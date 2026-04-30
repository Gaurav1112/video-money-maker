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
 * CinematicOpener — 20 movie-trailer styles, unique per topic
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
// EVERY session gets a DIFFERENT style — even for the same topic.
// The topic category determines a BASE set of suitable styles,
// then sessionNumber rotates through ALL 20 styles.
function selectStyle(_topic: string, _sessionNumber: number): number {
  // Style 0 = InstantHook (educational default — Fireship/Striver inspired)
  // Old cinematic styles (1-20) still available via direct override
  return 0;
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

/** Dramatic Warning Hook — first 3 seconds (frames 0-90) attention grab */
const WarningHook: React.FC<{
  frame: number;
  fps: number;
  hookText: string;
  topic: string;
}> = ({ frame, fps, hookText, topic }) => {
  // Phase A: RED FLASH (frame 0-10)
  const redFlashOp = interpolate(frame, [0, 1, 3, 10], [0, 1, 0.8, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Phase B: WARNING text + alarm pulse (frame 10-30)
  const warningOp = interpolate(frame, [10, 13, 25, 30], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const warningScale = 1 + interpolate(Math.sin(frame * 0.4), [-1, 1], [0, 0.2]);
  const borderPulse = interpolate(Math.sin(frame * 0.5), [-1, 1], [0.3, 1.0]);
  const breakTextOp = interpolate(frame, [14, 18, 25, 30], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Phase C: Dramatic stat counter (frame 30-60)
  const counterOp = interpolate(frame, [30, 35, 55, 60], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const counterVal = Math.round(
    interpolate(frame, [30, 55], [0, 10000000], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );

  // Phase D: Hook text slam (frame 60-90)
  const hookSpring = spring({
    frame: Math.max(0, frame - 60),
    fps,
    config: { damping: 8, stiffness: 200, mass: 0.5 },
  });
  const hookScale = interpolate(hookSpring, [0, 1], [0.3, 1.0]);
  const hookOp = interpolate(frame, [60, 65, 85, 90], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Only render during frames 0-90
  if (frame > 92) return null;

  return (
    <>
      {/* Phase A: RED FLASH */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#DC2626',
          opacity: redFlashOp,
          zIndex: 100,
        }}
      />

      {/* Phase B: WARNING text + pulsing border */}
      {frame >= 10 && frame <= 30 && (
        <>
          {/* Dark background with red radial glow */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at 50% 50%, #DC262640, #0A0A0A 70%)',
              opacity: warningOp,
              zIndex: 90,
            }}
          />
          {/* Pulsing red border */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              border: `4px solid rgba(220, 38, 38, ${borderPulse})`,
              opacity: warningOp,
              zIndex: 91,
            }}
          />
          {/* Warning emoji */}
          <div
            style={{
              position: 'absolute',
              top: '32%',
              left: '50%',
              transform: `translateX(-50%) scale(${warningScale})`,
              fontSize: 80,
              opacity: warningOp,
              zIndex: 92,
            }}
          >
            {'⚠'}
          </div>
          {/* WARNING text */}
          <div
            style={{
              position: 'absolute',
              top: '34%',
              left: 0,
              right: 0,
              textAlign: 'center',
              opacity: warningOp,
              zIndex: 92,
            }}
          >
            <span
              style={{
                fontSize: 72,
                fontFamily: FONTS.heading,
                fontWeight: 900,
                color: '#DC2626',
                letterSpacing: 8,
                textShadow: '0 0 40px #DC262680',
              }}
            >
              WARNING
            </span>
          </div>
          {/* "THIS CONCEPT BREAKS EVERYTHING" */}
          <div
            style={{
              position: 'absolute',
              top: '55%',
              left: 0,
              right: 0,
              textAlign: 'center',
              opacity: breakTextOp,
              zIndex: 92,
            }}
          >
            <span
              style={{
                fontSize: 40,
                fontFamily: FONTS.heading,
                fontWeight: 800,
                color: COLORS.textOnDark,
                letterSpacing: 2,
                textShadow: '0 4px 20px rgba(0,0,0,0.8)',
              }}
            >
              THIS CONCEPT BREAKS EVERYTHING
            </span>
          </div>
        </>
      )}

      {/* Phase C: Dramatic stat counter */}
      {frame >= 30 && frame <= 60 && (
        <div
          style={{
            position: 'absolute',
            top: '35%',
            left: 0,
            right: 0,
            textAlign: 'center',
            opacity: counterOp,
            zIndex: 90,
          }}
        >
          <span
            style={{
              fontSize: 120,
              fontFamily: FONTS.heading,
              fontWeight: 900,
              color: COLORS.textOnDark,
              letterSpacing: -2,
              textShadow: `0 0 40px ${COLORS.saffron}60`,
            }}
          >
            {counterVal.toLocaleString()}
          </span>
          <div
            style={{
              fontSize: 24,
              fontFamily: FONTS.text,
              fontWeight: 600,
              color: COLORS.gray,
              letterSpacing: 3,
              marginTop: 8,
            }}
          >
            DEVELOPERS GOT THIS WRONG IN INTERVIEWS
          </div>
        </div>
      )}

      {/* Phase D: Hook text slam */}
      {frame >= 60 && frame <= 92 && (
        <div
          style={{
            position: 'absolute',
            top: '38%',
            left: 0,
            right: 0,
            textAlign: 'center',
            transform: `scale(${hookScale})`,
            opacity: hookOp,
            zIndex: 90,
          }}
        >
          <span
            style={{
              fontSize: 56,
              fontFamily: FONTS.heading,
              fontWeight: 900,
              color: COLORS.textOnDark,
              lineHeight: 1.2,
              textShadow: `0 0 30px ${COLORS.saffron}50, 0 6px 20px rgba(0,0,0,0.9)`,
              maxWidth: '80%',
              display: 'inline-block',
            }}
          >
            {hookText || topic}
          </span>
        </div>
      )}
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
            color: COLORS.textOnDark,
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
            color: COLORS.textOnDark,
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
            color: COLORS.textOnDark,
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
          backgroundColor: COLORS.textOnDark,
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
            background: `linear-gradient(180deg, transparent, ${COLORS.gold}${Math.round(lightningOp * 255).toString(16).padStart(2, '0')}, ${COLORS.textOnDark}${Math.round(lightningOp * 200).toString(16).padStart(2, '0')}, ${COLORS.gold}${Math.round(lightningOp * 255).toString(16).padStart(2, '0')}, transparent)`,
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
            color: COLORS.textOnDark,
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
            color: COLORS.textOnDark,
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
            color: COLORS.textOnDark,
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
            color: COLORS.textOnDark,
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
            color: COLORS.textOnDark,
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
 * STYLE 7: "THE HACKER"
 * Matrix-style falling characters → "ACCESS GRANTED" → topic reveal
 * ═══════════════════════════════════════════════════════════════════════════════ */
const StyleHacker: React.FC<{
  topic: string;
  hookText: string;
  frame: number;
  fps: number;
  dur: number;
}> = ({ topic, hookText, frame, fps, dur }) => {
  const matrixChars = '01アイウエオカキクケコ{}[];=></>'.split('');
  const columns = 24;

  // Phase 1: Matrix rain (0-50f)
  const matrixOp = interpolate(frame, [0, 5, 40, 50], [0, 0.8, 0.8, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Phase 2: ACCESS GRANTED flash (50-90f)
  const greenFlash = interpolate(frame, [48, 50, 53], [0, 0.6, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const accessSpring = spring({
    frame: Math.max(0, frame - 50),
    fps,
    config: { damping: 8, stiffness: 200, mass: 0.5 },
  });
  const accessOp = interpolate(frame, [50, 55, 80, 90], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Decrypting topic text effect
  const decryptProgress = interpolate(frame, [65, 85], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const revealedChars = Math.floor(decryptProgress * topic.length);
  const decryptedText = topic
    .split('')
    .map((ch, i) => {
      if (i < revealedChars) return ch;
      const cIdx = (frame * 3 + i * 7) % matrixChars.length;
      return matrixChars[cIdx];
    })
    .join('');
  const decryptOp = interpolate(frame, [62, 68, dur - 15, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <>
      {/* Green flash */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: COLORS.teal, opacity: greenFlash }} />

      {/* Matrix columns */}
      {Array.from({ length: columns }, (_, col) => {
        const x = (col / columns) * 100;
        const speed = 2 + (col % 5);
        const offset = col * 13;
        return (
          <div key={`mc-${col}`} style={{ position: 'absolute', left: `${x}%`, top: 0, opacity: matrixOp }}>
            {Array.from({ length: 12 }, (_, row) => {
              const y = ((frame * speed + offset + row * 40) % 800) - 40;
              const charIdx = (frame + col * 3 + row * 7) % matrixChars.length;
              const charOp = interpolate(row, [0, 4, 8, 12], [0.15, 0.5, 0.3, 0.1]);
              return (
                <div
                  key={`mr-${row}`}
                  style={{
                    position: 'absolute',
                    top: y,
                    fontSize: 16,
                    fontFamily: FONTS.code,
                    color: COLORS.teal,
                    opacity: charOp,
                    textShadow: `0 0 8px ${COLORS.teal}`,
                  }}
                >
                  {matrixChars[charIdx]}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* ACCESS GRANTED */}
      {frame >= 50 && frame <= 90 && (
        <div
          style={{
            position: 'absolute',
            top: '30%',
            left: 0,
            right: 0,
            textAlign: 'center',
            transform: `scale(${interpolate(accessSpring, [0, 1], [0.3, 1])})`,
            opacity: accessOp,
          }}
        >
          <span
            style={{
              fontSize: 64,
              fontFamily: FONTS.code,
              fontWeight: 900,
              color: COLORS.teal,
              letterSpacing: 6,
              textShadow: `0 0 40px ${COLORS.teal}80`,
            }}
          >
            ACCESS GRANTED
          </span>
        </div>
      )}

      {/* Decrypting topic text */}
      <div
        style={{
          position: 'absolute',
          top: '52%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: decryptOp,
        }}
      >
        <span
          style={{
            fontSize: 44,
            fontFamily: FONTS.code,
            fontWeight: 700,
            color: decryptProgress >= 1 ? COLORS.gold : COLORS.teal,
            letterSpacing: 3,
            textTransform: 'uppercase',
            textShadow: `0 0 20px ${decryptProgress >= 1 ? COLORS.gold : COLORS.teal}50`,
          }}
        >
          {decryptedText}
        </span>
      </div>

      <TopicSlam topic={topic} frame={frame} fps={fps} startFrame={100} exitFrame={dur - 15} totalFrames={dur} />
      <BrandingReveal frame={frame} fps={fps} startFrame={108} />
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
 * STYLE 8: "THE COUNTDOWN"
 * 3...2...1 countdown → explosion → topic
 * ═══════════════════════════════════════════════════════════════════════════════ */
const StyleCountdown: React.FC<{
  topic: string;
  hookText: string;
  frame: number;
  fps: number;
  dur: number;
}> = ({ topic, hookText, frame, fps, dur }) => {
  // Phase 1: 3-2-1 countdown (0-60f, 20f each)
  const nums = [3, 2, 1];
  const activeNum = frame < 60 ? Math.floor(frame / 20) : -1;

  // Phase 2: BOOM explosion (60-90f)
  const boomFlash = interpolate(frame, [58, 60, 63, 70], [0, 1, 0.8, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const boomSpring = spring({
    frame: Math.max(0, frame - 60),
    fps,
    config: { damping: 6, stiffness: 300, mass: 0.3 },
  });
  const boomOp = interpolate(frame, [60, 63, 82, 90], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Shockwave rings
  const ringProgress = interpolate(frame, [60, 85], [0, 4], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const ringOp = interpolate(frame, [60, 65, 80, 85], [0, 0.6, 0.2, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Phase 3: Topic reveal (90-dur)
  const topicSpring = spring({
    frame: Math.max(0, frame - 88),
    fps,
    config: { damping: 10, stiffness: 150, mass: 0.6 },
  });
  const topicRevealOp = interpolate(frame, [88, 95, dur - 15, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <>
      {/* White explosion flash */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: COLORS.gold, opacity: boomFlash }} />

      {/* Countdown numbers */}
      {nums.map((num, i) => {
        const numStart = i * 20;
        const numSpring = spring({
          frame: Math.max(0, frame - numStart),
          fps,
          config: { damping: 6, stiffness: 250, mass: 0.4 },
        });
        const numOp = interpolate(frame, [numStart, numStart + 3, numStart + 15, numStart + 20], [0, 1, 1, 0], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });
        const numScale = interpolate(numSpring, [0, 1], [3, 1]);
        return (
          <div
            key={`cd-${num}`}
            style={{
              position: 'absolute',
              top: '32%',
              left: '50%',
              transform: `translate(-50%, -50%) scale(${numScale})`,
              opacity: numOp,
            }}
          >
            <span
              style={{
                fontSize: 180,
                fontFamily: FONTS.heading,
                fontWeight: 900,
                color: i === 2 ? COLORS.red : COLORS.saffron,
                textShadow: `0 0 60px ${i === 2 ? COLORS.red : COLORS.saffron}80`,
              }}
            >
              {num}
            </span>
          </div>
        );
      })}

      {/* Shockwave rings */}
      {frame >= 60 && frame <= 85 && (
        <>
          {[0, 1, 2].map((r) => (
            <div
              key={`ring-${r}`}
              style={{
                position: 'absolute',
                top: '40%',
                left: '50%',
                width: 60,
                height: 60,
                borderRadius: '50%',
                border: `2px solid ${COLORS.gold}`,
                transform: `translate(-50%, -50%) scale(${ringProgress - r * 0.5})`,
                opacity: ringOp * (1 - r * 0.3),
              }}
            />
          ))}
        </>
      )}

      {/* BOOM text */}
      {frame >= 60 && frame <= 90 && (
        <div
          style={{
            position: 'absolute',
            top: '35%',
            left: '50%',
            transform: `translate(-50%, -50%) scale(${interpolate(boomSpring, [0, 1], [0.2, 1])})`,
            opacity: boomOp,
          }}
        >
          <span
            style={{
              fontSize: 120,
              fontFamily: FONTS.heading,
              fontWeight: 900,
              color: COLORS.gold,
              textShadow: `0 0 50px ${COLORS.gold}AA`,
              letterSpacing: 10,
            }}
          >
            GO!
          </span>
        </div>
      )}

      <ParticleBurst frame={frame} startFrame={60} count={30} />

      {/* Topic reveal */}
      <div
        style={{
          position: 'absolute',
          top: '45%',
          left: 0,
          right: 0,
          textAlign: 'center',
          transform: `scale(${interpolate(topicSpring, [0, 1], [0.4, 1])})`,
          opacity: topicRevealOp,
        }}
      >
        <span
          style={{
            fontSize: 48,
            fontFamily: FONTS.heading,
            fontWeight: 900,
            color: COLORS.textOnDark,
            textShadow: `0 0 30px ${COLORS.saffron}50`,
          }}
        >
          {hookText || topic}
        </span>
      </div>

      <TopicSlam topic={topic} frame={frame} fps={fps} startFrame={100} exitFrame={dur - 15} totalFrames={dur} />
      <BrandingReveal frame={frame} fps={fps} startFrame={108} />
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
 * STYLE 9: "THE STACK OVERFLOW"
 * Error message → stack trace → "THE FIX" → topic
 * ═══════════════════════════════════════════════════════════════════════════════ */
const StyleStackOverflow: React.FC<{
  topic: string;
  hookText: string;
  frame: number;
  fps: number;
  dur: number;
}> = ({ topic, hookText, frame, fps, dur }) => {
  const errorLines = [
    'TypeError: Cannot read properties of undefined',
    '    at Server.handleRequest (server.js:42)',
    '    at processTicksAndRejections (node:internal)',
    '    at async Router.execute (router.js:118)',
    'Error: FATAL — Service crashed',
  ];

  // Phase 1: Error terminal (0-55f)
  const termOp = interpolate(frame, [0, 5, 48, 55], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const visibleLines = Math.min(errorLines.length, Math.floor(interpolate(frame, [5, 35], [0, 5], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  })));
  const cursorBlink = Math.floor(frame / 8) % 2 === 0;

  // Phase 2: Red screen shake + "THE FIX" (55-95f)
  const redPulse = interpolate(frame, [45, 48, 50], [0, 0.5, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const fixSpring = spring({
    frame: Math.max(0, frame - 58),
    fps,
    config: { damping: 7, stiffness: 220, mass: 0.4 },
  });
  const fixOp = interpolate(frame, [58, 63, 85, 95], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Phase 3: Solution (85-dur)
  const solOp = interpolate(frame, [82, 90, dur - 15, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Screen shake for error
  const shakeX = frame >= 45 && frame < 55
    ? Math.sin(frame * 3) * interpolate(frame, [45, 55], [6, 0], { extrapolateRight: 'clamp' })
    : 0;

  return (
    <>
      {/* Red flash */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: COLORS.red, opacity: redPulse }} />

      {/* Terminal window */}
      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '10%',
          right: '10%',
          transform: `translateX(${shakeX}px)`,
          opacity: termOp,
        }}
      >
        {/* Terminal header */}
        <div
          style={{
            background: `${COLORS.gray}33`,
            borderRadius: '8px 8px 0 0',
            padding: '8px 16px',
            display: 'flex',
            gap: 8,
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: COLORS.red }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: COLORS.gold }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: COLORS.teal }} />
        </div>
        {/* Terminal body */}
        <div
          style={{
            background: '#0D1117',
            borderRadius: '0 0 8px 8px',
            padding: '20px',
            minHeight: 180,
          }}
        >
          {errorLines.slice(0, visibleLines).map((line, i) => (
            <div
              key={`el-${i}`}
              style={{
                fontSize: 16,
                fontFamily: FONTS.code,
                color: i === 0 || i === 4 ? COLORS.red : COLORS.gray,
                marginBottom: 6,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              {line}
            </div>
          ))}
          {/* Blinking cursor */}
          <span
            style={{
              fontSize: 16,
              fontFamily: FONTS.code,
              color: COLORS.teal,
              opacity: cursorBlink ? 1 : 0,
            }}
          >
            {'█'}
          </span>
        </div>
      </div>

      {/* THE FIX */}
      {frame >= 58 && (
        <div
          style={{
            position: 'absolute',
            top: '38%',
            left: 0,
            right: 0,
            textAlign: 'center',
            transform: `scale(${interpolate(fixSpring, [0, 1], [0.3, 1])})`,
            opacity: fixOp,
          }}
        >
          <span
            style={{
              fontSize: 72,
              fontFamily: FONTS.heading,
              fontWeight: 900,
              color: COLORS.teal,
              letterSpacing: 8,
              textShadow: `0 0 40px ${COLORS.teal}60`,
            }}
          >
            THE FIX
          </span>
        </div>
      )}

      {/* Solution text */}
      <div
        style={{
          position: 'absolute',
          top: '55%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: solOp,
        }}
      >
        <span
          style={{
            fontSize: 36,
            fontFamily: FONTS.heading,
            fontWeight: 800,
            color: COLORS.textOnDark,
          }}
        >
          {hookText || `Master ${topic}`}
        </span>
      </div>

      <TopicSlam topic={topic} frame={frame} fps={fps} startFrame={100} exitFrame={dur - 15} totalFrames={dur} />
      <BrandingReveal frame={frame} fps={fps} startFrame={108} />
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
 * STYLE 10: "THE BATTLEFIELD"
 * Two armies (Wrong vs Right approach) charge → clash → winner
 * ═══════════════════════════════════════════════════════════════════════════════ */
const StyleBattlefield: React.FC<{
  topic: string;
  hookText: string;
  frame: number;
  fps: number;
  dur: number;
}> = ({ topic, hookText, frame, fps, dur }) => {
  // Phase 1: Two armies charging (0-50f)
  const leftCharge = interpolate(frame, [5, 45], [-300, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const rightCharge = interpolate(frame, [5, 45], [300, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const armyOp = interpolate(frame, [5, 12, 55, 65], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Phase 2: Clash explosion (50-80f)
  const clashFlash = interpolate(frame, [48, 50, 54], [0, 0.7, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const clashTextSpring = spring({
    frame: Math.max(0, frame - 50),
    fps,
    config: { damping: 6, stiffness: 280, mass: 0.3 },
  });
  const clashOp = interpolate(frame, [50, 54, 72, 80], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Phase 3: Winner (right/correct approach) rises (80-dur)
  const winnerSpring = spring({
    frame: Math.max(0, frame - 80),
    fps,
    config: { damping: 10, stiffness: 140, mass: 0.7 },
  });
  const winnerOp = interpolate(frame, [80, 88, dur - 15, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Soldiers (dots representing each army)
  const soldierCount = 8;

  return (
    <>
      {/* Clash flash */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: COLORS.gold, opacity: clashFlash }} />

      {/* Left army - WRONG approach */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '5%',
          width: '40%',
          transform: `translateX(${leftCharge}px)`,
          opacity: armyOp,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 22, fontFamily: FONTS.heading, fontWeight: 800, color: COLORS.red, letterSpacing: 3 }}>
            WRONG WAY
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          {Array.from({ length: soldierCount }, (_, i) => (
            <div
              key={`ls-${i}`}
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                backgroundColor: COLORS.red,
                opacity: 0.5 + (i % 3) * 0.15,
                boxShadow: `0 0 6px ${COLORS.red}40`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Right army - RIGHT approach */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          right: '5%',
          width: '40%',
          transform: `translateX(${rightCharge}px)`,
          opacity: armyOp,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 22, fontFamily: FONTS.heading, fontWeight: 800, color: COLORS.teal, letterSpacing: 3 }}>
            RIGHT WAY
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          {Array.from({ length: soldierCount }, (_, i) => (
            <div
              key={`rs-${i}`}
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                backgroundColor: COLORS.teal,
                opacity: 0.5 + (i % 3) * 0.15,
                boxShadow: `0 0 6px ${COLORS.teal}40`,
              }}
            />
          ))}
        </div>
      </div>

      {/* CLASH text */}
      {frame >= 50 && frame <= 80 && (
        <div
          style={{
            position: 'absolute',
            top: '35%',
            left: '50%',
            transform: `translate(-50%, -50%) scale(${interpolate(clashTextSpring, [0, 1], [4, 1])})`,
            opacity: clashOp,
            zIndex: 10,
          }}
        >
          <span
            style={{
              fontSize: 80,
              fontFamily: FONTS.heading,
              fontWeight: 900,
              color: COLORS.gold,
              textShadow: `0 0 50px ${COLORS.gold}AA`,
              letterSpacing: 6,
            }}
          >
            CLASH!
          </span>
        </div>
      )}

      <ParticleBurst frame={frame} startFrame={50} count={24} />

      {/* Winner reveal */}
      <div
        style={{
          position: 'absolute',
          top: '42%',
          left: 0,
          right: 0,
          textAlign: 'center',
          transform: `scale(${interpolate(winnerSpring, [0, 1], [0.5, 1])})`,
          opacity: winnerOp,
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 20, fontFamily: FONTS.text, fontWeight: 700, color: COLORS.teal, letterSpacing: 4 }}>
            WINNER
          </span>
        </div>
        <span
          style={{
            fontSize: 44,
            fontFamily: FONTS.heading,
            fontWeight: 900,
            color: COLORS.textOnDark,
            textShadow: `0 0 30px ${COLORS.teal}40`,
          }}
        >
          {hookText || topic}
        </span>
      </div>

      <TopicSlam topic={topic} frame={frame} fps={fps} startFrame={100} exitFrame={dur - 15} totalFrames={dur} />
      <BrandingReveal frame={frame} fps={fps} startFrame={108} />
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
 * STYLE 11: "THE TYPING TEST"
 * Speed typing challenge → WPM counter → "But can you TYPE this in code?"
 * ═══════════════════════════════════════════════════════════════════════════════ */
const StyleTypingTest: React.FC<{
  topic: string;
  hookText: string;
  frame: number;
  fps: number;
  dur: number;
}> = ({ topic, hookText, frame, fps, dur }) => {
  const codeSnippet = `function solve(${topic.toLowerCase().replace(/\s+/g, '_')}) {`;
  const typedLen = Math.min(
    codeSnippet.length,
    Math.floor(interpolate(frame, [5, 50], [0, codeSnippet.length], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    })),
  );
  const typedText = codeSnippet.slice(0, typedLen);

  // Phase 1: Typing animation (0-55f)
  const typeOp = interpolate(frame, [0, 5, 50, 58], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const cursorOn = Math.floor(frame / 4) % 2 === 0;

  // WPM counter
  const wpm = Math.round(interpolate(frame, [10, 45], [0, 180], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  }));
  const wpmColor = wpm > 120 ? COLORS.teal : wpm > 60 ? COLORS.gold : COLORS.textOnDark;

  // Phase 2: "But can you TYPE this in code?" (55-90f)
  const butSpring = spring({
    frame: Math.max(0, frame - 55),
    fps,
    config: { damping: 10, stiffness: 160, mass: 0.5 },
  });
  const butOp = interpolate(frame, [55, 62, 85, 93], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Phase 3: Topic (90-dur)
  const challengeOp = interpolate(frame, [88, 95, dur - 15, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <>
      {/* Typing area */}
      <div
        style={{
          position: 'absolute',
          top: '22%',
          left: '12%',
          right: '12%',
          opacity: typeOp,
        }}
      >
        <div
          style={{
            background: '#0D1117',
            borderRadius: 12,
            padding: '24px 28px',
            border: `1px solid ${COLORS.saffron}33`,
          }}
        >
          <span style={{ fontSize: 28, fontFamily: FONTS.code, color: COLORS.teal }}>
            {typedText}
          </span>
          <span style={{ fontSize: 28, fontFamily: FONTS.code, color: COLORS.saffron, opacity: cursorOn ? 1 : 0 }}>
            {'|'}
          </span>
        </div>
      </div>

      {/* WPM counter */}
      <div
        style={{
          position: 'absolute',
          top: '48%',
          left: '50%',
          transform: 'translateX(-50%)',
          opacity: typeOp,
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: 72, fontFamily: FONTS.heading, fontWeight: 900, color: wpmColor }}>
          {wpm}
        </span>
        <div style={{ fontSize: 18, fontFamily: FONTS.text, fontWeight: 700, color: COLORS.gray, letterSpacing: 4 }}>
          WPM
        </div>
      </div>

      {/* "But can you TYPE this in code?" */}
      <div
        style={{
          position: 'absolute',
          top: '35%',
          left: 0,
          right: 0,
          textAlign: 'center',
          transform: `scale(${interpolate(butSpring, [0, 1], [0.6, 1])})`,
          opacity: butOp,
        }}
      >
        <span style={{ fontSize: 42, fontFamily: FONTS.heading, fontWeight: 800, color: COLORS.textOnDark }}>
          But can you <span style={{ color: COLORS.saffron }}>CODE</span> this?
        </span>
      </div>

      {/* Challenge topic */}
      <div
        style={{
          position: 'absolute',
          top: '55%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: challengeOp,
        }}
      >
        <span style={{ fontSize: 36, fontFamily: FONTS.heading, fontWeight: 800, color: COLORS.gold }}>
          {hookText || topic}
        </span>
      </div>

      <TopicSlam topic={topic} frame={frame} fps={fps} startFrame={100} exitFrame={dur - 15} totalFrames={dur} />
      <BrandingReveal frame={frame} fps={fps} startFrame={108} />
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
 * STYLE 12: "THE TIMELINE"
 * Historical timeline of tech → zooms to present → "Today: {topic}"
 * ═══════════════════════════════════════════════════════════════════════════════ */
const StyleTimeline: React.FC<{
  topic: string;
  hookText: string;
  frame: number;
  fps: number;
  dur: number;
}> = ({ topic, hookText, frame, fps, dur }) => {
  const milestones = [
    { year: '1969', label: 'ARPANET', color: COLORS.gray },
    { year: '1991', label: 'HTTP', color: COLORS.gray },
    { year: '2006', label: 'AWS', color: COLORS.gray },
    { year: '2013', label: 'Docker', color: COLORS.gray },
    { year: '2026', label: topic, color: COLORS.gold },
  ];

  // Phase 1: Timeline scrolls in (0-60f)
  const scrollX = interpolate(frame, [5, 55], [600, -200], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const timelineOp = interpolate(frame, [5, 12, 60, 70], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Timeline line width grows
  const lineW = interpolate(frame, [5, 50], [0, 100], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Phase 2: "TODAY" zoom (60-95f)
  const todaySpring = spring({
    frame: Math.max(0, frame - 62),
    fps,
    config: { damping: 8, stiffness: 180, mass: 0.5 },
  });
  const todayOp = interpolate(frame, [62, 68, 90, 98], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Phase 3: Topic (95-dur)
  const topicOp = interpolate(frame, [92, 100, dur - 15, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <>
      {/* Timeline bar */}
      <div
        style={{
          position: 'absolute',
          top: '44%',
          left: '5%',
          width: `${lineW}%`,
          height: 3,
          background: `linear-gradient(90deg, ${COLORS.gray}44, ${COLORS.saffron}88)`,
          opacity: timelineOp,
        }}
      />

      {/* Milestones */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: 0,
          right: 0,
          opacity: timelineOp,
          transform: `translateX(${scrollX}px)`,
        }}
      >
        {milestones.map((ms, i) => {
          const nodeSpring = spring({
            frame: Math.max(0, frame - 10 - i * 8),
            fps,
            config: { damping: 12, stiffness: 140 },
          });
          const isLast = i === milestones.length - 1;
          return (
            <div
              key={`ms-${i}`}
              style={{
                position: 'absolute',
                left: 80 + i * 180,
                textAlign: 'center',
                transform: `scale(${interpolate(nodeSpring, [0, 1], [0, 1])})`,
              }}
            >
              <div
                style={{
                  width: isLast ? 18 : 12,
                  height: isLast ? 18 : 12,
                  borderRadius: '50%',
                  backgroundColor: ms.color,
                  margin: '0 auto 10px',
                  boxShadow: isLast ? `0 0 20px ${COLORS.gold}80` : 'none',
                  marginTop: 30,
                }}
              />
              <div style={{ fontSize: isLast ? 20 : 14, fontFamily: FONTS.code, fontWeight: 700, color: ms.color }}>
                {ms.year}
              </div>
              <div style={{ fontSize: isLast ? 16 : 12, fontFamily: FONTS.text, fontWeight: 600, color: ms.color, marginTop: 4 }}>
                {ms.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* TODAY zoom-in */}
      {frame >= 62 && (
        <div
          style={{
            position: 'absolute',
            top: '28%',
            left: 0,
            right: 0,
            textAlign: 'center',
            transform: `scale(${interpolate(todaySpring, [0, 1], [0.4, 1])})`,
            opacity: todayOp,
          }}
        >
          <span style={{ fontSize: 28, fontFamily: FONTS.text, fontWeight: 700, color: COLORS.saffron, letterSpacing: 6 }}>
            TODAY
          </span>
          <div style={{ marginTop: 16 }}>
            <span style={{ fontSize: 52, fontFamily: FONTS.heading, fontWeight: 900, color: COLORS.textOnDark }}>
              {hookText || topic}
            </span>
          </div>
        </div>
      )}

      <TopicSlam topic={topic} frame={frame} fps={fps} startFrame={100} exitFrame={dur - 15} totalFrames={dur} />
      <BrandingReveal frame={frame} fps={fps} startFrame={108} />
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
 * STYLE 13: "THE WHITEBOARD"
 * Hand-drawn doodle appearing → erased → clean architecture
 * ═══════════════════════════════════════════════════════════════════════════════ */
const StyleWhiteboard: React.FC<{
  topic: string;
  hookText: string;
  frame: number;
  fps: number;
  dur: number;
}> = ({ topic, hookText, frame, fps, dur }) => {
  // Phase 1: Messy doodles appear (0-50f)
  const doodleOp = interpolate(frame, [0, 8, 42, 52], [0, 0.8, 0.8, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const doodleLines = [
    { x1: 15, y1: 25, x2: 45, y2: 25 },
    { x1: 45, y1: 25, x2: 45, y2: 50 },
    { x1: 55, y1: 30, x2: 85, y2: 30 },
    { x1: 30, y1: 50, x2: 70, y2: 50 },
    { x1: 20, y1: 60, x2: 50, y2: 40 },
  ];
  const visibleDoodles = Math.min(doodleLines.length, Math.floor(
    interpolate(frame, [5, 35], [0, 5], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  ));

  // "THIS IS WRONG" label
  const wrongOp = interpolate(frame, [30, 38, 42, 52], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Phase 2: Erase wipe (50-65f)
  const eraseProgress = interpolate(frame, [50, 65], [0, 100], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Phase 3: Clean architecture (65-dur)
  const cleanBoxes = ['Input', topic.toUpperCase(), 'Output'];
  const cleanOp = interpolate(frame, [65, 75, dur - 15, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <>
      {/* Whiteboard background */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: '8%',
          right: '8%',
          bottom: '20%',
          background: `${COLORS.dark}`,
          border: `2px solid ${COLORS.gray}33`,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {/* Messy doodle lines */}
        {doodleLines.slice(0, visibleDoodles).map((line, i) => (
          <div
            key={`dl-${i}`}
            style={{
              position: 'absolute',
              left: `${line.x1}%`,
              top: `${line.y1}%`,
              width: `${Math.abs(line.x2 - line.x1)}%`,
              height: 3,
              backgroundColor: COLORS.red,
              opacity: doodleOp * (0.4 + (i % 3) * 0.15),
              transform: `rotate(${(i * 7 - 10)}deg)`,
            }}
          />
        ))}

        {/* "THIS IS WRONG" */}
        <div
          style={{
            position: 'absolute',
            top: '35%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-8deg)',
            opacity: wrongOp,
          }}
        >
          <span
            style={{
              fontSize: 48,
              fontFamily: FONTS.heading,
              fontWeight: 900,
              color: COLORS.red,
              letterSpacing: 4,
              textShadow: `0 0 20px ${COLORS.red}40`,
            }}
          >
            WRONG!
          </span>
        </div>

        {/* Erase wipe */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${eraseProgress}%`,
            bottom: 0,
            backgroundColor: '#0C0A15',
            zIndex: 5,
          }}
        />

        {/* Clean architecture boxes */}
        <div
          style={{
            position: 'absolute',
            top: '30%',
            left: '10%',
            right: '10%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            opacity: cleanOp,
            zIndex: 6,
          }}
        >
          {cleanBoxes.map((label, i) => {
            const boxSpring = spring({
              frame: Math.max(0, frame - 68 - i * 8),
              fps,
              config: { damping: 10, stiffness: 160 },
            });
            const isCenter = i === 1;
            return (
              <React.Fragment key={`cb-${i}`}>
                {i > 0 && (
                  <div
                    style={{
                      width: 40,
                      height: 2,
                      backgroundColor: COLORS.teal,
                      opacity: interpolate(boxSpring, [0, 1], [0, 0.6]),
                    }}
                  />
                )}
                <div
                  style={{
                    padding: '14px 24px',
                    border: `2px solid ${isCenter ? COLORS.gold : COLORS.teal}`,
                    borderRadius: 10,
                    background: `${isCenter ? COLORS.gold : COLORS.teal}12`,
                    transform: `scale(${interpolate(boxSpring, [0, 1], [0, 1])})`,
                  }}
                >
                  <span
                    style={{
                      fontSize: isCenter ? 18 : 14,
                      fontFamily: FONTS.text,
                      fontWeight: 700,
                      color: isCenter ? COLORS.gold : COLORS.teal,
                    }}
                  >
                    {label}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <TopicSlam topic={topic} frame={frame} fps={fps} startFrame={100} exitFrame={dur - 15} totalFrames={dur} />
      <BrandingReveal frame={frame} fps={fps} startFrame={108} />
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
 * STYLE 14: "THE SPOTLIGHT"
 * Dark stage → single spotlight → topic name drops in
 * ═══════════════════════════════════════════════════════════════════════════════ */
const StyleSpotlight: React.FC<{
  topic: string;
  hookText: string;
  frame: number;
  fps: number;
  dur: number;
}> = ({ topic, hookText, frame, fps, dur }) => {
  // Phase 1: Darkness + spotlight sweeps (0-50f)
  const spotX = interpolate(frame, [0, 20, 40, 50], [20, 80, 30, 50], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const spotY = interpolate(frame, [0, 15, 35, 50], [30, 60, 25, 45], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const spotSize = interpolate(frame, [0, 10, 45, 50], [50, 200, 180, 300], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const spotOp = interpolate(frame, [0, 5, 50, 55], [0, 0.6, 0.8, 0.3], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // "Searching..." text
  const searchOp = interpolate(frame, [15, 22, 38, 45], [0, 0.7, 0.7, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Phase 2: Spotlight locks + "FOUND IT" (50-85f)
  const foundSpring = spring({
    frame: Math.max(0, frame - 50),
    fps,
    config: { damping: 8, stiffness: 200, mass: 0.4 },
  });
  const foundOp = interpolate(frame, [50, 55, 75, 85], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const spotFinalSize = interpolate(frame, [50, 70], [300, 500], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Phase 3: Topic drops in (85-dur)
  const dropSpring = spring({
    frame: Math.max(0, frame - 85),
    fps,
    config: { damping: 10, stiffness: 140, mass: 0.6 },
  });
  const dropOp = interpolate(frame, [85, 92, dur - 15, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const dropY = interpolate(dropSpring, [0, 1], [-100, 0]);

  return (
    <>
      {/* Dark overlay with spotlight cutout */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: frame < 55
            ? `radial-gradient(circle ${spotSize}px at ${spotX}% ${spotY}%, transparent 0%, ${COLORS.dark}DD 100%)`
            : `radial-gradient(circle ${spotFinalSize}px at 50% 45%, transparent 0%, ${COLORS.dark}CC 100%)`,
          opacity: spotOp,
          zIndex: 5,
        }}
      />

      {/* Spotlight glow */}
      <div
        style={{
          position: 'absolute',
          left: `${frame < 50 ? spotX : 50}%`,
          top: `${frame < 50 ? spotY : 45}%`,
          width: frame < 50 ? spotSize : spotFinalSize,
          height: frame < 50 ? spotSize : spotFinalSize,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.gold}20 0%, transparent 70%)`,
          transform: 'translate(-50%, -50%)',
          opacity: spotOp,
        }}
      />

      {/* "Searching..." */}
      <div
        style={{
          position: 'absolute',
          top: '65%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: searchOp,
          zIndex: 10,
        }}
      >
        <span style={{ fontSize: 28, fontFamily: FONTS.text, fontWeight: 600, color: COLORS.gray, fontStyle: 'italic' }}>
          Searching for the answer...
        </span>
      </div>

      {/* "FOUND IT" */}
      {frame >= 50 && frame <= 85 && (
        <div
          style={{
            position: 'absolute',
            top: '30%',
            left: 0,
            right: 0,
            textAlign: 'center',
            transform: `scale(${interpolate(foundSpring, [0, 1], [0.3, 1])})`,
            opacity: foundOp,
            zIndex: 10,
          }}
        >
          <span style={{ fontSize: 64, fontFamily: FONTS.heading, fontWeight: 900, color: COLORS.gold, letterSpacing: 6, textShadow: `0 0 40px ${COLORS.gold}60` }}>
            FOUND IT.
          </span>
        </div>
      )}

      {/* Topic drops in */}
      <div
        style={{
          position: 'absolute',
          top: '45%',
          left: 0,
          right: 0,
          textAlign: 'center',
          transform: `translateY(${dropY}px)`,
          opacity: dropOp,
          zIndex: 10,
        }}
      >
        <span style={{ fontSize: 44, fontFamily: FONTS.heading, fontWeight: 900, color: COLORS.textOnDark }}>
          {hookText || topic}
        </span>
      </div>

      <TopicSlam topic={topic} frame={frame} fps={fps} startFrame={100} exitFrame={dur - 15} totalFrames={dur} />
      <BrandingReveal frame={frame} fps={fps} startFrame={108} />
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
 * STYLE 15: "THE HEARTBEAT"
 * ECG flatline → heartbeat spikes at topic keywords → "ALIVE"
 * ═══════════════════════════════════════════════════════════════════════════════ */
const StyleHeartbeat: React.FC<{
  topic: string;
  hookText: string;
  frame: number;
  fps: number;
  dur: number;
}> = ({ topic, hookText, frame, fps, dur }) => {
  // Phase 1: Flatline + "NO PULSE" (0-40f)
  const flatlineOp = interpolate(frame, [0, 5, 35, 42], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const lineX = interpolate(frame, [5, 35], [0, 100], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const noPulseOp = interpolate(frame, [10, 16, 35, 42], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Phase 2: Heartbeat spikes (40-85f)
  const beatOp = interpolate(frame, [38, 44, 80, 88], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  // Generate heartbeat pattern (deterministic)
  const beatPhase = (frame - 40) / 10;
  const beatY = frame >= 40 && frame <= 85
    ? Math.abs(Math.sin(beatPhase * Math.PI)) * 60
    : 0;
  const beatColor = beatY > 30 ? COLORS.teal : COLORS.red;

  // BPM counter
  const bpm = Math.round(interpolate(frame, [42, 75], [0, 120], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  }));

  // "ALIVE" text
  const aliveSpring = spring({
    frame: Math.max(0, frame - 65),
    fps,
    config: { damping: 8, stiffness: 180, mass: 0.5 },
  });
  const aliveOp = interpolate(frame, [65, 70, 82, 90], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Phase 3: Topic (85-dur)
  const topicOp = interpolate(frame, [85, 93, dur - 15, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <>
      {/* Flatline */}
      <div
        style={{
          position: 'absolute',
          top: '42%',
          left: '5%',
          width: `${lineX}%`,
          height: 3,
          backgroundColor: COLORS.red,
          opacity: flatlineOp,
          boxShadow: `0 0 10px ${COLORS.red}60`,
        }}
      />

      {/* NO PULSE */}
      <div style={{ position: 'absolute', top: '28%', left: 0, right: 0, textAlign: 'center', opacity: noPulseOp }}>
        <span style={{ fontSize: 56, fontFamily: FONTS.heading, fontWeight: 900, color: COLORS.red, letterSpacing: 6, textShadow: `0 0 30px ${COLORS.red}60` }}>
          NO PULSE
        </span>
      </div>

      {/* Heartbeat wave (series of bars) */}
      <div
        style={{
          position: 'absolute',
          top: '35%',
          left: '5%',
          right: '5%',
          height: 120,
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          opacity: beatOp,
        }}
      >
        {Array.from({ length: 40 }, (_, i) => {
          const barFrame = frame - 40 - i * 0.5;
          const barH = barFrame > 0
            ? Math.abs(Math.sin(barFrame * 0.8)) * 50 + 4
            : 4;
          return (
            <div
              key={`hb-${i}`}
              style={{
                flex: 1,
                height: barH,
                backgroundColor: barH > 25 ? COLORS.teal : COLORS.red,
                borderRadius: 2,
                opacity: 0.6 + (barH / 60) * 0.4,
              }}
            />
          );
        })}
      </div>

      {/* BPM counter */}
      <div
        style={{
          position: 'absolute',
          top: '58%',
          right: '10%',
          opacity: beatOp,
          textAlign: 'right',
        }}
      >
        <span style={{ fontSize: 48, fontFamily: FONTS.heading, fontWeight: 900, color: COLORS.teal }}>
          {bpm}
        </span>
        <span style={{ fontSize: 18, fontFamily: FONTS.text, fontWeight: 700, color: COLORS.gray, marginLeft: 8 }}>
          BPM
        </span>
      </div>

      {/* ALIVE */}
      {frame >= 65 && (
        <div
          style={{
            position: 'absolute',
            top: '25%',
            left: 0,
            right: 0,
            textAlign: 'center',
            transform: `scale(${interpolate(aliveSpring, [0, 1], [0.3, 1])})`,
            opacity: aliveOp,
          }}
        >
          <span style={{ fontSize: 72, fontFamily: FONTS.heading, fontWeight: 900, color: COLORS.teal, letterSpacing: 8, textShadow: `0 0 40px ${COLORS.teal}80` }}>
            ALIVE
          </span>
        </div>
      )}

      {/* Topic */}
      <div style={{ position: 'absolute', top: '55%', left: 0, right: 0, textAlign: 'center', opacity: topicOp }}>
        <span style={{ fontSize: 40, fontFamily: FONTS.heading, fontWeight: 900, color: COLORS.textOnDark }}>
          {hookText || topic}
        </span>
      </div>

      <TopicSlam topic={topic} frame={frame} fps={fps} startFrame={100} exitFrame={dur - 15} totalFrames={dur} />
      <BrandingReveal frame={frame} fps={fps} startFrame={108} />
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
 * STYLE 16: "THE BLUEPRINT"
 * Architectural blueprint unrolling → measurements → topic
 * ═══════════════════════════════════════════════════════════════════════════════ */
const StyleBlueprint: React.FC<{
  topic: string;
  hookText: string;
  frame: number;
  fps: number;
  dur: number;
}> = ({ topic, hookText, frame, fps, dur }) => {
  // Blueprint blue tint
  const bpColor = COLORS.saffron;

  // Phase 1: Blueprint unroll (0-50f) — clip from left
  const unrollWidth = interpolate(frame, [3, 45], [0, 100], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const bpOp = interpolate(frame, [3, 10, 55, 65], [0, 0.9, 0.9, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Blueprint grid
  const gridOp = interpolate(frame, [8, 20], [0, 0.3], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Measurement annotations appearing
  const annotCount = Math.min(3, Math.floor(interpolate(frame, [20, 45], [0, 3], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  })));
  const annotations = ['O(1) lookup', '99.99% uptime', '< 10ms latency'];

  // Phase 2: "ARCHITECTURE APPROVED" stamp (55-90f)
  const stampSpring = spring({
    frame: Math.max(0, frame - 55),
    fps,
    config: { damping: 6, stiffness: 250, mass: 0.3 },
  });
  const stampOp = interpolate(frame, [55, 58, 82, 90], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const stampRotate = interpolate(stampSpring, [0, 1], [-15, -5]);

  // Phase 3: Topic (88-dur)
  const topicOp = interpolate(frame, [88, 95, dur - 15, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <>
      {/* Blueprint surface */}
      <div
        style={{
          position: 'absolute',
          top: '8%',
          left: '6%',
          right: '6%',
          bottom: '22%',
          overflow: 'hidden',
          borderRadius: 8,
          border: `1px solid ${bpColor}33`,
          opacity: bpOp,
        }}
      >
        {/* Grid lines */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(${bpColor}15 1px, transparent 1px),
              linear-gradient(90deg, ${bpColor}15 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            opacity: gridOp,
            clipPath: `inset(0 ${100 - unrollWidth}% 0 0)`,
          }}
        />

        {/* Blueprint diagram boxes */}
        <div
          style={{
            position: 'absolute',
            top: '25%',
            left: '15%',
            right: '15%',
            display: 'flex',
            justifyContent: 'space-around',
            clipPath: `inset(0 ${100 - unrollWidth}% 0 0)`,
          }}
        >
          {['Client', topic, 'DB'].map((label, i) => (
            <div
              key={`bp-${i}`}
              style={{
                width: 120,
                height: 60,
                border: `1px dashed ${bpColor}66`,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 14, fontFamily: FONTS.code, color: bpColor, fontWeight: 600 }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Measurement annotations */}
        {annotations.slice(0, annotCount).map((ann, i) => {
          const aSpring = spring({
            frame: Math.max(0, frame - 22 - i * 8),
            fps,
            config: { damping: 12, stiffness: 140 },
          });
          return (
            <div
              key={`ann-${i}`}
              style={{
                position: 'absolute',
                top: `${55 + i * 12}%`,
                left: `${20 + i * 25}%`,
                transform: `scale(${interpolate(aSpring, [0, 1], [0, 1])})`,
              }}
            >
              <span style={{ fontSize: 14, fontFamily: FONTS.code, color: COLORS.teal, fontWeight: 600 }}>
                {'← '}{ann}
              </span>
            </div>
          );
        })}
      </div>

      {/* APPROVED stamp */}
      {frame >= 55 && (
        <div
          style={{
            position: 'absolute',
            top: '35%',
            left: '50%',
            transform: `translate(-50%, -50%) rotate(${stampRotate}deg) scale(${interpolate(stampSpring, [0, 1], [3, 1])})`,
            opacity: stampOp,
            zIndex: 10,
          }}
        >
          <div
            style={{
              border: `4px solid ${COLORS.teal}`,
              borderRadius: 8,
              padding: '12px 32px',
            }}
          >
            <span style={{ fontSize: 42, fontFamily: FONTS.heading, fontWeight: 900, color: COLORS.teal, letterSpacing: 6 }}>
              APPROVED
            </span>
          </div>
        </div>
      )}

      {/* Topic reveal */}
      <div style={{ position: 'absolute', top: '55%', left: 0, right: 0, textAlign: 'center', opacity: topicOp }}>
        <span style={{ fontSize: 40, fontFamily: FONTS.heading, fontWeight: 900, color: COLORS.textOnDark }}>
          {hookText || topic}
        </span>
      </div>

      <TopicSlam topic={topic} frame={frame} fps={fps} startFrame={100} exitFrame={dur - 15} totalFrames={dur} />
      <BrandingReveal frame={frame} fps={fps} startFrame={108} />
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
 * STYLE 17: "THE GLITCH"
 * Screen glitch/distortion → "REALITY CHECK" → topic
 * ═══════════════════════════════════════════════════════════════════════════════ */
const StyleGlitch: React.FC<{
  topic: string;
  hookText: string;
  frame: number;
  fps: number;
  dur: number;
}> = ({ topic, hookText, frame, fps, dur }) => {
  // Phase 1: Glitch effect (0-50f)
  const glitchIntensity = frame < 50
    ? interpolate(Math.sin(frame * 1.3), [-1, 1], [0, 1]) * interpolate(frame, [0, 25, 45, 50], [0, 1, 0.8, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0;

  // RGB split offsets
  const rgbShift = glitchIntensity * 8;

  // Horizontal glitch bars
  const barCount = 6;

  // "WHAT YOU KNOW IS WRONG" text
  const wrongTextOp = interpolate(frame, [15, 22, 40, 48], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Phase 2: "REALITY CHECK" (50-85f)
  const realitySpring = spring({
    frame: Math.max(0, frame - 50),
    fps,
    config: { damping: 7, stiffness: 220, mass: 0.4 },
  });
  const realityOp = interpolate(frame, [50, 55, 78, 85], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Scanlines after glitch
  const scanlineOp = interpolate(frame, [50, 58, 75, 82], [0, 0.15, 0.1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Phase 3: Clean topic (82-dur)
  const cleanSpring = spring({
    frame: Math.max(0, frame - 82),
    fps,
    config: { damping: 10, stiffness: 150, mass: 0.6 },
  });
  const cleanOp = interpolate(frame, [82, 90, dur - 15, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <>
      {/* Glitch bars */}
      {frame < 50 && Array.from({ length: barCount }, (_, i) => {
        const barY = ((frame * 5 + i * 120) % 700);
        const barH = 3 + (i % 4) * 5;
        const barShift = Math.sin(frame * 2 + i) * glitchIntensity * 30;
        return (
          <div
            key={`gb-${i}`}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: barY,
              height: barH,
              backgroundColor: i % 2 === 0 ? COLORS.saffron : COLORS.red,
              opacity: glitchIntensity * 0.3,
              transform: `translateX(${barShift}px)`,
            }}
          />
        );
      })}

      {/* RGB split text */}
      {frame < 50 && (
        <div style={{ position: 'absolute', top: '38%', left: 0, right: 0, textAlign: 'center' }}>
          {/* Red channel */}
          <span style={{
            position: 'absolute', left: 0, right: 0, textAlign: 'center',
            fontSize: 56, fontFamily: FONTS.heading, fontWeight: 900,
            color: 'rgba(255,0,0,0.5)',
            transform: `translate(${rgbShift}px, ${-rgbShift / 2}px)`,
            opacity: wrongTextOp,
          }}>
            {topic}
          </span>
          {/* Blue channel */}
          <span style={{
            position: 'absolute', left: 0, right: 0, textAlign: 'center',
            fontSize: 56, fontFamily: FONTS.heading, fontWeight: 900,
            color: 'rgba(0,0,255,0.5)',
            transform: `translate(${-rgbShift}px, ${rgbShift / 2}px)`,
            opacity: wrongTextOp,
          }}>
            {topic}
          </span>
          {/* Main */}
          <span style={{
            fontSize: 56, fontFamily: FONTS.heading, fontWeight: 900, color: COLORS.textOnDark,
            opacity: wrongTextOp, position: 'relative',
          }}>
            {topic}
          </span>
        </div>
      )}

      {/* Scanlines */}
      <div
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${COLORS.dark}20 2px, ${COLORS.dark}20 4px)`,
          opacity: scanlineOp,
        }}
      />

      {/* REALITY CHECK */}
      {frame >= 50 && (
        <div
          style={{
            position: 'absolute', top: '30%', left: 0, right: 0, textAlign: 'center',
            transform: `scale(${interpolate(realitySpring, [0, 1], [0.3, 1])})`,
            opacity: realityOp,
          }}
        >
          <span style={{
            fontSize: 64, fontFamily: FONTS.heading, fontWeight: 900,
            color: COLORS.indigo, letterSpacing: 6,
            textShadow: `0 0 40px ${COLORS.indigo}60`,
          }}>
            REALITY CHECK
          </span>
        </div>
      )}

      {/* Clean topic */}
      <div
        style={{
          position: 'absolute', top: '50%', left: 0, right: 0, textAlign: 'center',
          transform: `scale(${interpolate(cleanSpring, [0, 1], [0.5, 1])})`,
          opacity: cleanOp,
        }}
      >
        <span style={{ fontSize: 42, fontFamily: FONTS.heading, fontWeight: 900, color: COLORS.textOnDark }}>
          {hookText || topic}
        </span>
      </div>

      <TopicSlam topic={topic} frame={frame} fps={fps} startFrame={100} exitFrame={dur - 15} totalFrames={dur} />
      <BrandingReveal frame={frame} fps={fps} startFrame={108} />
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
 * STYLE 18: "THE TELESCOPE"
 * Stars → zoom through space → land on topic planet
 * ═══════════════════════════════════════════════════════════════════════════════ */
const StyleTelescope: React.FC<{
  topic: string;
  hookText: string;
  frame: number;
  fps: number;
  dur: number;
}> = ({ topic, hookText, frame, fps, dur }) => {
  const starCount = 30;

  // Phase 1: Star field + zoom effect (0-55f)
  const zoomSpeed = interpolate(frame, [0, 20, 50, 55], [1, 1, 3, 4], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const starsOp = interpolate(frame, [0, 5, 50, 58], [0, 0.8, 0.6, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // "ZOOMING IN..." text
  const zoomTextOp = interpolate(frame, [20, 28, 45, 52], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Phase 2: Planet appears (55-90f)
  const planetSpring = spring({
    frame: Math.max(0, frame - 55),
    fps,
    config: { damping: 10, stiffness: 120, mass: 0.8 },
  });
  const planetOp = interpolate(frame, [55, 62, 85, 92], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const planetScale = interpolate(planetSpring, [0, 1], [0.1, 1]);

  // Orbit ring
  const orbitAngle = frame * 2;

  // Phase 3: Topic on planet (85-dur)
  const labelOp = interpolate(frame, [72, 80, dur - 15, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <>
      {/* Star field */}
      {Array.from({ length: starCount }, (_, i) => {
        const seedX = ((i * 73 + 17) % 100);
        const seedY = ((i * 41 + 29) % 100);
        const starScale = zoomSpeed;
        const sx = 50 + (seedX - 50) * starScale;
        const sy = 50 + (seedY - 50) * starScale;
        const size = 1 + (i % 3);
        const starVis = (sx > -10 && sx < 110 && sy > -10 && sy < 110) ? 1 : 0;
        return (
          <div
            key={`star-${i}`}
            style={{
              position: 'absolute',
              left: `${sx}%`,
              top: `${sy}%`,
              width: size,
              height: size,
              borderRadius: '50%',
              backgroundColor: i % 4 === 0 ? COLORS.gold : COLORS.textOnDark,
              opacity: starsOp * starVis * (0.3 + (i % 5) * 0.14),
              boxShadow: `0 0 ${size * 2}px ${i % 3 === 0 ? COLORS.gold : COLORS.textOnDark}`,
            }}
          />
        );
      })}

      {/* "ZOOMING IN..." */}
      <div style={{ position: 'absolute', top: '20%', left: 0, right: 0, textAlign: 'center', opacity: zoomTextOp }}>
        <span style={{ fontSize: 32, fontFamily: FONTS.text, fontWeight: 700, color: COLORS.gray, letterSpacing: 6 }}>
          ZOOMING IN...
        </span>
      </div>

      {/* Planet */}
      {frame >= 55 && (
        <div
          style={{
            position: 'absolute',
            top: '35%',
            left: '50%',
            transform: `translate(-50%, -50%) scale(${planetScale})`,
            opacity: planetOp,
          }}
        >
          {/* Orbit ring */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 220,
              height: 220,
              borderRadius: '50%',
              border: `1px solid ${COLORS.indigo}44`,
              transform: `translate(-50%, -50%) rotate(${orbitAngle}deg)`,
            }}
          />
          {/* Planet sphere */}
          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: '50%',
              background: `radial-gradient(circle at 40% 35%, ${COLORS.indigo}CC, ${COLORS.saffron}88, ${COLORS.dark}CC)`,
              boxShadow: `0 0 60px ${COLORS.indigo}40, inset -20px -20px 40px rgba(0,0,0,0.3)`,
            }}
          />
          {/* Topic label on planet */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              opacity: labelOp,
            }}
          >
            <span style={{ fontSize: 18, fontFamily: FONTS.heading, fontWeight: 900, color: COLORS.textOnDark, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
              {topic.length > 12 ? topic.slice(0, 12) : topic}
            </span>
          </div>
        </div>
      )}

      {/* Topic text below planet */}
      <div style={{ position: 'absolute', top: '60%', left: 0, right: 0, textAlign: 'center', opacity: labelOp }}>
        <span style={{ fontSize: 40, fontFamily: FONTS.heading, fontWeight: 900, color: COLORS.textOnDark }}>
          {hookText || topic}
        </span>
      </div>

      <TopicSlam topic={topic} frame={frame} fps={fps} startFrame={100} exitFrame={dur - 15} totalFrames={dur} />
      <BrandingReveal frame={frame} fps={fps} startFrame={108} />
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
 * STYLE 19: "THE VAULT"
 * Bank vault door opening → golden light → topic treasure inside
 * ═══════════════════════════════════════════════════════════════════════════════ */
const StyleVault: React.FC<{
  topic: string;
  hookText: string;
  frame: number;
  fps: number;
  dur: number;
}> = ({ topic, hookText, frame, fps, dur }) => {
  // Phase 1: Vault door (0-55f)
  const doorLeftX = interpolate(frame, [10, 50], [0, -52], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const doorRightX = interpolate(frame, [10, 50], [0, 52], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const doorOp = interpolate(frame, [0, 5, 55, 65], [0, 1, 0.8, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Vault lock dial spinning
  const dialAngle = interpolate(frame, [0, 10], [0, 720], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const dialOp = interpolate(frame, [0, 3, 8, 12], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Golden light from inside
  const goldGlowOp = interpolate(frame, [30, 50, 80, 90], [0, 0.6, 0.4, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Phase 2: "TOP SECRET" + treasure (50-90f)
  const secretSpring = spring({
    frame: Math.max(0, frame - 48),
    fps,
    config: { damping: 8, stiffness: 180, mass: 0.5 },
  });
  const secretOp = interpolate(frame, [48, 55, 75, 85], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Phase 3: Topic reveal (82-dur)
  const treasureSpring = spring({
    frame: Math.max(0, frame - 75),
    fps,
    config: { damping: 10, stiffness: 140, mass: 0.6 },
  });
  const treasureOp = interpolate(frame, [75, 82, dur - 15, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <>
      {/* Golden glow from vault interior */}
      <div
        style={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.gold}40 0%, transparent 60%)`,
          opacity: goldGlowOp,
          filter: 'blur(30px)',
        }}
      />

      {/* Vault door — left half */}
      <div
        style={{
          position: 'absolute',
          top: '12%',
          left: '0%',
          width: '50%',
          bottom: '20%',
          backgroundColor: `${COLORS.gray}22`,
          border: `3px solid ${COLORS.gray}66`,
          borderRadius: '8px 0 0 8px',
          transform: `translateX(${doorLeftX}%)`,
          opacity: doorOp,
        }}
      >
        {/* Bolts */}
        {[20, 50, 80].map((y) => (
          <div key={`lb-${y}`} style={{ position: 'absolute', right: 12, top: `${y}%`, width: 16, height: 16, borderRadius: '50%', border: `2px solid ${COLORS.gray}`, opacity: 0.5 }} />
        ))}
      </div>

      {/* Vault door — right half */}
      <div
        style={{
          position: 'absolute',
          top: '12%',
          right: '0%',
          width: '50%',
          bottom: '20%',
          backgroundColor: `${COLORS.gray}22`,
          border: `3px solid ${COLORS.gray}66`,
          borderRadius: '0 8px 8px 0',
          transform: `translateX(${doorRightX}%)`,
          opacity: doorOp,
        }}
      >
        {[20, 50, 80].map((y) => (
          <div key={`rb-${y}`} style={{ position: 'absolute', left: 12, top: `${y}%`, width: 16, height: 16, borderRadius: '50%', border: `2px solid ${COLORS.gray}`, opacity: 0.5 }} />
        ))}
      </div>

      {/* Lock dial */}
      <div
        style={{
          position: 'absolute',
          top: '38%',
          left: '50%',
          transform: `translate(-50%, -50%) rotate(${dialAngle}deg)`,
          opacity: dialOp,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            border: `3px solid ${COLORS.gold}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: 2, height: 30, backgroundColor: COLORS.gold, transformOrigin: 'bottom' }} />
        </div>
      </div>

      {/* TOP SECRET */}
      {frame >= 48 && (
        <div
          style={{
            position: 'absolute',
            top: '25%',
            left: 0,
            right: 0,
            textAlign: 'center',
            transform: `scale(${interpolate(secretSpring, [0, 1], [0.3, 1])})`,
            opacity: secretOp,
          }}
        >
          <div style={{ border: `3px solid ${COLORS.gold}`, display: 'inline-block', padding: '8px 32px', borderRadius: 6 }}>
            <span style={{ fontSize: 42, fontFamily: FONTS.heading, fontWeight: 900, color: COLORS.gold, letterSpacing: 8 }}>
              TOP SECRET
            </span>
          </div>
        </div>
      )}

      {/* Treasure — topic */}
      <div
        style={{
          position: 'absolute',
          top: '48%',
          left: 0,
          right: 0,
          textAlign: 'center',
          transform: `scale(${interpolate(treasureSpring, [0, 1], [0.4, 1])})`,
          opacity: treasureOp,
        }}
      >
        <span style={{ fontSize: 44, fontFamily: FONTS.heading, fontWeight: 900, color: COLORS.textOnDark, textShadow: `0 0 30px ${COLORS.gold}40` }}>
          {hookText || topic}
        </span>
      </div>

      <TopicSlam topic={topic} frame={frame} fps={fps} startFrame={100} exitFrame={dur - 15} totalFrames={dur} />
      <BrandingReveal frame={frame} fps={fps} startFrame={108} />
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
 * STYLE 20: "THE SCOREBOARD"
 * Live match scoreboard → scores updating → "{topic}: 100%"
 * ═══════════════════════════════════════════════════════════════════════════════ */
const StyleScoreboard: React.FC<{
  topic: string;
  hookText: string;
  frame: number;
  fps: number;
  dur: number;
}> = ({ topic, hookText, frame, fps, dur }) => {
  // Phase 1: Scoreboard appears (0-50f)
  const boardSpring = spring({
    frame: Math.max(0, frame - 3),
    fps,
    config: { damping: 12, stiffness: 120, mass: 0.7 },
  });
  const boardOp = interpolate(frame, [3, 10, 55, 65], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // "LIVE" indicator blink
  const liveOn = Math.floor(frame / 10) % 2 === 0;

  // Scores ticking up
  const yourScore = Math.round(interpolate(frame, [10, 48], [0, 45], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  }));
  const topScore = Math.round(interpolate(frame, [10, 48], [0, 98], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  }));

  // "YOU'RE LOSING" warning
  const losingOp = interpolate(frame, [30, 36, 48, 55], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Phase 2: "LEVEL UP" (55-85f)
  const levelUpSpring = spring({
    frame: Math.max(0, frame - 55),
    fps,
    config: { damping: 7, stiffness: 200, mass: 0.4 },
  });
  const levelUpOp = interpolate(frame, [55, 60, 78, 85], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Final score
  const finalScore = Math.round(interpolate(frame, [60, 80], [45, 100], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  }));

  // Phase 3: Topic (82-dur)
  const topicOp = interpolate(frame, [82, 90, dur - 15, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <>
      {/* Scoreboard */}
      <div
        style={{
          position: 'absolute',
          top: '12%',
          left: '12%',
          right: '12%',
          transform: `scale(${interpolate(boardSpring, [0, 1], [0.8, 1])})`,
          opacity: boardOp,
        }}
      >
        {/* Header */}
        <div
          style={{
            background: `${COLORS.saffron}22`,
            borderRadius: '12px 12px 0 0',
            padding: '12px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            border: `1px solid ${COLORS.saffron}33`,
            borderBottom: 'none',
          }}
        >
          <span style={{ fontSize: 18, fontFamily: FONTS.heading, fontWeight: 800, color: COLORS.saffron, letterSpacing: 3 }}>
            INTERVIEW SCOREBOARD
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: COLORS.red, opacity: liveOn ? 1 : 0.3 }} />
            <span style={{ fontSize: 13, fontFamily: FONTS.text, fontWeight: 700, color: COLORS.red }}>LIVE</span>
          </div>
        </div>

        {/* Scores */}
        <div
          style={{
            background: `${COLORS.dark}`,
            borderRadius: '0 0 12px 12px',
            padding: '20px 24px',
            border: `1px solid ${COLORS.saffron}33`,
            borderTop: 'none',
          }}
        >
          {/* Your score */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 20, fontFamily: FONTS.text, fontWeight: 700, color: COLORS.gray }}>YOU</span>
            <div style={{ flex: 1, margin: '0 16px', height: 8, backgroundColor: `${COLORS.gray}22`, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${yourScore}%`, height: '100%', backgroundColor: COLORS.red, borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 24, fontFamily: FONTS.heading, fontWeight: 900, color: COLORS.red, width: 50, textAlign: 'right' }}>
              {yourScore}%
            </span>
          </div>
          {/* Top candidates */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 20, fontFamily: FONTS.text, fontWeight: 700, color: COLORS.gray }}>TOP 1%</span>
            <div style={{ flex: 1, margin: '0 16px', height: 8, backgroundColor: `${COLORS.gray}22`, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${topScore}%`, height: '100%', backgroundColor: COLORS.teal, borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 24, fontFamily: FONTS.heading, fontWeight: 900, color: COLORS.teal, width: 50, textAlign: 'right' }}>
              {topScore}%
            </span>
          </div>
        </div>
      </div>

      {/* "YOU'RE LOSING" */}
      <div style={{ position: 'absolute', top: '52%', left: 0, right: 0, textAlign: 'center', opacity: losingOp }}>
        <span style={{ fontSize: 36, fontFamily: FONTS.heading, fontWeight: 900, color: COLORS.red }}>
          {"YOU'RE FALLING BEHIND"}
        </span>
      </div>

      {/* LEVEL UP */}
      {frame >= 55 && (
        <div
          style={{
            position: 'absolute',
            top: '28%',
            left: 0,
            right: 0,
            textAlign: 'center',
            transform: `scale(${interpolate(levelUpSpring, [0, 1], [0.3, 1])})`,
            opacity: levelUpOp,
          }}
        >
          <span style={{ fontSize: 64, fontFamily: FONTS.heading, fontWeight: 900, color: COLORS.teal, letterSpacing: 6, textShadow: `0 0 40px ${COLORS.teal}60` }}>
            LEVEL UP
          </span>
          <div style={{ marginTop: 12 }}>
            <span style={{ fontSize: 48, fontFamily: FONTS.heading, fontWeight: 900, color: COLORS.gold }}>
              {finalScore}%
            </span>
          </div>
        </div>
      )}

      {/* Topic */}
      <div style={{ position: 'absolute', top: '58%', left: 0, right: 0, textAlign: 'center', opacity: topicOp }}>
        <span style={{ fontSize: 38, fontFamily: FONTS.heading, fontWeight: 900, color: COLORS.textOnDark }}>
          {hookText || topic}
        </span>
      </div>

      <TopicSlam topic={topic} frame={frame} fps={fps} startFrame={100} exitFrame={dur - 15} totalFrames={dur} />
      <BrandingReveal frame={frame} fps={fps} startFrame={108} />
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
 * MAIN COMPONENT — CinematicOpener
 * ═══════════════════════════════════════════════════════════════════════════════ */
/* ─────────────────────────────────────────────────────────────────────────────
 * Style 0: INSTANT HOOK — Educational opener (Fireship/Striver inspired)
 *
 *   0-15f  (0.5s): Topic name SLAMS in with spring
 *   15-45f (1.0s): Hook question fades in
 *   45-90f (1.5s): 3 bullet teasers appear one-by-one
 *   90+    (2.0s): Hold + smooth exit (handled by parent exitOp)
 * ───────────────────────────────────────────────────────────────────────────── */
const StyleInstantHook: React.FC<{
  topic: string;
  hookText: string;
  frame: number;
  fps: number;
  dur: number;
}> = ({ topic, hookText, frame, fps, dur }) => {
  // Extract 3 teaser bullets from hookText (split on ? or . or use fallback)
  const teasers = (() => {
    const parts = hookText.split(/[?.!]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 3) return parts.slice(0, 3);
    // Fallback teasers
    return [
      `What is ${topic}?`,
      `Real-world architecture`,
      `Interview-ready answer`,
    ];
  })();

  // Topic name slam (spring)
  const titleScale = spring({ frame, fps, from: 3, to: 1, durationInFrames: 15, config: { damping: 12, stiffness: 200 } });
  const titleOp = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });

  // Hook text fade
  const hookOp = interpolate(frame, [15, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const hookY = interpolate(frame, [15, 30], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Bullet stagger (each takes 12 frames to appear, starting at frame 45)
  const bulletOps = teasers.map((_, i) =>
    interpolate(frame, [45 + i * 12, 57 + i * 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  );
  const bulletYs = teasers.map((_, i) =>
    interpolate(frame, [45 + i * 12, 57 + i * 12], [15, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  );

  // Accent bar
  const barW = interpolate(frame, [0, 20], [0, 120], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 80px' }}>
      {/* Accent bar */}
      <div style={{ width: barW, height: 4, backgroundColor: COLORS.saffron, borderRadius: 2, marginBottom: 24 }} />

      {/* Topic name */}
      <div style={{
        fontFamily: FONTS.heading, fontSize: 72, fontWeight: 900, color: '#FFFFFF',
        textTransform: 'uppercase', letterSpacing: 3, textAlign: 'center',
        transform: `scale(${titleScale})`, opacity: titleOp,
      }}>
        {topic}
      </div>

      {/* Hook question */}
      <div style={{
        fontFamily: FONTS.text, fontSize: 36, color: COLORS.saffron, marginTop: 20,
        textAlign: 'center', opacity: hookOp, transform: `translateY(${hookY}px)`,
        fontWeight: 600, fontStyle: 'italic',
      }}>
        {hookText.split(/[?.!]/)[0]}?
      </div>

      {/* Bullet teasers */}
      <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {teasers.map((t, i) => (
          <div key={i} style={{
            fontFamily: FONTS.text, fontSize: 28, color: 'rgba(255,255,255,0.85)',
            opacity: bulletOps[i], transform: `translateY(${bulletYs[i]}px)`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ color: COLORS.saffron, fontSize: 20 }}>▸</span>
            {t}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

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
    <AbsoluteFill style={{ backgroundColor: '#0C0A15', overflow: 'hidden', opacity: exitOp }}>
      {/* Tech grid background — always present */}
      <TechGridBg frame={frame} accentColor={style === 2 ? COLORS.red : COLORS.saffron} />

      {/* SFX — impact on entry (LOUD for immediate attention grab) */}
      <Audio src={staticFile('audio/sfx/impact.wav')} volume={0.8} />

      {/* Cinematic corner brackets */}
      <CinematicFrame opacity={cornerOp} />

      {/* Style-specific content */}
      {style === 0 && <StyleInstantHook {...styleProps} />}
      {style === 1 && <StyleInterview {...styleProps} />}
      {style === 2 && <StyleCrisis {...styleProps} />}
      {style === 3 && <StyleMystery {...styleProps} />}
      {style === 4 && <StyleComparison {...styleProps} />}
      {style === 5 && <StyleJourney {...styleProps} />}
      {style === 6 && <StyleSalary {...styleProps} />}
      {style === 7 && <StyleHacker {...styleProps} />}
      {style === 8 && <StyleCountdown {...styleProps} />}
      {style === 9 && <StyleStackOverflow {...styleProps} />}
      {style === 10 && <StyleBattlefield {...styleProps} />}
      {style === 11 && <StyleTypingTest {...styleProps} />}
      {style === 12 && <StyleTimeline {...styleProps} />}
      {style === 13 && <StyleWhiteboard {...styleProps} />}
      {style === 14 && <StyleSpotlight {...styleProps} />}
      {style === 15 && <StyleHeartbeat {...styleProps} />}
      {style === 16 && <StyleBlueprint {...styleProps} />}
      {style === 17 && <StyleGlitch {...styleProps} />}
      {style === 18 && <StyleTelescope {...styleProps} />}
      {style === 19 && <StyleVault {...styleProps} />}
      {style === 20 && <StyleScoreboard {...styleProps} />}
    </AbsoluteFill>
  );
};

export default CinematicOpener;
