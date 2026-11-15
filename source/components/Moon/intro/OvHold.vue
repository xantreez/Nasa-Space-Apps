<script setup lang="ts">
// Emergency overlay: warnings + stability gauge + INTERACTIVE "HOLD to stabilize!" (the engine fails no matter what: it is the story).
import { onBeforeUnmount, ref } from "vue";
import { gsap } from "gsap";
import { sfx } from "../../../moon/sfx";
import type { IntroApi } from "./api";

const showHold = ref(false);
const holding = ref(false);
const failed = ref(false);
const prog = ref(0);
const warns = ref<string[]>([]);
const failText = ref("");
const needle = ref(-110);
const redOn = ref(true);
let off: (() => void) | null = null;
let tick: (() => void) | null = null;
const cleanups: (() => void)[] = [];

const pt = (a: number, r: number) => { const t = ((a - 90) * Math.PI) / 180; return [120 + Math.cos(t) * r, 120 + Math.sin(t) * r]; };
const arc = (g0: number, g1: number, r: number) => {
  const a0 = -120 + 240 * g0, a1 = -120 + 240 * g1;
  const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
};
const segs = [{ a: 0, b: 0.35, c: "#ff4d5a" }, { a: 0.35, b: 0.6, c: "#ffb74d" }, { a: 0.6, b: 0.86, c: "#2fe08a" }, { a: 0.86, b: 1, c: "#ffb74d" }];

async function run(api: IntroApi) {
  let g = 0.1, heldT = 0, t = 0, since = 0, isHeld = false, auto = false;
  const setHeld = (v: boolean) => { if (failed.value || !showHold.value) return; isHeld = v; holding.value = v; if (v) sfx.click(); };

  sfx.alarm();
  let alarm = true;
  (async () => { while (alarm && api.alive()) { await api.wait(2.4); if (alarm) sfx.alarm(); } })();
  const rumble = () => { if (alarm && api.alive()) { api.shake(failed.value ? 18 : 6, 0.7); api.wait(0.65).then(rumble); } };
  rumble();
  const s5a = api.line("s5a");
  api.wait(0.9).then(() => { warns.value = ["⚠ ENGINE 2 FAILURE"]; });
  api.wait(2).then(() => { warns.value = ["⚠ ENGINE 2 FAILURE", "⚠ LOSING ALTITUDE"]; });
  await api.wait(1.2);
  showHold.value = true;
  sfx.beep();

  const host = document.querySelector(".mi") as HTMLElement;
  const pd = (e: PointerEvent) => { if ((e.target as HTMLElement)?.closest?.(".mi-skip")) return; setHeld(true); };
  const pu = () => setHeld(false);
  host.addEventListener("pointerdown", pd);
  window.addEventListener("pointerup", pu);
  window.addEventListener("pointercancel", pu);
  off = api.onKey((e, down) => { e.preventDefault(); setHeld(down); });
  const cleanup = () => { host.removeEventListener("pointerdown", pd); window.removeEventListener("pointerup", pu); window.removeEventListener("pointercancel", pu); off?.(); };
  cleanups.push(cleanup);

  await new Promise<void>((res) => {
    let last = performance.now();
    tick = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; t += dt; since += dt;
      if (!failed.value) {
        if (!isHeld && since > 5.5 && !auto) { auto = true; isHeld = true; holding.value = true; }
        if (isHeld) heldT += dt; else heldT = Math.max(0, heldT - dt * 0.6);
        const jitter = (0.04 + heldT * 0.025) * Math.sin(t * 23) + 0.03 * Math.sin(t * 9.1);
        const target = isHeld ? Math.min(0.88, 0.22 + heldT * 0.32) : 0.1;
        g += (target + jitter - g) * Math.min(1, dt * 7);
        prog.value = Math.min(1, heldT / 2.4);
        if (heldT >= 2.4 || since > 11) { failed.value = true; isHeld = false; holding.value = false; res(); }
      } else g += (0 - g) * Math.min(1, dt * 9);
      needle.value = -120 + 240 * Math.max(0, Math.min(1, g));
    };
    gsap.ticker.add(tick);
  });
  if (tick) gsap.ticker.remove(tick);
  cleanup();
  if (!api.alive()) return;
  sfx.explosion();
  api.shake(24, 1.6);
  failText.value = "CAN'T STABILIZE!";
  warns.value = ["✖ ENGINE 2 OFFLINE", "✖ ENGINE 1 OFFLINE", "⚠ LOSING ALTITUDE"];
  await s5a;
  await api.wait(0.6);
  alarm = false;
}
defineExpose({ run });
onBeforeUnmount(() => { if (tick) gsap.ticker.remove(tick); cleanups.forEach((f) => f()); off?.(); });
</script>

