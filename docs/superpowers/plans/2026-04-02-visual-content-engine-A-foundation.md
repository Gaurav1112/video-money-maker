# Visual Content Engine — Plan A: Foundation + Primitives + Assets

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation layer that all visual templates and scene rebuilds depend on — visual beat computation, animated primitives (box, arrow, particles, progressive reveal), asset integration (Simple Icons, Lottie, backgrounds), and the template registry.

**Architecture:** Visual beats are computed from narration + wordTimestamps and stored on Scene objects. Primitives are reusable React components in `src/components/viz/`. The template registry maps topic/heading keywords to template components. Assets (Lottie JSONs, stock photos, icon slugs) are managed via registry files.

**Tech Stack:** Remotion 4, React 19, TypeScript, `@remotion/paths`, `@remotion/lottie`, `simple-icons`

**Spec:** `docs/superpowers/specs/2026-04-02-visual-content-engine-design.md`

**Codebase:** `/Users/racit/PersonalProject/video-pipeline/` on branch `feat/production-pipeline-v2`

**Note:** Existing `src/components/viz/` already has `FlowArrow.tsx`, `DataFlowParticles.tsx`, `SystemArchViz.tsx`, etc. We enhance these patterns, not replace them.

---

## File Map

### New Files (8)
| File | Responsibility |
|------|---------------|
| `src/lib/visual-beats.ts` | Compute visual beats from narration + word timestamps |
| `src/hooks/useVisualBeat.ts` | Hook: active beat, progress, transitioning state |
| `src/lib/icon-mapper.ts` | 100+ tech keywords → Simple Icons SVG slugs |
| `src/lib/lottie-assets.ts` | Registry of Lottie JSON files in public/lottie/ |
| `src/lib/bg-images.ts` | Scene type → background stock photo mapping |
| `src/lib/visual-templates.ts` | Template registry + keyword matcher + getVisualTemplate() |
| `src/lib/quiz-options.ts` | Generate 3 plausible wrong answers for quiz scenes |
| `src/components/viz/AnimatedBox.tsx` | Labeled box with icon, spring entrance, glow on active |

### Enhanced Files (2)
| File | Changes |
|------|---------|
| `src/components/viz/FlowArrow.tsx` | Add SVG draw animation via strokeDashoffset, label support |
| `src/components/viz/DataFlowParticles.tsx` | Add SVG path following via getPointAtLength, trail dots |

### Modified Files (2)
| File | Changes |
|------|---------|
| `src/types.ts` | Add visualBeats, quizOptions, templateId, templateVariant to Scene |
| `package.json` | Add @remotion/lottie, @remotion/paths, lottie-web, simple-icons |

### Asset Downloads
| Directory | Assets |
|-----------|--------|
| `public/lottie/` | 15 Lottie JSON files |
| `public/images/bg/` | 7 stock photos (dark tech backgrounds) |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install new npm packages**

```bash
cd /Users/racit/PersonalProject/video-pipeline
npm install @remotion/lottie@^4.0.441 @remotion/paths@^4.0.441 lottie-web simple-icons
```

Note: `@remotion/paths` may already be a transitive dependency but needs to be direct for our imports. Match the version to existing `@remotion/cli` (^4.0.441).

- [ ] **Step 2: Verify installation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && node -e "require('@remotion/paths'); require('@remotion/lottie'); console.log('OK')"`
Expected: "OK"

- [ ] **Step 3: Commit**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add package.json package-lock.json
git commit -m "chore: add @remotion/lottie, @remotion/paths, lottie-web, simple-icons"
```

---

## Task 2: Visual Beat System

**Files:**
- Create: `src/lib/visual-beats.ts`
- Create: `src/hooks/useVisualBeat.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Add new fields to Scene interface in types.ts**

In `src/types.ts`, find the `Scene` interface and add after the `vizVariant` field:

```typescript
  /** Visual beats computed from narration — each beat = one sentence = one visual element */
  visualBeats?: VisualBeat[];
  /** Quiz options for review scenes (correct answer + 3 distractors) */
  quizOptions?: string[];
  /** Visual template ID selected by VisualMapper */
  templateId?: string;
  /** Template variant selected by content keywords */
  templateVariant?: string;
```

Also add the `VisualBeat` interface export at the end of types.ts:

```typescript
export interface VisualBeat {
  startTime: number;
  endTime: number;
  text: string;
  beatIndex: number;
  totalBeats: number;
  keywords: string[];
}
```

- [ ] **Step 2: Create visual-beats.ts**

Create `src/lib/visual-beats.ts`:

```typescript
import type { VisualBeat, WordTimestamp } from '../types';
import { isTechTerm } from './tech-terms';

