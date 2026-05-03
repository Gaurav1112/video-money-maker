/**
 * LoadingBar.tsx
 *
 * Progress bar that fills across a question series or topic countdown.
 * "Question 3 of 5 to crack FAANG" — gives viewer a progress anchor,
 * which is a proven retention driver (people stay to see the bar complete).
 *
 * Usage:
 *   <LoadingBar seed={1} current={3} total={5} label="FAANG Questions" />
 *   <LoadingBar seed={1} current={2} total={4} label="Steps to 50 LPA" fillColor="#22C55E" />
 */
import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { createNoise } from './seeded-noise';

interface LoadingBarProps {
  seed: number;
  current: number;
  total: number;
  label?: string;
  sublabel?: string;
  fillColor?: string;
  trackColor?: string;
  /** Duration for the fill animation in frames. Default: 45 */
  fillDuration?: number;
  startFrame?: number;
  /** Display a percentage number alongside */
  showPercent?: boolean;
  height?: number;
  fontSize?: number;
}

export const LoadingBar: React.FC<LoadingBarProps> = ({
  seed,
  current,
  total,
  label,
  sublabel,
  fillColor = '#F97316',
  trackColor = '#1E293B',
  fillDuration = 45,
  startFrame = 0,
  showPercent = true,
  height = 16,
  fontSize = 36,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elapsed = Math.max(0, frame - startFrame);
  const n = createNoise(seed);

  const targetPercent = current / total;

  // Animate fill from previous step to current
  const prevPercent = Math.max(0, (current - 1) / total);
  const fillProgress = interpolate(elapsed, [0, fillDuration], [prevPercent, targetPercent], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Container fade in
  const containerOpacity = interpolate(elapsed, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Glow pulse on fill end
  const fillComplete = elapsed > fillDuration;
  const glowIntensity = fillComplete
    ? interpolate(Math.sin(frame * 0.15), [-1, 1], [0.3, 0.8])
    : 0;

  const percent = Math.round(fillProgress * 100);

  // Step dots
  const stepDots = Array.from({ length: total }, (_, i) => {
    const stepPercent = (i + 1) / total;
    const dotLeft = stepPercent * 100;
    const isActive = i < current;
    const isCurrent = i === current - 1;
    return { dotLeft, isActive, isCurrent, i };
  });

  return (
    <div
      style={{
        opacity: containerOpacity,
        padding: '0 40px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Label row */}
      {(label || showPercent) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 12,
          }}
        >
          {label && (
            <span
              style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 700,
                fontSize,
                color: '#F8FAFC',
              }}
            >
              {label}
            </span>
          )}
          {showPercent && (
            <span
              style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 800,
                fontSize: fontSize * 0.9,
                color: fillColor,
              }}
            >
              {current}/{total}
            </span>
          )}
        </div>
      )}

      {/* Track */}
      <div
        style={{
          width: '100%',
          height,
          background: trackColor,
          borderRadius: height,
          position: 'relative',
          overflow: 'visible',
          border: `1px solid #334155`,
        }}
      >
        {/* Fill */}
        <div
          style={{
            height: '100%',
            width: `${fillProgress * 100}%`,
            background: `linear-gradient(90deg, ${fillColor}cc, ${fillColor})`,
            borderRadius: height,
            boxShadow: fillComplete ? `0 0 ${12 + glowIntensity * 8}px ${fillColor}` : 'none',
            transition: 'none',
          }}
        />

        {/* Step dots */}
        {stepDots.map(({ dotLeft, isActive, isCurrent, i }) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${dotLeft}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: height * 1.5,
              height: height * 1.5,
              borderRadius: '50%',
              background: isActive ? fillColor : '#334155',
              border: `2px solid ${isActive ? fillColor : '#475569'}`,
              boxShadow: isCurrent ? `0 0 12px ${fillColor}` : 'none',
              zIndex: 2,
            }}
          />
        ))}
      </div>

      {/* Sublabel */}
      {sublabel && (
        <div
          style={{
            marginTop: 10,
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: fontSize * 0.65,
            color: '#64748B',
            textAlign: 'center',
          }}
        >
          {sublabel}
        </div>
      )}
    </div>
  );
};
