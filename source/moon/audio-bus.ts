// Shared audio bus for /game. Three channels (music, sfx, voice) -> master.
// sfx.ts (ElevenLabs sounds + music) and voice.ts (Tobish voice) both route through here.
// When voice talks, music is ducked automatically (voice.ts calls duck(true/false)).

let ctx: AudioContext | null = null;
let master: GainNode, music: GainNode, sfx: GainNode, voice: GainNode;
let muted = false;
const listeners = new Set<(m: boolean) => void>();

export const LEVELS = { master: 0.9, music: 0.32, musicDucked: 0.1, sfx: 0.7, voice: 1.0 };

export function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as any).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : LEVELS.master;
    master.connect(ctx.destination);
    music = ctx.createGain();
    music.gain.value = LEVELS.music;
    music.connect(master);
    sfx = ctx.createGain();
    sfx.gain.value = LEVELS.sfx;
    sfx.connect(master);
    voice = ctx.createGain();
    voice.gain.value = LEVELS.voice;
    voice.connect(master);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

// --- iOS Safari unlock -------------------------------------------------------------------------
// iOS only starts audio from touchend/click/keydown (pointerdown is NOT enough), mutes Web Audio when the
// ringer switch is on silent unless the audio session is "playback", and suspends the context
// ("interrupted") after the app goes to background. We handle all three and re-unlock on every gesture.
let silentEl: HTMLAudioElement | null = null;
const SILENT_WAV =
  "data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

export function unlockAudio() {
  if (typeof window === "undefined") return;
  try {
    const nav = navigator as any;
    if (nav.audioSession && nav.audioSession.type !== "playback") nav.audioSession.type = "playback";
  } catch {}
  const c = audioCtx();
  if (!c) return;
  if (c.state !== "running") c.resume().catch(() => {});
  try {
    // a 1-sample silent buffer played inside the gesture is what actually unlocks WebKit
    const b = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = b;
    src.connect(c.destination);
    src.start(0);
  } catch {}
  try {
    // older iOS (< 17): a playing <audio> element switches the session so the silent switch doesn't mute us
    if (!silentEl) {
      silentEl = new Audio(SILENT_WAV);
      silentEl.loop = true;
      silentEl.setAttribute("playsinline", "");
      silentEl.volume = 0.01;
    }
    if (silentEl.paused) silentEl.play().catch(() => {});
  } catch {}
}

if (typeof window !== "undefined") {
  const onGesture = () => {
    if (!ctx || ctx.state !== "running" || (silentEl && silentEl.paused)) unlockAudio();
  };
  for (const ev of ["touchend", "click", "keydown", "pointerup"]) window.addEventListener(ev, onGesture, { capture: true, passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && ctx && ctx.state !== "running") ctx.resume().catch(() => {});
  });
}

export function channel(name: "music" | "sfx" | "voice"): GainNode | null {
  if (!audioCtx()) return null;
  return name === "music" ? music : name === "sfx" ? sfx : voice;
}

export function duck(on: boolean) {
  const c = audioCtx();
  if (!c) return;
  music.gain.cancelScheduledValues(c.currentTime);
  music.gain.setTargetAtTime(on ? LEVELS.musicDucked : LEVELS.music, c.currentTime, 0.25);
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem("moon-muted", m ? "1" : "0");
  } catch {}
  if (ctx) master.gain.setTargetAtTime(m ? 0 : LEVELS.master, ctx.currentTime, 0.05);
  listeners.forEach((f) => f(m));
}
export function isMuted() {
  return muted;
}
export function onMuted(f: (m: boolean) => void) {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** Decode-and-cache helper for small mp3 files (sfx, voice lines). */
const buffers = new Map<string, Promise<AudioBuffer | null>>();
export function loadBuffer(url: string): Promise<AudioBuffer | null> {
  let p = buffers.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
      .then((b) => audioCtx()!.decodeAudioData(b))
      .catch(() => null);
    buffers.set(url, p);
  }
  return p;
}

if (typeof window !== "undefined") {
  try {
    muted = localStorage.getItem("moon-muted") === "1";
  } catch {}
}