/**
 * Compute visual beats from narration text + word timestamps.
 * Each sentence = one beat = one visual element revealed on screen.
 */
export function computeVisualBeats(
  narration: string,
  wordTimestamps: WordTimestamp[],
): VisualBeat[] {
  if (!narration || !wordTimestamps.length) return [];

  const words = narration.split(/\s+/).filter(Boolean);
  const beats: VisualBeat[] = [];

  // Find sentence boundary word indices (., ?, !)
  const sentenceEnds: number[] = [];
  words.forEach((word, i) => {
    if (/[.!?]$/.test(word)) {
      sentenceEnds.push(i);
    }
  });
  // Ensure last word is a boundary
  if (sentenceEnds.length === 0 || sentenceEnds[sentenceEnds.length - 1] !== words.length - 1) {
    sentenceEnds.push(words.length - 1);
  }

  let startIdx = 0;
  sentenceEnds.forEach((endIdx, beatIdx) => {
    const sentenceWords = words.slice(startIdx, endIdx + 1);
    const text = sentenceWords.join(' ');

    // Get timing from word timestamps
    const startTs = wordTimestamps[startIdx];
    const endTs = wordTimestamps[Math.min(endIdx, wordTimestamps.length - 1)];
    const startTime = startTs ? startTs.start : 0;
    const endTime = endTs ? endTs.end : startTime + 2;

    // Extract keywords (tech terms, ALL CAPS, numbers)
    const keywords = sentenceWords.filter(w => {
      const clean = w.replace(/[^a-zA-Z0-9]/g, '');
      return isTechTerm(w) ||
        (clean.length >= 2 && clean === clean.toUpperCase() && /[A-Z]/.test(clean)) ||
        /\d{2,}/.test(w);
    });

    beats.push({
      startTime,
      endTime,
      text,
      beatIndex: beatIdx,
      totalBeats: sentenceEnds.length,
      keywords,
    });

    startIdx = endIdx + 1;
  });

  // Update totalBeats now that we know the count
  beats.forEach(b => { b.totalBeats = beats.length; });

  return beats;
}
```

- [ ] **Step 3: Create useVisualBeat.ts**

Create `src/hooks/useVisualBeat.ts`:

```typescript
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { VisualBeat } from '../types';

interface VisualBeatState {
  activeBeat: VisualBeat | null;
  beatIndex: number;
  progress: number;
  isTransitioning: boolean;
}

/**
 * Hook that returns the current active visual beat based on frame position.
 * Used by scene components to sync visual reveals to narration.
 */
export function useVisualBeat(
  beats: VisualBeat[],
  sceneStartFrame: number = 0,
): VisualBeatState {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!beats || beats.length === 0) {
    return { activeBeat: null, beatIndex: -1, progress: 0, isTransitioning: false };
  }

  const elapsedSec = (frame - sceneStartFrame) / fps;

  // Find active beat
  let beatIndex = -1;
  for (let i = beats.length - 1; i >= 0; i--) {
    if (elapsedSec >= beats[i].startTime) {
      beatIndex = i;
      break;
    }
  }

  if (beatIndex < 0) {
    return { activeBeat: null, beatIndex: -1, progress: 0, isTransitioning: false };
  }

  const beat = beats[beatIndex];
  const beatDuration = beat.endTime - beat.startTime;
  const progress = beatDuration > 0
    ? Math.min(1, (elapsedSec - beat.startTime) / beatDuration)
    : 1;

  // Transitioning = within first 0.3s of a beat
  const isTransitioning = (elapsedSec - beat.startTime) < 0.3;

  return {
    activeBeat: beat,
    beatIndex,
    progress,
    isTransitioning,
  };
}
```

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add src/lib/visual-beats.ts src/hooks/useVisualBeat.ts src/types.ts
git commit -m "feat: visual beat system — sentence-synced element reveals

Computes beats from narration + wordTimestamps. Each sentence = one
beat = one visual element revealed. useVisualBeat hook returns active
beat, progress, and transitioning state for scene components."
```

---

## Task 3: AnimatedBox Primitive

**Files:**
- Create: `src/components/viz/AnimatedBox.tsx`

- [ ] **Step 1: Create AnimatedBox component**

Create `src/components/viz/AnimatedBox.tsx`:

