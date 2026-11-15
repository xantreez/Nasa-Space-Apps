<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import type { Consequence } from "../../../moon/types";
import Btn from "./Btn.vue";
import Sheet from "./Sheet.vue";
import { RES, RES_KEYS } from "./meta";
import { sfx } from "../../../moon/sfx";

const props = defineProps<{ consequence: Consequence }>();
const emit = defineEmits<{ close: [] }>();

const go = ref(false);
const scroller = ref<HTMLElement | null>(null);
const active = ref(0);

// chosen first, then the alternatives
const cols = computed(() => {
  const c = props.consequence;
  const opts = [...c.decision.options].sort((a, b) => (a.id === c.chosenId ? -1 : b.id === c.chosenId ? 1 : 0));
  const score = (o: (typeof opts)[number]) => RES_KEYS.reduce((a, k) => a + (c.after[o.id][k] - (c.before as any)[k]), 0) + (o.science ?? 0) * 0.5;
  const ok = opts.filter((o) => !c.failedIf[o.id]);
  const best = ok.length > 1 ? ok.reduce((a, b) => (score(b) > score(a) ? b : a)).id : null;
  return opts.map((o) => ({
    o,
    chosen: o.id === c.chosenId,
    best: o.id === best,
    after: c.after[o.id],
    fail: c.failedIf[o.id] ?? null,
  }));
});
function d(after: Record<string, number>, k: string) {
  return after[k] - (props.consequence.before as any)[k];
}
// phone: one compact card at a time, switched by tabs or a swipe
function jump(i: number) {
  if (i < 0 || i >= cols.value.length || i === active.value) return;
  active.value = i;
  sfx.click();
}
let tx = 0, ty = 0;
function onTouchStart(e: TouchEvent) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }
function onTouchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) jump(active.value + (dx < 0 ? 1 : -1));
}
const tabLabel = (c: { chosen: boolean; o: { label: string; emoji: string } }) => (c.chosen ? "✅ Your choice" : `${c.o.emoji} ${c.o.label}`);
onMounted(async () => {
  sfx.pop();
  await nextTick();
  setTimeout(() => (go.value = true), 350);
});
</script>

<template>
  <Sheet wide tone="#ffd23f">
    <div class="mq">
      <div class="mq__tag">🔍 What happened</div>
      <h2 class="mq__title">{{ consequence.decision.title }}</h2>
      <p class="mq__sub">Here is your choice — and what would have happened if you'd picked differently!</p>

      <div v-if="cols.length > 1" class="mq__tabs" role="tablist">
        <button v-for="(c, i) in cols" :key="c.o.id" role="tab" :aria-selected="active === i" :class="{ on: active === i, ch: c.chosen }" @click="jump(i)">
          <span>{{ tabLabel(c) }}</span><i v-if="c.best">⭐</i>
        </button>
      </div>

      <div ref="scroller" class="mq__cols" @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd">
        <section v-for="(c, i) in cols" :key="c.o.id" class="mq__col" :class="{ 'is-chosen': c.chosen, 'is-fail': c.fail, 'is-active': active === i }" :style="{ '--i': i }">
          <div class="mq__ribbon">{{ c.chosen ? "✅ YOUR CHOICE" : "🤔 What if…" }}</div>
          <div v-if="c.best" class="mq__best">⭐ Best for supplies</div>
          <div class="mq__opt"><span class="mq__emoji">{{ c.o.emoji }}</span><span class="mq__label">{{ c.o.label }}</span></div>

          <div v-if="c.fail" class="mq__fail">💀 Outpost would fail: {{ RES[c.fail].label }}</div>

          <p class="mq__outcome">{{ c.o.outcome }}</p>

          <div class="mq__bars">
            <div v-for="(k, ki) in RES_KEYS" :key="k" class="mq__b" :style="{ '--c': RES[k].color, '--r': 0.35 + i * 0.15 + ki * 0.2 + 's' }">
              <span class="mq__bi">{{ RES[k].emoji }}</span>
              <span class="mq__track">
                <i class="mq__before" :style="{ width: consequence.before[k] + '%' }" />
                <i class="mq__after" :class="d(c.after, k) < 0 ? 'is-dn' : 'is-up'" :style="{ width: (go ? c.after[k] : consequence.before[k]) + '%', transitionDelay: 0.35 + i * 0.15 + ki * 0.2 + 's' }" />
              </span>
              <span class="mq__nums">{{ consequence.before[k] }}→<b>{{ c.after[k] }}</b></span>
              <span class="mq__delta" :class="d(c.after, k) > 0 ? 'is-up' : d(c.after, k) < 0 ? 'is-dn' : ''">{{ d(c.after, k) > 0 ? "+" : d(c.after, k) < 0 ? "−" : "±" }}{{ Math.abs(d(c.after, k)) }}</span>
            </div>
          </div>
          <div v-if="c.o.science" class="mq__sci">🔬 +{{ c.o.science }} Science</div>

          <div class="mq__lesson"><b>🎓 Lesson</b>{{ c.o.lesson }}</div>
        </section>
      </div>

      <div class="mq__cta"><Btn @click="emit('close')">Continue →</Btn></div>
    </div>
  </Sheet>
