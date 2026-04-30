#!/bin/bash
# Create portrait Instagram reel from the NEW long video
# - Extracts first 3 minutes (includes 5s cinematic hook + best content)
# - Converts to 1080x1920 portrait with blurred bg
# - Speeds up to 1.7x (3min becomes ~1:46 — perfect reel length)
# - Preserves ALL audio, captions, graphics (burned in from Remotion)

LONG_VIDEO="$1"
OUTPUT="$2"
DURATION="${3:-180}"  # seconds to extract (default 3 min)

if [ -z "$LONG_VIDEO" ] || [ -z "$OUTPUT" ]; then
  echo "Usage: bash scripts/make-portrait-reels.sh <long-video.mp4> <output-portrait.mp4> [duration_secs]"
  exit 1
fi

echo "Creating portrait reel from: $LONG_VIDEO"
echo "  Duration: ${DURATION}s → $(echo "scale=0; $DURATION / 1.7" | bc)s at 1.7x"

ffmpeg -y -i "$LONG_VIDEO" -t "$DURATION" \
  -filter_complex "
    [0:v]setpts=PTS/1.7,split=2[bg][fg];
    [bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:3,eq=brightness=-0.12[blurred];
    [fg]scale=1080:-2:flags=lanczos[scaled];
    [blurred][scaled]overlay=(W-w)/2:(H-h)/2[vout];
    [0:a]atempo=1.7[aout]
  " \
  -map "[vout]" -map "[aout]" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 192k \
  -r 30 \
  -movflags +faststart \
  "$OUTPUT" 2>&1 | grep -E "frame=|time=|speed=" | tail -5

echo "Done: $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
