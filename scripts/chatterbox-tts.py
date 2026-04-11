#!/usr/bin/env python3
"""
Chatterbox TTS wrapper — called by tts-engine.ts
Generates WAV audio from text with human-sounding voice.

Usage:
  python3 scripts/chatterbox-tts.py --text "Hello world" --output output.wav
  python3 scripts/chatterbox-tts.py --text "Hello world" --output output.wav --reference voice.wav
"""
import argparse
import sys
import os

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--reference", default=None, help="Reference voice WAV for cloning")
    args = parser.parse_args()

    from chatterbox.tts import ChatterboxTTS
    import soundfile as sf
    import torch

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = ChatterboxTTS.from_pretrained(device=device)

    if args.reference and os.path.exists(args.reference):
        wav = model.generate(args.text, audio_prompt_path=args.reference)
    else:
        wav = model.generate(args.text)

    sf.write(args.output, wav.squeeze().cpu().numpy(), model.sr)
    duration = wav.shape[1] / model.sr
    print(f"{duration:.1f}")

if __name__ == "__main__":
    main()