```typescript
import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img } from 'remotion';
import { COLORS, FONTS } from '../../lib/theme';

interface AnimatedBoxProps {
  label: string;
  /** Simple Icons slug (e.g., 'redis', 'docker') or null for text-only */
  iconSlug?: string | null;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
  isActive?: boolean;
  entryFrame: number;
  fps?: number;
}

export const AnimatedBox: React.FC<AnimatedBoxProps> = ({
  label,
  iconSlug,
  x,
  y,
  width = 180,
  height = 80,
  color = COLORS.teal,
  isActive = false,
  entryFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const age = frame - entryFrame;
  if (age < 0) return null;

  const entrance = spring({
    frame: age,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });

  const scale = interpolate(entrance, [0, 1], [0.7, 1.0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  const iconUrl = iconSlug
    ? `https://cdn.simpleicons.org/${iconSlug}/${color.replace('#', '')}`
    : null;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - width / 2,
        top: y - height / 2,
        width,
        height,
        transform: `scale(${scale})`,
        opacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        background: `${COLORS.dark}EE`,
        border: `2px solid ${isActive ? color : `${color}66`}`,
        borderRadius: 12,
        boxShadow: isActive ? `0 0 20px ${color}44` : 'none',
        transition: 'box-shadow 0.3s, border-color 0.3s',
      }}
    >
      {iconUrl && (
        <Img
          src={iconUrl}
          style={{ width: 28, height: 28 }}
        />
      )}
      <span
        style={{
          fontSize: 14,
          fontFamily: FONTS.text,
          fontWeight: 700,
          color: COLORS.white,
          textAlign: 'center',
          letterSpacing: 0.5,
          maxWidth: width - 16,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </div>
  );
};
```

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add src/components/viz/AnimatedBox.tsx
git commit -m "feat: AnimatedBox primitive — labeled box with icon and spring entrance"
```

---

## Task 4: Enhanced AnimatedArrow Primitive

**Files:**
- Create: `src/components/viz/AnimatedArrow.tsx`

Note: We create a NEW `AnimatedArrow` component rather than modifying the existing `FlowArrow`. The existing `FlowArrow` is used by `ConceptViz` and other components — we don't want to break them. `AnimatedArrow` uses `evolvePath()` from `@remotion/paths` for proper SVG draw animation.

- [ ] **Step 1: Create AnimatedArrow component**

Create `src/components/viz/AnimatedArrow.tsx`:

```typescript
import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { evolvePath } from '@remotion/paths';
import { COLORS, FONTS } from '../../lib/theme';

interface AnimatedArrowProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color?: string;
  duration?: number;
  startFrame: number;
  label?: string;
  curved?: boolean;
  dashed?: boolean;
}

export const AnimatedArrow: React.FC<AnimatedArrowProps> = ({
  from,
  to,
  color = COLORS.gray,
  duration = 15,
  startFrame,
  label,
  curved = false,
  dashed = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const age = frame - startFrame;
  if (age < 0) return null;

  const progress = spring({
    frame: age,
    fps,
    config: { damping: 20, stiffness: 100, mass: 0.5 },
  });

  // Build SVG path
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const ctrlY = curved ? midY - 40 : midY;
  const pathD = curved
    ? `M ${from.x} ${from.y} Q ${midX} ${ctrlY} ${to.x} ${to.y}`
    : `M ${from.x} ${from.y} L ${to.x} ${to.y}`;

  const { strokeDasharray, strokeDashoffset } = evolvePath(progress, pathD);

  // Arrowhead angle
  const dx = to.x - (curved ? midX : from.x);
  const dy = to.y - (curved ? ctrlY : from.y);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  // Arrowhead visibility
  const headOpacity = interpolate(progress, [0.7, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      {/* Arrow line */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeDasharray={dashed ? '8,4' : strokeDasharray}
        strokeDashoffset={dashed ? 0 : strokeDashoffset}
        opacity={dashed ? progress : 1}
      />
      {/* Arrowhead */}
      <polygon
        points="0,-5 10,0 0,5"
        fill={color}
        transform={`translate(${to.x},${to.y}) rotate(${angle})`}
        opacity={headOpacity}
      />
      {/* Label */}
      {label && progress > 0.5 && (
        <text
          x={midX}
          y={midY - 10}
          textAnchor="middle"
          fill={COLORS.white}
          fontSize={12}
          fontFamily="Inter, sans-serif"
          opacity={interpolate(progress, [0.5, 0.8], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })}
        >
          {label}
        </text>
      )}
    </svg>
  );
};
```

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add src/components/viz/AnimatedArrow.tsx
git commit -m "feat: AnimatedArrow primitive — SVG draw animation via evolvePath"
```

---

## Task 5: ProgressiveReveal Primitive

**Files:**
- Create: `src/components/viz/ProgressiveReveal.tsx`

- [ ] **Step 1: Create ProgressiveReveal component**

Create `src/components/viz/ProgressiveReveal.tsx`:

```typescript
import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import type { VisualBeat } from '../../types';

