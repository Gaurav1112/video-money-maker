import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate,
  spring,
} from 'remotion';
import { COLORS, FONTS, SIZES } from '../../lib/theme';

/* ─── Types ────────────────────────────────────────────────────────────────── */

export interface ComparisonRow {
  attribute: string;
  optionA: string;
  optionB: string;
  winner: 'A' | 'B' | 'tie';
  beatIndex: number;
}

export interface ComparisonConfig {
  optionAName: string;
  optionBName: string;
  optionAColor?: string;
  optionBColor?: string;
  rows: ComparisonRow[];
  title?: string;
}

interface ComparisonRendererProps {
  config: ComparisonConfig;
  startFrame?: number;
}

/* ─── Component ────────────────────────────────────────────────────────────── */

const ComparisonRenderer: React.FC<ComparisonRendererProps> = ({
  config,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const {
    optionAName = 'Approach A',
    optionBName = 'Approach B',
    optionAColor = COLORS.teal,
    optionBColor = COLORS.indigo,
    rows: rawRows,
    title,
  } = config;

  // Fallback: if no rows provided, generate placeholder rows from option names
  const rows = (rawRows && rawRows.length > 0) ? rawRows : [
    { attribute: 'Use Case', optionA: `Best for ${optionAName}`, optionB: `Best for ${optionBName}`, winner: 'tie' as const, beatIndex: 0 },
    { attribute: 'Performance', optionA: 'Varies by scale', optionB: 'Varies by pattern', winner: 'tie' as const, beatIndex: 1 },
    { attribute: 'Complexity', optionA: 'Moderate', optionB: 'Moderate', winner: 'tie' as const, beatIndex: 2 },
  ];

  const elapsed = frame - startFrame;

  /* ── Title entrance ─────────────────────────────────────────────────────── */
  const titleSpring = spring({
    frame: Math.max(0, elapsed),
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [-30, 0]);

  /* ── VS text entrance ───────────────────────────────────────────────────── */
  const vsSpring = spring({
    frame: Math.max(0, elapsed - 8),
    fps,
    config: { damping: 8, stiffness: 200, mass: 0.5 },
  });
  const vsScale = interpolate(vsSpring, [0, 1], [0, 1]);

  /* ── Card entrances ─────────────────────────────────────────────────────── */
  const cardASpring = spring({
    frame: Math.max(0, elapsed - 5),
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.9 },
  });
  const cardAX = interpolate(cardASpring, [0, 1], [-200, 0]);

  const cardBSpring = spring({
    frame: Math.max(0, elapsed - 5),
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.9 },
  });
  const cardBX = interpolate(cardBSpring, [0, 1], [200, 0]);

  /* ── Determine overall winner ───────────────────────────────────────────── */
  let aWins = 0;
  let bWins = 0;
  for (const row of (rows || [])) {
    if (row.winner === 'A') aWins++;
    if (row.winner === 'B') bWins++;
  }
  const overallWinner: 'A' | 'B' | 'tie' =
    aWins > bWins ? 'A' : bWins > aWins ? 'B' : 'tie';

  /* ── Final beat: winner card scales up with gold glow ──────────────────── */
  const lastBeat = (rows || []).length > 0 ? Math.max(...(rows || []).map((r) => r.beatIndex)) : 0;
  const finalBeatDelay = 15 + lastBeat * 12 + 20;
  const finalSpring = spring({
    frame: Math.max(0, elapsed - finalBeatDelay),
    fps,
    config: { damping: 10, stiffness: 100, mass: 0.8 },
  });
  const winnerScale = interpolate(finalSpring, [0, 1], [1, 1.04]);
  const goldGlow = interpolate(finalSpring, [0, 1], [0, 1]);

  /* ── Row rendering helper ───────────────────────────────────────────────── */
  const renderRow = (row: ComparisonRow, side: 'A' | 'B') => {
    const rowDelay = 15 + row.beatIndex * 12;
    const rowSpring = spring({
      frame: Math.max(0, elapsed - rowDelay),
      fps,
      config: { damping: 14, stiffness: 120, mass: 0.7 },
    });
    const rowOpacity = interpolate(rowSpring, [0, 0.3], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const rowSlideY = interpolate(rowSpring, [0, 1], [20, 0]);

    const value = side === 'A' ? row.optionA : row.optionB;
    const isWinner = row.winner === side;
    const isLoser = row.winner !== 'tie' && row.winner !== side;

    return (
      <div
        key={`${side}-${row.beatIndex}`}
        style={{
          opacity: rowOpacity,
          transform: `translateY(${rowSlideY}px)`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 20px',
          borderRadius: 10,
          backgroundColor: isWinner
            ? `${COLORS.teal}14`
            : isLoser
              ? `${COLORS.red}0A`
              : `${COLORS.darkAlt}`,
          marginBottom: 8,
          border: `1px solid ${isWinner ? `${COLORS.teal}44` : isLoser ? `${COLORS.red}22` : `${COLORS.indigo}22`}`,
        }}
      >
        {/* Winner/loser indicator */}
        <span
          style={{
            fontSize: 20,
            flexShrink: 0,
            width: 28,
            textAlign: 'center',
          }}
        >
          {isWinner ? '\u2705' : isLoser ? '\u274C' : '\u2796'}
        </span>

        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: SIZES.caption,
              color: `${COLORS.gray}AA`,
              fontWeight: 500,
              marginBottom: 4,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
            }}
          >
            {row.attribute}
          </div>
          <div
            style={{
              fontSize: SIZES.bodySmall,
              color: isWinner ? COLORS.teal : isLoser ? COLORS.red : COLORS.white,
              fontWeight: isWinner ? 700 : 400,
              lineHeight: 1.4,
            }}
          >
            {value}
          </div>
        </div>
      </div>
    );
  };

  /* ── Card style helper ──────────────────────────────────────────────────── */
  const cardStyle = (
    side: 'A' | 'B',
    slideX: number,
  ): React.CSSProperties => {
    const color = side === 'A' ? optionAColor : optionBColor;
    const isWinnerSide = overallWinner === side;
    const scale = isWinnerSide ? winnerScale : 1;
    const glowIntensity = isWinnerSide ? goldGlow : 0;

    return {
      flex: '0 0 46%',
      padding: '28px 24px',
      borderRadius: 16,
      background: COLORS.darkAlt,
      border: `2px solid ${color}66`,
      transform: `translateX(${slideX}px) scale(${scale})`,
      opacity: cardASpring,
      boxShadow: isWinnerSide
        ? `0 0 ${40 * glowIntensity}px ${COLORS.gold}44, 0 0 ${80 * glowIntensity}px ${COLORS.gold}22`
        : `0 4px 24px ${COLORS.dark}88`,
      position: 'relative' as const,
      overflow: 'hidden' as const,
    };
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        justifyContent: 'center',
        alignItems: 'center',
        padding: '48px 50px',
        fontFamily: FONTS.text,
      }}
    >
      {/* ── Title ─────────────────────────────────────────────────────────── */}
      {title && (
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            fontSize: SIZES.heading2,
            fontWeight: 800,
            color: COLORS.white,
            marginBottom: 36,
            textAlign: 'center',
            fontFamily: FONTS.heading,
            letterSpacing: '-0.5px',
            textShadow: `0 0 40px ${COLORS.teal}44`,
          }}
        >
          {title}
        </div>
      )}

      {/* ── Cards container ───────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          width: '100%',
          maxWidth: 1760,
          gap: 0,
        }}
      >
        {/* ── Card A ──────────────────────────────────────────────────────── */}
        <div style={cardStyle('A', cardAX)}>
          {/* Header */}
          <div
            style={{
              fontSize: SIZES.heading3,
              fontWeight: 800,
              color: optionAColor,
              marginBottom: 24,
              textAlign: 'center',
              textShadow: `0 0 20px ${optionAColor}44`,
            }}
          >
            {optionAName}
          </div>

          {/* Rows */}
          {(rows || []).map((row) => renderRow(row, 'A'))}
        </div>

        {/* ── VS Badge ────────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 80,
            flexShrink: 0,
            alignSelf: 'center',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${COLORS.saffron}, ${COLORS.gold})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 900,
              color: COLORS.dark,
              transform: `scale(${vsScale})`,
              boxShadow: `0 0 30px ${COLORS.saffron}66`,
              letterSpacing: '2px',
            }}
          >
            VS
          </div>
        </div>

        {/* ── Card B ──────────────────────────────────────────────────────── */}
        <div style={cardStyle('B', cardBX)}>
          {/* Header */}
          <div
            style={{
              fontSize: SIZES.heading3,
              fontWeight: 800,
              color: optionBColor,
              marginBottom: 24,
              textAlign: 'center',
              textShadow: `0 0 20px ${optionBColor}44`,
            }}
          >
            {optionBName}
          </div>

          {/* Rows */}
          {(rows || []).map((row) => renderRow(row, 'B'))}
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div
        style={{
          opacity: interpolate(finalSpring, [0, 1], [0, 1]),
          marginTop: 28,
          fontSize: SIZES.caption,
          color: `${COLORS.indigo}CC`,
          letterSpacing: '0.8px',
          fontWeight: 500,
          textAlign: 'center',
        }}
      >
        Deep-dive at{' '}
        <span style={{ color: COLORS.teal, fontWeight: 700 }}>
          www.guru-sishya.in
        </span>
      </div>
    </AbsoluteFill>
  );
};

export default ComparisonRenderer;
