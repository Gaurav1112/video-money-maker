import React from 'react';
import { useCurrentFrame, AbsoluteFill, spring, useVideoConfig, interpolate } from 'remotion';
import { COLORS, FONTS } from '../lib/theme';
import { fadeIn } from '../lib/animations';

interface IntroSlideProps {
  durationInFrames?: number; // default 90 (3 seconds at 30fps)
}

// Particle definition — each has a fixed horizontal position and a phase offset
const PARTICLES = [
  { x: 15, phase: 0,  size: 3 },
  { x: 35, phase: 10, size: 2 },
  { x: 55, phase: 5,  size: 4 },
  { x: 72, phase: 18, size: 2 },
  { x: 88, phase: 8,  size: 3 },
];

const IntroSlide: React.FC<IntroSlideProps> = ({ durationInFrames = 90 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Logo spring entrance ──────────────────────────────────────────────────
  const logoScale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });

  // ── Breathing / pulse on logo (subtle scale oscillation) ─────────────────
  // Starts after logo has mostly settled (~frame 20) so it doesn't fight the spring
  const breatheProgress = Math.max(0, frame - 20);
  const breatheScale = 1 + interpolate(Math.sin(breatheProgress * 0.08), [-1, 1], [0, 0.02]);
  const combinedLogoScale = logoScale * breatheScale;

  // ── Fade-in timings ───────────────────────────────────────────────────────
  const logoOpacity    = fadeIn(frame, 10, 25);          // logo fades in
  const urlOpacity     = fadeIn(frame, 35, 15);          // URL fades in 0.5s after logo (~frame 35)
  const taglineOpacity = fadeIn(frame, 50, 20);          // tagline follows URL

  // ── Exit fade ─────────────────────────────────────────────────────────────
  const exitOpacity = frame > durationInFrames - 15
    ? 1 - fadeIn(frame, durationInFrames - 15, 15)
    : 1;

  // ── Lens flare sweep ─────────────────────────────────────────────────────
  // Sweeps from left (x = -300) to right (x = 1920) between frames 25–55
  const flareX = interpolate(frame, [25, 55], [-300, 1920], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const flareOpacity = interpolate(frame, [25, 40, 55], [0, 0.85, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Animated particles (float upward) ─────────────────────────────────────
  // Each particle drifts upward over 90 frames, cycling from bottom to top
  const particleElements = PARTICLES.map((p, i) => {
    const cycleFrame = (frame + p.phase) % 90;
    const yProgress = cycleFrame / 90;                // 0 → 1 over one cycle
    const particleY = interpolate(yProgress, [0, 1], [90, -10]);    // % from top
    const particleOpacity = interpolate(yProgress, [0, 0.15, 0.75, 1], [0, 0.8, 0.5, 0]);
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
          backgroundColor: COLORS.gold,
          opacity: particleOpacity,
          boxShadow: `0 0 ${p.size * 3}px ${COLORS.gold}`,
        }}
      />
    );
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

      {/* ── Floating particles ── */}
      {particleElements}

      {/* ── Ambient glow behind logo ── */}
      <div style={{
        position: 'absolute',
        width: 500,
        height: 500,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${COLORS.saffron}30, ${COLORS.gold}12, transparent 70%)`,
        filter: 'blur(70px)',
      }} />

      {/* ── Lens flare streak ── */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: 0,
        transform: `translateX(${flareX}px) translateY(-50%)`,
        width: 300,
        height: 4,
        background: `linear-gradient(90deg, transparent, ${COLORS.white}CC, ${COLORS.gold}FF, ${COLORS.white}CC, transparent)`,
        filter: 'blur(3px)',
        opacity: flareOpacity,
        pointerEvents: 'none',
      }} />
      {/* Secondary narrower streak for realism */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: 0,
        transform: `translateX(${flareX + 20}px) translateY(-50%)`,
        width: 180,
        height: 2,
        background: `linear-gradient(90deg, transparent, ${COLORS.gold}AA, transparent)`,
        filter: 'blur(1px)',
        opacity: flareOpacity * 0.6,
        pointerEvents: 'none',
      }} />

      {/* ── Logo / Brand Name ── */}
      <div style={{
        fontSize: 80,
        fontFamily: FONTS.heading,
        fontWeight: 900,
        transform: `scale(${combinedLogoScale})`,
        letterSpacing: -2,
        marginBottom: 8,
        opacity: logoOpacity,
      }}>
        <span style={{ color: COLORS.saffron }}>Guru</span>
        <span style={{ color: COLORS.gold }}> Sishya</span>
      </div>

      {/* ── Website URL ── */}
      <div style={{
        fontSize: 20,
        fontFamily: FONTS.code,
        fontWeight: 400,
        color: COLORS.teal,
        opacity: urlOpacity,
        letterSpacing: 1,
        marginBottom: 18,
      }}>
        www.guru-sishya.in
      </div>

      {/* ── Tagline ── */}
      <div style={{
        fontSize: 18,
        fontFamily: FONTS.text,
        fontWeight: 500,
        color: COLORS.gold,
        opacity: taglineOpacity,
        letterSpacing: 3,
        textTransform: 'uppercase',
      }}>
        Master Your Interview. Land Your Dream Job.
      </div>

      {/* ── Subtle animated underline ── */}
      <div style={{
        position: 'absolute',
        bottom: '28%',
        width: fadeIn(frame, 30, 40) * 320,
        height: 1,
        background: `linear-gradient(90deg, transparent, ${COLORS.saffron}88, transparent)`,
      }} />
    </AbsoluteFill>
  );
};

export default IntroSlide;
