<script setup lang="ts">
// Lunar mountains (3 hazy layers) + foreground ground plane with craters, rocks and frost sparkles.
import { computed } from "vue";
import { rng } from "./util";

const props = defineProps<{
  W: number; H: number; H0: number; weather: string;
  avoid: { x: number; y: number; r: number }[];
}>();

interface Ridge { fill: string; d: string; shade: string; rim: string; cls: string }

function ridge(seed: number, base: number, amp: number, step: number, round: boolean, fill: string, cls: string): Ridge {
  const { W } = props;
  const r = rng(seed);
  const pts: [number, number][] = [];
  let x = -70;
  let up = r() > 0.5;
  while (x < W + 90) {
    const h = up ? amp * (0.55 + r() * 0.45) : amp * (0.05 + r() * 0.22);
    pts.push([x, base - h]);
    x += step * (0.7 + r() * 0.6);
    up = !up;
  }
  let top = `M ${pts[0][0]} ${pts[0][1]}`;
  if (round) {
    for (let i = 1; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      top += ` Q ${x0} ${y0} ${(x0 + x1) / 2} ${(y0 + y1) / 2}`;
    }
    top += ` L ${pts[pts.length - 1][0]} ${pts[pts.length - 1][1]}`;
  } else {
    for (let i = 1; i < pts.length; i++) top += ` L ${pts[i][0]} ${pts[i][1]}`;
  }
  const d = `${top} L ${W + 90} ${base + 60} L -70 ${base + 60} Z`;
  // soft shadow on the right face of every peak (sun is on the left)
  let shade = "";
  if (!round) {
    for (let i = 1; i < pts.length - 1; i++) {
      const [px, py] = pts[i];
      if (pts[i - 1][1] > py && pts[i + 1][1] > py) {
        const [rx, ry] = pts[i + 1];
        shade += `M ${px} ${py} L ${rx} ${ry} L ${px + (rx - px) * 0.35} ${base + 4} Z `;
      }
    }
  }
  return { fill, d, shade, rim: top, cls };
}

const ridges = computed<Ridge[]>(() => {
  const { H0, W } = props;
  const k = H0 * 0.22;
  const st = W > 1000 ? 150 : 90;
  return [
    ridge(5, H0 + 2, k * 1.15, st * 1.1, false, "url(#mnMtnFar)", "far"),
    ridge(9, H0 + 10, k * 0.8, st * 1.3, false, "url(#mnMtnMid)", "mid"),
    ridge(14, H0 + 20, k * 0.5, st * 1.8, true, "url(#mnMtnNear)", "near"),
  ];
});

const groundTop = computed(() => {
  const { W, H, H0 } = props;
  return `M -90 ${H0 + 12} Q ${W * 0.5} ${H0 - 24} ${W + 90} ${H0 + 12} L ${W + 90} ${H + 20} L -90 ${H + 20} Z`;
});

function free(x: number, y: number, pad: number) {
  return !props.avoid.some((a) => Math.hypot((x - a.x) * 0.8, (y - a.y) * 1.6) < a.r + pad);
}

const craters = computed(() => {
  const { W, H, H0 } = props;
  const r = rng(31);
  const out: { x: number; y: number; rx: number; ry: number }[] = [];
  let tries = 0;
  const n = W > H ? 11 : 8;
  while (out.length < n && tries++ < 400) {
    const x = r() * W;
    const t = Math.pow(r(), 0.85);
    const y = H0 + 36 + t * (H - H0 - 70);
    const depth = (y - H0) / (H - H0);
    const rx = (18 + r() * 34) * (0.45 + depth * 1.1);
    if (!free(x, y, rx * 0.9)) continue;
    out.push({ x, y, rx, ry: rx * (0.24 + depth * 0.1) });
  }
  return out;
});

const rocks = computed(() => {
  const { W, H, H0 } = props;
  const r = rng(47);
  const out: { x: number; y: number; w: number; h: number }[] = [];
  let tries = 0;
  const n = W > H ? 16 : 12;
  while (out.length < n && tries++ < 500) {
    const x = r() * W;
    const y = H0 + 30 + Math.pow(r(), 0.8) * (H - H0 - 40);
    const depth = (y - H0) / (H - H0);
    const w = (7 + r() * 16) * (0.5 + depth * 1.0);
    if (!free(x, y, w * 1.2)) continue;
    out.push({ x, y, w, h: w * (0.55 + r() * 0.35) });
  }
  return out;
});

const patches = computed(() => {
  const { W, H, H0 } = props;
  const r = rng(101);
  return Array.from({ length: 9 }, (_, i) => {
    const t = (i + 0.5) / 9;
    const y = H0 + 40 + t * (H - H0 - 40) + (r() - 0.5) * 40;
    const rx = W * (0.16 + r() * 0.2);
    return { x: r() * W, y, rx, ry: rx * (0.1 + t * 0.07), d: i % 2 === 0 };
  });
});

