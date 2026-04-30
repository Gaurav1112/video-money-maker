import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

interface DataFlowParticlesProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  particleCount?: number;
  particleSize?: number;
  label?: string;
  speed?: number;
  stagger?: number;
  trail?: boolean;
  trailLength?: number;
  active?: boolean;
  variant?: 'normal' | 'fast' | 'slow' | 'error';
}

export const DataFlowParticles: React.FC<DataFlowParticlesProps> = ({
  fromX,
  fromY,
  toX,
  toY,
  color,
  particleCount = 3,
  particleSize = 4,
  label,
  speed = 2,
  stagger = 15,
  trail = true,
  trailLength = 5,
  active = true,
  variant = 'normal',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!active) return null;

  // Speed multiplier based on variant
  const speedMult = variant === 'fast' ? 2 : variant === 'slow' ? 0.5 : 1;
  const effectiveSpeed = speed * speedMult;

  // Variant colors
  const particleColor =
    variant === 'error' ? '#EF4444' :
    variant === 'slow' ? '#F59E0B' :
    variant === 'fast' ? '#22C55E' :
    color;

  // Calculate bezier midpoint (slightly curved)
  const dx = toX - fromX;
  const dy = toY - fromY;
  const midX = (fromX + toX) / 2 - dy * 0.15;
  const midY = (fromY + toY) / 2 + dx * 0.15;

  // Path length approximation
  const pathLength = Math.sqrt(dx * dx + dy * dy) * 1.1;
  const cycleDuration = pathLength / effectiveSpeed;

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
      {/* Connection line (subtle) */}
      <path
        d={`M ${fromX} ${fromY} Q ${midX} ${midY} ${toX} ${toY}`}
        fill="none"
        stroke={`${particleColor}22`}
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />

      {/* Particles */}
      {Array.from({ length: particleCount }).map((_, i) => {
        const particleFrame = frame * effectiveSpeed + i * stagger;
        const progress = (particleFrame % cycleDuration) / cycleDuration;
        const t = progress;

        // Quadratic bezier position
        const x = (1 - t) * (1 - t) * fromX + 2 * (1 - t) * t * midX + t * t * toX;
        const y = (1 - t) * (1 - t) * fromY + 2 * (1 - t) * t * midY + t * t * toY;

        // Error variant: wiggle perpendicular to path
        const wiggle = variant === 'error'
          ? Math.sin(frame * 0.5 + i * 2) * 4
          : 0;

        // Normal perpendicular
        const pathDx = 2 * (1 - t) * (midX - fromX) + 2 * t * (toX - midX);
        const pathDy = 2 * (1 - t) * (midY - fromY) + 2 * t * (toY - midY);
        const pathLen = Math.sqrt(pathDx * pathDx + pathDy * pathDy) || 1;
        const nx = -pathDy / pathLen;
        const ny = pathDx / pathLen;

        const finalX = x + nx * wiggle;
        const finalY = y + ny * wiggle;

        return (
          <React.Fragment key={i}>
            {/* Trail */}
            {trail &&
              Array.from({ length: trailLength }).map((_, ti) => {
                const trailT = Math.max(0, t - (ti + 1) * 0.02);
                const tx = (1 - trailT) * (1 - trailT) * fromX + 2 * (1 - trailT) * trailT * midX + trailT * trailT * toX;
                const ty = (1 - trailT) * (1 - trailT) * fromY + 2 * (1 - trailT) * trailT * midY + trailT * trailT * toY;
                const trailOpacity = (1 - (ti + 1) / (trailLength + 1)) * 0.5;
                const trailSize = particleSize * (1 - (ti + 1) / (trailLength + 1) * 0.5);
                return (
                  <circle
                    key={ti}
                    cx={tx}
                    cy={ty}
                    r={trailSize}
                    fill={particleColor}
                    opacity={trailOpacity}
                  />
                );
              })}

            {/* Main particle */}
            <circle
              cx={finalX}
              cy={finalY}
              r={particleSize}
              fill={particleColor}
              opacity={0.9}
            />

            {/* Glow */}
            <circle
              cx={finalX}
              cy={finalY}
              r={particleSize * 2}
              fill={particleColor}
              opacity={0.15}
            />

            {/* Label (only on first particle) */}
            {label && i === 0 && (
              <text
                x={finalX}
                y={finalY - particleSize - 6}
                textAnchor="middle"
                fill={particleColor}
                fontSize={8}
                fontFamily="JetBrains Mono, monospace"
                fontWeight={600}
                opacity={0.8}
              >
                {label}
              </text>
            )}

            {/* Error X mark */}
            {variant === 'error' && (
              <>
                <line
                  x1={finalX - 3}
                  y1={finalY - 3}
                  x2={finalX + 3}
                  y2={finalY + 3}
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                  opacity={0.8}
                />
                <line
                  x1={finalX + 3}
                  y1={finalY - 3}
                  x2={finalX - 3}
                  y2={finalY + 3}
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                  opacity={0.8}
                />
              </>
            )}
          </React.Fragment>
        );
      })}
    </svg>
  );
};
