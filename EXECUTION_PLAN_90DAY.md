# 🚀 90-DAY EXECUTION PLAN (Virality-First Approach)

**Goal:** 6.8/10 → 9.2/10 panel score | $500/month → $10K+/month  
**Start:** Now (5 May 2026)  
**Deadline:** 3 August 2026  
**Critical Path:** B-Roll → Visuals → Credibility → Course → Scale

---

## PHASE 1: VISUAL IMPACT (Week 1-2, Days 1-14)

### Sprint 1.1: B-Roll Dynamics Library (5 days)
**Impact: +300% retention**

**What:**
- Curate 20 evergreen tech/business stock clips
- Create template for per-concept B-roll
- Auto-inject 10-15s footage per teach-block

**Sources:**
- Mixkit.co (free, no attribution)
- Coverr.co (free, no attribution)
- Frame search by topic (Kubernetes → cloud UI footage)

**TDD Before Code:**
```typescript
// tests/broll/library.test.ts
describe('B-Roll Library', () => {
  test('returns 10-15s clips per topic', async () => {
    const clips = await getBrollClips('kubernetes');
    expect(clips.length).toBeGreaterThan(0);
    expect(clips[0].durationSec).toBeGreaterThanOrEqual(10);
    expect(clips[0].durationSec).toBeLessThanOrEqual(15);
  });
  
  test('clips are landscape or portrait', () => {
    const clips = getCachedClips();
    clips.forEach(c => {
      expect(['landscape', 'portrait']).toContain(c.orientation);
    });
  });
});
```

**Deliverables:**
- [ ] `src/stock/manifest.json` (60-80 clips)
- [ ] `src/stock/picker.ts` (selection logic)
- [ ] `src/stock/composer.ts` (ffmpeg integration)
- [ ] Tests passing (TDD-first)
- [ ] 3-5 test videos with B-roll

**Success:** Hook+B-roll videos get 2-3x retention  
**Effort:** 5 days (1 dev + 2 days stock research)

---

### Sprint 1.2: Micro-Shock Visuals (3 days)
**Impact: +150% click-through rate**

**What:**
- First 3 seconds show [WRONG] vs [RIGHT]
- Contradiction creates curiosity
- Side-by-side comparison or flash transition

**Examples:**
- "❌ Most engineers think X | ✅ Actually, Y"
- "❌ 10s animation | ✅ 2x faster with this"
- "❌ Everyone does this | ✅1M engineers do this instead"

**TDD Before Code:**
```typescript
// tests/visuals/shock-opening.test.ts
describe('Micro-Shock Opener', () => {
  test('renders WRONG vs RIGHT comparison', async () => {
    const video = await renderShockOpener({
      wrong: 'Most use REST APIs',
      right: 'Use gRPC instead',
      topic: 'api-patterns'
    });
    expect(video.durationMs).toBe(3000);
    expect(video.hasWrongLabel).toBe(true);
    expect(video.hasRightLabel).toBe(true);
  });
  
  test('shows contradiction in first frame', () => {
    const opener = getFirstFrame();
    expect(opener.hasDualPane).toBe(true); // [WRONG] [RIGHT]
  });
});
```

**Deliverables:**
- [ ] Remotion component for shock opener
- [ ] 5 test variations (different topics)
- [ ] Tests passing
- [ ] Integrated into main video template

**Success:** CTR increases 1.5x (test with 5 videos)  
**Effort:** 3 days

---

## PHASE 2: CREDIBILITY + DEPTH (Week 3-4, Days 15-28)

### Sprint 2.1: Author Credibility Build (3 days)
**Impact: Unlocks sponsorships ($5K/month)**

**What:**
- 30s intro video (face, credentials, win)
- 10+ student testimonials (screenshots/quotes)
- Statistics verification (cite sources)

**Deliverables:**
- [ ] Author intro video (30s)
- [ ] Testimonial graphics (10 slides)
- [ ] Statistics sources doc (linked in all videos)
- [ ] LinkedIn profile updated

**Success:** First sponsorship inquiry within 14 days  
**Effort:** 3 days (partly parallel with other work)

---

### Sprint 2.2: Hook Library (3 days)
**Impact: +2/10 virality → improve to 7.1/10**

**What:**
- Generate 50 hook variations per topic
- Rank by shock value + curiosity gap
- A/B test top 3 with first 5 videos

**Success:** Average retention 8.5/10  
**Effort:** 3 days

---

## PHASE 3: SCALE + COURSE (Week 5-8, Days 29-56)

### Sprint 3.1: War Stories (5 days)
**Impact: +1.5/10 quality (emotional resonance)**

**What:**
- 2-3 min per video: Failure → Learning → Win
- Real project stories (failures are credible)
- Hinglish narration (relatability)

**Success:** Comments increase 2x (engagement signal)  
**Effort:** 5 days

---

### Sprint 3.2: AI Quote Graphics (2 days)
**Impact: +80% LinkedIn shares**

**What:**
- Extract 2-3 key insights per video
- Generate 5-7s quote card at climax
- Design template (minimalist, readable)

**Success:** 2x shares on LinkedIn  
**Effort:** 2 days

