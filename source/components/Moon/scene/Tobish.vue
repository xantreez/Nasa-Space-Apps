<script setup lang="ts">
// Tobish, chibi astronaut. Origin (0,0) = between his boots. ~82 units tall.
defineProps<{ moving: boolean; air: boolean; face: 1 | -1; night: boolean }>();
</script>

<template>
  <g class="tb" :class="{ walk: moving && !air, air, idle: !moving }">
    <g class="face" :style="{ transform: `scaleX(${face})` }">
      <!-- far arm -->
      <g class="arm armF"><rect x="-19" y="-38" width="8" height="17" rx="4" fill="#cfd6ea" /><circle cx="-15" cy="-20" r="4.4" fill="#ff9f43" /></g>
      <!-- legs -->
      <g class="leg legF"><rect x="-9" y="-17" width="8" height="15" rx="4" fill="#cfd6ea" /><ellipse cx="-4" cy="-2" rx="6.4" ry="3.8" fill="#ff9f43" /></g>
      <g class="leg legN"><rect x="1" y="-17" width="8.5" height="15" rx="4" fill="#f4f6fc" /><ellipse cx="5.5" cy="-2" rx="6.6" ry="3.9" fill="#ff9f43" /><ellipse cx="7" cy="-3.6" rx="3" ry="1.4" fill="#fff" opacity=".5" /></g>

      <g class="upper">
        <!-- backpack + antenna -->
        <g class="pack">
          <rect x="-28" y="-40" width="6" height="19" rx="3" fill="#ff9f43" />
          <rect x="-26" y="-43" width="15" height="27" rx="7" fill="#e6e9f4" />
          <rect x="-26" y="-43" width="5" height="27" rx="2.5" fill="#fff" opacity=".6" />
          <circle cx="-17" cy="-30" r="2.2" fill="#4fd1ff" />
          <line x1="-21" y1="-43" x2="-25" y2="-62" stroke="#aab1c8" stroke-width="1.8" stroke-linecap="round" />
          <circle class="beacon" cx="-25" cy="-63" r="3" fill="#ff6b9d" />
        </g>
        <!-- torso -->
        <g class="torso">
          <rect x="-15" y="-41" width="30" height="29" rx="13" fill="url(#mnSuit)" />
          <rect x="-15" y="-20" width="30" height="5" fill="#ff9f43" />
          <rect x="-3" y="-21" width="6" height="7" rx="1.5" fill="#ffd23f" />
          <rect x="-8.5" y="-35" width="17" height="11" rx="3.5" fill="#34476f" />
          <circle cx="-4" cy="-31" r="2" fill="#ff9f43" /><circle cx="0.5" cy="-31" r="2" fill="#4fd1ff" /><circle cx="5" cy="-31" r="2" fill="#7cf29c" />
          <rect x="-4" y="-27" width="8" height="2" rx="1" fill="#7f90bd" />
          <path d="M-11 -34 Q-14 -26 -12 -18" stroke="#fff" stroke-opacity=".7" stroke-width="2.4" fill="none" stroke-linecap="round" />
        </g>
        <!-- near arm -->
        <g class="arm armN"><rect x="11" y="-39" width="8.5" height="18" rx="4.2" fill="#f4f6fc" /><circle cx="15.2" cy="-20" r="4.6" fill="#ff9f43" /><rect x="11" y="-39" width="8.5" height="5" rx="2.5" fill="#4fa8ff" /></g>
        <!-- helmet -->
        <g class="head">
          <rect x="-11" y="-44" width="22" height="7" rx="3.5" fill="#4fa8ff" />
          <circle cx="0" cy="-60" r="24" fill="url(#mnHelmet)" />
          <circle cx="-23" cy="-58" r="5.2" fill="#4fa8ff" /><circle cx="23" cy="-58" r="5.2" fill="#ff9f43" />
          <ellipse cx="5" cy="-59" rx="18.5" ry="15.5" fill="#dfe6f8" />
          <ellipse cx="5" cy="-59" rx="17" ry="14" fill="url(#mnVisor)" />
          <g class="eyes">
            <ellipse cx="-0.5" cy="-58" rx="2.7" ry="3.5" fill="#fff" /><ellipse cx="11" cy="-58" rx="2.7" ry="3.5" fill="#fff" />
            <circle cx="0.4" cy="-59" r="1" fill="#0b1b3a" /><circle cx="11.9" cy="-59" r="1" fill="#0b1b3a" />
          </g>
          <circle cx="-5" cy="-52" r="2.6" fill="#ff6b9d" opacity=".45" /><circle cx="16" cy="-52" r="2.6" fill="#ff6b9d" opacity=".45" />
          <path d="M3.5 -52 Q5.5 -49 8.5 -52" stroke="#fff" stroke-width="1.7" fill="none" stroke-linecap="round" />
          <path d="M-8 -68 Q3 -75 16 -68" stroke="#fff" stroke-opacity=".75" stroke-width="3.2" fill="none" stroke-linecap="round" />
          <circle cx="17" cy="-64" r="1.9" fill="#fff" opacity=".85" />
          <circle cx="14" cy="-51" r="4" fill="#4fa8ff" opacity=".5" />
          <path class="glint" d="M-7 -55 Q-6.3 -52.5 -4 -52 Q-6.3 -51.5 -7 -49 Q-7.7 -51.5 -10 -52 Q-7.7 -52.5 -7 -55Z" fill="#fff" />
          <path d="M-14 -78 Q-6 -84 4 -82" stroke="#fff" stroke-opacity=".65" stroke-width="3" fill="none" stroke-linecap="round" />
          <circle v-if="night" cx="0" cy="-83" r="3.5" fill="#fff6c8" />
        </g>
      </g>
    </g>
  </g>