</template>

<style scoped>
.mq__tag { display: inline-block; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 14px; letter-spacing: 1px; text-transform: uppercase; padding: 5px 14px; border-radius: 99px; background: #ffd23f; color: #3a2e00; box-shadow: 0 3px 0 #b89500; }
.mq__title { margin: 10px 0 2px; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 28px; line-height: 1.15; }
.mq__sub { margin: 0 0 14px; color: rgba(255,255,255,.8); font-weight: 700; font-size: 15.5px; }
.mq__cols { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 14px; align-items: stretch; }
.mq__col { position: relative; display: flex; flex-direction: column; gap: 10px; padding: 16px 14px 14px; border-radius: 24px; background: rgba(255,255,255,.07); border: 2px solid rgba(255,255,255,.12); animation: pop .55s cubic-bezier(.34,1.56,.64,1) calc(.1s + var(--i) * .15s) both; }
.mq__col.is-chosen { background: linear-gradient(180deg, rgba(255,210,63,.2), rgba(255,210,63,.07)); border-color: #ffd23f; box-shadow: 0 0 0 3px rgba(255,210,63,.18), 0 10px 28px rgba(0,0,0,.3); }
.mq__col.is-fail { border-color: rgba(255,77,109,.7); }
.mq__ribbon { align-self: flex-start; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 13px; letter-spacing: .8px; padding: 3px 12px; border-radius: 99px; background: rgba(255,255,255,.16); }
.is-chosen .mq__ribbon { background: #ffd23f; color: #3a2e00; }
.mq__opt { display: flex; align-items: center; gap: 10px; }
.mq__emoji { font-size: 38px; line-height: 1; }
.mq__label { font-family: "Fredoka", sans-serif; font-weight: 600; font-size: 20px; line-height: 1.15; }
.mq__fail { padding: 8px 12px; border-radius: 14px; font-weight: 800; font-size: 15px; background: rgba(255,77,109,.25); border: 2px solid #ff4d6d; color: #ffd0d8; animation: wob 1.2s ease-in-out infinite; }
.mq__outcome { margin: 0; font-weight: 700; font-size: 16px; color: rgba(255,255,255,.94); }
.mq__bars { display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: 16px; background: rgba(0,0,0,.25); }
.mq__b { display: grid; grid-template-columns: 24px 1fr auto 40px; align-items: center; gap: 6px; font-size: 14px; font-weight: 800; }
.mq__track { position: relative; height: 12px; border-radius: 7px; background: rgba(255,255,255,.12); overflow: hidden; }
.mq__before { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(255,255,255,.3); border-radius: 7px; }
.mq__after { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 7px; background: var(--c); transition: width 1s cubic-bezier(.34,1.2,.64,1); mix-blend-mode: normal; opacity: .95; }
.mq__after.is-dn { background: linear-gradient(90deg, #ff8a5c, #ff4d6d); }
.mq__nums { color: rgba(255,255,255,.7); font-size: 13px; font-variant-numeric: tabular-nums; white-space: nowrap; } .mq__nums b { color: #fff; }
.mq__b { animation: rowin .5s ease var(--r) both; }
.mq__delta { animation: dpop .5s cubic-bezier(.34,1.56,.64,1) calc(var(--r) + .7s) both; }
.mq__best { align-self: flex-start; margin-top: -4px; padding: 3px 12px; border-radius: 99px; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 13px; letter-spacing: .6px; color: #1d3a00; background: linear-gradient(180deg, #b6ff9a, #6ee07a); box-shadow: 0 0 14px rgba(124,242,156,.55); animation: bestin .6s cubic-bezier(.34,1.56,.64,1) 1.6s both; }
@keyframes rowin { from { opacity: 0; transform: translateX(-10px); } }
@keyframes dpop { from { opacity: 0; transform: scale(.3); } }
@keyframes bestin { from { opacity: 0; transform: scale(.4) rotate(-6deg); } }
.mq__delta { text-align: right; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 15px; color: rgba(255,255,255,.6); }
.mq__delta.is-up { color: #7cf29c; } .mq__delta.is-dn { color: #ff8a9b; }
.mq__sci { align-self: flex-start; font-family: "Fredoka", sans-serif; font-weight: 700; padding: 3px 12px; border-radius: 99px; background: #7c5cd6; }
.mq__lesson { margin-top: auto; padding: 10px 12px; border-radius: 16px; background: rgba(79,209,255,.13); border: 1px solid rgba(79,209,255,.4); font-weight: 700; font-size: 15px; color: #dff4ff; }
.mq__lesson b { display: block; font-family: "Fredoka", sans-serif; font-size: 14px; letter-spacing: .5px; color: #4fd1ff; margin-bottom: 2px; }
.mq__dots { display: none; justify-content: center; gap: 8px; margin-top: 10px; }
.mq__dots button { width: 12px; height: 12px; padding: 0; border: 0; border-radius: 50%; background: rgba(255,255,255,.3); transition: all .25s cubic-bezier(.34,1.56,.64,1); }
.mq__dots button.on { background: #ffd23f; transform: scale(1.4); }
.mq__cta { display: flex; justify-content: flex-end; margin-top: 16px; }
@keyframes pop { from { opacity: 0; transform: translateY(26px) scale(.9); } }
@keyframes wob { 50% { transform: rotate(-1.2deg) scale(1.02); } }
.mq__tabs { display: none; }
@media (max-width: 640px) {
  .mq__tag { font-size: 11px; padding: 2px 10px; box-shadow: 0 2px 0 #b89500; }
  .mq__title { font-size: 20px; margin: 6px 0 6px; }
  .mq__sub { display: none; }
  .mq__tabs { display: flex; gap: 5px; margin-bottom: 8px; }
  .mq__tabs button { flex: 1 1 0; min-width: 0; min-height: 38px; padding: 4px 6px; border-radius: 12px; border: 1.5px solid rgba(255,255,255,.14); background: rgba(255,255,255,.07); color: rgba(255,255,255,.8); font: 700 12.5px/1.15 "Fredoka", sans-serif; display: flex; align-items: center; justify-content: center; gap: 3px; transition: all .2s; }
  .mq__tabs button span { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; text-align: center; }
  .mq__tabs button.on { background: rgba(255,255,255,.18); color: #fff; border-color: rgba(255,255,255,.5); }
  .mq__tabs button.ch.on { background: #ffd23f; color: #3a2e00; border-color: #ffd23f; }
  .mq__tabs button i { font-style: normal; font-size: 11px; }
  .mq__cols { display: block; }
  .mq__col:not(.is-active) { display: none; }
  .mq__col { gap: 7px; padding: 10px 10px 10px; border-radius: 18px; animation: tabin .3s ease both; }
  .mq__ribbon { display: none; }
  .mq__best { margin: 0; font-size: 11.5px; padding: 1px 9px; animation-delay: .9s; }
  .mq__emoji { font-size: 26px; } .mq__label { font-size: 17px; }
  .mq__outcome { font-size: 14px; line-height: 1.32; }
  .mq__fail { font-size: 13px; padding: 5px 10px; }
  .mq__bars { gap: 3px; padding: 6px 8px; border-radius: 12px; }
  .mq__b { grid-template-columns: 20px 1fr auto 34px; gap: 5px; font-size: 12.5px; } .mq__track { height: 9px; } .mq__nums { font-size: 12px; } .mq__delta { font-size: 13.5px; }
  .mq__sci { font-size: 13px; padding: 1px 10px; }
  .mq__lesson { font-size: 13px; padding: 6px 10px; border-radius: 12px; line-height: 1.3; } .mq__lesson b { font-size: 12px; display: inline; margin-right: 4px; }
  .mq__cta { display: block; margin-top: 8px; } .mq__cta :deep(.mbtn), .mq__cta .mbtn { width: 100%; min-height: 46px; font-size: 16px; }
  .mq__b { animation-delay: calc(var(--r) * .8); }
}
@media (max-width: 640px) and (max-height: 700px) { .mq__outcome { font-size: 13px; } .mq__lesson { font-size: 12.5px; } }
@keyframes tabin { from { opacity: 0; transform: translateX(14px); } }
@media (min-width: 900px) { .mq__title { font-size: 34px; } .mq__outcome { font-size: 17px; } .mq__label { font-size: 22px; } }
</style>
