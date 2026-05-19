#!/bin/bash
# auto-pipeline.sh — FULLY AUTOMATED daily content pipeline
# Zero human involvement. Run via cron daily.
#
# What it does:
#   1. Advances the series day counter
#   2. Renders 2 quiz Shorts (diverse topics, series-branded)
#   3. Checks for trending topics, renders 1 trend Short if found
#   4. Uploads ALL to YouTube
#   5. Generates distribution packages for all platforms
#   6. Logs everything
#
# Crontab (run at 6:30 AM IST = 1:00 UTC):
#   0 1 * * * cd /Users/racit/PersonalProject/video-pipeline && bash scripts/auto-pipeline.sh >> logs/auto-pipeline.log 2>&1
#
# Manual run:
#   bash scripts/auto-pipeline.sh
#   bash scripts/auto-pipeline.sh --dry-run

set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

DRY_RUN=""
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN="--dry-run"

# YouTube credentials — set in environment or .env file
# export YOUTUBE_CLIENT_ID="your-client-id"
# export YOUTUBE_CLIENT_SECRET="your-client-secret"
if [ -f .env ]; then source .env; fi

DATE=$(date +%Y-%m-%d)
DOY=$(date +%j)

mkdir -p logs output/daily-short output/trends

echo "╔══════════════════════════════════════════════╗"
echo "║   AUTO PIPELINE — $DATE                      ║"
echo "╠══════════════════════════════════════════════╣"

UPLOADED=0
FAILED=0

upload_short() {
  local VIDEO="$1"
  local META="$2"
  if [[ -z "$DRY_RUN" && -f "$VIDEO" && -f "$META" ]]; then
    echo "  📤 Uploading..."
    if npx tsx scripts/upload-youtube.ts "$VIDEO" "$META" --shorts 2>&1 | tee -a logs/auto-pipeline.log | grep -q "Upload successful"; then
      UPLOADED=$((UPLOADED + 1))
      echo "  ✅ Uploaded!"
      # Distribute to all platforms
      npx tsx scripts/distribute-short.ts "$VIDEO" 2>&1 | grep "✓" | head -6
    else
      FAILED=$((FAILED + 1))
      echo "  ❌ Upload failed"
    fi
  fi
}

# ─── STEP 1: Get today's quizzes from series tracker ─────────────────────────
echo ""
echo "║ Step 1: Series Quizzes (2 Shorts)             ║"
echo "╠══════════════════════════════════════════════╣"

# Interleave topics: pick from different topic groups each day
# Kafka is 0-11, API Gateway 12-17, LB 18-22, DB 23-27, Microservices 28-32,
# Docker 33-36, K8s 37-40, Redis 41-44, SysDesign 45-49, REST 50-53, Auth 54-57, CICD 58-60
# Pick 2 quizzes from DIFFERENT topics each day
TOPIC_STARTS=(0 12 18 23 28 33 37 41 45 50 54 58)
TOPIC_SIZES=(12 6 5 5 5 4 4 4 5 4 4 3)
TOPIC_1_IDX=$(( DOY % 12 ))
TOPIC_2_IDX=$(( (DOY + 6) % 12 ))  # offset by 6 to ensure different topic
SHORT_1=$(( TOPIC_STARTS[TOPIC_1_IDX] + (DOY / 12) % TOPIC_SIZES[TOPIC_1_IDX] ))
SHORT_2=$(( TOPIC_STARTS[TOPIC_2_IDX] + (DOY / 12) % TOPIC_SIZES[TOPIC_2_IDX] ))

echo "  Quiz #$SHORT_1..."
npx tsx scripts/render-daily-short.ts --short $SHORT_1 $DRY_RUN 2>&1 | grep -E "Title:|Done|Video:" | head -3
VIDEO1=$(ls -t output/daily-short/*.mp4 2>/dev/null | head -1)
META1="${VIDEO1%.mp4}-metadata.json"
upload_short "$VIDEO1" "$META1"

echo ""
echo "  Quiz #$SHORT_2..."
npx tsx scripts/render-daily-short.ts --short $SHORT_2 $DRY_RUN 2>&1 | grep -E "Title:|Done|Video:" | head -3
VIDEO2=$(ls -t output/daily-short/*.mp4 2>/dev/null | head -1)
META2="${VIDEO2%.mp4}-metadata.json"
upload_short "$VIDEO2" "$META2"

# ─── STEP 2: Trend detection + render ────────────────────────────────────────
echo ""
echo "║ Step 2: Trending Topic Short                   ║"
echo "╠══════════════════════════════════════════════╣"

if [[ -z "$DRY_RUN" ]]; then
  echo "  🔍 Scanning HackerNews + Reddit..."
  if npx tsx scripts/trend-detector.ts --render 2>&1 | tee -a logs/auto-pipeline.log | grep -q "Rendered:"; then
    TREND_VIDEO=$(ls -t output/trends/*.mp4 2>/dev/null | head -1)
    TREND_META="${TREND_VIDEO%.mp4}-metadata.json"
    if [[ -f "$TREND_VIDEO" ]]; then
      echo "  🔥 Trending Short rendered!"
      upload_short "$TREND_VIDEO" "$TREND_META"
    fi
  else
    echo "  📭 No trending topics scored high enough today"
  fi
else
  echo "  [DRY RUN] Skipping trend scan"
fi

# ─── SUMMARY ─────────────────────────────────────────────────────────────────
echo ""
echo "╠══════════════════════════════════════════════╣"
echo "║ SUMMARY — $DATE                              ║"
echo "║ Uploaded: $UPLOADED  Failed: $FAILED                       ║"
echo "╚══════════════════════════════════════════════╝"
