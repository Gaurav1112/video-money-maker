/**
 * ConceptBox.tsx
 *
 * A labeled box that animates IN, can transform (split into multiple boxes,
 * merge, replicate), and animates OUT. Core Kurzgesagt-style building block.
 *
 * "Kafka partitions" → pass split={3} and watch one box become 3.
 * "Service mesh" → pass replicate={5} for horizontal scaling visual.
 *
 * Usage:
 *   <ConceptBox seed={8} label="API Server" icon="🖥" />
 *   <ConceptBox seed={8} label="Partition" icon="📦" split={3} splitLabel="P0 P1 P2" />
 */
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { createNoise } from './seeded-noise';

interface ConceptBoxProps {
  seed: number;
  label: string;
  icon?: string;
  sublabel?: string;
  /** Split this box into N boxes after splitDelay frames */
  split?: number;
  splitLabels?: string[];
  /** Replicate this box N times (horizontal) */
  replicate?: number;
  splitDelay?: number;
  color?: string;
  width?: number;
  height?: number;
  startFrame?: number;
  /** If true, box shakes on arrival (error/warning) */
  shake?: boolean;
}

export const ConceptBox: React.FC<ConceptBoxProps> = ({
  seed,
  label,
  icon,
  sublabel,
  split,
  splitLabels,
  replicate,
  splitDelay = 45,
  color = '#38BDF8',
  width = 200,
  height = 120,
  startFrame = 0,
  shake = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = createNoise(seed);
  const elapsed = Math.max(0, frame - startFrame);

  // Scale spring in
  const scaleSpring = spring({
    frame: elapsed,
    fps,
    config: { damping: 12, stiffness: 150, mass: 0.7 },
    durationInFrames: 30,
  });

  // Opacity fade in
  const opacity = interpolate(elapsed, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Shake (for error/warning boxes)
  const shakeX = shake && elapsed < 20
    ? n.smoothAt(elapsed * 5.3, -6, 6) * Math.max(0, 1 - elapsed / 20)
    : 0;

  // Split animation
  const splitProgress = split
    ? interpolate(elapsed - splitDelay, [0, 30], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      })
    : 0;

  const showSplit = split && elapsed > splitDelay;
  const splitCount = split ?? 1;

  const borderStyle = `2px solid ${color}`;
  const glowStyle = `0 0 20px ${color}44, inset 0 0 20px ${color}11`;

  if (showSplit && splitProgress > 0.05) {
    const gap = 16;
    const totalWidth = splitCount * width + (splitCount - 1) * gap;
    return (
      <div
        style={{
          display: 'flex',
          gap,
          opacity,
          transform: `scale(${scaleSpring}) translateX(${shakeX}px)`,
        }}
      >
        {Array.from({ length: splitCount }).map((_, i) => {
          const slideX = interpolate(splitProgress, [0, 1], [0, (i - (splitCount - 1) / 2) * (width + gap)]);
          const subLabel = splitLabels?.[i] ?? `${label} ${i}`;
          return (
            <div
              key={i}
              style={{
                width,
                height,
                background: `linear-gradient(135deg, ${color}22, ${color}11)`,
                border: borderStyle,
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `translateX(${slideX}px)`,
                boxShadow: glowStyle,
              }}
            >
              {icon && <span style={{ fontSize: 28 }}>{icon}</span>}
              <span
                style={{
                  color,
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontWeight: 700,
                  fontSize: 18,
                  marginTop: 4,
                  textAlign: 'center',
                }}
              >
                {subLabel}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // Replicate mode (shows N copies side by side from start)
  if (replicate && replicate > 1) {
    const gap = 12;
    return (
      <div style={{ display: 'flex', gap, opacity, transform: `scale(${scaleSpring})` }}>
        {Array.from({ length: replicate }).map((_, i) => {
          const delayFactor = interpolate(
            elapsed - i * 8,
            [0, 20],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );
          return (
            <div
              key={i}
              style={{
                width: width * 0.75,
                height: height * 0.75,
                background: `linear-gradient(135deg, ${color}22, ${color}11)`,
                border: borderStyle,
                borderRadius: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: delayFactor,
                boxShadow: glowStyle,
              }}
            >
              {icon && <span style={{ fontSize: 20 }}>{icon}</span>}
              <span
                style={{
                  color,
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontWeight: 700,
                  fontSize: 14,
                  textAlign: 'center',
                  padding: '0 8px',
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // Single box
  return (
    <div
      style={{
        width,
        height,
        background: `linear-gradient(135deg, ${color}22, ${color}11)`,
        border: borderStyle,
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        transform: `scale(${scaleSpring}) translateX(${shakeX}px)`,
        boxShadow: glowStyle,
      }}
    >
      {icon && <span style={{ fontSize: 32 }}>{icon}</span>}
      <span
        style={{
          color,
          fontFamily: '"Space Grotesk", sans-serif',
          fontWeight: 700,
          fontSize: 22,
          marginTop: icon ? 6 : 0,
          textAlign: 'center',
          padding: '0 12px',
        }}
      >
        {label}
      </span>
      {sublabel && (
        <span
          style={{
            color: '#64748B',
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 14,
            marginTop: 4,
            textAlign: 'center',
          }}
        >
          {sublabel}
        </span>
      )}
    </div>
  );
};
