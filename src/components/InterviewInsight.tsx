import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, typewriter } from '../lib/animations';

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface InterviewInsightProps {
  insight: string;
  tip: string;
  startFrame?: number;
  endFrame?: number;
  sceneIndex?: number;
  sceneStartFrame?: number;
  animationCues?: unknown[];
  /** Scene heading used to derive the interviewer question */
  heading?: string;
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

/** Derive an interviewer question from the scene heading or insight text */
function deriveQuestion(heading?: string, insight?: string): string {
  if (heading) {
    // Strip markdown-style prefixes
    const clean = heading.replace(/^#+\s*/, '').replace(/[*_`]/g, '').trim();
    // If it already ends with ?, use it
    if (clean.endsWith('?')) return clean;
    // Common transformations
    if (/^(how|what|why|when|where|which|can|does|is|are|should|would|could)/i.test(clean)) {
      return clean.endsWith('.') ? clean.slice(0, -1) + '?' : clean + '?';
    }
    return `Can you explain ${clean.toLowerCase()}?`;
  }
  // Fallback: derive from first sentence of insight
  if (insight) {
    const firstSentence = insight.split(/[.!?]/)[0]?.trim();
    if (firstSentence && firstSentence.length > 10) {
      return `How would you approach ${firstSentence.toLowerCase()}?`;
    }
  }
  return 'Walk me through your approach to this problem.';
}

/** Split insight into structured answer framework sections */
function buildFrameworkSections(insight: string): Array<{ label: string; content: string }> {
  const sentences = insight
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);

  if (sentences.length === 0) {
    return [
      { label: 'Clarify', content: insight || 'Understand the requirements first.' },
      { label: 'Design', content: 'Outline your solution approach.' },
      { label: 'Tradeoffs', content: 'Discuss pros, cons, and alternatives.' },
    ];
  }

  // Distribute sentences across framework sections
  const sections: Array<{ label: string; content: string }> = [];
  const labels = ['Clarify', 'Design', 'Tradeoffs'];

  if (sentences.length >= 3) {
    sections.push({ label: labels[0], content: sentences[0] + '.' });
    const midSentences = sentences.slice(1, -1);
    sections.push({ label: labels[1], content: midSentences.join('. ') + '.' });
    sections.push({ label: labels[2], content: sentences[sentences.length - 1] + '.' });
  } else if (sentences.length === 2) {
    sections.push({ label: labels[0], content: sentences[0] + '.' });
    sections.push({ label: labels[1], content: sentences[1] + '.' });
    sections.push({ label: labels[2], content: 'Consider alternatives and edge cases.' });
  } else {
    sections.push({ label: labels[0], content: sentences[0] + '.' });
    sections.push({ label: labels[1], content: 'Build on this foundation step by step.' });
    sections.push({ label: labels[2], content: 'Weigh the tradeoffs carefully.' });
  }

  return sections;
}

/** Highlights key interview phrases */
function highlightKeyPhrases(text: string): React.ReactNode[] {
  const keywords = [
    'always', 'never', 'key', 'critical', 'important', 'must', 'should',
    'interviewer', 'interviewers', 'expect', 'O\\(n\\)', 'O\\(log n\\)', 'O\\(1\\)',
    'trade-off', 'tradeoff', 'edge case', 'edge cases', 'time complexity',
    'space complexity', 'optimize', 'optimal', 'efficient', 'explain',
  ];
  const pattern = new RegExp(
    `\\b(${keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
    'gi',
  );

  const parts = text.split(pattern);
  return parts.map((part, i) => {
    if (keywords.some(k => k.toLowerCase().replace(/\\\(/g, '(').replace(/\\\)/g, ')') === part.toLowerCase())) {
      return (
        <span key={i} style={{ color: COLORS.gold, fontWeight: 700 }}>
          {part}
        </span>
      );
    }
    return part;
  });
}

/* ─── Component ────────────────────────────────────────────────────────────── */

const InterviewInsight: React.FC<InterviewInsightProps> = ({
  insight = '',
  tip = '',
  startFrame = 0,
  heading,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elapsed = frame - startFrame;

  const question = deriveQuestion(heading, insight);
  const sections = buildFrameworkSections(insight);

  /* ── Animation timing ────────────────────────────────────────────────────── */

  // Interviewer chat bubble: spring entrance from top
  const chatSpring = spring({
    frame: Math.max(0, elapsed),
    fps,
    config: { damping: 12, stiffness: 100, mass: 0.8 },
  });
  const chatY = interpolate(chatSpring, [0, 1], [-80, 0]);
  const chatOpacity = interpolate(chatSpring, [0, 0.4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Typewriter on question text
  const typewriterDelay = startFrame + 12;
  const typedQuestion = typewriter(question, frame, typewriterDelay, 1.2);

  // Framework card entrance
  const cardDelay = 25;
  const cardSpring = spring({
    frame: Math.max(0, elapsed - cardDelay),
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.9 },
  });
  const cardOpacity = interpolate(cardSpring, [0, 0.3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cardY = interpolate(cardSpring, [0, 1], [40, 0]);

  // Active section index: cycles through sections based on elapsed time
  const sectionInterval = 40; // frames per section
  const activeSection = Math.min(
    sections.length - 1,
    Math.max(0, Math.floor((elapsed - cardDelay - 15) / sectionInterval)),
  );

  // Pro tip badge fade-in
  const tipDelay = startFrame + cardDelay + sections.length * sectionInterval + 10;
  const tipOpacity = fadeIn(frame, tipDelay, 25);
  const tipSpring = spring({
    frame: Math.max(0, frame - tipDelay),
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.7 },
  });
  const tipY = interpolate(tipSpring, [0, 1], [30, 0]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONTS.text,
        boxSizing: 'border-box',
        padding: '40px 56px',
      }}
    >
      {/* ── Top 30%: Interviewer Chat Bubble ───────────────────────────────── */}
      <div
        style={{
          flex: '0 0 28%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          opacity: chatOpacity,
          transform: `translateY(${chatY}px)`,
        }}
      >
        <div
          style={{
            background: `linear-gradient(135deg, ${COLORS.darkAlt}, #151020)`,
            borderRadius: 20,
            padding: '28px 36px',
            border: `1.5px solid ${COLORS.indigo}44`,
            boxShadow: `0 8px 40px ${COLORS.dark}AA`,
            position: 'relative',
          }}
        >
          {/* Chat tail */}
          <div
            style={{
              position: 'absolute',
              top: -12,
              left: 40,
              width: 0,
              height: 0,
              borderLeft: '12px solid transparent',
              borderRight: '12px solid transparent',
              borderBottom: `12px solid ${COLORS.darkAlt}`,
            }}
          />

          {/* Label */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 14,
            }}
          >
            {/* Avatar circle */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${COLORS.saffron}, ${COLORS.gold})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 900,
                color: COLORS.dark,
              }}
            >
              ?
            </div>
            <span
              style={{
                fontSize: SIZES.bodySmall,
                fontWeight: 700,
                color: COLORS.saffron,
                letterSpacing: '0.8px',
                textTransform: 'uppercase' as const,
              }}
            >
              Interviewer asks:
            </span>
          </div>

          {/* Question with typewriter */}
          <div
            style={{
              fontSize: 30,
              fontWeight: 600,
              color: COLORS.white,
              lineHeight: 1.45,
              minHeight: 44,
              fontFamily: FONTS.heading,
            }}
          >
            {typedQuestion}
            {/* Blinking cursor */}
            {typedQuestion.length < question.length && (
              <span
                style={{
                  display: 'inline-block',
                  width: 3,
                  height: 30,
                  backgroundColor: COLORS.saffron,
                  marginLeft: 2,
                  verticalAlign: 'text-bottom',
                  opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Middle 50%: Answer Framework Card ──────────────────────────────── */}
      <div
        style={{
          flex: '0 0 52%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          opacity: cardOpacity,
          transform: `translateY(${cardY}px)`,
          gap: 12,
        }}
      >
        {sections.map((section, i) => {
          const isActive = elapsed >= cardDelay + 15 && i <= activeSection;
          const isCurrent = i === activeSection && elapsed >= cardDelay + 15;

          // Each section has its own spring for smooth highlighting
          const sectionActivationFrame = cardDelay + 15 + i * sectionInterval;
          const sectionSpring = spring({
            frame: Math.max(0, elapsed - sectionActivationFrame),
            fps,
            config: { damping: 14, stiffness: 100, mass: 0.8 },
          });
          const sectionHighlight = interpolate(sectionSpring, [0, 1], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'stretch',
                borderRadius: 14,
                overflow: 'hidden',
                background: isCurrent
                  ? `linear-gradient(135deg, ${COLORS.teal}14, ${COLORS.teal}08)`
                  : isActive
                    ? `${COLORS.darkAlt}`
                    : `${COLORS.dark}88`,
                border: `1.5px solid ${isCurrent ? `${COLORS.teal}55` : `${COLORS.indigo}22`}`,
                transition: 'all 0.3s',
                opacity: isActive ? 1 : 0.35,
              }}
            >
              {/* Left accent border */}
              <div
                style={{
                  width: 5,
                  flexShrink: 0,
                  background: isCurrent
                    ? COLORS.teal
                    : isActive
                      ? `${COLORS.teal}66`
                      : `${COLORS.indigo}33`,
                  borderRadius: '4px 0 0 4px',
                }}
              />

              <div style={{ padding: '20px 24px', flex: 1 }}>
                {/* Section label */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  {/* Step number */}
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: isCurrent
                        ? `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal}CC)`
                        : `${COLORS.indigo}44`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      fontWeight: 800,
                      color: isCurrent ? COLORS.dark : COLORS.gray,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  <span
                    style={{
                      fontSize: SIZES.bodySmall,
                      fontWeight: 800,
                      color: isCurrent ? COLORS.teal : COLORS.gray,
                      textTransform: 'uppercase' as const,
                      letterSpacing: '1px',
                    }}
                  >
                    {section.label}
                  </span>
                </div>

                {/* Section content — only fully visible when active */}
                <div
                  style={{
                    fontSize: SIZES.bodySmall,
                    color: isCurrent ? COLORS.white : `${COLORS.gray}CC`,
                    lineHeight: 1.55,
                    fontWeight: isCurrent ? 500 : 400,
                    opacity: interpolate(sectionHighlight, [0, 1], [0.4, 1]),
                  }}
                >
                  {isActive ? highlightKeyPhrases(section.content) : section.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Bottom 15%: Pro Tip Badge ──────────────────────────────────────── */}
      {tip && (
        <div
          style={{
            flex: '0 0 15%',
            display: 'flex',
            alignItems: 'center',
            opacity: tipOpacity,
            transform: `translateY(${tipY}px)`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              background: `linear-gradient(135deg, ${COLORS.gold}14, ${COLORS.gold}08)`,
              border: `2px solid ${COLORS.gold}44`,
              borderRadius: 14,
              padding: '18px 28px',
              width: '100%',
            }}
          >
            {/* Pro Tip badge */}
            <div
              style={{
                flexShrink: 0,
                background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.saffron})`,
                borderRadius: 8,
                padding: '6px 14px',
                fontSize: SIZES.caption,
                fontWeight: 900,
                color: COLORS.dark,
                letterSpacing: '1px',
                textTransform: 'uppercase' as const,
                whiteSpace: 'nowrap' as const,
              }}
            >
              PRO TIP
            </div>

            {/* Tip text */}
            <div
              style={{
                fontSize: SIZES.bodySmall,
                color: COLORS.white,
                lineHeight: 1.5,
                fontWeight: 400,
              }}
            >
              {highlightKeyPhrases(tip)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewInsight;
