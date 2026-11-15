<script setup lang="ts">
import Btn from "./Btn.vue";
import { sfx } from "../../../moon/sfx";
const emit = defineEmits<{ start: [] }>();
function go() {
  sfx.unlock();
  sfx.pop();
  emit("start");
}
</script>

<template>
  <div class="mt">
    <div class="mt__inner">
      <div class="mt__badge">🚀 NASA Space Apps</div>
      <h1 class="mt__title">
        <span>JUNIOR</span>
        <span class="mt__astro">ASTRONAUT</span>
      </h1>
      <div class="mt__sub">🌙 Moon Outpost</div>
      <p class="mt__hook">
        Tobish crashed on the Moon. His computer still works. He needs a commander — <b>you.</b>
      </p>
      <Btn big class="mt__play" @click="go">▶ PLAY</Btn>
      <p class="mt__src">Built on real NASA data: DONKI · OSDR · MSL RAD · Moon Trek</p>
    </div>
  </div>
</template>

<style scoped>
.mt {
  position: absolute; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center;
  padding: 20px; text-align: center; color: #fff; font-family: "Nunito", sans-serif;
  background: radial-gradient(ellipse at 50% 45%, rgba(5, 12, 30, 0.35), rgba(5, 12, 30, 0.78));
  overflow: auto;
}
.mt__inner { display: flex; flex-direction: column; align-items: center; gap: 14px; max-width: 640px; }
.mt__badge {
  font-weight: 800; font-size: 14px; letter-spacing: 1.5px; text-transform: uppercase; padding: 6px 16px;
  border-radius: 99px; background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px); animation: drop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.mt__title {
  margin: 0; display: flex; flex-direction: column; font-family: "Fredoka", sans-serif; font-weight: 700;
  font-size: clamp(40px, 11vw, 92px); line-height: 0.95; letter-spacing: 2px;
  text-shadow: 0 4px 0 #1f66c4, 0 8px 0 rgba(0, 0, 0, 0.25), 0 14px 30px rgba(0, 0, 0, 0.45);
}
.mt__title span { animation: drop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both; }
.mt__astro {
  background: linear-gradient(180deg, #ffe680, #ff9f43); -webkit-background-clip: text; background-clip: text;
  color: transparent; filter: drop-shadow(0 4px 0 #b4561a); text-shadow: none; animation-delay: 0.25s !important;
}
.mt__sub {
  font-family: "Fredoka", sans-serif; font-weight: 600; font-size: clamp(22px, 5vw, 34px); color: #bfe8ff;
  animation: drop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s both;
}
.mt__hook {
  margin: 4px 0 6px; font-size: clamp(16px, 3.6vw, 20px); font-weight: 700; line-height: 1.45; max-width: 460px;
  padding: 12px 18px; border-radius: 20px; background: rgba(12, 24, 48, 0.6); border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px); animation: drop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.55s both;
}
.mt__hook b { color: #ffd23f; }
.mt__play { animation: drop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.7s both, bob 1.8s ease-in-out 1.6s infinite; }
.mt__src { margin: 8px 0 0; font-size: 13.5px; font-weight: 700; color: rgba(255, 255, 255, 0.7); animation: drop 1s ease 1s both; }
@keyframes drop { from { opacity: 0; transform: translateY(-26px) scale(0.9); } }
@keyframes bob { 50% { transform: translateY(-6px) scale(1.04); } }
</style>
