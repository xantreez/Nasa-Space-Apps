<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { GameState } from "../../../moon/types";
import Btn from "./Btn.vue";
import Sheet from "./Sheet.vue";
import Confetti from "./Confetti.vue";
import { RES } from "./meta";
import { useCount } from "./useCount";
import { sfx } from "../../../moon/sfx";

const props = defineProps<{ kind: "failed" | "won"; state: GameState }>();
const emit = defineEmits<{ restart: []; retry: [] }>();

const won = computed(() => props.kind === "won");
const fire = ref(1);
const days = useCount(() => props.state.day, 1100, true);
const sci = useCount(() => props.state.science, 1300, true);
const cards = useCount(() => props.state.usedCards.length, 1000, true);
const built = useCount(() => props.state.built.length, 900, true);
const fr = computed(() => props.state.failReason);

const CREDITS = [
  { name: "NASA DONKI", what: "real space-weather events: flares, CMEs, storms", url: "https://kauai.ccmc.gsfc.nasa.gov/DONKI/" },
  { name: "NASA OSDR", what: "space biology: plants and life in space", url: "https://osdr.nasa.gov/" },
  { name: "MSL RAD", what: "radiation measured by Curiosity on Mars", url: "https://pds-ppi.igpp.ucla.edu/" },
  { name: "NASA Moon Trek", what: "maps of the Moon's surface", url: "https://trek.nasa.gov/moon/" },
  { name: "NASA Image Library", what: "real photos from NASA", url: "https://images.nasa.gov/" },
];

onMounted(() => {
  if (won.value) {
    sfx.win();
    setTimeout(() => fire.value++, 800);
    setTimeout(() => fire.value++, 1700);
  } else sfx.fail();
});
</script>

<template>
  <Sheet :tone="won ? '#ffd23f' : '#4fd1ff'">
    <template v-if="won" #over><Confetti :fire="fire" :count="100" /></template>

    <!-- WON -->
    <div v-if="won" class="me me--win">
      <div class="me__big">🚀🌕</div>
      <div class="me__tag">Mission accomplished!</div>
      <h2 class="me__title">You saved the outpost!</h2>
      <blockquote class="me__story">
        Tobish sends his first research data to NASA…
        <em>“I will stay here and contribute to humankind.”</em>
        <cite>— Tobish, Moon Outpost</cite>
      </blockquote>
    </div>

    <!-- FAILED -->
    <div v-else class="me me--fail">
      <div class="me__big me__big--sad">🛰️</div>
      <div class="me__tag me__tag--soft">The outpost failed</div>
      <h2 class="me__title">
        <template v-if="fr">{{ RES[fr.res].emoji }} {{ RES[fr.res].label }} ran out</template>
        <template v-else>Something ran out</template>
      </h2>
      <p v-if="fr" class="me__why">{{ fr.why }}</p>
      <div v-if="fr" class="me__lesson"><b>🎓 What astronauts learn from this</b>{{ fr.lesson }}</div>
      <p class="me__cheer">Every real mission learns from mistakes — even NASA's. You can do it, Commander! 💪</p>
    </div>

    <div class="me__stats">
      <div class="me__s"><b>{{ days }}</b><span>days survived</span></div>
      <div class="me__s"><b>{{ sci }}</b><span>🔬 science</span></div>
      <div class="me__s"><b>{{ cards }}</b><span>cards learned</span></div>
      <div v-if="won" class="me__s"><b>{{ built }}</b><span>buildings</span></div>
    </div>

    <div v-if="won" class="me__credits">
      <div class="me__ch">🛰️ Real NASA data used in this game</div>
      <a v-for="c in CREDITS" :key="c.name" :href="c.url" target="_blank" rel="noopener" class="me__c"><b>{{ c.name }}</b> — {{ c.what }} ↗</a>
    </div>

    <div class="me__cta">
      <template v-if="won"><Btn big @click="emit('restart')">Play again 🔄</Btn></template>
      <template v-else>
        <Btn big @click="emit('retry')">🔋 Use emergency reserve · retry mission {{ state.missionIdx + 1 }}</Btn>
        <Btn variant="ghost" @click="emit('restart')">Start the whole game over</Btn>
      </template>
    </div>
  </Sheet>
</template>

