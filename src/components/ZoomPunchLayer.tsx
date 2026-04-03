import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate, Easing } from 'remotion';

interface ZoomPunchLayerProps {
  children: React.ReactNode;
  /** Range in seconds between zoom punches, e.g. [3, 5] */
  intervalRange: [number, number];
  /** Max scale factor, e.g. 1.15 */
  scale: number;
  fps: number;
}

const PUNCH_DURATION_FRAMES = 24; // 0.8s at 30fps

/**
 * Deterministic zoom punch overlay. Adds subtle scale pulses at regular intervals.
 * Uses interpolate (not spring) for guaranteed 24-frame timing.
 */
export const ZoomPunchLayer: React.FC<ZoomPunchLayerProps> = ({
  children,
  intervalRange,
  scale: maxScale,
  fps,
}) => {
  const frame = useCurrentFrame();

  // Deterministic interval: average of range, converted to frames
  const avgInterval = ((intervalRange[0] + intervalRange[1]) / 2) * fps;

  // Which punch cycle are we in?
  const cycleFrame = frame % Math.round(avgInterval);
  const isPunching = cycleFrame < PUNCH_DURATION_FRAMES;

  let currentScale = 1.0;
  if (isPunching) {
    // First half: scale up. Second half: scale down.
    const half = PUNCH_DURATION_FRAMES / 2;
    if (cycleFrame < half) {
      currentScale = interpolate(cycleFrame, [0, half], [1.0, maxScale], {
        easing: Easing.out(Easing.cubic),
        extrapolateRight: 'clamp',
      });
    } else {
      currentScale = interpolate(cycleFrame, [half, PUNCH_DURATION_FRAMES], [maxScale, 1.0], {
        easing: Easing.inOut(Easing.cubic),
        extrapolateRight: 'clamp',
      });
    }
  }

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${currentScale})`,
        transformOrigin: 'center center',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
