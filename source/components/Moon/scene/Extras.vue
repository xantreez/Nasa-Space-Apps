<script setup lang="ts">
// Late-game growth: colony (extra domes + tubes) and the city skyline with a rover and a flag.
// Base centre at (0,0). `lightsOnly` draws just the glowing windows (above the night wash).
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { rng } from "./util";

const props = defineProps<{ kind: "colony" | "city"; x: number; y: number; s: number; on: boolean; night: boolean; lightsOnly?: boolean }>();

const ready = ref(false);
onMounted(() => nextTick(() => (ready.value = true)));
const popped = ref(false);
let popT = 0;
watch(() => props.on, (v) => {
  if (!v || !ready.value) return;
  popped.value = true;
  clearTimeout(popT);
  popT = window.setTimeout(() => (popped.value = false), 1400);
});
onBeforeUnmount(() => clearTimeout(popT));

const towers = [
  { x: -20, w: 30, h: 118, dome: false, back: false }, { x: -72, w: 26, h: 84, dome: false, back: false },
  { x: 40, w: 28, h: 96, dome: true, back: false }, { x: -112, w: 22, h: 58, dome: false, back: true },
  { x: 84, w: 22, h: 68, dome: false, back: true }, { x: -48, w: 20, h: 100, dome: false, back: true },
  { x: 14, w: 18, h: 70, dome: false, back: true },
];
const wins = computed(() => {
  const r = rng(91);
  return towers.map((t) => {
    let d = "";
    const cols = Math.max(2, Math.floor(t.w / 10));
    const rows = Math.floor((t.h - 14) / 14);
    for (let c = 0; c < cols; c++)
      for (let k = 0; k < rows; k++)
        if (r() < 0.78) d += `M ${t.x + 4 + c * ((t.w - 8) / cols) + 1} ${-t.h + 12 + k * 14} h 4.6 v 7 h -4.6 z `;
    return d;
  });
});
const tre = 0;
void tre;
</script>

