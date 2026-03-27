import React from 'react';
import { useCurrentFrame, AbsoluteFill } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, stagger } from '../lib/animations';

interface ComparisonTableProps {
  headers: string[];
  rows: string[][];
  title: string;
  startFrame?: number;
}

const ComparisonTable: React.FC<ComparisonTableProps> = ({
  headers,
  rows,
  title,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();

  const titleOpacity = fadeIn(frame, startFrame);
  const headerOpacity = fadeIn(frame, startFrame + 15);

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
          const rowStart = stagger(rowIndex, startFrame + 30, 15);
          const rowOpacity = fadeIn(frame, rowStart);

          return (
            <div
              key={rowIndex}
              style={{
                opacity: rowOpacity,
                display: 'flex',
                backgroundColor:
                  rowIndex % 2 === 0 ? COLORS.darkAlt : COLORS.dark,
                borderTop: `1px solid ${COLORS.darkAlt}`,
              }}
            >
              {row.map((cell, cellIndex) => (
                <div
                  key={cellIndex}
                  style={{
                    flex: 1,
                    padding: '14px 24px',
                    fontSize: SIZES.bodySmall,
                    color: COLORS.white,
                    textAlign: 'center',
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
