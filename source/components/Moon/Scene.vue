<script setup lang="ts">
// Moon base map: hand-made inline SVG + CSS/gsap. See components/Moon/scene/Preview.md.
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { gsap } from "gsap";
import type { BuildId, LocationId, Resources } from "../../moon/types";
import { LAYOUTS, LOC_IDS, LOC_META } from "./scene/layout";
import { clamp, lerp, rng } from "./scene/util";
import Sky from "./scene/Sky.vue";
import Ground from "./scene/Ground.vue";
import Loc from "./scene/Loc.vue";
import LocLabel from "./scene/LocLabel.vue";
import Extras from "./scene/Extras.vue";
import Wreck from "./scene/Wreck.vue";
import Tobish from "./scene/Tobish.vue";
import Ambient from "./scene/Ambient.vue";

type Weather = "calm" | "flare" | "storm" | "night";

const props = withDefaults(
  defineProps<{
    at: LocationId;
    target: LocationId | null;
    built: BuildId[];
    weather: Weather;
    highlight: LocationId[];
    disabled: boolean;
    day: number;
    res?: Resources | null;
  }>(),
  { res: null, target: null, built: () => [], weather: "calm", highlight: () => [], disabled: false, day: 1 },
);
const emit = defineEmits<{ go: [loc: LocationId]; arrived: [loc: LocationId] }>();

// ---------- layout: portrait phones get their own composition ----------
const root = ref<HTMLElement | null>(null);
const isTall = ref(false);
const L = computed(() => (isTall.value ? LAYOUTS.tall : LAYOUTS.wide));
let ro: ResizeObserver | null = null;
function measure() {
  const el = root.value;
  if (!el || !el.clientHeight) return;
  isTall.value = el.clientWidth / el.clientHeight < 1;
}

const has = (b: BuildId) => props.built.includes(b);
const night = computed(() => props.weather === "night");

const labelH = (id: LocationId) => {
  let h = LOC_META[id].h;
  if (id === "radio" && has("big-dish")) h = isTall.value ? 138 : 160;
  if (id === "shelter" && has("storm-shelter")) h = 98;
  if (id === "lab" && has("science-lab")) h = 116;
  if (id === "habitat" && has("o2-generator")) h = 98;
  return h;
};

type Item = { k: "loc"; id: LocationId; y: number } | { k: "colony" | "wreck"; y: number };
const world = computed<Item[]>(() => {
  const l = L.value;
  const items: Item[] = LOC_IDS.map((id) => ({ k: "loc", id, y: l.locs[id].y }));
  items.push({ k: "colony", y: l.colony.y }, { k: "wreck", y: l.wreck.y });
  return items.sort((a, b) => a.y - b.y);
});

const avoid = computed(() => {
  const l = L.value;
  const a = LOC_IDS.map((id) => ({ x: l.locs[id].x, y: l.locs[id].y, r: 110 * l.locs[id].s }));
  a.push({ x: l.wreck.x, y: l.wreck.y, r: 110 * l.wreck.s }, { x: l.colony.x, y: l.colony.y, r: 80 * l.colony.s });
  return a;
});

const hoverId = ref<LocationId | null>(null);
const onHover = (id: LocationId, on: boolean) => {
  if (on) hoverId.value = id;
  else if (hoverId.value === id) hoverId.value = null;
};
const onGo = (id: LocationId) => {
  if (props.disabled) return;
  emit("go", id);
};

// ---------- Tobish: walk / hop along the ground ----------
const tbEl = ref<SVGGElement | null>(null);
const shEl = ref<SVGEllipseElement | null>(null);
const moving = ref(false);
const air = ref(false);
const face = ref<1 | -1>(1);
const puffs = reactive<{ id: number; x: number; y: number; s: number }[]>([]);
let puffId = 0;
const timers: number[] = [];
const cur = { x: 0, y: 0, s: 1 };
let curLoc: LocationId = props.at;
let walking = false;
let tween: gsap.core.Tween | null = null;
const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function stand(loc: LocationId) {
  const l = L.value;
  const p = l.locs[loc];
  return { x: p.x + LOC_META[loc].stand * p.s, y: p.y + 34 * p.s, s: p.s * l.tScale };
}

