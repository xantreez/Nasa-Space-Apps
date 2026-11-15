<script setup lang="ts">
// Rover Run — Tobish drives a lunar rover across the surface to the base. Low gravity (1/6 g) jumps,
// collect solar cells (energy) and water ice, dodge craters/rocks/debris, outrun the lunar night.
import { ref, reactive, onMounted, onBeforeUnmount } from "vue";
import Btn from "../ui/Btn.vue";
import { sfx, music } from "../../../moon/sfx";
import type { MiniGameProps, MiniGameResult } from "../../../moon/types";

const props = defineProps<MiniGameProps>();
const emit = defineEmits<{ finish: [result: MiniGameResult] }>();

type Phase = "intro" | "count" | "play" | "paused" | "end" | "result";
const phase = ref<Phase>("intro");
const countNum = ref<string>("3");
const moreFacts = ref(false);

// ---------------------------------------------------------------- config (age + difficulty)
const spec = props.age === "specialist";
const diff = props.difficulty;
const BASE = (spec ? 255 : 215) + (diff - 1) * 18; // px/s logical at full speed
const CFG = {
  lives: spec ? 2 : 3,
  gapMul: (spec ? 1.0 : 1.3) - (diff - 1) * 0.07,
  drain: (spec ? 0.065 : 0.052) + (diff - 1) * 0.006, // energy per second
  gain: spec ? 0.085 : 0.1, // per solar cell
  target: BASE * 31, // world px to the base
};
const PX_PER_M = 10;
const KMH_DIV = 13.5; // 255 px/s ~ 19 km/h : near the Apollo LRV top speed

// physics (logical px, seconds). Low gravity = floaty.
const G_HOLD = 550;
const G_FALL = 1000;
const G_CUT = 1600;
const JUMP_V = 440;
const HOLD_MAX = 0.45;

// ---------------------------------------------------------------- facts (NASA)
interface Fact { icon: string; title: string; text: string; src: string; url: string }
const F_GRAV: Fact = {
  icon: "🪶", title: "Moon gravity is 1/6 of Earth's",
  text: "The Moon pulls with only 1.62 m/s² (Earth: 9.81). That is why astronauts bounce and why your rover floats so long!",
  src: "NASA Moon Facts", url: "https://science.nasa.gov/moon/facts/",
};
const F_NIGHT: Fact = {
  icon: "🌑", title: "Lunar night lasts about two weeks",
  text: "Daylight and night on the Moon each last roughly 14.75 Earth days (a full cycle is about 29.5 days). Rovers need solar panels plus batteries to survive the dark.",
  src: "NASA Moon Facts", url: "https://science.nasa.gov/moon/facts/",
};
const F_LRV: Fact = {
  icon: "🚙", title: "Real Moon buggies!",
  text: "Apollo 15, 16 and 17 astronauts drove the Lunar Roving Vehicle at up to about 18 km/h on the Moon.",
  src: "NASA Apollo Lunar Roving Vehicle", url: "https://www.nasa.gov/history/50-years-ago-the-lunar-roving-vehicle-on-apollo-15/",
};
const F_ICE: Fact = {
  icon: "🧊", title: "Water ice at the south pole",
  text: "NASA's Artemis program and the VIPER rover target the Moon's south pole, where ice may hide in permanently shadowed craters. Ice can become drinking water and rocket fuel.",
  src: "NASA VIPER", url: "https://science.nasa.gov/mission/viper/",
};

const result = reactive({ won: false, score: 0, cells: 0, ice: 0, lives: 0, maxLives: CFG.lives, cause: "win" as "win" | "night" | "lives", facts: [] as Fact[] });

// ---------------------------------------------------------------- HUD state (throttled)
const hud = reactive({
  pct: 0, nightPct: 0, m: 0, mTotal: Math.round(CFG.target / PX_PER_M), lives: CFG.lives, energy: 0.65,
  combo: 0, kmh: 0, warn: false, hint: "", gold: 0,
});
const coarse = ref(false);
const duckBtn = ref(false);

// ---------------------------------------------------------------- refs / sim
const root = ref<HTMLElement | null>(null);
const cv = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;
let raf = 0, last = 0, ro: ResizeObserver | null = null;
let dpr = 1, scale = 1, W = 600, H = 400, gy = 300, rx = 120, cssW = 600, cssH = 400;
let reduced = false;
let sky: HTMLCanvasElement | null = null, earth: HTMLCanvasElement | null = null;
let sprCell: HTMLCanvasElement | null = null, sprIce: HTMLCanvasElement | null = null;
let hudT = 0, time = 0;

interface Haz { t: "crater" | "rock" | "boulder" | "debris"; x: number; w: number; h: number; hit: boolean; ph: number }
interface Item { t: "cell" | "ice"; x: number; y: number; got: boolean; ph: number }
interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; s: number; k: 0 | 1 | 2 | 3; c: string; g: number; gy: number; rot: number }
interface FText { x: number; y: number; txt: string; life: number; c: string; sz: number }

const sim = {
  dist: 0, speed: 0, wheel: 0,
  h: 0, vy: 0, held: false, holdT: 0, duck: false, ground: true, air: 0, buffer: 0, coyote: 0,
  sx: 1, sy: 1, svx: 0, svy: 0, // squash springs
  energy: 0.65, gap: 0, gapMax: 200, lives: CFG.lives, inv: 0, bump: 0,
  cells: 0, ice: 0, totalUnits: 0, combo: 0, comboT: 0,
  nextX: 700, t: 0, dustT: 0, shake: 0, flash: 0, flashC: "239,68,68", endT: 0, won: false, cause: "win" as "win" | "night" | "lives",
  hazards: [] as Haz[], items: [] as Item[], parts: [] as Part[], texts: [] as FText[],
  hintDebris: false, hintJump: true, comboMax: 0,
};
let stars: { x: number; y: number; s: number; ph: number; sp: number }[] = [];
let lines: { x: number; y: number; l: number; v: number }[] = [];

const rand = (a = 1, b?: number) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ---------------------------------------------------------------- spawner
function arc(cx: number, span: number, n: number, peak: number, skip = -1, base = 24) {
  for (let i = 0; i < n; i++) {
    if (i === skip) continue;
    const t = n === 1 ? 0.5 : i / (n - 1);
    sim.items.push({ t: "cell", x: cx - span / 2 + t * span, y: base + (peak - base) * Math.sin(Math.PI * t), got: false, ph: rand(6) });
    sim.totalUnits++;
  }
}
function row(x0: number, n: number, y: number, step = 36) {
  for (let i = 0; i < n; i++) { sim.items.push({ t: "cell", x: x0 + i * step, y, got: false, ph: rand(6) }); sim.totalUnits++; }
}
function ice(x: number, y: number) { sim.items.push({ t: "ice", x, y, got: false, ph: rand(6) }); sim.totalUnits += 2; }
const hz = (t: Haz["t"], x: number, w: number, h: number) => sim.hazards.push({ t, x, w, h, hit: false, ph: rand(6) });

const pool: ((x: number) => number)[] = [];
const P = {
  crater: (x: number) => { const w = (spec ? 85 : 75) + rand(25); hz("crater", x + 70, w, 0); arc(x + 70 + w / 2, w + 100, 6, 95); return w + 150; },
  rock: (x: number) => { hz("rock", x + 70, 30, 24); arc(x + 85, 150, 5, 88); return 170; },
  boulder: (x: number) => { hz("boulder", x + 80, 52, 44); arc(x + 106, 190, 6, 112); return 210; },
  debris: (x: number) => { hz("debris", x + 80, 46, 28); row(x + 20, 5, 16); return 220; },
  pair: (x: number) => {
    hz("crater", x + 70, 70, 0); hz("crater", x + 245, 70, 0);
    arc(x + 210, 380, 9, 150, 4); ice(x + 210, 158); return 480;
  },
  combo: (x: number) => {
    hz("rock", x + 60, 30, 24); arc(x + 75, 130, 4, 85);
    hz("debris", x + 400, 46, 28); row(x + 340, 5, 16); return 500;
  },
  iceRun: (x: number) => { row(x, 3, 22); ice(x + 190, 150); arc(x + 190, 150, 4, 110, -1, 40); return 330; },
  cells: (x: number) => { row(x, 5, 22); return 260; },
};
(function fillPool() {
  const add = (f: (x: number) => number, n: number) => { for (let i = 0; i < n; i++) pool.push(f); };
  if (spec) { add(P.crater, 4); add(P.rock, 3); add(P.boulder, 3); add(P.debris, 4); add(P.pair, 3); add(P.combo, 3); add(P.iceRun, 2); }
  else { add(P.crater, 5); add(P.rock, 4); add(P.boulder, 3); add(P.debris, 3); add(P.iceRun, 2); add(P.cells, 1); if (diff >= 3) add(P.pair, 1); }
})();
let lastPat: ((x: number) => number) | null = null;
function topUp() {
  const lim = Math.min(sim.dist + W + 400, CFG.target - 450);
  while (sim.nextX < lim) {
    let f = pool[Math.floor(Math.random() * pool.length)];
    if (f === lastPat && Math.random() < 0.7) f = pool[Math.floor(Math.random() * pool.length)];
    lastPat = f;
    const w = f(sim.nextX);
    sim.nextX += w + (BASE * 0.95 + 130) * CFG.gapMul + rand(0, 110);
  }
}

