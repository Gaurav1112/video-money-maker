// src/components/EndCardCTA.tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { FONTS } from '../lib/theme';

interface Props {
  endQuestion: string;
  startFrame: number;
  durationFrames: number;
}

export const EndCardCTA: React.FC<Props> = ({ endQuestion, startFrame, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const age = frame - startFrame;
  if (age < 0 || age > durationFrames) return null;
  const s = spring({ frame: age, fps, config: { stiffness: 200, damping: 14, mass: 0.5 } });
  return (
    <div style={{
      position: 'absolute',
      bottom: 180, left: 60, right: 60,
      zIndex: 70,
      textAlign: 'center',
      opacity: interpolate(s, [0, 1], [0, 1]),
      transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px)`,
    }}>
      <div style={{
        display: 'inline-block',
        backgroundColor: 'rgba(255, 68, 68, 0.18)',
        border: '2px solid #FF4444',
        borderRadius: 32,
        padding: '14px 32px',
        fontSize: 32, fontFamily: FONTS.heading, fontWeight: 700,
        color: '#fff',
        boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
      }}>
        💬 {endQuestion}
      </div>
    </div>
  );
};

export default EndCardCTA;
