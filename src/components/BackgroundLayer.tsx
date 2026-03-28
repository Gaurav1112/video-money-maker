import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate } from 'remotion';
import { COLORS } from '../lib/theme';

interface BackgroundLayerProps {
  /** Current scene type for visual variety */
  sceneType?: string;
}

const BackgroundLayer: React.FC<BackgroundLayerProps> = ({ sceneType }) => {
  const frame = useCurrentFrame();

  // Slow rotating gradient
  const rotation = interpolate(frame, [0, 900], [0, 360], {
    extrapolateRight: 'extend',
  });

  // Secondary orb movement
  const orbX = interpolate(frame, [0, 600], [-15, 10], {
    extrapolateRight: 'extend',
  });
  const orbY = interpolate(frame, [0, 450], [60, 30], {
    extrapolateRight: 'extend',
  });

  // Scene-specific rendering
  switch (sceneType) {
    case 'title':
      return <TitleBackground frame={frame} rotation={rotation} />;
    case 'code':
      return <CodeBackground frame={frame} />;
    case 'text':
      return <TextBackground frame={frame} rotation={rotation} />;
    case 'table':
      return <TableBackground frame={frame} />;
    case 'interview':
      return <InterviewBackground frame={frame} />;
    case 'review':
      return <ReviewBackground frame={frame} />;
    case 'summary':
      return <SummaryBackground frame={frame} />;
    default:
      break;
  }

  // Default fallback
  const colors = {
    primary: COLORS.saffron,
    secondary: COLORS.indigo,
    bgTint: COLORS.dark,
    gridOpacity: '03',
    orbIntensity: '08',
  };

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bgTint }}>
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.primary}${colors.orbIntensity}, transparent 70%)`,
          top: '20%',
          right: '-10%',
          transform: `rotate(${rotation}deg)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.secondary}06, transparent 70%)`,
          bottom: `${((orbY % 100) + 100) % 100}%`,
          left: `${((orbX % 100) + 100) % 100}%`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${COLORS.white}${colors.gridOpacity} 1px, transparent 1px), linear-gradient(90deg, ${COLORS.white}${colors.gridOpacity} 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 50%, ${COLORS.dark}88 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// ============= TITLE: Deep space with stars and saffron glow =============
const TitleBackground: React.FC<{ frame: number; rotation: number }> = ({ frame, rotation }) => {
  const STAR_COUNT = 40;

  return (
    <AbsoluteFill style={{ backgroundColor: '#050311' }}>
      {/* Deep space gradient */}
      <div
        style={{
          position: 'absolute',
          inset: -200,
          background: `conic-gradient(from ${rotation}deg at 60% 40%, ${COLORS.saffron}06, ${COLORS.indigo}04, transparent, ${COLORS.saffron}06)`,
        }}
      />

      {/* Saffron nebula glow */}
      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '5%',
          width: 800,
          height: 500,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${COLORS.saffron}0C, transparent 70%)`,
          filter: 'blur(60px)',
        }}
      />

      {/* Secondary indigo nebula */}
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '10%',
          width: 600,
          height: 400,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${COLORS.indigo}08, transparent 70%)`,
          filter: 'blur(80px)',
        }}
      />

      {/* Star field */}
      {Array.from({ length: STAR_COUNT }).map((_, i) => {
        const seed = i * 137.508;
        const baseX = (seed * 7.31) % 100;
        const baseY = (seed * 3.97) % 100;
        const driftX = Math.sin(frame * 0.006 + i * 0.7) * 2;
        const driftY = Math.cos(frame * 0.004 + i * 1.1) * 1.5;
        const twinkle = interpolate(
          Math.sin(frame * 0.04 + i * 1.3),
          [-1, 1],
          [0.05, i < 10 ? 0.7 : 0.35],
        );
        const size = i < 6 ? 3 : i < 15 ? 2 : 1;
        const starColors = [COLORS.saffron, COLORS.gold, COLORS.white, COLORS.indigo, COLORS.teal];

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${baseX + driftX}%`,
              top: `${baseY + driftY}%`,
              width: size,
              height: size,
              borderRadius: '50%',
              backgroundColor: starColors[i % starColors.length],
              opacity: twinkle,
              boxShadow: i < 10 ? `0 0 ${size * 4}px ${starColors[i % starColors.length]}55` : 'none',
            }}
          />
        );
      })}

      {/* Deep vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 30%, #050311CC 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// ============= CODE: Dark IDE background with green terminal feel =============
const CodeBackground: React.FC<{ frame: number }> = ({ frame }) => {
  // Scanline effect
  const scanlineY = interpolate(frame, [0, 300], [0, 100], { extrapolateRight: 'extend' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0D1117' }}>
      {/* Terminal-green ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: '40%',
          left: '30%',
          width: 700,
          height: 400,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${COLORS.teal}06, transparent 70%)`,
          filter: 'blur(80px)',
        }}
      />

      {/* CRT-style grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${COLORS.teal}02 1px, transparent 1px)`,
          backgroundSize: '100% 4px',
        }}
      />

      {/* Subtle matrix-style code rain effect in background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${COLORS.teal}04 1px, transparent 1px), linear-gradient(90deg, ${COLORS.teal}02 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Scanning line */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${scanlineY % 100}%`,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${COLORS.teal}08, transparent)`,
        }}
      />

      {/* Bottom edge glow (like a monitor) */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 200,
          background: `linear-gradient(to top, ${COLORS.teal}04, transparent)`,
        }}
      />

      {/* Dark vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 40%, #0D1117AA 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// ============= TEXT: Subtle gradient with left accent and floating code snippets =============
const TextBackground: React.FC<{ frame: number; rotation: number }> = ({ frame, rotation }) => {
  // Floating faint code snippets
  const CODE_SNIPPETS = [
    'const data = await fetch(url);',
    'function optimize(arr) {',
    'return cache.get(key);',
    'if (node.left === null)',
    'while (queue.length > 0)',
    'export default handler;',
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: '#0C0A18' }}>
      {/* Gradient from dark to slightly lighter */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(135deg, #0C0A18 0%, #10102A 40%, #0C0A18 100%)`,
        }}
      />

      {/* Subtle indigo orb */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          right: '-5%',
          width: 500,
          height: 400,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${COLORS.indigo}06, transparent 70%)`,
          filter: 'blur(60px)',
        }}
      />

      {/* Floating code snippets — faint, in background */}
      {CODE_SNIPPETS.map((snippet, i) => {
        const baseY = 10 + i * 15;
        const driftY = Math.sin(frame * 0.01 + i * 2) * 5;
        const driftX = Math.cos(frame * 0.008 + i * 1.7) * 3;
        const opacity = interpolate(
          Math.sin(frame * 0.02 + i * 1.5),
          [-1, 1],
          [0.02, 0.06],
        );

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              right: `${5 + (i % 3) * 8 + driftX}%`,
              top: `${baseY + driftY}%`,
              fontSize: 14,
              fontFamily: 'JetBrains Mono, monospace',
              color: COLORS.indigo,
              opacity,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {snippet}
          </div>
        );
      })}

      {/* Subtle grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${COLORS.white}02 1px, transparent 1px), linear-gradient(90deg, ${COLORS.white}02 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />

      {/* Soft vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 50%, #0C0A1888 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// ============= TABLE: Clean structured grid feel =============
const TableBackground: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0A0D14' }}>
      {/* Structured grid — more visible than other scenes */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${COLORS.teal}05 1px, transparent 1px), linear-gradient(90deg, ${COLORS.teal}05 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Vertical accent lines */}
      {[20, 50, 80].map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${pos}%`,
            top: '5%',
            bottom: '5%',
            width: 1,
            background: `linear-gradient(180deg, transparent, ${COLORS.teal}08, transparent)`,
          }}
        />
      ))}

      {/* Subtle horizontal accent lines */}
      {[25, 50, 75].map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: `${pos}%`,
            left: '5%',
            right: '5%',
            height: 1,
            background: `linear-gradient(90deg, transparent, ${COLORS.teal}06, transparent)`,
          }}
        />
      ))}

      {/* Corner accents */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 50%, #0A0D14AA 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// ============= INTERVIEW: Warm golden glow, special border =============
const InterviewBackground: React.FC<{ frame: number }> = ({ frame }) => {
  const glowPulse = interpolate(
    Math.sin(frame * 0.03),
    [-1, 1],
    [0.3, 0.6],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#0F0C08' }}>
      {/* Warm golden radial glow */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '30%',
          width: 900,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${COLORS.gold}0A, ${COLORS.saffron}04, transparent 70%)`,
          opacity: glowPulse,
          filter: 'blur(60px)',
        }}
      />

      {/* Secondary warm tint bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 400,
          background: `linear-gradient(to top, ${COLORS.gold}04, transparent)`,
        }}
      />

      {/* Attention border — golden frame */}
      <div
        style={{
          position: 'absolute',
          inset: 30,
          border: `1px solid ${COLORS.gold}15`,
          borderRadius: 20,
          pointerEvents: 'none',
        }}
      />

      {/* Corner golden accents */}
      {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((corner) => {
        const isTop = corner.includes('top');
        const isLeft = corner.includes('left');
        return (
          <div
            key={corner}
            style={{
              position: 'absolute',
              [isTop ? 'top' : 'bottom']: 26,
              [isLeft ? 'left' : 'right']: 26,
              width: 20,
              height: 20,
              borderTop: isTop ? `2px solid ${COLORS.gold}44` : 'none',
              borderBottom: !isTop ? `2px solid ${COLORS.gold}44` : 'none',
              borderLeft: isLeft ? `2px solid ${COLORS.gold}44` : 'none',
              borderRight: !isLeft ? `2px solid ${COLORS.gold}44` : 'none',
              borderRadius: isTop && isLeft ? '8px 0 0 0' : isTop && !isLeft ? '0 8px 0 0' : !isTop && isLeft ? '0 0 0 8px' : '0 0 8px 0',
            }}
          />
        );
      })}

      {/* Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 40%, #0F0C08AA 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// ============= REVIEW: Quiz-show spotlight, dramatic =============
const ReviewBackground: React.FC<{ frame: number }> = ({ frame }) => {
  // Spotlight cone animation
  const spotlightSize = interpolate(
    Math.sin(frame * 0.02),
    [-1, 1],
    [300, 400],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#0C0610' }}>
      {/* Central spotlight cone */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          left: '50%',
          width: spotlightSize * 2,
          height: '140%',
          transform: 'translateX(-50%)',
          background: `conic-gradient(from 180deg at 50% 0%, transparent 40%, ${COLORS.saffron}06 48%, ${COLORS.saffron}0A 50%, ${COLORS.saffron}06 52%, transparent 60%)`,
        }}
      />

      {/* Radial spotlight on center */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          width: 800,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${COLORS.saffron}08, transparent 70%)`,
          transform: 'translateX(-50%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Subtle purple ambient */}
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '10%',
          width: 400,
          height: 300,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${COLORS.indigo}06, transparent 70%)`,
          filter: 'blur(50px)',
        }}
      />

      {/* Dark vignette for drama */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 50% 40%, transparent 25%, #0C0610CC 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// ============= SUMMARY: Celebration — bright accents, achievement feel =============
const SummaryBackground: React.FC<{ frame: number }> = ({ frame }) => {
  const celebrationGlow = interpolate(
    Math.sin(frame * 0.04),
    [-1, 1],
    [0.3, 0.7],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#0A0D10' }}>
      {/* Golden celebration glow */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: '40%',
          width: 800,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${COLORS.gold}0A, ${COLORS.teal}05, transparent 70%)`,
          opacity: celebrationGlow,
          filter: 'blur(60px)',
        }}
      />

      {/* Teal accent bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 300,
          background: `linear-gradient(to top, ${COLORS.teal}04, transparent)`,
        }}
      />

      {/* Achievement ring at center */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 500,
          height: 500,
          borderRadius: '50%',
          border: `1px solid ${COLORS.gold}08`,
          transform: 'translate(-50%, -50%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 700,
          height: 700,
          borderRadius: '50%',
          border: `1px solid ${COLORS.teal}05`,
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* Subtle grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${COLORS.white}02 1px, transparent 1px), linear-gradient(90deg, ${COLORS.white}02 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />

      {/* Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 40%, #0A0D10AA 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

export default BackgroundLayer;
