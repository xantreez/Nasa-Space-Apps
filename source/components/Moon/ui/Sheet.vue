<script setup lang="ts">
// Shared modal shell: dim backdrop, centered pop-in card on desktop, bottom sheet on phones.
withDefaults(defineProps<{ wide?: boolean; tone?: string }>(), { tone: "#4fd1ff" });
</script>

<template>
  <div class="msheet">
    <div class="msheet__card" :class="{ 'msheet__card--wide': wide }" :style="{ '--tone': tone }">
      <slot />
    </div>
    <slot name="over" />
  </div>
</template>

<style scoped>
.msheet {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: radial-gradient(ellipse at center, rgba(5, 12, 30, 0.45), rgba(5, 12, 30, 0.8));
  animation: fade 0.25s ease both;
  font-family: "Nunito", sans-serif;
  color: #fff;
}
.msheet__card {
  position: relative;
  width: min(640px, 100%);
  max-height: calc(100% - 8px);
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px 24px 22px;
  border-radius: 28px;
  background: linear-gradient(180deg, rgba(22, 40, 74, 0.86), rgba(12, 24, 48, 0.9));
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 0 0 3px color-mix(in srgb, var(--tone) 18%, transparent);
  animation: pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  font-size: 17px;
  font-weight: 600;
  line-height: 1.45;
  scrollbar-width: thin;
}
.msheet__card--wide { width: min(1080px, 100%); }
@keyframes fade { from { opacity: 0; } }
@keyframes pop { from { opacity: 0; transform: translateY(30px) scale(0.86); } }
@media (max-width: 640px) {
  .msheet { align-items: flex-end; padding: 0; }
  .msheet__card {
    width: 100%;
    max-height: calc(100% - 58px - env(safe-area-inset-top));
    border-radius: 22px 22px 0 0;
    padding: 10px 14px 0;
    font-size: 15px;
    line-height: 1.38;
    animation-name: sheet;
    overscroll-behavior: contain;
  }
  .msheet__card::before {
    content: ""; display: block; width: 40px; height: 4px; border-radius: 3px;
    background: rgba(255,255,255,.25); margin: 0 auto 8px;
  }
  /* primary button always visible: sticky footer inside the sheet, clear of the Safari toolbar */
  .msheet__card :deep([class*="__cta"]) {
    position: sticky; bottom: 0; z-index: 3; margin: 8px -14px 0 !important; padding: 10px 14px calc(12px + env(safe-area-inset-bottom));
    background: linear-gradient(180deg, rgba(12,24,48,0), rgba(12,24,48,.97) 26%);
  }
}
@keyframes sheet { from { transform: translateY(100%); } }
@media (min-width: 900px) { .msheet__card { font-size: 18px; padding: 30px 32px 28px; } }
</style>
