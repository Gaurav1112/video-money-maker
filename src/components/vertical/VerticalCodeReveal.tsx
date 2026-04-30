import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate,
  spring,
} from 'remotion';
import { FONTS } from '../../lib/theme';
import { VERTICAL, CODE_LIMITS, COMPONENT_DIMS } from '../../lib/vertical-layouts';
import type { AnimationCue } from '../../types';

// ════════════════════════════════════════════════════════════════════════════════
// PROPS
// ════════════════════════════════════════════════════════════════════════════════
interface VerticalCodeRevealProps {
  code: string;
  language?: string;
  title?: string;
  highlightLines?: number[];
  startFrame?: number;
  output?: string;
  sceneIndex?: number;
  sceneStartFrame?: number;
  animationCues?: AnimationCue[];
  sceneDurationFrames?: number;
  outputLabel?: string;
}

// ════════════════════════════════════════════════════════════════════════════════
// COLORS — hard-coded dark theme; NOT from theme.ts (which is now light)
// ════════════════════════════════════════════════════════════════════════════════
const C = {
  bg: '#0C0A15',
  codeBg: '#1E1E2E',
  tabBg: '#252535',
  outputBg: '#1A1A2E',
  saffron: '#E85D26',
  teal: '#1DD1A1',
  lineNumber: 'rgba(255,255,255,0.25)',
  activeLineBg: 'rgba(232,93,38,0.08)',
  activeLineBorder: '#E85D26',
  dotRed: '#FF5F56',
  dotYellow: '#FFBD2E',
  dotGreen: '#27C93F',
  outputText: '#1DD1A1',
  dimText: 'rgba(226,224,220,0.35)',
  plainText: '#E2E0DC',
} as const;

// ════════════════════════════════════════════════════════════════════════════════
// SYNTAX HIGHLIGHTING
// ════════════════════════════════════════════════════════════════════════════════
type TokenType = 'keyword' | 'string' | 'number' | 'comment' | 'function' | 'operator' | 'type' | 'punctuation' | 'decorator' | 'plain';

interface Token {
  text: string;
  type: TokenType;
}

const TOKEN_COLORS: Record<TokenType, string> = {
  keyword:    '#C792EA',
  string:     '#C3E88D',
  number:     '#FFCB6B',
  comment:    '#6A8A9A', // was #546E7A — better contrast on dark bg for mobile
  function:   '#82AAFF',
  operator:   '#89DDFF',
  type:       '#4EC9B0',
  punctuation:'#BABED8',
  decorator:  '#FFCB6B',
  plain:      '#E2E0DC',
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
  'string', 'number', 'boolean', 'any', 'unknown', 'never', 'void',
  'undefined', 'List', 'Dict', 'Tuple', 'Optional', 'Union', 'Iterator',
  'int', 'float', 'str', 'bool', 'dict', 'list', 'tuple', 'set',
  'HashMap', 'ArrayList', 'LinkedList', 'TreeMap', 'HashSet', 'TreeSet',
  'Integer', 'Long', 'Double', 'Float', 'Character', 'Byte', 'Short',
]);

