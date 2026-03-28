import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate, spring } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, stagger, pulseGlow } from '../lib/animations';
import { useSync } from '../hooks/useSync';
import type { AnimationCue } from '../types';

interface ComparisonTableProps {
  headers: string[];
  rows: string[][];
  title: string;
  startFrame?: number;
  endFrame?: number;
  sceneIndex?: number;
  sceneStartFrame?: number;
  animationCues?: AnimationCue[];
  /**
   * Column index (1-based, among data columns) that is the "winner" column.
   * For a 3-column table [Label, A, B], winnerCol=1 means column A wins.
   * Defaults to 1 (first data column after the label column).
   */
  winnerCol?: number;
}

const ComparisonTable: React.FC<ComparisonTableProps> = ({
  headers = [],
  rows = [],
  title = '',
  startFrame = 0,
  endFrame,
  sceneIndex,
  sceneStartFrame,
  animationCues,
  winnerCol = 1,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const sync = useSync(sceneIndex ?? 0, sceneStartFrame ?? startFrame);

  // ─── Visibility / sync logic ────────────────────────────────────────────────
  const titleOpacity = fadeIn(frame, startFrame);
  const headerOpacity = fadeIn(frame, startFrame + 10);
  const footerOpacity = fadeIn(frame, startFrame + 20);

  const hasSyncData = sync.isNarrating || sync.wordsSpoken > 0;

  const getVisibleRows = (totalRows: number): number => {
    if (hasSyncData && animationCues && animationCues.length > 0) {
      const rowCues = animationCues.filter(c => c.action === 'revealRow');
      const reached = rowCues.filter(c => sync.wordIndex >= c.wordIndex);
      return Math.max(1, reached.length);
    }
    if (hasSyncData && sync.phraseBoundaries.length > 0) {
      let visible = 1;
      for (let i = 0; i < sync.phraseBoundaries.length && i < totalRows; i++) {
        if (sync.wordIndex >= sync.phraseBoundaries[i]) visible = i + 2;
      }
      return Math.min(visible, totalRows);
    }
    // Fallback: time-based stagger (18 frames per row)
    return Math.min(totalRows, Math.floor(Math.max(0, frame - startFrame - 30) / 18) + 1);
  };

  const visibleRowCount = getVisibleRows(rows.length);
  const isNearEnd = endFrame !== undefined && frame >= endFrame - 30;

  // ─── Winner/loser column detection ──────────────────────────────────────────
  // For a table with headers [label, colA, colB, …], data columns start at index 1.
  // winnerCol=1 means the first non-label column wins (index 1 in each row array).
  // We only apply winner/loser styling when there are exactly 3 columns (label + 2 choices).
  const hasTwoChoices = headers.length === 3;
  // In the row array: index 0 = label, index 1 = first choice, index 2 = second choice
  const winnerCellIndex = hasTwoChoices ? winnerCol : -1; // 1 or 2
  const loserCellIndex = hasTwoChoices ? (winnerCol === 1 ? 2 : 1) : -1;

  // ─── Pulsing glow for highlighted (current) row near end ────────────────────
  const glowAlpha = pulseGlow(frame, 0.12, 0.5, 1.0);

  // ─── Column width ratios ─────────────────────────────────────────────────────
  // First column (label) gets slightly more space
  const colFlex = (colIndex: number) => (colIndex === 0 ? 1.4 : 1);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        justifyContent: 'center',
        alignItems: 'center',
        padding: '48px 80px',
        fontFamily: FONTS.text,
      }}
    >
      {/* ── Title ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          opacity: titleOpacity,
          fontSize: SIZES.heading2,
          fontWeight: 800,
          color: COLORS.white,
          marginBottom: 36,
          textAlign: 'center',
          fontFamily: FONTS.heading,
          letterSpacing: '-0.5px',
          textShadow: `0 0 40px ${COLORS.teal}66`,
        }}
      >
        {title}
      </div>

      {/* ── Table wrapper — full width ────────────────────────────────────── */}
      <div
        style={{
          width: '100%',
          maxWidth: 1760,
          borderRadius: 16,
          overflow: 'hidden',
          border: `1.5px solid ${COLORS.indigo}44`,
          boxShadow: `0 8px 64px ${COLORS.dark}CC, 0 0 0 1px ${COLORS.indigo}22`,
          opacity: headerOpacity,
        }}
      >
        {/* ── Gradient Header Row ─────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            background: `linear-gradient(135deg, ${COLORS.teal} 0%, #3B82F6 50%, ${COLORS.indigo} 100%)`,
            borderBottom: `2px solid ${COLORS.indigo}88`,
          }}
        >
          {headers.map((header, i) => (
            <div
              key={i}
              style={{
                flex: colFlex(i),
                padding: '20px 32px',
                fontSize: 20,
                fontWeight: 800,
                color: '#FFFFFF',
                textAlign: 'center',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                borderRight:
                  i < headers.length - 1
                    ? `1.5px solid rgba(255,255,255,0.25)`
                    : 'none',
                textShadow: '0 1px 4px rgba(0,0,0,0.4)',
              }}
            >
              {header}
            </div>
          ))}
        </div>

        {/* ── Data Rows ───────────────────────────────────────────────────── */}
        {rows.map((row, rowIndex) => {
          const isVisible = rowIndex < visibleRowCount;

          // Spring slide-in from left, staggered per row
          const rowDelay = startFrame + 30 + rowIndex * 6;
          const slideProgress = spring({
            frame: Math.max(0, frame - rowDelay),
            fps,
            config: { damping: 14, stiffness: 120, mass: 0.7 },
          });
          const slideX = interpolate(slideProgress, [0, 1], [-160, 0]);
          const rowOpacity = hasSyncData
            ? isVisible
              ? interpolate(slideProgress, [0, 0.3], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                })
              : 0
            : interpolate(slideProgress, [0, 0.3], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });

          // Glow on the last-visible row near scene end (winner row)
          const isHighlightedRow = isNearEnd && rowIndex === visibleRowCount - 1;

          const evenRow = rowIndex % 2 === 0;
          const rowBg = evenRow
            ? COLORS.darkAlt
            : `${COLORS.dark}EE`;

          return (
            <div
              key={rowIndex}
              style={{
                opacity: rowOpacity,
                transform: `translateX(${slideX}px)`,
                display: 'flex',
                backgroundColor: isHighlightedRow
                  ? `${COLORS.gold}14`
                  : rowBg,
                borderTop: `1px solid ${COLORS.indigo}22`,
                ...(isHighlightedRow
                  ? {
                      boxShadow: `0 0 24px 6px ${COLORS.gold}${Math.round(glowAlpha * 99).toString(16).padStart(2, '0')}, inset 0 0 40px ${COLORS.gold}10`,
                      borderTop: `1.5px solid ${COLORS.gold}88`,
                    }
                  : {}),
              }}
            >
              {row.map((cell, cellIndex) => {
                const isWinnerCell = hasTwoChoices && cellIndex === winnerCellIndex;
                const isLoserCell = hasTwoChoices && cellIndex === loserCellIndex;

                return (
                  <div
                    key={cellIndex}
                    style={{
                      flex: colFlex(cellIndex),
                      padding: '18px 32px',
                      fontSize: SIZES.bodySmall,
                      color: isHighlightedRow
                        ? COLORS.gold
                        : isWinnerCell
                        ? COLORS.teal
                        : isLoserCell
                        ? COLORS.gray
                        : COLORS.white,
                      opacity: isLoserCell ? 0.5 : 1,
                      textAlign: 'center',
                      fontWeight: isWinnerCell || isHighlightedRow ? 700 : 400,
                      borderRight:
                        cellIndex < row.length - 1
                          ? `1.5px solid ${COLORS.indigo}22`
                          : 'none',
                      // Label column: left-aligned, slightly bolder
                      ...(cellIndex === 0
                        ? {
                            textAlign: 'left',
                            fontWeight: 600,
                            color: COLORS.white,
                            opacity: 1,
                            fontSize: SIZES.body,
                          }
                        : {}),
                      // Winner cell gets gold checkmark via ::before (inline approach via prefix)
                      position: 'relative',
                    }}
                  >
                    {/* Winner checkmark badge */}
                    {isWinnerCell && (
                      <span
                        style={{
                          display: 'inline-block',
                          marginRight: 8,
                          color: COLORS.gold,
                          fontWeight: 900,
                          fontSize: 20,
                        }}
                      >
                        ✓
                      </span>
                    )}
                    {cell}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Footer CTA ────────────────────────────────────────────────────── */}
      <div
        style={{
          opacity: footerOpacity,
          marginTop: 28,
          fontSize: SIZES.caption,
          color: `${COLORS.indigo}CC`,
          letterSpacing: '0.8px',
          fontWeight: 500,
          textAlign: 'center',
          borderTop: `1px solid ${COLORS.indigo}33`,
          paddingTop: 16,
          width: '100%',
          maxWidth: 1760,
        }}
      >
        Practice this comparison →{' '}
        <span
          style={{
            color: COLORS.teal,
            fontWeight: 700,
            textDecoration: 'underline',
          }}
        >
          www.guru-sishya.in
        </span>
      </div>
    </AbsoluteFill>
  );
};

export default ComparisonTable;
