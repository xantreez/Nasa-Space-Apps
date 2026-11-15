<template>
  <div class="mg" :class="{ ready: booted }">
    <!-- 2D-сцена базы всегда на фоне -->
    <MoonScene
      class="mg__scene"
      :at="s?.at ?? 'habitat'"
      :target="target"
      :built="s?.built ?? []"
      :weather="s ? weather(s) : 'calm'"
      :highlight="s && s.phase === 'map' ? targets(s) : []"
      :disabled="!s || s.phase !== 'map' || s.actions <= 0 || !!target"
      :day="s?.day ?? 1"
      :res="s?.res ?? null"
      @go="onGo"
      @arrived="onArrived"
    />

    <!-- заставка и выбор возраста -->
    <Transition name="mg-fade">
      <TitleScreen v-if="screen === 'title'" class="mg__layer" @start="onStart" />
    </Transition>
    <Transition name="mg-fade">
      <component :is="introComp" v-if="screen === 'intro' && introComp" class="mg__layer" @done="onIntroDone" @skip="onIntroDone()" />
    </Transition>
    <Transition name="mg-fade">
      <AgeSelect v-if="screen === 'age'" class="mg__layer" @pick="startGame" />
    </Transition>

    <template v-if="s && screen === 'game'">
      <Hud
        class="mg__hud"
        :class="{ 'mg__hud--modal': s.phase !== 'map' && s.phase !== 'minigame', 'mg__hud--game': s.phase === 'minigame' }"
        :res="s.res"
        :day="s.day"
        :actions="s.actions"
        :actions-per-day="s.actionsPerDay"
        :science="s.science"
        :mission="status!.mission"
        :status="status"
        :weather="weather(s)"
        @end-day="onEndDay"
        @open-mission="showBrief = true"
      />

      <Transition name="mg-fade">
        <div v-if="s.phase === 'map' && s.actions > 0 && !target && hint" class="mg__hint">{{ hint }}</div>
      </Transition>
      <Transition name="mg-fade">
        <div v-if="nightfall" class="mg__night">🌙 Day {{ s.day }} is over — Tobish rests…</div>
      </Transition>

      <Transition name="mg-day">
        <div v-if="dayCard" :key="dayCard" class="mg__day" aria-hidden="true">
          <i class="mg__day-sun" />
          <span class="mg__day-k">NEW DAY</span>
          <b class="mg__day-n">Day {{ dayCard }}</b>
          <span class="mg__day-s">{{ DAY_QUIPS[dayCard % DAY_QUIPS.length] }}</span>
        </div>
      </Transition>

      <div v-if="!celebrate" class="mg__modals">
        <RadioMessage
          v-if="s.phase === 'briefing'"
          :key="`b${s.missionIdx}`"
          :title="`Mission ${status!.mission.index} · ${status!.mission.title}`"
          :text="named((s.retried ? 'Phew… the emergency reserve kicked in and the outpost is safe for now. Let’s try this mission again, Commander — smarter this time!\n\n' : '') + status!.mission.briefing)"
          from="TOBISH"
          :cta="s.missionIdx === 0 && s.day === 1 ? 'Let’s go, Commander! 🚀' : 'On it! 🚀'"
          @close="act(closeBriefing)"
        />
        <RadioMessage
          v-else-if="showBrief && s.phase === 'map'"
          :title="`Mission ${status!.mission.index} · ${status!.mission.title}`"
          :text="named(`${status!.mission.goal}\n\n${status!.mission.briefing}`)"
          from="TOBISH"
          cta="Got it"
          @close="showBrief = false"
        />
        <EventCard v-else-if="s.phase === 'event' && s.today" :key="`e${s.day}`" :event="s.today" :day="s.day" :sheltered="s.sheltered" @close="act(ackEvent)" />
        <StudyCard
          v-else-if="s.phase === 'card' && s.card"
          :key="s.card.id + s.day"
          :card="s.card"
          :age="s.age"
          :result="result"
          :tries="s.cardTries"
          @answer="onAnswer"
          @close="onCloseCard"
        />
        <DecisionModal v-else-if="s.phase === 'decision' && s.decision" :key="s.decision.id + s.day" :decision="s.decision" :res="s.res" @choose="(id: string) => act((x) => choose(x, id))" />
        <Consequences v-else-if="s.phase === 'consequences' && s.consequence" :consequence="s.consequence" @close="act(closeConsequences)" />
        <MissionComplete v-else-if="s.phase === 'mission-complete'" :mission="status!.mission" :next-mission="MISSIONS[s.missionIdx + 1] ?? null" @next="onNextMission" />
        <component
          :is="gameComp"
          v-else-if="s.phase === 'minigame' && s.minigame && gameComp"
          :key="'g' + s.missionIdx + s.day"
          :age="s.age"
          :difficulty="s.minigame.difficulty"
          @finish="onGameFinish"
        />
        <RewardPick
          v-else-if="s.phase === 'reward' && s.pendingReward"
          :res="s.res"
          :amount="s.pendingReward.amount"
          :home="s.pendingReward.home"
          :from="s.pendingReward.from"
          @pick="(k: ResKey) => act((x) => claimReward(x, k))"
        />
        <EndScreen v-else-if="s.phase === 'failed' || s.phase === 'won'" :kind="s.phase" :state="s" @restart="restart" @retry="act(retryMission)" />
      </div>
    </template>

    <button v-if="screen !== 'game'" class="mg__mute" :aria-label="muted ? 'Sound on' : 'Sound off'" @click="toggleMute">{{ muted ? "🔇" : "🔊" }}</button>
  </div>
