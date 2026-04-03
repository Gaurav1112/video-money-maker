# Long Video Makeover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Remotion video pipeline from 7.5/10 to 9/10 viral-grade quality by adding dynamic TTS pacing, caption modes, transition variety, zoom punches, BGM crossfade, auto-SFX, and progress milestones.

**Architecture:** Central `VideoStyle` config drives all components. Style is resolved once in `LongVideo.tsx` via `getStyleForFormat('long')` and threaded to each layer. TTS rate is resolved at the call site of `generateSceneAudios()` and passed per-scene, keeping `tts-engine.ts` decoupled from style concerns.

**Tech Stack:** Remotion 4, React 19, TypeScript, Edge TTS, `@remotion/transitions`, `@remotion/google-fonts`

**Spec:** `docs/superpowers/specs/2026-04-02-long-video-makeover-design.md`

**Codebase:** `/Users/racit/PersonalProject/video-pipeline/` on branch `feat/production-pipeline-v2`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/video-styles.ts` | Style registry — `educational` + `viral` modes, `getStyleForFormat()` |
| `src/components/ZoomPunchLayer.tsx` | Auto-zoom overlay wrapping content scenes |
| `src/components/transitions.tsxx` | Custom `TransitionPresentation` implementations (clockWipe, iris, flip) |
| `src/lib/sfx-triggers.ts` | Auto-generate `SfxTrigger[]` from scene content + style density |

### Modified Files
| File | Changes |
|------|---------|
| `src/pipeline/tts-engine.ts` | Add `rate` param to `edgeTTS()`, `generateAudio()`, `generateSceneAudios()`. Update cache key to include rate. |
| `src/components/CaptionOverlay.tsx` | Add `captionMode` prop. Fireship mode (existing cleanup) + Hormozi mode (separate render branch, 1-3 word groups). |
| `src/compositions/LongVideo.tsx` | Import style, wrap content in ZoomPunchLayer, pass captionMode, wire sceneName, rotate transitions, pass BGM config. |
| `src/components/BgmLayer.tsx` | Multi-track support via pre-computed `<Sequence><Audio>` segments with crossfade. |
| `src/components/ProgressBar.tsx` | Add milestone celebration overlay at 25/50/75%. |
| `src/pipeline/storyboard.ts` | Call `generateSfxTriggers()` after `stitchAudio()`, merge into `allSfxTriggers`. |
| `src/lib/sfx-durations.ts` | Add duration entries for new SFX types (impact, error, typing, riser). |
| `src/components/index.ts` | Export `ZoomPunchLayer`. |

---

## Task 1: VideoStyle Config (P2 — foundation, needed by all others)

**Files:**
- Create: `src/lib/video-styles.ts`

- [ ] **Step 1: Create video-styles.ts with style definitions**

```typescript
// src/lib/video-styles.ts
import type { SceneType, VideoFormat } from '../types';

export type CaptionMode = 'fireship' | 'hormozi';
export type SfxDensity = 'sparse' | 'dense';
export type TransitionType = 'fade' | 'slide-right' | 'slide-left' | 'slide-bottom' | 'slide-top' | 'wipe-left' | 'wipe-right' | 'clockWipe' | 'iris' | 'flip';

export interface VideoStyle {
  id: 'educational' | 'viral';
  ttsRate: Record<SceneType, string>;
  captionMode: CaptionMode;
  zoomInterval: [number, number];
  zoomScale: number;
  transitionPool: TransitionType[];
  bgmVolume: number;
  bgmChangeInterval: number;
  sfxDensity: SfxDensity;
}

const EDUCATIONAL: VideoStyle = {
  id: 'educational',
  ttsRate: {
    title: '+15%',
    text: '+0%',
    code: '-5%',
    diagram: '-5%',
    table: '+0%',
    interview: '+5%',
    review: '+0%',
    summary: '+10%',
  },
  captionMode: 'fireship',
  zoomInterval: [3, 5],
  zoomScale: 1.15,
  transitionPool: ['fade', 'slide-right', 'wipe-left', 'slide-bottom', 'fade', 'slide-left', 'wipe-right', 'slide-top'],
  bgmVolume: 0.12,
  bgmChangeInterval: 120,
  sfxDensity: 'sparse',
};

const VIRAL: VideoStyle = {
  id: 'viral',
  ttsRate: {
    title: '+20%',
    text: '+10%',
    code: '+0%',
    diagram: '+0%',
    table: '+5%',
    interview: '+10%',
    review: '+5%',
    summary: '+15%',
  },
  captionMode: 'hormozi',
  zoomInterval: [1.5, 3],
  zoomScale: 1.25,
  transitionPool: ['fade', 'slide-right', 'wipe-left', 'iris'],
  bgmVolume: 0.15,
  bgmChangeInterval: 60,
  sfxDensity: 'dense',
};

const STYLES: Record<string, VideoStyle> = {
  educational: EDUCATIONAL,
  viral: VIRAL,
};

export function getStyleForFormat(format: VideoFormat): VideoStyle {
  return format === 'long' ? STYLES.educational : STYLES.viral;
}

