<script setup lang="ts">
// Signal Lock — aim the Moon dish at Earth, send data packets that take 1.28 s each way (speed of light),
// and time them so solar-flare noise bursts sweeping the link don't destroy them.
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import type { MiniGameProps, MiniGameResult } from "../../../moon/types";
import { sfx, music } from "../../../moon/sfx";
import Btn from "../ui/Btn.vue";
import Sheet from "../ui/Sheet.vue";

const props = defineProps<MiniGameProps>();
const emit = defineEmits<{ finish: [result: MiniGameResult] }>();

// ---------------------------------------------------------------- config
const SPEC = props.age === "specialist";
const DL = props.difficulty - 1;
const TIME = 35;
const D = 1.28; // one-way light time Moon -> Earth, seconds (384,400 km / 299,792 km/s)
const CFG = {
  target: (SPEC ? 5 : 3) + props.difficulty, // cadet 4/5/6, specialist 6/7/8
  zone: (SPEC ? 0.15 : 0.24) - 0.016 * DL, // lock half-width (aim units)
  drift: (SPEC ? 1.0 : 0.7) * (1 + 0.12 * DL),
  wobble: (SPEC ? 0.07 : 0.03) + 0.012 * DL,
  fill: SPEC ? 0.8 : 1.0, // lock meter per second while aligned
  decay: SPEC ? 0.9 : 0.7,
  nzGap: [(SPEC ? 5.5 : 9) - 0.7 * DL, (SPEC ? 7.5 : 12) - 0.7 * DL] as [number, number],
  nzSpeed: (SPEC ? 0.7 : 0.5) + 0.06 * DL, // arc fraction per second
  nzWidth: SPEC ? 0.18 : 0.13,
  nzWarn: SPEC ? 1.5 : 2.2,
  spawn: SPEC ? 1.9 : 2.4,
  prio: SPEC ? 0.28 : 0,
};
const KINDS = {
  plant: { e: "🌱", label: "Plants", color: "#7cf29c" },
  rad: { e: "☢️", label: "Radiation", color: "#ffd23f" },
  health: { e: "🧑‍🚀", label: "Health", color: "#ff6b9d" },
} as const;
type Kind = keyof typeof KINDS;

const FACTS = [
  { t: "Radio waves travel at the speed of light, 299,792 km/s. The Moon is 384,400 km away on average, so a message takes about 1.28 seconds to reach Earth, and about 2.6 seconds for the reply to come back.", s: "NASA" },
  { t: "From Mars a one-way message takes roughly 3 to 22 minutes, depending on where the two planets are in their orbits.", s: "NASA Mars communications" },
  { t: "NASA's Deep Space Network has giant dishes at Goldstone (California), Madrid (Spain) and Canberra (Australia). They are spread around the world so one is always facing a faraway spacecraft as Earth turns.", s: "NASA Deep Space Network" },
  { t: "Solar flares can cause radio blackouts and interference. NASA's DONKI database and NOAA's Space Weather Prediction Center track them.", s: "NASA DONKI, NOAA SWPC" },
];

// ---------------------------------------------------------------- reactive UI state
const phase = ref<"intro" | "count" | "play" | "result">("intro");
const count = ref(3);
const hudTime = ref(TIME);
const hudPoints = ref(0);
const hudStreak = ref(0);
const hudLock = ref(0);
const hudLocked = ref(false);
const linkedView = ref(false);
const banner = ref<{ text: string; tone: "info" | "warn" | "bad" | "good" }>({ text: "", tone: "info" });
const queueView = ref<{ id: number; kind: Kind; prio: boolean; frac: number }[]>([]);
const showMore = ref(false);
const probe = ref<HTMLDivElement | null>(null);
const bannerVisible = ref(true);
const result = ref({ won: false, score: 0, delivered: 0, lost: 0, best: 0, lockPct: 0, reason: "" });
const timeStr = computed(() => {
  const s = Math.max(0, Math.ceil(hudTime.value));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
});
const nasaPct = computed(() => Math.min(100, (hudPoints.value / CFG.target) * 100));

// ---------------------------------------------------------------- sim types/state
interface Pk { id: number; kind: Kind; prio: boolean; born: number }
interface Fl { id: number; kind: Kind; prio: boolean; ph: "out" | "ack"; t: number }
interface Nz { st: "warn" | "act"; t: number; dir: 1 | -1; c: number; w: number }
interface Pt { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
interface Tx { x: number; y: number; text: string; color: string; t: number; life: number; size: number }

const G = {
  clock: 0, left: TIME,
  a: -0.45, wob: 0, e: 0, d: 0,
  meter: 0, linked: false, locked: false, lockedTime: 0, linkedTime: 0,
  points: 0, delivered: 0, lost: 0, noiseLost: 0, failReason: "", streak: 0, best: 0,
  queue: [] as Pk[], flights: [] as Fl[], noises: [] as Nz[],
  nextSpawn: 0, nextNoise: 0, id: 1,
  parts: [] as Pt[], texts: [] as Tx[], ripples: [] as { t: number; x: number; y: number; color: string }[],
  shake: 0, noiseLevel: 0, earthFlash: 0, dishFlash: 0,
  ending: 0, over: false, syncT: 0, infoT: 0, bannerKey: "", toastT: 0, toastText: "", toastTone: "bad" as "info" | "warn" | "bad" | "good",
};

function resetGame() {
  Object.assign(G, {
    a: -0.45, meter: 0, noiseLost: 0, failReason: "", linked: false, locked: false, lockedTime: 0, linkedTime: 0,
    points: 0, delivered: 0, lost: 0, streak: 0, best: 0, left: TIME,
    queue: [], flights: [], noises: [], nextSpawn: 0, nextNoise: 0,
    parts: [], texts: [], ripples: [], shake: 0, noiseLevel: 0, earthFlash: 0, dishFlash: 0,
    ending: 0, over: false, syncT: 0, infoT: 0, bannerKey: "", toastT: 0, toastText: "",
  });
  syncHud(true);
}

// ---------------------------------------------------------------- refs / env
const wrap = ref<HTMLDivElement | null>(null);
const cv = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;
let raf = 0;
let last = 0;
let paused = false;
let reduced = false;
let ro: ResizeObserver | null = null;
let cdT = 3;
let finished = false;

const keys = { l: false, r: false };
const hold = { l: false, r: false };
let dragging = false;
let lastX = 0;

const L = {
  W: 800, H: 600, dpr: 1, u: 1,
  dish: { x: 0, y: 0 }, piv: { x: 0, y: 0 },
  earth: { x: 0, y: 0, r: 40 },
  P0: { x: 0, y: 0 }, P1: { x: 0, y: 0 }, P2: { x: 0, y: 0 },
  scope: { x: 0, y: 0, w: 200, h: 50 },
  gy: 0,
  stars: [] as { x: number; y: number; r: number; ph: number }[],
  baseAngle: 0,
};

function S(name: string) { try { (sfx as any)[name]?.(); } catch { /* audio missing: never block */ } }
function M(name: any) { try { music.play(name); } catch { /* ignore */ } }
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- layout
function layout() {
  const el = wrap.value, c = cv.value;
  if (!el || !c) return;
  const r = el.getBoundingClientRect();
  const W = Math.max(200, r.width), H = Math.max(200, r.height);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.round(W * dpr);
  c.height = Math.round(H * dpr);
  L.W = W; L.H = H; L.dpr = dpr;
  const m = Math.min(W, H);
  const u = (L.u = clamp(m / 520, 0.72, 1.5));
  const narrow = W < 560;
  let safeT = 0, safeB = 0;
  if (probe.value) {
    const cs = getComputedStyle(probe.value);
    safeT = parseFloat(cs.paddingTop) || 0; safeB = parseFloat(cs.paddingBottom) || 0;
  }
  const top = (narrow ? 124 : 108) + safeT;
  const bottom = H - (narrow ? 150 : 132) - safeB;
  const er = clamp(m * 0.11, 34, 80);
  L.earth = { x: W - er * 1.4, y: top + er + 8, r: er };
  const dx = Math.max(58 * u, W * 0.15);
  const dy = bottom - 8;
  L.dish = { x: dx, y: dy };
  L.piv = { x: dx, y: dy - 34 * u };
  L.gy = dy + 22 * u;
  L.P0 = { ...L.piv };
  L.P2 = { x: L.earth.x - er * 0.95, y: L.earth.y + er * 0.25 };
  // control point so the curve's true highest point sits just under the HUD/banner
  const mY = top + 8, aY = L.P0.y, bY = L.P2.y;
  L.P1 = { x: (L.P0.x + L.P2.x) / 2, y: mY - Math.sqrt(Math.max(0, (aY - mY) * (bY - mY))) };
  L.baseAngle = Math.atan2(L.earth.y - L.piv.y, L.earth.x - L.piv.x);
  const sw = clamp(W * 0.36, 130, 260), sh = 50 * u;
  L.scope = { x: clamp(W * 0.36, dx + 70 * u, W - sw - 10), y: dy - sh + 12 * u, w: sw, h: sh };
  const n = Math.round((W * H) / 7000);
  L.stars = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.9, r: rnd(0.5, 1.7), ph: Math.random() * 6.28 }));
}

