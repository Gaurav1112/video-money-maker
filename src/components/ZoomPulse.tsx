import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';

interface ZoomPulseProps {
  /** Scene index used as phase seed so each scene pulses at a different offset */
  sceneIndex?: number;
  /** Cycle duration in seconds (default 4) */
  cycleDuration?: number;
  /** Max zoom scale (default 1.02) */
  maxScale?: number;
  children: React.ReactNode;
}

/**
 * ZoomPulse wraps its children in a subtle 1.0x -> 1.02x -> 1.0x zoom oscillation.
 * Each scene gets a different phase offset based on sceneIndex so they don't all
 * pulse in lockstep. Uses Remotion's interpolate() for frame-accurate animation.
 */
export const ZoomPulse: React.FC<ZoomPulseProps> = ({
  sceneIndex = 0,
  cycleDuration = 4,
  maxScale = 1.02,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cycleFrames = cycleDuration * fps;
  // Phase offset per scene (golden angle in radians for good distribution)
  const phaseOffset = sceneIndex * 2.399;

  // Progress through the current cycle: 0 -> 1 -> 0 (ping-pong)
  const rawProgress = ((frame + phaseOffset * fps) % cycleFrames) / cycleFrames;
  // Convert to 0->1->0 triangle wave
  const triangleWave = rawProgress <= 0.5
    ? rawProgress * 2
    : 2 - rawProgress * 2;

  // Apply easeInOut for smooth motion
  const eased = Easing.inOut(Easing.ease)(triangleWave);

  const scale = interpolate(eased, [0, 1], [1.0, maxScale]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        willChange: 'transform',
      }}
    >
      {children}
    </div>
  );
};
