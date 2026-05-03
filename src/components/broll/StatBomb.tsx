/**
 * StatBomb.tsx
 *
 * Full-frame dramatic number/stat reveal. Slams in, holds, then fades.
 * "₹50 LPA", "10M RPS", "340ms p95", "0–2 views" — the kind of number
 * that makes a viewer lean forward.
 *
 * Inspired by MrBeast's "show the payoff in 3 seconds" principle.
 *
 * Usage:
 *   <StatBomb seed={7} value="₹50 LPA" label="avg FAANG package India" />
 *   <StatBomb seed={7} value="340ms" label="p95 latency before fix" color="#EF4444" />
 */
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing, AbsoluteFill } from 'remotion';
import { createNoise } from './seeded-noise';

const COLORS = {
  bg: '#0F172A',
  text: '#F8FAFC',
  orange: '#F97316',
  red: '#EF4444',
  green: '#22C55E',
  sky: '#38BDF8',
};

interface StatBombProps {
  seed: number;
  value: string;
  label?: string;
  /** Accent color for the value. Defaults to orange. */
  color?: string;
  /** Background color. Defaults to deep slate. */
  background?: string;
  /** Frames for slam-in animation. Default: 12 */
  inFrames?: number;
  /** Frames to hold the stat. Default: 60 */
  holdFrames?: number;
  /** Frames for fade-out. Default: 18 */
  outFrames?: number;
  /** onAudioCue: frame index at which a "whoosh" SFX should fire */
  onAudioCue?: (frame: number) => void;
}

export const StatBomb: React.FC<StatBombProps> = ({
  seed,
  value,
  label,
  color = COLORS.orange,
  background = COLORS.bg,
  inFrames = 12,
  holdFrames = 60,
  outFrames = 18,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = createNoise(seed);

  const totalIn = inFrames;
  const totalHold = inFrames + holdFrames;
  const totalOut = totalHold + outFrames;

  // Slam-in: overshoot scale via spring
  const scaleSpring = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 300, mass: 0.6 },
    durationInFrames: inFrames * 2,
  });
  const scale = interpolate(scaleSpring, [0, 1], [0.3, 1]);

  // Shake on slam — uses seeded noise for deterministic shake
  const shakeX = frame < inFrames + 6
    ? n.smoothAt(frame * 3.7, -8, 8) * Math.max(0, 1 - frame / (inFrames + 6))
    : 0;
  const shakeY = frame < inFrames + 6
    ? n.smoothAt(frame * 2.3 + 100, -5, 5) * Math.max(0, 1 - frame / (inFrames + 6))
    : 0;

  // Fade out
  const opacity = frame < totalHold
    ? 1
    : interpolate(frame, [totalHold, totalOut], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.quad),
      });

  // Label slides up from below
  const labelY = interpolate(frame, [inFrames, inFrames + 20], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const labelOpacity = interpolate(frame, [inFrames, inFrames + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Seeded background particle count (subtle depth)
  const numParticles = Math.floor(n.smoothAt(10, 6, 14));

  return (
    <AbsoluteFill
      style={{
        background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        overflow: 'hidden',
      }}
    >
      {/* Subtle radial glow behind number */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`,
          transform: `translate(${shakeX}px, ${shakeY}px)`,
        }}
      />

      {/* Main stat value */}
      <div
        style={{
          fontSize: 120,
          fontFamily: '"Space Grotesk", sans-serif',
          fontWeight: 800,
          color,
          letterSpacing: '-4px',
          lineHeight: 1,
          transform: `scale(${scale}) translate(${shakeX}px, ${shakeY}px)`,
          transformOrigin: 'center center',
          textShadow: `0 0 60px ${color}66`,
        }}
      >
        {value}
      </div>

      {/* Label below */}
      {label && (
        <div
          style={{
            fontSize: 36,
            fontFamily: '"Space Grotesk", sans-serif',
            fontWeight: 600,
            color: COLORS.text,
            opacity: labelOpacity,
            transform: `translateY(${labelY}px)`,
            marginTop: 16,
            textAlign: 'center',
            maxWidth: 800,
            letterSpacing: '0.02em',
          }}
        >
          {label}
        </div>
      )}

      {/* Decorative line sweep under label */}
      <div
        style={{
          height: 3,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          width: interpolate(frame, [inFrames, inFrames + 30], [0, 400], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          marginTop: 12,
          borderRadius: 2,
          opacity: labelOpacity,
        }}
      />
    </AbsoluteFill>
  );
};
