import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { COLORS, FONTS } from '../../lib/theme';

interface ProsConsListProps {
  mode: 'pros' | 'cons';
  items: string[];
  sceneDurationFrames: number;
}

/**
 * Pros (✅) or Cons (❌) column, single-mode. Items reveal in sequence.
 * One mode per scene — pros and cons get separate Sequences in OpinionLong.
 */
export const ProsConsList: React.FC<ProsConsListProps> = ({ mode, items, sceneDurationFrames }) => {
  const frame = useCurrentFrame();
  const isPros = mode === 'pros';
  const marker = isPros ? '✅' : '❌';
  const accent = isPros ? COLORS.teal : COLORS.red;
  const heading = isPros ? 'Microservices solve real problems' : 'But in many organizations…';
  const revealEnd = sceneDurationFrames * 0.7;
  const perItem = Math.max(10, revealEnd / Math.max(1, items.length));

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        padding: 80,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          fontFamily: FONTS.heading,
          fontSize: 56,
          fontWeight: 800,
          color: accent,
          marginBottom: 48,
          letterSpacing: -1,
        }}
      >
        {heading}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {items.map((item, i) => {
          const start = i * perItem;
          const op = interpolate(frame, [start, start + 14], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
          const tx = interpolate(frame, [start, start + 14], [-32, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
          return (
            <div
              key={i}
              style={{
                opacity: op,
                transform: `translateX(${tx}px)`,
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                fontFamily: FONTS.text,
                fontSize: 38,
                color: COLORS.textOnLight,
                background: COLORS.cardBg,
                border: `2px solid ${COLORS.cardBorder}`,
                borderRadius: 12,
                padding: '20px 28px',
              }}
            >
              <span style={{ fontSize: 42 }}>{marker}</span>
              <span>{item}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
