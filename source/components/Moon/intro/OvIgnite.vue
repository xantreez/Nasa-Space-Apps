<script setup lang="ts">
// Launch overlay: countdown 3-2-1 (always completes) + INTERACTIVE ignition button (auto after 5 s).
import { onBeforeUnmount, ref } from "vue";
import { sfx } from "../../../moon/sfx";
import type { IntroApi } from "./api";

const cd = ref("");
const tick = ref(0);
const ready = ref(false);
let off: (() => void) | null = null;
let fireRes: (() => void) | null = null;

function fire() {
  if (!ready.value) return;
  ready.value = false;
  fireRes?.();
}

async function run(api: IntroApi) {
  const lineP = api.line("s4a");
  const gap = Math.max(0.85, (api.lineDur("s4a") - 1.0) / 3.6);
  await api.wait(0.35);
  for (const n of ["3", "2", "1"]) {
    if (!api.alive()) return;
    cd.value = n;
    tick.value++;
    sfx.countdown();
    await api.wait(gap);
  }
  await lineP;
  if (!api.alive()) return;
  api.hideSub();
  cd.value = "🔥";
  tick.value++;
  ready.value = true;
  sfx.beep();
  const p = new Promise<void>((res) => (fireRes = res));
  off = api.onKey((e, down) => { if (down) { e.preventDefault(); fire(); } });
  await Promise.race([p, api.wait(5.2).then(() => fire())]);
  off?.();
  cd.value = "";
}
defineExpose({ run });
onBeforeUnmount(() => off?.());
</script>

<template>
  <div class="mi-ov ig">
    <div v-if="cd" :key="tick" class="ig__num" :class="{ em: cd === '🔥' }"><i class="ig__ring" /><span>{{ cd }}</span></div>
    <Transition name="ign">
      <div v-if="ready" class="ig__box">
        <button class="mi-btn ig__btn" type="button" @click="fire">🔥 IGNITION</button>
        <div class="ig__hint">Tap to launch!<i class="ig__bar" /></div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.ig { pointer-events: none; }
.ig__num { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); display: grid; place-items: center; width: 260px; height: 260px; animation: ign 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
.ig__num span { font-family: "Fredoka", sans-serif; font-weight: 700; font-size: clamp(130px, 26vh, 230px); line-height: 1; color: #fff; -webkit-text-stroke: 8px rgba(255, 122, 61, 0.9); paint-order: stroke fill; text-shadow: 0 10px 40px rgba(255, 140, 60, 0.7); }
.ig__ring { position: absolute; inset: 10%; border-radius: 50%; border: 8px solid rgba(255, 210, 63, 0.9); animation: igr 0.8s ease-out forwards; }
.ig__num.em { top: 24%; }
.ig__num.em span { font-size: clamp(60px, 10vh, 96px); -webkit-text-stroke: 0; }
@keyframes ign { from { transform: translate(-50%, -50%) scale(1.8); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
@keyframes igr { from { transform: scale(0.6); opacity: 0.9; } to { transform: scale(1.9); opacity: 0; } }
.ig__box { position: absolute; left: 0; right: 0; bottom: calc(var(--bar) + 5vh); display: flex; flex-direction: column; align-items: center; gap: 10px; pointer-events: auto; }
.ig__btn { width: min(86vw, 440px); min-height: 84px; font-size: clamp(28px, 6.4vw, 38px); animation: igp 0.8s ease-in-out infinite; background: linear-gradient(180deg, #ff9f43, #ff3d3d); box-shadow: 0 7px 0 #a8200f, 0 16px 34px rgba(0, 0, 0, 0.45), inset 0 3px 0 rgba(255, 255, 255, 0.4); }
.ig__hint { font-family: "Fredoka", sans-serif; font-weight: 600; font-size: 17px; color: #fff; text-shadow: 0 2px 8px #000; }
.ig__bar { display: block; height: 4px; margin-top: 6px; border-radius: 4px; background: #ffd23f; animation: igb 5.2s linear forwards; }
@keyframes igp { 50% { transform: scale(1.05); box-shadow: 0 7px 0 #a8200f, 0 0 36px rgba(255, 90, 30, 0.7), inset 0 3px 0 rgba(255, 255, 255, 0.4); } }
@keyframes igb { from { width: 100%; } to { width: 0; } }
.ign-enter-active { transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s; }
.ign-leave-active { transition: transform 0.25s ease-in, opacity 0.25s; }
.ign-enter-from { transform: translateY(40px) scale(0.6); opacity: 0; }
.ign-leave-to { transform: scale(1.3); opacity: 0; }
@media (prefers-reduced-motion: reduce) { .ig__btn, .ig__num, .ig__ring { animation: none; } }
</style>
