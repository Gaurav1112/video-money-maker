/**
 * KenBurns.tsx
 *
 * Slow pan + zoom on any image or SVG child element.
 * Direction and magnitude seeded — same seed always produces same motion.
 *
 * Usage:
 *   <KenBurns seed={42} duration={150}>
 *     <img src={staticFile('diagram.svg')} style={{ width: '100%' }} />
 *   </KenBurns>
 */
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing, AbsoluteFill } from 'remotion';
import { createNoise } from './seeded-noise';

interface KenBurnsProps {
  seed: number;
  /** Duration of the Ken Burns move in frames. Default: 150 (5s at 30fps) */
  duration?: number;
  /** Starting scale. Default: 1.08 */
  scaleStart?: number;
  /** Ending scale. Default: 1.0 (zoom-out) or 1.15 (zoom-in) based on seed */
  scaleEnd?: number;
  /** Clip the overflowing scaled content. Default: true */
  overflow?: 'hidden' | 'visible';
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const KenBurns: React.FC<KenBurnsProps> = ({
  seed,
  duration = 150,
  scaleStart,
  scaleEnd,
  overflow = 'hidden',
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const n = createNoise(seed);

  // Deterministically decide zoom direction and pan direction from seed
  const zoomIn = n.smoothAt(0) > 0; // positive = zoom in, negative = zoom out
  const panX = n.smoothAt(1) * 40;  // [-40, 40] px
  const panY = n.smoothAt(2) * 20;  // [-20, 20] px

  const resolvedScaleStart = scaleStart ?? (zoomIn ? 1.0 : 1.12);
  const resolvedScaleEnd = scaleEnd ?? (zoomIn ? 1.12 : 1.0);

  const progress = interpolate(frame, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });

  const scale = interpolate(progress, [0, 1], [resolvedScaleStart, resolvedScaleEnd]);
  const translateX = interpolate(progress, [0, 1], [0, panX]);
  const translateY = interpolate(progress, [0, 1], [0, panY]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow,
        position: 'relative',
        ...style,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
          transformOrigin: 'center center',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
};
