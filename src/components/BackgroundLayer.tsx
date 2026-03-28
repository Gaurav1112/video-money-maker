import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate } from 'remotion';
import { COLORS } from '../lib/theme';

interface BackgroundLayerProps {
  /** Current scene type for visual variety */
  sceneType?: string;
}

const BackgroundLayer: React.FC<BackgroundLayerProps> = ({ sceneType }) => {
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

  // Scene-specific color tints
  const getSceneColors = () => {
    switch (sceneType) {
      case 'code':
        return {
          primary: COLORS.teal,
          secondary: COLORS.indigo,
          bgTint: `${COLORS.dark}`,
          gridOpacity: '04',
          orbIntensity: '05',
        };
      case 'interview':
        return {
          primary: COLORS.gold,
          secondary: COLORS.saffron,
          bgTint: '#0F0C08',
          gridOpacity: '03',
          orbIntensity: '0A',
        };
      case 'text':
        return {
          primary: COLORS.indigo,
          secondary: COLORS.teal,
          bgTint: '#0C0A18',
          gridOpacity: '03',
          orbIntensity: '06',
        };
      case 'summary':
        return {
          primary: COLORS.gold,
          secondary: COLORS.teal,
          bgTint: COLORS.dark,
          gridOpacity: '02',
          orbIntensity: '08',
        };
      case 'review':
        return {
          primary: COLORS.saffron,
          secondary: COLORS.indigo,
          bgTint: '#100A0C',
          gridOpacity: '03',
          orbIntensity: '06',
        };
      default:
        return {
          primary: COLORS.saffron,
          secondary: COLORS.indigo,
          bgTint: COLORS.dark,
          gridOpacity: '03',
          orbIntensity: '08',
        };
    }
  };

  const colors = getSceneColors();

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bgTint }}>
      {/* Primary gradient orb - top right */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.primary}${colors.orbIntensity}, transparent 70%)`,
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
          background: `radial-gradient(circle, ${colors.secondary}06, transparent 70%)`,
          bottom: `${orbY % 100}%`,
          left: `${orbX % 100}%`,
        }}
      />

      {/* Grid overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${COLORS.white}${colors.gridOpacity} 1px, transparent 1px), linear-gradient(90deg, ${COLORS.white}${colors.gridOpacity} 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />

      {/* Floating particles */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const x = interpolate(frame + i * 200, [0, 600], [10 + i * 15, 80 - i * 8], {
          extrapolateRight: 'extend',
        });
        const y = interpolate(frame + i * 150, [0, 800], [90 - i * 13, 10 + i * 8], {
          extrapolateRight: 'extend',
        });
        const pulse = interpolate(
          frame,
          [i * 30, i * 30 + 60, i * 30 + 120],
          [0.08, 0.2, 0.08],
          { extrapolateLeft: 'clamp', extrapolateRight: 'extend' },
        );
        const particleColors = [colors.primary, COLORS.gold, COLORS.teal, colors.secondary, COLORS.saffron, COLORS.indigo];
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${((x % 100) + 100) % 100}%`,
              top: `${((y % 100) + 100) % 100}%`,
              width: i < 2 ? 5 : 3,
              height: i < 2 ? 5 : 3,
              borderRadius: '50%',
              backgroundColor: particleColors[i],
              opacity: pulse,
              boxShadow: i < 2 ? `0 0 6px ${particleColors[i]}44` : 'none',
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