function bez(u: number) {
  const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
  return { x: a * L.P0.x + b * L.P1.x + c * L.P2.x, y: a * L.P0.y + b * L.P1.y + c * L.P2.y };
}
function bezN(u: number) {
  const tx = 2 * (1 - u) * (L.P1.x - L.P0.x) + 2 * u * (L.P2.x - L.P1.x);
  const ty = 2 * (1 - u) * (L.P1.y - L.P0.y) + 2 * u * (L.P2.y - L.P1.y);
  const l = Math.hypot(tx, ty) || 1;
  return { x: -ty / l, y: tx / l };
}

// ---------------------------------------------------------------- effects
function burst(x: number, y: number, color: string, n: number, speed = 160) {
  if (reduced) n = Math.ceil(n * 0.4);
  for (let i = 0; i < n && G.parts.length < 320; i++) {
    const a = Math.random() * 6.283, s = rnd(0.3, 1) * speed;
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: rnd(0.4, 0.9), color, size: rnd(1.5, 3.5) * L.u });
  }
}
function floatText(x: number, y: number, text: string, color: string, size = 18) {
  G.texts.push({ x, y, text, color, t: 0, life: 1.1, size: size * L.u });
}
function toast(text: string, tone: "info" | "warn" | "bad" | "good" = "bad") {
  G.toastText = text; G.toastTone = tone; G.toastT = 2.5;
}
function shake(v: number) { if (!reduced) G.shake = Math.max(G.shake, v); }

// ---------------------------------------------------------------- game logic
function startCountdown() {
  S("unlock");
  M("minigame");
  resetGame();
  phase.value = "count";
  cdT = 3;
  count.value = 3;
  S("countdown");
}

function lose(f: Fl, why: string) {
  const p = bez(f.ph === "out" ? f.t / D : 1 - f.t / D);
  G.lost++;
  G.noiseLost++;
  G.streak = 0;
  burst(p.x, p.y, "#ff7a45", 26, 220);
  floatText(p.x, p.y - 18 * L.u, why, "#ff8a5c");
  S("static");
  shake(8);
}

function send(idx = 0) {
  if (phase.value !== "play" || G.over || G.ending > 0) return;
  if (!G.linked) { toast("Lock on first!"); return; }
  const pk = G.queue[idx];
  if (!pk) return;
  G.queue.splice(idx, 1);
  if (!(G.locked && G.meter >= 0.35)) {
    G.lost++;
    G.streak = 0;
    burst(L.piv.x, L.piv.y, "#ff9f43", 16, 150);
    toast("Off target! Lock on, then send.");
    S("wrong");
    syncHud(true);
    return;
  }
  G.flights.push({ id: pk.id, kind: pk.kind, prio: pk.prio, ph: "out", t: 0 });
  G.dishFlash = 1;
  burst(L.piv.x, L.piv.y, KINDS[pk.kind].color, 12, 130);
  S("laser");
  syncHud(true);
}

function step(dt: number) {
  G.clock += dt;
  const c = G.clock;

  // input + kinematics (always, so the dish is alive in the intro)
  const dir = (keys.r || hold.r ? 1 : 0) - (keys.l || hold.l ? 1 : 0);
  G.a = clamp(G.a + dir * 1.7 * dt, -1.6, 1.6);
  const sp = CFG.drift;
  G.e = 0.62 * Math.sin(c * 0.45 * sp) + 0.28 * Math.sin(c * 1.1 * sp + 1.3);
  G.wob = CFG.wobble * (Math.sin(c * 2.7) + 0.6 * Math.sin(c * 4.9 + 2));
  G.d = G.a + G.wob - G.e;
  G.locked = Math.abs(G.d) < CFG.zone;

  G.toastT = Math.max(0, G.toastT - dt);
  G.infoT = Math.max(0, G.infoT - dt);
  // cosmetic decay
  G.shake *= Math.pow(0.0008, dt);
  G.earthFlash = Math.max(0, G.earthFlash - dt * 2.2);
  G.dishFlash = Math.max(0, G.dishFlash - dt * 3);
  for (const p of G.parts) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; }
  G.parts = G.parts.filter((p) => p.life < p.max);
  for (const t of G.texts) { t.t += dt; t.y -= 26 * dt; }
  G.texts = G.texts.filter((t) => t.t < t.life);
  for (const r of G.ripples) r.t += dt;
  G.ripples = G.ripples.filter((r) => r.t < 1.2);

  if (phase.value === "count") {
    cdT -= dt;
    const n = Math.max(1, Math.ceil(cdT));
    if (cdT <= 0) { phase.value = "play"; S("go"); }
    else if (n !== count.value) { count.value = n; S("countdown"); }
    return;
  }
  if (phase.value !== "play") { G.noiseLevel *= 0.9; return; }

  // ---- play
  if (!G.over) G.left -= dt;
  G.meter = clamp(G.meter + (G.locked ? CFG.fill : -CFG.decay) * dt, 0, 1);
  if (!G.linked && G.meter >= 1) {
    G.linked = true;
    G.nextSpawn = c + 0.4;
    G.nextNoise = c + rnd(7.5, 8.5);
    S("powerUp");
    burst(L.piv.x, L.piv.y, "#4fd1ff", 30, 240);
    G.ripples.push({ t: 0, x: L.earth.x, y: L.earth.y, color: "#4fd1ff" });
    floatText(L.earth.x - 40 * L.u, L.earth.y + L.earth.r + 24 * L.u, "LINK ESTABLISHED", "#7cf29c", 20);
  }
  if (G.linked) { G.linkedTime += dt; if (G.locked) G.lockedTime += dt; }

  if (G.linked && G.ending === 0 && !G.over) {
    // packet spawn
    if (G.queue.length < 3 && c >= G.nextSpawn) {
      const kinds = Object.keys(KINDS) as Kind[];
      G.queue.push({ id: G.id++, kind: kinds[Math.floor(Math.random() * 3)], prio: Math.random() < CFG.prio, born: c });
      G.nextSpawn = c + CFG.spawn * rnd(0.85, 1.15);
      S("pop");
      syncHud(true);
    }
    // expire priority packets
    for (let i = G.queue.length - 1; i >= 0; i--) {
      const q = G.queue[i];
      if (q.prio && c - q.born > 7.5) {
        G.queue.splice(i, 1); G.lost++; G.streak = 0;
        toast("Priority packet expired!");
        S("wrong"); syncHud(true);
      }
    }
    // noise bursts
    if (!G.noises.length && c >= G.nextNoise) {
      const dirn: 1 | -1 = Math.random() < 0.6 ? 1 : -1;
      const w = CFG.nzWidth;
      G.noises.push({ st: "warn", t: 0, dir: dirn, c: dirn > 0 ? -w / 2 : 1 + w / 2, w });
      G.nextNoise = c + rnd(CFG.nzGap[0], CFG.nzGap[1]);
      S("alarm");
    }
  }

  // noise update
  let lvl = 0;
  for (const n of G.noises) {
    n.t += dt;
    if (n.st === "warn") {
      lvl = Math.max(lvl, 0.25);
      if (n.t >= CFG.nzWarn) { n.st = "act"; S("static"); shake(4); }
    } else {
      n.c += n.dir * CFG.nzSpeed * dt;
      lvl = 1;
    }
  }
  G.noises = G.noises.filter((n) => n.st === "warn" || (n.dir > 0 ? n.c - n.w / 2 <= 1 : n.c + n.w / 2 >= 0));
  G.noiseLevel += (lvl - G.noiseLevel) * Math.min(1, dt * 8);

  // flights
  const dead: Fl[] = [];
  for (const f of G.flights) {
    f.t += dt;
    const u = clamp(f.ph === "out" ? f.t / D : 1 - f.t / D, 0, 1);
    let hit = false;
    for (const n of G.noises) if (n.st === "act" && Math.abs(u - n.c) < n.w / 2) hit = true;
    if (hit) { lose(f, "Lost to noise!"); dead.push(f); continue; }
    if (f.t >= D) {
      if (f.ph === "out") {
        f.ph = "ack"; f.t = 0;
        G.earthFlash = 1;
        G.ripples.push({ t: 0, x: L.earth.x, y: L.earth.y, color: KINDS[f.kind].color });
        G.ripples.push({ t: -0.15, x: L.earth.x, y: L.earth.y, color: "#ffffff" });
        burst(L.P2.x, L.P2.y, "#ffffff", 14, 150);
        floatText(L.earth.x - L.earth.r, L.earth.y + L.earth.r + 18 * L.u, "NASA got it!", "#9fe3ff");
        S("beep");
      } else {
        dead.push(f);
        const val = f.prio ? 2 : 1;
        G.points += val; G.delivered++; G.streak++; G.best = Math.max(G.best, G.streak);
        burst(L.piv.x, L.piv.y, "#7cf29c", 22, 200);
        floatText(L.piv.x + 20 * L.u, L.piv.y - 56 * L.u, `+${val}  ACK`, "#7cf29c", 22);
        if (G.streak >= 3) floatText(L.piv.x + 20 * L.u, L.piv.y - 82 * L.u, `Streak x${G.streak}`, "#ffd23f", 16);
        S("correct");
        if (G.streak >= 3) S("coin");
        syncHud(true);
      }
    }
  }
  if (dead.length) G.flights = G.flights.filter((f) => !dead.includes(f));

  // end conditions
  if (G.ending > 0) {
    G.ending -= dt;
    if (G.ending <= 0) endGame(true);
  } else if (!G.over && G.points >= CFG.target) {
    G.ending = 1.0;
    G.over = true;
    S("win");
    burst(L.earth.x, L.earth.y, "#ffd23f", 50, 320);
    floatText(L.W / 2, L.H * 0.4, "ALL DATA SENT!", "#7cf29c", 30);
  } else if (!G.over && G.left <= 0) {
    G.left = 0;
    endGame(false);
  }

  G.syncT -= dt;
  if (G.syncT <= 0) { G.syncT = 0.12; syncHud(false); }
}

