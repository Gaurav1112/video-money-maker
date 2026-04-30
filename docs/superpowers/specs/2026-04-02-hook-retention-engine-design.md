# Hook & Retention Engine — Design Spec

**Date:** 2026-04-02
**Status:** Approved, ready for implementation
**Sub-project:** 1 of 4 (Viral Video Converter v2)
**Goal:** Fix the root cause of 100-view videos — hook failure in first 3 seconds + brain tune-out from static visuals. Target: 50%+ retention, 70%+ intro retention.

---

## Problem

Research (10 agents, 200+ sources) identified 5 killers:
1. 5-second countdown intro causes instant scroll (50-60% drop in first 3s)
2. No pattern interrupts — same visual for 20-30s, brain tunes out at 5-8s
3. No curiosity gaps — linear teaching with no "why should I keep watching"
4. 0.5s transitions feel sluggish (Fireship uses 0.07-0.1s hard cuts)
5. Zoom punches are blind (not tied to keywords or content)

## Scope

5 components that transform viewer retention. This is Sub-project 1 — subsequent sub-projects cover captions, audio, and metadata.

---

## 1. Dual Hook System

### What Changes
Replace the 5-second `IntroSlide` (3-2-1 countdown) with a 3-second `HookSlide` that delivers two simultaneous hooks at frame 0.

