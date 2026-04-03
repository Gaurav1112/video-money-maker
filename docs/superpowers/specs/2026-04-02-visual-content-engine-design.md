# Visual Content Engine — Design Spec

**Date:** 2026-04-02
**Status:** Approved, ready for implementation
**Sub-project:** 2 of 4 (Viral Video Converter v2)
**Goal:** Replace static text slides with animated visual storytelling — progressive diagrams, data flow particles, typewriter code, VS battle comparisons, game show quizzes. Every frame must SHOW what the narrator is talking about. No bullet points, no static text walls.

---

## Problem

Research (5 agents, 100+ sources) identified the core gap:
- Videos show bullet points and static code blocks while narrator talks
- 95% of Indian students are visual learners — static text fails them
- 70% engagement boost from animated explanations vs static
- Top creators (Fireship, ByteByteGo, 3B1B) never show bullet points — they build diagrams piece by piece
- Maximum 5-7 words on screen at any time — narrator provides detail, screen provides VISUAL
- Something must change on screen every 3-5 seconds

## Scope

Complete rebuild of all 7 scene type components (TitleSlide already rebuilt in Sub-project 1). Plus a foundation layer (visual beats, animated primitives, asset integration) and 20 visual templates with 5-8 variants each (~100 unique visual states).

---

## 1. Visual Beat System (Foundation)

### What It Does
Splits each scene's narration into "visual beats" — timestamps where a new visual element appears. Each sentence = one beat = one element revealed.

### `src/lib/visual-beats.ts`

```typescript
export interface VisualBeat {
  startTime: number;      // seconds into scene
  endTime: number;
  text: string;           // the sentence being spoken
  beatIndex: number;
  totalBeats: number;
  keywords: string[];     // extracted tech terms from this sentence
}

export function computeVisualBeats(
  narration: string,
  wordTimestamps: WordTimestamp[],
): VisualBeat[];
```

**Algorithm:**
1. Split narration into sentences at `.` `?` `!` boundaries
2. Map each sentence to its word timestamp range
3. Extract keywords (tech terms, ALL CAPS, numbers) per sentence
4. Return array of beats with timing and keyword data

### `src/hooks/useVisualBeat.ts`

```typescript
export function useVisualBeat(
  beats: VisualBeat[],
  fps: number,
): {
  activeBeat: VisualBeat | null;
  beatIndex: number;
  progress: number;       // 0-1 within current beat
  isTransitioning: boolean;
};
```

Uses `useCurrentFrame()` to determine which beat is active. All scene components read this hook to sync visual reveals.

### Files
- Create: `src/lib/visual-beats.ts`
- Create: `src/hooks/useVisualBeat.ts`

---

## 2. Animated Primitives (Reusable Building Blocks)

4 primitives used by all 20 visual templates:

### `src/components/viz/ProgressiveReveal.tsx`
Wrapper that reveals children one per beat. Children are React elements indexed by beat number. Active child has full opacity + slight scale-up. Previous children dim to 40%. Future children invisible.

```typescript
interface ProgressiveRevealProps {
  beats: VisualBeat[];
  fps: number;
  children: React.ReactNode[];  // one child per beat
  dimOpacity?: number;          // default 0.4
}
```

Uses `spring()` for entrance: `translateY(20px) → 0` + `opacity: 0 → 1` over 12 frames.

### `src/components/viz/DataFlowParticle.tsx`
Colored dots that move along an SVG path, simulating data flowing between components.

```typescript
interface DataFlowParticleProps {
  path: string;              // SVG path d="" string
  color: string;             // particle color
  count?: number;            // number of particles (default 4)
  speed?: number;            // seconds to traverse full path (default 2)
  fps: number;
  startFrame?: number;       // when to start animation
  trailLength?: number;      // trailing dots (default 3)
}
```

Uses `getPointAtLength()` from `@remotion/paths` to position each particle. Particles staggered by `1/count` of the path length. Each trailing dot has decreasing opacity (0.6, 0.3, 0.1).

### `src/components/viz/AnimatedArrow.tsx`
SVG arrow that draws itself from source to target using stroke-dashoffset animation.

```typescript
interface AnimatedArrowProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color?: string;            // default COLORS.gray
  duration?: number;         // frames to draw (default 15)
  startFrame: number;        // when to start drawing
  label?: string;            // optional text label at midpoint
  curved?: boolean;          // bezier curve vs straight line
}
```

