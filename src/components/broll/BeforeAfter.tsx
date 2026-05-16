/**
 * BeforeAfter.tsx
 *
 * Animated before/after slider for visual comparisons.
 * "Old code" → "New code", "Without LB" → "With LB", "O(n²)" → "O(n log n)"
 *
 * The slider position animates from left edge to center by default.
 * Pass `autoSlide=true` to animate the wipe across the full width.
 *
 * Usage:
 *   <BeforeAfter
 *     seed={11}
 *     beforeLabel="O(n²) — TLE"
 *     afterLabel="O(n log n) — Accepted"
 *     before={<CodeTyper ... />}
 *     after={<CodeTyper ... />}
 *   />
 */
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing, AbsoluteFill } from 'remotion';
import { createNoise } from './seeded-noise';

interface BeforeAfterProps {
  seed: number;
  beforeLabel: string;
  afterLabel: string;
  before: React.ReactNode;
  after: React.ReactNode;
  /** Frames to animate the reveal slider from 0 to center. Default: 60 */
  revealFrames?: number;
  /** If true, slider continues past center to full right. Default: false */
  autoSlide?: boolean;
  /** Frame at which autoSlide starts (after initial reveal). Default: 90 */
  slideStartFrame?: number;
  beforeColor?: string;
  afterColor?: string;
}

export const BeforeAfter: React.FC<BeforeAfterProps> = ({
  seed,
  beforeLabel,
  afterLabel,
  before,
  after,
  revealFrames = 60,
  autoSlide = false,
  slideStartFrame = 90,
  beforeColor = '#EF4444',
  afterColor = '#22C55E',
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const n = createNoise(seed);

  // Clip position: 0 = all before, 1 = all after
  let clipFraction: number;

  if (autoSlide && frame > slideStartFrame) {
    // After initial reveal, continue sliding to full right
    clipFraction = interpolate(frame, [slideStartFrame, slideStartFrame + revealFrames], [0.5, 1.0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.cubic),
    });
  } else {
    // Animate from 0 to 0.5 (center) on enter
    clipFraction = interpolate(frame, [0, revealFrames], [0, 0.5], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    });
  }

  const sliderX = clipFraction * width;

  // Labels fade in
  const labelOpacity = interpolate(frame, [revealFrames * 0.3, revealFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: '#0F172A', overflow: 'hidden' }}>
      {/* "Before" layer (full width, clipped by slider from right) */}
      <AbsoluteFill
        style={{
          clipPath: `inset(0 ${100 - clipFraction * 100}% 0 0)`,
          background: '#0F172A',
        }}
      >
        {/* Before tint overlay */}
        <AbsoluteFill style={{ background: `${beforeColor}0A` }} />
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 40px 40px',
            boxSizing: 'border-box',
          }}
        >
          {before}
        </div>
        {/* Before label */}
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: 24,
            background: `${beforeColor}33`,
            color: beforeColor,
            fontFamily: '"Space Grotesk", sans-serif',
            fontWeight: 700,
            fontSize: 28,
            padding: '8px 20px',
            borderRadius: 8,
            border: `1px solid ${beforeColor}66`,
            opacity: labelOpacity,
          }}
        >
          ✗ {beforeLabel}
        </div>
      </AbsoluteFill>

      {/* "After" layer (full width, clipped from left) */}
      <AbsoluteFill
        style={{
          clipPath: `inset(0 0 0 ${clipFraction * 100}%)`,
          background: '#0F172A',
        }}
      >
        <AbsoluteFill style={{ background: `${afterColor}0A` }} />
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 40px 40px',
            boxSizing: 'border-box',
          }}
        >
          {after}
        </div>
        {/* After label */}
        <div
          style={{
            position: 'absolute',
            top: 24,
            right: 24,
            background: `${afterColor}33`,
            color: afterColor,
            fontFamily: '"Space Grotesk", sans-serif',
            fontWeight: 700,
            fontSize: 28,
            padding: '8px 20px',
            borderRadius: 8,
            border: `1px solid ${afterColor}66`,
            opacity: labelOpacity,
          }}
        >
          ✓ {afterLabel}
        </div>
      </AbsoluteFill>

      {/* Slider handle */}
      <div
        style={{
          position: 'absolute',
          left: sliderX - 2,
          top: 0,
          width: 4,
          height: '100%',
          background: '#F8FAFC',
          boxShadow: '0 0 12px rgba(248,250,252,0.8)',
          zIndex: 10,
        }}
      >
        {/* Handle knob */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
          }}
        >
          <span style={{ fontSize: 16, color: '#0F172A', fontWeight: 700 }}>◀▶</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
