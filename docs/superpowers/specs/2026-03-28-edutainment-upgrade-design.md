# Edutainment Upgrade: Audio-Visual Sync, Animations, Music & SFX

**Date:** 2026-03-28
**Status:** Approved
**Scope:** 6 interconnected systems that transform the video pipeline from slideshow-with-voiceover into sync-driven edutainment

## Problem

Current videos score 5.4/10 average (Visual 6, Content 7, Audio 5, Polish 5, Engagement 4). Root causes:

1. **Audio-video desync** — Audio stitcher uses 0.8s gaps, storyboard uses 1.5s padding + 15-frame transitions. These are independent calculations that drift cumulatively.
2. **Static visuals** — All scene content appears instantly. No progressive reveals, no animation synced to narration.
3. **Dead visual space** — Text/interview scenes have empty right halves with no concept visualizations.
4. **No background music** — Raw narration with silence gaps feels unfinished.
5. **No sound effects** — No audio feedback on transitions, reveals, or interactions.
6. **No edutainment** — Narration describes concepts but visuals don't illustrate them. No animated diagrams, no flowing dots, no building trees.

**Target:** 10/10 on all dimensions. Videos should feel like 3Blue1Brown meets Khan GS — every word has a corresponding visual change.

## Phase 0: Real Word Timestamps (Prerequisite)

The current TTS engine's `makeTimestamps()` divides total duration evenly across words — every word gets identical duration regardless of actual speech cadence. This is fundamentally incompatible with word-level sync. **Before any sync work begins**, the TTS engine must produce real word-level timestamps:

- **Edge TTS** — Use `--write-subtitles` flag which outputs VTT with word-level timing. Parse VTT into `WordTimestamp[]`.
- **Kokoro** — Use the `/timestamps` endpoint if available, or post-process with `stable-ts` (Python forced alignment library) as documented in the Kokoro TTS memory file.
- **Fallback** — If real timestamps are unavailable for a backend, distribute words proportionally by character count (not evenly) as a better-than-uniform approximation: `wordStart = sceneStart + (charsBeforeWord / totalChars) * duration`.

## Architecture

All 6 systems are built on a single shared primitive: the **SyncEngine** with a `useSync()` React hook.

```
Script Generator → TTS Engine → Audio Stitcher → SyncEngine → Consumer Systems → Remotion Output
                                     │                │
                                sceneOffsets[]    useSync() hook
                                (single source     (frame-level
                                 of truth)          timeline)
```

### Data Flow

1. **Script Generator** produces scenes with narration text and `animationCues[]`
2. **TTS Engine** (Kokoro/Edge) generates audio + **real** word-level timestamps per scene (see Phase 0)
3. **Audio Stitcher** concatenates into master track, returns `sceneOffsets[]` (exact start time of each scene in seconds)
4. **SyncEngine** converts `sceneOffsets[]` + `wordTimestamps[]` into a frame-level timeline
5. **Consumer systems** subscribe via `useSync()` and animate reactively
6. **Remotion** renders all visual + audio layers to MP4

### Critical Change: Audio Drives Video

**Before (broken):** Scene visual durations computed independently from audio timing. Audio gap = 0.8s, visual padding = 1.5s, transition = 0.5s → cumulative drift.

**After (fixed):** `sceneOffsets[]` from the audio stitcher is the single source of truth. Visual scene duration = `sceneOffsets[i+1] - sceneOffsets[i]` converted to frames. TransitionSeries frame counts are computed FROM audio offsets, not independently. No separate padding or gap calculations.

## System 1 & 2: SyncEngine + Audio-Visual Sync

### SyncEngine (`src/lib/sync-engine.ts`)

A pure data layer that converts word timestamps + scene offsets into frame-level lookup data. No React dependency — just data transformation.

**Input:**
- `sceneOffsets: number[]` — start time (seconds) of each scene in master audio
- `wordTimestamps: WordTimestamp[][]` — per-scene array of `{ word, start, end }` from TTS
- `fps: number` — frames per second (30)

**Output:** A `SyncTimeline` object consumed by `useSync()`.

### useSync() Hook (`src/hooks/useSync.ts`)

A React hook that reads Remotion's `useCurrentFrame()` and returns sync state for the current scene.