Uses `evolvePath()` from `@remotion/paths`. Arrow head is a small triangle that appears at the end.

### `src/components/viz/AnimatedBox.tsx`
Labeled box with optional icon inside, spring entrance animation, glow when active.

```typescript
interface AnimatedBoxProps {
  label: string;
  icon?: string;             // Simple Icons slug or Lottie asset key
  x: number;
  y: number;
  width?: number;            // default 180
  height?: number;           // default 80
  color?: string;            // border/accent color
  isActive?: boolean;        // glow effect when true
  entryFrame: number;        // spring entrance at this frame
  fps: number;
}
```

Entry: `scale(0.7) → scale(1.0)` + `opacity: 0 → 1` via `spring({ damping: 14, stiffness: 120 })`. Active glow: `boxShadow: 0 0 20px ${color}44`. Icon renders as SVG from Simple Icons or `<Lottie>` from asset registry.

### Files
- Create: `src/components/viz/ProgressiveReveal.tsx`
- Create: `src/components/viz/DataFlowParticle.tsx`
- Create: `src/components/viz/AnimatedArrow.tsx`
- Create: `src/components/viz/AnimatedBox.tsx`

---

## 3. Asset Integration Layer

### `src/lib/icon-mapper.ts`
Maps 100+ tech keywords to Simple Icons SVG slugs for use inside diagram nodes.

```typescript
export function getIconSlug(keyword: string): string | null;
```

Examples: "Redis" → `"redis"`, "Docker" → `"docker"`, "PostgreSQL" → `"postgresql"`, "React" → `"react"`, "Kafka" → `"apachekafka"`, "AWS" → `"amazonaws"`, "Kubernetes" → `"kubernetes"`, "MongoDB" → `"mongodb"`, "Nginx" → `"nginx"`.

Icon SVGs loaded via CDN: `https://cdn.simpleicons.org/{slug}/{hexColor}`

Or via npm `simple-icons` package for offline rendering.

### `src/lib/lottie-assets.ts`
Registry of pre-downloaded Lottie JSONs in `public/lottie/`.

```typescript
export interface LottieAsset {
  id: string;
  file: string;        // path relative to public/
  category: string;    // 'status' | 'action' | 'data' | 'ui'
  duration: number;    // seconds
}

export const LOTTIE_ASSETS: LottieAsset[];
export function getLottieAsset(id: string): LottieAsset | null;
```

**15-20 pre-downloaded assets:**
| ID | Category | What It Shows |
|----|----------|---------------|
| `loading-spinner` | status | Circular loading animation |
| `success-check` | status | Green checkmark drawing itself |
| `error-alert` | status | Red X with shake |
| `warning-triangle` | status | Yellow warning pulse |
| `data-flow` | data | Dots flowing through a pipe |
| `server-pulse` | action | Server icon with heartbeat |
| `database-write` | action | Data writing to disk |
| `network-ping` | action | Signal radiating outward |
| `lock-unlock` | action | Padlock opening |
| `rocket-launch` | action | Rocket taking off |
| `fire` | ui | Flame animation |
| `confetti` | ui | Celebration burst |
| `typing-cursor` | ui | Blinking cursor |
| `search-magnify` | ui | Magnifying glass sweep |
| `refresh-cycle` | ui | Circular refresh arrows |

**Source:** LottieFiles (free commercial license verified per animation).

### `src/lib/bg-images.ts`
Maps scene types to subtle background stock photos (92% darkened overlay).

```typescript
export function getBackgroundImage(sceneType: SceneType): string | null;
```

10 pre-downloaded stock photos in `public/images/bg/`:
| Scene Type | Image | Source |
|-----------|-------|--------|
| code | `coding-screen.jpg` | Unsplash (free) |
| diagram | `data-center.jpg` | Pexels (free) |
| interview | `office-desk.jpg` | Unsplash (free) |
| table | `whiteboard.jpg` | Pexels (free) |
| text | `server-room.jpg` | Unsplash (free) |
| review | `terminal.jpg` | Pixabay (free) |
| summary | `dashboard.jpg` | Pexels (free) |

Applied as: `background: linear-gradient(rgba(12,10,21,0.92), rgba(12,10,21,0.92)), url(${image})`

### Files
- Create: `src/lib/icon-mapper.ts`
- Create: `src/lib/lottie-assets.ts`
- Create: `src/lib/bg-images.ts`
- Download: 15-20 Lottie JSONs → `public/lottie/`
- Download: 7-10 stock photos → `public/images/bg/`