<template>
  <div class="mi-ov hd">
    <div v-if="redOn" class="hd__red" />
    <div class="hd__warns"><TransitionGroup name="wn"><div v-for="w in warns" :key="w" class="hd__chip" :class="{ off: w.startsWith('✖') }">{{ w }}</div></TransitionGroup></div>
    <Transition name="ft"><div v-if="failText" class="hd__fail">{{ failText }}</div></Transition>
    <Transition name="hb">
      <div v-if="showHold" class="hd__box">
        <svg class="hd__gauge" viewBox="0 20 240 170" aria-hidden="true">
          <circle cx="120" cy="120" r="82" fill="rgba(8,12,26,.75)" stroke="rgba(255,255,255,.25)" stroke-width="3" />
          <path v-for="(s, i) in segs" :key="i" :d="arc(s.a, s.b, 66)" :stroke="s.c" stroke-width="12" fill="none" />
          <g :transform="`rotate(${needle} 120 120)`"><polygon points="115,120 120,52 125,120" fill="#fff" /></g>
          <circle cx="120" cy="120" r="9" fill="#2b3350" stroke="#fff" stroke-width="2.5" />
        </svg>
        <button class="mi-btn hd__btn" :class="{ down: holding, dead: failed }" type="button" :disabled="failed">
          <i class="hd__fill" :style="{ width: prog * 100 + '%' }" />
          <span>{{ failed ? "✖ ENGINE LOST" : holding ? "HOLD…" : "HOLD to stabilize!" }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.hd { pointer-events: none; }
.hd__red { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 50%, rgba(255, 26, 42, 0) 35%, rgba(255, 26, 42, 0.5) 100%); animation: hdr 0.9s ease-in-out infinite; }
@keyframes hdr { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.95; } }
.hd__warns { position: absolute; top: calc(var(--bar) + 12px); left: 0; right: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 0 80px; }
.hd__chip { font-family: "Fredoka", sans-serif; font-weight: 700; font-size: clamp(13px, 1.6vw, 18px); letter-spacing: 0.06em; padding: 5px 14px; border-radius: 10px; background: rgba(120, 10, 20, 0.85); border: 2px solid #ff4d5a; color: #fff; animation: hdb 0.7s steps(2) infinite; box-shadow: 0 0 18px rgba(255, 40, 60, 0.5); }
.hd__chip.off { background: #d4121f; }
@keyframes hdb { 50% { opacity: 0.6; } }
.wn-enter-active { transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s; }
.wn-enter-from { transform: translateY(-14px) scale(0.8); opacity: 0; }
.hd__fail { position: absolute; left: 0; right: 0; top: 30%; text-align: center; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: clamp(28px, 6vw, 64px); color: #fff; text-shadow: 0 0 20px #ff1a2a, 0 4px 0 #8a0f1a; }
.ft-enter-active { transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s; }
.ft-enter-from { transform: scale(2.2); opacity: 0; }
.hd__box { position: absolute; left: 0; right: 0; bottom: calc(var(--bar) + 118px); display: flex; flex-direction: column; align-items: center; gap: 4px; pointer-events: auto; }
.hd__gauge { width: min(40vw, 190px); }
.hd__btn { position: relative; overflow: hidden; width: min(86vw, 440px); min-height: 72px; font-size: clamp(22px, 5.2vw, 30px); background: linear-gradient(180deg, #4fb4ff, #2a6bd8); box-shadow: 0 7px 0 #153f99, 0 14px 30px rgba(0, 0, 0, 0.45), inset 0 2px 0 rgba(255, 255, 255, 0.4); animation: hdp 0.8s ease-in-out infinite; touch-action: none; }
.hd__btn.down { animation: none; }
.hd__btn.dead { background: #55303a; box-shadow: 0 4px 0 #2a1018; animation: none; opacity: 0.8; }
.hd__btn span { position: relative; z-index: 1; }
.hd__fill { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(47, 224, 138, 0.55); transition: width 0.08s linear; }
@keyframes hdp { 50% { transform: scale(1.05); } }
.hb-enter-active { transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s; }
.hb-leave-active { transition: opacity 0.2s; }
.hb-enter-from { transform: translateY(40px) scale(0.7); opacity: 0; }
.hb-leave-to { opacity: 0; }
@media (max-height: 560px) { .hd__gauge { display: none; } }
@media (prefers-reduced-motion: reduce) { .hd__btn, .hd__chip, .hd__red { animation: none; } }
</style>
