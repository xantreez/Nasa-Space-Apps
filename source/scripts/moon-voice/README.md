# Tobish's voice (/game)

`voice.py` voices every line in the Moon game with OmniVoice (same setup as `scripts/tour-voice`)
and writes `public/moon/voice/<sha1(text)[:12]>.mp3` + `manifest.json` `{hash: {file, text, dur}}`.
`moon/voice.ts` plays them (same normalisation: trim + collapse whitespace; SHA-1 of UTF-8, first 12 hex).

Voice: OmniVoice voice design `male, young adult, american accent, moderate pitch` renders ONE reference
(`voice/tobish.wav`); every line clones it. Delete it to re-cast (then delete public/moon/voice too).
Slightly slow (0.94, 0.9 for storm lines). Radio post: 250-3800 Hz band-pass, compressor, static crackle,
-16 LUFS, mono mp3 80 kbps. Each clip is read back with Whisper and redone (up to 4x) if it doesn't match.

Lines come from `dump.ts` (`bun scripts/moon-voice/dump.ts`): missions, decisions (+ storm prompts for
every DONKI event severity>=2), `moon/voice-lines.ts`, cards, DONKI events. Priority = category order.

    ~/.cache/eduspace-tts/.venv/bin/python scripts/moon-voice/voice.py            # incremental
    ... voice.py --cats 1-missions,3-fixed --limit 5
