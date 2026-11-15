<script setup lang="ts">
import { isImageReady } from "../../../moon/preload";
import { ref, computed, watch } from "vue";
import type { Card, AgeBand, ResDelta, ResKey } from "../../../moon/types";
import Btn from "./Btn.vue";
import Sheet from "./Sheet.vue";
import Confetti from "./Confetti.vue";
import { RES, LOC } from "./meta";
import { LOCATION_RES } from "../../../moon/types";
import { sfx } from "../../../moon/sfx";

type Result = { picked: number; correct: boolean; final: boolean; reward: ResDelta; science: number };
const props = defineProps<{ card: Card; age: AgeBand; result: Result | null; tries: number }>();
const emit = defineEmits<{ answer: [idx: number]; close: [] }>();

const step = ref<"study" | "quiz">("study");
const showStudy = ref(false);
const wrong = ref<number[]>([]);
const shaking = ref(false);
const waiting = ref(false);
const confetti = ref(0);

const loc = computed(() => LOC[props.card.location]);
const resKey = computed(() => LOCATION_RES[props.card.location]);
const tone = computed(() => RES[resKey.value as ResKey | "science"]?.color ?? "#4fd1ff");
const letters = ["A", "B", "C", "D"];
const finished = computed(() => !!props.result && (props.result.correct || props.result.final));
const correctIdx = computed(() => props.card.question.correct);
const hintOn = computed(() => !finished.value && wrong.value.length > 0);
const rewards = computed(() => {
  const r = props.result;
  if (!r) return [];
  const out: { emoji: string; text: string }[] = [];
  (Object.entries(r.reward) as [ResKey, number][]).forEach(([k, v]) => v && out.push({ emoji: RES[k].emoji, text: `+${v} ${RES[k].label}` }));
  if (r.science) out.push({ emoji: "🔬", text: `+${r.science} Science` });
  return out;
});
const imgOk = ref(true);
// уже декодирована заранее → показываем сразу (с анимацией появления, но без ожидания сети)
const imgLoaded = ref(isImageReady(props.card.image));
const zoom = ref(false);

watch(
  () => props.card.id,
  () => {
    step.value = "study";
    showStudy.value = false;
    wrong.value = [];
    waiting.value = false;
    imgOk.value = true;
    imgLoaded.value = isImageReady(props.card.image);
    zoom.value = false;
  }
);
watch(
  () => props.result,
  (r) => {
    waiting.value = false;
    if (!r) return;
    if (r.correct) {
      sfx.correct();
      confetti.value++;
    } else {
      sfx.wrong();
      shaking.value = false;
      requestAnimationFrame(() => requestAnimationFrame(() => { shaking.value = true; setTimeout(() => (shaking.value = false), 550); }));
      if (!wrong.value.includes(r.picked)) wrong.value.push(r.picked);
    }
  }
);

function ready() {
  step.value = "quiz";
  sfx.pop();
}
function pick(i: number) {
  if (waiting.value || finished.value || wrong.value.includes(i)) return;
  waiting.value = true;
  sfx.click();
  emit("answer", i);
}
function state(i: number) {
  const r = props.result;
  if (r && r.correct && r.picked === i) return "right";
  if (r && r.final && i === correctIdx.value) return "reveal";
  if (wrong.value.includes(i)) return "wrong";
  return "";
}
</script>

