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
  topic: _topic,
  sessionNumber: _sessionNumber,
  totalFrames,
}) => {
  const frame = useCurrentFrame();

  const TEAL = '#CBD5E1';     // subtle gray for light theme
  const SAFFRON = '#94A3B8';  // muted slate for light theme
  const _GOLD = '#64748B';    // slate for light theme (reserved)

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

  // --- Animated full-frame scan line (sweeps top to bottom every 8s = 240 frames) ---
  const fullScanCycle = 240;
  const fullScanProgress = (frame % fullScanCycle) / fullScanCycle;
  const fullScanY = interpolate(fullScanProgress, [0, 1], [-2, 102]);

  // --- Circular progress ring ---
  const progress = Math.min(frame / Math.max(totalFrames, 1), 1);
  const ringRadius = 16;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - progress);

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

      {/* Top-left data panel removed — TopicHeader already shows topic + session */}

      {/* Bottom-right status indicators removed — hidden behind AvatarBubble
          and they look like debug telemetry, not professional video UI */}

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
