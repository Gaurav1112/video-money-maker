#!/usr/bin/env python3
"""
Kokoro TTS wrapper for the video pipeline.
Generates high-quality speech audio with word-level timestamps.

Usage:
  python3 scripts/kokoro-tts.py --text "Hello world" --output /tmp/test.wav
  python3 scripts/kokoro-tts.py --text "Hello world" --output /tmp/test.wav --voice af_heart --speed 1.2
  python3 scripts/kokoro-tts.py --text-file /tmp/input.txt --output /tmp/test.wav --timestamps

Voices: af_heart (warm male), af_bella (clear female), am_puck (energetic male)
Speed: 0.8 (slow) to 1.5 (fast), default 1.2
"""

import argparse
import json
import os
import sys
import time

# Model paths relative to pipeline root
PIPELINE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(PIPELINE_DIR, 'tools', 'kokoro', 'kokoro-v1.0.onnx')
VOICES_PATH = os.path.join(PIPELINE_DIR, 'tools', 'kokoro', 'voices-v1.0.bin')

def main():
    parser = argparse.ArgumentParser(description='Kokoro TTS for video pipeline')
    parser.add_argument('--text', type=str, help='Text to synthesize')
    parser.add_argument('--text-file', type=str, help='File containing text to synthesize')
    parser.add_argument('--output', type=str, required=True, help='Output audio path (.wav)')
    parser.add_argument('--voice', type=str, default='am_adam', help='Voice ID (default: am_adam — American male)')
    parser.add_argument('--speed', type=float, default=1.2, help='Speed multiplier (default: 1.2)')
    parser.add_argument('--timestamps', action='store_true', help='Output word timestamps as JSON')
    args = parser.parse_args()

    text = args.text
    if args.text_file:
        with open(args.text_file, 'r') as f:
            text = f.read().strip()

    if not text:
        print('Error: no text provided', file=sys.stderr)
        sys.exit(1)

    import kokoro_onnx
    import soundfile as sf
    import numpy as np

    start = time.time()
    kokoro = kokoro_onnx.Kokoro(MODEL_PATH, VOICES_PATH)

    # Generate audio
    samples, sr = kokoro.create(text, voice=args.voice, speed=args.speed)
    elapsed = time.time() - start
    duration = len(samples) / sr

    # Save audio
    sf.write(args.output, samples, sr)

    # Generate word timestamps weighted by character length + pause detection.
    # Words after punctuation (., !, ?, ;, :) get a pause gap.
    # Longer words get proportionally more time than short ones.
    words = text.split()
    word_timestamps = []

    # Weight each word: character count + pause bonus after punctuation
    PAUSE_AFTER = {'.': 0.35, '!': 0.35, '?': 0.35, ';': 0.2, ':': 0.15, ',': 0.1, '—': 0.2, '...': 0.3}
    weights = []
    for i, word in enumerate(words):
        # Base weight = character length (minimum 2 to avoid ultra-short words)
        w = max(2, len(word))
        # Add pause weight if previous word ended with punctuation
        if i > 0:
            prev = words[i - 1]
            for punct, pause_weight in PAUSE_AFTER.items():
                if prev.endswith(punct):
                    w += pause_weight * 10  # scale pause to character units
                    break
        weights.append(w)

    total_weight = sum(weights)
    current_time = 0.0
    for i, word in enumerate(words):
        word_duration = (weights[i] / total_weight) * duration
        word_timestamps.append({
            'word': word,
            'start': round(current_time, 3),
            'end': round(current_time + word_duration, 3)
        })
        current_time += word_duration

    # Output result as JSON on stdout
    result = {
        'audioPath': os.path.abspath(args.output),
        'duration': round(duration, 3),
        'wordTimestamps': word_timestamps,
        'voice': args.voice,
        'speed': args.speed,
        'generationTime': round(elapsed, 2),
        'realtimeFactor': round(duration / elapsed, 1)
    }
    print(json.dumps(result))

if __name__ == '__main__':
    main()
