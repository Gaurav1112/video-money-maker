import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

const COLORS = {
  saffron: '#E85D26',
  dark: '#0C0A15',
  white: '#FFFFFF',
  gray: '#A9ACB3',
};

interface ChapterBadgeProps {
  chapterName: string;
  chapterNumber: number;
  totalChapters: number;
}

export const ChapterBadge: React.FC<ChapterBadgeProps> = ({
  chapterName,
  chapterNumber,
  totalChapters,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const SHOW_DURATION = fps * 2.5; // 2.5 seconds

  // Slide in from left
  const enterProgress = spring({
    frame: Math.min(frame, Math.floor(fps * 0.5)),
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });

  // Slide out left
  const exitProgress =
    frame > SHOW_DURATION - fps * 0.4
      ? interpolate(
          frame - (SHOW_DURATION - fps * 0.4),
          [0, fps * 0.4],
          [0, 1],
          { extrapolateRight: 'clamp' },
        )
      : 0;

  const translateX =
    interpolate(enterProgress, [0, 1], [-200, 0]) - exitProgress * 200;
  const opacity = enterProgress * (1 - exitProgress);

  if (opacity <= 0) return null;

  const padNum = (n: number) => String(n).padStart(2, '0');

  return (
    <div
      style={{
        position: 'absolute',
        top: 30,
        left: 30,
        transform: `translateX(${translateX}px)`,
        opacity,
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        borderRadius: 10,
        overflow: 'hidden',
        background: 'rgba(12, 10, 21, 0.8)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${COLORS.saffron}44`,
        zIndex: 50,
      }}
    >
      {/* Saffron accent bar */}
      <div
        style={{
          width: 4,
          alignSelf: 'stretch',
          background: COLORS.saffron,
        }}
      />

      {/* Chapter number */}
      <div
        style={{
          padding: '8px 12px',
          fontSize: 13,
          fontWeight: 700,
          color: COLORS.saffron,
          fontFamily: 'JetBrains Mono, monospace',
          borderRight: `1px solid ${"#FFFFFF"}10`,
        }}
      >
        {padNum(chapterNumber)}/{padNum(totalChapters)}
      </div>

      {/* Chapter name */}
      <div
        style={{
          padding: '8px 16px 8px 12px',
          fontSize: 14,
          fontWeight: 600,
          color: "#FFFFFF",
          fontFamily: 'Inter, sans-serif',
          letterSpacing: 0.3,
        }}
      >
        {chapterName}
      </div>
    </div>
  );
};
