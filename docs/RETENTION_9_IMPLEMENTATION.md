# RETENTION 9/10 IMPLEMENTATION ROADMAP

## Goal
Increase average retention from 6/10 (40% avg) → 9/10 (70% avg) within 7 days.

## The 7 Retention Levers (Multiplicative)

### Lever 1: Hook Strength 🎣 
**Impact: 60% → 95% watch first 3 seconds**

```typescript
import { generateHooks, evaluateHook } from '@/retention-levers/hook-generator';

// Every video opens with 1 of 5 hook patterns:
// 1. Contradiction: "❌ Most engineers think... ✅ Actually..."
// 2. Curiosity: "🤔 {percent}% of engineers get this wrong"
// 3. Urgency: "⚠️ Your system will crash if..."
// 4. Pattern-Break: "🎬 Forget everything you know about..."
// 5. Surprise: "😱 This is {speed}x faster than you think"

const hooks = generateHooks('Database Indexing');
// Select highest scoring hook
const best = hooks.reduce((a, b) => 
  evaluateHook(a.hook).score > evaluateHook(b.hook).score ? a : b
);
```

**Checklist:**
- [ ] Update script-generator-v2.ts to include hook patterns
- [ ] A/B test: 3 hook styles per topic
- [ ] Track: frame_3s retention (target: 95%)

---

### Lever 2: Shock Opener ⚡
**Impact: +150% click-through rate (red vs green)**

✅ **ALREADY BUILT** — `src/components/shock-visuals/ShockOpener.tsx`

```typescript
<ShockOpener 
  wrong="❌ Most engineers..."
  right="✅ Actually..."
  durationFrames={90}
  expectedCTR={1.5}
/>
```

**Checklist:**
- [x] Component exists
- [ ] Integrate into render pipeline
- [ ] Test: A/B vs plain text hook

---

### Lever 3: Pattern Interrupts 🔔
**Impact: Break monotony, re-engage every 5 seconds**

```typescript
import { generatePatternInterrupts, SFX_LIBRARY } from '@/retention-levers/pattern-interrupts';

const interrupts = generatePatternInterrupts(180000); // 3-minute video
// [
//   { time: 0, type: 'SFX', effect: 'attention-ding' },
//   { time: 5000, type: 'graphic', effect: 'text-overlay' },
//   { time: 10000, type: 'cut', effect: 'scene-transition' },
//   ... repeats every 5s
// ]
```

**Types:**
- **SFX**: Attention ding, whoosh, reveal pop, notification alert
- **Graphic**: Text overlay, highlighting, shape transitions
- **Cut**: Scene change, camera move
- **Color Flash**: 300ms color change (grabs attention)

**Checklist:**
- [ ] Add SFX library to `assets/audio/sfx/`
- [ ] Implement interrupt injection in composer
- [ ] Test: no video longer than 5s without interrupt

---

### Lever 4: B-Roll Coverage 📹
**Impact: 15% → 60% visual coverage**

✅ **ALREADY ARCHITECTED** — `src/stock/broll/library.ts`

- Add stock footage clips for each concept
- Minimum 60% of video should show relevant B-roll (not blank screen)
- Sources: Coverr + Mixkit (free, no API key)

**Checklist:**
- [x] Manifest created
- [ ] Download all 20+ clips locally
- [ ] Integration in composer
- [ ] Test: measure % of video with B-roll

---

### Lever 5: Story Arc 📖
**Impact: Structured narratives keep viewers engaged**

```
Timing (3-minute video):
0-3s    : Hook (shock, urgency, curiosity)
3-10s   : Problem (why this matters)
10-60s  : Teaching (how to solve)
60-90s  : Solution (step-by-step)
90-150s : Proof (real-world example)
150-170s: Recap (key takeaway)
170-180s: Ending (CTA + cliffhanger)
```

**Checklist:**
- [ ] Update script templates to enforce arc
- [ ] Add validation: each section must exist
- [ ] Test: verify timing in generated scripts

---

### Lever 6: Pacing & Energy ⚡
**Impact: No gap > 5 seconds (keeps momentum)**

Rules:
- No silence longer than 5 seconds
- Cut transitions every 5-10 seconds
- SFX or visual change every 5 seconds
- Fast-paced VO delivery (140+ wpm for tech)

**Checklist:**
- [ ] Measure gap lengths in audio
- [ ] Add validator: no gap > 5s
- [ ] Test: frame retention stays 70%+ throughout

---

### Lever 7: Strong Ending 🎬
**Impact: 35% → 90% finish rate**