function tokenizeLine(line: string, _language: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    // Whitespace
    if (line[i] === ' ' || line[i] === '\t') {
      let ws = '';
      while (i < line.length && (line[i] === ' ' || line[i] === '\t')) {
        ws += line[i++];
      }
      tokens.push({ text: ws, type: 'plain' });
      continue;
    }

    // Line comments // and # (only at start or after whitespace-only prefix)
    if (
      (line[i] === '/' && line[i + 1] === '/') ||
      (line[i] === '#' && (i === 0 || line.slice(0, i).trim() === ''))
    ) {
      tokens.push({ text: line.slice(i), type: 'comment' });
      break;
    }

    // Block comment markers  /* */ and leading *
    if (
      (line[i] === '/' && line[i + 1] === '*') ||
      (line[i] === '*' && line[i + 1] === '/') ||
      (i === line.search(/\S/) && line[i] === '*')
    ) {
      tokens.push({ text: line.slice(i), type: 'comment' });
      break;
    }

    // Decorators @Foo
    if (line[i] === '@') {
      let dec = '@';
      i++;
      while (i < line.length && /[a-zA-Z0-9_.]/.test(line[i])) {
        dec += line[i++];
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
        str += line[i++];
      }
      tokens.push({ text: str, type: 'string' });
      continue;
    }

    // Numbers
    if (/[0-9]/.test(line[i]) || (line[i] === '.' && i + 1 < line.length && /[0-9]/.test(line[i + 1]))) {
      let num = '';
      if (line[i] === '0' && i + 1 < line.length && /[xXbBoO]/.test(line[i + 1])) {
        num += line[i] + line[i + 1];
        i += 2;
      }
      while (i < line.length && /[0-9a-fA-F._]/.test(line[i])) {
        num += line[i++];
      }
      tokens.push({ text: num, type: 'number' });
      continue;
    }

    // Identifiers, keywords, types, function calls
    if (/[a-zA-Z_$]/.test(line[i])) {
      let word = '';
      while (i < line.length && /[a-zA-Z0-9_$]/.test(line[i])) {
        word += line[i++];
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
      let op = line[i++];
      while (i < line.length && OPERATORS.has(line[i])) op += line[i++];
      tokens.push({ text: op, type: 'operator' });
      continue;
    }

    if (PUNCTUATION.has(line[i])) {
      tokens.push({ text: line[i++], type: 'punctuation' });
      continue;
    }

    tokens.push({ text: line[i++], type: 'plain' });
  }

  return tokens;
}

// ════════════════════════════════════════════════════════════════════════════════
// LAYOUT CONSTANTS
// ════════════════════════════════════════════════════════════════════════════════
const MARGIN_LEFT  = 60;          // matches SAFE_ZONE.left
const MARGIN_RIGHT = 140;         // matches SAFE_ZONE.right (platform buttons)
const MARGIN_H     = MARGIN_LEFT; // backward compat for positioning
const CODE_WIDTH = VERTICAL.width - MARGIN_LEFT - MARGIN_RIGHT;  // 880px
const FONT_SIZE  = CODE_LIMITS.fontSize;            // 28px
const LINE_H_MULT = 1.6;
const LINE_HEIGHT  = FONT_SIZE * LINE_H_MULT;       // ~44.8px
const LINE_NUM_W   = 56;
const TAB_Y        = 220; // was 70 — must be below SAFE_ZONE.top (200)
const CODE_BLOCK_Y = 270; // was 120
const CODE_BLOCK_TOP_BORDER = 2;
const CODE_PADDING_V = 20;
const CODE_PADDING_H = 20;

// Max lines to show inside the block (scroll if more)
const MAX_VISIBLE_LINES = CODE_LIMITS.maxLines; // 18

// Frames between successive line reveals
const FRAMES_PER_LINE = 6;