// ---------------------------------------------------------------- particles
function pf(k: Part["k"], x: number, y: number, vx: number, vy: number, life: number, s: number, c: string, g = 0) {
  if (sim.parts.length > 320) return;
  sim.parts.push({ x, y, vx, vy, life, max: life, s, k, c, g, gy: gy + rand(0, 8), rot: rand(6) });
}
function dust(x: number, n: number, power: number) {
  const m = reduced ? 0.4 : 1;
  for (let i = 0; i < Math.ceil(n * m); i++) pf(0, x + rand(-6, 6), gy - 3, rand(-1, 1) * power - sim.speed * 0.15, -rand(25, 95), rand(0.6, 1.3), rand(2.5, 6), "#d9dbe6", 170);
}
function sparkBurst(x: number, y: number, c1: string, c2: string, n = 9) {
  const m = reduced ? 0.5 : 1;
  for (let i = 0; i < Math.ceil(n * m); i++) { const a = rand(6.28), v = rand(50, 150); pf(1, x, y, Math.cos(a) * v, Math.sin(a) * v, rand(0.4, 0.75), rand(3, 6), Math.random() < 0.5 ? c1 : c2, 60); }
  pf(2, x, y, 0, 0, 0.4, 6, c1);
}
function ftext(x: number, y: number, txt: string, c = "#ffd23f", sz = 20) { sim.texts.push({ x, y, txt, life: 1, c, sz }); }

// ---------------------------------------------------------------- game flow
const hintShown = new Set<string>();
let hintTimer: any = 0;
function showHint(key: string, text: string) {
  if (hintShown.has(key)) return;
  hintShown.add(key); hud.hint = text;
  if (hintTimer) clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { hud.hint = ""; }, 2500);
}
function resetSim() {
  Object.assign(sim, {
    dist: 0, speed: 0, h: 0, vy: 0, held: false, holdT: 0, duck: false, ground: true, air: 0, buffer: 0, coyote: 0,
    sx: 1, sy: 1, svx: 0, svy: 0, energy: 0.65, lives: CFG.lives, inv: 0, bump: 0, cells: 0, ice: 0, totalUnits: 0,
    combo: 0, comboT: 0, nextX: 600, t: 0, shake: 0, flash: 0, endT: 0, won: false, cause: "win", comboMax: 0,
    hazards: [], items: [], parts: [], texts: [], hintDebris: false, hintJump: true,
  });
  sim.gap = sim.gapMax * 0.75;
  hud.hint = ""; hintShown.clear(); if (hintTimer) clearTimeout(hintTimer); moreFacts.value = false;
  lastPat = null;
  topUp();
}
function begin() {
  sfx.unlock?.(); music.play("minigame");
  resetSim();
  phase.value = "count"; cdT = 0; cdShown = 4; tickCount(0);
}
let cdT = 0, cdShown = 4;
function tickCount(dt: number) {
  cdT += dt;
  const n = 3 - Math.floor(cdT / 0.8);
  if (n !== cdShown) {
    cdShown = n;
    if (n > 0) { countNum.value = String(n); sfx.countdown(); }
    else if (n === 0) { countNum.value = "GO!"; sfx.go(); }
    else { phase.value = "play"; }
  }
}
function pause() { if (phase.value === "play") { phase.value = "paused"; sim.held = false; duckBtn.value = false; sim.duck = false; } }
function resume() { if (phase.value === "paused") { phase.value = "play"; last = 0; } }
function onVis() { if (document.hidden) { if (phase.value === "play") pause(); } else last = 0; }

function finishRun(won: boolean, cause: "win" | "night" | "lives") {
  sim.won = won; sim.cause = cause; sim.endT = 0; phase.value = "end";
  sim.held = false; sim.duck = false;
  if (won) { sfx.win(); for (let i = 0; i < 4; i++) setTimeout(() => sparkBurst(rx + rand(-60, 160), gy - rand(40, 150), "#ffd23f", "#7cf29c", 12), i * 220); }
  else { sfx.gameOver(); sfx.fail(); sim.shake = 12; }
}
function showResult() {
  const ratio = sim.totalUnits ? (sim.cells + sim.ice * 2) / sim.totalUnits : 0;
  const progress = clamp(sim.dist / CFG.target, 0, 1);
  const won = sim.won;
  const score = won
    ? Math.round(clamp(40 + 40 * Math.min(1, ratio * 1.25) + 20 * (sim.lives / CFG.lives), 0, 100))
    : Math.round(clamp(30 * progress + 15 * ratio, 0, 45));
  Object.assign(result, { won, score, cells: sim.cells, ice: sim.ice, lives: sim.lives, cause: sim.cause });
  result.facts = won ? [F_ICE, F_LRV] : sim.cause === "night" ? [F_NIGHT, F_LRV] : [F_GRAV, F_NIGHT];
  phase.value = "result";
}
function done() { music.play("base"); emit("finish", { won: result.won, score: result.score }); }

// ---------------------------------------------------------------- input
function wantJump() { sim.held = true; sim.holdT = 0; sim.buffer = 0.13; }
function onKeyDown(e: KeyboardEvent) {
  const k = e.key;
  const ctl = ["ArrowUp", "ArrowDown", " ", "w", "W", "s", "S", "Spacebar"].includes(k);
  if (phase.value === "play" || phase.value === "count") { if (ctl) e.preventDefault(); }
  if (k === "Escape" || k === "p" || k === "P") { if (phase.value === "play") pause(); else if (phase.value === "paused") resume(); return; }
  if (phase.value !== "play") return;
  if (k === " " || k === "ArrowUp" || k === "w" || k === "W" || k === "Spacebar") { if (!e.repeat) wantJump(); }
  else if (k === "ArrowDown" || k === "s" || k === "S") sim.duck = true;
}
function onKeyUp(e: KeyboardEvent) {
  const k = e.key;
  if (k === " " || k === "ArrowUp" || k === "w" || k === "W" || k === "Spacebar") sim.held = false;
  else if (k === "ArrowDown" || k === "s" || k === "S") sim.duck = false;
}
let ptr = -1, ptrY = 0, ptrSwiped = false;
function onPtrDown(e: PointerEvent) {
  if (phase.value !== "play") return;
  if (e.pointerType === "mouse" && e.button !== 0) return;
  coarse.value = e.pointerType !== "mouse" || coarse.value;
  ptr = e.pointerId; ptrY = e.clientY; ptrSwiped = false;
  wantJump();
}
function onPtrMove(e: PointerEvent) {
  if (e.pointerId !== ptr || phase.value !== "play") return;
  if (!ptrSwiped && e.clientY - ptrY > 36) { ptrSwiped = true; sim.held = false; sim.duck = true; if (sim.vy > 0) sim.vy = 0; }
}
function onPtrUp(e: PointerEvent) {
  if (e.pointerId !== ptr) return;
  ptr = -1; sim.held = false; if (ptrSwiped) sim.duck = false;
}
function duckDown(e: PointerEvent) { e.stopPropagation(); duckBtn.value = true; sim.duck = true; }
function duckUp(e: PointerEvent) { e.stopPropagation(); duckBtn.value = false; sim.duck = false; }

