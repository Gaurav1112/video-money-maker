import React from 'react';
import { useCurrentFrame, AbsoluteFill, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS, FONTS } from '../lib/theme';
import {
  fadeIn,
  slideUp,
  springIn,
  springScale,
  pulseGlow,
  stagger,
} from '../lib/animations';

interface OutroSlideProps {
  topic?: string;
  nextTopic?: string;
  takeaways?: string[];
  learnedPercent?: number; // 0–100, shown in progress bar
  durationInFrames?: number; // default 150 (5 seconds)
}

// Frame timing (at 30fps)
// 0–30   (0–1s)  : Takeaways animate in
// 30–60  (1–2s)  : Feature highlights animate in
// 60–90  (2–3s)  : CTA (URL + button) animate in
// 90–150 (3–5s)  : Subscribe + next episode tease animate in

const DEFAULT_TAKEAWAYS = [
  'You can explain this concept clearly',
  'You know the key trade-offs and edge cases',
  'You\'re ready for interview questions on this topic',
];

const FEATURES = [
  { icon: '📚', label: '141 Topics' },
  { icon: '❓', label: '1,988 Questions' },
  { icon: '💻', label: 'Code Playground' },
  { icon: '🎯', label: 'Mock Interviews' },
];

const OutroSlide: React.FC<OutroSlideProps> = ({
  topic = '',
  nextTopic,
  takeaways = DEFAULT_TAKEAWAYS,
  learnedPercent = 85,
  durationInFrames = 150,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Pulsing glow for the CTA URL
  const glowPulse = pulseGlow(frame, 0.1, 0.4, 1.0);

  // Subscribe icon pulse (starts at frame 90)
  const subscribePulse = frame >= 90
    ? pulseGlow(frame, 0.15, 0.7, 1.0)
    : 0;

  // ── Bell RING animation (oscillating rotation) ────────────────────────────
  const bellRingFrame = Math.max(0, frame - 90);
  const bellRotation = frame >= 90
    ? Math.sin(bellRingFrame * 0.8) * Math.max(0, 25 - bellRingFrame * 0.5)
    : 0;

  // Scale for subscribe bell icon
  const subscribeScale = frame >= 90
    ? 0.9 + springIn(frame, 90, fps) * 0.1
    : 0.9;

  // ── Progress bar: "You learned X% of {topic}" ────────────────────────────
  const progressBarWidth = interpolate(frame, [5, 40], [0, learnedPercent], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Shimmer sweep on CTA button ───────────────────────────────────────────
  const shimmerX = interpolate(frame % 60, [0, 60], [-100, 400], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Animated arrow for "Next Episode" card ────────────────────────────────
  const arrowBounce = frame >= 100
    ? Math.sin((frame - 100) * 0.15) * 6
    : 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bgBase,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 48,
        paddingLeft: 80,
        paddingRight: 80,
        overflow: 'hidden',
      }}
    >
      {/* ── Deep background ambient glows ── */}
      <div
        style={{
          position: 'absolute',
          top: -200,
          left: -200,
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.indigo}18, transparent 70%)`,
          filter: 'blur(100px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -150,
          right: -100,
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.saffron}14, transparent 70%)`,
          filter: 'blur(100px)',
          pointerEvents: 'none',
        }}
      />

      {/* ── Progress bar: "You learned X% of {topic}" ── */}
      <div style={{
        width: '100%',
        opacity: fadeIn(frame, 0, 15),
        transform: `translateY(${slideUp(frame, 0, 15, 30)}px)`,
        marginBottom: 20,
      }}>
        <div style={{
          fontSize: 15, fontFamily: FONTS.text, fontWeight: 600,
          color: COLORS.gray, marginBottom: 8,
        }}>
          You learned <span style={{ color: COLORS.teal, fontWeight: 800 }}>{Math.round(progressBarWidth)}%</span>
          {topic ? ` of ${topic}` : ''}
        </div>
        <div style={{
          width: '100%', height: 8, borderRadius: 4,
          background: `${COLORS.darkAlt}`, overflow: 'hidden',
          border: `1px solid ${COLORS.indigo}30`,
        }}>
          <div style={{
            width: `${progressBarWidth}%`, height: '100%', borderRadius: 4,
            background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.gold})`,
            boxShadow: `0 0 12px ${COLORS.teal}60`,
          }} />
        </div>
      </div>

      {/* ── Section 1 (0–1s): What You Learned ── */}
      <div
        style={{
          width: '100%',
          opacity: fadeIn(frame, 0, 20),
          transform: `translateY(${slideUp(frame, 0, 20, 40)}px)`,
          marginBottom: 32,
        }}
      >
        {/* Section label */}
        <div
          style={{
            fontSize: 14,
            fontFamily: FONTS.text,
            fontWeight: 700,
            letterSpacing: 3,
            color: COLORS.teal,
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          What You Learned
        </div>

        {/* Takeaway rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {takeaways.slice(0, 3).map((takeaway, i) => {
            const delay = stagger(i, 4, 8); // 0, 8, 16
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  opacity: fadeIn(frame, delay, 18),
                  transform: `translateX(${
                    -30 + springIn(frame, delay, fps) * 30
                  }px)`,
                }}
              >
                {/* Checkmark badge — spring bounce */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.indigo})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 14,
                    fontWeight: 800,
                    color: COLORS.textPrimary,
                    transform: `scale(${springScale(frame, delay, fps)})`,
                    boxShadow: `0 0 8px ${COLORS.teal}40`,
                  }}
                >
                  ✓
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontFamily: FONTS.text,
                    fontWeight: 500,
                    color: COLORS.textPrimary,
                    lineHeight: 1.3,
                  }}
                >
                  {takeaway}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Divider ── */}
      <div
        style={{
          width: '100%',
          height: 1,
          background: `linear-gradient(to right, transparent, ${COLORS.indigo}50, transparent)`,
          marginBottom: 28,
          opacity: fadeIn(frame, 25, 15),
        }}
      />

      {/* ── Section 2 (1–2s): Feature highlights ── */}
      <div
        style={{
          width: '100%',
          opacity: fadeIn(frame, 30, 20),
          transform: `translateY(${slideUp(frame, 30, 20, 35)}px)`,
          marginBottom: 32,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontFamily: FONTS.text,
            fontWeight: 700,
            letterSpacing: 3,
            color: COLORS.gold,
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          Guru Sishya — Everything You Need
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {FEATURES.map((feat, i) => {
            const delay = stagger(i, 34, 6);
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: `${COLORS.darkAlt}`,
                  border: `1px solid ${COLORS.indigo}40`,
                  borderRadius: 10,
                  paddingTop: 9,
                  paddingBottom: 9,
                  paddingLeft: 16,
                  paddingRight: 16,
                  opacity: fadeIn(frame, delay, 15),
                  transform: `scale(${springScale(frame, delay, fps)})`,
                }}
              >
                <span style={{ fontSize: 18 }}>{feat.icon}</span>
                <span
                  style={{
                    fontSize: 17,
                    fontFamily: FONTS.text,
                    fontWeight: 600,
                    color: COLORS.textPrimary,
                  }}
                >
                  {feat.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 3 (2–3s): CTA — glowing URL + Start Practicing ── */}
      <div
        style={{
          width: '100%',
          opacity: fadeIn(frame, 60, 20),
          transform: `translateY(${slideUp(frame, 60, 20, 35)}px)`,
          marginBottom: 28,
        }}
      >
        {/* Glowing URL */}
        <div
          style={{
            fontSize: 42,
            fontFamily: FONTS.heading,
            fontWeight: 900,
            color: COLORS.textPrimary,
            textShadow: `0 0 ${20 + glowPulse * 30}px ${COLORS.teal}${
              Math.round(glowPulse * 200).toString(16).padStart(2, '0')
            }, 0 0 60px ${COLORS.teal}30`,
            letterSpacing: -0.5,
            marginBottom: 16,
          }}
        >
          <span style={{ color: COLORS.teal }}>guru-sishya</span>
          <span style={{ color: COLORS.gray }}>.in</span>
        </div>

        {/* "Start Practicing FREE" button with shimmer sweep */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            background: `linear-gradient(135deg, ${COLORS.saffron}, #FF8C42)`,
            borderRadius: 12,
            paddingTop: 14,
            paddingBottom: 14,
            paddingLeft: 32,
            paddingRight: 32,
            boxShadow: `0 4px 32px ${COLORS.saffron}50`,
            transform: `scale(${0.95 + glowPulse * 0.05})`,
            position: 'relative' as const,
            overflow: 'hidden',
          }}
        >
          {/* Shimmer sweep — bright line moving across */}
          <div style={{
            position: 'absolute',
            top: 0, bottom: 0,
            left: shimmerX,
            width: 60,
            background: `linear-gradient(90deg, transparent, ${COLORS.textPrimary}50, ${COLORS.textPrimary}80, ${COLORS.textPrimary}50, transparent)`,
            transform: 'skewX(-20deg)',
            pointerEvents: 'none',
          }} />
          <span style={{ fontSize: 22 }}>🚀</span>
          <span
            style={{
              fontSize: 22,
              fontFamily: FONTS.text,
              fontWeight: 800,
              color: COLORS.textPrimary,
              letterSpacing: 0.3,
            }}
          >
            Start Practicing FREE
          </span>
        </div>

        {/* Social proof */}
        <div
          style={{
            marginTop: 12,
            fontSize: 15,
            fontFamily: FONTS.text,
            color: COLORS.gray,
            fontStyle: 'italic',
            opacity: fadeIn(frame, 75, 15),
          }}
        >
          Join 10,000+ students preparing for their dream job with Guru Sishya
        </div>
      </div>

      {/* ── Section 4 (3–5s): Subscribe CTA + Next Episode Tease ── */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 30,
          opacity: fadeIn(frame, 90, 20),
          transform: `translateY(${slideUp(frame, 90, 20, 35)}px)`,
        }}
      >
        {/* Subscribe block */}
        <div
          style={{
            flex: nextTopic ? '0 0 auto' : '1',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* Subscribe button row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: `${COLORS.red}15`,
              border: `2px solid ${COLORS.red}`,
              borderRadius: 12,
              paddingTop: 13,
              paddingBottom: 13,
              paddingLeft: 22,
              paddingRight: 22,
              boxShadow: `0 0 ${16 + subscribePulse * 16}px ${COLORS.red}40`,
            }}
          >
            {/* Ringing bell — oscillating rotation */}
            <span
              style={{
                fontSize: 26,
                transform: `scale(${subscribeScale}) rotate(${bellRotation}deg)`,
                transformOrigin: '50% 15%',
                display: 'inline-block',
                opacity: 0.5 + subscribePulse * 0.5,
              }}
            >
              🔔
            </span>
            <div>
              <div
                style={{
                  fontSize: 18,
                  fontFamily: FONTS.text,
                  fontWeight: 800,
                  color: COLORS.textPrimary,
                }}
              >
                Subscribe
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontFamily: FONTS.text,
                  fontWeight: 400,
                  color: COLORS.gray,
                  marginTop: 2,
                }}
              >
                {topic
                  ? `Get the complete ${topic} series`
                  : 'Daily interview prep lessons'}
              </div>
            </div>
          </div>
        </div>

        {/* Next Episode card with animated arrow */}
        {nextTopic && (
          <div
            style={{
              flex: 1,
              background: `${COLORS.darkAlt}`,
              border: `1px solid ${COLORS.gold}40`,
              borderRadius: 14,
              paddingTop: 14,
              paddingBottom: 14,
              paddingLeft: 20,
              paddingRight: 20,
              opacity: fadeIn(frame, 100, 20),
              transform: `translateX(${
                40 - springIn(frame, 100, fps) * 40
              }px)`,
              boxShadow: `0 2px 24px ${COLORS.gold}15`,
              position: 'relative' as const,
            }}
          >
            {/* "NEXT EPISODE" label */}
            <div style={{
              fontSize: 11, fontFamily: FONTS.text, fontWeight: 700,
              letterSpacing: 3, color: COLORS.gold, textTransform: 'uppercase',
              marginBottom: 6,
            }}>
              ▶ Next Episode
            </div>

            {/* Next topic title */}
            <div style={{
              fontSize: 20, fontFamily: FONTS.heading, fontWeight: 700,
              color: COLORS.textPrimary, lineHeight: 1.3, marginBottom: 8,
            }}>
              {nextTopic}
            </div>

            {/* Mini preview blurb */}
            <div style={{
              fontSize: 13, fontFamily: FONTS.text, color: COLORS.gray, lineHeight: 1.4,
            }}>
              Concepts · Patterns · Interview Questions
            </div>

            {/* Play arrow with bounce animation */}
            <div style={{
              marginTop: 10, display: 'flex', alignItems: 'center', gap: 6,
              transform: `translateX(${arrowBounce}px)`,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.saffron})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, boxShadow: `0 0 12px ${COLORS.gold}40`,
              }}>
                ▶
              </div>
              <span style={{
                fontSize: 13, fontFamily: FONTS.text, color: COLORS.gold, fontWeight: 600,
              }}>
                Watch next
              </span>
              {/* Animated arrow pointing right */}
              <span style={{
                fontSize: 18, color: COLORS.gold, marginLeft: 4,
                transform: `translateX(${arrowBounce * 0.5}px)`,
                display: 'inline-block',
              }}>
                →
              </span>
            </div>
          </div>
        )}

        {/* ── QR Code placeholder — "Scan to practice" ── */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          opacity: fadeIn(frame, 105, 20),
          transform: `scale(${springScale(frame, 105, fps)})`,
        }}>
          {/* Stylized QR square */}
          <div style={{
            width: 72, height: 72, borderRadius: 8,
            border: `3px solid ${COLORS.teal}`,
            background: COLORS.darkAlt,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative' as const, overflow: 'hidden',
            boxShadow: `0 0 16px ${COLORS.teal}30`,
          }}>
            {/* Inner QR pattern squares */}
            {[
              { top: 6, left: 6, size: 16 },
              { top: 6, left: 50, size: 16 },
              { top: 50, left: 6, size: 16 },
            ].map((sq, i) => (
              <div key={`qr-${i}`} style={{
                position: 'absolute', top: sq.top, left: sq.left,
                width: sq.size, height: sq.size, borderRadius: 2,
                border: `2px solid ${COLORS.teal}`,
                background: `${COLORS.teal}20`,
              }}>
                <div style={{
                  position: 'absolute', top: 3, left: 3,
                  width: 6, height: 6, borderRadius: 1,
                  background: COLORS.teal,
                }} />
              </div>
            ))}
            {/* Center dots pattern */}
            {[
              { top: 28, left: 28 }, { top: 28, left: 38 },
              { top: 38, left: 28 }, { top: 38, left: 38 },
              { top: 33, left: 48 }, { top: 48, left: 33 },
            ].map((dot, i) => (
              <div key={`qrd-${i}`} style={{
                position: 'absolute', top: dot.top, left: dot.left,
                width: 4, height: 4, borderRadius: 1,
                background: COLORS.teal, opacity: 0.7,
              }} />
            ))}
          </div>
          <div style={{
            fontSize: 10, fontFamily: FONTS.text, fontWeight: 600,
            color: COLORS.gray, letterSpacing: 1, textTransform: 'uppercase',
          }}>
            Scan to practice
          </div>
        </div>
      </div>

      {/* ── Bottom bar: brand mark + tagline ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 52,
          background: `linear-gradient(to right, ${COLORS.indigo}20, ${COLORS.saffron}15, ${COLORS.teal}20)`,
          borderTop: `1px solid ${COLORS.indigo}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 80,
          paddingRight: 80,
          opacity: fadeIn(frame, 110, 20),
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontFamily: FONTS.heading,
            fontWeight: 900,
          }}
        >
          <span style={{ color: COLORS.saffron }}>Guru</span>
          <span style={{ color: COLORS.gold }}> Sishya</span>
        </div>
        <div
          style={{
            fontSize: 14,
            fontFamily: FONTS.text,
            color: COLORS.gray,
            fontStyle: 'italic',
          }}
        >
          "Your dream job is one interview away. Keep learning."
        </div>
        <div
          style={{
            fontSize: 14,
            fontFamily: FONTS.text,
            color: COLORS.teal,
            fontWeight: 600,
          }}
        >
          guru-sishya.in
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default OutroSlide;
