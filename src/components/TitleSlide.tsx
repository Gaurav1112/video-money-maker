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
  /** Topic stats line, e.g. "12 Sessions • 45 Questions • Python & Java" */
  stats?: string;
  /** Duration label, e.g. "8 min deep dive" */
  durationLabel?: string;
}

// FPS = 30. Frame mapping:
//  0-30   (0-1s)  : background pattern + topic name dramatic zoom-in
// 15-50   (0.5-1.7s): circuit lines draw in
// 30-60   (1-2s)  : hook text fades + slides up below topic
// 55-75   (1.8-2.5s): stats bar + duration badge spring in
// 60-90   (2-3s)  : session badge + guru-sishya.in slide in from bottom
// 75-120  (2.5-4s): objectives as learning items fade in staggered

const TitleSlide: React.FC<TitleSlideProps> = ({
  topic = 'TOPIC',
  sessionNumber = 1,
  totalSessions = 12,
  title = '',
  objectives = [],
  language,
  hookText,
  stats,
  durationLabel,
}) => {
  const frame = useCurrentFrame();

  // ─── Default stats/duration if not provided ───
  const displayStats = stats || `${totalSessions} Sessions • Python & Java`;
  const displayDuration = durationLabel || '8 min deep dive';

  // ─── TOPIC NAME: massive zoom from 0.3x to 1.0x in first 30 frames ───
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

  // ─── STATS BAR: springs in at frame 55 ───
  const statsSpring = spring({
    frame: Math.max(0, frame - 55),
    fps: 30,
    config: { damping: 12, stiffness: 120, mass: 0.7 },
  });
  const statsOpacity = interpolate(frame, [55, 68], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ─── DURATION BADGE: springs in at frame 60 ───
  const durationSpring = spring({
    frame: Math.max(0, frame - 60),
    fps: 30,
    config: { damping: 10, stiffness: 150, mass: 0.6 },
  });
  const durationOpacity = interpolate(frame, [60, 72], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
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

  // ─── CIRCUIT LINES: draw in from frame 15 ───
  const circuitProgress = interpolate(frame, [15, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // ─── GEOMETRIC SHAPES: fade + rotate in from frame 10 ───
  const shapeOpacity = interpolate(frame, [10, 50], [0, 0.15], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const shapeRotation = interpolate(frame, [10, 120], [0, 45], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });

  // ─── BACKGROUND GRID pattern opacity ───
  const gridOpacity = interpolate(frame, [0, 30], [0, 0.06], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ─── OBJECTIVE PILLS colors ───
  const PILL_COLORS = [
    { bg: COLORS.saffron + '22', border: COLORS.saffron, text: COLORS.saffron },
    { bg: COLORS.gold + '1A', border: COLORS.gold, text: COLORS.gold },
    { bg: COLORS.teal + '1A', border: COLORS.teal, text: COLORS.teal },
    { bg: COLORS.indigo + '1A', border: COLORS.indigo, text: COLORS.indigo },
  ];

  // ─── LEARNING OBJECTIVES: fade in staggered from frame 75 ───
  const displayObjectives = objectives.slice(0, 4);

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
      {/* ── LAYER 0: Subtle dot-grid background pattern ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: gridOpacity,
          backgroundImage: `radial-gradient(circle, ${COLORS.gray}44 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          zIndex: 0,
        }}
      />

      {/* ── LAYER 0b: Gradient mesh background ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse 50% 40% at 15% 25%, ${COLORS.saffron}12 0%, transparent 70%),
            radial-gradient(ellipse 40% 35% at 85% 75%, ${COLORS.teal}10 0%, transparent 65%),
            radial-gradient(ellipse 45% 30% at 50% 90%, ${COLORS.indigo}0D 0%, transparent 60%)
          `,
          zIndex: 0,
        }}
      />

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

      {/* ── LAYER 1b: Decorative geometric shapes ── */}
      {/* Top-left hexagon */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: 60,
          width: 120,
          height: 120,
          border: `1.5px solid ${COLORS.saffron}33`,
          borderRadius: 12,
          opacity: shapeOpacity,
          transform: `rotate(${shapeRotation}deg)`,
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 95,
          left: 75,
          width: 90,
          height: 90,
          border: `1px solid ${COLORS.gold}22`,
          borderRadius: 8,
          opacity: shapeOpacity * 0.7,
          transform: `rotate(${shapeRotation + 15}deg)`,
          zIndex: 1,
        }}
      />
      {/* Bottom-right hexagon */}
      <div
        style={{
          position: 'absolute',
          bottom: 120,
          right: 80,
          width: 100,
          height: 100,
          border: `1.5px solid ${COLORS.teal}33`,
          borderRadius: 10,
          opacity: shapeOpacity,
          transform: `rotate(${-shapeRotation + 30}deg)`,
          zIndex: 1,
        }}
      />
      {/* Top-right circle */}
      <div
        style={{
          position: 'absolute',
          top: 160,
          right: 140,
          width: 60,
          height: 60,
          border: `1px solid ${COLORS.indigo}33`,
          borderRadius: '50%',
          opacity: shapeOpacity * 0.8,
          zIndex: 1,
        }}
      />
      {/* Bottom-left diamond */}
      <div
        style={{
          position: 'absolute',
          bottom: 200,
          left: 120,
          width: 50,
          height: 50,
          border: `1px solid ${COLORS.gold}30`,
          borderRadius: 4,
          opacity: shapeOpacity * 0.6,
          transform: `rotate(${shapeRotation + 45}deg)`,
          zIndex: 1,
        }}
      />

      {/* ── LAYER 1c: Circuit board lines ── */}
      <svg
        width="100%"
        height="100%"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
        }}
        viewBox="0 0 1920 1080"
      >
        {/* Top-left circuit cluster */}
        <line
          x1="0" y1="200" x2={200 * circuitProgress} y2="200"
          stroke={COLORS.saffron}
          strokeWidth="1.5"
          opacity={0.2 * circuitProgress}
          strokeDasharray="8 4"
        />
        <line
          x1={200 * circuitProgress} y1="200" x2={200 * circuitProgress} y2={200 + 100 * circuitProgress}
          stroke={COLORS.saffron}
          strokeWidth="1.5"
          opacity={0.15 * circuitProgress}
        />
        <circle
          cx={200 * circuitProgress} cy="200"
          r={4 * circuitProgress}
          fill={COLORS.saffron}
          opacity={0.3 * circuitProgress}
        />
        {/* Horizontal line from left at 400 */}
        <line
          x1="0" y1="420" x2={140 * circuitProgress} y2="420"
          stroke={COLORS.gold}
          strokeWidth="1"
          opacity={0.15 * circuitProgress}
          strokeDasharray="6 6"
        />

        {/* Bottom-right circuit cluster */}
        <line
          x1="1920" y1="850" x2={1920 - 220 * circuitProgress} y2="850"
          stroke={COLORS.teal}
          strokeWidth="1.5"
          opacity={0.2 * circuitProgress}
          strokeDasharray="8 4"
        />
        <line
          x1={1920 - 220 * circuitProgress} y1="850" x2={1920 - 220 * circuitProgress} y2={850 - 80 * circuitProgress}
          stroke={COLORS.teal}
          strokeWidth="1.5"
          opacity={0.15 * circuitProgress}
        />
        <circle
          cx={1920 - 220 * circuitProgress} cy="850"
          r={4 * circuitProgress}
          fill={COLORS.teal}
          opacity={0.3 * circuitProgress}
        />
        {/* Horizontal line from right at 700 */}
        <line
          x1="1920" y1="680" x2={1920 - 160 * circuitProgress} y2="680"
          stroke={COLORS.indigo}
          strokeWidth="1"
          opacity={0.12 * circuitProgress}
          strokeDasharray="6 6"
        />

        {/* Top-right vertical trace */}
        <line
          x1="1750" y1="0" x2="1750" y2={180 * circuitProgress}
          stroke={COLORS.gold}
          strokeWidth="1"
          opacity={0.12 * circuitProgress}
        />
        <circle
          cx="1750" cy={180 * circuitProgress}
          r={3 * circuitProgress}
          fill={COLORS.gold}
          opacity={0.25 * circuitProgress}
        />

        {/* Bottom-left vertical trace */}
        <line
          x1="170" y1="1080" x2="170" y2={1080 - 150 * circuitProgress}
          stroke={COLORS.indigo}
          strokeWidth="1"
          opacity={0.1 * circuitProgress}
        />
      </svg>

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

      {/* ── LAYER 2b: Glowing accent orbs ── */}
      {[
        { x: 12, y: 18, color: COLORS.saffron, size: 180, delay: 0 },
        { x: 82, y: 72, color: COLORS.teal, size: 140, delay: 10 },
        { x: 70, y: 15, color: COLORS.indigo, size: 100, delay: 20 },
      ].map((orb, i) => {
        const orbOpacity = interpolate(frame, [orb.delay, orb.delay + 40], [0, 0.08], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const orbPulse = pulseGlow(frame, 0.03 + i * 0.01, 0.6, 1.0);
        return (
          <div
            key={`orb-${i}`}
            style={{
              position: 'absolute',
              left: `${orb.x}%`,
              top: `${orb.y}%`,
              width: orb.size,
              height: orb.size,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${orb.color}55 0%, transparent 70%)`,
              opacity: orbOpacity * orbPulse,
              filter: `blur(${orb.size / 4}px)`,
              transform: 'translate(-50%, -50%)',
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
            marginBottom: 22,
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
              marginBottom: 28,
            }}
          >
            {hookText || title}
          </div>
        ) : null}

        {/* ── STATS BAR: sessions, questions, languages ── */}
        <div
          style={{
            opacity: statsOpacity,
            transform: `scale(${interpolate(statsSpring, [0, 1], [0.8, 1])}) translateY(${interpolate(statsSpring, [0, 1], [15, 0])}px)`,
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            marginBottom: 18,
          }}
        >
          <span
            style={{
              fontSize: SIZES.bodySmall,
              fontFamily: FONTS.code,
              fontWeight: 600,
              color: COLORS.gray,
              letterSpacing: 1.5,
            }}
          >
            {displayStats}
          </span>
        </div>

        {/* ── DURATION BADGE: "8 min deep dive" ── */}
        <div
          style={{
            opacity: durationOpacity,
            transform: `scale(${interpolate(durationSpring, [0, 1], [0.7, 1])})`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: COLORS.teal + '18',
            border: `1px solid ${COLORS.teal}44`,
            borderRadius: 24,
            padding: '7px 20px',
            marginBottom: 28,
          }}
        >
          {/* Animated clock icon */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke={COLORS.teal} strokeWidth="1.5" opacity={0.7} />
            <line
              x1="8" y1="8"
              x2="8" y2="4"
              stroke={COLORS.teal}
              strokeWidth="1.5"
              strokeLinecap="round"
              transform={`rotate(${interpolate(frame, [60, 150], [0, 360], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })}, 8, 8)`}
            />
            <line
              x1="8" y1="8"
              x2="11" y2="8"
              stroke={COLORS.teal}
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity={0.7}
            />
          </svg>
          <span
            style={{
              fontSize: SIZES.caption,
              fontFamily: FONTS.code,
              fontWeight: 700,
              color: COLORS.teal,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            {displayDuration}
          </span>
        </div>

        {/* ── LANGUAGE badge (if present) ── */}
        {language && (
          <div
            style={{
              opacity: badgeOpacity,
              transform: `translateY(${badgeY}px)`,
              marginBottom: 24,
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

        {/* ── LEARNING OBJECTIVES: "You'll learn:" header + items ── */}
        {displayObjectives.length > 0 && (
          <div
            style={{
              maxWidth: 1000,
              width: '100%',
            }}
          >
            {/* "You'll learn" header */}
            <div
              style={{
                opacity: interpolate(frame, [75, 88], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
                transform: `translateY(${interpolate(frame, [75, 90], [12, 0], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing: Easing.out(Easing.cubic),
                })}px)`,
                fontSize: SIZES.caption,
                fontFamily: FONTS.code,
                fontWeight: 700,
                color: COLORS.gold,
                letterSpacing: 3,
                textTransform: 'uppercase',
                marginBottom: 14,
              }}
            >
              You'll Learn
            </div>

            {/* Objective items as pill tags */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                justifyContent: 'center',
              }}
            >
              {displayObjectives.map((obj, idx) => {
                const delay = stagger(idx, 85, 10);
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
