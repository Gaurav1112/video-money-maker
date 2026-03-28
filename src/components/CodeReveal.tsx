import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate, useVideoConfig } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, slideUp } from '../lib/animations';
import { useSync } from '../hooks/useSync';
import type { AnimationCue } from '../types';

interface CodeRevealProps {
  code: string;
  language: string;
  title?: string;
  highlightLines?: number[];
  startFrame?: number;
  output?: string;
  sceneIndex?: number;
  sceneStartFrame?: number;
  animationCues?: AnimationCue[];
}

// Token types for syntax highlighting
type TokenType =
  | 'keyword'
  | 'string'
  | 'number'
  | 'comment'
  | 'function'
  | 'operator'
  | 'type'
  | 'punctuation'
  | 'decorator'
  | 'plain';

interface Token {
  text: string;
  type: TokenType;
}

// Color map for each token type
const TOKEN_COLORS: Record<TokenType, string> = {
  keyword: '#C792EA',     // soft purple
  string: '#C3E88D',      // green
  number: '#FFCB6B',      // gold
  comment: '#546E7A',     // muted gray
  function: '#82AAFF',    // light blue
  operator: '#89DDFF',    // cyan-white
  type: '#4EC9B0',        // teal
  punctuation: '#BABED8', // soft white
  decorator: '#FFCB6B',   // gold
  plain: COLORS.white,
};

const KEYWORDS = new Set([
  // JS/TS
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'class', 'import', 'export', 'from', 'async', 'await', 'new', 'try', 'catch',
  'throw', 'switch', 'case', 'break', 'continue', 'default', 'typeof', 'instanceof',
  'in', 'of', 'do', 'yield', 'delete', 'void', 'with', 'finally',
  'extends', 'implements', 'super', 'this', 'interface', 'type', 'enum', 'namespace',
  'abstract', 'declare', 'module', 'require', 'as', 'is',
  // Python
  'def', 'self', 'lambda', 'with', 'as', 'pass', 'raise', 'except', 'True', 'False',
  'None', 'and', 'or', 'not', 'is', 'in', 'elif', 'global', 'nonlocal', 'assert',
  'yield', 'del', 'print',
  // Java/general
  'public', 'private', 'protected', 'static', 'final', 'void', 'int', 'String',
  'boolean', 'double', 'float', 'long', 'char', 'byte', 'short', 'null',
  'true', 'false', 'package', 'throws', 'implements', 'abstract', 'synchronized',
]);

const TYPE_NAMES = new Set([
  'Array', 'Map', 'Set', 'Promise', 'Object', 'Number', 'Boolean', 'Record',
  'Partial', 'Required', 'Readonly', 'Pick', 'Omit', 'Exclude', 'Extract',
  'string', 'number', 'boolean', 'any', 'unknown', 'never', 'void', 'null',
  'undefined', 'List', 'Dict', 'Tuple', 'Optional', 'Union', 'Iterator',
  'int', 'float', 'str', 'bool', 'dict', 'list', 'tuple', 'set',
  'HashMap', 'ArrayList', 'LinkedList', 'TreeMap', 'HashSet', 'TreeSet',
  'Integer', 'Long', 'Double', 'Float', 'Character', 'Byte', 'Short',
]);

/**
 * Tokenize a line of code into colored tokens.
 * This is a simplified but visually effective tokenizer -- not a full parser,
 * but handles the most common patterns for Python, TypeScript, and Java.
 */
