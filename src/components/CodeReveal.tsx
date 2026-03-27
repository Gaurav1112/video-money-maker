import React from 'react';
import { useCurrentFrame, AbsoluteFill } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, slideUp } from '../lib/animations';

interface CodeRevealProps {
  code: string;
  language: string;
  title?: string;
  highlightLines?: number[];
  startFrame?: number;
}

const CodeReveal: React.FC<CodeRevealProps> = ({
  code,
  language,
  title,
  highlightLines = [],
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const lines = code.split('\n');
  const framesPerLine = 15; // Each line appears over 0.5 seconds

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        padding: 60,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 30,
          opacity: fadeIn(frame, startFrame, 20),
        }}
      >
        {/* Title */}
        {title && (
          <div
            style={{
              fontSize: SIZES.heading3,
              fontFamily: FONTS.heading,
              fontWeight: 700,
              color: COLORS.saffron,
            }}
          >
            {title}
          </div>
        )}

        {/* Language badge */}
        <div
          style={{
            backgroundColor: COLORS.teal + '20',
            color: COLORS.teal,
            padding: '6px 16px',
            borderRadius: 6,
            fontSize: SIZES.caption,
            fontFamily: FONTS.code,
            fontWeight: 600,
            textTransform: 'uppercase',
          }}
        >
          {language}
        </div>
      </div>

      {/* Code container */}
      <div
        style={{
          backgroundColor: COLORS.darkAlt,
          borderRadius: 12,
          padding: 40,
          flex: 1,
          overflow: 'hidden',
          border: `1px solid ${COLORS.gray}20`,
        }}
      >
        {/* Window dots */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#FF5F57' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#FEBC2E' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#28C840' }} />
        </div>

        {/* Code lines */}
        <div style={{ fontFamily: FONTS.code, fontSize: SIZES.code, lineHeight: 1.8 }}>
          {lines.map((line, idx) => {
            const lineStart = startFrame + 20 + idx * framesPerLine;
            const isVisible = frame >= lineStart;
            const isHighlighted = highlightLines.includes(idx + 1);
            const lineOpacity = isVisible ? fadeIn(frame, lineStart, 10) : 0;
            const lineSlide = isVisible ? slideUp(frame, lineStart, 20, 10) : 20;

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  opacity: lineOpacity,
                  transform: `translateY(${lineSlide}px)`,
                  backgroundColor: isHighlighted ? COLORS.gold + '10' : 'transparent',
                  borderLeft: isHighlighted ? `3px solid ${COLORS.gold}` : '3px solid transparent',
                  paddingLeft: 12,
                  marginLeft: -15,
                  borderRadius: 2,
                }}
              >
                {/* Line number */}
                <span
                  style={{
                    color: COLORS.gray + '60',
                    minWidth: 45,
                    textAlign: 'right',
                    marginRight: 20,
                    userSelect: 'none',
                    fontSize: SIZES.codeSmall,
                  }}
                >
                  {idx + 1}
                </span>

                {/* Code content - basic coloring */}
                <span style={{ color: colorizeCode(line, language) }}>
                  {line || ' '}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Basic syntax coloring (without full Shiki to keep it simple for now)
function colorizeCode(line: string, _language: string): string {
  const trimmed = line.trim();

  // Comments
  if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) {
    return COLORS.gray;
  }

  // Keywords
  const keywords = ['function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while',
    'class', 'import', 'export', 'from', 'async', 'await', 'def', 'self', 'public', 'private',
    'static', 'void', 'int', 'String', 'boolean', 'new', 'try', 'catch', 'throw'];

  if (keywords.some(k => trimmed.startsWith(k + ' ') || trimmed.startsWith(k + '('))) {
    return COLORS.indigo;
  }

  // Strings
  if (trimmed.includes('"') || trimmed.includes("'") || trimmed.includes('`')) {
    return COLORS.teal;
  }

  return COLORS.white;
}

export default CodeReveal;
