/**
 * Diagram.tsx
 *
 * Wraps an existing D2-generated SVG with:
 * 1. KenBurns slow pan/zoom
 * 2. Animated label callouts (pulsing rings + text labels)
 * 3. Zoom-to-region capability (crops + zooms to a sub-rect)
 *
 * This replaces the raw <img> pattern that the BROLL_BIBLE bans.
 *
 * Usage:
 *   <Diagram
 *     seed={15}
 *     src={staticFile('diagrams/kafka-architecture.svg')}
 *     callouts={[
 *       { x: 250, y: 180, label: 'Producer', frame: 30 },
 *       { x: 600, y: 180, label: 'Broker', frame: 60 },
 *       { x: 900, y: 180, label: 'Consumer', frame: 90 },
 *     ]}
 *     zoomRegion={{ x: 400, y: 100, width: 400, height: 200, startFrame: 120 }}
 *   />
 */
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Img, Easing } from 'remotion';
import { KenBurns } from './KenBurns';
import { createNoise } from './seeded-noise';

interface Callout {
  x: number;
  y: number;
  label: string;
  /** Frame at which this callout animates in. Default: 0 */
  frame?: number;
  color?: string;
}

interface ZoomRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Frame at which the zoom-to-region starts */
  startFrame: number;
  /** Duration of zoom. Default: 45 */
  duration?: number;
}

interface DiagramProps {
  seed: number;
  src: string;
  callouts?: Callout[];
  zoomRegion?: ZoomRegion;
  /** Duration of KenBurns motion. Default: 300 */
  kbDuration?: number;
  /** Natural dimensions of the SVG (used for callout positioning). Default: 1000×600 */
  svgWidth?: number;
  svgHeight?: number;
}

export const Diagram: React.FC<DiagramProps> = ({
  seed,
  src,
  callouts = [],
  zoomRegion,
  kbDuration = 300,
  svgWidth = 1000,
  svgHeight = 600,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const n = createNoise(seed);

  // Scale factor from SVG natural size to display size
  const scaleX = width / svgWidth;
  const scaleY = height / svgHeight;

  // Zoom-to-region transform
  let zoomStyle: React.CSSProperties = {};
  if (zoomRegion) {
    const { x, y, width: rw, height: rh, startFrame, duration = 45 } = zoomRegion;
    const zoomProgress = interpolate(frame - startFrame, [0, duration], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.cubic),
    });

    const targetScale = Math.min(width / (rw * scaleX), height / (rh * scaleY)) * 0.9;
    const currentScale = interpolate(zoomProgress, [0, 1], [1, targetScale]);

    const targetOriginX = (x + rw / 2) * scaleX;
    const targetOriginY = (y + rh / 2) * scaleY;

    const originX = interpolate(zoomProgress, [0, 1], [width / 2, targetOriginX]);
    const originY = interpolate(zoomProgress, [0, 1], [height / 2, targetOriginY]);

    zoomStyle = {
      transform: `scale(${currentScale})`,
      transformOrigin: `${originX}px ${originY}px`,
    };
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#0F172A' }}>
      <KenBurns seed={seed} duration={kbDuration}>
        <div style={{ width: '100%', height: '100%', ...zoomStyle }}>
          <Img
            src={src}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        </div>
      </KenBurns>

      {/* Callout overlays */}
      {callouts.map((callout, i) => {
        const calloutFrame = callout.frame ?? 0;
        const calloutElapsed = Math.max(0, frame - calloutFrame);
        const calloutOpacity = interpolate(calloutElapsed, [0, 15], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const calloutScale = spring({
          frame: calloutElapsed,
          fps,
          config: { damping: 10, stiffness: 200, mass: 0.5 },
          durationInFrames: 20,
        });

        if (calloutElapsed <= 0) return null;

        const color = callout.color ?? '#F97316';
        const dotX = callout.x * scaleX;
        const dotY = callout.y * scaleY;

        // Pulsing ring
        const pulseScale = 1 + 0.3 * Math.sin(frame * 0.1);

        return (
          <div key={i} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            {/* Pulsing ring */}
            <div
              style={{
                position: 'absolute',
                left: dotX - 12,
                top: dotY - 12,
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: `2px solid ${color}`,
                opacity: calloutOpacity * 0.6,
                transform: `scale(${pulseScale * calloutScale})`,
              }}
            />
            {/* Center dot */}
            <div
              style={{
                position: 'absolute',
                left: dotX - 6,
                top: dotY - 6,
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: color,
                opacity: calloutOpacity,
                transform: `scale(${calloutScale})`,
                boxShadow: `0 0 8px ${color}`,
              }}
            />
            {/* Label bubble */}
            <div
              style={{
                position: 'absolute',
                left: dotX + 16,
                top: dotY - 16,
                background: color,
                color: '#0F172A',
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 700,
                fontSize: 18,
                padding: '4px 12px',
                borderRadius: 6,
                opacity: calloutOpacity,
                transform: `scale(${calloutScale})`,
                transformOrigin: 'left center',
                whiteSpace: 'nowrap',
                boxShadow: `0 2px 8px rgba(0,0,0,0.4)`,
              }}
            >
              {callout.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};
