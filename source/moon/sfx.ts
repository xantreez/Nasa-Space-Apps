// Sound effects + music for /game. Real sounds are ElevenLabs mp3s (public/moon/sfx, public/moon/music) decoded via
// audio-bus; the tiny WebAudio synth below is the fallback so nothing is ever silent while files load.
import { audioCtx, channel, loadBuffer, setMuted as busSetMuted, isMuted as busIsMuted, unlockAudio } from "./audio-bus";

let ctx: AudioContext | null = null;
let muted = false;
const MASTER = 0.12;

function ac(): AudioContext | null {
  if (typeof window === "undefined" || muted || busIsMuted()) return null;
  try {
    ctx = audioCtx();
    return ctx;
  } catch {
    return null;
  }
}

function dest(c: AudioContext): AudioNode {
  return channel("sfx") || c.destination;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", vol = 1, slideTo?: number) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(MASTER * vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(dest(c));
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

function noise(start: number, dur: number, vol = 0.5, freq = 3000) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + start;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource();
  s.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = MASTER * vol;
  s.connect(f).connect(g).connect(dest(c));
  s.start(t0);
}

const synthFx: Record<string, () => void> = {
  click() {
    tone(620, 0, 0.07, "triangle", 0.8, 880);
  },
  pop() {
    tone(380, 0, 0.12, "sine", 0.9, 760);
  },
  correct() {
    tone(523, 0, 0.14, "triangle");
    tone(659, 0.09, 0.14, "triangle");
    tone(784, 0.18, 0.26, "triangle");
  },
  wrong() {
    tone(260, 0, 0.16, "sine", 0.9, 200);
    tone(200, 0.13, 0.22, "sine", 0.8, 150);
  },
  alarm() {
    for (let i = 0; i < 3; i++) {
      tone(740, i * 0.2, 0.12, "square", 0.35);
      tone(560, i * 0.2 + 0.1, 0.1, "square", 0.35);
    }
  },
  radio() {
    noise(0, 0.18, 0.6, 2500);
    tone(1100, 0.16, 0.05, "sine", 0.5);
  },
  win() {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.2, "triangle"));
  },
  fail() {
    tone(392, 0, 0.25, "sine", 0.9, 330);
    tone(330, 0.22, 0.25, "sine", 0.9, 262);
    tone(262, 0.44, 0.4, "sine", 0.8, 220);
  },
  // stubs — the sfx agent replaces these with ElevenLabs sounds (names are the contract)
  walk() {}, hop() { tone(500, 0, 0.08, "sine", 0.4, 700); }, build() { tone(330, 0, 0.12, "square", 0.4); tone(494, 0.1, 0.18, "triangle", 0.5); },
  whoosh() { noise(0, 0.25, 0.4, 1800); }, typewriter() {}, cardFlip() { noise(0, 0.06, 0.3, 4000); },
  coin() { tone(988, 0, 0.07, "square", 0.35); tone(1319, 0.06, 0.14, "square", 0.35); },
  explosion() { noise(0, 0.35, 0.9, 900); }, laser() { tone(1400, 0, 0.12, "sawtooth", 0.3, 300); },
  jump() { tone(300, 0, 0.18, "sine", 0.5, 700); }, land() { noise(0, 0.08, 0.4, 600); },
  blockDrop() { tone(180, 0, 0.08, "square", 0.4); }, blockRotate() { tone(700, 0, 0.04, "square", 0.25); },
  lineClear() { [660, 880, 1100].forEach((f, i) => tone(f, i * 0.06, 0.1, "triangle", 0.5)); },
  countdown() { tone(660, 0, 0.12, "sine", 0.6); }, go() { tone(990, 0, 0.25, "sine", 0.7); },
  gameOver() { tone(300, 0, 0.4, "sawtooth", 0.4, 120); }, powerUp() { tone(400, 0, 0.3, "triangle", 0.5, 1200); },
  beep() { tone(1000, 0, 0.08, "sine", 0.4); }, static() { noise(0, 0.2, 0.3, 3000); },
};


/** variants available per sound: name.mp3, name2.mp3, ... */
const VARIANTS: Record<string, number> = {
  click: 3, pop: 2, walk: 2, hop: 3, coin: 3, explosion: 3, laser: 3,
  correct: 1, wrong: 1, alarm: 1, radio: 1, win: 1, fail: 1, build: 1, whoosh: 1, typewriter: 1, cardFlip: 1, jump: 1,
  land: 1, blockDrop: 1, blockRotate: 1, lineClear: 1, countdown: 1, go: 1, gameOver: 1, powerUp: 1, beep: 1,
  static: 1, chime: 1, rewardTick: 1, storm: 1, doorOpen: 1,
};
const BASE = "/moon/sfx/";
const sfxBuffers = new Map<string, AudioBuffer[]>();
let sfxRequested = false;

