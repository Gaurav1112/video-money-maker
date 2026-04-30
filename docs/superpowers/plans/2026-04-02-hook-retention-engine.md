# Hook & Retention Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the root cause of 100-view videos by adding frame-0 dual hooks, pattern interrupts every 5-8s, contradiction-based open loops, style-driven transitions, and aggressive TTS pacing.

**Architecture:** 4 new files (hook-generator, PatternInterruptLayer, open-loops, topic-categories) + 8 modified files. Hook generator and open loops modify narration text before TTS. PatternInterruptLayer is a visual overlay per scene in LongVideo. Transition speed is style-driven with dramatic exceptions. TTS pacing gets aggressive rates (+5% to +20%) with no scene type at +0%.

**Tech Stack:** Remotion 4, React 19, TypeScript, Edge TTS (PrabhatNeural)

**Spec:** `docs/superpowers/specs/2026-04-02-hook-retention-engine-design.md`

**Codebase:** `/Users/racit/PersonalProject/video-pipeline/` on branch `feat/production-pipeline-v2`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/hook-generator.ts` | 7 hook formulas → `{ textHook, spokenHook }`, deterministic selection |
| `src/components/PatternInterruptLayer.tsx` | 5 interrupt types every 5-8s, keyword-targeted, replaces ZoomPunchLayer |
| `src/lib/open-loops.ts` | Contradiction-based curiosity gaps, 4 patterns, content-derived |
| `src/lib/topic-categories.ts` | Topic slug → category mapping for template selection |

### Modified Files
| File | Changes |
|------|---------|
| `src/components/IntroSlide.tsx` | Add `textHook` prop for hook mode, keep backward compat |
| `src/pipeline/script-generator.ts` | Wire hook-generator for spokenHook, call open-loops after scene gen |
| `src/lib/constants.ts` | `INTRO_DURATION = 90` (was 150) |
| `src/lib/video-styles.ts` | Add transition fields, update ttsRate to aggressive pacing, add `getTransitionDuration()` helper |
| `src/compositions/LongVideo.tsx` | Remove ZoomPunchLayer, add PatternInterruptLayer per scene, per-transition duration, pass textHook |
| `src/pipeline/storyboard.ts` | Per-transition duration in all 3 timing math cases |
| `src/pipeline/tts-engine.ts` | Add `--pitch=+2Hz`, update `preprocessForSpeech` punctuation tricks |
| `src/components/index.ts` | Export PatternInterruptLayer, remove dangling HookSlide export |

---

## Task 1: TTS Pacing Overhaul (P0)

**Files:**
- Modify: `src/lib/video-styles.ts`
- Modify: `src/pipeline/tts-engine.ts`

- [ ] **Step 1: Update EDUCATIONAL ttsRate in video-styles.ts**

In `src/lib/video-styles.ts`, find the `EDUCATIONAL` constant's `ttsRate` object and replace all values:

Find:
```typescript
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
```
Replace with:
```typescript
  ttsRate: {
    title: '+20%',
    text: '+5%',
    code: '-8%',
    diagram: '+0%',
    table: '+5%',
    interview: '+10%',
    review: '+8%',
    summary: '+15%',
  },
```

- [ ] **Step 2: Update VIRAL ttsRate**

Find the `VIRAL` constant's `ttsRate` and replace:
```typescript
  ttsRate: {
    title: '+25%',
    text: '+12%',
    code: '+0%',
    diagram: '+5%',
    table: '+8%',
    interview: '+15%',
    review: '+12%',
    summary: '+20%',
  },
```

- [ ] **Step 3: Add --pitch=+2Hz to edgeTTS in tts-engine.ts**

In `src/pipeline/tts-engine.ts`, find the `execFileSync` call inside `edgeTTS()` (around line 241-248):

Find:
```typescript
    `--rate=${rate}`,       // Per-scene pacing from VideoStyle
    '--text', cleanText,
```
Replace with:
```typescript
    `--rate=${rate}`,       // Per-scene pacing from VideoStyle
    '--pitch=+2Hz',         // Warmer tone for engagement
    '--text', cleanText,
```

- [ ] **Step 4: Add punctuation tricks to preprocessForSpeech**

In `src/pipeline/tts-engine.ts`, find `preprocessForSpeech` (around line 491). Add these transformations BEFORE the existing ones:

```typescript
  // Add natural pauses before contradiction words (Edge TTS respects commas)
  result = result.replace(/\b(but|however|actually|in fact|surprisingly)\b/gi, ', $1');
  // Clean up double commas that may result
  result = result.replace(/,\s*,/g, ',');

  // Add micro-pause before reveal words (dash creates a beat)
  result = result.replace(/\b(the answer is|the key is|the secret is|here is why)\b/gi, '— $1');
```

- [ ] **Step 5: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add src/lib/video-styles.ts src/pipeline/tts-engine.ts
git commit -m "feat: aggressive TTS pacing + warm pitch + punctuation pauses (P0)

No scene type at +0% anymore. Hooks at +20%, code at -8%, summaries
at +15%. Added --pitch=+2Hz for warmer voice. Punctuation tricks
add natural pauses before contradictions and reveals."
```

---

## Task 2: Hook Generator + IntroSlide Hook Mode (P0)

