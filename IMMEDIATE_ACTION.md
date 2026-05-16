# ⏰ IMMEDIATE ACTION: 3-Hour Sprint

## What You Need to Do RIGHT NOW

### Step 1: Configure YouTube (5 min)
```bash
# Edit config with YOUR details
nano config/publish-config.json

# Fill in:
# - youtube.channelId: YOUR_CHANNEL_ID
# - youtube.authorizedAt: today's date
# Add YouTube OAuth2 tokens when ready
```

### Step 2: Download B-Roll (2 hours)
**Get 50 stock footage clips:**
- Go to: https://mixkit.co/free-stock-video/
- Search: "coding", "terminal", "database", "network", "performance"
- Download to: `public/broll/cache/`
- Should have 50+ MP4 files

### Step 3: Test Render (30 min)
```bash
npx tsx scripts/render-retention-test.ts --topic "Database Indexing"
# Output: ~/guru-sishya-uploads/test.mp4
```

### Step 4: Upload Test (15 min)
```bash
export YOUTUBE_REFRESH_TOKEN="your_token"
export YOUTUBE_CLIENT_ID="your_id"
export YOUTUBE_CLIENT_SECRET="your_secret"

npx tsx scripts/youtube-upload-quick.ts --video ~/guru-sishya-uploads/test.mp4
```

### Step 5: Wait 1 Hour
- Check YouTube Studio
- Go to Analytics
- Look at retention curve
- **Target: ≥70% average**

### Step 6: If Success, Render Batch (1 hour)
```bash
for topic in caching api-gateway load-balancing microservices; do
  npx tsx scripts/render-stock-short.ts --topic $topic --enable-broll
done
```

### Step 7: Upload Batch (30 min)
```bash
gh workflow run complete-render-publish.yml -f limit=4
```

### Step 8: Final Check
- All 5 videos on YouTube ✅
- Retention ≥70% ✅
- Ready to go public ✅

---

## 🎯 SUCCESS CHECKLIST

- [ ] Config file edited (channel ID filled in)
- [ ] B-roll downloaded (50+ clips in public/broll/cache/)
- [ ] Test video rendered successfully
- [ ] Test video uploaded to YouTube
- [ ] Retention checked (≥70%?)
- [ ] 4 batch videos rendered
- [ ] 4 batch videos uploaded
- [ ] All 5 videos visible on your channel

---

## ⏱️ Timeline

| Phase | Task | Time |
|-------|------|------|
| 1 | Configure | 5 min |
| 2 | Download B-roll | 2 hours |
| 3 | Render test | 30 min |
| 4 | Upload test | 15 min |
| 5 | Wait + measure | 1-2 hours |
| 6 | Render batch | 1 hour |
| 7 | Upload batch | 30 min |
| 8 | Final check | 10 min |
| **TOTAL** | **Real Work** | **~4 hours** |

**Total with waiting:** 6-7 hours (mostly background render/upload)

---

## 📚 REFERENCE DOCS

If you get stuck, read these (in order):

1. **EXECUTIVE_BRIEF.md** — What's wrong + why
2. **P0_BLOCKERS_CODE_FIXES.md** — Code solutions
3. **P0_DEPLOYMENT_CHECKLIST.md** — Full step-by-step
4. **RETENTION_9_IMPLEMENTATION.md** — Technical details

All in home directory or repo root.

---

## 🚀 GO!

You have everything. Execute now.

Questions? Check the docs above.

Ready? Start with Step 1! 💪
