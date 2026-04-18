import React from 'react';
import { useCurrentFrame, AbsoluteFill, spring, useVideoConfig, interpolate, Audio, staticFile } from 'remotion';
import { COLORS, FONTS } from '../lib/theme';

interface IntroSlideProps {
  topic?: string;
  durationInFrames?: number;
  /** When provided, renders hook mode: bold text + SFX at frame 0, no countdown */
  textHook?: string;
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

// ── Floating code keywords (Matrix-rain style) ─────────────────────────────
const CODE_KEYWORDS = [
  'def', 'class', 'async', 'load_balance', 'O(n)', 'return', 'import',
  'for i in', 'HashMap', 'await', 'yield', 'Promise', 'interface',
  'fn main()', 'SELECT *', 'pub struct', 'lambda', 'O(log n)',
];

interface CodeRainDrop {
  x: number;
  speed: number;
  keyword: string;
  phase: number;
  size: number;
  opacity: number;
}

const CODE_RAIN: CodeRainDrop[] = CODE_KEYWORDS.map((keyword, i) => ({
  x: (i * 5.5 + 3) % 98,
  speed: 1.2 + (i % 4) * 0.6,
  keyword,
  phase: i * 7,
  size: 13 + (i % 3) * 3,
  opacity: 0.12 + (i % 5) * 0.04,
}));

// ── Explosion particles (burst outward from center when logo lands) ─────────
const EXPLOSION_PARTICLES = Array.from({ length: 24 }, (_, i) => {
  const angle = (i / 24) * Math.PI * 2;
  return {
    angle,
    speed: 6 + (i % 5) * 3,
    size: 3 + (i % 3) * 2,
    color: i % 3 === 0 ? COLORS.saffron : i % 3 === 1 ? COLORS.gold : COLORS.teal,
  };
});

const IntroSlide: React.FC<IntroSlideProps> = ({ topic = '', durationInFrames = 90, textHook }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── HOOK MODE: Rich visual hook — logos, animations, dramatic reveal ──────
  if (textHook) {
    // Extract company name from hook text for logo display
    const hookLower = textHook.toLowerCase();
    const companies: Array<{name: string; slug: string; color: string}> = [
      { name: 'Google', slug: 'google', color: '#4285F4' },
      { name: 'Amazon', slug: 'amazon', color: '#FF9900' },
      { name: 'Microsoft', slug: 'microsoft', color: '#00A4EF' },
      { name: 'Meta', slug: 'meta', color: '#0668E1' },
      { name: 'Netflix', slug: 'netflix', color: '#E50914' },
      { name: 'Apple', slug: 'apple', color: '#A2AAAD' },
      { name: 'Uber', slug: 'uber', color: '#000000' },
      { name: 'Flipkart', slug: 'flipkart', color: '#2874F0' },
      { name: 'Swiggy', slug: 'swiggy', color: '#FC8019' },
    ];
    const matchedCompany = companies.find(c => hookLower.includes(c.name.toLowerCase()));

    // Animation phases — spread across 5 seconds (150 frames)
    const phase1End = 30;  // 0-30 frames (1s): dramatic flash + logo zoom
    const phase2End = 70;  // 30-70 frames (1.3s): hook text slams in
    const phase3Start = 90; // 90 frames (3s): branding reveal
    const phase3End = durationInFrames - 15; // breathing room before exit

    // Phase 1: Dramatic flash (longer, more dramatic)
    const flashOpacity = interpolate(frame, [0, 4, 12], [1, 0.7, 0], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });

    // Company logo entrance — bigger, more dramatic
    const logoSpring = spring({ frame: Math.max(0, frame - 3), fps, config: { damping: 10, stiffness: 150, mass: 0.7 } });
    const logoScale = interpolate(logoSpring, [0, 1], [4.0, 1.0]);
    const logoOpacity = interpolate(frame, [3, 10, phase3Start, phase3Start + 15], [0, 1, 1, 0.4], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    // Logo breathing pulse after landing
    const logoBreathe = 1 + interpolate(Math.sin(Math.max(0, frame - 20) * 0.06), [-1, 1], [0, 0.04]);

    // Hook text slam-in — more dramatic delay
    const textSpring = spring({ frame: Math.max(0, frame - phase1End), fps, config: { damping: 8, stiffness: 180, mass: 0.5 } });
    const textScale = interpolate(textSpring, [0, 1], [0.4, 1.0]);
    const textY = interpolate(textSpring, [0, 1], [60, 0]);
    const textOpacity = interpolate(frame, [phase1End, phase1End + 6, phase3End, durationInFrames], [0, 1, 1, 0], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });

    // Radial glow pulse behind text — stronger
    const glowPulse = interpolate(Math.sin(frame * 0.06), [-1, 1], [0.25, 0.7]);

    // Branding reveal — "GURU SISHYA" at phase 3
    const brandSpring = spring({ frame: Math.max(0, frame - phase3Start), fps, config: { damping: 14, stiffness: 100, mass: 0.8 } });
    const brandOpacity = interpolate(brandSpring, [0, 1], [0, 1]);
    const brandScale = interpolate(brandSpring, [0, 1], [0.8, 1.0]);

    // Topic name fade — between text and branding
    const topicOpacity = interpolate(frame, [phase2End, phase2End + 20], [0, 0.9], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });

