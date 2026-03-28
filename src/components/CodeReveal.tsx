import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, slideUp, springIn } from '../lib/animations';

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
  const framesPerLine = 12; // Slightly faster for snappier reveals

  // Scan line position (moves down as code is revealed)
  const currentRevealLine = Math.floor(
    Math.max(0, (frame - startFrame - 20)) / framesPerLine,
  );

  // File name derived from language
  const fileName = language === 'python'
    ? 'solution.py'
    : language === 'java'
    ? 'Solution.java'
    : 'solution.ts';

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

      {/* Code container - editor frame */}
      <div
        style={{
          backgroundColor: COLORS.darkAlt,
          borderRadius: 12,
          flex: 1,
          overflow: 'hidden',
          border: `1px solid ${COLORS.gray}20`,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Title bar with dots + file tab */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#161222',
            borderBottom: `1px solid ${COLORS.gray}15`,
            padding: '10px 16px',
            gap: 0,
          }}
        >
          {/* Window dots */}
          <div style={{ display: 'flex', gap: 8, marginRight: 20 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#FF5F57' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#FEBC2E' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#28C840' }} />
          </div>

          {/* File tab */}
          <div
            style={{
              backgroundColor: COLORS.darkAlt,
              padding: '6px 16px',
              borderRadius: '6px 6px 0 0',
              fontSize: SIZES.caption,
              fontFamily: FONTS.code,
              color: COLORS.white,
              fontWeight: 500,
              borderTop: `2px solid ${COLORS.saffron}`,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ color: COLORS.saffron, fontSize: 12 }}>&#9679;</span>
            {fileName}
          </div>
        </div>

        {/* Code area */}
        <div style={{ padding: 32, flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* Noise texture overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.02'/%3E%3C/svg%3E")`,
              backgroundSize: '128px 128px',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />

          {/* Scan line effect */}
          {currentRevealLine < lines.length && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: currentRevealLine * (SIZES.code * 1.8) + 4,
                height: SIZES.code * 1.8 + 8,
                background: `linear-gradient(180deg, transparent, ${COLORS.saffron}06, ${COLORS.saffron}04, transparent)`,
                pointerEvents: 'none',
                zIndex: 1,
                transition: 'top 0.1s ease-out',
              }}
            />
          )}

          {/* Code lines */}
          <div style={{ fontFamily: FONTS.code, fontSize: SIZES.code, lineHeight: 1.8, position: 'relative', zIndex: 1 }}>
            {lines.map((line, idx) => {
              const lineStart = startFrame + 20 + idx * framesPerLine;
              const isVisible = frame >= lineStart;
              const isCurrentLine = idx === currentRevealLine && isVisible;
              const isHighlighted = highlightLines.includes(idx + 1);
              const lineOpacity = isVisible ? fadeIn(frame, lineStart, 8) : 0;
              const lineSlide = isVisible ? slideUp(frame, lineStart, 15, 8) : 15;

              // Line highlight glow for currently revealing line
              const glowOpacity = isCurrentLine
                ? interpolate(
                    frame,
                    [lineStart, lineStart + framesPerLine * 0.7, lineStart + framesPerLine],
                    [0.15, 0.08, 0],
                    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                  )
                : 0;

              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    opacity: lineOpacity,
                    transform: `translateY(${lineSlide}px)`,
                    backgroundColor: isHighlighted
                      ? COLORS.gold + '10'
                      : glowOpacity > 0
                      ? `rgba(232, 93, 38, ${glowOpacity})`
                      : 'transparent',
                    borderLeft: isHighlighted
                      ? `3px solid ${COLORS.gold}`
                      : '3px solid transparent',
                    paddingLeft: 12,
                    marginLeft: -15,
                    borderRadius: 2,
                    position: 'relative',
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

                  {/* Typing cursor */}
                  {isCurrentLine && (
                    <span
                      style={{
                        color: COLORS.saffron,
                        fontWeight: 700,
                        opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0,
                        marginLeft: 1,
                      }}
                    >
                      |
                    </span>
                  )}
                </div>
              );
            })}
          </div>
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