// ---------------------------------------------------------------- update
function update(dt: number) {
  time += dt;
  const ph = phase.value;
  const playing = ph === "play";
  const ending = ph === "end";

  if (ph === "count") tickCount(dt);

  // speed
  let target = 0;
  if (playing) {
    const f = 0.6 + 0.55 * sim.energy;
    const ramp = Math.min(1, sim.t / 1.6);
    target = BASE * f * (1 - sim.bump * 0.55) * (0.35 + 0.65 * ramp);
  } else if (ph === "intro" || ph === "count" || ph === "result") target = ph === "result" && sim.won ? 0 : 55;
  else if (ending) target = sim.won ? Math.max(0, 1 - sim.endT / 1.4) * BASE * 0.5 : Math.max(0, 1 - sim.endT / 0.7) * BASE * 0.4;
  sim.speed += (target - sim.speed) * Math.min(1, dt * (playing ? 4 : 3));
  if (sim.speed < 0.5 && target === 0) sim.speed = 0;
  const adv = sim.speed * dt;
  sim.dist += adv;
  sim.wheel += adv / 9;
  sim.bump = Math.max(0, sim.bump - dt * 1.2);

  // rover physics (not during intro/count: stays grounded)
  if (playing || ending) {
    if (playing) sim.t += dt;
    sim.coyote = sim.ground ? 0.09 : Math.max(0, sim.coyote - dt);
    if (sim.buffer > 0) sim.buffer -= dt;
    if (playing && sim.buffer > 0 && (sim.ground || sim.coyote > 0) && !sim.duck) {
      sim.vy = JUMP_V; sim.ground = false; sim.coyote = 0; sim.buffer = 0; sim.holdT = 0;
      sim.svy += 5; // stretch kick
      sfx.jump(); dust(rx, 8, 55);
    }
    if (!sim.ground) {
      let g = G_FALL;
      if (sim.vy > 0) {
        if (sim.held && sim.holdT < HOLD_MAX) { g = G_HOLD; sim.holdT += dt; }
        else if (!sim.held && sim.holdT < HOLD_MAX) { g = sim.holdT < 0.12 ? G_HOLD : G_CUT; sim.holdT += dt; }
      }
      if (sim.duck) g *= 2.6;
      sim.vy -= g * dt;
      sim.h += sim.vy * dt;
      sim.air += dt;
      if (sim.h <= 0) {
        sim.h = 0;
        const imp = -sim.vy;
        sim.vy = 0; sim.ground = true;
        sim.sy = 1 - clamp(imp / 700, 0.08, 0.34); sim.sx = 2 - sim.sy; sim.svx = 0; sim.svy = 0;
        sfx.land(); dust(rx, 11, 90);
        sim.air = 0;
        if (sim.buffer > 0) { /* buffered jump fires next frame */ }
      }
    }
  } else { sim.h = 0; sim.vy = 0; sim.ground = true; }
  // squash springs
  const tsy = sim.duck && playing ? 0.74 : 1 + (sim.ground ? 0 : clamp(Math.abs(sim.vy) / 1500, 0, 0.12));
  const tsx = sim.duck && playing ? 1.12 : 1 - (sim.ground ? 0 : clamp(Math.abs(sim.vy) / 3200, 0, 0.06));
  sim.svy += ((tsy - sim.sy) * 260 - sim.svy * 17) * dt; sim.sy += sim.svy * dt;
  sim.svx += ((tsx - sim.sx) * 260 - sim.svx * 17) * dt; sim.sx += sim.svx * dt;

  // wheel dust
  if (sim.ground && sim.speed > 40) {
    sim.dustT -= dt;
    if (sim.dustT <= 0) { sim.dustT = 0.05 + 40 / (sim.speed + 100) * 0.05; dust(rx - 28, 1, 25); if (!reduced && Math.random() < 0.5) dust(rx + 22, 1, 15); }
  }

  if (playing) {
    // energy + night
    sim.energy = clamp(sim.energy - CFG.drain * dt, 0, 1);
    const prog = clamp(sim.dist / CFG.target, 0, 1);
    const nightSpeed = BASE * (0.8 + 0.16 * prog);
    sim.gap = clamp(sim.gap + (sim.speed - nightSpeed) * dt, -5, sim.gapMax);
    if (sim.gap <= 0) { finishRun(false, "night"); }
    if (sim.inv > 0) sim.inv -= dt;
    topUp();

    // collisions
    const top = sim.h + (sim.duck ? 24 : 38);
    for (const hzd of sim.hazards) {
      if (hzd.hit) continue;
      const sx = rx + (hzd.x - sim.dist);
      if (sx > rx + 80 || sx + hzd.w < rx - 80) continue;
      let hitNow = false;
      if (hzd.t === "crater") hitNow = sim.h < 6 && rx > sx + 9 && rx < sx + hzd.w - 9;
      else if (hzd.t === "debris") {
        const bob = Math.sin(time * 2 + hzd.ph) * 3;
        hitNow = rx + 17 > sx + 5 && rx - 17 < sx + hzd.w - 5 && sim.h < 58 + bob && top > 30 + bob;
      } else hitNow = rx + 17 > sx + 4 && rx - 17 < sx + hzd.w - 4 && sim.h < hzd.h * 0.85;
      if (hitNow && sim.inv <= 0) bumpHit(hzd);
    }
    // hints
    if (sim.t > 0.15) showHint("jump", coarse.value ? "Tap to jump, hold to float higher!" : "SPACE to jump, hold to float higher!");
    if (!hintShown.has("duck")) {
      const d = sim.hazards.find((q) => q.t === "debris" && q.x - sim.dist > 0 && q.x - sim.dist < 360);
      if (d && sim.t > 3) showHint("duck", coarse.value ? "Swipe down or hold DUCK under debris!" : "Press ↓ to duck under debris!");
    }

    // pick-ups
    const cy = sim.h + (sim.duck ? 14 : 20);
    for (const it of sim.items) {
      if (it.got) continue;
      const sx = rx + (it.x - sim.dist);
      if (sx < rx - 40) continue;
      if (sx > rx + 40) break;
      if (Math.abs(sx - rx) < 32 && Math.abs(it.y - cy) < 32) collect(it, sx);
    }
    sim.comboT -= dt; if (sim.comboT <= 0) sim.combo = 0;

    // win
    if (sim.dist >= CFG.target - 40 && phase.value === "play") finishRun(true, "win");
  }
  if (ending) {
    sim.endT += dt;
    if (!sim.won && sim.cause === "night" && sim.gap < 40) sim.gap = Math.max(-60, sim.gap - dt * 90);
    if (sim.endT > (sim.won ? 2.1 : 1.4)) showResult();
  }

  // cull
  if (sim.hazards.length && sim.hazards[0].x + sim.hazards[0].w < sim.dist - 200) sim.hazards.shift();
  while (sim.items.length && sim.items[0].x < sim.dist - 200) sim.items.shift();

  // particles
  const sc = (adv);
  for (let i = sim.parts.length - 1; i >= 0; i--) {
    const p = sim.parts[i];
    p.life -= dt;
    if (p.life <= 0) { sim.parts.splice(i, 1); continue; }
    p.vy += p.g * dt;
    p.x += p.vx * dt - sc; p.y += p.vy * dt;
    if (p.k === 0 && p.y > p.gy) { p.y = p.gy; p.vy = 0; p.vx = 0; p.g = 0; }
  }
  for (let i = sim.texts.length - 1; i >= 0; i--) {
    const t = sim.texts[i]; t.life -= dt * 1.1; t.y -= 38 * dt; t.x -= sc;
    if (t.life <= 0) sim.texts.splice(i, 1);
  }
  sim.shake = Math.max(0, sim.shake - dt * 26);
  sim.flash = Math.max(0, sim.flash - dt * 2.2);

  // throttled HUD
  hudT -= dt;
  if (hudT <= 0) {
    hudT = 0.1;
    hud.pct = clamp(sim.dist / CFG.target, 0, 1);
    hud.nightPct = clamp((sim.dist - sim.gap) / CFG.target, 0, 1);
    hud.m = Math.round(Math.min(sim.dist, CFG.target) / PX_PER_M);
    hud.lives = sim.lives; hud.energy = sim.energy; hud.combo = sim.combo;
    hud.kmh = Math.round(sim.speed / KMH_DIV);
    hud.warn = playing && sim.gap < sim.gapMax * 0.35;
  }
}

function bumpHit(h: Haz) {
  h.hit = true;
  sim.lives--; sim.inv = 1.7; sim.bump = 1; sim.combo = 0;
  sim.shake = reduced ? 0 : 10; sim.flash = reduced ? 0.25 : 0.55; sim.flashC = "239,68,68";
  sim.gap = Math.max(0, sim.gap - 35);
  sim.vy = 380; sim.ground = false; sim.h = Math.max(sim.h, 1);
  sim.holdT = 1;
  sfx.explosion(); sfx.wrong();
  for (let i = 0; i < 12; i++) { const a = rand(3.4, 6), v = rand(60, 180); pf(3, rx, gy - sim.h - 14, Math.cos(a) * v, Math.sin(a) * v, rand(0.5, 0.9), rand(2, 4.5), Math.random() < 0.5 ? "#c9ccdc" : "#ff9f43", 520); }
  dust(rx, 10, 100);
  ftext(rx, gy - 70, sim.lives > 0 ? "Ouch!" : "Crash!", "#ff6b6b", 22);
  if (sim.lives <= 0) finishRun(false, "lives");
}
function collect(it: Item, sx: number) {
  it.got = true;
  const isIce = it.t === "ice";
  if (isIce) { sim.ice++; sim.energy = clamp(sim.energy + 0.2, 0, 1); sfx.powerUp(); sparkBurst(sx, gy - it.y, "#7be0ff", "#ffffff", 16); ftext(sx, gy - it.y - 12, "+ICE!", "#7be0ff", 22); }
  else { sim.cells++; sim.energy = clamp(sim.energy + CFG.gain, 0, 1); sfx.coin(); sparkBurst(sx, gy - it.y, "#ffd23f", "#fff6c2", 8); ftext(sx, gy - it.y - 12, "+⚡", "#ffd23f", 18); }
  sim.combo = sim.comboT > 0 ? sim.combo + (isIce ? 2 : 1) : (isIce ? 2 : 1);
  sim.comboT = 1.9;
  sim.gap = Math.min(sim.gapMax, sim.gap + (isIce ? 12 : 4));
  if (sim.combo > sim.comboMax) sim.comboMax = sim.combo;
  if (sim.combo >= 5 && sim.combo % 5 < (isIce ? 2 : 1)) { sim.energy = clamp(sim.energy + 0.04, 0, 1); ftext(rx + 30, gy - sim.h - 70, `COMBO x${sim.combo}!`, "#ffffff", 24); sfx.powerUp(); }
}

// ---------------------------------------------------------------- drawing helpers
function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function star4(c: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  c.beginPath();
  for (let i = 0; i < 8; i++) { const a = rot + (i * Math.PI) / 4, rad = i % 2 ? r * 0.3 : r; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
  c.closePath();
}

function buildSprites() {
  // sky (gradient + nebula) is built in resize(); here: earth, cell, ice
  const mk = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")!] as const; };
  {
    const R = 128, [c, g] = mk(R * 2 + 60, R * 2 + 60), cx = R + 30, cy = R + 30;
    const glow = g.createRadialGradient(cx, cy, R * 0.95, cx, cy, R + 28);
    glow.addColorStop(0, "rgba(110,190,255,.55)"); glow.addColorStop(1, "rgba(110,190,255,0)");
    g.fillStyle = glow; g.fillRect(0, 0, c.width, c.height);
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 6.2832); g.clip();
    const o = g.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R);
    o.addColorStop(0, "#5fc4ff"); o.addColorStop(0.6, "#2b78d6"); o.addColorStop(1, "#143a8a");
    g.fillStyle = o; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "#4fb872";
    const blobs: [number, number, number, number][] = [[-0.35, -0.2, 0.34, 0.2], [-0.1, 0.35, 0.2, 0.3], [0.4, -0.3, 0.28, 0.16], [0.35, 0.25, 0.2, 0.17], [-0.62, 0.15, 0.14, 0.2]];
    for (const [bx, by, bw, bh] of blobs) { g.beginPath(); g.ellipse(cx + bx * R, cy + by * R, bw * R, bh * R, 0.5, 0, 6.2832); g.fill(); }
    g.fillStyle = "#d9c98a"; g.beginPath(); g.ellipse(cx - 0.3 * R, cy + 0.05 * R, 0.1 * R, 0.07 * R, 0.3, 0, 6.2832); g.fill();
    g.fillStyle = "rgba(255,255,255,.45)";
    for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(cx + (hash(i) - 0.5) * R * 1.6, cy + (hash(i + 9) - 0.5) * R * 1.6, R * (0.1 + hash(i + 3) * 0.12), R * 0.035, hash(i + 6), 0, 6.2832); g.fill(); }
    const sh = g.createLinearGradient(cx - R * 0.2, cy - R, cx + R, cy + R);
    sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(4,8,30,.62)");
    g.fillStyle = sh; g.fillRect(0, 0, c.width, c.height);
    g.restore(); earth = c;
  }
  {
    const [c, g] = mk(64, 64);
    const h = g.createRadialGradient(32, 32, 4, 32, 32, 32); h.addColorStop(0, "rgba(255,214,70,.8)"); h.addColorStop(0.5, "rgba(255,200,60,.25)"); h.addColorStop(1, "rgba(255,200,60,0)");
    g.fillStyle = h; g.fillRect(0, 0, 64, 64);
    g.save(); g.translate(32, 32); g.rotate(-0.2);
    rr(g, -15, -15, 30, 30, 6); g.fillStyle = "#16327a"; g.fill(); g.lineWidth = 3; g.strokeStyle = "#ffd23f"; g.stroke();
    g.strokeStyle = "rgba(130,180,255,.8)"; g.lineWidth = 1.4;
    for (let i = -5; i <= 5; i += 5) { g.beginPath(); g.moveTo(i * 2, -13); g.lineTo(i * 2, 13); g.stroke(); g.beginPath(); g.moveTo(-13, i * 2); g.lineTo(13, i * 2); g.stroke(); }
    g.fillStyle = "#ffe36b"; g.beginPath(); g.moveTo(3, -11); g.lineTo(-6, 2); g.lineTo(-0.5, 2); g.lineTo(-3, 11); g.lineTo(7, -2); g.lineTo(1.5, -2); g.closePath(); g.fill();
    g.restore(); sprCell = c;
  }
  {
    const [c, g] = mk(64, 64);
    const h = g.createRadialGradient(32, 32, 4, 32, 32, 32); h.addColorStop(0, "rgba(120,225,255,.8)"); h.addColorStop(0.5, "rgba(90,200,255,.25)"); h.addColorStop(1, "rgba(90,200,255,0)");
    g.fillStyle = h; g.fillRect(0, 0, 64, 64);
    g.save(); g.translate(32, 32);
    const pts: [number, number][] = [[0, -22], [12, -9], [10, 14], [0, 22], [-10, 14], [-12, -9]];
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
    const f = g.createLinearGradient(-12, -22, 12, 22); f.addColorStop(0, "#e6fbff"); f.addColorStop(0.5, "#7be0ff"); f.addColorStop(1, "#2a9fe0");
    g.fillStyle = f; g.fill(); g.strokeStyle = "#ffffff"; g.lineWidth = 2; g.stroke();
    g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(0, -22); g.lineTo(0, 22); g.moveTo(-12, -9); g.lineTo(0, 2); g.lineTo(12, -9); g.stroke();
    g.restore(); sprIce = c;
  }
}