const specks = computed(() => {
  const { W, H, H0 } = props;
  const r = rng(63);
  const out: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < 56; i++) {
    const y = H0 + 24 + r() * (H - H0);
    out.push({ x: r() * W, y, r: 1 + r() * 2.2 * (0.5 + (y - H0) / (H - H0)) });
  }
  return out;
});

const frost = computed(() => {
  const { W, H, H0 } = props;
  const r = rng(77);
  const out: { x: number; y: number; s: number; d: number }[] = [];
  for (let i = 0; i < 18; i++) {
    out.push({ x: r() * W, y: H0 + 30 + r() * (H - H0 - 50), s: 0.5 + r() * 0.9, d: r() * 3 });
  }
  return out;
});
</script>

<template>
  <g class="ground" :class="{ night: weather === 'night' }">
    <g v-for="(m, i) in ridges" :key="m.cls" :class="['par', 'm-' + m.cls]">
      <path :d="m.d" :fill="m.fill" />
      <path v-if="m.shade" :d="m.shade" fill="#0b1b3a" opacity=".16" />
      <path :d="m.rim" fill="none" stroke="#ffffff" stroke-opacity=".28" stroke-width="1.6" stroke-linejoin="round" />
    </g>

    <path :d="groundTop" fill="url(#mnGround)" />
    <!-- sunlit wash from the left, shadowed foreground -->
    <path :d="groundTop" fill="url(#mnGroundSun)" />
    <path :d="groundTop" fill="url(#mnGroundShade)" />

    <ellipse v-for="(p, i) in patches" :key="'pt' + i" :cx="p.x" :cy="p.y" :rx="p.rx" :ry="p.ry" :fill="p.d ? 'url(#mnPatchD)' : 'url(#mnPatchL)'" />

    <g>
      <ellipse v-for="(s, i) in specks" :key="'sp' + i" :cx="s.x" :cy="s.y" :rx="s.r * 1.6" :ry="s.r" fill="#7f84a0" opacity=".16" />
    </g>

    <g v-for="(c, i) in craters" :key="'c' + i">
      <ellipse :cx="c.x" :cy="c.y + c.ry * 0.14" :rx="c.rx * 1.06" :ry="c.ry * 1.06" fill="#8e93a8" opacity=".35" />
      <ellipse :cx="c.x" :cy="c.y" :rx="c.rx" :ry="c.ry" fill="#eceef6" />
      <ellipse :cx="c.x" :cy="c.y + c.ry * 0.1" :rx="c.rx * 0.86" :ry="c.ry * 0.8" fill="url(#mnCrater)" />
      <path :d="`M ${c.x - c.rx * 0.8} ${c.y + c.ry * 0.12} Q ${c.x} ${c.y - c.ry * 0.5} ${c.x + c.rx * 0.8} ${c.y + c.ry * 0.12} Q ${c.x} ${c.y - c.ry * 0.05} ${c.x - c.rx * 0.8} ${c.y + c.ry * 0.12} Z`" fill="#7d83a0" opacity=".28" />
    </g>

    <g v-for="(k, i) in rocks" :key="'r' + i">
      <ellipse :cx="k.x + k.w * 0.55" :cy="k.y + 1" :rx="k.w * 1.15" :ry="k.h * 0.28" fill="#6b7190" opacity=".3" />
      <path :d="`M ${k.x - k.w} ${k.y} Q ${k.x - k.w * 0.95} ${k.y - k.h} ${k.x - k.w * 0.2} ${k.y - k.h * 1.05} Q ${k.x + k.w * 0.85} ${k.y - k.h * 1.1} ${k.x + k.w} ${k.y} Z`" fill="url(#mnRock)" />
      <path :d="`M ${k.x - k.w * 0.7} ${k.y - k.h * 0.55} Q ${k.x - k.w * 0.4} ${k.y - k.h * 0.95} ${k.x} ${k.y - k.h * 0.9}`" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.5" stroke-linecap="round" />
    </g>

    <g class="frost">
      <g v-for="(f, i) in frost" :key="'f' + i" :transform="`translate(${f.x} ${f.y}) scale(${f.s})`">
        <path class="fs" d="M0 -7 Q1 -1 7 0 Q1 1 0 7 Q-1 1 -7 0 Q-1 -1 0 -7Z" fill="#e6f6ff" :style="{ animationDelay: f.d + 's' }" />
      </g>
    </g>
  </g>
</template>

<style scoped>
.par { transition: transform 0.4s ease-out; will-change: transform; }
.m-far { transform: translate3d(calc(var(--par, 0) * -12px), 0, 0); }
.m-mid { transform: translate3d(calc(var(--par, 0) * -22px), 0, 0); }
.m-near { transform: translate3d(calc(var(--par, 0) * -34px), 0, 0); }

.frost { opacity: 0; transition: opacity 1s; }
.night .frost { opacity: 1; }
.fs { transform-box: fill-box; transform-origin: center; animation: fs 2.6s ease-in-out infinite; }
@keyframes fs { 0%, 100% { opacity: 0.2; transform: scale(0.6); } 50% { opacity: 1; transform: scale(1.1); } }

@media (prefers-reduced-motion: reduce) { .fs { animation: none !important; } }
</style>
