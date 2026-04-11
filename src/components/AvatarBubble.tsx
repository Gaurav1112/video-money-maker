import React from 'react';
import { useCurrentFrame, useVideoConfig, AbsoluteFill, Img, OffthreadVideo, interpolate, staticFile } from 'remotion';
import { COLORS } from '../lib/theme';
import { getWobble } from '../lib/wobble';

interface AvatarBubbleProps {
  avatarVideo?: string;
  avatarPhoto?: string;
  startFrame?: number;
  endFrame?: number;
}

const SIZE = 150;

export const AvatarBubble: React.FC<AvatarBubbleProps> = ({
  avatarVideo,
  avatarPhoto,
  startFrame = 0,
  endFrame = Infinity,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < startFrame || frame > endFrame) return null;

  const localFrame = frame - startFrame;
  const totalFrames = endFrame - startFrame;

  // Fade in/out
  const opacity = interpolate(localFrame, [0, 30, totalFrames - 30, totalFrames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Subtle breathing via Perlin noise
  const wobble = getWobble(frame, 999);
  const breathe = 1 + wobble.rotate * 0.015;

  // Glowing border pulse
  const glowIntensity = interpolate(Math.sin(frame * 0.06), [-1, 1], [4, 12]);

  return (
    <div style={{
      position: 'absolute',
      bottom: 80,
      left: 40,
      width: SIZE,
      height: SIZE,
      borderRadius: '50%',
      overflow: 'hidden',
      opacity,
      transform: `scale(${breathe})`,
      border: `3px solid ${COLORS.teal}`,
      boxShadow: `0 0 ${glowIntensity}px ${COLORS.teal}66, inset 0 0 ${glowIntensity * 0.5}px ${COLORS.teal}22`,
      zIndex: 80,
    }}>
      {avatarVideo ? (
        <OffthreadVideo
          src={staticFile(avatarVideo)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          muted
        />
      ) : avatarPhoto ? (
        <Img
          src={staticFile(avatarPhoto)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          background: `linear-gradient(135deg, ${COLORS.saffron}40, ${COLORS.teal}40)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 48, color: COLORS.white,
        }}>
          GS
        </div>
      )}
    </div>
  );
};
