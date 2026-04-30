import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

const COLORS = {
  saffron: '#E85D26',
  gold: '#FFD700',
  white: '#FFFFFF',
  dark: '#0C0A15',
};

// Different interrupt styles that rotate
const INTERRUPT_MESSAGES = [
  'But wait...',
  "Here's the trick...",
  'This is key \u2192',
  'Pay attention...',
  'The secret...',
  'Most miss this...',
];

interface PatternInterruptProps {
  totalFrames: number;
  introFrames: number;
  outroFrames: number;
}

export const PatternInterrupt: React.FC<PatternInterruptProps> = ({
  totalFrames,
  introFrames,
  outroFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const contentFrames = totalFrames - introFrames - outroFrames;
  const FLASH_DURATION = Math.floor(fps * 0.5); // 0.5 second

  // Interrupt at ~30% and ~65% of content
  const interrupts = [
    { pct: 0.30, msgIdx: 0 },
    { pct: 0.65, msgIdx: 2 },
  ];

  return (
    <>
      {interrupts.map(({ pct, msgIdx }, idx) => {
        const showFrame = introFrames + Math.floor(contentFrames * pct);
        const relFrame = frame - showFrame;

        if (relFrame < 0 || relFrame > FLASH_DURATION) return null;

        // Quick zoom pulse
        const zoomProgress = interpolate(relFrame, [0, 4, FLASH_DURATION], [1, 1.08, 1], {
          extrapolateRight: 'clamp',
        });

        // Flash opacity
        const flashOpacity = interpolate(
          relFrame,
          [0, 3, FLASH_DURATION - 3, FLASH_DURATION],
          [0, 1, 1, 0],
          { extrapolateRight: 'clamp' },
        );

        const msg = INTERRUPT_MESSAGES[msgIdx % INTERRUPT_MESSAGES.length];

        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 80,
              opacity: flashOpacity,
              transform: `scale(${zoomProgress})`,
              pointerEvents: 'none',
            }}
          >
            {/* Brief saffron flash overlay */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(circle at center, rgba(232,93,38,0.15) 0%, transparent 70%)`,
            }} />

            {/* Interrupt text */}
            <div style={{
              fontSize: 36,
              fontWeight: 900,
              color: COLORS.saffron,
              textShadow: `0 0 20px rgba(232,93,38,0.6), 0 2px 4px rgba(0,0,0,0.8)`,
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.02em',
            }}>
              {msg}
            </div>
          </div>
        );
      })}
    </>
  );
};
