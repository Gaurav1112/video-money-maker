import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  spring,
  interpolate,
  Audio,
  staticFile,
} from 'remotion';
import { COLORS, FONTS } from '../lib/theme';

/* ─────────────────────────────────────────────────────────────────────────────
 * CinematicOpener — 6 movie-trailer styles, unique per topic
 *
 * Replaces IntroSlide for the first INTRO_DURATION (150 frames / 5 seconds).
 * Each style packs 3 dramatic phases into 5 seconds:
 *   Phase 1 (0-1.5s / 0-45f):   Dramatic visual — flash, logo, particles
 *   Phase 2 (1.5-3.5s / 45-105f): Hook visual — interview, crisis, comparison
 *   Phase 3 (3.5-5s / 105-150f):  Topic title + branding + smooth exit
 * ───────────────────────────────────────────────────────────────────────────── */

interface CinematicOpenerProps {
  topic: string;
  sessionNumber: number;
  hookText: string;
  hookNarration: string;
  durationInFrames: number;
}

// ── Style selection logic ────────────────────────────────────────────────────
function selectStyle(topic: string, sessionNumber: number): number {
  const lower = topic.toLowerCase();
  if (lower.includes(' vs ') || lower.includes('comparison') || lower.includes('versus'))
    return 4;
  if (
    lower.includes('http') ||
    lower.includes('tcp') ||
    lower.includes('dns') ||
    lower.includes('networking')
  )
    return 5;
  if (
    ['tree', 'graph', 'sort', 'search', 'hash', 'array', 'linked', 'stack', 'queue', 'heap'].some(
      (k) => lower.includes(k),
    )
  )
    return 3;
  if (
    lower.includes('load') ||
    lower.includes('cach') ||
    lower.includes('database') ||
    lower.includes('scaling') ||
    lower.includes('system design')
  )
    return 2;
  // Rotate remaining between interview (1), crisis (2), salary (6)
  return [1, 2, 6][sessionNumber % 3];
}

// ── Company detection (shared across styles) ────────────────────────────────
const COMPANIES = [
  { name: 'Google', color: '#4285F4', slug: 'google' },
  { name: 'Amazon', color: '#FF9900', slug: 'amazon' },
  { name: 'Microsoft', color: '#00A4EF', slug: 'microsoft' },
  { name: 'Meta', color: '#0668E1', slug: 'meta' },
  { name: 'Netflix', color: '#E50914', slug: 'netflix' },
  { name: 'Apple', color: '#A2AAAD', slug: 'apple' },
  { name: 'Uber', color: '#000000', slug: 'uber' },
  { name: 'Flipkart', color: '#2874F0', slug: 'flipkart' },
  { name: 'Swiggy', color: '#FC8019', slug: 'swiggy' },
];

function detectCompany(text: string) {
  const lower = text.toLowerCase();
  return COMPANIES.find((c) => lower.includes(c.name.toLowerCase()));
}

// ── Shared sub-components ────────────────────────────────────────────────────

/** Tech grid background — CSS grid lines + radial gradient + floating keywords */
const TechGridBg: React.FC<{ frame: number; accentColor?: string }> = ({
  frame,
  accentColor = COLORS.saffron,
}) => {
  const keywords = [
    'async',
    'await',
    'class',
    'function',
    'return',
    'import',
    'const',
    'deploy',
    'scale',
    'cache',
    'query',
    'struct',
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Grid lines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(${accentColor}08 1px, transparent 1px),
            linear-gradient(90deg, ${accentColor}08 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
      {/* Radial glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 50% 40%, ${accentColor}0A 0%, transparent 50%)`,
        }}
      />
      {/* Floating code keywords */}
      {keywords.map((kw, i) => {
        const x = (i * 8.3 + 2) % 100;
        const cycleFrame = (frame + i * 15) % 150;
        const y = (cycleFrame / 150) * 120 - 10;
        return (
          <div
            key={`kw-${i}`}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              fontSize: 13,
              fontFamily: 'JetBrains Mono, monospace',
              color: COLORS.teal,
              opacity: 0.06 + (i % 3) * 0.02,
              whiteSpace: 'nowrap',
            }}
          >
            {kw}
          </div>
        );
      })}
    </div>
  );
};

/** Cinematic corner brackets */
const CinematicFrame: React.FC<{ opacity: number }> = ({ opacity }) => (
  <>
    <div
      style={{
        position: 'absolute',
        top: 40,
        left: 40,
        width: 40,
        height: 40,
        borderTop: `2px solid ${COLORS.saffron}`,
        borderLeft: `2px solid ${COLORS.saffron}`,
        opacity,
      }}
    />
    <div
      style={{
        position: 'absolute',
        top: 40,
        right: 40,
        width: 40,
        height: 40,
        borderTop: `2px solid ${COLORS.saffron}`,
        borderRight: `2px solid ${COLORS.saffron}`,
        opacity,
      }}
    />
    <div
      style={{
        position: 'absolute',
        bottom: 40,
        left: 40,
        width: 40,
        height: 40,
        borderBottom: `2px solid ${COLORS.saffron}`,
        borderLeft: `2px solid ${COLORS.saffron}`,
        opacity,
      }}
    />
    <div
      style={{
        position: 'absolute',
        bottom: 40,
        right: 40,
        width: 40,
        height: 40,
        borderBottom: `2px solid ${COLORS.saffron}`,
        borderRight: `2px solid ${COLORS.saffron}`,
        opacity,
      }}
    />
  </>
);

