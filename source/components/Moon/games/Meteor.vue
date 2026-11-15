<script setup lang="ts">
// Meteor Defense — tap comets, meteoroids and space junk to blast them before they crack the dome.
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import gsap from "gsap";
import { sfx, music } from "../../../moon/sfx";
import type { MiniGameProps, MiniGameResult } from "../../../moon/types";
import Btn from "../ui/Btn.vue";
import Sheet from "../ui/Sheet.vue";

const props = defineProps<MiniGameProps>();
const emit = defineEmits<{ finish: [result: MiniGameResult] }>();

const DUR = 35; // seconds of survival
const S = (n: string) => {
  try {
    (sfx as any)[n]?.();
  } catch {
    /* audio never breaks the game */
  }
};

// ---------------------------------------------------------------- reactive UI state
type Phase = "intro" | "count" | "play" | "winanim" | "lose" | "result";
const phase = ref<Phase>("intro");
const paused = ref(false);
const hp = ref(3);
const maxHp = ref(3);
const points = ref(0);
const secsLeft = ref(DUR);
const waveNo = ref(1);
const countLabel = ref("");
const shownScore = ref(0);
const res = ref({ won: false, score: 0, destroyed: 0, acc: 0, combo: 0, hp: 0, cells: 0, fact: 0, why: "" });
const hpPop = ref(-1);

const root = ref<HTMLElement | null>(null);
const cv = ref<HTMLCanvasElement | null>(null);
const barEl = ref<HTMLElement | null>(null);

const isCadet = computed(() => props.age === "cadet");
const stars = computed(() => (!res.value.won ? 0 : res.value.score >= 80 ? 3 : res.value.score >= 55 ? 2 : 1));

const FACTS = [
  {
    t: "The Moon has no air shield",
    b: "On Earth, the atmosphere burns most meteoroids up. The Moon has almost no atmosphere, so even tiny rocks hit the surface at about 20 km/s, roughly 50 times faster than a jet airliner.",
    s: "NASA Meteoroid Environment Office",
  },
  {
    t: "The Moon keeps its scars",
    b: "NASA's Lunar Reconnaissance Orbiter has photographed hundreds of brand-new impact craters on the Moon since 2009, by comparing before and after pictures.",
    s: "NASA LRO / LROC",
  },
  {
    t: "Space junk is real",
    b: "NASA's Orbital Debris Program Office tracks tens of thousands of pieces of human-made junk around Earth, like old satellite parts and bolts. They zoom at roughly 7 to 8 km/s, many times faster than a bullet.",
    s: "NASA Orbital Debris Program Office",
  },
];

// ---------------------------------------------------------------- game state (non-reactive, hot path)
interface Threat {
  id: number;
  kind: "rock" | "comet" | "big" | "debris";
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxhp: number;
  rot: number;
  vr: number;
  pts: number[];
  seed: number;
  variant: number;
  hitFlash: number;
  spark: number;
  fresh: number;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  grav: number;
  drag: number;
  chunk: boolean;
  rot: number;
  vr: number;
  add: boolean;
}
interface Ring { x: number; y: number; r: number; max: number; life: number; dur: number; color: string; w: number }
interface Floater { x: number; y: number; text: string; life: number; dur: number; color: string; size: number }
interface Beam { x1: number; y1: number; x2: number; y2: number; life: number; color: string }
interface Cell { x: number; y: number; t: number; vy: number; sway: number; ph: number; life: number }

let safeTop = 0, safeBot = 0;
let W = 360, H = 640, dpr = 1, u = 1, gh = 90, groundY = 550, domeX = 180, R = 50;
let ctx: CanvasRenderingContext2D | null = null;
let skyC: HTMLCanvasElement | null = null;
let fgC: HTMLCanvasElement | null = null;
const MARGIN = 28;

let raf = 0;
let lastT = 0;
let uid = 1;
let ro: ResizeObserver | null = null;
let reduce = false;

let threats: Threat[] = [];
let parts: Particle[] = [];
let rings: Ring[] = [];
let floaters: Floater[] = [];
let beams: Beam[] = [];
let cells: Cell[] = [];
let pings: { x: number; y: number; t: number }[] = [];
let craters: { x: number; d: number; r: number; a: number }[] = [];
let cracks: { x: number; y: number }[][] = [];
let stars3: { x: number; y: number; s: number; tw: number; l: number }[] = [];

let t = 0; // play time
let timeScale = 1;
let spawnT = 1.6;
let cellT = 6;
let cellsSpawned = 0;
let waveShown = -1;
let shake = 0;
let flash = 0; // red hit flash
let whiteFlash = 0;
let hurtT = 0;
let combo = 0;
let comboT = 0;
let bestCombo = 0;
let comboBanner = { text: "", t: 0, big: 0 };
let shots = 0;
let hitsN = 0;
let destroyed = 0;
let hitKinds: Record<string, number> = {};
let cellsGot = 0;
let aim = -Math.PI / 2;
let aimTarget = -Math.PI / 2;
let recoil = 0;
let muzzle = 0;
let lastLaserSnd = 0;
let kbMode = false;
let ptrX = 0.5;
let phaseT = 0;
let countNum = 4;
let winT = 0;
let loseT = 0;
let twT = 0;
let now = 0;

// ---------------------------------------------------------------- tuning
const diffMul = () => [0.85, 1, 1.2][Math.min(2, Math.max(0, props.difficulty - 1))];
const ageSpeed = () => (isCadet.value ? 0.74 : 1.08);
const ageSize = () => (isCadet.value ? 1.28 : 1);
const startHp = () => (isCadet.value ? (props.difficulty >= 3 ? 4 : 5) : props.difficulty === 1 ? 4 : 3);
const waveOf = () => Math.min(4, Math.floor(t / (DUR / 5)));

// ---------------------------------------------------------------- helpers
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const glowCache = new Map<string, HTMLCanvasElement>();
function glowSprite(color: string): HTMLCanvasElement {
  let g = glowCache.get(color);
  if (g) return g;
  g = document.createElement("canvas");
  g.width = g.height = 64;
  const c = g.getContext("2d")!;
  const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, color);
  gr.addColorStop(0.35, color.replace(/[\d.]+\)$/, "0.35)"));
  gr.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
  c.fillStyle = gr;
  c.fillRect(0, 0, 64, 64);
  glowCache.set(color, g);
  return g;
}
const C_ORANGE = "rgba(255,160,60,1)";
const C_YELLOW = "rgba(255,226,120,1)";
const C_WHITE = "rgba(255,255,255,1)";
const C_CYAN = "rgba(90,220,255,1)";
const C_GOLD = "rgba(255,210,63,1)";
const C_RED = "rgba(255,80,80,1)";
const C_GREEN = "rgba(124,242,156,1)";
function glow(x: number, y: number, size: number, color: string, alpha = 1) {
  if (!ctx) return;
  ctx.globalAlpha = alpha;
  ctx.drawImage(glowSprite(color), x - size, y - size, size * 2, size * 2);
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- layout / pre-rendered layers
function layout() {
  const el = root.value;
  const c = cv.value;
  if (!el || !c) return;
  const nw = Math.max(240, el.clientWidth);
  const nh = Math.max(240, el.clientHeight);
  const sx = nw / W, sy = nh / H;
  const oldU = u;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = nw;
  H = nh;
  c.width = Math.round(W * dpr);
  c.height = Math.round(H * dpr);
  c.style.width = W + "px";
  c.style.height = H + "px";
  ctx = c.getContext("2d", { alpha: false });
  u = clamp(Math.min(W / 560, H / 420), 0.78, 1.5);
  try {
    const pr = document.createElement("div");
    pr.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)";
    el.appendChild(pr);
    const cs = getComputedStyle(pr);
    safeTop = parseFloat(cs.paddingTop) || 0;
    safeBot = parseFloat(cs.paddingBottom) || 0;
    el.removeChild(pr);
  } catch { /* no safe area */ }
  gh = clamp(H * 0.15, 58, 132) + safeBot + (W < 700 ? 10 : 0);
  groundY = H - gh;
  domeX = W / 2;
  R = clamp(W * 0.11, 46, 88);
  // keep the live world sensible after a resize
  if (isFinite(sx) && isFinite(sy) && oldU > 0) {
    const k = u / oldU;
    for (const th of threats) { th.x *= sx; th.y *= sy; th.vx *= sx; th.vy *= sy; th.r *= k; }
    for (const ce of cells) { ce.x *= sx; ce.y *= sy; }
  }
  buildLayers();
}

