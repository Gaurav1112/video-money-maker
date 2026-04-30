# GOD-LEVEL Animations, Promotion & Video Pipeline Upgrade

**Date:** 2026-03-29
**Status:** Approved
**Scope:** Video pipeline animation system, website promotion, speed reminder, re-render all videos

---

## 1. Progressive Disclosure Animation System

**Problem:** Diagrams appear all at once — cognitive overload.
**Solution:** Every viz component builds element-by-element, synced to narration via word timestamps.

### Implementation
- Add `progressiveReveal` prop to all 12 viz components (TrafficFlow, DatabaseViz, CacheViz, etc.)
- Use `SyncTimeline.getSyncState()` to determine `sceneProgress` (0-1)
- Map progress thresholds to element visibility:
  - 0-0.2: First element (e.g., client)
  - 0.2-0.4: Second element (e.g., load balancer)
  - 0.4-0.6: Third element (e.g., servers)
  - 0.6-0.8: Connections/arrows
  - 0.8-1.0: Labels/metrics
- Each element uses `spring()` entrance animation when its threshold is reached
- Elements that haven't reached threshold: `opacity: 0, scale: 0`

### Files Modified
- `src/components/viz/TrafficFlow.tsx`
- `src/components/viz/DatabaseViz.tsx`
- `src/components/viz/CacheViz.tsx`
- `src/components/viz/HashTableViz.tsx`
- `src/components/viz/TreeViz.tsx`
- `src/components/viz/GraphViz.tsx`
- `src/components/viz/QueueViz.tsx`
- `src/components/viz/SortingViz.tsx`
- `src/components/viz/SystemArchViz.tsx`

---

## 2. Code Spotlight with Line-by-Line Reveal

**Problem:** Code appears in chunks. Narrator says "set up the next step" without explaining.
**Solution:** Lines appear one-by-one with spotlight on active line.

### Implementation
- Modify `src/components/CodeReveal.tsx`:
  - Calculate `linesPerBeat = totalLines / sceneDuration`
  - Active line: full opacity, saffron left border, slight scale(1.02)
  - Previous lines: 40% opacity (dimmed)
  - Future lines: hidden (opacity 0)
  - Smooth spring transition between lines
- Syntax highlighting colors: saffron for keywords, teal for strings, gold for numbers, indigo for comments

### Files Modified
- `src/components/CodeReveal.tsx`

---

## 3. Component Pulse-on-Mention

**Problem:** Viz is static while narrator talks about specific components.
**Solution:** When narrator says a keyword, the matching component pulses/glows.

### Implementation
- New hook: `usePulseOnMention(wordTimestamps, keywordMap)` in `src/hooks/usePulseOnMention.ts`
- `keywordMap`: maps keywords to component IDs (e.g., "cache" -> "cache-node", "database" -> "db-node")
- Returns `{ activeComponent: string | null, pulseIntensity: number }`
- Viz components check if their ID matches `activeComponent` and apply glow effect:
  - `boxShadow: 0 0 ${20 * intensity}px ${componentColor}`
  - `scale: 1 + 0.05 * intensity`
  - 500ms spring decay

### Files Created
- `src/hooks/usePulseOnMention.ts`

### Files Modified
- All viz components (add pulse support)

---

## 4. Speed Reminder Overlay (4x per video)

**Problem:** Viewers don't know they can watch at 1.5x speed.
**Solution:** Non-intrusive overlay reminding viewers at 4 strategic points.

### Implementation
- New component: `src/components/SpeedReminder.tsx`
- Placements (% of total video duration):
  1. **15%**: "Pro tip: This video is designed for 1.5x speed"
  2. **35%**: "Watching at 1.5x? You're learning faster than 90% of viewers"
  3. **55%**: "1.5x speed saves you time without missing anything"
  4. **75%**: "Still on 1x? Try 1.5x -- you'll be surprised!"
