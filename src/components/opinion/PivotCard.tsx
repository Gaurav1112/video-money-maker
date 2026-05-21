import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../../lib/theme';

interface PivotCardProps {
  text: string;
}

/**
 * Full-screen "The real question is…" pivot. One central card, big text,
 * accent line. Deliberately stark — Constitution V: subtract before adding.
 */
export const PivotCard: React.FC<PivotCardProps> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 180, mass: 1.1 } });
  const scale = interpolate(enter, [0, 1], [0.96, 1]);
  const op = interpolate(enter, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkAlt,
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 12%',
      }}
    >
      <div
        style={{
          opacity: op,
          transform: `scale(${scale})`,
          textAlign: 'center',
          maxWidth: 1500,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: 32,
            textTransform: 'uppercase',
            letterSpacing: 6,
            color: COLORS.saffron,
            marginBottom: 24,
            fontWeight: 700,
          }}
        >
          The real question
        </div>
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: 60,
            lineHeight: 1.3,
            fontWeight: 800,
            color: COLORS.textOnLight,
            letterSpacing: -1.5,
          }}
        >
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
};