/** Particle burst from center */
const ParticleBurst: React.FC<{ frame: number; startFrame: number; count?: number }> = ({
  frame,
  startFrame,
  count = 20,
}) => {
  const elapsed = Math.max(0, frame - startFrame);
  if (elapsed > 50) return null;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const speed = 4 + (i % 5) * 2;
        const distance = elapsed * speed;
        const pOpacity = interpolate(elapsed, [0, 5, 35, 50], [0, 0.9, 0.3, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <div
            key={`pb-${i}`}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 3 + (i % 3),
              height: 3 + (i % 3),
              borderRadius: '50%',
              backgroundColor:
                i % 3 === 0 ? COLORS.saffron : i % 3 === 1 ? COLORS.gold : COLORS.teal,
              transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`,
              opacity: pOpacity,
              boxShadow: `0 0 8px ${i % 2 === 0 ? COLORS.saffron : COLORS.gold}`,
            }}
          />
        );
      })}
    </>
  );
};

/** Branding bar — GURU SISHYA + tagline, used in Phase 3 of all styles */
const BrandingReveal: React.FC<{ frame: number; fps: number; startFrame: number }> = ({
  frame,
  fps,
  startFrame,
}) => {
  const bSpring = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.8 },
  });
  const brandOpacity = interpolate(bSpring, [0, 1], [0, 1]);
  const brandScale = interpolate(bSpring, [0, 1], [0.8, 1.0]);
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '6%',
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        transform: `scale(${brandScale})`,
        opacity: brandOpacity,
      }}
    >
      <div
        style={{
          width: 200,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${COLORS.saffron}CC, ${COLORS.gold}FF, ${COLORS.saffron}CC, transparent)`,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 28, fontFamily: FONTS.heading, fontWeight: 900, letterSpacing: -1 }}>
          <span style={{ color: COLORS.saffron }}>GURU</span>
          <span style={{ color: COLORS.gold }}> SISHYA</span>
        </span>
      </div>
      <span
        style={{
          fontSize: 13,
          fontFamily: FONTS.text,
          fontWeight: 500,
          color: `${COLORS.teal}CC`,
          letterSpacing: 3,
          textTransform: 'uppercase',
        }}
      >
        Master Your Interview
      </span>
    </div>
  );
};

