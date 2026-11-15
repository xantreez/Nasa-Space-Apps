<script setup lang="ts">
// «Куда направить ресурсы?» — игрок сам решает, какой ресурс пополнить наградой.
// Свой ресурс локации получает всё, остальные — 2/3 (потери при передаче).
import { computed, ref } from "vue";
import Btn from "./Btn.vue";
import Sheet from "./Sheet.vue";
import { RES, RES_KEYS } from "./meta";
import { sfx } from "../../../moon/sfx";
import type { ResKey, Resources } from "../../../moon/types";

const props = defineProps<{ res: Resources; amount: number; home: ResKey; from: string }>();
const emit = defineEmits<{ pick: [k: ResKey] }>();

const sel = ref<ResKey | null>(null);
const gain = (k: ResKey) => (k === props.home ? props.amount : Math.round((props.amount * 2) / 3));
const lowest = computed(() => [...RES_KEYS].sort((a, b) => props.res[a] - props.res[b])[0]);
const danger = computed(() => (props.res[lowest.value] <= 30 ? lowest.value : null));

function choose(k: ResKey) {
  sel.value = k;
  sfx.coin();
}
function confirm() {
  if (!sel.value) return;
  sfx.powerUp();
  emit("pick", sel.value);
}
</script>

<template>
  <Sheet tone="#ffd23f">
    <div class="rp">
      <div class="rp__tag">🎁 SUPPLIES EARNED</div>
      <h2 class="rp__title">Where should they go, Commander?</h2>
      <p class="rp__sub">
        <b>{{ from }}</b> earned you supplies. Sending them to <b>{{ RES[home].emoji }} {{ RES[home].label }}</b> gives the full
        <b>+{{ amount }}</b>. Sending them anywhere else loses some on the way: <b>+{{ Math.round((amount * 2) / 3) }}</b>.
      </p>
      <div v-if="danger" class="rp__warn">⚠️ {{ RES[danger].emoji }} {{ RES[danger].label }} is low ({{ res[danger] }}). If any supply reaches 0, the outpost fails!</div>

      <div class="rp__grid">
        <button
          v-for="k in RES_KEYS"
          :key="k"
          class="rp__opt"
          :class="{ on: sel === k, home: k === home, low: res[k] <= 30 }"
          :style="{ '--c': RES[k].color }"
          @click="choose(k)"
        >
          <span class="rp__emoji">{{ RES[k].emoji }}</span>
          <span class="rp__name">{{ RES[k].label }}</span>
          <span class="rp__bar">
            <i class="now" :style="{ width: `${res[k]}%` }" />
            <i class="add" :style="{ left: `${res[k]}%`, width: `${Math.min(100 - res[k], gain(k))}%` }" />
          </span>
          <span class="rp__nums">
            {{ res[k] }} → <b>{{ Math.min(100, res[k] + gain(k)) }}</b>
            <em>+{{ gain(k) }}</em>
          </span>
          <span v-if="k === home" class="rp__badge">full</span>
        </button>
      </div>

      <div class="rp__cta">
        <Btn big :disabled="!sel" @click="confirm">{{ sel ? `Send to ${RES[sel].label} ${RES[sel].emoji}` : "Pick a supply" }}</Btn>
      </div>
    </div>
  </Sheet>
</template>

<style scoped>
.rp__tag { font-family: "Fredoka", sans-serif; font-weight: 700; letter-spacing: 1px; color: #ffd23f; font-size: 14px; }
.rp__title { margin: 4px 0 6px; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 26px; line-height: 1.15; }
.rp__sub { margin: 0 0 10px; font-size: 15.5px; color: rgba(255, 255, 255, 0.85); }
.rp__warn {
  margin-bottom: 12px; padding: 10px 14px; border-radius: 14px; font-weight: 800; font-size: 15px;
  background: rgba(255, 77, 109, 0.16); border: 1.5px solid rgba(255, 77, 109, 0.6); animation: warn 1.2s ease-in-out infinite;
}
@keyframes warn { 50% { background: rgba(255, 77, 109, 0.28); } }
.rp__grid { display: grid; grid-template-columns: 1fr; gap: 8px; }
.rp__opt {
  position: relative; display: grid; grid-template-columns: 34px 82px 1fr auto; align-items: center; gap: 10px;
  padding: 10px 14px; border-radius: 16px; cursor: pointer; text-align: left; color: #fff; font: inherit;
  background: rgba(255, 255, 255, 0.06); border: 2px solid rgba(255, 255, 255, 0.1);
  transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.15s, background 0.15s;
}
.rp__opt:hover { transform: translateY(-2px); background: rgba(255, 255, 255, 0.1); }
.rp__opt.on { border-color: var(--c); background: color-mix(in srgb, var(--c) 18%, transparent); transform: scale(1.02); box-shadow: 0 0 0 4px color-mix(in srgb, var(--c) 22%, transparent); }
.rp__opt.low .rp__name { color: #ff8fa3; }
.rp__emoji { font-size: 26px; }
.rp__name { font-family: "Fredoka", sans-serif; font-weight: 600; font-size: 17px; }
.rp__bar { position: relative; height: 12px; border-radius: 99px; background: rgba(0, 0, 0, 0.35); overflow: hidden; }
.rp__bar i { position: absolute; top: 0; bottom: 0; }
.rp__bar .now { left: 0; background: var(--c); border-radius: 99px; }
.rp__bar .add { background: repeating-linear-gradient(45deg, color-mix(in srgb, var(--c) 70%, #fff) 0 6px, color-mix(in srgb, var(--c) 40%, transparent) 6px 12px); opacity: 0.35; transition: opacity 0.2s; }
.rp__opt.on .rp__bar .add { opacity: 1; animation: grow 0.5s ease-out; }
@keyframes grow { from { transform: scaleX(0); transform-origin: left; } }
.rp__nums { font-weight: 800; font-size: 15px; white-space: nowrap; }
.rp__nums em { font-style: normal; margin-left: 6px; color: var(--c); }
.rp__badge { position: absolute; top: -8px; right: 12px; font-size: 11px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; padding: 2px 8px; border-radius: 99px; background: #ffd23f; color: #3a2a00; }
.rp__cta { display: flex; justify-content: center; margin-top: 16px; }
@media (max-width: 640px) {
  .rp__tag { font-size: 12px; }
  .rp__title { font-size: 20px; margin: 2px 0 4px; }
  .rp__sub { font-size: 13.5px; margin-bottom: 8px; line-height: 1.3; }
  .rp__warn { padding: 6px 10px; font-size: 13px; margin-bottom: 8px; border-radius: 12px; }
  .rp__grid { gap: 6px; }
  .rp__opt { grid-template-columns: 24px 62px 1fr auto; gap: 8px; padding: 6px 10px; border-radius: 14px; border-width: 1.5px; }
  .rp__emoji { font-size: 20px; } .rp__name { font-size: 15px; } .rp__bar { height: 9px; }
  .rp__nums { font-size: 13.5px; } .rp__nums em { margin-left: 4px; }
  .rp__badge { top: -7px; right: 8px; font-size: 10px; padding: 1px 7px; }
  .rp__opt.on { transform: none; }
  .rp__cta { margin-top: 8px; }
  .rp__cta :deep(.mbtn) { width: 100%; font-size: 20px; min-height: 52px; padding: 8px 16px; }
}
</style>