### `HookSlide` Component
- **Frame 0:** Bold text hook appears (spring pop-in, 48px Inter 800) + SFX impact sound + voice starts immediately
- **Text hook:** Short punchy line on screen — "90% of developers get this wrong" or "This concept = 40 LPA at Google"
- **Spoken hook:** Slightly longer context line injected as the first sentence of scene 1's narration. Starts playing at frame 0, no silence gap.
- **Duration:** `INTRO_DURATION` drops from 150 frames (5s) to 90 frames (3s)
- **Visual:** Dark background (#0C0A15) with saffron text, topic name small in corner, no countdown, no logo animation

### Hook Generator (`src/lib/hook-generator.ts`)

```typescript
interface HookResult {
  textHook: string;   // on-screen (max 8 words)
  spokenHook: string; // narrated (1-2 sentences)
}

function generateHook(
  topic: string,
  sessionNumber: number,
  scenes: Scene[],
): HookResult;
```

**7 hook formulas** (selected by deterministic seed `topic + sessionNumber`):

| Formula | Text Hook Example | Spoken Hook Example |
|---------|------------------|-------------------|
| Contradiction | "This is actually WRONG" | "Everyone says you need microservices for scale. That's wrong for 90% of startups." |
| Stat bomb | "97% get this wrong" | "I asked 100 developers this question. Only 3 got it right." |
| Salary anchor | "8 LPA vs 40 LPA" | "This one concept is the difference between an 8 LPA and a 40 LPA offer." |
| Challenge | "Can you spot the bug?" | "There's a critical flaw in this architecture. See if you can find it before I reveal it." |
| Time promise | "60 seconds to master this" | "In the next 10 minutes, you'll understand how Netflix handles 200 million users." |
| Pain point | "Your API will crash at scale" | "If you're not doing this, your API will crash the moment you hit 10K concurrent users." |
| Authority | "Asked in Google SDE-2 2026" | "This exact question was asked in a Google SDE-2 interview last month." |

**Uniqueness guarantee:**
- Seed = `hash(topic + sessionNumber)` → selects formula index
- No two sessions of the same topic use the same formula
- Template slots (`{concept}`, `{company}`, `{salary}`) are filled from scene content, never hardcoded
- Template bank: 20+ variations per formula, rotated by seed

### SFX at Frame 0
The HookSlide renders an `<Audio>` element directly (not via SfxLayer) at frame 0 for the impact sound:
```tsx
<Audio src={staticFile('audio/sfx/impact.wav')} volume={0.6} />
```
This is a simple fire-and-forget audio — no SyncTimeline integration needed since it plays at the composition start.

### Integration
- `script-generator.ts`: Call `generateHook()` after generating scenes. Prepend `spokenHook` to scene 1's narration.
- `IntroSlide.tsx`: **Keep the file** but refactor its content to become the HookSlide. Rename the component internally but keep the filename as `IntroSlide.tsx` to avoid breaking `ViralShort.tsx` and other compositions that import it. Add a `textHook` prop — when provided, renders hook mode (bold text + SFX); when absent, falls back to the existing countdown behavior for backward compatibility.
- `components/index.ts`: Note that `HookSlide` is already exported as a dangling reference (line 1) — the file `HookSlide.tsx` does NOT exist on disk. Remove this dangling export. The component stays as `IntroSlide` with hook mode.
- `constants.ts`: `INTRO_DURATION = 90` (was 150).
- `storyboard.ts`: Intro scene duration updated to match new constant.

### Files
- Create: `src/lib/hook-generator.ts`
- Modify: `src/components/IntroSlide.tsx` (add hook mode with `textHook` prop, keep backward compat)
- Modify: `src/components/index.ts` (remove dangling `HookSlide` export)
- Modify: `src/pipeline/script-generator.ts` (prepend spoken hook)
- Modify: `src/lib/constants.ts` (`INTRO_DURATION = 90`)

---

## 2. Pattern Interrupt Engine

### What Changes
Replace the blind `ZoomPunchLayer` (same zoom every 3-5s) with a multi-type `PatternInterruptLayer` that rotates through 5 interrupt types every 5-8 seconds, targeted at keywords.

### `PatternInterruptLayer` Component

```typescript
interface PatternInterruptLayerProps {
  wordTimestamps: WordTimestamp[];
  sceneType: SceneType;
  narration: string;
  style: VideoStyle;
  fps: number;
}
```

**5 interrupt types** (round-robin, no two consecutive same type):

| Type | Visual Effect | Duration | Trigger |
|------|--------------|----------|---------|
| `zoom` | Scale 1.0 → 1.12 → 1.0 on content area | 18 frames (0.6s) | Keyword mention in narration |
| `callout` | Key term pops as floating pill label near top | 30 frames (1s) | Technical term or emphasis word |
| `colorPulse` | Background saffron glow overlay at 20% opacity | 9 frames (0.3s) | Interval-based |
| `sfxHit` | Whoosh or pop sound, no visual change | Audio only | Between other visual interrupts |
| `opacityCut` | Brief dip to 92% opacity, simulates hard cut | 3 frames (0.1s) | Interval-based |

**Keyword targeting algorithm:**
1. Scan `narration` for emphasis words (ALL CAPS, 2+ digit numbers, technical terms from a tech-terms dictionary)
2. Map emphasis words to their `wordTimestamps` positions
3. Schedule `zoom` and `callout` interrupts at keyword positions
4. Fill remaining 5-8s intervals with `colorPulse`, `sfxHit`, `opacityCut`
5. Deterministic: same input always produces same interrupt sequence

**Style controls:**
- `educational`: interrupt every 6-8 seconds, 3 types max per scene
- `viral`: interrupt every 4-6 seconds, all 5 types active

### Placement in LongVideo.tsx JSX Tree
Renders as an absolutely-positioned sibling AFTER `renderedScene` and BEFORE `SceneTransitionFlash`, inside the `<AbsoluteFill>` within each `TransitionSeries.Sequence`:
```tsx
<TransitionSeries.Sequence durationInFrames={duration}>
  <AbsoluteFill>
    {renderedScene}
    <PatternInterruptLayer
      wordTimestamps={scene.wordTimestamps || []}
      sceneType={scene.type}
      narration={scene.narration}
      style={style}
      fps={fps}
    />
    {!isFirst && <SceneTransitionFlash ... />}
  </AbsoluteFill>
</TransitionSeries.Sequence>
```

### SFX Hit Audio Rendering
The `sfxHit` interrupt type renders a `<Sequence><Audio>` element directly within the PatternInterruptLayer at the computed trigger frame (simpler than integrating with SfxLayer):
```tsx
<Sequence from={triggerFrame} durationInFrames={sfxDuration(effect)}>
  <Audio src={staticFile(`audio/sfx/${effect}.wav`)} volume={0.4} />
</Sequence>
```

### What Gets Replaced
- `ZoomPunchLayer.tsx` is **deprecated** — its zoom functionality is absorbed into the `zoom` interrupt type
- The `<ZoomPunchLayer>` wrapping in `LongVideo.tsx` is removed
- `zoomInterval` and `zoomScale` fields in `VideoStyle` become unused — mark as deprecated with a comment, don't remove yet

### Files
- Create: `src/components/PatternInterruptLayer.tsx`
- Create: `src/lib/tech-terms.ts` (dictionary of technical terms for keyword detection)
- Deprecate: `src/components/ZoomPunchLayer.tsx`
- Modify: `src/compositions/LongVideo.tsx` (remove ZoomPunchLayer wrapping, add PatternInterruptLayer per scene)
- Modify: `src/components/index.ts` (export PatternInterruptLayer)

---

## 3. Contradiction-Based Open Loops

### What Changes
Auto-inject "everyone says X, that's actually wrong" contradiction statements into earlier scenes, with fact-based resolutions in later scenes. Drives 32% higher watch time via the Zeigarnik Effect.

### Open Loop Generator (`src/lib/open-loops.ts`)

```typescript
interface OpenLoop {
  contradictionLine: string;  // appended to earlier scene narration
  resolutionLine: string;     // prepended to target scene narration
  plantSceneIndex: number;    // where the tease goes
  targetSceneIndex: number;   // where the reveal goes
}

function generateOpenLoops(
  scenes: Scene[],
  topic: string,
  sessionNumber: number,
): OpenLoop[];
```

**Algorithm:**
1. Scan scenes for high-value targets: `code`, `interview`, `review`, `summary` types (these have "reveal" moments — code shows implementation, interview has insider tips, review has quiz answers, summary has takeaways. Excluded: `title` is intro-only, `text` is explanation without reveal, `diagram`/`table` are visual aids without narrative payoff)
2. For each target at index N, select a plant scene at index N-3 to N-5 (1-2 minutes before)
3. Maximum 3 open loops per video (more = confusing)
4. Generate contradiction + resolution pair from template bank

**4 contradiction patterns:**

| Pattern | Planted Line | Resolution Line |
|---------|-------------|----------------|
| "Everyone says X, but..." | "Everyone says {concept} is the answer. That's actually wrong for {qualifier}..." | "Here's the proof — {fact_with_example}." |
| "Your professor lied" | "What your textbook says about {concept} is outdated — the real approach is coming up..." | "{concept_v2} is what {company} actually runs. Here's how." |
| "The opposite is true" | "Most developers think {common_belief}. It can actually make things WORSE..." | "{why_it_fails}. This is what separates {low_salary} answers from {high_salary} answers." |
| "Nobody tells you this" | "There's one thing about {topic} that nobody mentions in tutorials — and it's the thing interviewers test..." | "It's {hidden_concept}. And this is exactly how to explain it in an interview." |

**Uniqueness guarantees:**
- Seed = `hash(topic + sessionNumber + targetSceneIndex)` → selects pattern index
- No two scenes within one video use the same pattern
- No two sessions of the same topic use the same contradiction line for the same scene position
- Template bank: 20+ contradiction templates per topic category (system-design, dsa, databases, networking, api, caching)
- `{concept}`, `{qualifier}`, `{company}`, `{salary}` slots are filled from the target scene's actual content (heading, bullets, narration keywords), never hardcoded strings
- Resolution lines pull facts from the scene's narration, making them content-derived and unique per scene

**Topic category detection:**
- Topic slug is mapped to a category: "api-gateway" → `api`, "load-balancing" → `system-design`, "caching" → `caching`, etc.
- Fallback: `general` category with universal templates

### Integration
- Called in `script-generator.ts` after all scenes are generated, before TTS
- `injectOpenLoops(scenes, topic, sessionNumber)` → returns modified scenes with injected narration lines
- The injected lines become part of the TTS narration — spoken naturally by PrabhatNeural
- No changes to audio pipeline or storyboard — it's purely narration text modification

### Files
- Create: `src/lib/open-loops.ts`
- Create: `src/lib/topic-categories.ts` (topic slug → category mapping)
- Modify: `src/pipeline/script-generator.ts` (call `generateOpenLoops` + inject into scene narrations)

---

## 4. Style-Driven Transition Speed

### What Changes
Replace the global `TRANSITION_DURATION = 15` (0.5s) with style-driven speeds: fast by default, slow for dramatic scene pairs.

### VideoStyle Additions

```typescript
// Added to VideoStyle in video-styles.ts
transitionDuration: number;         // default: educational=8 (0.27s), viral=3 (0.1s)
dramaticTransitionDuration: number; // educational=15 (0.5s), viral=8 (0.27s)
```

### Dramatic Scene Pairs
These transitions get the slower `dramaticTransitionDuration`:
- `title` → first content scene (opening reveal)
- any scene → `review` (quiz buildup)
- `review` → `summary` (answer wrap-up)

All other transitions use the fast `transitionDuration`.

### Helper Function

```typescript
function getTransitionDuration(
  prevSceneType: SceneType | null,
  currSceneType: SceneType,
  style: VideoStyle,
): number;
```

Returns `dramaticTransitionDuration` for dramatic pairs, `transitionDuration` otherwise.

### Storyboard Math Impact
The timing math in `storyboard.ts` uses `TRANSITION_DURATION` in **3 places** (lines 97, 100, 105 approximately). All 3 must use per-transition duration:

**Case 1 — next offset exists (line ~97):**
```typescript
const prevType = i > 0 ? scenes[i - 1].type : 'title';
const transDuration = getTransitionDuration(prevType, scene.type, style);
durationFrames = TIMING.secondsToFrames(nextOffset - offset) + transDuration;
```

**Case 2 — last scene with audio (line ~100):**
```typescript
// No next scene → use default transitionDuration (not dramatic)
durationFrames = TIMING.secondsToFrames(audio.duration + 1.0) + style.transitionDuration;
```

**Case 3 — no audio fallback (line ~105):**
```typescript
// No audio → use default transitionDuration
durationFrames = TIMING.secondsToFrames(durationSeconds) + style.transitionDuration;
```

Cases 2 and 3 use the style's default `transitionDuration` (not dramatic) because there's no "next scene type" to form a dramatic pair.

The `getTransitionDuration` helper is imported from `video-styles.ts` and used in both `storyboard.ts` (timing math) and `LongVideo.tsx` (transition rendering). The `storyboard.ts` `generateStoryboard` function needs a `style` parameter added to its `StoryboardOptions` interface.

### LongVideo.tsx Changes
The `linearTiming({ durationInFrames: TRANSITION_DURATION })` call in the TransitionSeries (around line 429) must use the per-pair duration:

```typescript
const transDuration = getTransitionDuration(
  idx > 0 ? contentScenes[idx - 1].type : 'title',
  scene.type,
  style,
);
// ...
timing={linearTiming({ durationInFrames: transDuration })}
```

### Files
- Modify: `src/lib/video-styles.ts` (add fields + helper function + update EDUCATIONAL/VIRAL presets)
- Modify: `src/pipeline/storyboard.ts` (per-transition duration in timing math)
- Modify: `src/compositions/LongVideo.tsx` (per-transition duration in TransitionSeries)
- Modify: `src/lib/constants.ts` (`TRANSITION_DURATION` becomes fallback only, add comment)

---

## 5. TTS Pacing Overhaul — Make Audio Energetic

### Problem
Current TTS rate is `-5%` globally (142 WPM) — too slow and monotone. Research says:
- Below 120 WPM → brain wanders, fills gaps with unrelated thoughts
- 140-160 WPM → optimal retention for education
- 170-200 WPM → best for hooks and energy bursts
- Monotone delivery → 40-80% lower retention vs varied pacing

The current `rateMap` from makeover v1 is too conservative:
```
title: +15%, text: +0%, code: -5%, summary: +10%
```

### Fix: Aggressive Dynamic Pacing

Update the `EDUCATIONAL` style `ttsRate` in `video-styles.ts`:

| Scene Type | Old Rate | New Rate | WPM | Rationale |
|-----------|----------|----------|-----|-----------|
| title (hook) | +15% | **+20%** | ~180 | Hook MUST feel urgent, fast energy |
| text | +0% | **+5%** | ~157 | Slightly faster than neutral — keeps momentum |
| code | -5% | **-8%** | ~138 | Slow for comprehension but not sluggish |
| diagram | -5% | **+0%** | ~150 | Diagrams have visual support, no need to crawl |
| table | +0% | **+5%** | ~157 | Comparisons should flow |
| interview | +5% | **+10%** | ~165 | Conversational energy, like a real mentor |
| review | +0% | **+8%** | ~162 | Quiz should feel exciting, not sleepy |
| summary | +10% | **+15%** | ~172 | Wrap-up energy, drive to CTA |

**Key change:** Nothing is at `+0%` or `-5%` anymore. Every scene type has intentional energy. The slowest scene (`code` at -8%) is still 138 WPM — well above the 120 WPM danger zone.

### Viral Style Gets Even Faster

| Scene Type | Rate | WPM |
|-----------|------|-----|
| title (hook) | +25% | ~187 |
| text | +12% | ~168 |
| code | +0% | ~150 |
| interview | +15% | ~172 |
| review | +12% | ~168 |
| summary | +20% | ~180 |

### Edge TTS Pitch Warmth
Add `--pitch=+2Hz` to the `edgeTTS()` CLI args array in `tts-engine.ts`, right after the `--rate` flag (around line 244). This does NOT affect VTT subtitle generation — pitch changes only modify the audio output, not timing. Example:
```typescript
execFileSync('python3', [
  '-m', 'edge_tts',
  '--voice', voice,
  `--rate=${rate}`,
  '--pitch=+2Hz',        // Warmer tone
  '--text', cleanText,
  '--write-media', audioPath,
  '--write-subtitles', vttPath,
], { timeout: 120000 });
```

### Punctuation-Driven Micro-Pauses
Edge TTS doesn't support SSML `<break>` tags, but it respects punctuation. Update `preprocessForSpeech()` in `tts-engine.ts`:
- Add comma before "but", "however", "actually" → natural pause before contradictions
- Convert "..." to ", " (already done)
- Add period + space between stacked sentences to create breathing room
- Add dash before reveal words: "and the answer is — consistent hashing" → micro-pause before the reveal

### Files
- Modify: `src/lib/video-styles.ts` (update EDUCATIONAL + VIRAL `ttsRate` values)
- Modify: `src/pipeline/tts-engine.ts` (add `--pitch=+2Hz` to edgeTTS call)
- Modify: `src/pipeline/tts-engine.ts` (`preprocessForSpeech` — punctuation tricks for pauses)

---

## File Change Summary

### New Files (4)
| File | Purpose |
|------|---------|
| `src/lib/hook-generator.ts` | 7 hook formulas, deterministic selection, content-aware slots |
| `src/components/PatternInterruptLayer.tsx` | 5 interrupt types, keyword-targeted, round-robin |
| `src/lib/open-loops.ts` | Contradiction-based open loops, 4 patterns, content-derived |
| `src/lib/topic-categories.ts` | Topic slug → category mapping for template selection |

### Modified Files (8)
| File | Changes |
|------|---------|
| `src/components/IntroSlide.tsx` | Add hook mode (textHook prop), keep backward compat |
| `src/pipeline/script-generator.ts` | Prepend spoken hook, inject open loops after scene generation |
| `src/lib/constants.ts` | `INTRO_DURATION = 90`, `TRANSITION_DURATION` becomes fallback |
| `src/lib/video-styles.ts` | Add transition fields, update ttsRate to aggressive pacing, helper |
| `src/compositions/LongVideo.tsx` | Remove ZoomPunchLayer, add PatternInterruptLayer, per-transition duration |
| `src/pipeline/storyboard.ts` | Per-transition duration in timing math |
| `src/pipeline/tts-engine.ts` | Add `--pitch=+2Hz`, update `preprocessForSpeech` punctuation tricks |
| `src/components/index.ts` | Export PatternInterruptLayer, remove dangling HookSlide export |

### Deprecated Files (1)
| File | Reason |
|------|--------|
| `src/components/ZoomPunchLayer.tsx` | Absorbed by PatternInterruptLayer |

### Optional New File (1)
| File | Purpose |
|------|---------|
| `src/lib/tech-terms.ts` | Dictionary of tech terms for keyword detection in interrupts |

**Total: 4 new + 8 modified + 1 deprecated**

---

## Priority Order

1. **P0:** Hook System (#1) — fixes the 3-second drop-off (root cause of 100 views)
2. **P0:** TTS Pacing (#5) — fixes sluggish audio that loses viewers
3. **P1:** Pattern Interrupts (#2) — fixes mid-video attention loss
4. **P1:** Transition Speed (#4) — quick win, mostly config changes
5. **P2:** Open Loops (#3) — retention uplift, depends on script generator understanding

---

## Success Criteria

- [ ] No countdown intro — video starts with bold text hook + voice at frame 0
- [ ] Pattern interrupt fires every 5-8 seconds with 5 different types
- [ ] No two consecutive interrupts are the same type
- [ ] Keywords (ALL CAPS, numbers, tech terms) trigger zoom + callout interrupts
- [ ] 2-3 contradiction-based open loops per video, all unique per session
- [ ] Transitions are 0.27s (educational) / 0.1s (viral) with 0.5s / 0.27s for dramatic pairs
- [ ] No two videos from the pipeline share the same hook line or contradiction line
- [ ] TTS rate is +5% to +20% on all scene types (no +0% or negative except code at -8%)
- [ ] Voice has warmer pitch (+2Hz)
- [ ] Punctuation tricks add natural pauses before contradictions and reveals
- [ ] All changes are backward-compatible — existing storyboard JSON still renders
