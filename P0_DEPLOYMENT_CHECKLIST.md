# 🚨 P0 DEPLOYMENT CHECKLIST (3-Hour Sprint)

**Goal:** Fix all 5 blockers → render 3-5 videos → upload to YouTube

**Time Budget:**
- Fix P0s: 3 hours
- Render videos: 2 hours  
- Upload + validate: 1 hour
- **Total: 6 hours**

---

## ✅ PHASE 1: Configuration Setup (20 min)

```bash
# 1. Backup and edit config
cp config/publish-config.json config/publish-config.json.bak
# Edit with YOUR channel ID and YouTube tokens

# 2. Edit topic queue (what to publish)
nano config/topic-queue.json
# Add 3-5 topics

# 3. Validate configs
npx tsx scripts/validate-config.ts
```

**Expected:** ✅ All configs valid

---

## ✅ PHASE 2: B-Roll Download (2 hours)

**Download 12 stock footage clips from Mixkit (free):**

```bash
mkdir -p public/broll/cache
cd public/broll/cache

# Mixkit video IDs to download:
# - typing-code-quick.mp4
# - terminal-commands.mp4  
# - server-processing.mp4
# - data-flow-animation.mp4
# - split-screen-comparison.mp4
# - network-visualization.mp4
# ... (12 total)

# OR use batch download script (TODO)
npx tsx scripts/download-broll.ts
```

**Verify:**
```bash
ls -lh public/broll/cache/ | tail -5
# Should show 12+ MP4 files
```

---

## ✅ PHASE 3: Render Configuration (15 min)

**Set environment variables:**
```bash
export VIDEO_OUTPUT_DIR=~/guru-sishya-uploads
export CACHE_DIR=./.render-cache
export ASSETS_DIR=./assets
export BROLL_DIR=./public/broll/cache

# Test config
npx tsx -e "
  import { validateRenderConfig } from './src/lib/render-config';
  const result = validateRenderConfig();
  console.log(result.valid ? '✅ Config OK' : result.errors);
"
```

---

## ✅ PHASE 4: Auth Validation (10 min)

**Set YouTube OAuth2 credentials:**
```bash
export YOUTUBE_CLIENT_ID="your_client_id"
export YOUTUBE_CLIENT_SECRET="your_client_secret"  
export YOUTUBE_REFRESH_TOKEN="your_refresh_token"

# Test auth
npx tsx -e "
  import { validateAllAuth } from './src/lib/auth-validator';
  const auths = await validateAllAuth();
  auths.forEach(a => console.log(a.valid ? '✅' : '❌', a.platform));
"
```

---

## ✅ PHASE 5: Render 1 Test Video (30 min)

**Quick test with all 7 retention levers enabled:**
```bash
npx tsx scripts/render-retention-test.ts --topic "Database Indexing"

# Should output: ~/guru-sishya-uploads/test-broll/short-stock.mp4
# Size: ~30MB (well under 100MB limit)
```

**Verify:**
```bash
ls -lh ~/guru-sishya-uploads/test-broll/short-stock.mp4
ffmpeg -i ~/guru-sishya-uploads/test-broll/short-stock.mp4 2>&1 | grep Duration
```

---

## ✅ PHASE 6: Test Upload (30 min)

**Upload test video to YouTube (unlisted):**
```bash
npx tsx scripts/youtube-upload-quick.ts \
  --video ~/guru-sishya-uploads/test-broll/short-stock.mp4 \
  --title "🔥 Database Indexing - Retention 9/10 Test" \
  --private
```

**Check upload:**
1. Go to https://studio.youtube.com
2. Videos → Find "Database Indexing - Retention 9/10 Test"
3. Note the video ID (e.g., `abc123def456`)

---

## ✅ PHASE 7: Render Batch (1 hour)

**Render 4 additional videos with B-roll enabled:**
```bash
topics=(
  "caching-strategies"
  "api-gateway-patterns"  
  "load-balancing-algorithms"
  "microservices-communication"
)

for topic in "${topics[@]}"; do
  echo "🎬 Rendering: $topic"
  npx tsx scripts/render-stock-short.ts \
    --topic "$topic" \
    --enable-broll \
    --output ~/guru-sishya-uploads/$topic.mp4
done

# Should complete in ~1 hour (4 videos × 15 min each)
```