// ---------------------------------------------------------------- draw
function drawSky(c: CanvasRenderingContext2D) {
  if (sky) c.drawImage(sky, 0, 0, W, H);
  // stars
  const dp = sim.dist * 0.02;
  for (const s of stars) {
    let x = (s.x * W - dp * s.s) % W; if (x < 0) x += W;
    const a = reduced ? 0.8 : 0.5 + 0.5 * Math.sin(time * s.sp + s.ph);
    c.globalAlpha = 0.35 + 0.65 * a;
    c.fillStyle = "#fff";
    if (s.s > 1.5) { c.fillRect(x - s.s * 0.5, s.y * gy * 0.92, s.s, s.s); } else c.fillRect(x, s.y * gy * 0.92, s.s, s.s);
  }
  c.globalAlpha = 1;
  // Earth
  if (earth) {
    const R = clamp(H * 0.085, 30, 50);
    const ex = W * 0.8 - (sim.dist * 0.004) % 20, ey = Math.max(gy * 0.3, 130 / scale);
    const sz = (R * 2 + 60 * (R / 128) * 0.5) * 1;
    const full = (earth.width / 256) * R * 2;
    c.drawImage(earth, ex - full / 2, ey - full / 2, full, full);
    void sz;
  }
}
function ridge(c: CanvasRenderingContext2D, par: number, amp: number, freq: number, seed: number, c1: string, c2: string) {
  const off = sim.dist * par, step = 9;
  c.beginPath(); c.moveTo(0, gy + 2);
  for (let x = 0; x <= W + step; x += step) {
    const u = (x + off) * freq;
    const y = gy - amp * (0.5 * Math.abs(Math.sin(u + seed)) + 0.3 * Math.abs(Math.sin(u * 2.4 + seed * 2)) + 0.2 * Math.sin(u * 5.3 + seed * 3) * 0.5 + 0.1);
    c.lineTo(x, y);
  }
  c.lineTo(W, gy + 2); c.closePath();
  const g = c.createLinearGradient(0, gy - amp, 0, gy); g.addColorStop(0, c1); g.addColorStop(1, c2);
  c.fillStyle = g; c.fill();
}
function drawGround(c: CanvasRenderingContext2D) {
  const gh = H - gy;
  const g = c.createLinearGradient(0, gy, 0, H);
  g.addColorStop(0, "#d9dbe4"); g.addColorStop(0.35, "#b8bccb"); g.addColorStop(1, "#7f849c");
  c.fillStyle = g; c.fillRect(-10, gy, W + 20, gh + 10);
  c.fillStyle = "rgba(255,255,255,.55)"; c.fillRect(-10, gy, W + 20, 2);
  // texture rows with depth parallax
  for (let r = 0; r < 3; r++) {
    const par = 1 + r * 0.3, tile = 90 + r * 20, y = gy + 16 + r * (gh - 24) / 3.1;
    const i0 = Math.floor((sim.dist * par) / tile);
    for (let i = i0; i * tile - sim.dist * par < W + tile; i++) {
      const hh = hash(i * 3.7 + r * 91), x = i * tile - sim.dist * par + hh * tile * 0.6;
      const w = 12 + hash(i + r) * (20 + r * 14), hgt = w * (0.28 + r * 0.05);
      c.fillStyle = `rgba(70,76,110,${0.18 + r * 0.05})`; c.beginPath(); c.ellipse(x, y, w, hgt, 0, 0, 6.2832); c.fill();
      c.strokeStyle = "rgba(255,255,255,.4)"; c.lineWidth = 1.4; c.beginPath(); c.ellipse(x, y - 1, w, hgt, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
      if (hh > 0.55) { c.fillStyle = "rgba(90,96,130,.35)"; c.beginPath(); c.arc(x + w + 14, y + 3, 2 + r, 0, 6.2832); c.fill(); }
    }
  }
}
function drawMidRocks(c: CanvasRenderingContext2D) {
  const par = 0.55, tile = 230, i0 = Math.floor((sim.dist * par) / tile);
  for (let i = i0; i * tile - sim.dist * par < W + tile; i++) {
    const x = i * tile - sim.dist * par + hash(i) * 120, s = 10 + hash(i + 5) * 22;
    c.fillStyle = "#7b809b";
    c.beginPath(); c.moveTo(x - s, gy); c.lineTo(x - s * 0.7, gy - s * 0.7); c.lineTo(x, gy - s); c.lineTo(x + s * 0.8, gy - s * 0.55); c.lineTo(x + s, gy); c.closePath(); c.fill();
    c.fillStyle = "rgba(255,255,255,.18)"; c.beginPath(); c.moveTo(x - s * 0.7, gy - s * 0.7); c.lineTo(x, gy - s); c.lineTo(x - s * 0.1, gy - s * 0.3); c.closePath(); c.fill();
  }
}

function drawHazards(c: CanvasRenderingContext2D) {
  for (const h of sim.hazards) {
    const x = rx + (h.x - sim.dist);
    if (x > W + 60 || x + h.w < -60) continue;
    if (h.t === "crater") {
      const d = 18 + h.w * 0.16;
      c.beginPath(); c.moveTo(x - 6, gy); c.quadraticCurveTo(x + h.w * 0.15, gy + d * 1.9, x + h.w / 2, gy + d * 1.9); c.quadraticCurveTo(x + h.w * 0.85, gy + d * 1.9, x + h.w + 6, gy); c.closePath();
      const g = c.createLinearGradient(0, gy, 0, gy + d * 1.9); g.addColorStop(0, "#5d6384"); g.addColorStop(1, "#2a2e4a");
      c.fillStyle = g; c.fill();
      c.fillStyle = "rgba(255,255,255,.14)"; c.beginPath(); c.ellipse(x + h.w * 0.5, gy + d * 1.55, h.w * 0.28, d * 0.18, 0, 0, 6.2832); c.fill();
      c.fillStyle = "#eceef6"; c.beginPath(); c.ellipse(x - 5, gy + 1, 10, 4, 0, 0, 6.2832); c.fill(); c.beginPath(); c.ellipse(x + h.w + 5, gy + 1, 10, 4, 0, 0, 6.2832); c.fill();
    } else if (h.t === "rock" || h.t === "boulder") {
      const w = h.w, hh = h.h;
      c.fillStyle = "rgba(40,44,70,.28)"; c.beginPath(); c.ellipse(x + w / 2 + 6, gy + 3, w * 0.62, 5, 0, 0, 6.2832); c.fill();
      c.beginPath(); c.moveTo(x, gy); c.lineTo(x + w * 0.05, gy - hh * 0.55); c.lineTo(x + w * 0.3, gy - hh * 0.95); c.lineTo(x + w * 0.62, gy - hh); c.lineTo(x + w * 0.95, gy - hh * 0.5); c.lineTo(x + w, gy); c.closePath();
      const g = c.createLinearGradient(x, gy - hh, x + w, gy); g.addColorStop(0, "#a3a8bf"); g.addColorStop(1, "#6a6f8c");
      c.fillStyle = g; c.fill(); c.lineWidth = 2; c.strokeStyle = "#4d5170"; c.stroke();
      c.fillStyle = "rgba(255,255,255,.3)"; c.beginPath(); c.moveTo(x + w * 0.05, gy - hh * 0.55); c.lineTo(x + w * 0.3, gy - hh * 0.95); c.lineTo(x + w * 0.62, gy - hh); c.lineTo(x + w * 0.4, gy - hh * 0.55); c.closePath(); c.fill();
      if (h.t === "boulder") { c.strokeStyle = "rgba(40,44,70,.5)"; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x + w * 0.5, gy - hh * 0.9); c.lineTo(x + w * 0.42, gy - hh * 0.5); c.lineTo(x + w * 0.55, gy - hh * 0.2); c.stroke(); }
    } else {
      const bob = Math.sin(time * 2 + h.ph) * 3, cx = x + h.w / 2, cyy = gy - 44 + bob;
      c.fillStyle = "rgba(40,44,70,.25)"; c.beginPath(); c.ellipse(cx, gy + 3, 24, 4, 0, 0, 6.2832); c.fill();
      c.save(); c.translate(cx, cyy); c.rotate(Math.sin(time * 1.3 + h.ph) * 0.22);
      c.fillStyle = "#1b3d8f"; rr(c, -24, -4, 14, 9, 2); c.fill(); rr(c, 10, -4, 14, 9, 2); c.fill();
      c.strokeStyle = "rgba(150,190,255,.7)"; c.lineWidth = 1; c.beginPath(); c.moveTo(-17, -4); c.lineTo(-17, 5); c.moveTo(17, -4); c.lineTo(17, 5); c.stroke();
      rr(c, -10, -9, 20, 18, 4); c.fillStyle = "#c9cde0"; c.fill(); c.strokeStyle = "#6c7190"; c.lineWidth = 2; c.stroke();
      c.fillStyle = "#6c7190"; c.fillRect(-6, -3, 12, 3);
      c.strokeStyle = "#8a8fa8"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -9); c.lineTo(5, -17); c.stroke();
      c.fillStyle = Math.sin(time * 8 + h.ph) > 0 ? "#ff4d4d" : "#7a2a2a"; c.beginPath(); c.arc(0, 4, 2.2, 0, 6.2832); c.fill();
      c.restore();
    }
  }
}
function drawItems(c: CanvasRenderingContext2D) {
  for (const it of sim.items) {
    if (it.got) continue;
    const x = rx + (it.x - sim.dist);
    if (x > W + 30) break; if (x < -30) continue;
    const bob = Math.sin(time * 3 + it.ph) * 3;
    const y = gy - it.y + bob;
    const spr = it.t === "ice" ? sprIce : sprCell; if (!spr) continue;
    const sz = it.t === "ice" ? 40 : 34, sw = reduced ? 1 : 0.55 + 0.45 * Math.abs(Math.cos(time * 2.2 + it.ph));
    c.drawImage(spr, x - (sz * sw) / 2, y - sz / 2, sz * sw, sz);
  }
}
function drawBase(c: CanvasRenderingContext2D) {
  const fx = rx + (CFG.target - sim.dist);
  if (fx > W + 400 || fx < -500) return;
  const t = time;
  // runway lights
  for (let i = 0; i < 9; i++) {
    const x = fx - 380 + i * 42; const on = Math.floor(t * 6) % 9 === i;
    c.fillStyle = on ? "#fff3a0" : "#ffd23f"; c.globalAlpha = on ? 1 : 0.6; c.beginPath(); c.arc(x, gy + 8, on ? 4.5 : 3, 0, 6.2832); c.fill();
  }
  c.globalAlpha = 1;
  // pad glow
  const pg = c.createRadialGradient(fx, gy + 4, 4, fx, gy + 4, 220); pg.addColorStop(0, "rgba(120,255,200,.55)"); pg.addColorStop(1, "rgba(120,255,200,0)");
  c.fillStyle = pg; c.fillRect(fx - 220, gy - 120, 440, 190);
  // solar arrays
  for (const dx of [-150, 150]) {
    c.fillStyle = "#8a8fa8"; c.fillRect(fx + dx - 2, gy - 26, 4, 26);
    c.save(); c.translate(fx + dx, gy - 28); c.rotate(dx < 0 ? -0.25 : 0.25); c.fillStyle = "#1b3d8f"; rr(c, -34, -10, 68, 20, 3); c.fill(); c.strokeStyle = "rgba(150,190,255,.7)"; c.lineWidth = 1;
    for (let i = -24; i <= 24; i += 12) { c.beginPath(); c.moveTo(i, -10); c.lineTo(i, 10); c.stroke(); } c.restore();
  }
  // domes
  const dome = (x: number, r: number) => {
    const g = c.createLinearGradient(x - r, gy - r, x + r, gy); g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#aeb6d4");
    c.fillStyle = g; c.beginPath(); c.arc(x, gy, r, Math.PI, 0); c.closePath(); c.fill(); c.strokeStyle = "#7b83a6"; c.lineWidth = 2; c.stroke();
    c.fillStyle = "rgba(255,225,120,.95)"; c.beginPath(); c.arc(x, gy, r * 0.62, Math.PI * 1.1, Math.PI * 1.9); c.closePath(); c.fill();
    c.fillStyle = "rgba(255,255,255,.35)"; c.beginPath(); c.ellipse(x - r * 0.35, gy - r * 0.6, r * 0.18, r * 0.08, -0.7, 0, 6.2832); c.fill();
  };
  dome(fx + 55, 36); dome(fx - 30, 52); dome(fx + 110, 22);
  // tower + antenna
  c.fillStyle = "#c6cbe0"; c.fillRect(fx - 100, gy - 90, 6, 90);
  c.fillStyle = Math.sin(t * 7) > 0 ? "#ff6b9d" : "#80264a"; c.beginPath(); c.arc(fx - 97, gy - 94, 4, 0, 6.2832); c.fill();
  // flag
  c.fillStyle = "#fff"; c.fillRect(fx + 160, gy - 80, 3, 80); c.fillStyle = "#3a9bff"; c.beginPath(); c.moveTo(fx + 163, gy - 80); c.lineTo(fx + 192, gy - 72 + Math.sin(t * 4) * 2); c.lineTo(fx + 163, gy - 62); c.closePath(); c.fill();
  // sign
  c.font = '700 26px "Fredoka", sans-serif'; c.textAlign = "center"; c.lineWidth = 6; c.strokeStyle = "rgba(10,20,50,.85)"; c.strokeText("BASE", fx, gy - 120); c.fillStyle = "#7cf29c"; c.fillText("BASE", fx, gy - 120);
  // beams
  c.globalCompositeOperation = "lighter";
  for (const dx of [-30, 55]) { const bg = c.createLinearGradient(0, gy - 300, 0, gy - 40); bg.addColorStop(0, "rgba(120,255,200,0)"); bg.addColorStop(1, "rgba(120,255,200,.22)"); c.fillStyle = bg; c.beginPath(); c.moveTo(fx + dx - 10, gy - 40); c.lineTo(fx + dx - 40, gy - 300); c.lineTo(fx + dx + 40, gy - 300); c.lineTo(fx + dx + 10, gy - 40); c.closePath(); c.fill(); }
  c.globalCompositeOperation = "source-over";
  // checkered finish line
  for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? "#fff" : "#222"; c.fillRect(fx - 230, gy + 2 + i * 5 * 0, 0, 0); }
  const fl = fx - 270;
  for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? "#ffffff" : "#2a2e4a"; c.fillRect(fl + j * 8, gy - 4 + i * 5, 8, 5); }
}