    // Animated particles (energy burst) — more particles, longer life
    const particleElements = Array.from({ length: 24 }, (_, i) => {
      const angle = (i / 24) * Math.PI * 2;
      const speed = 3 + (i % 5) * 1.8;
      const distance = Math.max(0, frame - 3) * speed;
      const pOpacity = interpolate(frame, [3, 10, 35, 50], [0, 0.9, 0.4, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      });
      return (
        <div key={`p-${i}`} style={{
          position: 'absolute', top: '35%', left: '50%',
          width: 3 + (i % 4), height: 3 + (i % 4), borderRadius: '50%',
          backgroundColor: i % 3 === 0 ? COLORS.saffron : i % 3 === 1 ? COLORS.gold : COLORS.teal,
          transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`,
          opacity: pOpacity,
          boxShadow: `0 0 ${10 + (i % 3) * 6}px ${i % 2 === 0 ? COLORS.saffron : COLORS.gold}`,
        }} />
      );
    });

    // Scanning line effect — slower sweep
    const scanLineY = interpolate(frame, [0, 30], [-5, 105], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });

    // Horizontal accent lines (cinematic widescreen feel)
    const lineExtend = interpolate(frame, [phase1End, phase1End + 20], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });

    // Corner decorative elements
    const cornerOpacity = interpolate(frame, [15, 30], [0, 0.5], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });

    return (
      <AbsoluteFill style={{ backgroundColor: '#0C0A15', overflow: 'hidden' }}>
        {/* Animated tech grid background — never plain black */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          {/* Subtle grid pattern */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `
              linear-gradient(rgba(232,93,38,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(232,93,38,0.03) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }} />
          {/* Radial gradient overlay for depth */}
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(ellipse at 50% 40%, rgba(232,93,38,0.06) 0%, transparent 50%)`,
          }} />
          {/* Floating code keywords (subtle, background) */}
          {Array.from({ length: 12 }, (_, i) => {
            const keywords = ['async', 'await', 'class', 'function', 'return', 'import', 'const', 'interface', 'deploy', 'scale', 'cache', 'query'];
            const x = (i * 8.3 + 2) % 100;
            const cycleFrame = (frame + i * 15) % 150;
            const y = (cycleFrame / 150) * 120 - 10;
            return (
              <div key={`kw-${i}`} style={{
                position: 'absolute', left: `${x}%`, top: `${y}%`,
                fontSize: 13, fontFamily: 'JetBrains Mono, monospace',
                color: COLORS.teal, opacity: 0.06 + (i % 3) * 0.02,
                whiteSpace: 'nowrap',
              }}>{keywords[i]}</div>
            );
          })}
        </div>

        {/* SFX impact */}
        <Audio src={staticFile('audio/sfx/impact.wav')} volume={0.6} />

        {/* Phase 1: White flash on entry */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundColor: matchedCompany ? matchedCompany.color : COLORS.saffron,
          opacity: flashOpacity,
        }} />

        {/* Scanning line */}
        <div style={{
          position: 'absolute', left: 0, right: 0, top: `${scanLineY}%`,
          height: 3, background: `linear-gradient(90deg, transparent, ${COLORS.saffron}AA, ${COLORS.gold}FF, ${COLORS.saffron}AA, transparent)`,
          opacity: interpolate(frame, [0, 5, 15, 20], [0, 0.8, 0.6, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          boxShadow: `0 0 20px ${COLORS.saffron}60`,
        }} />

        {/* Radial glow behind content */}
        <div style={{
          position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 800, height: 800, borderRadius: '50%',
          background: `radial-gradient(circle, ${matchedCompany ? matchedCompany.color + '30' : COLORS.saffron + '25'}, transparent 60%)`,
          opacity: glowPulse, filter: 'blur(40px)',
        }} />

        {/* Energy burst particles */}
        {particleElements}

        {/* Corner decorative brackets (cinematic frame) */}
        <div style={{ position: 'absolute', top: 40, left: 40, width: 40, height: 40, borderTop: `2px solid ${COLORS.saffron}`, borderLeft: `2px solid ${COLORS.saffron}`, opacity: cornerOpacity }} />
        <div style={{ position: 'absolute', top: 40, right: 40, width: 40, height: 40, borderTop: `2px solid ${COLORS.saffron}`, borderRight: `2px solid ${COLORS.saffron}`, opacity: cornerOpacity }} />
        <div style={{ position: 'absolute', bottom: 40, left: 40, width: 40, height: 40, borderBottom: `2px solid ${COLORS.saffron}`, borderLeft: `2px solid ${COLORS.saffron}`, opacity: cornerOpacity }} />
        <div style={{ position: 'absolute', bottom: 40, right: 40, width: 40, height: 40, borderBottom: `2px solid ${COLORS.saffron}`, borderRight: `2px solid ${COLORS.saffron}`, opacity: cornerOpacity }} />

        {/* Horizontal accent lines — cinematic widescreen feel */}
        <div style={{
          position: 'absolute', top: '35%', left: `${50 - lineExtend * 40}%`, width: `${lineExtend * 80}%`, height: 1,
          background: `linear-gradient(90deg, transparent, ${COLORS.saffron}66, ${COLORS.gold}99, ${COLORS.saffron}66, transparent)`,
          opacity: 0.6,
        }} />
        <div style={{
          position: 'absolute', top: '65%', left: `${50 - lineExtend * 35}%`, width: `${lineExtend * 70}%`, height: 1,
          background: `linear-gradient(90deg, transparent, ${COLORS.gold}44, transparent)`,
          opacity: 0.4,
        }} />

        {/* Company logo (if detected in hook text) — bigger with glow ring */}
        {matchedCompany && (
          <div style={{
            position: 'absolute', top: '14%', left: '50%',
            transform: `translateX(-50%) scale(${logoScale * logoBreathe})`,
            opacity: logoOpacity,
          }}>
            {/* Glow ring behind logo */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: 160, height: 160, borderRadius: '50%',
              border: `2px solid ${matchedCompany.color}44`,
              boxShadow: `0 0 40px ${matchedCompany.color}33, inset 0 0 30px ${matchedCompany.color}11`,
            }} />
            <img
              src={`https://cdn.simpleicons.org/${matchedCompany.slug}/${matchedCompany.color.replace('#', '')}`}
              style={{ width: 100, height: 100, position: 'relative', filter: `drop-shadow(0 0 30px ${matchedCompany.color}88)` }}
            />
          </div>
        )}

        {/* "INTERVIEW QUESTION" badge — with glow */}
        <div style={{
          position: 'absolute', top: matchedCompany ? '30%' : '22%', left: '50%',
          transform: 'translateX(-50%)',
          opacity: interpolate(frame, [8, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}>
          <div style={{
            background: `linear-gradient(135deg, ${COLORS.saffron}FF, ${COLORS.gold}DD)`,
            borderRadius: 999, padding: '8px 28px',
            boxShadow: `0 4px 24px ${COLORS.saffron}66, 0 0 60px ${COLORS.saffron}22`,
          }}>
            <span style={{
              fontSize: 15, fontFamily: FONTS.text, fontWeight: 800,
              color: COLORS.dark, letterSpacing: 4, textTransform: 'uppercase',
            }}>
              {matchedCompany ? `${matchedCompany.name.toUpperCase()} INTERVIEW` : 'INTERVIEW QUESTION'}
            </span>
          </div>
        </div>

        {/* Hook text — main message (bigger, more dramatic) */}
        <div style={{
          position: 'absolute', top: '40%', left: 0, right: 0,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          transform: `scale(${textScale}) translateY(${textY}px)`,
          opacity: textOpacity,
        }}>
          <div style={{
            fontSize: 60, fontFamily: FONTS.heading, fontWeight: 900,
            color: COLORS.textOnDark, textAlign: 'center',
            maxWidth: '72%', lineHeight: 1.2, letterSpacing: -2,
            textShadow: `0 0 50px ${COLORS.saffron}40, 0 6px 20px rgba(0,0,0,0.95)`,
          }}>
            {textHook}
          </div>
        </div>

        {/* Topic name — appears after hook text */}
        <div style={{
          position: 'absolute', bottom: '22%', left: 0, right: 0,
          textAlign: 'center', opacity: topicOpacity,
        }}>
          <span style={{
            fontSize: 32, fontFamily: FONTS.heading, fontWeight: 700,
            color: COLORS.gold, letterSpacing: 4, textTransform: 'uppercase',
            textShadow: `0 0 20px ${COLORS.gold}40`,
          }}>
            {topic}
          </span>
        </div>

        {/* GURU SISHYA branding — full branded bar at bottom */}
        <div style={{
          position: 'absolute', bottom: '6%', left: 0, right: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          transform: `scale(${brandScale})`, opacity: brandOpacity,
        }}>
          {/* Gradient divider line */}
          <div style={{
            width: 200, height: 2,
            background: `linear-gradient(90deg, transparent, ${COLORS.saffron}CC, ${COLORS.gold}FF, ${COLORS.saffron}CC, transparent)`,
          }} />
          {/* Brand name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              fontSize: 28, fontFamily: FONTS.heading, fontWeight: 900,
              letterSpacing: -1,
            }}>
              <span style={{ color: COLORS.saffron }}>GURU</span>
              <span style={{ color: COLORS.gold }}>{' '}SISHYA</span>
            </span>
          </div>
          {/* Tagline */}
          <span style={{
            fontSize: 13, fontFamily: FONTS.text, fontWeight: 500,
            color: `${COLORS.teal}CC`, letterSpacing: 3, textTransform: 'uppercase',
          }}>
            Master Your Interview. Land Your Dream Job.
          </span>
          {/* Website */}
          <span style={{
            fontSize: 14, fontFamily: FONTS.code, fontWeight: 400,
            color: `${COLORS.teal}88`, letterSpacing: 2,
          }}>
            guru-sishya.in
          </span>
        </div>
      </AbsoluteFill>
    );
  }

  // ── PHASE TIMING ──────────────────────────────────────────────────────────
  // Frames 0–60:  Countdown "3... 2... 1..."  (each number gets 20 frames)
  // Frame 60:     Logo zoom-in + particle explosion
  // Frame 80+:    URL, tagline, typewriter topic title
  // Last 12:      Exit fade
  const COUNTDOWN_END = 60;
  const LOGO_START = COUNTDOWN_END;
  const logoFrame = Math.max(0, frame - LOGO_START);

  // ── COUNTDOWN: "3... 2... 1..." ───────────────────────────────────────────
  const countdownNumbers = [3, 2, 1];
  const countdownElements = countdownNumbers.map((num, i) => {
    const start = i * 20;
    const localFrame = frame - start;
    if (frame < start || frame >= COUNTDOWN_END) return null;
    const numSpring = spring({
      frame: Math.max(0, localFrame),
      fps,
      config: { damping: 8, stiffness: 250, mass: 0.5 },
    });
    const numScale = interpolate(numSpring, [0, 1], [3.0, 1.0]);
    const numOpacity = interpolate(localFrame, [0, 5, 14, 20], [0, 1, 1, 0], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    return (
      <div key={num} style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: `translate(-50%, -50%) scale(${numScale})`,
        fontSize: 180, fontFamily: FONTS.heading, fontWeight: 900,
        color: num === 1 ? COLORS.saffron : COLORS.gold,
        opacity: numOpacity,
        textShadow: `0 0 40px ${COLORS.saffron}80, 0 0 80px ${COLORS.gold}40`,
        letterSpacing: -4,
      }}>{num}</div>
    );
  });

  // ── Countdown pulse ring ──────────────────────────────────────────────────
  const countdownBeat = frame < COUNTDOWN_END
    ? interpolate(frame % 20, [0, 5, 20], [0, 1, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
    : 0;
  const beatScale = 1 + countdownBeat * 0.8;

  // ── Code rain (Matrix-style keywords, visible during countdown) ───────────
  const codeRainOpacity = interpolate(frame, [0, 10, COUNTDOWN_END, COUNTDOWN_END + 20], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const codeRainElements = CODE_RAIN.map((drop, i) => {
    const cycleLength = 120;
    const localFrame = (frame + drop.phase) % cycleLength;
    const y = (localFrame * drop.speed) % 120 - 10;
    return (
      <div key={`rain-${i}`} style={{
        position: 'absolute', left: `${drop.x}%`, top: `${y}%`,
        fontSize: drop.size, fontFamily: FONTS.code, fontWeight: 500,
        color: COLORS.teal, opacity: drop.opacity * codeRainOpacity,
        whiteSpace: 'nowrap', textShadow: `0 0 8px ${COLORS.teal}40`,
      }}>{drop.keyword}</div>
    );
  });

  // ── Logo zoom-in (starts at LOGO_START) ───────────────────────────────────
  const logoSpring = spring({
    frame: logoFrame, fps,
    config: { damping: 14, stiffness: 180, mass: 0.8 },
  });
  const logoScale = interpolate(logoSpring, [0, 1], [2.5, 1]);

  const logoOpacity = frame < LOGO_START ? 0
    : interpolate(logoFrame, [0, 5], [0.7, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      });

  // ── Breathing / pulse on logo ─────────────────────────────────────────────
  const breatheProgress = Math.max(0, logoFrame - 15);
  const breatheScale = 1 + interpolate(Math.sin(breatheProgress * 0.1), [-1, 1], [0, 0.015]);
  const combinedLogoScale = logoScale * breatheScale;

  // ── PARTICLE EXPLOSION (burst when logo lands) ────────────────────────────
  const explosionFrame = Math.max(0, logoFrame - 5);
  const explosionElements = EXPLOSION_PARTICLES.map((p, i) => {
    if (frame < LOGO_START + 5 || explosionFrame > 40) return null;
    const distance = explosionFrame * p.speed;
    const x = Math.cos(p.angle) * distance;
    const y = Math.sin(p.angle) * distance;
    const pOpacity = interpolate(explosionFrame, [0, 5, 30, 40], [0, 1, 0.4, 0], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    return (
      <div key={`exp-${i}`} style={{
        position: 'absolute', top: '50%', left: '50%',
        width: p.size, height: p.size, borderRadius: '50%',
        backgroundColor: p.color,
        transform: `translate(${x}px, ${y}px)`,
        opacity: pOpacity,
        boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
      }} />
    );
  });

  // ── URL appears ───────────────────────────────────────────────────────────
  const urlOpacity = interpolate(logoFrame, [12, 22], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const urlSlideUp = interpolate(logoFrame, [12, 22], [20, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Tagline appears after URL ─────────────────────────────────────────────
  const taglineOpacity = interpolate(logoFrame, [25, 40], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const taglineSlideUp = interpolate(logoFrame, [25, 40], [15, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── TYPEWRITER topic title ────────────────────────────────────────────────
  const typewriterStart = LOGO_START + 35;
  const typewriterElapsed = Math.max(0, frame - typewriterStart);
  const visibleChars = Math.min(topic.length, Math.floor(typewriterElapsed * 1.2));
  const displayedTopic = topic.slice(0, visibleChars);
  const showCursor = frame >= typewriterStart && visibleChars < topic.length;
  const cursorBlink = Math.sin(frame * 0.3) > 0;
  const topicOpacity = interpolate(frame, [typewriterStart, typewriterStart + 8], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Exit fade ─────────────────────────────────────────────────────────────
  const exitOpacity = frame > durationInFrames - 12
    ? interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
    : 1;

  // ── Saffron/gold radial burst ─────────────────────────────────────────────
  const burstScale = interpolate(logoFrame, [0, 20], [0.3, 1.2], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const burstOpacity = frame < LOGO_START ? 0
    : interpolate(logoFrame, [0, 8, 30], [0.9, 0.7, 0.25], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      });

  // ── Lens flare sweep — WIDER and BRIGHTER ─────────────────────────────────
  const flareX = interpolate(logoFrame, [3, 25], [-600, 2200], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const flareOpacity = interpolate(logoFrame, [3, 10, 20, 25], [0, 1.0, 0.6, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Horizontal accent lines ───────────────────────────────────────────────
  const lineExtend = interpolate(logoFrame, [3, 18], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Animated particles (float upward) ─────────────────────────────────────
  const particleElements = PARTICLES.map((p, i) => {
    const cycleFrame = (frame + p.phase) % 90;
    const yProgress = cycleFrame / 90;
    const particleY = interpolate(yProgress, [0, 1], [100, -10]);
    const particleOpacity = interpolate(yProgress, [0, 0.1, 0.7, 1], [0, 0.9, 0.6, 0]);
    const particleStartOpacity = interpolate(frame, [0, 3], [0.5, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    return (
      <div key={i} style={{
        position: 'absolute', left: `${p.x}%`, top: `${particleY}%`,
        width: p.size, height: p.size, borderRadius: '50%',
        backgroundColor: i % 2 === 0 ? COLORS.gold : COLORS.saffron,
        opacity: particleOpacity * particleStartOpacity,
        boxShadow: `0 0 ${p.size * 4}px ${i % 2 === 0 ? COLORS.gold : COLORS.saffron}`,
      }} />
    );
  });

  // ── Glow text shadow ──────────────────────────────────────────────────────
  const glowIntensity = interpolate(logoFrame, [0, 10, 20], [15, 25, 12], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{
      backgroundColor: '#0C0A15',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      opacity: exitOpacity,
    }}>

      {/* ── Code rain background (Matrix-style floating keywords) ── */}
      {codeRainElements}

      {/* ── Countdown pulse ring ── */}
      {frame < COUNTDOWN_END && (
        <div style={{
          position: 'absolute',
          width: 300, height: 300, borderRadius: '50%',
          border: `3px solid ${COLORS.saffron}60`,
          transform: `scale(${beatScale})`,
          opacity: countdownBeat * 0.6,
          boxShadow: `0 0 60px ${COLORS.saffron}30, inset 0 0 60px ${COLORS.saffron}10`,
        }} />
      )}

      {/* ── Countdown numbers: 3... 2... 1... ── */}
      {countdownElements}

      {/* ── Radial burst — saffron/gold explosion after countdown ── */}
      <div style={{
        position: 'absolute',
        width: 900, height: 900, borderRadius: '50%',
        background: `radial-gradient(circle, ${COLORS.saffron}60, ${COLORS.gold}30, transparent 70%)`,
        transform: `scale(${burstScale})`,
        opacity: burstOpacity,
        filter: 'blur(40px)',
      }} />

      {/* ── Secondary tighter glow ── */}
      <div style={{
        position: 'absolute',
        width: 400, height: 400, borderRadius: '50%',
        background: `radial-gradient(circle, ${COLORS.saffron}50, ${COLORS.gold}20, transparent 60%)`,
        opacity: frame < LOGO_START ? 0 : interpolate(logoFrame, [0, 15], [0.6, 0.3], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        }),
        filter: 'blur(25px)',
      }} />

      {/* ── Floating particles ── */}
      {particleElements}

      {/* ── Particle explosion (saffron/gold/teal dots radiating outward) ── */}
      {explosionElements}

      {/* ── Horizontal accent lines (whoosh from edges) ── */}
      {frame >= LOGO_START && (<>
        <div style={{
          position: 'absolute', top: '42%',
          left: `${50 - lineExtend * 40}%`, width: `${lineExtend * 80}%`, height: 2,
          background: `linear-gradient(90deg, transparent, ${COLORS.saffron}AA, ${COLORS.gold}FF, ${COLORS.saffron}AA, transparent)`,
          opacity: interpolate(logoFrame, [3, 10, 50], [0, 0.8, 0.3], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          }),
        }} />
        <div style={{
          position: 'absolute', top: '58%',
          left: `${50 - lineExtend * 35}%`, width: `${lineExtend * 70}%`, height: 1,
          background: `linear-gradient(90deg, transparent, ${COLORS.gold}88, transparent)`,
          opacity: interpolate(logoFrame, [5, 12, 50], [0, 0.6, 0.2], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          }),
        }} />
      </>)}

      {/* ── Lens flare — WIDER sweep, BRIGHTER peak, dual-layer ── */}
      {frame >= LOGO_START && (<>
        <div style={{
          position: 'absolute', top: '50%', left: 0,
          transform: `translateX(${flareX}px) translateY(-50%)`,
          width: 700, height: 10,
          background: `linear-gradient(90deg, transparent, ${COLORS.textOnDark}EE, ${COLORS.gold}FF, ${COLORS.textOnDark}FF, ${COLORS.gold}FF, ${COLORS.textOnDark}EE, transparent)`,
          filter: 'blur(2px)', opacity: flareOpacity, pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: '50%', left: 0,
          transform: `translateX(${flareX - 100}px) translateY(-50%)`,
          width: 1000, height: 60,
          background: `linear-gradient(90deg, transparent, ${COLORS.saffron}40, ${COLORS.gold}60, ${COLORS.saffron}40, transparent)`,
          filter: 'blur(20px)', opacity: flareOpacity * 0.7, pointerEvents: 'none',
        }} />
      </>)}

      {/* ── Logo / Brand Name — appears after countdown ── */}
      {frame >= LOGO_START && (
        <div style={{
          fontSize: 90, fontFamily: FONTS.heading, fontWeight: 900,
          transform: `scale(${combinedLogoScale})`,
          letterSpacing: -2, marginBottom: 12, opacity: logoOpacity,
          textShadow: `0 0 ${glowIntensity}px ${COLORS.saffron}, 0 0 ${glowIntensity * 2}px ${COLORS.gold}60`,
        }}>
          <span style={{ color: COLORS.saffron }}>GURU</span>
          <span style={{ color: COLORS.gold }}>{' '}SISHYA</span>
        </div>
      )}

      {/* ── Website URL — slides up ── */}
      {frame >= LOGO_START && (
        <div style={{
          fontSize: 22, fontFamily: FONTS.code, fontWeight: 500,
          color: COLORS.teal, opacity: urlOpacity, letterSpacing: 2,
          marginBottom: 20, transform: `translateY(${urlSlideUp}px)`,
        }}>
          guru-sishya.in
        </div>
      )}

      {/* ── Tagline — slides up ── */}
      {frame >= LOGO_START && (
        <div style={{
          fontSize: 20, fontFamily: FONTS.text, fontWeight: 600,
          color: COLORS.gold, opacity: taglineOpacity, letterSpacing: 4,
          textTransform: 'uppercase', transform: `translateY(${taglineSlideUp}px)`,
        }}>
          Master Your Interview. Land Your Dream Job.
        </div>
      )}

      {/* ── Typewriter topic title (types out character-by-character) ── */}
      {topic && frame >= typewriterStart && (
        <div style={{
          marginTop: 24, fontSize: 32, fontFamily: FONTS.heading, fontWeight: 800,
          color: COLORS.textOnDark, opacity: topicOpacity, letterSpacing: 1,
          textAlign: 'center', textShadow: `0 0 20px ${COLORS.teal}40`,
        }}>
          <span style={{ color: COLORS.teal }}>&gt; </span>
          {displayedTopic}
          {showCursor && cursorBlink && (
            <span style={{ color: COLORS.saffron, marginLeft: 2 }}>|</span>
          )}
          {visibleChars >= topic.length && (
            <span style={{
              color: COLORS.saffron, marginLeft: 2,
              opacity: interpolate(Math.sin(frame * 0.15), [-1, 1], [0.3, 1]),
            }}>|</span>
          )}
        </div>
      )}

      {/* ── Animated underline accent ── */}
      {frame >= LOGO_START && (
        <div style={{
          position: 'absolute', bottom: '22%',
          width: interpolate(logoFrame, [8, 35], [0, 350], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          }),
          height: 2,
          background: `linear-gradient(90deg, transparent, ${COLORS.saffron}AA, ${COLORS.gold}FF, ${COLORS.saffron}AA, transparent)`,
          borderRadius: 1,
        }} />
      )}
    </AbsoluteFill>
  );
};

export default IntroSlide;
