import React from 'react';
import { useCurrentFrame } from 'remotion';

/**
 * Deterministic film grain overlay. Uses SVG feTurbulence with
 * frame-based seed for consistent per-frame grain.
 */
export const FilmGrain: React.FC<{ opacity?: number }> = ({ opacity = 0.04 }) => {
  const frame = useCurrentFrame();
  // Change grain pattern every 2 frames for subtle movement
  const seed = Math.floor(frame / 2);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 999, mixBlendMode: 'overlay', opacity }}>
      <svg width="100%" height="100%">
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves={3} seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </div>
  );
};
