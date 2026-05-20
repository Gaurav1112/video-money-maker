// src/components/CodeSnippetPanel.tsx
//
// v3: 16-second wrong-vs-right code reveal for QuizShort. Renders inside the
// CODE phase (frames 420-900 at 30fps). Phases:
//   0-6s   : WRONG version, red border, "DON'T DO THIS"
//   6-10s  : transition (wrong slides out, right slides in)
//   10-16s : RIGHT version, green border, "DO THIS"
// Typewriter ~25 chars/sec on each, simple regex-based syntax highlighting.
//
// Deterministic: no Math.random; uses useCurrentFrame only.

import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import type { CodeSnippet } from '../lib/quiz-content';
import { FONTS } from '../lib/theme';

interface Props {
  snippet: CodeSnippet;
  startFrame: number;
  durationFrames: number; // ~480 frames at 30fps = 16s
}

// ── Syntax tokenizer ────────────────────────────────────────────────
// Returns an array of {text, kind} where kind drives color. We tokenize the
// whole snippet once (memoized) and then truncate by character count for the
// typewriter effect — this way colors are stable across frames.

type TokenKind = 'keyword' | 'string' | 'comment' | 'number' | 'punct' | 'plain';
interface Token {
  text: string;
  kind: TokenKind;
}

const KEYWORDS: Record<string, RegExp> = {
  ts: /\b(const|let|var|function|async|await|return|if|else|for|while|new|class|interface|type|export|import|from|as|of|in|try|catch|throw|true|false|null|undefined|this|use|app|public|private)\b/g,
  java: /\b(public|private|protected|class|interface|extends|implements|static|final|void|new|return|if|else|for|while|try|catch|throw|true|false|null|this|Duration|String|int|long|boolean|props)\b/g,
  python: /\b(def|class|return|if|elif|else|for|while|try|except|raise|import|from|as|with|lambda|True|False|None|self|pass|yield|async|await)\b/g,
  yaml: /^\s*([\w.-]+)(?=\s*:)/gm,
  json: /"([^"\\]*(?:\\.[^"\\]*)*)"(?=\s*:)/g,
  sql: /\b(SELECT|FROM|WHERE|UPDATE|DELETE|INSERT|INTO|VALUES|SET|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|HAVING|CREATE|INDEX|DROP|TABLE|ALTER|AND|OR|NOT|NULL|IS|IN|AS|RETURNING|NOW)\b/gi,
  bash: /\b(if|then|else|fi|for|do|done|while|case|esac|function|return|export|local|true|false)\b/g,
  go: /\b(func|var|const|type|struct|interface|return|if|else|for|range|go|defer|chan|map|nil|true|false|package|import)\b/g,
};

function tokenize(code: string, lang: CodeSnippet['language']): Token[] {
  // Strategy: walk char-by-char, emitting comments + strings as whole units;
  // then apply keyword regex to remaining text. Simple and good enough for the
  // tiny snippets we render.
  const out: Token[] = [];
  let i = 0;
  const commentStart = lang === 'sql' ? '--' : lang === 'python' ? '#' : lang === 'yaml' || lang === 'bash' ? '#' : '//';
  const stringChars = ['"', "'", '`'];

  while (i < code.length) {
    // Comment to end of line
    if (code.startsWith(commentStart, i)) {
      const end = code.indexOf('\n', i);
      const stop = end === -1 ? code.length : end;
      out.push({ text: code.slice(i, stop), kind: 'comment' });
      i = stop;
      continue;
    }
    // String literal
    const sc = stringChars.find((c) => code[i] === c);
    if (sc) {
      let j = i + 1;
      while (j < code.length && code[j] !== sc) {
        if (code[j] === '\\') j++;
        j++;
      }
      j = Math.min(j + 1, code.length);
      out.push({ text: code.slice(i, j), kind: 'string' });
      i = j;
      continue;
    }
    // Number
    const numMatch = code.slice(i).match(/^\d[\d_.]*/);
    if (numMatch) {
      out.push({ text: numMatch[0], kind: 'number' });
      i += numMatch[0].length;
      continue;
    }
    // Word
    const wordMatch = code.slice(i).match(/^[A-Za-z_][\w.-]*/);
    if (wordMatch) {
      const w = wordMatch[0];
      const kwRe = KEYWORDS[lang];
      kwRe.lastIndex = 0;
      const isKw = lang === 'yaml'
        ? /^\s/.test(code[i - 1] ?? ' ') && code[i + w.length] === ':'
        : kwRe.test(w);
      out.push({ text: w, kind: isKw ? 'keyword' : 'plain' });
      i += w.length;
      continue;
    }
    // Punctuation / whitespace
    out.push({ text: code[i], kind: /[\s]/.test(code[i]) ? 'plain' : 'punct' });
    i++;
  }
  return out;
}

const COLORS: Record<TokenKind, string> = {
  keyword: '#22D3EE',  // cyan
  string: '#FBBF24',   // yellow
  comment: '#6B7280',  // muted gray
  number: '#A78BFA',   // violet
  punct: '#E5E7EB',    // light
  plain: '#F9FAFB',    // near-white
};

// ── Typewriter slice ────────────────────────────────────────────────
function sliceTokens(tokens: Token[], maxChars: number): Token[] {
  if (maxChars <= 0) return [];
  const out: Token[] = [];
  let remaining = maxChars;
  for (const tok of tokens) {
    if (remaining <= 0) break;
    if (tok.text.length <= remaining) {
      out.push(tok);
      remaining -= tok.text.length;
    } else {
      out.push({ text: tok.text.slice(0, remaining), kind: tok.kind });
      remaining = 0;
    }
  }
  return out;
}

// ── Code panel (renders one side of the wrong/right pair) ───────────
const CodeBlock: React.FC<{
  tokens: Token[];
  charsToShow: number;
  borderColor: string;
  glow: string;
  header: string;
  caption?: string;
}> = ({ tokens, charsToShow, borderColor, glow, header, caption }) => {
  const visible = sliceTokens(tokens, charsToShow);
  return (
    <div style={{
      backgroundColor: 'rgba(13, 18, 28, 0.96)',
      border: `3px solid ${borderColor}`,
      borderRadius: 16,
      padding: '20px 24px 28px',
      boxShadow: `0 0 40px ${glow}, 0 12px 40px rgba(0,0,0,0.5)`,
      width: '100%',
      maxWidth: 900,
      margin: '0 auto',
    }}>
      <div style={{
        fontSize: 30, fontFamily: FONTS.heading, fontWeight: 900,
        color: borderColor, letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 6,
        textShadow: `0 0 16px ${glow}`,
      }}>
        {header}
      </div>
      {caption && (
        <div style={{
          fontSize: 18, fontFamily: FONTS.text, fontWeight: 600,
          color: '#94A3B8', marginBottom: 16, letterSpacing: 1,
          textTransform: 'uppercase',
        }}>
          {caption}
        </div>
      )}
      <pre style={{
        margin: 0,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 26,
        lineHeight: 1.45,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {visible.map((tok, i) => (
          <span key={i} style={{ color: COLORS[tok.kind], fontWeight: tok.kind === 'keyword' ? 700 : 500 }}>
            {tok.text}
          </span>
        ))}
      </pre>
    </div>
  );
};

export const CodeSnippetPanel: React.FC<Props> = ({ snippet, startFrame, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Hooks MUST run unconditionally — pre-compute before any early return.
  const wrongTokens = useMemo(() => tokenize(snippet.wrong, snippet.language), [snippet.wrong, snippet.language]);
  const rightTokens = useMemo(() => tokenize(snippet.right, snippet.language), [snippet.right, snippet.language]);

  const age = frame - startFrame;

  // Sub-phases relative to startFrame (480 frames @ 30fps = 16s default).
  // Phase boundaries are proportional in case duration changes.
  const wrongEnd = Math.round(durationFrames * (6 / 16));   // ~180 frames
  const transEnd = Math.round(durationFrames * (10 / 16));  // ~300 frames

  // Entry/exit springs for slide animation
  const enterSpring = spring({
    frame: Math.max(0, age),
    fps,
    config: { stiffness: 180, damping: 18, mass: 0.6 },
  });

  if (age < 0 || age >= durationFrames) return null;

  const typewriterCharsFor = (typingFrames: number, totalChars: number) => {
    // ~25 chars/sec = 25 / 30 frames-per-sec ≈ 0.83 chars/frame
    return Math.min(totalChars, Math.round((typingFrames / fps) * 25));
  };

  if (age < wrongEnd) {
    // WRONG phase: typewriter wrong code
    const typingFrames = age;
    const chars = typewriterCharsFor(typingFrames, snippet.wrong.length);
    const slide = interpolate(enterSpring, [0, 1], [80, 0]);
    return (
      <div style={{
        position: 'absolute',
        top: 360,
        left: 60,
        right: 60,
        zIndex: 25,
        transform: `translateY(${slide}px)`,
        opacity: interpolate(enterSpring, [0, 1], [0, 1]),
      }}>
        <CodeBlock
          tokens={wrongTokens}
          charsToShow={chars}
          borderColor="#FF4444"
          glow="rgba(255, 68, 68, 0.35)"
          header="X  DON'T DO THIS"
          caption={snippet.caption}
        />
      </div>
    );
  }

  if (age < transEnd) {
    // Transition: wrong slides up/out, right slides in
    const transAge = age - wrongEnd;
    const transDur = transEnd - wrongEnd;
    const t = transAge / transDur;
    const wrongOff = interpolate(t, [0, 1], [0, -120]);
    const wrongOp = interpolate(t, [0, 0.4], [1, 0], { extrapolateRight: 'clamp' });
    const rightOff = interpolate(t, [0, 1], [120, 0]);
    const rightOp = interpolate(t, [0.4, 1], [0, 1], { extrapolateLeft: 'clamp' });
    return (
      <>
        <div style={{
          position: 'absolute', top: 360, left: 60, right: 60, zIndex: 25,
          transform: `translateY(${wrongOff}px)`, opacity: wrongOp,
        }}>
          <CodeBlock
            tokens={wrongTokens}
            charsToShow={snippet.wrong.length}
            borderColor="#FF4444"
            glow="rgba(255, 68, 68, 0.35)"
            header="X  DON'T DO THIS"
            caption={snippet.caption}
          />
        </div>
        <div style={{
          position: 'absolute', top: 360, left: 60, right: 60, zIndex: 25,
          transform: `translateY(${rightOff}px)`, opacity: rightOp,
        }}>
          <CodeBlock
            tokens={rightTokens}
            charsToShow={0}
            borderColor="#10B981"
            glow="rgba(16, 185, 129, 0.35)"
            header="OK  DO THIS"
            caption={snippet.caption}
          />
        </div>
      </>
    );
  }

  // RIGHT phase: typewriter right code
  const rightAge = age - transEnd;
  const chars = typewriterCharsFor(rightAge, snippet.right.length);
  return (
    <div style={{
      position: 'absolute', top: 360, left: 60, right: 60, zIndex: 25,
    }}>
      <CodeBlock
        tokens={rightTokens}
        charsToShow={chars}
        borderColor="#10B981"
        glow="rgba(16, 185, 129, 0.35)"
        header="OK  DO THIS"
        caption={snippet.caption}
      />
    </div>
  );
};

export default CodeSnippetPanel;
