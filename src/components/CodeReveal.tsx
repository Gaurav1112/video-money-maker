import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate, useVideoConfig, spring } from 'remotion';
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
  /** Duration of the scene in frames (used to pace line reveal) */
  sceneDurationFrames?: number;
  /** Label shown in the output panel header (defaults to title or "Output") */
  outputLabel?: string;
}

// ─── Token types for syntax highlighting ────────────────────────────
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

const TOKEN_COLORS: Record<TokenType, string> = {
  keyword: '#C792EA',
  string: '#C3E88D',
  number: '#FFCB6B',
  comment: '#546E7A',
  function: '#82AAFF',
  operator: '#89DDFF',
  type: '#4EC9B0',
  punctuation: '#BABED8',
  decorator: '#FFCB6B',
  plain: COLORS.white,
};

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'class', 'import', 'export', 'from', 'async', 'await', 'new', 'try', 'catch',
  'throw', 'switch', 'case', 'break', 'continue', 'default', 'typeof', 'instanceof',
  'in', 'of', 'do', 'yield', 'delete', 'void', 'with', 'finally',
  'extends', 'implements', 'super', 'this', 'interface', 'type', 'enum', 'namespace',
  'abstract', 'declare', 'module', 'require', 'as', 'is',
  'def', 'self', 'lambda', 'pass', 'raise', 'except', 'True', 'False',
  'None', 'and', 'or', 'not', 'elif', 'global', 'nonlocal', 'assert', 'del', 'print',
  'public', 'private', 'protected', 'static', 'final', 'int', 'String',
  'boolean', 'double', 'float', 'long', 'char', 'byte', 'short', 'null',
  'true', 'false', 'package', 'throws', 'synchronized',
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

    // Line comments
    if ((line[i] === '/' && line[i + 1] === '/') || (line[i] === '#' && (i === 0 || line.slice(0, i).trim() === ''))) {
      tokens.push({ text: line.slice(i), type: 'comment' });
      break;
    }

    // Block comment markers
    if ((line[i] === '/' && line[i + 1] === '*') || (line[i] === '*' && line[i + 1] === '/') || (i === line.search(/\S/) && line[i] === '*')) {
      tokens.push({ text: line.slice(i), type: 'comment' });
      break;
    }

    // Decorators
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

    // Strings
    if (line[i] === '"' || line[i] === "'" || line[i] === '`') {
      const quote = line[i];
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
      const nextNonSpace = line.slice(i).search(/\S/);
      const nextChar = nextNonSpace >= 0 ? line[i + nextNonSpace] : '';

      if (KEYWORDS.has(word)) {
        tokens.push({ text: word, type: 'keyword' });
      } else if (TYPE_NAMES.has(word)) {
        tokens.push({ text: word, type: 'type' });
      } else if (nextChar === '(') {
        tokens.push({ text: word, type: 'function' });
      } else if (word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
        tokens.push({ text: word, type: 'type' });
      } else {
        tokens.push({ text: word, type: 'plain' });
      }
      continue;
    }

    // Operators
    const OPERATORS = new Set(['=', '+', '-', '*', '/', '%', '<', '>', '!', '&', '|', '^', '~', '?', ':']);
    const PUNCTUATION = new Set(['{', '}', '(', ')', '[', ']', ',', ';', '.']);

    if (OPERATORS.has(line[i])) {
      let op = line[i];
      i++;
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

    tokens.push({ text: line[i], type: 'plain' });
    i++;
  }

  return tokens;
}

