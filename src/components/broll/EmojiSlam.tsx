/**
 * EmojiSlam.tsx
 *
 * Emoji slam-in for emotional beats. Used sparingly per the tone map.
 * ✓ (correct answer), ✗ (wrong answer), 🔥 (hot take), 😬 (cringe/warning)
 *
 * The emoji drops from above with a physics-style bounce then fades.
 * Use for punctuation — max once every 30 seconds per the BROLL_BIBLE ban list.
 *
 * Usage:
 *   <EmojiSlam seed={99} emoji="✓" color="#22C55E" />
 *   <EmojiSlam seed={100} emoji="✗" color="#EF4444" label="WRONG ANSWER" />
 */
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { createNoise } from './seeded-noise';

interface EmojiSlamProps {
  seed: number;
  emoji: string;
  label?: string;
  color?: string;
  /** Frames for slam in. Default: 12 */
  inFrames?: number;
  /** Frames to hold. Default: 30 */
  holdFrames?: number;
  /** Frames to fade out. Default: 10 */
  outFrames?: number;
  size?: number;
  position?: 'center' | 'top-left' | 'top-right' | 'bottom-center';
}

export const EmojiSlam: React.FC<EmojiSlamProps> = ({
  seed,
  emoji,
  label,
  color = '#F97316',
  inFrames = 12,
  holdFrames = 30,
  outFrames = 10,
  size = 120,
  position = 'center',
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const n = createNoise(seed);

  const totalHold = inFrames + holdFrames;
  const totalDur = totalHold + outFrames;

  // Bounce spring drop
  const dropSpring = spring({
    frame,
    fps,
    config: { damping: 6, stiffness: 400, mass: 0.4 },
    durationInFrames: inFrames * 2,
  });

  const scaleSpring = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 350, mass: 0.5 },
    durationInFrames: inFrames * 2,
  });

  const dropY = interpolate(dropSpring, [0, 1], [-200, 0]);
  const scale = interpolate(scaleSpring, [0, 1], [0, 1]);

  // Fade out
  const opacity = frame < totalHold
    ? 1
    : interpolate(frame, [totalHold, totalDur], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  // Slight seeded rotation on land
  const rotation = n.smoothAt(0, -8, 8);

  // Position mapping
  const posMap: Record<string, React.CSSProperties> = {
    center: { top: '50%', left: '50%', transform: `translate(-50%, -50%) translateY(${dropY}px) scale(${scale}) rotate(${rotation}deg)` },
    'top-left': { top: 40, left: 40, transform: `translateY(${dropY}px) scale(${scale}) rotate(${rotation}deg)` },
    'top-right': { top: 40, right: 40, transform: `translateY(${dropY}px) scale(${scale}) rotate(${rotation}deg)` },
    'bottom-center': { bottom: 60, left: '50%', transform: `translateX(-50%) translateY(${dropY}px) scale(${scale}) rotate(${rotation}deg)` },
  };

  return (
    <div
      style={{
        position: 'absolute',
        opacity,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        ...posMap[position],
        // Override transform to combine all transforms
        transform: position === 'center'
          ? `translate(-50%, -50%) translateY(${dropY}px) scale(${scale}) rotate(${rotation}deg)`
          : position === 'bottom-center'
          ? `translateX(-50%) translateY(${dropY}px) scale(${scale}) rotate(${rotation}deg)`
          : `translateY(${dropY}px) scale(${scale}) rotate(${rotation}deg)`,
      }}
    >
      <span
        style={{
          fontSize: size,
          lineHeight: 1,
          filter: `drop-shadow(0 4px 16px ${color}88)`,
        }}
      >
        {emoji}
      </span>
      {label && (
        <div
          style={{
            background: color,
            color: '#0F172A',
            fontFamily: '"Space Grotesk", sans-serif',
            fontWeight: 800,
            fontSize: size * 0.28,
            padding: '6px 16px',
            borderRadius: 8,
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};
