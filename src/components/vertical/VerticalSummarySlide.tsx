import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate,
  spring,
} from 'remotion';
import { FONTS } from '../../lib/theme';

interface VerticalSummarySlideProps {
  takeaways?: string[];
  topic?: string;
  sessionNumber?: number;
  sceneIndex?: number;
  sceneStartFrame?: number;
  startFrame?: number;
  templateId?: string;
  visualBeats?: any[];
}

const BG = '#0C0A15';
const SAFFRON = '#E85D26';
const GOLD = '#FDB813';
const TEAL = '#1DD1A1';

/**
 * Native vertical summary/checklist — shows key takeaways with animated checkmarks.
 * 1080x1920, dark theme.
 */
export const VerticalSummarySlide: React.FC<VerticalSummarySlideProps> = ({
  takeaways = [],
  topic = '',
  sessionNumber = 1,
  sceneStartFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - sceneStartFrame);

  const headerSpring = spring({ frame: local, fps, config: { damping: 18, stiffness: 200, mass: 0.5 } });
  const items = takeaways.slice(0, 5);

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* Top gradient */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 50% 20%, rgba(29,209,161,0.08) 0%, transparent 55%)`,
      }} />

      {/* Header */}
      <div style={{
        position: 'absolute', top: 220, left: 60, right: 140,
        opacity: interpolate(headerSpring, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(headerSpring, [0, 1], [15, 0])}px)`,
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          backgroundColor: `${TEAL}18`, border: `2px solid ${TEAL}`,
          borderRadius: 40, padding: '10px 24px',
        }}>
          <span style={{
            fontFamily: FONTS.heading, fontSize: 26, fontWeight: 700,
            color: TEAL, letterSpacing: 2, textTransform: 'uppercase' as const,
          }}>
            Key Takeaways
          </span>
        </div>

        <div style={{
          marginTop: 24,
          fontFamily: FONTS.heading, fontSize: 44, fontWeight: 900,
          color: '#FFFFFF', lineHeight: 1.2,
        }}>
          {topic} — Session {sessionNumber}
        </div>
        <div style={{
          width: 60, height: 4, borderRadius: 2, marginTop: 16,
          background: `linear-gradient(90deg, ${TEAL}, ${GOLD})`,
        }} />
      </div>

      {/* Checklist items */}
      <div style={{
        position: 'absolute', top: 480, left: 60, right: 140,
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        {items.map((item, i) => {
          const delay = 20 + i * 12;
          const s = spring({
            frame: Math.max(0, local - delay), fps,
            config: { damping: 16, stiffness: 120, mass: 0.7 },
          });
          // Checkmark appears after item slides in
          const checkDelay = delay + 15;
          const checkS = spring({
            frame: Math.max(0, local - checkDelay), fps,
            config: { damping: 12, stiffness: 300, mass: 0.3 },
          });

          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 18,
              padding: '18px 22px',
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderRadius: 14,
              borderLeft: `4px solid ${[TEAL, SAFFRON, GOLD, TEAL, SAFFRON][i % 5]}`,
              opacity: interpolate(s, [0, 1], [0, 1]),
              transform: `translateX(${interpolate(s, [0, 1], [50, 0])}px)`,
            }}>
              {/* Animated checkmark */}
              <div style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: `${TEAL}22`, border: `2px solid ${TEAL}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transform: `scale(${interpolate(checkS, [0, 1], [0, 1])})`,
              }}>
                <span style={{
                  fontSize: 22, color: TEAL,
                  opacity: interpolate(checkS, [0, 1], [0, 1]),
                }}>✓</span>
              </div>

              <span style={{
                fontFamily: FONTS.text, fontSize: 36, fontWeight: 500,
                color: 'rgba(255,255,255,0.9)', lineHeight: 1.4, flex: 1,
              }}>
                {item}
              </span>
            </div>
          );
        })}
      </div>

      {/* Practice CTA at bottom */}
      <div style={{
        position: 'absolute', bottom: 480, left: 60, right: 140,
        opacity: interpolate(
          spring({ frame: Math.max(0, local - 80), fps, config: { damping: 14, stiffness: 100, mass: 0.8 } }),
          [0, 1], [0, 1],
        ),
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: FONTS.heading, fontSize: 30, fontWeight: 700,
          color: GOLD, letterSpacing: 0.5,
        }}>
          Practice at guru-sishya.in
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default VerticalSummarySlide;