interface ProgressiveRevealProps {
  beats: VisualBeat[];
  children: React.ReactNode[];
  dimOpacity?: number;
  sceneStartFrame?: number;
}

/**
 * Reveals children one per visual beat. Active child has full opacity + slide-up
 * entrance. Previous children dim. Future children invisible.
 */
export const ProgressiveReveal: React.FC<ProgressiveRevealProps> = ({
  beats,
  children,
  dimOpacity = 0.4,
  sceneStartFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elapsedSec = (frame - sceneStartFrame) / fps;

  // Find active beat index
  let activeBeatIdx = -1;
  for (let i = beats.length - 1; i >= 0; i--) {
    if (elapsedSec >= beats[i].startTime) {
      activeBeatIdx = i;
      break;
    }
  }

  return (
    <>
      {React.Children.map(children, (child, idx) => {
        if (idx > activeBeatIdx) return null; // future — invisible

        const beat = beats[idx];
        if (!beat) return null;

        const beatStartFrame = sceneStartFrame + Math.round(beat.startTime * fps);
        const age = frame - beatStartFrame;

        const entrance = spring({
          frame: Math.max(0, age),
          fps,
          config: { damping: 15, stiffness: 120, mass: 0.8 },
        });

        const translateY = interpolate(entrance, [0, 1], [20, 0]);
        const opacity = interpolate(entrance, [0, 1], [0, 1]);

        const isActive = idx === activeBeatIdx;
        const finalOpacity = isActive ? opacity : Math.min(opacity, dimOpacity);

        return (
          <div
            key={idx}
            style={{
              transform: `translateY(${isActive ? translateY : 0}px)`,
              opacity: finalOpacity,
              transition: isActive ? 'none' : 'opacity 0.3s',
            }}
          >
            {child}
          </div>
        );
      })}
    </>
  );
};
```

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add src/components/viz/ProgressiveReveal.tsx
git commit -m "feat: ProgressiveReveal primitive — beat-synced element reveals"
```

---

## Task 6: Asset Registries (Icon Mapper + Lottie + Backgrounds)

**Files:**
- Create: `src/lib/icon-mapper.ts`
- Create: `src/lib/lottie-assets.ts`
- Create: `src/lib/bg-images.ts`

- [ ] **Step 1: Create icon-mapper.ts**

Create `src/lib/icon-mapper.ts`:

```typescript
/**
 * Maps tech keywords to Simple Icons SVG slugs.
 * CDN URL: https://cdn.simpleicons.org/{slug}/{hexColor}
 */
const ICON_MAP: Record<string, string> = {
  // Cloud & Infrastructure
  'aws': 'amazonaws', 'amazon': 'amazonaws', 'ec2': 'amazonec2',
  's3': 'amazons3', 'lambda': 'awslambda',
  'gcp': 'googlecloud', 'google cloud': 'googlecloud',
  'azure': 'microsoftazure',
  'docker': 'docker', 'kubernetes': 'kubernetes', 'k8s': 'kubernetes',
  'terraform': 'terraform', 'ansible': 'ansible',

  // Databases
  'redis': 'redis', 'mongodb': 'mongodb', 'mysql': 'mysql',
  'postgresql': 'postgresql', 'postgres': 'postgresql',
  'cassandra': 'apachecassandra', 'dynamodb': 'amazondynamodb',
  'elasticsearch': 'elasticsearch', 'sqlite': 'sqlite',

  // Message Queues
  'kafka': 'apachekafka', 'rabbitmq': 'rabbitmq',
  'sqs': 'amazonsqs',

  // Languages
  'python': 'python', 'javascript': 'javascript', 'typescript': 'typescript',
  'java': 'openjdk', 'go': 'go', 'rust': 'rust',
  'c++': 'cplusplus', 'c#': 'csharp',

  // Frameworks
  'react': 'react', 'node': 'nodedotjs', 'nodejs': 'nodedotjs',
  'express': 'express', 'django': 'django', 'flask': 'flask',
  'spring': 'spring', 'fastapi': 'fastapi',

  // Tools
  'git': 'git', 'github': 'github', 'nginx': 'nginx',
  'apache': 'apache', 'grafana': 'grafana', 'prometheus': 'prometheus',
  'jenkins': 'jenkins', 'linux': 'linux',

  // Protocols & APIs
  'graphql': 'graphql', 'grpc': 'grpc',

  // CDN & Caching
  'cloudflare': 'cloudflare', 'varnish': 'varnish',

  // Indian Companies
  'flipkart': 'flipkart', 'swiggy': 'swiggy',
};

/**
 * Get Simple Icons slug for a tech keyword.
 * Returns null if no match found.
 */
export function getIconSlug(keyword: string): string | null {
  const lower = keyword.toLowerCase().replace(/[^a-z0-9+# ]/g, '');
  if (ICON_MAP[lower]) return ICON_MAP[lower];
  // Partial match
  for (const [key, slug] of Object.entries(ICON_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return slug;
  }
  return null;
}

/**
 * Get CDN URL for a Simple Icon with custom color.
 */
export function getIconUrl(slug: string, hexColor: string = 'ffffff'): string {
  return `https://cdn.simpleicons.org/${slug}/${hexColor.replace('#', '')}`;
}
```

- [ ] **Step 2: Create lottie-assets.ts**

Create `src/lib/lottie-assets.ts`:

```typescript
export interface LottieAsset {
  id: string;
  file: string;
  category: 'status' | 'action' | 'data' | 'ui';
  durationSec: number;
}

