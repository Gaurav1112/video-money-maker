#!/usr/bin/env python3
"""Edge-TTS helper that emits word-level boundaries.

The `python -m edge_tts` CLI only produces sentence-level SRT subtitles.
For karaoke captions we need per-word timestamps, which the Python API
exposes via WordBoundary events on the streaming Communicate iterator.

Usage:
    edge-tts-words.py --voice <voice> --rate <rate> --text <text> \\
        --out-audio <path.mp3> --out-words <path.json>

Output JSON shape:
    [{ "word": "Hello", "startMs": 100, "endMs": 540 }, ...]

Designed to be byte-deterministic for a fixed (voice, rate, text) tuple
so the upstream SHA256 cache stays valid.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

import edge_tts


async def synth(voice: str, rate: str, text: str, audio_path: Path, words_path: Path) -> None:
    communicate = edge_tts.Communicate(
        text, voice=voice, rate=rate, boundary="WordBoundary"
    )
    words: list[dict] = []
    with audio_path.open("wb") as audio:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                # offset & duration are in 100-nanosecond units (HNS)
                start_ms = int(chunk["offset"]) // 10_000
                dur_ms = int(chunk["duration"]) // 10_000
                words.append(
                    {
                        "word": chunk["text"],
                        "startMs": start_ms,
                        "endMs": start_ms + dur_ms,
                    }
                )
    words_path.write_text(json.dumps(words, ensure_ascii=False), encoding="utf-8")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--voice", required=True)
    p.add_argument("--rate", required=True, help="e.g. +0%% or +8%%")
    p.add_argument("--text", required=True)
    p.add_argument("--out-audio", required=True)
    p.add_argument("--out-words", required=True)
    args = p.parse_args()
    asyncio.run(
        synth(
            args.voice,
            args.rate,
            args.text,
            Path(args.out_audio),
            Path(args.out_words),
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
