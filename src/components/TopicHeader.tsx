import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';

interface TopicHeaderProps {
  topic: string;
  sessionNumber: number;
  language: string;
  sceneType?: string;
}

const SCENE_LABELS: Record<string, { icon: string; label: string; color: string }> = {
  title: { icon: '\u{1F3AC}', label: 'Intro', color: COLORS.saffron },
  text: { icon: '\u{1F4DD}', label: 'Concept', color: COLORS.indigo },
  code: { icon: '\u{1F4BB}', label: 'Code', color: COLORS.teal },
  diagram: { icon: '\u{1F4CA}', label: 'Diagram', color: COLORS.indigo },
  table: { icon: '\u{1F5C2}', label: 'Compare', color: COLORS.teal },
  interview: { icon: '\u{1F3AF}', label: 'Interview Tip', color: COLORS.gold },
  review: { icon: '\u{2753}', label: 'Quiz', color: COLORS.saffron },
  summary: { icon: '\u{1F3C6}', label: 'Summary', color: COLORS.gold },
};

const TopicHeader: React.FC<TopicHeaderProps> = ({
  topic = '',
  sessionNumber = 1,
  language = '',
  sceneType,
}) => {
  const frame = useCurrentFrame();

  const sceneInfo = sceneType ? SCENE_LABELS[sceneType] : null;

  // Subtle pulse for the scene type label
  const labelPulse = interpolate(
    Math.sin(frame * 0.06),
    [-1, 1],
    [0.85, 1],
  );

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 32px',
          backgroundColor: `${COLORS.dark}DD`,
          backdropFilter: 'blur(8px)',
          fontFamily: FONTS.text,
          borderBottom: `1px solid ${COLORS.gray}10`,
        }}
      >
        {/* Left side: topic + scene type */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              fontSize: SIZES.caption,
              color: COLORS.gray,
              fontWeight: 500,
            }}
          >
            {topic}
          </div>

          {/* Dynamic scene type label */}
          {sceneInfo && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                backgroundColor: `${sceneInfo.color}15`,
                padding: '3px 10px',
                borderRadius: 4,
                border: `1px solid ${sceneInfo.color}22`,
                opacity: labelPulse,
              }}
            >
              <span style={{ fontSize: 11 }}>{sceneInfo.icon}</span>
              <span
                style={{
                  fontSize: SIZES.caption - 2,
                  fontFamily: FONTS.code,
                  color: sceneInfo.color,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                {sceneInfo.label}
              </span>
            </div>
          )}
        </div>

        {/* Right side: session + language badges */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div
            style={{
              fontSize: SIZES.caption,
              color: COLORS.saffron,
              fontWeight: 600,
              backgroundColor: `${COLORS.saffron}22`,
              padding: '4px 12px',
              borderRadius: 6,
            }}
          >
            Session {sessionNumber}
          </div>

          <div
            style={{
              fontSize: SIZES.caption,
              color: COLORS.teal,
              fontWeight: 600,
              backgroundColor: `${COLORS.teal}22`,
              padding: '4px 12px',
              borderRadius: 6,
            }}
          >
            {language}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default TopicHeader;