---

## 4. Visual Template Registry

### `src/lib/visual-templates.ts`

```typescript
export interface VisualTemplateConfig {
  id: string;
  component: string;
  keywords: string[];
  variants: string[];
  layout: 'architecture' | 'flow' | 'comparison' | 'concept' | 'generic';
}

export function getVisualTemplate(
  topic: string,
  sessionNumber: number,
  sceneHeading: string,
  sceneType: SceneType,
  vizVariant?: string,
): {
  templateId: string;
  variant: string;
  accentColor: string;
};
```

**Matching algorithm:**
1. Extract keywords from `sceneHeading` + topic
2. Score each template: count matching keywords (heading keywords weighted 2x)
3. Best scoring template wins
4. Variant selected from content keywords within that template
5. Accent color: `['#E85D26', '#1DD1A1', '#FDB813', '#818CF8'][sessionNumber % 4]`
6. Fallback: `ConceptDiagram` for text/diagram scenes, `IconGrid` for list-heavy scenes

### The 20 Templates

Each template is a React component in `src/components/templates/`. They all share the same interface:

```typescript
interface VisualTemplateProps {
  beats: VisualBeat[];
  fps: number;
  variant: string;
  accentColor: string;
  sceneHeading: string;
  bullets?: string[];      // scene content for labels
  content?: string;        // raw content for parsing
}
```

#### Architecture Templates (7)

**`LoadBalancerArch`** — variants: `roundRobin`, `leastConnections`, `ipHash`, `weighted`, `overview`
- Beat 1: Client box appears (left)
- Beat 2: Load Balancer diamond appears (center) + arrow draws from client
- Beat 3-5: Server boxes appear (right, staggered) + arrows from LB
- Beat 6+: Data flow particles show distribution pattern per variant
- `roundRobin`: particles alternate servers 1→2→3→1→2→3
- `ipHash`: particles go to same server (color-coded by source)

**`CacheArch`** — variants: `overview`, `hitMiss`, `writeThrough`, `writeBehind`, `eviction`, `aside`
- Beat 1: Client box (left)
- Beat 2: Cache box (center, gold accent) + fast arrow (green)
- Beat 3: Database box (right) + slow arrow (red, dashed)
- Beat 4+: Variant-specific animation:
  - `hitMiss`: Green particle goes cache→client (fast), red goes client→DB→client (slow)
  - `writeThrough`: Write flows client→cache→DB sequentially
  - `writeBehind`: Write goes cache (instant green), then async batch to DB (delayed)
  - `eviction`: Items enter cache, oldest drops out the bottom when full

**`DatabaseArch`** — variants: `masterReplica`, `sharding`, `indexing`, `readWrite`, `overview`

**`MicroservicesArch`** — variants: `basic`, `eventDriven`, `saga`, `sidecar`, `overview`

**`MessageQueueArch`** — variants: `pubSub`, `pointToPoint`, `fanOut`, `deadLetter`, `overview`

**`APIGatewayArch`** — variants: `routing`, `rateLimiting`, `auth`, `aggregation`, `overview`

**`DistributedArch`** — variants: `consensus`, `partition`, `replication`, `leaderElection`, `overview`

#### Flow Templates (5)

**`RequestFlow`** — variants: `httpLifecycle`, `dnsResolution`, `tlsHandshake`, `restApi`, `overview`
- Horizontal flow: each stage appears left→right as a node
- Animated packet travels the full path after all nodes visible

**`AuthFlow`** — variants: `oauth`, `jwt`, `session`, `apiKey`, `overview`

**`DataPipeline`** — variants: `etl`, `streaming`, `batch`, `lambda`, `overview`

**`CIFlow`** — variants: `basic`, `blueGreen`, `canary`, `rollback`, `overview`

**`NetworkFlow`** — variants: `tcpHandshake`, `osi`, `websocket`, `http2`, `overview`

#### Comparison Templates (3)

**`VSBattle`** — variants: `default` (used for all comparisons)
- Two cards side by side
- Each row slides in per beat
- Checkmark/X per attribute
- Winner scales up with gold glow at end

**`ScaleComparison`** — variants: `horizontalVsVertical`, `autoScale`
- Single server → multiplied servers animation (horizontal)
- Single server growing bigger animation (vertical)

**`BeforeAfter`** — variants: `default`
- Left (red tint): broken/slow state
- Sliding divider reveals right (green tint): fixed/fast state
- Metrics overlay shows improvement