</template>

<style scoped>
.face { transition: transform 0.18s ease-out; transform-origin: 0 0; }
.upper { animation: bob 2.6s ease-in-out infinite; }
.torso { transform-box: fill-box; transform-origin: 50% 100%; animation: breathe 2.6s ease-in-out infinite; }
.head { transform-box: fill-box; transform-origin: 50% 100%; animation: tilt 5s ease-in-out infinite; }
.arm { transform-box: fill-box; transform-origin: 50% 8%; transition: transform 0.18s ease-out; }
.leg { transform-box: fill-box; transform-origin: 50% 5%; transition: transform 0.18s ease-out; }
.beacon { animation: blink 1.6s ease-in-out infinite; }
.eyes { transform-box: fill-box; transform-origin: center; animation: eyes 4.6s infinite; }
.glint { transform-box: fill-box; transform-origin: center; animation: glint 4s ease-in-out infinite; }

.idle .armN { animation: sway 3.2s ease-in-out infinite; }
.idle .armF { animation: sway 3.2s ease-in-out infinite reverse; }

.walk .upper { animation: step 0.3s ease-in-out infinite; }
.walk .legN { animation: swing 0.6s ease-in-out infinite; }
.walk .legF { animation: swing 0.6s ease-in-out infinite reverse; }
.walk .armN { animation: swing 0.6s ease-in-out infinite reverse; }
.walk .armF { animation: swing 0.6s ease-in-out infinite; }
.walk .head { animation: none; }

.air .upper { animation: none; transform: translateY(-1px); }
.air .legN { transform: rotate(-26deg); }
.air .legF { transform: rotate(24deg); }
.air .armN { transform: rotate(-150deg); }
.air .armF { transform: rotate(-120deg); }

@keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-1.6px); } }
@keyframes breathe { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(1.025, 1.04); } }
@keyframes tilt { 0%, 100% { transform: rotate(-1.6deg); } 50% { transform: rotate(1.6deg); } }
@keyframes sway { 0%, 100% { transform: rotate(3deg); } 50% { transform: rotate(-4deg); } }
@keyframes step { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes swing { 0%, 100% { transform: rotate(-30deg); } 50% { transform: rotate(30deg); } }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
@keyframes eyes { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.08); } }
@keyframes glint { 0%, 70%, 100% { opacity: 0; transform: scale(0.4); } 80% { opacity: 1; transform: scale(1.2); } 90% { opacity: 0.2; transform: scale(0.8); } }

@media (prefers-reduced-motion: reduce) {
  .upper, .torso, .head, .beacon, .eyes, .glint, .idle .armN, .idle .armF, .walk .legN, .walk .legF, .walk .armN, .walk .armF { animation: none !important; }
}
</style>
