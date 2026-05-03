/**
 * LiveLog.tsx
 *
 * Fake live log streaming — request/response pairs appearing in sequence.
 * Simulates API gateway logs, Kafka consumer logs, DB query logs.
 *
 * Usage:
 *   <LiveLog
 *     seed={33}
 *     entries={[
 *       { method: 'GET', path: '/api/users/42', status: 200, ms: 12 },
 *       { method: 'POST', path: '/api/order', status: 201, ms: 45 },
 *       { method: 'GET', path: '/api/product/999', status: 404, ms: 3 },
 *     ]}
 *     framesPerEntry={20}
 *   />
 */
import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { createNoise } from './seeded-noise';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';

interface LogEntry {
  method: HttpMethod;
  path: string;
  status: number;
  ms?: number;
  source?: string;
  message?: string;
}

interface LiveLogProps {
  seed: number;
  entries: LogEntry[];
  /** Frames between each entry. Default: 20 */
  framesPerEntry?: number;
  startFrame?: number;
  title?: string;
  /** Max visible rows (scrolls older ones off). Default: 12 */
  maxVisible?: number;
  fontSize?: number;
}

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: '#22C55E',
  POST: '#38BDF8',
  PUT: '#F97316',
  DELETE: '#EF4444',
  PATCH: '#A78BFA',
  HEAD: '#64748B',
};

function statusColor(s: number): string {
  if (s >= 500) return '#EF4444';
  if (s >= 400) return '#F97316';
  if (s >= 300) return '#A78BFA';
  if (s >= 200) return '#22C55E';
  return '#64748B';
}

function fakeTimestamp(seed: number, index: number): string {
  // Deterministic fake timestamp
  const baseHour = 14;
  const baseMin = (seed * 7 + index * 3) % 60;
  const baseSec = (seed * 13 + index * 7) % 60;
  const ms = (seed * 17 + index * 11) % 1000;
  return `${baseHour}:${String(baseMin).padStart(2, '0')}:${String(baseSec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export const LiveLog: React.FC<LiveLogProps> = ({
  seed,
  entries,
  framesPerEntry = 20,
  startFrame = 0,
  title = 'access.log — live',
  maxVisible = 12,
  fontSize = 20,
}) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const n = createNoise(seed);

  const visibleCount = Math.min(
    Math.floor(elapsed / framesPerEntry) + 1,
    entries.length,
  );

  // Scroll: show only last maxVisible entries
  const startIdx = Math.max(0, visibleCount - maxVisible);
  const visibleEntries = entries.slice(startIdx, visibleCount);

  const cursorBlink = Math.floor(frame / 12) % 2 === 0;

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
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['#EF4444', '#F97316', '#22C55E'].map((c, i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
            ))}
          </div>
          <span style={{ color: '#64748B', fontSize: fontSize * 0.85 }}>{title}</span>
        </div>
        {/* Live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#EF4444',
              opacity: cursorBlink ? 1 : 0.3,
            }}
          />
          <span style={{ color: '#EF4444', fontSize: fontSize * 0.8, fontWeight: 700 }}>LIVE</span>
        </div>
      </div>

      {/* Log entries */}
      <div style={{ padding: '12px 16px', lineHeight: 1.8, minHeight: 100 }}>
        {visibleEntries.map((entry, i) => {
          const globalIdx = startIdx + i;
          const entryFrame = globalIdx * framesPerEntry;
          const entryElapsed = Math.max(0, elapsed - entryFrame);
          const opacity = interpolate(entryElapsed, [0, 8], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const slideX = interpolate(entryElapsed, [0, 10], [-12, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          const isHighLatency = (entry.ms ?? 0) > 200;
          const ts = fakeTimestamp(seed, globalIdx);

          return (
            <div
              key={globalIdx}
              style={{
                display: 'flex',
                gap: 12,
                opacity,
                transform: `translateX(${slideX}px)`,
                alignItems: 'baseline',
                background: isHighLatency ? '#EF444410' : 'transparent',
                borderRadius: 4,
                padding: '1px 4px',
              }}
            >
              {/* Timestamp */}
              <span style={{ color: '#475569', minWidth: fontSize * 5.5 }}>{ts}</span>

              {/* Method badge */}
              <span
                style={{
                  color: METHOD_COLORS[entry.method] ?? '#64748B',
                  fontWeight: 700,
                  minWidth: fontSize * 3,
                }}
              >
                {entry.method}
              </span>

              {/* Path */}
              <span style={{ color: '#CBD5E1', flex: 1 }}>{entry.path}</span>

              {/* Status */}
              <span style={{ color: statusColor(entry.status), fontWeight: 700, minWidth: 36 }}>
                {entry.status}
              </span>

              {/* Latency */}
              {entry.ms !== undefined && (
                <span style={{ color: isHighLatency ? '#F97316' : '#64748B', minWidth: fontSize * 3 }}>
                  {entry.ms}ms
                </span>
              )}

              {/* Message */}
              {entry.message && (
                <span style={{ color: '#64748B', fontStyle: 'italic' }}>{entry.message}</span>
              )}
            </div>
          );
        })}

        {/* Blinking cursor */}
        {cursorBlink && (
          <div style={{ color: '#22C55E', display: 'flex', gap: 8 }}>
            <span style={{ color: '#38BDF8' }}>❯</span>
            <span style={{ color: '#F97316' }}>▌</span>
          </div>
        )}
      </div>
    </div>
  );
};