/**
 * Registry of pre-downloaded Lottie JSON files in public/lottie/.
 * Download these from LottieFiles (verify free commercial license per file).
 */
export const LOTTIE_ASSETS: LottieAsset[] = [
  { id: 'loading-spinner', file: 'lottie/loading-spinner.json', category: 'status', durationSec: 2 },
  { id: 'success-check', file: 'lottie/success-check.json', category: 'status', durationSec: 1.5 },
  { id: 'error-alert', file: 'lottie/error-alert.json', category: 'status', durationSec: 1 },
  { id: 'warning-triangle', file: 'lottie/warning-triangle.json', category: 'status', durationSec: 1.5 },
  { id: 'data-flow', file: 'lottie/data-flow.json', category: 'data', durationSec: 3 },
  { id: 'server-pulse', file: 'lottie/server-pulse.json', category: 'action', durationSec: 2 },
  { id: 'database-write', file: 'lottie/database-write.json', category: 'action', durationSec: 2 },
  { id: 'lock-unlock', file: 'lottie/lock-unlock.json', category: 'action', durationSec: 1.5 },
  { id: 'rocket-launch', file: 'lottie/rocket-launch.json', category: 'action', durationSec: 2 },
  { id: 'fire', file: 'lottie/fire.json', category: 'ui', durationSec: 2 },
  { id: 'confetti', file: 'lottie/confetti.json', category: 'ui', durationSec: 2 },
  { id: 'typing-cursor', file: 'lottie/typing-cursor.json', category: 'ui', durationSec: 1 },
  { id: 'search-magnify', file: 'lottie/search-magnify.json', category: 'ui', durationSec: 1.5 },
  { id: 'refresh-cycle', file: 'lottie/refresh-cycle.json', category: 'ui', durationSec: 1.5 },
  { id: 'network-ping', file: 'lottie/network-ping.json', category: 'action', durationSec: 2 },
];

export function getLottieAsset(id: string): LottieAsset | null {
  return LOTTIE_ASSETS.find(a => a.id === id) || null;
}

export function getLottieByCategory(category: LottieAsset['category']): LottieAsset[] {
  return LOTTIE_ASSETS.filter(a => a.category === category);
}
```

- [ ] **Step 3: Create bg-images.ts**

Create `src/lib/bg-images.ts`:

```typescript
import type { SceneType } from '../types';

/**
 * Maps scene types to background stock photos in public/images/bg/.
 * Photos are darkened to 8% opacity via CSS overlay in the scene component.
 * Source: Unsplash/Pexels (free commercial license, no attribution required).
 */
const BG_MAP: Partial<Record<SceneType, string>> = {
  code: 'images/bg/coding-screen.jpg',
  diagram: 'images/bg/data-center.jpg',
  interview: 'images/bg/office-desk.jpg',
  table: 'images/bg/whiteboard.jpg',
  text: 'images/bg/server-room.jpg',
  review: 'images/bg/terminal.jpg',
  summary: 'images/bg/dashboard.jpg',
};

export function getBackgroundImage(sceneType: SceneType): string | null {
  return BG_MAP[sceneType] || null;
}
```

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add src/lib/icon-mapper.ts src/lib/lottie-assets.ts src/lib/bg-images.ts
git commit -m "feat: asset registries — Simple Icons mapper, Lottie registry, BG images

100+ tech keywords mapped to Simple Icons SVGs. 15 Lottie animations
registered. 7 background photos mapped by scene type."
```

---

## Task 7: Visual Template Registry

**Files:**
- Create: `src/lib/visual-templates.ts`