// ════════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════════════════════════
const VerticalCodeReveal: React.FC<VerticalCodeRevealProps> = ({
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

  const rawLines = (code || '').split('\n');

  // Clamp to max visible lines
  const lines = rawLines.slice(0, MAX_VISIBLE_LINES);
  const totalLines = lines.length;

  // ── Derive which line is currently being revealed ──────────────────────────
  const effectiveDuration = sceneDurationFrames ?? durationInFrames;
  const elapsed = Math.max(0, frame - startFrame);

  // Sync-cue driven OR time-driven pacing
  let currentRevealLine: number;

  const hasCues = animationCues && animationCues.length > 0;
  if (hasCues) {
    // typeLine cues carry wordIndex; here we pace by elapsed frames since we
    // don't wire useSync in this self-contained component. If there are
    // typeLine cues with numeric targets, use the stagger count as a hint;
    // otherwise fall back to time-based.
    const typeLineCues = animationCues!.filter(c => c.action === 'typeLine');
    if (typeLineCues.length > 0) {
      // Each cue represents one line being revealed. Use the elapsed-frame
      // stagger (same 6-frame cadence) so the timing is predictable.
      currentRevealLine = Math.min(totalLines - 1, Math.floor(elapsed / FRAMES_PER_LINE));
    } else {
      // Default: pace so all lines visible by 85% of scene duration
      const revealWindow = effectiveDuration * 0.85;
      currentRevealLine = Math.min(
        totalLines - 1,
        Math.floor(elapsed / (revealWindow / Math.max(1, totalLines))),
      );
    }
  } else {
    // Proportional pacing: stretch reveal across 80% of scene duration
    // Fall back to fixed stagger only for very short scenes
    if (effectiveDuration > totalLines * FRAMES_PER_LINE * 1.5) {
      const revealWindow = effectiveDuration * 0.8;
      const framesPerLine = revealWindow / Math.max(1, totalLines);
      currentRevealLine = Math.min(totalLines - 1, Math.floor(elapsed / framesPerLine));
    } else {
      currentRevealLine = Math.min(totalLines - 1, Math.floor(elapsed / FRAMES_PER_LINE));
    }
  }

  const totalRevealed = Math.min(totalLines, currentRevealLine + 1);
  const allRevealed = totalRevealed >= totalLines;
  const revealProgress = totalRevealed / Math.max(1, totalLines);

  // ── Cursor blink ───────────────────────────────────────────────────────────
  const cursorOpacity = Math.sin(frame * 0.28) > 0 ? 1 : 0;

  // ── File tab slides down from top ─────────────────────────────────────────
  const tabSlide = interpolate(
    spring({ frame: Math.max(0, frame - startFrame), fps, config: { damping: 14, stiffness: 120, mass: 0.7 } }),
    [0, 1],
    [-60, 0],
  );
  const tabOpacity = interpolate(
    Math.max(0, frame - startFrame),
    [0, 12],
    [0, 1],
    { extrapolateRight: 'clamp' },
  );

  // ── Output panel springs in at 75% reveal (not after 100%+30f) ───────────
  const showOutput = !!output && revealProgress >= 0.75;
  const outputAge = showOutput ? Math.max(0, elapsed - effectiveDuration * 0.75) : 0;
  const outputDelayFrame = startFrame; // kept for backward compat reference
  const outputScale = showOutput
    ? spring({
        frame: outputAge,
        fps,
        config: { damping: 16, stiffness: 140, mass: 0.6 },
      })
    : 0;
  const outputOpacity = showOutput
    ? interpolate(outputAge, [0, 10], [0, 1], { extrapolateRight: 'clamp' })
    : 0;

  // ── File name from language ────────────────────────────────────────────────
  const fileName =
    language === 'python' ? 'solution.py' :
    language === 'java'   ? 'Solution.java' :
    language === 'go'     ? 'solution.go' :
    language === 'rust'   ? 'solution.rs' :
    language === 'cpp'    ? 'solution.cpp' :
    language === 'c'      ? 'solution.c' :
                            'solution.ts';

  const langColor =
    language === 'python' ? '#3572A5' :
    language === 'java'   ? '#B07219' :
    language === 'go'     ? '#00ACD7' :
    language === 'rust'   ? '#DEA584' :
    language === 'cpp'    ? '#F34B7D' :
                            '#3178C6';

  // ── Code block height (content area) ──────────────────────────────────────
  const codeContentHeight = Math.min(totalLines, MAX_VISIBLE_LINES) * LINE_HEIGHT + CODE_PADDING_V * 2;

  // ── Output panel Y position ────────────────────────────────────────────────
  const TAB_HEADER_H = 50;
  const outputY = CODE_BLOCK_Y + TAB_HEADER_H + codeContentHeight + 28;

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>

      {/* ── Subtle radial bg glow ──────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse at 50% 40%, rgba(232,93,38,0.05) 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />

      {/* ── Scene heading ─────────────────────────────────────────────────── */}
      {title && (
        <div style={{
          position: 'absolute',
          top: TAB_Y - 58,
          left: MARGIN_H,
          right: MARGIN_H,
          opacity: tabOpacity,
          transform: `translateY(${tabSlide * 0.5}px)`,
        }}>
          <div style={{
            fontFamily: FONTS.heading,
            fontSize: 28,
            fontWeight: 700,
            color: C.saffron,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <span style={{ opacity: 0.6, fontSize: 22 }}>{'</>'}</span>
            {title}
          </div>
        </div>
      )}

      {/* ── File tab header ───────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        top: CODE_BLOCK_Y,
        left: MARGIN_H,
        width: CODE_WIDTH,
        height: TAB_HEADER_H,
        backgroundColor: C.tabBg,
        borderRadius: '16px 16px 0 0',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 18,
        paddingRight: 18,
        gap: 14,
        opacity: tabOpacity,
        transform: `translateY(${tabSlide}px)`,
      }}>
        {/* macOS dots */}
        <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
          <div style={{ width: 13, height: 13, borderRadius: '50%', backgroundColor: C.dotRed }} />
          <div style={{ width: 13, height: 13, borderRadius: '50%', backgroundColor: C.dotYellow }} />
          <div style={{ width: 13, height: 13, borderRadius: '50%', backgroundColor: C.dotGreen }} />
        </div>

        {/* File tab chip */}
        <div style={{
          backgroundColor: C.codeBg,
          padding: '5px 16px',
          borderRadius: '6px 6px 0 0',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          borderTop: `2px solid ${langColor}`,
        }}>
          <span style={{ color: langColor, fontSize: 11 }}>●</span>
          <span style={{
            fontFamily: FONTS.code,
            fontSize: 22,
            color: C.plainText,
            fontWeight: 500,
            letterSpacing: 0.2,
          }}>
            {fileName}
          </span>
        </div>

        {/* Language badge */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            backgroundColor: `${langColor}22`,
            color: langColor,
            padding: '3px 12px',
            borderRadius: 5,
            fontFamily: FONTS.code,
            fontSize: 20,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}>
            {language}
          </div>
          <div style={{
            fontFamily: FONTS.code,
            fontSize: 20,
            color: 'rgba(255,255,255,0.22)',
          }}>
            {totalRevealed}/{totalLines}
          </div>
        </div>
      </div>

      {/* ── Code block ────────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        top: CODE_BLOCK_Y + TAB_HEADER_H,
        left: MARGIN_H,
        width: CODE_WIDTH,
        backgroundColor: C.codeBg,
        borderRadius: '0 0 16px 16px',
        borderTop: `${CODE_BLOCK_TOP_BORDER}px solid ${C.saffron}`,
        overflow: 'hidden',
        // Subtle drop shadow
        boxShadow: `0 12px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)`,
        opacity: tabOpacity,
        transform: `translateY(${tabSlide * 0.6}px)`,
      }}>
        <div style={{
          display: 'flex',
          paddingTop: CODE_PADDING_V,
          paddingBottom: CODE_PADDING_V,
        }}>

          {/* Line number gutter */}
          <div style={{
            width: LINE_NUM_W,
            flexShrink: 0,
            borderRight: '1px solid rgba(255,255,255,0.06)',
          }}>
            {lines.map((_, idx) => {
              const isVisible = idx < totalRevealed;
              const isActive  = idx === currentRevealLine && isVisible;

              return (
                <div
                  key={idx}
                  style={{
                    height: LINE_HEIGHT,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: 12,
                    fontFamily: FONTS.code,
                    fontSize: 22,
                    color: isActive ? C.saffron : C.lineNumber,
                    fontWeight: isActive ? 700 : 400,
                    backgroundColor: isActive ? C.activeLineBg : 'transparent',
                    opacity: isVisible ? 1 : 0,
                    transition: 'background-color 0.1s',
                  }}
                >
                  {idx + 1}
                </div>
              );
            })}
          </div>

          {/* Code lines */}
          <div style={{
            flex: 1,
            paddingLeft: CODE_PADDING_H,
            paddingRight: CODE_PADDING_H,
            fontFamily: FONTS.code,
            fontSize: FONT_SIZE,
            lineHeight: `${LINE_HEIGHT}px`,
            position: 'relative',
          }}>
            {/* Scan-line spotlight — glowing gradient follows active line */}
            {currentRevealLine < totalLines && (
              <div style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: currentRevealLine * LINE_HEIGHT - 4,
                height: LINE_HEIGHT + 8,
                background: `linear-gradient(180deg, transparent, rgba(232,93,38,0.06), rgba(232,93,38,0.04), transparent)`,
                pointerEvents: 'none',
                zIndex: 2,
              }} />
            )}
            {lines.map((line, idx) => {
              const isVisible = idx < totalRevealed;
              const isActive   = idx === currentRevealLine && isVisible;
              const isPast     = idx < currentRevealLine && isVisible;
              const isHighlighted = (highlightLines ?? []).includes(idx + 1);

              // Per-line staggered entrance
              const lineStartFrame = startFrame + idx * FRAMES_PER_LINE;
              const lineAge = Math.max(0, frame - lineStartFrame);

              const lineOpacity = isVisible
                ? interpolate(lineAge, [0, 8], [0, 1], { extrapolateRight: 'clamp' }) * (isPast ? 0.78 : 1)
                : 0; // was 0.45 — past code must stay readable on mobile
              const lineSlide = isVisible
                ? interpolate(lineAge, [0, 10], [-18, 0], {
                    extrapolateRight: 'clamp',
                    easing: (t: number) => 1 - Math.pow(1 - t, 3),
                  })
                : -18;

              // Character-level typewriter on the currently-revealing line
              // was lineAge * 14 (instant pop-in) — now 5 chars/frame for visible typing
              const charsVisible = isActive
                ? Math.min(line.length, Math.floor(lineAge * 5))
                : isVisible
                ? line.length
                : 0;
              const displayText = isActive ? line.slice(0, charsVisible) : (line || ' ');
              const tokens = tokenizeLine(displayText, language);

              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    height: LINE_HEIGHT,
                    opacity: lineOpacity,
                    transform: `translateX(${lineSlide}px)`,
                    backgroundColor: isHighlighted
                      ? 'rgba(253,184,19,0.08)'
                      : isActive
                      ? C.activeLineBg
                      : 'transparent',
                    borderLeft: isActive
                      ? `3px solid ${C.activeLineBorder}`
                      : isHighlighted
                      ? '3px solid rgba(253,184,19,0.7)'
                      : '3px solid transparent',
                    paddingLeft: 8,
                    marginLeft: -8,
                    borderRadius: 2,
                  }}
                >
                  {/* Syntax-highlighted tokens */}
                  <span style={{ display: 'flex', flexWrap: 'nowrap' }}>
                    {tokens.map((tok, tIdx) => (
                      <span
                        key={tIdx}
                        style={{
                          color: TOKEN_COLORS[tok.type],
                          whiteSpace: 'pre',
                        }}
                      >
                        {tok.text}
                      </span>
                    ))}
                  </span>

                  {/* Blinking cursor on active line */}
                  {isActive && (
                    <span style={{
                      display: 'inline-block',
                      width: 2,
                      height: FONT_SIZE * 1.1,
                      backgroundColor: C.saffron,
                      marginLeft: 2,
                      verticalAlign: 'middle',
                      opacity: cursorOpacity,
                      boxShadow: `0 0 6px ${C.saffron}, 0 0 14px ${C.saffron}77`,
                    }} />
                  )}

                  {/* Idle cursor after full reveal */}
                  {!isActive && isVisible && allRevealed && idx === totalLines - 1 && (
                    <span style={{
                      display: 'inline-block',
                      width: 2,
                      height: FONT_SIZE,
                      backgroundColor: 'rgba(255,255,255,0.3)',
                      marginLeft: 1,
                      verticalAlign: 'middle',
                      opacity: cursorOpacity,
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Output panel ──────────────────────────────────────────────────── */}
      {output && (
        <div style={{
          position: 'absolute',
          top: outputY,
          left: MARGIN_H,
          width: CODE_WIDTH,
          backgroundColor: C.outputBg,
          borderRadius: 14,
          overflow: 'hidden',
          opacity: outputOpacity,
          transform: `translateY(${interpolate(outputScale, [0, 1], [30, 0])}px)`,
          border: `1px solid rgba(29,209,161,0.18)`,
          boxShadow: `0 6px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(29,209,161,0.06)`,
        }}>
          {/* Output header bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 20px 10px 20px',
            borderBottom: '1px solid rgba(29,209,161,0.12)',
          }}>
            <div style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              backgroundColor: C.teal,
              boxShadow: `0 0 7px ${C.teal}`,
            }} />
            <span style={{
              fontFamily: FONTS.code,
              fontSize: 22,
              color: C.teal,
              fontWeight: 700,
              textTransform: 'uppercase' as const,
              letterSpacing: 1.2,
            }}>
              {outputLabel ?? 'Output'}
            </span>
          </div>

          {/* Output text */}
          <div style={{
            padding: '16px 20px 18px 20px',
            fontFamily: FONTS.code,
            fontSize: 26,
            color: C.outputText,
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap' as const,
            wordBreak: 'break-word' as const,
          }}>
            {output}
          </div>
        </div>
      )}

    </AbsoluteFill>
  );
};

export default VerticalCodeReveal;
