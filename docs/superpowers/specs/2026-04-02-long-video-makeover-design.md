# Long Video Makeover — Design Spec

**Date:** 2026-04-02
**Status:** Approved, ready for implementation
**Goal:** Transform pipeline from 7.5/10 → 9/10 viral-grade quality
**Style:** Style C (Hybrid) — `educational` for long-form, `viral` for shorts

---

## Problem

Videos get ~100 views. Instagram algorithm tests 100-200 people, they scroll past. Root cause: hook failure in first 2 seconds, content feels like "lecture not entertainment." Research (12 agents) shows Fireship-style pacing + Hormozi-style captions = the formula.

## Scope

This spec covers **Sub-project 1 of 3: Long Video Makeover** — 10 components that transform LongVideo.tsx and its supporting layers. Sub-projects 2 (Viral Shorts) and 3 (Metadata Engine) are separate specs.

---

## 1. VideoStyle Config (`src/lib/video-styles.ts`) — NEW FILE

Central style registry that drives all other components. Two modes:

```typescript
interface VideoStyle {
  id: 'educational' | 'viral';
  ttsRate: Record<SceneType, string>;  // e.g. { title: '+15%', code: '-5%', text: '+0%' }
  captionMode: 'fireship' | 'hormozi';
  zoomInterval: [number, number];       // seconds: [3, 5] for educational, [1.5, 3] for viral
  zoomScale: number;                    // 1.15 for educational, 1.25 for viral
  transitionPool: TransitionType[];
  bgmVolume: number;                    // 0.12-0.15
  bgmChangeInterval: number;           // seconds between track changes
  sfxDensity: 'sparse' | 'dense';
}
```

**Educational style** (long-form): 150-160 WPM, zoom every 3-5s at 1.15x, Fireship-clean captions, varied transitions, lo-fi BGM at 12%, sparse SFX.

**Viral style** (shorts): 200-220 WPM, zoom every 1.5-3s at 1.25x, Hormozi bounce captions, hard cuts, aggressive SFX.

**Auto-selector:** `getStyleForFormat(format: VideoFormat): VideoStyle` — returns `educational` for `long`, `viral` for `short`.

**Files:** Create `src/lib/video-styles.ts`.

## 2. ZoomPunchLayer (`src/components/ZoomPunchLayer.tsx`) — NEW FILE

Auto-zoom overlay that adds subtle visual motion every few seconds, preventing static-frame syndrome.

**Behavior:**
- Wraps child content in a `scale()` transform
- Every `zoomInterval` seconds, spring-animate scale from 1.0 → `zoomScale` → 1.0
- Duration of each punch: 0.8s (24 frames)
- Uses `interpolate()` with `Easing.bezier()` for guaranteed 24-frame timing (springs may not settle in 24 frames)
- Only zooms during content scenes (not intro/outro)

**Props:**
```typescript
interface ZoomPunchLayerProps {
  children: React.ReactNode;
  intervalRange: [number, number];  // [3, 5] seconds
  scale: number;                    // 1.15
  fps: number;
}
```

**Implementation:** Use `useCurrentFrame()` to deterministically compute zoom trigger frames. No randomness — same input always produces same output (Remotion requirement).

**Placement in LongVideo.tsx:** Wrap the `<Sequence from={INTRO_DURATION} durationInFrames={contentFrames}>` element (NOT individual `TransitionSeries.Sequence` children). The zoom applies to the entire content area including transitions, which is the desired behavior. `TransitionSeries` manages absolute positioning internally, so wrapping individual children would break crossfades.

**Files:** Create `src/components/ZoomPunchLayer.tsx`. Wire into `LongVideo.tsx`.

## 3. Dynamic TTS Pacing (`src/pipeline/tts-engine.ts`) — MODIFY

**P0 BLOCKER.** Currently `--rate=-5%` is hardcoded at line 244. Need per-scene rate control.

