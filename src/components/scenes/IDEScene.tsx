import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate, useVideoConfig, spring } from 'remotion';
import type { AnimationCue } from '../../types';

interface IDESceneProps {
  code: string;
  language: string;
  filename: string;
  terminal?: string;
  highlightLines?: number[];
  startFrame?: number;
  sceneIndex?: number;
  sceneStartFrame?: number;
  animationCues?: AnimationCue[];
  sceneDurationFrames?: number;
}

// ---------------------------------------------------------------------------
// Minimal syntax highlighting — keywords, strings, comments, numbers
// ---------------------------------------------------------------------------
type TokenType = 'keyword' | 'string' | 'comment' | 'number' | 'function' | 'normal';

const TOKEN_COLORS: Record<TokenType, string> = {
  keyword: '#60A5FA',   // blue
  string: '#4ADE80',    // green
  comment: '#6B7280',   // gray
  number: '#FDE68A',    // yellow
  function: '#C084FC',  // purple
  normal: '#E5E7EB',    // white-ish
};

const KEYWORDS: Record<string, Set<string>> = {
  python: new Set([
    'def', 'class', 'import', 'from', 'return', 'if', 'else', 'elif',
    'for', 'while', 'in', 'not', 'and', 'or', 'True', 'False', 'None',
    'try', 'except', 'finally', 'with', 'as', 'yield', 'lambda', 'pass',
    'raise', 'async', 'await', 'self', 'print', 'break', 'continue',
  ]),
  typescript: new Set([
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for',
    'while', 'class', 'interface', 'type', 'import', 'export', 'from',
    'async', 'await', 'new', 'this', 'true', 'false', 'null', 'undefined',
    'try', 'catch', 'finally', 'throw', 'switch', 'case', 'break', 'default',
    'extends', 'implements', 'static', 'private', 'public', 'protected',
  ]),
  javascript: new Set([
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for',
    'while', 'class', 'import', 'export', 'from', 'async', 'await',
    'new', 'this', 'true', 'false', 'null', 'undefined',
    'try', 'catch', 'finally', 'throw', 'switch', 'case', 'break',
  ]),
  java: new Set([
    'public', 'private', 'protected', 'static', 'void', 'class', 'interface',
    'extends', 'implements', 'new', 'return', 'if', 'else', 'for', 'while',
    'import', 'package', 'try', 'catch', 'finally', 'throw', 'throws',
    'this', 'super', 'true', 'false', 'null', 'final', 'abstract',
  ]),
  go: new Set([
    'func', 'package', 'import', 'var', 'const', 'type', 'struct', 'interface',
    'return', 'if', 'else', 'for', 'range', 'switch', 'case', 'default',
    'go', 'chan', 'select', 'defer', 'map', 'make', 'nil', 'true', 'false',
  ]),
};

