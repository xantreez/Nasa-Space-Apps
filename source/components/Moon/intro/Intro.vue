<script setup lang="ts">
// Cinematic intro: AI-illustrated + Kling-animated shots (public/moon/intro/*.mp4) played by two crossfading <video> elements,
// with HTML overlays (subtitles, countdown, ignition, hold gauge, computer + name). <Intro @done="{ name }" @skip />
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { gsap } from "gsap";
import { INTRO_LINES, type IntroLine } from "../../../moon/intro-lines";
import { music, sfx } from "../../../moon/sfx";
import { LAYOUTS } from "../scene/layout";
import OvIgnite from "./OvIgnite.vue";
import OvHold from "./OvHold.vue";
import OvComputer from "./OvComputer.vue";
import type { IntroApi } from "./api";

const emit = defineEmits<{ done: [p: { name: string }]; skip: [] }>();
const BY_ID: Record<string, IntroLine> = Object.fromEntries(INTRO_LINES.map((l) => [l.id, l]));
const BASE = "/moon/intro/";
const ORDER = ["a_room", "b1_study", "b2_study", "c_grad", "d_pad", "e_lift", "f_journey", "g_cockpit", "h_fall", "i_alone", "j_find", "k_screen"];

/** where the subject sits (keeps it in frame on tall phones where object-fit: cover crops the sides) */
const POS: Record<string, string> = { a_room: "68% 50%", c_grad: "52% 50%" };
const root = ref<HTMLElement | null>(null);
const stage = ref<HTMLElement | null>(null);
const vids = [ref<HTMLVideoElement | null>(null), ref<HTMLVideoElement | null>(null)];
// loader: shown only when a clip is genuinely slow (slow mobile networks)
const buffering = ref(false);
let bufTimer: ReturnType<typeof setTimeout> | null = null;
function setBuffering(on: boolean) {
  if (bufTimer) clearTimeout(bufTimer);
  bufTimer = null;
  if (on) bufTimer = setTimeout(() => (buffering.value = true), 300);
  else buffering.value = false;
}
function onWaiting(e: Event) {
  const v = e.target as HTMLVideoElement;
  if (front >= 0 && vids[front].value === v) setBuffering(true);
}
function onPlaying(e: Event) {
  const v = e.target as HTMLVideoElement;
  if (front >= 0 && vids[front].value === v) setBuffering(false);
}
const dustEl = ref<HTMLElement | null>(null);
const overlay = ref<"" | "ignite" | "hold" | "computer">("");
const ovRef = ref<any>(null);
const barsOn = ref(false);
const reduced = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// ---------- liveness, tracked animations, pause on hidden tab ----------
let alive = true;
let paused = false;
const tracked = new Set<gsap.core.Animation>();
const resolvers = new Set<() => void>();
function track<T extends gsap.core.Animation>(a: T): T {
  tracked.add(a);
  if (paused) a.pause();
  return a;
}
function waitS(sec: number): Promise<void> {
  return new Promise((res) => {
    if (!alive) return res();
    let c: gsap.core.Tween;
    const fin = () => {
      resolvers.delete(fin);
      tracked.delete(c);
      res();
    };
    c = gsap.delayedCall(Math.max(0, sec), fin);
    tracked.add(c);
    if (paused) c.pause();
    resolvers.add(fin);
  });
}
function onVis() {
  paused = document.hidden;
  tracked.forEach((a) => (paused ? a.pause() : a.resume()));
  vids.forEach((v) => {
    const e = v.value;
    if (!e) return;
    if (paused) e.pause();
    else if (e.style.opacity !== "0" && !e.ended) e.play().catch(() => {});
  });
}

// ---------- voice (optional) + clip durations ----------
let voiceMod: any = null;
let manifest: Record<string, { dur: number }> = {};
const minSec = (text: string) => (text.length * 55 + 600) / 1000;
function lineDur(id: string): number {
  const l = BY_ID[id];
  let d = minSec(l.text);
  try {
    const h = voiceMod?.voiceHash?.(l.text);
    const m = h && manifest[h];
    if (m?.dur) d = Math.max(d, m.dur + 0.35);
  } catch {}
  return d + 0.15;
}