</template>

<script setup lang="ts">
import { defineComponent, h } from "vue";
import MoonScene from "~/components/Moon/Scene.vue";
import TitleScreen from "~/components/Moon/ui/TitleScreen.vue";
import AgeSelect from "~/components/Moon/ui/AgeSelect.vue";
import Hud from "~/components/Moon/ui/Hud.vue";
import RadioMessage from "~/components/Moon/ui/RadioMessage.vue";
import EventCard from "~/components/Moon/ui/EventCard.vue";
import StudyCard from "~/components/Moon/ui/StudyCard.vue";
import DecisionModal from "~/components/Moon/ui/DecisionModal.vue";
import Consequences from "~/components/Moon/ui/Consequences.vue";
import MissionComplete from "~/components/Moon/ui/MissionComplete.vue";
import EndScreen from "~/components/Moon/ui/EndScreen.vue";
import RewardPick from "~/components/Moon/ui/RewardPick.vue";
import type { AgeBand, GameState, LocationId, ResDelta } from "~/moon/types";
import {
  newGame,
  closeBriefing,
  ackEvent,
  walkTo,
  answer,
  closeCard,
  choose,
  closeConsequences,
  endDay,
  nextMission,
  missionStatus,
  targets,
  weather,
  finishGame,
  claimReward,
  retryMission,
} from "~/moon/engine";
import { CARDS } from "~/moon/data/cards";
import { preloadImages } from "~/moon/preload";
import type { MiniGameId, MiniGameResult, ResKey } from "~/moon/types";
import { MISSIONS } from "~/moon/missions";
import { sfx, music, preloadAudio } from "~/moon/sfx";
import { voice } from "~/moon/voice";
import { VOICE_WIN, VOICE_FAIL } from "~/moon/voice-lines";

definePageMeta({ layout: false });

const OG_DESC =
  "Tobish crashed on the Moon. Be his commander and keep him alive with real NASA science — a free space-survival game for kids 7–12 built on NASA DONKI, MSL RAD, OSDR and Moon Trek data.";