function apply(x: number, y: number, hop: number, s: number) {
  cur.x = x; cur.y = y; cur.s = s;
  tbEl.value?.setAttribute("transform", `translate(${x.toFixed(1)} ${(y - hop).toFixed(1)}) scale(${s.toFixed(3)})`);
  const sh = shEl.value;
  if (sh) {
    const k = 1 - Math.min(0.4, hop / (90 * s));
    sh.setAttribute("cx", x.toFixed(1));
    sh.setAttribute("cy", (y + 1).toFixed(1));
    sh.setAttribute("rx", (17 * s * k).toFixed(1));
    sh.setAttribute("ry", (4.6 * s * k).toFixed(1));
    sh.setAttribute("opacity", (0.38 * k).toFixed(2));
  }
  root.value?.style.setProperty("--par", (((x / L.value.W) - 0.5) * 2).toFixed(3));
}

function snap(loc: LocationId) {
  const p = stand(loc);
  curLoc = loc;
  apply(p.x, p.y, 0, p.s);
}

function puff(x: number, y: number, s: number) {
  if (reduced()) return;
  const id = ++puffId;
  puffs.push({ id, x, y, s });
  timers.push(window.setTimeout(() => {
    const i = puffs.findIndex((q) => q.id === id);
    if (i >= 0) puffs.splice(i, 1);
  }, 800));
}

function startWalk(dest: LocationId) {
  tween?.kill();
  const from = { ...cur };
  const to = stand(dest);
  const dx = to.x - from.x;
  const dist = Math.hypot(dx, (to.y - from.y) * 1.6);
  if (dist < 6) {
    curLoc = dest;
    timers.push(window.setTimeout(() => emit("arrived", dest), 220));
    return;
  }
  if (Math.abs(dx) > 4) face.value = dx >= 0 ? 1 : -1;
  const rm = reduced();
  const W = L.value.W;
  const dur = rm ? 0.5 : clamp(0.9 + (dist / W) * 1.6, 1, 1.8);
  const hops = rm ? 0 : clamp(Math.round(dist / (W * 0.085)), 1, 6);
  const ease = gsap.parseEase("sine.inOut");
  const o = { t: 0 };
  let last = 0;
  walking = true;
  moving.value = true;
  tween = gsap.to(o, {
    t: 1, duration: dur, ease: "none",
    onUpdate() {
      const e = ease(o.t);
      const x = lerp(from.x, to.x, e), y = lerp(from.y, to.y, e), s = lerp(from.s, to.s, e);
      let hop = 0;
      if (hops) {
        const ph = o.t * hops;
        const idx = Math.floor(ph);
        const u = ph - idx;
        hop = 30 * s * 4 * u * (1 - u);
        if (idx > last) { last = idx; puff(x, y, s); }
      }
      const a = hop > 3;
      if (a !== air.value) air.value = a;
      apply(x, y, hop, s);
    },
    onComplete() {
      walking = false;
      moving.value = false;
      air.value = false;
      apply(to.x, to.y, 0, to.s);
      puff(to.x, to.y, to.s);
      curLoc = dest;
      emit("arrived", dest);
    },
  });
}

