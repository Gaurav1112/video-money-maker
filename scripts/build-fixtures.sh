#!/usr/bin/env bash
# scripts/build-fixtures.sh
# Audio & golden fixtures for TDD test suite
# Run: npm run test:fixtures
# Generated files are committed; _renders/ and _first3s/ are gitignored.

set -euo pipefail

FIXTURES_DIR="$(cd "$(dirname "$0")/.." && pwd)/tests/fixtures"
mkdir -p "$FIXTURES_DIR"

echo "=== Building audio fixtures ==="

# 1. master-1s.wav — sine wave normalised to -14 LUFS, true peak ≤ -1.5 dBTP
ffmpeg -y \
  -f lavfi -i "sine=frequency=440:duration=1" \
  -ar 44100 -ac 2 \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" \
  "$FIXTURES_DIR/master-1s.wav"

# 2. bgm-solo-1s.wav — pink noise at moderate level (no ducking)
ffmpeg -y \
  -f lavfi -i "anoisesrc=duration=1:color=pink:r=44100:amplitude=0.5" \
  -ac 2 \
  "$FIXTURES_DIR/bgm-solo-1s.wav"

# 3. bgm-under-narration-1s.wav — BGM sidechain-compressed under narration
ffmpeg -y \
  -i "$FIXTURES_DIR/bgm-solo-1s.wav" \
  -i "$FIXTURES_DIR/master-1s.wav" \
  -filter_complex \
    "[0:a][1:a]sidechaincompress=threshold=0.05:ratio=8:attack=5:release=200[a]" \
  -map "[a]" \
  "$FIXTURES_DIR/bgm-under-narration-1s.wav"

echo "  ✓ master-1s.wav (sine -14 LUFS)"
echo "  ✓ bgm-solo-1s.wav (pink noise)"
echo "  ✓ bgm-under-narration-1s.wav (sidechain ducked)"

# 4. demo-storyboard.json — checked-in fixture (post-pivot).
#    Pre-pivot generator imported src/story/story-engine which no longer exists;
#    we now ship a static fixture under tests/fixtures/demo-storyboard.json.
if [ -f "$FIXTURES_DIR/demo-storyboard.json" ]; then
  echo "  ✓ demo-storyboard.json (checked-in fixture)"
else
  echo "  ✗ demo-storyboard.json missing — please commit a static fixture" >&2
  exit 1
fi
echo ""
echo "=== All fixtures built → $FIXTURES_DIR ==="