<style scoped>
.me { text-align: center; }
.me__big { font-size: 80px; line-height: 1; display: inline-block; animation: pop .8s cubic-bezier(.34,1.56,.64,1) both, bob 2.5s ease-in-out .8s infinite; filter: drop-shadow(0 0 24px rgba(255,210,63,.6)); }
.me__big--sad { filter: drop-shadow(0 0 20px rgba(79,209,255,.5)); }
.me__tag { margin-top: 4px; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 17px; letter-spacing: 1.2px; text-transform: uppercase; color: #ffd23f; }
.me__tag--soft { color: #9bdcff; }
.me__title { margin: 4px 0 12px; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 38px; line-height: 1.08; text-shadow: 0 3px 0 rgba(0,0,0,.3); }
.me__story { margin: 0 0 14px; padding: 14px 18px; border-radius: 22px; font-weight: 800; font-size: 18px; background: rgba(255,210,63,.13); border: 2px solid rgba(255,210,63,.5); display: flex; flex-direction: column; gap: 6px; }
.me__story em { font-style: normal; font-family: "Fredoka", sans-serif; font-weight: 600; font-size: 24px; color: #fff3b8; }
.me__story cite { font-size: 14px; color: rgba(255,255,255,.65); font-style: normal; }
.me__why { margin: 0 0 10px; font-weight: 800; font-size: 18px; }
.me__lesson { text-align: left; margin: 0 0 12px; padding: 12px 16px; border-radius: 18px; font-weight: 700; background: rgba(79,209,255,.13); border: 2px solid rgba(79,209,255,.45); color: #e4f6ff; }
.me__lesson b { display: block; font-family: "Fredoka", sans-serif; color: #4fd1ff; margin-bottom: 3px; }
.me__cheer { margin: 0 0 12px; font-weight: 800; color: #c8ffd8; }
.me__stats { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin: 6px 0 14px; }
.me__s { flex: 1 1 100px; display: flex; flex-direction: column; align-items: center; padding: 10px 8px; border-radius: 20px; background: rgba(255,255,255,.09); box-shadow: 0 4px 0 rgba(0,0,0,.25); animation: pop .5s cubic-bezier(.34,1.56,.64,1) .4s both; }
.me__s b { font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 38px; line-height: 1; color: #ffd23f; font-variant-numeric: tabular-nums; }
.me__s span { font-weight: 800; font-size: 14px; color: rgba(255,255,255,.8); }
.me__credits { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; padding: 12px 14px; border-radius: 20px; background: rgba(0,0,0,.25); text-align: left; }
.me__ch { font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 17px; margin-bottom: 2px; }
.me__c { font-weight: 700; font-size: 15px; color: #cfeeff; text-decoration: none; padding: 4px 0; } .me__c b { color: #4fd1ff; } .me__c:hover { text-decoration: underline; }
.me__cta { display: flex; flex-direction: column; align-items: center; gap: 12px; }
@keyframes pop { from { opacity: 0; transform: scale(.4) translateY(20px); } }
@keyframes bob { 50% { transform: translateY(-8px) rotate(-3deg); } }
@media (max-width: 640px) {
  .me__big { font-size: 46px; } .me__tag { font-size: 13px; }
  .me__title { font-size: 23px; margin: 2px 0 6px; }
  .me__story { padding: 8px 12px; font-size: 14px; margin-bottom: 8px; border-radius: 16px; } .me__story em { font-size: 17px; } .me__story cite { font-size: 12px; }
  .me__why { font-size: 14.5px; margin-bottom: 6px; line-height: 1.35; }
  .me__lesson { font-size: 13.5px; padding: 8px 12px; margin-bottom: 8px; border-radius: 14px; line-height: 1.35; }
  .me__cheer { font-size: 13.5px; margin-bottom: 6px; }
  .me__stats { gap: 6px; margin: 4px 0 8px; } .me__s { flex-basis: 70px; padding: 6px 4px; border-radius: 14px; } .me__s b { font-size: 24px; } .me__s span { font-size: 11.5px; }
  .me__credits { padding: 8px 10px; margin-bottom: 8px; border-radius: 14px; gap: 2px; } .me__ch { font-size: 14px; } .me__c { font-size: 12.5px; padding: 2px 0; }
  .me__cta { gap: 6px; } .me__cta :deep(.mbtn), .me__cta .mbtn { width: 100%; padding-inline: 12px; min-height: 48px; font-size: 16px; line-height: 1.15; }
  .me__cta :deep(.mbtn--big) { font-size: 17px; min-height: 52px; }
}
@media (min-width: 900px) { .me__title { font-size: 46px; } }
</style>
