/**
 * LongVideo.patch.tsx
 *
 * Patch for src/compositions/LongVideo.tsx to integrate the new b-roll library.
 *
 * HOW TO APPLY:
 * 1. In LongVideo.tsx, add the import block below at the top of the file
 * 2. Replace the existing scene rendering logic with the BrollSequencer wrapper
 * 3. The feature flag USE_NEW_BROLL=1 (env var or inputProps.useNewBroll) gates this
 *
 * The patch is additive — it wraps existing scenes rather than replacing them,
 * so it can be reverted instantly by removing the BrollSequencer wrapper.
 *
 * DIFF SUMMARY:
 *   + import BrollSequencer
 *   + import orchestrateBroll, autoSegmentScript
 *   + if (inputProps.useNewBroll) → render BrollSequencer
 *   + else → existing code (unchanged)
 */

import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  Sequence,
  staticFile,
} from 'remotion';
import { orchestrateBroll, autoSegmentScript, validateBrollPlan } from '../lib/broll-orchestrator';
import { COMPONENT_DURATION, DEFAULT_COMPONENT_PROPS } from '../lib/broll-templates';

// B-roll component registry
import { KenBurns }        from '../components/broll/KenBurns';
import { StatBomb }        from '../components/broll/StatBomb';
import { CodeTyper }       from '../components/broll/CodeTyper';
import { TerminalStream }  from '../components/broll/TerminalStream';
import { CompareSplit }    from '../components/broll/CompareSplit';
import { ConceptBox }      from '../components/broll/ConceptBox';
import { ArrowFlow }       from '../components/broll/ArrowFlow';
import { LoadingBar }      from '../components/broll/LoadingBar';
import { EmojiSlam }       from '../components/broll/EmojiSlam';
import { MetricCard }      from '../components/broll/MetricCard';
import { BeforeAfter }     from '../components/broll/BeforeAfter';
import { WhiteboardDraw }  from '../components/broll/WhiteboardDraw';
import { LiveLog }         from '../components/broll/LiveLog';
import { CharacterCam }    from '../components/broll/CharacterCam';
import { Diagram }         from '../components/broll/Diagram';
import type { BrollComponentId } from '../lib/broll-templates';

// ---------------------------------------------------------------------------
// Component registry (maps string IDs → React components)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BROLL_REGISTRY: Record<BrollComponentId, React.FC<any>> = {
  KenBurns,
  StatBomb,
  CodeTyper,
  TerminalStream,
  CompareSplit,
  ConceptBox,
  ArrowFlow,
  LoadingBar,
  EmojiSlam,
  MetricCard,
  BeforeAfter,
  WhiteboardDraw,
  LiveLog,
  Diagram,
};

// ---------------------------------------------------------------------------
// BrollSequencer — drop-in wrapper that replaces static scene rendering
// ---------------------------------------------------------------------------

interface BrollSequencerProps {
  /** Narration text for the video (full script) */
  narration: string;
  /** Master seed for deterministic selection. Default: derived from narration hash */
  seed?: number;
  /** Avatar image path for CharacterCam PiP */
  avatarSrc?: string;
  /** If provided, overrides auto-segmentation */
  segments?: Parameters<typeof orchestrateBroll>[0];
  fps?: number;
}

export const BrollSequencer: React.FC<BrollSequencerProps> = ({
  narration,
  seed,
  avatarSrc,
  segments: providedSegments,
  fps: propFps,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const resolvedFps = propFps ?? fps;

  // Derive seed from narration if not provided
  let resolvedSeed = seed;
  if (resolvedSeed === undefined) {
    let h = 2166136261;
    for (let i = 0; i < narration.length; i++) {
      h ^= narration.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    resolvedSeed = h % 100000;
  }

  // Build segments
  const segments = providedSegments ?? autoSegmentScript(narration, {}, resolvedFps);

  // Orchestrate b-roll plan
  const plan = orchestrateBroll(segments, { fps: resolvedFps, seed: resolvedSeed });

  // In development: validate and warn
  if (process.env.NODE_ENV !== 'production') {
    const errors = validateBrollPlan(plan, resolvedFps);
    if (errors.length > 0) {
      console.warn('[BrollSequencer] Plan validation warnings:', errors);
    }
  }

  return (
    <AbsoluteFill style={{ background: '#0F172A' }}>
      {/* B-roll sequences */}
      {plan.map((item, i) => {
        const Component = BROLL_REGISTRY[item.component];
        if (!Component) return null;

        const defaultProps = DEFAULT_COMPONENT_PROPS[item.component] ?? {};
        const componentProps = {
          ...defaultProps,
          seed: item.seed,
          startFrame: 0, // each is in its own <Sequence>, so frame resets
          ...(item.props ?? {}),
        };

        return (
          <Sequence
            key={i}
            from={item.startFrame}
            durationInFrames={item.durationFrames}
            name={`broll-${item.component}-${i}`}
          >
            <AbsoluteFill>
              <Component {...componentProps} />
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* CharacterCam PiP — always visible as overlay */}
      {avatarSrc && (
        <CharacterCam
          seed={resolvedSeed}
          src={staticFile(avatarSrc)}
          position="bottom-right"
          size={240}
        />
      )}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// INTEGRATION INSTRUCTIONS (copy-paste into LongVideo.tsx)
// ---------------------------------------------------------------------------
//
// In LongVideo.tsx, find the render return and wrap like this:
//
//   // Feature flag: USE_NEW_BROLL=1 or inputProps.useNewBroll
//   const useNewBroll = process.env.USE_NEW_BROLL === '1' || inputProps.useNewBroll;
//
//   if (useNewBroll) {
//     return (
//       <BrollSequencer
//         narration={inputProps.narration ?? ''}
//         seed={inputProps.seed}
//         avatarSrc={inputProps.avatarPath}
//       />
//     );
//   }
//
//   // ... existing LongVideo render code ...
//
// ---------------------------------------------------------------------------