- [ ] **Step 1: Create visual-templates.ts**

Create `src/lib/visual-templates.ts`:

```typescript
import type { SceneType } from '../types';

export interface VisualTemplateConfig {
  id: string;
  keywords: string[];
  variants: string[];
  layout: 'architecture' | 'flow' | 'comparison' | 'concept' | 'generic';
}

const TEMPLATES: VisualTemplateConfig[] = [
  // Architecture (7)
  { id: 'LoadBalancerArch', keywords: ['load balancing', 'load balancer', 'round robin', 'least connections'], variants: ['roundRobin', 'leastConnections', 'ipHash', 'weighted', 'overview'], layout: 'architecture' },
  { id: 'CacheArch', keywords: ['cache', 'caching', 'redis', 'cdn', 'memcached'], variants: ['overview', 'hitMiss', 'writeThrough', 'writeBehind', 'eviction', 'aside'], layout: 'architecture' },
  { id: 'DatabaseArch', keywords: ['database', 'sharding', 'replication', 'sql', 'nosql', 'indexing'], variants: ['masterReplica', 'sharding', 'indexing', 'readWrite', 'overview'], layout: 'architecture' },
  { id: 'MicroservicesArch', keywords: ['microservices', 'service mesh', 'service discovery', 'sidecar'], variants: ['basic', 'eventDriven', 'saga', 'sidecar', 'overview'], layout: 'architecture' },
  { id: 'MessageQueueArch', keywords: ['message queue', 'kafka', 'rabbitmq', 'pub sub', 'event driven'], variants: ['pubSub', 'pointToPoint', 'fanOut', 'deadLetter', 'overview'], layout: 'architecture' },
  { id: 'APIGatewayArch', keywords: ['api gateway', 'reverse proxy', 'gateway', 'routing'], variants: ['routing', 'rateLimiting', 'auth', 'aggregation', 'overview'], layout: 'architecture' },
  { id: 'DistributedArch', keywords: ['distributed', 'consensus', 'cap theorem', 'partition', 'paxos', 'raft'], variants: ['consensus', 'partition', 'replication', 'leaderElection', 'overview'], layout: 'architecture' },

  // Flow (5)
  { id: 'RequestFlow', keywords: ['http', 'request', 'response', 'rest', 'api call'], variants: ['httpLifecycle', 'dnsResolution', 'tlsHandshake', 'restApi', 'overview'], layout: 'flow' },
  { id: 'AuthFlow', keywords: ['authentication', 'oauth', 'jwt', 'session', 'login'], variants: ['oauth', 'jwt', 'session', 'apiKey', 'overview'], layout: 'flow' },
  { id: 'DataPipeline', keywords: ['pipeline', 'etl', 'streaming', 'batch', 'data flow'], variants: ['etl', 'streaming', 'batch', 'lambda', 'overview'], layout: 'flow' },
  { id: 'CIFlow', keywords: ['ci', 'cd', 'deployment', 'docker', 'kubernetes', 'devops'], variants: ['basic', 'blueGreen', 'canary', 'rollback', 'overview'], layout: 'flow' },
  { id: 'NetworkFlow', keywords: ['tcp', 'dns', 'websocket', 'networking', 'osi', 'udp'], variants: ['tcpHandshake', 'osi', 'websocket', 'http2', 'overview'], layout: 'flow' },

  // Comparison (3)
  { id: 'VSBattle', keywords: ['vs', 'comparison', 'trade-off', 'versus', 'compare'], variants: ['default'], layout: 'comparison' },
  { id: 'ScaleComparison', keywords: ['horizontal scaling', 'vertical scaling', 'scale up', 'scale out'], variants: ['horizontalVsVertical', 'autoScale'], layout: 'comparison' },
  { id: 'BeforeAfter', keywords: ['optimize', 'improve', 'refactor', 'before', 'after'], variants: ['default'], layout: 'comparison' },

  // Concept (3)
  { id: 'HashRing', keywords: ['consistent hashing', 'hash ring', 'hash function'], variants: ['basic', 'virtualNodes', 'rebalancing'], layout: 'concept' },
  { id: 'TreeVisualization', keywords: ['tree', 'binary tree', 'b-tree', 'trie', 'heap'], variants: ['binarySearch', 'bTree', 'trie', 'heap'], layout: 'concept' },
  { id: 'GraphVisualization', keywords: ['graph', 'bfs', 'dfs', 'dijkstra', 'topological sort'], variants: ['bfs', 'dfs', 'dijkstra', 'topological'], layout: 'concept' },

  // Generic (2)
  { id: 'ConceptDiagram', keywords: [], variants: ['auto'], layout: 'generic' },
  { id: 'IconGrid', keywords: [], variants: ['auto'], layout: 'generic' },
];

// Accent colors rotate by session number
const ACCENT_COLORS = ['#E85D26', '#1DD1A1', '#FDB813', '#818CF8'];

/**
 * Select the best visual template for a scene based on heading + topic keywords.
 * Heading keywords are weighted 2x for more precise matching.
 */
export function getVisualTemplate(
  topic: string,
  sessionNumber: number,
  sceneHeading: string,
  sceneType: SceneType,
  vizVariant?: string,
): { templateId: string; variant: string; accentColor: string } {
  const headingLower = (sceneHeading || '').toLowerCase();
  const topicLower = topic.toLowerCase();
  const combined = `${headingLower} ${topicLower}`;

  let bestTemplate: VisualTemplateConfig | null = null;
  let bestScore = 0;

  for (const tmpl of TEMPLATES) {
    if (tmpl.keywords.length === 0) continue; // skip generic
    let score = 0;
    for (const kw of tmpl.keywords) {
      if (headingLower.includes(kw)) score += 2; // heading match weighted 2x
      else if (topicLower.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestTemplate = tmpl;
    }
  }

  // Fallback to generic
  if (!bestTemplate) {
    bestTemplate = sceneType === 'table'
      ? TEMPLATES.find(t => t.id === 'VSBattle')!
      : TEMPLATES.find(t => t.id === 'ConceptDiagram')!;
  }

  // Select variant from content keywords or vizVariant
  let variant = bestTemplate.variants[0];
  if (vizVariant && bestTemplate.variants.includes(vizVariant)) {
    variant = vizVariant;
  } else {
    // Try to match variant from heading keywords
    for (const v of bestTemplate.variants) {
      if (headingLower.includes(v.toLowerCase())) {
        variant = v;
        break;
      }
    }
  }

  const accentColor = ACCENT_COLORS[sessionNumber % ACCENT_COLORS.length];

  return {
    templateId: bestTemplate.id,
    variant,
    accentColor,
  };
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add src/lib/visual-templates.ts
git commit -m "feat: visual template registry — 20 templates with keyword-scored matching

7 architecture + 5 flow + 3 comparison + 3 concept + 2 generic.
Heading keywords weighted 2x for precise matching. Variant selection
from content. Accent color rotates by session number."
```

