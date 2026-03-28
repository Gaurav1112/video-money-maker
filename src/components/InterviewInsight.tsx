import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, slideIn, slideUp, springIn, bounceIn, pulseGlow } from '../lib/animations';

interface InterviewInsightProps {
  insight: string;
  tip: string;
  startFrame?: number;
  endFrame?: number;
  sceneIndex?: number;
  sceneStartFrame?: number;
  animationCues?: unknown[];
}

/**
 * Extracts 2-3 short bullet points from an insight/tip string.
 * Looks for sentence boundaries and picks the most action-oriented ones.
 */
function extractBullets(insight: string, tip: string): string[] {
  const combined = `${insight} ${tip}`;
  // Split on sentence boundaries
  const sentences = combined
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15 && s.length < 100);

  if (sentences.length === 0) return [];

  // Prefer sentences that contain interview-relevant keywords
  const keywords = /\b(always|never|use|avoid|explain|show|demonstrate|mention|focus|remember|key|important|interviewers?|expect)\b/i;
  const ranked = sentences.sort((a, b) => {
    const aMatch = keywords.test(a) ? 1 : 0;
    const bMatch = keywords.test(b) ? 1 : 0;
    return bMatch - aMatch;
  });

  return ranked.slice(0, 3);
}

/**
 * Highlights key phrases in a string by wrapping them in a styled span.
 * Returns an array of React nodes (plain strings + highlighted spans).
 */
function highlightKeyPhrases(text: string): React.ReactNode[] {
  const keywords = [
    'always', 'never', 'key', 'critical', 'important', 'must', 'should',
    'interviewer', 'interviewers', 'expect', 'O(n)', 'O(log n)', 'O(1)',
    'trade-off', 'tradeoff', 'edge case', 'edge cases', 'time complexity',
    'space complexity', 'optimize', 'optimal', 'efficient', 'explain',
  ];
  const pattern = new RegExp(`\\b(${keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');

  const parts = text.split(pattern);
  return parts.map((part, i) => {
    if (keywords.some((k) => k.toLowerCase() === part.toLowerCase())) {
      return (
        <span
          key={i}
          style={{
            color: COLORS.gold,
            fontWeight: 700,
          }}
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

const InterviewInsight: React.FC<InterviewInsightProps> = ({
  insight = '',
  tip = '',
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();

  // ── Animation timing (all relative to startFrame) ──────────────────────
  const headingDelay   = startFrame;
  const insightDelay   = startFrame + 18;
  const proTipDelay    = startFrame + 38;
  const bulletsDelay   = startFrame + 55;

  // Heading: slides down from above
  const headingSlide = slideUp(frame, headingDelay, -50, 35);
  const headingOpacity = fadeIn(frame, headingDelay, 25);

  // Star icon: bounces in
  const iconScale = bounceIn(frame, headingDelay + 5);

  // Insight text: fades in
  const insightOpacity = fadeIn(frame, insightDelay, 30);
  const insightSlide = slideUp(frame, insightDelay, 30, 35);

  // Pro tip card: springs up from below
  const tipSpring = springIn(frame, proTipDelay);
  const tipSlide = slideUp(frame, proTipDelay, 60, 40);
  const tipOpacity = fadeIn(frame, proTipDelay, 25);

  // Bullets: staggered fade-in
  const bullets = extractBullets(insight, tip);

  // Pulsing gold glow on the star
  const starGlow = pulseGlow(frame, 0.1, 0.5, 1.0);

  // Subtle accent line width animation
  const accentWidth = interpolate(
    frame,
    [headingDelay, headingDelay + 45],
    [0, 100],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '48px 56px',
        fontFamily: FONTS.text,
        boxSizing: 'border-box',
        gap: 32,
      }}
    >
      {/* ── 1. HEADING ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          opacity: headingOpacity,
          transform: `translateY(${headingSlide}px)`,
        }}
      >
        {/* Star icon */}
        <div
          style={{
            fontSize: 38,
            transform: `scale(${iconScale})`,
            filter: `drop-shadow(0 0 10px ${COLORS.gold})`,
            opacity: starGlow,
            lineHeight: 1,
          }}
        >
          ★
        </div>

        <div>
          <div
            style={{
              fontSize: SIZES.heading3,
              fontWeight: 800,
              color: COLORS.saffron,
              fontFamily: FONTS.heading,
              letterSpacing: '-0.5px',
              lineHeight: 1,
            }}
          >
            Interview Insight
          </div>
          {/* Animated underline accent */}
          <div
            style={{
              height: 3,
              width: `${accentWidth}%`,
              background: `linear-gradient(90deg, ${COLORS.gold}, ${COLORS.saffron}88)`,
              borderRadius: 2,
              marginTop: 6,
            }}
          />
        </div>
      </div>

      {/* ── 2. KEY INSIGHT — large, clear, one sentence ────────────── */}
      <div
        style={{
          opacity: insightOpacity,
          transform: `translateY(${insightSlide}px)`,
        }}
      >
        <p
          style={{
            fontSize: 30,
            fontWeight: 600,
            color: COLORS.white,
            lineHeight: 1.5,
            margin: 0,
            letterSpacing: '-0.2px',
          }}
        >
          {highlightKeyPhrases(insight)}
        </p>
      </div>

      {/* ── 3. PRO TIP CARD ────────────────────────────────────────── */}
      <div
        style={{
          opacity: tipOpacity * tipSpring,
          transform: `translateY(${tipSlide}px)`,
          background: `linear-gradient(135deg, ${COLORS.teal}18, ${COLORS.teal}08)`,
          border: `2px solid ${COLORS.teal}55`,
          borderLeft: `5px solid ${COLORS.teal}`,
          borderRadius: 14,
          padding: '24px 28px',
        }}
      >
        {/* Card label */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 20,
              lineHeight: 1,
            }}
          >
            💡
          </div>
          <span
            style={{
              fontSize: SIZES.bodySmall,
              fontWeight: 700,
              color: COLORS.teal,
              letterSpacing: '0.8px',
              textTransform: 'uppercase' as const,
            }}
          >
            Pro Tip
          </span>
        </div>

        {/* Tip text */}
        <p
          style={{
            fontSize: SIZES.body,
            color: COLORS.white,
            lineHeight: 1.55,
            margin: 0,
            fontWeight: 400,
          }}
        >
          {highlightKeyPhrases(tip)}
        </p>
      </div>

      {/* ── 4. WHAT INTERVIEWERS WANT — bullet points ──────────────── */}
      {bullets.length > 0 && (
        <div
          style={{
            opacity: fadeIn(frame, bulletsDelay, 25),
          }}
        >
          <div
            style={{
              fontSize: SIZES.bodySmall,
              fontWeight: 700,
              color: COLORS.indigo,
              letterSpacing: '0.6px',
              textTransform: 'uppercase' as const,
              marginBottom: 14,
            }}
          >
            What Interviewers Want
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bullets.map((bullet, i) => {
              const bulletOpacity = fadeIn(frame, bulletsDelay + i * 12, 20);
              const bulletSlide = slideIn(frame, bulletsDelay + i * 12, 30, 25);
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    opacity: bulletOpacity,
                    transform: `translateX(${bulletSlide}px)`,
                  }}
                >
                  {/* Bullet dot */}
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: COLORS.gold,
                      marginTop: 7,
                      flexShrink: 0,
                      boxShadow: `0 0 6px ${COLORS.gold}88`,
                    }}
                  />
                  <span
                    style={{
                      fontSize: SIZES.bodySmall,
                      color: COLORS.gray,
                      lineHeight: 1.5,
                    }}
                  >
                    {bullet}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewInsight;
