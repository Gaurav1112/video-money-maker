#!/usr/bin/env python3
"""Edge-TTS synthesis helper.

Reads text or SSML from stdin (UTF-8), synthesizes via Microsoft Edge TTS
(`edge_tts.Communicate`), and writes MP3 audio bytes to --out.

Used by `src/audio/tts-engines/edge-tts-hinglish.ts` for the Hinglish dual-
track audio path and by the Hinglish hot path in `src/voice/tts.ts`.

Usage:
    edge-tts-synth.py --voice <voice> [--rate <rate>] [--pitch <pitch>] --out <path.mp3> < input.txt
    edge-tts-synth.py --voice <voice> [--rate <rate>] [--pitch <pitch>] --out <path.mp3> \\
        --write-words <path.words.json> < input.txt

    --pitch       Hz delta from voice baseline, e.g. "+5Hz" (energetic hook),
                  "-3Hz" (gravitas/CTA closing), "+0Hz" (neutral body). Matches
                  the pitchPercent→Hz conversion in edge-tts-hinglish.ts.

    --write-words Optional path to write a word-boundary JSON sidecar in the
                  same shape as edge-tts-words.py:
                      [{ "word": "Hello", "startMs": 100, "endMs": 540 }, ...]
                  Audio and word timing come from the *same* synthesis pass so
                  they are byte-exact — no drift from a second TTS call.

Determinism: same (voice, rate, pitch, text) → same MP3 bytes (Edge TTS CDN-
hosted neural model is stable across short windows; cache layer in TS code keys
on SHA-256 of `voice::rate::pitch::text` to avoid repeat calls).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Optional

import edge_tts


async def synth(
    voice: str,
    rate: str,
    pitch: str,
    text: str,
    out_path: Path,
    words_path: Optional[Path] = None,
) -> None:
    # Enable WordBoundary events only when a sidecar path is requested so we
    # don't pay the marginal overhead on pure-audio calls.
    kwargs: dict = {}
    if words_path is not None:
        kwargs["boundary"] = "WordBoundary"

    communicate = edge_tts.Communicate(text, voice=voice, rate=rate, pitch=pitch, **kwargs)
    words: list[dict] = []

    with out_path.open("wb") as fh:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                fh.write(chunk["data"])
            elif words_path is not None and chunk["type"] == "WordBoundary":
                # offset and duration are in 100-nanosecond units (HNS)
                start_ms = int(chunk["offset"]) // 10_000
                dur_ms = int(chunk["duration"]) // 10_000
                words.append(
                    {
                        "word": chunk["text"],
                        "startMs": start_ms,
                        "endMs": start_ms + dur_ms,
                    }
                )

    if words_path is not None:
        words_path.write_text(
            json.dumps(words, ensure_ascii=False), encoding="utf-8"
        )


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
    p.add_argument(
        "--write-words",
        default=None,
        metavar="PATH",
        help="Optional path to write word-boundary JSON sidecar",
    )
    args = p.parse_args()
    text = sys.stdin.read()
    if not text.strip():
        print("[edge-tts-synth] empty stdin text", file=sys.stderr)
        return 2
    words_path = Path(args.write_words) if args.write_words else None
    asyncio.run(synth(args.voice, args.rate, args.pitch, text, Path(args.out), words_path))
    return 0


if __name__ == "__main__":
    sys.exit(main())