<template>
  <g :transform="`translate(${x} ${y}) scale(${s})`" :class="{ night }">
    <!-- ============ CITY ============ -->
    <Transition v-if="kind === 'city'" name="pop">
      <g v-if="on" class="pop">
        <template v-if="!lightsOnly">
          <ellipse cx="0" cy="6" rx="206" ry="16" fill="#6b7190" opacity=".3" />
          <ellipse cx="0" cy="3" rx="196" ry="11" fill="#b8bccb" />
          <!-- back towers -->
          <g v-for="(t, i) in towers.filter((q) => q.back)" :key="'b' + i" opacity=".85">
            <rect :x="t.x" :y="-t.h" :width="t.w" :height="t.h" rx="7" fill="#c2c9df" />
            <rect :x="t.x" :y="-t.h" :width="t.w * 0.35" :height="t.h" rx="4" fill="#fff" opacity=".45" />
          </g>
          <!-- low domes + tubes -->
          <rect x="-150" y="-17" width="300" height="11" rx="5.5" fill="url(#mnMetal)" />
          <path d="M-190 0 A44 48 0 0 1 -102 0 Z" fill="url(#mnDome)" /><path d="M-176 -26 A34 40 0 0 1 -140 -42" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="4" stroke-linecap="round" />
          <path d="M102 0 A38 42 0 0 1 178 0 Z" fill="url(#mnDome)" /><path d="M112 -22 A30 34 0 0 1 134 -38" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="4" stroke-linecap="round" />
          <!-- main towers -->
          <g v-for="(t, i) in towers.filter((q) => !q.back)" :key="'t' + i">
            <rect :x="t.x" :y="-t.h" :width="t.w" :height="t.h" rx="9" fill="url(#mnTower)" />
            <rect :x="t.x" :y="-t.h" :width="t.w * 0.3" :height="t.h" rx="5" fill="#fff" opacity=".5" />
            <rect :x="t.x" :y="-34" :width="t.w" :height="5" fill="#4fa8ff" />
            <path v-if="t.dome" :d="`M ${t.x - 3} ${-t.h + 6} A ${t.w / 2 + 3} 20 0 0 1 ${t.x + t.w + 3} ${-t.h + 6} Z`" fill="#4fd1ff" opacity=".7" />
            <line v-else :x1="t.x + t.w / 2" :y1="-t.h" :x2="t.x + t.w / 2" :y2="-t.h - 16" stroke="#aab1c8" stroke-width="3" stroke-linecap="round" />
          </g>
          <!-- dim window lights (day) -->
          <path v-for="(d, i) in wins" :key="'w' + i" :d="d" fill="#ffe08a" opacity=".55" />
          <!-- flag -->
          <line x1="196" y1="2" x2="196" y2="-58" stroke="#e6e9f4" stroke-width="3" stroke-linecap="round" />
          <g class="flag"><path d="M197 -58 L228 -50 L197 -40 Z" fill="#ff9f43" /><path d="M207 -49 l2 -4 l2 4 l-4 -2.6 h4.4 z" fill="#fff" /></g>
          <!-- rover -->
          <g class="rover-lane"><g class="rover">
            <ellipse cx="0" cy="3" rx="19" ry="3.4" fill="#6b7190" opacity=".4" />
            <rect x="-17" y="-14" width="34" height="10" rx="5" fill="#ff9f43" /><rect x="-6" y="-23" width="17" height="10" rx="4" fill="#e6e9f4" /><rect x="-3" y="-21" width="11" height="6" rx="2.5" fill="#4a7bc4" />
            <line x1="12" y1="-23" x2="16" y2="-33" stroke="#aab1c8" stroke-width="1.8" stroke-linecap="round" /><circle cx="16" cy="-34" r="2" fill="#ff6b9d" />
            <g transform="translate(-10 -3)"><g class="wheel"><circle r="6" fill="#3b4268" /><circle r="2.4" fill="#aab1c8" /><path d="M-6 0 H6" stroke="#aab1c8" stroke-width="1.5" /></g></g>
            <g transform="translate(10 -3)"><g class="wheel"><circle r="6" fill="#3b4268" /><circle r="2.4" fill="#aab1c8" /><path d="M-6 0 H6" stroke="#aab1c8" stroke-width="1.5" /></g></g>
          </g></g>
        </template>
        <!-- lit windows (also repeated above the night wash) -->
        <template v-else>
          <circle cx="-20" cy="-70" r="80" fill="url(#mnHaloW)" class="halo" />
          <path v-for="(d, i) in wins" :key="'lw' + i" :d="d" fill="#ffe9a8" />
          <circle class="blink" cx="-5" cy="-136" r="3.6" fill="#ff6b9d" />
        </template>
        <g v-if="popped && !lightsOnly" class="burst"><ellipse cx="0" cy="-50" rx="150" ry="70" fill="none" stroke="#ffd23f" stroke-width="5" /></g>
      </g>
    </Transition>

    <!-- ============ COLONY ============ -->
    <Transition v-else name="pop">
      <g v-if="on" class="pop">
        <template v-if="!lightsOnly">
          <ellipse cx="0" cy="4" rx="118" ry="11" fill="#6b7190" opacity=".32" />
          <rect x="-84" y="-17" width="168" height="11" rx="5.5" fill="url(#mnMetal)" />
          <path d="M-106 0 A30 34 0 0 1 -46 0 Z" fill="url(#mnDome)" /><path d="M-98 -12 A24 28 0 0 1 -80 -28" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="3.6" stroke-linecap="round" />
          <path d="M46 0 A30 34 0 0 1 106 0 Z" fill="url(#mnDome)" /><path d="M54 -12 A24 28 0 0 1 72 -28" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="3.6" stroke-linecap="round" />
          <path d="M-46 0 A46 54 0 0 1 46 0 Z" fill="url(#mnDome)" />
          <path d="M-30 0 A30 54 0 0 1 30 0 M-44 -22 Q0 -30 44 -22" fill="none" stroke="#8e93a8" stroke-opacity=".28" stroke-width="2" />
          <path d="M-40 -10 A42 48 0 0 1 -14 -46" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="4.4" stroke-linecap="round" />
          <rect x="-48" y="-8" width="96" height="8" rx="4" fill="#9aa0ba" />
          <rect x="-24" y="-38" width="30" height="18" rx="8" fill="#2b4a7a" />
          <rect x="-82" y="-22" width="18" height="12" rx="6" fill="#2b4a7a" /><rect x="64" y="-22" width="18" height="12" rx="6" fill="#2b4a7a" />
        </template>
        <template v-else>
          <circle cx="-9" cy="-29" r="44" fill="url(#mnHaloW)" class="halo" />
          <rect x="-22" y="-36" width="26" height="14" rx="6" fill="url(#mnWin)" />
          <rect x="-80" y="-20" width="14" height="8" rx="4" fill="url(#mnWin)" /><rect x="66" y="-20" width="14" height="8" rx="4" fill="url(#mnWin)" />
          <circle v-for="k in 6" :key="k" class="blink" :style="{ animationDelay: k * 0.25 + 's' }" :cx="-60 + k * 18" cy="-12" r="2" fill="#ffe9a8" />
        </template>
        <g v-if="popped && !lightsOnly" class="burst"><ellipse cx="0" cy="-26" rx="80" ry="34" fill="none" stroke="#4fd1ff" stroke-width="5" /></g>
      </g>
    </Transition>
  </g>
</template>

<style scoped>
.pop-enter-active { animation: pop 0.95s cubic-bezier(0.34, 1.56, 0.64, 1) both; transform-box: fill-box; transform-origin: 50% 100%; }
@keyframes pop { 0% { transform: scale(0); opacity: 0; } 55% { opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
.burst > * { transform-box: fill-box; transform-origin: center; animation: burst 1.2s ease-out forwards; }
@keyframes burst { 0% { transform: scale(0.3); opacity: 1; } 100% { transform: scale(2.2); opacity: 0; } }
.halo { opacity: 0.3; transition: opacity 1s; }
.night .halo { opacity: 1; }
.blink { animation: blink 1.6s ease-in-out infinite; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
.flag { transform-box: fill-box; transform-origin: 0 50%; animation: wave 2.6s ease-in-out infinite; }
@keyframes wave { 0%, 100% { transform: skewY(0deg) scaleX(1); } 50% { transform: skewY(-5deg) scaleX(0.92); } }
.rover-lane { transform: translateY(26px); }
.rover { animation: drive 22s linear infinite; }
@keyframes drive {
  0% { transform: translateX(-150px) scaleX(1); }
  49% { transform: translateX(150px) scaleX(1); }
  50% { transform: translateX(150px) scaleX(-1); }
  99% { transform: translateX(-150px) scaleX(-1); }
  100% { transform: translateX(-150px) scaleX(1); }
}
.wheel { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .rover, .wheel, .flag, .blink { animation: none !important; } }
</style>
