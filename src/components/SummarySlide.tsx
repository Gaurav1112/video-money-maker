import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate, spring } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, slideUp, stagger, springIn, springScale, sweepUnderline, slideFromLeft, pulseGlow } from '../lib/animations';
import type { VisualBeat } from '../types';

interface SummarySlideProps {
  takeaways?: string[];
  topic?: string;
  sessionNumber?: number;
  nextTopic?: string;
  startFrame?: number;
  endFrame?: number;
  /** If provided, renders a TemplateFactory diagram in the last 30% */
  templateId?: string;
  /** Visual beats for the TemplateFactory diagram */
  visualBeats?: VisualBeat[];
}

/**
 * Truncate text to max chars with ellipsis.
 */
function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '\u2026';
}

/**
 * SummarySlide — Animated checklist + optional "money shot" diagram.
 *
 * Phase 1 (first 70%): Animated checklist with self-drawing elements
 *   - "KEY TAKEAWAYS" header with gold underline that draws itself
 *   - Each takeaway appears one by one with checkmark draw animation
 *   - Previous items dim to 70%
 *
 * Phase 2 (last 30%): TemplateFactory diagram or Subscribe CTA
 */
const SummarySlide: React.FC<SummarySlideProps> = ({
  takeaways = [],
  topic = 'this topic',
  sessionNumber = 1,
  nextTopic,
  startFrame = 0,
  endFrame,
  templateId,
  visualBeats,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;

  const sceneDuration = endFrame != null ? endFrame - startFrame : 240;
  const phase1Duration = Math.round(sceneDuration * 0.7);
  const phase2Start = startFrame + phase1Duration;

  // Default takeaways so the slide is never blank
  const displayTakeaways =
    takeaways && takeaways.length > 0
      ? takeaways
      : [
          `You learned the fundamentals of ${topic}`,
          `You can now explain ${topic} clearly in interviews`,
          `Practice quizzes and flashcards at guru-sishya.in`,
        ];

  // Per-item timing within phase 1
  const itemCount = displayTakeaways.length;
  const headerDuration = 25; // frames for header to appear
  const availableForItems = phase1Duration - headerDuration - 10;
  const perItemDelay = Math.max(12, Math.floor(availableForItems / Math.max(1, itemCount)));

  // ─── HEADER: "KEY TAKEAWAYS" ──────────────────────────────────────────
  const headerOpacity = fadeIn(frame, startFrame, 15);
  const headerY = slideUp(frame, startFrame, 40, 20);

  // Gold underline draws itself
  const underlineWidth = sweepUnderline(frame, startFrame + 8, 300, 20);

  // ─── PHASE 2 ANIMATIONS ──────────────────────────────────────────────
  const phase2Opacity = fadeIn(frame, phase2Start, 20);
  const phase2Y = slideUp(frame, phase2Start, 40, 25);

  // CTA pulse
  const ctaPulse = pulseGlow(frame, 0.06, 0.95, 1.05);

  // Track which item is "active" (most recently appeared)
  const getActiveIndex = (): number => {
    for (let i = itemCount - 1; i >= 0; i--) {
      const itemStart = stagger(i, startFrame + headerDuration, perItemDelay);
      if (frame >= itemStart) return i;
    }
    return -1;
  };
  const activeIndex = getActiveIndex();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        fontFamily: FONTS.text,
        overflow: 'hidden',
      }}
    >
      {/* Background glow orb */}
      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '50%',
          width: 800,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${COLORS.gold}10 0%, ${COLORS.saffron}05 40%, transparent 70%)`,
          transform: 'translateX(-50%)',
          filter: 'blur(80px)',
          zIndex: 1,
        }}
      />

      {/* ── MAIN CONTENT ── */}
      <div
        style={{
          position: 'relative',
          zIndex: 6,
          padding: '50px 80px',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        {/* ── HEADER: KEY TAKEAWAYS ── */}
        <div
          style={{
            opacity: headerOpacity,
            transform: `translateY(${headerY}px)`,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: SIZES.heading3,
              fontWeight: 900,
              color: COLORS.white,
              fontFamily: FONTS.heading,
              letterSpacing: 4,
              textTransform: 'uppercase' as const,
              marginBottom: 8,
            }}
          >
            KEY TAKEAWAYS
          </div>
          {/* Self-drawing gold underline */}
          <div
            style={{
              height: 3,
              width: underlineWidth,
              backgroundColor: COLORS.gold,
              borderRadius: 2,
              boxShadow: `0 0 12px ${COLORS.gold}66`,
            }}
          />
        </div>

        {/* Session badge */}
        <div
          style={{
            opacity: headerOpacity,
            fontSize: SIZES.caption,
            fontWeight: 600,
            color: COLORS.gray,
            marginBottom: 28,
            letterSpacing: 1,
          }}
        >
          {topic} {'\u2014'} Session {sessionNumber}
        </div>

        {/* ── CHECKLIST ITEMS ── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            flex: frame < phase2Start ? 1 : undefined,
          }}
        >
          {displayTakeaways.map((takeaway, index) => {
            const itemStart = stagger(index, startFrame + headerDuration, perItemDelay);
            const itemSpring = springIn(frame, itemStart);
            const isActive = index === activeIndex;
            const isPast = index < activeIndex;

            // Icon slides in from left
            const iconSlide = slideFromLeft(frame, itemStart, 30, 15);

            // Text fades in slightly after icon
            const textOpacity = fadeIn(frame, itemStart + 4, 12);

            // Checkmark SVG draws itself (stroke-dashoffset animation)
            const checkDrawProgress = interpolate(
              frame,
              [itemStart + 8, itemStart + 20],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            );
            const checkPathLength = 24; // approximate path length
            const checkDashOffset = checkPathLength * (1 - checkDrawProgress);

            // Dim previous items to 70%
            const itemDim = isPast ? 0.7 : 1;

            return (
              <div
                key={index}
                style={{
                  opacity: itemSpring * itemDim,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  backgroundColor: isActive ? `${COLORS.darkAlt}` : `${COLORS.darkAlt}CC`,
                  borderRadius: 12,
                  padding: '16px 24px',
                  border: isActive
                    ? `1px solid ${COLORS.teal}50`
                    : `1px solid ${COLORS.teal}18`,
                  borderLeft: `4px solid ${isActive ? COLORS.teal : `${COLORS.teal}60`}`,
                  boxShadow: isActive ? `0 2px 20px ${COLORS.teal}15` : 'none',
                }}
              >
                {/* Teal dot / checkmark icon sliding in from left */}
                <div
                  style={{
                    transform: `translateX(${iconSlide.x}px)`,
                    opacity: iconSlide.opacity,
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      backgroundColor: `${COLORS.teal}20`,
                      border: `2px solid ${COLORS.teal}66`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: COLORS.teal,
                      }}
                    />
                  </div>
                </div>

                {/* Takeaway text */}
                <div
                  style={{
                    flex: 1,
                    opacity: textOpacity,
                    fontSize: SIZES.bodySmall,
                    fontWeight: 600,
                    color: COLORS.white,
                    lineHeight: 1.45,
                  }}
                >
                  {truncateText(takeaway, 60)}
                </div>

                {/* Self-drawing green checkmark on right */}
                <div style={{ flexShrink: 0, width: 28, height: 28 }}>
                  <svg width={28} height={28} viewBox="0 0 28 28">
                    <circle
                      cx={14}
                      cy={14}
                      r={12}
                      fill="none"
                      stroke={`${COLORS.teal}44`}
                      strokeWidth={2}
                    />
                    <path
                      d="M8 14 L12 18 L20 10"
                      fill="none"
                      stroke={COLORS.teal}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={checkPathLength}
                      strokeDashoffset={checkDashOffset}
                    />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── PHASE 2: Diagram or Subscribe CTA ── */}
        {frame >= phase2Start - 5 && (
          <div
            style={{
              opacity: phase2Opacity,
              transform: `translateY(${phase2Y}px)`,
              marginTop: 28,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {templateId ? (
              /* Render TemplateFactory diagram — lazy loaded */
              <TemplateFactoryWrapper
                templateId={templateId}
                visualBeats={visualBeats || []}
                topic={topic}
                fps={fps}
              />
            ) : (
              /* Subscribe CTA */
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                <div
                  style={{
                    fontSize: SIZES.heading3,
                    fontWeight: 800,
                    color: COLORS.saffron,
                    fontFamily: FONTS.heading,
                    textAlign: 'center',
                  }}
                >
                  Subscribe for more!
                </div>
                <div
                  style={{
                    transform: `scale(${ctaPulse})`,
                    background: `linear-gradient(135deg, ${COLORS.saffron} 0%, ${COLORS.gold} 100%)`,
                    color: COLORS.dark,
                    padding: '16px 48px',
                    borderRadius: 50,
                    fontSize: SIZES.bodySmall,
                    fontWeight: 800,
                    fontFamily: FONTS.text,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    boxShadow: `0 6px 30px ${COLORS.saffron}55`,
                    letterSpacing: 0.5,
                  }}
                >
                  Practice now {'\u2192'} www.guru-sishya.in
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Wrapper that lazily loads TemplateFactory so missing files don't crash.
 */
const TemplateFactoryWrapper: React.FC<{
  templateId: string;
  visualBeats: VisualBeat[];
  topic: string;
  fps: number;
}> = ({ templateId, visualBeats, topic, fps }) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { default: TemplateFactory } = require('./templates/TemplateFactory');
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <TemplateFactory
          templateId={templateId}
          variant="default"
          beats={visualBeats}
          accentColor={COLORS.teal}
          fps={fps}
          sceneHeading={topic}
        />
      </div>
    );
  } catch {
    // TemplateFactory not available — show fallback
    return (
      <div
        style={{
          fontSize: SIZES.bodySmall,
          color: COLORS.gray,
          textAlign: 'center',
        }}
      >
        Diagram: {templateId}
      </div>
    );
  }
};

export default SummarySlide;
