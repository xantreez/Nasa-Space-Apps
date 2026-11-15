<script setup lang="ts">
// Space backdrop: gradient, nebula, stars, sun, big friendly Earth. Lives inside the scene <svg>.
import { computed } from "vue";
import { rng } from "./util";

const props = defineProps<{
  W: number; H: number; H0: number; weather: string; day: number;
  earth: { x: number; y: number; r: number }; sun: { x: number; y: number };
}>();

const night = computed(() => props.weather === "night");

const stars = computed(() => {
  const r = rng(11);
  const n = props.W > props.H ? 90 : 62;
  const out: { x: number; y: number; r: number; g: number; c: string; o: number }[] = [];
  const cols = ["#ffffff", "#cfe8ff", "#fff1c2"];
  for (let i = 0; i < n; i++) {
    const x = -40 + r() * (props.W + 80);
    const y = -10 + r() * (props.H0 - 10);
    const c = cols[Math.floor(r() * 3)];
    const rad = 0.6 + r() * 1.5;
    const o = 0.45 + r() * 0.55;
    if (Math.hypot(x - props.earth.x, y - props.earth.y) < props.earth.r * 1.35) continue;
    out.push({ x, y, r: rad, g: i % 3, c, o });
  }
  return out;
});
const sparks = computed(() => {
  const r = rng(23);
  const out: { x: number; y: number; s: number; d: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const x = r() * props.W;
    const y = 10 + r() * (props.H0 - 80);
    if (Math.hypot(x - props.earth.x, y - props.earth.y) < props.earth.r * 1.4) continue;
    out.push({ x, y, s: 0.7 + r() * 0.8, d: r() * 4 });
  }
  return out;
});

const nebulae = computed(() => {
  const { W, H0 } = props;
  return [
    { x: W * 0.28, y: H0 * 0.34, rx: W * 0.42, ry: H0 * 0.3, f: "mnNebT", rot: -12 },
    { x: W * 0.74, y: H0 * 0.5, rx: W * 0.36, ry: H0 * 0.26, f: "mnNebP", rot: 14 },
    { x: W * 0.5, y: H0 * 0.12, rx: W * 0.5, ry: H0 * 0.18, f: "mnNebB", rot: 4 },
  ];
});

const sunPos = computed(() => {
  const d = Math.min(14, Math.max(0, props.day - 1));
  return { x: props.sun.x + d * props.W * 0.011, y: props.sun.y + Math.sin(d * 0.45) * 8 };
});

const flare = computed(() => {
  const s = sunPos.value;
  const tx = props.W * 0.58, ty = props.H0 * 0.78;
  const pts = [
    { t: 0.22, r: 16, c: "#ffd27a", o: 0.35 },
    { t: 0.4, r: 34, c: "#ff9f43", o: 0.2 },
    { t: 0.58, r: 12, c: "#ff6b9d", o: 0.35 },
    { t: 0.8, r: 46, c: "#ffd27a", o: 0.16 },
  ];
  return pts.map((p) => ({ x: s.x + (tx - s.x) * p.t, y: s.y + (ty - s.y) * p.t, r: p.r, c: p.c, o: p.o }));
});

// Earth is drawn in a 200x200 box centred on (0,0), radius 100.
const clouds = [
  { x: -80, y: -62, w: 26 }, { x: -20, y: -40, w: 34 }, { x: 52, y: -70, w: 24 },
  { x: -52, y: -8, w: 38 }, { x: 28, y: 6, w: 30 }, { x: 84, y: -22, w: 26 },
  { x: -86, y: 40, w: 28 }, { x: -10, y: 52, w: 36 }, { x: 62, y: 58, w: 28 }, { x: 8, y: 84, w: 24 },
];
</script>