**Files:**
- Create: `src/lib/hook-generator.ts`
- Modify: `src/components/IntroSlide.tsx`
- Modify: `src/lib/constants.ts`
- Modify: `src/pipeline/script-generator.ts`
- Modify: `src/components/index.ts`

- [ ] **Step 1: Create hook-generator.ts**

Create `src/lib/hook-generator.ts`:

```typescript
import type { Scene } from '../types';

export interface HookResult {
  textHook: string;   // on-screen (max 8 words)
  spokenHook: string; // narrated (1-2 sentences)
}

type HookFormula = (topic: string, scenes: Scene[]) => HookResult;

// Extract a key concept from early scenes for content-aware hooks
function getKeyConcept(scenes: Scene[]): string {
  const textScene = scenes.find(s => s.type === 'text' && s.heading);
  return textScene?.heading || 'this concept';
}

function getCodeTopic(scenes: Scene[]): string {
  const codeScene = scenes.find(s => s.type === 'code');
  return codeScene?.heading || 'the implementation';
}

const HOOK_FORMULAS: HookFormula[] = [
  // 0: Contradiction
  (topic, scenes) => ({
    textHook: `What you know about ${topic} is WRONG`,
    spokenHook: `Everyone says ${getKeyConcept(scenes)} is the best approach. That's actually wrong for 90% of real-world systems. Let me show you why.`,
  }),
  // 1: Stat bomb
  (topic, _scenes) => ({
    textHook: `97% get ${topic} wrong`,
    spokenHook: `I've interviewed hundreds of developers on ${topic}. 97% make the same critical mistake. After this video, you won't be one of them.`,
  }),
  // 2: Salary anchor
  (topic, _scenes) => ({
    textHook: `${topic} = 8 LPA vs 40 LPA`,
    spokenHook: `This one topic, ${topic}, is literally the difference between an 8 LPA offer and a 40 LPA offer. Here's exactly what senior engineers know that you don't.`,
  }),
  // 3: Challenge
  (topic, scenes) => ({
    textHook: `Can you explain ${topic}?`,
    spokenHook: `If your interviewer asks you to explain ${getKeyConcept(scenes)} right now, could you? Most candidates freeze. By the end of this video, you'll explain it better than most senior engineers.`,
  }),
  // 4: Time promise
  (topic, _scenes) => ({
    textHook: `Master ${topic} in 10 minutes`,
    spokenHook: `In the next 10 minutes, you'll understand ${topic} well enough to design it in a FAANG interview. No fluff, no filler, just the exact mental model you need.`,
  }),
  // 5: Pain point
  (topic, scenes) => ({
    textHook: `Your ${topic} will BREAK at scale`,
    spokenHook: `If you're not using ${getKeyConcept(scenes)} correctly, your system will crash the moment you hit 10,000 concurrent users. I've seen it happen. Here's the fix.`,
  }),
  // 6: Authority
  (topic, _scenes) => ({
    textHook: `Asked in Google SDE-2 interview`,
    spokenHook: `This exact question about ${topic} was asked in a Google SDE-2 interview. I'm going to show you the answer that got the candidate hired.`,
  }),
];

/**
 * Generate a dual hook (text + spoken) for a video.
 * Deterministic: same topic + sessionNumber always produces the same hook.
 * No two sessions of the same topic use the same formula.
 */