export function getStyle(id: 'educational' | 'viral'): VideoStyle {
  return STYLES[id];
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit src/lib/video-styles.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add src/lib/video-styles.ts
git commit -m "feat: add VideoStyle config with educational + viral modes"
```

---

## Task 2: Dynamic TTS Pacing (P0 — blocker)

**Files:**
- Modify: `src/pipeline/tts-engine.ts:51-62` (generateAudio signature + cache key)
- Modify: `src/pipeline/tts-engine.ts:241-244` (edgeTTS rate param)
- Modify: `src/pipeline/tts-engine.ts:458-476` (generateSceneAudios — accept per-scene rates)

- [ ] **Step 1: Add `rate` param to `edgeTTS()` function**

In `src/pipeline/tts-engine.ts`, find the `edgeTTS` function (around line 220). Add `rate` parameter and use it instead of hardcoded `'--rate=-5%'`.

Find (line 223-228):
```typescript
async function edgeTTS(
  text: string,
  cacheKey: string,
  outputName?: string,
  voiceLanguage: string = 'indian-english'
): Promise<TTSResult> {
```
Replace with:
```typescript
async function edgeTTS(
  text: string,
  cacheKey: string,
  outputName?: string,
  voiceLanguage: string = 'indian-english',
  rate: string = '-5%'
): Promise<TTSResult> {
```

Find line 244:
```typescript
    '--rate=-5%',           // Slightly slower for teacher clarity
```
Replace with:
```typescript
    `--rate=${rate}`,       // Per-scene pacing from VideoStyle
```

- [ ] **Step 2: Add `rate` param to `generateAudio()` and update cache key**

In `src/pipeline/tts-engine.ts`, modify `generateAudio` (line 51):

Find:
```typescript
export async function generateAudio(
  text: string,
  voice: string = DEFAULT_VOICE,
  outputName?: string,
  voiceLanguage: string = DEFAULT_VOICE_LANGUAGE
): Promise<TTSResult> {
```
Replace with:
```typescript
export async function generateAudio(
  text: string,
  voice: string = DEFAULT_VOICE,
  outputName?: string,
  voiceLanguage: string = DEFAULT_VOICE_LANGUAGE,
  rate: string = '-5%'
): Promise<TTSResult> {
```

Update cache key (line 62):
Find:
```typescript
  const cacheKey = crypto.createHash('sha256').update(text + edgeVoice + voiceLanguage).digest('hex');
```
Replace with:
```typescript
  const cacheKey = crypto.createHash('sha256').update(text + edgeVoice + voiceLanguage + rate).digest('hex');
```

Thread rate to `edgeTTS` call (line 71):
Find:
```typescript
    return await edgeTTS(text, cacheKey, outputName, voiceLanguage);
```
Replace with:
```typescript
    return await edgeTTS(text, cacheKey, outputName, voiceLanguage, rate);
```

- [ ] **Step 3: Add per-scene rates to `generateSceneAudios()`**

Find (line 458):
```typescript
export async function generateSceneAudios(
  scenes: Array<{ narration: string; type: string }>,
  voice: string = DEFAULT_VOICE,
  voiceLanguage: string = DEFAULT_VOICE_LANGUAGE
): Promise<TTSResult[]> {
```
Replace with:
```typescript
export async function generateSceneAudios(
  scenes: Array<{ narration: string; type: string }>,
  voice: string = DEFAULT_VOICE,
  voiceLanguage: string = DEFAULT_VOICE_LANGUAGE,
  rateMap?: Record<string, string>
): Promise<TTSResult[]> {
```

Update the loop body (line 476) — thread per-scene rate:
Find:
```typescript
    const result = await generateAudio(spokenText, resolvedVoice, `scene_${i}.mp3`, voiceLanguage);
```
Replace with:
```typescript
    const sceneRate = rateMap?.[scene.type] ?? '-5%';
    const result = await generateAudio(spokenText, resolvedVoice, `scene_${i}.mp3`, voiceLanguage, sceneRate);
```

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit src/pipeline/tts-engine.ts`
Expected: No errors. All existing callers work because new params have defaults.

- [ ] **Step 5: Commit**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add src/pipeline/tts-engine.ts
git commit -m "feat: add per-scene TTS rate param (P0 blocker fix)

Thread rate through generateSceneAudios → generateAudio → edgeTTS.
Cache key now includes rate to prevent stale cached audio.
Default -5% preserves existing behavior."
```

---

## Task 3: Caption Modes (P1 — biggest visual impact)

**Files:**
- Modify: `src/components/CaptionOverlay.tsx` (full file — add captionMode prop, Hormozi render branch)

- [ ] **Step 1: Add `captionMode` prop to interface**

In `src/components/CaptionOverlay.tsx`, find the `CaptionOverlayProps` interface (line 11):

Add after `wordTimestamps`:
```typescript
  /** Caption style: 'fireship' (clean monospace) or 'hormozi' (bounce box) */
  captionMode?: 'fireship' | 'hormozi';
```

Add to destructured props (line 128, add after `wordTimestamps`):
```typescript
  captionMode = 'fireship',
```

- [ ] **Step 2: Modify `buildSentenceGroups` to accept `maxWords` parameter**

Find (line 48):
```typescript
const buildSentenceGroups = (
  words: string[],
): Array<{ start: number; end: number }> => {
  const MAX_WORDS = 14;
  const MIN_WORDS = 4;
```
Replace with:
```typescript
const buildSentenceGroups = (
  words: string[],
  maxWords: number = 14,
): Array<{ start: number; end: number }> => {
  const MAX_WORDS = maxWords;
  const MIN_WORDS = Math.min(4, maxWords);
```

- [ ] **Step 3: Update `buildSentenceGroups` call to pass mode-based maxWords**

Find (line 164):
```typescript
  const groups = buildSentenceGroups(words);
```
Replace with:
```typescript
  const groups = buildSentenceGroups(words, captionMode === 'hormozi' ? 3 : 14);
```

- [ ] **Step 4: Add Hormozi render branch**

After the existing render return's closing `</AbsoluteFill>` (line 363), add a conditional early return for Hormozi mode. The logic: BEFORE the existing render (line 225), add:

Find (line 225):
```typescript
  // ── Render ──
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          bottom: 60,
```
Replace with:
```typescript
  // ── Render ──
  if (captionMode === 'hormozi') {
    // Hormozi mode: bold centered words, slam-in animation, full-width color bar
    const hormoziGroup = activeWords;

    const slamSpring = spring({
      frame: elapsed - getWordStartFrame(currentWordIndex),
      fps,
      config: { damping: 10, stiffness: 280, mass: 0.5 },
    });
    const slamY = interpolate(slamSpring, [0, 1], [-20, 0]);
    const slamScale = interpolate(slamSpring, [0, 1], [0.8, 1.0]);

    return (
      <AbsoluteFill>
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            opacity: containerOpacity,
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: `linear-gradient(135deg, ${COLORS.saffron}EE, ${COLORS.saffron}CC)`,
              borderRadius: 8,
              padding: '20px 48px',
              display: 'flex',
              gap: 14,
              alignItems: 'center',
              justifyContent: 'center',
              transform: `translateY(${slamY}px) scale(${slamScale})`,
              boxShadow: `0 8px 32px ${COLORS.saffron}44`,
            }}
          >
            {hormoziGroup.map((word, wIdx) => {
              const localIdx = wIdx;
              const isCurrent = localIdx === localWordIndex;
              const isFuture = localIdx > localWordIndex;

              if (isFuture) return null;

              const emphasis = isEmphasis(word);
              const wordSpring = isCurrent
                ? spring({
                    frame: elapsed - getWordStartFrame(activeGroup.start + localIdx),
                    fps,
                    config: { damping: 8, stiffness: 250, mass: 0.4 },
                  })
                : 0;
              const wordScale = isCurrent
                ? interpolate(wordSpring, [0, 1], [1.0, 1.3])
                : 1.0;

              return (
                <span
                  key={`hormozi-${activeGroupIdx}-${localIdx}`}
                  style={{
                    display: 'inline-block',
                    fontFamily: FONTS.text,
                    fontSize: isCurrent ? 44 : 38,
                    fontWeight: 800,
                    color: isCurrent ? COLORS.white : (emphasis ? COLORS.gold : `${COLORS.white}DD`),
                    textTransform: 'uppercase',
                    transform: `scale(${wordScale})`,
                    transformOrigin: 'center bottom',
                    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                    letterSpacing: 1,
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          bottom: 60,
```

- [ ] **Step 5: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit src/components/CaptionOverlay.tsx`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add src/components/CaptionOverlay.tsx
git commit -m "feat: add fireship/hormozi caption modes (P1)

Fireship: existing clean style with monospace, word-by-word reveal.
Hormozi: bold uppercase, saffron bar, slam-in animation, 1-3 word groups.
buildSentenceGroups now accepts maxWords parameter."
```

---

## Task 4: Transition Variety (P1)

**Files:**
- Create: `src/components/transitions.tsx`
- Modify: `src/compositions/LongVideo.tsx:54-75` (getTransitionForScene)

- [ ] **Step 1: Create custom transition presentations**

Create `src/components/transitions.tsx`:

```typescript
import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import type { TransitionPresentation } from '@remotion/transitions';

// --- Clock Wipe: circular reveal using conic-gradient clip-path ---
export function clockWipe(): TransitionPresentation<Record<string, unknown>> {
  return {
    Slide: ({ presentationDirection, presentationProgress, passedProps, children }) => {
      const progress = presentationDirection === 'entering' ? presentationProgress : 1;
      const angle = progress * 360;
      return (
        <AbsoluteFill
          style={{
            ...passedProps?.style,
            clipPath: `polygon(50% 50%, 50% 0%, ${angle > 90 ? '100% 0%' : `${50 + 50 * Math.tan((angle * Math.PI) / 180)}% 0%`}${angle > 90 ? `, 100% ${angle > 180 ? '100%' : `${50 * Math.tan(((angle - 90) * Math.PI) / 180)}%`}` : ''}${angle > 180 ? `, ${angle > 270 ? '0%' : `${100 - 50 * Math.tan(((angle - 180) * Math.PI) / 180)}%`} 100%` : ''}${angle > 270 ? `, 0% ${100 - 50 * Math.tan(((angle - 270) * Math.PI) / 180)}%` : ''})`,
          }}
        >
          {children}
        </AbsoluteFill>
      );
    },
  } as unknown as TransitionPresentation<Record<string, unknown>>;
}

// --- Iris: circular reveal from center ---
export function iris(): TransitionPresentation<Record<string, unknown>> {
  return {
    Slide: ({ presentationDirection, presentationProgress, passedProps, children }) => {
      const progress = presentationDirection === 'entering' ? presentationProgress : 1;
      const radius = progress * 150; // percentage — 150% covers full frame diagonally
      return (
        <AbsoluteFill
          style={{
            ...passedProps?.style,
            clipPath: `circle(${radius}% at 50% 50%)`,
          }}
        >
          {children}
        </AbsoluteFill>
      );
    },
  } as unknown as TransitionPresentation<Record<string, unknown>>;
}

// --- Flip: 2D scaleX flip (safe for headless Chrome) ---
export function flip(): TransitionPresentation<Record<string, unknown>> {
  return {
    Slide: ({ presentationDirection, presentationProgress, passedProps, children }) => {
      const isEntering = presentationDirection === 'entering';
      // Exiting: scaleX 1 → 0 (first half). Entering: scaleX 0 → 1 (second half).
      const scaleX = isEntering ? presentationProgress : 1 - presentationProgress;
      return (
        <AbsoluteFill
          style={{
            ...passedProps?.style,
            transform: `scaleX(${scaleX})`,
            opacity: scaleX < 0.05 ? 0 : 1,
          }}
        >
          {children}
        </AbsoluteFill>
      );
    },
  } as unknown as TransitionPresentation<Record<string, unknown>>;
}
```

- [ ] **Step 2: Update `getTransitionForScene` in LongVideo.tsx to rotate through pool**

In `src/compositions/LongVideo.tsx`, replace the entire `getTransitionForScene` function (lines 54-75):

Find:
```typescript
function getTransitionForScene(sceneType: string): TransitionPresentation<Record<string, unknown>> {
  switch (sceneType) {
    case 'title':
      return fade() as TransitionPresentation<Record<string, unknown>>;
    case 'code':
      return slide({ direction: 'from-right' }) as TransitionPresentation<Record<string, unknown>>;
    case 'text':
      return fade() as TransitionPresentation<Record<string, unknown>>;
    case 'interview':
      return wipe({ direction: 'from-left' }) as TransitionPresentation<Record<string, unknown>>;
    case 'summary':
      return fade() as TransitionPresentation<Record<string, unknown>>;
    case 'diagram':
      return slide({ direction: 'from-bottom' }) as TransitionPresentation<Record<string, unknown>>;
    case 'table':
      return slide({ direction: 'from-left' }) as TransitionPresentation<Record<string, unknown>>;
    case 'review':
      return wipe({ direction: 'from-right' }) as TransitionPresentation<Record<string, unknown>>;
    default:
      return fade() as TransitionPresentation<Record<string, unknown>>;
  }
}
```
Replace with:
```typescript
import { clockWipe, iris, flip } from '../components/transitions';

type TransitionFactory = () => TransitionPresentation<Record<string, unknown>>;

const TRANSITION_POOL: TransitionFactory[] = [
  () => fade() as TransitionPresentation<Record<string, unknown>>,
  () => slide({ direction: 'from-right' }) as TransitionPresentation<Record<string, unknown>>,
  () => wipe({ direction: 'from-left' }) as TransitionPresentation<Record<string, unknown>>,
  () => slide({ direction: 'from-bottom' }) as TransitionPresentation<Record<string, unknown>>,
  () => iris() as TransitionPresentation<Record<string, unknown>>,
  () => slide({ direction: 'from-left' }) as TransitionPresentation<Record<string, unknown>>,
  () => wipe({ direction: 'from-right' }) as TransitionPresentation<Record<string, unknown>>,
  () => flip() as TransitionPresentation<Record<string, unknown>>,
];

function getTransitionForScene(_sceneType: string, sceneIndex: number): TransitionPresentation<Record<string, unknown>> {
  return TRANSITION_POOL[sceneIndex % TRANSITION_POOL.length]();
}
```

Also update the call site (line 429) to pass `idx`:
Find:
```typescript
                    presentation={getTransitionForScene(scene.type)}
```
Replace with:
```typescript
                    presentation={getTransitionForScene(scene.type, idx)}
```

- [ ] **Step 3: Verify the import is at module scope**

The import `import { clockWipe, iris, flip } from '../components/transitions';` was included in Step 2's replacement block. Move it to the top of the file with the other imports (near line 1-10). The `TRANSITION_POOL` and `getTransitionForScene` remain at module scope (where the old function was). Remove the import line from the replacement block if placed at top.

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit src/compositions/LongVideo.tsx`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add src/components/transitions.tsx src/compositions/LongVideo.tsx
git commit -m "feat: add transition variety with clockWipe, iris, flip (P1)

Transitions now rotate through 8 styles by scene index instead of
being locked to scene type. Custom transitions use 2D-safe approaches
(clip-path, scaleX) for headless Chrome compatibility."
```

---

## Task 5: ZoomPunchLayer (P2)

**Files:**
- Create: `src/components/ZoomPunchLayer.tsx`
- Modify: `src/components/index.ts` (add export)
- Modify: `src/compositions/LongVideo.tsx` (wrap content Sequence)

- [ ] **Step 1: Create ZoomPunchLayer component**

Create `src/components/ZoomPunchLayer.tsx`:

```typescript
import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate, Easing } from 'remotion';

interface ZoomPunchLayerProps {
  children: React.ReactNode;
  /** Range in seconds between zoom punches, e.g. [3, 5] */
  intervalRange: [number, number];
  /** Max scale factor, e.g. 1.15 */
  scale: number;
  fps: number;
}

const PUNCH_DURATION_FRAMES = 24; // 0.8s at 30fps

/**
 * Deterministic zoom punch overlay. Adds subtle scale pulses at regular intervals.
 * Uses interpolate (not spring) for guaranteed 24-frame timing.
 */
export const ZoomPunchLayer: React.FC<ZoomPunchLayerProps> = ({
  children,
  intervalRange,
  scale: maxScale,
  fps,
}) => {
  const frame = useCurrentFrame();

  // Deterministic interval: average of range, converted to frames
  const avgInterval = ((intervalRange[0] + intervalRange[1]) / 2) * fps;

  // Which punch cycle are we in?
  const cycleFrame = frame % Math.round(avgInterval);
  const isPunching = cycleFrame < PUNCH_DURATION_FRAMES;

  let currentScale = 1.0;
  if (isPunching) {
    // First half: scale up. Second half: scale down.
    const half = PUNCH_DURATION_FRAMES / 2;
    if (cycleFrame < half) {
      currentScale = interpolate(cycleFrame, [0, half], [1.0, maxScale], {
        easing: Easing.out(Easing.cubic),
        extrapolateRight: 'clamp',
      });
    } else {
      currentScale = interpolate(cycleFrame, [half, PUNCH_DURATION_FRAMES], [maxScale, 1.0], {
        easing: Easing.inOut(Easing.cubic),
        extrapolateRight: 'clamp',
      });
    }
  }

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${currentScale})`,
        transformOrigin: 'center center',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Export from components index**

In `src/components/index.ts`, add at the end:
```typescript
export { ZoomPunchLayer } from './ZoomPunchLayer';
```

- [ ] **Step 3: Wire into LongVideo.tsx**

In `src/compositions/LongVideo.tsx`, add import:
```typescript
import { ZoomPunchLayer } from '../components/ZoomPunchLayer';
import { getStyleForFormat } from '../lib/video-styles';
```

Add style resolution at the top of the component (after `const progress = ...`, around line 254):
```typescript
  const style = getStyleForFormat('long');
```

Wrap the content `<Sequence>` (line 305) with ZoomPunchLayer:

Find:
```typescript
      <Sequence from={INTRO_DURATION} durationInFrames={contentFrames}>
        <TransitionSeries>
```
Replace with:
```typescript
      <Sequence from={INTRO_DURATION} durationInFrames={contentFrames}>
        <ZoomPunchLayer intervalRange={style.zoomInterval} scale={style.zoomScale} fps={fps}>
        <TransitionSeries>
```

Find the closing of the TransitionSeries + Sequence (around line 446):
```typescript
        </TransitionSeries>
      </Sequence>
```
Replace with:
```typescript
        </TransitionSeries>
        </ZoomPunchLayer>
      </Sequence>
```

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit src/compositions/LongVideo.tsx`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add src/components/ZoomPunchLayer.tsx src/components/index.ts src/compositions/LongVideo.tsx
git commit -m "feat: add ZoomPunchLayer with auto-zoom every 3-5s (P2)

Wraps content Sequence with deterministic scale pulses.
Uses interpolate with Easing.cubic for guaranteed 24-frame timing.
Driven by VideoStyle config (educational: 1.15x, viral: 1.25x)."
```

---

## Task 6: BGM Multi-Track Crossfade (P3)

**Files:**
- Modify: `src/components/BgmLayer.tsx` (multi-track support)

- [ ] **Step 1: Add multi-track props and segment computation**

Rewrite `src/components/BgmLayer.tsx` to support multiple tracks with crossfade. The key change: instead of a single `<Audio loop>`, pre-compute track segments and render each as a separate `<Sequence><Audio>`.

First, add `Sequence` to the existing remotion import (line 2):
Find:
```typescript
import { Audio, interpolate, useCurrentFrame, useVideoConfig, staticFile } from 'remotion';
```
Replace with:
```typescript
import { Audio, Sequence, interpolate, useCurrentFrame, useVideoConfig, staticFile } from 'remotion';
```

Then, in `src/components/BgmLayer.tsx`, add to the interface:
```typescript
  /** Array of BGM track paths for rotation (relative to public/) */
  tracks?: string[];
  /** Seconds between track changes (default 120) */
  trackChangeInterval?: number;
```

After the `resolvedFile` memo, add a segment computation memo:

```typescript
  const trackChangeInterval = props.trackChangeInterval ?? 120;
  const trackList = props.tracks ?? [resolvedFile];

  // Pre-compute which track plays at which frame range
  const segments = React.useMemo(() => {
    if (trackList.length <= 1) return null; // single track — use existing loop behavior

    const intervalFrames = trackChangeInterval * fps;
    const crossfadeFrames = 3 * fps; // 3s crossfade
    const segs: Array<{ trackFile: string; startFrame: number; endFrame: number }> = [];
    let frame = 0;
    let trackIdx = 0;

    while (frame < durationInFrames) {
      segs.push({
        trackFile: trackList[trackIdx % trackList.length],
        startFrame: frame,
        endFrame: Math.min(frame + intervalFrames + crossfadeFrames, durationInFrames),
      });
      frame += intervalFrames;
      trackIdx++;
    }
    return segs;
  }, [trackList, trackChangeInterval, fps, durationInFrames]);
```

- [ ] **Step 2: Render multi-track segments when available**

In the return, add conditional rendering:

```typescript
  if (segments && segments.length > 1) {
    const crossfadeFrames = 3 * fps;
    return (
      <>
        {segments.map((seg, i) => (
          <Sequence key={`bgm-${i}`} from={seg.startFrame} durationInFrames={seg.endFrame - seg.startFrame}>
            <Audio
              src={staticFile(seg.trackFile)}
              volume={(f) => {
                const localFrame = f;
                const segDuration = seg.endFrame - seg.startFrame;
                // Fade in over crossfade period
                const fadeIn = interpolate(localFrame, [0, crossfadeFrames], [0, 1], {
                  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
                });
                // Fade out over crossfade period at end
                const fadeOut = interpolate(localFrame, [segDuration - crossfadeFrames, segDuration], [1, 0], {
                  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
                });
                // Ducking from pre-computed array
                const absFrame = seg.startFrame + localFrame;
                const ducked = absFrame < duckingVolumes.length ? duckingVolumes[absFrame] : duckVolume;
                return fadeIn * fadeOut * ducked;
              }}
            />
          </Sequence>
        ))}
      </>
    );
  }
```

Keep the existing single-track `<Audio loop>` return as the fallback.

- [ ] **Step 3: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit src/components/BgmLayer.tsx`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add src/components/BgmLayer.tsx
git commit -m "feat: add BGM multi-track crossfade support (P3)

Pre-computes track segments in useMemo, renders each as Sequence/Audio.
3-second crossfade overlap between tracks. Falls back to single loop
when only one track provided."
```

---

## Task 7: SFX Auto-Trigger Generation (P3)

**Files:**
- Create: `src/lib/sfx-triggers.ts`
- Modify: `src/lib/sfx-durations.ts` (add new SFX duration entries)
- Modify: `src/pipeline/storyboard.ts:35-39` (call generateSfxTriggers)

- [ ] **Step 1: Add new SFX durations**

In `src/lib/sfx-durations.ts`, add to the `SFX_DURATIONS` record:

```typescript
  'impact': 18,          // 0.6s — bass thud
  'error': 15,           // 0.5s — error buzz
  'typing': 30,          // 1.0s — keyboard typing loop
  'riser': 45,           // 1.5s — rising tension
  'whoosh': 12,          // 0.4s — generic whoosh
  // Note: 'pop': 6 already exists in the file — do NOT duplicate
```

- [ ] **Step 2: Create sfx-triggers.ts**

Create `src/lib/sfx-triggers.ts`:

```typescript
import type { Scene, SfxTrigger } from '../types';
import type { SfxDensity } from './video-styles';

/**
 * Auto-generate SFX triggers by analyzing scene content.
 * Scans for patterns and assigns appropriate sound effects.
 */
export function generateSfxTriggers(
  scenes: Scene[],
  density: SfxDensity = 'sparse',
): SfxTrigger[] {
  const maxPerScene = density === 'dense' ? 3 : 1;
  const triggers: SfxTrigger[] = [];

  scenes.forEach((scene, sceneIndex) => {
    const sceneTriggers: SfxTrigger[] = [];

    // Code scenes get a typing SFX at start
    if (scene.type === 'code') {
      sceneTriggers.push({
        sceneIndex,
        wordIndex: 0,
        effect: 'typing',
        volume: 0.3,
      });
    }

    // Review/quiz scenes get a ding when answer is revealed (midpoint)
    if (scene.type === 'review') {
      const midWord = Math.floor((scene.wordTimestamps?.length || 10) / 2);
      sceneTriggers.push({
        sceneIndex,
        wordIndex: midWord,
        effect: 'ding',
        volume: 0.5,
      });
    }

    // Text scenes with numbers get an impact SFX
    if (scene.narration && /\d{2,}/.test(scene.narration)) {
      const words = scene.narration.split(/\s+/);
      const numIdx = words.findIndex(w => /\d{2,}/.test(w));
      if (numIdx >= 0) {
        sceneTriggers.push({
          sceneIndex,
          wordIndex: numIdx,
          effect: 'impact',
          volume: 0.4,
        });
      }
    }

    // Summary scenes get a success chime
    if (scene.type === 'summary') {
      sceneTriggers.push({
        sceneIndex,
        wordIndex: 0,
        effect: 'success-chime',
        volume: 0.4,
      });
    }

    // Limit per scene
    triggers.push(...sceneTriggers.slice(0, maxPerScene));
  });

  return triggers;
}
```

- [ ] **Step 3: Wire into storyboard.ts**

In `src/pipeline/storyboard.ts`, add imports at top:
```typescript
import { generateSfxTriggers } from '../lib/sfx-triggers';
import type { SfxDensity } from '../lib/video-styles';
```

Add `sfxDensity` to `StoryboardOptions` interface:
```typescript
  sfxDensity?: SfxDensity;
```

After the `stitchAudio` call (line 39), before the intro scene creation (line 42), add:

```typescript
  // Auto-generate SFX triggers from scene content
  const autoSfxTriggers = generateSfxTriggers(scenes, options.sfxDensity);
  const mergedSfxTriggers = [...(allSfxTriggers || []), ...autoSfxTriggers];
```

Update the return (line 151):
Find:
```typescript
    ...(allSfxTriggers ? { allSfxTriggers } : {}),
```
Replace with:
```typescript
    ...(mergedSfxTriggers.length > 0 ? { allSfxTriggers: mergedSfxTriggers } : {}),
```

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit src/pipeline/storyboard.ts`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add src/lib/sfx-triggers.ts src/lib/sfx-durations.ts src/pipeline/storyboard.ts
git commit -m "feat: add auto SFX trigger generation (P3)

Scans scene content for patterns: code→typing, review→ding,
numbers→impact, summary→success-chime. Respects sfxDensity
(sparse: 1/scene, dense: 3/scene). Merges with existing triggers."
```

---

## Task 8: Progress Bar Milestones (P3)

**Files:**
- Modify: `src/components/ProgressBar.tsx` (add milestone celebration overlay)

- [ ] **Step 1: Add milestoneAt prop and milestone rendering**

In `src/components/ProgressBar.tsx`, add to the interface (after `sceneStartFrame`):
```typescript
  /** Progress thresholds for milestone celebrations */
  milestoneAt?: number[];
  /** Total frames in the video — used for precise milestone timing */
  totalFrames?: number;
```

Add to destructured props:
```typescript
  milestoneAt = [0.25, 0.5, 0.75],
  totalFrames: totalFramesProp,
```

After the existing `nameOpacity` computation (line 71), add milestone detection logic:

```typescript
  // Milestone celebration
  const MILESTONE_DURATION_FRAMES = 45; // 1.5s at 30fps
  // Use explicit totalFrames prop (reliable) or fall back to estimate
  const totalFrames = totalFramesProp ?? (clampedProgress > 0.01 ? frame / clampedProgress : 10000);

  const activeMilestone = (milestoneAt || []).find((threshold) => {
    const crossFrame = Math.round(threshold * totalFrames);
    return frame >= crossFrame && frame < crossFrame + MILESTONE_DURATION_FRAMES;
  });

  const milestoneLabels: Record<number, string> = {
    0.25: '25% Done!',
    0.5: 'Halfway!',
    0.75: 'Almost There!',
  };

  const milestoneEmoji: Record<number, string> = {
    0.25: '\u{1F389}',  // party popper
    0.5: '\u{1F525}',   // fire
    0.75: '\u{1F680}',  // rocket
  };
```

- [ ] **Step 2: Render milestone celebration overlay**

Inside the return `<AbsoluteFill>`, after the scene type indicator div (before the closing `</AbsoluteFill>`), add:

```typescript
      {/* Milestone celebration */}
      {activeMilestone !== undefined && (() => {
        const crossFrame = Math.round(activeMilestone * totalFrames);
        const milestoneAge = frame - crossFrame;
        const mScale = spring({
          frame: milestoneAge,
          fps,
          config: { damping: 10, stiffness: 200, mass: 0.5 },
        });
        const mOpacity = interpolate(milestoneAge, [0, 10, 35, 45], [0, 1, 1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <div
            style={{
              position: 'absolute',
              bottom: 40,
              left: '50%',
              transform: `translateX(-50%) scale(${interpolate(mScale, [0, 1], [0.5, 1])})`,
              opacity: mOpacity,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              backgroundColor: `${COLORS.dark}EE`,
              padding: '10px 24px',
              borderRadius: 12,
              border: `2px solid ${COLORS.gold}`,
              boxShadow: `0 0 20px ${COLORS.gold}44`,
              zIndex: 200,
            }}
          >
            <span style={{ fontSize: 28 }}>{milestoneEmoji[activeMilestone] || '\u{1F389}'}</span>
            <span
              style={{
                fontSize: 20,
                fontFamily: FONTS.heading,
                fontWeight: 800,
                color: COLORS.gold,
                letterSpacing: 1,
              }}
            >
              {milestoneLabels[activeMilestone] || `${Math.round(activeMilestone * 100)}%`}
            </span>
          </div>
        );
      })()}
```

- [ ] **Step 3: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit src/components/ProgressBar.tsx`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add src/components/ProgressBar.tsx
git commit -m "feat: add progress bar milestone celebrations at 25/50/75% (P3)

Shows brief animated overlay with emoji + text when crossing
progress thresholds. Spring scale animation with gold glow."
```

---

## Task 9: Wire Everything into LongVideo.tsx (P5 — final integration)

**Files:**
- Modify: `src/compositions/LongVideo.tsx`

This task assumes Tasks 1-8 are complete. All imports and the `style` const should already be in place from Task 5. This task wires the remaining pieces.

- [ ] **Step 1: Pass captionMode to CaptionOverlay**

Find (around line 476):
```typescript
        <CaptionOverlay
          key={`caption-${activeScene.audioOffsetSeconds ?? activeScene.startFrame}`}
          text={activeScene.narration!}
```
Add `captionMode` prop:
```typescript
        <CaptionOverlay
          key={`caption-${activeScene.audioOffsetSeconds ?? activeScene.startFrame}`}
          text={activeScene.narration!}
          captionMode={style.captionMode}
```

- [ ] **Step 2: Pass sceneName to ProgressBar**

Find:
```typescript
          <ProgressBar
            progress={progress}
            sceneMarkers={sceneMarkers}
            currentSceneType={currentSceneType}
          />
```
Replace with:
```typescript
          <ProgressBar
            progress={progress}
            sceneMarkers={sceneMarkers}
            currentSceneType={currentSceneType}
            sceneName={activeScene?.heading}
            sceneStartFrame={activeScene ? INTRO_DURATION + activeScene.startFrame : undefined}
            totalFrames={totalFrames}
          />
```

- [ ] **Step 3: Pass style config to BgmLayer**

Find:
```typescript
        <BgmLayer syncTimeline={syncTimeline} bgmFile={storyboard.bgmFile} />
```
Replace with:
```typescript
        <BgmLayer
          syncTimeline={syncTimeline}
          bgmFile={storyboard.bgmFile}
          baseVolume={style.bgmVolume}
          trackChangeInterval={style.bgmChangeInterval}
        />
```

- [ ] **Step 4: Verify full compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit`
Expected: No errors across entire project

- [ ] **Step 5: Commit**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add src/compositions/LongVideo.tsx
git commit -m "feat: wire all makeover components into LongVideo.tsx

Connects VideoStyle → CaptionOverlay (captionMode), ProgressBar
(sceneName + milestones), BgmLayer (volume + track interval).
ZoomPunchLayer and transition rotation already wired in earlier tasks."
```

---

## Task 10: Smoke Test & Validation

- [ ] **Step 1: Full TypeScript compilation check**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Start the Remotion studio to visually verify**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx remotion studio`
Expected: Studio opens at localhost:3000. Navigate to LongVideo composition — verify:
- Zoom punches visible (subtle scale every ~4s)
- Captions showing in fireship mode (clean, dark pill)
- Transitions rotating (not same style every time)
- Progress bar milestone shows at 25% mark
- No console errors

- [ ] **Step 3: Test TTS rate param (dry run)**

Run: `cd /Users/racit/PersonalProject/video-pipeline && node -e "const { generateAudio } = require('./src/pipeline/tts-engine'); console.log('Rate param accepted:', generateAudio.length)"`
Expected: Shows function accepts 5 parameters (text, voice, outputName, voiceLanguage, rate)

- [ ] **Step 4: Commit final state**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add -A
git commit -m "chore: complete Long Video Makeover implementation

All 10 components built and wired:
1. VideoStyle config (educational + viral modes)
2. ZoomPunchLayer (auto zoom 1.15x every 3-5s)
3. Dynamic TTS pacing (per-scene rate param)
4. Caption modes (fireship clean + hormozi bounce)
5. Transition variety (8 styles rotating by scene index)
6. BGM multi-track crossfade
7. SFX auto-triggers (typing, ding, impact, chime)
8. Progress bar milestones (25/50/75%)
9. Full LongVideo.tsx wiring

Pipeline score: 7.5/10 → 9/10 viral-grade."
```

---

## Dependency Graph

```
Task 1 (VideoStyle) ──────────────────────────────────────┐
Task 2 (TTS Rate) ──── independent ──────────────────────┤
Task 3 (Captions) ──── independent ──────────────────────┤
Task 4 (Transitions) ── independent ─────────────────────┤
Task 5 (ZoomPunch) ──── depends on Task 1 ───────────────┤
Task 6 (BGM) ────────── independent ─────────────────────┤
Task 7 (SFX) ────────── independent ─────────────────────┤
Task 8 (ProgressBar) ── independent ─────────────────────┤
Task 9 (Wire All) ───── depends on Tasks 1-8 ────────────┘
Task 10 (Smoke Test) ── depends on Task 9
```

**Parallelizable:** Tasks 1-4 can run in parallel. Tasks 5-8 can run in parallel (Task 5 needs Task 1 but Task 1 is fast). Task 9 must wait for all. Task 10 must wait for Task 9.

**Recommended parallel batches:**
- **Batch 1:** Tasks 1, 2, 3, 4 (all independent, P0+P1+P2)
- **Batch 2:** Tasks 5, 6, 7, 8 (all independent after Task 1, P2+P3)
- **Batch 3:** Task 9 (integration, sequential)
- **Batch 4:** Task 10 (validation, sequential)