```typescript
interface SyncState {
  currentWord: string;          // Word being spoken right now (empty in gaps)
  wordIndex: number;            // Index into scene's wordTimestamps (0-based)
  sceneProgress: number;        // 0→1 float for scene-local progress
  phraseBoundaries: number[];   // Word indices where sentences/phrases end
  isNarrating: boolean;         // Is audio playing vs in a silence gap?
  wordsSpoken: number;          // Total words spoken so far in this scene
}
```

**Usage:** Every scene component calls `useSync(sceneIndex)` and uses the returned values to drive animations.

### Storyboard Changes

The storyboard builder (`src/pipeline/storyboard.ts`) must be refactored:

- Remove independent duration calculations (no more "audio + 2s" padding)
- Scene `durationInFrames` = `Math.round((sceneOffsets[i+1] - sceneOffsets[i]) * fps) + TRANSITION_DURATION`
  - The `+ TRANSITION_DURATION` compensates for crossfade overlap consumed by adjacent TransitionSeries transitions
- Last scene duration = remaining audio frames after last offset + TRANSITION_DURATION
- **Scenes with missing audio** (offset === -1): assign a fixed fallback duration based on scene type defaults (title: 10s, text: 8s, etc.) and skip sync-driven animation (use time-based fallback animations instead)
- Intro/outro durations remain fixed (90 and 150 frames) — these are outside the audio stitcher's scope
- Store `wordTimestamps` per scene in the storyboard for `useSync()` consumption

### Frame Offset Formula

The intro scene sits before the master audio starts. The absolute frame position of any content scene is:

```
absoluteFrame(sceneIndex) = INTRO_FRAMES + Math.round(sceneOffsets[sceneIndex] * fps)
```

The master `<Audio>` component must use `from={INTRO_FRAMES}` so narration begins after the intro. `useSync(sceneIndex)` internally accounts for this offset.

### Type Additions

```typescript
// Added to Scene interface
interface Scene {
  // ... existing fields ...
  wordTimestamps?: WordTimestamp[];   // Real TTS word timing for this scene
  animationCues?: AnimationCue[];    // Visual animation triggers
  sfxTriggers?: SfxTrigger[];        // Sound effect triggers
}

// Added to Storyboard interface
interface Storyboard {
  // ... existing fields ...
  sceneOffsets: number[];            // Master audio offset (seconds) per scene
  allSfxTriggers: SfxTrigger[];     // Flattened SFX triggers for SfxLayer
}
```

### LongVideo/ShortVideo Composition Changes

- TransitionSeries `<Transition.Presentation>` durations come from storyboard frame counts (which come from audio offsets + transition compensation)
- Single `<Audio src={masterTrack} from={INTRO_FRAMES}>` — starts after intro
- Remove all per-scene audio logic
- Add `<BgmLayer>` and `<SfxLayer>` as sibling audio components

## System 3: Sub-Scene Animations

Each scene type gets narration-synced internal animations driven by `animationCues[]` and `useSync()`.

### Animation Cues

The script generator embeds `animationCues[]` in each scene:

```typescript
interface AnimationCue {
  wordIndex: number;    // Which word triggers this animation
  action: string;       // What to do: 'typeLine', 'showNode', 'revealBullet', etc.
  target?: string | number;  // Action-specific target (line number, node id, bullet index)
}
```

Cues are auto-generated by the script generator based on scene type. The algorithm for each:

- **Code scenes** → Narration typically has fewer phrases than code lines (e.g., 3 phrases for 15 lines). **Algorithm:** divide code lines evenly across narration phrases. If narration has N phrases and code has M lines, each phrase triggers `ceil(M/N)` lines. Cue wordIndex = first word of each phrase. Example: 3 phrases, 9 lines → lines 1-3 at phrase 1, lines 4-6 at phrase 2, lines 7-9 at phrase 3.
- **Diagram scenes** → one cue per node/edge, matched to entity name mentions in narration text (string match on node labels)
- **Text scenes** → one cue per bullet, matched to phrase boundaries (see below)
- **Table scenes** → one cue per row, evenly distributed across narration duration if no explicit phrase matches

### Phrase Boundary Detection

`phraseBoundaries` are computed from the narration text by splitting on sentence-ending punctuation (`.`, `!`, `?`) and clause-breaking punctuation (`;`, `:`, `, and `, `, but `, `, or `). Each boundary is the `wordIndex` of the last word before the split. This is a simple text-based heuristic, not NLP.