function syncHud(force: boolean) {
  hudTime.value = G.left;
  hudPoints.value = G.points;
  hudStreak.value = G.streak;
  hudLock.value = Math.round(G.meter * 100);
  hudLocked.value = G.locked;
  linkedView.value = G.linked;
  if (force || G.queue.length) {
    queueView.value = G.queue.map((q) => ({ id: q.id, kind: q.kind, prio: q.prio, frac: q.prio ? clamp(1 - (G.clock - q.born) / 7.5, 0, 1) : 1 }));
  }
  const nz = G.noises[0];
  const steer = G.d > 0 ? "steer left" : "steer right";
  let b: { text: string; tone: "info" | "warn" | "bad" | "good" };
  if (G.ending > 0) b = { text: "Mission complete!", tone: "good" };
  else if (!G.linked) b = { text: `Aim at Earth and hold the beam on it (${steer})`, tone: "info" };
  else if (nz && nz.st === "warn") b = { text: `Solar flare noise coming from the ${nz.dir > 0 ? "Moon" : "Earth"} side. Hold your packets!`, tone: "warn" };
  else if (nz) b = { text: "Noise is sweeping the link. Wait for it to pass.", tone: "bad" };
  else if (!G.locked) b = { text: `Lock lost! ${steer}`, tone: "bad" };
  else b = { text: "Send packets! Each trip takes 1.28 s", tone: "info" };
  if (G.bannerKey !== b.text) { G.bannerKey = b.text; G.infoT = 2.5; }
  if (G.toastT > 0) b = { text: G.toastText, tone: G.toastTone };
  const vis = G.toastT > 0 || !G.linked || b.tone === "warn" || b.tone === "bad" || G.infoT > 0;
  if (b.text !== banner.value.text || b.tone !== banner.value.tone) banner.value = b;
  if (vis !== bannerVisible.value) bannerVisible.value = vis;
}

function endGame(won: boolean) {
  if (finished || phase.value === "result") return;
  G.over = true;
  const total = G.delivered + G.lost;
  const ratio = total ? G.delivered / total : 0;
  const lockFrac = G.linkedTime > 0 ? G.lockedTime / G.linkedTime : 0;
  let score = ratio * 55 + lockFrac * 20 + Math.min(1, G.points / CFG.target) * 25;
  score = won ? Math.max(score, 55) : Math.min(score, 55);
  result.value = {
    won, score: Math.round(clamp(score, 0, 100)), delivered: G.delivered, lost: G.lost,
    best: G.best, lockPct: Math.round(lockFrac * 100),
  };
  G.failReason = won ? "" : !G.linked ? "Time ran out before the dish locked on!" : G.noiseLost >= 2 && G.noiseLost * 2 >= G.lost ? "Too many packets were lost in the solar noise!" : "Time ran out!";
  result.value.reason = G.failReason;
  clearKeys();
  phase.value = "result";
  if (!won) S("fail");
  syncHud(true);
}

function retry() {
  M("minigame");
  resetGame();
  phase.value = "count";
  cdT = 3;
  count.value = 3;
  S("countdown");
}

function done() {
  if (finished) return;
  finished = true;
  M("base");
  emit("finish", { won: result.value.won, score: result.value.score });
}

// ---------------------------------------------------------------- input
function onKey(e: KeyboardEvent, down: boolean) {
  const k = e.key;
  if (k === "ArrowLeft" || k === "a" || k === "A") { keys.l = down; if (phase.value !== "result") e.preventDefault(); }
  else if (k === "ArrowRight" || k === "d" || k === "D") { keys.r = down; if (phase.value !== "result") e.preventDefault(); }
  else if ((k === " " || k === "Enter" || k === "ArrowUp" || k === "w") && down && !e.repeat && phase.value === "play") {
    e.preventDefault();
    send(0);
  }
}
const kd = (e: KeyboardEvent) => onKey(e, true);
const ku = (e: KeyboardEvent) => onKey(e, false);
function clearKeys() { keys.l = keys.r = hold.l = hold.r = false; dragging = false; }
function onVis() {
  paused = document.hidden;
  last = performance.now();
  if (paused) clearKeys();
}
function onDown(e: PointerEvent) {
  dragging = true; lastX = e.clientX;
  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
}
function onMove(e: PointerEvent) {
  if (!dragging) return;
  const w = wrap.value?.clientWidth || 600;
  G.a = clamp(G.a + ((e.clientX - lastX) / w) * 3.0, -1.6, 1.6);
  lastX = e.clientX;
}
function onUp() { dragging = false; }
function holdDir(d: -1 | 0 | 1) { hold.l = d < 0; hold.r = d > 0; }

