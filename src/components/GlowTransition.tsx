import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const GlowTransition: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const mid = durationInFrames / 2;
  const opacity = interpolate(frame, [0, mid * 0.7, mid, mid * 1.3, durationInFrames],
    [0, 0.6, 0.9, 0.6, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const hue = interpolate(frame, [0, durationInFrames], [20, 50]);
  return (
    <AbsoluteFill style={{
      background: `radial-gradient(ellipse at 60% 40%, hsla(${hue}, 90%, 65%, ${opacity * 0.7}) 0%, hsla(${hue + 30}, 80%, 50%, ${opacity * 0.3}) 40%, transparent 70%)`,
      mixBlendMode: 'screen',
      pointerEvents: 'none',
    }} />
  );
};