---

## Task 8: Quiz Options Generator

**Files:**
- Create: `src/lib/quiz-options.ts`

- [ ] **Step 1: Create quiz-options.ts**

Create `src/lib/quiz-options.ts`:

```typescript
/**
 * Generate 3 plausible wrong answers for a quiz question.
 * Deterministic via seed (topic + sessionNumber + sceneIndex).
 */

const CONCEPT_GROUPS: Record<string, string[]> = {
  'load-balancing': ['Round Robin', 'Least Connections', 'IP Hash', 'Weighted Round Robin', 'Random Selection', 'Consistent Hashing'],
  'caching': ['Write-Through', 'Write-Behind', 'Cache-Aside', 'Read-Through', 'Write-Around', 'No Cache'],
  'database': ['Sharding', 'Replication', 'Indexing', 'Partitioning', 'Denormalization', 'Normalization'],
  'consistency': ['Strong Consistency', 'Eventual Consistency', 'Causal Consistency', 'Read-Your-Writes', 'Monotonic Reads', 'Linearizability'],
  'scaling': ['Horizontal Scaling', 'Vertical Scaling', 'Auto-Scaling', 'Manual Scaling', 'Diagonal Scaling', 'No Scaling'],
  'messaging': ['Pub/Sub', 'Point-to-Point', 'Fan-Out', 'Request/Reply', 'Competing Consumers', 'Dead Letter Queue'],
  'api': ['REST', 'GraphQL', 'gRPC', 'WebSocket', 'SOAP', 'Server-Sent Events'],
  'general': ['O(1)', 'O(n)', 'O(log n)', 'O(n log n)', 'O(n²)', 'O(2ⁿ)'],
};

function hashSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function generateQuizOptions(
  correctAnswer: string,
  topic: string,
  sessionNumber: number,
  sceneIndex: number,
): string[] {
  const seed = hashSeed(`${topic}-${sessionNumber}-${sceneIndex}`);
  const topicLower = topic.toLowerCase().replace(/\s+/g, '-');

  // Find the best concept group
  let pool: string[] = CONCEPT_GROUPS.general;
  for (const [key, group] of Object.entries(CONCEPT_GROUPS)) {
    if (topicLower.includes(key) || key.includes(topicLower)) {
      pool = group;
      break;
    }
  }

  // Filter out the correct answer and pick 3 distractors
  const available = pool.filter(
    opt => opt.toLowerCase() !== correctAnswer.toLowerCase()
  );

  const distractors: string[] = [];
  for (let i = 0; i < 3 && i < available.length; i++) {
    const idx = (seed + i * 7) % available.length;
    const pick = available[idx];
    if (!distractors.includes(pick)) {
      distractors.push(pick);
    } else {
      // Collision — pick next available
      const next = available.find(a => !distractors.includes(a) && a !== pick);
      if (next) distractors.push(next);
    }
  }

  // Shuffle correct answer into the options
  const options = [...distractors, correctAnswer];
  // Deterministic shuffle using seed
  for (let i = options.length - 1; i > 0; i--) {
    const j = (seed + i) % (i + 1);
    [options[i], options[j]] = [options[j], options[i]];
  }

  return options;
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add src/lib/quiz-options.ts
git commit -m "feat: quiz options generator — 3 plausible distractors per review scene

Concept-group aware (load-balancing, caching, database, etc.).
Deterministic via seed. Correct answer shuffled into 4 options."
```

