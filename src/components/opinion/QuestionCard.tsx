import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../../lib/theme';

interface QuestionCardProps {
  text: string;
}

/**
 * Closing question prompting engagement. Dark background for contrast against
 * the warm light theme used elsewhere — signals "now it's your turn".
 */
export const QuestionCard: React.FC<QuestionCardProps> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const op = interpolate(enter, [0, 1], [0, 1]);
  const scale = interpolate(enter, [0, 1], [0.97, 1]);

  return (
    <AbsoluteFill
      style={{
        background: 'radial-gradient(circle at 50% 40%, #0F172A 0%, #020617 80%)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 10%',
      }}
    >
      <div
        style={{
          opacity: op,
          transform: `scale(${scale})`,
          textAlign: 'center',
          maxWidth: 1600,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: 28,
            textTransform: 'uppercase',
            letterSpacing: 8,
            color: COLORS.gold,
            marginBottom: 32,
            fontWeight: 700,
          }}
        >
          Your turn
        </div>
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: 56,
            lineHeight: 1.4,
            fontWeight: 700,
            color: '#F8FAFC',
            letterSpacing: -1,
          }}
        >
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
};
