#!/usr/bin/env python3
"""Edge-TTS synthesis helper.

Reads text or SSML from stdin (UTF-8), synthesizes via Microsoft Edge TTS
(`edge_tts.Communicate`), and writes MP3 audio bytes to --out.

Used by `src/audio/tts-engines/edge-tts-hinglish.ts` for the Hinglish dual-
track audio path. Replaces the never-published `edge-tts-node` npm package
that earlier code mistakenly tried to import.

Usage:
    edge-tts-synth.py --voice <voice> [--rate <rate>] [--pitch <pitch>] --out <path.mp3> < input.txt

    --pitch  Hz delta from voice baseline, e.g. "+5Hz" (energetic hook),
             "-3Hz" (gravitas/CTA closing), "+0Hz" (neutral body). Matches the
             pitchPercent→Hz conversion in edge-tts-hinglish.ts where 1% ≈ 1Hz.

Determinism: same (voice, rate, pitch, text) → same MP3 bytes (Edge TTS CDN-
hosted neural model is stable across short windows; cache layer in TS code keys
on SHA-256 of `voice::rate::pitch::text` to avoid repeat calls).
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

import edge_tts


async def synth(voice: str, rate: str, pitch: str, text: str, out_path: Path) -> None:
    communicate = edge_tts.Communicate(text, voice=voice, rate=rate, pitch=pitch)
    with out_path.open("wb") as fh:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                fh.write(chunk["data"])


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--voice", required=True)
    p.add_argument("--rate", default="+0%", help="e.g. +0%% or -5%%")
    p.add_argument(
        "--pitch",
        default="+0Hz",
        help="Hz delta from baseline, e.g. +5Hz (hook) or -3Hz (closing). Default +0Hz.",
    )
    p.add_argument("--out", required=True)
    args = p.parse_args()
    text = sys.stdin.read()
    if not text.strip():
        print("[edge-tts-synth] empty stdin text", file=sys.stderr)
        return 2
    asyncio.run(synth(args.voice, args.rate, args.pitch, text, Path(args.out)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
