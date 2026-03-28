import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate } from 'remotion';
import { COLORS } from '../lib/theme';

interface ProgressBarProps {
  progress: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  const frame = useCurrentFrame();
  const clampedProgress = Math.min(1, Math.max(0, progress));

  // Shimmer effect moving along the progress bar
  const shimmerX = interpolate(
    frame % 120,
    [0, 120],
    [-100, 200],
  );

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 5,
          backgroundColor: `${COLORS.darkAlt}`,
        }}
      >
        {/* Progress fill */}
        <div
          style={{
            height: '100%',
            width: `${clampedProgress * 100}%`,
            background: `linear-gradient(90deg, ${COLORS.saffron}, ${COLORS.gold})`,
            borderRadius: '0 2px 2px 0',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Shimmer highlight */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: `${shimmerX}%`,
              width: 60,
              height: '100%',
              background: `linear-gradient(90deg, transparent, ${COLORS.white}33, transparent)`,
            }}
          />
        </div>

        {/* Progress dot at the end */}
        {clampedProgress > 0.01 && (
          <div
            style={{
              position: 'absolute',
              top: -3,
              left: `${clampedProgress * 100}%`,
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: COLORS.gold,
              transform: 'translateX(-50%)',
              boxShadow: `0 0 8px ${COLORS.gold}66`,
            }}
          />
        )}
      </div>
    </AbsoluteFill>
  );
};

export default ProgressBar;
