#!/bin/bash
# Batch render vertical videos for a topic.
# Usage: bash scripts/batch-render-vertical.sh <topic> [count]
# Example: bash scripts/batch-render-vertical.sh load-balancing 10

TOPIC=$1
COUNT=${2:-10}

if [ -z "$TOPIC" ]; then
  echo "Usage: bash scripts/batch-render-vertical.sh <topic> [count]"
  exit 1
fi

echo "=== Batch Rendering $COUNT Vertical Videos for $TOPIC ==="
echo ""

for i in $(seq 1 $COUNT); do
  echo "--- Session $i of $COUNT ---"
  npx tsx scripts/render-vertical-session.ts "$TOPIC" "$i"
  echo ""
done

echo "=== Done! $COUNT vertical videos rendered for $TOPIC ==="
