<script setup lang="ts">
// Name pill + invisible hit area for one location (interactive layer, drawn above the night wash).
import { computed } from "vue";
import type { LocationId } from "../../../moon/types";
import { LOC_META } from "./layout";

const props = defineProps<{
  id: LocationId; x: number; y: number; s: number; h: number; size: number;
  highlighted: boolean; hover: boolean; disabled: boolean;
}>();
const emit = defineEmits<{ go: [loc: LocationId]; hover: [on: boolean] }>();

const meta = computed(() => LOC_META[props.id]);
const ph = computed(() => props.size * 2.1);
const textW = computed(() => meta.value.name.length * props.size * 0.56);
const total = computed(() => props.size * 1.3 + textW.value);
const pw = computed(() => total.value + props.size * 1.6);
const ly = computed(() => -(props.h * props.s) - props.size * 1.7 - (props.highlighted ? 4 : 0));
const hw = computed(() => Math.max(92 * props.s, pw.value / 2 + 6));
const hitTop = computed(() => ly.value - ph.value / 2 - (props.highlighted ? props.size * 2.2 : 8));

function go() { emit("go", props.id); }
</script>

<template>
  <g class="lab" :class="{ off: disabled }" role="button" tabindex="0" :aria-label="meta.aria" :aria-disabled="disabled"
    :transform="`translate(${x} ${y})`" @click="go" @keydown.enter.prevent="go" @keydown.space.prevent="go"
    @pointerenter="emit('hover', true)" @pointerleave="emit('hover', false)" @focus="emit('hover', true)" @blur="emit('hover', false)">
    <rect :x="-hw" :y="hitTop" :width="hw * 2" :height="-hitTop + 18 * s + 10" fill="transparent" />
    <g :style="{ transform: `translate(0px, ${ly}px)` }">
      <g class="pill" :class="{ on: hover && !disabled, hl: highlighted }">
        <rect class="fring" :x="-pw / 2 - 4" :y="-ph / 2 - 4" :width="pw + 8" :height="ph + 8" :rx="ph / 2 + 4" fill="none" stroke="#4fd1ff" stroke-width="3" />
        <g v-if="highlighted" class="arrow">
          <path :d="`M ${-size * 0.7} ${-ph / 2 - size * 1.5} L ${size * 0.7} ${-ph / 2 - size * 1.5} L 0 ${-ph / 2 - size * 0.4} Z`" fill="#ffd23f" stroke="#7a4f00" stroke-width="2" stroke-linejoin="round" />
        </g>
        <rect :x="-pw / 2" :y="-ph / 2 + 3" :width="pw" :height="ph" :rx="ph / 2" :fill="highlighted ? '#d89a00' : '#aab4d0'" />
        <rect :x="-pw / 2" :y="-ph / 2" :width="pw" :height="ph" :rx="ph / 2" :fill="highlighted ? '#ffd23f' : '#ffffff'" :fill-opacity="highlighted ? 1 : 0.96" />
        <path :d="`M -6 ${ph / 2 - 1} L 0 ${ph / 2 + 6} L 6 ${ph / 2 - 1} Z`" :fill="highlighted ? '#ffd23f' : '#ffffff'" />
        <text :x="-total / 2 + size * 0.55" :y="size * 0.38" text-anchor="middle" :font-size="size * 1.15">{{ meta.emoji }}</text>
        <text :x="-total / 2 + size * 1.3" :y="size * 0.38" text-anchor="start" :font-size="size" font-weight="700" font-family="Fredoka, Nunito, sans-serif" fill="#10223f">{{ meta.name }}</text>
      </g>
    </g>
  </g>
</template>

<style scoped>
.lab { cursor: pointer; outline: none; -webkit-tap-highlight-color: transparent; }
.lab.off { cursor: default; }
.pill { transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1); }
.pill.on { transform: scale(1.08) translateY(-3px); }
.lab:active:not(.off) .pill { transform: scale(0.96); }
.fring { opacity: 0; }
.lab:focus-visible .fring { opacity: 1; }
.arrow { animation: bounce 0.9s ease-in-out infinite; }
.hl { filter: drop-shadow(0 0 6px rgba(255, 210, 63, 0.7)); }
@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
@media (prefers-reduced-motion: reduce) { .arrow { animation: none !important; } .pill { transition: none; } }
</style>
