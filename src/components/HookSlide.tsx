import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate, Easing } from 'remotion';
import { COLORS, FONTS } from '../lib/theme';
import { fadeIn } from '../lib/animations';

interface HookSlideProps {
  hookText: string;
  startFrame?: number;
}

const HookSlide: React.FC<HookSlideProps> = ({
  hookText,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();

  const opacity = fadeIn(frame, startFrame, 20);

  // Pulse/zoom animation: scale from 0.9 to 1.05 and back
  const scale = interpolate(
    frame,
    [startFrame, startFrame + 30, startFrame + 60, startFrame + 90],
    [0.9, 1.05, 1.0, 1.02],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    }
  );

  // Subtle glow pulse
  const glowIntensity = interpolate(
    frame,
    [startFrame, startFrame + 45, startFrame + 90],
    [0, 1, 0.6],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0C0A15',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '80px',
        fontFamily: FONTS.heading,
      }}
    >
      {/* Dramatic accent background glow */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.saffron}22 0%, transparent 70%)`,
          opacity: glowIntensity,
          filter: 'blur(80px)',
        }}
      />

      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          fontSize: 80,
          fontWeight: 900,
          color: COLORS.saffron,
          textAlign: 'center',
          lineHeight: 1.2,
          maxWidth: '90%',
          textShadow: `0 0 ${40 * glowIntensity}px ${COLORS.saffron}66`,
          zIndex: 1,
        }}
      >
        {hookText}
      </div>
    </AbsoluteFill>
  );
};

export default HookSlide;