---

### Sprint 3.3: Course Launch (15 days)
**Impact: $5K/month recurring revenue**

**What:**
- Curriculum (8 modules, 16 lessons)
- Video recordings (5-7 min each)
- Worksheets + code files
- Price: $49 (launch special) → $99 (regular)

**Success:** 50 sales month 1 → 150 sales by month 3  
**Effort:** 15 days (includes recording + editing)

---

## PHASE 4: GROWTH (Week 9-12, Days 57-90)

### Sprint 4.1: Parallel Rendering (5 days)
**Impact: 10 videos/day capacity (vs 2/day now)**

**What:**
- Render up to 4 videos in parallel
- GHA runners + self-hosted GPU cluster
- Caching for faster reruns

**Success:** Publish 60 videos in month 3 (vs 20)  
**Effort:** 5 days

---

### Sprint 4.2: Growth Hacking (10 days)
**Impact: Organic reach + paid multiplier**

**What:**
- LinkedIn sharing strategy
- Reddit communities (r/webdev, r/Backend, etc)
- Email list (newsletter)
- Telegram channel growth

**Success:** 30K organics → 100K organics  
**Effort:** 10 days (concurrent with other work)

---

### Sprint 4.3: Sponsorship Deals (5 days)
**Impact: $5K/month**

**What:**
- Sponsor pitch deck (1K+ subs proof)
- Outreach to 20 companies
- Close 1-2 deals/month

**Success:** 1-2 deals by end of week 12  
**Effort:** 5 days

---

## 📊 WEEKLY BREAKDOWN

| Week | Focus | P0s | P1s | Effort | Cumulative |
|------|-------|-----|-----|--------|-----------|
| 1-2 | **Visual Impact** | B-roll, Shock visuals | Hook, Cred | 8 days | 8 days |
| 3-4 | **Credibility** | Cred build | Hook lib, War stories start | 6 days | 14 days |
| 5-6 | **War Stories** | War stories, Quote graphics | Course start | 7 days | 21 days |
| 7-8 | **Course Launch** | Course launch | Parallel render start | 15 days | 36 days |
| 9-10 | **Parallel Render** | Parallel render, Growth hacking | Sponsorship outreach | 15 days | 51 days |
| 11-12 | **Scale + Revenue** | Close sponsorships | Growth measurement | 10 days | 61 days |

**Contingency buffer:** 29 days (47% buffer for debugging, testing, iteration)

---

## 💰 REVENUE MILESTONES

| Milestone | Timeline | AdSense | Sponsorship | Course | Total |
|-----------|----------|---------|-------------|--------|-------|
| Day 14 | +B-roll + shock | $200 | $0 | $0 | **$200** |
| Day 28 | +Credibility | $500 | $500 | $0 | **$1,000** |
| Day 42 | +War stories | $1,000 | $2,000 | $500 | **$3,500** |
| Day 56 | +Course live | $2,000 | $3,000 | $1,500 | **$6,500** |
| Day 70 | +Parallel render | $3,500 | $4,000 | $2,500 | **$10,000** |
| Day 90 | Full optimization | $5,000 | $5,000 | $5,000 | **$15,000** |

**Path to $10K: Day 70** (20 days before deadline)

---

## 🎯 MEASUREMENT FRAMEWORK

### Weekly Metrics
- Video views (should 2-3x with B-roll)
- Average retention (target: 7.5/10)
- Click-through rate (target: +150% vs baseline)
- Subscriber growth (target: 2x)
- Comment sentiment (positive %)

### Monthly Metrics
- Revenue (track AdSense, sponsorships, course)
- Panel score (Virality, Monetization, Quality, Technical)
- Course sales (target: 50→150→300)
- Sponsorship inquiries
- Tier ranking (Tier 2 → Tier 1)

---

## ✅ TDD DISCIPLINE

**Rule: Every feature starts with FAILING tests**

1. Write test that fails (WRONG code)
2. Write code to pass test (CORRECT code)
3. Merge + measure impact
4. Iterate based on metrics

**Examples:**
- B-roll: Test expects 10-15s clips → implement provider
- Shock visuals: Test expects 3s duration + dual pane → implement opener
- Course: Test expects 8 modules + 16 lessons → build curriculum

---

## 🚨 CRITICAL SUCCESS FACTORS

1. **B-Roll First** — If delayed, all downstream videos suffer
2. **Shock Visuals Second** — Drives CTR, multiplies reach
3. **Credibility Lock** — Enables sponsorships (highest unit revenue)
4. **Course Readiness** — Must be polished (first sale is critical)
5. **Parallel Render** — Enables volume (10 videos/day vs 2)
6. **Consistent Publishing** — 3-4 videos/week maintains algorithm favor

---

## 🎬 STARTING TOMORROW

**Day 1 Action:**
```bash
npm run dev  # Start local dev
git checkout -b feature/p0-broll-library
mkdir -p src/stock tests/broll
# Write failing tests first
npm run test -- tests/broll/library.test.ts
# Implement to pass tests
npm run test -- --watch
```

**Success = First video with B-roll published by Day 5**

