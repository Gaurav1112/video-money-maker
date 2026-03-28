import React from 'react';
import { useCurrentFrame, AbsoluteFill, spring, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../lib/theme';
import { fadeIn, slideUp } from '../lib/animations';

interface OutroSlideProps {
  topic?: string;
  nextTopic?: string;
  durationInFrames?: number; // default 150 (5 seconds)
}

const OutroSlide: React.FC<OutroSlideProps> = ({
  topic = '',
  nextTopic,
  durationInFrames = 150,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({ frame, fps, config: { damping: 10, stiffness: 80 } });

  return (
    <AbsoluteFill style={{
      backgroundColor: COLORS.dark,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        width: 600,
        height: 600,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${COLORS.saffron}15, transparent 70%)`,
        filter: 'blur(80px)',
      }} />

      {/* Thank you message */}
      <div style={{
        fontSize: 48,
        fontFamily: FONTS.heading,
        fontWeight: 800,
        color: COLORS.white,
        opacity: fadeIn(frame, 0, 30),
        transform: `translateY(${slideUp(frame, 0, 30)}px)`,
        marginBottom: 20,
      }}>
        Thanks for watching!
      </div>

      {/* Brand */}
      <div style={{
        fontSize: 64,
        fontFamily: FONTS.heading,
        fontWeight: 900,
        transform: `scale(${logoSpring})`,
        marginBottom: 30,
      }}>
        <span style={{ color: COLORS.saffron }}>Guru</span>
        <span style={{ color: COLORS.gold }}> Sishya</span>
      </div>

      {/* CTA Cards */}
      <div style={{
        display: 'flex',
        gap: 30,
        opacity: fadeIn(frame, 30, 30),
        transform: `translateY(${slideUp(frame, 30, 40)}px)`,
      }}>
        {/* Subscribe CTA */}
        <div style={{
          background: COLORS.saffron,
          color: COLORS.white,
          padding: '16px 40px',
          borderRadius: 12,
          fontSize: 22,
          fontFamily: FONTS.text,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          Subscribe for Daily Lessons
        </div>

        {/* Website CTA */}
        <div style={{
          background: `${COLORS.teal}20`,
          border: `2px solid ${COLORS.teal}`,
          color: COLORS.teal,
          padding: '16px 40px',
          borderRadius: 12,
          fontSize: 22,
          fontFamily: FONTS.text,
          fontWeight: 700,
        }}>
          guru-sishya.in
        </div>
      </div>

      {/* Next topic teaser */}
      {nextTopic && (
        <div style={{
          marginTop: 40,
          opacity: fadeIn(frame, 60, 30),
          fontSize: 20,
          fontFamily: FONTS.text,
          color: COLORS.gray,
        }}>
          Next up: <span style={{ color: COLORS.gold, fontWeight: 600 }}>{nextTopic}</span>
        </div>
      )}

      {/* Empathy message */}
      <div style={{
        position: 'absolute',
        bottom: 60,
        fontSize: 18,
        fontFamily: FONTS.text,
        color: COLORS.gray,
        opacity: fadeIn(frame, 80, 30),
        fontStyle: 'italic',
      }}>
        "Your dream job is one interview away. Keep learning."
      </div>
    </AbsoluteFill>
  );
};

export default OutroSlide;
