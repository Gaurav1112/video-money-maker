import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';

interface AnimatedOverlayProps {
  sceneType?: string;
}

/**
 * Adds constant subtle motion to every frame:
 * 1. Floating particles (small dots drifting upward)
 * 2. Scanning line (horizontal sweep every ~4 seconds)
 * 3. Corner vignette (darkened corners for cinematic feel)
 * 4. Subtle grid lines (tech/coding feel)
 * 5. Highlight sweep (diagonal light shine every 5 seconds)
 */
export const AnimatedOverlay: React.FC<AnimatedOverlayProps> = ({ sceneType = 'text' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 1. Floating particles — 8 small dots drifting upward
  const particles = Array.from({ length: 8 }, (_, i) => {
    const x = (i * 137.5 + frame * 0.1 * (i % 3 + 1)) % 100; // scattered horizontally
    const y = (100 - ((frame * 0.3 + i * 50) % 120)); // drift upward
    const opacity = y > 0 && y < 100 ? 0.15 + 0.1 * Math.sin(frame * 0.05 + i) : 0;
    const size = 2 + (i % 3);
    const color = i % 2 === 0 ? '#E85D26' : '#FFD700';

    return (
      <div
        key={`p-${i}`}
        style={{
          position: 'absolute',
          left: `${x}%`,
          top: `${y}%`,
          width: size,
          height: size,
          borderRadius: '50%',
          background: color,
          opacity,
          boxShadow: `0 0 ${size * 2}px ${color}`,
          pointerEvents: 'none',
        }}
      />
    );
  });

  // 2. Scanning line — subtle horizontal sweep
  const scanY = (frame * 0.8) % 110 - 5; // sweeps top to bottom every ~4 seconds

  // 3. Corner vignette — cinematic darkened edges
  const vignetteOpacity = 0.4;

  // 5. Highlight sweep — diagonal light shine every 5 seconds
  const sweepCycleFrames = fps * 5;
  const sweepProgress = (frame % sweepCycleFrames) / sweepCycleFrames;
  // The sweep itself takes ~30% of the cycle, rest is idle
  const sweepActive = sweepProgress < 0.3;
  const sweepPosition = sweepActive
    ? interpolate(sweepProgress, [0, 0.3], [-30, 130], {
        easing: Easing.inOut(Easing.ease),
      })
    : -999; // off-screen when inactive
  // Opacity peaks in the middle of the sweep
  const sweepOpacity = sweepActive
    ? interpolate(sweepProgress, [0, 0.15, 0.3], [0, 0.07, 0])
    : 0;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 1,
      overflow: 'hidden',
    }}>
      {/* Floating particles */}
      {particles}

      {/* Scanning line */}
      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: `${scanY}%`,
        height: 1,
        background: 'linear-gradient(90deg, transparent 0%, rgba(232,93,38,0.08) 30%, rgba(232,93,38,0.12) 50%, rgba(232,93,38,0.08) 70%, transparent 100%)',
      }} />

      {/* Highlight sweep — diagonal light shine */}
      {sweepActive && (
        <div style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${sweepPosition}%`,
          width: '15%',
          background: `linear-gradient(105deg, transparent 0%, rgba(255,255,255,${sweepOpacity}) 40%, rgba(255,255,255,${sweepOpacity * 1.2}) 50%, rgba(255,255,255,${sweepOpacity}) 60%, transparent 100%)`,
          transform: 'skewX(-15deg)',
        }} />
      )}

      {/* Corner vignette */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,${vignetteOpacity}) 100%)`,
      }} />

      {/* Subtle tech grid (only for code/diagram scenes) */}
      {(sceneType === 'code' || sceneType === 'diagram') && (
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.03,
          backgroundImage: `
            linear-gradient(rgba(129,140,248,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(129,140,248,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          transform: `translateY(${frame * 0.1 % 40}px)`,
        }} />
      )}
    </div>
  );
};
