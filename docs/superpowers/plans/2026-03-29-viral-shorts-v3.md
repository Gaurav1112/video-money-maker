# Viral Shorts v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a purpose-built 1080x1920 Remotion composition that renders viral shorts/reels with alternating full-screen text and diagram frames, using the same storyboard data and audio as the long video.

**Architecture:** New `ViralShort.tsx` composition renders scenes as full-screen frames (never split panels). Text scenes fill 1080px width with large fonts. Diagram scenes render ConceptViz at full 1080px width. CaptionOverlay renders at the bottom with karaoke word highlighting. Same master audio with `startFrom` offset. Smart clip selector groups scenes by heading into complete subtopics.

**Tech Stack:** Remotion 4, React 19, TypeScript, Edge TTS word timestamps

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/compositions/ViralShort.tsx` | CREATE | The 1080x1920 vertical composition — alternating full-screen frames |
| `src/compositions/index.tsx` | MODIFY | Register `ViralShort` composition |
| `src/pipeline/smart-clip-selector.ts` | CREATE | Group scenes by heading, score, select subtopic clips |
| `scripts/render-viral-shorts.ts` | CREATE (replace) | CLI to render viral shorts from storyboard props |
| `package.json` | MODIFY | Update `render:shorts` npm script |

---

### Task 1: Create ViralShort.tsx — The Composition

**Files:**
- Create: `src/compositions/ViralShort.tsx`

- [ ] **Step 1: Create the composition file with layout constants**

```typescript
// src/compositions/ViralShort.tsx
import React from 'react';
import {
  useCurrentFrame, useVideoConfig, AbsoluteFill, Sequence,
  Audio, staticFile, interpolate, spring,
} from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { Storyboard, Scene } from '../types';
import { COLORS, FONTS } from '../lib/theme';
import { SyncTimeline } from '../lib/sync-engine';
import { setSyncTimeline } from '../hooks/useSync';
import { ConceptViz } from '../components/ConceptViz';
import { CaptionOverlay, BackgroundLayer } from '../components';

// ── Layout ──
const SHORT_INTRO = 60;   // 2s hook
const SHORT_OUTRO = 90;   // 3s CTA
const SAFE_ZONE = 150;    // YT/IG UI buttons
const CTA_BAR_H = 76;     // branding bar
const CAPTION_H = 200;    // subtitle strip
const TRANSITION = 8;     // cross-fade frames

// Content area: 1920 - SAFE_ZONE - CTA_BAR_H - CAPTION_H = 1494px
const CONTENT_TOP = 0;
const CONTENT_HEIGHT = 1920 - SAFE_ZONE - CTA_BAR_H - CAPTION_H;

interface ViralShortProps {
  storyboard: Storyboard;
  clipStart?: number;
  clipEnd?: number;
}
```

- [ ] **Step 2: Build the main component with intro, content scenes, outro, captions, CTA, and audio**

The main component structure:
```
<AbsoluteFill>
  <BackgroundLayer />

  {/* INTRO: Hook text full-screen */}
  <Sequence from={0} duration={SHORT_INTRO}>
    <HookFrame hookText={...} />
  </Sequence>

  {/* CONTENT: Alternating full-screen scenes */}
  <Sequence from={SHORT_INTRO} duration={contentFrames}>
    <TransitionSeries>
      {scenes.map(scene => (
        <TransitionSeries.Sequence duration={sceneDuration}>
          {scene.type === 'text' || scene.type === 'interview' ? (
            <FullScreenText scene={scene} />
          ) : (
            <FullScreenViz scene={scene} topic={topic} />
          )}
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={linearTiming({durationInFrames: TRANSITION})} presentation={fade()} />
      ))}
    </TransitionSeries>
  </Sequence>

  {/* OUTRO: CTA */}
  <Sequence from={SHORT_INTRO + contentFrames} duration={SHORT_OUTRO}>
    <OutroFrame topic={topic} />
  </Sequence>

  {/* SUBTITLES: Same CaptionOverlay, positioned above CTA bar */}
  <div style={{ position:'absolute', bottom: SAFE_ZONE + CTA_BAR_H, left:0, right:0, height: CAPTION_H, zIndex:50, clipPath:'inset(0)' }}>
    <CaptionOverlay ... />
  </div>

  {/* CTA BAR */}
  <div style={{ position:'absolute', bottom: SAFE_ZONE, height: CTA_BAR_H, ... }}>
    guru-sishya.in — FREE Interview Prep
  </div>

  {/* AUDIO: Same master MP3, seeked to clip position */}
  <Audio src={masterAudio} startFrom={audioStartFrame} />
