"""SFX + music for the /game Moon game via ElevenLabs. Key from ../rashid/.env (never printed).
Idempotent: raw API output is cached in ./raw, final files in public/moon/{sfx,music} are skipped if present.
Usage: python3 gen.py [sfx|music|name ...]   (add --force to regenerate)"""
import os, sys, time, subprocess, json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import requests
from dotenv import load_dotenv

load_dotenv(Path("/Users/mac/Desktop/magic/rashid/.env"))
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
RAW = HERE / "raw"; RAW.mkdir(exist_ok=True)
SFX_DIR = ROOT / "public/moon/sfx"; MUS_DIR = ROOT / "public/moon/music"
SFX_DIR.mkdir(parents=True, exist_ok=True); MUS_DIR.mkdir(parents=True, exist_ok=True)
H = {"xi-api-key": os.environ["ELEVENLABS_API_KEY"]}
FORCE = "--force" in sys.argv

S = "Soft, gentle, friendly, not harsh, no high-pitched squeal, clean, no music, no voice. "
# name: (prompt, api_duration_s, variants)
SFX = {
 "click": ("Soft rounded UI button tap, a tiny warm wooden-plastic tick", 0.5, 3),
 "pop": ("Cute bubble pop, short soft water-drop pop", 0.5, 2),
 "correct": ("Happy success chime, three ascending soft bell notes, glockenspiel, bright but gentle", 1.2, 1),
 "wrong": ("Gentle soft 'uh-oh' two descending notes on a soft marimba, friendly, not scary", 1.0, 1),
 "alarm": ("Space station warning beeps, three soft rounded electronic pulses, calm not scary", 1.8, 1),
 "radio": ("Walkie-talkie radio squelch open: short soft static burst followed by a small blip", 0.8, 1),
 "win": ("Triumphant short victory fanfare, warm brass and bells, cheerful and kid-friendly", 2.0, 1),
 "fail": ("Soft sad trombone-like descending gentle notes, comedic and harmless, kids game", 1.6, 1),
 "walk": ("Single soft footstep of an astronaut on moon dust, muffled crunchy, low gravity", 0.5, 2),
 "hop": ("Light bouncy low-gravity hop, soft springy boing with a tiny dust puff", 0.8, 3),
 "build": ("Cheerful construction clunk: soft metal click-lock snapping into place with a small rising sparkle", 1.2, 1),
 "whoosh": ("Smooth soft air whoosh sweeping by, gentle, medium length", 1.0, 1),
 "typewriter": ("A few soft retro computer terminal key tick-tick-tick sounds, quick burst", 0.8, 1),
 "cardFlip": ("Playing card flip, soft paper flick snap", 0.5, 1),
 "coin": ("Cute coin pickup, bright but soft two-note ding, video game", 0.6, 3),
 "explosion": ("Cartoon asteroid explosion, soft rounded boom with a gentle crumble and sparkle, not scary, family friendly", 1.5, 3),
 "laser": ("Cute sci-fi laser zap, soft rounded pew, short, not shrill", 0.6, 3),
 "jump": ("Cartoon jump boing, rising soft spring", 0.6, 1),
 "land": ("Soft thud landing on moon dust, muffled low puff", 0.5, 1),
 "blockDrop": ("Wooden block set down with a soft satisfying thunk", 0.5, 1),
 "blockRotate": ("Quick soft clicky tick as a puzzle piece rotates, light", 0.5, 1),
 "lineClear": ("Puzzle line clear: quick rising sparkly arpeggio with a soft whoosh, glittery but gentle", 1.2, 1),
 "countdown": ("Single soft electronic beep, round sine tone, mid pitch, arcade countdown tick", 0.5, 1),
 "go": ("Arcade GO start beep, higher bright rounded tone with a short shimmer", 0.8, 1),
 "gameOver": ("Game over jingle: gentle descending four-note phrase, soft synth, sad but kind", 2.0, 1),
 "powerUp": ("Power-up collected: rising magical sparkly sweep, soft synth, cheerful", 1.2, 1),
 "beep": ("Short friendly electronic beep, console blip", 0.5, 1),
 "static": ("Soft radio static crackle burst, low volume hiss", 0.8, 1),
 "chime": ("Calm notification chime, single soft bell with a gentle tail", 1.5, 1),
 "rewardTick": ("Tiny soft tick-up counter sound, light marimba blip", 0.5, 1),
 "storm": ("Distant soft rumbling solar storm swell, gentle low whoosh with crackling static, not scary", 2.0, 1),
 "doorOpen": ("Spaceship sliding door opening: soft pneumatic hiss and smooth motor glide", 1.5, 1),
}
MUSIC = {
 "title": "Wonder-filled hopeful cinematic theme about the first view of the Moon: warm orchestral strings, soft synth pads, gentle piano arpeggios, twinkling celesta, slow build to an uplifting melody. Kid-friendly, magical, 90 BPM.",
 "base": "Calm curious exploration music for a moon base: light playful synth pluck melody, soft mallets, warm pad, gentle pulse, relaxed 100 BPM, bright and friendly, looping, no big climaxes.",
 "storm": "Tense but not scary pulsing music for a solar storm warning in a kids game: steady soft synth pulse, low strings ostinato, light percussion, rising hopeful undertones, 120 BPM, urgent but friendly.",
 "night": "Soft mysterious cozy lunar night music: slow dreamy pads, soft music-box and harp notes, warm low strings, calm, starry, lullaby-like, 70 BPM, very gentle.",
 "minigame": "Upbeat energetic arcade chiptune meets orchestral: bouncy bass, bright square-wave and pluck melodies, light drums, orchestral hits and strings, fun, driving, kid-friendly, 140 BPM.",
 "victory": "Triumphant joyful celebration: soaring orchestral brass and strings, bells, timpani, uplifting heroic melody in a major key, kid-friendly, 110 BPM, big happy ending.",
}
MUSIC_LEN = {"title": 90, "base": 90, "storm": 75, "night": 90, "minigame": 75, "victory": 60}
XF = 3.0

