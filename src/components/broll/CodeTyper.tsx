/**
 * CodeTyper.tsx
 *
 * Line-by-line syntax-highlighted code reveal with deterministic timing.
 * Timing is derived from character count so the same code always types at
 * the same speed — deterministic for CI renders.
 *
 * Uses a lightweight tokenizer (no Shiki import at runtime — Shiki requires
 * async loading which conflicts with Remotion's sync render model). Instead,
 * uses a fast regex-based tokenizer for TypeScript/Python/Java/Go/Bash.
 *
 * For actual Shiki usage: pre-tokenize at script generation time and pass
 * `tokens` prop directly (see TokenizedCodeTyper variant below).
 *
 * Usage:
 *   <CodeTyper
 *     seed={42}
 *     code={`function hello() {\n  return "world";\n}`}
 *     language="typescript"
 *     startFrame={0}
 *   />
 */
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { createNoise } from './seeded-noise';

// ---------------------------------------------------------------------------
// Lightweight regex tokenizer
// ---------------------------------------------------------------------------
type TokenType = 'keyword' | 'string' | 'comment' | 'number' | 'operator' | 'plain' | 'type' | 'function';

interface Token {
  type: TokenType;
  value: string;
}

const TS_KEYWORDS = /\b(const|let|var|function|return|if|else|for|while|class|interface|type|import|export|from|async|await|new|this|extends|implements|void|null|undefined|true|false|string|number|boolean|any|never)\b/g;
const PY_KEYWORDS = /\b(def|class|return|if|elif|else|for|while|import|from|as|try|except|with|yield|lambda|and|or|not|in|is|None|True|False|pass|break|continue)\b/g;
const STRINGS = /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g;
const COMMENTS_SL = /\/\/.*|#.*/g;
const NUMBERS = /\b\d+\.?\d*\b/g;
const FUNCTIONS = /\b([a-zA-Z_]\w*)\s*(?=\()/g;
const TYPES = /\b([A-Z][A-Za-z0-9_]*)\b/g;

function tokenizeLine(line: string, language: string): Token[] {
  // Simple approach: replace matched regions with tokens
  const tokens: Token[] = [];
  let remaining = line;
  let pos = 0;

  // Find all matches across all patterns, sort by position, emit tokens
  type Match = { start: number; end: number; type: TokenType; value: string };
  const matches: Match[] = [];

  function collectMatches(pattern: RegExp, type: TokenType, text: string) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, type, value: m[0] });
    }
  }

  collectMatches(STRINGS, 'string', line);
  collectMatches(COMMENTS_SL, 'comment', line);
  collectMatches(NUMBERS, 'number', line);
  collectMatches(language === 'python' ? PY_KEYWORDS : TS_KEYWORDS, 'keyword', line);
  collectMatches(FUNCTIONS, 'function', line);
  collectMatches(TYPES, 'type', line);

  // Sort by start position, deduplicate overlapping (first match wins)
  matches.sort((a, b) => a.start - b.start);

  let cursor = 0;
  for (const m of matches) {
    if (m.start < cursor) continue; // overlap, skip
    if (m.start > cursor) {
      tokens.push({ type: 'plain', value: line.slice(cursor, m.start) });
    }
    tokens.push({ type: m.type, value: m.value });
    cursor = m.end;
  }
  if (cursor < line.length) {
    tokens.push({ type: 'plain', value: line.slice(cursor) });
  }
  return tokens.length > 0 ? tokens : [{ type: 'plain', value: line }];
}

// ---------------------------------------------------------------------------
// Token colors (GuruSishya palette)
// ---------------------------------------------------------------------------
const TOKEN_COLORS: Record<TokenType, string> = {
  keyword: '#38BDF8',    // sky blue
  string: '#22C55E',     // green
  comment: '#64748B',    // muted slate
  number: '#F97316',     // orange
  operator: '#F8FAFC',   // white
  plain: '#CBD5E1',      // light slate
  type: '#A78BFA',       // purple
  function: '#FCD34D',   // yellow
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface CodeTyperProps {
  seed: number;
  code: string;
  language?: 'typescript' | 'python' | 'java' | 'go' | 'bash' | 'sql';
  startFrame?: number;
  /** Characters per frame. Default: 3 (deterministic — based on total char count) */
  charsPerFrame?: number;
  /** Highlight specific lines red (0-indexed). e.g. bugLine={3} */
  bugLine?: number;
  /** Add a blinking cursor */
  showCursor?: boolean;
  fontSize?: number;
  maxLines?: number;
}

export const CodeTyper: React.FC<CodeTyperProps> = ({
  seed,
  code,
  language = 'typescript',
  startFrame = 0,
  charsPerFrame = 3,
  bugLine,
  showCursor = true,
  fontSize = 28,
  maxLines = 20,
}) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);

  const lines = code.split('\n').slice(0, maxLines);
  const totalChars = lines.join('\n').length;

  // Deterministic: charsPerFrame derived from code length so total typing
  // duration = totalChars / charsPerFrame frames
  const resolvedCPF = charsPerFrame;

  const charsRevealed = Math.floor(elapsed * resolvedCPF);

  // Map chars to lines
  let charsLeft = charsRevealed;
  const revealedLines: { text: string; complete: boolean }[] = [];
  for (const line of lines) {
    if (charsLeft <= 0) break;
    const take = Math.min(charsLeft, line.length);
    revealedLines.push({ text: line.slice(0, take), complete: take >= line.length });
    charsLeft -= line.length + 1; // +1 for newline
  }

  const cursorVisible = showCursor && Math.floor(frame / 15) % 2 === 0;

  return (
    <div
      style={{
        background: '#1E293B',
        borderRadius: 12,
        padding: '24px 32px',
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize,
        lineHeight: 1.6,
        overflowY: 'hidden',
        maxHeight: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        border: '1px solid #334155',
      }}
    >
      {/* Window chrome dots */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['#EF4444', '#F97316', '#22C55E'].map((c, i) => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
        ))}
      </div>

      {revealedLines.map((lineData, lineIdx) => {
        const tokens = tokenizeLine(lineData.text, language);
        const isBug = lineIdx === bugLine;
        return (
          <div
            key={lineIdx}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              background: isBug ? '#EF444422' : 'transparent',
              borderLeft: isBug ? '3px solid #EF4444' : '3px solid transparent',
              paddingLeft: 8,
              marginLeft: -8,
              borderRadius: isBug ? '0 4px 4px 0' : 0,
            }}
          >
            {/* Line number */}
            <span style={{ color: '#475569', fontSize: fontSize * 0.75, minWidth: 32, userSelect: 'none' }}>
              {lineIdx + 1}
            </span>
            {/* Tokens */}
            <span>
              {tokens.map((tok, ti) => (
                <span key={ti} style={{ color: isBug ? '#FCA5A5' : TOKEN_COLORS[tok.type] }}>
                  {tok.value}
                </span>
              ))}
              {/* Cursor on last revealed line */}
              {lineIdx === revealedLines.length - 1 && !lineData.complete && cursorVisible && (
                <span style={{ color: '#F97316', fontWeight: 700 }}>▌</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
};
