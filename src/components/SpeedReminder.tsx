import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

const COLORS = {
  saffron: '#E85D26',
  dark: '#0C0A15',
  gold: '#FFD700',
  white: '#FFFFFF',
};

const MESSAGES = [
  { text: 'Pro tip: 1.5x speed for better listening', icon: '\u26A1' },
  { text: "At 1.5x? You're learning 50% faster", icon: '\uD83D\uDD25' },
  { text: '1.5x speed — same learning, less time', icon: '\u23E9' },
  { text: 'Still on 1x? Try 1.5x for better listening!', icon: '\u26A1' },
];

interface SpeedReminderProps {
  totalFrames: number;
  introFrames: number;
  outroFrames: number;
}

export const SpeedReminder: React.FC<SpeedReminderProps> = ({
  totalFrames,
  introFrames,
  outroFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const contentFrames = totalFrames - introFrames - outroFrames;
  const SHOW_DURATION = Math.floor(fps * 3.5); // 3.5 seconds visible

  // 4 placement points (% of content duration)
  const placements = [0.15, 0.35, 0.55, 0.75];

  return (
    <>
      {placements.map((pct, idx) => {
        const showFrame = introFrames + Math.floor(contentFrames * pct);
        const relFrame = frame - showFrame;

        if (relFrame < -5 || relFrame > SHOW_DURATION + 10) return null;

        // Slide in from right
        const enterProgress = spring({
          frame: Math.max(0, relFrame),
          fps,
          config: { damping: 14, stiffness: 120, mass: 0.8 },
        });

        // Slide out
        const exitStart = SHOW_DURATION - Math.floor(fps * 0.5);
        const exitProgress =
          relFrame > exitStart
            ? interpolate(relFrame - exitStart, [0, Math.floor(fps * 0.5)], [0, 1], {
                extrapolateRight: 'clamp',
              })
            : 0;

        const translateX =
          interpolate(enterProgress, [0, 1], [300, 0]) + exitProgress * 300;
        const opacity = enterProgress * (1 - exitProgress);

        const msg = MESSAGES[idx];

        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              top: 80,
              right: 30,
              transform: `translateX(${translateX}px)`,
              opacity,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 24px',
              borderRadius: 50,
              background: 'rgba(12, 10, 21, 0.85)',
              backdropFilter: 'blur(12px)',
              border: `1.5px solid ${COLORS.saffron}66`,
              boxShadow: `0 4px 20px ${COLORS.saffron}33`,
              zIndex: 100,
            }}
          >
            <span style={{ fontSize: 22 }}>{msg.icon}</span>
            <span
              style={{
                color: "#FFFFFF",
                fontSize: 18,
                fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
                letterSpacing: 0.3,
              }}
            >
              {msg.text}
            </span>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${COLORS.saffron}, ${COLORS.gold})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 700,
                color: "#FFFFFF",
              }}
            >
              1.5x
            </div>
          </div>
        );
      })}
    </>
  );
};
