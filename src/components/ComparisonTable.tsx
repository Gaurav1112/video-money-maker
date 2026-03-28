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

  // ─── Sanitise rows: drop any separator rows that slipped through ──────────
  const cleanRows = rows.filter(
    row => !row.every(cell => /^[-:]+$/.test(cell) || cell.trim() === ''),
  );
  // Pad short rows so every row has the same number of cells as the header
  const colCount = headers.length;
  const paddedRows = cleanRows.map(row => {
    if (row.length >= colCount) return row;
    return [...row, ...Array(colCount - row.length).fill('—')];
  });

  // ─── Visibility / sync logic ────────────────────────────────────────────────
  const titleOpacity = fadeIn(frame, startFrame);
  const headerOpacity = fadeIn(frame, startFrame + 8);
  const footerOpacity = fadeIn(frame, startFrame + 16);

  const hasSyncData = sync.isNarrating || sync.wordsSpoken > 0;

  const getVisibleRows = (totalRows: number): number => {
    if (hasSyncData && animationCues && animationCues.length > 0) {
      const rowCues = animationCues.filter(c => c.action === 'revealRow');
      if (rowCues.length > 0) {
        const reached = rowCues.filter(c => sync.wordIndex >= c.wordIndex);
        return Math.max(1, reached.length);
      }
      // animationCues exist but no revealRow cues — fall through to time-based
    }
    if (hasSyncData && sync.phraseBoundaries.length > 0) {
      let visible = 1;
      for (let i = 0; i < sync.phraseBoundaries.length && i < totalRows; i++) {
        if (sync.wordIndex >= sync.phraseBoundaries[i]) visible = i + 2;
      }
      return Math.min(visible, totalRows);
    }
    // Time-based stagger: reveal ALL rows by 50% of scene duration (fast cadence)
    const sceneDuration = (endFrame ?? (startFrame + totalRows * 30 + 60)) - startFrame;
    const rowInterval = Math.max(3, Math.floor((sceneDuration * 0.45) / Math.max(1, totalRows)));
    return Math.min(totalRows, Math.floor(Math.max(0, frame - startFrame - 10) / rowInterval) + 1);
  };

  const visibleRowCount = getVisibleRows(paddedRows.length);
  const isNearEnd = endFrame !== undefined && frame >= endFrame - 30;

  // ─── Winner/loser column detection ──────────────────────────────────────────
  const hasTwoChoices = headers.length === 3;
  const winnerCellIndex = hasTwoChoices ? winnerCol : -1;
  const loserCellIndex = hasTwoChoices ? (winnerCol === 1 ? 2 : 1) : -1;

  // ─── Pulsing glow for highlighted (current) row near end ────────────────────
  const glowAlpha = pulseGlow(frame, 0.12, 0.5, 1.0);

  // ─── Column width ratios — adapt to column count ──────────────────────────
  const colFlex = (colIndex: number) => (colIndex === 0 ? 1.5 : 1);

  // ─── Dynamic font sizing based on column count ────────────────────────────
  const cellFontSize = colCount > 4 ? Math.max(16, 22 - (colCount - 4) * 2) : SIZES.bodySmall;
  const headerFontSize = colCount > 4 ? Math.max(16, 20 - (colCount - 4) * 1) : 20;
  const labelFontSize = colCount > 4 ? Math.max(18, SIZES.body - (colCount - 4) * 2) : SIZES.body;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        justifyContent: 'center',
        alignItems: 'center',
        padding: '48px 60px',
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
          marginBottom: 32,
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
        {/* ── Header Row — saffron text, dark bg ──────────────────────────── */}
        <div
          style={{
            display: 'flex',
            background: `linear-gradient(135deg, #1A1625 0%, #0C0A15 100%)`,
            borderBottom: `3px solid ${COLORS.saffron}`,
          }}
        >
          {headers.map((header, i) => (
            <div
              key={i}
              style={{
                flex: colFlex(i),
                padding: '18px 24px',
                fontSize: headerFontSize,
                fontWeight: 800,
                color: COLORS.saffron,
                textAlign: i === 0 ? 'left' : 'center',
                textTransform: 'uppercase',
                letterSpacing: '1.2px',
                borderRight:
                  i < headers.length - 1
                    ? `1.5px solid ${COLORS.indigo}33`
                    : 'none',
                textShadow: `0 0 12px ${COLORS.saffron}44`,
              }}
            >
              {header || '—'}
            </div>
          ))}
        </div>

        {/* ── Data Rows ───────────────────────────────────────────────────── */}
        {paddedRows.map((row, rowIndex) => {
          const isVisible = rowIndex < visibleRowCount;

          // Spring slide-in from left, staggered per row
          const rowDelay = startFrame + 15 + rowIndex * 4;
          const slideProgress = spring({
            frame: Math.max(0, frame - rowDelay),
            fps,
            config: { damping: 14, stiffness: 120, mass: 0.7 },
          });
          const slideX = interpolate(slideProgress, [0, 1], [-120, 0]);

          // Always compute opacity from spring progress; when sync is active,
          // gate it on whether the row is logically visible yet.
          const springOpacity = interpolate(slideProgress, [0, 0.3], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const rowOpacity = hasSyncData ? (isVisible ? springOpacity : 0) : springOpacity;

          // Glow on the last-visible row near scene end (winner row)
          const isHighlightedRow = isNearEnd && rowIndex === visibleRowCount - 1;

          const evenRow = rowIndex % 2 === 0;
          const rowBg = evenRow ? COLORS.darkAlt : `${COLORS.dark}EE`;

          return (
            <div
              key={rowIndex}
              style={{
                opacity: rowOpacity,
                transform: `translateX(${slideX}px)`,
                display: 'flex',
                backgroundColor: isHighlightedRow ? `${COLORS.gold}14` : rowBg,
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
                const isLabelCol = cellIndex === 0;
                const cellText = (cell && cell.trim()) || '—';

                return (
                  <div
                    key={cellIndex}
                    style={{
                      flex: colFlex(cellIndex),
                      padding: '16px 24px',
                      fontSize: isLabelCol ? labelFontSize : cellFontSize,
                      color: isHighlightedRow
                        ? COLORS.gold
                        : isLabelCol
                          ? COLORS.white
                          : isWinnerCell
                            ? COLORS.teal
                            : isLoserCell
                              ? '#C4C7CC'
                              : COLORS.white,
                      opacity: 1,
                      textAlign: isLabelCol ? 'left' : 'center',
                      fontWeight: isLabelCol || isWinnerCell || isHighlightedRow ? 700 : 400,
                      borderRight:
                        cellIndex < row.length - 1
                          ? `1.5px solid ${COLORS.indigo}22`
                          : 'none',
                      lineHeight: 1.4,
                      position: 'relative',
                    }}
                  >
                    {/* Winner checkmark badge */}
                    {isWinnerCell && (
                      <span
                        style={{
                          display: 'inline-block',
                          marginRight: 6,
                          color: COLORS.gold,
                          fontWeight: 900,
                          fontSize: cellFontSize,
                        }}
                      >
                        ✓
                      </span>
                    )}
                    {cellText}
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
          marginTop: 24,
          fontSize: SIZES.caption,
          color: `${COLORS.indigo}CC`,
          letterSpacing: '0.8px',
          fontWeight: 500,
          textAlign: 'center',
          borderTop: `1px solid ${COLORS.indigo}33`,
          paddingTop: 14,
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