#### Concept Templates (3)

**`HashRing`** — variants: `basic`, `virtualNodes`, `rebalancing`
- Circular ring drawn with evolvePath()
- Nodes placed on ring via spring animation
- Keys map to nearest node with animated arc

**`TreeVisualization`** — variants: `binarySearch`, `bTree`, `trie`, `heap`
- Tree builds top-down, node by node per beat
- Highlighted traversal path for search operations

**`GraphVisualization`** — variants: `bfs`, `dfs`, `dijkstra`, `topological`
- Nodes appear with edges drawing between them
- Traversal: visited nodes change color in order

#### Generic Fallback (2)

**`ConceptDiagram`** — auto-generates from scene content
- Parses bullets for entity names → creates AnimatedBox per entity
- Parses for relationship words → creates AnimatedArrow between entities
- Parses for numbers → creates animated counter overlays
- Layout: auto-arranged in a top-down or left-right flow

**`IconGrid`** — for list-heavy scenes
- Grid of Simple Icons SVGs with labels
- Each icon appears one per beat with spring animation
- Used when scene has many technology mentions but no clear relationships

### Files
- Create: `src/lib/visual-templates.ts`
- Create: `src/components/templates/` directory with 20 template components

---

## 5. Scene Component Rebuilds

### 5A: TextSection.tsx → Visual-First Explanation

**Current:** Left panel (42%) = heading + bullet points. Right panel (58%) = ConceptViz.
**New:** Full-screen visual template. No bullet panel.

**Changes:**
- Remove left text panel entirely
- Visual template fills 100% of frame
- Scene heading shows as small chapter marker (20px, muted, top-left corner)
- The `VisualMapper` selects the best template based on `scene.heading` + topic
- Template receives `beats` computed from narration
- Each beat reveals one element in the template
- Background: stock photo at 8% opacity via `bg-images.ts`

**Key rule:** Maximum 5 words per on-screen label. Narrator provides all detail. Screen shows VISUAL ONLY.

### 5B: CodeReveal.tsx → Typewriter + Spotlight + Output Panel

**Current:** Static syntax-highlighted code block shown all at once.
**New:** Split panel with progressive reveal.

**Left panel (60%):**
- Code appears line-by-line via typewriter effect (chars appear at `1.2 chars/frame`)
- Current line: saffron left-border (4px solid), full opacity, slight scale 1.02
- Previous lines: opacity 0.3, no border
- Blinking cursor at end of current line: `opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0`
- Background: #1E1E2E (VS Code dark)
- Font: JetBrains Mono 24px (already loaded)
- Line numbers visible, muted color

**Right panel (40%):**
- Starts hidden (width 0)
- Slides in via `translateX(100%) → translateX(0)` when narrator discusses output/result
- Triggered at a specific beat (the beat containing words like "output", "returns", "result", "produces")
- Shows: input value → animated arrow → output value
- Example: `"user_123"` → `→` → `"bucket_7"` (green highlight)

**Beat mapping:**
- Each beat reveals 2-3 lines of code
- Output panel beat detected by keywords: "output", "returns", "result", "gives us"

### 5C: DiagramSlide.tsx → Progressive Architecture Diagram

**Current:** Static SVG from Mermaid renderer.
**New:** Uses visual template system for animated progressive reveal.

**Changes:**
- Instead of rendering raw SVG, select a visual template via `VisualMapper`
- If scene has a Mermaid-generated SVG, parse it into nodes + edges and feed to `ConceptDiagram` fallback
- If topic matches a specific template (e.g., "Load Balancing" → `LoadBalancerArch`), use that instead
- After all elements revealed, activate data flow particles on the primary path

### 5D: ComparisonTable.tsx → VS Battle Cards

**Current:** HTML table with headers + rows.
**New:** Two animated cards with row-by-row reveals.

**Layout:**
- "VS" text slams in center (spring animation) on beat 0
- Left card (48% width, option A name) + Right card (48% width, option B name) appear on beat 1
- Each subsequent beat reveals one comparison row:
  - Row slides in from bottom
  - Winner side: green checkmark SVG draws itself (evolvePath)
  - Loser side: red X appears with subtle shake
  - Current row highlighted, previous rows dim to 70%
- Final beat: winner card scales to 1.05 + gold border glow
- "It depends" case: both cards get saffron border + "Choose based on use case" text