</AbsoluteFill>
```

- [ ] **Step 3: Build HookFrame sub-component**

Giant text that fills the screen from frame 0:
```typescript
const HookFrame: React.FC<{hookText: string; fps: number}> = ({hookText, fps}) => {
  const frame = useCurrentFrame();
  const scale = spring({ frame, fps, config: { damping: 10, stiffness: 300, mass: 0.5 } });
  return (
    <AbsoluteFill style={{ display:'flex', alignItems:'center', justifyContent:'center', padding: 60 }}>
      <div style={{
        fontSize: 56, fontWeight: 900, color: '#FFF', textAlign: 'center',
        lineHeight: 1.15, transform: `scale(${interpolate(scale, [0,1], [1.2,1])})`,
        textShadow: '0 0 30px rgba(232,93,38,0.4), 0 4px 8px rgba(0,0,0,0.8)',
      }}>
        {hookText}
      </div>
      <div style={{ marginTop: 24, fontSize: 20, fontWeight: 700, color: '#E85D26', opacity: interpolate(frame, [20,35], [0,0.7], {extrapolateRight:'clamp'}) }}>
        GURU SISHYA
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 4: Build FullScreenText sub-component**

Full-width text with heading + bullets:
```typescript
const FullScreenText: React.FC<{scene: Scene; fps: number}> = ({scene, fps}) => {
  const frame = useCurrentFrame();
  const bullets = scene.bullets || [];

  return (
    <AbsoluteFill style={{ padding: '80px 56px', display:'flex', flexDirection:'column', justifyContent:'center' }}>
      {scene.heading && (
        <div style={{
          fontSize: 52, fontWeight: 900, color: '#FFF', lineHeight: 1.15,
          borderLeft: '6px solid #E85D26', paddingLeft: 24, marginBottom: 32,
          // spring entrance
        }}>
          {scene.heading}
        </div>
      )}
      {bullets.slice(0, 4).map((bullet, i) => (
        <div key={i} style={{
          fontSize: 32, color: i === 0 ? '#FFF' : '#CCC', fontWeight: i === 0 ? 700 : 500,
          lineHeight: 1.4, marginBottom: 20, paddingLeft: 24,
          borderLeft: i === 0 ? '4px solid #FDB813' : '4px solid transparent',
          // staggered spring entrance
        }}>
          {bullet}
        </div>
      ))}
      {/* Fallback: first sentence of narration if no bullets */}
      {bullets.length === 0 && scene.narration && (
        <div style={{ fontSize: 36, color: '#FFF', fontWeight: 700, lineHeight: 1.35, paddingLeft: 24, borderLeft: '4px solid #20C997' }}>
          {scene.narration.split(/[.!?]/)[0]}.
        </div>
      )}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 5: Build FullScreenViz sub-component**

ConceptViz fills the entire frame:
```typescript
const FullScreenViz: React.FC<{scene: Scene; topic: string; sceneIndex: number; sceneStartFrame: number}> = ({scene, topic, sceneIndex, sceneStartFrame}) => {
  return (
    <AbsoluteFill style={{ padding: '40px 20px' }}>
      {/* Small heading at top for context */}
      {scene.heading && (
        <div style={{ fontSize: 28, fontWeight: 700, color: '#E85D26', marginBottom: 16, textAlign: 'center' }}>
          {scene.heading}
        </div>
      )}
      <div style={{ flex: 1, position: 'relative' }}>
        <ConceptViz topic={topic} sceneIndex={sceneIndex} sceneStartFrame={sceneStartFrame}
          keywords={scene.bullets || []} sceneDuration={scene.endFrame - scene.startFrame}
          vizVariant={scene.vizVariant} />
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 6: Build OutroFrame sub-component**

Cliffhanger + CTA:
```typescript
const OutroFrame: React.FC<{fps: number; topic: string}> = ({fps, topic}) => {
  const frame = useCurrentFrame();
  const topicSlug = topic.toLowerCase().replace(/\s+/g, '-');
  return (
    <AbsoluteFill style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding: 56 }}>
      {/* Phase 1: Cliffhanger */}
      {frame < 35 && (
        <div style={{ fontSize: 40, fontWeight: 900, color: '#FFF', textAlign: 'center', textShadow: '0 0 20px rgba(232,93,38,0.5)' }}>
          But there's ONE thing{'\n'}most people miss...
        </div>
      )}
      {/* Phase 2: CTA */}
      {frame >= 25 && (
        <>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#E85D26', marginBottom: 20 }}>GURU SISHYA</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#20C997', background: 'rgba(32,201,151,0.12)',
            padding: '14px 32px', borderRadius: 32, border: '2px solid #20C997' }}>
            guru-sishya.in/{topicSlug}
          </div>
          <div style={{ fontSize: 22, color: '#FFF', marginTop: 12 }}>1,988 FREE Practice Questions</div>
        </>
      )}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 7: Wire up audio with startFrom offset and sync timeline**

```typescript
// In main component:
const audioStartOffset = (storyboard as any)._audioStartOffset ?? 0;
const audioStartFrame = Math.round(audioStartOffset * fps);

// Sync timeline for captions
const syncTimeline = React.useMemo(() => {
  const offsets = storyboard.sceneOffsets || [];
  const timestamps = storyboard.scenes.map(s => s.wordTimestamps || []);
  return new SyncTimeline(offsets, timestamps, fps, SHORT_INTRO);
}, [storyboard, fps]);

React.useEffect(() => { setSyncTimeline(syncTimeline); }, [syncTimeline]);
```

- [ ] **Step 8: Type check**

Run: `npx tsc --noEmit`
Expected: EXIT 0

- [ ] **Step 9: Commit**

```bash
git add src/compositions/ViralShort.tsx
git commit -m "feat: add ViralShort composition — purpose-built 9:16 with alternating full-screen frames"
```

---

### Task 2: Register ViralShort Composition

**Files:**
- Modify: `src/compositions/index.tsx`

- [ ] **Step 1: Import and register ViralShort**

Add to imports:
```typescript
import { ViralShort } from './ViralShort';
```

Add composition after ShortVideo:
```typescript
<Composition
  id="ViralShort"
  component={asCompositionComponent(ViralShort)}
  calculateMetadata={({ props }: { props: Record<string, unknown> }) => ({
    durationInFrames: ((props.storyboard as Storyboard)?.durationInFrames || 1800) + 150,
    fps: 30,
    width: 1080,
    height: 1920,
  })}
  fps={30}
  width={1080}
  height={1920}
  defaultProps={{ storyboard: defaultStoryboard }}
/>
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: EXIT 0

- [ ] **Step 3: Commit**

```bash
git add src/compositions/index.tsx
git commit -m "feat: register ViralShort composition at 1080x1920"
```

---

### Task 3: Create Smart Clip Selector

**Files:**
- Create: `src/pipeline/smart-clip-selector.ts`

- [ ] **Step 1: Create the module with groupScenesByHeading**

Group consecutive scenes sharing the same `heading` into logical subtopics. Each group = 1 potential short.

- [ ] **Step 2: Add scoreSuggestions — score each group by virality**

Scoring: interview (100) > code (80) > problem (70) > text (50). Bonuses for ideal duration (30-50s), having narration, multi-scene groups.

- [ ] **Step 3: Add selectSubtopicClips — pick top non-overlapping clips**

Filter by duration (20-58s), sort by score, select up to 5 non-overlapping clips, return in chronological order.

- [ ] **Step 4: Add buildMiniStoryboard — create a storyboard for one clip**

Re-index scene frames starting from 0, preserve wordTimestamps, calculate `_audioStartOffset` from the first scene's `audioOffsetSeconds`.

- [ ] **Step 5: Export the public API**

```typescript
export { selectSubtopicClips, buildMiniStoryboard };
```

- [ ] **Step 6: Type check + commit**

---

### Task 4: Create Render Script

**Files:**
- Create: `scripts/render-viral-shorts.ts` (replace existing)

- [ ] **Step 1: Create CLI script**

```
npx tsx scripts/render-viral-shorts.ts --topic "Load Balancing" --session 1 --props output/test-props-s1.json
```

Steps:
1. Load storyboard from props JSON
2. Call `selectSubtopicClips()` to pick clips
3. For each clip: `buildMiniStoryboard()` → write temp props → Remotion `renderMedia()` with `ViralShort` composition
4. Output to `~/Documents/guru-sishya/{topic}/session-{n}/shorts/` and `reels/`
5. Write metadata.json

- [ ] **Step 2: Update package.json**

```json
"render:shorts": "tsx scripts/render-viral-shorts.ts"
```

- [ ] **Step 3: Type check + commit**

---

### Task 5: Test Render + Verify

- [ ] **Step 1: Render a test short from Load Balancing S1**

```bash
npm run render:shorts -- --topic "Load Balancing" --session 1 --props output/test-props-s1.json
```

- [ ] **Step 2: Verify output**

Check:
- File exists at `~/Documents/guru-sishya/load-balancing/session-1/shorts/short-1.mp4`
- Resolution is 1080x1920
- Has audio stream
- Subtitles are visible and synced
- Text is large and readable (52px heading, 32px bullets)
- Viz fills the screen
- Branding bar visible
- Hook text in first 2 seconds

- [ ] **Step 3: Commit all changes**

---

### Task 6: Clean Up Broken Converters

- [ ] **Step 1: Delete broken files**

```bash
rm src/pipeline/shorts-converter.ts
rm src/pipeline/viral-shorts-converter.ts
rm scripts/convert-shorts.ts
rm scripts/make-viral-shorts.ts
rm scripts/make-shorts-v2.ts
```

- [ ] **Step 2: Update render-all.ts to use new script**

Change the shorts rendering call to use `render-viral-shorts.ts`.

- [ ] **Step 3: Update package.json — remove broken npm scripts**

Remove `convert:shorts`, update `shorts`.

- [ ] **Step 4: Type check + commit**
