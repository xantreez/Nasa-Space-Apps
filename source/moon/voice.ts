// Tobish's voice: plays pre-rendered OmniVoice clips (public/moon/voice/<sha1(text)[:12]>.mp3).
// Hash = first 12 hex chars of SHA-1 over the UTF-8 text after norm() — identical to scripts/moon-voice/voice.py.
import { audioCtx, channel, duck, loadBuffer, isMuted } from "./audio-bus";

export function norm(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Small synchronous SHA-1 (hex) over UTF-8 bytes. */
export function sha1(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n));
  const len = bytes.length;
  const padded = new Uint8Array((((len + 8) >> 6) + 1) << 6);
  padded.set(bytes);
  padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor((len * 8) / 0x100000000));
  dv.setUint32(padded.length - 4, (len * 8) >>> 0);
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Array<number>(80);
  for (let o = 0; o < padded.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      const [f, k] =
        i < 20 ? [(b & c) | (~b & d), 0x5a827999] :
        i < 40 ? [b ^ c ^ d, 0x6ed9eba1] :
        i < 60 ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc] : [b ^ c ^ d, 0xca62c1d6];
      const t = (rotl(a, 5) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = rotl(b, 30) >>> 0; b = a; a = t;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map((x) => x.toString(16).padStart(8, "0")).join("");
}

export const voiceHash = (text: string) => sha1(norm(text)).slice(0, 12);

type Manifest = Record<string, { file: string; text: string; dur: number }>;
let manifestP: Promise<Manifest> | null = null;
const manifest = () =>
  (manifestP ??= fetch("/moon/voice/manifest.json")
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({})));

let current: AudioBufferSourceNode | null = null;
let token = 0;
let isSpeaking = false;

function finish(my: number) {
  if (my !== token) return; // a newer line took over (and owns ducking)
  isSpeaking = false;
  current = null;
  duck(false);
}

export const voice = {
  /** Speak the pre-rendered clip for exactly this text. Resolves when finished; silently resolves if no clip / muted / stopped. */
  async say(text: string): Promise<void> {
    voice.stop();
    const my = ++token;
    try {
      if (isMuted()) return;
      const m = await manifest();
      const entry = m[voiceHash(text)];
      if (!entry || my !== token) return;
      const buf = await loadBuffer("/moon/voice/" + entry.file);
      const ctx = audioCtx();
      const out = channel("voice");
      if (!buf || !ctx || !out || my !== token) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(out);
      current = src;
      isSpeaking = true;
      duck(true);
      await new Promise<void>((res) => {
        src.onended = () => res();
        src.start();
      });
      finish(my);
    } catch {
      finish(my);
    }
  },
  /** Cut the current line (e.g. when the player closes the message). */
  stop() {
    token++;
    if (current) {
      try { current.onended = null; current.stop(); } catch {}
      current = null;
    }
    if (isSpeaking) { isSpeaking = false; duck(false); }
  },
  get speaking() {
    return isSpeaking;
  },
  /** Warm the cache for upcoming lines (decode in background). */
  async preload(texts: string[]): Promise<void> {
    try {
      const m = await manifest();
      for (const t of texts) {
        const e = m[voiceHash(t)];
        if (e) await loadBuffer("/moon/voice/" + e.file);
      }
    } catch {}
  },
};