// ---------- subtitles ----------
interface Sub { key: number; who: IntroLine["who"]; words: string[]; step: number }
const sub = ref<Sub | null>(null);
let subKey = 0;
function showSub(who: IntroLine["who"], text: string, secs: number) {
  const words = text.split(/\s+/);
  sub.value = { key: ++subKey, who, words, step: Math.min(0.11, Math.max(0.03, (secs * 0.55) / words.length)) };
}
async function line(id: string, shown?: string) {
  if (!alive) return;
  const L = BY_ID[id];
  showSub(L.who, shown ?? L.text, lineDur(id));
  if (L.who !== "narrator") sfx.beep();
  let sp: Promise<any> = Promise.resolve();
  try {
    sp = voiceMod?.voice?.say?.(L.text) ?? Promise.resolve();
  } catch {}
  await Promise.all([sp.catch(() => {}), waitS(minSec(L.text) + 0.15)]);
}
async function lines(ids: string[]) {
  for (const id of ids) {
    if (!alive) return;
    await line(id);
  }
}
const hideSub = () => (sub.value = null);

// ---------- gentle shake (CSS transform on the video wrapper) ----------
function shake(amp: number, dur: number) {
  const el = stage.value;
  if (!el || !alive) return null;
  const a = reduced ? amp * 0.1 : amp;
  const o = { p: 0 };
  return track(
    gsap.to(o, {
      p: 1, duration: dur, ease: "none",
      onUpdate() {
        const k = a * (1 - o.p);
        gsap.set(el, { x: (Math.random() * 2 - 1) * k, y: (Math.random() * 2 - 1) * k });
      },
      onComplete() { gsap.set(el, { x: 0, y: 0 }); },
    }),
  );
}
/** soft colour wash (never white): dust / warm glow */
function flash(color = "#c9c3b9", peak = 0.5, inS = 0.4, outS = 0.9) {
  const el = dustEl.value;
  if (!el || !alive) return;
  gsap.killTweensOf(el);
  gsap.set(el, { background: color });
  track(gsap.timeline().to(el, { opacity: Math.min(peak, 0.85), duration: inS }).to(el, { opacity: 0, duration: outS, ease: "power1.inOut" }));
}
function dust(on: boolean, sec = 1) {
  const el = dustEl.value;
  if (!el) return;
  gsap.set(el, { background: "#bdb6ab" });
  track(gsap.to(el, { opacity: on ? 1 : 0, duration: sec, ease: "power1.inOut" }));
}

// ---------- keyboard ----------
const keyFns = new Set<(e: KeyboardEvent, down: boolean) => void>();
const onKey = (fn: (e: KeyboardEvent, down: boolean) => void) => {
  keyFns.add(fn);
  return () => keyFns.delete(fn);
};
function kd(e: KeyboardEvent) {
  if (!(e.code === "Space" || e.key === "Enter")) return;
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
  keyFns.forEach((f) => f(e, true));
}
function ku(e: KeyboardEvent) {
  if (!(e.code === "Space" || e.key === "Enter")) return;
  keyFns.forEach((f) => f(e, false));
}

function labPos() {
  const el = root.value;
  if (!el) return { x: 0, y: 0 };
  const w = el.clientWidth, h = el.clientHeight;
  const L = w / h < 1 ? LAYOUTS.tall : LAYOUTS.wide;
  const s = Math.max(w / L.W, h / L.H);
  return { x: (w - L.W * s) / 2 + L.locs.lab.x * s, y: (h - L.H * s) / 2 + (L.locs.lab.y - 30) * s };
}

const api: IntroApi = {
  reduced, track, wait: waitS, line, lines, dur: (...ids: string[]) => ids.reduce((s, id) => s + lineDur(id), 0),
  lineDur, hideSub, shake, flash, onKey, alive: () => alive, labPos,
  music: (n) => music.play(n),
  reveal(sec) {
    barsOn.value = false;
    if (root.value) gsap.to(root.value, { backgroundColor: "rgba(6,13,34,0)", duration: sec, ease: "power1.inOut" });
    if (stage.value) gsap.to(stage.value, { opacity: 0, duration: sec * 0.9, ease: "power1.inOut" });
  },
};

