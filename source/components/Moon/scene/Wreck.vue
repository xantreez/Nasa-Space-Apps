<script setup lang="ts">
// The crashed rocket, lying on its side. A landmark now: no smoke, just a blinking beacon.
</script>

<template>
  <g class="wreck">
    <ellipse cx="6" cy="6" rx="118" ry="14" fill="#6b7190" opacity=".35" />
    <ellipse cx="-4" cy="3" rx="104" ry="11" fill="#9aa0ba" opacity=".55" />
    <!-- debris -->
    <path d="M-120 2 l10 -9 l11 6 l-6 8 z" fill="#e6e9f4" /><path d="M126 0 l9 -6 l7 5 l-8 5 z" fill="#ff5a5f" />
    <circle cx="-136" cy="3" r="3" fill="#aab1c8" />
    <g transform="rotate(-5 0 -26)">
      <!-- back fins -->
      <path d="M-86 -22 L-112 -2 L-92 2 L-70 -10 Z" fill="#d93b44" />
      <path d="M-84 -34 L-108 -58 L-96 -62 L-72 -42 Z" fill="#ff5a5f" transform="rotate(-18 -84 -34)" />
      <!-- nozzle -->
      <path d="M-92 -40 L-106 -48 L-106 -8 L-92 -16 Z" fill="#7d86a3" />
      <ellipse cx="-106" cy="-28" rx="5" ry="20" fill="#3b4268" />
      <!-- body -->
      <rect x="-96" y="-52" width="170" height="52" rx="26" fill="url(#mnRocket)" />
      <rect x="-96" y="-52" width="170" height="14" rx="7" fill="#fff" opacity=".45" />
      <!-- nose cone -->
      <path d="M58 -52 Q120 -44 132 -26 Q120 -8 58 0 Z" fill="url(#mnNose)" />
      <!-- stripes -->
      <rect x="-48" y="-52" width="16" height="52" fill="#ff9f43" />
      <rect x="-26" y="-52" width="6" height="52" fill="#4fa8ff" />
      <!-- porthole -->
      <circle cx="18" cy="-28" r="13" fill="#e6e9f4" /><circle cx="18" cy="-28" r="9.5" fill="#1b3a6b" />
      <path d="M12 -33 Q17 -37 22 -34" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".8" />
      <!-- scorch + dent + rip -->
      <ellipse cx="-70" cy="-22" rx="26" ry="18" fill="#2b2f45" opacity=".55" />
      <path d="M-30 0 L-22 -14 L-12 -4 L-4 -16 L6 0 Z" fill="#2b2f45" opacity=".5" />
      <path d="M40 -52 l8 12 l-6 6 l8 10" stroke="#3b4268" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".6" />
      <path d="M-90 -44 L-52 -48" stroke="#fff" stroke-opacity=".6" stroke-width="3" stroke-linecap="round" />
    </g>
    <!-- beacon so you can spot it from afar -->
    <circle class="beacon-halo" cx="-8" cy="-60" r="16" fill="url(#mnHaloR)" />
    <rect x="-9.5" y="-60" width="3" height="10" fill="#7d86a3" /><circle class="beacon" cx="-8" cy="-62" r="4" fill="#ff5a5f" />
    <!-- half-buried rocks -->
    <path d="M52 4 Q56 -12 74 -10 Q90 -8 94 4 Z" fill="url(#mnRock)" />
    <path d="M-20 5 Q-16 -6 -4 -5 Q6 -4 8 5 Z" fill="url(#mnRock)" />
  </g>
</template>

<style scoped>
.beacon, .beacon-halo { animation: blink 1.4s ease-in-out infinite; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
@media (prefers-reduced-motion: reduce) { .beacon, .beacon-halo { animation: none !important; } }
</style>