### Per-Component Animation Behavior

**CodeReveal** (rewrite of existing component):
- Lines type character-by-character as narrator explains each one
- `typeLine(n)` triggered at wordIndex cue
- `highlightLine(n)` during active explanation
- Cursor blinks at current line
- Keyboard-click SFX per character burst

**DiagramBuild** (new component, replaces static DiagramSlide for applicable scenes):
- Nodes spring-in (`scaleIn` with spring physics) when narrator mentions them
- Edges draw as animated paths connecting nodes
- `showNode(id)`, `drawEdge(from, to)`, `pulseNode(id)` actions
- Pop SFX on each node appearance

**BulletReveal** (rewrite of TextSection):
- Bullets slide in from left one at a time at phrase boundaries
- `revealBullet(n)` at `phraseBoundaries[n]`
- Keywords highlight with color change as they're spoken
- Soft-tap SFX per bullet

**ComparisonReveal** (rewrite of ComparisonTable):
- Table rows slide in one at a time synced to narration
- Checkmarks/X marks animate on mention
- Winner row gets glow effect at scene end
- Ding SFX per row

**MetricCounter** (new component):
- Numbers count up from 0 with `easeOutExpo` deceleration
- Triggered at wordIndex cue when narrator says the number
- Supports bars, gauges, and plain counters
- Counting tick SFX + final ding

## System 4: Edutainment Components (ConceptViz)

### Split-Layout System

Text and interview scenes get a 55/45 split layout via a **`SplitLayout` wrapper component** (`src/components/SplitLayout.tsx`):

```typescript
function SplitLayout({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <div style={{ flex: '0 0 55%' }}>{left}</div>
      <div style={{ flex: '0 0 45%' }}>{right}</div>
    </div>
  );
}
```

The parent composition (LongVideo/ShortVideo) wraps text/interview scenes in `SplitLayout`. Individual scene components (BulletReveal, InterviewInsight) render at whatever width they're given — they don't know about the split. ConceptViz fills the right side.

Both sides consume the same `useSync()` timeline. The left side reveals bullets progressively, the right side animates the concept visualization in sync.

### ConceptViz Component (`src/components/ConceptViz.tsx`)

A routing component that maps topic → visualization:

```typescript
function ConceptViz({ topic, sceneIndex }: Props) {
  const sync = useSync(sceneIndex);
  const Viz = getVisualization(topic);  // topic→component mapping
  return <Viz sync={sync} />;
}
```

### Visualization Library

Start with 5 core visualizations for the 3 demo topics, plus 2 generics:

| Visualization | Topics | Animation |
|---|---|---|
| `TrafficFlow` | Load Balancing, CDN, API Gateway | Dots flow from source through LB to servers. Server health bars. Fan-out arrows. |
| `HashTableViz` | Hash Maps, Sets, Caching | Bucket array with chaining. Keys hash and land in buckets. Collision animation. |
| `SystemArchViz` | System Design, Microservices | Layered architecture blocks. Request flows between layers. Component highlights. |
| `TreeViz` | Binary Trees, BST, Heaps | Node insert/delete with rebalancing animation. Traversal path highlighting. |
| `SortingViz` | Sorting algorithms | Bar chart with swap/compare animations. |
| `KeywordCloud` | Generic fallback | Animated keyword cloud, current narration word pulses large. |
| `MetricDashboard` | Generic for number-heavy scenes | Multiple counters, bars, gauges animating. |

Each visualization is a standalone React component using Remotion's `interpolate()` and `spring()`. New visualizations can be added without architecture changes — just add a component and register the topic mapping.

### Topic Mapping

The script generator's existing 40+ topic→analogy map is extended to include a `visualization` field:

```typescript
const TOPIC_VIZ_MAP: Record<string, string> = {
  'load-balancing': 'TrafficFlow',
  'hash-map': 'HashTableViz',
  'system-design': 'SystemArchViz',
  'binary-tree': 'TreeViz',
  'merge-sort': 'SortingViz',
  // ... more mappings
  // Unmapped topics fall back to 'KeywordCloud'
};
```

## System 5: Background Music

### Asset Library

4 royalty-free lo-fi loops stored in `public/audio/bgm/`:

