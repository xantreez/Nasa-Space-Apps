# Moon game audio generator
`python3 gen.py` generates SFX (`public/moon/sfx/*.mp3`, mono 96k, trimmed, loudnorm) and seamless music loops
(`public/moon/music/*.mp3`, 128k, 3 s crossfade at the loop point) with ElevenLabs. Key comes from `../rashid/.env`.
Idempotent: skips existing outputs; raw API results cached in `raw/` (gitignore it). `--force` regenerates; pass names
(`python3 gen.py coin music`) to limit. Variants are `name.mp3`, `name2.mp3`, `name3.mp3`.
