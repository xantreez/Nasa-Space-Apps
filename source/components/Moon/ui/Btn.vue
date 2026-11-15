<script setup lang="ts">
import { sfx } from "../../../moon/sfx";
withDefaults(defineProps<{ variant?: "go" | "blue" | "ghost" | "warn"; big?: boolean; disabled?: boolean }>(), {
  variant: "go",
});
const emit = defineEmits<{ click: [e: MouseEvent] }>();
function onClick(e: MouseEvent) {
  sfx.click();
  emit("click", e);
}
</script>

<template>
  <button class="mbtn" :class="[`mbtn--${variant}`, { 'mbtn--big': big }]" :disabled="disabled" @click="onClick">
    <slot />
  </button>
</template>

<style scoped>
.mbtn {
  --c: #2fcf6b;
  --e: #1a9a4c;
  font-family: "Fredoka", sans-serif;
  font-weight: 700;
  font-size: 17px;
  letter-spacing: 0.3px;
  color: #fff;
  background: linear-gradient(180deg, color-mix(in srgb, var(--c) 82%, #fff), var(--c));
  border: 0;
  border-radius: 18px;
  min-height: 48px;
  padding: 10px 24px;
  box-shadow: 0 5px 0 var(--e), 0 10px 18px rgba(0, 0, 0, 0.3), inset 0 2px 0 rgba(255, 255, 255, 0.35);
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.18);
  cursor: pointer;
  transition: transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.12s, filter 0.15s;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.mbtn:hover:not(:disabled) { transform: translateY(-2px) scale(1.03); filter: brightness(1.06); }
.mbtn:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 2px 0 var(--e), 0 4px 8px rgba(0, 0, 0, 0.3), inset 0 2px 0 rgba(255,255,255,.3); }
.mbtn:disabled { opacity: 0.5; cursor: default; }
.mbtn--blue { --c: #3a9bff; --e: #1f66c4; }
.mbtn--warn { --c: #ff9f43; --e: #c96a14; }
.mbtn--ghost {
  --c: rgba(255, 255, 255, 0.16);
  --e: rgba(0, 0, 0, 0.3);
  background: rgba(255, 255, 255, 0.14);
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.25);
  font-size: 15px;
  padding: 8px 18px;
}
.mbtn--big { font-size: 24px; min-height: 62px; padding: 12px 46px; border-radius: 24px; }
@media (min-width: 900px) { .mbtn { font-size: 18px; } .mbtn--big { font-size: 28px; } }
</style>