// ---------- camera: zoom toward the place Tobish walks to, ease back out on the map, subtle pointer parallax ----------
const cam = ref<HTMLElement | null>(null);
const camS = { z: 1.03, fx: 0.5, fy: 0.55 }; // z = zoom, fx/fy = focus point as a fraction of the container
const parS = { x: 0, y: 0 };
let camTween: gsap.core.Tween | null = null;
function applyCam() {
  const el = cam.value, r = root.value;
  if (!el || !r) return;
  const cw = r.clientWidth, ch = r.clientHeight;
  const z = camS.z;
  let tx = cw / 2 - camS.fx * cw * z + parS.x, ty = ch * 0.5 - camS.fy * ch * z + parS.y;
  tx = Math.min(0, Math.max(cw - cw * z, tx)); ty = Math.min(0, Math.max(ch - ch * z, ty));
  el.style.transform = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0) scale(${z.toFixed(4)})`;
}
function fracAt(x: number, y: number) {
  const r = root.value, l = L.value;
  if (!r) return { fx: 0.5, fy: 0.55 };
  const cw = r.clientWidth, ch = r.clientHeight, k = Math.max(cw / l.W, ch / l.H);
  return { fx: ((cw - l.W * k) / 2 + x * k) / cw, fy: ((ch - l.H * k) / 2 + y * k) / ch };
}
function camTo(z: number, id: LocationId | { x: number; y: number } | null, dur = 1.1) {
  const f = !id ? { fx: 0.5, fy: 0.55 } : typeof id === "string" ? fracAt(L.value.locs[id].x, L.value.locs[id].y - 30) : fracAt(id.x, id.y);
  camTween?.kill();
  if (reduced()) { Object.assign(camS, { z: 1.03, fx: 0.5, fy: 0.55 }); applyCam(); return; }
  camTween = gsap.to(camS, { z, fx: f.fx, fy: f.fy, duration: dur, ease: "power2.inOut", onUpdate: applyCam });
}
const focused = ref(false);
watch(() => props.disabled, (d) => {
  if (!d && !props.target) { focused.value = false; camTo(1.03, null, 1.2); }
});
// a brand-new building: sparkle burst + the camera swings over to admire it
const BUILD_AT: Partial<Record<BuildId, LocationId>> = {
  "o2-generator": "habitat", garden: "greenhouse", "big-dish": "radio", "storm-shelter": "shelter", "battery-bank": "solar", "science-lab": "lab",
};
const bursts = reactive<{ id: number; x: number; y: number }[]>([]);
let burstId = 0;
let admireT = 0;
const SPARK = Array.from({ length: 12 }, (_, i) => ({ a: (i / 12) * Math.PI * 2, d: 70 + (i % 3) * 26, c: ["#ffd23f", "#fff3a8", "#7fd6ff"][i % 3] }));
watch(() => props.built.join(","), (n, o) => {
  if (o === undefined || !root.value) return;
  const old = o ? o.split(",") : [];
  const fresh = n.split(",").filter((b) => b && !old.includes(b)) as BuildId[];
  if (!fresh.length) return;
  const l = L.value;
  const b = fresh[0];
  const lid = BUILD_AT[b];
  const pt = lid ? { x: l.locs[lid].x, y: l.locs[lid].y - 50 * l.locs[lid].s } : b === "colony" ? { x: l.colony.x, y: l.colony.y - 30 } : { x: l.city.x, y: l.city.y - 40 };
  const id = ++burstId;
  window.setTimeout(() => bursts.push({ id, ...pt }), 350);
  timers.push(window.setTimeout(() => { const i = bursts.findIndex((q) => q.id === id); if (i >= 0) bursts.splice(i, 1); }, 2400));
  if (focused.value) return;
  camTo(1.22, pt, 1.2);
  clearTimeout(admireT);
  admireT = window.setTimeout(() => { if (!focused.value) camTo(1.03, null, 1.4); }, 2700);
});
onBeforeUnmount(() => clearTimeout(admireT));

function onPointerMove(e: PointerEvent) {
  if (e.pointerType !== "mouse" || !root.value) return;
  const r = root.value.getBoundingClientRect();
  parS.x = -((e.clientX - r.left) / r.width - 0.5) * 16;
  parS.y = -((e.clientY - r.top) / r.height - 0.5) * 10;
  if (!camTween?.isActive()) applyCam();
}

watch(() => props.target, (t) => { if (t) { startWalk(t); focused.value = true; camTo(1.14, t, 1.3); } });
watch(() => props.at, (a) => { if (!walking) snap(a); });
watch(isTall, () => { if (!walking) snap(curLoc); });

onMounted(() => {
  measure();
  if (root.value && typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => { measure(); applyCam(); });
    ro.observe(root.value);
  }
  snap(props.at);
  applyCam();
  if (props.target && props.target !== props.at) startWalk(props.target);
});
onBeforeUnmount(() => {
  ro?.disconnect();
  tween?.kill();
  camTween?.kill();
  timers.forEach((t) => clearTimeout(t));
});

// ---------- the base shows its own state ----------
const lowO2 = computed(() => !!props.res && props.res.oxygen <= 30);
const lowEn = computed(() => !!props.res && props.res.energy <= 30);
const lowSh = computed(() => !!props.res && props.res.shield <= 30);
const lowFood = computed(() => !!props.res && props.res.food <= 30);
const thriving = computed(() => !!props.res && Object.values(props.res).every((v) => v >= 65));
const pos = (id: LocationId, dx: number, dy: number) => {
  const p = L.value.locs[id];
  return `translate(${p.x + dx * p.s} ${p.y + dy * p.s}) scale(${p.s})`;
};

// ---------- weather decorations ----------
const streaks = (() => {
  const r = rng(5);
  return Array.from({ length: 30 }, () => ({
    x: r() * 1300 - 100, y: r() * 800 - 250, len: 40 + r() * 70, w: 1.6 + r() * 2.4,
    d: -r() * 1.4, dur: 0.7 + r() * 0.6, c: ["#ffb347", "#ff6b3d", "#ffe08a", "#ff8a5c"][Math.floor(r() * 4)],
  }));
})();
</script>

<template>
  <div ref="root" class="mn-sc" :class="['w-' + weather, { tall: isTall, off: disabled, 'low-en': lowEn, thriving }]" @pointermove="onPointerMove">
    <div ref="cam" class="mn-cam">
    <svg class="mn-svg" :viewBox="`0 0 ${L.W} ${L.H}`" preserveAspectRatio="xMidYMid slice" role="group" aria-label="Moon base map">
      <defs>
        <linearGradient id="mnSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#050d24" /><stop offset=".35" stop-color="#0b1b3a" /><stop offset=".75" stop-color="#123a5c" /><stop offset="1" stop-color="#1d6c86" />
        </linearGradient>
        <linearGradient id="mnHaze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#4fd1ff" stop-opacity="0" /><stop offset=".75" stop-color="#4fd1ff" stop-opacity=".2" /><stop offset="1" stop-color="#9eeaff" stop-opacity=".38" />
        </linearGradient>
        <radialGradient id="mnNebT"><stop offset="0" stop-color="#1fb6c7" stop-opacity=".32" /><stop offset="1" stop-color="#1fb6c7" stop-opacity="0" /></radialGradient>
        <radialGradient id="mnNebP"><stop offset="0" stop-color="#d6509f" stop-opacity=".2" /><stop offset="1" stop-color="#d6509f" stop-opacity="0" /></radialGradient>
        <radialGradient id="mnNebB"><stop offset="0" stop-color="#5a6eff" stop-opacity=".26" /><stop offset="1" stop-color="#5a6eff" stop-opacity="0" /></radialGradient>
        <linearGradient id="mnShoot" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#fff" /><stop offset="1" stop-color="#fff" stop-opacity="0" /></linearGradient>
        <radialGradient id="mnSunGlow"><stop offset="0" stop-color="#fff6d0" stop-opacity=".95" /><stop offset=".22" stop-color="#ffd27a" stop-opacity=".4" /><stop offset="1" stop-color="#ffb060" stop-opacity="0" /></radialGradient>
        <radialGradient id="mnStreak"><stop offset="0" stop-color="#fff" stop-opacity=".9" /><stop offset=".4" stop-color="#ffd27a" stop-opacity=".4" /><stop offset="1" stop-color="#ff9f43" stop-opacity="0" /></radialGradient>
        <radialGradient id="mnOcean" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#6ad0ff" /><stop offset=".5" stop-color="#2f8be6" /><stop offset="1" stop-color="#1454a6" /></radialGradient>
        <radialGradient id="mnEarthShade" cx=".35" cy=".3" r=".85"><stop offset=".5" stop-color="#040c2c" stop-opacity="0" /><stop offset="1" stop-color="#040c2c" stop-opacity=".62" /></radialGradient>
        <radialGradient id="mnEarthGlow"><stop offset="0" stop-color="#82d2ff" stop-opacity=".55" /><stop offset=".59" stop-color="#82d2ff" stop-opacity=".55" /><stop offset="1" stop-color="#82d2ff" stop-opacity="0" /></radialGradient>
        <clipPath id="mnEarthClip"><circle r="100" /></clipPath>

        <linearGradient id="mnMtnFar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a86ae" /><stop offset="1" stop-color="#86abc8" /></linearGradient>
        <linearGradient id="mnMtnMid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7690b8" /><stop offset="1" stop-color="#a9b6d0" /></linearGradient>
        <linearGradient id="mnMtnNear" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ca7c8" /><stop offset="1" stop-color="#c6cbde" /></linearGradient>
        <linearGradient id="mnGround" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9cddd" /><stop offset=".3" stop-color="#d8dae7" /><stop offset=".75" stop-color="#bdc1d5" /><stop offset="1" stop-color="#9a9fba" /></linearGradient>
        <radialGradient id="mnGroundSun" cx=".08" cy=".1" r=".9"><stop offset="0" stop-color="#fff4dc" stop-opacity=".55" /><stop offset="1" stop-color="#fff4dc" stop-opacity="0" /></radialGradient>
        <linearGradient id="mnGroundShade" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#4c5282" stop-opacity="0" /><stop offset="1" stop-color="#4c5282" stop-opacity=".38" /></linearGradient>
        <radialGradient id="mnPatchD"><stop offset="0" stop-color="#6f77a6" stop-opacity=".22" /><stop offset="1" stop-color="#6f77a6" stop-opacity="0" /></radialGradient>
        <radialGradient id="mnPatchL"><stop offset="0" stop-color="#fffaf0" stop-opacity=".38" /><stop offset="1" stop-color="#fffaf0" stop-opacity="0" /></radialGradient>
        <linearGradient id="mnCrater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#979fb7" /><stop offset="1" stop-color="#cbcfdf" /></linearGradient>
        <linearGradient id="mnRock" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e0e3ee" /><stop offset="1" stop-color="#8e93a8" /></linearGradient>

        <radialGradient id="mnDome" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#fff" /><stop offset=".55" stop-color="#e3e7f6" /><stop offset="1" stop-color="#aab2d2" /></radialGradient>
        <linearGradient id="mnGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a6f3ff" stop-opacity=".6" /><stop offset="1" stop-color="#3fc1d9" stop-opacity=".3" /></linearGradient>
        <linearGradient id="mnMetal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0f2fb" /><stop offset="1" stop-color="#a8b0c8" /></linearGradient>
        <linearGradient id="mnTower" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f4f6fc" /><stop offset="1" stop-color="#aeb6ce" /></linearGradient>
        <radialGradient id="mnMound" cx=".35" cy=".25" r=".9"><stop offset="0" stop-color="#dcdee9" /><stop offset="1" stop-color="#9ba0b9" /></radialGradient>
        <linearGradient id="mnPanel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#55a2ff" /><stop offset="1" stop-color="#1a47b8" /></linearGradient>
        <linearGradient id="mnTank" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b4f2ff" /><stop offset="1" stop-color="#2aa9d8" /></linearGradient>
        <linearGradient id="mnWin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c2" /><stop offset="1" stop-color="#ffb64d" /></linearGradient>
        <linearGradient id="mnScreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2166b0" /><stop offset="1" stop-color="#0d2a52" /></linearGradient>
        <linearGradient id="mnDoor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#97a1c6" /><stop offset="1" stop-color="#586288" /></linearGradient>
        <radialGradient id="mnDish" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#f1f3fb" /><stop offset="1" stop-color="#8f99be" /></radialGradient>
        <radialGradient id="mnHaloW"><stop offset="0" stop-color="#ffd678" stop-opacity=".8" /><stop offset="1" stop-color="#ffd678" stop-opacity="0" /></radialGradient>
        <radialGradient id="mnHaloB"><stop offset="0" stop-color="#64c8ff" stop-opacity=".75" /><stop offset="1" stop-color="#64c8ff" stop-opacity="0" /></radialGradient>
        <radialGradient id="mnHaloG"><stop offset="0" stop-color="#7cf29c" stop-opacity=".4" /><stop offset="1" stop-color="#7cf29c" stop-opacity="0" /></radialGradient>
        <radialGradient id="mnHaloP"><stop offset="0" stop-color="#a78bfa" stop-opacity=".7" /><stop offset="1" stop-color="#a78bfa" stop-opacity="0" /></radialGradient>
        <radialGradient id="mnHaloK"><stop offset="0" stop-color="#ff6b9d" stop-opacity=".6" /><stop offset="1" stop-color="#ff6b9d" stop-opacity="0" /></radialGradient>
        <radialGradient id="mnHaloR"><stop offset="0" stop-color="#ff5a5f" stop-opacity=".7" /><stop offset="1" stop-color="#ff5a5f" stop-opacity="0" /></radialGradient>
        <linearGradient id="mnRocket" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" /><stop offset="1" stop-color="#bfc8e0" /></linearGradient>
        <linearGradient id="mnNose" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a7f" /><stop offset="1" stop-color="#d33a44" /></linearGradient>

        <linearGradient id="mnSuit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" /><stop offset="1" stop-color="#cdd4ea" /></linearGradient>
        <radialGradient id="mnHelmet" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#fff" /><stop offset=".7" stop-color="#d5dcf1" /><stop offset="1" stop-color="#a9b3d6" /></radialGradient>
        <linearGradient id="mnVisor" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3f7fcc" /><stop offset=".5" stop-color="#1c3d70" /><stop offset="1" stop-color="#0b1b3a" /></linearGradient>

        <linearGradient id="mnNight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1650" stop-opacity="0" /><stop offset=".22" stop-color="#0a1650" stop-opacity=".5" /><stop offset="1" stop-color="#050b3a" stop-opacity=".62" /></linearGradient>
        <radialGradient id="mnShine"><stop offset="0" stop-color="#b4dcff" stop-opacity=".5" /><stop offset="1" stop-color="#b4dcff" stop-opacity="0" /></radialGradient>
      </defs>

      <Sky :W="L.W" :H="L.H" :H0="L.H0" :weather="weather" :day="day" :earth="L.earth" :sun="L.sun" />
      <Ground :W="L.W" :H="L.H" :H0="L.H0" :weather="weather" :avoid="avoid" />
      <Ambient :W="L.W" :H="L.H" :H0="L.H0" :tall="isTall" :night="night" />

      <Extras kind="city" :x="L.city.x" :y="L.city.y" :s="L.city.s" :on="has('city')" :night="night" />

      <template v-for="it in world" :key="it.k === 'loc' ? it.id : it.k">
        <Loc v-if="it.k === 'loc'" :id="it.id" :s="L.locs[it.id].s" :built="built" :night="night"
          :highlighted="highlight.includes(it.id)" :hover="hoverId === it.id && !disabled" :transform="`translate(${L.locs[it.id].x} ${L.locs[it.id].y})`" />
        <Extras v-else-if="it.k === 'colony'" kind="colony" :x="L.colony.x" :y="L.colony.y" :s="L.colony.s" :on="has('colony')" :night="night" />
        <g v-else :transform="`translate(${L.wreck.x} ${L.wreck.y}) scale(${L.wreck.s})`"><Wreck /></g>
      </template>

      <!-- night: deep blue wash over the ground, lights glow on top of it -->
      <g class="night-layer">
        <rect :x="-90" :y="L.H0 - 90" :width="L.W + 180" :height="L.H - L.H0 + 130" fill="url(#mnNight)" />
        <ellipse :cx="L.earth.x" :cy="L.H0 + 90" :rx="L.W * 0.34" :ry="L.H * 0.16" fill="url(#mnShine)" />
        <Extras kind="city" lights-only :x="L.city.x" :y="L.city.y" :s="L.city.s" :on="has('city')" :night="night" />
        <Extras kind="colony" lights-only :x="L.colony.x" :y="L.colony.y" :s="L.colony.s" :on="has('colony')" :night="night" />
        <Loc v-for="id in LOC_IDS" :key="'l' + id" :id="id" lights-only :s="L.locs[id].s" :built="built" :night="night"
          :transform="`translate(${L.locs[id].x} ${L.locs[id].y})`" />
      </g>

      <!-- base status lights: kids can SEE low supplies -->
      <g class="st" aria-hidden="true">
        <g v-if="lowO2" :transform="pos('habitat', 26, -92)"><circle class="st-red" r="26" fill="url(#mnHaloR)" /><circle class="st-beacon" r="5" fill="#ff4d4d" stroke="#fff" stroke-width="1.5" /></g>
        <g v-if="lowSh" :transform="pos('shelter', 0, -30)"><ellipse class="st-blue" rx="90" ry="60" fill="url(#mnHaloB)" /></g>
        <g v-if="lowFood" :transform="pos('greenhouse', 0, -40)"><ellipse class="st-amber" rx="84" ry="56" fill="url(#mnHaloW)" /></g>
        <g v-if="lowEn" :transform="pos('solar', -40, -30)"><ellipse class="st-amber" rx="100" ry="46" fill="url(#mnHaloW)" /></g>
      </g>

      <g v-for="b in bursts" :key="b.id" :transform="`translate(${b.x} ${b.y})`" class="bst" aria-hidden="true">
        <circle class="bst-ring" r="40" fill="none" stroke="#ffd23f" stroke-width="5" />
        <circle class="bst-glow" r="90" fill="url(#mnHaloW)" />
        <circle v-for="(sp, i) in SPARK" :key="i" class="bst-sp" r="5" :fill="sp.c"
          :style="{ '--x': Math.cos(sp.a) * sp.d + 'px', '--y': Math.sin(sp.a) * sp.d - 20 + 'px', animationDelay: (i % 4) * 0.05 + 's' }" />
      </g>

      <!-- Tobish + dust -->
      <ellipse ref="shEl" fill="#4c5282" opacity=".38" />
      <g v-for="p in puffs" :key="p.id" :transform="`translate(${p.x} ${p.y}) scale(${p.s})`">
        <circle class="pf pf1" cx="-8" cy="-3" r="5" /><circle class="pf pf2" cx="8" cy="-3" r="5" /><circle class="pf pf3" cx="0" cy="-5" r="6.5" />
      </g>
      <g ref="tbEl"><Tobish :moving="moving" :air="air" :face="face" :night="night" /></g>

      <!-- name pills + hit areas -->
      <LocLabel v-for="id in LOC_IDS" :key="'lb' + id" :id="id" :x="L.locs[id].x" :y="L.locs[id].y" :s="L.locs[id].s" :h="labelH(id)"
        :size="L.labelSize" :highlighted="highlight.includes(id)" :hover="hoverId === id" :disabled="disabled"
        @go="onGo" @hover="(on) => onHover(id, on)" />
    </svg>
    </div>

    <!-- screen-space weather -->
    <div class="ov ov-flare"><i class="pl" /></div>
    <div class="ov ov-storm"><i class="pl" /></div>
    <svg class="ov ov-streaks" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g v-for="(s, i) in streaks" :key="i" :transform="`translate(${s.x} ${s.y})`">
        <line class="streak" x1="0" y1="0" :x2="-s.len * 0.55" :y2="s.len * 0.84" :stroke="s.c" :stroke-width="s.w" stroke-linecap="round"
          :style="{ animationDelay: s.d + 's', animationDuration: s.dur + 's' }" />
      </g>
    </svg>
    <div class="ov ov-night" />
    <div class="ov ov-dim" />
    <div class="ov ov-glow" />
  </div>
</template>

<style scoped>
.mn-sc { position: relative; width: 100%; height: 100%; overflow: hidden; background: #0b1b3a; user-select: none; -webkit-user-select: none; touch-action: manipulation; --par: 0; }
.mn-cam { position: absolute; inset: 0; transform-origin: 0 0; will-change: transform; }
.st-red { animation: stpulse 0.9s ease-in-out infinite; }
.st-beacon { animation: stblink 0.9s steps(1) infinite; }
.st-blue { animation: stpulse 1.5s ease-in-out infinite; }
.st-amber { animation: stpulse 1.8s ease-in-out infinite; }
.bst { pointer-events: none; }
.bst-ring { transform-box: fill-box; transform-origin: center; animation: bring 1.1s ease-out both; }
.bst-glow { transform-box: fill-box; transform-origin: center; animation: bglow 1.8s ease-out both; }
.bst-sp { animation: bsp 1.3s cubic-bezier(.2,.7,.3,1) both; }
@keyframes bring { from { transform: scale(0.3); opacity: 1; } to { transform: scale(3.2); opacity: 0; } }
@keyframes bglow { 0% { transform: scale(0.3); opacity: 0; } 25% { opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
@keyframes bsp { 0% { transform: translate(0, 0) scale(0.3); opacity: 1; } 70% { opacity: 1; } 100% { transform: translate(var(--x), calc(var(--y) + 24px)) scale(1); opacity: 0; } }
.st, .st * { pointer-events: none; }
.st-red, .st-blue, .st-amber { transform-box: fill-box; transform-origin: center; }
@keyframes stpulse { 0%, 100% { opacity: 0.25; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.1); } }
@keyframes stblink { 50% { opacity: 0.15; } }
.ov-dim { background: rgba(3, 8, 28, 0.42); transition: opacity 1.2s; }
.low-en .ov-dim { opacity: 1; animation: flick 3.4s steps(1) infinite; }
@keyframes flick { 0%, 100% { opacity: 1; } 8% { opacity: 0.35; } 10% { opacity: 1; } 52% { opacity: 0.7; } 54% { opacity: 1; } }
.ov-glow { background: radial-gradient(ellipse at 50% 85%, rgba(255, 214, 120, 0.22), rgba(255, 214, 120, 0) 60%); }
.thriving .ov-glow { opacity: 1; }
.mn-svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }

.night-layer { opacity: 0; transition: opacity 1s ease; pointer-events: none; }
.w-night .night-layer { opacity: 1; }

.pf { fill: #eceef7; opacity: 0; transform-box: fill-box; transform-origin: center; animation: puff 0.75s ease-out forwards; }
.pf2 { animation-delay: 0.03s; } .pf3 { animation-delay: 0.06s; }
.pf1 { --dx: -22px; } .pf2 { --dx: 22px; } .pf3 { --dx: 0px; }
@keyframes puff { 0% { opacity: 0.85; transform: translate(0, 0) scale(0.4); } 100% { opacity: 0; transform: translate(var(--dx), -12px) scale(1.9); } }

/* weather overlays */
.ov { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; opacity: 0; transition: opacity 1s ease; }
.pl { position: absolute; inset: 0; display: block; }
.ov-flare .pl {
  background: linear-gradient(105deg, rgba(255, 165, 40, 0.5) 0%, rgba(255, 205, 90, 0.2) 34%, rgba(255, 180, 60, 0) 64%),
    radial-gradient(circle at 9% 13%, rgba(255, 232, 160, 0.5), rgba(255, 232, 160, 0) 38%);
  animation: pulse 2.4s ease-in-out infinite;
}
.w-flare .ov-flare { opacity: 1; }
.ov-storm .pl {
  background: radial-gradient(ellipse at 50% 55%, rgba(255, 70, 40, 0.1) 40%, rgba(255, 40, 30, 0.5) 100%);
  animation: pulse 1.3s ease-in-out infinite;
}
.ov-storm { background: rgba(255, 90, 40, 0.14); }
.w-storm .ov-storm, .w-storm .ov-streaks { opacity: 1; }
.streak { opacity: 0; animation: streak 1s linear infinite; }
@keyframes streak {
  0% { opacity: 0; transform: translate(0, 0); }
  15% { opacity: 0.95; }
  100% { opacity: 0; transform: translate(-300px, 460px); }
}
.ov-night { background: radial-gradient(ellipse at 50% 55%, rgba(2, 6, 30, 0) 50%, rgba(2, 6, 30, 0.5) 100%); }
.w-night .ov-night { opacity: 1; }
@keyframes pulse { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }

@media (prefers-reduced-motion: reduce) {
  .pl, .streak, .st *, .ov-dim, .bst * { animation: none !important; }
  .streak { opacity: 0.55; }
  .ov { transition-duration: 0.01s; }
}
</style>
