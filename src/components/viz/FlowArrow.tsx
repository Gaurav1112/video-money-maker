import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';

interface FlowArrowProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  label?: string;
  latency?: string;
  active?: boolean;
  dashed?: boolean;
  revealed?: boolean;
}

export const FlowArrow: React.FC<FlowArrowProps> = ({
  fromX,
  fromY,
  toX,
  toY,
  color,
  label,
  latency,
  active = false,
  dashed = false,
  revealed = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = revealed
    ? spring({
        frame,
        fps,
        config: { damping: 14, stiffness: 100, mass: 0.8 },
      })
    : 0;

  if (entrance <= 0) return null;

  // Calculate midpoint and angle
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const angleDeg = (angle * 180) / Math.PI;

  // Arrow line length for stroke animation
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.sqrt(dx * dx + dy * dy);

  // Arrowhead points
  const headLen = 10;
  const headAngle = 0.4;
  const ax1 = toX - headLen * Math.cos(angle - headAngle);
  const ay1 = toY - headLen * Math.sin(angle - headAngle);
  const ax2 = toX - headLen * Math.cos(angle + headAngle);
  const ay2 = toY - headLen * Math.sin(angle + headAngle);

  // Active flowing dot
  const dotProgress = active ? (frame * 0.03) % 1 : 0;
  const dotX = fromX + dx * dotProgress;
  const dotY = fromY + dy * dotProgress;

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {/* Arrow line */}
      <line
        x1={fromX}
        y1={fromY}
        x2={fromX + dx * entrance}
        y2={fromY + dy * entrance}
        stroke={color}
        strokeWidth={active ? 2 : 1.5}
        strokeDasharray={dashed ? '6 4' : undefined}
        opacity={0.7 * entrance}
      />

      {/* Arrowhead */}
      {entrance > 0.8 && (
        <polygon
          points={`${toX},${toY} ${ax1},${ay1} ${ax2},${ay2}`}
          fill={color}
          opacity={0.8}
        />
      )}

      {/* Active flowing dot */}
      {active && (
        <>
          <circle cx={dotX} cy={dotY} r={3} fill={color} opacity={0.9} />
          <circle cx={dotX} cy={dotY} r={6} fill={color} opacity={0.2} />
        </>
      )}

      {/* Label */}
      {label && entrance > 0.5 && (
        <text
          x={midX}
          y={midY - 8}
          textAnchor="middle"
          fill={color}
          fontSize={10}
          fontFamily="Inter, sans-serif"
          fontWeight={600}
          opacity={0.85 * entrance}
          transform={`rotate(${Math.abs(angleDeg) > 90 ? angleDeg + 180 : angleDeg}, ${midX}, ${midY - 8})`}
        >
          {label}
        </text>
      )}

      {/* Latency label */}
      {latency && entrance > 0.6 && (
        <text
          x={midX}
          y={midY + 14}
          textAnchor="middle"
          fill="#A9ACB3"
          fontSize={9}
          fontFamily="JetBrains Mono, monospace"
          opacity={0.7 * entrance}
          transform={`rotate(${Math.abs(angleDeg) > 90 ? angleDeg + 180 : angleDeg}, ${midX}, ${midY + 14})`}
        >
          {latency}
        </text>
      )}
    </svg>
  );
};