// ---------- video player: two stacked <video>, crossfade, preload next ----------
let front = -1; // index of the visible video
let curKey = "";
const loaded: Record<number, string> = {};
function vurl(key: string) {
  return BASE + key + ".mp4";
}
function prep(i: number, key: string, loop = false) {
  const v = vids[i].value;
  if (!v) return null;
  if (loaded[i] !== key) {
    loaded[i] = key;
    v.poster = BASE + key + ".jpg";
    v.src = vurl(key);
    v.preload = "auto";
    v.load();
  }
  v.loop = loop;
  return v;
}
function ready(v: HTMLVideoElement) {
  return new Promise<void>((res) => {
    if (v.readyState >= 3) return res();
    const done = () => { v.removeEventListener("canplay", done); v.removeEventListener("error", done); res(); };
    v.addEventListener("canplay", done);
    v.addEventListener("error", done);
    setTimeout(done, 4500);
  });
}
/** crossfade to a shot; T = seconds it should stay on screen (clip is slowed to fit, never below 0.5x) */
async function show(key: string, T = 5, opts: { loop?: boolean; fade?: number } = {}) {
  if (!alive) return;
  const back = front === 0 ? 1 : 0;
  const nv = prep(back, key, !!opts.loop);
  const pv = front >= 0 ? vids[front].value : null;
  if (!nv) return;
  if (nv.readyState < 3) setBuffering(true);
  await ready(nv);
  setBuffering(false);
  if (!alive) return;
  nv.style.objectPosition = POS[key] ?? "50% 50%";
  bgKey.value = key;
  nv.currentTime = 0;
  const dur = isFinite(nv.duration) && nv.duration > 0 ? nv.duration : 5;
  nv.playbackRate = opts.loop ? 1 : T > dur ? Math.max(0.5, dur / T) : 1;
  nv.play().catch(() => {});
  const fade = opts.fade ?? 0.8;
  gsap.set(nv, { zIndex: 2, opacity: 0, scale: 1.0 });
  track(gsap.to(nv, { opacity: 1, duration: fade, ease: "power1.inOut" }));
  track(gsap.to(nv, { scale: 1.07, duration: Math.max(T, 5) + 1, ease: "none" }));
  if (pv) {
    gsap.set(pv, { zIndex: 1 });
    track(gsap.to(pv, { opacity: 0, duration: fade, ease: "power1.inOut", delay: fade * 0.3, onComplete: () => pv.pause() }));
  }
  front = back;
  curKey = key;
  // preload the next shot into the idle element
  const nxt = ORDER[ORDER.indexOf(key) + 1];
  if (nxt) setTimeout(() => { if (alive) prep(front === 0 ? 1 : 0, nxt); }, fade * 1000 + 300);
}

async function scene1() {
  const L = ["s1a", "s1b", "s1c"];
  await show("a_room", api.dur(...L) + 0.6, { fade: 1.2 });
  await lines(L);
}
async function scene2() {
  await show("b1_study", api.dur("s2a") + 0.4);
  await line("s2a");
  await show("b2_study", api.dur("s2b") + 0.6);
  await line("s2b");
  await waitS(0.3);
}
async function scene3() {
  await show("c_grad", Math.max(5.5, api.dur("s3a") + 0.6));
  await Promise.all([line("s3a"), waitS(5.4)]);
}
async function scene4() {
  await show("d_pad", api.dur("s4a") + 6, { fade: 1 });
  ovRef.value = null;
  overlay.value = "ignite";
  await waitForOv();
  await ovRef.value?.run?.(api);
  overlay.value = "";
  if (!alive) return;
  // liftoff
  music.play("storm");
  sfx.explosion();
  sfx.go();
  shake(9, 3.2);
  await show("e_lift", 4.4, { fade: 0.5 });
  await waitS(3.6);
  await show("f_journey", Math.max(api.dur("s4b") + 1.5, 6.5), { fade: 1 });
  await line("s4b");
  await waitS(1.0);
}
async function scene5() {
  await show("g_cockpit", 9.5);
  ovRef.value = null;
  overlay.value = "hold";
  await waitForOv();
  await ovRef.value?.run?.(api);
  overlay.value = "";
  if (!alive) return;
  api.shake(12, 1.4);
  await show("h_fall", 7.5, { fade: 0.5 });
  await line("s5b");
  await waitS(1.2);
  dust(true, 1.2);
  await waitS(1.2);
}
async function scene6() {
  await show("i_alone", api.dur("s6a", "s6b") + 0.8, { fade: 1.2 });
  dust(false, 1.6);
  await lines(["s6a", "s6b"]);
  await show("j_find", api.dur("s6c") + 1, { fade: 1 });
  await line("s6c");
  await waitS(0.4);
}
async function scene7(): Promise<string> {
  await show("k_screen", 60, { loop: true, fade: 1.2 });
  ovRef.value = null;
  overlay.value = "computer";
  await waitForOv();
  const r = await ovRef.value?.run?.(api);
  return r?.name || "Commander";
}
async function waitForOv() {
  for (let i = 0; i < 40 && !ovRef.value; i++) await waitS(0.05);
}

