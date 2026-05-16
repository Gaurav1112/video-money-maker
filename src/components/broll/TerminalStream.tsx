/**
 * TerminalStream.tsx
 *
 * Fake terminal output streaming with deterministic timing.
 * Simulates kubectl, curl, docker, or custom command output.
 * Each output line appears at a fixed frame offset.
 *
 * Usage:
 *   <TerminalStream
 *     seed={5}
 *     command="kubectl get pods -n production"
 *     lines={[
 *       { text: 'NAME                     READY   STATUS    RESTARTS', type: 'header' },
 *       { text: 'api-server-7d9f-xk2p8    1/1     Running   0', type: 'success' },
 *       { text: 'worker-6b8c-m3nt9        0/1     Error     3', type: 'error' },
 *     ]}
 *     startFrame={0}
 *     framesPerLine={18}
 *   />
 */
import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { createNoise } from './seeded-noise';

type LineType = 'plain' | 'success' | 'error' | 'warning' | 'header' | 'dim';

interface TerminalLine {
  text: string;
  type?: LineType;
  /** If true, line types character-by-character instead of appearing instantly */
  typewriter?: boolean;
}

interface TerminalStreamProps {
  seed: number;
  command?: string;
  lines: TerminalLine[];
  startFrame?: number;
  /** Frames between each line appearing. Default: 18 (0.6s) */
  framesPerLine?: number;
  /** Typewriter chars/frame for lines with typewriter:true. Default: 8 */
  charsPerFrame?: number;
  title?: string;
  showPrompt?: boolean;
  fontSize?: number;
}

const LINE_COLORS: Record<LineType, string> = {
  plain: '#CBD5E1',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F97316',
  header: '#38BDF8',
  dim: '#475569',
};

export const TerminalStream: React.FC<TerminalStreamProps> = ({
  seed,
  command,
  lines,
  startFrame = 0,
  framesPerLine = 18,
  charsPerFrame = 8,
  title = 'bash',
  showPrompt = true,
  fontSize = 24,
}) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const n = createNoise(seed);

  // How many lines are visible?
  const commandDone = framesPerLine; // command appears first
  const linesVisible = Math.min(
    Math.floor(Math.max(0, elapsed - commandDone) / framesPerLine),
    lines.length,
  );

  // Cursor blink
  const cursorOn = Math.floor(frame / 15) % 2 === 0;

  // Command character reveal
  const cmdChars = command
    ? Math.min(command.length, Math.floor(elapsed * charsPerFrame))
    : 0;
  const cmdText = command ? command.slice(0, cmdChars) : '';

  return (
    <div
      style={{
        background: '#0D0D0D',
        borderRadius: 12,
        overflow: 'hidden',
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize,
        boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
        border: '1px solid #1E293B',
      }}
    >
      {/* Title bar */}
      <div
        style={{
          background: '#1E293B',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          {['#EF4444', '#F97316', '#22C55E'].map((c, i) => (
            <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
          ))}
        </div>
        <span style={{ color: '#64748B', fontSize: fontSize * 0.8 }}>{title}</span>
      </div>

      {/* Content */}
      <div style={{ padding: '16px 20px', lineHeight: 1.7, overflowY: 'hidden' }}>
        {/* Command line */}
        {command && (
          <div style={{ color: '#22C55E', display: 'flex', gap: 8 }}>
            {showPrompt && (
              <span style={{ color: '#38BDF8', userSelect: 'none' }}>❯</span>
            )}
            <span>{cmdText}</span>
            {elapsed < commandDone && cursorOn && (
              <span style={{ color: '#F97316' }}>▌</span>
            )}
          </div>
        )}

        {/* Output lines */}
        {lines.slice(0, linesVisible).map((line, i) => {
          const lineFrame = commandDone + i * framesPerLine;
          const lineElapsed = Math.max(0, elapsed - lineFrame);

          let displayText = line.text;
          if (line.typewriter) {
            const chars = Math.min(line.text.length, Math.floor(lineElapsed * charsPerFrame));
            displayText = line.text.slice(0, chars);
          }

          const opacity = interpolate(lineElapsed, [0, 6], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const slideX = interpolate(lineElapsed, [0, 8], [-16, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          return (
            <div
              key={i}
              style={{
                color: LINE_COLORS[line.type ?? 'plain'],
                opacity,
                transform: `translateX(${slideX}px)`,
              }}
            >
              {displayText}
              {line.typewriter &&
                lineElapsed > 0 &&
                displayText.length < line.text.length &&
                cursorOn && (
                  <span style={{ color: '#F97316' }}>▌</span>
                )}
            </div>
          );
        })}

        {/* Blinking cursor after last line */}
        {linesVisible >= lines.length && cursorOn && (
          <div style={{ color: '#22C55E', display: 'flex', gap: 8 }}>
            {showPrompt && (
              <span style={{ color: '#38BDF8', userSelect: 'none' }}>❯</span>
            )}
            <span style={{ color: '#F97316' }}>▌</span>
          </div>
        )}
      </div>
    </div>
  );
};
