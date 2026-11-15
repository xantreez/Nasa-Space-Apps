<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import Btn from "./Btn.vue";
import Sheet from "./Sheet.vue";
import { sfx } from "../../../moon/sfx";

const props = withDefaults(defineProps<{ title: string; text: string; from?: string; cta: string }>(), { from: "TOBISH" });
const emit = defineEmits<{ close: [] }>();

const shown = ref(0);
const done = computed(() => shown.value >= props.text.length);
let timer: ReturnType<typeof setInterval> | null = null;

function start() {
  stop();
  shown.value = 0;
  sfx.radio();
  timer = setInterval(() => {
    shown.value = Math.min(props.text.length, shown.value + 2);
    if (shown.value >= props.text.length) stop();
  }, 26);
}
function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}
function skip() {
  if (!done.value) {
    shown.value = props.text.length;
    stop();
  }
}
onMounted(start);
watch(() => props.text, start);
onBeforeUnmount(stop);
</script>

<template>
  <Sheet tone="#7cf29c">
    <div class="mr" @click="skip">
      <div class="mr__scan" />
      <div class="mr__top">
        <span class="mr__live"><i /> 📡 INCOMING · {{ from }}</span>
        <span class="mr__bars"><i /><i /><i /><i /></span>
      </div>
      <div class="mr__body">
        <div class="mr__avatar" :class="{ 'mr__avatar--talk': !done }">
          <span>🧑‍🚀</span>
        </div>
        <div class="mr__msg">
          <div class="mr__title">{{ title }}</div>
          <p class="mr__text">{{ text.slice(0, shown) }}<span v-if="!done" class="mr__cur">▍</span></p>
          <div v-if="!done" class="mr__skip">tap to skip</div>
        </div>
      </div>
      <div class="mr__cta">
        <Btn :class="{ 'mr__cta-btn': done }" @click.stop="emit('close')">{{ cta }}</Btn>
      </div>
    </div>
  </Sheet>
</template>

<style scoped>
.mr { position: relative; }
.mr__scan {
  position: absolute; inset: -24px; pointer-events: none; border-radius: 28px; opacity: 0.5;
  background: repeating-linear-gradient(0deg, rgba(124, 242, 156, 0.07) 0 2px, transparent 2px 5px);
  animation: scan 6s linear infinite;
}
.mr__top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.mr__live { font-family: "Fredoka", sans-serif; font-weight: 700; letter-spacing: 1px; font-size: 15px; color: #7cf29c; display: flex; align-items: center; gap: 8px; }
.mr__live i { width: 10px; height: 10px; border-radius: 50%; background: #ff4d6d; animation: blink 1s infinite; }
.mr__bars { display: flex; gap: 3px; align-items: flex-end; height: 18px; }
.mr__bars i { width: 5px; background: #7cf29c; border-radius: 2px; animation: eq 0.9s ease-in-out infinite; }
.mr__bars i:nth-child(2) { animation-delay: 0.15s; } .mr__bars i:nth-child(3) { animation-delay: 0.3s; } .mr__bars i:nth-child(4) { animation-delay: 0.45s; }
.mr__body { display: flex; gap: 16px; align-items: flex-start; }
.mr__avatar {
  flex: none; width: 72px; height: 72px; border-radius: 50%; display: grid; place-items: center; font-size: 40px;
  background: radial-gradient(circle at 35% 30%, #9ee7ff, #3a9bff 70%); border: 4px solid #fff;
  box-shadow: 0 5px 0 #1f66c4, 0 0 24px rgba(79, 209, 255, 0.5);
}
.mr__avatar--talk { animation: talk 0.4s ease-in-out infinite; }
.mr__msg { flex: 1; min-width: 0; }
.mr__title { font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 24px; margin-bottom: 4px; color: #fff; }
.mr__text { margin: 0; min-height: 4.4em; font-weight: 700; font-size: 17px; line-height: 1.5; color: #eaf6ff; white-space: pre-wrap; }
.mr__cur { color: #7cf29c; animation: blink 0.7s infinite; }
.mr__skip { margin-top: 6px; font-size: 13.5px; font-weight: 700; color: rgba(255, 255, 255, 0.6); }
.mr__cta { display: flex; justify-content: flex-end; margin-top: 16px; }
.mr__cta-btn { animation: pulse 1.4s ease-in-out infinite; }
@media (max-width: 640px) {
  .mr__top { margin-bottom: 8px; } .mr__live { font-size: 12.5px; }
  .mr__body { gap: 10px; }
  .mr__avatar { width: 44px; height: 44px; font-size: 24px; border-width: 3px; }
  .mr__title { font-size: 18px; margin-bottom: 2px; line-height: 1.15; }
  .mr__text { font-size: 14.5px; line-height: 1.38; min-height: 0; }
  .mr__skip { font-size: 12px; }
  .mr__cta :deep(.mbtn), .mr__cta .mbtn { width: 100%; min-height: 46px; } .mr__cta { display: block; margin-top: 8px; }
}
@media (min-width: 900px) { .mr__text { font-size: 19px; } .mr__avatar { width: 84px; height: 84px; font-size: 48px; } }
@keyframes scan { to { background-position: 0 40px; } }
@keyframes blink { 50% { opacity: 0.15; } }
@keyframes eq { 0%, 100% { height: 4px; } 50% { height: 18px; } }
@keyframes talk { 50% { transform: scale(1.07) rotate(-3deg); } }
@keyframes pulse { 50% { transform: scale(1.06); } }
</style>