<template>
  <Sheet :tone="tone">
    <template #over><Confetti v-if="confetti" :fire="confetti" /></template>
    <div class="ms">
      <div class="ms__head">
        <span class="ms__loc" :style="{ '--c': tone }">{{ loc.emoji }} {{ loc.label }}</span>
        <span class="ms__steps"><i :class="{ on: step === 'study' }" /><i :class="{ on: step === 'quiz' }" /></span>
      </div>

      <!-- STUDY -->
      <template v-if="step === 'study'">
        <div class="ms__phase">📖 Study</div>
        <h2 class="ms__title">{{ card.title }}</h2>
        <figure v-if="card.image && imgOk" class="ms__fig" :class="{ on: imgLoaded }" @click="zoom = true">
          <img class="ms__bg" :src="card.image" alt="" aria-hidden="true" />
          <img class="ms__img" :src="card.image" :alt="card.title" decoding="async" @load="imgLoaded = true" @error="imgOk = false" />
          <span class="ms__zoom" aria-hidden="true">⤢</span>
          <figcaption v-if="card.imageCredit">📷 {{ card.imageCredit }}</figcaption>
        </figure>
        <Teleport to="body">
          <Transition name="ms-lb">
            <div v-if="zoom && card.image" class="ms-lb" @click="zoom = false">
              <img :src="card.image" :alt="card.title" />
              <div v-if="card.imageCredit" class="ms-lb__cap">📷 {{ card.imageCredit }}</div>
            </div>
          </Transition>
        </Teleport>
        <div v-if="card.stat" class="ms__stat" :style="{ '--c': tone }">
          <b>{{ card.stat.value }}</b>
          <span>{{ card.stat.label }}</span>
        </div>
        <p class="ms__body">{{ card.body }}</p>
        <a class="ms__src" :href="card.source.url" target="_blank" rel="noopener">🛰️ Source: {{ card.source.name }}<span v-if="card.source.detail"> · {{ card.source.detail }}</span> ↗</a>
        <div class="ms__cta"><Btn @click="ready">I'm ready for the question →</Btn></div>
      </template>

      <!-- QUIZ -->
      <template v-else>
        <div class="ms__phase">❓ Quiz</div>
        <button class="ms__peek" @click="showStudy = !showStudy">📖 Look at the card again {{ showStudy ? "▲" : "▼" }}</button>
        <Transition name="peek">
          <div v-if="showStudy" class="ms__peekbox">
            <div v-if="card.stat" class="ms__peekstat"><b>{{ card.stat.value }}</b> {{ card.stat.label }}</div>
            {{ card.body }}
          </div>
        </Transition>

        <h2 class="ms__q">{{ card.question.q }}</h2>
        <div class="ms__opts" :class="{ 'ms__opts--shake': shaking, 'ms__opts--done': finished }">
          <button
            v-for="(o, i) in card.question.options"
            :key="i"
            class="ms__opt"
            :class="[state(i) && `is-${state(i)}`, { 'is-dim': finished && !state(i) }]"
            :disabled="finished || wrong.includes(i)"
            :style="{ '--i': i }"
            @click="pick(i)"
          >
            <span class="ms__letter">{{ state(i) === "right" || state(i) === "reveal" ? "✓" : state(i) === "wrong" ? "✕" : letters[i] }}</span>
            <span class="ms__otext">{{ o }}</span>
          </button>
        </div>

        <Transition name="box">
          <div v-if="hintOn" class="ms__hint"><b>💡 Hint:</b> {{ card.question.hint }}<div class="ms__try">Try again — you have {{ Math.max(0, 2 - tries) }} more {{ 2 - tries === 1 ? "try" : "tries" }}!</div></div>
        </Transition>

        <Transition name="box">
          <div v-if="finished && result" class="ms__done" :class="result.correct ? 'is-ok' : 'is-no'">
            <div class="ms__verdict">{{ result.correct ? (tries <= 1 ? "🎉 Perfect! Right on the first try!" : "🎉 Correct! Nice work!") : "Good effort! Here's the right answer:" }}</div>
            <div v-if="rewards.length" class="ms__rewards">
              <span v-for="(r, i) in rewards" :key="i" class="ms__rw" :style="{ '--i': i }">{{ r.text }} {{ r.emoji }}</span>
            </div>
            <p class="ms__explain">{{ card.question.explain }}</p>
            <div class="ms__cta"><Btn @click="emit('close')">Continue →</Btn></div>
          </div>
        </Transition>
      </template>
    </div>
  </Sheet>
</template>