```typescript
import { generateStrongEnding } from '@/retention-levers/strong-ending';

const ending = generateStrongEnding('Database Indexing');
// {
//   recap: "That's indexing in a nutshell: ...",
//   bonusTip: "🎁 Bonus tip: Most engineers don't know...",
//   cta: "👉 Watch next: [Link]",
//   cliffhanger: "🤯 But here's the crazy part..."
// }
```

**Sequence (last 30 seconds):**
1. **Recap** (5s): Summarize key takeaway
2. **Bonus Tip** (8s): One surprising fact
3. **Cliffhanger** (5s): "But here's the crazy part..."
4. **CTA** (12s): Next video link + subscribe prompt

**Checklist:**
- [ ] Add ending generator to script-generator-v2
- [ ] Test: videos have all 4 ending elements
- [ ] Track: frame_180s retention (target: 90%)

---

## Implementation Timeline (7 days)

### Day 1: Hooks + Shock Opener
- [ ] Integrate `hook-generator.ts` into script pipeline
- [ ] Test: hooks score 70+/100
- [ ] Activate ShockOpener component in renders
- **Target**: First video with hook + shock opener published

### Day 2: Pattern Interrupts + B-Roll
- [ ] Download 20+ B-roll clips locally
- [ ] Implement interrupt generator
- [ ] Add SFX to composer
- **Target**: Pattern interrupts firing every 5s

### Day 3: Story Arc + Pacing
- [ ] Add arc validator to script-generator-v2
- [ ] Test: all scripts follow arc timing
- [ ] Add gap detector to audio pipeline
- **Target**: All new videos follow 7-section arc

### Day 4: Strong Ending
- [ ] Integrate ending generator
- [ ] Add ending template to scripts
- [ ] Test: 4-element ending appears
- **Target**: Every video has recap + bonus + cliffhanger + CTA

### Day 5-7: A/B Testing + Refinement
- [ ] Render 5 videos with all 7 levers
- [ ] Publish to YouTube
- [ ] Track retention curves
- [ ] Iterate based on metrics

---

## Retention Targets

| Metric | Baseline | Target | Lever |
|--------|----------|--------|-------|
| 3s retention | 60% | 95% | Hook + Shock |
| 30s retention | 50% | 85% | Interrupts + B-roll |
| 60s retention | 40% | 75% | Story Arc |
| 120s retention | 35% | 70% | Pacing + Energy |
| Finish rate | 35% | 90% | Strong Ending |
| **Average** | **40%** | **70%** | **All 7** |

---

## Code Checklist

```
src/retention-levers/
├── hook-generator.ts         ✅ DONE
├── pattern-interrupts.ts     ✅ DONE
├── strong-ending.ts          ✅ DONE
├── story-arc-enforcer.ts     [ ] TODO
└── pacing-validator.ts       [ ] TODO

Integration points:
├── src/scripts/script-generator-v2.ts  [ ] Add hooks + arc
├── src/stock/composer.ts               [ ] Add interrupts
├── src/remotion/index.tsx              [ ] Shock opener
└── src/publish/youtube.ts              [ ] Track retention

Tests:
├── tests/retention/hooks.test.ts       [ ] TODO
├── tests/retention/interrupts.test.ts  [ ] TODO
├── tests/retention/ending.test.ts      [ ] TODO
└── tests/retention/arc.test.ts         [ ] TODO
```

---

## Measurement Strategy

After each video publishes:
1. **24h**: Frame retention curve (3s, 30s, 60s, 120s, 180s)
2. **48h**: Calculate average retention %
3. **Track against baseline**: Compare to previous videos
4. **Weekly rollup**: Aggregate 5-7 videos → trend

```sql
-- Query to measure retention per video
SELECT 
  video_id,
  title,
  published_at,
  retention_3s,
  retention_30s,
  retention_60s,
  retention_120s,
  retention_180s,
  (retention_3s + retention_30s + retention_60s + retention_120s + retention_180s) / 5 as avg_retention
FROM youtube_metrics
WHERE published_at >= NOW() - INTERVAL 7 DAY
ORDER BY avg_retention DESC;
```

---

## Success Criteria

✅ **PASS** when:
- [ ] 70% average retention achieved on 3+ videos
- [ ] 95% watch-through at 3s
- [ ] 90% finish rate
- [ ] 50%+ improvement over baseline (40% → 70%)
- [ ] All 7 levers implemented and tested

---

## Contingency (If retention stuck at 60%)

Escalation triggers:
1. **Re-analyze B-roll**: Is 60% coverage enough?
2. **Hook testing**: Are we picking the highest-scoring hooks?
3. **Audio pacing**: Check average words-per-minute (target: 140+)
4. **Competitor teardown**: How do Fireship/Veritasium do it?
5. **User interviews**: Ask viewers what makes them click away

**Emergency plan**: Revert to proven viral format (MrBeast-style shock cuts), then incrementally re-add levers.