function drawRover(c: CanvasRenderingContext2D) {
  const x = rx, y = gy - sim.h;
  const blink = sim.inv > 0 && Math.floor(sim.inv * 14) % 2 === 0;
  // shadow
  const sh = clamp(1 - sim.h / 220, 0.35, 1);
  c.fillStyle = `rgba(30,34,60,${0.35 * sh})`; c.beginPath(); c.ellipse(x, gy + 4, 36 * sh, 5 * sh, 0, 0, 6.2832); c.fill();
  c.save();
  if (blink) c.globalAlpha = 0.35;
  const tilt = clamp(-sim.vy / 2600, -0.16, 0.16) * (sim.ground ? 0 : 1) - (sim.ground ? 0 : 0);
  c.translate(x, y); c.rotate(-tilt); c.scale(sim.sx, sim.sy);
  const bounce = sim.ground && sim.speed > 20 ? Math.sin(sim.wheel * 1.7) * 1.2 : 0;
  // wheels
  const wr = 9.5;
  for (const wx of [-23, 0, 23]) {
    const wy = -wr + (sim.ground ? Math.sin(sim.wheel * 1.4 + wx) * 0.6 : 2);
    c.strokeStyle = "#8a8fa8"; c.lineWidth = 3; c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx * 0.7, -17 + bounce); c.stroke();
    c.fillStyle = "#262a40"; c.beginPath(); c.arc(wx, wy, wr, 0, 6.2832); c.fill();
    c.strokeStyle = "#4a5075"; c.lineWidth = 2.4;
    for (let i = 0; i < 10; i++) { const a = sim.wheel + (i * 6.2832) / 10; c.beginPath(); c.moveTo(wx + Math.cos(a) * (wr - 2), wy + Math.sin(a) * (wr - 2)); c.lineTo(wx + Math.cos(a) * (wr + 1.2), wy + Math.sin(a) * (wr + 1.2)); c.stroke(); }
    c.fillStyle = "#cdd2ea"; c.beginPath(); c.arc(wx, wy, 4.4, 0, 6.2832); c.fill();
    c.strokeStyle = "#7b83a6"; c.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) { const a = sim.wheel * 1 + (i * 6.2832) / 3; c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx + Math.cos(a) * 4, wy + Math.sin(a) * 4); c.stroke(); }
  }
  c.translate(0, bounce);
  // back solar panel
  c.save(); c.translate(-26, -30); c.rotate(-0.28);
  c.strokeStyle = "#8a8fa8"; c.lineWidth = 2; c.beginPath(); c.moveTo(6, 10); c.lineTo(6, 0); c.stroke();
  c.fillStyle = "#1c3f9a"; rr(c, -14, -8, 34, 8, 2); c.fill(); c.strokeStyle = "rgba(160,200,255,.8)"; c.lineWidth = 1;
  for (let i = -8; i <= 14; i += 7) { c.beginPath(); c.moveTo(i, -8); c.lineTo(i, 0); c.stroke(); }
  c.fillStyle = `rgba(255,220,90,${0.18 + sim.energy * 0.35})`; rr(c, -14, -8, 34, 8, 2); c.fill();
  c.restore();
  // chassis
  rr(c, -31, -32, 62, 17, 8);
  const g = c.createLinearGradient(0, -32, 0, -15); g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#bcc3de");
  c.fillStyle = g; c.fill(); c.lineWidth = 2; c.strokeStyle = "#7b83a6"; c.stroke();
  c.fillStyle = "#3fd0c9"; c.fillRect(-26, -22, 52, 4);
  c.fillStyle = "#ff9f43"; c.fillRect(-26, -26, 10, 2.5);
  // Tobish
  c.fillStyle = "#ff9f43"; rr(c, -11, -42, 14, 12, 4); c.fill();
  const hx = -3, hy = -45;
  c.fillStyle = "#fff"; c.beginPath(); c.arc(hx, hy, 9.5, 0, 6.2832); c.fill(); c.strokeStyle = "#9aa2c4"; c.lineWidth = 1.6; c.stroke();
  const vg = c.createLinearGradient(hx, hy - 6, hx + 8, hy + 6); vg.addColorStop(0, "#5fc4ff"); vg.addColorStop(1, "#16327a");
  c.fillStyle = vg; rr(c, hx - 1, hy - 5.5, 10.5, 10, 4.5); c.fill();
  c.fillStyle = "rgba(255,255,255,.7)"; c.beginPath(); c.ellipse(hx + 3, hy - 2.5, 2.2, 1.1, -0.5, 0, 6.2832); c.fill();
  c.strokeStyle = "#fff"; c.lineWidth = 2; c.beginPath(); c.moveTo(hx - 5, hy - 8); c.lineTo(hx - 8, hy - 14); c.stroke();
  c.fillStyle = Math.sin(time * 6) > 0 ? "#ff6b9d" : "#7d2f4b"; c.beginPath(); c.arc(hx - 8, hy - 14.5, 2.2, 0, 6.2832); c.fill();
  // arm on stick
  c.strokeStyle = "#fff"; c.lineWidth = 3.4; c.lineCap = "round"; c.beginPath(); c.moveTo(0, -37); c.lineTo(11, -31); c.stroke(); c.lineCap = "butt";
  // front dish
  c.strokeStyle = "#8a8fa8"; c.lineWidth = 2; c.beginPath(); c.moveTo(24, -32); c.lineTo(24, -42); c.stroke();
  c.fillStyle = "#e6e9f6"; c.beginPath(); c.ellipse(24, -44, 7, 3.2, -0.5, 0, 6.2832); c.fill();
  // headlight
  c.fillStyle = "#fff2a8"; c.beginPath(); c.arc(31, -24, 3, 0, 6.2832); c.fill();
  c.restore();
  // headlight cone when dark
  const dark = clamp(1 - sim.gap / 160, 0, 1);
  if (dark > 0.05 || sim.energy < 0.01) {
    c.globalCompositeOperation = "lighter";
    const cg = c.createLinearGradient(x + 30, 0, x + 190, 0); cg.addColorStop(0, `rgba(255,240,170,${0.4 * dark})`); cg.addColorStop(1, "rgba(255,240,170,0)");
    c.fillStyle = cg; c.beginPath(); c.moveTo(x + 32, y - 24); c.lineTo(x + 190, y - 70); c.lineTo(x + 190, y + 10); c.closePath(); c.fill();
    c.globalCompositeOperation = "source-over";
  }
}

