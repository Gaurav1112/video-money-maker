import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';

export const AnimatedOverlay: React.FC<{ sceneType?: string }> = () => {
  const frame = useCurrentFrame();
  const intensity = interpolate(frame % 90, [0, 45, 90], [0.3, 0.4, 0.3]);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse 70% 60% at 50% 50%, transparent 50%, rgba(12,10,21,${intensity}) 100%)`,
      }} />
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '8%',
        background: 'linear-gradient(180deg, rgba(12,10,21,0.12) 0%, transparent 100%)',
      }} />
    </AbsoluteFill>
  );
};