**Changes:**
- Add `rate` parameter to `edgeTTS()` function signature: `rate?: string` (default `'-5%'`)
- Thread rate through the actual call chain: `generateSceneAudios()` → `generateAudio()` → `edgeTTS()`
- The caller of `generateSceneAudios()` resolves rates per-scene from `VideoStyle.ttsRate[scene.type]` and passes them in, keeping tts-engine decoupled from video style concerns
- **Cache key must include rate** — update the hash in `edgeTTS()` to: `crypto.createHash('sha256').update(text + voice + voiceLanguage + rate).digest('hex')`. Without this, different rates for the same text return stale cached audio (data corruption bug)

**Rate map (educational):**
| Scene Type | Rate | Rationale |
|-----------|------|-----------|
| title | +15% | Hook — fast energy |
| text | +0% | Normal teaching pace |
| code | -5% | Slow for comprehension |
| diagram | -5% | Visual needs time |
| table | +0% | Normal |
| interview | +5% | Conversational energy |
| review | +0% | Quiz — clear pace |
| summary | +10% | Wrap-up energy |

**Files:** Modify `src/pipeline/tts-engine.ts` (add rate param to `edgeTTS()` and `generateAudio()`, update cache key). The rate lookup happens at the call site of `generateSceneAudios()`, not in `audio-stitcher.ts` (which only concatenates MP3s via ffmpeg).

## 4. Caption Modes (`src/components/CaptionOverlay.tsx`) — MODIFY

**P1 BLOCKER.** Current captions are one style only. Need two switchable modes.

### Fireship Mode (default for long-form)
- Clean monospace font (JetBrains Mono or Source Code Pro)
- White text on semi-transparent dark pill background
- Active word: saffron highlight, no bounce
- 2-line max, centered at bottom 15%
- Fade transitions between sentence groups

### Hormozi Mode (for shorts)
- Bold sans-serif (Inter 800)
- Full-width colored background bar
- Active word: scale 1.3x + spring bounce + color pop
- 1-3 word groups (NOT the 8-14 word groups used in fireship mode)
- Slam-in animation (translateY -20px → 0 with spring)

**Implementation notes:**
- Hormozi mode requires a **separate rendering branch**, not just CSS changes. The word grouping logic (`buildSentenceGroups`) must accept a `maxWords` parameter: 14 for fireship, 3 for hormozi
- The existing `isEmphasis` and `isBreakPoint` helpers apply to both modes
- Hormozi's "full-width colored background bar" replaces the dark-pill container — use a conditional render path based on mode

**Props addition:**
```typescript
captionMode?: 'fireship' | 'hormozi';
```

**Files:** Modify `src/components/CaptionOverlay.tsx`. The mode prop flows from `LongVideo.tsx` which reads it from `VideoStyle`.

## 5. Sub-Scene Splitting (`src/lib/sub-scene-splitter.ts`) — NEW FILE

Utility for viral shorts — splits long scenes into 2-4 second beats for faster pacing.

**Algorithm:**
1. Take a scene's narration + word timestamps
2. Find natural break points (sentence boundaries, commas, conjunctions)
3. Group words into sub-scenes of 2-4 seconds each
4. Return array of `SubScene` with start/end times and text

```typescript
interface SubScene {
  text: string;
  startTime: number;  // seconds
  endTime: number;
  wordTimestamps: WordTimestamp[];
}

function splitIntoSubScenes(
  narration: string,
  wordTimestamps: WordTimestamp[],
  targetDuration: [number, number],  // [2, 4] seconds
): SubScene[];
```

**Note:** This is primarily for Sub-project 2 (Viral Shorts) but building it now keeps the architecture clean. Long videos don't use sub-scenes.

**Files:** Create `src/lib/sub-scene-splitter.ts`.

## 6. Transition Variety (`src/components/SceneTransitionFlash.tsx` + `LongVideo.tsx`) — MODIFY

**P1 BLOCKER.** Current `getTransitionForScene()` in LongVideo.tsx is deterministic per scene type — every `code` scene gets `slide(from-right)`, every `text` gets `fade()`. After 12 scenes it feels repetitive.

