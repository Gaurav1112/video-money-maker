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
  output?: string;
}

const CodeReveal: React.FC<CodeRevealProps> = ({
  code,
  language,
  title,
  highlightLines = [],
  startFrame = 0,
  output,
}) => {
  const frame = useCurrentFrame();
  const lines = code.split('\n');
  const framesPerLine = 12;

  // Scan line position (moves down as code is revealed)
  const currentRevealLine = Math.floor(
    Math.max(0, (frame - startFrame - 20)) / framesPerLine,
  );

  // Total revealed lines
  const totalRevealed = Math.min(lines.length, currentRevealLine + 1);

  // Cursor blink (faster blink = more alive feel)
  const cursorVisible = Math.sin(frame * 0.4) > 0;

  // After all lines revealed, show output
  const allLinesRevealedFrame = startFrame + 20 + lines.length * framesPerLine;
  const showOutput = output && frame >= allLinesRevealedFrame;
  const outputOpacity = showOutput
    ? interpolate(
        frame,
        [allLinesRevealedFrame, allLinesRevealedFrame + 20],
        [0, 1],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      )
    : 0;

  // File name derived from language
  const fileName = language === 'python'
    ? 'solution.py'
    : language === 'java'
    ? 'Solution.java'
    : 'solution.ts';

  // Minimap indicator (right side)
  const minimapProgress = totalRevealed / Math.max(1, lines.length);

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
          marginBottom: 24,
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
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {/* Code icon */}
            <span style={{ fontSize: 20, opacity: 0.7 }}>&#60;/&#62;</span>
            {title}
          </div>
        )}

        {/* Language badge + line counter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              fontSize: SIZES.caption,
              fontFamily: FONTS.code,
              color: COLORS.gray,
              fontWeight: 500,
            }}
          >
            {totalRevealed}/{lines.length} lines
          </div>
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

          {/* Breadcrumb path (right side) */}
          <div
            style={{
              marginLeft: 'auto',
              fontSize: SIZES.caption - 2,
              fontFamily: FONTS.code,
              color: `${COLORS.gray}66`,
            }}
          >
            src / {fileName}
          </div>
        </div>

        {/* Code area + minimap */}
        <div style={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* Main code area */}
          <div style={{ padding: '24px 32px', flex: 1, position: 'relative', overflow: 'hidden' }}>
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
                  background: `linear-gradient(180deg, transparent, ${COLORS.saffron}08, ${COLORS.saffron}06, transparent)`,
                  pointerEvents: 'none',
                  zIndex: 1,
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

                // Character-by-character typing effect for current line
                const charsVisible = isCurrentLine
                  ? Math.floor(
                      interpolate(
                        frame,
                        [lineStart, lineStart + framesPerLine],
                        [0, line.length],
                        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                      ),
                    )
                  : isVisible
                  ? line.length
                  : 0;

                // Flash effect on each new character
                const charFlash = isCurrentLine && charsVisible > 0
                  ? interpolate(
                      (frame - lineStart) % 2,
                      [0, 1],
                      [1, 0.85],
                    )
                  : 1;

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
                        : isCurrentLine
                        ? `3px solid ${COLORS.saffron}88`
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
                        color: isCurrentLine ? COLORS.saffron + '88' : COLORS.gray + '60',
                        minWidth: 45,
                        textAlign: 'right',
                        marginRight: 20,
                        userSelect: 'none',
                        fontSize: SIZES.codeSmall,
                        fontWeight: isCurrentLine ? 600 : 400,
                      }}
                    >
                      {idx + 1}
                    </span>

                    {/* Code content */}
                    <span
                      style={{
                        color: colorizeCode(line, language),
                        opacity: charFlash,
                      }}
                    >
                      {isCurrentLine ? line.slice(0, charsVisible) : (line || ' ')}
                    </span>

                    {/* Blinking cursor */}
                    {isCurrentLine && cursorVisible && (
                      <span
                        style={{
                          display: 'inline-block',
                          width: 2,
                          height: SIZES.code,
                          backgroundColor: COLORS.saffron,
                          marginLeft: 1,
                          verticalAlign: 'middle',
                          boxShadow: `0 0 6px ${COLORS.saffron}66`,
                        }}
                      />
                    )}

                    {/* Idle cursor on last revealed line (after its typing is done) */}
                    {!isCurrentLine && isVisible && idx === totalRevealed - 1 && currentRevealLine >= lines.length && cursorVisible && (
                      <span
                        style={{
                          display: 'inline-block',
                          width: 2,
                          height: SIZES.code,
                          backgroundColor: COLORS.gray + '66',
                          marginLeft: 1,
                          verticalAlign: 'middle',
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Minimap (right side) */}
          <div
            style={{
              width: 40,
              backgroundColor: '#161222',
              borderLeft: `1px solid ${COLORS.gray}10`,
              position: 'relative',
              padding: '8px 4px',
            }}
          >
            {/* Minimap lines */}
            {lines.map((line, idx) => {
              const isRevealed = idx < totalRevealed;
              const indent = line.search(/\S/);
              const lineLen = Math.min(line.trim().length, 30);
              return (
                <div
                  key={idx}
                  style={{
                    height: 2,
                    marginBottom: 1,
                    marginLeft: Math.min(indent, 8),
                    width: Math.max(2, lineLen * 0.8),
                    backgroundColor: isRevealed
                      ? idx === currentRevealLine
                        ? COLORS.saffron + '88'
                        : COLORS.gray + '30'
                      : COLORS.gray + '10',
                    borderRadius: 1,
                  }}
                />
              );
            })}

            {/* Viewport indicator */}
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: 0,
                right: 0,
                height: `${Math.min(100, (10 / Math.max(1, lines.length)) * 100)}%`,
                backgroundColor: COLORS.saffron + '10',
                borderLeft: `2px solid ${COLORS.saffron}44`,
                transform: `translateY(${minimapProgress * 60}%)`,
              }}
            />
          </div>
        </div>

        {/* Output section at bottom */}
        {output && (
          <div
            style={{
              borderTop: `1px solid ${COLORS.gray}20`,
              backgroundColor: '#0D0B17',
              padding: '12px 24px',
              opacity: outputOpacity,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: SIZES.caption - 2,
                  fontFamily: FONTS.code,
                  color: COLORS.teal,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                Output
              </div>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: COLORS.teal,
                  boxShadow: `0 0 6px ${COLORS.teal}`,
                }}
              />
            </div>
            <div
              style={{
                fontFamily: FONTS.code,
                fontSize: SIZES.codeSmall,
                color: COLORS.teal,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}
            >
              {output}
            </div>
          </div>
        )}
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
    'static', 'void', 'int', 'String', 'boolean', 'new', 'try', 'catch', 'throw', 'interface',
    'type', 'extends', 'implements', 'super', 'this', 'yield', 'lambda', 'with', 'as'];

  if (keywords.some(k => trimmed.startsWith(k + ' ') || trimmed.startsWith(k + '('))) {
    return COLORS.indigo;
  }

  // Strings
  if (trimmed.includes('"') || trimmed.includes("'") || trimmed.includes('`')) {
    return COLORS.teal;
  }

  // Numbers
  if (/^\s*\d/.test(trimmed) || /=\s*\d/.test(trimmed)) {
    return COLORS.gold;
  }

  return COLORS.white;
}

export default CodeReveal;
