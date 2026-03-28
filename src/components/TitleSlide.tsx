import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate, spring, Easing } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, slideUp, stagger, springIn, bounceIn, pulseGlow } from '../lib/animations';

interface TitleSlideProps {
  topic?: string;
  sessionNumber?: number;
  totalSessions?: number;
  title?: string;
  objectives?: string[];
  language?: string;
  hookText?: string;
}

// FPS = 30. Frame mapping:
//  0-30   (0-1s)  : topic name dramatic zoom-in fills screen
// 30-60   (1-2s)  : hook text fades + slides up below topic
// 60-90   (2-3s)  : session badge + guru-sishya.in slide in from bottom
// 90-150  (3-5s)  : objectives pill tags spring in at bottom

const TitleSlide: React.FC<TitleSlideProps> = ({
  topic = 'TOPIC',
  sessionNumber = 1,
  totalSessions = 12,
  title = '',
  objectives = [],
  language,
  hookText,
}) => {
  const frame = useCurrentFrame();

  // ─── TOPIC NAME: massive zoom from 0.4x to 1.0x in first 30 frames ───
  const topicZoomScale = spring({
    frame: Math.max(0, frame),
    fps: 30,
    config: { damping: 14, stiffness: 90, mass: 1.1 },
    from: 0.3,
    to: 1,
  });

  const topicOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Subtle ongoing glow pulse on the topic after it lands
  const glowPulse = pulseGlow(frame, 0.07, 0.6, 1.0);

  // ─── HOOK TEXT: appears at frame 30, slides up ───
  const hookOpacity = interpolate(frame, [30, 48], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const hookSlide = interpolate(frame, [30, 52], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // ─── BADGE + BRANDING: slides in from bottom at frame 60 ───
  const badgeSpring = spring({
    frame: Math.max(0, frame - 60),
    fps: 30,
    config: { damping: 12, stiffness: 130, mass: 0.7 },
  });
  const badgeY = interpolate(badgeSpring, [0, 1], [80, 0]);
  const badgeOpacity = interpolate(frame, [60, 72], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ─── ANIMATED BORDER drawing effect (starts at frame 20) ───
  const borderProgress = interpolate(frame, [20, 100], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });

  // ─── GRADIENT BURST: saffron center glow that peaks at frame 15 ───
  const burstIntensity = interpolate(frame, [0, 15, 40, 150], [0, 1, 0.55, 0.4], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ─── PLAY PULSE indicator ───
  const playPulse = pulseGlow(frame, 0.1, 0.4, 1.0);
  const playScale = spring({
    frame: Math.max(0, frame - 5),
    fps: 30,
    config: { damping: 10, stiffness: 180, mass: 0.5 },
  });

  // ─── OBJECTIVE PILLS: stagger spring in from frame 90 ───
  const PILL_COLORS = [
    { bg: COLORS.saffron + '22', border: COLORS.saffron, text: COLORS.saffron },
    { bg: COLORS.gold + '1A', border: COLORS.gold, text: COLORS.gold },
    { bg: COLORS.teal + '1A', border: COLORS.teal, text: COLORS.teal },
    { bg: COLORS.indigo + '1A', border: COLORS.indigo, text: COLORS.indigo },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* ── LAYER 1: Dramatic saffron gradient burst from center ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 80% 60% at 50% 45%, ${COLORS.saffron}${Math.round(burstIntensity * 38).toString(16).padStart(2, '0')} 0%, ${COLORS.dark}00 70%)`,
          zIndex: 0,
        }}
      />
      {/* Secondary indigo counter-glow at bottom */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 60% 40% at 50% 90%, ${COLORS.indigo}18, transparent 65%)`,
          opacity: burstIntensity * 0.7,
          zIndex: 0,
        }}
      />

      {/* ── LAYER 2: Star field particles ── */}
      {Array.from({ length: 28 }).map((_, i) => {
        const seed = i * 137.508;
        const baseX = (seed * 7.31) % 100;
        const baseY = (seed * 3.97) % 100;
        const driftX = Math.sin(frame * 0.007 + i * 0.7) * 2.5;
        const driftY = Math.cos(frame * 0.005 + i * 1.1) * 2;
        const twinkle = interpolate(
          Math.sin(frame * 0.05 + i * 1.3),
          [-1, 1],
          [0.04, i < 6 ? 0.55 : 0.25],
        );
        const size = i < 4 ? 3 : i < 10 ? 2 : 1;
        const starColor = [COLORS.saffron, COLORS.gold, COLORS.teal, COLORS.indigo, COLORS.white][i % 5];
        return (
          <div
            key={`star-${i}`}
            style={{
              position: 'absolute',
              left: `${baseX + driftX}%`,
              top: `${baseY + driftY}%`,
              width: size,
              height: size,
              borderRadius: '50%',
              backgroundColor: starColor,
              opacity: twinkle,
              boxShadow: i < 6 ? `0 0 ${size * 3}px ${starColor}55` : 'none',
              zIndex: 1,
            }}
          />
        );
      })}

      {/* ── LAYER 3: Animated frame border (draws clockwise) ── */}
      <div
        style={{
          position: 'absolute',
          left: 36,
          top: 36,
          right: 36,
          bottom: 36,
          pointerEvents: 'none',
          zIndex: 4,
        }}
      >
        {/* Top */}
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: `${Math.min(borderProgress * 4, 1) * 100}%`,
          height: 2,
          background: `linear-gradient(90deg, ${COLORS.saffron}88, ${COLORS.gold}55)`,
          borderRadius: 1,
          boxShadow: `0 0 8px ${COLORS.saffron}44`,
        }} />
        {/* Right */}
        <div style={{
          position: 'absolute', top: 0, right: 0,
          width: 2,
          height: `${Math.max(0, Math.min((borderProgress - 0.25) * 4, 1)) * 100}%`,
          background: `linear-gradient(180deg, ${COLORS.gold}55, ${COLORS.teal}44)`,
          borderRadius: 1,
        }} />
        {/* Bottom */}
        <div style={{
          position: 'absolute', bottom: 0, right: 0,
          width: `${Math.max(0, Math.min((borderProgress - 0.5) * 4, 1)) * 100}%`,
          height: 2,
          background: `linear-gradient(270deg, ${COLORS.teal}44, ${COLORS.indigo}44)`,
          borderRadius: 1,
          transformOrigin: 'right',
        }} />
        {/* Left */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0,
          width: 2,
          height: `${Math.max(0, Math.min((borderProgress - 0.75) * 4, 1)) * 100}%`,
          background: `linear-gradient(0deg, ${COLORS.indigo}44, ${COLORS.saffron}55)`,
          borderRadius: 1,
          transformOrigin: 'bottom',
        }} />
        {/* Corner dots */}
        {[
          { style: { top: -4, left: -4 }, color: COLORS.saffron, show: borderProgress > 0.04 },
          { style: { top: -4, right: -4 }, color: COLORS.gold, show: borderProgress > 0.28 },
          { style: { bottom: -4, right: -4 }, color: COLORS.teal, show: borderProgress > 0.54 },
          { style: { bottom: -4, left: -4 }, color: COLORS.indigo, show: borderProgress > 0.78 },
        ].map(({ style, color, show }, idx) =>
          show ? (
            <div
              key={`corner-${idx}`}
              style={{
                position: 'absolute',
                ...style,
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: color,
                opacity: 0.7,
                boxShadow: `0 0 10px ${color}88`,
              }}
            />
          ) : null
        )}
      </div>

      {/* ── LAYER 4: SESSION badge — top-right corner ── */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          right: 72,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          opacity: playPulse * fadeIn(frame, 5),
          transform: `scale(${playScale})`,
          zIndex: 5,
        }}
      >
        <div
          style={{
            width: 11,
            height: 11,
            borderRadius: '50%',
            backgroundColor: COLORS.red,
            boxShadow: `0 0 ${10 * playPulse}px ${COLORS.red}99`,
          }}
        />
        <span
          style={{
            fontSize: SIZES.caption,
            fontFamily: FONTS.code,
            fontWeight: 700,
            color: COLORS.white,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          Session {sessionNumber} of {totalSessions}
        </span>
      </div>

      {/* ── MAIN CONTENT: centered column ── */}
      <div
        style={{
          position: 'relative',
          zIndex: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          paddingLeft: 80,
          paddingRight: 80,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* ★ TOPIC NAME — HUGE, CINEMATIC, SCREEN-FILLING ★ */}
        <div
          style={{
            fontSize: SIZES.heading1,       // 72px
            fontFamily: FONTS.heading,
            fontWeight: 900,
            color: COLORS.saffron,
            lineHeight: 1.0,
            letterSpacing: 3,
            textTransform: 'uppercase',
            opacity: topicOpacity,
            transform: `scale(${topicZoomScale})`,
            textShadow: [
              `0 0 ${60 * glowPulse}px ${COLORS.saffron}88`,
              `0 0 ${120 * glowPulse}px ${COLORS.saffron}33`,
              `0 0 200px ${COLORS.gold}22`,
              `0 4px 20px ${COLORS.dark}CC`,
            ].join(', '),
            marginBottom: 24,
          }}
        >
          {topic}
        </div>

        {/* ── Saffron divider bar — appears with topic ── */}
        <div
          style={{
            width: interpolate(frame, [10, 45], [0, 320], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            }),
            height: 3,
            background: `linear-gradient(90deg, transparent, ${COLORS.saffron}, ${COLORS.gold}, transparent)`,
            borderRadius: 2,
            marginBottom: 28,
            boxShadow: `0 0 16px ${COLORS.saffron}55`,
          }}
        />

        {/* ── HOOK TEXT — shocking statement, gold, 36px ── */}
        {(hookText || title) ? (
          <div
            style={{
              fontSize: SIZES.heading3,     // 36px
              fontFamily: FONTS.text,
              fontWeight: 600,
              color: COLORS.gold,
              lineHeight: 1.3,
              maxWidth: 900,
              opacity: hookOpacity,
              transform: `translateY(${hookSlide}px)`,
              textShadow: `0 0 40px ${COLORS.gold}44, 0 2px 8px ${COLORS.dark}`,
              marginBottom: 52,
            }}
          >
            {hookText || title}
          </div>
        ) : null}

        {/* ── LANGUAGE badge (if present) ── */}
        {language && (
          <div
            style={{
              opacity: badgeOpacity,
              transform: `translateY(${badgeY}px)`,
              marginBottom: 32,
            }}
          >
            <div
              style={{
                display: 'inline-block',
                backgroundColor: COLORS.teal + '20',
                border: `1px solid ${COLORS.teal}55`,
                color: COLORS.teal,
                padding: '6px 18px',
                borderRadius: 20,
                fontSize: SIZES.bodySmall,
                fontFamily: FONTS.code,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}
            >
              {language}
            </div>
          </div>
        )}

        {/* ── OBJECTIVE PILLS — spring in as colored tags ── */}
        {objectives.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              justifyContent: 'center',
              maxWidth: 1000,
            }}
          >
            {objectives.map((obj, idx) => {
              const delay = stagger(idx, 90, 12);
              const pillSpring = springIn(frame, delay);
              const pillColor = PILL_COLORS[idx % PILL_COLORS.length];
              return (
                <div
                  key={idx}
                  style={{
                    opacity: pillSpring,
                    transform: `scale(${interpolate(pillSpring, [0, 1], [0.6, 1])}) translateY(${interpolate(pillSpring, [0, 1], [20, 0])}px)`,
                    backgroundColor: pillColor.bg,
                    border: `1px solid ${pillColor.border}66`,
                    borderRadius: 24,
                    padding: '8px 18px',
                    fontSize: SIZES.bodySmall,   // 22px
                    fontFamily: FONTS.text,
                    fontWeight: 600,
                    color: pillColor.text,
                    whiteSpace: 'nowrap',
                    boxShadow: `0 0 12px ${pillColor.border}22`,
                  }}
                >
                  {obj}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── BOTTOM BAR: session badge + branding slide up at frame 60 ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 72,
          paddingRight: 72,
          paddingBottom: 40,
          opacity: badgeOpacity,
          transform: `translateY(${badgeY}px)`,
          zIndex: 5,
        }}
      >
        {/* Session badge */}
        <div
          style={{
            backgroundColor: COLORS.saffron,
            color: COLORS.white,
            padding: '10px 24px',
            borderRadius: 8,
            fontSize: SIZES.bodySmall,
            fontFamily: FONTS.text,
            fontWeight: 800,
            letterSpacing: 1,
            textTransform: 'uppercase',
            boxShadow: `0 0 20px ${COLORS.saffron}55`,
          }}
        >
          Session {sessionNumber} of {totalSessions}
        </div>

        {/* guru-sishya.in branding */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: COLORS.saffron,
              boxShadow: `0 0 8px ${COLORS.saffron}88`,
              opacity: playPulse,
            }}
          />
          <span
            style={{
              fontSize: SIZES.bodySmall,
              fontFamily: FONTS.code,
              fontWeight: 700,
              color: COLORS.gray,
              letterSpacing: 1,
            }}
          >
            guru-sishya.in
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default TitleSlide;
