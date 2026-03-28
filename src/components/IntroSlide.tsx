import React from 'react';
import { useCurrentFrame, AbsoluteFill, spring, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../lib/theme';
import { fadeIn } from '../lib/animations';

interface IntroSlideProps {
  durationInFrames?: number; // default 90 (3 seconds at 30fps)
}

const IntroSlide: React.FC<IntroSlideProps> = ({ durationInFrames = 90 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring animation for logo entrance
  const logoScale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });
  const textOpacity = fadeIn(frame, 20, 30);
  const taglineOpacity = fadeIn(frame, 45, 30);
  // Fade out at the end
  const exitOpacity = frame > durationInFrames - 15 ? 1 - fadeIn(frame, durationInFrames - 15, 15) : 1;

  return (
    <AbsoluteFill style={{
      backgroundColor: COLORS.dark,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: exitOpacity,
    }}>
      {/* Ambient glow behind logo */}
      <div style={{
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${COLORS.saffron}25, ${COLORS.gold}10, transparent 70%)`,
        filter: 'blur(60px)',
      }} />

      {/* Logo / Brand Name */}
      <div style={{
        fontSize: 80,
        fontFamily: FONTS.heading,
        fontWeight: 900,
        transform: `scale(${logoScale})`,
        letterSpacing: -2,
        marginBottom: 16,
        opacity: textOpacity,
      }}>
        <span style={{ color: COLORS.saffron }}>Guru</span>
        <span style={{ color: COLORS.gold }}> Sishya</span>
      </div>

      {/* Tagline */}
      <div style={{
        fontSize: 24,
        fontFamily: FONTS.text,
        fontWeight: 500,
        color: COLORS.gray,
        opacity: taglineOpacity,
        letterSpacing: 4,
        textTransform: 'uppercase',
      }}>
        Master Your Interview
      </div>

      {/* Website */}
      <div style={{
        fontSize: 18,
        fontFamily: FONTS.code,
        color: COLORS.teal,
        opacity: taglineOpacity,
        marginTop: 20,
      }}>
        guru-sishya.in
      </div>

      {/* Subtle animated line */}
      <div style={{
        position: 'absolute',
        bottom: '30%',
        width: fadeIn(frame, 30, 40) * 300,
        height: 2,
        background: `linear-gradient(90deg, transparent, ${COLORS.saffron}, transparent)`,
      }} />
    </AbsoluteFill>
  );
};

export default IntroSlide;
