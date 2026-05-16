import React from 'react';
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate, spring } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, pulseGlow } from '../lib/animations';
import { useSync } from '../hooks/useSync';
import type { AnimationCue, VisualBeat } from '../types';
import ComparisonRenderer from './templates/ComparisonRenderer';
import type { ComparisonConfig, ComparisonRow } from './templates/ComparisonRenderer';

/* ─── Winner auto-detection ────────────────────────────────────────────────── */

const WINNER_KEYWORDS = /\b(faster|better|yes|lower|higher throughput|more scalable|built-in|native|optimal|efficient|unlimited|redundancy|strong)\b/i;
const LOSER_KEYWORDS = /\b(slower|worse|no|higher latency|single point|limited|manual|complex|exponential|ceiling)\b/i;

function autoDetectWinner(optionA: string, optionB: string): 'A' | 'B' | 'tie' {
  const aWinScore = (optionA.match(WINNER_KEYWORDS) || []).length;
  const aLoseScore = (optionA.match(LOSER_KEYWORDS) || []).length;
  const bWinScore = (optionB.match(WINNER_KEYWORDS) || []).length;
  const bLoseScore = (optionB.match(LOSER_KEYWORDS) || []).length;

  const aNet = aWinScore - aLoseScore;
  const bNet = bWinScore - bLoseScore;

  if (aNet > bNet) return 'A';
  if (bNet > aNet) return 'B';
  return 'tie';
}

/* ─── Convert headers/rows into ComparisonConfig ───────────────────────────── */

function buildConfigFromTable(
  headers: string[],
  rows: string[][],
  title: string,
  winnerCol: number,
): ComparisonConfig {
  // For a 3-column table: [Attribute, OptionA, OptionB]
  const optionAName = headers.length >= 2 ? headers[1] : 'Option A';
  const optionBName = headers.length >= 3 ? headers[2] : 'Option B';

  const comparisonRows: ComparisonRow[] = rows
    .filter(row => !row.every(cell => /^[-:]+$/.test(cell) || cell.trim() === ''))
    .map((row, index) => {
      const attribute = row[0] || '';
      const optionA = row[1] || '—';
      const optionB = row[2] || '—';

      let winner: 'A' | 'B' | 'tie';
      if (headers.length === 3) {
        // Explicit winnerCol or auto-detect
        if (winnerCol > 0) {
          winner = winnerCol === 1 ? 'A' : 'B';
        } else {
          winner = autoDetectWinner(optionA, optionB);
        }
      } else {
        winner = 'tie';
      }

      return { attribute, optionA, optionB, winner, beatIndex: index };
    });

  return {
    optionAName,
    optionBName,
    optionAColor: COLORS.teal,
    optionBColor: COLORS.saffron,
    rows: comparisonRows,
    title,
  };
}

/* ─── Props ────────────────────────────────────────────────────────────────── */

interface ComparisonTableProps {
  headers: string[];
  rows: string[][];
  title: string;
  startFrame?: number;
  endFrame?: number;
  sceneIndex?: number;
  sceneStartFrame?: number;
  animationCues?: AnimationCue[];
  winnerCol?: number;
  /** When present, delegates to the VS Battle ComparisonRenderer */
  visualBeats?: VisualBeat[];
}

/* ─── Component ────────────────────────────────────────────────────────────── */