function tokenizeLine(line: string, _language: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    // Whitespace
    if (line[i] === ' ' || line[i] === '\t') {
      let ws = '';
      while (i < line.length && (line[i] === ' ' || line[i] === '\t')) {
        ws += line[i];
        i++;
      }
      tokens.push({ text: ws, type: 'plain' });
      continue;
    }

    // Line comments: // or #
    if ((line[i] === '/' && line[i + 1] === '/') || (line[i] === '#' && (i === 0 || line.slice(0, i).trim() === ''))) {
      tokens.push({ text: line.slice(i), type: 'comment' });
      break;
    }

    // Block comment markers: /* or */  or lines starting with *
    if ((line[i] === '/' && line[i + 1] === '*') || (line[i] === '*' && line[i + 1] === '/') || (i === line.search(/\S/) && line[i] === '*')) {
      tokens.push({ text: line.slice(i), type: 'comment' });
      break;
    }

    // Decorators: @something
    if (line[i] === '@') {
      let dec = '@';
      i++;
      while (i < line.length && /[a-zA-Z0-9_.]/.test(line[i])) {
        dec += line[i];
        i++;
      }
      tokens.push({ text: dec, type: 'decorator' });
      continue;
    }

    // Strings: single, double, backtick, triple quotes
    if (line[i] === '"' || line[i] === "'" || line[i] === '`') {
      const quote = line[i];
      // Check for triple quotes
      const isTriple = line.slice(i, i + 3) === quote.repeat(3);
      const endQuote = isTriple ? quote.repeat(3) : quote;
      let str = '';
      const startQuoteLen = isTriple ? 3 : 1;
      str += line.slice(i, i + startQuoteLen);
      i += startQuoteLen;
      while (i < line.length) {
        if (line[i] === '\\' && i + 1 < line.length) {
          str += line[i] + line[i + 1];
          i += 2;
          continue;
        }
        if (line.slice(i, i + endQuote.length) === endQuote) {
          str += endQuote;
          i += endQuote.length;
          break;
        }
        str += line[i];
        i++;
      }
      tokens.push({ text: str, type: 'string' });
      continue;
    }

    // Numbers
    if (/[0-9]/.test(line[i]) || (line[i] === '.' && i + 1 < line.length && /[0-9]/.test(line[i + 1]))) {
      let num = '';
      // Hex prefix
      if (line[i] === '0' && i + 1 < line.length && (line[i + 1] === 'x' || line[i + 1] === 'X' || line[i + 1] === 'b' || line[i + 1] === 'o')) {
        num += line[i] + line[i + 1];
        i += 2;
      }
      while (i < line.length && /[0-9a-fA-F._]/.test(line[i])) {
        num += line[i];
        i++;
      }
      tokens.push({ text: num, type: 'number' });
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_$]/.test(line[i])) {
      let word = '';
      while (i < line.length && /[a-zA-Z0-9_$]/.test(line[i])) {
        word += line[i];
        i++;
      }

      // Check if it's a function call (followed by '(')
      const nextNonSpace = line.slice(i).search(/\S/);
      const nextChar = nextNonSpace >= 0 ? line[i + nextNonSpace] : '';

      if (KEYWORDS.has(word)) {
        tokens.push({ text: word, type: 'keyword' });
      } else if (TYPE_NAMES.has(word)) {
        tokens.push({ text: word, type: 'type' });
      } else if (nextChar === '(') {
        tokens.push({ text: word, type: 'function' });
      } else if (word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
        // PascalCase = likely a type/class name
        tokens.push({ text: word, type: 'type' });
      } else {
        tokens.push({ text: word, type: 'plain' });
      }
      continue;
    }

    // Operators and punctuation
    const OPERATORS = new Set(['=', '+', '-', '*', '/', '%', '<', '>', '!', '&', '|', '^', '~', '?', ':']);
    const PUNCTUATION = new Set(['{', '}', '(', ')', '[', ']', ',', ';', '.']);

    if (OPERATORS.has(line[i])) {
      let op = line[i];
      i++;
      // Multi-char operators: ==, ===, =>, !=, !==, <=, >=, &&, ||, ??, ++, --, **, ->, ::
      while (i < line.length && OPERATORS.has(line[i])) {
        op += line[i];
        i++;
      }
      tokens.push({ text: op, type: 'operator' });
      continue;
    }

    if (PUNCTUATION.has(line[i])) {
      tokens.push({ text: line[i], type: 'punctuation' });
      i++;
      continue;
    }

    // Anything else
    tokens.push({ text: line[i], type: 'plain' });
    i++;
  }

  return tokens;
}

