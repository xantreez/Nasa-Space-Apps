<script setup lang="ts">
import { computed, onMounted } from "vue";
import type { SpaceWeatherEvent, ResKey } from "../../../moon/types";
import Btn from "./Btn.vue";
import Sheet from "./Sheet.vue";
import { RES } from "./meta";
import { sfx } from "../../../moon/sfx";

const props = defineProps<{ event: SpaceWeatherEvent; day: number; sheltered: boolean }>();
const emit = defineEmits<{ close: [] }>();

const KIND = {
  FLR: { icon: "☀️", name: "Solar flare", color: "#ffb02e" },
  CME: { icon: "💥", name: "Coronal mass ejection", color: "#ff7a45" },
  GST: { icon: "🧲", name: "Geomagnetic storm", color: "#c06bff" },
  SEP: { icon: "⚡", name: "Radiation particles", color: "#ff5c7a" },
  QUIET: { icon: "😌", name: "Quiet Sun", color: "#7cf29c" },
} as const;
const k = computed(() => KIND[props.event.kind] ?? KIND.QUIET);
const effects = computed(() =>
  (Object.entries(props.event.effect) as [ResKey, number][]).filter(([, v]) => v).map(([key, v]) => ({ key, v }))
);
const date = computed(() => {
  const d = new Date(props.event.time);
  return isNaN(+d) ? props.event.time : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
});
const levels = ["Quiet", "Mild", "Strong", "EXTREME"];
onMounted(() => (props.event.severity >= 2 ? sfx.alarm() : sfx.pop()));
</script>

<template>
  <Sheet :tone="k.color">
    <div class="me">
      <div class="me__head">Space weather report · Day {{ day }}</div>
      <div class="me__hero" :style="{ '--c': k.color }">
        <div class="me__icon" :class="{ 'me__icon--hot': event.severity >= 2 }">{{ k.icon }}</div>
        <div class="me__hero-t">
          <div class="me__kind">{{ k.name }}</div>
          <div v-if="event.kind !== 'QUIET'" class="me__mag">{{ event.magnitude }}</div>
        </div>
      </div>
      <h2 class="me__title">{{ event.title }}</h2>
      <p class="me__text">{{ event.text }}</p>

      <div class="me__sev">
        <span class="me__sev-l">Danger level: <b>{{ levels[event.severity] }}</b></span>
        <span class="me__sev-bars"><i v-for="n in 3" :key="n" :class="{ on: n <= event.severity }" :style="{ '--d': n * 0.12 + 's' }" /></span>
      </div>

      <div v-if="effects.length" class="me__fx">
        <span class="me__fx-l">Expected hit:</span>
        <span v-for="(e, i) in effects" :key="e.key" class="me__chip" :style="{ '--i': i }">
          {{ RES[e.key].emoji }} {{ e.v > 0 ? "+" : "−" }}{{ Math.abs(e.v) }}
        </span>
      </div>
      <div v-if="sheltered" class="me__shelter">🛡️ Shelter protected you: damage reduced</div>

      <a class="me__src" :href="event.source.url" target="_blank" rel="noopener">
        🛰️ Real NASA DONKI event · {{ date }}<span class="me__ext"> ↗</span>
      </a>

      <div class="me__cta"><Btn @click="emit('close')">{{ event.kind === "QUIET" ? "Great, let's work! →" : "Got it, Commander →" }}</Btn></div>
    </div>
  </Sheet>
</template>