<template>
  <g class="sky" :class="{ night, flare: weather === 'flare', storm: weather === 'storm' }">
    <rect :x="-80" :y="-60" :width="W + 160" :height="H0 + 140" fill="url(#mnSky)" />
    <rect :x="-80" :y="H0 - 200" :width="W + 160" :height="260" fill="url(#mnHaze)" />

    <g class="par p2">
      <ellipse v-for="(n, i) in nebulae" :key="i" :cx="n.x" :cy="n.y" :rx="n.rx" :ry="n.ry"
        :transform="`rotate(${n.rot} ${n.x} ${n.y})`" :fill="`url(#${n.f})`" />
    </g>

    <!-- lunar night: deep blue wash behind stars and Earth -->
    <rect class="night-sky" :x="-80" :y="-60" :width="W + 160" :height="H0 + 140" fill="#030820" />

    <g class="par p4 stars">
      <g class="tw tw0"><circle v-for="(s, i) in stars.filter((q) => q.g === 0)" :key="i" :cx="s.x" :cy="s.y" :r="s.r" :fill="s.c" :opacity="s.o" /></g>
      <g class="tw tw1"><circle v-for="(s, i) in stars.filter((q) => q.g === 1)" :key="i" :cx="s.x" :cy="s.y" :r="s.r" :fill="s.c" :opacity="s.o" /></g>
      <g class="tw tw2"><circle v-for="(s, i) in stars.filter((q) => q.g === 2)" :key="i" :cx="s.x" :cy="s.y" :r="s.r" :fill="s.c" :opacity="s.o" /></g>
      <g class="tw tw1">
        <path v-for="(s, i) in sparks" :key="i" class="spark" d="M0 -9 Q1.2 -1.2 9 0 Q1.2 1.2 0 9 Q-1.2 1.2 -9 0 Q-1.2 -1.2 0 -9Z"
          fill="#fff" :transform="`translate(${s.x} ${s.y}) scale(${s.s})`" :style="{ animationDelay: s.d + 's' }" />
      </g>
      <g class="shoot s1"><line :x1="W * 0.62" :y1="H0 * 0.12" :x2="W * 0.62 + 70" :y2="H0 * 0.12 - 34" stroke="url(#mnShoot)" stroke-width="2.4" stroke-linecap="round" /></g>
      <g class="shoot s2"><line :x1="W * 0.3" :y1="H0 * 0.3" :x2="W * 0.3 + 56" :y2="H0 * 0.3 - 27" stroke="url(#mnShoot)" stroke-width="2" stroke-linecap="round" /></g>
    </g>

    <!-- Sun -->
    <g class="sun" :style="{ transform: `translate(${sunPos.x}px, ${sunPos.y}px)` }">
      <circle class="sun-glow" r="120" fill="url(#mnSunGlow)" />
      <circle r="17" fill="#fff8dc" />
      <circle r="11" fill="#fff" />
    </g>

    <!-- Lens flare (solar flare weather) -->
    <g class="lens">
      <ellipse :cx="sunPos.x" :cy="sunPos.y" rx="260" ry="5" fill="url(#mnStreak)" />
      <circle v-for="(f, i) in flare" :key="i" :cx="f.x" :cy="f.y" :r="f.r" :fill="f.c" :opacity="f.o" />
    </g>

    <!-- Earth: home -->
    <g class="par p6">
      <g :transform="`translate(${earth.x} ${earth.y}) scale(${earth.r / 100})`">
        <g class="earth">
          <circle class="earth-glow" r="168" fill="url(#mnEarthGlow)" />
          <circle r="100" fill="url(#mnOcean)" />
          <g clip-path="url(#mnEarthClip)">
            <!-- continents -->
            <path d="M-10 -20 C5 -30 25 -25 32 -10 C40 5 30 25 22 45 C15 62 0 62 -4 45 C-8 28 -22 18 -18 2 C-16 -8 -14 -14 -10 -20Z" fill="#4cb86f" />
            <path d="M-22 -58 C-8 -68 14 -64 18 -52 C10 -44 -2 -40 -12 -44 C-18 -46 -26 -48 -22 -58Z" fill="#5fcf82" />
            <path d="M24 -50 C46 -62 78 -48 92 -22 C84 -8 58 -16 44 -26 C34 -30 26 -38 24 -50Z" fill="#46ac68" />
            <path d="M-80 4 C-62 -4 -46 8 -46 26 C-48 48 -60 66 -68 62 C-78 50 -86 28 -80 4Z" fill="#55c277" />
            <path d="M-4 -26 C8 -30 22 -24 26 -12 C16 -8 4 -10 -4 -18Z" fill="#e8c97a" opacity=".85" />
            <path d="M58 40 C72 34 86 40 84 52 C78 62 62 60 58 40Z" fill="#6dd38f" />
            <!-- clouds drifting -->
            <g class="clouds">
              <g v-for="k in 2" :key="k" :transform="`translate(${(k - 1) * 220} 0)`">
                <g v-for="(c, i) in clouds" :key="i" :transform="`translate(${c.x} ${c.y})`">
                  <ellipse :cx="0" :cy="4" :rx="c.w" :ry="c.w * 0.26" fill="#cfe3ff" opacity=".55" />
                  <ellipse :cx="0" :cy="0" :rx="c.w" :ry="c.w * 0.32" fill="#fff" opacity=".92" />
                  <ellipse :cx="-c.w * 0.42" :cy="2" :rx="c.w * 0.55" :ry="c.w * 0.26" fill="#fff" opacity=".92" />
                  <ellipse :cx="c.w * 0.3" :cy="-c.w * 0.14" :rx="c.w * 0.55" :ry="c.w * 0.3" fill="#fff" />
                </g>
              </g>
            </g>
            <circle r="100" fill="url(#mnEarthShade)" />
            <ellipse cx="-38" cy="-52" rx="34" ry="20" transform="rotate(-32 -38 -52)" fill="#fff" opacity=".2" />
          </g>
          <circle r="99" fill="none" stroke="#9fdcff" stroke-opacity=".55" stroke-width="3" />
        </g>
      </g>
    </g>

  </g>
