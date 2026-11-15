<script setup lang="ts">
// Computer overlay: connecting -> signal -> "your name, Commander" (INTERACTIVE) -> greeting with the name -> pull back to the base map.
import { nextTick, ref } from "vue";
import { gsap } from "gsap";
import { INTRO_LINES } from "../../../moon/intro-lines";
import { sfx } from "../../../moon/sfx";
import type { IntroApi } from "./api";

const mon = ref<HTMLElement | null>(null);
const inp = ref<HTMLInputElement | null>(null);
const phase = ref<"boot" | "connect" | "ok" | "name" | "hello">("boot");
const log = ref<string[]>([]);
const blocks = ref(0);
const name = ref("");
const greet = ref("");
const hint = ref(false);
let resolveName: ((n: string) => void) | null = null;
const DEFAULT = "Commander";
const s7c = INTRO_LINES.find((l) => l.id === "s7c")!;

function submit() {
  if (!resolveName) return;
  const n = name.value.replace(/\s+/g, " ").trim().slice(0, 14) || DEFAULT;
  const f = resolveName;
  resolveName = null;
  sfx.click();
  f(n);
}
function typeTo(api: IntroApi, text: string, cps = 30) {
  const o = { n: 0 };
  return new Promise<void>((res) => {
    api.track(gsap.to(o, {
      n: text.length, duration: text.length / cps, ease: "none",
      onUpdate() { const k = Math.floor(o.n); if (k !== greet.value.length) { greet.value = text.slice(0, k); if (k % 3 === 0) sfx.typewriter(); } },
      onComplete() { greet.value = text; res(); },
    }));
  });
}

async function run(api: IntroApi): Promise<{ name: string }> {
  gsap.fromTo(mon.value, { scale: 1.06, opacity: 0, y: 16 }, { scale: 1, opacity: 1, y: 0, duration: 0.9, ease: "power3.out" });
  sfx.static();
  for (const l of ["> POWER ............ OK", "> RADIO ARRAY ...... OK", "> AIMING DISH AT EARTH"]) {
    log.value.push(l);
    sfx.typewriter();
    await api.wait(0.45);
  }
  phase.value = "connect";
  for (const b of [1, 2, 3, 3, 4, 6, 7, 8, 10]) {
    blocks.value = b;
    sfx.beep();
    await api.wait(0.32 + (b === 3 ? 0.35 : 0));
    if (!api.alive()) return { name: DEFAULT };
  }
  sfx.powerUp();
  phase.value = "ok";
  await api.wait(0.6);
  await api.line("s7a");
  if (!api.alive()) return { name: DEFAULT };

  const lb = api.line("s7b");
  phase.value = "name";
  await nextTick();
  try { if (window.matchMedia("(pointer: fine)").matches) inp.value?.focus(); } catch {}
  await lb;
  const who = await new Promise<string>((res) => {
    resolveName = res;
    api.wait(9).then(() => { if (resolveName) hint.value = true; });
  });
  if (!api.alive()) return { name: DEFAULT };
  inp.value?.blur();

  // the greeting shows the name ON SCREEN; the voice clip still says the original text
  const shown = who === DEFAULT ? s7c.text : s7c.text.replace("Commander!", `Commander ${who}!`);
  phase.value = "hello";
  const sP = api.line("s7c", shown);
  await Promise.all([typeTo(api, shown), sP]);
  await api.wait(0.5);
  api.hideSub();

  // pull back from the screen towards the lab on the base map
  const lab = api.labPos();
  const host = mon.value!.closest(".mi") as HTMLElement;
  const rect = mon.value!.getBoundingClientRect();
  const rr = host.getBoundingClientRect();
  const dx = lab.x - (rect.left - rr.left + rect.width / 2);
  const dy = lab.y - (rect.top - rr.top + rect.height / 2);
  sfx.whoosh();
  api.reveal(1.6);
  await new Promise<void>((res) => {
    api.track(gsap.timeline({ onComplete: () => res() }))
      .to(mon.value, { scale: 0.13, x: dx, y: dy, duration: 1.7, ease: "power3.inOut" }, 0)
      .to(mon.value, { opacity: 0, duration: 0.5, ease: "power1.in" }, 1.25);
  });
  return { name: who };
}
defineExpose({ run });
</script>

