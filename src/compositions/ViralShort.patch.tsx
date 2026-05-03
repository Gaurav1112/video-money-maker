/**
 * ViralShort.patch.tsx
 *
 * Patch for src/compositions/ViralShort.tsx to integrate the new b-roll library.
 *
 * SHORTS-SPECIFIC RULES (from BROLL_BIBLE):
 * - Movement + text + voice all start at frame 0 (Karen X. Cheng principle)
 * - Visual change every 3–5 seconds
 * - StatBomb or CodeTyper as the default opener (replaces static TitleSlide)
 * - Shorter component durations (Shorts = 30–60s total, so cuts need to be faster)
 * - CharacterCam in top-left for Shorts (bottom is covered by Shorts UI chrome)
 * - Min font size 64pt (85px) for mobile readability
 *
 * HOW TO APPLY:
 * 1. Add the import block to ViralShort.tsx
 * 2. Replace the hook/scene sequence with ShortBrollSequencer
 * 3. Gate behind inputProps.useNewBroll
 */

import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  Sequence,
  interpolate,
  Easing,
} from 'remotion';
import { orchestrateBroll, autoSegmentScript } from '../lib/broll-orchestrator';
import { DEFAULT_COMPONENT_PROPS } from '../lib/broll-templates';
import type { BrollComponentId } from '../lib/broll-templates';

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
import { CharacterCam }    from '../components/broll/CharacterCam';
import { WhiteboardDraw }  from '../components/broll/WhiteboardDraw';
import { LiveLog }         from '../components/broll/LiveLog';
import { Diagram }         from '../components/broll/Diagram';
import { KenBurns }        from '../components/broll/KenBurns';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BROLL_REGISTRY: Record<BrollComponentId, React.FC<any>> = {
  KenBurns, StatBomb, CodeTyper, TerminalStream, CompareSplit,
  ConceptBox, ArrowFlow, LoadingBar, EmojiSlam, MetricCard,
  BeforeAfter, WhiteboardDraw, LiveLog, Diagram,
};

// ---------------------------------------------------------------------------
// Diya Light Sweep — GuruSishya motion signature (1.2 seconds, frame 0)
// ---------------------------------------------------------------------------

export const DiyaLightSweep: React.FC = () => {
  const frame = useCurrentFrame();

  const sweepX = interpolate(frame, [0, 36], [-200, 1280 + 200], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });

  const opacity = interpolate(frame, [0, 6, 30, 36], [0, 0.9, 0.9, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 200 }}>
      {/* Horizontal glow sweep */}
      <div
        style={{
          position: 'absolute',
          left: sweepX - 100,
          top: 0,
          width: 200,
          height: '100%',
          background: 'linear-gradient(90deg, transparent, #F9731688, #F97316, #F9731688, transparent)',
          opacity,
          filter: 'blur(8px)',
        }}
      />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Short B-Roll Sequencer
// ---------------------------------------------------------------------------

interface ShortBrollSequencerProps {
  /** Hook text shown in first 3 seconds */
  hookStat?: string;
  hookStatLabel?: string;
  /** Full narration for auto-segmentation */
  narration: string;
  seed?: number;
  avatarSrc?: string;
  /** Total duration in frames */
  durationInFrames?: number;
}

export const ShortBrollSequencer: React.FC<ShortBrollSequencerProps> = ({
  hookStat,
  hookStatLabel,
  narration,
  seed = 42,
  avatarSrc,
}) => {
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const isVertical = height > width; // Shorts = 1080×1920

  // Segments — tighter for Shorts (2–3s per cut)
  const segments = autoSegmentScript(narration, {}, fps);
  const plan = orchestrateBroll(segments, { fps, seed, repeatGapSec: 10 });

  // Shorts-specific font size override
  const shortsFontSize = isVertical ? 64 : 48;

  return (
    <AbsoluteFill style={{ background: '#0F172A' }}>
      {/* === HOOK: Frame 0–90 (StatBomb or question) === */}
      <Sequence from={0} durationInFrames={hookStat ? 90 : 0} name="hook-statbomb">
        {hookStat && (
          <StatBomb
            seed={seed}
            value={hookStat}
            label={hookStatLabel}
            color="#F97316"
            inFrames={8}
            holdFrames={68}
            outFrames={14}
          />
        )}
      </Sequence>

      {/* === Diya Light Sweep over hook === */}
      <Sequence from={0} durationInFrames={36} name="diya-sweep">
        <DiyaLightSweep />
      </Sequence>

      {/* === Main B-roll body (offset past hook) === */}
      {plan.map((item, i) => {
        const Component = BROLL_REGISTRY[item.component];
        if (!Component) return null;

        const hookOffset = hookStat ? 90 : 0;
        const startFrame = item.startFrame + hookOffset;
        const dur = Math.min(item.durationFrames, durationInFrames - startFrame);
        if (dur <= 0) return null;

        const defaultProps = DEFAULT_COMPONENT_PROPS[item.component] ?? {};
        return (
          <Sequence
            key={i}
            from={startFrame}
            durationInFrames={dur}
            name={`broll-${item.component}-${i}`}
          >
            <AbsoluteFill>
              <Component
                {...defaultProps}
                seed={item.seed}
                startFrame={0}
                fontSize={shortsFontSize}
                {...(item.props ?? {})}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* CharacterCam — top-left for Shorts (bottom is UI chrome) */}
      {avatarSrc && (
        <CharacterCam
          seed={seed}
          src={avatarSrc}
          position={isVertical ? 'top-left' : 'bottom-right'}
          size={isVertical ? 200 : 240}
          padding={isVertical ? 80 : 32}
        />
      )}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// INTEGRATION INSTRUCTIONS (copy-paste into ViralShort.tsx)
// ---------------------------------------------------------------------------
//
//   const useNewBroll = process.env.USE_NEW_BROLL === '1' || inputProps.useNewBroll;
//
//   if (useNewBroll) {
//     return (
//       <ShortBrollSequencer
//         hookStat={inputProps.hookStat}
//         hookStatLabel={inputProps.hookStatLabel}
//         narration={inputProps.narration ?? ''}
//         seed={inputProps.seed}
//         avatarSrc={inputProps.avatarPath}
//       />
//     );
//   }
//   // ... existing ViralShort code ...
//
// ---------------------------------------------------------------------------
