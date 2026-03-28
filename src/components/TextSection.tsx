import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate, spring, useVideoConfig } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { useSync } from '../hooks/useSync';
import type { AnimationCue } from '../types';

interface TextSectionProps {
  heading: string;
  bullets: string[];
  content?: string;
  narration?: string;
  startFrame?: number;
  endFrame?: number;
  sceneIndex?: number;
  sceneStartFrame?: number;
  animationCues?: AnimationCue[];
}

const ACCENT_COLORS = [
  COLORS.saffron,
  COLORS.teal,
  COLORS.indigo,
  COLORS.gold,
];

const TextSection: React.FC<TextSectionProps> = ({
  heading = '',
  bullets = [],
  content = '',
  narration = '',
  startFrame = 0,
  endFrame = 300,
  sceneIndex,
  sceneStartFrame,
  animationCues,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sync = useSync(sceneIndex ?? 0, sceneStartFrame ?? startFrame);
  const sceneDuration = endFrame - startFrame;

  // ALWAYS use narration sentences as visual content — they're richer than generic bullets
  const displayText = narration || content || '';
  const sentences = displayText
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 15 && s.length < 150);

  // Prefer narration sentences (5-7 items), fall back to bullets only if no narration
  const displayBullets = sentences.length >= 3
    ? sentences.slice(0, 7)
    : bullets.length > 0 ? bullets : ['...'];

  // Progressive reveal: show one item at a time
  const progress = frame / Math.max(1, sceneDuration);
  const itemsPerStep = Math.max(1, Math.floor(sceneDuration / (displayBullets.length + 1) / fps * fps));
  const visibleCount = Math.min(
    displayBullets.length,
    Math.floor(frame / Math.max(1, itemsPerStep)) + 1
  );

  // Current narration word for highlighting
  const currentWord = sync.currentWord?.toLowerCase() || '';

  // Heading animation
  const headingScale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  return (
    <AbsoluteFill
      style={{
        background: 'transparent',
        padding: '60px 40px 60px 50px',
        fontFamily: FONTS.text,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        overflow: 'hidden',
      }}
    >
      {/* Decorative left accent line */}
      <div
        style={{
          position: 'absolute',
          left: 30,
          top: '10%',
          bottom: '10%',
          width: 3,
          background: `linear-gradient(180deg, transparent, ${COLORS.saffron}60, ${COLORS.teal}40, transparent)`,
          borderRadius: 2,
        }}
      />

      {/* Heading with animated underline */}
      <div style={{ marginBottom: 24, transform: `scale(${headingScale})`, transformOrigin: 'left center' }}>
        <div
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: COLORS.saffron,
            fontFamily: FONTS.heading,
            lineHeight: 1.2,
          }}
        >
          {heading}
        </div>
        <div
          style={{
            width: interpolate(frame, [5, 30], [0, 200], { extrapolateRight: 'clamp' }),
            height: 3,
            background: `linear-gradient(90deg, ${COLORS.saffron}, ${COLORS.gold}80)`,
            borderRadius: 2,
            marginTop: 8,
          }}
        />
      </div>

      {/* Content items — fill the space with animated, revealing text */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {displayBullets.map((text, i) => {
          const isVisible = i < visibleCount;
          const isCurrent = i === visibleCount - 1;
          const isPast = i < visibleCount - 1;
          const accentColor = ACCENT_COLORS[i % ACCENT_COLORS.length];

          // Spring-in animation for each bullet
          const revealFrame = i * itemsPerStep;
          const bulletSpring = isVisible ? spring({
            frame: frame - revealFrame,
            fps,
            config: { damping: 14, stiffness: 120 },
          }) : 0;

          // Highlight words that match current narration
          const words = text.split(/\s+/);
          const highlightedText = words.map((word, wi) => {
            const isSpoken = currentWord && word.toLowerCase().includes(currentWord);
            return (
              <span
                key={wi}
                style={{
                  color: isSpoken && isCurrent ? COLORS.gold : (isCurrent ? COLORS.white : '#888'),
                  fontWeight: isSpoken && isCurrent ? 700 : (isCurrent ? 500 : 400),
                  fontSize: isCurrent ? 22 : 19,
                }}
              >
                {word}{' '}
              </span>
            );
          });

          if (!isVisible) return null;

          return (
            <div
              key={i}
              style={{
                opacity: bulletSpring,
                transform: `translateX(${interpolate(bulletSpring, [0, 1], [-30, 0])}px)`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: '14px 18px',
                borderRadius: 10,
                borderLeft: `3px solid ${isCurrent ? accentColor : accentColor + '40'}`,
                background: isCurrent
                  ? `linear-gradient(90deg, ${accentColor}15, transparent)`
                  : 'transparent',
              }}
            >
              {/* Number/icon badge */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: isCurrent ? accentColor : accentColor + '30',
                  color: isCurrent ? '#fff' : accentColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: FONTS.code,
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>

              {/* Text with word highlighting — LARGE and filling space */}
              <div style={{ lineHeight: 1.7, fontFamily: FONTS.text, fontSize: isCurrent ? 24 : 20 }}>
                {highlightedText}
              </div>
            </div>
          );
        })}
      </div>

      {/* Key stat callout — appears when a number is mentioned in narration */}
      {currentWord && /\d/.test(currentWord) && (
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: 50,
            right: 20,
            textAlign: 'center',
            fontSize: 40,
            fontWeight: 800,
            color: COLORS.gold,
            fontFamily: FONTS.heading,
            opacity: 0.8,
            textShadow: `0 0 30px ${COLORS.gold}40`,
          }}
        >
          {currentWord}
        </div>
      )}
    </AbsoluteFill>
  );
};

export default TextSection;
