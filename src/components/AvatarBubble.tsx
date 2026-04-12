import React from 'react';
import { useCurrentFrame, useVideoConfig, Img, OffthreadVideo, interpolate, staticFile, Loop } from 'remotion';
import { COLORS } from '../lib/theme';
import { getWobble } from '../lib/wobble';

/**
 * Rhubarb mouth shapes mapped to mouth openness (0 = closed, 1 = wide open)
 * A = Closed (rest), B = Slightly open, C = Open, D = Wide open
 * E = Slight smile, F = "F/V" sound, G = "TH" sound, H = "L" sound, X = Silence
 */
const MOUTH_OPENNESS: Record<string, number> = {
  'X': 0,    // silence — closed
  'A': 0.1,  // rest position — barely open
  'B': 0.35, // consonant — slightly open
  'C': 0.55, // vowel — open
  'D': 0.85, // wide vowel — wide open
  'E': 0.3,  // slight smile
  'F': 0.2,  // F/V sound
  'G': 0.4,  // TH sound
  'H': 0.45, // L sound
};

interface MouthCue {
  start: number;
  end: number;
  value: string; // A-H, X
}

interface AvatarBubbleProps {
  avatarVideo?: string;
  avatarPhoto?: string;
  mouthCues?: MouthCue[];  // from Rhubarb lip sync
  startFrame?: number;
  endFrame?: number;
  audioOffset?: number;    // seconds offset into master audio
}

const SIZE = 220;

export const AvatarBubble: React.FC<AvatarBubbleProps> = ({
  avatarVideo,
  avatarPhoto,
  mouthCues,
  startFrame = 0,
  endFrame = Infinity,
  audioOffset = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < startFrame || frame > endFrame) return null;

  const localFrame = frame - startFrame;
  const totalFrames = endFrame - startFrame;
  const currentTime = localFrame / fps;

  // Fade in/out
  const opacity = interpolate(localFrame, [0, 30, totalFrames - 30, totalFrames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Subtle breathing + vertical float
  const wobble = getWobble(frame, 999);
  const breathe = 1 + wobble.rotate * 0.012;
  const floatY = Math.sin(frame * 0.03) * 2;

  // Get current mouth shape from Rhubarb cues
  let mouthOpen = 0;
  if (mouthCues && mouthCues.length > 0) {
    const adjustedTime = currentTime + audioOffset;
    const activeCue = mouthCues.find(c => adjustedTime >= c.start && adjustedTime < c.end);
    if (activeCue) {
      mouthOpen = MOUTH_OPENNESS[activeCue.value] || 0;
    }
  } else {
    // Fallback: simulate speaking with sine wave (when no cues available)
    mouthOpen = Math.max(0, Math.sin(frame * 0.25) * 0.4 + 0.1);
  }

  // Smooth the mouth animation
  const smoothMouth = interpolate(mouthOpen, [0, 1], [0, 1]);

  // Speaking ring intensity follows mouth openness
  const ringIntensity = 0.15 + mouthOpen * 0.6;

  return (
    <div style={{
      position: 'absolute',
      bottom: 80,
      right: 40,
      width: SIZE + 30,
      height: SIZE + 30,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 80,
      opacity,
    }}>
      {/* Speaking pulse ring — intensity follows mouth openness */}
      <div style={{
        position: 'absolute',
        width: SIZE + 16,
        height: SIZE + 16,
        borderRadius: '50%',
        border: `2px solid ${COLORS.saffron}`,
        opacity: ringIntensity,
        transform: `scale(${1 + mouthOpen * 0.06})`,
        transition: 'transform 0.05s, opacity 0.05s',
      }} />

      {/* Avatar circle */}
      <div style={{
        width: SIZE,
        height: SIZE,
        borderRadius: '50%',
        overflow: 'hidden',
        transform: `scale(${breathe}) translateY(${floatY}px)`,
        border: `3px solid ${COLORS.saffron}`,
        boxShadow: `0 0 ${12 + mouthOpen * 8}px ${COLORS.saffron}33, 0 8px 32px rgba(0,0,0,0.15)`,
      }}>
        {avatarVideo ? (
          <Loop durationInFrames={450}>
            <OffthreadVideo
              src={staticFile(avatarVideo)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              muted
            />
          </Loop>
        ) : avatarPhoto ? (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <Img
              src={staticFile(avatarPhoto)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {/* Mouth animation overlay — semi-transparent dark oval that scales with mouth openness */}
            <div style={{
              position: 'absolute',
              bottom: '18%',
              left: '50%',
              transform: `translateX(-50%) scaleY(${0.3 + smoothMouth * 0.7})`,
              width: SIZE * 0.28,
              height: SIZE * 0.12,
              borderRadius: '50%',
              backgroundColor: 'rgba(30, 20, 15, 0.7)',
              transition: 'transform 0.03s',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
            }} />
          </div>
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: `linear-gradient(135deg, ${COLORS.saffron}40, ${COLORS.teal}40)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column',
          }}>
            <svg width="90" height="90" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" fill={`${COLORS.white}cc`} />
              <path d="M4 21c0-4.418 3.582-8 8-8s8 3.582 8 8" fill={`${COLORS.white}99`} />
            </svg>
            <div style={{ fontSize: 24, fontWeight: 700, color: `${COLORS.white}cc`, marginTop: -4, letterSpacing: '0.1em' }}>GS</div>
          </div>
        )}
      </div>

      {/* Name badge */}
      <div style={{
        position: 'absolute',
        bottom: 2,
        left: '50%',
        transform: 'translateX(-50%)',
        background: COLORS.saffron,
        borderRadius: 6,
        padding: '3px 10px',
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#FFFFFF', letterSpacing: 1 }}>
          GURU SISHYA
        </span>
      </div>
    </div>
  );
};
