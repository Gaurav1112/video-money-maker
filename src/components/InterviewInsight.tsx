import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, springIn, springScale, wiggle } from '../lib/animations';

interface InterviewInsightProps {
  insight: string;
  tip: string;
  startFrame?: number;
}

const InterviewInsight: React.FC<InterviewInsightProps> = ({
  insight,
  tip,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();

  const cardSpring = springIn(frame, startFrame);
  const scale = springScale(frame, startFrame);

  // Wiggle/shake on entry
  const shakeX = wiggle(frame, startFrame, 5, 0.6);

  // Animated border - "drawing itself" via dashoffset simulation
  const borderProgress = interpolate(
    frame,
    [startFrame, startFrame + 40],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Icon pulse
  const iconScale = interpolate(
    frame,
    [startFrame + 10, startFrame + 25, startFrame + 40, startFrame + 55, startFrame + 70],
    [0, 1.3, 1.0, 1.15, 1.0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Gold glow pulse
  const glowOpacity = interpolate(
    frame,
    [startFrame, startFrame + 30, startFrame + 60],
    [0, 0.4, 0.2],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, #0F0C08 0%, #0C0A15 60%, #100C06 100%)`,
        justifyContent: 'center',
        alignItems: 'center',
        padding: '80px 100px',
        fontFamily: FONTS.text,
      }}
    >
      {/* Warm gold background glow */}
      <div
        style={{
          position: 'absolute',
          width: 900,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${COLORS.gold}12, ${COLORS.saffron}06, transparent 70%)`,
          opacity: glowOpacity,
          filter: 'blur(60px)',
        }}
      />
      {/* Secondary warm tint */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(ellipse at 20% 80%, ${COLORS.gold}06, transparent 60%)`,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          opacity: cardSpring,
          transform: `translateX(${shakeX}px) scale(${scale})`,
          position: 'relative',
          maxWidth: 900,
          width: '100%',
        }}
      >
        {/* Animated border layers */}
        {/* Top border */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${borderProgress * 100}%`,
            height: 3,
            backgroundColor: COLORS.gold,
            borderRadius: '16px 0 0 0',
          }}
        />
        {/* Right border */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 3,
            height: `${Math.max(0, (borderProgress - 0.25) / 0.25) * 100}%`,
            backgroundColor: COLORS.gold,
          }}
        />
        {/* Bottom border */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: `${Math.max(0, (borderProgress - 0.5) / 0.25) * 100}%`,
            height: 3,
            backgroundColor: COLORS.gold,
            transformOrigin: 'right',
          }}
        />
        {/* Left border */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: 3,
            height: `${Math.max(0, (borderProgress - 0.75) / 0.25) * 100}%`,
            backgroundColor: COLORS.gold,
            transformOrigin: 'bottom',
          }}
        />

        {/* Card content */}
        <div
          style={{
            borderRadius: 16,
            padding: '48px 56px',
            backgroundColor: `${COLORS.darkAlt}`,
            boxShadow: `0 0 60px ${COLORS.gold}11, inset 0 0 30px ${COLORS.gold}05`,
          }}
        >
          {/* Header with pulsing icon */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 28,
            }}
          >
            {/* Star/lightbulb icon */}
            <div
              style={{
                fontSize: 32,
                transform: `scale(${iconScale})`,
                filter: `drop-shadow(0 0 8px ${COLORS.gold}66)`,
              }}
            >
              &#9733;
            </div>
            <div
              style={{
                fontSize: SIZES.heading3,
                fontWeight: 700,
                color: COLORS.gold,
                fontFamily: FONTS.heading,
              }}
            >
              Interview Insight
            </div>
          </div>

          <div
            style={{
              fontSize: SIZES.body + 2,
              color: COLORS.white,
              lineHeight: 1.6,
              marginBottom: 24,
              opacity: fadeIn(frame, startFrame + 15),
            }}
          >
            {insight}
          </div>

          <div
            style={{
              fontSize: SIZES.body,
              color: COLORS.teal,
              lineHeight: 1.5,
              fontStyle: 'italic',
              borderTop: `1px solid ${COLORS.gold}44`,
              paddingTop: 20,
              opacity: fadeIn(frame, startFrame + 25),
            }}
          >
            {tip}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default InterviewInsight;