function buildLayers() {
  // sky: navy -> teal, nebula glows
  const sw = W + MARGIN * 2, sh = H + MARGIN * 2;
  skyC = document.createElement("canvas");
  skyC.width = Math.round(sw * dpr);
  skyC.height = Math.round(sh * dpr);
  let c = skyC.getContext("2d")!;
  c.scale(dpr, dpr);
  c.translate(MARGIN, MARGIN);
  let g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#08142e");
  g.addColorStop(0.55, "#0e2f52");
  g.addColorStop(1, "#18617a");
  c.fillStyle = g;
  c.fillRect(-MARGIN, -MARGIN, sw, sh);
  const neb = (x: number, y: number, r: number, col: string) => {
    const gr = c.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = gr;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  };
  neb(W * 0.2, H * 0.3, Math.max(W, H) * 0.45, "rgba(60,140,200,0.22)");
  neb(W * 0.75, H * 0.55, Math.max(W, H) * 0.4, "rgba(40,190,190,0.16)");
  neb(W * 0.5, H * 0.12, Math.max(W, H) * 0.35, "rgba(150,110,220,0.1)");

  // foreground: Earth, far hills, moon ground
  fgC = document.createElement("canvas");
  fgC.width = Math.round(sw * dpr);
  fgC.height = Math.round(sh * dpr);
  c = fgC.getContext("2d")!;
  c.scale(dpr, dpr);
  c.translate(MARGIN, MARGIN);
  // Earth
  const re = clamp(Math.min(W, H) * 0.13, 34, 96);
  const ex = W * (W < 520 ? 0.8 : 0.84), ey = H * (W < 520 ? 0.27 : 0.25);
  const halo = c.createRadialGradient(ex, ey, re * 0.9, ex, ey, re * 1.9);
  halo.addColorStop(0, "rgba(110,190,255,0.35)");
  halo.addColorStop(1, "rgba(110,190,255,0)");
  c.fillStyle = halo;
  c.fillRect(ex - re * 2, ey - re * 2, re * 4, re * 4);
  c.save();
  c.beginPath();
  c.arc(ex, ey, re, 0, Math.PI * 2);
  c.clip();
  g = c.createRadialGradient(ex - re * 0.35, ey - re * 0.35, re * 0.1, ex, ey, re);
  g.addColorStop(0, "#6cc3ff");
  g.addColorStop(0.6, "#2f7fe0");
  g.addColorStop(1, "#1a4aa0");
  c.fillStyle = g;
  c.fillRect(ex - re, ey - re, re * 2, re * 2);
  c.fillStyle = "#5fd08a";
  const blob = (dx: number, dy: number, rx: number, ry: number, rot: number) => {
    c.beginPath();
    c.ellipse(ex + dx * re, ey + dy * re, rx * re, ry * re, rot, 0, Math.PI * 2);
    c.fill();
  };
  blob(-0.3, -0.1, 0.34, 0.2, 0.5);
  blob(-0.45, 0.28, 0.16, 0.26, -0.3);
  blob(0.35, 0.2, 0.28, 0.16, 0.2);
  blob(0.1, -0.5, 0.2, 0.1, 0);
  c.fillStyle = "rgba(255,255,255,0.75)";
  blob(0.1, 0.0, 0.3, 0.06, -0.2);
  blob(-0.2, 0.5, 0.26, 0.05, 0.3);
  blob(0.4, -0.35, 0.2, 0.05, 0.1);
  const sh2 = c.createRadialGradient(ex - re * 0.5, ey - re * 0.5, re * 0.6, ex + re * 0.2, ey + re * 0.2, re * 1.25);
  sh2.addColorStop(0, "rgba(0,10,40,0)");
  sh2.addColorStop(1, "rgba(0,10,40,0.38)");
  c.fillStyle = sh2;
  c.fillRect(ex - re, ey - re, re * 2, re * 2);
  c.restore();
  c.strokeStyle = "rgba(170,225,255,0.55)";
  c.lineWidth = 2;
  c.beginPath();
  c.arc(ex, ey, re, 0, Math.PI * 2);
  c.stroke();
  // far hills
  c.fillStyle = "#4b5c82";
  c.beginPath();
  c.moveTo(-MARGIN, H + MARGIN);
  c.lineTo(-MARGIN, groundY - 8);
  const hn = 12;
  for (let i = 0; i <= hn; i++) {
    const x = (W + MARGIN * 2) * (i / hn) - MARGIN;
    c.lineTo(x, groundY - 10 - (Math.sin(i * 1.7) * 0.5 + 0.5) * gh * 0.32 - (i % 3) * 3);
  }
  c.lineTo(W + MARGIN, H + MARGIN);
  c.fill();
  // ground
  g = c.createLinearGradient(0, groundY, 0, H);
  g.addColorStop(0, "#d9dbe4");
  g.addColorStop(0.45, "#b8bccb");
  g.addColorStop(1, "#8e93a8");
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(-MARGIN, H + MARGIN);
  c.lineTo(-MARGIN, groundY + 2);
  for (let i = 0; i <= 24; i++) {
    const x = (W + MARGIN * 2) * (i / 24) - MARGIN;
    c.lineTo(x, groundY + Math.sin(i * 0.9) * 2.5 + Math.cos(i * 2.3) * 1.5);
  }
  c.lineTo(W + MARGIN, H + MARGIN);
  c.fill();
  c.fillStyle = "rgba(255,255,255,0.5)";
  c.fillRect(-MARGIN, groundY, W + MARGIN * 2, 2);
  // dim static craters + rocks for texture
  let sd = 7;
  const r1 = () => ((sd = (sd * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 14; i++) {
    const cx = r1() * W, cy = groundY + 10 + r1() * (gh - 14), cr = (6 + r1() * 12) * u;
    c.fillStyle = "rgba(110,116,140,0.35)";
    c.beginPath();
    c.ellipse(cx, cy, cr, cr * 0.28, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.28)";
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(cx, cy - 1, cr, cr * 0.28, 0, Math.PI * 1.05, Math.PI * 1.95);
    c.stroke();
  }
  // stars (normalized)
  if (!stars3.length) {
    for (let i = 0; i < 140; i++) {
      const l = i < 70 ? 0 : i < 110 ? 1 : 2;
      stars3.push({ x: Math.random(), y: Math.random() * 0.8, s: 0.6 + l * 0.55 + Math.random() * 0.4, tw: Math.random() * 6.28, l });
    }
  }
}

// ---------------------------------------------------------------- spawning
function makeThreat(kind: Threat["kind"], x: number, y: number, vx: number, vy: number, r: number): Threat {
  const n = 11;
  const pts: number[] = [];
  for (let i = 0; i < n; i++) pts.push(rnd(0.74, 1.1));
  const maxhp = kind === "debris" && !isCadet.value ? 2 : 1;
  return {
    id: uid++, kind, x, y, vx, vy, r, hp: maxhp, maxhp, rot: rnd(0, 6.28),
    vr: rnd(-1.6, 1.6) * (kind === "debris" ? 1.8 : 1), pts, seed: Math.random() * 100,
    variant: Math.random() < 0.5 ? 0 : 1, hitFlash: 0, spark: 0, fresh: 0.25,
  };
}

function spawnThreat() {
  const w = waveOf();
  const wts: [Threat["kind"], number][] = [
    ["rock", 5],
    ["comet", 2 + w * 0.6],
    ["big", w >= 1 ? 1 + w * 0.7 : 0.2],
    ["debris", w >= 1 ? 1.4 + w * 0.3 : 0],
  ];
  let tot = 0;
  for (const [, v] of wts) tot += v;
  let pick = Math.random() * tot;
  let kind: Threat["kind"] = "rock";
  for (const [k, v] of wts) {
    if ((pick -= v) <= 0) { kind = k; break; }
  }
  const base = { rock: 19, comet: 14, big: 33, debris: 17 }[kind];
  const r = base * u * ageSize() * rnd(0.92, 1.1);
  const mult = { rock: 1, comet: 1.55, big: 0.72, debris: 0.9 }[kind];
  const speed = Math.min(H * 0.42, H * (0.14 + 0.022 * w) * diffMul() * ageSpeed() * mult * rnd(0.9, 1.12));
  const near = Math.random() < 0.62;
  const tx = near ? domeX + rnd(-R * 0.85, R * 0.85) : rnd(24, W - 24);
  const sx = clamp(tx + rnd(-1, 1) * Math.min(W * 0.55, H * 0.7), -r, W + r);
  const sy = -r * 2.2;
  const dx = tx - sx, dy = groundY - sy;
  const d = Math.hypot(dx, dy);
  threats.push(makeThreat(kind, sx, sy, (dx / d) * speed, (dy / d) * speed, r));
}

function maxAlive() {
  return (isCadet.value ? 4 : 5) + waveOf() + (props.difficulty - 1);
}
function spawnInterval() {
  const base = isCadet.value ? 1.75 : 1.25;
  return (base / (1 + 0.13 * waveOf()) / diffMul()) * rnd(0.8, 1.2);
}
function spawnCell() {
  cells.push({ x: rnd(W * 0.15, W * 0.85), y: -30, t: 0, vy: H * 0.085, sway: rnd(18, 36) * u, ph: rnd(0, 6.28), life: 0 });
  cellsSpawned++;
}

// ---------------------------------------------------------------- effects
function addPart(p: Partial<Particle>) {
  if (parts.length > 700) return;
  parts.push({
    x: 0, y: 0, vx: 0, vy: 0, life: 0.6, max: 0.6, size: 3, color: C_ORANGE, grav: 0, drag: 0.5,
    chunk: false, rot: 0, vr: 0, add: true, ...p,
  } as Particle);
  const q = parts[parts.length - 1];
  q.max = q.life;
}
function explode(x: number, y: number, size: number, tone: "fire" | "ice" | "metal" | "gold" = "fire") {
  const n = Math.round((16 + size * 0.5) * (reduce ? 0.7 : 1));
  const cols =
    tone === "ice" ? [C_CYAN, C_WHITE, C_CYAN] : tone === "gold" ? [C_GOLD, C_YELLOW, C_WHITE] : tone === "metal" ? [C_WHITE, C_YELLOW, C_ORANGE] : [C_ORANGE, C_YELLOW, C_RED, C_WHITE];
  for (let i = 0; i < n; i++) {
    const a = rnd(0, 6.28), sp = rnd(60, 260) * u * (0.6 + size / 60);
    addPart({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: rnd(0.35, 0.9), size: rnd(2, 5) * u, color: cols[i % cols.length], grav: 160, drag: 1.6 });
  }
  if (tone !== "ice" && tone !== "gold") {
    const m = tone === "metal" ? 7 : 6;
    for (let i = 0; i < m; i++) {
      const a = rnd(0, 6.28), sp = rnd(50, 190) * u;
      addPart({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: rnd(0.8, 1.5), size: rnd(2.5, 5.5) * u, color: tone === "metal" ? "#aab4c8" : "#6e6560", grav: 320, drag: 0.5, chunk: true, rot: rnd(0, 6), vr: rnd(-9, 9), add: false });
    }
  }
  rings.push({ x, y, r: size * 0.3, max: size * 2.6, life: 0.5, dur: 0.5, color: tone === "ice" ? C_CYAN : tone === "gold" ? C_GOLD : C_ORANGE, w: 4 * u });
  rings.push({ x, y, r: size * 0.2, max: size * 1.6, life: 0.32, dur: 0.32, color: C_WHITE, w: 2.5 * u });
  addPart({ x, y, size: size * 2.8, life: 0.22, color: C_YELLOW, grav: 0, drag: 0 });
  addShake(Math.min(14, 3 + size * 0.17));
}
function addShake(v: number) {
  shake = Math.min(18, shake + v * (reduce ? 0.2 : 1));
}
function floater(x: number, y: number, text: string, color = "#fff", size = 22, dur = 0.9) {
  floaters.push({ x, y, text, life: dur, dur, color, size: size * Math.min(1.3, u) });
}
function crater(x: number, r: number) {
  craters.push({ x: x / W, d: rnd(0.12, 0.7), r: (r / u) * rnd(0.9, 1.25), a: 1 });
  if (craters.length > 46) craters.shift();
}

// ---------------------------------------------------------------- gameplay actions
function topY() {
  return safeTop + 104;
}
function turretPos() {
  return { x: domeX, y: groundY - R - 2 * u };
}
function fireAt(tx: number, ty: number) {
  const tp = turretPos();
  aimTarget = Math.atan2(ty - tp.y, tx - tp.x);
  if (aimTarget > -0.12) aimTarget = -0.12;
  if (aimTarget < -Math.PI + 0.12 && aimTarget > -Math.PI - 4) aimTarget = Math.min(aimTarget, -Math.PI + 0.12);
  const a = Math.atan2(ty - tp.y, tx - tp.x);
  const len = 28 * u;
  beams.push({ x1: tp.x + Math.cos(a) * len, y1: tp.y + Math.sin(a) * len, x2: tx, y2: ty, life: 0.14, color: C_CYAN });
  recoil = 1;
  muzzle = 1;
  if (now - lastLaserSnd > 0.07) { S("laser"); lastLaserSnd = now; }
}

function hitRadius(r: number) {
  return Math.max(r + 12 * u, 30);
}

function pointerShoot(x: number, y: number) {
  if (phase.value !== "play") return;
  pings.push({ x, y, t: 0 });
  let best: Threat | null = null, bestD = 1e9;
  for (const th of threats) {
    const d = Math.hypot(th.x - x, th.y - y) / hitRadius(th.r);
    if (d <= 1 && d < bestD) { best = th; bestD = d; }
  }
  let bc: Cell | null = null;
  for (const ce of cells) {
    const d = Math.hypot(ce.x - x, ce.y - y) / Math.max(40 * u, 36);
    if (d <= 1 && d < bestD) { bc = ce; bestD = d; best = null; }
  }
  if (!best && !bc && !threats.length && !cells.length) return;
  shots++;
  if (bc) {
    fireAt(bc.x, bc.y);
    collectCell(bc);
  } else if (best) {
    fireAt(best.x, best.y);
    damage(best);
  } else {
    fireAt(x, y);
    // small dust puff where the laser lands
    for (let i = 0; i < 5; i++) addPart({ x, y, vx: rnd(-40, 40), vy: rnd(-50, 10), life: 0.3, size: 2 * u, color: C_CYAN, drag: 2 });
    comboT = Math.max(0, comboT - 0.4);
  }
}

function nearestTarget(): { x: number; y: number; th?: Threat; ce?: Cell } | null {
  let best: Threat | null = null, bd = 1e9;
  for (const th of threats) {
    if (th.y < -th.r) continue;
    const d = Math.hypot(th.x - domeX, th.y - groundY);
    if (d < bd) { bd = d; best = th; }
  }
  if (best) return { x: best.x, y: best.y, th: best };
  if (cells.length) return { x: cells[0].x, y: cells[0].y, ce: cells[0] };
  return null;
}

function keyShoot() {
  if (phase.value !== "play") return;
  const tg = nearestTarget();
  if (!tg) return;
  shots++;
  pings.push({ x: tg.x, y: tg.y, t: 0 });
  fireAt(tg.x, tg.y);
  if (tg.th) damage(tg.th);
  else if (tg.ce) collectCell(tg.ce);
}

function damage(th: Threat) {
  hitsN++;
  th.hp--;
  if (th.hp > 0) {
    th.hitFlash = 1;
    explodeSmall(th.x, th.y);
    S("beep");
    addShake(2);
    floater(th.x, th.y - th.r - 8, "CRACK!", "#cfe3ff", 16, 0.6);
    return;
  }
  killThreat(th, true);
}
function explodeSmall(x: number, y: number) {
  for (let i = 0; i < 8; i++) {
    const a = rnd(0, 6.28), sp = rnd(60, 160) * u;
    addPart({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.2, 0.45), size: rnd(1.5, 3) * u, color: C_WHITE, drag: 2 });
  }
}

function killThreat(th: Threat, byPlayer: boolean) {
  threats = threats.filter((q) => q !== th);
  const tone = th.kind === "comet" ? "ice" : th.kind === "debris" ? "metal" : "fire";
  explode(th.x, th.y, th.r * 1.9, tone);
  S("explosion");
  if (th.kind === "big") {
    // split into two smaller rocks flying apart
    const sp = Math.hypot(th.vx, th.vy);
    const ang = Math.atan2(th.vy, th.vx);
    for (const s of [-1, 1]) {
      const a = ang + s * rnd(0.35, 0.6);
      const k = rnd(0.95, 1.2);
      const sm = makeThreat("rock", th.x + s * th.r * 0.3, th.y, Math.cos(a) * sp * k, Math.sin(a) * sp * k, th.r * 0.54);
      sm.fresh = 0.35;
      threats.push(sm);
    }
    floater(th.x, th.y - th.r, "SPLIT!", "#ffd23f", 18, 0.8);
  }
  if (!byPlayer) return;
  destroyed++;
  if (comboT > 0) combo++;
  else combo = 1;
  comboT = 2.3;
  bestCombo = Math.max(bestCombo, combo);
  const base = { rock: 10, comet: 15, big: 25, debris: 20 }[th.kind];
  const mult = Math.min(5, combo);
  const gain = base * mult;
  points.value += gain;
  floater(th.x, th.y, "+" + gain, mult > 1 ? "#ffd23f" : "#ffffff", 20 + mult * 1.5);
  if (combo >= 3) {
    comboBanner = { text: `x${combo} COMBO!`, t: 1.3, big: 1 };
    if (combo % 3 === 0) S("coin");
  }
}

function collectCell(ce: Cell) {
  cells = cells.filter((q) => q !== ce);
  hitsN++;
  cellsGot++;
  explode(ce.x, ce.y, 40 * u, "gold");
  S("powerUp");
  rings.push({ x: ce.x, y: ce.y, r: 10, max: Math.max(W, H) * 0.35, life: 0.7, dur: 0.7, color: C_GOLD, w: 6 * u });
  if (hp.value < maxHp.value) {
    hp.value++;
    hpPop.value = hp.value - 1;
    setTimeout(() => (hpPop.value = -1), 600);
    floater(ce.x, ce.y - 20, "+1 DOME REPAIR", "#7cf29c", 20, 1.3);
    // repair flash on dome
    whiteFlash = 0.5;
    if (cracks.length) cracks.pop();
  } else {
    points.value += 150;
    floater(ce.x, ce.y - 20, "SOLAR BONUS +150", "#ffd23f", 20, 1.3);
  }
  // the pulse also vaporises small stuff nearby
  for (const th of threats.slice()) {
    if (th.kind !== "big" && Math.hypot(th.x - ce.x, th.y - ce.y) < Math.max(W, H) * 0.22) {
      explode(th.x, th.y, th.r * 1.5, "gold");
      threats = threats.filter((q) => q !== th);
      destroyed++;
      points.value += 10;
    }
  }
}

function domeHit(th: Threat) {
  threats = threats.filter((q) => q !== th);
  explode(th.x, th.y, th.r * 2.2, "fire");
  S("explosion");
  S(hp.value <= 2 ? "alarm" : "wrong");
  hitKinds[th.kind] = (hitKinds[th.kind] || 0) + 1;
  hp.value = Math.max(0, hp.value - 1);
  hpPop.value = -1;
  combo = 0;
  comboT = 0;
  flash = 1;
  hurtT = 0.5;
  addShake(16);
  // a crack across the glass
  const a = rnd(Math.PI * 1.15, Math.PI * 1.85);
  const pts: { x: number; y: number }[] = [];
  let cx = Math.cos(a) * R * 0.95, cy = Math.sin(a) * R * 0.95;
  const dirx = -Math.cos(a) + rnd(-0.5, 0.5), diry = -Math.sin(a) * 0.4 + rnd(0, 0.4);
  for (let i = 0; i < 5; i++) {
    pts.push({ x: cx, y: cy });
    cx += (dirx * R * 0.17) + rnd(-6, 6) * u;
    cy += (diry * R * 0.17) + rnd(-3, 8) * u;
  }
  cracks.push(pts);
  floater(domeX, groundY - R - 28 * u, "OUCH!", "#ff8a8a", 24, 0.9);
  if (hp.value <= 0 && phase.value === "play") beginLose();
}

function groundHit(th: Threat) {
  threats = threats.filter((q) => q !== th);
  crater(th.x, th.r);
  const y = groundY + 4;
  explode(th.x, y, th.r * 1.7, th.kind === "comet" ? "ice" : "fire");
  S("land");
  addShake(4 + th.r * 0.1);
  // dust
  for (let i = 0; i < 10; i++) addPart({ x: th.x + rnd(-th.r, th.r), y, vx: rnd(-90, 90) * u, vy: rnd(-120, -20) * u, life: rnd(0.5, 1), size: rnd(3, 6) * u, color: "rgba(220,222,232,1)", grav: 120, drag: 1.5, add: false });
  // not counted as a kill; combo only decays with time
}

// ---------------------------------------------------------------- phases
function beginLose() {
  phase.value = "lose";
  loseT = 0;
  timeScale = 0.35;
  for (let i = 0; i < 5; i++) setTimeout(() => {
    explode(domeX + rnd(-R, R) * 0.8, groundY - rnd(0.1, 0.9) * R, 30 * u, "fire");
  }, i * 180);
  S("gameOver");
}
function beginWin() {
  phase.value = "winanim";
  winT = 0;
  twT = 0;
  cells = [];
  S("go");
}
function finishRound() {
  const won = phase.value === "winanim" && hp.value > 0;
  const acc = shots ? hitsN / shots : 0;
  const hpPart = (hp.value / maxHp.value) * 40;
  const accPart = Math.min(1, acc) * 30;
  const comboPart = (Math.min(bestCombo, 10) / 10) * 20;
  const tot = destroyed + craters.length + (maxHp.value - hp.value);
  const killPart = tot ? (destroyed / tot) * 10 : 10;
  let score = hpPart + accPart + comboPart + killPart + cellsGot * 3;
  if (won) score = Math.max(score, 35);
  else score = Math.min(score * 0.4, 30) * Math.min(1, t / DUR + 0.2);
  score = Math.round(clamp(score, 0, 100));
  res.value = { won, score, destroyed, acc: Math.round(acc * 100), combo: bestCombo, hp: hp.value, cells: cellsGot, fact: Math.floor(Math.random() * 3), why: won ? "" : whyLost(acc) };
  phase.value = "result";
  shownScore.value = 0;
  const o = { v: 0 };
  gsap.to(o, { v: score, duration: 1.2, ease: "power2.out", delay: 0.35, onUpdate: () => (shownScore.value = Math.round(o.v)) });
  S(won ? "win" : "fail");
  music.play(won ? "victory" : "base");
}
function whyLost(acc: number) {
  const top = Object.entries(hitKinds).sort((a, b) => b[1] - a[1])[0]?.[0];
  const name = { rock: "Fast rocks", comet: "Speedy comets", big: "Big meteors", debris: "Space junk" }[top || "rock"] || "Rocks";
  if (shots > 6 && acc < 0.5) return `${name} got through, and many shots missed. Aim right at the rock!`;
  if (top === "big") return "Big meteors got through. Shoot them early so the pieces are easy to catch.";
  if (top === "debris") return "Space junk got through. It takes 2 hits, so start on it early.";
  return `${name} got through. Shoot the ones closest to the dome first.`;
}
function resetWorld() {
  threats = []; parts = []; rings = []; floaters = []; beams = []; cells = []; pings = []; craters = []; cracks = [];
  t = 0; timeScale = 1; spawnT = 1.6; cellT = 6; cellsSpawned = 0; waveShown = -1; shake = 0; flash = 0; whiteFlash = 0;
  combo = 0; comboT = 0; bestCombo = 0; comboBanner = { text: "", t: 0, big: 0 };
  shots = 0; hitsN = 0; destroyed = 0; hitKinds = {}; cellsGot = 0;
  maxHp.value = startHp();
  hp.value = maxHp.value;
  points.value = 0;
  secsLeft.value = DUR;
  waveNo.value = 1;
  paused.value = false;
}
function startCountdown() {
  S("click");
  moreOpen.value = false;
  try { (sfx as any).unlock?.(); } catch { /* noop */ }
  music.play("minigame");
  resetWorld();
  phase.value = "count";
  phaseT = 0;
  countNum = 4;
  (document.activeElement as HTMLElement | null)?.blur?.();
}
function cont() {
  music.play("base");
  emit("finish", { won: res.value.won, score: res.value.score });
}
function togglePause(force?: boolean) {
  if (phase.value !== "play") return;
  paused.value = force ?? !paused.value;
  if (paused.value) S("click");
  (document.activeElement as HTMLElement | null)?.blur?.();
  lastT = 0;
}

// ---------------------------------------------------------------- update
function update(rdt: number) {
  const ph = phase.value;
  // ambient: stars always twinkle
  twT += rdt;

  if (ph === "count") {
    phaseT += rdt;
    const n = Math.ceil(3 - phaseT + 0.0001);
    if (phaseT < 3) {
      if (n !== countNum) { countNum = n; countLabel.value = String(n); S("countdown"); }
    } else if (phaseT < 3.7) {
      if (countNum !== 0) { countNum = 0; countLabel.value = "GO!"; S("go"); }
    } else {
      countLabel.value = "";
      phase.value = "play";
    }
  }

  if (ph !== "play" && ph !== "winanim" && ph !== "lose") {
    stepFx(rdt);
    return;
  }
  const dt = rdt * timeScale;

  if (ph === "play") {
    t += dt;
    const w = waveOf();
    if (w !== waveShown) {
      waveShown = w;
      waveNo.value = w + 1;
      if (t > 1) { floater(W / 2, topY(), `WAVE ${w + 1}`, "#ffffff", 20, 1.5); S("alarm"); }
    }
    secsLeft.value = Math.max(0, Math.ceil(DUR - t));
    if (barEl.value) barEl.value.style.transform = `scaleX(${clamp(1 - t / DUR, 0, 1)})`;
    spawnT -= dt;
    if (spawnT <= 0 && DUR - t > 1.2) {
      if (threats.length < maxAlive()) spawnThreat();
      spawnT = spawnInterval();
    }
    cellT -= dt;
    if (cellT <= 0 && DUR - t > 5 && cellsSpawned < 3) {
      spawnCell();
      cellT = rnd(9, 12);
    }
    if (t >= DUR) beginWin();
  } else if (ph === "winanim") {
    winT += dt;
    twT += 0;
    if (threats.length && winT > 0.25) {
      if (Math.floor(winT * 9) !== Math.floor((winT - dt) * 9)) {
        const th = threats[0];
        killThreat(th, false);
        points.value += 5;
      }
    }
    if (!threats.length && winT > 1.5) finishRound();
    if (winT > 1.3 && Math.random() < dt * 8) {
      // celebratory sparkles over the dome
      const x = domeX + rnd(-W * 0.3, W * 0.3), y = rnd(H * 0.2, H * 0.5);
      explode(x, y, 22 * u, "gold");
    }
    if (winT > 4) finishRound();
  } else if (ph === "lose") {
    loseT += rdt;
    if (loseT > 1.6) { timeScale = 1; finishRound(); }
  }

  // threats
  for (let i = threats.length - 1; i >= 0; i--) {
    const th = threats[i];
    th.x += th.vx * dt;
    th.y += th.vy * dt;
    th.rot += th.vr * dt;
    th.hitFlash = Math.max(0, th.hitFlash - dt * 4);
    th.fresh = Math.max(0, th.fresh - dt);
    th.spark -= dt;
    if (th.spark <= 0 && th.y > -th.r) {
      th.spark = th.kind === "comet" ? 0.025 : 0.05;
      const sp = Math.hypot(th.vx, th.vy) || 1;
      addPart({
        x: th.x - (th.vx / sp) * th.r * 0.6 + rnd(-3, 3), y: th.y - (th.vy / sp) * th.r * 0.6 + rnd(-3, 3),
        vx: rnd(-18, 18) - th.vx * 0.05, vy: rnd(-18, 18) - th.vy * 0.05, life: rnd(0.25, 0.55), size: th.r * rnd(0.12, 0.28),
        color: th.kind === "comet" ? C_CYAN : th.kind === "debris" ? "rgba(200,210,230,1)" : C_ORANGE, drag: 1.5,
      });
    }
    if (ph === "lose" && th.y > groundY) { threats.splice(i, 1); continue; }
    const dd = Math.hypot(th.x - domeX, th.y - groundY);
    if (th.y > 0 && th.y < groundY + 6 && dd < R + th.r * 0.45 && ph !== "lose") {
      domeHit(th);
      continue;
    }
    if (th.y + th.r * 0.3 >= groundY + 6) groundHit(th);
    else if (th.x < -th.r * 4 || th.x > W + th.r * 4) threats.splice(i, 1);
  }
  // cells
  for (let i = cells.length - 1; i >= 0; i--) {
    const ce = cells[i];
    ce.life += dt;
    ce.y += ce.vy * dt;
    ce.x += Math.cos(ce.life * 1.3 + ce.ph) * ce.sway * dt;
    if (ce.y > groundY - 10 * u) {
      glow(ce.x, groundY, 0, C_GOLD, 0);
      floater(ce.x, groundY - 20, "missed", "#cfd6e6", 14, 0.7);
      cells.splice(i, 1);
    }
  }
  if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
  stepFx(rdt);
}

function stepFx(rdt: number) {
  const dt = rdt * (phase.value === "lose" ? timeScale : 1);
  shake *= Math.pow(0.0008, rdt);
  if (shake < 0.05) shake = 0;
  flash = Math.max(0, flash - rdt * 2.2);
  whiteFlash = Math.max(0, whiteFlash - rdt * 2.5);
  hurtT = Math.max(0, hurtT - rdt);
  recoil = Math.max(0, recoil - rdt * 7);
  muzzle = Math.max(0, muzzle - rdt * 9);
  comboBanner.t = Math.max(0, comboBanner.t - rdt);
  // turret aim easing
  let da = aimTarget - aim;
  aim += da * Math.min(1, rdt * 22);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    const k = Math.exp(-p.drag * dt);
    p.vx *= k;
    p.vy = p.vy * k + p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    if (p.chunk && p.y > groundY + 4) { p.y = groundY + 4; p.vy *= -0.3; p.vx *= 0.6; p.vr *= 0.5; }
  }
  for (let i = rings.length - 1; i >= 0; i--) { rings[i].life -= dt; if (rings[i].life <= 0) rings.splice(i, 1); }
  for (let i = floaters.length - 1; i >= 0; i--) { const f = floaters[i]; f.life -= rdt; f.y -= 34 * u * rdt; if (f.life <= 0) floaters.splice(i, 1); }
  for (let i = beams.length - 1; i >= 0; i--) { beams[i].life -= rdt; if (beams[i].life <= 0) beams.splice(i, 1); }
  for (let i = pings.length - 1; i >= 0; i--) { pings[i].t += rdt; if (pings[i].t > 0.35) pings.splice(i, 1); }
}