function tokenizeLine(line: string, language: string): Array<{ text: string; type: TokenType }> {
  const tokens: Array<{ text: string; type: TokenType }> = [];
  const kwSet = KEYWORDS[language] || KEYWORDS.typescript;

  // Check for line comments
  const commentPrefixes = ['#', '//'];
  for (const prefix of commentPrefixes) {
    const commentIdx = line.indexOf(prefix);
    if (commentIdx >= 0) {
      // Check it's not inside a string (simple heuristic)
      const before = line.slice(0, commentIdx);
      const singleQuotes = (before.match(/'/g) || []).length;
      const doubleQuotes = (before.match(/"/g) || []).length;
      if (singleQuotes % 2 === 0 && doubleQuotes % 2 === 0) {
        if (commentIdx > 0) {
          tokens.push(...tokenizeLine(line.slice(0, commentIdx), language));
        }
        tokens.push({ text: line.slice(commentIdx), type: 'comment' });
        return tokens;
      }
    }
  }

  // Tokenize by words and strings
  const regex = /("[^"]*"|'[^']*'|`[^`]*`|\b\w+\b|\S)/g;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(line)) !== null) {
    // Add any whitespace/gap before this match
    if (match.index > lastIndex) {
      tokens.push({ text: line.slice(lastIndex, match.index), type: 'normal' });
    }

    const word = match[0];

    if (/^["'`]/.test(word)) {
      tokens.push({ text: word, type: 'string' });
    } else if (/^\d+(\.\d+)?$/.test(word)) {
      tokens.push({ text: word, type: 'number' });
    } else if (kwSet.has(word)) {
      tokens.push({ text: word, type: 'keyword' });
    } else if (/^[A-Z_]+$/.test(word) && word.length > 1) {
      // CONSTANT_CASE
      tokens.push({ text: word, type: 'number' });
    } else {
      // Check if next non-space char is '(' — function call
      const afterWord = line.slice(match.index + word.length);
      if (/^\s*\(/.test(afterWord)) {
        tokens.push({ text: word, type: 'function' });
      } else {
        tokens.push({ text: word, type: 'normal' });
      }
    }

    lastIndex = match.index + word.length;
  }

  // Remaining text
  if (lastIndex < line.length) {
    tokens.push({ text: line.slice(lastIndex), type: 'normal' });
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Language icon color mapping
// ---------------------------------------------------------------------------
function getLanguageColor(lang: string): string {
  const map: Record<string, string> = {
    python: '#3776AB',
    typescript: '#3178C6',
    javascript: '#F7DF1E',
    java: '#ED8B00',
    go: '#00ADD8',
    rust: '#CE422B',
    ruby: '#CC342D',
    cpp: '#00599C',
    c: '#A8B9CC',
    sql: '#336791',
    bash: '#4EAA25',
    yaml: '#CB171E',
    json: '#000000',
    dockerfile: '#2496ED',
  };
  return map[lang.toLowerCase()] || '#60A5FA';
}

// ---------------------------------------------------------------------------
// File icon
// ---------------------------------------------------------------------------
function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

/**
 * VS Code-like IDE with sidebar, tab bar, editor, and optional terminal.
 */
export const IDEScene: React.FC<IDESceneProps> = ({
  code,
  language,
  filename,
  terminal,
  highlightLines = [],
  startFrame = 0,
  sceneDurationFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lines = code.split('\n');
  const langColor = getLanguageColor(language);

  // Window entrance
  const entrance = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 80, mass: 1 },
  });
  const windowScale = interpolate(entrance, [0, 1], [0.92, 1]);
  const windowOpacity = interpolate(entrance, [0, 1], [0, 1]);

  // Line reveal: distribute lines across ~70% of scene duration
  const totalLines = lines.length;
  const revealDuration = sceneDurationFrames
    ? Math.round(sceneDurationFrames * 0.7)
    : totalLines * 4; // fallback: ~4 frames per line
  const framesPerLine = Math.max(2, Math.floor(revealDuration / Math.max(1, totalLines)));

  // Highlight set for fast lookup
  const highlightSet = new Set(highlightLines);

  // Sidebar file list (decorative)
  const sidebarFiles = [
    filename,
    'config.ts',
    'utils.ts',
    'index.ts',
  ];

  const hasTerminal = !!terminal;
  const editorHeightPercent = hasTerminal ? '75%' : '100%';
  const terminalHeightPercent = '25%';

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0D0D1A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          maxWidth: 1600,
          maxHeight: 920,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 25px 80px rgba(0,0,0,0.6)',
          transform: `scale(${windowScale})`,
          opacity: windowOpacity,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Title bar */}
        <div
          style={{
            backgroundColor: '#1E1E2E',
            height: 36,
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            gap: 8,
            flexShrink: 0,
            borderBottom: '1px solid #2D2D3F',
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#FF5F57' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#FFBD2E' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#28CA41' }} />
          <div
            style={{
              flex: 1,
              textAlign: 'center',
              color: '#8B8BA7',
              fontSize: 12,
              fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 500,
            }}
          >
            {filename} — Visual Studio Code
          </div>
          <div style={{ width: 52 }} />
        </div>

        {/* Main area: sidebar + editor + terminal */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Sidebar */}
          <div
            style={{
              width: 48,
              backgroundColor: '#181825',
              borderRight: '1px solid #2D2D3F',
              display: 'flex',
              flexDirection: 'column',
              padding: '12px 0',
              gap: 4,
              flexShrink: 0,
            }}
          >
            {/* Activity bar icons (simplified rectangles) */}
            {['📄', '🔍', '🔀', '🐛'].map((icon, i) => (
              <div
                key={i}
                style={{
                  width: 48,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  opacity: i === 0 ? 1 : 0.4,
                  borderLeft: i === 0 ? '2px solid #60A5FA' : '2px solid transparent',
                }}
              >
                {icon}
              </div>
            ))}
          </div>

          {/* File explorer + editor column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Tab bar */}
            <div
              style={{
                height: 36,
                backgroundColor: '#1E1E2E',
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid #2D2D3F',
                flexShrink: 0,
              }}
            >
              {/* Active tab */}
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0 14px',
                  backgroundColor: '#282840',
                  borderBottom: `2px solid ${langColor}`,
                  borderRight: '1px solid #2D2D3F',
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    backgroundColor: langColor,
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    color: '#E5E7EB',
                    fontFamily: "'Inter', system-ui, sans-serif",
                  }}
                >
                  {filename}
                </span>
                <span style={{ fontSize: 14, color: '#6B7280', marginLeft: 4 }}>×</span>
              </div>
            </div>

            {/* Editor + terminal */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Editor area */}
              <div
                style={{
                  height: editorHeightPercent,
                  backgroundColor: '#1E1E2E',
                  display: 'flex',
                  overflow: 'hidden',
                }}
              >
                {/* Code with line numbers */}
                <div
                  style={{
                    flex: 1,
                    padding: '16px 0',
                    overflow: 'hidden',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 18,
                    lineHeight: 1.65,
                  }}
                >
                  {lines.map((line, lineIdx) => {
                    const lineNum = lineIdx + 1;
                    const isHighlighted = highlightSet.has(lineNum);

                    // Line reveal animation
                    const lineRevealFrame = lineIdx * framesPerLine;
                    const lineVisible = frame >= lineRevealFrame;
                    const lineOpacity = lineVisible
                      ? interpolate(
                          frame,
                          [lineRevealFrame, lineRevealFrame + 8],
                          [0, 1],
                          { extrapolateRight: 'clamp' },
                        )
                      : 0;

                    // Current line indicator (yellow left border)
                    const isCurrentLine =
                      frame >= lineRevealFrame &&
                      (lineIdx === totalLines - 1 || frame < (lineIdx + 1) * framesPerLine + 8);

                    const tokens = tokenizeLine(line, language);

                    return (
                      <div
                        key={lineIdx}
                        style={{
                          display: 'flex',
                          opacity: lineOpacity,
                          backgroundColor: isHighlighted
                            ? 'rgba(253, 230, 138, 0.06)'
                            : isCurrentLine
                              ? 'rgba(255, 255, 255, 0.03)'
                              : 'transparent',
                          borderLeft: isCurrentLine
                            ? '3px solid #FDE68A'
                            : isHighlighted
                              ? '3px solid rgba(253, 230, 138, 0.3)'
                              : '3px solid transparent',
                          paddingRight: 16,
                          minHeight: 30,
                        }}
                      >
                        {/* Line number */}
                        <span
                          style={{
                            display: 'inline-block',
                            width: 52,
                            textAlign: 'right',
                            paddingRight: 16,
                            color: isCurrentLine ? '#E5E7EB' : '#4B5563',
                            userSelect: 'none',
                            flexShrink: 0,
                          }}
                        >
                          {lineNum}
                        </span>
                        {/* Code tokens */}
                        <span style={{ whiteSpace: 'pre' }}>
                          {tokens.map((token, tIdx) => (
                            <span key={tIdx} style={{ color: TOKEN_COLORS[token.type] }}>
                              {token.text}
                            </span>
                          ))}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Minimap */}
                <div
                  style={{
                    width: 48,
                    backgroundColor: '#181825',
                    borderLeft: '1px solid #2D2D3F',
                    padding: '8px 4px',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {lines.map((line, i) => {
                    const lineOpacity = frame >= i * framesPerLine ? 0.5 : 0.1;
                    const trimmed = line.trim();
                    const indent = line.length - line.trimStart().length;
                    return (
                      <div
                        key={i}
                        style={{
                          height: 3,
                          marginBottom: 1,
                          marginLeft: Math.min(indent * 2, 16),
                          width: Math.min(trimmed.length * 0.8, 36),
                          backgroundColor: highlightSet.has(i + 1) ? '#FDE68A' : '#60A5FA',
                          opacity: lineOpacity,
                          borderRadius: 1,
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Terminal panel */}
              {hasTerminal && (
                <div
                  style={{
                    height: terminalHeightPercent,
                    backgroundColor: '#0D0D1A',
                    borderTop: '1px solid #2D2D3F',
                    display: 'flex',
                    flexDirection: 'column',
                    flexShrink: 0,
                  }}
                >
                  {/* Terminal tab bar */}
                  <div
                    style={{
                      height: 28,
                      backgroundColor: '#181825',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 12px',
                      gap: 12,
                      borderBottom: '1px solid #2D2D3F',
                    }}
                  >
                    <span style={{ fontSize: 11, color: '#6B7280', fontFamily: "'Inter', system-ui, sans-serif" }}>
                      TERMINAL
                    </span>
                    <span style={{ fontSize: 11, color: '#4B5563', fontFamily: "'Inter', system-ui, sans-serif" }}>
                      OUTPUT
                    </span>
                    <span style={{ fontSize: 11, color: '#4B5563', fontFamily: "'Inter', system-ui, sans-serif" }}>
                      PROBLEMS
                    </span>
                  </div>
                  {/* Terminal content */}
                  <div
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 15,
                      color: '#E5E7EB',
                      whiteSpace: 'pre-wrap',
                      overflow: 'hidden',
                      lineHeight: 1.5,
                    }}
                  >
                    {/* Reveal terminal output after code is mostly shown */}
                    {(() => {
                      const terminalStart = Math.min(revealDuration, totalLines * framesPerLine);
                      const terminalOpacity = interpolate(
                        frame,
                        [terminalStart, terminalStart + 15],
                        [0, 1],
                        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                      );
                      return (
                        <span style={{ opacity: terminalOpacity }}>
                          <span style={{ color: '#6B7280' }}>$ </span>
                          <span style={{ color: '#4ADE80' }}>{terminal}</span>
                        </span>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default IDEScene;
