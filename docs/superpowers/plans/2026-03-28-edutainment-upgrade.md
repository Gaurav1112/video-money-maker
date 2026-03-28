# Edutainment Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the video pipeline from static slideshows into sync-driven edutainment where every narrated word triggers a corresponding visual change.

**Architecture:** A SyncEngine converts TTS word timestamps + audio scene offsets into a frame-level timeline. Scene components subscribe via a `useSync()` hook and animate reactively. Background music and sound effects layer on top as composition-level audio components.

**Tech Stack:** Remotion 4 (React 19), TypeScript, edge-tts-node, ffmpeg, Remotion `interpolate()`/`spring()`

**Spec:** `docs/superpowers/specs/2026-03-28-edutainment-upgrade-design.md`

---

## File Structure Overview

**New files (15):**
- `src/lib/sync-engine.ts` — Core sync timeline builder (pure data, no React)
- `src/hooks/useSync.ts` — React hook returning `SyncState` per scene
- `src/components/SplitLayout.tsx` — 55/45 wrapper for text/interview scenes
- `src/components/ConceptViz.tsx` — Topic→visualization router
- `src/components/MetricCounter.tsx` — Animated number counter
- `src/components/BgmLayer.tsx` — Background music with sidechain ducking
- `src/components/SfxLayer.tsx` — Composition-level SFX renderer
- `src/components/viz/KeywordCloud.tsx` — Generic fallback visualization
- `src/components/viz/TrafficFlow.tsx` — Load balancing visualization
- `src/components/viz/HashTableViz.tsx` — Hash map visualization
- `src/components/viz/SystemArchViz.tsx` — System design visualization
- `src/components/viz/MetricDashboard.tsx` — Generic metric visualization
- `src/components/viz/TreeViz.tsx` — Binary tree visualization
- `src/components/viz/SortingViz.tsx` — Sorting algorithm visualization
- `src/__tests__/sync-engine.test.ts` — SyncEngine unit tests

**Modified files (11):**
- `src/types.ts` — Add AnimationCue, SfxTrigger, SyncTimeline, WordTimestamp types
- `src/pipeline/tts-engine.ts` — Real word timestamps from Edge TTS VTT + char-proportional fallback
- `src/pipeline/audio-stitcher.ts` — Minor: ensure sceneOffsets handles -1 gracefully
- `src/pipeline/storyboard.ts` — Audio-driven scene timing, store wordTimestamps
- `src/pipeline/script-generator.ts` — Generate animationCues[] and sfxTriggers[] per scene
- `src/components/CodeReveal.tsx` — Sync-driven line typing via useSync()
- `src/components/TextSection.tsx` — BulletReveal with phrase-synced reveals
- `src/components/ComparisonTable.tsx` — Row-by-row reveal synced to narration
- `src/components/DiagramSlide.tsx` — Progressive node/edge reveal
- `src/compositions/LongVideo.tsx` — Add BgmLayer, SfxLayer, sync-driven timing
- `src/compositions/ShortVideo.tsx` — Same changes as LongVideo

**New asset directories:**
- `public/audio/bgm/` — 4 CC0 lo-fi MP3 loops
- `public/audio/sfx/` — ~15 CC0 WAV sound effects

---

### Task 1: Add New Types

**Files:**
- Modify: `src/types.ts`
- Test: manual TypeScript compilation check

- [ ] **Step 1: Add WordTimestamp, AnimationCue, SfxTrigger, SyncTimeline types**

Add to the end of `src/types.ts` (after line 56):

```typescript
export interface WordTimestamp {
  word: string;
  start: number;  // seconds relative to scene audio start
  end: number;    // seconds relative to scene audio start
}

export interface AnimationCue {
  wordIndex: number;
  action: string;
  target?: string | number;
}

export interface SfxTrigger {
  sceneIndex: number;
  wordIndex: number;
  effect: string;
  volume?: number;
}

export interface SyncState {
  currentWord: string;
  wordIndex: number;
  sceneProgress: number;
  phraseBoundaries: number[];
  isNarrating: boolean;
  wordsSpoken: number;
}
```

- [ ] **Step 2: Extend Scene and Storyboard interfaces**

In `src/types.ts`, add new optional fields to the `Scene` interface (after line 15, before the closing `}`):

```typescript
  wordTimestamps?: WordTimestamp[];
  animationCues?: AnimationCue[];
  sfxTriggers?: SfxTrigger[];
```

Add new fields to the `Storyboard` interface (after line 30, before the closing `}`):

```typescript
  sceneOffsets: number[];
  allSfxTriggers: SfxTrigger[];
```

- [ ] **Step 3: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/types.ts
git commit -m "feat: add sync engine types (WordTimestamp, AnimationCue, SfxTrigger, SyncState)"
```

---

### Task 2: Real Word Timestamps (Phase 0)

**Files:**
- Modify: `src/pipeline/tts-engine.ts` (lines 185-196: `makeTimestamps()`, lines 47-87: `edgeTTS()`)
- Test: `src/__tests__/tts-timestamps.test.ts`

- [ ] **Step 1: Write test for character-proportional timestamp fallback**

Create `src/__tests__/tts-timestamps.test.ts`:

```typescript
import { makeTimestampsProportional } from '../pipeline/tts-engine';

