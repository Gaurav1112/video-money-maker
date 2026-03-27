import React from 'react';
import { AbsoluteFill } from 'remotion';
import { COLORS } from '../lib/theme';

interface ProgressBarProps {
  progress: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  const clampedProgress = Math.min(1, Math.max(0, progress));

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 8,
          backgroundColor: `${COLORS.dark}CC`,
        }}
      >
        <div
          style={{
            height: 4,
            marginTop: 2,
            width: `${clampedProgress * 100}%`,
            backgroundColor: COLORS.saffron,
            borderRadius: '0 2px 2px 0',
            transition: 'width 0.1s linear',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export default ProgressBar;