**Changes to LongVideo.tsx `getTransitionForScene()`:**
- Accept scene index as second parameter
- Rotate through transition pool based on scene index: `pool[index % pool.length]`
- Educational pool: `[fade, slide-right, wipe-left, slide-bottom, fade, slide-left, wipe-right, slide-top]`
- Scene-type still influences selection but doesn't lock it

**New transitions to add:**
- `clockWipe` — circular reveal (custom implementation using clip-path `conic-gradient`)
- `iris` — circular iris from center (clip-path circle)
- `flip` — 3D card flip (perspective + rotateY)

These 3 are custom `TransitionPresentation` implementations in a new file `src/components/transitions.ts`. Each must implement the `TransitionPresentation` interface with `Slide` and `Overlay` components.

**Note:** `flip` uses `perspective + rotateY` — test with Remotion's headless Chrome renderer, as some 3D CSS transforms may not render correctly in PNG-based screenshot mode. If `flip` causes artifacts, fall back to a 2D scale-flip approximation (scaleX 1→0→1).

**Files:** Create `src/components/transitions.ts`. Modify `src/compositions/LongVideo.tsx` (`getTransitionForScene`).

## 7. BGM Mixing (`src/components/BgmLayer.tsx`) — MODIFY

Current BgmLayer works but is basic — single track, fixed volume. Upgrade:

**Changes:**
- Accept `trackChangeInterval` prop (default 120s = 2 min)
- Accept `tracks` array prop (list of BGM file paths)
- Volume from `VideoStyle.bgmVolume` (0.12-0.15 range)
- Track selection: rotate through `tracks` array by index

**Remotion-compatible crossfade approach:** Cannot dynamically switch `<Audio>` src mid-render. Instead, pre-compute track segments as an array of `{ trackFile, startFrame, endFrame }` in a `useMemo`, then render each segment as a separate `<Sequence><Audio>` with fade-in/fade-out volume curves on the 3s (90-frame) overlap regions. This is the only declarative approach that works with Remotion's frame-by-frame renderer.

**BGM tracks needed:** 3-4 royalty-free lo-fi tracks in `public/audio/bgm/`. These are asset files, not code — user will need to source them. The code should handle any number of tracks gracefully (loop if fewer tracks than changes needed).

**Files:** Modify `src/components/BgmLayer.tsx`.

## 8. SFX Upgrade (`src/lib/sfx-triggers.ts`) — NEW FILE + MODIFY

Current SFX system exists (`SfxLayer.tsx`, `sfx-durations.ts`) but has limited triggers. Add intelligent auto-SFX:

**New SFX types:**
| Effect | When | Sound |
|--------|------|-------|
| whoosh | Scene transition | Fast swoosh |
| pop | Bullet point appears | Subtle pop |
| ding | Correct answer reveal | Bell ding |
| error | Wrong answer / anti-pattern | Error buzz |
| typing | Code scene starts | Keyboard typing |
| impact | Key stat / number | Bass thud |
| riser | Before reveal / climax | Rising tension |

**Auto-trigger logic** (`src/lib/sfx-triggers.ts`):
```typescript
function generateSfxTriggers(scenes: Scene[], style: VideoStyle): SfxTrigger[];
```
- Scans scenes for patterns (code blocks → typing, numbers → impact, questions → ding on answer)
- Respects `sfxDensity`: sparse = 1 per scene max, dense = 2-3 per scene
- Returns `SfxTrigger[]` that gets set on `storyboard.allSfxTriggers`

**SFX audio files:** Need 7 short audio files in `public/audio/sfx/`. These are assets — user sources them. Code references them by name.

**Files:** Create `src/lib/sfx-triggers.ts`. Call `generateSfxTriggers()` in `generateStoryboard()` (in `src/pipeline/storyboard.ts`) after `stitchAudio()` returns, merging results with any existing `allSfxTriggers` from the stitcher.

## 9. Progress Bar Milestones (`src/components/ProgressBar.tsx`) — MODIFY

Add milestone celebrations at 25%, 50%, 75% progress.

**Note:** `sceneName` and `sceneStartFrame` props already exist in ProgressBar.tsx with slide-in animation implemented. The actual new work is the milestone celebration overlay.