<template>
  <div class="mi-ov s7">
    <div class="s7__wrap">
      <div ref="mon" class="s7__mon" style="opacity: 0">
        <div class="s7__case">
          <div class="s7__scr">
            <div class="s7__hdr"><span class="s7__dot" /> MISSION CONTROL LINK <em>TOBISH-1</em></div>
            <div class="s7__body">
              <div v-for="(l, i) in log" :key="i" class="s7__log">{{ l }}</div>
              <div v-if="phase === 'connect'" class="s7__conn">
                <div class="s7__big">CONNECTING TO MISSION CONTROL<span class="s7__dots">…</span></div>
                <div class="s7__blocks"><b v-for="k in 10" :key="k" :class="{ on: k <= blocks }">▮</b></div>
              </div>
              <div v-if="phase === 'ok' || phase === 'name'" class="s7__ok">
                <svg class="s7__globe" viewBox="-60 -60 120 120" aria-hidden="true">
                  <circle r="30" fill="#2f8be6" /><path d="M-14 -16 C-6 -24 8 -20 12 -8 C4 -2 -6 -6 -12 4 C-18 0 -18 -10 -14 -16Z" fill="#4cb86f" /><path d="M6 8 C16 4 24 12 20 22 C12 26 6 20 6 8Z" fill="#5fcf82" />
                  <circle r="30" fill="none" stroke="#bfeaff" stroke-opacity=".7" stroke-width="1.6" />
                  <circle v-for="k in 2" :key="k" class="s7-ring" r="30" fill="none" stroke="#7ff0ff" stroke-width="1.6" :style="{ animationDelay: k * 0.8 + 's' }" />
                </svg>
                <div class="s7__big s7__good"><span class="s7__bars"><i /><i /><i /><i /></span> SIGNAL ESTABLISHED</div>
              </div>
              <form v-if="phase === 'name'" class="s7__form" @submit.prevent="submit">
                <label for="s7name" class="s7__lbl">YOUR NAME, COMMANDER</label>
                <div class="s7__row">
                  <span class="s7__prompt">&gt;</span>
                  <input id="s7name" ref="inp" v-model="name" class="s7__inp" type="text" maxlength="14" inputmode="text" enterkeyhint="done" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Commander" aria-label="Your name, Commander" />
                  <button class="s7__ok-btn" type="submit">OK ▶</button>
                </div>
                <div class="s7__hint" :class="{ show: hint }">Type your name and press OK</div>
              </form>
              <div v-if="phase === 'hello'" class="s7__hello"><span class="s7__who">TOBISH ▸</span> {{ greet }}<span class="s7__cur">▮</span></div>
            </div>
            <div class="s7__scan" /><div class="s7__glare" />
          </div>
          <div class="s7__foot"><i class="g" /><i class="a" /><i class="p" /><span class="s7__grille"><b v-for="k in 8" :key="k" /></span></div>
        </div>
        <div class="s7__stand" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.s7__wrap { position: absolute; inset: 0; display: flex; align-items: flex-start; justify-content: center; padding-top: calc(var(--bar) + clamp(44px, 9vh, 92px)); pointer-events: none; }