/** Topic title slam — big text with spring */
const TopicSlam: React.FC<{
  topic: string;
  frame: number;
  fps: number;
  startFrame: number;
  exitFrame: number;
  totalFrames: number;
}> = ({ topic, frame, fps, startFrame, exitFrame, totalFrames }) => {
  const tSpring = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 8, stiffness: 200, mass: 0.5 },
  });
  const scale = interpolate(tSpring, [0, 1], [0.3, 1.0]);
  const opacity = interpolate(
    frame,
    [startFrame, startFrame + 6, exitFrame, totalFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '22%',
        left: 0,
        right: 0,
        textAlign: 'center',
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      <span
        style={{
          fontSize: 38,
          fontFamily: FONTS.heading,
          fontWeight: 800,
          color: COLORS.gold,
          letterSpacing: 3,
          textTransform: 'uppercase',
          textShadow: `0 0 30px ${COLORS.gold}40`,
        }}
      >
        {topic}
      </span>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
 * STYLE 1: "THE INTERVIEW"
 * Company logo zoom + interview question + topic reveal
 * ═══════════════════════════════════════════════════════════════════════════════ */
const StyleInterview: React.FC<{
  topic: string;
  hookText: string;
  frame: number;
  fps: number;
  dur: number;
}> = ({ topic, hookText, frame, fps, dur }) => {
  const company = detectCompany(hookText) || detectCompany(topic);
  const accentColor = company?.color || COLORS.saffron;

  // Phase 1: Flash + company logo zoom (0-45f)
  const flashOp = interpolate(frame, [0, 4, 14], [1, 0.7, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const logoSpring = spring({
    frame: Math.max(0, frame - 3),
    fps,
    config: { damping: 10, stiffness: 150, mass: 0.7 },
  });
  const logoScale = interpolate(logoSpring, [0, 1], [4.0, 1.0]);
  const logoOp = interpolate(frame, [3, 10, 90, 105], [0, 1, 1, 0.3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Phase 2: Hook text slam (45-105f)
  const textSpring = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 8, stiffness: 180, mass: 0.5 },
  });
  const textScale = interpolate(textSpring, [0, 1], [0.4, 1.0]);
  const textY = interpolate(textSpring, [0, 1], [60, 0]);
  const textOp = interpolate(frame, [30, 36, dur - 15, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Interview badge
  const badgeOp = interpolate(frame, [8, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Scanning line
  const scanY = interpolate(frame, [0, 30], [-5, 105], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scanOp = interpolate(frame, [0, 5, 15, 20], [0, 0.8, 0.6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Silhouette boxes (interviewer / candidate)
  const silhouetteOp = interpolate(frame, [20, 35], [0, 0.7], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const silhouetteFade = interpolate(frame, [90, 105], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Glow pulse
  const glowPulse = interpolate(Math.sin(frame * 0.06), [-1, 1], [0.25, 0.7]);

  return (
    <>
      {/* Flash */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: accentColor,
          opacity: flashOp,
        }}
      />

      {/* Scan line */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${scanY}%`,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${COLORS.saffron}AA, ${COLORS.gold}FF, ${COLORS.saffron}AA, transparent)`,
          opacity: scanOp,
          boxShadow: `0 0 20px ${COLORS.saffron}60`,
        }}
      />

      {/* Radial glow */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accentColor}30, transparent 60%)`,
          opacity: glowPulse,
          filter: 'blur(40px)',
        }}
      />

      {/* Particle burst on logo land */}
      <ParticleBurst frame={frame} startFrame={3} count={24} />

      {/* Company logo */}
      {company && (
        <div
          style={{
            position: 'absolute',
            top: '14%',
            left: '50%',
            transform: `translateX(-50%) scale(${logoScale})`,
            opacity: logoOp,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 160,
              height: 160,
              borderRadius: '50%',
              border: `2px solid ${company.color}44`,
              boxShadow: `0 0 40px ${company.color}33`,
            }}
          />
          <img
            src={`https://cdn.simpleicons.org/${company.slug}/${company.color.replace('#', '')}`}
            style={{
              width: 100,
              height: 100,
              position: 'relative',
              filter: `drop-shadow(0 0 30px ${company.color}88)`,
            }}
          />
        </div>
      )}

      {/* Interview badge */}
      <div
        style={{
          position: 'absolute',
          top: company ? '30%' : '18%',
          left: '50%',
          transform: 'translateX(-50%)',
          opacity: badgeOp,
        }}
      >
        <div
          style={{
            background: `linear-gradient(135deg, ${COLORS.saffron}FF, ${COLORS.gold}DD)`,
            borderRadius: 999,
            padding: '8px 28px',
            boxShadow: `0 4px 24px ${COLORS.saffron}66`,
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontFamily: FONTS.text,
              fontWeight: 800,
              color: COLORS.dark,
              letterSpacing: 4,
              textTransform: 'uppercase',
            }}
          >
            {company ? `${company.name.toUpperCase()} INTERVIEW` : 'INTERVIEW QUESTION'}
          </span>
        </div>
      </div>

      {/* Silhouette boxes — interviewer vs candidate */}
      <div
        style={{
          position: 'absolute',
          top: '42%',
          left: '10%',
          right: '10%',
          display: 'flex',
          justifyContent: 'space-between',
          opacity: silhouetteOp * silhouetteFade,
        }}
      >
        <div
          style={{
            width: 160,
            height: 80,
            border: `2px solid ${COLORS.teal}`,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${COLORS.teal}11`,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontFamily: FONTS.text,
              fontWeight: 700,
              color: COLORS.teal,
              letterSpacing: 2,
            }}
          >
            INTERVIEWER
          </span>
        </div>
        {/* Desk line between them */}
        <div
          style={{
            flex: 1,
            height: 2,
            alignSelf: 'center',
            margin: '0 20px',
            background: `linear-gradient(90deg, ${COLORS.teal}66, ${COLORS.gray}44, ${COLORS.saffron}66)`,
          }}
        />
        <div
          style={{
            width: 160,
            height: 80,
            border: `2px solid ${COLORS.saffron}`,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${COLORS.saffron}11`,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontFamily: FONTS.text,
              fontWeight: 700,
              color: COLORS.saffron,
              letterSpacing: 2,
            }}
          >
            CANDIDATE
          </span>
        </div>
      </div>

      {/* Hook text */}
      <div
        style={{
          position: 'absolute',
          top: '55%',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          transform: `scale(${textScale}) translateY(${textY}px)`,
          opacity: textOp,
        }}
      >
        <div
          style={{
            fontSize: 52,
            fontFamily: FONTS.heading,
            fontWeight: 900,
            color: COLORS.white,
            textAlign: 'center',
            maxWidth: '72%',
            lineHeight: 1.2,
            letterSpacing: -2,
            textShadow: `0 0 50px ${COLORS.saffron}40, 0 6px 20px rgba(0,0,0,0.95)`,
          }}
        >
          {hookText}
        </div>
      </div>

      {/* Topic + Branding (Phase 3) */}
      <TopicSlam topic={topic} frame={frame} fps={fps} startFrame={95} exitFrame={dur - 15} totalFrames={dur} />
      <BrandingReveal frame={frame} fps={fps} startFrame={100} />
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
 * STYLE 2: "THE CRISIS"
 * System down alarm + server overload + clean architecture reveal
 * ═══════════════════════════════════════════════════════════════════════════════ */
const StyleCrisis: React.FC<{
  topic: string;
  hookText: string;
  frame: number;
  fps: number;
  dur: number;
}> = ({ topic, hookText, frame, fps, dur }) => {
  // Phase 1: Red flash + SYSTEM DOWN (0-45f)
  const redFlash = interpolate(frame, [0, 3, 8], [0.9, 0.6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const shakeX = frame < 20 ? Math.sin(frame * 2.5) * interpolate(frame, [0, 20], [8, 0], { extrapolateRight: 'clamp' }) : 0;
  const systemDownOp = interpolate(frame, [3, 8, 35, 45], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Phase 2: Server box + request arrows (45-105f)
  const serverOp = interpolate(frame, [20, 30, 55, 60], [0, 0.9, 0.9, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const serverColor = frame > 40 ? COLORS.red : COLORS.teal;
  const serverScale = frame > 50 ? interpolate(frame, [50, 58], [1, 0], { extrapolateRight: 'clamp' }) : 1;

  // Request counter
  const counterVal =
    frame < 25
      ? 0
      : Math.round(
          interpolate(frame, [25, 55], [0, 1000000], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        );
  const counterOp = interpolate(frame, [25, 30, 55, 60], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Phase 2b: "What if..." text (60-105f)
  const whatIfSpring = spring({
    frame: Math.max(0, frame - 60),
    fps,
    config: { damping: 12, stiffness: 120, mass: 0.6 },
  });
  const whatIfOp = interpolate(frame, [60, 66, 95, 105], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Green architecture boxes appearing
  const boxCount = Math.min(3, Math.floor(interpolate(frame, [70, 95], [0, 3], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })));
  const boxLabels = ['Load Balancer', 'Server Pool', 'Cache Layer'];

  // Stats (Phase 2b-3)
  const statsOp = interpolate(frame, [80, 90, dur - 20, dur - 10], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const uptimeVal = Math.round(
    interpolate(frame, [80, 100], [0, 99.99], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * 100,
  ) / 100;
  const latencyVal = Math.round(
    interpolate(frame, [85, 100], [500, 12], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  );

  // Alarm pulse
  const alarmPulse = frame < 50 ? interpolate(Math.sin(frame * 0.8), [-1, 1], [0, 0.15]) : 0;

  return (
    <>
      {/* Red flash */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: COLORS.red, opacity: redFlash }} />
      {/* Alarm pulse overlay */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: COLORS.red, opacity: alarmPulse }} />

      {/* SYSTEM DOWN text */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: 0,
          right: 0,
          textAlign: 'center',
          transform: `translateX(${shakeX}px)`,
          opacity: systemDownOp,
        }}
      >
        <span
          style={{
            fontSize: 80,
            fontFamily: FONTS.heading,
            fontWeight: 900,
            color: COLORS.red,
            letterSpacing: 8,
            textShadow: `0 0 40px ${COLORS.red}80`,
          }}
        >
          SYSTEM DOWN
        </span>
      </div>

      {/* Server box with incoming arrows */}
      <div
        style={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          transform: `translateX(-50%) scale(${serverScale})`,
          opacity: serverOp,
        }}
      >
        <div
          style={{
            width: 120,
            height: 80,
            border: `3px solid ${serverColor}`,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${serverColor}22`,
            boxShadow: frame > 40 ? `0 0 30px ${COLORS.red}60` : 'none',
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontFamily: FONTS.code,
              color: serverColor,
              fontWeight: 700,
            }}
          >
            SERVER
          </span>
        </div>
        {/* Request arrows */}
        {Array.from({ length: Math.min(6, Math.floor(interpolate(frame, [25, 50], [0, 6], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))) }, (_, i) => (
          <div
            key={`arr-${i}`}
            style={{
              position: 'absolute',
              top: -30 - i * 12,
              left: 20 + i * 15,
              fontSize: 18,
              color: COLORS.saffron,
              opacity: 0.7,
            }}
          >
            ↓
          </div>
        ))}
      </div>

      {/* Request counter */}
      <div
        style={{
          position: 'absolute',
          top: '60%',
          left: '50%',
          transform: 'translateX(-50%)',
          opacity: counterOp,
        }}
      >
        <span
          style={{
            fontSize: 36,
            fontFamily: FONTS.code,
            fontWeight: 700,
            color: frame > 40 ? COLORS.red : COLORS.gold,
          }}
        >
          {counterVal.toLocaleString()} requests
        </span>
      </div>

      {/* "What if there was a better way?" */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: whatIfOp,
          transform: `scale(${interpolate(whatIfSpring, [0, 1], [0.8, 1])})`,
        }}
      >
        <span
          style={{
            fontSize: 42,
            fontFamily: FONTS.heading,
            fontWeight: 800,
            color: COLORS.white,
            textShadow: `0 0 30px ${COLORS.teal}40`,
          }}
        >
          A better way exists.
        </span>
      </div>

      {/* Architecture boxes */}
      <div
        style={{
          position: 'absolute',
          top: '45%',
          left: '20%',
          right: '20%',
          display: 'flex',
          justifyContent: 'space-around',
          opacity: interpolate(frame, [70, 78], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        {boxLabels.slice(0, boxCount).map((label, i) => {
          const bSpring = spring({
            frame: Math.max(0, frame - 70 - i * 8),
            fps,
            config: { damping: 10, stiffness: 160 },
          });
          return (
            <div
              key={label}
              style={{
                width: 140,
                height: 60,
                border: `2px solid ${COLORS.teal}`,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `${COLORS.teal}15`,
                transform: `scale(${interpolate(bSpring, [0, 1], [0.3, 1])})`,
                opacity: interpolate(bSpring, [0, 1], [0, 1]),
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontFamily: FONTS.text,
                  color: COLORS.teal,
                  fontWeight: 700,
                  textAlign: 'center',
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Stats */}
      <div
        style={{
          position: 'absolute',
          top: '62%',
          left: '25%',
          right: '25%',
          display: 'flex',
          justifyContent: 'space-around',
          opacity: statsOp,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontFamily: FONTS.heading, fontWeight: 900, color: COLORS.teal }}>
            {uptimeVal}%
          </div>
          <div style={{ fontSize: 12, fontFamily: FONTS.text, color: COLORS.gray, letterSpacing: 2 }}>
            UPTIME
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontFamily: FONTS.heading, fontWeight: 900, color: COLORS.gold }}>
            {latencyVal}ms
          </div>
          <div style={{ fontSize: 12, fontFamily: FONTS.text, color: COLORS.gray, letterSpacing: 2 }}>
            LATENCY
          </div>
        </div>
      </div>

      <TopicSlam topic={topic} frame={frame} fps={fps} startFrame={105} exitFrame={dur - 15} totalFrames={dur} />
      <BrandingReveal frame={frame} fps={fps} startFrame={110} />
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
 * STYLE 3: "THE MYSTERY"
 * Giant "?" + slow code reveal + O(n²) → O(log n) transformation
 * ═══════════════════════════════════════════════════════════════════════════════ */
const StyleMystery: React.FC<{
  topic: string;
  hookText: string;
  frame: number;
  fps: number;
  dur: number;
}> = ({ topic, hookText, frame, fps, dur }) => {
  // Phase 1: Giant "?" pulses (0-45f)
  const qScale = 1 + interpolate(Math.sin(frame * 0.15), [-1, 1], [0, 0.12]);
  const qOp = interpolate(frame, [0, 5, 35, 45], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const struggleOp = interpolate(frame, [12, 20, 35, 45], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Phase 2: O(n²) crossed out → O(log n) (45-105f)
  const slowCodeOp = interpolate(frame, [45, 52, 65, 72], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const strikethrough = interpolate(frame, [58, 65], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fastCodeOp = interpolate(frame, [70, 78, 95, 105], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Speed bars
  const barOp = interpolate(frame, [75, 82], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const slowBarW = interpolate(frame, [75, 90], [0, 80], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fastBarW = interpolate(frame, [80, 90], [0, 20], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Master text
  const masterOp = interpolate(frame, [88, 96, dur - 15, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <>
      {/* Giant "?" */}
      <div
        style={{
          position: 'absolute',
          top: '25%',
          left: '50%',
          transform: `translateX(-50%) scale(${qScale})`,
          opacity: qOp,
        }}
      >
        <span
          style={{
            fontSize: 200,
            fontFamily: FONTS.heading,
            fontWeight: 900,
            color: COLORS.indigo,
            textShadow: `0 0 60px ${COLORS.indigo}60`,
          }}
        >
          ?
        </span>
      </div>

      {/* "Every developer struggles..." */}
      <div
        style={{
          position: 'absolute',
          top: '65%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: struggleOp,
        }}
      >
        <span
          style={{
            fontSize: 32,
            fontFamily: FONTS.text,
            fontWeight: 600,
            color: COLORS.gray,
            fontStyle: 'italic',
          }}
        >
          Every developer struggles with this...
        </span>
      </div>

      {/* O(n²) — SLOW */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translateX(-50%)',
          opacity: slowCodeOp,
        }}
      >
        <span
          style={{
            fontSize: 72,
            fontFamily: FONTS.code,
            fontWeight: 700,
            color: COLORS.red,
            position: 'relative',
          }}
        >
          O(n²)
          {/* Strikethrough line */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              width: `${strikethrough}%`,
              height: 4,
              backgroundColor: COLORS.red,
              transform: 'rotate(-5deg)',
            }}
          />
        </span>
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <span
            style={{
              fontSize: 20,
              fontFamily: FONTS.text,
              fontWeight: 700,
              color: COLORS.red,
              letterSpacing: 4,
            }}
          >
            YOUR CODE IS SLOW
          </span>
        </div>
      </div>

      {/* O(log n) — FAST */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translateX(-50%)',
          opacity: fastCodeOp,
        }}
      >
        <span
          style={{
            fontSize: 72,
            fontFamily: FONTS.code,
            fontWeight: 700,
            color: COLORS.teal,
            textShadow: `0 0 30px ${COLORS.teal}50`,
          }}
        >
          O(log n)
        </span>
      </div>

      {/* Speed comparison bars */}
      <div
        style={{
          position: 'absolute',
          top: '55%',
          left: '20%',
          right: '20%',
          opacity: barOp,
        }}
      >
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, fontFamily: FONTS.text, color: COLORS.red, width: 60 }}>
            Before
          </span>
          <div
            style={{
              width: `${slowBarW}%`,
              height: 20,
              backgroundColor: COLORS.red,
              borderRadius: 4,
              boxShadow: `0 0 10px ${COLORS.red}40`,
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, fontFamily: FONTS.text, color: COLORS.teal, width: 60 }}>
            After
          </span>
          <div
            style={{
              width: `${fastBarW}%`,
              height: 20,
              backgroundColor: COLORS.teal,
              borderRadius: 4,
              boxShadow: `0 0 10px ${COLORS.teal}40`,
            }}
          />
        </div>
      </div>

      {/* "Master this..." */}
      <div
        style={{
          position: 'absolute',
          top: '72%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: masterOp,
        }}
      >
        <span
          style={{
            fontSize: 28,
            fontFamily: FONTS.text,
            fontWeight: 700,
            color: COLORS.white,
          }}
        >
          Master this, ace the interview.
        </span>
      </div>

      <TopicSlam topic={topic} frame={frame} fps={fps} startFrame={100} exitFrame={dur - 15} totalFrames={dur} />
      <BrandingReveal frame={frame} fps={fps} startFrame={108} />
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
 * STYLE 4: "THE COMPARISON"
 * VS slam + two sides + lightning clash
 * ═══════════════════════════════════════════════════════════════════════════════ */
const StyleComparison: React.FC<{
  topic: string;
  hookText: string;
  frame: number;
  fps: number;
  dur: number;
}> = ({ topic, hookText, frame, fps, dur }) => {
  // Extract A vs B from topic
  const vsParts = topic.split(/\s+vs\.?\s+/i);
  const optionA = vsParts[0]?.trim() || 'Option A';
  const optionB = vsParts[1]?.trim() || 'Option B';

  // Phase 1: VS SLAM (0-45f)
  const vsSpring = spring({
    frame: Math.max(0, frame - 2),
    fps,
    config: { damping: 6, stiffness: 250, mass: 0.4 },
  });
  const vsScale = interpolate(vsSpring, [0, 1], [5, 1]);
  const vsOp = interpolate(frame, [2, 8, 35, 45], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Shockwave ring
  const ringScale = interpolate(frame, [2, 25], [0, 3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ringOp = interpolate(frame, [2, 8, 20, 25], [0, 0.8, 0.3, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Phase 2: Two sides (45-105f)
  const sideOp = interpolate(frame, [40, 50, 100, 110], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const leftSlide = interpolate(frame, [40, 55], [-200, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rightSlide = interpolate(frame, [40, 55], [200, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Lightning between them
  const lightningOp = frame > 55 && frame < 100 ? interpolate(Math.sin(frame * 0.5), [-1, 1], [0.2, 0.8]) : 0;

  // "Which one?" text
  const whichOp = interpolate(frame, [85, 93, dur - 15, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <>
      {/* Flash on VS slam */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: COLORS.white,
          opacity: interpolate(frame, [2, 4, 10], [0, 0.8, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      />

      {/* Shockwave ring */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 100,
          height: 100,
          borderRadius: '50%',
          border: `3px solid ${COLORS.gold}`,
          transform: `translate(-50%, -50%) scale(${ringScale})`,
          opacity: ringOp,
        }}
      />

      {/* VS text */}
      <div
        style={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${vsScale})`,
          opacity: vsOp,
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontSize: 120,
            fontFamily: FONTS.heading,
            fontWeight: 900,
            color: COLORS.gold,
            textShadow: `0 0 40px ${COLORS.gold}80, 0 0 80px ${COLORS.saffron}40`,
          }}
        >
          VS
        </span>
      </div>

      {/* Two sides */}
      <div
        style={{
          position: 'absolute',
          top: '25%',
          left: 0,
          right: 0,
          bottom: '25%',
          display: 'flex',
          opacity: sideOp,
        }}
      >
        {/* Left side — Option A */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRight: `1px solid ${COLORS.gray}33`,
            transform: `translateX(${leftSlide}px)`,
          }}
        >
          <div
            style={{
              padding: '20px 40px',
              border: `3px solid ${COLORS.indigo}`,
              borderRadius: 16,
              background: `${COLORS.indigo}15`,
            }}
          >
            <span
              style={{
                fontSize: 36,
                fontFamily: FONTS.heading,
                fontWeight: 800,
                color: COLORS.indigo,
              }}
            >
              {optionA}
            </span>
          </div>
        </div>

        {/* Lightning center line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '50%',
            width: 4,
            background: `linear-gradient(180deg, transparent, ${COLORS.gold}${Math.round(lightningOp * 255).toString(16).padStart(2, '0')}, ${COLORS.white}${Math.round(lightningOp * 200).toString(16).padStart(2, '0')}, ${COLORS.gold}${Math.round(lightningOp * 255).toString(16).padStart(2, '0')}, transparent)`,
            boxShadow: `0 0 20px ${COLORS.gold}${Math.round(lightningOp * 150).toString(16).padStart(2, '0')}`,
          }}
        />

        {/* Right side — Option B */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `translateX(${rightSlide}px)`,
          }}
        >
          <div
            style={{
              padding: '20px 40px',
              border: `3px solid ${COLORS.saffron}`,
              borderRadius: 16,
              background: `${COLORS.saffron}15`,
            }}
          >
            <span
              style={{
                fontSize: 36,
                fontFamily: FONTS.heading,
                fontWeight: 800,
                color: COLORS.saffron,
              }}
            >
              {optionB}
            </span>
          </div>
        </div>
      </div>

      {/* "Which one should YOU use?" */}
      <div
        style={{
          position: 'absolute',
          top: '72%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: whichOp,
        }}
      >
        <span
          style={{
            fontSize: 34,
            fontFamily: FONTS.heading,
            fontWeight: 800,
            color: COLORS.white,
          }}
        >
          Which one should{' '}
          <span style={{ color: COLORS.gold }}>YOU</span> use?
        </span>
      </div>

      <TopicSlam topic={topic} frame={frame} fps={fps} startFrame={100} exitFrame={dur - 15} totalFrames={dur} />
      <BrandingReveal frame={frame} fps={fps} startFrame={108} />
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
 * STYLE 5: "THE JOURNEY"
 * Animated request traveling through the internet
 * ═══════════════════════════════════════════════════════════════════════════════ */
const StyleJourney: React.FC<{
  topic: string;
  hookText: string;
  frame: number;
  fps: number;
  dur: number;
}> = ({ topic, hookText, frame, fps, dur }) => {
  const hops = ['Client', 'DNS', 'Server', 'Response'];
  const hopPositions = [10, 35, 60, 85]; // % from left

  // Phase 1: "From A to B" text (0-45f)
  const fromToOp = interpolate(frame, [5, 12, 35, 45], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Animated dot traveling along path
  const dotProgress = interpolate(frame, [5, 40], [0, 3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const dotX = interpolate(dotProgress, [0, 1, 2, 3], hopPositions, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Phase 2: Hop nodes appear (20-90f)
  const nodesOp = interpolate(frame, [18, 28, 95, 105], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // "But what ACTUALLY happens?" (55-100f)
  const whatOp = interpolate(frame, [55, 63, 90, 100], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // "Let's trace every step" (85-dur)
  const traceOp = interpolate(frame, [85, 93, dur - 15, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Connection line
  const lineWidth = interpolate(frame, [18, 40], [0, 80], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <>
      {/* "From A to B" */}
      <div
        style={{
          position: 'absolute',
          top: '18%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: fromToOp,
        }}
      >
        <span
          style={{
            fontSize: 48,
            fontFamily: FONTS.heading,
            fontWeight: 900,
            color: COLORS.white,
          }}
        >
          From <span style={{ color: COLORS.teal }}>A</span> to{' '}
          <span style={{ color: COLORS.saffron }}>B</span>
        </span>
      </div>

      {/* Connection line */}
      <div
        style={{
          position: 'absolute',
          top: '44%',
          left: '10%',
          width: `${lineWidth}%`,
          height: 2,
          background: `linear-gradient(90deg, ${COLORS.teal}88, ${COLORS.indigo}66, ${COLORS.saffron}88)`,
          opacity: nodesOp,
        }}
      />

      {/* Hop nodes */}
      {hops.map((hop, i) => {
        const nodeSpring = spring({
          frame: Math.max(0, frame - 20 - i * 6),
          fps,
          config: { damping: 12, stiffness: 140 },
        });
        const isActive = dotProgress >= i && dotProgress < i + 1.2;
        return (
          <div
            key={hop}
            style={{
              position: 'absolute',
              top: '37%',
              left: `${hopPositions[i]}%`,
              transform: `translateX(-50%) scale(${interpolate(nodeSpring, [0, 1], [0, 1])})`,
              opacity: nodesOp,
            }}
          >
            <div
              style={{
                width: 80,
                height: 50,
                border: `2px solid ${isActive ? COLORS.gold : COLORS.teal}`,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isActive ? `${COLORS.gold}20` : `${COLORS.teal}10`,
                boxShadow: isActive ? `0 0 20px ${COLORS.gold}40` : 'none',
                transition: 'all 0.1s',
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontFamily: FONTS.code,
                  fontWeight: 700,
                  color: isActive ? COLORS.gold : COLORS.teal,
                }}
              >
                {hop}
              </span>
            </div>
          </div>
        );
      })}

      {/* Traveling dot */}
      <div
        style={{
          position: 'absolute',
          top: '43%',
          left: `${dotX}%`,
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: COLORS.gold,
          boxShadow: `0 0 15px ${COLORS.gold}80`,
          opacity: interpolate(frame, [5, 10, 40, 45], [0, 1, 1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      />

      {/* "But what ACTUALLY happens?" */}
      <div
        style={{
          position: 'absolute',
          top: '58%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: whatOp,
        }}
      >
        <span
          style={{
            fontSize: 36,
            fontFamily: FONTS.heading,
            fontWeight: 800,
            color: COLORS.white,
          }}
        >
          But what <span style={{ color: COLORS.saffron }}>ACTUALLY</span> happens?
        </span>
      </div>

      {/* "Let's trace every step" */}
      <div
        style={{
          position: 'absolute',
          top: '70%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: traceOp,
        }}
      >
        <span
          style={{
            fontSize: 28,
            fontFamily: FONTS.text,
            fontWeight: 600,
            color: COLORS.teal,
          }}
        >
          Let&apos;s trace every single step.
        </span>
      </div>

      <TopicSlam topic={topic} frame={frame} fps={fps} startFrame={100} exitFrame={dur - 15} totalFrames={dur} />
      <BrandingReveal frame={frame} fps={fps} startFrame={108} />
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
 * STYLE 6: "THE SALARY"
 * ₹8 LPA → ₹45 LPA gap reveal + concept = the difference
 * ═══════════════════════════════════════════════════════════════════════════════ */
const StyleSalary: React.FC<{
  topic: string;
  hookText: string;
  frame: number;
  fps: number;
  dur: number;
}> = ({ topic, hookText, frame, fps, dur }) => {
  // Phase 1: Salary numbers (0-45f)
  const lowOp = interpolate(frame, [5, 12, 45, 55], [0, 1, 1, 0.3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const highSpring = spring({
    frame: Math.max(0, frame - 18),
    fps,
    config: { damping: 8, stiffness: 160, mass: 0.6 },
  });
  const highScale = interpolate(highSpring, [0, 1], [0.5, 1]);
  const highOp = interpolate(frame, [18, 25, 45, 55], [0, 1, 1, 0.3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Glow gap between salaries
  const gapOp = interpolate(frame, [25, 32, 45, 55], [0, 0.8, 0.6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const gapPulse = interpolate(Math.sin(frame * 0.1), [-1, 1], [0.4, 1]);

  // Phase 2: "The difference? ONE concept." (45-90f)
  const diffOp = interpolate(frame, [45, 52, 75, 85], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const conceptSpring = spring({
    frame: Math.max(0, frame - 58),
    fps,
    config: { damping: 10, stiffness: 180 },
  });

  // Phase 3: "After this video, YOU will know it" (85-dur)
  const afterOp = interpolate(frame, [85, 92, dur - 20, dur - 10], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Animated counter for high salary
  const salaryCounter = Math.round(
    interpolate(frame, [18, 40], [8, 45], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  );

  return (
    <>
      {/* Low salary */}
      <div
        style={{
          position: 'absolute',
          top: '28%',
          left: '25%',
          transform: 'translateX(-50%)',
          opacity: lowOp,
        }}
      >
        <span
          style={{
            fontSize: 42,
            fontFamily: FONTS.heading,
            fontWeight: 700,
            color: COLORS.gray,
          }}
        >
          ₹8 LPA
        </span>
      </div>

      {/* High salary with animated counter */}
      <div
        style={{
          position: 'absolute',
          top: '22%',
          right: '25%',
          transform: `translateX(50%) scale(${highScale})`,
          opacity: highOp,
        }}
      >
        <span
          style={{
            fontSize: 72,
            fontFamily: FONTS.heading,
            fontWeight: 900,
            color: COLORS.gold,
            textShadow: `0 0 40px ${COLORS.gold}60`,
          }}
        >
          ₹{salaryCounter} LPA
        </span>
      </div>

      {/* Glowing gap line */}
      <div
        style={{
          position: 'absolute',
          top: '38%',
          left: '25%',
          right: '25%',
          height: 3,
          background: `linear-gradient(90deg, ${COLORS.gray}44, ${COLORS.gold}AA, ${COLORS.gold}AA, ${COLORS.gray}44)`,
          opacity: gapOp * gapPulse,
          boxShadow: `0 0 20px ${COLORS.gold}40`,
        }}
      />

      {/* "The difference? ONE concept." */}
      <div
        style={{
          position: 'absolute',
          top: '45%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: diffOp,
        }}
      >
        <span
          style={{
            fontSize: 38,
            fontFamily: FONTS.heading,
            fontWeight: 800,
            color: COLORS.white,
          }}
        >
          The difference?{' '}
          <span style={{ color: COLORS.saffron }}>ONE</span> concept.
        </span>
      </div>

      {/* Topic name — dramatic reveal */}
      <div
        style={{
          position: 'absolute',
          top: '58%',
          left: 0,
          right: 0,
          textAlign: 'center',
          transform: `scale(${interpolate(conceptSpring, [0, 1], [0.5, 1])})`,
          opacity: interpolate(frame, [58, 65, dur - 15, dur], [0, 1, 1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        <span
          style={{
            fontSize: 52,
            fontFamily: FONTS.heading,
            fontWeight: 900,
            color: COLORS.gold,
            textShadow: `0 0 30px ${COLORS.gold}50`,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          {topic}
        </span>
      </div>

      {/* "After this video, YOU will know it." */}
      <div
        style={{
          position: 'absolute',
          top: '74%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: afterOp,
        }}
      >
        <span
          style={{
            fontSize: 28,
            fontFamily: FONTS.text,
            fontWeight: 700,
            color: COLORS.white,
          }}
        >
          After this video,{' '}
          <span style={{ color: COLORS.teal }}>YOU</span> will know it.
        </span>
      </div>

      <BrandingReveal frame={frame} fps={fps} startFrame={105} />
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
 * MAIN COMPONENT — CinematicOpener
 * ═══════════════════════════════════════════════════════════════════════════════ */
export const CinematicOpener: React.FC<CinematicOpenerProps> = ({
  topic,
  sessionNumber,
  hookText,
  hookNarration,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = selectStyle(topic, sessionNumber);
  const dur = durationInFrames;

  // Exit fade for the whole opener (last 12 frames)
  const exitOp = interpolate(frame, [dur - 12, dur], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Corner brackets fade in
  const cornerOp = interpolate(frame, [10, 25], [0, 0.5], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const styleProps = { topic, hookText, frame, fps, dur };

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark, overflow: 'hidden', opacity: exitOp }}>
      {/* Tech grid background — always present */}
      <TechGridBg frame={frame} accentColor={style === 2 ? COLORS.red : COLORS.saffron} />

      {/* SFX — impact on entry */}
      <Audio src={staticFile('audio/sfx/impact.wav')} volume={0.6} />

      {/* Cinematic corner brackets */}
      <CinematicFrame opacity={cornerOp} />

      {/* Style-specific content */}
      {style === 1 && <StyleInterview {...styleProps} />}
      {style === 2 && <StyleCrisis {...styleProps} />}
      {style === 3 && <StyleMystery {...styleProps} />}
      {style === 4 && <StyleComparison {...styleProps} />}
      {style === 5 && <StyleJourney {...styleProps} />}
      {style === 6 && <StyleSalary {...styleProps} />}
    </AbsoluteFill>
  );
};

export default CinematicOpener;