export function generateDualHook(
  topic: string,
  sessionNumber: number,
  scenes: Scene[],
): HookResult {
  // Deterministic seed: rotate through formulas by session
  const seed = (topic.length * 7 + sessionNumber * 13) % HOOK_FORMULAS.length;
  return HOOK_FORMULAS[seed](topic, scenes);
}
```

- [ ] **Step 2: Update INTRO_DURATION in constants.ts**

In `src/lib/constants.ts`, find:
```typescript
export const INTRO_DURATION = 150; // frames (5 seconds — countdown + logo + typewriter)
```
Replace with:
```typescript
export const INTRO_DURATION = 90; // frames (3 seconds — hook text + voice start)
```

- [ ] **Step 2b: Add deprecation comment to TRANSITION_DURATION in constants.ts**

In `src/lib/constants.ts`, find:
```typescript
export const TRANSITION_DURATION = 15; // frames (0.5 seconds)
```
Replace with:
```typescript
/** @deprecated Use getTransitionDuration() from video-styles.ts instead. Kept as fallback only. */
export const TRANSITION_DURATION = 15; // frames (0.5 seconds) — replaced by style-driven values
```

- [ ] **Step 3: Add hook mode to IntroSlide.tsx**

In `src/components/IntroSlide.tsx`, add `textHook` to the interface (line 5-8):

Find:
```typescript
interface IntroSlideProps {
  topic?: string;
  durationInFrames?: number; // default 150 (5 seconds at 30fps) — extended for countdown
}
```
Replace with:
```typescript
interface IntroSlideProps {
  topic?: string;
  durationInFrames?: number;
  /** When provided, renders hook mode: bold text + SFX at frame 0, no countdown */
  textHook?: string;
}
```

Add `textHook` to destructured props (line 57):
Find:
```typescript
const IntroSlide: React.FC<IntroSlideProps> = ({ topic = '', durationInFrames = 150 }) => {
```
Replace with:
```typescript
const IntroSlide: React.FC<IntroSlideProps> = ({ topic = '', durationInFrames = 90, textHook }) => {
```

Add hook mode early return BEFORE the existing countdown logic. Right after `const { fps } = useVideoConfig();` (line 59), add:

```typescript
  // ── HOOK MODE: Bold text + SFX at frame 0, no countdown ──────────────────
  if (textHook) {
    const hookSpring = spring({
      frame, fps,
      config: { damping: 10, stiffness: 200, mass: 0.5 },
    });
    const hookScale = interpolate(hookSpring, [0, 1], [0.7, 1.0]);
    const hookOpacity = interpolate(frame, [0, 5, durationInFrames - 10, durationInFrames], [0, 1, 1, 0], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    // Topic name fades in after hook
    const topicOpacity = interpolate(frame, [20, 35], [0, 0.7], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });

    return (
      <AbsoluteFill style={{ backgroundColor: COLORS.dark, overflow: 'hidden' }}>
        {/* SFX impact at frame 0 */}
        <Audio src={staticFile('audio/sfx/impact.wav')} volume={0.6} />

        {/* Bold hook text — center screen */}
        <div style={{
          position: 'absolute', top: '38%', left: 0, right: 0,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          transform: `scale(${hookScale})`, opacity: hookOpacity,
        }}>
          <div style={{
            fontSize: 52, fontFamily: FONTS.heading, fontWeight: 900,
            color: COLORS.saffron, textAlign: 'center',
            maxWidth: '80%', lineHeight: 1.3, letterSpacing: -1,
            textShadow: `0 0 30px ${COLORS.saffron}60, 0 4px 12px rgba(0,0,0,0.8)`,
          }}>
            {textHook}
          </div>
        </div>

        {/* Topic name — subtle, below hook */}
        <div style={{
          position: 'absolute', bottom: '25%', left: 0, right: 0,
          textAlign: 'center', opacity: topicOpacity,
        }}>
          <span style={{
            fontSize: 24, fontFamily: FONTS.text, fontWeight: 600,
            color: COLORS.gold, letterSpacing: 2, textTransform: 'uppercase',
          }}>
            {topic}
          </span>
        </div>
      </AbsoluteFill>
    );
  }
```

Add the `Audio` and `staticFile` imports at the top of IntroSlide.tsx:
Find:
```typescript
import { useCurrentFrame, AbsoluteFill, spring, useVideoConfig, interpolate } from 'remotion';
```
Replace with:
```typescript
import { useCurrentFrame, AbsoluteFill, spring, useVideoConfig, interpolate, Audio, staticFile } from 'remotion';
```

- [ ] **Step 4: Wire hook generator into script-generator.ts**

In `src/pipeline/script-generator.ts`, add import at the top:
```typescript
import { generateDualHook } from '../lib/hook-generator';
```

Find the existing hook generation (around line 1061-1068):
```typescript
  // ── 1. HOOK — Session-aware dramatic opening ────────────────────────────
  let hookNarration = generateHook(session.topic, session.title, sessionNum, totalSessions);

  // Inject analogy from the SESSION-SPECIFIC analogy set (different metaphor each session)
  const analogy = getAnalogy(session.topic, sessionNum);
  if (analogy) {
    hookNarration += ` ${analogy}`;
  }
```
Replace with:
```typescript
  // ── 1. DUAL HOOK — bold text + spoken narration at frame 0 ──────────────
  // Note: We pass the existing scenes array to generateDualHook. At this point
  // in the function, 'scenes' is empty (title scene hasn't been pushed yet).
  // The hook generator gracefully handles empty arrays by using fallback text.
  // For fully content-aware hooks, we'd need to restructure generateScript to
  // generate content scenes first, but this would require significant refactoring.
  // The current approach is a pragmatic first iteration — hooks are still varied
  // via 7 formulas + deterministic seeding by topic + sessionNumber.
  const dualHook = generateDualHook(session.topic, sessionNum, scenes);
  let hookNarration = dualHook.spokenHook;

  // Inject analogy from the SESSION-SPECIFIC analogy set (different metaphor each session)
  const analogy = getAnalogy(session.topic, sessionNum);
  if (analogy) {
    hookNarration += ` ${analogy}`;
  }

  // Series context
  const seriesInfo = totalSessions
    ? ` This is session ${sessionNum} of ${totalSessions} in our complete ${session.topic} series.`
    : ` This is session ${sessionNum} of our ${session.topic} series.`;
  hookNarration += `${seriesInfo} Today's topic: ${session.title}.`;
```

Also store `textHook` on the title scene. Find the title scene push (around line 1071-1080):
```typescript
  scenes.push({
    type: 'title',
    content: session.title,
    narration: hookNarration,
    duration: titleDuration,
    startFrame: currentFrame,
    endFrame: (currentFrame += TIMING.secondsToFrames(titleDuration)),
    bullets: session.objectives,
    heading: session.topic,
  });
```
Replace with:
```typescript
  scenes.push({
    type: 'title',
    content: session.title,
    narration: hookNarration,
    duration: titleDuration,
    startFrame: currentFrame,
    endFrame: (currentFrame += TIMING.secondsToFrames(titleDuration)),
    bullets: session.objectives,
    heading: dualHook.textHook, // Text hook for HookSlide display
  });
```

- [ ] **Step 5: Pass textHook to IntroSlide in LongVideo.tsx**

In `src/compositions/LongVideo.tsx`, find the IntroSlide usage (around line 299-302):
```typescript
        <IntroSlide durationInFrames={INTRO_DURATION} topic={storyboard.topic} />
```
Replace with:
```typescript
        <IntroSlide
          durationInFrames={INTRO_DURATION}
          topic={storyboard.topic}
          textHook={storyboard.scenes[0]?.heading}
        />
```

- [ ] **Step 6: Remove dangling HookSlide export from index.ts**

In `src/components/index.ts`, find and remove:
```typescript
export { default as HookSlide } from './HookSlide';
```

- [ ] **Step 7: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add src/lib/hook-generator.ts src/components/IntroSlide.tsx src/lib/constants.ts src/pipeline/script-generator.ts src/compositions/LongVideo.tsx src/components/index.ts
git commit -m "feat: dual hook system — bold text + spoken hook at frame 0 (P0)

7 hook formulas (contradiction, stat, salary, challenge, time,
pain point, authority). IntroSlide now has hook mode — no countdown,
just bold text + SFX impact at frame 0. INTRO_DURATION 150 → 90.
Deterministic selection by topic + sessionNumber."
```

---

## Task 3: Style-Driven Transition Speed (P1)

**Files:**
- Modify: `src/lib/video-styles.ts`
- Modify: `src/pipeline/storyboard.ts`
- Modify: `src/compositions/LongVideo.tsx`

- [ ] **Step 1: Add transition fields to VideoStyle and helper**

In `src/lib/video-styles.ts`, find the `VideoStyle` interface and add the two new fields:

Find:
```typescript
  sfxDensity: SfxDensity;
}
```
Replace with:
```typescript
  sfxDensity: SfxDensity;
  transitionDuration: number;         // default frames: educational=8, viral=3
  dramaticTransitionDuration: number; // for reveals: educational=15, viral=8
}
```

Add to `EDUCATIONAL`:
```typescript
  transitionDuration: 8,
  dramaticTransitionDuration: 15,
```

Add to `VIRAL`:
```typescript
  transitionDuration: 3,
  dramaticTransitionDuration: 8,
```

Add helper function at the bottom of the file (NOTE: `SceneType` is already imported at the top of video-styles.ts — do NOT add a duplicate import):
```typescript
const DRAMATIC_PAIRS: Array<[string | null, string]> = [
  ['title', '*'],      // title → any first content scene
  [null, 'review'],    // any → review (quiz buildup)
  ['review', 'summary'], // review → summary (answer wrap-up)
];

export function getTransitionDuration(
  prevSceneType: SceneType | null,
  currSceneType: SceneType,
  style: VideoStyle,
): number {
  for (const [prev, curr] of DRAMATIC_PAIRS) {
    if ((prev === null || prev === prevSceneType) && (curr === '*' || curr === currSceneType)) {
      return style.dramaticTransitionDuration;
    }
  }
  return style.transitionDuration;
}
```

- [ ] **Step 2: Update storyboard.ts timing math**

In `src/pipeline/storyboard.ts`, add imports:
```typescript
import { getStyleForFormat } from '../lib/video-styles';
import { getTransitionDuration } from '../lib/video-styles';
```

Inside `generateStoryboard()`, after the options destructuring (line 31), add:
```typescript
  const style = getStyleForFormat('long');
```

Replace all 3 uses of `TRANSITION_DURATION` in the timing loop:

**Case 1** (around line 97 — next offset exists):
Find the full line:
```typescript
        durationFrames = TIMING.secondsToFrames(nextOffset - offset) + TRANSITION_DURATION;
```
Replace with:
```typescript
        const prevType = i > 0 ? scenes[i - 1].type : 'title';
        const transDuration = getTransitionDuration(prevType scene.type, style);
        durationFrames = TIMING.secondsToFrames(nextOffset - offset) + transDuration;
```
(Remove the existing `durationFrames = ...` line and replace with these 3 lines)

**Case 2** (around line 100 — last scene with audio):
Find: `+ TRANSITION_DURATION;` (second occurrence)
Replace with: `+ style.transitionDuration;`

**Case 3** (around line 105 — no audio fallback):
Find: `+ TRANSITION_DURATION;` (third occurrence)
Replace with: `+ style.transitionDuration;`

- [ ] **Step 3: Update LongVideo.tsx transition rendering**

In `src/compositions/LongVideo.tsx`, add import:
```typescript
import { getTransitionDuration } from '../lib/video-styles';
```

Find the TransitionSeries.Transition timing (around line 429):
```typescript
                    timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
```
Replace with:
```typescript
                    timing={linearTiming({
                      durationInFrames: getTransitionDuration(
                        idx > 0 ? contentScenes[idx - 1].type : 'title',
                        scene.type,
                        style,
                      ),
                    })}
```

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add src/lib/video-styles.ts src/pipeline/storyboard.ts src/compositions/LongVideo.tsx
git commit -m "feat: style-driven transition speed with dramatic exceptions (P1)

Educational: 8 frames (0.27s) default, 15 frames (0.5s) dramatic.
Viral: 3 frames (0.1s) default, 8 frames (0.27s) dramatic.
Dramatic pairs: title→first, any→review, review→summary."
```

---

## Task 4: Pattern Interrupt Engine (P1)

**Files:**
- Create: `src/components/PatternInterruptLayer.tsx`
- Create: `src/lib/tech-terms.ts`
- Modify: `src/compositions/LongVideo.tsx`
- Modify: `src/components/index.ts`

- [ ] **Step 1: Create tech-terms.ts**

Create `src/lib/tech-terms.ts`:

```typescript
/** Technical terms that should trigger visual emphasis in pattern interrupts */
export const TECH_TERMS = new Set([
  // Data structures
  'array', 'hashmap', 'tree', 'graph', 'queue', 'stack', 'heap', 'trie',
  'linked list', 'binary tree', 'hash table', 'priority queue',
  // Algorithms
  'binary search', 'sorting', 'recursion', 'dynamic programming', 'BFS', 'DFS',
  'greedy', 'backtracking', 'divide and conquer',
  // System design
  'load balancer', 'cache', 'database', 'microservices', 'API gateway',
  'message queue', 'CDN', 'sharding', 'replication', 'consistent hashing',
  'rate limiting', 'circuit breaker', 'reverse proxy', 'websocket',
  // Complexity
  'O(1)', 'O(n)', 'O(log n)', 'O(n log n)', 'O(n^2)',
  // Concepts
  'latency', 'throughput', 'availability', 'scalability', 'partition',
  'CAP theorem', 'ACID', 'BASE', 'REST', 'GraphQL', 'gRPC',
  'TCP', 'UDP', 'HTTP', 'DNS', 'SSL', 'TLS',
]);

/** Check if a word or phrase is a technical term */
export function isTechTerm(word: string): boolean {
  const lower = word.toLowerCase().replace(/[^a-z0-9() ]/g, '');
  if (TECH_TERMS.has(lower)) return true;
  // Check for abbreviations (2+ consecutive uppercase letters)
  if (/^[A-Z]{2,}$/.test(word.replace(/[^A-Z]/g, '')) && word.length >= 2) return true;
  return false;
}
```

- [ ] **Step 2: Create PatternInterruptLayer.tsx**

Create `src/components/PatternInterruptLayer.tsx`:

```typescript
import React from 'react';
import {
  useCurrentFrame, AbsoluteFill, interpolate, Easing,
  spring, useVideoConfig, Sequence, Audio, staticFile,
} from 'remotion';
import { COLORS, FONTS } from '../lib/theme';
import { sfxDuration } from '../lib/sfx-durations';
import { isTechTerm } from '../lib/tech-terms';
import type { WordTimestamp, SceneType } from '../types';
import type { VideoStyle } from '../lib/video-styles';

type InterruptType = 'zoom' | 'callout' | 'colorPulse' | 'sfxHit' | 'opacityCut';

interface Interrupt {
  type: InterruptType;
  frame: number;       // absolute frame within the scene
  keyword?: string;    // for zoom + callout
}

interface PatternInterruptLayerProps {
  wordTimestamps: WordTimestamp[];
  sceneType: SceneType;
  narration: string;
  style: VideoStyle;
  fps: number;
  sceneDurationFrames: number;
}

const INTERRUPT_TYPES: InterruptType[] = ['zoom', 'callout', 'colorPulse', 'sfxHit', 'opacityCut'];

function computeInterrupts(
  wordTimestamps: WordTimestamp[],
  narration: string,
  style: VideoStyle,
  fps: number,
  sceneDuration: number,
): Interrupt[] {
  const intervalMin = style.id === 'viral' ? 4 : 6;
  const intervalMax = style.id === 'viral' ? 6 : 8;
  const avgInterval = ((intervalMin + intervalMax) / 2) * fps;

  // Find keyword positions (tech terms, ALL CAPS, numbers)
  const words = narration.split(/\s+/);
  const keywordFrames: Array<{ frame: number; word: string }> = [];
  words.forEach((word, i) => {
    const isKeyword = isTechTerm(word) ||
      (word.replace(/[^a-zA-Z]/g, '').length >= 2 && word === word.toUpperCase()) ||
      /\d{2,}/.test(word);
    if (isKeyword && wordTimestamps[i]) {
      keywordFrames.push({ frame: Math.round(wordTimestamps[i].start * fps), word });
    }
  });

  const interrupts: Interrupt[] = [];
  let nextTrigger = Math.round(avgInterval);
  let typeIndex = 0;

  while (nextTrigger < sceneDuration - fps) { // stop 1s before scene end
    // Check if a keyword is near this trigger point (within 1s)
    const nearbyKeyword = keywordFrames.find(
      kf => Math.abs(kf.frame - nextTrigger) < fps
    );

    let type: InterruptType;
    if (nearbyKeyword && (typeIndex % 5 === 0 || typeIndex % 5 === 1)) {
      // Keyword found → use zoom or callout
      type = typeIndex % 2 === 0 ? 'zoom' : 'callout';
    } else {
      type = INTERRUPT_TYPES[typeIndex % INTERRUPT_TYPES.length];
    }

    // No two consecutive same type
    if (interrupts.length > 0 && interrupts[interrupts.length - 1].type === type) {
      typeIndex++;
      type = INTERRUPT_TYPES[typeIndex % INTERRUPT_TYPES.length];
    }

    interrupts.push({
      type,
      frame: nearbyKeyword ? nearbyKeyword.frame : nextTrigger,
      keyword: nearbyKeyword?.word,
    });

    nextTrigger += Math.round(avgInterval);
    typeIndex++;
  }

  return interrupts;
}

export const PatternInterruptLayer: React.FC<PatternInterruptLayerProps> = ({
  wordTimestamps,
  sceneType,
  narration,
  style,
  fps,
  sceneDurationFrames,
}) => {
  const frame = useCurrentFrame();

  const interrupts = React.useMemo(
    () => computeInterrupts(wordTimestamps, narration, style, fps, sceneDurationFrames),
    [wordTimestamps, narration, style, fps, sceneDurationFrames],
  );

  // Find active interrupt
  const activeInterrupt = interrupts.find(
    int => frame >= int.frame && frame < int.frame + 30 // max 1s window
  );

  if (!activeInterrupt) return null;

  const age = frame - activeInterrupt.frame;

  switch (activeInterrupt.type) {
    case 'zoom': {
      // NOTE: Zoom interrupt cannot scale sibling content from an overlay.
      // Instead, we render a brief "flash zoom" visual cue — a translucent
      // expanding circle that draws the eye inward, simulating a zoom feel.
      const half = 9; // 18 frames total
      if (age > 18) return null;
      const ringScale = age < half
        ? interpolate(age, [0, half], [0.8, 1.3], { easing: Easing.out(Easing.cubic), extrapolateRight: 'clamp' })
        : interpolate(age, [half, 18], [1.3, 1.5], { easing: Easing.out(Easing.cubic), extrapolateRight: 'clamp' });
      const ringOpacity = interpolate(age, [0, 3, 15, 18], [0, 0.2, 0.1, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      });
      return (
        <AbsoluteFill style={{ pointerEvents: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{
            width: 400, height: 400, borderRadius: '50%',
            border: `3px solid ${COLORS.saffron}`,
            transform: `scale(${ringScale})`,
            opacity: ringOpacity,
            boxShadow: `0 0 40px ${COLORS.saffron}30`,
          }} />
        </AbsoluteFill>
      );
    }

    case 'callout': {
      if (age > 30 || !activeInterrupt.keyword) return null;
      const calloutSpring = spring({ frame: age, fps, config: { damping: 12, stiffness: 200, mass: 0.5 } });
      const calloutOpacity = interpolate(age, [0, 5, 22, 30], [0, 1, 1, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      });
      return (
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
          <div style={{
            position: 'absolute', top: 80, right: 60,
            background: `${COLORS.saffron}EE`, borderRadius: 999,
            padding: '8px 24px',
            transform: `scale(${interpolate(calloutSpring, [0, 1], [0.5, 1])})`,
            opacity: calloutOpacity,
            boxShadow: `0 4px 20px ${COLORS.saffron}44`,
          }}>
            <span style={{
              fontSize: 22, fontFamily: FONTS.heading, fontWeight: 800,
              color: COLORS.white, textTransform: 'uppercase', letterSpacing: 1,
            }}>
              {activeInterrupt.keyword}
            </span>
          </div>
        </AbsoluteFill>
      );
    }

    case 'colorPulse': {
      if (age > 9) return null;
      const pulseOpacity = interpolate(age, [0, 3, 9], [0, 0.15, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      });
      return (
        <AbsoluteFill style={{
          background: `radial-gradient(circle at center, ${COLORS.saffron}40, transparent 70%)`,
          opacity: pulseOpacity, pointerEvents: 'none',
        }} />
      );
    }

    case 'sfxHit': {
      // Render audio-only interrupt
      return (
        <Sequence from={activeInterrupt.frame} durationInFrames={sfxDuration('whoosh-in')}>
          <Audio src={staticFile('audio/sfx/whoosh-in.wav')} volume={0.35} />
        </Sequence>
      );
    }

    case 'opacityCut': {
      if (age > 3) return null;
      return (
        <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.08)', pointerEvents: 'none' }} />
      );
    }

    default:
      return null;
  }
};
```

- [ ] **Step 3: Wire PatternInterruptLayer into LongVideo.tsx**

In `src/compositions/LongVideo.tsx`, add import:
```typescript
import { PatternInterruptLayer } from '../components/PatternInterruptLayer';
```

Remove the ZoomPunchLayer wrapping. Find:
```typescript
        <ZoomPunchLayer intervalRange={style.zoomInterval} scale={style.zoomScale} fps={fps}>
        <TransitionSeries>
```
Replace with:
```typescript
        <TransitionSeries>
```

Find:
```typescript
        </TransitionSeries>
        </ZoomPunchLayer>
```
Replace with:
```typescript
        </TransitionSeries>
```

Remove the ZoomPunchLayer import:
```typescript
import { ZoomPunchLayer } from '../components/ZoomPunchLayer';
```

Add PatternInterruptLayer inside each TransitionSeries.Sequence. Find (around line 437-438):
```typescript
                    {!isFirst && (
                      <SceneTransitionFlash sceneType={scene.type} sceneNumber={idx + 1} totalScenes={contentScenes.length} />
                    )}
```
Add BEFORE this block:
```typescript
                    <PatternInterruptLayer
                      wordTimestamps={scene.wordTimestamps || []}
                      sceneType={scene.type}
                      narration={scene.narration || ''}
                      style={style}
                      fps={fps}
                      sceneDurationFrames={duration}
                    />
```

- [ ] **Step 4: Update index.ts exports**

In `src/components/index.ts`, add:
```typescript
export { PatternInterruptLayer } from './PatternInterruptLayer';
```

- [ ] **Step 5: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add src/components/PatternInterruptLayer.tsx src/lib/tech-terms.ts src/compositions/LongVideo.tsx src/components/index.ts
git commit -m "feat: pattern interrupt engine — 5 types every 5-8s (P1)

Zoom punch, text callout, color pulse, SFX hit, opacity cut.
Keyword-targeted via tech-terms dictionary. Round-robin rotation,
no two consecutive same type. Replaces ZoomPunchLayer."
```

---

## Task 5: Contradiction-Based Open Loops (P2)

**Files:**
- Create: `src/lib/topic-categories.ts`
- Create: `src/lib/open-loops.ts`
- Modify: `src/pipeline/script-generator.ts`

- [ ] **Step 1: Create topic-categories.ts**

Create `src/lib/topic-categories.ts`:

```typescript
type TopicCategory = 'system-design' | 'dsa' | 'databases' | 'networking' | 'api' | 'caching' | 'general';

const CATEGORY_MAP: Record<string, TopicCategory> = {
  'load-balancing': 'system-design',
  'load balancing': 'system-design',
  'microservices': 'system-design',
  'system-design': 'system-design',
  'distributed-systems': 'system-design',
  'scalability': 'system-design',
  'message-queue': 'system-design',
  'caching': 'caching',
  'cache': 'caching',
  'redis': 'caching',
  'cdn': 'caching',
  'api-gateway': 'api',
  'api gateway': 'api',
  'rest-api': 'api',
  'graphql': 'api',
  'grpc': 'api',
  'database-design': 'databases',
  'database': 'databases',
  'sql': 'databases',
  'nosql': 'databases',
  'sharding': 'databases',
  'indexing': 'databases',
  'networking': 'networking',
  'tcp': 'networking',
  'http': 'networking',
  'dns': 'networking',
  'websocket': 'networking',
  'binary-search': 'dsa',
  'sorting': 'dsa',
  'dynamic-programming': 'dsa',
  'trees': 'dsa',
  'graphs': 'dsa',
  'arrays': 'dsa',
  'linked-list': 'dsa',
  'hash-map': 'dsa',
};

export function getTopicCategory(topicSlug: string): TopicCategory {
  const lower = topicSlug.toLowerCase().replace(/\s+/g, '-');
  if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower];
  // Partial match
  for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return cat;
  }
  return 'general';
}
```

- [ ] **Step 2: Create open-loops.ts**

Create `src/lib/open-loops.ts`:

```typescript
import type { Scene } from '../types';
import { getTopicCategory } from './topic-categories';

export interface OpenLoop {
  contradictionLine: string;
  resolutionLine: string;
  plantSceneIndex: number;
  targetSceneIndex: number;
}

type ContradictionPattern = (concept: string, detail: string) => {
  contradiction: string;
  resolution: string;
};

const PATTERNS: ContradictionPattern[] = [
  // 0: "Everyone says X, but..."
  (concept, detail) => ({
    contradiction: `Everyone says ${concept} is the best approach. That is actually wrong for most real-world systems. I will show you why in a moment.`,
    resolution: `Remember when I said ${concept} is wrong for most systems? Here is the proof. ${detail}`,
  }),
  // 1: "Your textbook is outdated"
  (concept, detail) => ({
    contradiction: `What your textbook says about ${concept} is outdated. The real approach that companies like Google use is coming up.`,
    resolution: `Here is what replaced the textbook version of ${concept}. ${detail}`,
  }),
  // 2: "The opposite is true"
  (concept, detail) => ({
    contradiction: `Most developers think more ${concept} means better performance. It can actually make things worse. Stay tuned to see why.`,
    resolution: `Here is why more ${concept} can backfire. ${detail} This is what separates junior from senior answers in interviews.`,
  }),
  // 3: "Nobody tells you this"
  (concept, detail) => ({
    contradiction: `There is one thing about ${concept} that nobody mentions in tutorials, and it is exactly what interviewers test. I will reveal it shortly.`,
    resolution: `Here is the hidden catch about ${concept} that interviewers love to ask. ${detail}`,
  }),
];

const HIGH_VALUE_TYPES = new Set(['code', 'interview', 'review', 'summary']);

/**
 * Generate contradiction-based open loops for a video.
 * Plants teasers in earlier scenes, resolves them in target scenes.
 * Deterministic: same input always produces same output.
 * Max 3 loops per video, all unique.
 */
export function generateOpenLoops(
  scenes: Scene[],
  topic: string,
  sessionNumber: number,
): OpenLoop[] {
  const loops: OpenLoop[] = [];
  const usedPatterns = new Set<number>();

  // Find high-value target scenes
  const targets = scenes
    .map((s, i) => ({ scene: s, index: i }))
    .filter(({ scene }) => HIGH_VALUE_TYPES.has(scene.type));

  for (const target of targets) {
    if (loops.length >= 3) break;

    // Plant 3-5 scenes before target
    const plantIndex = Math.max(1, target.index - 3 - (loops.length)); // vary offset
    if (plantIndex >= target.index) continue;
    if (loops.some(l => l.plantSceneIndex === plantIndex)) continue; // don't double-plant

    // Select pattern deterministically, ensuring no repeats
    const seed = (topic.length * 7 + sessionNumber * 13 + target.index * 3) % PATTERNS.length;
    let patternIdx = seed;
    while (usedPatterns.has(patternIdx) && usedPatterns.size < PATTERNS.length) {
      patternIdx = (patternIdx + 1) % PATTERNS.length;
    }
    usedPatterns.add(patternIdx);

    // Extract concept from target scene
    const concept = target.scene.heading || topic;
    const detail = target.scene.narration?.split('.').slice(0, 2).join('.') || '';

    const pattern = PATTERNS[patternIdx];
    const { contradiction, resolution } = pattern(concept, detail);

    loops.push({
      contradictionLine: contradiction,
      resolutionLine: resolution,
      plantSceneIndex: plantIndex,
      targetSceneIndex: target.index,
    });
  }

  return loops;
}

/**
 * Inject open loops into scene narrations.
 * Appends contradiction to plant scene, prepends resolution to target scene.
 * Returns a NEW array — does not mutate input.
 */
export function injectOpenLoops(scenes: Scene[], topic: string, sessionNumber: number): Scene[] {
  const loops = generateOpenLoops(scenes, topic, sessionNumber);
  if (loops.length === 0) return scenes;

  const modified = scenes.map(s => ({ ...s })); // shallow clone

  for (const loop of loops) {
    const plant = modified[loop.plantSceneIndex];
    const target = modified[loop.targetSceneIndex];

    if (plant && plant.narration) {
      plant.narration = `${plant.narration} ${loop.contradictionLine}`;
    }
    if (target && target.narration) {
      target.narration = `${loop.resolutionLine} ${target.narration}`;
    }
  }

  return modified;
}
```

- [ ] **Step 3: Wire into script-generator.ts**

In `src/pipeline/script-generator.ts`, add import:
```typescript
import { injectOpenLoops } from '../lib/open-loops';
```

Find the end of `generateScript()` — the return statement (around line 1300-1302):

```typescript
  const personalizedScenes = personalityInjector(scenes, sessionNum);

  return addStoryTransitions(personalizedScenes);
```
Replace with:
```typescript
  const personalizedScenes = personalityInjector(scenes, sessionNum);

  // ── Inject contradiction-based open loops ──────────────────────────────
  const withLoops = injectOpenLoops(personalizedScenes, session.topic, sessionNum);

  return addStoryTransitions(withLoops);
```

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add src/lib/topic-categories.ts src/lib/open-loops.ts src/pipeline/script-generator.ts
git commit -m "feat: contradiction-based open loops for 32% retention boost (P2)

4 patterns: 'everyone says X but', 'textbook outdated', 'opposite
is true', 'nobody tells you'. Max 3 per video, content-derived,
deterministic, unique per session. Auto-injected into narration."
```

---

## Task 6: Smoke Test & Validation

- [ ] **Step 1: Full TypeScript compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Generate API Gateway S1 storyboard with new engine**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsx scripts/render-session.ts api-gateway 1`
Expected: Storyboard generates with:
- Shorter intro (90 frames, not 150)
- Spoken hook in scene 1 narration
- Open loop contradiction lines in earlier scenes
- Faster TTS rate (+20% for title, +5% for text, etc.)

- [ ] **Step 3: Render a quick preview (first 30 seconds)**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx remotion render src/compositions/index.tsx LongVideo output/hook-test.mp4 --props=output/test-props-s1.json --frames=0-900 --concurrency=4`
Expected: 30-second preview renders showing:
- Bold text hook at frame 0 (no countdown)
- Pattern interrupts visible within scenes
- Faster transitions between scenes

- [ ] **Step 4: Commit final state**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add -A
git commit -m "chore: complete Hook & Retention Engine (sub-project 1)

5 components built:
1. Dual hook (text + spoken at frame 0, 7 formulas)
2. Pattern interrupt engine (5 types every 5-8s)
3. Contradiction open loops (4 patterns, max 3/video)
4. Style-driven transitions (0.27s default, 0.5s dramatic)
5. TTS pacing overhaul (+20% hooks, -8% code, +2Hz pitch)

Pipeline retention target: 50%+ (from <30%)."
```

---

## Dependency Graph

```
Task 1 (TTS Pacing) ──── independent ────────────────────┐
Task 2 (Hook System) ──── independent ───────────────────┤
Task 3 (Transitions) ──── depends on Task 1 (style) ────┤
Task 4 (Interrupts) ───── depends on Task 3 (LongVideo) ┤
Task 5 (Open Loops) ───── independent ───────────────────┤
Task 6 (Smoke Test) ───── depends on all ────────────────┘
```

**Recommended parallel batches:**
- **Batch 1:** Tasks 1, 2 (independent — TTS + Hook)
- **Batch 2:** Task 5 (open loops — modifies script-generator.ts which Task 2 also touches, so must run AFTER Task 2)
- **Batch 3:** Tasks 3, 4 (sequential — both touch video-styles.ts and LongVideo.tsx)
- **Batch 4:** Task 6 (validation)

**Note:** Tasks 2 and 5 both modify `script-generator.ts` — they CANNOT run in parallel. Task 2 modifies lines 1061-1080 (hook generation), Task 5 modifies lines 1299-1302 (return statement). Run Task 2 first, then Task 5.