| File | Duration | Style |
|---|---|---|
| `lofi-study-1.wav` | ~2.5 min | Mellow piano + lo-fi beats |
| `lofi-study-2.wav` | ~3 min | Ambient chords + soft drums |
| `lofi-chill-1.wav` | ~2 min | Guitar + vinyl crackle |
| `lofi-ambient-1.wav` | ~2.5 min | Pad textures + subtle rhythm |

All CC0 licensed, **MP3 format** (~3MB each vs ~34MB WAV — keeps repo lightweight for $8/month VPS). Selected deterministically per video using seeded random (topic + session number as seed).

### BgmLayer Component (`src/components/BgmLayer.tsx`)

A Remotion component placed in the composition alongside the master narration audio.

**Behavior:**
- Plays selected BGM loop for full video duration (loops if video > track length)
- Volume ducking driven by the `SyncTimeline` directly (not via `useSync()` hook, since BgmLayer is composition-level). BgmLayer receives the full `SyncTimeline` object as a prop and computes `isNarrating` from the current frame by checking if the frame falls within any scene's word timestamp range:
  ```
  isNarrating = syncTimeline.isFrameInNarration(currentFrame)
  ```
- Volume levels:
  - Narrating → `interpolate()` volume to **0.08** (8%)
  - Silence gap → `interpolate()` volume to **0.25** (25%)
  - Attack/release: 10 frames (0.33s) for smooth transitions
- Fade in over first 60 frames (2s) of video
- Fade out over last 90 frames (3s) of video
- Uses Remotion's `<Audio volume={...}>` with computed volume per frame

## System 6: Sound Effects

### Asset Library

~15 royalty-free sound effects stored in `public/audio/sfx/`:

| File | Duration | Usage |
|---|---|---|
| `whoosh-in.wav` | 0.4s | Scene transitions (enter) |
| `whoosh-out.wav` | 0.3s | Scene transitions (exit) |
| `swoosh.wav` | 0.3s | Slide-in animations |
| `pop.wav` | 0.2s | Node/element appearance |
| `click.wav` | 0.1s | Single interaction |
| `soft-tap.wav` | 0.15s | Bullet reveal |
| `keyboard-click.wav` | 0.15s | Code character typing |
| `keyboard-burst.wav` | 0.5s | Code line completion |
| `ding.wav` | 0.5s | Table row reveal, counter step |
| `chime.wav` | 0.8s | Important reveal |
| `shimmer.wav` | 0.6s | Diagram edge draw |
| `success-chime.wav` | 1.2s | Scene completion, correct answer |
| `level-up.wav` | 1.5s | Summary/outro |
| `subtle-pulse.wav` | 0.4s | Emphasis pulse |
| `tension-build.wav` | 1.0s | Problem setup scenes |

All CC0 licensed, WAV format.

### SFX Trigger Types

**Auto-triggered** — These are rendered by individual scene components using inline `<Sequence>` + `<Audio>` within the component itself (not via `SfxLayer`). Each component knows when its animation fires and plays the corresponding SFX at that frame:
- Scene transition → `whoosh-in`
- Code line typed → `keyboard-click` (or `keyboard-burst` on completion)
- Bullet revealed → `soft-tap`
- Diagram node appeared → `pop`
- Diagram edge drawn → `shimmer`
- Table row revealed → `ding`
- Counter completed → `success-chime`

**Cue-triggered** — These are pre-computed by the script generator and rendered by the composition-level `SfxLayer` (via `sfxTriggers[]` in scene data):
```typescript
interface SfxTrigger {
  sceneIndex: number;   // Which scene this trigger belongs to
  wordIndex: number;    // When to play (synced to narration word)
  effect: string;       // SFX filename (without extension)
  volume?: number;      // Optional volume override (default 1.0)
}
```

### SfxLayer Component (`src/components/SfxLayer.tsx`)

Renders each trigger as a positioned `<Sequence>` containing an `<Audio>`:

```typescript
function SfxLayer({ triggers, syncTimeline, fps }: Props) {
  return (
    <>
      {triggers.map((trigger, i) => {
        // computeFrame: looks up the word timestamp for trigger.wordIndex
        // in the scene identified by trigger.sceneIndex, adds INTRO_FRAMES
        // offset, and converts to absolute frame number
        const frame = syncTimeline.wordIndexToAbsoluteFrame(
          trigger.sceneIndex, trigger.wordIndex
        );
        // sfxDuration: returns frame count for the SFX file
        // (looked up from a static duration map, e.g. 'pop' → 6 frames)
        return (
          <Sequence key={i} from={frame} durationInFrames={sfxDuration(trigger.effect)}>
            <Audio src={staticFile(`audio/sfx/${trigger.effect}.wav`)} volume={trigger.volume ?? 1.0} />
          </Sequence>
        );
      })}
    </>
  );
}
```

