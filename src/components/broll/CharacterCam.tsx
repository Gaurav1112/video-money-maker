/**
 * CharacterCam.tsx
 *
 * Picture-in-picture container for SadTalker face frame.
 * Subtle bob animation keeps it alive between lip-sync moments.
 * Positioned in a corner (bottom-right by default) with a rounded frame.
 *
 * Usage:
 *   <CharacterCam
 *     seed={7}
 *     src={staticFile('avatar-frame.webp')}
 *     size={280}
 *     position="bottom-right"
 *   />
 *
 * When src is not provided, renders a placeholder circle.
 */
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Img, staticFile } from 'remotion';
import { getSeededWobble } from './seeded-noise';

type PipPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

interface CharacterCamProps {
  seed: number;
  /** Path to the SadTalker face frame/video. Optional — renders placeholder if omitted. */
  src?: string;
  size?: number;
  position?: PipPosition;
  /** Padding from the edge in px. Default: 32 */
  padding?: number;
  /** Border color. Default: #F97316 (Diya orange) */
  borderColor?: string;
  borderWidth?: number;
  /** Show a subtle expression indicator (emoji) in top-right of frame */
  expressionEmoji?: string;
  /** Bob amplitude in px. Default: 3 */
  bobAmplitude?: number;
}

const POSITION_STYLES: Record<PipPosition, (padding: number) => React.CSSProperties> = {
  'bottom-right': (p) => ({ bottom: p, right: p }),
  'bottom-left': (p) => ({ bottom: p, left: p }),
  'top-right': (p) => ({ top: p, right: p }),
  'top-left': (p) => ({ top: p, left: p }),
};

export const CharacterCam: React.FC<CharacterCamProps> = ({
  seed,
  src,
  size = 280,
  position = 'bottom-right',
  padding = 32,
  borderColor = '#F97316',
  borderWidth = 3,
  expressionEmoji,
  bobAmplitude = 3,
}) => {
  const frame = useCurrentFrame();
  const wobble = getSeededWobble(frame, seed);

  // Slow sinusoidal bob (like a person naturally shifting weight)
  const bobY = Math.sin(frame * 0.04) * bobAmplitude;
  const bobRotate = Math.sin(frame * 0.025) * 0.4;

  const posStyle = POSITION_STYLES[position](padding);

  return (
    <div
      style={{
        position: 'absolute',
        width: size,
        height: size,
        ...posStyle,
        zIndex: 50,
        transform: `translateY(${bobY}px) rotate(${bobRotate}deg)`,
        willChange: 'transform',
      }}
    >
      {/* Glow ring */}
      <div
        style={{
          position: 'absolute',
          inset: -4,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${borderColor}33 0%, transparent 70%)`,
          animation: 'none', // deterministic — no CSS animations
        }}
      />

      {/* Border */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: `${borderWidth}px solid ${borderColor}`,
          boxShadow: `0 0 20px ${borderColor}66`,
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* Avatar content */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          overflow: 'hidden',
          background: '#1E293B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {src ? (
          <Img
            src={src}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'top center',
            }}
          />
        ) : (
          /* Placeholder when no src */
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: `linear-gradient(135deg, #1E293B, #0F172A)`,
            }}
          >
            <span style={{ fontSize: size * 0.35 }}>🧑‍💻</span>
            <span
              style={{
                fontSize: size * 0.12,
                color: '#64748B',
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 600,
                marginTop: 4,
              }}
            >
              GuruSishya
            </span>
          </div>
        )}
      </div>

      {/* Expression emoji badge */}
      {expressionEmoji && (
        <div
          style={{
            position: 'absolute',
            top: -8,
            right: -8,
            width: size * 0.28,
            height: size * 0.28,
            borderRadius: '50%',
            background: '#0F172A',
            border: `2px solid ${borderColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size * 0.18,
            zIndex: 2,
            boxShadow: `0 2px 8px rgba(0,0,0,0.5)`,
          }}
        >
          {expressionEmoji}
        </div>
      )}

      {/* Name badge */}
      <div
        style={{
          position: 'absolute',
          bottom: -4,
          left: '50%',
          transform: 'translateX(-50%)',
          background: borderColor,
          color: '#0F172A',
          fontFamily: '"Space Grotesk", sans-serif',
          fontWeight: 700,
          fontSize: 14,
          padding: '3px 10px',
          borderRadius: 20,
          whiteSpace: 'nowrap',
          zIndex: 2,
          letterSpacing: '0.03em',
        }}
      >
        GuruSishya
      </div>
    </div>
  );
};
