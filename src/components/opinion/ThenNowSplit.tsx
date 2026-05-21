import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../../lib/theme';

interface ThenNowSplitProps {
  thenLines: string[];
  nowLines: string[];
  /** Total duration of the scene in frames (for line stagger). */
  sceneDurationFrames: number;
}

/**
 * 1995 (then, left column) vs 2026 (now, right column). Lines reveal in
 * sequence over the first 60% of the scene; settle for the last 40%.
 */
export const ThenNowSplit: React.FC<ThenNowSplitProps> = ({ thenLines, nowLines, sceneDurationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const all = [...thenLines, ...nowLines];
  const revealEndFrame = sceneDurationFrames * 0.6;
  const perLine = Math.max(8, revealEndFrame / Math.max(1, all.length));

  const renderColumn = (label: string, lines: string[], startIdx: number, color: string) => (
    <div
      style={{
        flex: 1,
        padding: 64,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          fontFamily: FONTS.heading,
          fontSize: 64,
          fontWeight: 800,
          color,
          marginBottom: 48,
          letterSpacing: -1,
        }}
      >
        {label}
      </div>
      {lines.map((line, i) => {
        const idx = startIdx + i;
        const start = idx * perLine;
        const op = interpolate(frame, [start, start + 12], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
        const ty = interpolate(frame, [start, start + 12], [16, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
        return (
          <div
            key={i}
            style={{
              opacity: op,
              transform: `translateY(${ty}px)`,
              fontFamily: FONTS.text,
              fontSize: 36,
              lineHeight: 1.5,
              color: COLORS.textOnLight,
              marginBottom: 20,
            }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark, display: 'flex', flexDirection: 'row' }}>
      {renderColumn('1995', thenLines, 0, COLORS.gray)}
      <div style={{ width: 4, background: COLORS.cardBorder }} />
      {renderColumn('2026', nowLines, thenLines.length, COLORS.saffron)}
    </AbsoluteFill>
  );
};