</template>

<style scoped>
.par { transition: transform 0.4s ease-out; will-change: transform; }
.p2 { transform: translate3d(calc(var(--par, 0) * -3px), 0, 0); }
.p4 { transform: translate3d(calc(var(--par, 0) * -8px), 0, 0); }
.p6 { transform: translate3d(calc(var(--par, 0) * -16px), 0, 0); }

.tw { animation: tw 3.4s ease-in-out infinite; }
.tw0 { animation-duration: 4.2s; }
.tw1 { animation-duration: 3.1s; animation-delay: -1.2s; }
.tw2 { animation-duration: 5.3s; animation-delay: -2.4s; }
@keyframes tw { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
.spark { transform-box: fill-box; transform-origin: center; animation: spark 3.6s ease-in-out infinite; }
@keyframes spark { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }

.stars { transition: opacity 1s; opacity: 0.85; }
.night .stars { opacity: 1; }

.shoot { opacity: 0; animation: shoot 11s linear infinite; }
.shoot.s2 { animation-duration: 17s; animation-delay: -6s; }
@keyframes shoot {
  0% { opacity: 0; transform: translate(0, 0); }
  2% { opacity: 1; }
  7% { opacity: 0; transform: translate(-240px, 120px); }
  100% { opacity: 0; transform: translate(-240px, 120px); }
}

.sun { transition: transform 1.2s ease, opacity 1s; }
.sun-glow { transform-box: fill-box; transform-origin: center; transition: transform 1s ease, opacity 1s; opacity: 0.95; }
.night .sun { opacity: 0; }
.flare .sun-glow { transform: scale(1.9); }
.storm .sun-glow { transform: scale(1.4); }

.lens { opacity: 0; transition: opacity 1s; }
.flare .lens { opacity: 1; animation: lensPulse 2.2s ease-in-out infinite; }
@keyframes lensPulse { 0%, 100% { opacity: 0.75; } 50% { opacity: 1; } }

.earth { animation: bob 9s ease-in-out infinite; }
@keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
.earth-glow { transform-box: fill-box; transform-origin: center; transition: transform 1s, opacity 1s; opacity: 0.8; }
.night .earth-glow { transform: scale(1.22); opacity: 1; }
.clouds { animation: drift 95s linear infinite; }
@keyframes drift { from { transform: translateX(0); } to { transform: translateX(-220px); } }

.night-sky { opacity: 0; transition: opacity 1s; pointer-events: none; }
.night .night-sky { opacity: 0.42; }

@media (prefers-reduced-motion: reduce) {
  .tw, .spark, .shoot, .earth, .clouds, .lens { animation: none !important; }
}
</style>