function drawParts(c: CanvasRenderingContext2D) {
  for (const p of sim.parts) {
    if (p.k !== 0 && p.k !== 3) continue;
    const a = p.life / p.max;
    if (p.k === 0) { c.globalAlpha = a * 0.55; c.fillStyle = p.c; c.beginPath(); c.arc(p.x, p.y, p.s * (1 + (1 - a) * 0.9), 0, 6.2832); c.fill(); }
    else { c.globalAlpha = Math.min(1, a * 2); c.fillStyle = p.c; c.save(); c.translate(p.x, p.y); c.rotate(p.rot + time * 8); c.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); c.restore(); }
  }
  c.globalAlpha = 1; c.globalCompositeOperation = "lighter";
  for (const p of sim.parts) {
    if (p.k === 0 || p.k === 3) continue;
    const a = p.life / p.max;
    c.globalAlpha = clamp(a * 1.4, 0, 1);
    if (p.k === 1) { c.fillStyle = p.c; star4(c, p.x, p.y, p.s * (0.6 + a), p.rot + time * 4); c.fill(); }
    else { c.strokeStyle = p.c; c.lineWidth = 3 * a; c.beginPath(); c.arc(p.x, p.y, 8 + (1 - a) * 34, 0, 6.2832); c.stroke(); }
  }
  c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
}
function drawTexts(c: CanvasRenderingContext2D) {
  c.textAlign = "center";
  for (const t of sim.texts) {
    const a = clamp(t.life * 1.6, 0, 1), pop = 1 + Math.max(0, t.life - 0.8) * 2.5;
    c.globalAlpha = a; c.font = `700 ${t.sz * pop}px "Fredoka", sans-serif`; c.lineWidth = 5; c.strokeStyle = "rgba(10,20,50,.85)"; c.strokeText(t.txt, t.x, t.y); c.fillStyle = t.c; c.fillText(t.txt, t.x, t.y);
  }
  c.globalAlpha = 1;
}

function drawNight(c: CanvasRenderingContext2D) {
  const edge = rx + 10 - sim.gap;
  if (edge + 60 <= 0) return;
  const g = c.createLinearGradient(edge - 130, 0, edge + 60, 0);
  g.addColorStop(0, "rgba(3,5,18,.86)"); g.addColorStop(0.55, "rgba(6,10,32,.7)"); g.addColorStop(1, "rgba(6,10,32,0)");
  c.fillStyle = g; c.fillRect(0, 0, edge + 60, H);
  // warm sunset rim
  const w = c.createLinearGradient(edge + 20, 0, edge + 120, 0); w.addColorStop(0, "rgba(255,150,90,0)"); w.addColorStop(0.3, "rgba(255,150,90,.13)"); w.addColorStop(1, "rgba(255,150,90,0)");
  c.fillStyle = w; c.fillRect(edge + 20, 0, 100, H);
  // creeping shadow fingers on the ground
  c.fillStyle = "rgba(4,6,22,.5)";
  for (let i = 0; i < 4; i++) { const fy = gy + 10 + i * ((H - gy) / 4), l = 50 + 40 * Math.sin(time * 1.2 + i * 1.7); c.beginPath(); c.ellipse(edge + 30 + l * 0.3, fy, l, 7, 0, 0, 6.2832); c.fill(); }
}

function draw() {
  const c = ctx; if (!c) return;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, cv.value!.width, cv.value!.height);
  const sx = sim.shake > 0 && !reduced ? rand(-1, 1) * sim.shake : 0, sy = sim.shake > 0 && !reduced ? rand(-1, 1) * sim.shake : 0;
  const k = dpr * scale;
  c.setTransform(k, 0, 0, k, sx * dpr, sy * dpr);
  drawSky(c);
  ridge(c, 0.06, gy * 0.42, 0.0052, 1.3, "#4a5a8e", "#2c3a6a");
  ridge(c, 0.15, gy * 0.26, 0.0085, 4.1, "#6577a8", "#43558a");
  drawMidRocks(c);
  drawGround(c);
  drawBase(c);
  drawHazards(c);
  drawItems(c);
  drawRover(c);
  drawParts(c);
  // speed lines
  if (!reduced && sim.speed > 80) {
    const a = clamp((sim.speed - 80) / 260, 0, 0.5);
    c.strokeStyle = `rgba(255,255,255,${a * 0.5})`; c.lineWidth = 1.4; c.beginPath();
    for (const l of lines) { c.moveTo(l.x, l.y); c.lineTo(l.x + l.l * (sim.speed / 250), l.y); }
    c.stroke();
  }
  drawTexts(c);
  if (phase.value === "play" || phase.value === "end" || phase.value === "paused") drawNight(c);
  else if (phase.value === "count" || phase.value === "intro") drawNight(c);
  if (hud.warn && phase.value === "play" && !reduced) {
    const a = 0.12 + 0.1 * Math.sin(time * 9);
    const vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, "rgba(255,60,60,0)"); vg.addColorStop(1, `rgba(255,60,60,${a * 1.6})`);
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
  }
  if (sim.flash > 0) { c.fillStyle = `rgba(${sim.flashC},${sim.flash * 0.5})`; c.fillRect(-10, -10, W + 20, H + 20); }
}

function stepLines(dt: number) {
  for (const l of lines) { l.x -= (l.v + sim.speed * 1.6) * dt; if (l.x < -80) { l.x = W + rand(0, 80); l.y = rand(H); } }
}

function frame(ts: number) {
  raf = requestAnimationFrame(frame);
  if (!ctx) return;
  if (!last) last = ts;
  const dt = Math.min(0.033, Math.max(0.001, (ts - last) / 1000)); last = ts;
  if (phase.value === "paused") return;
  update(dt); stepLines(dt); draw();
}