- Visual: Pill-shaped, slides from top-right, 3-second duration (90 frames)
- Style: Glass morphism, saffron accent, lightning bolt icon
- Narration: Verbal mention on placements #1 and #3 only (inject into scene narration at those points)

### Files Created
- `src/components/SpeedReminder.tsx`

### Files Modified
- `src/compositions/LongVideo.tsx` (render SpeedReminder at 4 timestamps)
- `src/pipeline/script-generator.ts` (inject speed verbal mentions at 15% and 55%)

---

## 5. GOD-LEVEL Promotion System

### A. Three-Point CTA with Topic-Specific Deep Links

**Current:** Generic "guru-sishya.in" mentions.
**New:** Topic-specific URLs + optimized CTA timing.

- CTA 1 (~10%): Lower-third banner "Full notes at guru-sishya.in/{topic-slug}" (3s)
- CTA 2 (~50%): Mid-video card with platform preview mockup (5s, already exists — enhance)
- CTA 3 (last 10s): Enhanced end screen (already exists — enhance)

### B. Platform Preview Overlay

- New component: `src/components/PlatformPreview.tsx`
- Animated mockup showing guru-sishya.in quiz interface for the current topic
- Stat counter animation: "1,988 questions" counting up
- "Try it FREE" badge with pulse

### C. Social Proof Counter

- Add to BrandingLayer: animated "10,000+ engineers practicing" text at scene transitions
- "141 topics | 1,988 questions | FREE" in end card

### D. Enhanced Metadata

- First 2 lines of YouTube description: value hook + topic-specific CTA link
- Pinned comment template with deep link
- Community post template

### Files Created
- `src/components/PlatformPreview.tsx`

### Files Modified
- `src/components/BrandingLayer.tsx` (topic-specific URLs, lower-third CTA, social proof)
- `src/pipeline/metadata-generator.ts` (description optimization, pinned comment template)
- `src/pipeline/script-generator.ts` (topic-specific URLs in narration CTAs)

---

## 6. Before/After Split Screen

**For optimization/comparison scenes** (e.g., "without load balancing" vs "with").

### Implementation
- New component: `src/components/BeforeAfterSplit.tsx`
- Left panel: "Before" state (red accent, slow particles, bottleneck viz)
- Right panel: "After" state (green accent, fast particles, smooth flow)
- Divider line with label: "vs"
- Used for scenes where narration contains comparison keywords

### Files Created
- `src/components/BeforeAfterSplit.tsx`

### Files Modified
- `src/compositions/LongVideo.tsx` (render BeforeAfterSplit for comparison scenes)
- `src/pipeline/script-generator.ts` (detect comparison scenes, set scene.layout = 'split')

---

## 7. Multi-Panel DSA View

**For algorithm visualization scenes** (sorting, tree traversal, graph traversal).

### Implementation
- New component: `src/components/AlgorithmPanel.tsx`
- 3-panel layout:
  - Left (40%): Algorithm visualization (existing viz components)
  - Top-right (30%): Pseudocode with highlighted active line
  - Bottom-right (30%): Variable state tracker
- Pseudocode extracted from scene content or generated from code
- Variable state updates synced to animation progress

### Files Created
- `src/components/AlgorithmPanel.tsx`

### Files Modified
- `src/compositions/LongVideo.tsx` (use AlgorithmPanel for DSA scenes)

---

## 8. Delete Old Videos & Re-render All Topics

1. Delete all files in `/output/` except metadata templates
2. Re-render all topics from content/ directory
3. Render in parallel using concurrent Remotion processes
4. Update `upload-guide.html` with new video list and features

---

## Architecture Notes

- All new components use Remotion `spring()` for natural motion
- All animations are frame-driven via `useCurrentFrame()` (not CSS animations)
- Progressive disclosure uses `sceneProgress` from SyncTimeline
- Pulse-on-mention uses word timestamps from TTS engine
- Speed reminders are overlays on the main composition (not separate scenes)
- Topic slug derived from topic name: `topic.toLowerCase().replace(/\s+/g, '-')`
