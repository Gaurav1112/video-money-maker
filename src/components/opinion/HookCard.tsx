import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../../lib/theme';

interface HookCardProps {
  /** Full hook text from the `## Hook` section. */
  text: string;
  /** Optional accent color override (defaults to brand blue). */
  accent?: string;
}

/**
 * HookCard — large centered hook quote. Used as the opening of OpinionLong
 * and as the cold-open of OpinionShort. One visual element only (Constitution V).
 */
export const HookCard: React.FC<HookCardProps> = ({ text, accent = COLORS.saffron }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const translate = interpolate(enter, [0, 1], [24, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 12%',
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${translate}px)`,
          textAlign: 'center',
          fontFamily: FONTS.heading,
          color: COLORS.textOnLight,
          fontSize: 64,
          lineHeight: 1.25,
          fontWeight: 700,
          maxWidth: 1400,
        }}
      >
        <div
          style={{
            width: 96,
            height: 4,
            background: accent,
            margin: '0 auto 40px',
            borderRadius: 2,
          }}
        />
        {text}
      </div>
    </AbsoluteFill>
  );
};