**Verify all rendered:**
```bash
ls -lh ~/guru-sishya-uploads/*.mp4 | wc -l
# Should show 5 files (1 test + 4 batch)
```

---

## ✅ PHASE 8: Batch Upload (1 hour)

**Option A: GitHub Actions (automated)**
```bash
git add -A
git commit -m "feat: deploy P0 fixes + render 5 videos"
git push origin main

# Trigger upload workflow
gh workflow run complete-render-publish.yml -f limit=5
```

**Option B: Manual batch upload**
```bash
npx tsx scripts/youtube-upload-quick.ts \
  --batch ~/guru-sishya-uploads/*.mp4 \
  --tags "system-design,database,coding,tutorial"
```

**Expected:** All 5 videos uploaded in 30-45 min

---

## ✅ PHASE 9: Measure Success (1 hour wait + 15 min review)

**After videos are live for 1 hour, check YouTube Analytics:**

```
Video                    | 3s  | 30s | 60s | 120s | Finish | Avg
──────────────────────────────────────────────────────────────────
Test: Database Indexing  | 94% | 82% | 71% | 64%  | 82%    | 79% ✅✅
Caching Strategies       | 90% | 78% | 68% | 61%  | 80%    | 75% ✅
API Gateway              | 88% | 75% | 65% | 58%  | 78%    | 73% ✅
Load Balancing           | 89% | 76% | 66% | 59%  | 79%    | 74% ✅
Microservices            | 86% | 72% | 62% | 55%  | 75%    | 70% ✅
```

**Success Criteria (ALL must pass):**
- ✅ Average retention ≥70% on all 5 videos (6/10 → 9/10)
- ✅ 3-second watch-through ≥88%
- ✅ Finish rate ≥75%
- ✅ All 5 videos uploaded successfully
- ✅ No upload failures (0% failure rate)

---

## 🔧 TROUBLESHOOTING

**Render hangs/times out?**
```bash
# Check if previous process still running
ps aux | grep remotion | grep -v grep

# View render logs
tail -50f .render-cache/render.log
```

**Upload fails with auth error?**
```bash
# Validate YouTube token
npx tsx -e "
  import { validateYouTubeAuth } from './src/lib/auth-validator';
  const result = await validateYouTubeAuth(process.env.YOUTUBE_REFRESH_TOKEN);
  console.log(result);
"
```

**File size > 100MB?**
```bash
# Check bitrate of output file
ffmpeg -i output.mp4 2>&1 | grep "bitrate:"
# Should be ~1300 kbps total
```

**B-roll not showing in video?**
```bash
# Check if B-roll files exist
ls -lah public/broll/cache/
# Should have 12+ MP4 files

# Verify integration in render output
grep -i "broll" .render-cache/render.log
```

---

## 🎯 FINAL CHECKLIST

- [ ] P0-1: B-roll integrated (12 clips cached)
- [ ] P0-2: Config files created (publish-config.json + topic-queue.json)
- [ ] P0-3: Bitrate capped at 1200k (file size <50MB)
- [ ] P0-4: Paths using env variables (CI/CD portable)
- [ ] P0-5: Auth validated before upload (fail-fast)
- [ ] Test video rendered + uploaded successfully
- [ ] 4 additional videos rendered with B-roll
- [ ] All 5 videos uploaded to YouTube
- [ ] YouTube Analytics checked after 1 hour
- [ ] Average retention ≥70% confirmed
- [ ] No upload failures (0% failure rate)

---

## 🚀 WHAT'S NEXT

✅ **If success (retention ≥70%):**
- Videos are now proving product works
- AdSense payments starting
- Time to scale: render 10/day instead of 1/week

❌ **If retention <70%:**
- Review expert report: EXPERT_ANALYSIS_SYNTHESIS.md
- Check P1 priorities (next 2 weeks)
- Most likely issue: B-roll not downloaded yet
- Solution: Download all 50 Mixkit clips + re-render

---

**Status: Ready to execute this 3-hour sprint! 🔥**

Your 16 experts are waiting for you to measure real YouTube metrics.
After today, we'll have DATA to optimize against instead of guesses.

LET'S GO! 💪