**New changes:**
- At 25/50/75% progress, show a brief celebration overlay (1.5s = 45 frames):
  - Confetti burst emoji (party popper)
  - Text: "25% done!", "Halfway there!", "Almost done!"
  - Spring scale animation 0 → 1.0
  - Gold glow behind text

**Props additions:**
```typescript
milestoneAt?: number[];   // [0.25, 0.5, 0.75] — progress thresholds
```

**Files:** Modify `src/components/ProgressBar.tsx`. Wire `sceneName` from `LongVideo.tsx` (use `activeScene.heading`).

## 10. Wire Everything into LongVideo.tsx — MODIFY

Final integration step. Changes to `LongVideo.tsx`:

1. Import `getStyleForFormat` from `video-styles.ts`
2. Get style: `const style = getStyleForFormat('long')`
3. Wrap content `<Sequence>` with `<ZoomPunchLayer>` using style config
4. Pass `captionMode={style.captionMode}` to `<CaptionOverlay>`
5. Pass `sceneName={activeScene?.heading}` to `<ProgressBar>`
6. Update `getTransitionForScene()` to use scene index rotation
7. Pass style config to `<BgmLayer>` (volume, track change interval)

---

## File Change Summary

### New Files (4)
| File | Purpose |
|------|---------|
| `src/lib/video-styles.ts` | Style system config |
| `src/components/ZoomPunchLayer.tsx` | Auto-zoom overlay |
| `src/components/transitions.ts` | Custom transition presentations (clockWipe, iris, flip) |
| `src/lib/sfx-triggers.ts` | Auto SFX trigger generation |

### Modified Files (6)
| File | Changes |
|------|---------|
| `src/pipeline/tts-engine.ts` | Add `rate` param to `edgeTTS()` + `generateAudio()`, update cache key |
| `src/components/CaptionOverlay.tsx` | Add fireship/hormozi modes with separate render branches |
| `src/compositions/LongVideo.tsx` | Wire all new components + transition rotation |
| `src/components/BgmLayer.tsx` | Multi-track crossfade via multiple `<Sequence><Audio>` |
| `src/components/ProgressBar.tsx` | Milestone celebrations |
| `src/pipeline/storyboard.ts` | Call `generateSfxTriggers()` after stitching |

### Deferred to Sub-project 2
| File | Purpose |
|------|---------|
| `src/lib/sub-scene-splitter.ts` | Sub-scene splitting (needed for Viral Shorts, not Long Video) |

**Total: 4 new files, 6 modified files (+ 1 deferred)**

---

## Dependencies & Assets Needed

**NPM packages:** None new required. All transitions can be built with existing `@remotion/transitions` API.

**Audio assets (user-sourced):**
- 3-4 lo-fi BGM tracks → `public/audio/bgm/`
- 7 SFX files (whoosh, pop, ding, error, typing, impact, riser) → `public/audio/sfx/`

**Fonts:** JetBrains Mono for fireship captions — available via `@remotion/google-fonts/JetBrainsMono`.

---

## Priority Order

1. **P0:** TTS rate param (#3) — blocks re-rendering with correct pacing
2. **P1:** Caption modes (#4) + Transition variety (#6) — biggest visual impact
3. **P2:** VideoStyle config (#1) + ZoomPunchLayer (#2) — structural + motion
4. **P3:** BGM mixing (#7) + SFX upgrade (#8) + Progress milestones (#9)
5. **P4:** Sub-scene splitting (#5) — needed for Sub-project 2, not Sub-project 1
6. **P5:** Wire everything (#10) — final integration

---

## Success Criteria

- [ ] TTS rate varies per scene type (not hardcoded -5%)
- [ ] Captions switch between fireship (clean) and hormozi (bounce) modes
- [ ] Transitions rotate through 6+ styles instead of repeating per scene type
- [ ] Zoom punch adds subtle motion every 3-5 seconds
- [ ] BGM crossfades between tracks every 2 minutes
- [ ] SFX triggers fire automatically based on scene content
- [ ] Progress bar shows milestone celebrations at 25/50/75%
- [ ] Overall score: 9/10 viral-grade (from 7.5/10)
