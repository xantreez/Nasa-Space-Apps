<script setup lang="ts">
import { ref, watch, computed, onMounted } from "vue";
import { flyChips, trackPointer } from "./fly";
import type { Resources, Mission, ResKey } from "../../../moon/types";
import { RES, RES_KEYS, LOC, type MissionStatus } from "./meta";
import { useCount } from "./useCount";
import { sfx } from "../../../moon/sfx";
import Btn from "./Btn.vue";

const props = defineProps<{
  res: Resources;
  day: number;
  actions: number;
  actionsPerDay: number;
  science: number;
  mission: Mission;
  status: MissionStatus;
  weather: "calm" | "flare" | "storm" | "night";
}>();
const emit = defineEmits<{ endDay: []; openMission: [] }>();

const open = ref(false);
const muted = ref(false);
function toggleMute() {
  muted.value = !muted.value;
  sfx.setMuted(muted.value);
}
function toggleMission() {
  open.value = !open.value;
  sfx.click();
  if (open.value && !window.matchMedia("(max-width: 640px)").matches) emit("openMission");
}

// Count-up numbers
const counters = RES_KEYS.map((k) => ({ k, v: useCount(() => props.res[k], 700) }));
const sci = useCount(() => props.science, 700);

// Delta chips
let chipId = 0;
const chips = ref<{ id: number; k: ResKey | "science"; d: number }[]>([]);
function addChip(k: ResKey | "science", d: number) {
  const id = chipId++;
  chips.value.push({ id, k, d });
  setTimeout(() => (chips.value = chips.value.filter((c) => c.id !== id)), 1700);
}
const meters = ref<Record<string, HTMLElement | null>>({});
const bump = ref<Record<string, "up" | "dn" | "">>({});
function setBump(k: string, v: "up" | "dn") {
  bump.value = { ...bump.value, [k]: "" };
  requestAnimationFrame(() => {
    bump.value = { ...bump.value, [k]: v };
    setTimeout(() => (bump.value = { ...bump.value, [k]: "" }), 900);
  });
}
onMounted(trackPointer);
watch(
  () => ({ ...props.res }),
  (n, o) => {
    let up = false;
    RES_KEYS.forEach((k) => {
      const d = n[k] - o[k];
      if (d === 0) return;
      if (d > 0) {
        up = true;
        flyChips(meters.value[k], RES[k].color, RES[k].emoji, d, () => { setBump(k, "up"); addChip(k, d); sfx.rewardTick?.(); });
      } else {
        setBump(k, "dn");
        addChip(k, d);
      }
    });
    if (up) sfx.pop();
  }
);
watch(
  () => props.science,
  (n, o) => n !== o && addChip("science", n - o)
);

const low = computed(() => RES_KEYS.some((k) => props.res[k] <= 25));
watch(low, (v) => v && sfx.alarm());

const pips = computed(() => Array.from({ length: props.actionsPerDay }, (_, i) => i < props.actions));
const tasksText = computed(() => props.status.tasks.map((t) => `${LOC[t.location].emoji} ${Math.min(t.have, t.need)}/${t.need}`));
function replay() {
  open.value = false;
  emit("openMission");
}
const wIcon = computed(() => ({ calm: "🌙", flare: "☀️", storm: "🧲", night: "🌑" }[props.weather]));
</script>

