/**
 * WhiteboardDraw.tsx
 *
 * Animated whiteboard-style sketch effect using SVG path animation.
 * Paths animate via stroke-dashoffset (the "drawing on" effect).
 * Deterministic: path draw speed is based on total path length.
 *
 * Usage:
 *   <WhiteboardDraw
 *     seed={22}
 *     paths={[
 *       { d: 'M 100 300 C 200 100 400 100 500 300', label: 'User Request', color: '#38BDF8' },
 *       { d: 'M 500 300 L 700 300', label: 'Backend', color: '#22C55E' },
 *     ]}
 *     framesPerPath={45}
 *   />
 */
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import { createNoise } from './seeded-noise';

interface DrawPath {
  d: string;
  label?: string;
  labelOffset?: { x: number; y: number };
  color?: string;
  strokeWidth?: number;
  /** Approximate path length in SVG units for dash animation. Auto-estimate if not set. */
  pathLength?: number;
}

interface WhiteboardDrawProps {
  seed: number;
  paths: DrawPath[];
  /** Frames to draw each path. Default: 45 */
  framesPerPath?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  background?: string;
  startFrame?: number;
}

/** Rough path length estimate for straight/curved paths (avoids DOM getTotalLength) */
function estimatePathLength(d: string): number {
  const coords = d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
  if (coords.length < 4) return 300;
  let len = 0;
  for (let i = 0; i + 3 < coords.length; i += 2) {
    const dx = coords[i + 2] - coords[i];
    const dy = coords[i + 3] - coords[i + 1];
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return Math.max(len, 50);
}

export const WhiteboardDraw: React.FC<WhiteboardDrawProps> = ({
  seed,
  paths,
  framesPerPath = 45,
  canvasWidth = 1000,
  canvasHeight = 600,
  background = '#FFFDF7',
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const n = createNoise(seed);

  return (
    <div
      style={{
        width: canvasWidth,
        height: canvasHeight,
        background,
        borderRadius: 16,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 32px rgba(0,0,0,0.3)',
        border: '2px solid #E2E8F0',
      }}
    >
      {/* Paper texture lines (subtle) */}
      {Array.from({ length: Math.floor(canvasHeight / 40) }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: i * 40 + 20,
            height: 1,
            background: '#CBD5E155',
          }}
        />
      ))}

      <svg
        width={canvasWidth}
        height={canvasHeight}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {paths.map((path, i) => {
          const pathElapsed = Math.max(0, elapsed - i * framesPerPath);
          const drawProgress = Math.min(1, pathElapsed / framesPerPath);
          const pLen = path.pathLength ?? estimatePathLength(path.d);
          const dashOffset = pLen * (1 - drawProgress);
          const color = path.color ?? '#1E293B';
          const labelOffset = path.labelOffset ?? { x: 0, y: -20 };

          // Extract approximate midpoint coords for label placement
          const coords = path.d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
          const midX = coords.length > 2 ? coords[Math.floor(coords.length / 4) * 2] : 100;
          const midY = coords.length > 3 ? coords[Math.floor(coords.length / 4) * 2 + 1] : 100;

          const labelOpacity = interpolate(drawProgress, [0.6, 1.0], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          return (
            <g key={i}>
              {/* Slight seeded hand-wobble: duplicate offset path for sketch feel */}
              <path
                d={path.d}
                fill="none"
                stroke={color}
                strokeWidth={(path.strokeWidth ?? 3) * 0.3}
                strokeDasharray={`${pLen} ${pLen}`}
                strokeDashoffset={dashOffset + 1.5}
                strokeLinecap="round"
                opacity={0.2}
              />
              {/* Main path */}
              <path
                d={path.d}
                fill="none"
                stroke={color}
                strokeWidth={path.strokeWidth ?? 3}
                strokeDasharray={`${pLen} ${pLen}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Label */}
              {path.label && (
                <text
                  x={midX + labelOffset.x}
                  y={midY + labelOffset.y}
                  fill={color}
                  fontSize={18}
                  fontFamily='"Space Grotesk", sans-serif'
                  fontWeight="600"
                  opacity={labelOpacity}
                  textAnchor="middle"
                >
                  {path.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
