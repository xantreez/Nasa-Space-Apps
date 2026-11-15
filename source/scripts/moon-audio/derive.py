"""Fallback when ElevenLabs credits run out: derive missing music loops from base/minigame with ffmpeg
(pitch/tempo shift, filters, reverb). Only fills tracks that don't exist. Delete a derived file and run gen.py to replace it."""
import subprocess
from pathlib import Path
M = Path(__file__).resolve().parent.parent.parent / "public/moon/music"
R = 44100
RECIPES = {  # name: (source, filter)
 "night": ("base", f"asetrate={int(R*0.84)},aresample={R},lowpass=f=3800,aecho=0.8:0.85:70|140:0.35|0.25,volume=0.9"),
 "storm": ("minigame", f"asetrate={int(R*0.88)},aresample={R},lowpass=f=6500,tremolo=f=3.6:d=0.45,aecho=0.8:0.8:60:0.25"),
 "title": ("base", f"asetrate={int(R*0.94)},aresample={R},aecho=0.8:0.88:90|180:0.35|0.25,bass=g=2"),
 "victory": ("minigame", f"asetrate={int(R*1.05)},aresample={R},aecho=0.8:0.88:80|160:0.3|0.2,treble=g=-2"),
}
for n, (src, f) in RECIPES.items():
    out = M / f"{n}.mp3"
    if out.exists() or not (M / f"{src}.mp3").exists(): continue
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(M / f"{src}.mp3"), "-af", f + ",loudnorm=I=-20:TP=-2",
                    "-b:a", "96k", str(out)], check=True)
    print("derived", n)
