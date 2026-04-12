#!/bin/bash
# ============================================================================
# FULL DETERMINISTIC VIDEO PIPELINE
# ============================================================================
# Generates complete videos for any topic/session. No LLM, no tokens.
# Same input = same output. Every video has unique hooks, visuals, avatar.
#
# Usage:
#   bash scripts/full-pipeline.sh <topic-slug> <session-number>
#   bash scripts/full-pipeline.sh api-gateway 1
#   bash scripts/full-pipeline.sh load-balancing --all
#   bash scripts/full-pipeline.sh --list
#
# What it does:
#   1. Generate storyboard (Chatterbox TTS + D2 diagrams + Rhubarb lip sync)
#   2. Generate lip-synced guru avatar (SadTalker + art_0 character)
#   3. Render video (Remotion with light theme + all upgrades)
#   4. Copy to ~/Documents/guru-sishya/<topic>/session-<N>/long/
# ============================================================================

set -e

PIPELINE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SADTALKER_DIR="$PIPELINE_DIR/tools/SadTalker"
SADTALKER_ENV="$PIPELINE_DIR/tools/sadtalker-env/bin/python"
GURU_FACE="$SADTALKER_DIR/examples/source_image/art_0.png"
AVATAR_VIDEO="$PIPELINE_DIR/public/video/teacher-talking.mp4"
DOCS_DIR="$HOME/Documents/guru-sishya"

cd "$PIPELINE_DIR"

# ── List topics ──────────────────────────────────────────────────────────────
if [ "$1" = "--list" ]; then
  python3 scripts/render-pipeline.py --list-topics
  exit 0
fi

TOPIC="$1"
SESSION="$2"

if [ -z "$TOPIC" ]; then
  echo "Usage: bash scripts/full-pipeline.sh <topic-slug> <session-number>"
  echo "       bash scripts/full-pipeline.sh <topic-slug> --all"
  echo "       bash scripts/full-pipeline.sh --list"
  exit 1
fi

# ── Render all sessions ──────────────────────────────────────────────────────
if [ "$SESSION" = "--all" ]; then
  for S in $(seq 1 10); do
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║  $TOPIC — Session $S                                        "
    echo "╚══════════════════════════════════════════════════════════════╝"
    bash scripts/full-pipeline.sh "$TOPIC" "$S" || {
      echo "  ⚠ Session $S failed or doesn't exist. Stopping."
      break
    }
  done
  echo ""
  echo "═══ ALL DONE: $TOPIC ═══"
  exit 0
fi

PROPS="output/test-props-s${SESSION}.json"
OUTPUT="output/${TOPIC}-s${SESSION}.mp4"
DEST_DIR="$DOCS_DIR/$TOPIC/session-$SESSION/long"
DEST="$DEST_DIR/${TOPIC}-s${SESSION}.mp4"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  $TOPIC — Session $SESSION                                    "
echo "╚══════════════════════════════════════════════════════════════╝"

# ── Step 1: Generate storyboard (Chatterbox TTS + D2 + Rhubarb) ─────────
echo ""
echo "[1/4] Generating storyboard (Chatterbox voice + D2 diagrams + lip sync cues)..."
npx tsx scripts/render-session.ts "$TOPIC" "$SESSION"

if [ ! -f "$PROPS" ]; then
  echo "  ✗ No props file — topic may not have session $SESSION"
  exit 1
fi

# Verify key features
HAS_D2=$(node -e "const d=JSON.parse(require('fs').readFileSync('$PROPS','utf-8')); console.log(!!d.storyboard.scenes[2]?.d2Svg)")
HAS_CUES=$(node -e "const d=JSON.parse(require('fs').readFileSync('$PROPS','utf-8')); console.log(d.storyboard.mouthCues?.length || 0)")
echo "  ✓ D2 diagrams: $HAS_D2"
echo "  ✓ Lip sync cues: $HAS_CUES"

# ── Step 2: Generate lip-synced guru avatar ──────────────────────────────
MASTER_AUDIO=$(node -e "const d=JSON.parse(require('fs').readFileSync('$PROPS','utf-8')); console.log(d.storyboard.audioFile)")

if [ -f "$SADTALKER_ENV" ] && [ -f "$GURU_FACE" ] && [ -f "$MASTER_AUDIO" ]; then
  echo ""
  echo "[2/4] Generating lip-synced guru avatar (SadTalker)..."

  # Convert master audio to WAV for SadTalker (only first 30 seconds — avatar loops)
  AVATAR_AUDIO="/tmp/avatar-audio-${TOPIC}-s${SESSION}.wav"
  ffmpeg -y -i "$MASTER_AUDIO" -t 30 "$AVATAR_AUDIO" 2>/dev/null

  AVATAR_OUT="$PIPELINE_DIR/output/sadtalker-session"
  mkdir -p "$AVATAR_OUT"

  cd "$SADTALKER_DIR"
  "$SADTALKER_ENV" inference.py \
    --driven_audio "$AVATAR_AUDIO" \
    --source_image "$GURU_FACE" \
    --result_dir "$AVATAR_OUT" \
    --still --preprocess resize 2>&1 | grep -E "Face Renderer|landmark|audio2exp" | tail -3
  cd "$PIPELINE_DIR"

  # Find and copy the output
  AVATAR_RESULT=$(find "$AVATAR_OUT" -name "*.mp4" -newer "$AVATAR_AUDIO" | head -1)
  if [ -n "$AVATAR_RESULT" ]; then
    cp "$AVATAR_RESULT" "$AVATAR_VIDEO"
    echo "  ✓ Guru avatar generated"
  else
    echo "  ⚠ Avatar generation failed — using existing"
  fi

  rm -f "$AVATAR_AUDIO"
  rm -rf "$AVATAR_OUT"
else
  echo ""
  echo "[2/4] Skipping avatar (SadTalker not set up or no audio)"
fi

# ── Step 3: Render video ─────────────────────────────────────────────────
echo ""
echo "[3/4] Rendering video..."
npx remotion render src/compositions/index.tsx LongVideo "$OUTPUT" \
  --props="$PROPS" --concurrency=4 2>&1 | tail -3

if [ ! -f "$OUTPUT" ]; then
  echo "  ✗ Render failed"
  exit 1
fi

SIZE=$(du -h "$OUTPUT" | cut -f1)
echo "  ✓ Rendered: $SIZE"

# ── Step 4: Copy to Documents ────────────────────────────────────────────
echo ""
echo "[4/4] Copying to Documents..."
mkdir -p "$DEST_DIR"
cp "$OUTPUT" "$DEST"
rm -f "$OUTPUT"

echo ""
echo "  ✓ DONE: $DEST ($SIZE)"
echo ""
