#!/bin/bash
set -e
cd /Users/racit/PersonalProject/video-pipeline

TOPICS=("caching:Caching" "database-design:Database Design" "api-gateway:API Gateway")

for entry in "${TOPICS[@]}"; do
  IFS=':' read -r SLUG NAME <<< "$entry"
  echo "========================================"
  echo "TOPIC: $NAME ($SLUG)"
  echo "========================================"

  for SESSION in $(seq 1 10); do
    echo ""
    echo "--- $NAME Session $SESSION / 10 ---"

    # Create folders
    mkdir -p ~/Documents/guru-sishya/$SLUG/session-$SESSION/{long,shorts,reels}

    # 1. Generate storyboard + TTS
    echo "[1/4] Generating storyboard..."
    npx tsx scripts/render-session.ts "$SLUG" "$SESSION" 2>&1 | tail -3

    # 2. Render long video
    echo "[2/4] Rendering long video..."
    npx remotion render src/compositions/index.tsx LongVideo \
      "output/${SLUG}-s${SESSION}.mp4" \
      --props="output/test-props-s${SESSION}.json" \
      --concurrency=6 2>&1 | tail -1

    # 3. Copy to Documents
    if [ -f "output/${SLUG}-s${SESSION}.mp4" ]; then
      cp "output/${SLUG}-s${SESSION}.mp4" ~/Documents/guru-sishya/$SLUG/session-$SESSION/long/
      SIZE=$(du -h "output/${SLUG}-s${SESSION}.mp4" | cut -f1)
      echo "  ✅ Long: $SIZE"
    else
      echo "  ❌ Long video failed"
      continue
    fi

    # 4. Render shorts + reels
    echo "[4/4] Rendering shorts..."
    npm run render:shorts -- --topic "$NAME" --session "$SESSION" \
      --props "output/test-props-s${SESSION}.json" 2>&1 | grep -E "✅|❌|Done"

    echo "=== $NAME S$SESSION DONE ==="
  done

  echo ""
  echo "========== $NAME COMPLETE =========="
done

echo ""
echo "🏁 ALL 30 SESSIONS COMPLETE!"
find ~/Documents/guru-sishya/ -name "*.mp4" | wc -l
echo "total videos"