.s7__mon { position: relative; width: min(92vw, 640px); pointer-events: auto; filter: drop-shadow(0 30px 40px rgba(0, 0, 0, 0.5)); }
.s7__case { position: relative; background: linear-gradient(160deg, #66719a, #323a58 60%, #262c45); border-radius: 30px; padding: 4.2% 4.2% 3.6%; box-shadow: inset 0 3px 0 rgba(255, 255, 255, 0.28), inset 0 -8px 0 rgba(0, 0, 0, 0.28), 0 0 90px rgba(63, 208, 255, 0.28); }
.s7__scr { position: relative; container-type: inline-size; aspect-ratio: 4 / 3.1; border-radius: 6cqw; overflow: hidden; background: radial-gradient(ellipse at 50% 40%, #07384a, #021018 85%); box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.8), inset 0 0 0 3px #0a1c28, 0 0 0 4px #161c30; color: #7ff0ff; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-weight: 700; text-shadow: 0 0 8px rgba(127, 240, 255, 0.8); }
.s7__hdr { display: flex; align-items: center; gap: 2cqw; padding: 2.6cqw 4cqw; font-size: 3.1cqw; letter-spacing: 0.12em; background: rgba(127, 240, 255, 0.1); border-bottom: 1px solid rgba(127, 240, 255, 0.35); }
.s7__hdr em { margin-left: auto; font-style: normal; opacity: 0.6; }
.s7__dot { width: 2.4cqw; height: 2.4cqw; border-radius: 50%; background: #2fe08a; box-shadow: 0 0 8px #2fe08a; animation: s7b 1s infinite; }
.s7__body { padding: 3cqw 4.4cqw; font-size: 3.6cqw; line-height: 1.4; }
.s7__log { opacity: 0.8; font-size: 3.2cqw; }
.s7__big { font-size: 4.6cqw; letter-spacing: 0.04em; margin-top: 2.4cqw; font-family: "Fredoka", ui-monospace, monospace; }
.s7__blocks { margin-top: 2.2cqw; font-size: 8cqw; line-height: 1; letter-spacing: 0.5cqw; }
.s7__blocks b { color: #0f3a48; text-shadow: none; transition: color 0.12s; }
.s7__blocks b.on { color: #7ff0ff; text-shadow: 0 0 10px #7ff0ff; }
.s7__dots { animation: s7b 0.8s infinite; }
.s7__ok { display: flex; align-items: center; gap: 4cqw; margin-top: 2.6cqw; }
.s7__globe { width: 17cqw; flex: none; overflow: visible; }
.s7-ring { transform-box: fill-box; transform-origin: center; animation: s7r 1.8s ease-out infinite; }
@keyframes s7r { from { transform: scale(1); opacity: 0.8; } to { transform: scale(2.4); opacity: 0; } }
.s7__good { margin: 0; color: #7cf29c; text-shadow: 0 0 10px #2fe08a; display: flex; align-items: center; gap: 2.4cqw; }
.s7__bars { display: inline-flex; align-items: flex-end; gap: 0.7cqw; height: 5cqw; }
.s7__bars i { width: 1.2cqw; background: #7cf29c; border-radius: 1px; } .s7__bars i:nth-child(1) { height: 25%; } .s7__bars i:nth-child(2) { height: 50%; } .s7__bars i:nth-child(3) { height: 75%; } .s7__bars i:nth-child(4) { height: 100%; }
.s7__form { margin-top: 3cqw; }
.s7__lbl { display: block; font-size: 3.4cqw; letter-spacing: 0.14em; color: #ffd23f; text-shadow: 0 0 8px rgba(255, 210, 63, 0.7); margin-bottom: 1.6cqw; }
.s7__row { display: flex; align-items: center; gap: 2cqw; }
.s7__prompt { font-size: 5cqw; }
.s7__inp { flex: 1; min-width: 0; min-height: 44px; font: inherit; font-size: max(16px, 5cqw); letter-spacing: 0.06em; color: #fff; background: rgba(127, 240, 255, 0.12); border: 2px solid #7ff0ff; border-radius: 2cqw; padding: 1.2cqw 2.6cqw; outline: none; text-shadow: 0 0 8px #7ff0ff; caret-color: #ffd23f; box-shadow: 0 0 18px rgba(127, 240, 255, 0.35); }
.s7__inp::placeholder { color: rgba(127, 240, 255, 0.4); }
.s7__ok-btn { min-height: 44px; min-width: 44px; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: max(15px, 4.4cqw); color: #062a1a; background: linear-gradient(180deg, #8dffb4, #2fe08a); border: 0; border-radius: 2cqw; padding: 0 3.4cqw; cursor: pointer; box-shadow: 0 4px 0 #148a52; text-shadow: none; animation: s7p 1s ease-in-out infinite; touch-action: manipulation; }
.s7__ok-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 #148a52; }
.s7__hint { margin-top: 1.6cqw; font-size: 2.8cqw; opacity: 0; transition: opacity 0.4s; color: #fff; }
.s7__hint.show { opacity: 0.8; }
.s7__hello { margin-top: 3cqw; font-size: 4.4cqw; line-height: 1.5; color: #fff; text-shadow: 0 0 10px #7ff0ff; }
.s7__who { color: #ffd23f; text-shadow: 0 0 8px #ffd23f; margin-right: 1cqw; }
.s7__cur { animation: s7b 0.7s steps(2) infinite; color: #7ff0ff; }
.s7__scan { position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.18) 0 2px, transparent 2px 4px); mix-blend-mode: multiply; }
.s7__glare { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(125deg, rgba(255, 255, 255, 0.12) 0, rgba(255, 255, 255, 0) 32%); }
.s7__foot { display: flex; align-items: center; gap: 2.4%; padding: 2.4% 3% 0; height: 28px; }
.s7__foot i { width: 11px; height: 11px; border-radius: 50%; } .s7__foot .g { background: #2fe08a; box-shadow: 0 0 10px #2fe08a; } .s7__foot .a { background: #ffb74d; } .s7__foot .p { background: #ff6b9d; }
.s7__grille { margin-left: auto; display: flex; gap: 5px; } .s7__grille b { width: 3px; height: 14px; background: #161c30; border-radius: 2px; }
.s7__stand { width: 30%; height: 18px; margin: 0 auto; background: linear-gradient(#323a58, #1a1f33); border-radius: 0 0 14px 14px; }
@keyframes s7b { 50% { opacity: 0.25; } }
@keyframes s7p { 50% { transform: scale(1.07); } }
@media (prefers-reduced-motion: reduce) { .s7__ok-btn, .s7__cur, .s7__dots, .s7-ring { animation: none; } }
</style>
