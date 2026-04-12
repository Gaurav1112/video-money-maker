#!/bin/bash
# Generate lip-synced talking avatar using SadTalker via Docker
# Usage: bash scripts/sadtalker-docker.sh <face-photo> <audio-file> <output-video>
#
# Example:
#   bash scripts/sadtalker-docker.sh public/images/guru-avatar.jpg public/audio/master-API-Gateway-s1.mp3 public/video/teacher-talking.mp4

FACE="$1"
AUDIO="$2"
OUTPUT="$3"

if [ -z "$FACE" ] || [ -z "$AUDIO" ] || [ -z "$OUTPUT" ]; then
  echo "Usage: bash scripts/sadtalker-docker.sh <face.jpg> <audio.mp3> <output.mp4>"
  exit 1
fi

FACE_ABS=$(realpath "$FACE")
AUDIO_ABS=$(realpath "$AUDIO")
OUTPUT_DIR=$(dirname "$(realpath "$OUTPUT")")
OUTPUT_NAME=$(basename "$OUTPUT")

echo "Generating lip-synced avatar..."
echo "  Face: $FACE_ABS"
echo "  Audio: $AUDIO_ABS"
echo "  Output: $OUTPUT_DIR/$OUTPUT_NAME"

# Run SadTalker via Docker
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
if [ -n "$RESULT" ] && [ "$RESULT" != "$OUTPUT_DIR/$OUTPUT_NAME" ]; then
  mv "$RESULT" "$OUTPUT_DIR/$OUTPUT_NAME"
fi

if [ -f "$OUTPUT_DIR/$OUTPUT_NAME" ]; then
  echo "✓ Done: $OUTPUT_DIR/$OUTPUT_NAME ($(du -h "$OUTPUT_DIR/$OUTPUT_NAME" | cut -f1))"
else
  echo "✗ Failed — SadTalker did not produce output"
  echo "Try: docker pull vinthony/sadtalker"
  exit 1
fi
