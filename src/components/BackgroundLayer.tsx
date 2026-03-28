import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate } from 'remotion';
import { COLORS } from '../lib/theme';

const BackgroundLayer: React.FC = () => {
  const frame = useCurrentFrame();

  // Slow rotating gradient
  const rotation = interpolate(frame, [0, 900], [0, 360], {
    extrapolateRight: 'extend',
  });

  // Secondary orb movement
  const orbX = interpolate(frame, [0, 600], [-15, 10], {
    extrapolateRight: 'extend',
  });
  const orbY = interpolate(frame, [0, 450], [60, 30], {
    extrapolateRight: 'extend',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      {/* Primary gradient orb - top right */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.saffron}08, transparent 70%)`,
          top: '20%',
          right: '-10%',
          transform: `rotate(${rotation}deg)`,
        }}
      />

      {/* Secondary gradient orb - bottom left */}
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.indigo}06, transparent 70%)`,
          bottom: `${orbY % 100}%`,
          left: `${orbX % 100}%`,
        }}
      />

      {/* Grid overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${COLORS.white}03 1px, transparent 1px), linear-gradient(90deg, ${COLORS.white}03 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />

      {/* Floating particles */}
      {[0, 1, 2, 3].map((i) => {
        const x = interpolate(frame + i * 200, [0, 600], [10 + i * 20, 80 - i * 10], {
          extrapolateRight: 'extend',
        });
        const y = interpolate(frame + i * 150, [0, 800], [90 - i * 15, 10 + i * 10], {
          extrapolateRight: 'extend',
        });
        const pulse = interpolate(
          frame,
          [i * 30, i * 30 + 60, i * 30 + 120],
          [0.1, 0.25, 0.1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'extend' },
        );
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${((x % 100) + 100) % 100}%`,
              top: `${((y % 100) + 100) % 100}%`,
              width: 4,
              height: 4,
              borderRadius: '50%',
              backgroundColor: [COLORS.saffron, COLORS.gold, COLORS.teal, COLORS.indigo][i],
              opacity: pulse,
            }}
          />
        );
      })}

      {/* Subtle vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 50%, ${COLORS.dark}88 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

export default BackgroundLayer;
