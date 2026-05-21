import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../../lib/theme';

interface LessonCardProps {
  text: string;
}

/**
 * The "lesson" closing thought. Same visual family as PivotCard but with a
 * 💡 marker and a warmer background to differentiate beats.
 */
export const LessonCard: React.FC<LessonCardProps> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 180 } });
  const op = interpolate(enter, [0, 1], [0, 1]);
  const ty = interpolate(enter, [0, 1], [16, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.warmBgAlt,
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 12%',
      }}
    >
      <div
        style={{
          opacity: op,
          transform: `translateY(${ty}px)`,
          textAlign: 'center',
          maxWidth: 1500,
        }}
      >
        <div style={{ fontSize: 88, marginBottom: 24 }}>💡</div>
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: 54,
            lineHeight: 1.35,
            fontWeight: 700,
            color: COLORS.textOnLight,
            letterSpacing: -1,
          }}
        >
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
};