const ComparisonTable: React.FC<ComparisonTableProps> = ({
  headers = [],
  rows = [],
  title = '',
  startFrame = 0,
  endFrame,
  sceneIndex,
  sceneStartFrame,
  animationCues,
  winnerCol = 0,
  visualBeats,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sync = useSync(sceneIndex ?? 0, sceneStartFrame ?? startFrame);

  /* ── Path 1: VS Battle cards via ComparisonRenderer ──────────────────────── */
  if (visualBeats && headers.length >= 3) {
    const config = buildConfigFromTable(headers, rows, title, winnerCol);
    return <ComparisonRenderer config={config} startFrame={startFrame} />;
  }

  /* ── Path 2: Progressive table with VS flair (backward compat) ───────────── */

  // Sanitise rows
  const cleanRows = rows.filter(
    row => !row.every(cell => /^[-:]+$/.test(cell) || cell.trim() === ''),
  );
  const colCount = headers.length;
  const paddedRows = cleanRows.map(row => {
    if (row.length >= colCount) return row;
    return [...row, ...Array(colCount - row.length).fill('—')];
  });

  const hasTwoChoices = headers.length === 3;
  const elapsed = frame - startFrame;

  /* ── VS badge spring animation ───────────────────────────────────────────── */
  const vsSpring = spring({
    frame: Math.max(0, elapsed - 5),
    fps,
    config: { damping: 8, stiffness: 200, mass: 0.5 },
  });
  const vsScale = interpolate(vsSpring, [0, 1], [0, 1]);

  /* ── Title animation ─────────────────────────────────────────────────────── */
  const titleSpring = spring({
    frame: Math.max(0, elapsed),
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [-30, 0]);

  /* ── Header animation ────────────────────────────────────────────────────── */
  const headerOpacity = fadeIn(frame, startFrame + 8);

  /* ── Sync-aware row visibility ───────────────────────────────────────────── */
  const hasSyncData = sync.isNarrating || sync.wordsSpoken > 0;

  const getVisibleRows = (totalRows: number): number => {
    if (hasSyncData && animationCues && animationCues.length > 0) {
      const rowCues = animationCues.filter(c => c.action === 'revealRow');
      if (rowCues.length > 0) {
        const reached = rowCues.filter(c => sync.wordIndex >= c.wordIndex);
        return Math.max(1, reached.length);
      }
    }
    if (hasSyncData && sync.phraseBoundaries.length > 0) {
      let visible = 1;
      for (let i = 0; i < sync.phraseBoundaries.length && i < totalRows; i++) {
        if (sync.wordIndex >= sync.phraseBoundaries[i]) visible = i + 2;
      }
      return Math.min(visible, totalRows);
    }
    // Time-based stagger
    const sceneDuration = (endFrame ?? (startFrame + totalRows * 30 + 60)) - startFrame;
    const rowInterval = Math.max(3, Math.floor((sceneDuration * 0.45) / Math.max(1, totalRows)));
    return Math.min(totalRows, Math.floor(Math.max(0, frame - startFrame - 10) / rowInterval) + 1);
  };

  const visibleRowCount = getVisibleRows(paddedRows.length);

  /* ── Winner/loser column detection ───────────────────────────────────────── */
  const effectiveWinnerCol = winnerCol || 1;
  const winnerCellIndex = hasTwoChoices ? effectiveWinnerCol : -1;
  const loserCellIndex = hasTwoChoices ? (effectiveWinnerCol === 1 ? 2 : 1) : -1;

  /* ── Glow for highlighted row ────────────────────────────────────────────── */
  const glowAlpha = pulseGlow(frame, 0.12, 0.5, 1.0);
  const isNearEnd = endFrame !== undefined && frame >= endFrame - 30;

  /* ── Column width ratios ─────────────────────────────────────────────────── */
  const colFlex = (colIndex: number) => (colIndex === 0 ? 1.5 : 1);

  /* ── Dynamic font sizing ─────────────────────────────────────────────────── */
  const cellFontSize = colCount > 4 ? Math.max(16, 22 - (colCount - 4) * 2) : SIZES.bodySmall;
  const headerFontSize = colCount > 4 ? Math.max(16, 20 - (colCount - 4) * 1) : 20;
  const labelFontSize = colCount > 4 ? Math.max(18, SIZES.body - (colCount - 4) * 2) : SIZES.body;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bgBase,
        justifyContent: 'center',
        alignItems: 'center',
        padding: '48px 60px',
        fontFamily: FONTS.text,
      }}
    >
      {/* Animated background — never plain black */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(29,209,161,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(29,209,161,0.02) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at 50% 40%, rgba(232,93,38,0.04) 0%, transparent 50%)`,
        }} />
      </div>

      {/* ── Title ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          fontSize: SIZES.heading2,
          fontWeight: 800,
          color: COLORS.textPrimary,
          marginBottom: 32,
          textAlign: 'center',
          fontFamily: FONTS.heading,
          letterSpacing: '-0.5px',
          textShadow: `0 0 40px ${COLORS.teal}66`,
        }}
      >
        {title}
      </div>

      {/* ── VS Badge (center screen, spring entrance) ─────────────────────── */}
      {hasTwoChoices && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) scale(${vsScale})`,
            zIndex: 10,
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${COLORS.saffron}, ${COLORS.gold})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            fontWeight: 900,
            color: COLORS.bgBase,
            boxShadow: `0 0 40px ${COLORS.saffron}66, 0 0 80px ${COLORS.gold}33`,
            letterSpacing: '2px',
            opacity: vsScale,
          }}
        >
          VS
        </div>
      )}

      {/* ── Table wrapper ─────────────────────────────────────────────────── */}
      <div
        style={{
          width: '100%',
          maxWidth: 1760,
          borderRadius: 16,
          overflow: 'hidden',
          border: `1.5px solid ${COLORS.indigo}44`,
          boxShadow: `0 8px 64px ${COLORS.bgBase}CC, 0 0 0 1px ${COLORS.indigo}22`,
          opacity: headerOpacity,
        }}
      >
        {/* ── Header Row ──────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            background: `linear-gradient(135deg, #1A1625 0%, #0C0A15 100%)`,
            borderBottom: `3px solid ${COLORS.saffron}`,
          }}
        >
          {headers.map((header, i) => {
            const isWinnerHeader = hasTwoChoices && i === winnerCellIndex;
            const isLoserHeader = hasTwoChoices && i === loserCellIndex;
            return (
              <div
                key={i}
                style={{
                  flex: colFlex(i),
                  padding: '18px 24px',
                  fontSize: headerFontSize,
                  fontWeight: 800,
                  color: isWinnerHeader
                    ? COLORS.teal
                    : isLoserHeader
                      ? COLORS.saffron
                      : COLORS.saffron,
                  textAlign: i === 0 ? 'left' : 'center',
                  textTransform: 'uppercase',
                  letterSpacing: '1.2px',
                  borderRight:
                    i < headers.length - 1
                      ? `1.5px solid ${COLORS.indigo}33`
                      : 'none',
                  textShadow: `0 0 12px ${isWinnerHeader ? COLORS.teal : COLORS.saffron}44`,
                }}
              >
                {header || '—'}
              </div>
            );
          })}
        </div>

        {/* ── Data Rows (slide in from bottom, winner green / loser red) ──── */}
        {paddedRows.map((row, rowIndex) => {
          const isVisible = rowIndex < visibleRowCount;

          // Spring slide-in from bottom
          const rowDelay = startFrame + 15 + rowIndex * 6;
          const rowSpring = spring({
            frame: Math.max(0, frame - rowDelay),
            fps,
            config: { damping: 14, stiffness: 120, mass: 0.7 },
          });
          const slideY = interpolate(rowSpring, [0, 1], [60, 0]);
          const springOpacity = interpolate(rowSpring, [0, 0.3], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const rowOpacity = hasSyncData ? (isVisible ? springOpacity : 0) : springOpacity;

          const isHighlightedRow = isNearEnd && rowIndex === visibleRowCount - 1;
          const evenRow = rowIndex % 2 === 0;
          const rowBg = evenRow ? COLORS.darkAlt : `${COLORS.bgBase}EE`;

          return (
            <div
              key={rowIndex}
              style={{
                opacity: rowOpacity,
                transform: `translateY(${slideY}px)`,
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

                // Winner side gets green tint bg, loser gets red tint bg
                const cellBg = isWinnerCell
                  ? `${COLORS.teal}0C`
                  : isLoserCell
                    ? `${COLORS.red}08`
                    : 'transparent';

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
                          ? COLORS.textPrimary
                          : isWinnerCell
                            ? COLORS.teal
                            : isLoserCell
                              ? COLORS.red
                              : COLORS.textPrimary,
                      backgroundColor: cellBg,
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
                    {isWinnerCell && (
                      <span
                        style={{
                          display: 'inline-block',
                          marginRight: 6,
                          color: COLORS.teal,
                          fontWeight: 900,
                          fontSize: cellFontSize,
                        }}
                      >
                        {'\u2713'}
                      </span>
                    )}
                    {isLoserCell && (
                      <span
                        style={{
                          display: 'inline-block',
                          marginRight: 6,
                          color: COLORS.red,
                          fontWeight: 900,
                          fontSize: cellFontSize,
                          opacity: 0.7,
                        }}
                      >
                        {'\u2717'}
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
          opacity: fadeIn(frame, startFrame + 16),
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
        Practice this comparison {'\u2192'}{' '}
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
