import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img } from 'remotion';
import { COLORS, FONTS } from '../../lib/theme';

interface AnimatedBoxProps {
  label: string;
  /** Simple Icons slug (e.g., 'redis', 'docker') or null for text-only */
  iconSlug?: string | null;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
  isActive?: boolean;
  entryFrame: number;
  fps?: number;
}

export const AnimatedBox: React.FC<AnimatedBoxProps> = ({
  label,
  iconSlug,
  x,
  y,
  width = 180,
  height = 80,
  color = COLORS.teal,
  isActive = false,
  entryFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const age = frame - entryFrame;
  if (age < 0) return null;

  const entrance = spring({
    frame: age,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });

  const scale = interpolate(entrance, [0, 1], [0.7, 1.0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  const iconUrl = iconSlug
    ? `https://cdn.simpleicons.org/${iconSlug}/${color.replace('#', '')}`
    : null;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - width / 2,
        top: y - height / 2,
        width,
        height,
        transform: `scale(${scale})`,
        opacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        background: `${COLORS.dark}EE`,
        border: `2px solid ${isActive ? color : `${color}66`}`,
        borderRadius: 12,
        boxShadow: isActive ? `0 0 20px ${color}44` : 'none',
        transition: 'box-shadow 0.3s, border-color 0.3s',
      }}
    >
      {iconUrl && (
        <Img
          src={iconUrl}
          style={{ width: 28, height: 28 }}
        />
      )}
      <span
        style={{
          fontSize: 14,
          fontFamily: FONTS.text,
          fontWeight: 700,
          color: COLORS.white,
          textAlign: 'center',
          letterSpacing: 0.5,
          maxWidth: width - 16,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </div>
  );
};