<style scoped>
.me__head { font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 14px; letter-spacing: 1.4px; text-transform: uppercase; color: rgba(255,255,255,.7); text-align: center; }
.me__hero { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 12px 0 6px; }
.me__icon { font-size: 76px; line-height: 1; filter: drop-shadow(0 0 22px var(--c)); animation: ico 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both, bob 2.6s ease-in-out 0.8s infinite; }
.me__icon--hot { animation: ico 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both, rumble 0.35s linear 0.8s 4; }
.me__kind { font-family: "Fredoka", sans-serif; font-weight: 600; font-size: 20px; color: #fff; }
.me__mag { display: inline-block; margin-top: 4px; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 22px; padding: 2px 14px; border-radius: 99px; background: var(--c); color: #1a1230; box-shadow: 0 4px 0 color-mix(in srgb, var(--c) 55%, #000); }
.me__title { margin: 6px 0 6px; text-align: center; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 28px; line-height: 1.15; }
.me__text { margin: 0 0 14px; text-align: center; color: rgba(255,255,255,.92); font-weight: 700; }
.me__sev { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 12px; font-weight: 800; }
.me__sev-bars { display: flex; gap: 5px; }
.me__sev-bars i { width: 34px; height: 14px; border-radius: 8px; background: rgba(255,255,255,.16); }
.me__sev-bars i.on { background: linear-gradient(90deg, #ffd23f, #ff4d6d); animation: grow .5s cubic-bezier(.34,1.56,.64,1) var(--d) both; }
.me__fx { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px; margin-bottom: 8px; }
.me__fx-l { font-weight: 800; color: rgba(255,255,255,.75); font-size: 15px; }
.me__chip { font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 18px; padding: 5px 14px; border-radius: 99px; background: rgba(255, 77, 109, .25); border: 2px solid #ff4d6d; animation: chip .5s cubic-bezier(.34,1.56,.64,1) calc(.3s + var(--i) * .1s) both; }
.me__shelter { text-align: center; margin: 8px 0; padding: 10px 14px; border-radius: 16px; font-weight: 800; background: rgba(124,242,156,.18); border: 2px solid #7cf29c; color: #c8ffd8; animation: chip .5s cubic-bezier(.34,1.56,.64,1) .5s both; }
.me__src { display: block; text-align: center; margin-top: 12px; font-weight: 800; font-size: 15px; color: #9bdcff; text-decoration: none; padding: 8px; border-radius: 12px; background: rgba(79,209,255,.1); }
.me__src:hover { background: rgba(79,209,255,.2); }
.me__cta { display: flex; justify-content: center; margin-top: 14px; }
@keyframes ico { from { opacity: 0; transform: scale(0.2) rotate(-90deg); } }
@keyframes bob { 50% { transform: translateY(-7px) scale(1.04); } }
@keyframes rumble { 25% { transform: translate(-3px, 2px) rotate(-3deg); } 75% { transform: translate(3px, -2px) rotate(3deg); } }
@keyframes grow { from { transform: scaleX(0); opacity: 0; } }
@keyframes chip { from { opacity: 0; transform: scale(0.3); } }
@media (max-width: 640px) {
  .me__head { font-size: 11.5px; }
  .me__hero { margin: 6px 0 2px; gap: 12px; }
  .me__icon { font-size: 46px; } .me__kind { font-size: 16px; } .me__mag { font-size: 17px; }
  .me__title { font-size: 21px; margin: 2px 0 4px; }
  .me__text { font-size: 14.5px; margin-bottom: 8px; line-height: 1.35; }
  .me__sev { margin-bottom: 8px; font-size: 14px; } .me__sev-bars i { width: 24px; height: 11px; }
  .me__fx-l { font-size: 13px; } .me__chip { font-size: 15px; padding: 2px 11px; }
  .me__shelter { font-size: 13.5px; padding: 6px 10px; margin: 6px 0; }
  .me__src { font-size: 13px; padding: 5px; margin-top: 6px; }
  .me__cta :deep(.mbtn), .me__cta .mbtn { width: 100%; min-height: 46px; }
}
@media (max-width: 640px) and (max-height: 700px) { .me__icon { font-size: 38px; } .me__text { font-size: 13.5px; } }
@media (min-width: 900px) { .me__icon { font-size: 92px; } .me__title { font-size: 34px; } }
</style>