**Data source:** Existing `scene.content` has markdown table. Parse `headers` (option names) and `rows` (comparison attributes) — this parsing already exists in `LongVideo.tsx` `getSceneProps`.

### 5E: InterviewInsight.tsx → Mock Interview Layout

**Current:** Text paragraph with insight content.
**New:** Chat bubble interview simulation.

**Layout:**
- **Top 25%:** Interviewer chat bubble (dark background, rounded, typewriter text animation)
  - "What would you say about {scene.heading}?"
  - Derived from scene content
- **Middle 50%:** Answer framework card
  - Sections: "Clarify → Estimate → Design → Tradeoffs" (4 labeled sections)
  - One section highlights per beat (teal left-border + light background)
  - Content fills in the active section with fade-in
- **Bottom 15%:** Red flag / green flag comparison
  - Beat N-1: "Bad answer" appears with red tint + X
  - Beat N: "Good answer" replaces it with green tint + checkmark

### 5F: ReviewQuestion.tsx → Game Show Quiz

**Current:** Question text + answer text shown together.
**New:** 4-option quiz with countdown and reveal.

**Layout + timing:**
- Beat 0: "POP QUIZ!" text slams in (spring, 1.5s)
- Beat 1: Question text appears at top (fade in)
- Beat 2: 4 option cards fly in from corners (A top-left, B top-right, C bottom-left, D bottom-right)
- Beat 3: Countdown timer (3s, SVG circle with strokeDashoffset animation)
- Beat 4: Correct answer pulses green + checkmark. Wrong answers dim + grayscale.
- Beat 5: One-line explanation fades in below

**Quiz option generation:**
New function `generateQuizOptions(question, answer, sceneContent)` in `src/lib/quiz-options.ts`:
- Takes the correct answer and generates 3 plausible wrong answers
- Uses content keywords to create distractors (e.g., if answer is "round robin", distractors might be "random selection", "least connections", "IP hash")
- Deterministic via seed (topic + sessionNumber + sceneIndex)

### 5G: SummarySlide.tsx → Checklist + Money Shot

**Current:** Bullet list of takeaways.
**New:** Two-phase summary.

**Phase 1 (first 70% of scene duration):** Animated checklist
- Each takeaway appears one per beat:
  - Small icon slides in from left (matched to concept via icon-mapper)
  - Text label fades in next to it (max 7 words)
  - Green checkmark draws itself on the right (SVG evolvePath)
  - Previous items dim to 70%
- Satisfying "ding" SFX on each checkmark

**Phase 2 (last 30%):** Complete diagram
- The visual template from the main content scenes, fully built with all elements visible
- All data flow particles active
- This is the "money shot" — the frame viewers screenshot
- CTA text fades in: "Subscribe for more" (bottom center)

### Files Modified
- Modify: `src/components/TextSection.tsx` (full rewrite to visual-first)
- Modify: `src/components/CodeReveal.tsx` (typewriter + spotlight + output panel)
- Modify: `src/components/DiagramSlide.tsx` (visual template integration)
- Modify: `src/components/ComparisonTable.tsx` (VS battle cards)
- Modify: `src/components/InterviewInsight.tsx` (mock interview layout)
- Modify: `src/components/ReviewQuestion.tsx` (game show quiz)
- Modify: `src/components/SummarySlide.tsx` (checklist + money shot)

### New Files
- Create: `src/lib/quiz-options.ts` (generate 3 wrong answers for quiz)

---

## 6. Pipeline Integration

### script-generator.ts Changes
- After scene generation, compute `VisualBeat[]` per scene from narration + word timestamps
- Store beats on the `Scene` object (new field: `visualBeats?: VisualBeat[]`)
- Call `generateQuizOptions()` for review scenes — store options on scene (new field: `quizOptions?: string[]`)
- Select visual template per scene via `getVisualTemplate()` — store on scene (new field: `templateId?: string`, `templateVariant?: string`)

### types.ts Changes
Add to `Scene` interface:
```typescript
visualBeats?: VisualBeat[];
quizOptions?: string[];
templateId?: string;
templateVariant?: string;
```

### LongVideo.tsx Changes
- Pass `beats`, `templateId`, `templateVariant`, `accentColor` to each scene component via `getSceneProps()`
- Scene components read these props and render the appropriate visual template
- Remove the old `SplitLayout` / `ConceptViz` rendering for text/interview scenes
- Keep the `noOverlays` mode for ViralShort backward compatibility