const OG_TITLE = "Junior Astronaut · Moon Outpost";
const OG_IMG = "https://edu-space.io/moon/og.jpg";
useHead({
  title: OG_TITLE,
  meta: [
    { name: "description", content: OG_DESC },
    { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" },
    { name: "theme-color", content: "#0b1b3a" },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Junior Astronaut" },
    { property: "og:url", content: "https://edu-space.io/game" },
    { property: "og:title", content: OG_TITLE },
    { property: "og:description", content: OG_DESC },
    { property: "og:image", content: OG_IMG },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: "Junior Astronaut: Tobish the astronaut stands on the Moon next to his crashed rocket, Earth in the sky." },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: OG_TITLE },
    { name: "twitter:description", content: OG_DESC },
    { name: "twitter:image", content: OG_IMG },
  ],
  link: [
    { rel: "icon", type: "image/png", href: "/moon/favicon.png" },
    { rel: "apple-touch-icon", href: "/moon/apple-touch-icon.png" },
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
    { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@600;700;800;900&display=swap" },
  ],
});

type Screen = "title" | "intro" | "age" | "game";
const screen = ref<Screen>("title");
// shallowRef: движок делает structuredClone, а он падает на реактивных Proxy
const s = shallowRef<GameState | null>(null);
const target = ref<LocationId | null>(null);
const result = ref<{ picked: number; correct: boolean; final: boolean; reward: ResDelta; science: number } | null>(null);
const showBrief = ref(false);
const nightfall = ref(false);
const muted = ref(false);
const booted = ref(false);

const status = computed(() => (s.value ? missionStatus(s.value) : null));

const LOC_NAME: Record<LocationId, string> = {
  habitat: "Habitat",
  greenhouse: "Greenhouse",
  solar: "Solar Field",
  shelter: "Storm Shelter",
  radio: "Radio Dish",
  lab: "Lab Computer",
};

const hint = computed(() => {
  if (!s.value) return "";
  const t = targets(s.value);
  if (t.length) return `👆 Tap the ${t.map((l) => LOC_NAME[l]).join(" or ")} to continue`;
  return "👆 Tap a place to collect resources";
});

const dayCard = ref(0);
const DAY_QUIPS = ["Sunrise over the Moon outpost", "Tobish checks the oxygen first", "The Sun climbs over the crater rim", "Earth hangs in the sky, watching", "Another day on the Moon"];
let dayT = 0;
watch(
  () => s.value?.day,
  (d, o) => {
    if (!d || !o || d <= o || screen.value !== "game") return;
    dayCard.value = d;
    sfx.chime?.();
    clearTimeout(dayT);
    dayT = window.setTimeout(() => (dayCard.value = 0), 1900);
  }
);

function act(fn: (x: GameState) => GameState) {
  if (!s.value) return;
  s.value = fn(s.value);
}

function startGame(age: AgeBand) {
  s.value = newGame(age);
  target.value = null;
  result.value = null;
  screen.value = "game";
}

function restart() {
  if (!s.value) return;
  startGame(s.value.age);
}

function onGo(loc: LocationId) {
  const x = s.value;
  if (!x || x.phase !== "map" || x.actions <= 0 || target.value) return;
  sfx.click();
  if (loc === x.at) return onArrived(loc);
  target.value = loc;
}

function onArrived(loc: LocationId) {
  target.value = null;
  if (!s.value || s.value.phase !== "map") return;
  result.value = null;
  s.value = walkTo(s.value, loc);
}

function onAnswer(idx: number) {
  if (!s.value) return;
  const r = answer(s.value, idx);
  s.value = r.state;
  result.value = { picked: idx, correct: r.correct, final: r.final, reward: r.reward, science: r.science };
}

function onCloseCard() {
  result.value = null;
  act(closeCard);
}

// after a mission: hold the next briefing for a moment so the new building can pop in and the camera can admire it
const celebrate = ref(false);
function onNextMission() {
  const x = s.value;
  if (!x) return;
  const had = x.built.length;
  act(nextMission);
  if (s.value && s.value.phase === "briefing" && s.value.built.length > had) {
    celebrate.value = true;
    sfx.build();
    setTimeout(() => sfx.powerUp(), 450);
    setTimeout(() => (celebrate.value = false), 3000);
  }
}

function onEndDay() {
  if (!s.value || s.value.phase !== "map" || nightfall.value) return;
  nightfall.value = true;
  setTimeout(() => {
    nightfall.value = false;
    act(endDay);
  }, 1300);
}

