"""Tobish's voice for the /game Moon survival game (moon/voice.ts).

Collects every line via `bun scripts/moon-voice/dump.ts`, voices it with OmniVoice
(k2-fsa/OmniVoice) and writes public/moon/voice/<sha1(text)[:12]>.mp3 + manifest.json
{hash: {file, text, dur}}. Incremental: existing hashes are skipped.

Voice: OmniVoice "voice design" (instruct = "male, young adult, american accent,
moderate pitch") makes ONE reference clip, voice/tobish.wav, which every line then
clones — delete it to re-cast. Each clip is read back with Whisper and redone if wrong.
Post: radio band-pass 250-3800 Hz, light compression, static crackle, -16 LUFS, mono mp3.

    python voice.py                    # everything, priority order
    python voice.py --cats 1-missions,3-fixed
    python voice.py --limit 5          # trial
"""
import argparse, difflib, hashlib, json, os, re, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
OUT = ROOT / "public/moon/voice"
VS = Path(os.environ.get("VOICESTUDIO_RES", "/Applications/VoiceStudio.app/Contents/Resources"))
sys.path.insert(0, str(VS))

NUM_STEP = int(os.environ.get("MOON_VOICE_STEPS", "20"))  # 32 = model default; 20 is faster, still clean
ROLES = {
    "tobish": ("male, young adult, american accent, moderate pitch",
               "Commander, we did it! The air is clean, the lights are on, and we are not alone out here."),
    "narrator": ("male, middle-aged, low pitch, british accent",
                 "Long ago, on a quiet night, a little light began to shine over the silent sea of stars."),
    "control": ("female, middle-aged, moderate pitch, american accent",
                "Tobish, this is Mission Control. We read you loud and clear. Stand by for the next update."),
}


def norm(text: str) -> str:
    """Must match norm() in moon/voice.ts: trim + collapse whitespace."""
    return re.sub(r"\s+", " ", text).strip()


def hid(text: str) -> str:
    return hashlib.sha1(norm(text).encode("utf-8")).hexdigest()[:12]


def speakable(text: str) -> str:
    text = re.sub(r"[\U0001F000-\U0001FFFF☀-➿️]", "", text)
    text = text.replace("—", ", ").replace("–", " to ").replace("…", "...")
    text = text.replace("°C", " degrees Celsius").replace("km/s", "kilometres per second").replace("km/h", "kilometres per hour")
    text = text.replace("%", " percent").replace("&", " and ")
    text = re.sub(r"\bNASA's\b", "NASA's", text)
    text = re.sub(r"\bDONKI\b", "Donkee", text)
    return norm(text)


_asr = None


def heard(path, text):
    global _asr
    from faster_whisper import WhisperModel
    if _asr is None:
        _asr = WhisperModel("base.en", device="cpu", compute_type="int8", cpu_threads=4)
    segs, _ = _asr.transcribe(path, language="en")
    w = lambda s: re.sub(r"[^\w ]", " ", s.lower()).split()
    return difflib.SequenceMatcher(None, w(text), w(" ".join(x.text for x in segs))).ratio()


_model = None


def model():
    global _model
    if _model is None:
        import torch
        from omnivoice.models.omnivoice import OmniVoice
        device = "mps" if torch.backends.mps.is_available() else "cpu"
        local = Path(os.environ.get("OMNIVOICE_MODEL", Path.home() / ".cache/eduspace-tts/OmniVoice"))
        src = str(local) if (local / "model.safetensors").exists() else "k2-fsa/OmniVoice"
        _model = OmniVoice.from_pretrained(src, device_map=device, dtype=torch.float16 if device != "cpu" else torch.float32)
    return _model


def voice_prompt(who):
    import soundfile as sf
    m = model()
    vdir = HERE / "voice"
    vdir.mkdir(exist_ok=True)
    INSTRUCT, REF_TEXT = ROLES[who]
    wav, txt = vdir / f"{who}.wav", vdir / f"{who}.txt"
    if not wav.exists():
        for _ in range(8):
            a = m.generate(text=REF_TEXT, language="English", instruct=INSTRUCT, speed=0.95)
            sf.write(str(wav), a[0].squeeze(0).float().cpu().numpy(), m.sampling_rate)
            if heard(str(wav), REF_TEXT) > 0.9:
                break
        txt.write_text(REF_TEXT)
    return m.create_voice_clone_prompt(str(wav), ref_text=txt.read_text())


