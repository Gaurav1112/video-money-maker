#!/bin/bash
# Generate a looping lip-synced avatar video using SadTalker
# This creates a short talking-head clip from KumarGaurav.jpg that loops in ViralShort
#
# Usage:
#   bash scripts/generate-avatar-video.sh                    # uses default 10s audio sample
#   bash scripts/generate-avatar-video.sh path/to/audio.mp3  # uses specific audio
#
# Output: public/video/avatar-talking.mp4 (loops in ViralShort AvatarBubble)
# Cost: $0 — runs 100% locally via Docker

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FACE="$PROJECT_ROOT/public/images/KumarGaurav.jpg"
OUTPUT_DIR="$PROJECT_ROOT/public/video"
OUTPUT="$OUTPUT_DIR/avatar-talking.mp4"

# Use provided audio or generate a 10s sample from any existing TTS
AUDIO="${1:-}"
if [ -z "$AUDIO" ]; then
  # Find any existing TTS audio to use as lip-sync reference
  AUDIO=$(find "$PROJECT_ROOT/public/audio" -name "kokoro_*.mp3" -size +50k | head -1)
  if [ -z "$AUDIO" ]; then
    echo "No audio file found. Run a render first to generate TTS audio, then re-run this script."
    exit 1
  fi
  echo "Using audio sample: $AUDIO"

  # Trim to 10 seconds for a compact loop
  TRIMMED="$PROJECT_ROOT/public/audio/_avatar-sample.mp3"
  ffmpeg -y -i "$AUDIO" -t 10 -codec:a libmp3lame -b:a 192k "$TRIMMED" 2>/dev/null
  AUDIO="$TRIMMED"
fi

mkdir -p "$OUTPUT_DIR"

echo "=== Generating Lip-Synced Avatar ==="
echo "  Face:   $FACE"
echo "  Audio:  $AUDIO"
echo "  Output: $OUTPUT"
echo ""

# Check Docker
if ! docker --version >/dev/null 2>&1; then
  echo "Error: Docker not installed. Install Docker Desktop first."
  exit 1
fi

# Check SadTalker image
if ! docker images | grep -q sadtalker; then
  echo "Pulling SadTalker Docker image (one-time, ~4GB)..."
  docker pull vinthony/sadtalker --platform linux/amd64
fi

FACE_ABS=$(realpath "$FACE")
AUDIO_ABS=$(realpath "$AUDIO")

echo "Running SadTalker..."
echo "(This takes 2-5 minutes on first run, faster with GPU)"

docker run --rm \
  -v "$FACE_ABS:/app/input/face.jpg:ro" \
  -v "$AUDIO_ABS:/app/input/audio.mp3:ro" \
  -v "$OUTPUT_DIR:/app/output" \
  --platform linux/amd64 \
  vinthony/sadtalker \
  --driven_audio /app/input/audio.mp3 \
  --source_image /app/input/face.jpg \
  --result_dir /app/output \
  --still \
  --enhancer gfpgan \
  --preprocess crop 2>&1

# Find the output file (SadTalker names it with a timestamp)
RESULT=$(find "$OUTPUT_DIR" -name "*.mp4" -newer "$AUDIO_ABS" -maxdepth 2 | head -1)
if [ -n "$RESULT" ] && [ "$RESULT" != "$OUTPUT" ]; then
  mv "$RESULT" "$OUTPUT"
fi

if [ -f "$OUTPUT" ]; then
  SIZE=$(du -h "$OUTPUT" | cut -f1)
  DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUTPUT" 2>/dev/null | cut -d. -f1)
  echo ""
  echo "=== Avatar Video Generated ==="
  echo "  File:     $OUTPUT ($SIZE)"
  echo "  Duration: ${DURATION}s (will loop in ViralShort)"
  echo ""
  echo "The AvatarBubble component in ViralShort.tsx will auto-detect"
  echo "public/video/avatar-talking.mp4 and use it instead of the static photo."
else
  echo ""
  echo "Error: SadTalker did not produce output."
  echo "Try: docker pull vinthony/sadtalker"
  exit 1
fi