// Действия кончились — день заканчивается сам
watch(
  () => s.value && s.value.phase === "map" && s.value.actions <= 0 && !target.value,
  (v) => {
    if (v) setTimeout(onEndDay, 700);
  }
);

watch(
  () => s.value?.phase,
  (p, old) => {
    if (!p || p === old) return;
    if (p === "event" && (s.value?.today?.severity ?? 0) >= 2) sfx.alarm();
    else if (p === "briefing") sfx.radio();
    else if (p === "mission-complete") sfx.win();
    else if (p === "won") sfx.win();
    else if (p === "failed") sfx.fail();
    else if (p === "decision" || p === "event") sfx.pop();
  }
);

// Мини-игры грузим лениво: страница живёт, даже если какой-то игры ещё нет
const GAME_FILES = import.meta.glob("../components/Moon/games/*.vue");
const GAME_FILE: Record<MiniGameId, string> = { meteor: "Meteor", rover: "Rover", blocks: "Blocks", signal: "Signal" };
const gameCache = new Map<string, any>();
const gameComp = computed(() => {
  const id = s.value?.minigame?.id;
  if (!id) return null;
  const key = `../components/Moon/games/${GAME_FILE[id]}.vue`;
  const loader = GAME_FILES[key];
  if (!loader) return null;
  if (!gameCache.has(key)) gameCache.set(key, defineAsyncComponent(loader as any));
  return gameCache.get(key);
});
// Если игры нет в сборке — засчитываем, чтобы миссия не застряла
watch(
  () => s.value?.phase === "minigame" && !gameComp.value,
  (v) => v && setTimeout(() => onGameFinish({ won: true, score: 60 }), 50)
);
function onGameFinish(r: MiniGameResult) {
  act((x) => finishGame(x, r));
}

// Фоновая предзагрузка всех фото карточек и мини-игр, чтобы ничего не «догружалось» на глазах
function preloadAssets() {
  // все фото карточек декодируются заранее и держатся в памяти — модалка открывается уже с картинкой
  preloadImages(CARDS.map((c) => c.image).filter(Boolean) as string[], 3);
  // первые клипы интро — заранее, чтобы оно стартовало без ожидания (остальные интро догружает само)
  for (const k of ["a_room", "b1_study"]) fetch(`/moon/intro/${k}.mp4`, { priority: "low" } as RequestInit).catch(() => {});
  // код интро — сразу, пока игрок смотрит на заставку
  Object.values(INTRO_FILES).forEach((l) => (l as () => Promise<unknown>)().catch(() => {}));
  // код мини-игр — тоже заранее
  const idle = (window as any).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 1500));
  idle(() => Object.values(GAME_FILES).forEach((l) => (l as () => Promise<unknown>)().catch(() => {})));
}

// Интро (лениво, чтобы страница жила и без него)
const INTRO_FILES = import.meta.glob("../components/Moon/intro/Intro.vue");
// Пока код интро грузится (медленная сеть) — показываем лоадер, а не пустую карту
const IntroLoading = defineComponent({
  render: () =>
    h("div", { class: "mg-boot" }, [h("div", { class: "mg-boot__orbit" }, [h("i"), h("b")]), h("span", "Loading the story…")]),
});
const introComp = computed(() => {
  const l = Object.values(INTRO_FILES)[0];
  return l ? defineAsyncComponent({ loader: l as any, loadingComponent: IntroLoading, delay: 150 }) : null;
});
const commander = ref("");
try {
  commander.value = localStorage.getItem("moon-commander") ?? "";
} catch {}
function onStart() {
  screen.value = introComp.value ? "intro" : "age";
}
function onIntroDone(p?: { name?: string }) {
  const n = (p?.name ?? "").trim().slice(0, 14);
  if (n && n.toLowerCase() !== "commander") {
    commander.value = n;
    try {
      localStorage.setItem("moon-commander", n);
    } catch {}
  }
  screen.value = "age";
}
/** «Commander» в репликах Tobish → «Commander Азиз» (только первое вхождение) */
function named(t: string) {
  return commander.value ? t.replace(/\bCommander\b/, `Commander ${commander.value}`) : t;
}