// ---------------------------------------------------------------- drawing
function drawStars() {
  if (!ctx) return;
  const px = (ptrX - 0.5);
  for (const s of stars3) {
    const par = [4, 10, 20][s.l];
    let x = (s.x * W + px * -par + twT * (1 + s.l * 1.6)) % W;
    if (x < 0) x += W;
    const y = s.y * H + (twT * (0.6 + s.l)) % 1;
    const a = 0.45 + 0.55 * Math.abs(Math.sin(twT * (0.8 + s.l * 0.4) + s.tw));
    ctx.globalAlpha = a * (s.l === 0 ? 0.6 : 1);
    ctx.fillStyle = s.l === 2 ? "#fff6d8" : "#dbeaff";
    ctx.beginPath();
    ctx.arc(x, y, s.s, 0, 6.283);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function rockPath(th: Threat) {
  if (!ctx) return;
  const n = th.pts.length;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283;
    const rr = th.r * th.pts[i];
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function drawTrail(th: Threat) {
  if (!ctx) return;
  const sp = Math.hypot(th.vx, th.vy) || 1;
  const ux = th.vx / sp, uy = th.vy / sp;
  const len = clamp(sp * (th.kind === "comet" ? 0.42 : 0.26), th.r * 2.6, th.kind === "comet" ? 260 : 170);
  const w = th.r * (th.kind === "comet" ? 0.85 : 0.95);
  const hx = th.x - ux * th.r * 0.3, hy = th.y - uy * th.r * 0.3;
  const tx = th.x - ux * len, ty = th.y - uy * len;
  const nx = -uy, ny = ux;
  const g = ctx.createLinearGradient(hx, hy, tx, ty);
  if (th.kind === "comet") {
    g.addColorStop(0, "rgba(220,250,255,0.95)");
    g.addColorStop(0.3, "rgba(90,210,255,0.55)");
    g.addColorStop(1, "rgba(90,210,255,0)");
  } else if (th.kind === "debris") {
    g.addColorStop(0, "rgba(200,215,240,0.45)");
    g.addColorStop(1, "rgba(200,215,240,0)");
  } else {
    g.addColorStop(0, "rgba(255,230,140,0.95)");
    g.addColorStop(0.3, "rgba(255,130,40,0.6)");
    g.addColorStop(1, "rgba(255,60,20,0)");
  }
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(hx + nx * w, hy + ny * w);
  ctx.lineTo(tx, ty);
  ctx.lineTo(hx - nx * w, hy - ny * w);
  ctx.closePath();
  ctx.fill();
  if (th.kind === "comet") {
    // second, thinner dust tail, slightly bent
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(hx + nx * w * 0.5, hy + ny * w * 0.5);
    ctx.quadraticCurveTo(tx * 0.5 + hx * 0.5 + nx * w * 2.2, ty * 0.5 + hy * 0.5 + ny * w * 2.2, th.x - ux * len * 0.8 + nx * w * 1.2, th.y - uy * len * 0.8 + ny * w * 1.2);
    ctx.lineTo(hx - nx * w * 0.5, hy - ny * w * 0.5);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawThreat(th: Threat) {
  if (!ctx) return;
  const danger = th.y > groundY - H * 0.22 && Math.hypot(th.x - domeX, 1) < R * 1.8;
  drawTrail(th);
  ctx.globalCompositeOperation = "lighter";
  const hot = th.kind === "comet" ? C_CYAN : th.kind === "debris" ? "rgba(200,220,255,1)" : th.kind === "big" ? "rgba(255,110,50,1)" : C_ORANGE;
  glow(th.x, th.y, th.r * 2.5, hot, 0.8 + th.hitFlash * 0.2);
  ctx.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.translate(th.x, th.y);
  ctx.rotate(th.rot);
  if (th.kind === "comet") {
    const g = ctx.createRadialGradient(-th.r * 0.2, -th.r * 0.2, 1, 0, 0, th.r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.5, "#bff0ff");
    g.addColorStop(1, "#5cc9f5");
    ctx.fillStyle = g;
    rockPath(th);
    ctx.fill();
  } else if (th.kind === "debris") {
    const r = th.r;
    if (th.variant === 0) {
      // satellite panel with solar cells
      ctx.fillStyle = "#8d98b0";
      ctx.fillRect(-r * 1.15, -r * 0.62, r * 2.3, r * 1.24);
      ctx.fillStyle = "#2b5fb8";
      ctx.fillRect(-r * 1.05, -r * 0.52, r * 2.1, r * 1.04);
      ctx.strokeStyle = "rgba(170,210,255,0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = -2; i <= 2; i++) { ctx.moveTo(i * r * 0.42, -r * 0.52); ctx.lineTo(i * r * 0.42, r * 0.52); }
      ctx.moveTo(-r * 1.05, 0); ctx.lineTo(r * 1.05, 0);
      ctx.stroke();
      ctx.fillStyle = "#c9d2e4";
      ctx.fillRect(-r * 0.12, -r * 0.8, r * 0.24, r * 1.6);
    } else {
      // big hex bolt
      ctx.fillStyle = "#b4bdd0";
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#6f7a92";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.45, 0, 6.283);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
    // blinking beacon + hp ring (not rotated)
    ctx.save();
    ctx.translate(th.x, th.y);
    if (Math.sin(twT * 9 + th.seed) > 0) glow(0, 0, 0, C_RED, 0);
    ctx.strokeStyle = th.hp > 1 ? "rgba(255,255,255,0.8)" : "rgba(255,120,120,0.9)";
    ctx.lineWidth = 2.5 * Math.min(1.4, u);
    if (th.maxhp > 1) {
      ctx.beginPath();
      ctx.arc(0, 0, th.r * 1.5, -Math.PI / 2, -Math.PI / 2 + 6.283 * (th.hp / th.maxhp));
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.translate(th.x, th.y);
  } else {
    const g = ctx.createRadialGradient(-th.r * 0.35, -th.r * 0.35, 1, 0, 0, th.r * 1.1);
    g.addColorStop(0, th.kind === "big" ? "#b09a8c" : "#a89c94");
    g.addColorStop(0.7, th.kind === "big" ? "#6d5a52" : "#6e6560");
    g.addColorStop(1, "#40383a");
    ctx.fillStyle = g;
    rockPath(th);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,170,90,0.55)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    for (let i = 0; i < 3; i++) {
      const a = th.seed + i * 2.1;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * th.r * 0.38, Math.sin(a) * th.r * 0.38, th.r * (0.12 + (i % 2) * 0.07), 0, 6.283);
      ctx.fill();
    }
    if (th.kind === "big") {
      ctx.strokeStyle = "rgba(255,200,120,0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-th.r * 0.5, -th.r * 0.1);
      ctx.lineTo(-th.r * 0.05, th.r * 0.1);
      ctx.lineTo(th.r * 0.2, -th.r * 0.2);
      ctx.lineTo(th.r * 0.55, th.r * 0.15);
      ctx.stroke();
    }
  }
  if (th.hitFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${th.hitFlash * 0.7})`;
    ctx.beginPath();
    ctx.arc(0, 0, th.r * 1.05, 0, 6.283);
    ctx.fill();
  }
  ctx.restore();
  if (danger && !reduce) {
    ctx.strokeStyle = `rgba(255,90,90,${0.35 + 0.3 * Math.sin(twT * 14)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(th.x, th.y, th.r * 1.55, 0, 6.283);
    ctx.stroke();
  }
}

function drawCell(ce: Cell) {
  if (!ctx) return;
  const s = 15 * u * (isCadet.value ? 1.2 : 1);
  ctx.globalCompositeOperation = "lighter";
  glow(ce.x, ce.y, s * 3.4 + Math.sin(ce.life * 6) * 3, C_GOLD, 0.9);
  ctx.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.translate(ce.x, ce.y);
  ctx.rotate(Math.sin(ce.life * 1.6 + ce.ph) * 0.25);
  // wings
  ctx.fillStyle = "#3b7de0";
  ctx.strokeStyle = "#cfe3ff";
  ctx.lineWidth = 1.5;
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.rect(sd > 0 ? s * 0.8 : -s * 2.1, -s * 0.7, s * 1.3, s * 1.4);
    ctx.fill();
    ctx.stroke();
  }
  // capsule
  const g = ctx.createLinearGradient(0, -s, 0, s);
  g.addColorStop(0, "#fff2a8");
  g.addColorStop(0.5, "#ffd23f");
  g.addColorStop(1, "#e8a010");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-s * 0.85, -s * 1.0, s * 1.7, s * 2.0, s * 0.7);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();
  // bolt
  ctx.fillStyle = "#8a5a00";
  ctx.beginPath();
  ctx.moveTo(s * 0.12, -s * 0.7);
  ctx.lineTo(-s * 0.4, s * 0.12);
  ctx.lineTo(-s * 0.02, s * 0.12);
  ctx.lineTo(-s * 0.14, s * 0.7);
  ctx.lineTo(s * 0.4, -s * 0.2);
  ctx.lineTo(s * 0.02, -s * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // hint ring
  ctx.strokeStyle = `rgba(255,226,120,${0.35 + 0.25 * Math.sin(ce.life * 5)})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 6]);
  ctx.beginPath();
  ctx.arc(ce.x, ce.y, s * 2.6, ce.life, ce.life + 6.283);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawDome() {
  if (!ctx) return;
  const cx = domeX, cy = groundY + 2;
  const low = hp.value / maxHp.value;
  // base plate
  ctx.fillStyle = "rgba(60,66,90,0.55)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 3, R * 1.22, R * 0.14, 0, 0, 6.283);
  ctx.fill();
  ctx.fillStyle = "#5d6482";
  ctx.beginPath();
  ctx.ellipse(cx, cy, R * 1.12, R * 0.11, 0, 0, 6.283);
  ctx.fill();
  // interior: habitat + greenhouse + antenna + tiny astronaut
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, Math.PI, 0);
  ctx.closePath();
  ctx.clip();
  const ig = ctx.createLinearGradient(0, cy - R, 0, cy);
  ig.addColorStop(0, "rgba(60,120,170,0.55)");
  ig.addColorStop(1, "rgba(150,230,230,0.5)");
  ctx.fillStyle = ig;
  ctx.fillRect(cx - R, cy - R, R * 2, R);
  ctx.fillStyle = "#e6eaf4";
  ctx.beginPath();
  ctx.roundRect(cx - R * 0.5, cy - R * 0.42, R * 0.55, R * 0.42, R * 0.08);
  ctx.fill();
  ctx.fillStyle = "#ffd98a";
  for (let i = 0; i < 3; i++) ctx.fillRect(cx - R * 0.42 + i * R * 0.16, cy - R * 0.3, R * 0.09, R * 0.1);
  ctx.fillStyle = "rgba(124,242,156,0.85)";
  ctx.beginPath();
  ctx.arc(cx + R * 0.35, cy, R * 0.3, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = "#cfd6e6";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.25, cy - R * 0.42);
  ctx.lineTo(cx - R * 0.25, cy - R * 0.68);
  ctx.stroke();
  ctx.fillStyle = Math.sin(twT * 4) > 0 ? "#ff6b6b" : "#7a3a3a";
  ctx.beginPath();
  ctx.arc(cx - R * 0.25, cy - R * 0.7, 2.2 * u, 0, 6.283);
  ctx.fill();
  // astronaut (Tobish)
  const ax = cx + Math.sin(twT * 0.5) * R * 0.5 - R * 0.1;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(ax - 3.5 * u, cy - 11 * u, 7 * u, 8 * u, 2 * u);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ax, cy - 14 * u, 4.2 * u, 0, 6.283);
  ctx.fill();
  ctx.fillStyle = "#2a5ec0";
  ctx.beginPath();
  ctx.ellipse(ax, cy - 14 * u, 2.7 * u, 2.1 * u, 0, 0, 6.283);
  ctx.fill();
  ctx.restore();
  // glass shell
  const gg = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.7, R * 0.1, cx, cy, R);
  gg.addColorStop(0, "rgba(255,255,255,0.35)");
  gg.addColorStop(0.7, "rgba(140,210,255,0.1)");
  gg.addColorStop(1, low < 0.5 ? "rgba(255,120,110,0.4)" : "rgba(120,210,255,0.4)");
  ctx.fillStyle = gg;
  ctx.beginPath();
  ctx.arc(cx, cy, R, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = `rgba(${low < 0.5 ? "255,170,160" : "200,238,255"},0.9)`;
  ctx.lineWidth = 3 * Math.min(1.3, u);
  ctx.beginPath();
  ctx.arc(cx, cy, R, Math.PI, 0);
  ctx.stroke();
  // struts
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, R * (i / 4) * 1, R, 0, Math.PI, 0);
    ctx.stroke();
  }
  // cracks
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 2;
  for (const cr of cracks) {
    ctx.beginPath();
    cr.forEach((p, i) => (i ? ctx.lineTo(cx + p.x, cy + p.y) : ctx.moveTo(cx + p.x, cy + p.y)));
    ctx.stroke();
  }
  // shield flash
  if (hurtT > 0 || whiteFlash > 0) {
    const a = Math.max(hurtT * 1.6, whiteFlash);
    ctx.fillStyle = hurtT > 0 ? `rgba(255,110,110,${a * 0.5})` : `rgba(160,255,190,${a * 0.6})`;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.04, Math.PI, 0);
    ctx.fill();
  }
  // turret
  const tp = turretPos();
  ctx.fillStyle = "#8e97b0";
  ctx.beginPath();
  ctx.roundRect(tp.x - 9 * u, tp.y + 2 * u, 18 * u, 11 * u, 4 * u);
  ctx.fill();
  ctx.save();
  ctx.translate(tp.x, tp.y);
  ctx.rotate(aim);
  const len = (26 - recoil * 6) * u;
  ctx.fillStyle = "#d5dbea";
  ctx.beginPath();
  ctx.roundRect(0, -4 * u, len, 8 * u, 3 * u);
  ctx.fill();
  ctx.fillStyle = "#6a7390";
  ctx.fillRect(len - 5 * u, -4.5 * u, 5 * u, 9 * u);
  ctx.restore();
  ctx.fillStyle = "#f0f3fa";
  ctx.beginPath();
  ctx.arc(tp.x, tp.y, 8 * u, 0, 6.283);
  ctx.fill();
  ctx.fillStyle = C_CYAN.replace("1)", "1)");
  ctx.fillStyle = "#4fd1ff";
  ctx.beginPath();
  ctx.arc(tp.x, tp.y, 3.6 * u, 0, 6.283);
  ctx.fill();
  if (muzzle > 0) {
    ctx.globalCompositeOperation = "lighter";
    glow(tp.x + Math.cos(aim) * len, tp.y + Math.sin(aim) * len, 26 * u * muzzle + 6, C_CYAN, muzzle);
    ctx.globalCompositeOperation = "source-over";
  }
}

function drawCraters() {
  if (!ctx) return;
  for (const c of craters) {
    const x = c.x * W, y = groundY + 8 + c.d * (gh - 16), r = c.r * u;
    ctx.fillStyle = "rgba(70,76,100,0.5)";
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.3, 0, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = "rgba(40,44,64,0.45)";
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.04, r * 0.7, r * 0.2, 0, 0, 6.283);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x, y - 1, r, r * 0.3, 0, Math.PI * 1.02, Math.PI * 1.98);
    ctx.stroke();
  }
}

function draw() {
  const c = ctx;
  if (!c) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = "source-over";
  let sx = 0, sy = 0;
  if (shake > 0) { sx = rnd(-1, 1) * shake; sy = rnd(-1, 1) * shake; }
  c.save();
  c.translate(sx, sy);
  if (skyC) c.drawImage(skyC, -MARGIN, -MARGIN, W + MARGIN * 2, H + MARGIN * 2);
  drawStars();
  if (fgC) c.drawImage(fgC, -MARGIN, -MARGIN, W + MARGIN * 2, H + MARGIN * 2);
  drawCraters();
  for (const ce of cells) drawCell(ce);
  for (const th of threats) drawThreat(th);
  drawDome();

  // keyboard reticle
  if (kbMode && phase.value === "play") {
    const tg = nearestTarget();
    if (tg) {
      const r = (tg.th ? tg.th.r : 26 * u) * 1.7 + 6;
      c.save();
      c.translate(tg.x, tg.y);
      c.rotate(twT * 1.4);
      c.strokeStyle = "rgba(124,242,156,0.95)";
      c.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        c.rotate(Math.PI / 2);
        c.beginPath();
        c.arc(0, 0, r, -0.35, 0.35);
        c.stroke();
      }
      c.restore();
    }
  }

  // lasers
  c.globalCompositeOperation = "lighter";
  for (const b of beams) {
    const k = b.life / 0.14;
    const w = (10 + 6 * k) * Math.min(1.2, u);
    c.lineCap = "round";
    c.strokeStyle = `rgba(80,210,255,${0.35 * k})`;
    c.lineWidth = w;
    c.beginPath(); c.moveTo(b.x1, b.y1); c.lineTo(b.x2, b.y2); c.stroke();
    c.strokeStyle = `rgba(190,245,255,${0.9 * k})`;
    c.lineWidth = w * 0.4;
    c.beginPath(); c.moveTo(b.x1, b.y1); c.lineTo(b.x2, b.y2); c.stroke();
    c.strokeStyle = `rgba(255,255,255,${k})`;
    c.lineWidth = w * 0.15;
    c.beginPath(); c.moveTo(b.x1, b.y1); c.lineTo(b.x2, b.y2); c.stroke();
    glow(b.x2, b.y2, 22 * u * k + 6, C_CYAN, k);
  }
  // particles
  for (const p of parts) {
    if (p.add) {
      const k = p.life / p.max;
      glow(p.x, p.y, p.size * (0.6 + k) * 2.2, p.color, Math.min(1, k * 1.4));
    }
  }
  c.globalCompositeOperation = "source-over";
  for (const p of parts) {
    if (!p.chunk) continue;
    c.globalAlpha = Math.min(1, (p.life / p.max) * 2);
    c.fillStyle = p.color;
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.rot);
    c.fillRect(-p.size, -p.size * 0.6, p.size * 2, p.size * 1.2);
    c.restore();
  }
  for (const p of parts) {
    if (p.add || p.chunk) continue;
    c.globalAlpha = (p.life / p.max) * 0.7;
    c.fillStyle = p.color;
    c.beginPath();
    c.arc(p.x, p.y, p.size * (1.4 - p.life / p.max * 0.4), 0, 6.283);
    c.fill();
  }
  c.globalAlpha = 1;
  // shockwave rings
  c.globalCompositeOperation = "lighter";
  for (const r of rings) {
    const k = 1 - r.life / r.dur;
    const e = 1 - Math.pow(1 - k, 3);
    c.strokeStyle = r.color.replace("1)", `${(1 - k) * 0.9})`);
    c.lineWidth = r.w * (1 - k) + 0.5;
    c.beginPath();
    c.arc(r.x, r.y, r.r + (r.max - r.r) * e, 0, 6.283);
    c.stroke();
  }
  c.globalCompositeOperation = "source-over";
  // tap pings
  for (const p of pings) {
    const k = p.t / 0.35;
    c.strokeStyle = `rgba(255,255,255,${0.7 * (1 - k)})`;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(p.x, p.y, 8 * u + k * 18 * u, 0, 6.283);
    c.stroke();
  }
  c.restore();

  // floaters + combo banner (screen space)
  c.textAlign = "center";
  c.textBaseline = "middle";
  for (const f of floaters) {
    const k = f.life / f.dur;
    const pop = 1 + Math.max(0, (k - 0.8) * 3);
    c.globalAlpha = Math.min(1, k * 2.2);
    c.font = `700 ${f.size * pop}px Fredoka, sans-serif`;
    c.lineWidth = 5;
    c.strokeStyle = "rgba(8,18,40,0.8)";
    c.lineJoin = "round";
    c.strokeText(f.text, f.x, f.y);
    c.fillStyle = f.color;
    c.fillText(f.text, f.x, f.y);
  }
  c.globalAlpha = 1;
  if (comboBanner.t > 0 && phase.value === "play") {
    const k = comboBanner.t / 1.3;
    const pop = 1 + Math.max(0, k - 0.85) * 3.2;
    const size = clamp(W * 0.055, 18, 30) * pop;
    c.globalAlpha = Math.min(1, comboBanner.t * 3);
    c.font = `700 ${size}px Fredoka, sans-serif`;
    c.lineWidth = 8;
    c.strokeStyle = "rgba(8,18,40,0.85)";
    const y = topY() + (1 - k) * -6;
    c.strokeText(comboBanner.text, W / 2, y);
    const g = c.createLinearGradient(0, y - size / 2, 0, y + size / 2);
    g.addColorStop(0, "#fff6b0");
    g.addColorStop(1, "#ffb020");
    c.fillStyle = g;
    c.fillText(comboBanner.text, W / 2, y);
    c.globalAlpha = 1;
  }
  // combo timer pip
  if (combo >= 2 && comboT > 0 && phase.value === "play") {
    c.fillStyle = "rgba(255,255,255,0.25)";
    const bw = Math.min(160, W * 0.4);
    c.fillRect(W / 2 - bw / 2, topY() + 20, bw, 5);
    c.fillStyle = "#ffd23f";
    c.fillRect(W / 2 - bw / 2, topY() + 20, bw * (comboT / 2.3), 5);
  }
  // hit vignette / flash
  if (flash > 0) {
    const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, "rgba(255,60,60,0)");
    g.addColorStop(1, `rgba(255,50,50,${flash * (reduce ? 0.25 : 0.55)})`);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }
  if (hp.value === 1 && phase.value === "play") {
    const a = 0.12 + 0.08 * Math.sin(twT * 6);
    const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.8);
    g.addColorStop(0, "rgba(255,50,50,0)");
    g.addColorStop(1, `rgba(255,50,50,${reduce ? 0.1 : a})`);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }
}

// ---------------------------------------------------------------- loop & input
function frame(ts: number) {
  raf = requestAnimationFrame(frame);
  if (!lastT) lastT = ts;
  const rdt = Math.min(0.05, (ts - lastT) / 1000);
  lastT = ts;
  now = ts / 1000;
  if (!paused.value) update(rdt);
  draw();
}

function onPointer(e: PointerEvent) {
  const c = cv.value;
  if (!c) return;
  const r = c.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  ptrX = clamp(x / W, 0, 1);
  kbMode = false;
  if (paused.value) return;
  e.preventDefault();
  pointerShoot(x, y);
}
function onMove(e: PointerEvent) {
  const c = cv.value;
  if (!c) return;
  ptrX = clamp((e.clientX - c.getBoundingClientRect().left) / W, 0, 1);
}
function onKey(e: KeyboardEvent) {
  if (phase.value === "play") {
    if (e.code === "Space" || e.key === "Enter") {
      e.preventDefault();
      if (paused.value) return;
      kbMode = true;
      keyShoot();
    } else if (e.key === "Escape" || e.key === "p" || e.key === "P") {
      e.preventDefault();
      togglePause();
    }
  }
}
function onVis() {
  if (document.hidden) {
    if (phase.value === "play") paused.value = true;
    lastT = 0;
  } else lastT = 0;
}

onMounted(() => {
  reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  maxHp.value = startHp();
  hp.value = maxHp.value;
  layout();
  ro = new ResizeObserver(() => layout());
  if (root.value) ro.observe(root.value);
  window.addEventListener("keydown", onKey);
  document.addEventListener("visibilitychange", onVis);
  raf = requestAnimationFrame(frame);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  ro?.disconnect();
  window.removeEventListener("keydown", onKey);
  document.removeEventListener("visibilitychange", onVis);
  gsap.killTweensOf(shownScore);
  glowCache.clear();
  skyC = fgC = null;
  ctx = null;
});

const timeText = computed(() => `${Math.floor(secsLeft.value / 60)}:${String(secsLeft.value % 60).padStart(2, "0")}`);
const fact = computed(() => FACTS[res.value.fact]);
const moreOpen = ref(false);
const otherFacts = (i: number) => FACTS.filter((_, k) => k !== i);
</script>

<template>
  <div ref="root" class="mgm" :class="{ 'mgm--play': phase === 'play' || phase === 'count' }">
    <canvas
      ref="cv"
      class="mgm__cv"
      aria-label="Meteor Defense game field"
      @pointerdown="onPointer"
      @pointermove="onMove"
    />

    <!-- HUD -->
    <div v-if="phase === 'play' || phase === 'count' || phase === 'winanim' || phase === 'lose'" class="mgm__hud">
      <div class="mgm__row">
        <div class="mgm__hearts" :aria-label="`Dome health ${hp} of ${maxHp}`">
          <svg
            v-for="i in maxHp"
            :key="i"
            class="mgm__heart"
            :class="{ 'mgm__heart--off': i > hp, 'mgm__heart--pop': hpPop === i - 1 }"
            viewBox="0 0 24 22"
          >
            <path d="M12 21s-9-6.2-9-12.2C3 5 5.6 3 8.2 3c1.6 0 3 .8 3.8 2.1C12.8 3.8 14.2 3 15.8 3 18.4 3 21 5 21 8.8 21 14.8 12 21 12 21z" />
          </svg>
        </div>
        <div class="mgm__pts"><b>{{ points }}</b> pts</div>
        <button class="mgm__pause" aria-label="Pause" @click.stop="togglePause()">
          <svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1.5" /><rect x="14" y="5" width="4" height="14" rx="1.5" /></svg>
        </button>
      </div>
      <div class="mgm__time">
        <div class="mgm__bar"><i ref="barEl" /></div>
        <span>WAVE {{ waveNo }}</span>
        <span>{{ timeText }}</span>
      </div>
    </div>

    <div v-if="phase === 'count' && countLabel" :key="countLabel" class="mgm__count">{{ countLabel }}</div>

    <!-- Intro -->
    <Sheet v-if="phase === 'intro'" tone="#ff9f43">
      <div class="mgi">
        <div class="mgi__badge">MINI-GAME</div>
        <h2>Meteor Defense</h2>
        <p class="mgi__goal">
          Zap the space rocks before they crack Tobish's dome. Survive {{ DUR }} seconds!
        </p>
        <p class="mgi__ctl1"><b>Tap</b> a rock to zap it &middot; <b>Space</b> / <b>Enter</b> shoots the closest</p>
        <div class="mgi__fact">
          <span class="mgi__fi">{{ FACTS[0].t }}</span>
          {{ FACTS[0].b }}
          <em>Source: {{ FACTS[0].s }}</em>
        </div>
        <button class="mgi__more" @click="moreOpen = !moreOpen">More facts {{ moreOpen ? "▴" : "▾" }}</button>
        <div v-if="moreOpen" class="mgi__facts">
          <div v-for="f in otherFacts(0)" :key="f.t" class="mgi__fact">
            <span class="mgi__fi">{{ f.t }}</span>{{ f.b }}<em>Source: {{ f.s }}</em>
          </div>
        </div>
        <div class="mgi__btn"><Btn big @click="startCountdown">Start!</Btn></div>
      </div>
    </Sheet>

    <!-- Pause -->
    <Sheet v-if="paused && phase === 'play'" tone="#4fd1ff">
      <div class="mgi mgi--c">
        <h2>Paused</h2>
        <p>Take a breath, cadet. The meteors will wait.</p>
        <div class="mgi__btn"><Btn big @click="togglePause(false)">Resume</Btn></div>
      </div>
    </Sheet>

    <!-- Result -->
    <Sheet v-if="phase === 'result'" :tone="res.won ? '#7cf29c' : '#ff6b6b'">
      <div class="mgi mgi--c mgr">
        <div class="mgr__head">
          <div class="mgr__stars" aria-hidden="true">
            <svg v-for="i in 3" :key="i" viewBox="0 0 24 24" :class="{ on: i <= stars }" :style="{ animationDelay: 0.2 + i * 0.18 + 's' }">
              <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" />
            </svg>
          </div>
          <h2>{{ res.won ? "Dome saved!" : "The dome took too many hits!" }}</h2>
        </div>
        <p class="mgr__sub">{{ res.won ? "Tobish is safe. Great shooting, cadet!" : res.why }}</p>
        <p v-if="!res.won" class="mgr__tobish">Tobish: "Good try! One more go and you'll nail it!"</p>
        <div class="mgr__row">
          <div class="mgr__score"><b>{{ shownScore }}</b><span>/100</span></div>
          <div class="mgr__grid">
            <div><b>{{ res.destroyed }}</b><span>zapped</span></div>
            <div><b>{{ res.acc }}%</b><span>aim</span></div>
            <div><b>x{{ res.combo }}</b><span>combo</span></div>
            <div><b>{{ res.hp }}/{{ maxHp }}</b><span>dome</span></div>
          </div>
        </div>
        <div class="mgi__fact">
          <span class="mgi__fi">{{ fact.t }}</span>
          {{ fact.b }}
          <em>Source: {{ fact.s }}</em>
        </div>
        <button class="mgi__more" @click="moreOpen = !moreOpen">More facts {{ moreOpen ? "▴" : "▾" }}</button>
        <div v-if="moreOpen" class="mgi__facts">
          <div v-for="f in otherFacts(res.fact)" :key="f.t" class="mgi__fact">
            <span class="mgi__fi">{{ f.t }}</span>{{ f.b }}<em>Source: {{ f.s }}</em>
          </div>
        </div>
        <div class="mgi__btn mgi__btn--row mgi__btn--sticky">
          <template v-if="res.won"><Btn big @click="cont">Continue</Btn></template>
          <template v-else>
            <Btn variant="ghost" @click="cont">Back to base</Btn>
            <Btn big variant="warn" @click="startCountdown">🔁 Try again</Btn>
          </template>
        </div>
      </div>
    </Sheet>
  </div>
</template>

<style scoped>
.mgm {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 100vh;
  height: 100dvh;
  height: 100svh;
  max-height: 100%;
  z-index: 60;
  overflow: hidden;
  background: #0a1a36;
  font-family: "Nunito", sans-serif;
  color: #fff;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: none;
}
.mgm__cv {
  position: absolute;
  inset: 0;
  display: block;
  touch-action: none;
  cursor: crosshair;
}
.mgm__hud {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  padding: calc(10px + env(safe-area-inset-top)) 14px 0;
  pointer-events: none;
  z-index: 2;
}
.mgm__row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.mgm__hearts {
  display: flex;
  gap: 4px;
  padding: 7px 11px;
  border-radius: 18px;
  background: rgba(12, 24, 48, 0.62);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.mgm__heart { width: 24px; height: 22px; fill: #ff5d7a; filter: drop-shadow(0 0 5px rgba(255, 93, 122, 0.6)); transition: transform 0.2s; }
.mgm__heart--off { fill: rgba(255, 255, 255, 0.16); filter: none; }
.mgm__heart--pop { animation: heal 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes heal { 0% { transform: scale(0.2); } 60% { transform: scale(1.6); } 100% { transform: scale(1); } }
.mgm__pts {
  margin-left: auto;
  font-family: "Fredoka", sans-serif;
  font-size: 15px;
  font-weight: 600;
  padding: 7px 14px;
  border-radius: 18px;
  background: rgba(12, 24, 48, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.75);
}
.mgm__pts b { color: #ffd23f; font-size: 19px; }
.mgm__pause {
  pointer-events: auto;
  width: 46px;
  height: 46px;
  border-radius: 16px;
  border: 0;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.16);
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.25);
  display: grid;
  place-items: center;
  touch-action: manipulation;
}
.mgm__pause:active { transform: translateY(2px); }
.mgm__pause svg { width: 22px; height: 22px; fill: #fff; }
.mgm__time {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  font-family: "Fredoka", sans-serif;
  font-weight: 600;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}
.mgm__bar {
  flex: 1;
  height: 9px;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.18);
  order: 0;
}
.mgm__bar i {
  display: block;
  height: 100%;
  width: 100%;
  transform-origin: left center;
  background: linear-gradient(90deg, #4fd1ff, #7cf29c);
  border-radius: 6px;
}
.mgm__count {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: "Fredoka", sans-serif;
  font-weight: 700;
  font-size: clamp(90px, 22vmin, 190px);
  color: #fff;
  text-shadow: 0 6px 0 rgba(0, 0, 0, 0.25), 0 0 40px rgba(79, 209, 255, 0.8);
  pointer-events: none;
  animation: cnt 0.75s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  z-index: 3;
}
@keyframes cnt { from { transform: scale(2.2); opacity: 0; } 30% { opacity: 1; } to { transform: scale(1); } }

.mgi { text-align: left; }
.mgi--c { text-align: center; }
.mgi__badge {
  display: inline-block;
  font-family: "Fredoka", sans-serif;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1.5px;
  padding: 3px 10px;
  border-radius: 10px;
  background: rgba(255, 159, 67, 0.2);
  color: #ffb36b;
  margin-bottom: 4px;
}
.mgi h2 { font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 30px; margin: 0 0 6px; line-height: 1.1; }
.mgi p { margin: 0 0 10px; color: rgba(255, 255, 255, 0.85); }
.mgi__ctl { list-style: none; margin: 0 0 10px; padding: 0; display: grid; gap: 6px; font-size: 14.5px; color: rgba(255, 255, 255, 0.8); }
.mgi__ctl li { padding: 8px 12px; border-radius: 14px; background: rgba(255, 255, 255, 0.07); }
.mgi__ctl b { color: #7ad7ff; margin-right: 6px; font-family: "Fredoka", sans-serif; }
.mgi__hearts { font-size: 13px; color: rgba(255, 255, 255, 0.6); margin-bottom: 10px; }
.mgi__fact {
  font-size: 13.5px;
  line-height: 1.45;
  padding: 11px 14px;
  border-radius: 16px;
  background: rgba(79, 209, 255, 0.1);
  border: 1px solid rgba(79, 209, 255, 0.28);
  color: rgba(255, 255, 255, 0.88);
  text-align: left;
}
.mgi__fi { display: block; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 15px; color: #7ad7ff; margin-bottom: 2px; }
.mgi__fact em { display: block; margin-top: 5px; font-style: normal; font-size: 12px; font-weight: 800; color: rgba(255, 255, 255, 0.55); }
.mgi__btn { display: flex; justify-content: center; margin-top: 16px; padding-bottom: 6px; }
.mgi__btn--row { gap: 12px; align-items: center; }
.mgi__btn--row :deep(.mbtn) { white-space: nowrap; }
@media (max-width: 640px) { .mgi__btn--row :deep(.mbtn--big) { padding-left: 24px; padding-right: 24px; font-size: 21px; } }
.mgi__more { display: block; margin: 6px auto 0; background: none; border: 0; color: #7ad7ff; font: 700 13px "Fredoka", sans-serif; padding: 8px 14px; cursor: pointer; touch-action: manipulation; }
.mgi__facts { display: grid; gap: 6px; margin-top: 4px; }
.mgi__btn--sticky { position: sticky; bottom: -4px; z-index: 2; margin-top: 8px; padding: 10px 0 4px; background: linear-gradient(180deg, rgba(12,24,48,0), rgba(12,24,48,0.92) 30%); }
.mgr__head { display: flex; flex-direction: column; align-items: center; }
.mgr__row { display: flex; align-items: center; gap: 10px; margin: 2px 0 10px; }
.mgr__row .mgr__score { margin: 0; flex: none; }
.mgr__row .mgr__grid { margin: 0; flex: 1; gap: 5px; }
.mgr__stars { display: flex; justify-content: center; gap: 6px; margin-bottom: 2px; }
.mgr__stars svg { width: 46px; height: 46px; fill: rgba(255, 255, 255, 0.16); animation: star 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.mgr__stars svg.on { fill: #ffd23f; filter: drop-shadow(0 0 8px rgba(255, 210, 63, 0.7)); }
.mgr__stars svg:nth-child(2) { transform: translateY(-8px); }
@keyframes star { from { opacity: 0; scale: 0.2; } }
.mgi__ctl1 { font-size: 14.5px; color: rgba(255,255,255,.8); padding: 8px 12px; border-radius: 14px; background: rgba(255,255,255,.07); }
.mgi__ctl1 b { color: #7ad7ff; font-family: "Fredoka", sans-serif; }
.mgr__tobish { font-size: 14px; color: #ffd98a; font-style: italic; }
.mgr__sub { font-size: 15px; }
.mgr__score { font-family: "Fredoka", sans-serif; margin: 2px 0 10px; }
.mgr__score b { font-size: 60px; line-height: 1; color: #fff; text-shadow: 0 0 24px rgba(79, 209, 255, 0.6); }
.mgr__score span { font-size: 18px; color: rgba(255, 255, 255, 0.6); margin-left: 6px; }
.mgr__grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
.mgr__grid div { padding: 8px 4px; border-radius: 14px; background: rgba(255, 255, 255, 0.08); display: grid; }
.mgr__grid b { font-family: "Fredoka", sans-serif; font-size: 19px; }
.mgr__grid span { font-size: 11.5px; color: rgba(255, 255, 255, 0.65); font-weight: 800; }
@media (max-width: 640px), (max-height: 700px) {
  .mgi h2 { font-size: 22px; margin-bottom: 4px; }
  .mgi p { margin-bottom: 6px; font-size: 14px; }
  .mgr__stars svg { width: 30px; height: 30px; }
  .mgr__stars svg:nth-child(2) { transform: none; }
  .mgr__score b { font-size: 40px; }
  .mgr__score span { font-size: 13px; margin-left: 2px; }
  .mgr__grid div { padding: 5px 2px; border-radius: 10px; }
  .mgr__grid b { font-size: 14px; }
  .mgr__grid span { font-size: 10.5px; }
  .mgi__fact { font-size: 12.5px; line-height: 1.38; padding: 9px 11px; }
  .mgi__fi { font-size: 13.5px; }
  .mgi__ctl1 { font-size: 13px; }
  .mgi__btn { margin-top: 8px; }
}
@media (max-width: 640px) {
  .mgm__hud { padding-left: 10px; padding-right: 10px; }
  .mgm__heart { width: 21px; height: 19px; }
}
@media (prefers-reduced-motion: reduce) {
  .mgm__count, .mgm__heart--pop, .mgr__stars svg { animation: none; }
}
</style>
