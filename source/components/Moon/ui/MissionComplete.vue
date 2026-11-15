<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { Mission } from "../../../moon/types";
import Btn from "./Btn.vue";
import Sheet from "./Sheet.vue";
import Confetti from "./Confetti.vue";
import { BUILD } from "./meta";
import { sfx } from "../../../moon/sfx";

defineProps<{ mission: Mission; nextMission: Mission | null }>();
const emit = defineEmits<{ next: [] }>();
const fire = ref(1);
onMounted(() => {
  sfx.win();
  setTimeout(() => fire.value++, 700);
});
</script>

<template>
  <Sheet tone="#ffd23f">
    <template #over><Confetti :fire="fire" :count="90" /></template>
    <div class="mc">
      <div class="mc__star">⭐</div>
      <div class="mc__tag">Mission {{ mission.index }} complete!</div>
      <h2 class="mc__title">{{ mission.title }}</h2>
      <p class="mc__reward">🎁 {{ mission.reward.text }}</p>

      <div v-if="mission.reward.builds.length" class="mc__builds">
        <div class="mc__bl">New buildings unlocked</div>
        <div class="mc__brow">
          <div v-for="(b, i) in mission.reward.builds" :key="b" class="mc__b" :style="{ '--i': i }">
            <span class="mc__bi">{{ BUILD[b]?.emoji ?? "🏗️" }}</span>
            <span class="mc__bn">{{ BUILD[b]?.label ?? b }}</span>
          </div>
        </div>
      </div>

      <div v-if="nextMission" class="mc__next">
        <b>Next up · Mission {{ nextMission.index }}</b>
        <span>{{ nextMission.title }}</span>
        <em>{{ nextMission.goal }}</em>
      </div>

      <div class="mc__cta"><Btn big @click="emit('next')">{{ nextMission ? "Next mission →" : "Finish →" }}</Btn></div>
    </div>
  </Sheet>
</template>

<style scoped>
.mc { text-align: center; }
.mc__star { font-size: 84px; line-height: 1; filter: drop-shadow(0 0 24px #ffd23f); animation: star 1s cubic-bezier(.34,1.56,.64,1) both, spin 6s linear 1s infinite; display: inline-block; }
.mc__tag { margin-top: 4px; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 18px; letter-spacing: 1.2px; text-transform: uppercase; color: #ffd23f; }
.mc__title { margin: 4px 0 8px; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 38px; line-height: 1.05; text-shadow: 0 3px 0 rgba(0,0,0,.3); }
.mc__reward { margin: 0 0 14px; font-weight: 800; font-size: 18px; color: #fff3b8; }
.mc__bl { font-weight: 800; font-size: 14px; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,.7); margin-bottom: 8px; }
.mc__brow { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
.mc__b { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 104px; padding: 10px 12px; border-radius: 20px; background: rgba(255,255,255,.1); border: 2px solid rgba(255,210,63,.5); animation: pop .6s cubic-bezier(.34,1.56,.64,1) calc(.5s + var(--i) * .15s) both; }
.mc__bi { font-size: 44px; line-height: 1; } .mc__bn { font-family: "Fredoka", sans-serif; font-weight: 600; font-size: 16px; }
.mc__next { display: flex; flex-direction: column; gap: 2px; margin-top: 16px; padding: 12px 16px; border-radius: 20px; background: rgba(79,209,255,.12); border: 1px dashed rgba(79,209,255,.55); }
.mc__next b { font-family: "Fredoka", sans-serif; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; color: #4fd1ff; }
.mc__next span { font-family: "Fredoka", sans-serif; font-weight: 600; font-size: 22px; } .mc__next em { font-style: normal; font-weight: 700; font-size: 15.5px; color: rgba(255,255,255,.85); }
.mc__cta { margin-top: 18px; }
@keyframes star { from { opacity: 0; transform: scale(0) rotate(-180deg); } }
@keyframes spin { 0%, 90% { transform: rotate(0); } 95% { transform: rotate(12deg) scale(1.1); } }
@keyframes pop { from { opacity: 0; transform: translateY(20px) scale(.5); } }
@media (max-width: 640px) {
  .mc__star { font-size: 48px; } .mc__tag { font-size: 14px; margin: 0; }
  .mc__title { font-size: 26px; margin: 2px 0 4px; }
  .mc__reward { font-size: 14.5px; margin-bottom: 8px; line-height: 1.3; }
  .mc__bl { font-size: 12px; margin-bottom: 4px; }
  .mc__brow { gap: 6px; } .mc__b { min-width: 84px; padding: 6px 8px; border-radius: 14px; }
  .mc__bi { font-size: 30px; } .mc__bn { font-size: 13.5px; }
  .mc__next { margin-top: 8px; padding: 8px 12px; border-radius: 14px; } .mc__next span { font-size: 17px; } .mc__next em { font-size: 13px; line-height: 1.3; }
  .mc__cta { margin-top: 8px; } .mc__cta :deep(.mbtn), .mc__cta .mbtn { width: 100%; padding-inline: 16px; font-size: 20px; min-height: 52px; }
}
@media (min-width: 900px) { .mc__title { font-size: 48px; } }
</style>
