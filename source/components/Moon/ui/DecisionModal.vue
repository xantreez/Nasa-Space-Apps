<script setup lang="ts">
import { ref } from "vue";
import type { Decision, Resources } from "../../../moon/types";
import Sheet from "./Sheet.vue";
import { RES, RES_KEYS } from "./meta";
import { sfx } from "../../../moon/sfx";

defineProps<{ decision: Decision; res: Resources }>();
const emit = defineEmits<{ choose: [optionId: string] }>();
const picked = ref<string | null>(null);
function pick(id: string) {
  if (picked.value) return;
  picked.value = id;
  sfx.pop();
  setTimeout(() => emit("choose", id), 380);
}
</script>

<template>
  <Sheet tone="#ffb02e">
    <div class="md">
      <div class="md__tag">🤔 Tobish needs your decision!</div>
      <h2 class="md__title">{{ decision.title }}</h2>
      <p class="md__prompt">{{ decision.prompt }}</p>

      <div class="md__res">
        <div v-for="k in RES_KEYS" :key="k" class="md__r" :style="{ '--c': RES[k].color }">
          <span>{{ RES[k].emoji }}</span>
          <span class="md__bar"><i :style="{ width: res[k] + '%' }" /></span>
          <b>{{ res[k] }}</b>
        </div>
      </div>

      <div class="md__hint">💡 Think: what does each choice use up, and what does it keep safe? You'll see what happens to ALL of them after you choose.</div>

      <div class="md__opts" :class="{ 'md__opts--3': decision.options.length > 2 }">
        <button
          v-for="(o, i) in decision.options"
          :key="o.id"
          class="md__opt"
          :class="{ 'is-picked': picked === o.id, 'is-off': picked && picked !== o.id }"
          :style="{ '--i': i }"
          @click="pick(o.id)"
        >
          <span class="md__emoji">{{ o.emoji }}</span>
          <span class="md__label">{{ o.label }}</span>
        </button>
      </div>
    </div>
  </Sheet>
</template>

<style scoped>
.md__tag { display: inline-block; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 14px; letter-spacing: 1px; text-transform: uppercase; padding: 5px 14px; border-radius: 99px; background: #ffb02e; color: #3a2400; box-shadow: 0 3px 0 #b87a00; }
.md__title { margin: 12px 0 6px; font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 30px; line-height: 1.12; }
.md__prompt { margin: 0 0 14px; font-weight: 700; color: rgba(255,255,255,.93); }
.md__res { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 12px; padding: 10px; border-radius: 16px; background: rgba(0,0,0,.25); }
.md__r { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 16px; }
.md__r b { font-family: "Fredoka", sans-serif; font-size: 16px; }
.md__bar { width: 100%; height: 8px; border-radius: 5px; background: rgba(255,255,255,.15); overflow: hidden; }
.md__bar i { display: block; height: 100%; background: var(--c); border-radius: 5px; animation: fill .8s cubic-bezier(.34,1.2,.64,1) both; transform-origin: left; }
.md__hint { margin-bottom: 14px; padding: 10px 14px; border-radius: 16px; font-weight: 800; font-size: 15px; background: rgba(255,210,63,.14); border: 1px dashed rgba(255,210,63,.6); color: #ffeaa0; }
.md__opts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.md__opts--3 { grid-template-columns: repeat(3, 1fr); }
.md__opt {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 140px; padding: 16px 12px;
  border-radius: 24px; cursor: pointer; color: #fff; font-family: inherit; text-align: center;
  background: linear-gradient(180deg, rgba(58,155,255,.32), rgba(31,102,196,.32)); border: 2px solid rgba(120,190,255,.6);
  box-shadow: 0 6px 0 #1a4f9a, 0 12px 20px rgba(0,0,0,.3), inset 0 2px 0 rgba(255,255,255,.2);
  animation: pop .5s cubic-bezier(.34,1.56,.64,1) calc(.2s + var(--i) * .1s) both;
  transition: transform .15s cubic-bezier(.34,1.56,.64,1), opacity .3s;
}
.md__opt:hover { transform: translateY(-4px) scale(1.03); }
.md__opt:active, .md__opt.is-picked { transform: translateY(4px) scale(.98); box-shadow: 0 2px 0 #1a4f9a; background: linear-gradient(180deg, #3a9bff, #1f66c4); }
.md__opt.is-off { opacity: .3; transform: scale(.94); }
.md__emoji { font-size: 48px; line-height: 1; }
.md__label { font-family: "Fredoka", sans-serif; font-weight: 600; font-size: 19px; line-height: 1.2; }
@keyframes fill { from { transform: scaleX(0); } }
@keyframes pop { from { opacity: 0; transform: translateY(24px) scale(.8); } }
@media (max-width: 640px) {
  .md { padding-bottom: calc(12px + env(safe-area-inset-bottom)); }
  .md__tag { font-size: 12px; padding: 3px 11px; }
  .md__title { font-size: 21px; margin: 8px 0 4px; }
  .md__prompt { font-size: 14.5px; margin-bottom: 8px; line-height: 1.35; }
  .md__res { padding: 6px 8px; gap: 6px; margin-bottom: 8px; border-radius: 12px; }
  .md__r { font-size: 13px; gap: 2px; } .md__r b { font-size: 13px; } .md__bar { height: 5px; }
  .md__hint { font-size: 13px; padding: 6px 10px; margin-bottom: 8px; border-radius: 12px; }
  .md__opts, .md__opts--3 { grid-template-columns: 1fr; gap: 8px; }
  .md__opt { flex-direction: row; min-height: 58px; justify-content: flex-start; text-align: left; padding: 8px 14px; gap: 12px; border-radius: 18px; box-shadow: 0 4px 0 #1a4f9a, inset 0 2px 0 rgba(255,255,255,.2); }
  .md__emoji { font-size: 30px; } .md__label { font-size: 17px; }
}
@media (max-width: 640px) and (max-height: 700px) { .md__hint { display: none; } .md__opt { min-height: 52px; } }
@media (min-width: 900px) { .md__title { font-size: 36px; } .md__label { font-size: 21px; } }
</style>