// Голос: читаем то, что сейчас на экране (клипы ищутся по точному тексту; нет клипа — тишина)
const spoken = computed(() => {
  const x = s.value;
  if (!x || screen.value !== "game" || celebrate.value) return "";
  switch (x.phase) {
    case "briefing":
      return status.value?.mission.briefing ?? "";
    case "event":
      return x.today?.text ?? "";
    case "decision":
      return x.decision?.prompt ?? "";
    case "consequences": {
      const c = x.consequence;
      return c?.decision.options.find((o) => o.id === c.chosenId)?.outcome ?? "";
    }
    case "card":
      return x.age === "cadet" && x.card && !x.cardDone ? x.card.body : "";
    case "won":
      return VOICE_WIN;
    case "failed":
      return VOICE_FAIL;
    default:
      return "";
  }
});
watch(spoken, (t) => {
  voice.stop();
  if (t) voice.say(t);
});

// Музыка по ситуации (интро и мини-игры переключают её сами)
const mood = computed(() => {
  if (screen.value === "intro") return null;
  if (screen.value !== "game" || !s.value) return "title";
  const p = s.value.phase;
  if (p === "minigame") return null;
  if (p === "won") return "victory";
  const w = weather(s.value);
  return w === "storm" ? "storm" : w === "night" ? "night" : "base";
});
watch(mood, (m) => m && music.play(m as any));

function toggleMute() {
  muted.value = !muted.value;
  sfx.setMuted(muted.value);
}

onMounted(() => {
  if (import.meta.dev) (window as any).__mg = { get phase() { return s.value?.phase ?? screen.value; }, get s() { return s.value; }, patch: (r: Partial<Record<ResKey, number>>) => { if (s.value) s.value = { ...s.value, res: { ...s.value.res, ...r } }; }, finish: (won: boolean) => onGameFinish({ won, score: won ? 80 : 20 }), targets: () => (s.value ? targets(s.value) : []) };
  requestAnimationFrame(() => (booted.value = true));
  preloadAssets();
  setTimeout(() => preloadAudio(), 1200);
  // браузер разрешает звук только после первого касания
  const first = () => {
    sfx.unlock();
    if (mood.value) music.play(mood.value as any);
    for (const ev of ["touchend", "click", "keydown"]) window.removeEventListener(ev, first);
    window.removeEventListener("keydown", first);
  };
  for (const ev of ["touchend", "click"]) window.addEventListener(ev, first);
  window.addEventListener("keydown", first);
});
</script>

