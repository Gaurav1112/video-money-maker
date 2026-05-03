/**
 * MetricCard.tsx
 *
 * Animated metric card with countup numbers and delta indicator.
 * For "before/after" numbers, performance stats, salary comparisons.
 *
 * Usage:
 *   <MetricCard seed={4} value={50} unit="LPA" label="Avg FAANG Package" prefix="₹" />
 *   <MetricCard seed={5} value={99.9} unit="%" label="Uptime" from={95.1} />
 *   <MetricCard seed={6} value={340} unit="ms" label="p95 Latency" from={1200} direction="down" />
 */
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { createNoise } from './seeded-noise';

interface MetricCardProps {
  seed: number;
  value: number;
  unit?: string;
  label: string;
  sublabel?: string;
  prefix?: string;
  /** Starting value for countup animation. Default: 0 */
  from?: number;
  /** 'up' = green (improvement), 'down' = green (latency going down = good), 'neutral' = blue */
  direction?: 'up' | 'down' | 'neutral';
  /** Duration of countup in frames. Default: 60 */
  countupFrames?: number;
  startFrame?: number;
  /** Number of decimal places. Default: auto */
  decimals?: number;
  color?: string;
  width?: number;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  seed,
  value,
  unit = '',
  label,
  sublabel,
  prefix = '',
  from = 0,
  direction = 'neutral',
  countupFrames = 60,
  startFrame = 0,
  decimals,
  color,
  width = 320,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elapsed = Math.max(0, frame - startFrame);
  const n = createNoise(seed);

  const resolvedColor = color ?? (
    direction === 'up' ? '#22C55E' :
    direction === 'down' ? '#22C55E' :
    '#38BDF8'
  );

  // Countup with easing
  const countProgress = interpolate(elapsed, [0, countupFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });

  const currentValue = from + (value - from) * countProgress;

  const resolvedDecimals = decimals ?? (Math.abs(value) < 10 ? 1 : 0);
  const displayValue = currentValue.toFixed(resolvedDecimals);

  // Card entrance
  const cardScale = spring({
    frame: elapsed,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
    durationInFrames: 30,
  });

  const cardOpacity = interpolate(elapsed, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Delta arrow
  const delta = value - from;
  const showDelta = from !== 0 && Math.abs(delta) > 0;
  const deltaPositive = (direction === 'up' && delta > 0) || (direction === 'down' && delta < 0);
  const deltaColor = deltaPositive ? '#22C55E' : '#EF4444';
  const deltaArrow = deltaPositive ? '↑' : '↓';
  const deltaAbs = Math.abs(delta).toFixed(resolvedDecimals);

  // Subtle number glow pulse when countup completes
  const glowPulse = elapsed > countupFrames
    ? interpolate(Math.sin(frame * 0.08), [-1, 1], [0.4, 0.8])
    : 0;

  return (
    <div
      style={{
        width,
        background: `linear-gradient(135deg, ${resolvedColor}18, ${resolvedColor}08)`,
        border: `2px solid ${resolvedColor}44`,
        borderRadius: 16,
        padding: '24px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        opacity: cardOpacity,
        transform: `scale(${cardScale})`,
        boxShadow: `0 0 ${20 + glowPulse * 20}px ${resolvedColor}${Math.round(glowPulse * 40).toString(16).padStart(2, '0')}`,
      }}
    >
      {/* Value row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        {prefix && (
          <span
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: 700,
              fontSize: 36,
              color: resolvedColor,
              opacity: 0.8,
            }}
          >
            {prefix}
          </span>
        )}
        <span
          style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontWeight: 800,
            fontSize: 72,
            color: resolvedColor,
            lineHeight: 1,
            letterSpacing: '-2px',
            textShadow: `0 0 40px ${resolvedColor}88`,
          }}
        >
          {displayValue}
        </span>
        {unit && (
          <span
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: 600,
              fontSize: 36,
              color: resolvedColor,
              opacity: 0.7,
              marginLeft: 4,
            }}
          >
            {unit}
          </span>
        )}
      </div>

      {/* Delta indicator */}
      {showDelta && elapsed > countupFrames * 0.5 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            opacity: interpolate(elapsed - countupFrames * 0.5, [0, 15], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          <span style={{ color: deltaColor, fontSize: 22, fontWeight: 700 }}>
            {deltaArrow} {deltaAbs}{unit}
          </span>
          <span style={{ color: '#64748B', fontSize: 16, fontFamily: '"Space Grotesk", sans-serif' }}>
            vs before
          </span>
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: `${resolvedColor}33`, borderRadius: 1 }} />

      {/* Label */}
      <div
        style={{
          fontFamily: '"Space Grotesk", sans-serif',
          fontWeight: 600,
          fontSize: 22,
          color: '#CBD5E1',
        }}
      >
        {label}
      </div>

      {/* Sublabel */}
      {sublabel && (
        <div
          style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 16,
            color: '#475569',
          }}
        >
          {sublabel}
        </div>
      )}
    </div>
  );
};
