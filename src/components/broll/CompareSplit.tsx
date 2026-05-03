/**
 * CompareSplit.tsx
 *
 * Animated 50/50 vertical split: "Without X" vs "With X".
 * The divider wipes from center on entry and can be dragged (static in render).
 *
 * Information-density principle: each panel must SHOW the concept,
 * not just label it. Pass children for each panel.
 *
 * Usage:
 *   <CompareSplit
 *     seed={12}
 *     leftLabel="Without Load Balancer"
 *     rightLabel="With Load Balancer"
 *     left={<ArrowFlow ... />}
 *     right={<ArrowFlow ... />}
 *   />
 */
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing, AbsoluteFill } from 'remotion';
import { createNoise } from './seeded-noise';

interface CompareSplitProps {
  seed: number;
  leftLabel: string;
  rightLabel: string;
  left: React.ReactNode;
  right: React.ReactNode;
  /** Frames for the divider wipe-in animation. Default: 30 */
  inFrames?: number;
  leftColor?: string;
  rightColor?: string;
  /** If true, left panel gets a red tint (bad), right gets green (good) */
  goodBad?: boolean;
}

export const CompareSplit: React.FC<CompareSplitProps> = ({
  seed,
  leftLabel,
  rightLabel,
  left,
  right,
  inFrames = 30,
  leftColor = '#EF4444',
  rightColor = '#22C55E',
  goodBad = true,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const n = createNoise(seed);

  // Left panel slides in from left
  const leftX = interpolate(frame, [0, inFrames], [-width / 2, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Right panel slides in from right
  const rightX = interpolate(frame, [0, inFrames], [width / 2, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Labels fade + slide up
  const labelOpacity = interpolate(frame, [inFrames * 0.5, inFrames + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelY = interpolate(frame, [inFrames * 0.5, inFrames + 10], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Divider glow pulse
  const glowOpacity = interpolate(frame, [inFrames, inFrames + 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const resolvedLeft = goodBad ? '#EF444420' : '#1E293B';
  const resolvedRight = goodBad ? '#22C55E20' : '#1E293B';

  return (
    <AbsoluteFill style={{ background: '#0F172A', overflow: 'hidden' }}>
      {/* Left panel */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '50%',
          height: '100%',
          transform: `translateX(${leftX}px)`,
          background: resolvedLeft,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderRight: goodBad ? `2px solid ${leftColor}33` : 'none',
        }}
      >
        {/* Label */}
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: 0,
            right: 0,
            textAlign: 'center',
            opacity: labelOpacity,
            transform: `translateY(${labelY}px)`,
          }}
        >
          <span
            style={{
              background: goodBad ? '#EF444433' : '#1E293B',
              color: leftColor,
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: 700,
              fontSize: 28,
              padding: '6px 20px',
              borderRadius: 8,
              border: `1px solid ${leftColor}66`,
            }}
          >
            ✗ {leftLabel}
          </span>
        </div>

        {/* Content */}
        <div style={{ width: '90%', height: '70%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {left}
        </div>
      </div>

      {/* Right panel */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: '50%',
          height: '100%',
          transform: `translateX(${rightX}px)`,
          background: resolvedRight,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderLeft: goodBad ? `2px solid ${rightColor}33` : 'none',
        }}
      >
        {/* Label */}
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: 0,
            right: 0,
            textAlign: 'center',
            opacity: labelOpacity,
            transform: `translateY(${labelY}px)`,
          }}
        >
          <span
            style={{
              background: goodBad ? '#22C55E33' : '#1E293B',
              color: rightColor,
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: 700,
              fontSize: 28,
              padding: '6px 20px',
              borderRadius: 8,
              border: `1px solid ${rightColor}66`,
            }}
          >
            ✓ {rightLabel}
          </span>
        </div>

        {/* Content */}
        <div style={{ width: '90%', height: '70%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {right}
        </div>
      </div>

      {/* Center divider */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          width: 3,
          height: '100%',
          background: `linear-gradient(180deg, transparent, #F97316, transparent)`,
          opacity: glowOpacity,
          transform: 'translateX(-50%)',
          boxShadow: `0 0 20px #F97316`,
        }}
      />

      {/* VS badge at center */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#F97316',
          color: '#0F172A',
          fontFamily: '"Space Grotesk", sans-serif',
          fontWeight: 800,
          fontSize: 22,
          padding: '8px 14px',
          borderRadius: 8,
          opacity: glowOpacity,
          boxShadow: '0 4px 20px rgba(249,115,22,0.5)',
          zIndex: 10,
        }}
      >
        VS
      </div>
    </AbsoluteFill>
  );
};
