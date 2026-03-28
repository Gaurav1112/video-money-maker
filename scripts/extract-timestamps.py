#!/usr/bin/env python3
"""
Extract word-level timestamps from audio using faster-whisper.

Usage:
  python3 scripts/extract-timestamps.py <audio_file> [--model tiny|base|small]

Outputs JSON to stdout:
  {
    "words": [{ "word": "hello", "start": 0.0, "end": 0.42 }, ...],
    "duration": 12.5
  }

Requires: pip3 install faster-whisper
"""

import sys
import json
import os

def extract_timestamps(audio_path: str, model_size: str = "tiny") -> dict:
    """Extract word-level timestamps from an audio file using faster-whisper."""
    from faster_whisper import WhisperModel

    # Use CPU for compatibility; INT8 quantization for speed
    model = WhisperModel(model_size, device="cpu", compute_type="int8")

    segments, info = model.transcribe(
        audio_path,
        word_timestamps=True,
        language="en",          # Force English for speed (skip language detection)
        beam_size=1,            # Fastest decoding
        best_of=1,              # No sampling overhead
        vad_filter=True,        # Skip silence segments
    )

    words = []
    for segment in segments:
        if segment.words:
            for w in segment.words:
                words.append({
                    "word": w.word.strip(),
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                })

    duration = info.duration if info.duration else (words[-1]["end"] if words else 0)

    return {
        "words": words,
        "duration": round(duration, 3),
    }


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 extract-timestamps.py <audio_file> [--model tiny|base|small]", file=sys.stderr)
        sys.exit(1)

    audio_path = sys.argv[1]

    if not os.path.exists(audio_path):
        print(json.dumps({"error": f"File not found: {audio_path}", "words": [], "duration": 0}))
        sys.exit(1)

    # Parse optional --model flag
    model_size = "tiny"
    if "--model" in sys.argv:
        idx = sys.argv.index("--model")
        if idx + 1 < len(sys.argv):
            model_size = sys.argv[idx + 1]

    try:
        result = extract_timestamps(audio_path, model_size)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e), "words": [], "duration": 0}))
        sys.exit(1)


if __name__ == "__main__":
    main()