const SCENES = [scene1, scene2, scene3, scene4, scene5, scene6];
let started = false;
async function direct() {
  if (started) return;
  started = true;
  let startAt = 1;
  try {
    const q = new URLSearchParams(location.search).get("introScene");
    if (import.meta.dev && q) startAt = Math.min(7, Math.max(1, parseInt(q) || 1));
  } catch {}
  music.play("title");
  barsOn.value = true;
  let name = "Commander";
  for (let n = startAt; n <= 7 && alive; n++) {
    if (n === 6) music.play("night");
    if (n === 7) name = await scene7();
    else await SCENES[n - 1]();
    hideSub();
  }
  if (!alive) return;
  music.play("base");
  await waitS(0.4);
  finish(name);
}
let finished = false;
function finish(name: string) {
  if (finished) return;
  finished = true;
  emit("done", { name });
}
function skip() {
  if (finished) return;
  teardown();
  try { voiceMod?.voice?.stop?.(); } catch {}
  sfx.click();
  finished = true;
  emit("skip");
}
function teardown() {
  alive = false;
  tracked.forEach((a) => a.kill());
  tracked.clear();
  resolvers.forEach((f) => f());
  resolvers.clear();
  vids.forEach((v) => v.value?.pause());
  gsap.killTweensOf([stage.value, dustEl.value]);
}

const isTall = ref(false);
// blurred backdrop of the current shot: on portrait phones the 16:9 clip is shown WHOLE (contain) and this fills above/below
const bgKey = ref("");
let ro: ResizeObserver | null = null;
onMounted(async () => {
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("keydown", kd);
  window.addEventListener("keyup", ku);
  if (root.value && typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => { isTall.value = root.value!.clientWidth / root.value!.clientHeight < 1; });
    ro.observe(root.value);
  }
  try { voiceMod = await import("../../../moon/voice"); } catch {}
  try {
    const r = await fetch("/moon/voice/manifest.json");
    if (r.ok) manifest = await r.json();
  } catch {}
  direct();
});
onBeforeUnmount(() => {
  teardown();
  ro?.disconnect();
  document.removeEventListener("visibilitychange", onVis);
  window.removeEventListener("keydown", kd);
  window.removeEventListener("keyup", ku);
  try { voiceMod?.voice?.stop?.(); } catch {}
});
const subWho = computed(() => sub.value?.who);
void curKey;
</script>