// ─── Constants ──────────────────────────────────────────────────────
const CODE_BG = '#1E1E2E';
const OUTPUT_BG = '#252530';
const TITLE_BAR_BG = '#161B22';
const LINE_HEIGHT_MULT = 1.8;

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
  sceneDurationFrames,
  outputLabel,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const lines = (code || '').split('\n');
  const totalLines = lines.length;

  // ─── Line reveal pacing ─────────────────────────────────────────
  // Pace so all lines are revealed by ~90% of scene duration
  const effectiveDuration = sceneDurationFrames ?? durationInFrames;
  const revealWindow = effectiveDuration * 0.9; // reveal all lines within 90% of scene
  const linesPerSecond = totalLines / (revealWindow / fps);

  // Sync hook (unconditional)
  const sync = useSync(sceneIndex ?? 0, sceneStartFrame ?? startFrame);

  // Current reveal line
  let currentRevealLine: number;
  const hasSyncData = sync.isNarrating || sync.wordsSpoken > 0;
  if (hasSyncData && animationCues && animationCues.length > 0) {
    const typeLineCues = animationCues.filter(c => c.action === 'typeLine');
    const reachedCues = typeLineCues.filter(c => sync.wordIndex >= c.wordIndex);
    if (reachedCues.length > 0) {
      const lastCue = reachedCues[reachedCues.length - 1];
      currentRevealLine = typeof lastCue.target === 'number' ? lastCue.target : totalLines;
    } else {
      currentRevealLine = 0;
    }
  } else {
    // Time-based progressive reveal
    const elapsed = Math.max(0, frame - startFrame);
    currentRevealLine = Math.min(
      totalLines,
      Math.floor(elapsed * linesPerSecond / fps),
    );
  }

  const totalRevealed = Math.min(totalLines, currentRevealLine + 1);
  const revealProgress = totalRevealed / Math.max(1, totalLines);

  // ─── Cursor blink ───────────────────────────────────────────────
  const cursorOpacity = Math.sin(frame * 0.3) > 0 ? 1 : 0;

  // ─── Output panel slide-in ──────────────────────────────────────
  // Starts when ~60% of code is revealed
  const outputTriggerProgress = 0.6;
  const showOutputPanel = output && revealProgress >= outputTriggerProgress;
  const outputPanelWidth = showOutputPanel
    ? spring({
        frame: frame - startFrame,
        fps,
        config: { damping: 18, stiffness: 80, mass: 0.8 },
        from: 0,
        to: 40, // 40% width
      })
    : 0;

  // ─── File name / icon color ─────────────────────────────────────
  const fileName = language === 'python'
    ? 'solution.py'
    : language === 'java'
    ? 'Solution.java'
    : 'solution.ts';

  const langIconColor = language === 'python'
    ? '#3572A5'
    : language === 'java'
    ? '#B07219'
    : '#3178C6';

  // ─── Ambient glow ──────────────────────────────────────────────
  const ambientGlow = interpolate(
    Math.sin(frame * 0.02),
    [-1, 1],
    [0.3, 0.6],
  );

  // ─── Minimap ───────────────────────────────────────────────────
  const minimapProgress = totalRevealed / Math.max(1, totalLines);

  // Character typing speed for the current line
  const charsPerFrame = 12;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        padding: 50,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Ambient glow */}
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
            {totalRevealed}/{totalLines} lines
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

      {/* Main editor container */}
      <div
        style={{
          backgroundColor: CODE_BG,
          borderRadius: 12,
          flex: 1,
          overflow: 'hidden',
          border: `1px solid ${COLORS.gray}22`,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          boxShadow: `0 8px 40px ${COLORS.dark}CC, 0 0 0 1px ${COLORS.gray}10`,
        }}
      >
        {/* Title bar with dots + file tab */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: TITLE_BAR_BG,
            borderBottom: `1px solid ${COLORS.gray}15`,
            padding: '10px 16px',
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
              backgroundColor: CODE_BG,
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

          {/* Breadcrumb */}
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

        {/* ─── Split panels: Code (left) + Output (right) ─── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* LEFT PANEL — Code with typewriter */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Line number gutter */}
            <div
              style={{
                width: 60,
                backgroundColor: CODE_BG,
                borderRight: `1px solid ${COLORS.gray}10`,
                paddingTop: 24,
                flexShrink: 0,
              }}
            >
              {lines.map((_, idx) => {
                const isVisible = idx < totalRevealed;
                const isCurrentLine = idx === currentRevealLine;
                const isPastLine = idx < currentRevealLine && isVisible;

                return (
                  <div
                    key={idx}
                    style={{
                      height: SIZES.code * LINE_HEIGHT_MULT,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: 12,
                      opacity: isVisible ? (isPastLine ? 0.3 : 1) : 0,
                      fontSize: SIZES.codeSmall,
                      fontFamily: FONTS.code,
                      color: isCurrentLine ? COLORS.saffron : COLORS.gray + '44',
                      fontWeight: isCurrentLine ? 700 : 400,
                      backgroundColor: isCurrentLine ? `${COLORS.saffron}08` : 'transparent',
                    }}
                  >
                    {idx + 1}
                  </div>
                );
              })}
            </div>

            {/* Main code area */}
            <div style={{ padding: '24px 24px', flex: 1, position: 'relative', overflow: 'hidden' }}>
              {/* Scan line glow on current line */}
              {currentRevealLine < totalLines && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: currentRevealLine * (SIZES.code * LINE_HEIGHT_MULT) + 4,
                    height: SIZES.code * LINE_HEIGHT_MULT + 8,
                    background: `linear-gradient(180deg, transparent, ${COLORS.saffron}06, ${COLORS.saffron}04, transparent)`,
                    pointerEvents: 'none',
                    zIndex: 1,
                  }}
                />
              )}

              {/* Code lines */}
              <div
                style={{
                  fontFamily: FONTS.code,
                  fontSize: SIZES.code,
                  lineHeight: LINE_HEIGHT_MULT,
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                {lines.map((line, idx) => {
                  const isVisible = idx < totalRevealed;
                  const isCurrentLine = idx === currentRevealLine && isVisible;
                  const isPastLine = idx < currentRevealLine && isVisible;
                  const isHighlighted = highlightLines.includes(idx + 1);

                  // Per-line timing for character-level typewriter on the current line
                  const lineStartFrame = startFrame + Math.floor(idx / linesPerSecond * fps);
                  const lineOpacity = isVisible ? fadeIn(frame, lineStartFrame, 8) : 0;
                  const lineSlide = isVisible ? slideUp(frame, lineStartFrame, 10, 8) : 10;

                  // Character reveal on current line
                  const charsVisible = isCurrentLine
                    ? Math.min(line.length, Math.floor((frame - lineStartFrame) * charsPerFrame))
                    : isVisible
                    ? line.length
                    : 0;

                  const displayText = isCurrentLine ? line.slice(0, charsVisible) : (line || ' ');
                  const tokens = tokenizeLine(displayText, language);

                  // Spotlight: current line full opacity + saffron border, past lines dim
                  const dimFactor = isPastLine ? 0.3 : 1.0;

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
                          ? `${COLORS.saffron}0A`
                          : 'transparent',
                        borderLeft: isCurrentLine
                          ? `4px solid ${COLORS.saffron}`
                          : isHighlighted
                          ? `4px solid ${COLORS.gold}`
                          : '4px solid transparent',
                        paddingLeft: 12,
                        marginLeft: -16,
                        borderRadius: 2,
                        position: 'relative',
                        height: SIZES.code * LINE_HEIGHT_MULT,
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

                      {/* Blinking cursor on current line */}
                      {isCurrentLine && (
                        <span
                          style={{
                            display: 'inline-block',
                            width: 2,
                            height: SIZES.code * 1.1,
                            backgroundColor: COLORS.saffron,
                            marginLeft: 2,
                            verticalAlign: 'middle',
                            opacity: cursorOpacity,
                            boxShadow: `0 0 8px ${COLORS.saffron}, 0 0 16px ${COLORS.saffron}88`,
                          }}
                        />
                      )}

                      {/* Idle cursor on last line after all revealed */}
                      {!isCurrentLine && isVisible && idx === totalRevealed - 1 && currentRevealLine >= totalLines && (
                        <span
                          style={{
                            display: 'inline-block',
                            width: 2,
                            height: SIZES.code,
                            backgroundColor: COLORS.gray + '66',
                            marginLeft: 1,
                            verticalAlign: 'middle',
                            opacity: cursorOpacity,
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Minimap */}
            <div
              style={{
                width: 50,
                backgroundColor: TITLE_BAR_BG,
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
                      marginLeft: Math.min(indent < 0 ? 0 : indent, 8),
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
                  height: `${Math.min(100, (10 / Math.max(1, totalLines)) * 100)}%`,
                  backgroundColor: COLORS.saffron + '08',
                  borderLeft: `2px solid ${COLORS.saffron}33`,
                  transform: `translateY(${minimapProgress * 60}%)`,
                }}
              />
            </div>
          </div>

          {/* RIGHT PANEL — Output (slides in from 0% to 40% width) */}
          {output && (
            <div
              style={{
                width: `${outputPanelWidth}%`,
                overflow: 'hidden',
                backgroundColor: OUTPUT_BG,
                borderLeft: outputPanelWidth > 1 ? `1px solid ${COLORS.gray}20` : 'none',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
              }}
            >
              {/* Output header */}
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: `1px solid ${COLORS.gray}15`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  opacity: outputPanelWidth > 5 ? 1 : 0,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: COLORS.teal,
                    boxShadow: `0 0 6px ${COLORS.teal}`,
                  }}
                />
                <div
                  style={{
                    fontSize: SIZES.caption,
                    fontFamily: FONTS.code,
                    color: COLORS.teal,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {outputLabel || 'Output'}
                </div>
              </div>

              {/* Output body */}
              <div
                style={{
                  padding: '16px 16px',
                  flex: 1,
                  opacity: outputPanelWidth > 10 ? 1 : 0,
                }}
              >
                <div
                  style={{
                    fontFamily: FONTS.code,
                    fontSize: SIZES.codeSmall,
                    color: COLORS.teal,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {output}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default CodeReveal;