// ---------------------------------------------------------------- drawing
function draw() {
  const c = ctx;
  if (!c) return;
  const { W, H, dpr, u } = L;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const clock = G.clock;

  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b1b3a");
  bg.addColorStop(1, "#123a5c");
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);

  c.save();
  if (G.shake > 0.3) c.translate(rnd(-1, 1) * G.shake, rnd(-1, 1) * G.shake);

  c.globalCompositeOperation = "lighter";
  let g = c.createRadialGradient(W * 0.25, H * 0.3, 0, W * 0.25, H * 0.3, W * 0.5);
  g.addColorStop(0, "rgba(90,70,200,0.16)"); g.addColorStop(1, "rgba(90,70,200,0)");
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  g = c.createRadialGradient(W * 0.6, H * 0.7, 0, W * 0.6, H * 0.7, W * 0.5);
  g.addColorStop(0, "rgba(40,190,200,0.12)"); g.addColorStop(1, "rgba(40,190,200,0)");
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = "source-over";

  for (const s of L.stars) {
    c.globalAlpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(clock * 1.5 + s.ph));
    c.fillStyle = "#fff";
    c.beginPath(); c.arc(s.x, s.y, s.r, 0, 6.283); c.fill();
  }
  c.globalAlpha = 1;

  drawEarth(c, clock);
  drawGround(c);
  drawArc(c, clock);
  drawBeamAndDish(c, clock);
  drawFlights(c);
  drawScope(c, clock);

  for (const r of G.ripples) {
    if (r.t < 0) continue;
    const k = r.t / 1.1;
    c.strokeStyle = r.color; c.globalAlpha = Math.max(0, 1 - k) * 0.8; c.lineWidth = 3 * u * (1 - k) + 1;
    c.beginPath(); c.arc(r.x, r.y, L.earth.r * (1.05 + k * 1.3), 0, 6.283); c.stroke();
  }
  c.globalAlpha = 1;

  c.globalCompositeOperation = "lighter";
  for (const p of G.parts) {
    c.globalAlpha = 1 - p.life / p.max;
    c.fillStyle = p.color;
    c.beginPath(); c.arc(p.x, p.y, p.size, 0, 6.283); c.fill();
  }
  c.globalCompositeOperation = "source-over";
  c.globalAlpha = 1;

  c.textAlign = "center"; c.textBaseline = "middle"; c.lineJoin = "round";
  for (const t of G.texts) {
    const k = t.t / t.life;
    c.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    c.font = `700 ${t.size}px Fredoka, sans-serif`;
    c.lineWidth = 4; c.strokeStyle = "rgba(8,16,36,0.85)"; c.strokeText(t.text, t.x, t.y);
    c.fillStyle = t.color; c.fillText(t.text, t.x, t.y);
  }
  c.globalAlpha = 1;
  c.restore();

  if (G.noiseLevel > 0.5) {
    c.fillStyle = `rgba(255,90,50,${0.06 * G.noiseLevel * (0.6 + 0.4 * Math.sin(clock * 30))})`;
    c.fillRect(0, 0, W, H);
  }
}

function drawEarth(c: CanvasRenderingContext2D, clock: number) {
  const { x, y, r } = L.earth;
  let g = c.createRadialGradient(x, y, r * 0.9, x, y, r * (1.8 + G.earthFlash * 0.6));
  g.addColorStop(0, `rgba(120,200,255,${0.4 + G.earthFlash * 0.4})`); g.addColorStop(1, "rgba(120,200,255,0)");
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 2.4, 0, 6.283); c.fill();
  c.save();
  c.beginPath(); c.arc(x, y, r, 0, 6.283); c.clip();
  g = c.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, "#6fc6ff"); g.addColorStop(0.6, "#2a7fd0"); g.addColorStop(1, "#0f3f7c");
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  const off = ((clock * 4) % (r * 3.2)) - r * 1.6;
  c.fillStyle = "#58c77a";
  for (const [bx, by, bw, bh] of [[-0.3, -0.35, 0.7, 0.4], [0.35, 0.2, 0.5, 0.6], [-0.7, 0.35, 0.45, 0.3], [0.0, 0.65, 0.4, 0.2]] as number[][]) {
    for (const k of [0, -1, 1]) {
      c.beginPath();
      c.ellipse(x + bx * r + off + k * r * 3.2, y + by * r, bw * r, bh * r, 0.4, 0, 6.283);
      c.fill();
    }
  }
  c.fillStyle = "rgba(255,255,255,0.55)";
  for (const [bx, by, bw] of [[-0.2, -0.1, 0.5], [0.4, -0.55, 0.4], [-0.5, 0.5, 0.45]] as number[][]) {
    c.beginPath(); c.ellipse(x + bx * r - off * 0.5, y + by * r, bw * r, bw * r * 0.22, 0, 0, 6.283); c.fill();
  }
  g = c.createRadialGradient(x - r * 0.5, y - r * 0.5, r * 0.4, x + r * 0.3, y + r * 0.3, r * 1.3);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(5,10,30,0.55)");
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
  if (!G.linked && phase.value !== "result") {
    c.lineWidth = 5 * L.u; c.lineCap = "round";
    c.strokeStyle = "rgba(255,255,255,0.15)";
    c.beginPath(); c.arc(x, y, r + 10 * L.u, 0, 6.283); c.stroke();
    c.strokeStyle = G.locked ? "#7cf29c" : "#ffd23f";
    c.beginPath(); c.arc(x, y, r + 10 * L.u, -1.5708, -1.5708 + G.meter * 6.283); c.stroke();
    c.lineCap = "butt";
  }
}

function drawGround(c: CanvasRenderingContext2D) {
  const { W, H, gy, u } = L;
  const g = c.createLinearGradient(0, gy - 10 * u, 0, H);
  g.addColorStop(0, "#d9dbe4"); g.addColorStop(0.35, "#b8bccb"); g.addColorStop(1, "#8e93a8");
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(0, H); c.lineTo(0, gy + 10 * u);
  c.quadraticCurveTo(W * 0.3, gy - 10 * u, W * 0.6, gy + 6 * u);
  c.quadraticCurveTo(W * 0.85, gy + 18 * u, W, gy + 4 * u);
  c.lineTo(W, H); c.closePath(); c.fill();
  c.fillStyle = "rgba(100,105,135,0.28)";
  for (const [fx, fy, fw] of [[0.08, 0.4, 30], [0.36, 0.7, 40], [0.55, 0.5, 26], [0.74, 0.8, 46], [0.92, 0.45, 28]] as number[][]) {
    c.beginPath(); c.ellipse(W * fx, gy + (H - gy) * fy * 0.5 + 18 * u, fw * u, fw * u * 0.3, 0, 0, 6.283); c.fill();
  }
}

