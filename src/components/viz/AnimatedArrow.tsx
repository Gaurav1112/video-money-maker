import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { evolvePath } from '@remotion/paths';
import { COLORS } from '../../lib/theme';

interface AnimatedArrowProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color?: string;
  duration?: number;
  startFrame: number;
  label?: string;
  curved?: boolean;
  dashed?: boolean;
}

export const AnimatedArrow: React.FC<AnimatedArrowProps> = ({
  from,
  to,
  color = COLORS.gray,
  duration = 15,
  startFrame,
  label,
  curved = false,
  dashed = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const age = frame - startFrame;
  if (age < 0) return null;

  const progress = spring({
    frame: age,
    fps,
    config: { damping: 20, stiffness: 100, mass: 0.5 },
  });

  // Build SVG path
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const ctrlY = curved ? midY - 40 : midY;
  const pathD = curved
    ? `M ${from.x} ${from.y} Q ${midX} ${ctrlY} ${to.x} ${to.y}`
    : `M ${from.x} ${from.y} L ${to.x} ${to.y}`;

  const { strokeDasharray, strokeDashoffset } = evolvePath(progress, pathD);

  // Arrowhead angle
  const dx = to.x - (curved ? midX : from.x);
  const dy = to.y - (curved ? ctrlY : from.y);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  // Arrowhead visibility
  const headOpacity = interpolate(progress, [0.7, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      {/* Arrow line */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeDasharray={dashed ? '8,4' : strokeDasharray}
        strokeDashoffset={dashed ? 0 : strokeDashoffset}
        opacity={dashed ? progress : 1}
      />
      {/* Arrowhead */}
      <polygon
        points="0,-5 10,0 0,5"
        fill={color}
        transform={`translate(${to.x},${to.y}) rotate(${angle})`}
        opacity={headOpacity}
      />
      {/* Label */}
      {label && progress > 0.5 && (
        <text
          x={midX}
          y={midY - 10}
          textAnchor="middle"
          fill={COLORS.white}
          fontSize={12}
          fontFamily="Inter, sans-serif"
          opacity={interpolate(progress, [0.5, 0.8], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })}
        >
          {label}
        </text>
      )}
    </svg>
  );
};
