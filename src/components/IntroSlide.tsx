import React from 'react';
import { useCurrentFrame, AbsoluteFill, spring, useVideoConfig, interpolate } from 'remotion';
import { COLORS, FONTS } from '../lib/theme';

interface IntroSlideProps {
  durationInFrames?: number; // default 90 (3 seconds at 30fps)
}

// Particle definition — each has a fixed horizontal position and a phase offset
const PARTICLES = [
  { x: 10, phase: 0,  size: 4 },
  { x: 22, phase: 10, size: 3 },
  { x: 38, phase: 5,  size: 5 },
  { x: 50, phase: 18, size: 3 },
  { x: 65, phase: 8,  size: 4 },
  { x: 78, phase: 12, size: 3 },
  { x: 90, phase: 3,  size: 4 },
];

const IntroSlide: React.FC<IntroSlideProps> = ({ durationInFrames = 90 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── INSTANT zoom-in: logo starts at 2.5x scale and snaps down to 1x ──────
  // Using a fast spring that settles quickly — visible from frame 0
  const logoSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.8 },
  });
  // Zoom from 2.5x → 1x (inverse spring: big to normal)
  const logoScale = interpolate(logoSpring, [0, 1], [2.5, 1]);

  // ── Logo opacity: START at 0.7 on frame 0, reach 1.0 by frame 5 ──────────
  const logoOpacity = interpolate(frame, [0, 5], [0.7, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Breathing / pulse on logo (subtle scale oscillation after settle) ─────
  const breatheProgress = Math.max(0, frame - 15);
  const breatheScale = 1 + interpolate(Math.sin(breatheProgress * 0.1), [-1, 1], [0, 0.015]);
  const combinedLogoScale = logoScale * breatheScale;

  // ── URL appears quickly ─────────────────────────────────────────────────
  const urlOpacity = interpolate(frame, [12, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const urlSlideUp = interpolate(frame, [12, 22], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Tagline appears after URL ───────────────────────────────────────────
  const taglineOpacity = interpolate(frame, [25, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const taglineSlideUp = interpolate(frame, [25, 40], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Exit fade ─────────────────────────────────────────────────────────────
  const exitOpacity = frame > durationInFrames - 12
    ? interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  // ── Saffron/gold radial burst — visible from frame 0 ─────────────────────
  // Expands outward rapidly to create a "whoosh" feel
  const burstScale = interpolate(frame, [0, 20], [0.3, 1.2], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const burstOpacity = interpolate(frame, [0, 8, 30], [0.9, 0.7, 0.25], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Lens flare sweep (fast "whoosh" from left to right) ──────────────────
  const flareX = interpolate(frame, [5, 30], [-300, 1920], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const flareOpacity = interpolate(frame, [5, 15, 30], [0, 0.9, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Horizontal accent lines that "whoosh" in from edges ──────────────────
  const lineExtend = interpolate(frame, [3, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Animated particles (float upward, more visible from start) ───────────
  const particleElements = PARTICLES.map((p, i) => {
    const cycleFrame = (frame + p.phase) % 90;
    const yProgress = cycleFrame / 90;
    const particleY = interpolate(yProgress, [0, 1], [100, -10]);
    const particleOpacity = interpolate(yProgress, [0, 0.1, 0.7, 1], [0, 0.9, 0.6, 0]);
    // Particles visible from frame 0
    const particleStartOpacity = interpolate(frame, [0, 3], [0.5, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: `${p.x}%`,
          top: `${particleY}%`,
          width: p.size,
          height: p.size,
          borderRadius: '50%',
          backgroundColor: i % 2 === 0 ? COLORS.gold : COLORS.saffron,
          opacity: particleOpacity * particleStartOpacity,
          boxShadow: `0 0 ${p.size * 4}px ${i % 2 === 0 ? COLORS.gold : COLORS.saffron}`,
        }}
      />
    );
  });

  // ── Glow text shadow for the brand name ──────────────────────────────────
  const glowIntensity = interpolate(frame, [0, 10, 20], [15, 25, 12], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{
      backgroundColor: COLORS.dark,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      opacity: exitOpacity,
    }}>

      {/* ── Radial burst — saffron/gold explosion visible from frame 0 ── */}
      <div style={{
        position: 'absolute',
        width: 900,
        height: 900,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${COLORS.saffron}60, ${COLORS.gold}30, transparent 70%)`,
        transform: `scale(${burstScale})`,
        opacity: burstOpacity,
        filter: 'blur(40px)',
      }} />

      {/* ── Secondary tighter glow for depth ── */}
      <div style={{
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${COLORS.saffron}50, ${COLORS.gold}20, transparent 60%)`,
        opacity: interpolate(frame, [0, 15], [0.6, 0.3], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
        filter: 'blur(25px)',
      }} />

      {/* ── Floating particles ── */}
      {particleElements}

      {/* ── Horizontal accent lines (whoosh from edges) ── */}
      <div style={{
        position: 'absolute',
        top: '42%',
        left: `${50 - lineExtend * 40}%`,
        width: `${lineExtend * 80}%`,
        height: 2,
        background: `linear-gradient(90deg, transparent, ${COLORS.saffron}AA, ${COLORS.gold}FF, ${COLORS.saffron}AA, transparent)`,
        opacity: interpolate(frame, [3, 10, 50], [0, 0.8, 0.3], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
      }} />
      <div style={{
        position: 'absolute',
        top: '58%',
        left: `${50 - lineExtend * 35}%`,
        width: `${lineExtend * 70}%`,
        height: 1,
        background: `linear-gradient(90deg, transparent, ${COLORS.gold}88, transparent)`,
        opacity: interpolate(frame, [5, 12, 50], [0, 0.6, 0.2], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
      }} />

      {/* ── Lens flare streak (fast whoosh) ── */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: 0,
        transform: `translateX(${flareX}px) translateY(-50%)`,
        width: 400,
        height: 6,
        background: `linear-gradient(90deg, transparent, ${COLORS.white}DD, ${COLORS.gold}FF, ${COLORS.white}DD, transparent)`,
        filter: 'blur(3px)',
        opacity: flareOpacity,
        pointerEvents: 'none',
      }} />

      {/* ── Logo / Brand Name — VISIBLE FROM FRAME 0 ── */}
      <div style={{
        fontSize: 90,
        fontFamily: FONTS.heading,
        fontWeight: 900,
        transform: `scale(${combinedLogoScale})`,
        letterSpacing: -2,
        marginBottom: 12,
        opacity: logoOpacity,
        textShadow: `0 0 ${glowIntensity}px ${COLORS.saffron}, 0 0 ${glowIntensity * 2}px ${COLORS.gold}60`,
      }}>
        <span style={{ color: COLORS.saffron }}>GURU</span>
        <span style={{ color: COLORS.gold }}>{' '}SISHYA</span>
      </div>

      {/* ── Website URL — slides up into view ── */}
      <div style={{
        fontSize: 22,
        fontFamily: FONTS.code,
        fontWeight: 500,
        color: COLORS.teal,
        opacity: urlOpacity,
        letterSpacing: 2,
        marginBottom: 20,
        transform: `translateY(${urlSlideUp}px)`,
      }}>
        guru-sishya.in
      </div>

      {/* ── Tagline — slides up into view ── */}
      <div style={{
        fontSize: 20,
        fontFamily: FONTS.text,
        fontWeight: 600,
        color: COLORS.gold,
        opacity: taglineOpacity,
        letterSpacing: 4,
        textTransform: 'uppercase',
        transform: `translateY(${taglineSlideUp}px)`,
      }}>
        Master Your Interview. Land Your Dream Job.
      </div>

      {/* ── Animated underline accent ── */}
      <div style={{
        position: 'absolute',
        bottom: '28%',
        width: interpolate(frame, [8, 35], [0, 350], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
        height: 2,
        background: `linear-gradient(90deg, transparent, ${COLORS.saffron}AA, ${COLORS.gold}FF, ${COLORS.saffron}AA, transparent)`,
        borderRadius: 1,
      }} />
    </AbsoluteFill>
  );
};

export default IntroSlide;