<template>
  <div ref="root" class="mi" :class="{ tall: isTall }">
    <Transition name="mi-bd">
      <div v-if="isTall && bgKey" :key="bgKey" class="mi-bd" :style="{ backgroundImage: `url(${BASE}${bgKey}.jpg)` }" />
    </Transition>
    <div ref="stage" class="mi-stage">
      <video :ref="(e: any) => (vids[0].value = e)" class="mi-vid" muted playsinline webkit-playsinline preload="auto" disablepictureinpicture @waiting="onWaiting" @stalled="onWaiting" @playing="onPlaying" @canplay="onPlaying" />
      <video :ref="(e: any) => (vids[1].value = e)" class="mi-vid" muted playsinline webkit-playsinline preload="auto" disablepictureinpicture @waiting="onWaiting" @stalled="onWaiting" @playing="onPlaying" @canplay="onPlaying" />
    </div>
    <Transition name="mi-load">
      <div v-if="buffering" class="mi-load" role="status" aria-live="polite">
        <div class="mi-load__orbit"><span class="mi-load__earth" /><span class="mi-load__moon" /></div>
        <span class="mi-load__txt">Loading the story…</span>
      </div>
    </Transition>
    <div class="mi-vig" />
    <div ref="dustEl" class="mi-dust" />
    <OvIgnite v-if="overlay === 'ignite'" :ref="(e: any) => (ovRef = e)" />
    <OvHold v-else-if="overlay === 'hold'" :ref="(e: any) => (ovRef = e)" />
    <OvComputer v-else-if="overlay === 'computer'" :ref="(e: any) => (ovRef = e)" />
    <div class="mi-bar mi-bar--t" :class="{ off: !barsOn }" />
    <div class="mi-bar mi-bar--b" :class="{ off: !barsOn }" />
    <Transition name="mi-sub" mode="out-in">
      <div v-if="sub" :key="sub.key" class="mi-sub" :class="'w-' + subWho" role="status" aria-live="polite">
        <span v-if="sub.who !== 'narrator'" class="mi-who">{{ sub.who === "tobish" ? "🧑‍🚀 Tobish" : "📡 Mission Control" }}</span>
        <span class="mi-txt"><span v-for="(w, i) in sub.words" :key="i" class="mi-w" :style="{ animationDelay: i * sub.step + 's' }">{{ w + " " }}</span></span>
      </div>
    </Transition>
    <button class="mi-skip" type="button" aria-label="Skip intro" @click="skip">Skip ⏭</button>
  </div>
</template>

<style>
/* shared (unscoped) intro styles: mi- prefix */
.mi { position: absolute; inset: 0; z-index: 45; overflow: hidden; background: #060d22; --bar: clamp(14px, 5.2vh, 52px); font-family: "Nunito", system-ui, sans-serif; color: #fff; user-select: none; -webkit-user-select: none; touch-action: manipulation; }
.mi-stage { position: absolute; inset: -2%; will-change: transform; }
.mi-ov { position: absolute; inset: 0; z-index: 10; }
.mi-layer { position: absolute; inset: 0; overflow: hidden; }
.mi-svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.mi-vid { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 50%; opacity: 0; background: #060d22; will-change: opacity, transform; }
.mi-vig { position: absolute; inset: 0; pointer-events: none; z-index: 3; background: radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,.4) 100%); }
.mi-dust { position: absolute; inset: 0; z-index: 4; opacity: 0; pointer-events: none; }
.mi-bar { position: absolute; left: 0; right: 0; height: var(--bar); background: #000; z-index: 7; transition: height 0.9s cubic-bezier(0.22, 1, 0.36, 1); pointer-events: none; }
.mi-bar--t { top: 0; } .mi-bar--b { bottom: 0; }
.mi-bar.off { height: 0; }

.mi-skip {
  position: absolute; z-index: 20; top: calc(var(--bar) + 10px); right: 12px; font-family: "Fredoka", sans-serif; font-weight: 600; font-size: 15px;
  color: #fff; background: rgba(12, 24, 48, 0.55); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 999px; padding: 9px 16px; min-height: 44px; cursor: pointer;
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); -webkit-tap-highlight-color: transparent; transition: background 0.15s, transform 0.12s;
}
.mi-skip:hover { background: rgba(40, 70, 130, 0.7); }
.mi-skip:active { transform: translateY(2px); }