### New Dependencies
```bash
npm install @remotion/lottie @remotion/gif @remotion/animated-emoji lottie-web simple-icons
```

---

## 7. Uniqueness System

Every session of every topic produces unique video content:

| Dimension | How Uniqueness Is Achieved |
|-----------|--------------------------|
| Template selection | Matched by `scene.heading` keywords, not just topic slug |
| Template variant | Selected from content keywords within the template |
| Accent color | Rotates by `sessionNumber % 4` (saffron → teal → gold → indigo) |
| Diagram labels | Derived from scene's actual `bullets[]` and `heading` |
| Code content | Always unique per session content JSON |
| Quiz options | Generated from session-specific content, seeded by scene index |
| Analogies | Already rotate by session (restaurant → highway → hospital → airport) |
| Hooks | Rotate by 7 formulas × session seed |
| Open loops | Content-derived contradictions, unique per session |
| Data flow patterns | Variant-specific particle routing (round-robin vs hash vs weighted) |

**Generic fallback uniqueness:** `ConceptDiagram` auto-generates from bullet text, so even unmatched topics get content-specific visuals — different bullets = different boxes and arrows.

---

## File Change Summary

### New Files (30+)
| Category | Count | Files |
|----------|-------|-------|
| Foundation | 2 | `visual-beats.ts`, `useVisualBeat.ts` |
| Asset layer | 3 | `icon-mapper.ts`, `lottie-assets.ts`, `bg-images.ts` |
| Primitives | 4 | `ProgressiveReveal.tsx`, `DataFlowParticle.tsx`, `AnimatedArrow.tsx`, `AnimatedBox.tsx` |
| Templates | 20 | One component per template in `src/components/templates/` |
| Utilities | 2 | `visual-templates.ts`, `quiz-options.ts` |
| Assets | ~30 | 15-20 Lottie JSONs + 7-10 stock photos |

### Modified Files (9)
| File | Changes |
|------|---------|
| `src/components/TextSection.tsx` | Full rewrite — visual template, no bullets |
| `src/components/CodeReveal.tsx` | Typewriter + spotlight + output panel |
| `src/components/DiagramSlide.tsx` | Visual template integration |
| `src/components/ComparisonTable.tsx` | VS battle cards |
| `src/components/InterviewInsight.tsx` | Mock interview chat bubbles |
| `src/components/ReviewQuestion.tsx` | Game show quiz |
| `src/components/SummarySlide.tsx` | Checklist + money shot |
| `src/pipeline/script-generator.ts` | Compute beats, quiz options, template selection |
| `src/types.ts` | Add visualBeats, quizOptions, templateId, templateVariant fields |

### New Dependencies (4)
`@remotion/lottie`, `@remotion/gif`, `@remotion/animated-emoji`, `lottie-web`

---

## Priority Order

1. **P0:** Foundation (beats + primitives) — everything depends on this
2. **P0:** Asset layer (icons, Lottie, backgrounds) — templates need assets
3. **P1:** Visual template registry + first 5 architecture templates — biggest visual impact
4. **P1:** TextSection + DiagramSlide rebuilds — most common scene types
5. **P2:** CodeReveal rebuild — second most common
6. **P2:** Remaining 15 templates (flow, comparison, concept, generic)
7. **P3:** ComparisonTable + InterviewInsight + ReviewQuestion + SummarySlide rebuilds
8. **P3:** Pipeline integration (script-generator, types, LongVideo wiring)

---

## Implementation Batches

- **Batch A:** Foundation + Primitives + Asset layer (6 new lib files + 4 new components + asset downloads)
- **Batch B:** 20 visual templates (parallelizable — each template is independent)
- **Batch C:** 7 scene component rebuilds + pipeline wiring + LongVideo integration

---

## Success Criteria

- [ ] No bullet points visible in any text scene — only animated diagrams
- [ ] Code appears line-by-line with spotlight, never dumped all at once
- [ ] Diagrams build progressively — one element per narration sentence
- [ ] Data flow particles visible on architecture diagrams after build
- [ ] Comparisons use VS battle cards, not HTML tables
- [ ] Quiz scenes have 4 options with countdown timer and animated reveal
- [ ] Summary shows checklist with checkmark animations + complete diagram
- [ ] Every session of every topic produces visually unique video
- [ ] Something changes on screen every 3-5 seconds
- [ ] Maximum 5-7 words of text visible at any time on non-code scenes
- [ ] All assets are legally safe for monetized YouTube (no copyrighted clips)
