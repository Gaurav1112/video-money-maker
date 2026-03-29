import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

const COLORS = {
  saffron: '#E85D26',
  gold: '#FFD700',
  teal: '#20C997',
  dark: '#0C0A15',
  darkAlt: '#1A1625',
  white: '#FFFFFF',
  gray: '#A9ACB3',
  indigo: '#818CF8',
};

interface PlatformPreviewProps {
  topicSlug: string;
  topicName: string;
}

export const PlatformPreview: React.FC<PlatformPreviewProps> = ({
  topicSlug,
  topicName,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance: slide up from below
  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.9 },
  });
  const translateY = interpolate(entrance, [0, 1], [120, 0]);

  // Animated stat counter (counts up over 2 seconds)
  const countProgress = interpolate(frame, [fps * 0.5, fps * 2.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const questionCount = Math.floor(countProgress * 1988);

  // Pulsing glow on FREE badge
  const pulseGlow = interpolate(
    Math.sin(frame * 0.08),
    [-1, 1],
    [0.4, 1],
  );

  const optionLabels = ['A. Round Robin', 'B. Least Connections', 'C. IP Hash', 'D. Random'];

  return (
    <div
      style={{
        width: 380,
        transform: `translateY(${translateY}px)`,
        opacity: entrance,
        borderRadius: 16,
        background: `linear-gradient(145deg, ${COLORS.darkAlt}, ${COLORS.dark})`,
        border: `1.5px solid ${COLORS.indigo}44`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.5)`,
        overflow: 'hidden',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          background: `linear-gradient(90deg, ${COLORS.saffron}22, ${COLORS.gold}11)`,
          borderBottom: `1px solid ${COLORS.indigo}22`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: COLORS.teal,
            boxShadow: `0 0 6px ${COLORS.teal}`,
          }}
        />
        <span style={{ color: COLORS.teal, fontSize: 13, fontWeight: 600 }}>
          guru-sishya.in/{topicSlug}
        </span>
      </div>

      {/* Mock Quiz UI */}
      <div style={{ padding: 16 }}>
        {/* Question */}
        <div
          style={{
            color: COLORS.white,
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 12,
            lineHeight: 1.4,
          }}
        >
          Q: Which algorithm distributes requests equally across all servers?
        </div>

        {/* Options */}
        {optionLabels.map((opt, i) => {
          const isCorrect = i === 0;
          const showAnswer = frame > fps * 2;
          return (
            <div
              key={i}
              style={{
                padding: '8px 12px',
                marginBottom: 6,
                borderRadius: 8,
                background: showAnswer && isCorrect ? `${COLORS.teal}22` : `${COLORS.white}08`,
                border: `1px solid ${showAnswer && isCorrect ? COLORS.teal : `${COLORS.white}15`}`,
                color: showAnswer && isCorrect ? COLORS.teal : COLORS.gray,
                fontSize: 12,
                fontWeight: isCorrect && showAnswer ? 600 : 400,
              }}
            >
              {opt} {showAnswer && isCorrect ? ' \u2713' : ''}
            </div>
          );
        })}

        {/* Progress bar */}
        <div
          style={{
            marginTop: 12,
            height: 4,
            borderRadius: 2,
            background: `${COLORS.white}10`,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: '35%',
              height: '100%',
              borderRadius: 2,
              background: `linear-gradient(90deg, ${COLORS.saffron}, ${COLORS.gold})`,
            }}
          />
        </div>
      </div>

      {/* Footer with stats */}
      <div
        style={{
          padding: '10px 16px',
          borderTop: `1px solid ${COLORS.white}10`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: COLORS.gold, fontSize: 20, fontWeight: 700 }}>
            {questionCount.toLocaleString()}
          </span>
          <span style={{ color: COLORS.gray, fontSize: 11 }}>
            Practice Questions
          </span>
        </div>
        <div
          style={{
            padding: '4px 10px',
            borderRadius: 20,
            background: `${COLORS.teal}22`,
            border: `1px solid ${COLORS.teal}`,
            color: COLORS.teal,
            fontSize: 11,
            fontWeight: 700,
            boxShadow: `0 0 ${12 * pulseGlow}px ${COLORS.teal}44`,
          }}
        >
          100% FREE
        </div>
      </div>
    </div>
  );
};