<style scoped>
.ms__head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.ms__loc { font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 16px; padding: 5px 14px; border-radius: 99px; background: color-mix(in srgb, var(--c) 25%, transparent); border: 2px solid var(--c); }
.ms__steps { display: flex; gap: 6px; }
.ms__steps i { width: 26px; height: 8px; border-radius: 5px; background: rgba(255,255,255,.2); transition: all .3s; }
.ms__steps i.on { background: #ffd23f; }
.ms__phase { font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(255,255,255,.65); }
.ms__title { margin: 4px 0 12px; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 29px; line-height: 1.12; }
.ms__fig {
  position: relative; margin: 0 0 12px; height: 230px; border-radius: 20px; overflow: hidden; cursor: zoom-in;
  background: linear-gradient(110deg, #13284a 30%, #1e3d66 50%, #13284a 70%) 0 0 / 300% 100%;
  box-shadow: 0 6px 0 rgba(0,0,0,.3); animation: pop .5s cubic-bezier(.34,1.56,.64,1) .1s both, shimmer 1.4s linear infinite;
}
.ms__fig.on { animation: pop .5s cubic-bezier(.34,1.56,.64,1) .1s both; }
.ms__fig img { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; transition: opacity .6s ease, filter .8s ease, transform .9s cubic-bezier(.2,.8,.2,1); }
.ms__bg { object-fit: cover; filter: blur(22px) saturate(1.2) brightness(.55); transform: scale(1.25); }
.ms__img { object-fit: contain; filter: blur(12px); transform: scale(1.06); }
.ms__fig.on .ms__bg { opacity: 1; }
.ms__fig.on .ms__img { opacity: 1; filter: none; transform: none; }
.ms__fig:hover .ms__img { transform: scale(1.03); }
.ms__zoom { position: absolute; top: 10px; right: 10px; width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; background: rgba(0,0,0,.45); font-size: 16px; opacity: 0; transition: opacity .2s; }
.ms__fig.on .ms__zoom { opacity: .9; }
.ms__fig figcaption { position: absolute; z-index: 1; left: 0; right: 0; bottom: 0; padding: 14px 12px 6px; font-size: 12px; font-weight: 700; color: rgba(255,255,255,.85); background: linear-gradient(transparent, rgba(0,0,0,.75)); }
@keyframes shimmer { to { background-position: -300% 0; } }
.ms-lb { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center; padding: 24px; background: rgba(4,10,24,.88); backdrop-filter: blur(10px); cursor: zoom-out; }
.ms-lb img { max-width: 100%; max-height: calc(100% - 40px); border-radius: 18px; box-shadow: 0 30px 80px rgba(0,0,0,.6); }
.ms-lb__cap { margin-top: 10px; font: 700 13px "Nunito", sans-serif; color: rgba(255,255,255,.8); }
.ms-lb-enter-active, .ms-lb-leave-active { transition: opacity .3s ease; }
.ms-lb-enter-active img { animation: pop .45s cubic-bezier(.34,1.56,.64,1); }
.ms-lb-enter-from, .ms-lb-leave-to { opacity: 0; }
.ms__stat { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; padding: 12px 18px; border-radius: 22px; background: linear-gradient(135deg, color-mix(in srgb, var(--c) 35%, transparent), color-mix(in srgb, var(--c) 10%, transparent)); border: 2px solid var(--c); animation: pop .5s cubic-bezier(.34,1.56,.64,1) .2s both; }
.ms__stat b { font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 42px; line-height: 1; color: var(--c); text-shadow: 0 3px 0 rgba(0,0,0,.3); white-space: nowrap; }
.ms__stat span { font-weight: 800; font-size: 16px; line-height: 1.25; }
.ms__body { margin: 0 0 12px; font-weight: 700; color: rgba(255,255,255,.95); }
.ms__src { display: inline-block; font-weight: 800; font-size: 14px; color: #9bdcff; text-decoration: none; padding: 6px 12px; border-radius: 99px; background: rgba(79,209,255,.12); border: 1px solid rgba(79,209,255,.4); }
.ms__src:hover { background: rgba(79,209,255,.25); }
.ms__cta { display: flex; justify-content: flex-end; margin-top: 16px; }

.ms__peek { background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.18); color: #fff; font: 800 14.5px "Nunito", sans-serif; padding: 8px 14px; border-radius: 99px; cursor: pointer; min-height: 38px; margin: 6px 0; }
.ms__peekbox { margin: 4px 0 10px; padding: 12px 14px; border-radius: 16px; background: rgba(0,0,0,.28); font-size: 15px; font-weight: 700; color: rgba(255,255,255,.9); }
.ms__peekstat { margin-bottom: 4px; font-weight: 800; color: #ffd23f; } .ms__peekstat b { font-family: "Fredoka", sans-serif; font-size: 20px; }
.peek-enter-active, .box-enter-active { animation: pop .4s cubic-bezier(.34,1.56,.64,1) both; }
.ms__q { margin: 6px 0 14px; font-family: "Fredoka", sans-serif; font-weight: 600; font-size: 26px; line-height: 1.2; }
.ms__opts { display: flex; flex-direction: column; gap: 10px; }
.ms__opts--shake { animation: shake .5s cubic-bezier(.36,.07,.19,.97) both; }
.ms__opt {
  display: flex; align-items: center; gap: 12px; width: 100%; min-height: 58px; padding: 10px 14px; text-align: left; cursor: pointer; color: #fff; font-family: "Nunito", sans-serif; font-weight: 800; font-size: 17px; line-height: 1.3;
  border-radius: 20px; background: linear-gradient(180deg, rgba(58,155,255,.28), rgba(31,102,196,.28)); border: 2px solid rgba(120,190,255,.5);
  box-shadow: 0 5px 0 #1a4f9a, inset 0 2px 0 rgba(255,255,255,.15); animation: pop .45s cubic-bezier(.34,1.56,.64,1) calc(.05s + var(--i) * .07s) both;
  transition: transform .12s cubic-bezier(.34,1.56,.64,1), background .2s, opacity .3s; -webkit-tap-highlight-color: transparent;
}
.ms__opt:hover:not(:disabled) { transform: translateY(-2px) scale(1.015); }
.ms__opt:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 2px 0 #1a4f9a; }
.ms__letter { flex: none; width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 19px; background: rgba(255,255,255,.2); }
.ms__opt.is-wrong { background: linear-gradient(180deg, #ff6b81, #d6324f); border-color: #ff9aa9; box-shadow: 0 5px 0 #8f1a30; opacity: .85; }
.ms__opt.is-right, .ms__opt.is-reveal { background: linear-gradient(180deg, #3fe07e, #1fa84f); border-color: #9dffbf; box-shadow: 0 5px 0 #11703a; animation: pop .45s cubic-bezier(.34,1.56,.64,1) both, glow 1s ease-in-out 2; }
.ms__opt.is-dim { opacity: .45; }
.ms__hint { margin-top: 14px; padding: 12px 16px; border-radius: 18px; font-weight: 800; background: rgba(255,210,63,.16); border: 2px solid #ffd23f; color: #fff3b8; }
.ms__try { margin-top: 4px; font-size: 14.5px; color: rgba(255,255,255,.8); }
.ms__done { margin-top: 14px; padding: 14px 16px; border-radius: 22px; }
.ms__done.is-ok { background: rgba(47,207,107,.18); border: 2px solid #3fe07e; }
.ms__done.is-no { background: rgba(255,176,46,.15); border: 2px solid #ffb02e; }
.ms__verdict { font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 22px; }
.ms__rewards { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 4px; }
.ms__rw { font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 18px; padding: 4px 14px; border-radius: 99px; background: #2fcf6b; box-shadow: 0 3px 0 #11703a; animation: chip .5s cubic-bezier(.34,1.56,.64,1) calc(.2s + var(--i) * .12s) both; }
.ms__explain { margin: 8px 0 0; font-weight: 700; color: rgba(255,255,255,.95); }
@keyframes pop { from { opacity: 0; transform: translateY(18px) scale(.9); } }
@keyframes chip { from { opacity: 0; transform: translateY(-14px) scale(.3); } }
@keyframes shake { 15% { transform: translateX(-9px); } 30% { transform: translateX(8px); } 45% { transform: translateX(-6px); } 60% { transform: translateX(5px); } 75% { transform: translateX(-2px); } }
@keyframes glow { 50% { box-shadow: 0 5px 0 #11703a, 0 0 28px #7cf29c; } }
@media (max-width: 640px) {
  .ms { padding-bottom: calc(14px + env(safe-area-inset-bottom)); }
  .ms__head { margin-bottom: 6px; }
  .ms__loc { font-size: 14px; padding: 3px 11px; border-width: 1.5px; }
  .ms__steps i { width: 20px; height: 6px; }
  .ms__phase { display: none; }
  .ms__title { font-size: 21px; margin: 2px 0 8px; }
  .ms__fig { height: 150px; margin-bottom: 8px; border-radius: 16px; box-shadow: 0 4px 0 rgba(0,0,0,.3); }
  .ms__stat { gap: 10px; margin-bottom: 8px; padding: 7px 12px; border-radius: 16px; }
  .ms__stat b { font-size: 26px; text-shadow: 0 2px 0 rgba(0,0,0,.3); } .ms__stat span { font-size: 13.5px; }
  .ms__body { font-size: 15px; margin-bottom: 8px; line-height: 1.35; }
  .ms__src { font-size: 12px; padding: 4px 10px; line-height: 1.25; }
  .ms__q { font-size: 19px; margin: 4px 0 10px; }
  .ms__peek { font-size: 12.5px; min-height: 30px; padding: 4px 11px; margin: 2px 0 0; }
  .ms__peekbox { font-size: 13.5px; padding: 8px 12px; }
  .ms__opts { gap: 7px; }
  .ms__opt { font-size: 15.5px; min-height: 46px; padding: 6px 10px; gap: 10px; border-radius: 16px; box-shadow: 0 4px 0 #1a4f9a, inset 0 2px 0 rgba(255,255,255,.15); }
  .ms__opt.is-wrong { box-shadow: 0 4px 0 #8f1a30; } .ms__opt.is-right, .ms__opt.is-reveal { box-shadow: 0 4px 0 #11703a; }
  .ms__letter { width: 30px; height: 30px; font-size: 16px; border-radius: 10px; }
  .ms__hint { margin-top: 10px; padding: 8px 12px; border-radius: 14px; font-size: 14px; } .ms__try { font-size: 13px; }
  .ms__done { margin-top: 8px; padding: 10px 12px; border-radius: 18px; }
  .ms__verdict { font-size: 18px; } .ms__rewards { margin: 6px 0 2px; gap: 6px; } .ms__rw { font-size: 15px; padding: 2px 11px; }
  .ms__explain { font-size: 14px; margin-top: 6px; line-height: 1.35; }
  /* after answering, only the right answer stays: the explanation and Continue fit */
  .ms__opts--done .ms__opt:not(.is-right):not(.is-reveal) { display: none; }
  .ms__done .ms__cta { margin: 8px 0 0 !important; position: static; padding: 0; background: none; }
  .ms__cta { display: block; margin-top: 8px; } .ms__cta :deep(.mbtn), .ms__cta .mbtn { width: 100%; min-height: 46px; font-size: 16px; }
}
@media (max-width: 640px) and (max-height: 700px) { .ms__fig { height: 120px; } .ms__body { font-size: 14px; } .ms__title { font-size: 19px; } }
@media (min-width: 900px) { .ms__title { font-size: 34px; } .ms__q { font-size: 30px; } .ms__opt { font-size: 19px; } .ms__stat b { font-size: 50px; } .ms__fig { height: 300px; } }
</style>