function drawArc(c: CanvasRenderingContext2D, clock: number) {
  const u = L.u;
  const N = 64;
  const amp = (2 + G.meter * 4) * u * (G.linked ? 1 : 0.4);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = bez(t), n = bezN(t);
    let o = Math.sin(t * 40 - clock * 9) * amp * Math.sin(t * Math.PI);
    for (const z of G.noises) if (z.st === "act" && Math.abs(t - z.c) < z.w / 2) o += rnd(-9, 9) * u;
    pts.push({ x: p.x + n.x * o, y: p.y + n.y * o });
  }
  const path = () => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); };
  c.lineJoin = "round"; c.lineCap = "round";
  c.globalCompositeOperation = "lighter";
  const base = G.linked ? 1 : 0.35;
  c.strokeStyle = `rgba(120,225,255,${0.14 * base})`; c.lineWidth = 12 * u; path(); c.stroke();
  c.strokeStyle = `rgba(120,225,255,${0.55 * base})`; c.lineWidth = 2.4 * u; path(); c.stroke();
  c.globalCompositeOperation = "source-over";

  for (const z of G.noises) {
    if (z.st === "warn") {
      const pulse = 0.5 + 0.5 * Math.sin(clock * 12);
      c.setLineDash([8 * u, 10 * u]); c.lineDashOffset = -clock * 50 * z.dir;
      c.strokeStyle = `rgba(255,150,60,${0.35 + 0.35 * pulse})`; c.lineWidth = 5 * u; path(); c.stroke();
      c.setLineDash([]);
      const o = bez(z.dir > 0 ? 0 : 1);
      const iy = o.y - (z.dir > 0 ? 70 * u : -L.earth.r * 1.35);
      c.fillStyle = `rgba(255,${(120 + 80 * pulse) | 0},50,0.95)`;
      c.beginPath(); c.arc(o.x, iy, 17 * u, 0, 6.283); c.fill();
      c.fillStyle = "#1a1030"; c.font = `700 ${20 * u}px Fredoka, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText("!", o.x, iy + 1);
      const k = clamp(z.t / CFG.nzWarn, 0, 1);
      c.strokeStyle = "#fff"; c.lineWidth = 3 * u;
      c.beginPath(); c.arc(o.x, iy, 22 * u, -1.5708, -1.5708 + k * 6.283); c.stroke();
    } else {
      const a = Math.max(0, z.c - z.w / 2), b = Math.min(1, z.c + z.w / 2);
      if (b <= a) continue;
      c.globalCompositeOperation = "lighter";
      for (let pass = 0; pass < 2; pass++) {
        c.strokeStyle = pass ? "rgba(255,230,170,0.9)" : "rgba(255,90,50,0.45)";
        c.lineWidth = (pass ? 2.5 : 14) * u;
        c.beginPath();
        for (let i = 0; i <= 14; i++) {
          const t = a + (b - a) * (i / 14);
          const p = bez(t), n = bezN(t), o = rnd(-10, 10) * u * (pass ? 1 : 0.5);
          i ? c.lineTo(p.x + n.x * o, p.y + n.y * o) : c.moveTo(p.x + n.x * o, p.y + n.y * o);
        }
        c.stroke();
      }
      c.globalCompositeOperation = "source-over";
      if (!reduced && Math.random() < 0.5) { const p = bez(clamp(z.c, 0, 1)); burst(p.x, p.y, "#ff9a5c", 1, 80); }
    }
  }
}

function drawBeamAndDish(c: CanvasRenderingContext2D, clock: number) {
  const { piv, u } = L;
  const ang = L.baseAngle + clamp(G.d, -2.4, 2.4) * 0.38;
  const len = Math.hypot(L.earth.x - piv.x, L.earth.y - piv.y) * 1.02;
  const hw = len * Math.tan(CFG.zone * 0.38);
  const ok = G.locked;
  c.save();
  c.translate(piv.x, piv.y); c.rotate(ang);
  c.globalCompositeOperation = "lighter";
  const g = c.createLinearGradient(0, 0, len, 0);
  const col = ok ? "79,209,255" : "255,120,100";
  g.addColorStop(0, `rgba(${col},${0.55 + G.dishFlash * 0.3})`); g.addColorStop(1, `rgba(${col},0.04)`);
  c.fillStyle = g;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(len, -hw); c.lineTo(len, hw); c.closePath(); c.fill();
  c.strokeStyle = `rgba(${col},0.5)`; c.lineWidth = 1.5; c.setLineDash([10, 18]); c.lineDashOffset = -clock * 90;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(len, 0); c.stroke(); c.setLineDash([]);
  c.globalCompositeOperation = "source-over";
  c.restore();

  const bx = L.dish.x, by = L.dish.y + 12 * u;
  c.strokeStyle = "#9aa0b8"; c.lineWidth = 5 * u; c.lineCap = "round";
  c.beginPath(); c.moveTo(piv.x, piv.y); c.lineTo(bx, by); c.moveTo(piv.x, piv.y + 8 * u); c.lineTo(bx - 22 * u, by + 6 * u); c.moveTo(piv.x, piv.y + 8 * u); c.lineTo(bx + 22 * u, by + 6 * u); c.stroke();
  c.fillStyle = "#6e738c"; c.beginPath(); c.ellipse(bx, by + 6 * u, 26 * u, 6 * u, 0, 0, 6.283); c.fill();

  c.save();
  c.translate(piv.x, piv.y); c.rotate(ang);
  const s = 26 * u;
  const bg = c.createLinearGradient(-s * 0.8, 0, 0, 0);
  bg.addColorStop(0, "#c9cfe2"); bg.addColorStop(1, "#f4f6ff");
  c.fillStyle = bg; c.strokeStyle = "#fff"; c.lineWidth = 3 * u;
  c.beginPath(); c.moveTo(0, -s); c.quadraticCurveTo(-s * 1.15, 0, 0, s); c.quadraticCurveTo(-s * 0.4, 0, 0, -s); c.fill(); c.stroke();
  c.strokeStyle = "#dfe3f3"; c.lineWidth = 2.5 * u;
  c.beginPath(); c.moveTo(-s * 0.25, 0); c.lineTo(s * 0.55, 0); c.stroke();
  c.fillStyle = ok ? "#4fd1ff" : "#ff7a6a";
  c.beginPath(); c.arc(s * 0.6, 0, 4.5 * u, 0, 6.283); c.fill();
  c.restore();
  c.fillStyle = "#fff"; c.beginPath(); c.arc(piv.x, piv.y, 5 * u, 0, 6.283); c.fill();
}

function drawEnvelope(c: CanvasRenderingContext2D, x: number, y: number, kind: Kind, prio: boolean, rot = 0) {
  const u = L.u, col = KINDS[kind].color;
  const g = c.createRadialGradient(x, y, 0, x, y, 30 * u);
  g.addColorStop(0, col + "aa"); g.addColorStop(1, col + "00");
  c.globalCompositeOperation = "lighter";
  c.fillStyle = g; c.beginPath(); c.arc(x, y, 30 * u, 0, 6.283); c.fill();
  c.globalCompositeOperation = "source-over";
  c.save(); c.translate(x, y); c.rotate(rot);
  const w = 30 * u, h = 21 * u;
  c.fillStyle = prio ? "#ffe9a3" : "#f4f8ff"; c.strokeStyle = prio ? "#ffd23f" : col; c.lineWidth = 2.2 * u;
  c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 5 * u); c.fill(); c.stroke();
  c.strokeStyle = "rgba(60,80,120,0.35)"; c.lineWidth = 1.5 * u;
  c.beginPath(); c.moveTo(-w / 2 + 1, -h / 2 + 1); c.lineTo(0, 1 * u); c.lineTo(w / 2 - 1, -h / 2 + 1); c.stroke();
  c.restore();
  c.font = `${14 * u}px sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText(KINDS[kind].e, x, y + 3 * u);
  if (prio) { c.font = `${11 * u}px sans-serif`; c.fillText("⭐", x + w / 2, y - h / 2); }
}

function drawFlights(c: CanvasRenderingContext2D) {
  const u = L.u;
  for (const f of G.flights) {
    const uu = clamp(f.ph === "out" ? f.t / D : 1 - f.t / D, 0, 1);
    const sgn = f.ph === "out" ? 1 : -1;
    const col = f.ph === "out" ? KINDS[f.kind].color : "#7cf29c";
    c.globalCompositeOperation = "lighter";
    c.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      const a = clamp(uu - sgn * 0.016 * i, 0, 1), b = clamp(uu - sgn * 0.016 * (i + 1), 0, 1);
      const p = bez(a), q = bez(b);
      c.strokeStyle = col; c.globalAlpha = (1 - i / 8) * 0.8; c.lineWidth = (7 - i * 0.6) * u;
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke();
    }
    c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
    const p = bez(uu);
    if (f.ph === "out") drawEnvelope(c, p.x, p.y, f.kind, f.prio, Math.sin(G.clock * 6 + f.id) * 0.12);
    else {
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 26 * u);
      g.addColorStop(0, "rgba(124,242,156,0.7)"); g.addColorStop(1, "rgba(124,242,156,0)");
      c.globalCompositeOperation = "lighter"; c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, 26 * u, 0, 6.283); c.fill();
      c.globalCompositeOperation = "source-over";
      c.fillStyle = "#2fcf6b"; c.strokeStyle = "#fff"; c.lineWidth = 2 * u;
      c.beginPath(); c.arc(p.x, p.y, 12 * u, 0, 6.283); c.fill(); c.stroke();
      c.fillStyle = "#fff"; c.font = `700 ${9 * u}px Fredoka, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText("ACK", p.x, p.y + 1);
    }
    const rem = Math.max(0, D - f.t);
    const label = `${f.ph === "ack" ? "ACK " : ""}${rem.toFixed(2)} s`;
    c.font = `700 ${12 * u}px Fredoka, sans-serif`;
    const tw = c.measureText(label).width + 12 * u;
    const ly = p.y - 30 * u < 8 ? p.y + 32 * u : p.y - 30 * u;
    c.fillStyle = "rgba(8,16,36,0.78)"; c.beginPath(); c.roundRect(p.x - tw / 2, ly - 10 * u, tw, 20 * u, 10 * u); c.fill();
    c.strokeStyle = col; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(label, p.x, ly + 0.5);
  }
}

function drawScope(c: CanvasRenderingContext2D, clock: number) {
  const { x, y, w, h } = L.scope, u = L.u;
  c.fillStyle = "rgba(8,16,36,0.78)"; c.strokeStyle = "rgba(255,255,255,0.18)"; c.lineWidth = 1.5;
  c.beginPath(); c.roundRect(x, y, w, h, 10 * u); c.fill(); c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.07)"; c.lineWidth = 1;
  c.beginPath();
  for (let i = 1; i < 6; i++) { c.moveTo(x + (w * i) / 6, y + 4); c.lineTo(x + (w * i) / 6, y + h - 4); }
  c.moveTo(x + 4, y + h / 2); c.lineTo(x + w - 4, y + h / 2); c.stroke();
  const noisy = G.noiseLevel > 0.5;
  const col = noisy ? "#ff8a5c" : G.locked ? "#7cf29c" : "#ffd23f";
  c.save();
  c.beginPath(); c.roundRect(x + 2, y + 2, w - 4, h - 4, 8 * u); c.clip();
  c.strokeStyle = col; c.lineWidth = 2; c.lineJoin = "round";
  c.globalCompositeOperation = "lighter";
  const A = h * 0.34 * (0.15 + 0.85 * G.meter);
  c.beginPath();
  for (let px = 0; px <= w; px += 2) {
    let v = Math.sin(px * 0.16 - clock * 9) * A;
    for (const f of G.flights) {
      const fx = (f.ph === "out" ? f.t / D : 1 - f.t / D) * w;
      const dd = Math.abs(px - fx);
      if (dd < 10) v -= (1 - dd / 10) * h * 0.3;
    }
    v += (Math.random() - 0.5) * h * 0.9 * G.noiseLevel;
    px ? c.lineTo(x + px, y + h / 2 + v) : c.moveTo(x, y + h / 2 + v);
  }
  c.stroke();
  c.globalCompositeOperation = "source-over";
  c.restore();
  c.fillStyle = "rgba(255,255,255,0.55)"; c.font = `700 ${9 * u}px Nunito, sans-serif`; c.textAlign = "left"; c.textBaseline = "top";
  c.fillText(noisy ? "SOLAR NOISE" : G.linked ? "SIGNAL" : "SEARCHING", x + 8, y + 5);
}

// ---------------------------------------------------------------- loop
function frame(now: number) {
  raf = requestAnimationFrame(frame);
  if (paused) { last = now; return; }
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (dt <= 0) return;
  step(dt);
  draw();
}

onMounted(() => {
  reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  ctx = cv.value?.getContext("2d") || null;
  layout();
  if (typeof ResizeObserver !== "undefined" && wrap.value) {
    ro = new ResizeObserver(() => layout());
    ro.observe(wrap.value);
  } else window.addEventListener("resize", layout);
  window.addEventListener("keydown", kd);
  window.addEventListener("keyup", ku);
  window.addEventListener("blur", clearKeys);
  document.addEventListener("visibilitychange", onVis);
  last = performance.now();
  raf = requestAnimationFrame(frame);
  syncHud(true);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  ro?.disconnect();
  window.removeEventListener("resize", layout);
  window.removeEventListener("keydown", kd);
  window.removeEventListener("keyup", ku);
  window.removeEventListener("blur", clearKeys);
  document.removeEventListener("visibilitychange", onVis);
});
</script>

<template>
  <div ref="wrap" class="sg">
    <div ref="probe" class="sg__probe" aria-hidden="true" />
    <canvas ref="cv" class="sg__cv" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" />

    <template v-if="phase === 'play' || phase === 'count'">
      <div class="sg__hud">
        <div class="sg__pill sg__time" :class="{ 'sg__time--low': hudTime <= 10 }">⏱ {{ timeStr }}</div>
        <div class="sg__nasa">
          <div class="sg__nasa-top"><span>Data sent to NASA</span><b>{{ hudPoints }}/{{ CFG.target }}</b></div>
          <div class="sg__bar"><i :style="{ width: nasaPct + '%' }" /></div>
        </div>
        <div class="sg__pill sg__streak" :class="{ 'sg__streak--on': hudStreak >= 2 }">🔥 ×{{ hudStreak }}</div>
        <div class="sg__lock">
          <span>Lock</span>
          <div class="sg__bar sg__bar--lock" :class="{ 'sg__bar--ok': hudLocked }"><i :style="{ width: hudLock + '%' }" /></div>
          <b>{{ hudLock }}%</b>
        </div>
      </div>
      <div v-show="bannerVisible" class="sg__banner" :class="`sg__banner--${banner.tone}`">{{ banner.text }}</div>

      <div class="sg__tray">
        <div class="sg__queue">
          <button
            v-for="(q, i) in queueView" :key="q.id" class="sg__chip" :class="{ 'sg__chip--prio': q.prio, 'sg__chip--first': i === 0 }"
            tabindex="-1" :style="{ '--c': KINDS[q.kind].color }" @mousedown.prevent @pointerdown.prevent="send(i)"
          >
            <span class="sg__chip-e">{{ KINDS[q.kind].e }}</span>
            <span class="sg__chip-l">{{ q.prio ? '⭐ ×2 ' : '' }}{{ KINDS[q.kind].label }}</span>
            <i v-if="q.prio" class="sg__chip-t" :style="{ width: q.frac * 100 + '%' }" />
          </button>
          <div v-if="!queueView.length" class="sg__empty">{{ linkedView ? 'Next packet coming…' : 'Packets start once the dish is locked' }}</div>
        </div>
        <div class="sg__ctrl">
          <button class="sg__arrow" tabindex="-1" aria-label="Steer left" @pointerdown.prevent="holdDir(-1)" @pointerup="holdDir(0)" @pointerleave="holdDir(0)" @pointercancel="holdDir(0)">◀</button>
          <button class="sg__send" tabindex="-1" :disabled="!queueView.length" @mousedown.prevent @pointerdown.prevent="send(0)">
            SEND <small>Space</small>
          </button>
          <button class="sg__arrow" tabindex="-1" aria-label="Steer right" @pointerdown.prevent="holdDir(1)" @pointerup="holdDir(0)" @pointerleave="holdDir(0)" @pointercancel="holdDir(0)">▶</button>
        </div>
      </div>
    </template>

    <div v-if="phase === 'count'" class="sg__count"><span :key="count">{{ count }}</span></div>

    <Sheet v-if="phase === 'intro'" tone="#4fd1ff">
      <div class="sg-card">
        <div class="sg-card__icon">📡</div>
        <h2 class="sg-card__h">Signal Lock</h2>
        <p class="sg-card__goal">Keep the dish on Earth and send <b>{{ CFG.target }}</b> data packets to NASA before the solar noise hits them!</p>
        <p class="sg-card__ctl1">Drag or ← → to aim · tap a packet or Space to send</p>
        <div class="sg-fact">
          <b>Real science</b>
          <p>{{ FACTS[0].t }}</p>
          <small>Source: {{ FACTS[0].s }}</small>
        </div>
        <div class="sg-card__btn sg-card__cta"><Btn big @click="startCountdown">Start</Btn></div>
      </div>
    </Sheet>

    <Sheet v-if="phase === 'result'" :tone="result.won ? '#7cf29c' : '#ff9f43'">
      <div class="sg-card sg-card--res">
        <div class="sg-card__icon sg-card__icon--sm">{{ result.won ? '🛰️' : '📡' }}</div>
        <h2 class="sg-card__h">{{ result.won ? 'All data delivered to NASA!' : result.reason }}</h2>
        <p class="sg-card__goal sg-card__goal--sm">{{ result.won ? 'Great timing, Commander. Earth confirmed every packet.' : 'Tobish: \"Don\'t worry, Commander. Even NASA waits for the noise to pass. Watch the warning, then we try again!\"' }}</p>
        <div class="sg-stats">
          <div class="sg-stats__score"><b>{{ result.score }}</b><span>score</span></div>
          <div><b>{{ result.delivered }}</b><span>sent</span></div>
          <div><b>{{ result.lost }}</b><span>lost</span></div>
          <div><b>×{{ result.best }}</b><span>streak</span></div>
          <div><b>{{ result.lockPct }}%</b><span>lock</span></div>
        </div>
        <div class="sg-cmp">
          <div class="sg-cmp__t">If you were on Mars…</div>
          <div class="sg-cmp__row"><span>🌙 Moon</span><div class="sg-cmp__track"><i class="sg-cmp__dot sg-cmp__dot--moon" /></div><b>1.28 s</b></div>
          <div class="sg-cmp__row"><span>🔴 Mars</span><div class="sg-cmp__track"><i class="sg-cmp__dot sg-cmp__dot--mars" /></div><b>3–22 min</b></div>
        </div>
        <div class="sg-fact sg-fact--res">
          <b>What you learned</b>
          <p>{{ FACTS[1].t }} <em>({{ FACTS[1].s }})</em></p>
          <template v-if="showMore">
            <p>{{ FACTS[2].t }} <em>({{ FACTS[2].s }})</em></p>
            <p>{{ FACTS[3].t }} <em>({{ FACTS[3].s }})</em></p>
          </template>
          <button class="sg-more" type="button" @click="showMore = !showMore">{{ showMore ? 'Fewer facts ▴' : 'More facts ▾' }}</button>
        </div>
        <div class="sg-card__btn sg-card__btn--row sg-card__cta">
          <template v-if="result.won"><Btn big class="sg-btn" @click="done">Continue</Btn></template>
          <template v-else><Btn big class="sg-btn" @click="retry">🔁 Try again</Btn><Btn variant="ghost" class="sg-btn sg-btn--g" @click="done">Back to base</Btn></template>
        </div>
      </div>
    </Sheet>
  </div>
</template>

<style scoped>
.sg {
  position: absolute; inset: 0; z-index: 60; overflow: hidden;
  background: linear-gradient(180deg, #0b1b3a, #123a5c);
  font-family: "Nunito", sans-serif; color: #fff;
  user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
}
.sg__hud { padding-top: calc(10px + env(safe-area-inset-top)) !important; }
.sg__banner { top: calc(80px + env(safe-area-inset-top)) !important; }
.sg__cv { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; display: block; cursor: ew-resize; }

.sg__hud {
  position: absolute; top: 0; left: 0; right: 0; z-index: 2; pointer-events: none;
  display: grid; grid-template-columns: auto 1fr auto; gap: 8px 10px; align-items: center;
  padding: 10px 12px 0; max-width: 900px; margin: 0 auto;
}
.sg__pill {
  font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 17px; padding: 6px 12px; border-radius: 16px;
  background: rgba(12, 24, 48, 0.72); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.12); white-space: nowrap;
}
.sg__time--low { color: #ff8a5c; animation: pulse 0.6s ease-in-out infinite alternate; }
.sg__streak { opacity: 0.6; transition: opacity 0.2s, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.sg__streak--on { opacity: 1; transform: scale(1.1); color: #ffd23f; }
.sg__nasa {
  padding: 5px 12px 7px; border-radius: 16px; background: rgba(12, 24, 48, 0.72);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border: 1px solid rgba(255, 255, 255, 0.12);
}
.sg__nasa-top { display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 800; margin-bottom: 4px; gap: 8px; }
.sg__nasa-top b { font-family: "Fredoka", sans-serif; color: #7cf29c; }
.sg__bar { height: 9px; border-radius: 6px; background: rgba(255, 255, 255, 0.14); overflow: hidden; }
.sg__bar i { display: block; height: 100%; border-radius: 6px; background: linear-gradient(90deg, #4fd1ff, #7cf29c); transition: width 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.sg__bar--lock i { background: #ffd23f; transition: none; }
.sg__bar--ok i { background: #4fd1ff; }
.sg__lock { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 800; max-width: 420px; }
.sg__lock .sg__bar { flex: 1; }
.sg__lock b { width: 36px; text-align: right; font-family: "Fredoka", sans-serif; }
.sg__banner {
  position: absolute; top: 80px; left: 50%; transform: translateX(-50%); z-index: 2; pointer-events: none;
  width: max-content; max-width: calc(100% - 24px); text-align: center; font-weight: 800; font-size: 13.5px; line-height: 1.25;
  padding: 6px 14px; border-radius: 14px; background: rgba(12, 24, 48, 0.78); backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.14);
}
.sg__banner--warn { background: rgba(120, 60, 10, 0.85); border-color: #ff9f43; animation: pulse 0.5s ease-in-out infinite alternate; }
.sg__banner--bad { background: rgba(110, 30, 30, 0.82); border-color: #ff6b6b; }
.sg__banner--good { background: rgba(20, 90, 50, 0.85); border-color: #7cf29c; }

.sg__tray {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; padding: 8px 12px calc(10px + env(safe-area-inset-bottom));
  display: flex; flex-direction: column; gap: 8px; align-items: center;
  background: linear-gradient(180deg, transparent, rgba(8, 14, 32, 0.55) 40%);
}
.sg__queue { display: flex; gap: 8px; min-height: 52px; width: 100%; max-width: 520px; justify-content: center; }
.sg__empty { align-self: center; font-weight: 800; font-size: 13px; opacity: 0.6; }
.sg__chip {
  position: relative; flex: 1 1 0; min-width: 0; min-height: 52px; display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; border-radius: 16px; border: 1.5px solid color-mix(in srgb, var(--c) 70%, transparent);
  background: rgba(12, 24, 48, 0.78); backdrop-filter: blur(12px); color: #fff; font: inherit; cursor: pointer; overflow: hidden;
  animation: chip 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both; touch-action: manipulation;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.3), 0 0 14px color-mix(in srgb, var(--c) 30%, transparent);
}
.sg__chip--first { box-shadow: 0 3px 0 rgba(0, 0, 0, 0.3), 0 0 18px color-mix(in srgb, var(--c) 60%, transparent); }
.sg__chip--prio { background: rgba(70, 52, 8, 0.85); border-color: #ffd23f; }
.sg__chip-e { font-size: 24px; }
.sg__chip-l { font-family: "Fredoka", sans-serif; font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sg__chip-t { position: absolute; left: 0; bottom: 0; height: 4px; background: #ffd23f; }
.sg__ctrl { display: flex; gap: 10px; width: 100%; max-width: 520px; align-items: stretch; }
.sg__arrow {
  width: 64px; min-height: 56px; border: 0; border-radius: 18px; color: #fff; font-size: 22px; cursor: pointer;
  background: rgba(255, 255, 255, 0.16); box-shadow: 0 4px 0 rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.25);
  touch-action: none; transition: transform 0.1s;
}
.sg__arrow:active { transform: translateY(3px); box-shadow: 0 1px 0 rgba(0, 0, 0, 0.28); background: rgba(255, 255, 255, 0.26); }
.sg__send {
  flex: 1; min-height: 56px; border: 0; border-radius: 20px; cursor: pointer; color: #fff;
  font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 24px; letter-spacing: 0.5px;
  background: linear-gradient(180deg, #5ee08e, #2fcf6b); text-shadow: 0 2px 0 rgba(0, 0, 0, 0.18);
  box-shadow: 0 5px 0 #1a9a4c, 0 10px 18px rgba(0, 0, 0, 0.3), inset 0 2px 0 rgba(255, 255, 255, 0.35);
  transition: transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.12s; touch-action: manipulation;
}
.sg__send small { font-size: 11px; opacity: 0.75; font-weight: 600; margin-left: 4px; }
.sg__send:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 2px 0 #1a9a4c; }
.sg__send:disabled { opacity: 0.45; cursor: default; }

.sg__count { position: absolute; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; pointer-events: none; }
.sg__count span {
  font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 150px; color: #fff;
  text-shadow: 0 0 40px rgba(79, 209, 255, 0.8), 0 6px 0 rgba(0, 0, 0, 0.25);
  animation: cnt 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.sg-card { text-align: center; }
.sg-card__icon { font-size: 46px; line-height: 1; }
.sg-card__h { font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 30px; margin: 6px 0 4px; }
.sg-card__goal { margin: 0 0 12px; opacity: 0.92; }
.sg-card__ctl { list-style: none; margin: 0 0 12px; padding: 0; text-align: left; display: grid; gap: 6px; font-size: 14.5px; }
.sg-card__ctl li { background: rgba(255, 255, 255, 0.07); padding: 8px 12px; border-radius: 14px; }
.sg-fact { text-align: left; background: rgba(79, 209, 255, 0.1); border: 1px solid rgba(79, 209, 255, 0.3); border-radius: 16px; padding: 10px 14px; font-size: 14px; margin-bottom: 14px; }
.sg-fact b { font-family: "Fredoka", sans-serif; color: #7fdcff; font-size: 15px; }
.sg-fact p { margin: 4px 0; }
.sg-fact em { opacity: 0.7; font-size: 12.5px; }
.sg-fact small { opacity: 0.65; }
.sg-card__btn { display: flex; justify-content: center; }
.sg-card__btn--row { gap: 12px; flex-wrap: wrap; align-items: center; }
.sg-card__ctl1 { margin: 0 0 12px; font-weight: 800; font-size: 14.5px; background: rgba(255,255,255,.07); padding: 8px 12px; border-radius: 14px; }
.sg-score { font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 64px; line-height: 1; color: #ffd23f; text-shadow: 0 0 24px rgba(255, 210, 63, 0.5); }
.sg-score small { font-size: 18px; opacity: 0.6; margin-left: 4px; }
.sg-stats { display: grid; grid-template-columns: 1.3fr repeat(4, 1fr); gap: 6px; margin: 10px 0; }
.sg-stats__score { background: rgba(255,210,63,.16) !important; }
.sg-stats__score b { color: #ffd23f; font-size: 24px !important; }
.sg-stats div { background: rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 6px 2px; display: flex; flex-direction: column; }
.sg-stats b { font-family: "Fredoka", sans-serif; font-size: 20px; }
.sg-stats span { font-size: 11px; opacity: 0.7; font-weight: 800; }
.sg-cmp { text-align: left; background: rgba(255, 159, 67, 0.1); border: 1px solid rgba(255, 159, 67, 0.35); border-radius: 16px; padding: 10px 14px; margin-bottom: 12px; font-size: 14px; }
.sg-cmp__t { font-family: "Fredoka", sans-serif; font-weight: 700; color: #ffb877; margin-bottom: 6px; }
.sg-cmp__row { display: grid; grid-template-columns: 64px 1fr 76px; gap: 8px; align-items: center; margin: 4px 0; font-weight: 800; }
.sg-cmp__row b { text-align: right; font-family: "Fredoka", sans-serif; font-size: 13.5px; }
.sg-cmp__track { height: 10px; border-radius: 6px; background: rgba(255, 255, 255, 0.12); position: relative; overflow: hidden; }
.sg-cmp__dot { position: absolute; top: 0; left: 0; height: 100%; width: 14px; border-radius: 7px; }
.sg-cmp__dot--moon { background: #4fd1ff; animation: moonrun 1.28s linear infinite; }
.sg-cmp__dot--mars { background: #ff6b4a; animation: marsrun 9s linear infinite; }
.sg-more { margin-top: 2px; background: none; border: 0; color: #7fdcff; font: inherit; font-weight: 800; font-size: 13px; cursor: pointer; padding: 4px 0; }
.sg-card__btn--row { padding-top: 8px; }
.sg-card__icon--sm { font-size: 34px; }
.sg-card__goal--sm { font-size: 14px; margin-bottom: 4px; }
.sg__probe { position: absolute; left: 0; top: 0; width: 0; height: 0; visibility: hidden; padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }

@keyframes moonrun { from { left: -14px; } to { left: 100%; } }
@keyframes marsrun { from { left: -14px; } to { left: 100%; } }
@keyframes pulse { from { opacity: 0.75; } to { opacity: 1; } }
@keyframes chip { from { transform: translateY(20px) scale(0.7); opacity: 0; } }
@keyframes cnt { 0% { transform: scale(0.3); opacity: 0; } 40% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 0.85; } }

@media (max-width: 640px) {
  .sg { position: fixed; inset: 0 auto auto 0; width: 100%; height: 100%; height: 100dvh; height: 100svh; padding: env(safe-area-inset-left); }
  .sg-card { font-size: 13.5px; line-height: 1.35; }
  .sg-card__icon { font-size: 30px; }
  .sg-card__h { font-size: 21px; margin: 2px 0; }
  .sg-card__goal { margin-bottom: 6px; font-size: 14px; }
  .sg-card__ctl1 { font-size: 13px; padding: 6px 10px; margin-bottom: 8px; }
  .sg-fact { font-size: 13px; padding: 8px 12px; margin-bottom: 8px; }
  .sg-fact b { font-size: 14px; }
  .sg-fact p { margin: 2px 0; }
  .sg-cmp { padding: 6px 10px; margin-bottom: 8px; font-size: 13px; }
  .sg-cmp__t { margin-bottom: 2px; font-size: 14px; }
  .sg-cmp__row { margin: 2px 0; grid-template-columns: 58px 1fr 70px; }
  .sg-cmp__track { height: 7px; }
  .sg-stats b { font-size: 17px; }
  .sg-card--res .sg-card__btn--row { flex-wrap: nowrap; gap: 8px; }
  .sg-btn { font-size: 17px !important; min-height: 50px !important; padding: 8px 16px !important; border-radius: 18px !important; white-space: nowrap; }
  .sg-btn--g { font-size: 14px !important; padding: 8px 12px !important; }
  .sg-card--res .sg-card__icon { display: none; }
  .sg-card--res .sg-card__h { font-size: 19px; }
  .sg__tray { padding-bottom: calc(10px + env(safe-area-inset-bottom)); }
}
@media (max-width: 560px) {
  .sg__nasa-top { font-size: 11.5px; }
  .sg__pill { font-size: 15px; padding: 5px 9px; }
  .sg__chip { padding: 6px 7px; gap: 4px; }
  .sg__chip-e { font-size: 21px; }
  .sg__chip-l { font-size: 12.5px; }
  .sg-card__h { font-size: 25px; }
  .sg-score { font-size: 52px; }
  .sg__count span { font-size: 110px; }
}
@media (prefers-reduced-motion: reduce) {
  .sg__chip, .sg__count span, .sg__time--low, .sg__banner--warn { animation: none; }
  .sg-cmp__dot { animation: none; left: 40%; }
  .sg__bar i { transition: none; }
}
</style>