<template>
  <div class="mh">
    <!-- resources -->
    <div class="mh__res">
      <div
        v-for="c in counters"
        :key="c.k"
        class="mh__m"
        :ref="(el: any) => (meters[c.k] = el)"
        :class="[{ 'mh__m--low': res[c.k] <= 25 }, bump[c.k] ? 'bump-' + bump[c.k] : '']"
        :style="{ '--c': RES[c.k].color }"
        :title="RES[c.k].label"
      >
        <span class="mh__ic">{{ RES[c.k].emoji }}</span>
        <span class="mh__bar"><i :style="{ width: Math.max(0, Math.min(100, res[c.k])) + '%' }" /></span>
        <b class="mh__num">{{ c.v.value }}</b>
        <span class="mh__lbl">{{ RES[c.k].label }}</span>
        <TransitionGroup name="chip" tag="span" class="mh__chips">
          <span v-for="ch in chips.filter((x) => x.k === c.k)" :key="ch.id" class="mh__chip" :class="ch.d > 0 ? 'is-up' : 'is-dn'">
            {{ ch.d > 0 ? "+" : "" }}{{ ch.d }} {{ RES[c.k].emoji }}
          </span>
        </TransitionGroup>
      </div>
    </div>

    <!-- day / actions / science / end day -->
    <div class="mh__row">
      <div class="mh__pill mh__day"><span class="mh__wi">{{ wIcon }}</span> Day <b>{{ day }}</b></div>
      <div class="mh__pill mh__act" title="Actions left today">
        <span class="mh__pips"><i v-for="(p, i) in pips" :key="i" :class="{ on: p }" /></span>
        <span class="mh__small">{{ actions }} left</span>
      </div>
      <div class="mh__pill mh__sci" :style="{ '--c': RES.science.color }">
        🔬 <b>{{ sci }}</b>
        <TransitionGroup name="chip" tag="span" class="mh__chips mh__chips--sci">
          <span v-for="ch in chips.filter((x) => x.k === 'science')" :key="ch.id" class="mh__chip is-up">+{{ ch.d }} 🔬</span>
        </TransitionGroup>
      </div>
      <button class="mh__pill mh__mute" :aria-label="muted ? 'Sound off' : 'Sound on'" @click="toggleMute">{{ muted ? "🔇" : "🔊" }}</button>
      <div class="mh__spacer" />
      <Btn variant="blue" class="mh__end" :class="{ 'mh__end--pulse': actions === 0 }" @click="emit('endDay')">End day 🌙</Btn>
    </div>

    <!-- mission chip -->
    <button class="mh__mission" :class="{ 'is-open': open }" @click="toggleMission">
      <span class="mh__mhead">
        <span class="mh__mnum">Mission {{ mission.index }}</span>
        <span class="mh__mshort">M{{ mission.index }}</span>
        <span class="mh__mtitle">{{ mission.title }}</span>
        <span class="mh__mtasks">
          <span v-for="(t, i) in tasksText" :key="i" class="mh__task" :class="{ done: status.tasks[i].have >= status.tasks[i].need }">{{ t }}</span>
          <span v-if="status.scienceNeeded" class="mh__task" :class="{ done: science >= status.scienceNeeded }">🔬 {{ Math.min(science, status.scienceNeeded) }}/{{ status.scienceNeeded }}</span>
          <span v-if="mission.decisionId" class="mh__task" :class="{ done: status.decisionDone }">🤔 {{ status.decisionDone ? 1 : 0 }}/1</span>
        </span>
        <span class="mh__caret">{{ open ? "▲" : "▼" }}</span>
      </span>
      <Transition name="goal">
        <span v-if="open" class="mh__goal">🎯 {{ mission.goal }}</span>
      </Transition>
    </button>
    <Transition name="goal">
      <div v-if="open" class="mh__panel">
        <div class="mh__ptitle">Mission {{ mission.index }} · {{ mission.title }}</div>
        <div class="mh__pgoal">🎯 {{ mission.goal }}</div>
        <div class="mh__pbtns">
          <span class="mh__psci">🔬 Science <b>{{ sci }}</b></span>
          <button class="mh__pbtn" @click="replay">📡 Replay briefing</button>
          <button class="mh__pbtn" :aria-label="muted ? 'Sound on' : 'Sound off'" @click="toggleMute">{{ muted ? "🔇" : "🔊" }}</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.mh {
  position: absolute; top: 0; left: 0; right: 0; z-index: 30; display: flex; flex-direction: column; gap: 8px;
  padding: 10px 12px; pointer-events: none; font-family: "Nunito", sans-serif; color: #fff;
  background: linear-gradient(180deg, rgba(5, 12, 30, 0.55), transparent);
}
.mh > * { pointer-events: auto; }
.mh__res { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.mh__m {
  position: relative; display: grid; grid-template-columns: auto 1fr; grid-template-areas: "ic num" "bar bar" "lbl lbl";
  align-items: center; column-gap: 6px; row-gap: 3px; padding: 7px 10px 8px; border-radius: 18px; min-width: 0;
  background: rgba(12, 24, 48, 0.72); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.12); box-shadow: 0 3px 0 rgba(0, 0, 0, 0.25);
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.mh__ic { grid-area: ic; font-size: 20px; line-height: 1; }
.mh__num { grid-area: num; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 19px; text-align: right; font-variant-numeric: tabular-nums; }
.mh__bar { grid-area: bar; height: 10px; border-radius: 6px; background: rgba(255, 255, 255, 0.14); overflow: hidden; box-shadow: inset 0 2px 3px rgba(0,0,0,.3); }
.mh__bar i { display: block; height: 100%; border-radius: 6px; background: linear-gradient(180deg, color-mix(in srgb, var(--c) 70%, #fff), var(--c)); transition: width 0.7s cubic-bezier(0.34, 1.3, 0.64, 1); }
.mh__lbl { grid-area: lbl; display: none; font-size: 13px; font-weight: 800; color: rgba(255, 255, 255, 0.75); }
.mh__m--low { border-color: #ff4d6d; animation: lowpulse 0.9s ease-in-out infinite; }
.mh__m--low .mh__bar i { background: linear-gradient(180deg, #ff8a9b, #ff3b5c); }
.mh__m--low .mh__num { color: #ff8a9b; }
.mh__chips { position: absolute; left: 0; right: 0; top: 100%; display: flex; flex-direction: column; align-items: center; pointer-events: none; z-index: 5; }
.mh__chip {
  margin-top: 2px; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 15px; padding: 3px 10px; border-radius: 99px;
  white-space: nowrap; box-shadow: 0 3px 10px rgba(0, 0, 0, 0.35);
}
.mh__chip.is-up { background: #2fcf6b; } .mh__chip.is-dn { background: #ff4d6d; }
.chip-enter-active { animation: chipin 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
.chip-leave-active { transition: all 0.5s ease; position: absolute; }
.chip-leave-to { opacity: 0; transform: translateY(-12px); }
@keyframes chipin { from { opacity: 0; transform: translateY(-14px) scale(0.5); } }
.mh__m.bump-up { animation: bumpup 0.7s cubic-bezier(0.34, 1.56, 0.64, 1); border-color: var(--c); }
.mh__m.bump-up .mh__bar i { filter: brightness(1.4); }
.mh__m.bump-dn { animation: bumpdn 0.5s ease; }
@keyframes bumpup { 0% { transform: scale(1); box-shadow: 0 0 0 0 var(--c); } 35% { transform: scale(1.14); box-shadow: 0 0 22px 2px var(--c); } 100% { transform: scale(1); box-shadow: 0 3px 0 rgba(0,0,0,.25); } }
@keyframes bumpdn { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-5px); background: rgba(120,20,40,.8); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(3px); } }
@keyframes lowpulse { 50% { transform: scale(1.05); box-shadow: 0 0 18px rgba(255, 77, 109, 0.7); } }

.mh__row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.mh__pill {
  position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; min-height: 40px; border-radius: 16px;
  background: rgba(12, 24, 48, 0.72); backdrop-filter: blur(14px); border: 1px solid rgba(255, 255, 255, 0.12);
  font-family: "Fredoka", sans-serif; font-weight: 600; font-size: 16px; color: #fff; box-shadow: 0 3px 0 rgba(0,0,0,.25);
}
.mh__day b { font-size: 20px; color: #ffd23f; }
.mh__pips { display: flex; gap: 5px; }
.mh__pips i { width: 14px; height: 14px; border-radius: 50%; background: rgba(255, 255, 255, 0.18); transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.mh__pips i.on { background: radial-gradient(circle at 35% 30%, #fff3a8, #ffd23f); box-shadow: 0 0 8px #ffd23f; }
.mh__small { font-size: 13px; font-family: "Nunito", sans-serif; font-weight: 800; color: rgba(255, 255, 255, 0.75); }
.mh__sci b { color: var(--c); font-size: 18px; min-width: 1.4em; }
.mh__chips--sci { top: 100%; }
.mh__mute { cursor: pointer; font-size: 18px; width: 40px; justify-content: center; padding: 0; }
.mh__spacer { flex: 1; }
.mh__end { min-height: 44px !important; padding: 6px 18px !important; font-size: 16px !important; }
.mh__end--pulse { animation: endpulse 1s ease-in-out infinite; }
@keyframes endpulse { 50% { transform: scale(1.08); } }

.mh__mission {
  align-self: flex-start; max-width: 100%; text-align: left; cursor: pointer; color: #fff; font-family: inherit; padding: 8px 14px;
  border-radius: 18px; background: rgba(12, 24, 48, 0.78); backdrop-filter: blur(14px); border: 1px solid rgba(255, 215, 80, 0.35);
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.25); display: flex; flex-direction: column; gap: 6px; min-height: 44px; justify-content: center;
  transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.mh__mission:active { transform: scale(0.97); }
.mh__mhead { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.mh__mnum { font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #ffd23f; }
.mh__mtitle { font-family: "Fredoka", sans-serif; font-weight: 600; font-size: 16px; }
.mh__mtasks { display: inline-flex; gap: 6px; flex-wrap: wrap; }
.mh__task { font-weight: 800; font-size: 14.5px; padding: 2px 9px; border-radius: 99px; background: rgba(255, 255, 255, 0.14); transition: all .3s; }
.mh__task.done { background: #2fcf6b; text-decoration: none; }
.mh__caret { font-size: 11px; opacity: 0.7; }
.mh__goal { font-weight: 700; font-size: 15.5px; line-height: 1.4; color: #eaf6ff; max-width: 520px; }
.goal-enter-active { animation: goalin 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes goalin { from { opacity: 0; transform: translateY(-8px); } }

.mh__mshort, .mh__panel { display: none; }
/* phone: meters strip + one slim row (Day · pips · mission chip · End day); the mission opens as an overlay */
@media (max-width: 640px) {
  .mh { flex-direction: row; flex-wrap: wrap; align-items: center; gap: 5px; padding: calc(6px + env(safe-area-inset-top)) 8px 4px; background: linear-gradient(180deg, rgba(5, 12, 30, 0.7), rgba(5,12,30,0)); }
  .mh__res { width: 100%; gap: 4px; }
  .mh__m { grid-template-columns: auto auto; grid-template-areas: "ic num" "bar bar"; justify-content: center; column-gap: 4px; row-gap: 3px; padding: 4px 4px 5px; border-radius: 12px; box-shadow: 0 2px 0 rgba(0,0,0,.25); }
  .mh__ic { font-size: 14px; }
  .mh__num { font-size: 15px; text-align: left; }
  .mh__bar { height: 5px; }
  .mh__chip { font-size: 12px; padding: 1px 7px; }
  .mh__row { display: contents; }
  .mh__sci, .mh__mute, .mh__spacer { display: none; }
  .mh__pill { min-height: 32px; padding: 2px 8px; font-size: 14px; gap: 4px; border-radius: 12px; box-shadow: 0 2px 0 rgba(0,0,0,.25); order: 1; }
  .mh__day b { font-size: 16px; }
  .mh__wi { display: none; }
  .mh__act { order: 2; padding: 2px 7px; }
  .mh__pips { gap: 3px; } .mh__pips i { width: 9px; height: 9px; }
  .mh__small { display: none; }
  .mh__end { order: 4; margin-left: auto; padding: 4px 10px !important; font-size: 13.5px !important; white-space: nowrap; min-height: 32px !important; border-radius: 12px !important; }
  .mh__mission { order: 3; flex: 1 1 0; min-width: 0; align-self: auto; min-height: 32px; padding: 3px 8px; border-radius: 12px; }
  .mh__mhead { flex-wrap: nowrap; gap: 5px; overflow: hidden; }
  .mh__mnum, .mh__mtitle, .mh__caret { display: none; }
  .mh__mshort { display: inline; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 13px; color: #ffd23f; }
  .mh__mtasks { flex-wrap: nowrap; gap: 3px; }
  .mh__task { font-size: 12.5px; padding: 1px 6px; white-space: nowrap; }
  .mh__goal { display: none; }
  .mh__panel {
    display: block; position: absolute; z-index: 40; top: 100%; left: 8px; right: 8px; margin-top: 2px; padding: 12px 14px; border-radius: 18px;
    background: rgba(12, 24, 48, 0.94); backdrop-filter: blur(14px); border: 1px solid rgba(255, 215, 80, 0.4); box-shadow: 0 12px 30px rgba(0,0,0,.5);
  }
  .mh__ptitle { font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 16px; color: #ffd23f; }
  .mh__pgoal { margin: 4px 0 10px; font-weight: 700; font-size: 14.5px; line-height: 1.35; color: #eaf6ff; }
  .mh__pbtns { display: flex; align-items: center; gap: 8px; }
  .mh__psci { font-weight: 800; font-size: 14px; flex: 1; } .mh__psci b { color: #c4b2ff; }
  .mh__pbtn { min-height: 38px; padding: 4px 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.1); color: #fff; font: 800 13.5px "Nunito", sans-serif; }
}
@media (min-width: 900px) {
  .mh { padding: 14px 18px; gap: 10px; flex-direction: row; flex-wrap: wrap; align-items: flex-start; }
  .mh__res { gap: 10px; flex: 0 1 auto; grid-template-columns: repeat(5, 118px); }
  .mh__lbl { display: block; }
  .mh__m { padding: 9px 12px 10px; }
  .mh__num { font-size: 22px; }
  .mh__ic { font-size: 24px; }
  .mh__bar { height: 12px; }
  .mh__row { flex: 1; justify-content: flex-end; flex-wrap: nowrap; }
  .mh__spacer { display: none; }
  .mh__mission { flex-basis: 100%; align-self: flex-start; flex: none; }
  .mh__pill { font-size: 18px; }
}
</style>