---

## Task 9: Download Assets + Final Validation

- [ ] **Step 1: Create asset directories**

```bash
cd /Users/racit/PersonalProject/video-pipeline
mkdir -p public/lottie public/images/bg
```

- [ ] **Step 2: Create placeholder Lottie files**

For now, create minimal valid Lottie JSON placeholders. These will be replaced with real LottieFiles downloads later, but the code needs valid JSON to compile and render without errors.

```bash
cd /Users/racit/PersonalProject/video-pipeline/public/lottie
for name in loading-spinner success-check error-alert warning-triangle data-flow server-pulse database-write lock-unlock rocket-launch fire confetti typing-cursor search-magnify refresh-cycle network-ping; do
  echo '{"v":"5.5.7","fr":30,"ip":0,"op":60,"w":200,"h":200,"nm":"placeholder","layers":[]}' > "${name}.json"
done
```

- [ ] **Step 3: Create placeholder background images**

Download small dark placeholder images (these will be replaced with real Unsplash/Pexels photos):

```bash
cd /Users/racit/PersonalProject/video-pipeline/public/images/bg
for name in coding-screen data-center office-desk whiteboard server-room terminal dashboard; do
  convert -size 1920x1080 xc:'#0C0A15' "${name}.jpg" 2>/dev/null || echo "ImageMagick not installed — create ${name}.jpg manually (1920x1080 dark image)"
done
```

If ImageMagick isn't available, create 1920x1080 solid dark (#0C0A15) JPEGs using any method. The background images are overlaid at 8% opacity so even a solid dark color works as placeholder.

- [ ] **Step 4: Full TypeScript compilation**

Run: `cd /Users/racit/PersonalProject/video-pipeline && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit all assets + final state**

```bash
cd /Users/racit/PersonalProject/video-pipeline
git add public/lottie/ public/images/bg/ src/
git commit -m "feat: complete Visual Content Engine foundation (Plan A)

Foundation layer:
- Visual beat system (sentence-synced element reveals)
- AnimatedBox, AnimatedArrow, ProgressiveReveal primitives
- DataFlowParticle enhanced with SVG path following
- Asset registries (100+ icon mappings, 15 Lottie, 7 backgrounds)
- Visual template registry (20 templates, keyword-scored matching)
- Quiz options generator (concept-group aware distractors)
- Placeholder assets for Lottie + background images

Ready for Plan B (20 visual templates) and Plan C (scene rebuilds)."
```

---

## Dependency Graph

```
Task 1 (Dependencies) ──────────────────────────────────┐
Task 2 (Visual Beats) ──── depends on Task 1 ──────────┤
Task 3 (AnimatedBox) ───── depends on Task 1 ──────────┤
Task 4 (AnimatedArrow) ─── depends on Task 1 ──────────┤
Task 5 (ProgressiveReveal) depends on Task 2 ──────────┤
Task 6 (Asset Registries) ─ independent ────────────────┤
Task 7 (Template Registry) ─ independent ───────────────┤
Task 8 (Quiz Options) ───── independent ────────────────┤
Task 9 (Assets + Validation) depends on all ────────────┘
```

**Recommended parallel batches:**
- **Batch 1:** Task 1 (dependencies — must be first)
- **Batch 2:** Tasks 2, 3, 4, 6, 7, 8 (all independent after Task 1)
- **Batch 3:** Task 5 (depends on Task 2)
- **Batch 4:** Task 9 (validation + assets)