const CodeReveal: React.FC<CodeRevealProps> = ({
  code = '',
  language = 'typescript',
  title,
  highlightLines = [],
  startFrame = 0,
  output,
  sceneIndex,
  sceneStartFrame,
  animationCues,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = (code || '').split('\n');
  // FIRESHIP-speed reveal: code appears almost instantly.
  // First 5 lines show within 15 frames (0.5s). Remaining lines at ~5-8 lines/sec.
  // ALL lines visible by 60% of scene duration (not 100%).
  // For 30 lines at 30fps: 5 instant + 25 remaining in ~5s = ~6 frames/line for remaining.
  // For short code (<15 lines): 2 frames/line. For long code (>40): 2 frames/line.
  const INSTANT_LINES = 5; // first N lines appear within 0.5s
  const INSTANT_WINDOW = 15; // frames to reveal the first batch (0.5s at 30fps)
  const framesPerLine = lines.length > 40 ? 2 : lines.length > 20 ? 3 : lines.length > 10 ? 4 : 5;

  // Sync hook — always called unconditionally (React Rules of Hooks)
  const sync = useSync(sceneIndex ?? 0, sceneStartFrame ?? startFrame);

  // Scan line position (moves down as code is revealed)
  let currentRevealLine: number;
  const hasSyncData = sync.isNarrating || sync.wordsSpoken > 0;
  if (hasSyncData && animationCues && animationCues.length > 0) {
    const typeLineCues = animationCues.filter(c => c.action === 'typeLine');
    const reachedCues = typeLineCues.filter(c => sync.wordIndex >= c.wordIndex);
    if (reachedCues.length > 0) {
      const lastCue = reachedCues[reachedCues.length - 1];
      currentRevealLine = typeof lastCue.target === 'number' ? lastCue.target : lines.length;
    } else {
      currentRevealLine = 0;
    }
  } else {
    // Fallback: time-based reveal — Fireship-style instant start
    // First INSTANT_LINES appear within INSTANT_WINDOW frames, then remaining at framesPerLine pace
    const elapsed = Math.max(0, frame - startFrame);
    if (elapsed <= INSTANT_WINDOW) {
      // Reveal first batch proportionally within the instant window
      currentRevealLine = Math.floor((elapsed / INSTANT_WINDOW) * INSTANT_LINES);
    } else {
      // After instant batch, continue at framesPerLine pace for remaining lines
      currentRevealLine = INSTANT_LINES + Math.floor((elapsed - INSTANT_WINDOW) / framesPerLine);
    }
  }

  // Total revealed lines
  const totalRevealed = Math.min(lines.length, currentRevealLine + 1);

  // Cursor blink
  const cursorVisible = Math.sin(frame * 0.4) > 0;

  // After all lines revealed, show output
  const allLinesRevealedFrame = startFrame + INSTANT_WINDOW + Math.max(0, lines.length - INSTANT_LINES) * framesPerLine;
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

  // Language icon color
  const langIconColor = language === 'python'
    ? '#3572A5'
    : language === 'java'
    ? '#B07219'
    : '#3178C6';

  // Minimap indicator
  const minimapProgress = totalRevealed / Math.max(1, lines.length);

  // Editor ambient glow
  const ambientGlow = interpolate(
    Math.sin(frame * 0.02),
    [-1, 1],
    [0.3, 0.6],
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        padding: 50,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Subtle ambient glow behind the editor */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '20%',
          width: 800,
          height: 400,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${COLORS.indigo}08, transparent 70%)`,
          opacity: ambientGlow,
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />

      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          opacity: fadeIn(frame, startFrame, 20),
        }}
      >
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
            <span style={{ fontSize: 20, opacity: 0.7 }}>&#60;/&#62;</span>
            {title}
          </div>
        )}

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

      {/* Code container - premium IDE frame */}
      <div
        style={{
          backgroundColor: '#0D1117',
          borderRadius: 12,
          flex: 1,
          overflow: 'hidden',
          border: `1px solid ${COLORS.gray}22`,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          boxShadow: `0 8px 40px ${COLORS.dark}CC, 0 0 0 1px ${COLORS.gray}10, inset 0 1px 0 ${COLORS.gray}08`,
        }}
      >
        {/* Title bar with dots + file tab */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#161B22',
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
              backgroundColor: '#0D1117',
              padding: '6px 16px',
              borderRadius: '6px 6px 0 0',
              fontSize: SIZES.caption,
              fontFamily: FONTS.code,
              color: COLORS.white,
              fontWeight: 500,
              borderTop: `2px solid ${langIconColor}`,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ color: langIconColor, fontSize: 12 }}>&#9679;</span>
            {fileName}
          </div>

          {/* Breadcrumb path */}
          <div
            style={{
              marginLeft: 'auto',
              fontSize: SIZES.caption - 2,
              fontFamily: FONTS.code,
              color: `${COLORS.gray}55`,
            }}
          >
            src / {fileName}
          </div>
        </div>

        {/* Code area + minimap */}
        <div style={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* Line number gutter */}
          <div
            style={{
              width: 60,
              backgroundColor: '#0D1117',
              borderRight: `1px solid ${COLORS.gray}10`,
              paddingTop: 24,
              flexShrink: 0,
            }}
          >
            {lines.map((_, idx) => {
              // Compute when this line becomes visible: instant batch or sequential
              const lineStart = idx < INSTANT_LINES
                ? startFrame + Math.floor((idx / INSTANT_LINES) * INSTANT_WINDOW)
                : startFrame + INSTANT_WINDOW + (idx - INSTANT_LINES) * framesPerLine;
              const isVisible = frame >= lineStart;
              const isCurrentLine = idx === currentRevealLine && isVisible;
              const isPastLine = idx < currentRevealLine && isVisible;
              const lineOpacity = isVisible ? fadeIn(frame, lineStart, 8) : 0;
              // Pulse effect on current line number
              const lineNumPulse = isCurrentLine
                ? interpolate(Math.sin(frame * 0.12), [-1, 1], [0.7, 1.0])
                : 1;
              // Scale bump on current line number
              const lineNumScale = isCurrentLine
                ? interpolate(Math.sin(frame * 0.12), [-1, 1], [1.0, 1.15])
                : 1;

              return (
                <div
                  key={idx}
                  style={{
                    height: SIZES.code * 1.8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: 12,
                    opacity: lineOpacity * (isPastLine ? 0.5 : 1) * lineNumPulse,
                    fontSize: SIZES.codeSmall,
                    fontFamily: FONTS.code,
                    color: isCurrentLine ? COLORS.saffron : isPastLine ? COLORS.gray + '33' : COLORS.gray + '44',
                    fontWeight: isCurrentLine ? 700 : 400,
                    backgroundColor: isCurrentLine ? `${COLORS.saffron}08` : 'transparent',
                    transform: `scale(${lineNumScale})`,
                    textShadow: isCurrentLine ? `0 0 8px ${COLORS.saffron}44` : 'none',
                  }}
                >
                  {idx + 1}
                </div>
              );
            })}
          </div>

          {/* Main code area */}
          <div style={{ padding: '24px 24px', flex: 1, position: 'relative', overflow: 'hidden' }}>
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
                }}
              />
            )}

            {/* Code lines with per-token coloring */}
            <div style={{ fontFamily: FONTS.code, fontSize: SIZES.code, lineHeight: 1.8, position: 'relative', zIndex: 1 }}>
              {lines.map((line, idx) => {
                // Compute when this line becomes visible: instant batch or sequential
                const lineStart = idx < INSTANT_LINES
                  ? startFrame + Math.floor((idx / INSTANT_LINES) * INSTANT_WINDOW)
                  : startFrame + INSTANT_WINDOW + (idx - INSTANT_LINES) * framesPerLine;
                const isVisible = frame >= lineStart;
                const isCurrentLine = idx === currentRevealLine && isVisible;
                const isPastLine = idx < currentRevealLine && isVisible;
                const isHighlighted = highlightLines.includes(idx + 1);
                const lineOpacity = isVisible ? fadeIn(frame, lineStart, 8) : 0;
                const lineSlide = isVisible ? slideUp(frame, lineStart, 15, 8) : 15;

                // Dim past lines slightly to focus attention on current
                const dimFactor = isPastLine ? 0.55 : 1.0;

                // Glowing border pulse on current line
                const glowPulse = isCurrentLine
                  ? interpolate(Math.sin(frame * 0.1), [-1, 1], [0.15, 0.35])
                  : 0;
                const borderGlow = isCurrentLine
                  ? interpolate(Math.sin(frame * 0.1), [-1, 1], [0.6, 1.0])
                  : 0;

                // Fast character typing: reveal ~12 chars per frame for snappy feel
                const charsPerFrame = Math.max(12, Math.ceil(line.length / Math.max(1, framesPerLine)));
                const charsVisible = isCurrentLine
                  ? Math.min(line.length, Math.floor((frame - lineStart) * charsPerFrame))
                  : isVisible
                  ? line.length
                  : 0;

                const displayText = isCurrentLine ? line.slice(0, charsVisible) : (line || ' ');

                // Tokenize the visible text
                const tokens = tokenizeLine(displayText, language);

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      opacity: lineOpacity * dimFactor,
                      transform: `translateY(${lineSlide}px)`,
                      backgroundColor: isHighlighted
                        ? COLORS.gold + '10'
                        : isCurrentLine
                        ? `rgba(232, 93, 38, ${glowPulse})`
                        : 'transparent',
                      boxShadow: isCurrentLine
                        ? `0 0 ${20 + glowPulse * 20}px rgba(232, 93, 38, ${glowPulse}), inset 0 0 12px rgba(232, 93, 38, ${glowPulse * 0.3})`
                        : 'none',
                      borderLeft: isHighlighted
                        ? `3px solid ${COLORS.gold}`
                        : isCurrentLine
                        ? `3px solid rgba(232, 93, 38, ${borderGlow})`
                        : '3px solid transparent',
                      paddingLeft: 12,
                      marginLeft: -15,
                      borderRadius: 2,
                      position: 'relative',
                      height: SIZES.code * 1.8,
                      alignItems: 'center',
                    }}
                  >
                    {/* Colored tokens */}
                    <span style={{ display: 'flex' }}>
                      {tokens.map((token, tIdx) => (
                        <span
                          key={tIdx}
                          style={{
                            color: TOKEN_COLORS[token.type],
                            whiteSpace: 'pre',
                          }}
                        >
                          {token.text}
                        </span>
                      ))}
                    </span>

                    {/* Blinking cursor */}
                    {isCurrentLine && cursorVisible && (
                      <span
                        style={{
                          display: 'inline-block',
                          width: 2,
                          height: SIZES.code * 1.1,
                          backgroundColor: COLORS.saffron,
                          marginLeft: 2,
                          verticalAlign: 'middle',
                          boxShadow: `0 0 8px ${COLORS.saffron}, 0 0 16px ${COLORS.saffron}88`,
                        }}
                      />
                    )}

                    {/* Idle cursor on last line */}
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
              width: 50,
              backgroundColor: '#161B22',
              borderLeft: `1px solid ${COLORS.gray}10`,
              position: 'relative',
              padding: '8px 6px',
            }}
          >
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
                        : COLORS.gray + '25'
                      : COLORS.gray + '08',
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
                backgroundColor: COLORS.saffron + '08',
                borderLeft: `2px solid ${COLORS.saffron}33`,
                transform: `translateY(${minimapProgress * 60}%)`,
              }}
            />
          </div>
        </div>

        {/* Output section at bottom */}
        {output && (
          <div
            style={{
              borderTop: `1px solid rgba(35, 134, 54, 0.25)`,
              backgroundColor: '#0A1210',
              padding: '12px 24px',
              opacity: outputOpacity,
              boxShadow: 'inset 0 1px 0 rgba(35, 134, 54, 0.1)',
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
                Terminal
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

export default CodeReveal;