## File Structure (New/Modified)

```
src/
├── lib/
│   └── sync-engine.ts              (NEW) Core sync timeline builder
├── hooks/                           (NEW directory)
│   └── useSync.ts                   (NEW) React hook for sync state
├── components/
│   ├── SplitLayout.tsx              (NEW) 55/45 split wrapper for text/interview scenes
│   ├── CodeReveal.tsx               (REWRITE) Sync-driven code typing
│   ├── TextSection.tsx              (REWRITE) → BulletReveal with split layout
│   ├── ComparisonTable.tsx          (REWRITE) → ComparisonReveal with row animations
│   ├── DiagramSlide.tsx             (REWRITE) → DiagramBuild with progressive reveal
│   ├── ConceptViz.tsx               (NEW) Split-layout concept visualization router
│   ├── viz/                         (NEW) Visualization components
│   │   ├── TrafficFlow.tsx
│   │   ├── HashTableViz.tsx
│   │   ├── SystemArchViz.tsx
│   │   ├── TreeViz.tsx
│   │   ├── SortingViz.tsx
│   │   ├── KeywordCloud.tsx
│   │   └── MetricDashboard.tsx
│   ├── MetricCounter.tsx            (NEW) Animated number counter
│   ├── BgmLayer.tsx                 (NEW) Background music with ducking
│   └── SfxLayer.tsx                 (NEW) Sound effects renderer
├── pipeline/
│   ├── storyboard.ts               (MODIFY) Audio-driven scene timing
│   └── script-generator.ts         (MODIFY) Add animationCues[] and sfxTriggers[]
├── compositions/
│   ├── LongVideo.tsx                (MODIFY) Add BgmLayer, SfxLayer, use sync timing
│   └── ShortVideo.tsx               (MODIFY) Same changes as LongVideo
└── types.ts                         (MODIFY) Add AnimationCue, SfxTrigger, SyncTimeline types

public/audio/
├── bgm/                             (NEW) 4 lo-fi loops (MP3)
│   ├── lofi-study-1.mp3
│   ├── lofi-study-2.mp3
│   ├── lofi-chill-1.mp3
│   └── lofi-ambient-1.mp3
└── sfx/                             (NEW) ~15 sound effects
    ├── whoosh-in.wav
    ├── whoosh-out.wav
    ├── pop.wav
    ├── click.wav
    ├── keyboard-click.wav
    ├── keyboard-burst.wav
    ├── ding.wav
    ├── chime.wav
    ├── shimmer.wav
    ├── soft-tap.wav
    ├── swoosh.wav
    ├── success-chime.wav
    ├── level-up.wav
    ├── subtle-pulse.wav
    └── tension-build.wav
```

## Testing Strategy

1. **SyncEngine unit tests** — Verify frame calculations match expected word positions for known timestamps
2. **Visual snapshot tests** — Remotion `renderStill()` at key frames to verify component state matches expected animation phase
3. **Audio layer tests** — Verify BGM ducking volume at specific frames, SFX placement at correct frames
4. **Integration test** — Full render of Load Balancing Session 1 demo, manual review of output video
5. **Sync drift test** — Compare last scene's visual end frame vs audio end time, assert < 1 frame of drift

## Success Criteria

| Dimension | Current | Target | How |
|---|---|---|---|
| Visual | 6/10 | 10/10 | Split layouts, concept viz, progressive reveals |
| Content | 7/10 | 10/10 | Animation cues make content tangible |
| Audio | 5/10 | 10/10 | BGM + SFX + perfect narration sync |
| Polish | 5/10 | 10/10 | Sound design, smooth transitions, no drift |
| Engagement | 4/10 | 10/10 | Every word has a corresponding visual change |

## Constraints

- Zero cost — all audio assets are CC0/royalty-free, bundled in repo
- Must render on $8/month VPS (no heavy GPU requirements)
- All animations use Remotion's `interpolate()` and `spring()` — no external animation libraries
- Master audio track approach preserved (no per-scene audio)
- Backward compatible with existing 3 demo topics
