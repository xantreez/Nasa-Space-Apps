<script setup lang="ts">
// One base location, drawn with its base centre at (0,0) and scaled by `s` (parent translates it).
// `lightsOnly` renders just the glowing bits (windows, screens, lamps) so they can sit above the night wash.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { BuildId, LocationId } from "../../../moon/types";

const props = defineProps<{
  id: LocationId; s: number; built: BuildId[]; night: boolean; lightsOnly?: boolean; highlighted?: boolean; hover?: boolean;
}>();

const ready = ref(false);
onMounted(() => nextTick(() => (ready.value = true)));
// builds that just appeared (drives the one-shot burst ring)
const fresh = ref<BuildId[]>([]);
let freshT = 0;
watch(() => props.built.join(","), (n, o) => {
  if (!ready.value) return;
  const old = o ? o.split(",") : [];
  fresh.value = n.split(",").filter((b) => b && !old.includes(b)) as BuildId[];
  clearTimeout(freshT);
  freshT = window.setTimeout(() => (fresh.value = []), 1400);
});
onBeforeUnmount(() => clearTimeout(freshT));
const has = (b: BuildId) => props.built.includes(b);

// solar panel geometry
const panels = computed(() =>
  [-98, -46, 6].map((x0) => {
    const TL = [x0, -46], TR = [x0 + 48, -52], BR = [x0 + 48, -20], BL = [x0, -12];
    const mix = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const P = (u: number, v: number) => {
      const t = mix(TL, TR, u), b = mix(BL, BR, u);
      const p = mix(t, b, v);
      return `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    };
    const lines: string[] = [];
    for (const u of [0.25, 0.5, 0.75]) lines.push(`M ${P(u, 0)} L ${P(u, 1)}`);
    for (const v of [0.33, 0.66]) lines.push(`M ${P(0, v)} L ${P(1, v)}`);
    return {
      poly: `${TL.join(" ")} ${TR.join(" ")} ${BR.join(" ")} ${BL.join(" ")}`,
      sheen: `${TL.join(" ")} ${TR.join(" ")} ${P(1, 0.4)} ${P(0, 0.4)}`,
      grid: lines.join(" "), cx: x0 + 24, cy: -17,
    };
  }),
);

// trefoil (radiation) via dashed ring
const tre = 2 * Math.PI * 4;
const burstDirs = [
  [0, -46], [40, -30], [48, 6], [-40, -30], [-48, 6], [0, -70],
].map(([dx, dy]) => ({ dx, dy }));

const plants = [-36, -12, 14, 38];
</script>

<template>
  <g class="loc" :class="[id, { night }]">
    <g v-if="highlighted && !lightsOnly" class="rings" fill="none" stroke="#ffd23f">
      <ellipse class="ring" cx="0" cy="6" rx="96" ry="22" stroke-width="4" />
      <ellipse class="ring r2" cx="0" cy="6" rx="96" ry="22" stroke-width="3" />
    </g>
    <g v-if="!lightsOnly" class="art-wrap" :class="{ on: hover }">
      <!-- ============ HABITAT ============ -->
      <g v-if="id === 'habitat'">
        <ellipse cx="34" cy="3" rx="100" ry="10" fill="#6b7190" opacity=".35" />
        <!-- airlock -->
        <rect x="52" y="-38" width="52" height="38" rx="13" fill="url(#mnMetal)" />
        <rect x="52" y="-38" width="52" height="9" rx="4.5" fill="#fff" opacity=".55" />
        <rect x="52" y="-12" width="52" height="5" fill="#ff9f43" />
        <circle cx="78" cy="-21" r="11.5" fill="#ff9f43" /><circle cx="78" cy="-21" r="8" fill="#243357" />
        <circle cx="78" cy="-21" r="5" fill="#4fd1ff" opacity=".8" /><path d="M74 -24 Q78 -27 82 -24" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" />
        <!-- dome -->
        <path d="M-64 0 A64 74 0 0 1 64 0 Z" fill="url(#mnDome)" />
        <path d="M-40 0 A40 74 0 0 1 40 0 M-17 0 A17 74 0 0 1 17 0 M-58 -28 Q0 -38 58 -28 M-44 -52 Q0 -62 44 -52" fill="none" stroke="#8e93a8" stroke-opacity=".28" stroke-width="2" />
        <path d="M-56 -14 A58 66 0 0 1 -18 -64" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="5" stroke-linecap="round" />
        <rect x="-70" y="-10" width="140" height="10" rx="5" fill="#9aa0ba" />
        <rect x="-70" y="-10" width="140" height="4" rx="2" fill="#fff" opacity=".35" />
        <path d="M-70 -5 H70" stroke="#ff9f43" stroke-width="2.4" stroke-dasharray="10 8" />
        <!-- window frame -->
        <rect x="-35" y="-57" width="44" height="28" rx="13" fill="#2b4a7a" />
        <!-- antenna -->
        <line x1="26" y1="-70" x2="26" y2="-92" stroke="#aab1c8" stroke-width="3" stroke-linecap="round" />
        <!-- o2 generator -->
        <Transition name="pop">
          <g v-if="has('o2-generator')" class="pop">
            <rect x="-112" y="-52" width="30" height="52" rx="15" fill="url(#mnTank)" />
            <rect x="-107" y="-46" width="6" height="36" rx="3" fill="#fff" opacity=".6" />
            <rect x="-104" y="-61" width="16" height="10" rx="3" fill="#7d86a3" />
            <path d="M-82 -22 H-66" stroke="#9aa0ba" stroke-width="6" stroke-linecap="round" />
            <circle cx="-82" cy="-22" r="4" fill="#7d86a3" />
            <text x="-97" y="-22" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="12" fill="#0b4a66">O₂</text>
            <circle class="bub b1" cx="-96" cy="-66" r="3" fill="#bdf0ff" />
            <circle class="bub b2" cx="-92" cy="-66" r="2.2" fill="#bdf0ff" />
            <circle class="bub b3" cx="-99" cy="-66" r="1.8" fill="#bdf0ff" />
            <g v-if="fresh.includes('o2-generator')" class="burst"><circle cx="-97" cy="-26" r="14" fill="none" stroke="#4fd1ff" stroke-width="4" /></g>
          </g>
        </Transition>
      </g>

      <!-- ============ GREENHOUSE ============ -->
      <g v-else-if="id === 'greenhouse'">
        <ellipse cx="30" cy="3" rx="92" ry="9" fill="#6b7190" opacity=".35" />
        <rect x="60" y="-24" width="26" height="24" rx="9" fill="url(#mnMetal)" /><rect x="68" y="-17" width="10" height="17" rx="5" fill="#243357" />
        <path d="M-62 0 A62 66 0 0 1 62 0 Z" fill="#14485a" opacity=".75" />
        <ellipse class="aura" :class="{ on: has('garden') }" cx="0" cy="-26" rx="80" ry="56" fill="url(#mnHaloG)" />
        <rect x="-54" y="-12" width="108" height="12" rx="4" fill="#8a6a55" />
        <g class="plants" :class="{ big: has('garden') }">
          <g v-for="(px, i) in plants" :key="px" :transform="`translate(${px} -10)`">
            <g class="plant" :style="{ animationDelay: i * 0.4 + 's' }">
              <path d="M0 0 V-18" stroke="#2fa05f" stroke-width="3" stroke-linecap="round" />
              <path d="M0 -6 C-14 -8 -17 -24 -2 -30 C 8 -22 6 -10 0 -6Z" fill="#5be07f" transform="rotate(-30 0 -6)" />
              <path d="M0 -6 C-14 -8 -17 -24 -2 -30 C 8 -22 6 -10 0 -6Z" fill="#2fb868" transform="rotate(34 0 -6) scale(-1 1)" />
              <path d="M0 -14 C-12 -16 -14 -32 0 -40 C 12 -32 12 -18 0 -14Z" fill="#7cf29c" />
              <circle v-if="i % 2 === 0" cx="7" cy="-8" r="3.4" fill="#ff6b6b" /><circle v-if="i % 2 === 1" cx="-7" cy="-9" r="3" fill="#ffb347" />
            </g>
          </g>
        </g>
        <path d="M-62 0 A62 66 0 0 1 62 0 Z" fill="url(#mnGlass)" />
        <path d="M-40 0 A40 66 0 0 1 40 0 M-18 0 A18 66 0 0 1 18 0 M-56 -26 Q0 -36 56 -26 M-38 -48 Q0 -57 38 -48" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.2" />
        <path d="M-52 -16 A56 60 0 0 1 -20 -60" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="5" stroke-linecap="round" />
        <rect x="-68" y="-8" width="136" height="8" rx="4" fill="#8e93a8" />
        <Transition name="pop">
          <g v-if="has('garden')" class="pop">
            <g v-for="(row, r) in [0, 1]" :key="r" :transform="`translate(${-130 + r * 10} ${-4 - r * 13})`">
              <rect x="0" y="-2" width="62" height="11" rx="5" fill="#7a5a49" /><rect x="0" y="-2" width="62" height="4" rx="2" fill="#a07f68" />
              <g v-for="k in 5" :key="k" :transform="`translate(${k * 11 - 2} 0)`">
                <g class="sprout" :style="{ animationDelay: (k * 0.3 + r * 0.5) + 's' }">
                  <path d="M0 0 V-8" stroke="#2fa05f" stroke-width="2" stroke-linecap="round" />
                  <path d="M0 -4 C-8 -5 -9 -14 -1 -17 C 5 -13 4 -6 0 -4Z" fill="#5be07f" />
                  <path d="M0 -6 C 8 -7 9 -16 1 -19 C -5 -15 -4 -8 0 -6Z" fill="#7cf29c" />
                  <circle v-if="(k + r) % 3 === 0" cx="0" cy="-19" r="2.6" fill="#ffb347" />
                </g>
              </g>
            </g>
            <g v-if="fresh.includes('garden')" class="burst"><ellipse cx="0" cy="-30" rx="70" ry="50" fill="none" stroke="#7cf29c" stroke-width="4" /></g>
          </g>
        </Transition>
      </g>

      <!-- ============ SOLAR ============ -->
      <g v-else-if="id === 'solar'">
        <ellipse cx="0" cy="3" rx="124" ry="9" fill="#6b7190" opacity=".35" />
        <g v-for="(p, i) in panels" :key="i">
          <path :d="`M ${p.cx} ${p.cy} L ${p.cx - 4} 0`" stroke="#aab1c8" stroke-width="4" stroke-linecap="round" />
          <ellipse :cx="p.cx - 4" cy="1" rx="9" ry="3" fill="#8e93a8" />
          <polygon :points="p.poly" fill="url(#mnPanel)" stroke="#eef1fb" stroke-width="3" stroke-linejoin="round" />
          <path :d="p.grid" stroke="#b9d6ff" stroke-opacity=".55" stroke-width="1.2" />
          <polygon :points="p.sheen" fill="#fff" opacity=".22" />
          <g :transform="`translate(${p.cx - 10 + i * 3} ${p.cy - 14})`">
            <path class="glint" :style="{ animationDelay: i * 0.9 + 's' }" d="M0 -9 Q1.2 -1.2 9 0 Q1.2 1.2 0 9 Q-1.2 1.2 -9 0 Q-1.2 -1.2 0 -9Z" fill="#fff" />
          </g>
        </g>
        <path d="M62 -14 Q76 -14 82 -10" stroke="#5b6285" stroke-width="3.4" fill="none" stroke-linecap="round" />
        <Transition name="pop">
          <g v-if="has('battery-bank')" class="pop">
            <g v-for="k in 3" :key="k" :transform="`translate(${70 + (k - 1) * 26} 0)`">
              <rect x="0" y="-34" width="22" height="34" rx="5" fill="url(#mnMetal)" />
              <rect x="6" y="-39" width="10" height="6" rx="2" fill="#7d86a3" />
              <rect x="3" y="-30" width="4" height="24" rx="2" fill="#fff" opacity=".6" />
              <path d="M12 -26 L8 -17 H13 L10 -8" stroke="#ffd23f" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            </g>
            <g v-if="fresh.includes('battery-bank')" class="burst"><circle cx="108" cy="-20" r="20" fill="none" stroke="#ffd23f" stroke-width="4" /></g>
          </g>
        </Transition>
      </g>

      <!-- ============ SHELTER ============ -->
      <g v-else-if="id === 'shelter'">
        <ellipse cx="14" cy="3" rx="100" ry="10" fill="#6b7190" opacity=".35" />
        <Transition name="pop">
          <g v-if="has('storm-shelter')" class="pop">
            <path d="M-106 0 C-104 -44 -62 -72 0 -72 C 62 -72 104 -44 106 0Z" fill="url(#mnMound)" />
            <path d="M-92 -22 Q-74 -52 -40 -62" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="4" stroke-linecap="round" />
            <ellipse cx="-62" cy="-30" rx="9" ry="6" fill="#8b90aa" /><ellipse cx="68" cy="-34" rx="11" ry="7" fill="#9a9fb8" /><ellipse cx="30" cy="-60" rx="8" ry="5" fill="#8b90aa" />
            <g v-if="fresh.includes('storm-shelter')" class="burst"><ellipse cx="0" cy="-34" rx="90" ry="50" fill="none" stroke="#7cf29c" stroke-width="5" /></g>
          </g>
        </Transition>
        <path d="M-80 0 C-76 -36 -46 -58 0 -58 C 46 -58 76 -36 80 0Z" fill="url(#mnMound)" />
        <path d="M-70 -18 Q-56 -42 -26 -52" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="4" stroke-linecap="round" />
        <ellipse cx="-48" cy="-16" rx="8" ry="5" fill="#8b90aa" /><ellipse cx="54" cy="-14" rx="9" ry="5.5" fill="#a9aec6" /><ellipse cx="-22" cy="-44" rx="6" ry="4" fill="#9a9fb8" /><ellipse cx="38" cy="-40" rx="5" ry="3.4" fill="#8b90aa" />
        <circle cx="-64" cy="-6" r="3" fill="#8b90aa" /><circle cx="70" cy="-8" r="3.4" fill="#8b90aa" />
        <!-- door -->
        <path d="M-22 2 V-20 A22 22 0 0 1 22 -20 V2 Z" fill="#ffb74d" />
        <path d="M-17 2 V-20 A17 17 0 0 1 17 -20 V2 Z" fill="url(#mnDoor)" />
        <circle cx="0" cy="-12" r="7" fill="none" stroke="#e6e9f4" stroke-width="2.4" /><path d="M-7 -12 H7 M0 -19 V-5" stroke="#e6e9f4" stroke-width="2" />
        <g transform="translate(0 -46)">
          <circle r="9" fill="#ffd23f" /><circle r="9" fill="none" stroke="#243357" stroke-width="1" opacity=".4" />
          <circle r="4" fill="none" stroke="#243357" stroke-width="8" :stroke-dasharray="`${tre / 6} ${tre / 6}`" transform="rotate(-60)" />
          <circle r="1.7" fill="#243357" />
        </g>
        <!-- shield bubble (storm shelter) -->
        <path class="shield" :class="{ on: has('storm-shelter') }" d="M-112 0 C-112 -62 -62 -96 0 -96 C 62 -96 112 -62 112 0" fill="url(#mnHaloG)" stroke="#7cf29c" stroke-width="3" stroke-opacity=".75" />
      </g>

      <!-- ============ RADIO ============ -->
      <g v-else-if="id === 'radio'">
        <ellipse cx="14" cy="3" rx="78" ry="8" fill="#6b7190" opacity=".35" />
        <!-- hut -->
        <rect x="10" y="-30" width="54" height="30" rx="9" fill="url(#mnMetal)" /><rect x="10" y="-30" width="54" height="8" rx="4" fill="#fff" opacity=".55" />
        <rect x="18" y="-20" width="18" height="12" rx="4" fill="#243357" /><rect x="42" y="-22" width="14" height="22" rx="6" fill="#e6e9f4" /><rect x="10" y="-9" width="54" height="4" fill="#ff6b9d" />
        <!-- mast + dish -->
        <rect x="-24" y="-82" width="7" height="82" rx="3" fill="url(#mnMetal)" />
        <path d="M-32 0 H-9 L-14 -8 H-27 Z" fill="#8e93a8" />
        <g class="dish" style="transform: translate(-20px, -84px) rotate(24deg)">
          <path d="M0 6 L-9 22 H9 Z" fill="#aab1c8" transform="translate(0 -4)" />
          <ellipse cx="0" cy="2" rx="38" ry="13" fill="#8e93a8" />
          <ellipse cx="0" cy="0" rx="38" ry="13" fill="url(#mnDish)" />
          <ellipse cx="0" cy="-1" rx="30" ry="9.5" fill="#cfd5ea" opacity=".75" /><ellipse cx="0" cy="-1" rx="16" ry="5" fill="#aab1c8" opacity=".6" />
          <path d="M-30 -2 L0 -30 M30 -2 L0 -30" stroke="#7d86a3" stroke-width="2.2" fill="none" stroke-linecap="round" />
          <circle cx="0" cy="-31" r="4.4" fill="#ff6b9d" /><circle cx="-1.2" cy="-32.4" r="1.4" fill="#fff" />
        </g>
        <!-- signal rings toward Earth -->
        <g class="sig" style="transform: translate(-20px, -84px) rotate(24deg)">
          <path class="r r1" d="M-18 -54 A22 22 0 0 1 18 -54" fill="none" stroke="#ff6b9d" stroke-width="3.4" stroke-linecap="round" />
          <path class="r r2" d="M-28 -60 A34 34 0 0 1 28 -60" fill="none" stroke="#ff6b9d" stroke-width="3.2" stroke-linecap="round" />
          <path class="r r3" d="M-38 -68 A46 46 0 0 1 38 -68" fill="none" stroke="#ff6b9d" stroke-width="3" stroke-linecap="round" />
        </g>
        <!-- big dish -->
        <Transition name="pop">
          <g v-if="has('big-dish')" class="pop">
            <rect x="-86" y="-104" width="8" height="104" rx="4" fill="url(#mnMetal)" />
            <path d="M-96 0 H-68 L-74 -10 H-90 Z" fill="#8e93a8" />
            <g style="transform: translate(-82px, -108px) rotate(16deg) scale(1.55)">
              <ellipse cx="0" cy="2" rx="38" ry="13" fill="#8e93a8" />
              <ellipse cx="0" cy="0" rx="38" ry="13" fill="url(#mnDish)" />
              <ellipse cx="0" cy="-1" rx="30" ry="9.5" fill="#cfd5ea" opacity=".75" /><ellipse cx="0" cy="-1" rx="16" ry="5" fill="#aab1c8" opacity=".6" />
              <path d="M-30 -2 L0 -30 M30 -2 L0 -30" stroke="#7d86a3" stroke-width="1.8" fill="none" stroke-linecap="round" />
              <circle cx="0" cy="-31" r="3.6" fill="#ffd23f" />
            </g>
            <g v-if="fresh.includes('big-dish')" class="burst"><circle cx="-82" cy="-110" r="30" fill="none" stroke="#ff6b9d" stroke-width="4" /></g>
          </g>
        </Transition>
      </g>

      <!-- ============ LAB ============ -->
      <g v-else-if="id === 'lab'">
        <ellipse cx="14" cy="3" rx="98" ry="10" fill="#6b7190" opacity=".35" />
        <path d="M60 -16 H90 V0 H60" fill="#aab1c8" /><rect x="76" y="-30" width="30" height="30" rx="14" fill="url(#mnDome)" />
        <rect x="-64" y="-50" width="128" height="50" rx="17" fill="url(#mnMetal)" />
        <rect x="-64" y="-50" width="128" height="12" rx="6" fill="#fff" opacity=".5" />
        <rect x="-64" y="-10" width="128" height="7" fill="#4fa8ff" />
        <rect x="-52" y="-42" width="68" height="34" rx="9" fill="#243357" />
        <rect x="33" y="-36" width="24" height="36" rx="10" fill="#e6e9f4" /><circle cx="45" cy="-24" r="5" fill="#243357" /><rect x="33" y="-14" width="24" height="3" fill="#ff9f43" />
        <!-- roof dish + mast -->
        <path d="M-40 -50 L-40 -62" stroke="#7d86a3" stroke-width="3" stroke-linecap="round" /><path d="M-52 -66 Q-40 -54 -28 -66 Z" fill="#cfd5ea" />
        <!-- science lab upgrade -->
        <Transition name="pop">
          <g v-if="has('science-lab')" class="pop">
            <line x1="30" y1="-50" x2="30" y2="-104" stroke="#aab1c8" stroke-width="4" stroke-linecap="round" />
            <path d="M16 -78 H44 M20 -90 H40 M24 -102 H36" stroke="#cfd5ea" stroke-width="3" stroke-linecap="round" />
            <circle class="node" cx="30" cy="-108" r="5" fill="#a78bfa" />
            <ellipse class="holo" cx="30" cy="-72" rx="40" ry="12" fill="none" stroke="#a78bfa" stroke-width="3" />
            <ellipse class="holo h2" cx="30" cy="-72" rx="40" ry="12" fill="none" stroke="#c4b5fd" stroke-width="2" />
            <g v-if="fresh.includes('science-lab')" class="burst"><circle cx="30" cy="-80" r="26" fill="none" stroke="#a78bfa" stroke-width="4" /></g>
          </g>
        </Transition>
      </g>
    </g>

    <!-- ============ LIGHTS (always drawn; repeated above the night wash) ============ -->
    <g class="lights">
      <template v-if="id === 'habitat'">
        <circle class="halo" cx="-13" cy="-43" r="46" fill="url(#mnHaloW)" />
        <rect x="-31" y="-53" width="36" height="20" rx="9" fill="url(#mnWin)" />
        <path d="M-26 -49 Q-18 -52 -10 -49" stroke="#fff" stroke-opacity=".8" stroke-width="2.4" fill="none" stroke-linecap="round" />
        <path d="M-6 -35 q4 -8 8 0 z" fill="#b8541a" opacity=".55" />
        <circle class="blink" cx="26" cy="-93" r="3.5" fill="#ff6b9d" />
        <circle cx="78" cy="-21" r="19" fill="url(#mnHaloW)" opacity=".7" />
      </template>
      <template v-else-if="id === 'greenhouse'">
        <ellipse class="halo" cx="0" cy="-34" rx="52" ry="34" fill="url(#mnHaloK)" />
        <circle v-for="k in 4" :key="k" class="blink" :style="{ animationDelay: k * 0.35 + 's' }" :cx="-45 + k * 18" cy="-60" r="2.4" fill="#ffd1e6" />
      </template>
      <template v-else-if="id === 'solar'">
        <template v-if="has('battery-bank')">
          <circle v-for="k in 3" :key="k" class="led" :style="{ animationDelay: k * 0.4 + 's' }" :cx="70 + (k - 1) * 26 + 11" cy="-4" r="2.8" fill="#7cf29c" />
          <circle v-for="k in 3" :key="'h' + k" :cx="70 + (k - 1) * 26 + 11" cy="-4" r="9" fill="url(#mnHaloG)" opacity=".7" />
        </template>
      </template>
      <template v-else-if="id === 'shelter'">
        <circle class="halo" cx="0" cy="-12" r="34" fill="url(#mnHaloG)" />
        <circle class="blink" cx="-24" cy="-2" r="2.6" fill="#7cf29c" /><circle class="blink" cx="24" cy="-2" r="2.6" fill="#7cf29c" />
      </template>
      <template v-else-if="id === 'radio'">
        <circle class="blink" cx="-20.5" cy="-86" r="4" fill="#ff6b9d" />
        <circle class="halo" cx="-20.5" cy="-86" r="17" fill="url(#mnHaloK)" />
        <circle class="blink" cx="20" cy="-34" r="2.6" fill="#7cf29c" />
        <rect x="18" y="-20" width="18" height="12" rx="4" fill="#4a9c8a" opacity=".6" />
      </template>
      <template v-else-if="id === 'lab'">
        <ellipse class="halo" cx="-18" cy="-26" rx="70" ry="40" fill="url(#mnHaloB)" />
        <rect x="-49" y="-39" width="62" height="28" rx="7" fill="url(#mnScreen)" />
        <path class="wave" d="M-44 -22 L-36 -22 L-31 -32 L-24 -14 L-17 -30 L-10 -20 L-3 -26 L4 -22 L10 -22" fill="none" stroke="#7cf29c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <rect x="-44" y="-17" width="8" height="3" rx="1.5" fill="#4fd1ff" opacity=".8" /><rect x="-32" y="-17" width="14" height="3" rx="1.5" fill="#a78bfa" opacity=".9" /><rect class="cur" x="-14" y="-17" width="3" height="3" fill="#fff" />
        <circle cx="45" cy="-24" r="3" fill="#4fd1ff" opacity=".85" />
        <circle v-if="has('science-lab')" class="halo" cx="30" cy="-90" r="46" fill="url(#mnHaloP)" />
      </template>
    </g>
  </g>
</template>

<style scoped>
.pop-enter-active { animation: pop 0.85s cubic-bezier(0.34, 1.56, 0.64, 1) both; transform-box: fill-box; transform-origin: 50% 100%; }
@keyframes pop { 0% { transform: scale(0); opacity: 0; } 55% { opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
.art-wrap { transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1); transform-origin: 0 0; }
.art-wrap.on { transform: scale(1.045); }
.burst { pointer-events: none; }
.burst > * { transform-box: fill-box; transform-origin: center; animation: burst 1.1s ease-out forwards; }
@keyframes burst { 0% { transform: scale(0.3); opacity: 1; } 100% { transform: scale(2.6); opacity: 0; } }

.lights .halo { opacity: 0.38; transition: opacity 1s; }
.night .halo { opacity: 1; }
.blink { animation: blink 1.5s ease-in-out infinite; }
.led { animation: blink 1.2s ease-in-out infinite; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
.glint { transform-box: fill-box; transform-origin: center; animation: glint 3.4s ease-in-out infinite; }
@keyframes glint { 0%, 60%, 100% { opacity: 0; transform: scale(0.3); } 75% { opacity: 1; transform: scale(1.1); } }

.bub { animation: rise 2.4s ease-in infinite; }
.b2 { animation-delay: -0.8s; } .b3 { animation-delay: -1.6s; }
@keyframes rise { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(-26px); opacity: 0; } }

.aura { opacity: 0; transition: opacity 0.9s; }
.aura.on { opacity: 0.9; animation: breathe 3.6s ease-in-out infinite; }
@keyframes breathe { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
.plants { transform-box: fill-box; transform-origin: 50% 100%; transition: transform 0.9s cubic-bezier(0.34, 1.56, 0.64, 1); }
.plants.big { transform: scale(1.22); }
.plant, .sprout { transform-box: fill-box; transform-origin: 50% 100%; animation: sway 3.4s ease-in-out infinite; }
@keyframes sway { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }

.shield { opacity: 0; transition: opacity 0.9s; pointer-events: none; }
.shield.on { opacity: 1; animation: shieldPulse 3s ease-in-out infinite; }
@keyframes shieldPulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }

.sig .r { opacity: 0; animation: sig 2.1s ease-out infinite; }
.sig .r2 { animation-delay: 0.35s; } .sig .r3 { animation-delay: 0.7s; }
@keyframes sig { 0% { opacity: 0; } 25% { opacity: 0.95; } 100% { opacity: 0; } }

.ring { transform-box: fill-box; transform-origin: center; animation: ring 1.9s ease-out infinite; }
.ring.r2 { animation-delay: 0.95s; }
@keyframes ring { 0% { transform: scale(0.65); opacity: 0.95; } 100% { transform: scale(1.35); opacity: 0; } }
.holo { transform-box: fill-box; transform-origin: center; animation: holo 3s ease-in-out infinite; }
.holo.h2 { animation-delay: -1.5s; }
@keyframes holo { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.9; } 50% { transform: translateY(-8px) scale(1.12); opacity: 0.35; } }
.node { animation: blink 1.2s ease-in-out infinite; }
.wave { stroke-dasharray: 70; animation: wave 2.2s linear infinite; }
@keyframes wave { from { stroke-dashoffset: 70; } to { stroke-dashoffset: -70; } }
.cur { animation: blink 1s steps(1) infinite; }

@media (prefers-reduced-motion: reduce) {
  .blink, .led, .glint, .bub, .aura.on, .plant, .sprout, .shield.on, .sig .r, .ring, .holo, .node, .wave, .cur { animation: none !important; }
  .sig .r1 { opacity: 0.7; }
}
</style>
