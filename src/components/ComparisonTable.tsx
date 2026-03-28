import React from 'react';
import { useCurrentFrame, AbsoluteFill } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, stagger } from '../lib/animations';
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
}

const ComparisonTable: React.FC<ComparisonTableProps> = ({
  headers,
  rows,
  title,
  startFrame = 0,
  endFrame,
  sceneIndex,
  sceneStartFrame,
  animationCues,
}) => {
  const frame = useCurrentFrame();
  const sync = useSync(sceneIndex ?? 0, sceneStartFrame ?? startFrame);

  const titleOpacity = fadeIn(frame, startFrame);
  const headerOpacity = fadeIn(frame, startFrame + 15);

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
    // Fallback: time-based stagger (15 frames per row)
    return Math.min(totalRows, Math.floor(Math.max(0, frame - startFrame - 30) / 15) + 1);
  };

  const visibleRowCount = getVisibleRows(rows.length);
  const isNearEnd = endFrame !== undefined && frame >= endFrame - 30;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px 80px',
        fontFamily: FONTS.text,
      }}
    >
      <div
        style={{
          opacity: titleOpacity,
          fontSize: SIZES.heading2,
          fontWeight: 700,
          color: COLORS.saffron,
          marginBottom: 40,
          textAlign: 'center',
          fontFamily: FONTS.heading,
        }}
      >
        {title}
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: 1000,
          borderRadius: 12,
          overflow: 'hidden',
          border: `1px solid ${COLORS.darkAlt}`,
        }}
      >
        {/* Header Row */}
        <div
          style={{
            opacity: headerOpacity,
            display: 'flex',
            backgroundColor: COLORS.teal,
          }}
        >
          {headers.map((header, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                padding: '16px 24px',
                fontSize: SIZES.body,
                fontWeight: 700,
                color: COLORS.dark,
                textAlign: 'center',
                borderRight:
                  i < headers.length - 1
                    ? `1px solid ${COLORS.dark}33`
                    : 'none',
              }}
            >
              {header}
            </div>
          ))}
        </div>

        {/* Data Rows */}
        {rows.map((row, rowIndex) => {
          const isVisible = rowIndex < visibleRowCount;
          // Fallback stagger opacity used when sync is inactive
          const rowStart = stagger(rowIndex, startFrame + 30, 15);
          const fallbackOpacity = fadeIn(frame, rowStart);
          const rowOpacity = hasSyncData ? (isVisible ? 1 : 0) : fallbackOpacity;

          // Winner row glow: highlight the last visible row near scene end
          const isWinnerRow = isNearEnd && rowIndex === visibleRowCount - 1;

          return (
            <div
              key={rowIndex}
              style={{
                opacity: rowOpacity,
                display: 'flex',
                backgroundColor:
                  rowIndex % 2 === 0 ? COLORS.darkAlt : COLORS.dark,
                borderTop: `1px solid ${COLORS.darkAlt}`,
                ...(isWinnerRow
                  ? {
                      boxShadow: `0 0 16px 4px ${COLORS.saffron}66`,
                      borderTop: `1px solid ${COLORS.saffron}`,
                    }
                  : {}),
              }}
            >
              {row.map((cell, cellIndex) => (
                <div
                  key={cellIndex}
                  style={{
                    flex: 1,
                    padding: '14px 24px',
                    fontSize: SIZES.bodySmall,
                    color: isWinnerRow ? COLORS.saffron : COLORS.white,
                    textAlign: 'center',
                    fontWeight: isWinnerRow ? 700 : 400,
                    borderRight:
                      cellIndex < row.length - 1
                        ? `1px solid ${COLORS.darkAlt}`
                        : 'none',
                  }}
                >
                  {cell}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export default ComparisonTable;
