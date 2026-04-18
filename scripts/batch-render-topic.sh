#!/bin/bash
# Batch render all sessions of a topic — PARALLEL pipeline
# Usage: bash scripts/batch-render-topic.sh <topic-slug> [max-sessions]
#
# Optimizations:
#   - Phase 1: Generate ALL storyboards first (I/O bound, parallel TTS)
#   - Phase 2: Render ALL videos (CPU bound, one at a time with max concurrency)
#   - Skip already-rendered videos (check destination exists)
#   - Persistent TTS disk cache across sessions

set -e

TOPIC="$1"
MAX="${2:-10}"

if [ -z "$TOPIC" ]; then
  echo "Usage: bash scripts/batch-render-topic.sh <topic-slug> [max-sessions]"
  exit 1
fi

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  BATCH RENDER: $TOPIC (up to $MAX sessions)                 "
echo "╚══════════════════════════════════════════════════════════════╝"

DEST_BASE="$HOME/Documents/guru-sishya/${TOPIC}"

# ── Phase 1: Generate ALL storyboards (fast — ~1 min each with parallel TTS) ──
echo ""
echo "═══ PHASE 1: Generating storyboards ═══"
SESSIONS_TO_RENDER=()
for SESSION in $(seq 1 $MAX); do
  DEST="$DEST_BASE/session-${SESSION}/long/${TOPIC}-s${SESSION}.mp4"

  # Skip if already rendered
  if [ -f "$DEST" ]; then
    echo "  ⏭ Session $SESSION: already rendered, skipping"
    continue
  fi

  echo "  [Storyboard] Session $SESSION..."
  npx tsx scripts/render-session.ts "$TOPIC" "$SESSION" 2>&1 | tail -1

  PROPS="output/test-props-s${SESSION}.json"
  if [ ! -f "$PROPS" ]; then
    echo "  ✗ No props — topic may not have session $SESSION. Stopping."
    break
  fi
  SESSIONS_TO_RENDER+=($SESSION)
done

if [ ${#SESSIONS_TO_RENDER[@]} -eq 0 ]; then
  echo ""
  echo "═══ ALL SESSIONS ALREADY RENDERED ═══"
  exit 0
fi

echo ""
echo "═══ PHASE 2: Rendering ${#SESSIONS_TO_RENDER[@]} videos ═══"

for SESSION in "${SESSIONS_TO_RENDER[@]}"; do
  PROPS="output/test-props-s${SESSION}.json"
  OUTPUT="output/${TOPIC}-s${SESSION}.mp4"
  DEST_DIR="$DEST_BASE/session-${SESSION}/long"
  DEST="$DEST_DIR/${TOPIC}-s${SESSION}.mp4"

  echo ""
  echo "  [Render] Session $SESSION..."
  npx remotion render src/compositions/index.tsx LongVideo "$OUTPUT" \
    --props="$PROPS" --concurrency=50% --gl=angle --crf=23 2>&1 | tail -1

  # Copy to Documents
  mkdir -p "$DEST_DIR"
  cp "$OUTPUT" "$DEST"
  rm -f "$OUTPUT"
  SIZE=$(du -h "$DEST" | cut -f1)
  echo "  ✓ Session $SESSION: $DEST ($SIZE)"
done

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  DONE: ${#SESSIONS_TO_RENDER[@]} videos rendered for $TOPIC  "
echo "╚══════════════════════════════════════════════════════════════╝"