describe('makeTimestampsProportional', () => {
  it('distributes timestamps by character count, not evenly', () => {
    const text = 'A longword short';
    const duration = 3.0;
    const result = makeTimestampsProportional(text, duration);

    expect(result).toHaveLength(3);
    expect(result[0].word).toBe('A');
    expect(result[1].word).toBe('longword');
    expect(result[2].word).toBe('short');

    // 'A' is 1 char, 'longword' is 8, 'short' is 5 → total 14
    // 'A' should get ~1/14 of duration (~0.214s)
    // 'longword' should get ~8/14 (~1.714s)
    expect(result[0].end - result[0].start).toBeLessThan(0.5);
    expect(result[1].end - result[1].start).toBeGreaterThan(1.0);

    // Timestamps should be contiguous
    expect(result[0].start).toBe(0);
    expect(result[1].start).toBeCloseTo(result[0].end, 2);
    expect(result[2].end).toBeCloseTo(duration, 2);
  });

  it('handles single word', () => {
    const result = makeTimestampsProportional('hello', 1.0);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ word: 'hello', start: 0, end: 1.0 });
  });

  it('handles empty text', () => {
    const result = makeTimestampsProportional('', 1.0);
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx jest src/__tests__/tts-timestamps.test.ts --no-cache`
Expected: FAIL — `makeTimestampsProportional` is not exported

- [ ] **Step 3: Implement character-proportional fallback**

In `src/pipeline/tts-engine.ts`, replace `makeTimestamps()` (lines 185-196) with:

```typescript
/** Distribute timestamps proportionally by character count (better than uniform) */
export function makeTimestampsProportional(
  text: string,
  duration: number,
): Array<{ word: string; start: number; end: number }> {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return [];

  const totalChars = words.reduce((sum, w) => sum + w.length, 0);
  const timestamps: Array<{ word: string; start: number; end: number }> = [];
  let currentTime = 0;

  for (const word of words) {
    const wordDuration = (word.length / totalChars) * duration;
    timestamps.push({
      word,
      start: currentTime,
      end: currentTime + wordDuration,
    });
    currentTime += wordDuration;
  }

  return timestamps;
}
```

Also update the old `makeTimestamps()` to call this internally while **preserving its existing signature** (it returns `TTSResult` and takes `audioPath`):

```typescript
function makeTimestamps(text: string, duration: number, audioPath: string): TTSResult {
  return {
    audioPath,
    wordTimestamps: makeTimestampsProportional(text, duration),
    duration,
  };
}
```

**IMPORTANT:** Do NOT change the function signature of `makeTimestamps()`. It is called by `kokoroTTS()`, `edgeTTS()`, `macosTTS()`, and `silentFallback()` — all passing 3 args and expecting `TTSResult` back.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx jest src/__tests__/tts-timestamps.test.ts --no-cache`
Expected: PASS

- [ ] **Step 5: Add Edge TTS VTT parsing for real timestamps**

In `src/pipeline/tts-engine.ts`, add a VTT parser function (after the makeTimestampsProportional function):

```typescript
/** Parse Edge TTS VTT subtitle output into WordTimestamp array */
export function parseVttTimestamps(
  vttContent: string,
): Array<{ word: string; start: number; end: number }> {
  const timestamps: Array<{ word: string; start: number; end: number }> = [];
  // VTT format: "00:00:01.234 --> 00:00:02.345\nword"
  const cuePattern = /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})\s*\n(.+)/g;
  let match;

  while ((match = cuePattern.exec(vttContent)) !== null) {
    const start = parseVttTime(match[1]);
    const end = parseVttTime(match[2]);
    const text = match[3].trim();
    // Split multi-word cues into individual words
    const words = text.split(/\s+/);
    if (words.length === 1) {
      timestamps.push({ word: text, start, end });
    } else {
      // Distribute evenly within the cue
      const cueDuration = end - start;
      words.forEach((w, i) => {
        timestamps.push({
          word: w,
          start: start + (i / words.length) * cueDuration,
          end: start + ((i + 1) / words.length) * cueDuration,
        });
      });
    }
  }

  return timestamps;
}

function parseVttTime(time: string): number {
  const [h, m, rest] = time.split(':');
  const [s, ms] = rest.split('.');
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
}
```

- [ ] **Step 6: Update edgeTTS() to capture VTT timestamps when available**

In the `edgeTTS()` function (around line 47-87), after the audio is generated, check if a VTT file was produced alongside it. If so, parse it:

```typescript
// After existing audio generation, check for VTT sidecar
const vttPath = audioPath.replace(/\.\w+$/, '.vtt');
let wordTimestamps: Array<{ word: string; start: number; end: number }>;
try {
  const vttContent = await fs.readFile(vttPath, 'utf-8');
  wordTimestamps = parseVttTimestamps(vttContent);
} catch {
  // No VTT available, fall back to proportional
  wordTimestamps = makeTimestampsProportional(text, duration);
}
```

Note: The `edge-tts-node` package may not produce VTT files automatically. If it doesn't, the proportional fallback kicks in. This can be upgraded later when a subtitle-capable Edge TTS wrapper is available.

- [ ] **Step 7: Commit**

```bash
git add src/pipeline/tts-engine.ts src/__tests__/tts-timestamps.test.ts
git commit -m "feat: add character-proportional word timestamps + VTT parser for Edge TTS"
```

---

### Task 3: SyncEngine (Core)

**Files:**
- Create: `src/lib/sync-engine.ts`
- Create: `src/__tests__/sync-engine.test.ts`

- [ ] **Step 1: Write SyncEngine tests**

Create `src/__tests__/sync-engine.test.ts`:

```typescript
import { SyncTimeline } from '../lib/sync-engine';

describe('SyncTimeline', () => {
  const fps = 30;
  const INTRO_FRAMES = 90;

  // Scene 0: starts at 0s, words at 0.0-0.5, 0.5-1.0, 1.0-1.5
  // Scene 1: starts at 2.0s, words at 0.0-0.8, 0.8-1.5
  const sceneOffsets = [0, 2.0];
  const wordTimestamps = [
    [
      { word: 'hello', start: 0.0, end: 0.5 },
      { word: 'world', start: 0.5, end: 1.0 },
      { word: 'test', start: 1.0, end: 1.5 },
    ],
    [
      { word: 'second', start: 0.0, end: 0.8 },
      { word: 'scene', start: 0.8, end: 1.5 },
    ],
  ];

  let timeline: SyncTimeline;

  beforeEach(() => {
    timeline = new SyncTimeline(sceneOffsets, wordTimestamps, fps, INTRO_FRAMES);
  });

  describe('getSyncState', () => {
    it('returns correct word at scene 0, frame 0 (relative)', () => {
      // Frame 0 within scene 0 → word "hello" (0.0-0.5s = frames 0-15)
      const state = timeline.getSyncState(0, 5);
      expect(state.currentWord).toBe('hello');
      expect(state.wordIndex).toBe(0);
      expect(state.isNarrating).toBe(true);
    });

    it('returns correct word mid-scene', () => {
      // Frame 20 within scene 0 → 20/30=0.67s → word "world" (0.5-1.0s)
      const state = timeline.getSyncState(0, 20);
      expect(state.currentWord).toBe('world');
      expect(state.wordIndex).toBe(1);
      expect(state.wordsSpoken).toBe(2);
    });

    it('returns not narrating in gap after last word', () => {
      // Frame 50 within scene 0 → 50/30=1.67s → after "test" ends at 1.5s
      const state = timeline.getSyncState(0, 50);
      expect(state.isNarrating).toBe(false);
    });

    it('computes sceneProgress correctly', () => {
      // Scene 0 goes from offset 0 to offset 2.0 → 60 frames of audio
      const state = timeline.getSyncState(0, 30);
      expect(state.sceneProgress).toBeCloseTo(0.5, 1);
    });
  });

  describe('wordIndexToAbsoluteFrame', () => {
    it('computes absolute frame for scene 0 word 0', () => {
      // Scene 0 offset = 0s → abs frame = INTRO + 0 = 90
      const frame = timeline.wordIndexToAbsoluteFrame(0, 0);
      expect(frame).toBe(INTRO_FRAMES); // 90
    });

    it('computes absolute frame for scene 1 word 1', () => {
      // Scene 1 offset = 2.0s → abs = 90 + 60 = 150
      // Word 1 starts at 0.8s within scene → +24 frames
      const frame = timeline.wordIndexToAbsoluteFrame(1, 1);
      expect(frame).toBe(INTRO_FRAMES + 60 + 24); // 174
    });
  });

  describe('isFrameInNarration', () => {
    it('returns true during narration', () => {
      // Absolute frame 100 = INTRO(90) + 10 → scene 0, 10/30=0.33s → within "hello" (0-0.5s)
      expect(timeline.isFrameInNarration(100)).toBe(true);
    });

    it('returns false in gap between scenes', () => {
      // Absolute frame 135 = INTRO(90) + 45 → scene 0, 45/30=1.5s → after last word ends
      expect(timeline.isFrameInNarration(135)).toBe(false);
    });

    it('returns false before intro ends', () => {
      expect(timeline.isFrameInNarration(50)).toBe(false);
    });
  });

  describe('getPhraseBoundaries', () => {
    it('detects sentence boundaries', () => {
      const narration = 'Hello world. This is a test. Final sentence';
      const boundaries = SyncTimeline.computePhraseBoundaries(narration);
      // "Hello world." → boundary at word index 1
      // "This is a test." → boundary at word index 5
      expect(boundaries).toContain(1);
      expect(boundaries).toContain(5);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx jest src/__tests__/sync-engine.test.ts --no-cache`
Expected: FAIL — module not found

- [ ] **Step 3: Implement SyncTimeline class**

Create `src/lib/sync-engine.ts`:

```typescript
import type { WordTimestamp } from '../types';

export class SyncTimeline {
  private sceneOffsets: number[];
  private wordTimestamps: WordTimestamp[][];
  private fps: number;
  private introFrames: number;
  private sceneDurationsInSeconds: number[];

  constructor(
    sceneOffsets: number[],
    wordTimestamps: WordTimestamp[][],
    fps: number,
    introFrames: number,
  ) {
    this.sceneOffsets = sceneOffsets;
    this.wordTimestamps = wordTimestamps;
    this.fps = fps;
    this.introFrames = introFrames;

    // Precompute scene durations (time between consecutive offsets)
    this.sceneDurationsInSeconds = sceneOffsets.map((offset, i) => {
      if (i < sceneOffsets.length - 1) {
        return sceneOffsets[i + 1] - offset;
      }
      // Last scene: use last word's end time + 1s breathing room
      const lastWords = wordTimestamps[i];
      if (lastWords && lastWords.length > 0) {
        return lastWords[lastWords.length - 1].end + 1.0;
      }
      return 8; // fallback 8 seconds
    });
  }

  /**
   * Get sync state for a scene at a given relative frame (within the scene).
   */
  getSyncState(sceneIndex: number, relativeFrame: number): {
    currentWord: string;
    wordIndex: number;
    sceneProgress: number;
    phraseBoundaries: number[];
    isNarrating: boolean;
    wordsSpoken: number;
  } {
    const words = this.wordTimestamps[sceneIndex] || [];
    const sceneDuration = this.sceneDurationsInSeconds[sceneIndex] || 8;
    const currentTimeInScene = relativeFrame / this.fps;

    let currentWord = '';
    let wordIndex = -1;
    let wordsSpoken = 0;
    let isNarrating = false;

    for (let i = 0; i < words.length; i++) {
      if (currentTimeInScene >= words[i].start && currentTimeInScene < words[i].end) {
        currentWord = words[i].word;
        wordIndex = i;
        isNarrating = true;
      }
      if (currentTimeInScene >= words[i].start) {
        wordsSpoken = i + 1;
      }
    }

    // If we're between words but within the narration window, still narrating
    if (!isNarrating && words.length > 0) {
      const lastWord = words[words.length - 1];
      if (currentTimeInScene < lastWord.end && currentTimeInScene >= words[0].start) {
        isNarrating = true;
        // Find the closest word before current time
        for (let i = words.length - 1; i >= 0; i--) {
          if (currentTimeInScene >= words[i].start) {
            wordIndex = i;
            currentWord = words[i].word;
            break;
          }
        }
      }
    }

    const sceneProgress = Math.min(1, currentTimeInScene / sceneDuration);

    // Compute phrase boundaries from narration text
    const fullNarration = words.map(w => w.word).join(' ');
    const phraseBoundaries = SyncTimeline.computePhraseBoundaries(fullNarration);

    return {
      currentWord,
      wordIndex: Math.max(0, wordIndex),
      sceneProgress,
      phraseBoundaries,
      isNarrating,
      wordsSpoken,
    };
  }

  /**
   * Convert a word index in a scene to an absolute composition frame.
   */
  wordIndexToAbsoluteFrame(sceneIndex: number, wordIndex: number): number {
    const sceneOffset = this.sceneOffsets[sceneIndex] || 0;
    const words = this.wordTimestamps[sceneIndex] || [];
    const wordStart = words[wordIndex]?.start || 0;
    return this.introFrames + Math.round((sceneOffset + wordStart) * this.fps);
  }

  /**
   * Check if a given absolute frame falls within any narration.
   */
  isFrameInNarration(absoluteFrame: number): boolean {
    if (absoluteFrame < this.introFrames) return false;

    const timeInMaster = (absoluteFrame - this.introFrames) / this.fps;

    for (let i = 0; i < this.sceneOffsets.length; i++) {
      const sceneStart = this.sceneOffsets[i];
      const words = this.wordTimestamps[i] || [];
      if (words.length === 0) continue;

      const firstWordAbsStart = sceneStart + words[0].start;
      const lastWordAbsEnd = sceneStart + words[words.length - 1].end;

      if (timeInMaster >= firstWordAbsStart && timeInMaster < lastWordAbsEnd) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get scene duration in frames for use by storyboard/composition.
   */
  getSceneDurationFrames(sceneIndex: number): number {
    return Math.round(this.sceneDurationsInSeconds[sceneIndex] * this.fps);
  }

  /**
   * Detect phrase boundaries from narration text.
   * Splits on sentence-ending punctuation and clause breaks.
   */
  static computePhraseBoundaries(narration: string): number[] {
    const words = narration.split(/\s+/).filter(w => w.length > 0);
    const boundaries: number[] = [];

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      // Sentence endings
      if (/[.!?;:]$/.test(word)) {
        boundaries.push(i);
      }
      // Clause breaks: ", and", ", but", ", or"
      if (
        word.endsWith(',') &&
        i + 1 < words.length &&
        /^(and|but|or)$/i.test(words[i + 1])
      ) {
        boundaries.push(i);
      }
    }

    return boundaries;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx jest src/__tests__/sync-engine.test.ts --no-cache`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync-engine.ts src/__tests__/sync-engine.test.ts
git commit -m "feat: implement SyncTimeline with frame-level word sync, phrase boundaries, narration detection"
```

---

### Task 4: useSync() React Hook

**Files:**
- Create: `src/hooks/useSync.ts`

- [ ] **Step 1: Create hooks directory and useSync hook**

Create `src/hooks/useSync.ts`:

```typescript
import { useCurrentFrame } from 'remotion';
import { SyncTimeline } from '../lib/sync-engine';
import type { SyncState } from '../types';

// Module-level singleton — set once by the composition, read by all components
let globalTimeline: SyncTimeline | null = null;

export function setSyncTimeline(timeline: SyncTimeline): void {
  globalTimeline = timeline;
}

/**
 * React hook that returns sync state for a given scene.
 * Uses Remotion's useCurrentFrame() to determine the current position,
 * then delegates to SyncTimeline for word-level sync data.
 *
 * @param sceneIndex - Index of the current scene in the storyboard
 * @param sceneStartFrame - Absolute start frame of this scene in the composition
 */
export function useSync(sceneIndex: number, sceneStartFrame: number): SyncState {
  const frame = useCurrentFrame();

  if (!globalTimeline) {
    return {
      currentWord: '',
      wordIndex: 0,
      sceneProgress: 0,
      phraseBoundaries: [],
      isNarrating: false,
      wordsSpoken: 0,
    };
  }

  const relativeFrame = frame - sceneStartFrame;
  return globalTimeline.getSyncState(sceneIndex, Math.max(0, relativeFrame));
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit`
Expected: No errors (or only pre-existing errors)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSync.ts
git commit -m "feat: add useSync() hook for scene-level sync state"
```

---

### Task 5: Refactor Storyboard to Audio-Driven Timing

**Files:**
- Modify: `src/pipeline/storyboard.ts` (lines 25-90: duration calculation logic)
- Modify: `src/lib/constants.ts` (add INTRO_DURATION, OUTRO_DURATION, TRANSITION_DURATION as named exports)

- [ ] **Step 1: Add named constants**

In `src/lib/constants.ts`, add at the end of the file (after the closing `};`):

```typescript
export const INTRO_DURATION = 90;  // frames (3 seconds)
export const OUTRO_DURATION = 150; // frames (5 seconds)
export const TRANSITION_DURATION = 15; // frames (0.5 seconds)
```

**NOTE:** `LongVideo.tsx` defines local `INTRO_DURATION` and `OUTRO_DURATION` constants (lines 28-29). Task 19 must remove these local declarations and import from constants instead to avoid duplication.

- [ ] **Step 2: Refactor storyboard duration calculation**

In `src/pipeline/storyboard.ts`, the `generateStoryboard()` function currently computes scene durations based on audio + breathing room (around lines 36-70). Replace the scene duration logic to use audio offsets as single source of truth.

Replace the per-scene duration computation block with:

```typescript
// Audio-driven scene timing: sceneOffsets are the single source of truth
for (let i = 0; i < scenes.length; i++) {
  const offset = sceneOffsets[i] ?? -1;

  if (offset === -1) {
    // No audio for this scene — use type-based default
    const defaults: Record<string, number> = {
      title: 10, code: 15, text: 8, diagram: 10,
      table: 8, interview: 8, review: 10, summary: 8,
    };
    scenes[i].duration = defaults[scenes[i].type] || 8;
  } else if (i < scenes.length - 1 && sceneOffsets[i + 1] !== undefined && sceneOffsets[i + 1] !== -1) {
    scenes[i].duration = sceneOffsets[i + 1] - offset;
  } else {
    // Last scene: use word timestamps end + breathing room
    const words = audioResults[i]?.wordTimestamps || [];
    const lastWordEnd = words.length > 0 ? words[words.length - 1].end : 0;
    scenes[i].duration = lastWordEnd + 1.5;
  }

  // Store word timestamps on scene for useSync() consumption
  scenes[i].wordTimestamps = audioResults[i]?.wordTimestamps || [];

  // Compute frame ranges
  const durationFrames = Math.round(scenes[i].duration * fps) + TRANSITION_DURATION;
  scenes[i].startFrame = currentFrame;
  scenes[i].endFrame = currentFrame + durationFrames;
  currentFrame += durationFrames;
}
```

Import `TRANSITION_DURATION` from constants at the top of the file.

- [ ] **Step 3: Store sceneOffsets and allSfxTriggers on Storyboard**

In the storyboard return object, add:

```typescript
sceneOffsets,
allSfxTriggers: scenes.flatMap((s, i) =>
  (s.sfxTriggers || []).map(t => ({ ...t, sceneIndex: i }))
),
```

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/storyboard.ts src/lib/constants.ts
git commit -m "feat: refactor storyboard to audio-driven timing with sceneOffsets as single source of truth"
```

---

### Task 6: Audio Assets (BGM + SFX Placeholders)

**Files:**
- Create: `public/audio/bgm/` directory with placeholder MP3 files
- Create: `public/audio/sfx/` directory with placeholder WAV files

Note: Real CC0 audio files need to be sourced separately. For now, create silent placeholder files so the pipeline doesn't crash when referencing them.

- [ ] **Step 1: Create directory structure and generate silent placeholders**

```bash
cd /Users/racit/PersonalProject/video-pipeline
mkdir -p public/audio/bgm public/audio/sfx

# Generate silent BGM placeholders (5 seconds each, MP3)
for f in lofi-study-1 lofi-study-2 lofi-chill-1 lofi-ambient-1; do
  ffmpeg -f lavfi -i anullsrc=r=48000:cl=stereo -t 5 -q:a 9 "public/audio/bgm/${f}.mp3" -y 2>/dev/null
done

# Generate silent SFX placeholders (0.5 seconds each, WAV)
for f in whoosh-in whoosh-out swoosh pop click soft-tap keyboard-click keyboard-burst ding chime shimmer success-chime level-up subtle-pulse tension-build; do
  ffmpeg -f lavfi -i anullsrc=r=48000:cl=stereo -t 0.5 "public/audio/sfx/${f}.wav" -y 2>/dev/null
done
```

- [ ] **Step 2: Create SFX duration map**

Create `src/lib/sfx-durations.ts`:

```typescript
/** Duration in frames (at 30fps) for each SFX file */
export const SFX_DURATIONS: Record<string, number> = {
  'whoosh-in': 12,      // 0.4s
  'whoosh-out': 9,      // 0.3s
  'swoosh': 9,          // 0.3s
  'pop': 6,             // 0.2s
  'click': 3,           // 0.1s
  'soft-tap': 5,        // 0.15s
  'keyboard-click': 5,  // 0.15s
  'keyboard-burst': 15, // 0.5s
  'ding': 15,           // 0.5s
  'chime': 24,          // 0.8s
  'shimmer': 18,        // 0.6s
  'success-chime': 36,  // 1.2s
  'level-up': 45,       // 1.5s
  'subtle-pulse': 12,   // 0.4s
  'tension-build': 30,  // 1.0s
};

export function sfxDuration(effect: string): number {
  return SFX_DURATIONS[effect] || 15; // default 0.5s
}
```

- [ ] **Step 3: Commit**

```bash
git add public/audio/ src/lib/sfx-durations.ts
git commit -m "feat: add audio asset directories with silent placeholders + SFX duration map"
```

---

### Task 7: BgmLayer Component

**Files:**
- Create: `src/components/BgmLayer.tsx`

- [ ] **Step 1: Implement BgmLayer**

Create `src/components/BgmLayer.tsx`:

```typescript
import React from 'react';
import { Audio, interpolate, useCurrentFrame, useVideoConfig, staticFile, Sequence } from 'remotion';
import { SyncTimeline } from '../lib/sync-engine';

interface BgmLayerProps {
  syncTimeline: SyncTimeline;
  bgmFile: string; // e.g. 'audio/bgm/lofi-study-1.mp3'
}

export const BgmLayer: React.FC<BgmLayerProps> = ({ syncTimeline, bgmFile }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const volume = React.useCallback(
    (f: number) => {
      // Fade in over first 60 frames (2s)
      const fadeIn = interpolate(f, [0, 60], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

      // Fade out over last 90 frames (3s)
      const fadeOut = interpolate(
        f,
        [durationInFrames - 90, durationInFrames],
        [1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      );

      // Sidechain ducking: 8% when narrating, 25% in gaps
      // Smooth over 10 frames by checking nearby frames for transition ramp
      const isNarrating = syncTimeline.isFrameInNarration(f);
      const wasNarrating = f > 0 ? syncTimeline.isFrameInNarration(f - 1) : false;

      // Find how many consecutive frames we've been in current state (up to 10)
      let framesInState = 0;
      for (let i = 0; i < 10; i++) {
        if (syncTimeline.isFrameInNarration(f - i) === isNarrating) {
          framesInState++;
        } else {
          break;
        }
      }

      // Interpolate between 0.08 and 0.25 over 10 frames
      const duckProgress = Math.min(1, framesInState / 10);
      const targetVolume = isNarrating
        ? interpolate(duckProgress, [0, 1], [0.25, 0.08])
        : interpolate(duckProgress, [0, 1], [0.08, 0.25]);

      return fadeIn * fadeOut * targetVolume;
    },
    [syncTimeline, durationInFrames],
  );

  return (
    <Audio
      src={staticFile(bgmFile)}
      volume={volume}
      loop
    />
  );
};
```

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/BgmLayer.tsx
git commit -m "feat: add BgmLayer with sidechain ducking (8% narrating, 25% gaps)"
```

---

### Task 8: SfxLayer Component

**Files:**
- Create: `src/components/SfxLayer.tsx`

- [ ] **Step 1: Implement SfxLayer**

Create `src/components/SfxLayer.tsx`:

```typescript
import React from 'react';
import { Sequence, Audio, staticFile } from 'remotion';
import { SyncTimeline } from '../lib/sync-engine';
import { sfxDuration } from '../lib/sfx-durations';
import type { SfxTrigger } from '../types';

interface SfxLayerProps {
  triggers: SfxTrigger[];
  syncTimeline: SyncTimeline;
}

export const SfxLayer: React.FC<SfxLayerProps> = ({ triggers, syncTimeline }) => {
  return (
    <>
      {triggers.map((trigger, i) => {
        const frame = syncTimeline.wordIndexToAbsoluteFrame(
          trigger.sceneIndex,
          trigger.wordIndex,
        );
        const duration = sfxDuration(trigger.effect);

        return (
          <Sequence key={`sfx-${i}`} from={frame} durationInFrames={duration}>
            <Audio
              src={staticFile(`audio/sfx/${trigger.effect}.wav`)}
              volume={trigger.volume ?? 1.0}
            />
          </Sequence>
        );
      })}
    </>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SfxLayer.tsx
git commit -m "feat: add SfxLayer for composition-level sound effects"
```

---

### Task 9: SplitLayout + ConceptViz Router

**Files:**
- Create: `src/components/SplitLayout.tsx`
- Create: `src/components/ConceptViz.tsx`
- Create: `src/components/viz/KeywordCloud.tsx` (generic fallback)

- [ ] **Step 1: Implement SplitLayout**

Create `src/components/SplitLayout.tsx`:

```typescript
import React from 'react';
import type { ReactNode } from 'react';

interface SplitLayoutProps {
  left: ReactNode;
  right: ReactNode;
  leftWidth?: string;
  rightWidth?: string;
}

export const SplitLayout: React.FC<SplitLayoutProps> = ({
  left,
  right,
  leftWidth = '55%',
  rightWidth = '45%',
}) => {
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <div style={{ flex: `0 0 ${leftWidth}`, overflow: 'hidden' }}>{left}</div>
      <div style={{ flex: `0 0 ${rightWidth}`, overflow: 'hidden' }}>{right}</div>
    </div>
  );
};
```

- [ ] **Step 2: Implement KeywordCloud fallback visualization**

Create `src/components/viz/KeywordCloud.tsx`:

```typescript
import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';
import type { SyncState } from '../../types';
import { THEME } from '../../lib/theme';

interface KeywordCloudProps {
  sync: SyncState;
  keywords: string[];
  frame: number;
}

export const KeywordCloud: React.FC<KeywordCloudProps> = ({ sync, keywords, frame }) => {
  const { fps } = useVideoConfig();
  const displayKeywords = keywords.length > 0 ? keywords : ['concept', 'learn', 'build', 'code'];

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
      }}
    >
      {displayKeywords.map((keyword, i) => {
        const isCurrentWord =
          sync.currentWord.toLowerCase().includes(keyword.toLowerCase()) ||
          keyword.toLowerCase().includes(sync.currentWord.toLowerCase());

        const baseScale = spring({
          frame: frame - i * 8,
          fps,
          config: { damping: 15, stiffness: 100 },
        });

        const pulseScale = isCurrentWord ? 1.3 : 1.0;
        const color = isCurrentWord ? THEME.colors.saffron : THEME.colors.gray;
        const opacity = interpolate(baseScale, [0, 1], [0, isCurrentWord ? 1 : 0.5]);

        return (
          <span
            key={keyword}
            style={{
              fontSize: isCurrentWord ? 32 : 20,
              fontWeight: isCurrentWord ? 700 : 400,
              color,
              opacity,
              transform: `scale(${baseScale * pulseScale})`,
              fontFamily: THEME.fonts.heading,
              // NOTE: Do NOT use CSS transitions — Remotion renders frame-by-frame, CSS transitions have no effect in rendered MP4
            }}
          >
            {keyword}
          </span>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 3: Implement ConceptViz router**

Create `src/components/ConceptViz.tsx`:

```typescript
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { useSync } from '../hooks/useSync';
import { KeywordCloud } from './viz/KeywordCloud';
import type { SyncState } from '../types';

// Topic → visualization component mapping
// Start with KeywordCloud as default, add specific viz components in later tasks
const TOPIC_VIZ_MAP: Record<string, React.FC<{ sync: SyncState; frame: number; keywords: string[] }>> = {
  // Will be populated in Tasks 13-15
};

function getVisualization(topic: string) {
  const normalizedTopic = topic.toLowerCase().replace(/[^a-z0-9]/g, '-');

  for (const [key, component] of Object.entries(TOPIC_VIZ_MAP)) {
    if (normalizedTopic.includes(key)) return component;
  }

  return KeywordCloud; // fallback
}

interface ConceptVizProps {
  topic: string;
  sceneIndex: number;
  sceneStartFrame: number;
  keywords?: string[];
}

export const ConceptViz: React.FC<ConceptVizProps> = ({
  topic,
  sceneIndex,
  sceneStartFrame,
  keywords = [],
}) => {
  const frame = useCurrentFrame();
  const sync = useSync(sceneIndex, sceneStartFrame);
  const Viz = getVisualization(topic);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Viz sync={sync} frame={frame} keywords={keywords} />
    </div>
  );
};
```

- [ ] **Step 4: Commit**

```bash
git add src/components/SplitLayout.tsx src/components/ConceptViz.tsx src/components/viz/KeywordCloud.tsx
git commit -m "feat: add SplitLayout, ConceptViz router, and KeywordCloud fallback visualization"
```

---

### Task 10: Rewrite CodeReveal with Sync-Driven Animations

**Files:**
- Modify: `src/components/CodeReveal.tsx` (lines 229-239: reveal logic, lines 487-506: typing logic)

- [ ] **Step 1: Add useSync integration to CodeReveal**

In `src/components/CodeReveal.tsx`, add imports at the top:

```typescript
import { useSync } from '../hooks/useSync';
import { Sequence, Audio, staticFile } from 'remotion';
```

Add new props to the component interface:

```typescript
interface CodeRevealProps {
  // ... existing props ...
  sceneIndex?: number;
  sceneStartFrame?: number;
  animationCues?: Array<{ wordIndex: number; action: string; target?: string | number }>;
}
```

- [ ] **Step 2: Replace frame-based line reveal with sync-driven reveal**

In the component body, replace the existing line reveal logic (around line 231):

```typescript
// OLD: const currentRevealLine = Math.floor(Math.max(0, (frame - startFrame - 20)) / framesPerLine);

// NEW: Sync-driven line reveal
// IMPORTANT: Always call useSync unconditionally (React Rules of Hooks).
// Pass sceneIndex/sceneStartFrame with defaults — the hook returns empty state when no timeline is set.
const sync = useSync(sceneIndex ?? 0, sceneStartFrame ?? startFrame);

let currentRevealLine: number;
const hasSyncData = sync.isNarrating || sync.wordsSpoken > 0;
if (hasSyncData && animationCues && animationCues.length > 0) {
  // Find the latest 'typeLine' cue that's been reached
  const typeLineCues = animationCues.filter(c => c.action === 'typeLine');
  const reachedCues = typeLineCues.filter(c => sync.wordIndex >= c.wordIndex);
  if (reachedCues.length > 0) {
    const lastCue = reachedCues[reachedCues.length - 1];
    currentRevealLine = typeof lastCue.target === 'number' ? lastCue.target : lines.length;
  } else {
    currentRevealLine = 0;
  }
} else {
  // Fallback: time-based reveal (backward compat)
  currentRevealLine = Math.floor(Math.max(0, (frame - startFrame - 20)) / framesPerLine);
}
```

- [ ] **Step 3: Add auto-triggered keyboard SFX**

Within the render, add keyboard burst SFX for each line reveal. The SFX frame is computed from the word timestamps in `sync`:

```typescript
{/* Auto-triggered keyboard burst SFX — fires when each code line starts typing */}
{animationCues && animationCues
  .filter(c => c.action === 'typeLine')
  .map((cue, i) => {
    // Use scene-relative frame based on sync progress:
    // Each cue fires when wordIndex reaches cue.wordIndex
    // Approximate the frame using word position ratio * scene duration
    const totalWords = sync.phraseBoundaries.length > 0
      ? sync.phraseBoundaries[sync.phraseBoundaries.length - 1] + 1
      : 30; // fallback estimate
    const sceneFrames = endFrame - startFrame;
    const cueFrame = Math.round((cue.wordIndex / totalWords) * sceneFrames);

    return (
      <Sequence key={`kb-${i}`} from={cueFrame} durationInFrames={15}>
        <Audio src={staticFile('audio/sfx/keyboard-burst.wav')} volume={0.3} />
      </Sequence>
    );
  })
}
```

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/CodeReveal.tsx
git commit -m "feat: rewrite CodeReveal with sync-driven line reveal and keyboard SFX"
```

---

### Task 11: Rewrite TextSection as BulletReveal

**Files:**
- Modify: `src/components/TextSection.tsx` (full rewrite)

- [ ] **Step 1: Rewrite TextSection with sync-driven bullet reveals**

Replace the content of `src/components/TextSection.tsx`:

```typescript
import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Sequence,
  Audio,
  staticFile,
} from 'remotion';
import { useSync } from '../hooks/useSync';
import { THEME } from '../lib/theme';
import type { AnimationCue } from '../types';

interface TextSectionProps {
  heading: string;
  bullets: string[];
  startFrame: number;
  endFrame: number;
  sceneIndex?: number;
  sceneStartFrame?: number;
  animationCues?: AnimationCue[];
}

export const TextSection: React.FC<TextSectionProps> = ({
  heading,
  bullets,
  startFrame,
  endFrame,
  sceneIndex,
  sceneStartFrame,
  animationCues,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Always call hook unconditionally (React Rules of Hooks)
  const sync = useSync(sceneIndex ?? 0, sceneStartFrame ?? startFrame);

  // Determine which bullets are visible
  const hasSyncData = sync.isNarrating || sync.wordsSpoken > 0;
  const getVisibleBullets = (): number => {
    if (hasSyncData && sync.phraseBoundaries.length > 0) {
      // Sync-driven: reveal one bullet per phrase boundary
      let visible = 0;
      for (let i = 0; i < sync.phraseBoundaries.length && i < bullets.length; i++) {
        if (sync.wordIndex >= sync.phraseBoundaries[i]) {
          visible = i + 2; // Next bullet after boundary
        }
      }
      return Math.max(1, Math.min(visible, bullets.length));
    }
    // Fallback: time-based stagger (25 frames per bullet)
    return Math.min(
      bullets.length,
      Math.floor(Math.max(0, frame - startFrame - 20) / 25) + 1,
    );
  };

  const visibleCount = getVisibleBullets();

  return (
    <div style={{ width: '100%', height: '100%', padding: '40px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      {/* Heading */}
      <div
        style={{
          fontSize: 36,
          fontWeight: 700,
          color: THEME.colors.white,
          fontFamily: THEME.fonts.heading,
          marginBottom: 32,
          opacity: interpolate(frame - startFrame, [0, 15], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        {heading}
      </div>

      {/* Bullets */}
      {bullets.map((bullet, i) => {
        const isVisible = i < visibleCount;
        const bulletFrame = startFrame + 20 + i * 25;
        const slideIn = isVisible
          ? spring({ frame: frame - bulletFrame, fps, config: { damping: 15, stiffness: 120 } })
          : 0;

        const isCurrent = i === visibleCount - 1;
        const isSpoken =
          sync && sync.currentWord
            ? bullet.toLowerCase().includes(sync.currentWord.toLowerCase())
            : false;

        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 20,
              opacity: slideIn,
              transform: `translateX(${interpolate(slideIn, [0, 1], [-40, 0])}px)`,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: isCurrent ? THEME.colors.saffron : THEME.colors.gold,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: THEME.colors.dark,
                fontSize: 14,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <span
              style={{
                fontSize: 24,
                color: isCurrent ? THEME.colors.white : THEME.colors.gray,
                fontFamily: THEME.fonts.text,
                fontWeight: isSpoken ? 700 : 400,
              }}
            >
              {bullet}
            </span>
          </div>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/TextSection.tsx
git commit -m "feat: rewrite TextSection as BulletReveal with sync-driven phrase-boundary reveals"
```

---

### Task 12: Rewrite ComparisonTable with Row-by-Row Reveal

**Files:**
- Modify: `src/components/ComparisonTable.tsx` (full rewrite)

- [ ] **Step 1: Rewrite ComparisonTable with sync-driven row reveals**

Replace `src/components/ComparisonTable.tsx` content with sync-aware version that reveals rows one at a time synced to phrase boundaries, with ding SFX and winner glow. Follow the same pattern as TextSection: accept `sceneIndex`, `sceneStartFrame`, `animationCues` props, use `useSync()`, fall back to time-based stagger if sync unavailable.

Key changes from current (129 lines):
- Replace `stagger(rowIndex, startFrame + 30, 15)` with phrase-boundary-driven reveals from `useSync()`
- Add winner row glow at scene end (last 30 frames)
- Add inline `<Audio>` for ding SFX on each row reveal

- [ ] **Step 2: Verify and commit**

```bash
git add src/components/ComparisonTable.tsx
git commit -m "feat: rewrite ComparisonTable with sync-driven row reveals and ding SFX"
```

---

### Task 13: Rewrite DiagramSlide as DiagramBuild

**Files:**
- Modify: `src/components/DiagramSlide.tsx` (full rewrite — currently 62 lines)

- [ ] **Step 1: Rewrite DiagramSlide with progressive node/edge reveal**

The current component renders a static SVG via `dangerouslySetInnerHTML`. Replace with a component that:

1. Accepts `animationCues` with `showNode(id)` and `drawEdge(from, to)` actions
2. Uses `useSync()` to determine which cues have been reached
3. Renders nodes/edges with spring-in animations as they're triggered
4. Falls back to the existing static SVG behavior when no cues provided (backward compat)

Since Mermaid SVGs are pre-rendered, the progressive reveal works by:
- Wrapping the full SVG in a container
- Overlaying opacity masks on individual SVG groups (nodes = `<g class="node">`, edges = `<g class="edgePath">`)
- Revealing groups as their corresponding cues are reached

Add pop SFX for node reveals via inline `<Sequence>` + `<Audio>`.

- [ ] **Step 2: Verify and commit**

```bash
git add src/components/DiagramSlide.tsx
git commit -m "feat: rewrite DiagramSlide as DiagramBuild with progressive reveal and pop SFX"
```

---

### Task 14: MetricCounter Component

**Files:**
- Create: `src/components/MetricCounter.tsx`

- [ ] **Step 1: Implement MetricCounter**

Create `src/components/MetricCounter.tsx`:

```typescript
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Sequence, Audio, staticFile } from 'remotion';
import { THEME } from '../lib/theme';
import type { SyncState } from '../types';

interface MetricCounterProps {
  value: number;
  label: string;
  suffix?: string;  // e.g. 'ms', '%', 'M'
  sync: SyncState;
  triggerWordIndex: number;  // wordIndex that starts the count
  frame: number;
  startFrame: number;
}

export const MetricCounter: React.FC<MetricCounterProps> = ({
  value,
  label,
  suffix = '',
  sync,
  triggerWordIndex,
  frame,
  startFrame,
}) => {
  const { fps } = useVideoConfig();

  const isTriggered = sync.wordIndex >= triggerWordIndex;
  const triggerFrame = isTriggered ? frame - startFrame : 0;

  // easeOutExpo count-up over 45 frames (1.5s)
  const countDuration = 45;
  const countProgress = isTriggered
    ? interpolate(triggerFrame, [0, countDuration], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: (t) => 1 - Math.pow(2, -10 * t), // easeOutExpo
      })
    : 0;

  const displayValue = Math.round(value * countProgress);

  // Format number with commas
  const formatted = displayValue.toLocaleString() + suffix;

  return (
    <div style={{ textAlign: 'center', padding: 16 }}>
      <div
        style={{
          fontFamily: THEME.fonts.code,
          fontSize: 48,
          fontWeight: 700,
          color: isTriggered ? THEME.colors.gold : THEME.colors.gray,
          opacity: isTriggered ? 1 : 0.3,
        }}
      >
        {isTriggered ? formatted : '—'}
      </div>
      <div
        style={{
          fontSize: 16,
          color: THEME.colors.gray,
          fontFamily: THEME.fonts.text,
          marginTop: 8,
        }}
      >
        {label}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/MetricCounter.tsx
git commit -m "feat: add MetricCounter with easeOutExpo count-up animation"
```

---

### Task 15: TrafficFlow Visualization

**Files:**
- Create: `src/components/viz/TrafficFlow.tsx`

- [ ] **Step 1: Implement TrafficFlow visualization**

Create `src/components/viz/TrafficFlow.tsx` — animated dots flowing from clients through a load balancer to servers. Uses `sync.wordIndex` to progressively reveal: client nodes → LB node → arrows → server nodes → flowing dots. All animations via Remotion `interpolate()` and `spring()`.

Key visual elements:
- Client dot cluster (top) — appears at wordIndex 0
- Load balancer box (middle) — springs in at wordIndex ~3
- Fan-out arrows (middle→bottom) — draw progressively
- Server boxes (bottom row, 3 servers) — spring in sequentially
- Health bars under servers — fill based on sceneProgress
- Animated dots flowing along arrows — continuous loop after all elements visible

- [ ] **Step 2: Register in ConceptViz TOPIC_VIZ_MAP**

In `src/components/ConceptViz.tsx`, import `TrafficFlow` and add to map:

```typescript
import { TrafficFlow } from './viz/TrafficFlow';

const TOPIC_VIZ_MAP = {
  'load-balanc': TrafficFlow,
  'cdn': TrafficFlow,
  'api-gateway': TrafficFlow,
};
```

- [ ] **Step 3: Commit**

```bash
git add src/components/viz/TrafficFlow.tsx src/components/ConceptViz.tsx
git commit -m "feat: add TrafficFlow visualization for load balancing topics"
```

---

### Task 16: HashTableViz Visualization

**Files:**
- Create: `src/components/viz/HashTableViz.tsx`

- [ ] **Step 1: Implement HashTableViz**

Create `src/components/viz/HashTableViz.tsx` — animated hash table with bucket array, keys hashing into buckets, and collision chaining. Progressive reveal synced to `sync.wordIndex`:
- Bucket array (left column, 4-6 slots) — appears first
- Keys animate into buckets via hash arrow
- Collision chain links extend on collision mention
- Load factor bar fills as items are added

- [ ] **Step 2: Register in ConceptViz**

Add to TOPIC_VIZ_MAP: `'hash-map': HashTableViz, 'hash-table': HashTableViz, 'caching': HashTableViz`

- [ ] **Step 3: Commit**

```bash
git add src/components/viz/HashTableViz.tsx src/components/ConceptViz.tsx
git commit -m "feat: add HashTableViz visualization for hash map topics"
```

---

### Task 17: SystemArchViz + MetricDashboard Visualizations

**Files:**
- Create: `src/components/viz/SystemArchViz.tsx`
- Create: `src/components/viz/MetricDashboard.tsx`

- [ ] **Step 1: Implement SystemArchViz**

Layered architecture blocks (Client → API → Service → DB) with request flow arrows. Progressive reveal synced to narration. Blocks spring-in, arrows draw, request dots flow.

- [ ] **Step 2: Implement MetricDashboard**

Generic dashboard with 2-3 MetricCounter instances arranged in a grid. Uses sync to trigger each counter at different word indices.

- [ ] **Step 3: Register both in ConceptViz**

```typescript
'system-design': SystemArchViz,
'microservice': SystemArchViz,
```

- [ ] **Step 4: Commit**

```bash
git add src/components/viz/SystemArchViz.tsx src/components/viz/MetricDashboard.tsx src/components/ConceptViz.tsx
git commit -m "feat: add SystemArchViz and MetricDashboard visualizations"
```

---

### Task 17b: TreeViz + SortingViz Visualizations

**Files:**
- Create: `src/components/viz/TreeViz.tsx`
- Create: `src/components/viz/SortingViz.tsx`

- [ ] **Step 1: Implement TreeViz**

Binary tree visualization with node insert/rebalance animations. Nodes spring-in from parent, edges draw as paths. Traversal path highlights nodes in order synced to narration.

- [ ] **Step 2: Implement SortingViz**

Bar chart with swap/compare animations. Bars highlight during comparison, swap positions with spring animation. Sorted bars change color.

- [ ] **Step 3: Register both in ConceptViz**

```typescript
'binary-tree': TreeViz, 'bst': TreeViz, 'heap': TreeViz,
'sort': SortingViz, 'merge-sort': SortingViz, 'quick-sort': SortingViz,
```

- [ ] **Step 4: Commit**

```bash
git add src/components/viz/TreeViz.tsx src/components/viz/SortingViz.tsx src/components/ConceptViz.tsx
git commit -m "feat: add TreeViz and SortingViz visualizations"
```

---

### Task 18: Script Generator — Animation Cues + SFX Triggers

**Files:**
- Modify: `src/pipeline/script-generator.ts` (lines 711-761: `sectionToScene()`)

- [ ] **Step 1: Add animation cue generation functions**

Add to `src/pipeline/script-generator.ts` (before `sectionToScene()`):

```typescript
import type { AnimationCue, SfxTrigger } from '../types';
import { SyncTimeline } from '../lib/sync-engine';

/** Generate animation cues for a code scene */
function generateCodeCues(narration: string, codeLineCount: number): AnimationCue[] {
  const phrases = SyncTimeline.computePhraseBoundaries(narration);
  const words = narration.split(/\s+/);
  const cues: AnimationCue[] = [];

  if (phrases.length === 0) {
    // No phrase boundaries — distribute lines evenly across word count
    const wordsPerGroup = Math.max(1, Math.floor(words.length / codeLineCount));
    for (let line = 0; line < codeLineCount; line++) {
      cues.push({ wordIndex: line * wordsPerGroup, action: 'typeLine', target: line });
    }
  } else {
    // Distribute code lines across phrases
    const linesPerPhrase = Math.ceil(codeLineCount / (phrases.length + 1));
    let lineIndex = 0;
    // First batch at word 0
    cues.push({ wordIndex: 0, action: 'typeLine', target: 0 });
    lineIndex += linesPerPhrase;
    // Remaining batches at phrase boundaries
    for (const boundary of phrases) {
      if (lineIndex >= codeLineCount) break;
      cues.push({ wordIndex: boundary + 1, action: 'typeLine', target: lineIndex });
      lineIndex += linesPerPhrase;
    }
  }

  return cues;
}

/** Generate animation cues for a text/bullet scene */
function generateTextCues(narration: string, bulletCount: number): AnimationCue[] {
  const phrases = SyncTimeline.computePhraseBoundaries(narration);
  const cues: AnimationCue[] = [
    { wordIndex: 0, action: 'revealBullet', target: 0 },
  ];

  for (let i = 0; i < Math.min(phrases.length, bulletCount - 1); i++) {
    cues.push({ wordIndex: phrases[i] + 1, action: 'revealBullet', target: i + 1 });
  }

  return cues;
}

/** Generate animation cues for a table scene */
function generateTableCues(narration: string, rowCount: number): AnimationCue[] {
  const words = narration.split(/\s+/);
  const wordsPerRow = Math.max(1, Math.floor(words.length / rowCount));
  return Array.from({ length: rowCount }, (_, i) => ({
    wordIndex: i * wordsPerRow,
    action: 'revealRow',
    target: i,
  }));
}

/** Generate standard SFX triggers for a scene */
function generateSceneSfxTriggers(
  sceneIndex: number,
  sceneType: string,
  cues: AnimationCue[],
): SfxTrigger[] {
  const triggers: SfxTrigger[] = [];

  // Scene entry whoosh
  triggers.push({ sceneIndex, wordIndex: 0, effect: 'whoosh-in', volume: 0.4 });

  // Type-specific SFX
  if (sceneType === 'table') {
    cues.filter(c => c.action === 'revealRow').forEach(c => {
      triggers.push({ sceneIndex, wordIndex: c.wordIndex, effect: 'ding', volume: 0.3 });
    });
  }

  return triggers;
}
```

- [ ] **Step 2: Integrate cue generation into sectionToScene()**

In the `sectionToScene()` function (around lines 711-761), after the Scene object is created, add animation cues based on scene type:

```typescript
// After creating the scene object:
const scene: Scene = { /* existing fields */ };

// Generate animation cues based on scene type
if (scene.type === 'code') {
  const lineCount = scene.content.split('\n').filter(l => l.trim()).length;
  scene.animationCues = generateCodeCues(scene.narration, lineCount);
} else if (scene.type === 'text' && scene.bullets) {
  scene.animationCues = generateTextCues(scene.narration, scene.bullets.length);
} else if (scene.type === 'table') {
  const rowCount = scene.content.split('\n').filter(l => l.includes('|')).length - 2; // minus header + separator
  scene.animationCues = generateTableCues(scene.narration, Math.max(1, rowCount));
}

// Generate SFX triggers
scene.sfxTriggers = generateSceneSfxTriggers(0, scene.type, scene.animationCues || []);
// Note: sceneIndex will be corrected in storyboard when flattening
```

- [ ] **Step 3: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/pipeline/script-generator.ts
git commit -m "feat: add animation cue + SFX trigger generation to script generator"
```

---

### Task 19: LongVideo Composition Integration

**Files:**
- Modify: `src/compositions/LongVideo.tsx` (major: lines 154-294)

This is the critical integration task that wires everything together.

- [ ] **Step 1: Add imports and SyncTimeline construction**

At the top of `LongVideo.tsx`, add new imports and **remove the local `INTRO_DURATION`/`OUTRO_DURATION` constants** (lines 28-29) since they'll be imported from constants:

```typescript
import { SyncTimeline } from '../lib/sync-engine';
import { setSyncTimeline } from '../hooks/useSync';
import { BgmLayer } from '../components/BgmLayer';
import { SfxLayer } from '../components/SfxLayer';
import { SplitLayout } from '../components/SplitLayout';
import { ConceptViz } from '../components/ConceptViz';
import { INTRO_DURATION, OUTRO_DURATION, TRANSITION_DURATION } from '../lib/constants';
```

**Remove** the local declarations:
```typescript
// DELETE these lines (around lines 28-29):
// const INTRO_DURATION = 90;
// const OUTRO_DURATION = 150;
```

- [ ] **Step 2: Build SyncTimeline at composition top level**

Inside the `LongVideo` component, before the return, construct the timeline:

```typescript
const syncTimeline = React.useMemo(() => {
  const offsets = storyboard.sceneOffsets || [];
  const timestamps = storyboard.scenes.map(s => s.wordTimestamps || []);
  return new SyncTimeline(offsets, timestamps, fps, INTRO_DURATION);
}, [storyboard, fps]);

// Set the global timeline for useSync() consumers (side effect belongs in useEffect)
React.useEffect(() => {
  setSyncTimeline(syncTimeline);
}, [syncTimeline]);
```

- [ ] **Step 3: Update master audio placement**

Replace the existing `<Audio>` tag (around line 263-278) with:

```typescript
{storyboard.audioFile && (
  <Sequence from={INTRO_DURATION}>
    <Audio
      src={staticFile(`audio/${storyboard.audioFile.split('/').pop()}`)}
      volume={(f) => {
        const fadeIn = interpolate(f, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
        const totalAudioFrames = storyboard.durationInFrames - INTRO_DURATION - OUTRO_DURATION;
        const fadeOut = interpolate(f, [totalAudioFrames - 15, totalAudioFrames], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return fadeIn * fadeOut;
      }}
    />
  </Sequence>
)}
```

- [ ] **Step 4: Add BgmLayer and SfxLayer**

After the master audio, add:

```typescript
{/* Background Music */}
{storyboard.bgmFile && syncTimeline && (
  <BgmLayer syncTimeline={syncTimeline} bgmFile={storyboard.bgmFile} />
)}

{/* Sound Effects */}
{syncTimeline && storyboard.allSfxTriggers && (
  <SfxLayer triggers={storyboard.allSfxTriggers} syncTimeline={syncTimeline} />
)}
```

- [ ] **Step 5: Wrap text/interview scenes in SplitLayout**

In the TransitionSeries scene mapping (around lines 180-240), for text and interview scene types, wrap in SplitLayout:

```typescript
// Inside the scene rendering logic, when scene.type is 'text' or 'interview':
if (scene.type === 'text' || scene.type === 'interview') {
  const SceneComponent = SCENE_COMPONENT_MAP[scene.type];
  return (
    <SplitLayout
      left={<SceneComponent {...sceneProps} sceneIndex={i} sceneStartFrame={sceneAbsoluteStart} animationCues={scene.animationCues} />}
      right={<ConceptViz topic={storyboard.topic} sceneIndex={i} sceneStartFrame={sceneAbsoluteStart} keywords={scene.bullets || []} />}
    />
  );
}
```

- [ ] **Step 6: Pass sync props to all scene components**

Update `getSceneProps()` (around line 71) to include sync props:

```typescript
function getSceneProps(scene: Scene, index: number, sceneStartFrame: number) {
  return {
    ...existingProps,
    sceneIndex: index,
    sceneStartFrame: sceneStartFrame,
    animationCues: scene.animationCues,
  };
}
```

- [ ] **Step 7: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit`
Expected: No errors (or only warnings)

- [ ] **Step 8: Commit**

```bash
git add src/compositions/LongVideo.tsx
git commit -m "feat: integrate SyncEngine, BgmLayer, SfxLayer, and SplitLayout into LongVideo"
```

---

### Task 20: ShortVideo Composition Integration

**Files:**
- Modify: `src/compositions/ShortVideo.tsx` (93 lines)

- [ ] **Step 1: Apply same changes as LongVideo**

Mirror the LongVideo changes: add SyncTimeline construction, BgmLayer, SfxLayer, sync props to scene components. Use `SHORT_INTRO_DURATION` (45 frames) and `SHORT_OUTRO_DURATION` (90 frames) instead of the long-form constants.

- [ ] **Step 2: Commit**

```bash
git add src/compositions/ShortVideo.tsx
git commit -m "feat: integrate sync engine into ShortVideo composition"
```

---

### Task 21: Integration Test — Full Render

**Files:**
- Modify: `scripts/generate-pilot.ts` (add BGM file selection to storyboard)

- [ ] **Step 1: Add BGM selection to storyboard generation**

In `scripts/generate-pilot.ts` (or wherever the storyboard is finalized), add BGM file selection:

```typescript
// Deterministic BGM selection based on topic + session
const BGM_FILES = [
  'audio/bgm/lofi-study-1.mp3',
  'audio/bgm/lofi-study-2.mp3',
  'audio/bgm/lofi-chill-1.mp3',
  'audio/bgm/lofi-ambient-1.mp3',
];
const bgmSeed = (topic + sessionNumber).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
storyboard.bgmFile = BGM_FILES[bgmSeed % BGM_FILES.length];
```

- [ ] **Step 2: Generate a test video**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsx scripts/generate-pilot.ts`

This should generate a Load Balancing session 1 video with:
- Sync-driven animations (code typing, bullet reveals)
- Background music (silent placeholder, but layer present)
- Sound effects (silent placeholders, but triggers firing)
- Split layouts on text scenes with KeywordCloud visualization

- [ ] **Step 3: Render the video**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx remotion render src/index.ts LongVideo out/test-edutainment.mp4`

Review the output video manually. Check:
- [ ] Code lines appear progressively (not all at once)
- [ ] Text bullets appear one at a time
- [ ] No audio-video desync (narration matches visual scene changes)
- [ ] BGM layer is present (even if silent)
- [ ] Split layout visible on text scenes
- [ ] No rendering errors

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-pilot.ts
git commit -m "feat: add BGM selection and integration test for edutainment pipeline"
```

---

### Task 22: Source Real Audio Assets

**Files:**
- Replace: `public/audio/bgm/*.mp3` with real CC0 lo-fi loops
- Replace: `public/audio/sfx/*.wav` with real CC0 sound effects

- [ ] **Step 1: Source and download CC0 audio**

Find and download royalty-free audio from sources like:
- **BGM:** freemusicarchive.org, pixabay.com/music (CC0 lo-fi beats)
- **SFX:** freesound.org, pixabay.com/sound-effects (CC0 UI sounds)

Replace the silent placeholders in `public/audio/bgm/` and `public/audio/sfx/` with real audio files.

Requirements:
- BGM: MP3, 48kHz, ~2-3 minutes each, loopable
- SFX: WAV, 48kHz, short duration as specified in spec

- [ ] **Step 2: Test with real audio**

Re-render the test video and verify:
- BGM plays softly under narration, gets louder in gaps
- SFX triggers are audible at the right moments
- No clipping or distortion

- [ ] **Step 3: Commit**

```bash
git add public/audio/
git commit -m "feat: add real CC0 audio assets (4 BGM loops + 15 SFX)"
```

---

## Task Dependency Graph

```
Task 1 (Types) ─────────────────────────────────────────┐
Task 2 (TTS Timestamps) ────────────────────────────────┤
Task 3 (SyncEngine) ──── depends on 1 ──────────────────┤
Task 4 (useSync Hook) ── depends on 3 ──────────────────┤
Task 5 (Storyboard) ──── depends on 1, 2 ───────────────┤
Task 6 (Audio Assets) ──────────────────────────────────┤
Task 7 (BgmLayer) ────── depends on 3 ──────────────────┤
Task 8 (SfxLayer) ────── depends on 3, 6 ───────────────┤
Task 9 (SplitLayout + ConceptViz) ── depends on 4 ──────┤
Task 10 (CodeReveal) ─── depends on 4 ──────────────────┤
Task 11 (TextSection) ── depends on 4 ──────────────────┤
Task 12 (ComparisonTable) ── depends on 4 ──────────────┤
Task 13 (DiagramSlide) ── depends on 4 ─────────────────┤
Task 14 (MetricCounter) ── depends on 4 ────────────────┤
Task 15 (TrafficFlow) ── depends on 9 ──────────────────┤
Task 16 (HashTableViz) ── depends on 9 ─────────────────┤
Task 17 (SystemArchViz) ── depends on 9 ────────────────┤
Task 18 (Script Generator) ── depends on 1, 3 ──────────┤
Task 19 (LongVideo) ──── depends on ALL above ──────────┤
Task 20 (ShortVideo) ─── depends on 19 ─────────────────┤
Task 21 (Integration Test) ── depends on 19, 20 ────────┤
Task 22 (Real Audio) ─── depends on 21 ─────────────────┘
```

**Parallelizable groups:**
- Tasks 1-2: Foundation (sequential, fast)
- Tasks 3-6: Core infrastructure (3→4 sequential, 5-6 parallel)
- Tasks 7-8: Audio layers (parallel)
- Tasks 9-14: Component rewrites (all parallel after Task 4)
- Tasks 15-17: Visualizations (all parallel after Task 9)
- Task 18: Script generator (parallel with 9-17)
- Tasks 19-22: Integration (sequential)