function sfxUrls(name: string): string[] {
  const n = VARIANTS[name] || 1;
  return Array.from({ length: n }, (_, i) => `${BASE}${name}${i ? i + 1 : ""}.mp3`);
}

async function loadSfx(name: string) {
  try {
    const bufs = (await Promise.all(sfxUrls(name).map((u) => loadBuffer(u)))).filter((b): b is AudioBuffer => !!b);
    if (bufs.length) sfxBuffers.set(name, bufs);
  } catch {}
}

function playSfx(name: string) {
  try {
    if (typeof window === "undefined" || muted || busIsMuted()) return;
    const c = audioCtx();
    const out = channel("sfx");
    if (!sfxRequested) preloadSfx(); // lazy: first play kicks off loading
    const bufs = sfxBuffers.get(name);
    if (c && out && bufs && bufs.length) {
      const src = c.createBufferSource();
      src.buffer = bufs[Math.floor(Math.random() * bufs.length)];
      src.playbackRate.value = 1 + (Math.random() * 2 - 1) * 0.04;
      src.connect(out);
      src.start();
      return;
    }
    synthFx[name]?.();
  } catch {}
}

function preloadSfx() {
  if (sfxRequested) return Promise.resolve();
  sfxRequested = true;
  return Promise.all(Object.keys(VARIANTS).map(loadSfx)).then(() => {});
}

const names = [...Object.keys(VARIANTS)];
const api: Record<string, any> = {
  setMuted(b: boolean) {
    muted = b;
    busSetMuted(b);
  },
  isMuted() {
    return muted || busIsMuted();
  },
  /** call from any user gesture to unlock audio */
  unlock() {
    try {
      unlockAudio();
    } catch {}
  },
};
for (const n of names) api[n] = () => playSfx(n);

export const sfx = api as {
  setMuted(b: boolean): void;
  isMuted(): boolean;
  unlock(): void;
} & Record<
  | "click" | "pop" | "correct" | "wrong" | "alarm" | "radio" | "win" | "fail" | "walk" | "hop" | "build" | "whoosh"
  | "typewriter" | "cardFlip" | "coin" | "explosion" | "laser" | "jump" | "land" | "blockDrop" | "blockRotate"
  | "lineClear" | "countdown" | "go" | "gameOver" | "powerUp" | "beep" | "static" | "chime" | "rewardTick" | "storm"
  | "doorOpen",
  () => void
>;

// ---------------- music ----------------
export type MusicName = "title" | "base" | "storm" | "night" | "minigame" | "victory";
const MUSIC_NAMES: MusicName[] = ["title", "base", "storm", "night", "minigame", "victory"];
const FADE = 1.2;
let wanted: MusicName | null = null;
let cur: { name: MusicName; src: AudioBufferSourceNode; gain: GainNode } | null = null;

function fadeOutTrack(t: NonNullable<typeof cur>, secs: number) {
  try {
    const c = audioCtx();
    if (!c) return;
    t.gain.gain.cancelScheduledValues(c.currentTime);
    t.gain.gain.setValueAtTime(t.gain.gain.value, c.currentTime);
    t.gain.gain.linearRampToValueAtTime(0, c.currentTime + secs);
    t.src.stop(c.currentTime + secs + 0.05);
    t.src.onended = () => {
      try {
        t.src.disconnect();
        t.gain.disconnect();
      } catch {}
    };
  } catch {}
}

async function startTrack(name: MusicName) {
  const buf = await loadBuffer(`/moon/music/${name}.mp3`);
  if (wanted !== name || !buf || cur?.name === name) return;
  const c = audioCtx();
  const out = channel("music");
  if (!c || !out) return;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, c.currentTime);
  gain.gain.linearRampToValueAtTime(1, c.currentTime + FADE);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(gain).connect(out);
  src.start();
  if (cur) fadeOutTrack(cur, FADE);
  cur = { name, src, gain };
}

export const music = {
  play(name: MusicName) {
    try {
      if (typeof window === "undefined" || wanted === name) return;
      wanted = name;
      startTrack(name).catch(() => {});
    } catch {}
  },
  stop() {
    try {
      wanted = null;
      if (cur) fadeOutTrack(cur, FADE);
      cur = null;
    } catch {}
  },
};

/** Fetch+decode all sfx first, then music in the background one by one (low priority). Safe to call repeatedly. */
let preloading = false;
export function preloadAudio() {
  if (typeof window === "undefined" || preloading) return;
  preloading = true;
  (async () => {
    try {
      await preloadSfx();
      for (const n of MUSIC_NAMES) await loadBuffer(`/moon/music/${n}.mp3`);
    } catch {}
  })();
}
