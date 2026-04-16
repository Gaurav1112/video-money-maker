import React from 'react';
import { AbsoluteFill } from 'remotion';

export const CinematicGrade: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ overflow: 'hidden' }}>
    <AbsoluteFill style={{
      filter: 'contrast(1.08) saturate(1.15) brightness(0.97) sepia(0.06) hue-rotate(-3deg)',
    }}>
      {children}
    </AbsoluteFill>
    <AbsoluteFill style={{
      background: 'linear-gradient(180deg, rgba(10,30,40,0.04) 0%, transparent 40%, rgba(10,30,40,0.06) 100%)',
      mixBlendMode: 'multiply',
      pointerEvents: 'none',
    }} />
  </AbsoluteFill>
);
