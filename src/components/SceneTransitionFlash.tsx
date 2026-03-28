import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate } from 'remotion';
import { COLORS } from '../lib/theme';

interface SceneTransitionFlashProps {
  /** Scene type for color theming */
  sceneType?: string;
}

const SCENE_FLASH_COLORS: Record<string, string> = {
  title: COLORS.saffron,
  text: COLORS.indigo,
  code: COLORS.teal,
  diagram: COLORS.indigo,
  table: COLORS.teal,
  interview: COLORS.gold,
  review: COLORS.saffron,
  summary: COLORS.gold,
};

/**
 * SceneTransitionFlash - A brief visual flash/swipe at the start of each scene.
 * Placed inside each Sequence, it triggers at frame 0 of the scene.
 * Creates a "page turn" feeling with a colored light wipe.
 */
const SceneTransitionFlash: React.FC<SceneTransitionFlashProps> = ({
  sceneType = 'text',
}) => {
  const frame = useCurrentFrame();
  const color = SCENE_FLASH_COLORS[sceneType] || COLORS.saffron;

  // Flash fades in quickly and out quickly (first 12 frames = 0.4s)
  const flashOpacity = interpolate(
    frame,
    [0, 3, 8, 14],
    [0, 0.25, 0.1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Horizontal wipe line sweeps across
  const wipeX = interpolate(
    frame,
    [0, 12],
    [-5, 105],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const wipeOpacity = interpolate(
    frame,
    [0, 4, 10, 14],
    [0, 0.7, 0.3, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  if (frame > 15) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 50 }}>
      {/* Full-screen flash */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: color,
          opacity: flashOpacity,
        }}
      />

      {/* Horizontal wipe line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${wipeX}%`,
          width: 4,
          background: `linear-gradient(180deg, transparent, ${color}, transparent)`,
          opacity: wipeOpacity,
          boxShadow: `0 0 30px 10px ${color}44`,
        }}
      />

      {/* Top edge highlight */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${color}${frame < 8 ? '66' : '00'}, transparent)`,
          opacity: wipeOpacity,
        }}
      />
    </AbsoluteFill>
  );
};

export default SceneTransitionFlash;