.mi-sub {
  position: absolute; z-index: 15; left: 50%; transform: translateX(-50%); bottom: calc(var(--bar) + 16px); width: min(92vw, 860px);
  text-align: center; font-family: "Fredoka", "Nunito", sans-serif; font-weight: 600; font-size: clamp(18px, 2.2vw, 28px); line-height: 1.28;
  padding: 12px 20px 14px; border-radius: 22px; background: rgba(8, 14, 34, 0.62); border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); text-shadow: 0 2px 8px rgba(0, 0, 0, 0.55); pointer-events: none;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
}
.mi-who { display: inline-block; font-size: 0.55em; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 11px; border-radius: 999px; margin-bottom: 4px; display: block; width: fit-content; margin-inline: auto; }
.w-tobish .mi-who { background: #3a9bff; color: #fff; }
.w-control .mi-who { background: #1fcf8a; color: #052b1b; }
.w-control { border-color: rgba(31, 207, 138, 0.45); }
.w-tobish { border-color: rgba(90, 175, 255, 0.5); }
.mi-w { opacity: 0; display: inline-block; white-space: pre; animation: miw 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
@keyframes miw { from { opacity: 0; transform: translateY(8px) scale(0.92); } to { opacity: 1; transform: none; } }
.mi-sub-enter-active { transition: opacity 0.25s, transform 0.3s; }
.mi-sub-leave-active { transition: opacity 0.18s; }
.mi-sub-enter-from { opacity: 0; transform: translateX(-50%) translateY(10px); }
.mi-sub-leave-to { opacity: 0; }

.mi-btn {
  font-family: "Fredoka", sans-serif; font-weight: 700; color: #fff; border: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  border-radius: 24px; min-height: 64px; padding: 12px 34px; font-size: clamp(22px, 3vw, 30px); letter-spacing: 0.4px; text-shadow: 0 2px 0 rgba(0, 0, 0, 0.2);
  background: linear-gradient(180deg, #ffb347, #ff6b3d); box-shadow: 0 6px 0 #b8421a, 0 14px 28px rgba(0, 0, 0, 0.4), inset 0 2px 0 rgba(255, 255, 255, 0.4);
  transition: transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.12s;
}
.mi-btn:active, .mi-btn.down { transform: translateY(4px); box-shadow: 0 2px 0 #b8421a, 0 6px 12px rgba(0, 0, 0, 0.4), inset 0 2px 0 rgba(255, 255, 255, 0.3); }
@media (max-width: 480px) { .mi-skip { font-size: 14px; padding: 8px 13px; } }
@media (prefers-reduced-motion: reduce) { .mi-w { animation-duration: 0.01s; animation-delay: 0s !important; } }

.mi-load { position: absolute; z-index: 30; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 22px 28px; border-radius: 24px; background: rgba(8, 18, 40, 0.62); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.12); pointer-events: none; }
.mi-load__orbit { position: relative; width: 64px; height: 64px; animation: mi-orbit 1.6s linear infinite; }
.mi-load__earth { position: absolute; left: 50%; top: 50%; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #9ee7ff, #2f7fe0 60%, #1d4fa0); box-shadow: 0 0 18px rgba(79, 209, 255, 0.55); animation: mi-orbit 1.6s linear infinite reverse; }
.mi-load__moon { position: absolute; left: 50%; top: 0; width: 12px; height: 12px; margin-left: -6px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff, #c9ccd8 70%); box-shadow: 0 0 10px rgba(255, 255, 255, 0.6); }
.mi-load__txt { font: 700 15px "Nunito", sans-serif; color: rgba(255, 255, 255, 0.85); letter-spacing: 0.3px; }
@keyframes mi-orbit { to { transform: rotate(360deg); } }
.mi-load-enter-active, .mi-load-leave-active { transition: opacity 0.35s ease; }
.mi-load-enter-from, .mi-load-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .mi-load__orbit, .mi-load__earth { animation-duration: 4s; } }

/* portrait phones: show the whole 16:9 shot, blurred copy of the frame fills the rest */
.mi-bd { position: absolute; inset: -10%; z-index: 0; background-size: cover; background-position: center; filter: blur(28px) saturate(1.25) brightness(0.5); transform: scale(1.1); }
.mi-bd-enter-active, .mi-bd-leave-active { transition: opacity 0.8s ease; }
.mi-bd-enter-from, .mi-bd-leave-to { opacity: 0; }
.mi.tall .mi-stage { inset: 0; z-index: 1; }
.mi.tall .mi-vid { object-fit: contain; object-position: 50% 40% !important; background: transparent; }
.mi.tall .mi-bar { display: none; }
.mi.tall .mi-vig { background: radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0) 45%, rgba(0,0,0,.35) 100%); }
.mi.tall .mi-sub { bottom: calc(env(safe-area-inset-bottom, 0px) + 22px); }
.mi.tall .mi-skip { top: calc(env(safe-area-inset-top, 0px) + 12px); }
</style>