// ---------------------------------------------------------------- resize
function resize() {
  const el = root.value, c = cv.value; if (!el || !c) return;
  const r = el.getBoundingClientRect();
  cssW = Math.max(240, r.width); cssH = Math.max(200, r.height);
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const portrait = cssH > cssW * 1.15;
  scale = clamp(Math.min(cssH / 380, cssW / (portrait ? 430 : 480)), 0.5, 1.6);
  W = cssW / scale; H = cssH / scale;
  gy = portrait ? Math.round(H * 0.64) : Math.round(H - clamp(H * 0.24, 92, 150));
  rx = clamp(W * 0.22, 100, 220);
  c.width = Math.round(cssW * dpr); c.height = Math.round(cssH * dpr);
  c.style.width = cssW + "px"; c.style.height = cssH + "px";
  ctx = c.getContext("2d");
  // sky cache
  const s = document.createElement("canvas"); s.width = Math.ceil(W / 2); s.height = Math.ceil(H / 2);
  const g = s.getContext("2d")!; g.scale(0.5, 0.5);
  const sg = g.createLinearGradient(0, 0, 0, gy); sg.addColorStop(0, "#081230"); sg.addColorStop(0.55, "#0f3054"); sg.addColorStop(1, "#1a5a76");
  g.fillStyle = sg; g.fillRect(0, 0, W, H);
  const n1 = g.createRadialGradient(W * 0.25, gy * 0.35, 0, W * 0.25, gy * 0.35, W * 0.45); n1.addColorStop(0, "rgba(90,130,255,.22)"); n1.addColorStop(1, "rgba(90,130,255,0)");
  g.fillStyle = n1; g.fillRect(0, 0, W, H);
  const n2 = g.createRadialGradient(W * 0.6, gy * 0.8, 0, W * 0.6, gy * 0.8, W * 0.5); n2.addColorStop(0, "rgba(60,220,200,.2)"); n2.addColorStop(1, "rgba(60,220,200,0)");
  g.fillStyle = n2; g.fillRect(0, 0, W, H);
  sky = s;
  lines = Array.from({ length: reduced ? 0 : 16 }, () => ({ x: rand(W), y: rand(H), l: rand(30, 90), v: rand(100, 300) }));
}

// ---------------------------------------------------------------- lifecycle
let mq: MediaQueryList | null = null;
onMounted(() => {
  mq = window.matchMedia("(prefers-reduced-motion: reduce)"); reduced = mq.matches;
  coarse.value = window.matchMedia("(pointer: coarse)").matches;
  stars = Array.from({ length: 110 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() < 0.15 ? rand(1.6, 2.4) : rand(0.7, 1.4), ph: rand(6), sp: rand(1, 3.5) }));
  buildSprites(); resize();
  sim.gap = sim.gapMax * 0.75;
  ro = new ResizeObserver(() => resize()); if (root.value) ro.observe(root.value);
  window.addEventListener("keydown", onKeyDown); window.addEventListener("keyup", onKeyUp);
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("blur", pause);
  raf = requestAnimationFrame(frame);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(raf); if (hintTimer) clearTimeout(hintTimer);
  ro?.disconnect();
  window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp);
  document.removeEventListener("visibilitychange", onVis);
  window.removeEventListener("blur", pause);
  sim.parts = []; sim.items = []; sim.hazards = [];
});

defineExpose({ pause, resume });
</script>

