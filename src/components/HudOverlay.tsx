import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';

interface HudOverlayProps {
  topic: string;
  sessionNumber: number;
  totalFrames: number;
}

/**
 * Persistent Jarvis/Iron Man HUD overlay.
 * Renders subtle sci-fi elements at frame edges without blocking center content.
 * All animations are deterministic (no Math.random).
 */
export const HudOverlay: React.FC<HudOverlayProps> = ({
  topic,
  sessionNumber,
  totalFrames,
}) => {
  const frame = useCurrentFrame();

  const TEAL = '#1DD1A1';
  const SAFFRON = '#E85D26';
  const GOLD = '#FDB813';

  // --- Corner Brackets ---
  const bracketLength = 40;
  const bracketWidth = 1;
  const bracketColor = SAFFRON;
  const bracketOpacity = 0.25;
  const bracketOffset = 16; // distance from edge

  const cornerStyle = (
    top: boolean,
    left: boolean,
  ): React.CSSProperties => ({
    position: 'absolute',
    top: top ? bracketOffset : undefined,
    bottom: !top ? bracketOffset : undefined,
    left: left ? bracketOffset : undefined,
    right: !left ? bracketOffset : undefined,
    width: bracketLength,
    height: bracketLength,
    borderColor: bracketColor,
    borderStyle: 'solid',
    borderWidth: 0,
    borderTopWidth: top ? bracketWidth : 0,
    borderBottomWidth: !top ? bracketWidth : 0,
    borderLeftWidth: left ? bracketWidth : 0,
    borderRightWidth: !left ? bracketWidth : 0,
    opacity: bracketOpacity,
    pointerEvents: 'none' as const,
  });

  // --- Scanline for top-left data panel (sweeps every 5s = 150 frames at 30fps) ---
  const scanlineCycle = 150; // 5 seconds at 30fps
  const scanlineProgress = (frame % scanlineCycle) / scanlineCycle;
  const scanlineX = interpolate(scanlineProgress, [0, 1], [-100, 200]);

  // --- Animated full-frame scan line (sweeps top to bottom every 8s = 240 frames) ---
  const fullScanCycle = 240;
  const fullScanProgress = (frame % fullScanCycle) / fullScanCycle;
  const fullScanY = interpolate(fullScanProgress, [0, 1], [-2, 102]);

  // --- Status indicator blink (REC blinks every 1s = 30 frames) ---
  const recBlink = Math.floor(frame / 15) % 2 === 0; // toggle every 0.5s
  const audioPulseOpacity = interpolate(
    frame % 60,
    [0, 30, 60],
    [0.6, 1.0, 0.6],
  );

  // --- Circular progress ring ---
  const progress = Math.min(frame / Math.max(totalFrames, 1), 1);
  const ringRadius = 16;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - progress);

  const sessionLabel = `S${String(sessionNumber).padStart(2, '0')}`;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 50 }}>
      {/* Corner brackets */}
      <div style={cornerStyle(true, true)} />
      <div style={cornerStyle(true, false)} />
      <div style={cornerStyle(false, true)} />
      <div style={cornerStyle(false, false)} />

      {/* Top and bottom border lines */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: TEAL,
          opacity: 0.15,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          background: TEAL,
          opacity: 0.15,
        }}
      />

      {/* Full-frame animated scan line */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${fullScanY}%`,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${TEAL}, transparent)`,
          opacity: 0.05,
        }}
      />

      {/* Top-left data panel */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          padding: '8px 14px',
          background: 'rgba(12, 10, 21, 0.4)',
          borderLeft: `2px solid ${TEAL}`,
          borderRadius: '0 4px 4px 0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {/* Topic name */}
        <div
          style={{
            fontSize: 14,
            fontFamily: "'Inter', monospace, sans-serif",
            fontWeight: 600,
            color: TEAL,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.08em',
            opacity: 0.8,
          }}
        >
          {topic.replace(/-/g, ' ')}
        </div>
        {/* Session badge */}
        <div
          style={{
            fontSize: 12,
            fontFamily: "'Inter', monospace, sans-serif",
            fontWeight: 700,
            color: GOLD,
            opacity: 0.7,
          }}
        >
          {sessionLabel}
        </div>
        {/* Scanline sweep */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${scanlineX}%`,
            width: 40,
            background: `linear-gradient(90deg, transparent, rgba(29, 209, 161, 0.15), transparent)`,
            pointerEvents: 'none' as const,
          }}
        />
      </div>

      {/* Bottom-right status indicators */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          alignItems: 'flex-end',
        }}
      >
        {/* AUDIO — green, pulsing */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontFamily: "'Inter', monospace, sans-serif",
              fontWeight: 600,
              color: '#4ade80',
              opacity: 0.6,
              letterSpacing: '0.05em',
            }}
          >
            AUDIO
          </span>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#4ade80',
              opacity: audioPulseOpacity * 0.5,
            }}
          />
        </div>
        {/* SYNC — green, steady */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontFamily: "'Inter', monospace, sans-serif",
              fontWeight: 600,
              color: '#4ade80',
              opacity: 0.6,
              letterSpacing: '0.05em',
            }}
          >
            SYNC
          </span>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#4ade80',
              opacity: 0.5,
            }}
          />
        </div>
        {/* REC — red, blinking */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontFamily: "'Inter', monospace, sans-serif",
              fontWeight: 600,
              color: '#ef4444',
              opacity: recBlink ? 0.7 : 0.2,
              letterSpacing: '0.05em',
            }}
          >
            REC
          </span>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#ef4444',
              opacity: recBlink ? 0.6 : 0.15,
            }}
          />
        </div>
      </div>

      {/* Circular progress indicator — top-right */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          width: 40,
          height: 40,
        }}
      >
        <svg
          width={40}
          height={40}
          viewBox="0 0 40 40"
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Background ring */}
          <circle
            cx={20}
            cy={20}
            r={ringRadius}
            fill="none"
            stroke={TEAL}
            strokeWidth={1.5}
            opacity={0.1}
          />
          {/* Progress ring */}
          <circle
            cx={20}
            cy={20}
            r={ringRadius}
            fill="none"
            stroke={SAFFRON}
            strokeWidth={1.5}
            strokeDasharray={ringCircumference}
            strokeDashoffset={ringOffset}
            strokeLinecap="round"
            opacity={0.3}
          />
        </svg>
        {/* Percentage text */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9,
            fontFamily: "'Inter', monospace, sans-serif",
            fontWeight: 700,
            color: SAFFRON,
            opacity: 0.4,
          }}
        >
          {Math.round(progress * 100)}
        </div>
      </div>
    </AbsoluteFill>
  );
};
