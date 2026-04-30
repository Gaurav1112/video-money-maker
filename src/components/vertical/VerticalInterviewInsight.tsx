import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate,
  spring,
} from 'remotion';
import { FONTS } from '../../lib/theme';

interface VerticalInterviewInsightProps {
  insight: string;
  tip?: string;
  heading?: string;
  sceneIndex?: number;
  sceneStartFrame?: number;
}

const BG = '#0C0A15';
const SAFFRON = '#E85D26';
const GOLD = '#FDB813';
const TEAL = '#1DD1A1';

/**
 * Native vertical interview insight — full 1080x1920, no scaling.
 * Shows: interviewer question badge + insight text + tip card.
 */
export const VerticalInterviewInsight: React.FC<VerticalInterviewInsightProps> = ({
  insight,
  tip,
  heading,
  sceneStartFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - sceneStartFrame);

  // Derive question from heading
  const question = heading
    ? heading.replace(/^(Interview|Secret|Reality|Check|Anchor|Deep Dive)\s*[-—:.]?\s*/i, '').trim()
    : 'What would you answer?';

  // Animations
  const badgeSpring = spring({ frame: local, fps, config: { damping: 18, stiffness: 200, mass: 0.5 } });
  const insightSpring = spring({ frame: Math.max(0, local - 10), fps, config: { damping: 16, stiffness: 150, mass: 0.6 } });
  const tipSpring = spring({ frame: Math.max(0, local - 25), fps, config: { damping: 14, stiffness: 120, mass: 0.7 } });

  // Split insight into sentences for staggered reveal
  const sentences = insight.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 4);

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* Top glow */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse at 50% 30%, rgba(232,93,38,0.08) 0%, transparent 60%)`,
      }} />

      {/* Interview badge */}
      <div style={{
        position: 'absolute',
        top: 220,
        left: 60,
        right: 140,
        opacity: interpolate(badgeSpring, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(badgeSpring, [0, 1], [20, 0])}px)`,
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          backgroundColor: `${SAFFRON}18`,
          border: `2px solid ${SAFFRON}`,
          borderRadius: 40,
          padding: '12px 28px',
        }}>
          <div style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: SAFFRON,
            boxShadow: `0 0 8px ${SAFFRON}`,
          }} />
          <span style={{
            fontFamily: FONTS.heading,
            fontSize: 28,
            fontWeight: 700,
            color: SAFFRON,
            letterSpacing: 2,
            textTransform: 'uppercase' as const,
          }}>
            Interview Question
          </span>
        </div>
      </div>

      {/* Question text */}
      <div style={{
        position: 'absolute',
        top: 320,
        left: 60,
        right: 140,
        opacity: interpolate(badgeSpring, [0, 1], [0, 1]),
        transform: `scale(${interpolate(badgeSpring, [0, 1], [0.95, 1])})`,
      }}>
        <div style={{
          fontFamily: FONTS.heading,
          fontSize: 52,
          fontWeight: 900,
          color: '#FFFFFF',
          lineHeight: 1.2,
          textShadow: '0 4px 20px rgba(0,0,0,0.6)',
        }}>
          "{question}"
        </div>
        <div style={{
          width: 60,
          height: 4,
          borderRadius: 2,
          background: `linear-gradient(90deg, ${SAFFRON}, ${GOLD})`,
          marginTop: 20,
        }} />
      </div>

      {/* Insight — staggered sentences */}
      <div style={{
        position: 'absolute',
        top: 560,
        left: 60,
        right: 140,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}>
        {sentences.map((sentence, i) => {
          const delay = 10 + i * 12;
          const s = spring({
            frame: Math.max(0, local - delay),
            fps,
            config: { damping: 18, stiffness: 140, mass: 0.6 },
          });
          return (
            <div
              key={i}
              style={{
                opacity: interpolate(s, [0, 1], [0, 1]),
                transform: `translateX(${interpolate(s, [0, 1], [40, 0])}px)`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
                padding: '16px 20px',
                backgroundColor: i === 0 ? 'rgba(232,93,38,0.08)' : 'rgba(255,255,255,0.03)',
                borderRadius: 14,
                borderLeft: `4px solid ${[SAFFRON, GOLD, TEAL, SAFFRON][i % 4]}`,
              }}
            >
              <span style={{
                fontFamily: FONTS.text,
                fontSize: i === 0 ? 40 : 36,
                fontWeight: i === 0 ? 700 : 500,
                color: i === 0 ? '#FFFFFF' : 'rgba(255,255,255,0.9)',
                lineHeight: 1.45,
              }}>
                {sentence}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tip card */}
      {tip && (
        <div style={{
          position: 'absolute',
          bottom: 500,
          left: 60,
          right: 140,
          opacity: interpolate(tipSpring, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(tipSpring, [0, 1], [30, 0])}px)`,
        }}>
          <div style={{
            backgroundColor: `${TEAL}12`,
            border: `1px solid ${TEAL}40`,
            borderRadius: 16,
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: `${TEAL}22`,
              border: `1.5px solid ${TEAL}55`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontFamily: FONTS.heading,
              fontSize: 18,
              fontWeight: 800,
              color: TEAL,
            }}>
              💡
            </div>
            <span style={{
              fontFamily: FONTS.text,
              fontSize: 32,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.85)',
              lineHeight: 1.5,
            }}>
              {tip.length > 150 ? tip.slice(0, 150) + '...' : tip}
            </span>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export default VerticalInterviewInsight;