<template>
  <div
    ref="root"
    class="rv"
    @pointerdown="onPtrDown"
    @pointermove="onPtrMove"
    @pointerup="onPtrUp"
    @pointercancel="onPtrUp"
    @contextmenu.prevent
  >
    <canvas ref="cv" class="rv__cv" aria-label="Rover Run game" />

    <!-- HUD -->
    <div v-if="phase === 'play' || phase === 'paused' || phase === 'end' || phase === 'count'" class="rv-hud">
      <div class="rv-top">
        <div class="rv-panel rv-prog" :aria-label="`Distance ${hud.m} of ${hud.mTotal} meters`">
          <div class="rv-prog__track">
            <div class="rv-prog__night" :style="{ width: hud.nightPct * 100 + '%' }" />
            <div class="rv-prog__fill" :style="{ width: hud.pct * 100 + '%' }" />
            <div class="rv-prog__rover" :style="{ left: hud.pct * 100 + '%' }">🚙</div>
            <div class="rv-prog__base">🏠</div>
          </div>
          <div class="rv-prog__txt"><b>{{ hud.m }}</b> / {{ hud.mTotal }} m</div>
        </div>
        <div class="rv-badge" title="Moon gravity is 1/6 of Earth's">1/6 g</div>
        <button class="rv-pause" aria-label="Pause" @pointerdown.stop @click.stop="pause">❚❚</button>
      </div>
      <div class="rv-row">
        <div class="rv-panel rv-lives" aria-label="Lives">
          <span v-for="i in CFG.lives" :key="i" class="rv-heart" :class="{ 'rv-heart--off': i > hud.lives }">♥</span>
        </div>
        <div class="rv-panel rv-energy" :class="{ 'rv-energy--low': hud.energy < 0.3 }" aria-label="Solar energy">
          <span class="rv-energy__ic">⚡</span>
          <div class="rv-energy__bar"><div class="rv-energy__fill" :style="{ width: hud.energy * 100 + '%' }" /></div>
        </div>
        <div class="rv-panel rv-speed"><b>{{ hud.kmh }}</b> km/h</div>
        <div v-if="hud.combo >= 2" :key="hud.combo" class="rv-combo">x{{ hud.combo }}</div>
      </div>
      <div v-if="hud.warn" class="rv-warn">🌑 Night is catching up! Grab solar cells ⚡</div>
      <div v-else-if="hud.hint && phase === 'play'" class="rv-hint">{{ hud.hint }}</div>
    </div>

    <button
      v-if="coarse && phase === 'play'"
      class="rv-duck"
      :class="{ 'rv-duck--on': duckBtn }"
      aria-label="Duck"
      @pointerdown="duckDown"
      @pointerup="duckUp"
      @pointercancel="duckUp"
      @pointerleave="duckUp"
    >⬇ DUCK</button>

    <div v-if="phase === 'count'" class="rv-count"><span :key="countNum">{{ countNum }}</span></div>

    <!-- Intro -->
    <div v-if="phase === 'intro'" class="rv-ov" @pointerdown.stop>
      <div class="rv-card" style="--tone:#ffd23f">
        <div class="rv-body">
          <div class="rv-eyebrow">MINI-GAME</div>
          <h2 class="rv-title">Rover Run 🚙</h2>
          <p class="rv-goal">Reach the base before the lunar night catches you. Grab solar cells ⚡ to stay fast!</p>
          <div class="rv-keys">
            <i>{{ coarse ? "📱" : "⌨️" }}</i>
            <span v-if="coarse"><b>Tap</b> jump (hold = higher) · <b>swipe down</b> duck</span>
            <span v-else><b>Space / click</b> jump (hold = higher) · <b>↓</b> duck</span>
          </div>
          <div class="rv-fact">
            <div class="rv-fact__ic">{{ F_GRAV.icon }}</div>
            <div>
              <b>{{ F_GRAV.title }}</b>
              <p>{{ F_GRAV.text }}</p>
              <a :href="F_GRAV.url" target="_blank" rel="noopener" class="rv-src">Source: {{ F_GRAV.src }}</a>
            </div>
          </div>
        </div>
        <div class="rv-foot"><Btn big @click="begin">Start driving!</Btn></div>
      </div>
    </div>

    <!-- Pause -->
    <div v-if="phase === 'paused'" class="rv-ov" @pointerdown.stop>
      <div class="rv-card rv-card--small" style="--tone:#4fd1ff">
        <div class="rv-body">
          <h2 class="rv-title">Paused ⏸</h2>
          <p class="rv-goal">Take a breath, astronaut. The night will wait!</p>
        </div>
        <div class="rv-foot"><Btn big @click="resume">Resume</Btn></div>
      </div>
    </div>

    <!-- Result -->
    <div v-if="phase === 'result'" class="rv-ov" @pointerdown.stop>
      <div class="rv-card" :style="{ '--tone': result.won ? '#7cf29c' : '#ff9f43' }">
        <div class="rv-body">
          <div class="rv-eyebrow" :class="result.won ? 'rv-eyebrow--win' : 'rv-eyebrow--lose'">{{ result.won ? "MISSION COMPLETE" : "ROVER STOPPED" }}</div>
          <h2 class="rv-title">
            {{ result.won ? "You reached the base! 🏠" : result.cause === "night" ? "The night caught you! 🌑" : "The rover took too many bumps! 🔧" }}
          </h2>
          <div class="rv-stats">
            <div class="rv-stat"><b>{{ result.score }}</b><span>score</span></div>
            <div class="rv-stat"><b>{{ result.cells }}⚡</b><span>cells</span></div>
            <div class="rv-stat"><b>{{ result.ice }}🧊</b><span>ice</span></div>
            <div class="rv-stat"><b>{{ result.lives }}/{{ result.maxLives }}♥</b><span>lives</span></div>
          </div>
          <p v-if="!result.won" class="rv-tobish">Tobish: “{{ result.cause === "night" ? "So close! Grab more solar cells to outrun the shadow. You've got this!" : "Every pilot bumps! Hold to float over boulders, duck under debris." }}”</p>
          <div class="rv-fact">
            <div class="rv-fact__ic">{{ result.facts[0].icon }}</div>
            <div>
              <b>{{ result.facts[0].title }}</b>
              <p>{{ result.facts[0].text }}</p>
              <a :href="result.facts[0].url" target="_blank" rel="noopener" class="rv-src">Source: {{ result.facts[0].src }}</a>
            </div>
          </div>
          <button class="rv-more" @click="moreFacts = !moreFacts">More facts {{ moreFacts ? "▴" : "▾" }}</button>
          <div v-if="moreFacts">
            <div v-for="f in result.facts.slice(1)" :key="f.title" class="rv-fact">
              <div class="rv-fact__ic">{{ f.icon }}</div>
              <div>
                <b>{{ f.title }}</b>
                <p>{{ f.text }}</p>
                <a :href="f.url" target="_blank" rel="noopener" class="rv-src">Source: {{ f.src }}</a>
              </div>
            </div>
          </div>
        </div>
        <div class="rv-foot rv-foot--row">
          <Btn v-if="result.won" big @click="done">Continue</Btn>
          <template v-else>
            <Btn big @click="begin">🔁 Try again</Btn>
            <Btn variant="ghost" @click="done">Back to base</Btn>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rv {
  position: absolute; inset: 0; z-index: 60; overflow: hidden;
  height: 100vh; height: 100dvh; height: 100svh; width: 100%;
  background: #0b1b3a; color: #fff; font-family: "Nunito", sans-serif;
  touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
}
.rv__cv { position: absolute; inset: 0; display: block; }
.rv-hud { position: absolute; inset: 0; pointer-events: none; padding: max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) 10px max(10px, env(safe-area-inset-left)); }
.rv-top { display: flex; gap: 8px; align-items: center; }
.rv-panel {
  background: rgba(12, 24, 48, 0.72); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 16px; padding: 6px 12px;
  font-family: "Fredoka", sans-serif; font-weight: 600; font-size: 14px;
}
.rv-prog { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; }
.rv-prog__track { position: relative; flex: 1; height: 12px; border-radius: 8px; background: rgba(255, 255, 255, 0.14); margin: 8px 8px 8px 4px; }
.rv-prog__night { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(4, 6, 22, 0.9); border-radius: 8px; }
.rv-prog__fill { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #4fd1ff, #7cf29c); border-radius: 8px; opacity: 0.9; mix-blend-mode: screen; }
.rv-prog__rover { position: absolute; top: -9px; transform: translateX(-50%) scaleX(-1); font-size: 19px; line-height: 1; }
.rv-prog__base { position: absolute; right: -8px; top: -9px; font-size: 18px; line-height: 1; }
.rv-prog__txt { white-space: nowrap; font-size: 13px; color: rgba(255, 255, 255, 0.85); }
.rv-prog__txt b { color: #fff; }
.rv-badge {
  font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 15px; padding: 6px 12px; border-radius: 14px;
  background: linear-gradient(180deg, #ffe36b, #ffb52e); color: #3a2600; box-shadow: 0 3px 0 #c9800f, 0 6px 12px rgba(0, 0, 0, 0.3);
  animation: rvbadge 2.4s ease-in-out infinite;
}
@keyframes rvbadge { 50% { transform: translateY(-3px) rotate(-3deg); } }
.rv-pause {
  pointer-events: auto; width: 44px; height: 44px; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(12, 24, 48, 0.72); color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; touch-action: manipulation;
}
.rv-row { display: flex; gap: 8px; align-items: center; margin-top: 8px; flex-wrap: wrap; }
.rv-lives { display: flex; gap: 2px; padding: 4px 10px; }
.rv-heart { color: #ff5d7a; font-size: 20px; line-height: 1; text-shadow: 0 0 10px rgba(255, 93, 122, 0.6); transition: transform 0.2s; }
.rv-heart--off { color: rgba(255, 255, 255, 0.22); text-shadow: none; transform: scale(0.8); }
.rv-energy { display: flex; align-items: center; gap: 6px; padding: 6px 10px; }
.rv-energy__ic { color: #ffd23f; }
.rv-energy__bar { width: clamp(70px, 18vw, 150px); height: 12px; border-radius: 8px; background: rgba(255, 255, 255, 0.14); overflow: hidden; }
.rv-energy__fill { height: 100%; border-radius: 8px; background: linear-gradient(90deg, #ffb52e, #ffe36b); transition: width 0.15s; }
.rv-energy--low .rv-energy__fill { background: linear-gradient(90deg, #ef4444, #ff9f43); }
.rv-energy--low { animation: rvlow 0.6s ease-in-out infinite; }
@keyframes rvlow { 50% { border-color: rgba(239, 68, 68, 0.9); } }
.rv-speed { color: rgba(255, 255, 255, 0.8); }
.rv-speed b { color: #fff; font-size: 17px; }
.rv-combo {
  font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 22px; color: #ffd23f; text-shadow: 0 2px 0 rgba(0, 0, 0, 0.4), 0 0 14px rgba(255, 210, 63, 0.6);
  animation: rvpop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes rvpop { from { transform: scale(0.5); } }
.rv-warn, .rv-hint {
  width: fit-content; margin: 8px auto 0; max-width: 100%; text-align: center;
  font-family: "Fredoka", sans-serif; font-weight: 600; font-size: 13.5px; padding: 5px 12px; border-radius: 14px;
  background: rgba(12, 24, 48, 0.72); border: 1px solid rgba(255, 255, 255, 0.14); backdrop-filter: blur(10px);
  animation: rvhint 0.3s ease both;
}
@keyframes rvhint { from { opacity: 0; transform: translateY(-6px); } }
.rv-warn { border-color: rgba(239, 68, 68, 0.8); color: #ffd0d0; }
.rv-duck {
  position: absolute; left: max(14px, env(safe-area-inset-left)); bottom: calc(16px + env(safe-area-inset-bottom)); z-index: 3; width: 96px; height: 64px; border-radius: 20px;
  font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 16px; color: #fff; cursor: pointer;
  background: rgba(58, 155, 255, 0.35); border: 2px solid rgba(255, 255, 255, 0.35); touch-action: none;
}
.rv-duck--on { background: rgba(58, 155, 255, 0.8); transform: translateY(2px); }
.rv-count { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 4; }
.rv-count span {
  font-family: "Fredoka", sans-serif; font-weight: 700; font-size: clamp(90px, 22vmin, 190px); color: #fff;
  text-shadow: 0 6px 0 rgba(0, 0, 0, 0.3), 0 0 40px rgba(79, 209, 255, 0.7); animation: rvcount 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes rvcount { from { transform: scale(2.2); opacity: 0; } 60% { opacity: 1; } to { transform: scale(1); } }

.rv-ov {
  position: absolute; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center;
  padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
  background: radial-gradient(ellipse at center, rgba(5, 12, 30, 0.45), rgba(5, 12, 30, 0.8)); animation: rvfade 0.25s ease both;
}
@keyframes rvfade { from { opacity: 0; } }
.rv-card {
  display: flex; flex-direction: column; width: min(560px, 100%); max-height: 100%; font-size: 15.5px; font-weight: 600; line-height: 1.4;
  border-radius: 26px; overflow: hidden; background: linear-gradient(180deg, rgba(22, 40, 74, 0.9), rgba(12, 24, 48, 0.94));
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 0 0 3px color-mix(in srgb, var(--tone) 18%, transparent);
  animation: rvcardpop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes rvcardpop { from { opacity: 0; transform: translateY(24px) scale(0.9); } }
.rv-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 20px 22px 8px; scrollbar-width: thin; }
.rv-foot { flex: 0 0 auto; display: flex; justify-content: center; padding: 10px 18px 16px; background: linear-gradient(180deg, rgba(12, 24, 48, 0), rgba(12, 24, 48, 0.95) 30%); }
.rv-foot--row { gap: 10px; align-items: center; flex-wrap: wrap; }
.rv-card--small { text-align: center; }
.rv-tobish { margin: 0 0 10px; font-size: 14px; color: rgba(255, 255, 255, 0.88); display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.rv-more { background: none; border: 0; color: #8fdcff; font: 700 13px "Fredoka", sans-serif; cursor: pointer; padding: 4px 2px; margin-bottom: 6px; }
.rv-eyebrow { font-family: "Fredoka", sans-serif; font-weight: 700; letter-spacing: 2px; font-size: 12px; color: #ffd23f; }
.rv-eyebrow--win { color: #7cf29c; } .rv-eyebrow--lose { color: #ff9f43; }
.rv-title { font-family: "Fredoka", sans-serif; font-weight: 700; font-size: clamp(24px, 6vw, 34px); line-height: 1.1; margin: 4px 0 8px; }
.rv-goal { margin: 0 0 12px; color: rgba(255, 255, 255, 0.85); }
.rv-keys { display: flex; align-items: center; gap: 10px; padding: 8px 12px; margin-bottom: 10px; border-radius: 14px; background: rgba(255, 255, 255, 0.07); font-size: 14.5px; }
.rv-keys i { font-style: normal; font-size: 22px; }
.rv-fact { display: flex; gap: 12px; padding: 12px 14px; border-radius: 18px; background: rgba(79, 209, 255, 0.1); border: 1px solid rgba(79, 209, 255, 0.28); margin-bottom: 10px; }
.rv-fact p { margin: 2px 0 4px; color: rgba(255, 255, 255, 0.85); font-size: 14.5px; line-height: 1.4; }
.rv-fact b { font-family: "Fredoka", sans-serif; font-weight: 600; font-size: 16px; }
.rv-fact__ic { font-size: 30px; line-height: 1; }
.rv-src { font-size: 12.5px; color: #8fdcff; text-decoration: underline; text-underline-offset: 2px; }
.rv-meta { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; color: rgba(255, 255, 255, 0.65); margin-bottom: 6px; }
.rv-act { display: flex; justify-content: center; margin-top: 12px; }
.rv-act--two { flex-direction: column; align-items: center; gap: 12px; }
.rv-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 8px 0 10px; }
.rv-stat { text-align: center; padding: 5px 2px; border-radius: 12px; background: rgba(255, 255, 255, 0.08); }
.rv-stat b { display: block; font-family: "Fredoka", sans-serif; font-size: 16px; white-space: nowrap; }
.rv-stat span { font-size: 11px; color: rgba(255, 255, 255, 0.65); }
.rv-learn { font-family: "Fredoka", sans-serif; font-weight: 600; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; color: rgba(255, 255, 255, 0.6); margin: 4px 0 6px; }
@media (max-width: 480px) {
  .rv-panel { font-size: 13px; padding: 5px 9px; }
  .rv-prog__txt { font-size: 12px; }
  .rv-body { padding: 16px 16px 4px; }
  .rv-title { font-size: 24px; margin: 2px 0 6px; }
  .rv-goal { margin-bottom: 8px; font-size: 14.5px; }
  .rv-fact { padding: 9px 11px; gap: 9px; border-radius: 16px; }
  .rv-fact p { font-size: 13px; line-height: 1.35; }
  .rv-fact__ic { font-size: 24px; }
  .rv-card { border-radius: 22px; }
  .rv-foot { padding: 8px 14px 12px; }
  .rv-badge { font-size: 13px; padding: 5px 9px; }
}
@media (prefers-reduced-motion: reduce) {
  .rv-badge, .rv-energy--low, .rv-warn, .rv-hint, .rv-ov, .rv-card, .rv-count span, .rv-combo { animation: none; }
}
</style>
