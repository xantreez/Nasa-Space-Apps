<script setup lang="ts">
import type { AgeBand } from "../../../moon/types";
import { sfx } from "../../../moon/sfx";
const emit = defineEmits<{ pick: [age: AgeBand] }>();
const cards: { age: AgeBand; emoji: string; title: string; ages: string; text: string; color: string }[] = [
  { age: "cadet", emoji: "🧑‍🚀", title: "Cadet", ages: "ages 7–9", text: "Simple questions with 3 answers and friendly hints. A great first mission!", color: "#4fd1ff" },
  { age: "specialist", emoji: "👩‍🚀", title: "Specialist", ages: "ages 10–12", text: "Trickier science with 4 answers and real numbers. For future mission experts!", color: "#ff9f43" },
];
function pick(a: AgeBand) {
  sfx.pop();
  emit("pick", a);
}
</script>

<template>
  <div class="ma">
    <h2 class="ma__h">Choose your rank, Commander!</h2>
    <div class="ma__row">
      <button v-for="(c, i) in cards" :key="c.age" class="ma__card" :style="{ '--c': c.color, '--i': i }" @click="pick(c.age)">
        <span class="ma__emoji">{{ c.emoji }}</span>
        <span class="ma__title">{{ c.title }}</span>
        <span class="ma__ages">{{ c.ages }}</span>
        <span class="ma__text">{{ c.text }}</span>
        <span class="ma__go">Pick →</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.ma {
  position: absolute; inset: 0; z-index: 40; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 22px; padding: 20px 16px; overflow: auto; color: #fff; font-family: "Nunito", sans-serif;
  background: radial-gradient(ellipse at center, rgba(5, 12, 30, 0.4), rgba(5, 12, 30, 0.82));
}
.ma__h { margin: 0; font-family: "Fredoka", sans-serif; font-weight: 700; text-align: center; font-size: clamp(26px, 6vw, 44px); text-shadow: 0 3px 0 rgba(0,0,0,.3); animation: pop .5s cubic-bezier(.34,1.56,.64,1) both; }
.ma__row { display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; width: 100%; max-width: 760px; }
.ma__card {
  flex: 1 1 280px; max-width: 360px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center;
  padding: 22px 20px 20px; border-radius: 28px; cursor: pointer; color: #fff; font-family: inherit;
  background: linear-gradient(180deg, rgba(26, 46, 84, 0.88), rgba(12, 24, 48, 0.9)); backdrop-filter: blur(14px);
  border: 2px solid color-mix(in srgb, var(--c) 55%, transparent);
  box-shadow: 0 7px 0 color-mix(in srgb, var(--c) 45%, #000), 0 18px 34px rgba(0, 0, 0, 0.4);
  animation: pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) calc(0.15s + var(--i) * 0.12s) both;
  transition: transform 0.15s cubic-bezier(.34,1.56,.64,1), box-shadow .15s; -webkit-tap-highlight-color: transparent;
}
.ma__card:hover { transform: translateY(-6px) scale(1.03); }
.ma__card:active { transform: translateY(4px); box-shadow: 0 3px 0 color-mix(in srgb, var(--c) 45%, #000); }
.ma__emoji { font-size: 64px; line-height: 1; animation: bob 2.4s ease-in-out infinite; }
.ma__title { font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 30px; color: var(--c); }
.ma__ages { font-weight: 800; font-size: 15px; padding: 3px 14px; border-radius: 99px; background: color-mix(in srgb, var(--c) 22%, transparent); }
.ma__text { font-size: 16.5px; font-weight: 600; line-height: 1.4; color: rgba(255, 255, 255, 0.88); margin: 6px 0 8px; }
.ma__go { font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 18px; background: var(--c); color: #0b1b3a; padding: 8px 24px; border-radius: 16px; box-shadow: 0 4px 0 color-mix(in srgb, var(--c) 50%, #000); }
@keyframes pop { from { opacity: 0; transform: translateY(40px) scale(0.85); } }
@keyframes bob { 50% { transform: translateY(-6px) rotate(-4deg); } }
</style>
