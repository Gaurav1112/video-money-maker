import React from 'react';
import { useCurrentFrame, useVideoConfig, Img, OffthreadVideo, interpolate, staticFile } from 'remotion';
import { COLORS } from '../lib/theme';
import { getWobble } from '../lib/wobble';

interface AvatarBubbleProps {
  avatarVideo?: string;
  avatarPhoto?: string;
  startFrame?: number;
  endFrame?: number;
}

const SIZE = 220;

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

  // Subtle breathing + vertical float
  const wobble = getWobble(frame, 999);
  const breathe = 1 + wobble.rotate * 0.015;
  const floatY = Math.sin(frame * 0.03) * 3;

  // Speaking indicator — pulsing ring that simulates talking
  // Uses a fast sine wave to create a "speaking" vibration effect
  const speakPulse1 = interpolate(Math.sin(frame * 0.25), [-1, 1], [0.4, 1.0]);
  const speakPulse2 = interpolate(Math.sin(frame * 0.35 + 1), [-1, 1], [0.3, 0.8]);
  const speakPulse3 = interpolate(Math.sin(frame * 0.18 + 2), [-1, 1], [0.5, 1.0]);

  // Ring scale pulsing (simulates audio waveform around the avatar)
  const ringScale1 = 1 + speakPulse1 * 0.08;
  const ringScale2 = 1 + speakPulse2 * 0.12;
  const ringScale3 = 1 + speakPulse3 * 0.06;

  return (
    <div style={{
      position: 'absolute',
      bottom: 80,
      right: 40,
      width: SIZE + 40, // extra space for speaking rings
      height: SIZE + 40,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 80,
      opacity,
    }}>
      {/* Speaking pulse rings — concentric animated circles */}
      <div style={{
        position: 'absolute',
        width: SIZE + 20,
        height: SIZE + 20,
        borderRadius: '50%',
        border: `2px solid ${COLORS.teal}`,
        opacity: speakPulse1 * 0.4,
        transform: `scale(${ringScale1})`,
      }} />
      <div style={{
        position: 'absolute',
        width: SIZE + 30,
        height: SIZE + 30,
        borderRadius: '50%',
        border: `1px solid ${COLORS.saffron}`,
        opacity: speakPulse2 * 0.25,
        transform: `scale(${ringScale2})`,
      }} />
      <div style={{
        position: 'absolute',
        width: SIZE + 36,
        height: SIZE + 36,
        borderRadius: '50%',
        border: `1px solid ${COLORS.gold}`,
        opacity: speakPulse3 * 0.15,
        transform: `scale(${ringScale3})`,
      }} />

      {/* Avatar circle */}
      <div style={{
        width: SIZE,
        height: SIZE,
        borderRadius: '50%',
        overflow: 'hidden',
        transform: `scale(${breathe}) translateY(${floatY}px)`,
        border: `3px solid ${COLORS.teal}`,
        boxShadow: `0 0 20px ${COLORS.teal}44, 0 8px 32px rgba(0,0,0,0.5)`,
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
            background: `linear-gradient(135deg, ${COLORS.saffron}60, ${COLORS.teal}60)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column',
          }}>
            <svg width="90" height="90" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" fill={`${COLORS.white}cc`} />
              <path d="M4 21c0-4.418 3.582-8 8-8s8 3.582 8 8" fill={`${COLORS.white}99`} />
            </svg>
            <div style={{ fontSize: 24, fontWeight: 700, color: `${COLORS.white}cc`, marginTop: -4, letterSpacing: '0.1em' }}>
              GS
            </div>
          </div>
        )}
      </div>

      {/* "LIVE" badge */}
      <div style={{
        position: 'absolute',
        bottom: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        background: COLORS.saffron,
        borderRadius: 4,
        padding: '2px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          backgroundColor: '#fff',
          opacity: speakPulse1,
        }} />
        <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: 1 }}>
          LIVE
        </span>
      </div>
    </div>
  );
};
