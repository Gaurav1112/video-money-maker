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
- Uses `spring()` with damping 12, stiffness 150 for organic feel
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

**Files:** Create `src/components/ZoomPunchLayer.tsx`. Wire into `LongVideo.tsx` wrapping the content `<Sequence>`.

## 3. Dynamic TTS Pacing (`src/pipeline/tts-engine.ts`) — MODIFY

**P0 BLOCKER.** Currently `--rate=-5%` is hardcoded at line 244. Need per-scene rate control.

**Changes:**
- Add `rate` parameter to `edgeTTS()` function signature: `rate?: string` (default `'-5%'`)
- Add `rate` parameter to `generateTTS()` function signature
- Thread rate through from `renderSession()` → `generateTTS()` → `edgeTTS()`
- In `audio-stitcher.ts` or wherever scenes are iterated for TTS: look up rate from `VideoStyle.ttsRate[scene.type]`

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

**Files:** Modify `src/pipeline/tts-engine.ts`. Modify `src/pipeline/audio-stitcher.ts` (rate lookup per scene).

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
- Single centered word or 3-word groups
- Slam-in animation (translateY -20px → 0 with spring)

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

These 3 are custom `TransitionPresentation` implementations in a new file `src/components/transitions.ts`.

**Files:** Create `src/components/transitions.ts`. Modify `src/compositions/LongVideo.tsx` (`getTransitionForScene`).

## 7. BGM Mixing (`src/components/BgmLayer.tsx`) — MODIFY

Current BgmLayer works but is basic — single track, fixed volume. Upgrade:

**Changes:**
- Accept `trackChangeInterval` prop (default 120s = 2 min)
- Accept `tracks` array prop (list of BGM file paths)
- Crossfade between tracks: 3s overlap, fade-out old + fade-in new
- Volume from `VideoStyle.bgmVolume` (0.12-0.15 range)
- Track selection: rotate through `tracks` array by index

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

**Files:** Create `src/lib/sfx-triggers.ts`. Modify `src/pipeline/storyboard.ts` to call `generateSfxTriggers()` during storyboard generation.

## 9. Progress Bar Milestones (`src/components/ProgressBar.tsx`) — MODIFY

Add milestone celebrations at 25%, 50%, 75% progress:

**Changes:**
- At 25/50/75% progress, show a brief celebration overlay (1.5s):
  - Confetti burst emoji (party popper)
  - Text: "25% done!", "Halfway there!", "Almost done!"
  - Spring scale animation 0 → 1.0
  - Gold glow behind text
- Add `sceneName` prop to show current chapter label above progress bar
- `sceneName` text slides in from left when scene changes (already partially implemented)

**Props additions:**
```typescript
sceneName?: string;       // Current scene heading
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

### New Files (3)
| File | Purpose |
|------|---------|
| `src/lib/video-styles.ts` | Style system config |
| `src/components/ZoomPunchLayer.tsx` | Auto-zoom overlay |
| `src/lib/sub-scene-splitter.ts` | Sub-scene splitting for shorts |

### Modified Files (8)
| File | Changes |
|------|---------|
| `src/pipeline/tts-engine.ts` | Add `rate` param to `edgeTTS()` |
| `src/pipeline/audio-stitcher.ts` | Thread per-scene TTS rate |
| `src/components/CaptionOverlay.tsx` | Add fireship/hormozi modes |
| `src/components/SceneTransitionFlash.tsx` | (minor cleanup only) |
| `src/compositions/LongVideo.tsx` | Wire all new components + transition rotation |
| `src/components/BgmLayer.tsx` | Multi-track crossfade |
| `src/components/ProgressBar.tsx` | Milestone celebrations + sceneName |
| `src/pipeline/storyboard.ts` | Auto-generate SFX triggers |

### New Files (additional)
| File | Purpose |
|------|---------|
| `src/components/transitions.ts` | Custom transition presentations (clockWipe, iris, flip) |
| `src/lib/sfx-triggers.ts` | Auto SFX trigger generation |

**Total: 5 new files, 8 modified files**

---

## Dependencies & Assets Needed

**NPM packages:** None new required. All transitions can be built with existing `@remotion/transitions` API.

**Audio assets (user-sourced):**
- 3-4 lo-fi BGM tracks → `public/audio/bgm/`
- 7 SFX files (whoosh, pop, ding, error, typing, impact, riser) → `public/audio/sfx/`

**No new fonts needed.** JetBrains Mono for fireship captions can be loaded via `@remotion/google-fonts`.

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
