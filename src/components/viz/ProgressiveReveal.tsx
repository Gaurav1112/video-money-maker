import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import type { VisualBeat } from '../../types';

interface ProgressiveRevealProps {
  beats: VisualBeat[];
  children: React.ReactNode[];
  dimOpacity?: number;
  sceneStartFrame?: number;
}

/**
 * Reveals children one per visual beat. Active child has full opacity + slide-up
 * entrance. Previous children dim. Future children invisible.
 */
export const ProgressiveReveal: React.FC<ProgressiveRevealProps> = ({
  beats,
  children,
  dimOpacity = 0.4,
  sceneStartFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elapsedSec = (frame - sceneStartFrame) / fps;

  // Find active beat index
  let activeBeatIdx = -1;
  for (let i = beats.length - 1; i >= 0; i--) {
    if (elapsedSec >= beats[i].startTime) {
      activeBeatIdx = i;
      break;
    }
  }

  return (
    <>
      {React.Children.map(children, (child, idx) => {
        if (idx > activeBeatIdx) return null; // future — invisible

        const beat = beats[idx];
        if (!beat) return null;

        const beatStartFrame = sceneStartFrame + Math.round(beat.startTime * fps);
        const age = frame - beatStartFrame;

        const entrance = spring({
          frame: Math.max(0, age),
          fps,
          config: { damping: 15, stiffness: 120, mass: 0.8 },
        });

        const translateY = interpolate(entrance, [0, 1], [20, 0]);
        const opacity = interpolate(entrance, [0, 1], [0, 1]);

        const isActive = idx === activeBeatIdx;
        const finalOpacity = isActive ? opacity : Math.min(opacity, dimOpacity);

        return (
          <div
            key={idx}
            style={{
              transform: `translateY(${isActive ? translateY : 0}px)`,
              opacity: finalOpacity,
              transition: isActive ? 'none' : 'opacity 0.3s',
            }}
          >
            {child}
          </div>
        );
      })}
    </>
  );
};