<style scoped>
.mg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  height: 100svh;
  overflow: hidden;
  background: #0b1b3a;
  color: #fff;
  font-family: "Nunito", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  opacity: 0;
  transition: opacity 0.6s ease;
}
.mg.ready {
  opacity: 1;
}
.mg__scene {
  position: absolute;
  inset: 0;
}
.mg__layer {
  position: absolute;
  inset: 0;
  z-index: 30;
}
.mg__hud {
  position: absolute;
  z-index: 10;
  left: 0;
  right: 0;
  top: 0;
}
.mg__hud--modal {
  z-index: 30;
}
.mg__hud--modal :deep(.mh__mission),
.mg__hud--modal :deep(.mh__row),
.mg__hud--modal :deep(.mh__pill),
.mg__hud--modal :deep(.mh__end),
.mg__hud--modal :deep(.mh__panel) {
  opacity: 0;
  pointer-events: none !important;
  transition: opacity 0.2s;
}
.mg__modals :deep(.msheet) {
  padding-top: 96px;
}
@media (max-width: 640px) {
  .mg__hint {
    font-size: 13.5px;
    padding: 8px 16px;
    white-space: nowrap;
    bottom: calc(14px + env(safe-area-inset-bottom));
  }
  .mg__modals :deep(.msheet) {
    padding-top: 0;
  }
}
.mg__modals {
  position: absolute;
  inset: 0;
  z-index: 20;
  pointer-events: none;
}
.mg__modals > :deep(*) {
  pointer-events: auto;
}
.mg__hint {
  position: absolute;
  z-index: 9;
  left: 50%;
  bottom: calc(18px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  max-width: calc(100% - 32px);
  padding: 12px 20px;
  border-radius: 999px;
  background: rgba(12, 24, 48, 0.72);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-weight: 800;
  font-size: 15px;
  text-align: center;
  pointer-events: none;
  animation: mg-bob 2.4s ease-in-out infinite;
}
.mg__day {
  position: absolute;
  z-index: 45;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(5, 12, 30, 0) 20%, rgba(255, 170, 70, 0.28) 55%, rgba(5, 12, 30, 0) 85%);
  font-family: "Fredoka", sans-serif;
  text-align: center;
  text-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
}
.mg__day-sun {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(70vw, 520px);
  aspect-ratio: 1;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(255, 224, 140, 0.55), rgba(255, 170, 70, 0) 65%);
  animation: mg-sun 1.9s ease-out both;
}
.mg__day-k {
  position: relative;
  font-weight: 700;
  letter-spacing: 6px;
  font-size: clamp(14px, 2.4vw, 20px);
  color: #ffe08a;
}
.mg__day-n {
  position: relative;
  font-weight: 700;
  font-size: clamp(56px, 12vw, 120px);
  line-height: 1;
  color: #fff;
}
.mg__day-s {
  position: relative;
  font-family: "Nunito", sans-serif;
  font-weight: 800;
  font-size: clamp(14px, 2.4vw, 20px);
  color: rgba(255, 255, 255, 0.85);
}
.mg-day-enter-active {
  animation: mg-dayin 0.6s cubic-bezier(0.34, 1.4, 0.64, 1) both;
}
.mg-day-leave-active {
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.mg-day-leave-to {
  opacity: 0;
  transform: translateY(-24px);
}
@keyframes mg-dayin {
  from {
    opacity: 0;
    transform: scale(0.8) translateY(30px);
  }
}
@keyframes mg-sun {
  from {
    transform: translate(-50%, 60%) scale(0.4);
    opacity: 0;
  }
  35% {
    opacity: 1;
  }
  to {
    transform: translate(-50%, -50%) scale(1.15);
  }
}
@media (prefers-reduced-motion: reduce) {
  .mg__day-sun {
    animation: none;
  }
}
.mg__night {
  position: absolute;
  z-index: 25;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(5, 12, 30, 0.72);
  font-family: "Fredoka", sans-serif;
  font-weight: 600;
  font-size: clamp(22px, 4vw, 34px);
  text-align: center;
  padding: 16px;
}
.mg__mute {
  position: absolute;
  z-index: 40;
  right: calc(12px + env(safe-area-inset-right));
  bottom: calc(12px + env(safe-area-inset-bottom));
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(12, 24, 48, 0.6);
  backdrop-filter: blur(10px);
  font-size: 18px;
  cursor: pointer;
}
@keyframes mg-bob {
  0%,
  100% {
    transform: translate(-50%, 0);
  }
  50% {
    transform: translate(-50%, -5px);
  }
}
.mg-fade-enter-active,
.mg-fade-leave-active {
  transition: opacity 0.45s ease;
}
.mg-fade-enter-from,
.mg-fade-leave-to {
  opacity: 0;
}
</style>

<style>
.mg-boot { position: absolute; inset: 0; z-index: 45; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; background: radial-gradient(ellipse at center, #10264a, #060f24 75%); color: rgba(255, 255, 255, 0.85); font: 700 15px "Nunito", sans-serif; }
.mg-boot__orbit { position: relative; width: 64px; height: 64px; animation: mg-orbit 1.6s linear infinite; }
.mg-boot__orbit i { position: absolute; left: 50%; top: 50%; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #9ee7ff, #2f7fe0 60%, #1d4fa0); box-shadow: 0 0 18px rgba(79, 209, 255, 0.55); }
.mg-boot__orbit b { position: absolute; left: 50%; top: 0; width: 12px; height: 12px; margin-left: -6px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff, #c9ccd8 70%); box-shadow: 0 0 10px rgba(255, 255, 255, 0.6); }
@keyframes mg-orbit { to { transform: rotate(360deg); } }
</style>
