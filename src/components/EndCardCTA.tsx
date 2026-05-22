// src/components/EndCardCTA.tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { FONTS } from '../lib/theme';

interface Props {
  endQuestion: string;
  startFrame: number;
  durationFrames: number;
}

// ── Debate framing detector ──
// If the prompt contains " or " (case-insensitive) BEFORE any question mark,
// split it into a binary VS layout. Examples that match:
//   "Are you acks=all or acks=1?"           → left "Are you acks=all", right "acks=1"
//   "kafka or rabbitmq for events?"         → left "kafka", right "rabbitmq for events"
// Examples that do NOT match (flat CTA):
//   "Did you know about auto-commit? Comment YES or NO."   (or appears AFTER ?)
function parseDebate(text: string): { left: string; right: string } | null {
  const qIdx = text.indexOf('?');
  const searchSlice = qIdx >= 0 ? text.slice(0, qIdx) : text;
  const m = searchSlice.match(/^(.+?)\s+or\s+(.+?)(?:\?|\.|$)/i);
  if (!m) return null;
  const left = m[1].trim();
  const right = m[2]
    .trim()
    .replace(/[?.!]+$/, '')
    .trim();
  if (!left || !right) return null;
  return { left, right };
}

export const EndCardCTA: React.FC<Props> = ({ endQuestion, startFrame, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const age = frame - startFrame;
  if (age < 0 || age > durationFrames) return null;
  const s = spring({ frame: age, fps, config: { stiffness: 200, damping: 14, mass: 0.5 } });
  const containerOpacity = interpolate(s, [0, 1], [0, 1]);
  const containerY = interpolate(s, [0, 1], [40, 0]);

  const debate = parseDebate(endQuestion);

  if (debate) {
    // VS layout: two stacked pills + "VS" + "👇 Pick a side"
    return (
      <div
        style={{
          position: 'absolute',
          bottom: 140,
          left: 60,
          right: 60,
          zIndex: 70,
          textAlign: 'center',
          opacity: containerOpacity,
          transform: `translateY(${containerY}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {/* Left option pill */}
        <div
          style={{
            backgroundColor: 'rgba(34, 211, 238, 0.18)',
            border: '2px solid #22D3EE',
            borderRadius: 28,
            padding: '12px 28px',
            fontSize: 30,
            fontFamily: FONTS.heading,
            fontWeight: 800,
            color: '#fff',
            maxWidth: '85%',
            boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {debate.left}
        </div>
        {/* VS badge */}
        <div
          style={{
            fontSize: 28,
            fontFamily: FONTS.heading,
            fontWeight: 900,
            color: '#FBBF24',
            letterSpacing: 2,
            textShadow: '0 0 14px rgba(251, 191, 36, 0.6)',
          }}
        >
          VS
        </div>
        {/* Right option pill */}
        <div
          style={{
            backgroundColor: 'rgba(255, 68, 68, 0.2)',
            border: '2px solid #FF4444',
            borderRadius: 28,
            padding: '12px 28px',
            fontSize: 30,
            fontFamily: FONTS.heading,
            fontWeight: 800,
            color: '#fff',
            maxWidth: '85%',
            boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {debate.right}
        </div>
        {/* Pick a side CTA */}
        <div
          style={{
            marginTop: 8,
            fontSize: 26,
            fontFamily: FONTS.heading,
            fontWeight: 700,
            color: '#fff',
            letterSpacing: 1,
            textShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          👇 Pick a side
        </div>
        {/* v3.1: third brand touchpoint — URL anchored under the CTA */}
        <div
          style={{
            fontSize: 22,
            color: '#FBBF24',
            marginTop: 8,
            letterSpacing: 1.5,
            fontFamily: FONTS.heading,
            fontWeight: 700,
            textShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          🌐 www.guru-sishya.in
        </div>
      </div>
    );
  }

  // Fallback: original single-pill CTA
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 180,
        left: 60,
        right: 60,
        zIndex: 70,
        textAlign: 'center',
        opacity: containerOpacity,
        transform: `translateY(${containerY}px)`,
      }}
    >
      <div
        style={{
          display: 'inline-block',
          backgroundColor: 'rgba(255, 68, 68, 0.18)',
          border: '2px solid #FF4444',
          borderRadius: 32,
          padding: '14px 32px',
          fontSize: 32,
          fontFamily: FONTS.heading,
          fontWeight: 700,
          color: '#fff',
          boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
        }}
      >
        💬 {endQuestion}
      </div>
      {/* v3.1: third brand touchpoint — URL anchored under the CTA */}
      <div
        style={{
          fontSize: 22,
          color: '#FBBF24',
          marginTop: 8,
          letterSpacing: 1.5,
          fontFamily: FONTS.heading,
          fontWeight: 700,
          textShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}
      >
        🌐 www.guru-sishya.in
      </div>
    </div>
  );
};

export default EndCardCTA;
