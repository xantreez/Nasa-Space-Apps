<script setup lang="ts">
// Tiny signs of life: a satellite crossing the sky and a rover patrolling the regolith.
const props = defineProps<{ W: number; H: number; H0: number; tall: boolean; night: boolean }>();
</script>

<template>
  <g class="amb" aria-hidden="true">
    <!-- satellite -->
    <g :transform="`translate(0 ${H0 * (tall ? 0.34 : 0.3)})`">
      <g class="sat" :style="{ '--w': W + 160 + 'px' }">
        <g transform="rotate(-14) scale(.9)">
          <rect x="-4" y="-3" width="8" height="6" rx="1.5" fill="#dfe6f7" />
          <rect x="-22" y="-2" width="15" height="4" fill="#4a8fe8" /><rect x="7" y="-2" width="15" height="4" fill="#4a8fe8" />
          <path d="M-14.5 -2V2M-22 0H-7M14.5 -2V2M7 0H22" stroke="#9cc4ff" stroke-width=".7" />
          <circle class="blink" r="1.6" cx="0" cy="-5" fill="#ff5a5f" />
        </g>
      </g>
    </g>
    <!-- rover -->
    <g :transform="`translate(${tall ? 140 : 520} ${tall ? 648 : 664})`">
      <g class="rov" :style="{ '--d': (tall ? 330 : 560) + 'px' }">
        <g :transform="`scale(${tall ? 0.62 : 0.85})`">
          <ellipse cx="0" cy="9" rx="26" ry="4" fill="#4c5282" opacity=".3" />
          <g class="rbody">
            <rect x="-22" y="-14" width="44" height="14" rx="5" fill="#f3f5fc" />
            <rect x="-22" y="-5" width="44" height="3" fill="#ff9f43" />
            <rect x="2" y="-21" width="15" height="9" rx="3" fill="#2b4a7a" /><rect x="4" y="-19" width="8" height="4" rx="2" fill="#7fd6ff" opacity=".8" />
            <path d="M-12 -14 L-12 -26 M-18 -26 H-6" stroke="#aab1c8" stroke-width="2" stroke-linecap="round" />
            <circle class="blink" cx="-12" cy="-27" r="1.8" fill="#4fd1ff" />
          </g>
          <g fill="#3b4268"><circle cx="-14" cy="3" r="6" /><circle cx="0" cy="4" r="5" /><circle cx="14" cy="3" r="6" /></g>
          <g fill="#aab1c8"><circle cx="-14" cy="3" r="2.4" /><circle cx="0" cy="4" r="2" /><circle cx="14" cy="3" r="2.4" /></g>
        </g>
      </g>
    </g>
  </g>
</template>

<style scoped>
.sat { animation: sat 70s linear infinite; animation-delay: -18s; }
@keyframes sat { from { transform: translate(-80px, 30px); } 50% { transform: translate(calc(var(--w) * .5), -6px); } to { transform: translate(var(--w), 36px); } }
.blink { animation: blink 1.4s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0.1; } }
.rov { animation: rov 46s linear infinite; }
.rbody { animation: bob .5s ease-in-out infinite alternate; }
@keyframes bob { to { transform: translateY(-1.2px); } }
@keyframes rov {
  0% { transform: translateX(0) scaleX(1); }
  45% { transform: translateX(var(--d)) scaleX(1); }
  50% { transform: translateX(var(--d)) scaleX(-1); }
  95% { transform: translateX(0) scaleX(-1); }
  100% { transform: translateX(0) scaleX(1); }
}
@media (prefers-reduced-motion: reduce) { .sat, .rov, .rbody, .blink { animation: none; } }
</style>
