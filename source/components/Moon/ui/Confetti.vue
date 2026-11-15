<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
// Emits a burst of DOM confetti. Change `fire` (number) to burst again.
const props = withDefaults(defineProps<{ fire?: number; count?: number }>(), { fire: 1, count: 70 });
const COLORS = ["#4fd1ff", "#ffd23f", "#7cf29c", "#ff9f43", "#ff6b9d", "#a78bfa", "#fff"];
const bits = ref<{ id: number; style: Record<string, string> }[]>([]);
let n = 0;
function burst() {
  const arr = [];
  for (let i = 0; i < props.count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 120 + Math.random() * 300;
    arr.push({
      id: n++,
      style: {
        "--dx": `${Math.cos(ang) * dist}px`,
        "--dy": `${Math.sin(ang) * dist - 160}px`,
        "--rot": `${Math.random() * 900 - 450}deg`,
        "--c": COLORS[i % COLORS.length],
        "--w": `${6 + Math.random() * 8}px`,
        "--h": `${8 + Math.random() * 10}px`,
        "--d": `${1.2 + Math.random() * 0.9}s`,
        "--delay": `${Math.random() * 0.12}s`,
        "--r": Math.random() > 0.5 ? "50%" : "2px",
      },
    });
  }
  bits.value = arr;
  setTimeout(() => (bits.value = []), 2400);
}
onMounted(burst);
watch(() => props.fire, burst);
</script>

<template>
  <div class="mconf" aria-hidden="true">
    <i v-for="b in bits" :key="b.id" :style="b.style" />
  </div>
</template>

<style scoped>
.mconf { position: absolute; left: 50%; top: 38%; width: 0; height: 0; pointer-events: none; z-index: 80; }
.mconf i {
  position: absolute; left: 0; top: 0; width: var(--w); height: var(--h); background: var(--c); border-radius: var(--r);
  animation: fly var(--d) cubic-bezier(0.15, 0.7, 0.3, 1) var(--delay) both;
}
@keyframes fly {
  0% { transform: translate(0, 0) rotate(0); opacity: 1; }
  70% { opacity: 1; }
  100% { transform: translate(var(--dx), calc(var(--dy) + 320px)) rotate(var(--rot)); opacity: 0; }
}
</style>