FILTER_NARRATOR = (
    "[0:a]highpass=f=70,acompressor=threshold=-22dB:ratio=2.5:attack=15:release=250:makeup=2,"
    "aecho=0.85:0.5:55|110:0.14|0.07,loudnorm=I=-16:TP=-1.5:LRA=9"
)
FILTER = (
    "[0:a]highpass=f=250,lowpass=f=3800,acompressor=threshold=-20dB:ratio=3:attack=10:release=150:makeup=2,"
    "adelay=260|260,apad=pad_dur=0.15[v];"
    "anoisesrc=d=0.5:c=white:a=0.5,highpass=f=800,lowpass=f=3500,"
    "tremolo=f=45:d=0.9,afade=t=in:d=0.03,afade=t=out:st=0.05:d=0.4,volume=0.12[n];"
    "[v][n]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=9"
)


def post(wav: Path, mp3: Path, who="tobish"):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-filter_complex", FILTER_NARRATOR if who == "narrator" else FILTER,
                    "-ac", "1", "-ar", "24000", "-b:a", "80k", str(mp3)], check=True)


def duration(mp3: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(mp3)],
                       capture_output=True, text=True)
    return round(float(r.stdout.strip() or 0), 2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cats", default="")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()
    import soundfile as sf

    dump = subprocess.run(["bun", str(HERE / "dump.ts")], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    lines = json.loads(dump)
    cats = args.cats.split(",") if args.cats else None
    seen, todo = set(), []
    for x in sorted(lines, key=lambda x: x["cat"]):  # stable: priority = category number
        t = norm(x["text"])
        if t in seen or (cats and x["cat"] not in cats):
            continue
        seen.add(t)
        todo.append((x["cat"], t, x.get("who") or "tobish", x.get("id") or ""))
    OUT.mkdir(parents=True, exist_ok=True)
    mp = OUT / "manifest.json"
    man = json.loads(mp.read_text()) if mp.exists() else {}
    todo = [(c, t, w, i) for c, t, w, i in todo if not (hid(t) in man and (OUT / man[hid(t)]["file"]).exists())]
    if args.limit:
        todo = todo[: args.limit]
    print(f"{len(todo)} lines to voice", flush=True)
    if not todo:
        return
    prompts = {}
    m = model()
    tmp = HERE / "out"
    tmp.mkdir(exist_ok=True)
    for i, (cat, t, who, lid) in enumerate(todo, 1):
        if who not in prompts:
            prompts[who] = voice_prompt(who)
        say = speakable(t)
        tense = bool(re.search(r"storm|flare|radiation|danger|alarm|hide|warning|particles", t, re.I))
        speed = 0.9 if tense else 0.94
        if who == "narrator":
            speed = 0.9
        elif who == "control":
            speed = 0.92
        elif lid in ("s5a", "s5b"):
            speed = 1.08  # panicked, fast
        elif lid == "s7c":
            speed = 0.94
        best, wav = -1.0, tmp / "best.wav"
        for _ in range(4):
            t0 = time.time()
            a = m.generate(text=say, language="English", voice_clone_prompt=prompts[who], speed=speed, num_step=NUM_STEP)
            cand = tmp / "try.wav"
            sf.write(str(cand), a[0].squeeze(0).float().cpu().numpy(), m.sampling_rate)
            t1 = time.time()
            sc = heard(str(cand), say)
            print(f"   gen {t1 - t0:.0f}s asr {time.time() - t1:.0f}s", flush=True)
            if sc > best:
                best = sc
                cand.replace(wav)
            if sc > 0.85:
                break
        h = hid(t)
        mp3 = OUT / f"{h}.mp3"
        post(wav, mp3, who)
        man[h] = {"file": mp3.name, "text": t, "dur": duration(mp3)}
        mp.write_text(json.dumps(man, indent=1, sort_keys=True, ensure_ascii=False))
        print(f"[{i}/{len(todo)}] {cat} {who} {h} heard {best:.2f} {man[h]['dur']}s", flush=True)


if __name__ == "__main__":
    main()
