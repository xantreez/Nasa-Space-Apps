<script setup lang="ts">
/**
 * Regolith Blocks — Tobish's 3D printer drops moon-dust bricks to build a radiation wall.
 * Own falling-brick puzzle: 10 wide (cadet 8, simple pieces), full row = shield layer that flies into the meter.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { MiniGameProps, MiniGameResult } from "../../../moon/types";
import { music, sfx } from "../../../moon/sfx";
import Btn from "../ui/Btn.vue";

const props = defineProps<MiniGameProps>();
const emit = defineEmits<{ finish: [result: MiniGameResult] }>();

// ---------------------------------------------------------------- config
const cadet = props.age === "cadet";
const di = Math.max(0, Math.min(2, (props.difficulty || 1) - 1));
const COLS = cadet ? 8 : 10;
const ROWS = 20;
const TARGET = cadet ? [3, 4, 5][di] : [4, 5, 6][di];
const TOTAL_TIME = 45;
const BASE_INTERVAL = cadet ? [0.85, 0.72, 0.6][di] : [0.6, 0.5, 0.4][di];
const STORM_MULT = cadet ? 1.7 : 2.4;
const LOCK_DELAY = cadet ? 0.7 : 0.5;
const STORM_WARN = 2.2;
const STORM_LEN = 8;

const SHAPES: Record<string, number[][]> = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
};
const ORDER = ["I", "O", "T", "L", "J", "S", "Z"];
const ALLOWED = cadet ? ["I", "O", "T", "L", "J"] : ORDER;
// pastel moon-dust tones, index = ORDER index + 1
const COLORS = ["", "#7fe3d6", "#ffe08a", "#c9afff", "#ffb48a", "#8cc4ff", "#9fe8a4", "#ff9fba"];

type Cell = { c: number; v: number } | null;
interface Piece { k: string; ci: number; m: number[][]; x: number; y: number }

// ---------------------------------------------------------------- reactive UI state
type Phase = "intro" | "count" | "play" | "result";
const phase = ref<Phase>("intro");
const paused = ref(false);
const countNum = ref<string>("3");
const shownLayers = ref(0);
const timeShown = ref(TOTAL_TIME);
const stormMode = ref<"idle" | "warn" | "on">("idle");
const stormPct = ref(0);
const stormSecs = ref(0);
const pulseKey = ref(0);
const nextKey = ref("T");
const touchUi = ref(false);
const result = ref({ won: false, reason: 'top' as 'top' | 'time', score: 0, layers: 0, timeLeft: 0, stars: 0 });

const cell = ref(24);
const sideW = ref(110);
const boardW = computed(() => cell.value * COLS);
const boardH = computed(() => cell.value * ROWS);

// ---------------------------------------------------------------- refs
const rootEl = ref<HTMLElement | null>(null);
const areaEl = ref<HTMLElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
const nextEl = ref<HTMLCanvasElement | null>(null);
const meterEl = ref<HTMLElement | null>(null);

// ---------------------------------------------------------------- game state (non-reactive, hot path)
let ctx: CanvasRenderingContext2D | null = null;
let dpr = 1;
let raf = 0;
let lastTs = 0;
let ro: ResizeObserver | null = null;
let reduced = false;
const timers: number[] = [];

let grid: Cell[][] = [];
let rowOff: number[] = [];
let cur: Piece | null = null;
let queue: string[] = [];
let nextK = "T";
let mode: "drop" | "clearing" | "ending" = "drop";
let timeLeft = TOTAL_TIME;
let layers = 0;
let multiBonus = 0;
let gAcc = 0;
let lockT = 0;
let lockResets = 0;
let clearRows: number[] = [];
let clearT = 0;
let collapsed = false;
let endT = 0;
let endWon = false;
let shake = 0;
let flashAll = 0;
let stormClock = 0;
let nextStorm = 12;
let stormCount = 0;
let lossReason: 'top' | 'time' = 'top';
let heldDir = 0;
let dasT = 0;
let dasRep = false;
let softHeld = false;
let softSwipe = false;
let wasTimeInt = -1;
let t = 0; // visual time

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: number; g: number; rot: number }
interface Flyer { x: number; y: number; tx: number; ty: number; t: number; dur: number; delay: number; ci: number; v: number; last: boolean }
interface Float { text: string; x: number; y: number; t: number; dur: number; color: string; size: number }
let parts: Particle[] = [];
let flyers: Flyer[] = [];
let floats: Float[] = [];
let trails: { x: number; y: number; w: number; h: number; t: number; color: string }[] = [];

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- pieces
function refill() {
  const bag = ALLOWED.slice();
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  queue.push(...bag);
}
function pullKind(): string {
  if (queue.length < 2) refill();
  return queue.shift()!;
}
function rotCW(m: number[][]): number[][] {
  const n = m.length;
  const o = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) o[c][n - 1 - r] = m[r][c];
  return o;
}
function collide(m: number[][], x: number, y: number): boolean {
  for (let r = 0; r < m.length; r++)
    for (let c = 0; c < m.length; c++) {
      if (!m[r][c]) continue;
      const gx = x + c, gy = y + r;
      if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
      if (gy >= 0 && grid[gy][gx]) return true;
    }
  return false;
}
function spawn(): boolean {
  const k = nextK;
  nextK = pullKind();
  nextKey.value = nextK;
  const m = SHAPES[k].map((r) => r.slice());
  let top = 0;
  while (top < m.length && !m[top].some(Boolean)) top++;
  cur = { k, ci: ORDER.indexOf(k) + 1, m, x: Math.floor((COLS - m.length) / 2), y: -top };
  gAcc = 0; lockT = 0; lockResets = 0;
  return !collide(cur.m, cur.x, cur.y);
}
function ghostY(): number {
  if (!cur) return 0;
  let y = cur.y;
  while (!collide(cur.m, cur.x, y + 1)) y++;
  return y;
}
function grounded() {
  return !!cur && collide(cur.m, cur.x, cur.y + 1);
}
function bumpLock() {
  if (grounded() && lockResets < 12) { lockT = 0; lockResets++; }
}
function move(dx: number): boolean {
  if (!cur || mode !== "drop") return false;
  if (collide(cur.m, cur.x + dx, cur.y)) return false;
  cur.x += dx;
  bumpLock();
  return true;
}
function rotate(dir: 1 | -1) {
  if (!cur || mode !== "drop" || cur.k === "O") return;
  let m = cur.m;
  m = dir === 1 ? rotCW(m) : rotCW(rotCW(rotCW(m)));
  const kicks = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1]];
  for (const [kx, ky] of kicks) {
    if (!collide(m, cur.x + kx, cur.y + ky)) {
      cur.m = m; cur.x += kx; cur.y += ky;
      bumpLock();
      sfx.blockRotate();
      return;
    }
  }
}
function hardDrop() {
  if (!cur || mode !== "drop") return;
  const gy = ghostY();
  const dist = gy - cur.y;
  // trail
  for (let r = 0; r < cur.m.length; r++)
    for (let c = 0; c < cur.m.length; c++)
      if (cur.m[r][c]) trails.push({ x: cur.x + c, y: cur.y + r, w: 1, h: gy - cur.y, t: 0, color: COLORS[cur.ci] });
  cur.y = gy;
  if (!reduced) shake = Math.max(shake, 5 + Math.min(dist, 12) * 0.5);
  lock(true);
}

// ---------------------------------------------------------------- lock / clear
function lock(hard: boolean) {
  if (!cur) return;
  const cs = cell.value;
  let above = false;
  for (let r = 0; r < cur.m.length; r++)
    for (let c = 0; c < cur.m.length; c++) {
      if (!cur.m[r][c]) continue;
      const gy = cur.y + r, gx = cur.x + c;
      if (gy < 0) { above = true; continue; }
      grid[gy][gx] = { c: cur.ci, v: Math.floor(Math.random() * 3) };
      sparkle((gx + 0.5) * cs, (gy + 0.5) * cs, COLORS[cur.ci], hard ? 4 : 2);
      if (hard) dustPuff((gx + 0.5) * cs, (gy + 1) * cs, 2);
    }
  cur = null;
  sfx.blockDrop();
  if (above) return endGame(false);
  const full: number[] = [];
  for (let r = 0; r < ROWS; r++) if (grid[r].every(Boolean)) full.push(r);
  if (full.length) {
    clearRows = full; clearT = 0; collapsed = false; mode = "clearing";
    sfx.lineClear();
    const label = ["", "SHIELD LAYER!", "DOUBLE LAYER!", "TRIPLE LAYER!", "QUAD LAYER!!"][Math.min(4, full.length)];
    const cy = ((full[0] + full[full.length - 1]) / 2 + 0.5) * cs;
    floats.push({ text: label, x: (COLS * cs) / 2, y: cy, t: 0, dur: 1.3, color: full.length > 1 ? "#ffd23f" : "#7cf29c", size: Math.max(16, cs * (full.length > 1 ? 1.05 : 0.9)) });
    if (full.length > 1) { multiBonus += full.length - 1; sfx.powerUp(); }
    if (!reduced) shake = Math.max(shake, 4 + full.length * 2);
  } else if (!spawn()) endGame(false);
}

function doCollapse() {
  collapsed = true;
  const cs = cell.value;
  // meter target in canvas css coordinates
  let tx = COLS * cs + 14 + sideW.value / 2, ty = (ROWS * cs) / 2;
  const cv = canvasEl.value, me = meterEl.value;
  if (cv && me) {
    const a = cv.getBoundingClientRect(), b = me.getBoundingClientRect();
    tx = b.left - a.left + b.width / 2;
    const segH = b.height / TARGET;
    ty = b.bottom - a.top - segH * (layers + 0.5);
  }
  for (const r of clearRows) {
    for (let c = 0; c < COLS; c++) {
      const g = grid[r][c]!;
      flyers.push({ x: (c + 0.5) * cs, y: (r + 0.5) * cs, tx, ty, t: 0, dur: 0.55 + Math.random() * 0.12, delay: c * 0.025, ci: g.c, v: g.v, last: c === COLS - 1 });
      sparkle((c + 0.5) * cs, (r + 0.5) * cs, "#ffffff", 1);
    }
    layers++;
  }
  // collapse
  const keep: Cell[][] = [];
  const offs: number[] = [];
  let removedBelow = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (clearRows.includes(r)) { removedBelow++; continue; }
    keep.unshift(grid[r]);
    offs.unshift(-removedBelow);
  }
  while (keep.length < ROWS) { keep.unshift(new Array(COLS).fill(null)); offs.unshift(0); }
  grid = keep;
  rowOff = offs.map((o) => o);
  // rows that moved down by k cells start k cells higher
  rowOff = rowOff.map((o) => (o < 0 ? o : 0));
  if (layers >= TARGET) {
    endGame(true);
  }
}

function endGame(won: boolean) {
  if (mode === "ending") return;
  mode = "ending";
  endWon = won;
  endT = 0;
  cur = null;
  heldDir = 0; softHeld = false;
  if (won) { flashAll = 1; sfx.powerUp(); }
  else { sfx.gameOver(); if (!reduced) shake = 10; }
}

function showResult() {
  const won = endWon;
  const frac = clamp(timeLeft / TOTAL_TIME, 0, 1);
  let score: number;
  if (won) score = clamp(Math.round(62 + 30 * frac + 4 * multiBonus), 60, 100);
  else score = clamp(Math.round((48 * Math.min(layers, TARGET)) / TARGET), 0, 49);
  const stars = won ? (score >= 88 ? 3 : score >= 74 ? 2 : 1) : 0;
  result.value = { won, reason: lossReason, score, layers: Math.min(layers, TARGET), timeLeft: Math.max(0, Math.round(timeLeft)), stars };
  phase.value = "result";
  stormMode.value = "idle";
  shownLayers.value = won ? TARGET : shownLayers.value;
  won ? sfx.win() : sfx.fail();
}

// ---------------------------------------------------------------- fx helpers
function sparkle(x: number, y: number, color: string, n: number) {
  if (reduced) n = Math.ceil(n / 2);
  for (let i = 0; i < n && parts.length < 420; i++) {
    const a = Math.random() * Math.PI * 2, s = rnd(40, 150);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0, max: rnd(0.35, 0.8), size: rnd(2, 5) * (cell.value / 24), color, kind: 0, g: 160, rot: Math.random() * 6 });
  }
}
function dustPuff(x: number, y: number, n: number) {
  if (reduced) return;
  for (let i = 0; i < n && parts.length < 420; i++)
    parts.push({ x: x + rnd(-6, 6), y, vx: rnd(-60, 60), vy: rnd(-40, -5), life: 0, max: rnd(0.4, 0.7), size: rnd(3, 6) * (cell.value / 24), color: "#cfd3df", kind: 1, g: -10, rot: 0 });
}
function burst(x: number, y: number, n: number) {
  for (let i = 0; i < n && parts.length < 420; i++) {
    const a = Math.random() * Math.PI * 2, s = rnd(60, 220);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: rnd(0.5, 1), size: rnd(2, 5), color: ["#7cf29c", "#ffd23f", "#4fd1ff", "#fff"][i % 4], kind: 0, g: 80, rot: 0 });
  }
}

// ---------------------------------------------------------------- sprites
const spriteCache = new Map<string, HTMLCanvasElement>();
function mix(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const tgt = amt >= 0 ? 255 : 0, a = Math.abs(amt);
  r = Math.round(r + (tgt - r) * a); g = Math.round(g + (tgt - g) * a); b = Math.round(b + (tgt - b) * a);
  return `rgb(${r},${g},${b})`;
}
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function sprite(ci: number, v: number, size: number): HTMLCanvasElement {
  const px = Math.max(8, Math.round(size * dpr));
  const key = `${ci}-${v}-${px}`;
  let s = spriteCache.get(key);
  if (s) return s;
  s = document.createElement("canvas");
  s.width = s.height = px;
  const g = s.getContext("2d")!;
  const base = COLORS[ci];
  const pad = Math.max(1, px * 0.04), w = px - pad * 2, rad = px * 0.2;
  // body
  const grad = g.createLinearGradient(0, pad, 0, px - pad);
  grad.addColorStop(0, mix(base, 0.28));
  grad.addColorStop(1, mix(base, -0.12));
  g.fillStyle = grad;
  rr(g, pad, pad, w, w, rad); g.fill();
  // inner panel
  const ip = px * 0.15;
  g.fillStyle = mix(base, 0.06);
  rr(g, ip, ip, px - ip * 2, px - ip * 2, rad * 0.7); g.fill();
  // bevel highlights
  g.lineWidth = Math.max(1, px * 0.07);
  g.lineCap = "round";
  g.strokeStyle = "rgba(255,255,255,0.55)";
  g.beginPath(); g.moveTo(pad + rad, pad + g.lineWidth / 2); g.lineTo(px - pad - rad, pad + g.lineWidth / 2); g.stroke();
  g.beginPath(); g.moveTo(pad + g.lineWidth / 2, pad + rad); g.lineTo(pad + g.lineWidth / 2, px - pad - rad); g.stroke();
  g.strokeStyle = "rgba(40,30,70,0.22)";
  g.beginPath(); g.moveTo(pad + rad, px - pad - g.lineWidth / 2); g.lineTo(px - pad - rad, px - pad - g.lineWidth / 2); g.stroke();
  g.beginPath(); g.moveTo(px - pad - g.lineWidth / 2, pad + rad); g.lineTo(px - pad - g.lineWidth / 2, px - pad - rad); g.stroke();
  // dust speckles + crater (seeded)
  let seed = (ci * 131 + v * 977 + 13) >>> 0;
  const rn = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 9; i++) {
    const x = ip + rn() * (px - ip * 2), y = ip + rn() * (px - ip * 2), r = px * (0.012 + rn() * 0.028);
    g.fillStyle = rn() > 0.5 ? "rgba(255,255,255,0.35)" : "rgba(60,50,90,0.18)";
    g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill();
  }
  const cx = px * (0.3 + rn() * 0.4), cy = px * (0.3 + rn() * 0.4), cr = px * (0.1 + rn() * 0.06);
  g.fillStyle = "rgba(60,50,90,0.16)";
  g.beginPath(); g.arc(cx, cy, cr, 0, 6.3); g.fill();
  g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = Math.max(1, px * 0.03);
  g.beginPath(); g.arc(cx, cy, cr, 0.2, 2.6); g.stroke();
  spriteCache.set(key, s);
  return s;
}

// ---------------------------------------------------------------- update
function curInterval(): number {
  let iv = BASE_INTERVAL * Math.pow(0.955, layers);
  if (stormMode.value === "on") iv /= STORM_MULT;
  if (softHeld || softSwipe) iv = Math.min(iv, 0.045);
  return Math.max(0.04, iv);
}

function updateStorm(dt: number) {
  if (stormMode.value === "idle") {
    nextStorm -= dt;
    if (nextStorm <= 0 && timeLeft > 10) {
      stormMode.value = "warn"; stormClock = STORM_WARN; sfx.alarm();
    }
  } else if (stormMode.value === "warn") {
    stormClock -= dt;
    stormPct.value = Math.round(clamp(1 - stormClock / STORM_WARN, 0, 1) * 100);
    if (stormClock <= 0) { stormMode.value = "on"; stormClock = STORM_LEN; stormCount++; if (!reduced) shake = Math.max(shake, 3); }
  } else {
    stormClock -= dt;
    stormPct.value = Math.round(clamp(stormClock / STORM_LEN, 0, 1) * 100);
    stormSecs.value = Math.max(0, Math.ceil(stormClock));
    if (stormClock <= 0) { stormMode.value = "idle"; nextStorm = stormCount >= 2 ? 1e9 : rnd(8, 11); stormPct.value = 0; }
  }
}

function update(dt: number) {
  t += dt;
  if (mode !== "ending") {
    timeLeft -= dt;
    updateStorm(dt);
    const ti = Math.max(0, Math.ceil(timeLeft));
    if (ti !== wasTimeInt) { wasTimeInt = ti; timeShown.value = ti; }
  }
  if (mode === "drop") {
    if (timeLeft <= 0) { timeLeft = 0; lossReason = 'time'; return endGame(false); }
    if (heldDir) {
      dasT += dt;
      if (!dasRep) { if (dasT >= 0.17) { dasRep = true; dasT -= 0.17; } }
      if (dasRep) while (dasT >= 0.05) { dasT -= 0.05; move(heldDir); }
    }
    if (!cur) return;
    const iv = curInterval();
    if (grounded()) {
      lockT += dt;
      if (lockT >= LOCK_DELAY || (softHeld && lockT >= 0.12)) lock(false);
    } else {
      lockT = 0;
      gAcc += dt;
      while (gAcc >= iv && cur) {
        if (!collide(cur.m, cur.x, cur.y + 1)) { cur.y++; gAcc -= iv; } else { gAcc = 0; break; }
      }
    }
  } else if (mode === "clearing") {
    clearT += dt;
    if (!collapsed && clearT >= (reduced ? 0.15 : 0.38)) doCollapse();
    if (collapsed && mode === "clearing" && clearT >= (reduced ? 0.3 : 0.6)) {
      mode = "drop";
      if (!spawn()) endGame(false);
    }
  } else if (mode === "ending") {
    endT += dt;
    if (endT > (endWon ? 1.5 : 1.2)) { if (phase.value === "play") showResult(); }
  }
}

function fxUpdate(dt: number) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life += dt;
    if (p.life >= p.max) { parts.splice(i, 1); continue; }
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
  }
  for (let i = flyers.length - 1; i >= 0; i--) {
    const f = flyers[i];
    if (f.delay > 0) { f.delay -= dt; continue; }
    f.t += dt / f.dur;
    if (f.t >= 1) {
      burst(f.tx, f.ty, f.last ? 14 : 2);
      if (f.last) { shownLayers.value = Math.min(TARGET, shownLayers.value + 1); pulseKey.value++; sfx.coin(); }
      flyers.splice(i, 1);
    }
  }
  for (let i = floats.length - 1; i >= 0; i--) { floats[i].t += dt; if (floats[i].t > floats[i].dur) floats.splice(i, 1); }
  for (let i = trails.length - 1; i >= 0; i--) { trails[i].t += dt; if (trails[i].t > 0.22) trails.splice(i, 1); }
  if (rowOff.length) {
    const k = 1 - Math.exp(-dt * 14);
    for (let i = 0; i < rowOff.length; i++) if (rowOff[i]) { rowOff[i] *= 1 - k; if (Math.abs(rowOff[i]) < 0.01) rowOff[i] = 0; }
  }
  shake *= Math.exp(-dt * 9);
  if (shake < 0.1) shake = 0;
  flashAll = Math.max(0, flashAll - dt * 1.6);
  if (stormMode.value === "on" && !reduced && parts.length < 380 && Math.random() < dt * 30) {
    parts.push({ x: rnd(0, COLS * cell.value), y: -4, vx: rnd(-30, -10), vy: rnd(300, 480), life: 0, max: 1.2, size: rnd(1, 2) * (cell.value / 24), color: "#ffb347", kind: 2, g: 0, rot: 0 });
  }
}

// ---------------------------------------------------------------- render
function render() {
  const c = ctx, cv = canvasEl.value;
  if (!c || !cv) return;
  const cs = cell.value, W = boardW.value, H = boardH.value;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, cv.width / dpr, cv.height / dpr);
  c.save();
  if (shake > 0) c.translate(rnd(-shake, shake) * 0.5, rnd(-shake, shake) * 0.5);

  // board panel
  const storm = stormMode.value;
  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "rgba(10,22,46,0.78)");
  bg.addColorStop(1, "rgba(14,44,66,0.82)");
  c.fillStyle = bg;
  rr(c, 0, 0, W, H, Math.max(8, cs * 0.45)); c.fill();
  c.save();
  rr(c, 0, 0, W, H, Math.max(8, cs * 0.45)); c.clip();
  c.strokeStyle = "rgba(255,255,255,0.045)";
  c.lineWidth = 1;
  c.beginPath();
  for (let i = 1; i < COLS; i++) { c.moveTo(i * cs + 0.5, 0); c.lineTo(i * cs + 0.5, H); }
  for (let i = 1; i < ROWS; i++) { c.moveTo(0, i * cs + 0.5); c.lineTo(W, i * cs + 0.5); }
  c.stroke();
  // faint "habitat" glow at the bottom
  const hg = c.createRadialGradient(W / 2, H, 0, W / 2, H, W * 0.8);
  hg.addColorStop(0, "rgba(124,242,156,0.10)"); hg.addColorStop(1, "rgba(124,242,156,0)");
  c.fillStyle = hg; c.fillRect(0, 0, W, H);

  // trails
  for (const tr of trails) {
    c.globalAlpha = (1 - tr.t / 0.22) * 0.35;
    c.fillStyle = tr.color;
    c.fillRect(tr.x * cs + cs * 0.15, tr.y * cs, cs * 0.7, tr.h * cs);
  }
  c.globalAlpha = 1;

  // settled cells
  const losing = mode === "ending" && !endWon;
  for (let r = 0; r < ROWS; r++) {
    const off = rowOff[r] || 0;
    for (let col = 0; col < COLS; col++) {
      const g = grid[r][col];
      if (!g) continue;
      const y = (r + off) * cs;
      if (clearRows.includes(r) && !collapsed && mode === "clearing") continue;
      c.drawImage(sprite(g.c, g.v, cs), col * cs, y, cs, cs);
    }
  }
  // clearing rows (flash)
  if (mode === "clearing" && !collapsed) {
    const k = clearT / 0.38;
    for (const r of clearRows) {
      for (let col = 0; col < COLS; col++) {
        const g = grid[r][col]!;
        const sc = 1 + Math.sin(k * Math.PI) * 0.12;
        c.save();
        c.translate((col + 0.5) * cs, (r + 0.5) * cs); c.scale(sc, sc);
        c.drawImage(sprite(g.c, g.v, cs), -cs / 2, -cs / 2, cs, cs);
        c.restore();
      }
      const a = reduced ? 0.5 : 0.35 + 0.45 * Math.abs(Math.sin(k * Math.PI * 3));
      c.fillStyle = `rgba(190,255,215,${a})`;
      c.fillRect(0, r * cs, W, cs);
      c.shadowColor = "#7cf29c"; c.shadowBlur = cs;
      c.fillStyle = `rgba(255,255,255,${a * 0.6})`;
      c.fillRect(0, r * cs + cs * 0.3, W, cs * 0.4);
      c.shadowBlur = 0;
    }
  }

  // ghost + active piece
  if (cur) {
    const gy = ghostY();
    for (let r = 0; r < cur.m.length; r++)
      for (let col = 0; col < cur.m.length; col++) {
        if (!cur.m[r][col]) continue;
        const x = (cur.x + col) * cs;
        if (gy + r >= 0) {
          c.globalAlpha = 0.22;
          c.drawImage(sprite(cur.ci, 0, cs), x, (gy + r) * cs, cs, cs);
          c.globalAlpha = 0.55;
          c.strokeStyle = COLORS[cur.ci]; c.lineWidth = 1.5;
          rr(c, x + 2, (gy + r) * cs + 2, cs - 4, cs - 4, cs * 0.18); c.stroke();
          c.globalAlpha = 1;
        }
      }
    const frac = !grounded() && mode === "drop" ? clamp(gAcc / curInterval(), 0, 0.95) : 0;
    const gl = grounded() ? clamp(lockT / LOCK_DELAY, 0, 1) : 0;
    for (let r = 0; r < cur.m.length; r++)
      for (let col = 0; col < cur.m.length; col++) {
        if (!cur.m[r][col]) continue;
        const x = (cur.x + col) * cs, y = (cur.y + r + frac) * cs;
        c.drawImage(sprite(cur.ci, 1, cs), x, y, cs, cs);
        if (gl > 0) { c.globalAlpha = gl * 0.35; c.fillStyle = "#fff"; rr(c, x + 2, y + 2, cs - 4, cs - 4, cs * 0.2); c.fill(); c.globalAlpha = 1; }
      }
  }

  // particles
  for (const p of parts) {
    const k = 1 - p.life / p.max;
    c.globalAlpha = clamp(k, 0, 1) * (p.kind === 1 ? 0.55 : 1);
    c.fillStyle = p.color;
    if (p.kind === 0) {
      const s = p.size * (0.5 + k);
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot + p.life * 4);
      c.beginPath(); c.moveTo(0, -s * 1.6); c.lineTo(s * 0.5, 0); c.lineTo(0, s * 1.6); c.lineTo(-s * 0.5, 0); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(-s * 1.6, 0); c.lineTo(0, s * 0.5); c.lineTo(s * 1.6, 0); c.lineTo(0, -s * 0.5); c.closePath(); c.fill();
      c.restore();
    } else if (p.kind === 1) {
      c.beginPath(); c.arc(p.x, p.y, p.size * (1.6 - k * 0.6), 0, 6.3); c.fill();
    } else {
      c.strokeStyle = p.color; c.lineWidth = p.size;
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + p.vx * 0.04, p.y + p.vy * 0.04); c.stroke();
    }
  }
  c.globalAlpha = 1;

  // storm tint
  if (storm !== "idle") {
    const a = storm === "warn" ? 0.1 + 0.12 * (0.5 + 0.5 * Math.sin(t * 14)) : 0.14 + 0.06 * Math.sin(t * 6);
    const vg = c.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, H * 0.75);
    vg.addColorStop(0, "rgba(255,120,60,0)"); vg.addColorStop(1, `rgba(255,110,50,${a * 2.2})`);
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
  }
  if (losing) { c.fillStyle = `rgba(30,35,55,${clamp(endT / 0.9, 0, 0.55)})`; c.fillRect(0, 0, W, H); }
  if (flashAll > 0) { c.fillStyle = `rgba(255,255,255,${flashAll * 0.5})`; c.fillRect(0, 0, W, H); }
  c.restore();

  // border
  c.strokeStyle = storm === "on" ? "rgba(255,160,80,0.8)" : "rgba(255,255,255,0.16)";
  c.lineWidth = 2;
  rr(c, 1, 1, W - 2, H - 2, Math.max(8, cs * 0.45)); c.stroke();

  // flyers (may leave the board toward the meter)
  for (const f of flyers) {
    if (f.delay > 0) continue;
    const e = f.t * f.t * (3 - 2 * f.t);
    const x = f.x + (f.tx - f.x) * e;
    const y = f.y + (f.ty - f.y) * e - Math.sin(f.t * Math.PI) * cs * 2.2;
    const s = cs * (1 - 0.65 * e);
    c.save();
    c.shadowColor = "#7cf29c"; c.shadowBlur = 12;
    c.globalAlpha = 1 - Math.max(0, f.t - 0.85) * 6;
    c.drawImage(sprite(f.ci, f.v, cs), x - s / 2, y - s / 2, s, s);
    c.restore();
  }
  // floating combo text
  for (const f of floats) {
    const k = f.t / f.dur;
    const pop = k < 0.15 ? 0.5 + (k / 0.15) * 0.7 : k < 0.25 ? 1.2 - ((k - 0.15) / 0.1) * 0.2 : 1;
    c.save();
    c.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    c.translate(f.x, f.y - k * cs * 2.2); c.scale(pop, pop);
    c.font = `700 ${f.size}px Fredoka, sans-serif`;
    c.textAlign = "center"; c.textBaseline = "middle";
    c.lineWidth = Math.max(3, f.size * 0.2); c.strokeStyle = "rgba(10,20,40,0.85)"; c.lineJoin = "round";
    c.strokeText(f.text, 0, 0);
    c.fillStyle = f.color; c.fillText(f.text, 0, 0);
    c.restore();
  }
}

function drawNext() {
  const cv = nextEl.value;
  if (!cv) return;
  const px = cv.clientWidth, d = dpr;
  if (!px) return;
  if (cv.width !== Math.round(px * d)) { cv.width = Math.round(px * d); cv.height = Math.round(px * d); }
  const g = cv.getContext("2d")!;
  g.setTransform(d, 0, 0, d, 0, 0);
  g.clearRect(0, 0, px, px);
  const m = SHAPES[nextKey.value];
  let r0 = 9, r1 = -1, c0 = 9, c1 = -1;
  m.forEach((row, r) => row.forEach((v, c) => { if (v) { r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); } }));
  const ncs = Math.floor(px / 4.4);
  const ox = (px - (c1 - c0 + 1) * ncs) / 2, oy = (px - (r1 - r0 + 1) * ncs) / 2;
  const ci = ORDER.indexOf(nextKey.value) + 1;
  m.forEach((row, r) => row.forEach((v, c) => { if (v) g.drawImage(sprite(ci, 2, ncs), ox + (c - c0) * ncs, oy + (r - r0) * ncs, ncs, ncs); }));
}

function frame(ts: number) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0);
  lastTs = ts;
  if (!paused.value) {
    if (phase.value === "play") update(dt);
    fxUpdate(dt);
  }
  render();
}

// ---------------------------------------------------------------- layout
function layout() {
  const a = areaEl.value, cv = canvasEl.value;
  if (!a || !cv) return;
  const rect = a.getBoundingClientRect();
  const vw = window.innerWidth;
  touchUi.value = vw < 860 || (window.matchMedia?.("(pointer: coarse)").matches ?? false);
  sideW.value = vw < 520 ? 84 : vw < 860 ? 112 : 140;
  const gap = vw < 520 ? 8 : 14;
  const availW = rect.width - sideW.value - gap - 8, availH = rect.height - 4;
  const cs = Math.max(10, Math.floor(Math.min(availW / COLS, availH / ROWS)));
  cell.value = cs;
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = cs * COLS + gap + sideW.value, h = cs * ROWS;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  ctx = cv.getContext("2d");
  spriteCache.clear();
  nextTick(drawNext);
}

// ---------------------------------------------------------------- input
function canPlay() { return phase.value === "play" && !paused.value && mode === "drop"; }
function press(name: string) {
  if (!canPlay()) return;
  if (name === "left") { move(-1); heldDir = -1; dasT = 0; dasRep = false; }
  else if (name === "right") { move(1); heldDir = 1; dasT = 0; dasRep = false; }
  else if (name === "rotate") rotate(1);
  else if (name === "rotateL") rotate(-1);
  else if (name === "soft") softHeld = true;
  else if (name === "hard") hardDrop();
}
function release(name: string) {
  if (name === "left" && heldDir === -1) heldDir = 0;
  else if (name === "right" && heldDir === 1) heldDir = 0;
  else if (name === "soft") softHeld = false;
}
const KEYMAP: Record<string, string> = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", ArrowUp: "rotate", w: "rotate", W: "rotate", x: "rotate", X: "rotate", z: "rotateL", Z: "rotateL", ArrowDown: "soft", s: "soft", S: "soft", " ": "hard" };
function onKeyDown(e: KeyboardEvent) {
  if (phase.value !== "play") return;
  if (e.key === "p" || e.key === "P" || e.key === "Escape") { e.preventDefault(); togglePause(); return; }
  const n = KEYMAP[e.key];
  if (!n) return;
  e.preventDefault();
  if (e.repeat) return;
  press(n);
}
function onKeyUp(e: KeyboardEvent) {
  const n = KEYMAP[e.key];
  if (n) release(n);
}
function togglePause() {
  if (phase.value !== "play") return;
  paused.value = !paused.value;
  heldDir = 0; softHeld = false; softSwipe = false;
}
function onVis() {
  if (document.hidden && phase.value === "play" && !paused.value) togglePause();
}

// swipe gestures on the board
let gx = 0, gy0 = 0, gLastX = 0, gT = 0, gId = -1, gMoved = false;
function onPtrDown(e: PointerEvent) {
  if (phase.value !== "play") return;
  gId = e.pointerId; gx = gLastX = e.clientX; gy0 = e.clientY; gT = performance.now(); gMoved = false;
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
}
function onPtrMove(e: PointerEvent) {
  if (e.pointerId !== gId || !canPlay()) return;
  const step = cell.value * 0.85;
  while (e.clientX - gLastX >= step) { move(1); gLastX += step; gMoved = true; }
  while (gLastX - e.clientX >= step) { move(-1); gLastX -= step; gMoved = true; }
  const dy = e.clientY - gy0;
  if (dy > cell.value * 1.4 && Math.abs(dy) > Math.abs(e.clientX - gx) * 1.2) { softSwipe = true; gMoved = true; }
  if (Math.hypot(e.clientX - gx, dy) > 10) gMoved = true;
}
function onPtrUp(e: PointerEvent) {
  if (e.pointerId !== gId) return;
  gId = -1;
  const wasSoft = softSwipe;
  softSwipe = false;
  if (!canPlay()) return;
  const dt = performance.now() - gT, dy = e.clientY - gy0, dx = e.clientX - gx;
  if (!gMoved && dt < 300) rotate(1);
  else if (dy > cell.value * 3 && dt < 320 && Math.abs(dy) > Math.abs(dx) * 1.5 && !wasSoft) hardDrop();
  else if (dy > cell.value * 3 && dt < 320 && Math.abs(dy) > Math.abs(dx) * 1.5) hardDrop();
}

// ---------------------------------------------------------------- flow
function resetGame() {
  grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
  rowOff = new Array(ROWS).fill(0);
  queue = []; refill(); nextK = pullKind();
  parts = []; flyers = []; floats = []; trails = [];
  mode = "drop"; timeLeft = TOTAL_TIME; layers = 0; multiBonus = 0; shownLayers.value = 0;
  timeShown.value = TOTAL_TIME; wasTimeInt = -1;
  stormMode.value = "idle"; stormPct.value = 0; nextStorm = rnd(10, 13); stormCount = 0; lossReason = 'top';
  heldDir = 0; softHeld = false; softSwipe = false; shake = 0; flashAll = 0; clearRows = []; collapsed = false;
  prefill();
  cur = null; spawn();
}
function prefill() {
  const n = cadet ? 2 : 3;
  const g = 1 + Math.floor(Math.random() * (COLS - 3));
  for (let i = 0; i < n; i++) {
    const r = ROWS - 1 - i;
    for (let c = 0; c < COLS; c++) {
      const gap = c === g || (c === g + 1 && !(i === 2));
      if (!gap) grid[r][c] = { c: 1 + Math.floor(Math.random() * 7), v: Math.floor(Math.random() * 3) };
    }
  }
}
function start() {
  sfx.unlock();
  music.play("minigame");
  resetGame();
  paused.value = false;
  phase.value = "count";
  const seq = ["3", "2", "1", "GO!"];
  seq.forEach((s, i) => {
    timers.push(window.setTimeout(() => {
      countNum.value = s;
      s === "GO!" ? sfx.go() : sfx.countdown();
      if (i === seq.length - 1) timers.push(window.setTimeout(() => { phase.value = "play"; lastTs = performance.now(); }, 550));
    }, i * 800));
  });
}
function retry() {
  start();
}
function finish() {
  music.play("base");
  emit("finish", { won: result.value.won, score: result.value.score });
}

watch(nextKey, () => nextTick(drawNext));

onMounted(() => {
  reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  resetGame();
  layout();
  ro = new ResizeObserver(() => layout());
  if (areaEl.value) ro.observe(areaEl.value);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", layout);
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("blur", onVis);
  raf = requestAnimationFrame(frame);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  ro?.disconnect();
  timers.forEach((id) => clearTimeout(id));
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  window.removeEventListener("resize", layout);
  document.removeEventListener("visibilitychange", onVis);
  window.removeEventListener("blur", onVis);
});

const introFact = computed(() =>
  cadet
    ? "The Moon has no thick air to protect it, so its surface gets about 200 times more radiation than Earth's surface! Moon dust, called regolith, can be piled up as a wall to block a lot of it."
    : "The Moon's surface receives about 1.37 millisieverts of radiation per day, roughly 200 times more than Earth's surface (Chang'e-4 lander dosimeter, Zhang et al. 2020). A thick layer of regolith soaks up much of it.",
);
const moreIntro = computed(() => [
  "Moon dust is sharp and sticky. Apollo astronauts found it clung to everything, so builders must handle it carefully (NASA Apollo reports).",
  "NASA's Artemis program plans a long-term Moon base near the lunar south pole.",
]);
const moreResult = computed(() => [
  "A habitat can also be buried or covered with regolith: the dust acts like a thick blanket against radiation and temperature swings (NASA ISRU studies).",
  "Radiation is measured in sieverts: the Moon's surface gets about 1.37 mSv per day (Chang'e-4, Zhang et al. 2020).",
]);
const moreFacts = ref(false);
const resultFact = computed(() =>
  result.value.won
    ? "NASA is studying how to 3D-print habitats from regolith (Artemis and ISRU research; the NASA 3D-Printed Habitat Challenge), so crews can build with the Moon's own dust."
    : "Research for NASA and ESA suggests roughly half a metre to a few metres of regolith can cut much of the radiation from solar particle events. Keep stacking!",
);
const meterSegs = computed(() => Array.from({ length: TARGET }, (_, i) => i));
</script>

<template>
  <div ref="rootEl" class="blk" :class="{ 'blk--storm': stormMode === 'on' }">
    <div class="blk__stars" />
    <div class="blk__title" v-show="phase === 'play' || phase === 'count'">Regolith Blocks</div>

    <div ref="areaEl" class="blk__area">
      <div class="blk__stage" :style="{ width: boardW + (sideW + (touchUi ? 8 : 14)) + 'px', height: boardH + 'px' }">
        <canvas
          ref="canvasEl"
          class="blk__cv"
          :style="{ width: boardW + (sideW + (touchUi ? 8 : 14)) + 'px', height: boardH + 'px' }"
          @pointerdown="onPtrDown"
          @pointermove="onPtrMove"
          @pointerup="onPtrUp"
          @pointercancel="onPtrUp"
        />
        <!-- storm banner -->
        <div v-if="stormMode !== 'idle'" class="blk__storm" :class="{ 'blk__storm--warn': stormMode === 'warn' }" :style="{ width: boardW + 'px' }">
          <span>{{ stormMode === "warn" ? "SOLAR STORM INCOMING!" : "SOLAR STORM: bricks fall faster " + stormSecs + "s" }}</span>
          <i><b :style="{ width: stormPct + '%' }" /></i>
        </div>
        <!-- side panel -->
        <aside class="blk__side" :style="{ width: sideW + 'px' }">
          <div class="blk__card">
            <div class="blk__lbl">NEXT</div>
            <canvas ref="nextEl" class="blk__next" />
          </div>
          <div class="blk__card blk__card--meter">
            <div class="blk__lbl">SHIELD</div>
            <div ref="meterEl" class="blk__meter" :class="{ 'blk__meter--pulse': pulseKey % 2 === 1, 'blk__meter--pulse2': pulseKey % 2 === 0 && pulseKey > 0 }">
              <div v-for="i in meterSegs" :key="i" class="blk__seg" :class="{ 'is-on': i < shownLayers }" />
            </div>
            <div class="blk__count"><b>{{ shownLayers }}</b>/{{ TARGET }}</div>
          </div>
          <div class="blk__card blk__card--time" :class="{ 'is-low': timeShown <= 10 }">
            <div class="blk__lbl">TIME</div>
            <div class="blk__tv">{{ timeShown }}s</div>
          </div>
        </aside>
        <button v-show="phase === 'play'" class="blk__pause" aria-label="Pause" @click="togglePause">II</button>
      </div>
    </div>

    <!-- touch controls -->
    <div v-if="touchUi" class="blk__ctl" :class="{ 'is-off': phase !== 'play' }">
      <button class="cb cb--blue" aria-label="Left" @pointerdown.prevent="press('left')" @pointerup="release('left')" @pointerleave="release('left')" @pointercancel="release('left')"><svg viewBox="0 0 24 24"><path d="M15 5l-8 7 8 7" /></svg></button>
      <button class="cb cb--blue" aria-label="Right" @pointerdown.prevent="press('right')" @pointerup="release('right')" @pointerleave="release('right')" @pointercancel="release('right')"><svg viewBox="0 0 24 24"><path d="M9 5l8 7-8 7" /></svg></button>
      <button class="cb cb--go" aria-label="Rotate" @pointerdown.prevent="press('rotate')"><svg viewBox="0 0 24 24"><path d="M19 12a7 7 0 1 1-2.2-5.1M19 4v4h-4" /></svg></button>
      <button class="cb cb--warn" aria-label="Soft drop" @pointerdown.prevent="press('soft')" @pointerup="release('soft')" @pointerleave="release('soft')" @pointercancel="release('soft')"><svg viewBox="0 0 24 24"><path d="M6 8l6 6 6-6" /></svg></button>
      <button class="cb cb--pink" aria-label="Hard drop" @pointerdown.prevent="press('hard')"><svg viewBox="0 0 24 24"><path d="M6 5l6 6 6-6M6 12l6 6 6-6" /></svg></button>
    </div>
    <div v-else class="blk__hint">Arrows move / rotate &nbsp;·&nbsp; Down soft drop &nbsp;·&nbsp; Space hard drop &nbsp;·&nbsp; P pause</div>

    <!-- countdown -->
    <div v-if="phase === 'count'" class="blk__count3"><span :key="countNum">{{ countNum }}</span></div>

    <!-- pause -->
    <div v-if="paused && phase === 'play'" class="blk__veil">
      <div class="blk__panel blk__panel--sm">
        <h2>Paused</h2>
        <p>Take a breath, cadet. The printer waits.</p>
        <Btn big @click="togglePause">Resume</Btn>
      </div>
    </div>

    <!-- intro -->
    <div v-if="phase === 'intro'" class="blk__veil">
      <div class="blk__panel">
        <div class="blk__body">
          <div class="blk__bricks"><i v-for="n in 7" :key="n" :style="{ background: COLORS[n] }" /></div>
          <h2>Regolith Blocks</h2>
          <p class="blk__goal">
            Tobish's 3D printer drops Moon-dust bricks. Fill whole rows to build <b>{{ TARGET }} shield layers</b> before the stack tops out or {{ TOTAL_TIME }}s run out!
          </p>
          <p class="blk__ctl1">{{ touchUi ? "Buttons below, or swipe the board." : "Arrows move and rotate, Space drops fast." }} Solar storms speed bricks up!</p>
          <div class="blk__fact">
            <span class="blk__tag">MOON SCIENCE</span>
            {{ introFact }}
            <em>Source: NASA Artemis / ISRU research</em>
            <template v-if="moreFacts"><p v-for="f in moreIntro" :key="f">{{ f }}</p></template>
            <button class="blk__more" @click="moreFacts = !moreFacts">{{ moreFacts ? "Fewer facts \u25B4" : "More facts \u25BE" }}</button>
          </div>
        </div>
        <div class="blk__foot"><Btn big @click="start">Start printing</Btn></div>
      </div>
    </div>

    <!-- result -->
    <div v-if="phase === 'result'" class="blk__veil">
      <div class="blk__panel" :class="result.won ? 'is-win' : 'is-lose'">
        <div class="blk__body">
          <h2>{{ result.won ? "Wall complete!" : result.reason === "time" ? "Time ran out!" : "The wall reached the top!" }}</h2>
          <div v-if="result.won" class="blk__stars3">
            <svg v-for="n in 3" :key="n" viewBox="0 0 24 24" :class="{ on: n <= result.stars }" :style="{ animationDelay: n * 0.18 + 's' }"><path d="M12 2l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.6 5.7 21.4l1.5-7.1L1.8 9.4 9 8.6z" /></svg>
          </div>
          <div class="blk__stats">
            <div><b>{{ result.layers }}/{{ TARGET }}</b><span>layers</span></div>
            <div><b>{{ result.timeLeft }}s</b><span>time left</span></div>
            <div><b>{{ result.score }}</b><span>score</span></div>
          </div>
          <p class="blk__goal blk__goal--2">
            {{ result.won ? "The radiation wall is up. Great building!" : "Tobish: Every brick counts, cadet. Let's print it again!" }}
          </p>
          <div class="blk__fact">
            <span class="blk__tag">YOU LEARNED</span>
            {{ resultFact }}
            <em>Source: NASA Artemis, ISRU, Centennial Challenge</em>
            <template v-if="moreFacts"><p v-for="f in moreResult" :key="f">{{ f }}</p></template>
            <button class="blk__more" @click="moreFacts = !moreFacts">{{ moreFacts ? "Fewer facts \u25B4" : "More facts \u25BE" }}</button>
          </div>
        </div>
        <div class="blk__foot">
          <template v-if="!result.won">
            <Btn big @click="retry">🔁 Try again</Btn>
            <Btn variant="ghost" @click="finish">Back to base</Btn>
          </template>
          <Btn v-else big @click="finish">Continue</Btn>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.blk {
  position: absolute; left: 0; top: 0; width: 100%; z-index: 60;
  height: 100%; height: 100vh; height: 100dvh; height: 100svh;
  max-height: 100%;
  display: flex; flex-direction: column; align-items: center;
  background: radial-gradient(120% 80% at 70% 0%, #1a5f78 0%, transparent 60%), linear-gradient(180deg, #0b1b3a 0%, #123a5c 100%);
  font-family: "Nunito", sans-serif; color: #fff; overflow: hidden;
  user-select: none; -webkit-user-select: none; touch-action: manipulation;
  padding: calc(6px + env(safe-area-inset-top)) calc(8px + env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) calc(8px + env(safe-area-inset-left));
  box-sizing: border-box;
}
.blk__stars {
  position: absolute; inset: 0; pointer-events: none; opacity: 0.8;
  background-image:
    radial-gradient(1.5px 1.5px at 12% 20%, #fff, transparent), radial-gradient(1px 1px at 30% 70%, #cfe9ff, transparent),
    radial-gradient(1.5px 1.5px at 55% 12%, #fff, transparent), radial-gradient(1px 1px at 78% 40%, #fff, transparent),
    radial-gradient(1.5px 1.5px at 90% 80%, #cfe9ff, transparent), radial-gradient(1px 1px at 8% 88%, #fff, transparent),
    radial-gradient(1px 1px at 65% 90%, #fff, transparent), radial-gradient(1.5px 1.5px at 42% 38%, #cfe9ff, transparent);
  animation: blk-tw 4s ease-in-out infinite alternate;
}
@keyframes blk-tw { from { opacity: 0.45; } to { opacity: 0.9; } }
.blk__title { font: 700 16px "Fredoka", sans-serif; letter-spacing: 0.5px; opacity: 0.75; margin: 2px 0 0; position: relative; }
.blk__area { position: relative; flex: 1 1 0; min-height: 0; width: 100%; display: flex; align-items: center; justify-content: center; }
.blk__stage { position: relative; flex: none; }
.blk__cv { position: absolute; left: 0; top: 0; touch-action: none; cursor: pointer; }
.blk__side {
  position: absolute; right: 0; top: 0; bottom: 0; display: flex; flex-direction: column; gap: 8px; pointer-events: none;
}
.blk__card {
  background: rgba(12, 24, 48, 0.72); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 18px; padding: 6px 8px 8px; text-align: center;
}
.blk__card--meter { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.blk__lbl { font: 700 11px "Fredoka", sans-serif; letter-spacing: 1.5px; opacity: 0.65; margin-bottom: 4px; }
.blk__next { width: 100%; aspect-ratio: 1; display: block; }
.blk__meter {
  flex: 1; min-height: 40px; display: flex; flex-direction: column-reverse; gap: 3px; padding: 4px;
  border-radius: 12px; background: rgba(0, 0, 0, 0.3); box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.35);
}
.blk__seg { flex: 1; border-radius: 6px; background: rgba(255, 255, 255, 0.08); transition: background 0.3s, box-shadow 0.3s; }
.blk__seg.is-on { background: linear-gradient(180deg, #b4ffcb, #4fe08a); box-shadow: 0 0 12px rgba(124, 242, 156, 0.8), inset 0 2px 0 rgba(255, 255, 255, 0.5); }
.blk__meter--pulse { animation: blk-pulse 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
.blk__meter--pulse2 { animation: blk-pulse2 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes blk-pulse { 0% { transform: scale(1); } 40% { transform: scale(1.1); } 100% { transform: scale(1); } }
@keyframes blk-pulse2 { 0% { transform: scale(1); } 40% { transform: scale(1.1); } 100% { transform: scale(1); } }
.blk__count { font: 600 14px "Fredoka", sans-serif; margin-top: 4px; opacity: 0.85; }
.blk__count b { font-size: 20px; color: #7cf29c; }
.blk__tv { font: 700 22px "Fredoka", sans-serif; }
.blk__card--time.is-low .blk__tv { color: #ff8a6b; animation: blk-blink 0.6s infinite alternate; }
@keyframes blk-blink { to { opacity: 0.5; } }
.blk__pause {
  position: absolute; left: 6px; top: 6px; width: 34px; height: 34px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(12, 24, 48, 0.6); color: #fff; font: 700 13px "Fredoka", sans-serif; cursor: pointer; opacity: 0.7;
}
.blk__storm {
  position: absolute; left: 0; top: 3px; z-index: 2; pointer-events: none; padding: 2px 8px 4px; border-radius: 10px;
  background: rgba(150, 50, 20, 0.7); border: 1px solid rgba(255, 190, 120, 0.5); text-align: center;
  font: 700 10px/1.2 "Fredoka", sans-serif; letter-spacing: 0.3px; box-sizing: border-box; opacity: 0.9;
  transform: scale(0.94); transform-origin: top center; animation: blk-stormin 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
.blk__storm--warn { animation: blk-stormin 0.3s forwards, blk-warn 0.35s 0.3s infinite alternate; }
@keyframes blk-stormin { to { transform: scale(1); } }
@keyframes blk-warn { to { background: rgba(230, 90, 30, 0.95); } }
.blk__storm i { display: block; height: 3px; border-radius: 2px; background: rgba(0, 0, 0, 0.3); margin-top: 3px; overflow: hidden; }
.blk__storm b { display: block; height: 100%; background: linear-gradient(90deg, #ffd23f, #ff9f43); transition: width 0.15s linear; }

/* controls */
.blk__ctl { position: relative; flex: none; display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; width: min(100%, 460px); padding-top: 8px; transition: opacity 0.2s; }
.blk__ctl.is-off { opacity: 0.35; pointer-events: none; }
.cb {
  --c: #3a9bff; --e: #1f66c4;
  height: 58px; border: 0; border-radius: 18px; cursor: pointer; display: grid; place-items: center;
  background: linear-gradient(180deg, color-mix(in srgb, var(--c) 80%, #fff), var(--c));
  box-shadow: 0 5px 0 var(--e), 0 9px 14px rgba(0, 0, 0, 0.3), inset 0 2px 0 rgba(255, 255, 255, 0.35);
  touch-action: none; -webkit-tap-highlight-color: transparent; transition: transform 0.1s;
}
.cb:active { transform: translateY(3px); box-shadow: 0 2px 0 var(--e), 0 3px 6px rgba(0, 0, 0, 0.3), inset 0 2px 0 rgba(255, 255, 255, 0.3); }
.cb svg { width: 28px; height: 28px; fill: none; stroke: #fff; stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.2)); }
.cb--go { --c: #2fcf6b; --e: #1a9a4c; }
.cb--warn { --c: #ff9f43; --e: #c96a14; }
.cb--pink { --c: #ff6b9d; --e: #c2386d; }
.blk__hint { flex: none; font-size: 12px; opacity: 0.6; padding: 6px 0 2px; position: relative; }

/* countdown */
.blk__count3 { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; z-index: 5; }
.blk__count3 span {
  font: 700 clamp(80px, 22vw, 150px) "Fredoka", sans-serif; color: #fff; text-shadow: 0 6px 0 rgba(0, 0, 0, 0.25), 0 0 40px rgba(124, 242, 156, 0.7);
  animation: blk-cd 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes blk-cd { 0% { transform: scale(0.2); opacity: 0; } 35% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); opacity: 0.9; } }

/* panels */
.blk__veil { position: absolute; inset: 0; z-index: 10; display: grid; place-items: center; padding: calc(10px + env(safe-area-inset-top)) calc(10px + env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) calc(10px + env(safe-area-inset-left)); box-sizing: border-box; background: rgba(6, 12, 28, 0.55); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); overflow: auto; }
.blk__panel {
  width: min(100%, 460px); max-height: 100%; overflow: hidden; box-sizing: border-box; padding: 16px 16px 14px; text-align: center; display: flex; flex-direction: column; min-height: 0;
  background: rgba(12, 24, 48, 0.82); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 28px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
  animation: blk-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.blk__panel--sm { width: min(100%, 320px); }
@keyframes blk-pop { from { transform: scale(0.85) translateY(14px); opacity: 0; } }
.blk__panel h2 { font: 700 clamp(26px, 6vw, 34px) "Fredoka", sans-serif; margin: 6px 0 8px; }
.blk__panel.is-win h2 { color: #7cf29c; }
.blk__panel.is-lose h2 { color: #ffb347; }
.blk__goal { font-weight: 700; font-size: 15px; line-height: 1.4; margin: 0 0 12px; color: rgba(255, 255, 255, 0.92); }
.blk__goal b { color: #7cf29c; }
.blk__bricks { display: flex; justify-content: center; gap: 5px; }
.blk__bricks i { width: 22px; height: 22px; border-radius: 7px; box-shadow: inset 0 3px 0 rgba(255, 255, 255, 0.45), inset 0 -3px 0 rgba(40, 30, 70, 0.2); animation: blk-bob 1.6s ease-in-out infinite; }
.blk__bricks i:nth-child(2n) { animation-delay: 0.3s; } .blk__bricks i:nth-child(3n) { animation-delay: 0.6s; }
@keyframes blk-bob { 50% { transform: translateY(-5px); } }
.blk__how { list-style: none; margin: 0 0 12px; padding: 0; text-align: left; font-size: 13px; line-height: 1.35; display: grid; gap: 6px; color: rgba(255, 255, 255, 0.85); }
.blk__how li { background: rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 7px 10px; }
.blk__how b { color: #4fd1ff; margin-right: 6px; }
.blk__fact { text-align: left; font-size: 13px; line-height: 1.45; background: rgba(79, 209, 255, 0.1); border: 1px solid rgba(79, 209, 255, 0.3); border-radius: 16px; padding: 10px 12px; margin-bottom: 16px; }
.blk__fact em { display: block; margin-top: 5px; font-size: 11px; opacity: 0.65; }
.blk__tag { display: block; font: 700 11px "Fredoka", sans-serif; letter-spacing: 1.4px; color: #4fd1ff; margin-bottom: 3px; }
.blk__stars3 { display: flex; justify-content: center; gap: 6px; margin-bottom: 10px; }
.blk__stars3 svg { width: 48px; height: 48px; fill: rgba(255, 255, 255, 0.14); }
.blk__stars3 svg.on { fill: #ffd23f; filter: drop-shadow(0 0 10px rgba(255, 210, 63, 0.7)); animation: blk-star 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
@keyframes blk-star { from { transform: scale(0) rotate(-40deg); } }
.blk__stats { display: flex; justify-content: center; gap: 10px; margin-bottom: 12px; }
.blk__stats div { flex: 1; background: rgba(255, 255, 255, 0.07); border-radius: 14px; padding: 8px 4px; }
.blk__stats b { display: block; font: 700 22px "Fredoka", sans-serif; }
.blk__stats span { font-size: 11px; opacity: 0.65; }
.blk__btns { display: flex; justify-content: center; align-items: center; gap: 12px; flex-wrap: wrap; }

@media (max-width: 420px) {
  .blk__panel { padding: 16px 14px 18px; }
  .blk__how { font-size: 12px; }
  .blk__fact { font-size: 12px; }
}
@media (max-height: 720px) { .blk__bricks { display: none; } .blk__title { display: none; } }
@media (prefers-reduced-motion: reduce) {
  .blk__stars, .blk__bricks i, .blk__panel, .blk__count3 span, .blk__storm--warn, .blk__meter--pulse, .blk__meter--pulse2, .blk__stars3 svg.on { animation: none !important; }
}
.blk__ctl1 { font-size: 13px; opacity: 0.8; margin: 0 0 12px; }

.blk__body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.blk__foot { flex: none; display: flex; justify-content: center; align-items: center; gap: 10px; flex-wrap: wrap; padding-top: 10px; }
.blk__goal--2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 8px; }
.blk__more { display: block; margin: 6px auto 0; background: none; border: 0; color: #4fd1ff; font: 700 12px "Fredoka", sans-serif; cursor: pointer; padding: 4px 8px; }
.blk__fact p { margin: 6px 0 0; font-size: 12px; }
.blk__panel h2 { font-size: clamp(22px, 5.5vw, 30px); margin: 4px 0 6px; }
.blk__goal { font-size: 14px; margin-bottom: 8px; }
.blk__fact { font-size: 12.5px; line-height: 1.4; padding: 8px 10px; margin-bottom: 4px; }
.blk__stars3 { margin-bottom: 6px; } .blk__stars3 svg { width: 36px; height: 36px; }
.blk__stats { gap: 6px; margin-bottom: 8px; flex-wrap: nowrap; } .blk__stats b { font-size: 18px; } .blk__stats span { font-size: 10px; }
.blk__bricks i { width: 18px; height: 18px; }
.blk__panel :deep(.mbtn--big) { font-size: 20px; min-height: 52px; padding: 8px 30px; }
</style>