def run(*a):
    return subprocess.run(a, check=True, capture_output=True, text=True)

def dur(p):
    return float(run("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)).stdout)

def gen_sfx(name, i, prompt, d):
    out = SFX_DIR / (f"{name}.mp3" if i == 0 else f"{name}{i+1}.mp3")
    if out.exists() and not FORCE: return
    raw = RAW / f"{out.stem}.mp3"
    if not raw.exists() or FORCE:
        text = S + prompt + (f". Variation {i+1}." if i else "")
        r = requests.post("https://api.elevenlabs.io/v1/sound-generation", headers=H,
                          json={"text": text, "duration_seconds": d, "prompt_influence": 0.6}, timeout=300)
        r.raise_for_status(); raw.write_bytes(r.content)
    af = ("silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,"
          "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,"
          "lowpass=f=9500,highpass=f=60,loudnorm=I=-20:TP=-3:LRA=7,"
          "afade=t=in:d=0.004")
    tmp = out.with_suffix(".tmp.mp3")
    run("ffmpeg", "-y", "-i", str(raw), "-af", af, "-ac", "1", "-ar", "44100", "-b:a", "96k", str(tmp))
    dl = dur(tmp)
    run("ffmpeg", "-y", "-i", str(tmp), "-af", f"afade=t=out:st={max(0, dl-0.06):.3f}:d=0.06", "-ac", "1", "-b:a", "96k", str(out))
    tmp.unlink(); print("sfx", out.name, f"{dur(out):.2f}s", flush=True)

def gen_music(name):
    out = MUS_DIR / f"{name}.mp3"
    if out.exists() and not FORCE: return
    raw = RAW / f"music_{name}.mp3"
    if not raw.exists() or FORCE:
        for attempt in range(6):  # 429 = concurrency limit shared with other jobs: back off and retry
            r = requests.post("https://api.elevenlabs.io/v1/music", headers=H,
                              json={"prompt": MUSIC[name] + " Instrumental only, no vocals, no singing.",
                                    "music_length_ms": MUSIC_LEN[name] * 1000}, timeout=900)
            if r.status_code not in (429, 401): break
            time.sleep(20 * (attempt + 1))
        r.raise_for_status(); raw.write_bytes(r.content)
    T = dur(raw)
    # seamless loop: body + crossfade(tail -> head)
    fc = (f"[0:a]atrim={XF}:{T-XF},asetpts=PTS-STARTPTS[body];"
          f"[0:a]atrim={T-XF}:{T},asetpts=PTS-STARTPTS[tail];"
          f"[0:a]atrim=0:{XF},asetpts=PTS-STARTPTS[head];"
          f"[tail][head]acrossfade=d={XF}:c1=qsin:c2=qsin[x];"
          f"[body][x]concat=n=2:v=0:a=1,lowpass=f=14000,loudnorm=I=-20:TP=-2:LRA=9[o]")
    run("ffmpeg", "-y", "-i", str(raw), "-filter_complex", fc, "-map", "[o]", "-ar", "44100", "-b:a", "128k", str(out))
    print("music", out.name, f"{dur(out):.1f}s {out.stat().st_size//1024}KB", flush=True)

def safe(f, *a):
    try: f(*a)
    except Exception as e: print("FAIL", a[0], type(e).__name__, str(e)[:200], flush=True)

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    want = lambda n, grp: not args or n in args or grp in args
    with ThreadPoolExecutor(1 if args == ["music"] else 4) as ex:
        for n, (p, d, v) in SFX.items():
            if want(n, "sfx"):
                for i in range(v): ex.submit(safe, gen_sfx, n, i, p, d)
        for n in MUSIC:
            if want(n, "music"): ex.submit(safe, gen_music, n)
