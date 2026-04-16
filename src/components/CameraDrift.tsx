import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const CameraDrift: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.06], { extrapolateRight: 'clamp' });
  const translateX = interpolate(frame, [0, durationInFrames], [0, -12], { extrapolateRight: 'clamp' });
  const translateY = interpolate(frame, [0, durationInFrames], [0, -6], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`, overflow: 'hidden' }}>
      {children}
    </AbsoluteFill>
  );
};
