import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate } from 'remotion';
import { COLORS } from '../lib/theme';

interface BackgroundLayerProps {
  /** Current scene type for visual variety */
  sceneType?: string;
}

// ============= SHARED: Animated dot grid (tech/engineering feel) =============
const AnimatedDotGrid: React.FC<{ frame: number; spacing?: number; dotOpacity?: number }> = ({
  frame,
  spacing = 40,
  dotOpacity = 0.03,
}) => {
  // Slow drift — the grid subtly scrolls over time
  const driftX = frame * 0.08;
  const driftY = frame * 0.05;

  return (
    <div
      style={{
        position: 'absolute',
        inset: -spacing, // overflow to avoid gaps during drift
        backgroundImage: `radial-gradient(circle, rgba(255,255,255,${dotOpacity}) 1px, transparent 1px)`,
        backgroundSize: `${spacing}px ${spacing}px`,
        backgroundPosition: `${driftX % spacing}px ${driftY % spacing}px`,
        pointerEvents: 'none',
      }}
    />
  );
};

// ============= SHARED: Floating code keywords (ultra-subtle atmosphere) =============
const CODE_KEYWORDS = [
  'async', 'await', 'function', 'class', 'return', 'import', 'const',
  'O(n)', '\u2192', '{ }', '[ ]', '< >', 'export', 'interface', 'void',
  'yield', 'Promise', 'new',
];

const FloatingCodeKeywords: React.FC<{
  frame: number;
  count?: number;
  color?: string;
  baseOpacity?: number;
}> = ({ frame, count = 18, color = COLORS.white, baseOpacity = 0.04 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const seed = i * 197.327;
        const word = CODE_KEYWORDS[i % CODE_KEYWORDS.length];
        // Stagger horizontal positions across the frame
        const baseX = (seed * 4.91) % 92 + 3;
        const baseY = (seed * 3.17) % 85 + 5;
        // Each word drifts horizontally at a different speed
        const speed = 0.015 + (i % 5) * 0.008;
        const driftX = ((frame * speed + seed) % 120) - 10; // wraps across screen
        // Slight vertical sine wave
        const driftY = Math.sin(frame * 0.008 + i * 1.6) * 8;
        const opacity = interpolate(
          Math.sin(frame * 0.012 + i * 2.3),
          [-1, 1],
          [baseOpacity * 0.3, baseOpacity],
        );

        return (
          <div
            key={`kw-${i}`}
            style={{
              position: 'absolute',
              left: `${(baseX + driftX) % 100}%`,
              top: `${baseY + driftY}%`,
              fontSize: 14,
              fontFamily: 'JetBrains Mono, monospace',
              color,
              opacity,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              userSelect: 'none',
              letterSpacing: 1,
            }}
          >
            {word}
          </div>
        );
      })}
    </>
  );
};

// ============= SHARED: Ambient glow orbs (atmospheric depth) =============
interface GlowOrbConfig {
  color: string;
  opacity: number;
  size: number;
  blur: number;
  baseX: number;
  baseY: number;
  speedX: number;
  speedY: number;
  phaseOffset: number;
}

const DEFAULT_GLOW_ORBS: GlowOrbConfig[] = [
  { color: COLORS.saffron, opacity: 0.05, size: 350, blur: 100, baseX: 20, baseY: 30, speedX: 0.002, speedY: 0.0015, phaseOffset: 0 },
  { color: COLORS.teal, opacity: 0.04, size: 300, blur: 100, baseX: 75, baseY: 60, speedX: 0.0018, speedY: 0.002, phaseOffset: 1.5 },
  { color: COLORS.indigo, opacity: 0.04, size: 280, blur: 100, baseX: 55, baseY: 20, speedX: 0.0022, speedY: 0.0012, phaseOffset: 3.0 },
  { color: '#FFD700', opacity: 0.03, size: 250, blur: 100, baseX: 40, baseY: 80, speedX: 0.0015, speedY: 0.0025, phaseOffset: 4.5 },
];

const AmbientGlowOrbs: React.FC<{
  frame: number;
  orbs?: GlowOrbConfig[];
  intensityMultiplier?: number;
}> = ({ frame, orbs = DEFAULT_GLOW_ORBS, intensityMultiplier = 1.0 }) => {
  return (
    <>
      {orbs.map((orb, i) => {
        const x = orb.baseX + Math.sin(frame * orb.speedX + orb.phaseOffset) * 12;
        const y = orb.baseY + Math.cos(frame * orb.speedY + orb.phaseOffset) * 10;
        // Slow pulse
        const pulse = interpolate(
          Math.sin(frame * 0.015 + orb.phaseOffset),
          [-1, 1],
          [orb.opacity * 0.5 * intensityMultiplier, orb.opacity * intensityMultiplier],
        );

        return (
          <div
            key={`orb-${i}`}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: orb.size,
              height: orb.size,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${orb.color}, transparent 70%)`,
              opacity: pulse,
              filter: `blur(${orb.blur}px)`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }}
          />
        );
      })}
    </>
  );
};

// ============= SHARED: Scene-aware color shift overlay =============
const SCENE_COLOR_SHIFTS: Record<string, { color: string; opacity: number }> = {
  title:      { color: COLORS.saffron, opacity: 0.03 },
  hook:       { color: COLORS.saffron, opacity: 0.03 },
  code:       { color: COLORS.indigo,  opacity: 0.04 },
  text:       { color: COLORS.indigo,  opacity: 0.02 },
  concept:    { color: COLORS.indigo,  opacity: 0.02 },
  table:      { color: COLORS.gold,    opacity: 0.02 },
  comparison: { color: COLORS.gold,    opacity: 0.02 },
  interview:  { color: '#FFD700',      opacity: 0.035 },
  diagram:    { color: COLORS.indigo,  opacity: 0.03 },
  review:     { color: COLORS.teal,    opacity: 0.03 },
  quiz:       { color: COLORS.teal,    opacity: 0.03 },
  summary:    { color: COLORS.teal,    opacity: 0.02 },
  problem:    { color: COLORS.red,     opacity: 0.03 },
  solution:   { color: COLORS.teal,    opacity: 0.035 },
};

const SceneColorShift: React.FC<{ frame: number; sceneType: string }> = ({ frame, sceneType }) => {
  const shift = SCENE_COLOR_SHIFTS[sceneType] || { color: COLORS.indigo, opacity: 0.02 };
  // Subtle breathing pulse on the color shift
  const breathe = interpolate(
    Math.sin(frame * 0.01),
    [-1, 1],
    [shift.opacity * 0.5, shift.opacity],
  );

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse at 50% 45%, ${shift.color}, transparent 75%)`,
        opacity: breathe,
        pointerEvents: 'none',
      }}
    />
  );
};

// ============= SHARED: Cinematic vignette =============
const CinematicVignette: React.FC<{
  color?: string;
  intensity?: number;
  innerStop?: number;
}> = ({ color = 'rgba(0,0,0,0.4)', intensity = 1.0, innerStop = 50 }) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse at center, transparent ${innerStop}%, ${color} 100%)`,
        opacity: intensity,
        pointerEvents: 'none',
      }}
    />
  );
};

// ============= SHARED: Floating ambient particles =============
const AmbientParticles: React.FC<{ frame: number; color: string; count?: number }> = ({
  frame,
  color,
  count = 18,
}) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const seed = i * 137.508;
        const baseX = (seed * 6.13) % 100;
        const baseY = (seed * 4.27) % 100;
        const driftX = Math.sin(frame * 0.007 + i * 0.9) * 4;
        const driftY = Math.cos(frame * 0.005 + i * 1.3) * 3;
        const opacity = interpolate(
          Math.sin(frame * 0.025 + i * 1.7),
          [-1, 1],
          [0.0, i < 5 ? 0.18 : 0.08],
        );
        const size = i < 3 ? 3 : i < 8 ? 2 : 1.5;

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
              backgroundColor: color,
              opacity,
              boxShadow: i < 5 ? `0 0 ${size * 3}px ${color}55` : 'none',
              pointerEvents: 'none',
            }}
          />
        );
      })}
    </>
  );
};

// ============= SHARED: Floating code symbols =============
const CODE_SYMBOLS = ['<', '>', '{', '}', ';', '=>', '/>', '()', '[]', '&&', '||', '!=', '++', '::'];

const SCENE_SYMBOL_COLORS: Record<string, string> = {
  title: COLORS.saffron,
  hook: COLORS.saffron,
  code: COLORS.teal,
  text: COLORS.indigo,
  concept: COLORS.indigo,
  table: COLORS.gold,
  comparison: COLORS.gold,
  interview: COLORS.saffron,
  diagram: COLORS.indigo,
  review: COLORS.teal,
  quiz: COLORS.teal,
  summary: COLORS.gold,
};

/** Intensity multiplier per scene type: 0.0-1.0 */
const SCENE_INTENSITY: Record<string, number> = {
  title: 0.6,
  hook: 0.8,
  code: 1.0,
  text: 0.5,
  concept: 0.5,
  table: 0.4,
  comparison: 0.4,
  interview: 0.7,
  diagram: 0.6,
  review: 0.8,
  quiz: 0.8,
  summary: 0.3,
};

const FloatingCodeSymbols: React.FC<{
  frame: number;
  sceneType?: string;
  count?: number;
}> = ({ frame, sceneType = 'text', count = 10 }) => {
  const color = SCENE_SYMBOL_COLORS[sceneType] || COLORS.indigo;
  const intensity = SCENE_INTENSITY[sceneType] ?? 0.5;
  const symbolCount = Math.round(count * intensity);

  return (
    <>
      {Array.from({ length: symbolCount }).map((_, i) => {
        const seed = i * 173.205; // different seed from particles
        const symbol = CODE_SYMBOLS[(i * 3 + Math.floor(seed)) % CODE_SYMBOLS.length];
        const baseX = (seed * 5.71) % 95 + 2;
        const baseY = (seed * 3.83) % 90 + 5;
        // Very slow drift
        const driftX = Math.sin(frame * 0.003 + i * 1.4) * 6;
        const driftY = Math.cos(frame * 0.002 + i * 0.8) * 4;
        // Slow rotation
        const rotation = Math.sin(frame * 0.004 + i * 2.1) * 15;
        const opacity = interpolate(
          Math.sin(frame * 0.015 + i * 1.9),
          [-1, 1],
          [0.02, 0.06 * intensity],
        );

        return (
          <div
            key={`sym-${i}`}
            style={{
              position: 'absolute',
              left: `${baseX + driftX}%`,
              top: `${baseY + driftY}%`,
              fontSize: 14 + (i % 4) * 3,
              fontFamily: 'JetBrains Mono, monospace',
              color,
              opacity,
              transform: `rotate(${rotation}deg)`,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {symbol}
          </div>
        );
      })}
    </>
  );
};

// ============= SHARED: Accent radial glow overlay =============
const AccentGlow: React.FC<{
  frame: number;
  color: string;
  x?: string;
  y?: string;
  width?: number;
  height?: number;
  minOpacity?: number;
  maxOpacity?: number;
  blur?: number;
}> = ({
  frame,
  color,
  x = '50%',
  y = '40%',
  width = 800,
  height = 600,
  minOpacity = 0.04,
  maxOpacity = 0.10,
  blur = 80,
}) => {
  const glowOpacity = interpolate(
    Math.sin(frame * 0.025),
    [-1, 1],
    [minOpacity, maxOpacity],
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        left: x,
        width,
        height,
        borderRadius: '50%',
        background: `radial-gradient(ellipse, ${color}, transparent 70%)`,
        opacity: glowOpacity,
        filter: `blur(${blur}px)`,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }}
    />
  );
};

// ============= SHARED: Cinematic atmosphere layer (combines all new effects) =============
/** Renders the dot grid, floating keywords, glow orbs, scene color shift, and vignette.
 *  Layered BEHIND all existing scene-specific elements. */
const CinematicAtmosphere: React.FC<{
  frame: number;
  sceneType: string;
  /** Override vignette darkness per scene */
  vignetteColor?: string;
  vignetteInnerStop?: number;
  /** Dim orbs/keywords for scenes that already have heavy decoration */
  subtlety?: number;
}> = ({
  frame,
  sceneType,
  vignetteColor = 'rgba(0,0,0,0.4)',
  vignetteInnerStop = 50,
  subtlety = 1.0,
}) => {
  return (
    <>
      {/* 1. Animated dot grid */}
      <AnimatedDotGrid frame={frame} spacing={40} dotOpacity={0.03} />

      {/* 2. Floating code keywords */}
      <FloatingCodeKeywords
        frame={frame}
        count={18}
        baseOpacity={0.04 * subtlety}
      />

      {/* 3. Ambient glow orbs */}
      <AmbientGlowOrbs frame={frame} intensityMultiplier={subtlety} />

      {/* 4. Scene-aware color shift */}
      <SceneColorShift frame={frame} sceneType={sceneType} />

      {/* 5. Cinematic vignette (rendered last so it sits on top) */}
      <CinematicVignette
        color={vignetteColor}
        innerStop={vignetteInnerStop}
      />
    </>
  );
};

/** Scene-specific warm background colors — subtle variation per scene type */
const SCENE_BG_COLORS: Record<string, string> = {
  title:      '#0E0804',
  hook:       '#0E0804',
  code:       '#070F0D',
  text:       '#0A0A1C',
  concept:    '#0A0A1C',
  table:      '#0C0D0A',
  comparison: '#0C0D0A',
  interview:  '#110906',
  diagram:    '#080A12',
  review:     '#070E0D',
  quiz:       '#070E0D',
  summary:    '#0C0D0A',
};

const BackgroundLayer: React.FC<BackgroundLayerProps> = ({ sceneType = 'text' }) => {
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
    case 'hook':
      return <TitleBackground frame={frame} rotation={rotation} sceneType={sceneType} />;
    case 'code':
      return <CodeBackground frame={frame} sceneType={sceneType} />;
    case 'text':
    case 'concept':
      return <TextBackground frame={frame} rotation={rotation} sceneType={sceneType} />;
    case 'table':
    case 'comparison':
      return <TableBackground frame={frame} sceneType={sceneType} />;
    case 'interview':
      return <InterviewBackground frame={frame} sceneType={sceneType} />;
    case 'diagram':
      return <DiagramBackground frame={frame} rotation={rotation} sceneType={sceneType} />;
    case 'review':
    case 'quiz':
      return <ReviewBackground frame={frame} sceneType={sceneType} />;
    case 'summary':
      return <SummaryBackground frame={frame} sceneType={sceneType} />;
    default:
      break;
  }

  // Default fallback — uses warm background
  const colors = {
    primary: COLORS.saffron,
    secondary: COLORS.indigo,
    bgTint: SCENE_BG_COLORS[sceneType] || COLORS.warmBg,
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
      {/* Floating code symbols */}
      <FloatingCodeSymbols frame={frame} sceneType={sceneType} />
      {/* Cinematic atmosphere */}
      <CinematicAtmosphere frame={frame} sceneType={sceneType} />
    </AbsoluteFill>
  );
};

// ============= HOOK / TITLE: Saffron (#E85D26) warm glow — exciting energy =============
const TitleBackground: React.FC<{ frame: number; rotation: number; sceneType: string }> = ({ frame, rotation, sceneType }) => {
  const STAR_COUNT = 40;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0E0804' }}>
      {/* Deep warm space gradient */}
      <div
        style={{
          position: 'absolute',
          inset: -200,
          background: `conic-gradient(from ${rotation}deg at 60% 40%, ${COLORS.saffron}08, ${COLORS.gold}04, transparent, ${COLORS.saffron}06)`,
        }}
      />

      {/* PRIMARY: Saffron nebula glow — top-left anchor */}
      <AccentGlow
        frame={frame}
        color={`${COLORS.saffron}18`}
        x="15%"
        y="25%"
        width={900}
        height={600}
        minOpacity={0.55}
        maxOpacity={1.0}
        blur={70}
      />

      {/* SECONDARY: Warm gold hint */}
      <AccentGlow
        frame={frame}
        color={`${COLORS.gold}10`}
        x="75%"
        y="70%"
        width={500}
        height={400}
        minOpacity={0.3}
        maxOpacity={0.7}
        blur={90}
      />

      {/* Animated star field */}
      {Array.from({ length: STAR_COUNT }).map((_, i) => {
        const seed = i * 137.508;
        const baseX = (seed * 7.31) % 100;
        const baseY = (seed * 3.97) % 100;
        const driftX = Math.sin(frame * 0.006 + i * 0.7) * 2;
        const driftY = Math.cos(frame * 0.004 + i * 1.1) * 1.5;
        const twinkle = interpolate(
          Math.sin(frame * 0.04 + i * 1.3),
          [-1, 1],
          [0.05, i < 10 ? 0.75 : 0.4],
        );
        const size = i < 6 ? 3 : i < 15 ? 2 : 1;
        // Warm star colors — saffron-biased
        const starColors = [COLORS.saffron, COLORS.gold, COLORS.white, COLORS.saffron, COLORS.gold];

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
              boxShadow: i < 10 ? `0 0 ${size * 4}px ${starColors[i % starColors.length]}66` : 'none',
            }}
          />
        );
      })}

      {/* Ambient particles in saffron */}
      <AmbientParticles frame={frame} color={COLORS.saffron} count={12} />

      {/* Bottom warm edge glow */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 250,
          background: `linear-gradient(to top, ${COLORS.saffron}07, transparent)`,
        }}
      />

      {/* Floating code symbols */}
      <FloatingCodeSymbols frame={frame} sceneType="title" count={8} />

      {/* Cinematic atmosphere — slightly reduced subtlety for title's existing richness */}
      <CinematicAtmosphere
        frame={frame}
        sceneType={sceneType}
        vignetteColor="#0E0804CC"
        vignetteInnerStop={30}
        subtlety={0.7}
      />
    </AbsoluteFill>
  );
};

// ============= TEXT / CONCEPT: Indigo (#818CF8) cool — learning mode =============
const TextBackground: React.FC<{ frame: number; rotation: number; sceneType: string }> = ({ frame, rotation, sceneType }) => {
  const CODE_SNIPPETS = [
    'const data = await fetch(url);',
    'function optimize(arr) {',
    'return cache.get(key);',
    'if (node.left === null)',
    'while (queue.length > 0)',
    'export default handler;',
  ];

  // Slowly drifting gradient angle
  const gradientShift = interpolate(frame, [0, 600], [135, 160], { extrapolateRight: 'extend' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#080A1C' }}>
      {/* Moving gradient background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(${gradientShift}deg, #080A1C 0%, #0F1030 45%, #080A1C 100%)`,
        }}
      />

      {/* PRIMARY: Indigo radial glow */}
      <AccentGlow
        frame={frame}
        color={`${COLORS.indigo}20`}
        x="65%"
        y="20%"
        width={700}
        height={500}
        minOpacity={0.45}
        maxOpacity={0.95}
        blur={80}
      />

      {/* SECONDARY: Deeper indigo bottom */}
      <AccentGlow
        frame={frame}
        color={`${COLORS.indigo}10`}
        x="25%"
        y="75%"
        width={500}
        height={400}
        minOpacity={0.25}
        maxOpacity={0.55}
        blur={100}
      />

      {/* Floating faint code snippets */}
      {CODE_SNIPPETS.map((snippet, i) => {
        const baseY = 10 + i * 15;
        const driftY = Math.sin(frame * 0.01 + i * 2) * 5;
        const driftX = Math.cos(frame * 0.008 + i * 1.7) * 3;
        const opacity = interpolate(
          Math.sin(frame * 0.02 + i * 1.5),
          [-1, 1],
          [0.02, 0.07],
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

      {/* Ambient particles — indigo */}
      <AmbientParticles frame={frame} color={COLORS.indigo} count={16} />

      {/* Subtle grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${COLORS.white}02 1px, transparent 1px), linear-gradient(90deg, ${COLORS.white}02 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />

      {/* Blueprint left accent line */}
      <div
        style={{
          position: 'absolute',
          left: '8%',
          top: '5%',
          bottom: '5%',
          width: 1,
          background: `linear-gradient(180deg, transparent, ${COLORS.indigo}18, transparent)`,
        }}
      />

      {/* Floating code symbols */}
      <FloatingCodeSymbols frame={frame} sceneType="text" count={10} />

      {/* Cinematic atmosphere */}
      <CinematicAtmosphere
        frame={frame}
        sceneType={sceneType}
        vignetteColor="#080A1C88"
        vignetteInnerStop={50}
        subtlety={0.9}
      />
    </AbsoluteFill>
  );
};

// ============= CODE: Teal (#20C997) tech / terminal feel =============
const CodeBackground: React.FC<{ frame: number; sceneType: string }> = ({ frame, sceneType }) => {
  const scanlineY = interpolate(frame, [0, 300], [0, 100], { extrapolateRight: 'extend' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#050F0C' }}>
      {/* PRIMARY: Teal ambient glow — center */}
      <AccentGlow
        frame={frame}
        color={`${COLORS.teal}18`}
        x="50%"
        y="45%"
        width={800}
        height={500}
        minOpacity={0.4}
        maxOpacity={0.9}
        blur={90}
      />

      {/* SECONDARY: Teal edge glow — top right */}
      <AccentGlow
        frame={frame}
        color={`${COLORS.teal}10`}
        x="80%"
        y="15%"
        width={400}
        height={350}
        minOpacity={0.2}
        maxOpacity={0.5}
        blur={70}
      />

      {/* CRT scanline grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${COLORS.teal}02 1px, transparent 1px)`,
          backgroundSize: '100% 4px',
        }}
      />

      {/* Matrix-style code grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${COLORS.teal}04 1px, transparent 1px), linear-gradient(90deg, ${COLORS.teal}03 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Animated scanning line */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${scanlineY % 100}%`,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${COLORS.teal}12, transparent)`,
        }}
      />

      {/* Ambient particles — teal */}
      <AmbientParticles frame={frame} color={COLORS.teal} count={14} />

      {/* Bottom terminal glow */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 200,
          background: `linear-gradient(to top, ${COLORS.teal}06, transparent)`,
        }}
      />

      {/* Floating code symbols — higher density for code scenes */}
      <FloatingCodeSymbols frame={frame} sceneType="code" count={14} />

      {/* Cinematic atmosphere — blue/indigo shifted for code */}
      <CinematicAtmosphere
        frame={frame}
        sceneType={sceneType}
        vignetteColor="#050F0CAA"
        vignetteInnerStop={40}
        subtlety={0.8}
      />
    </AbsoluteFill>
  );
};

// ============= TABLE / COMPARISON: Gold (#FFD700) — analysis mode =============
const TableBackground: React.FC<{ frame: number; sceneType: string }> = ({ frame, sceneType }) => {
  // Slowly pulsing column highlights
  const columnPulse = interpolate(Math.sin(frame * 0.02), [-1, 1], [0.04, 0.09]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0A0C08' }}>
      {/* PRIMARY: Gold radial glow — top center */}
      <AccentGlow
        frame={frame}
        color={`${COLORS.gold}18`}
        x="50%"
        y="20%"
        width={900}
        height={500}
        minOpacity={0.35}
        maxOpacity={0.8}
        blur={100}
      />

      {/* SECONDARY: Gold warm bottom */}
      <AccentGlow
        frame={frame}
        color={`${COLORS.gold}0C`}
        x="50%"
        y="85%"
        width={700}
        height={350}
        minOpacity={0.2}
        maxOpacity={0.5}
        blur={80}
      />

      {/* Structured gold-tinted grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${COLORS.gold}04 1px, transparent 1px), linear-gradient(90deg, ${COLORS.gold}04 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Vertical accent column dividers */}
      {[20, 50, 80].map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${pos}%`,
            top: '5%',
            bottom: '5%',
            width: 1,
            background: `linear-gradient(180deg, transparent, ${COLORS.gold}${Math.round(columnPulse * 255).toString(16).padStart(2, '0')}, transparent)`,
          }}
        />
      ))}

      {/* Horizontal row dividers */}
      {[25, 50, 75].map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: `${pos}%`,
            left: '5%',
            right: '5%',
            height: 1,
            background: `linear-gradient(90deg, transparent, ${COLORS.gold}08, transparent)`,
          }}
        />
      ))}

      {/* Ambient particles — gold */}
      <AmbientParticles frame={frame} color={COLORS.gold} count={12} />

      {/* Floating code symbols */}
      <FloatingCodeSymbols frame={frame} sceneType="table" count={8} />

      {/* Cinematic atmosphere */}
      <CinematicAtmosphere
        frame={frame}
        sceneType={sceneType}
        vignetteColor="#0A0C08AA"
        vignetteInnerStop={50}
        subtlety={0.85}
      />
    </AbsoluteFill>
  );
};

// ============= INTERVIEW: Saffron (#E85D26) — interview intensity =============
const InterviewBackground: React.FC<{ frame: number; sceneType: string }> = ({ frame, sceneType }) => {
  const glowPulse = interpolate(Math.sin(frame * 0.03), [-1, 1], [0.45, 0.85]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0F0804' }}>
      {/* PRIMARY: Saffron warm radial glow — center stage */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '30%',
          width: 900,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${COLORS.saffron}15, ${COLORS.gold}06, transparent 70%)`,
          opacity: glowPulse,
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      {/* SECONDARY: Warm tint layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 50% 40%, ${COLORS.saffron}05 0%, transparent 65%)`,
        }}
      />

      {/* Warm bottom edge */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 350,
          background: `linear-gradient(to top, ${COLORS.saffron}06, transparent)`,
        }}
      />

      {/* Intensity border — saffron frame */}
      <div
        style={{
          position: 'absolute',
          inset: 30,
          border: `1px solid ${COLORS.saffron}18`,
          borderRadius: 20,
          pointerEvents: 'none',
        }}
      />

      {/* Corner accent brackets */}
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
              width: 22,
              height: 22,
              borderTop: isTop ? `2px solid ${COLORS.saffron}55` : 'none',
              borderBottom: !isTop ? `2px solid ${COLORS.saffron}55` : 'none',
              borderLeft: isLeft ? `2px solid ${COLORS.saffron}55` : 'none',
              borderRight: !isLeft ? `2px solid ${COLORS.saffron}55` : 'none',
              borderRadius:
                isTop && isLeft
                  ? '8px 0 0 0'
                  : isTop && !isLeft
                  ? '0 8px 0 0'
                  : !isTop && isLeft
                  ? '0 0 0 8px'
                  : '0 0 8px 0',
            }}
          />
        );
      })}

      {/* Ambient particles — saffron */}
      <AmbientParticles frame={frame} color={COLORS.saffron} count={10} />

      {/* Floating code symbols */}
      <FloatingCodeSymbols frame={frame} sceneType="interview" count={10} />

      {/* Cinematic atmosphere — gold-shifted for interview */}
      <CinematicAtmosphere
        frame={frame}
        sceneType={sceneType}
        vignetteColor="#0F0804AA"
        vignetteInnerStop={40}
        subtlety={0.75}
      />
    </AbsoluteFill>
  );
};

// ============= DIAGRAM: Indigo (#818CF8) — blueprint feel =============
const DiagramBackground: React.FC<{ frame: number; rotation: number; sceneType: string }> = ({ frame, rotation, sceneType }) => {
  // Blueprint grid drift
  const gridOffset = interpolate(frame, [0, 600], [0, 20], { extrapolateRight: 'extend' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#060810' }}>
      {/* Moving gradient — slow drift */}
      <div
        style={{
          position: 'absolute',
          inset: -200,
          background: `conic-gradient(from ${rotation * 0.4}deg at 40% 50%, ${COLORS.indigo}05, transparent, ${COLORS.indigo}04, transparent)`,
        }}
      />

      {/* PRIMARY: Indigo radial glow — blueprint light source */}
      <AccentGlow
        frame={frame}
        color={`${COLORS.indigo}1C`}
        x="50%"
        y="45%"
        width={850}
        height={600}
        minOpacity={0.4}
        maxOpacity={0.9}
        blur={90}
      />

      {/* Blueprint-style fine grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${COLORS.indigo}04 1px, transparent 1px), linear-gradient(90deg, ${COLORS.indigo}04 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          backgroundPosition: `${gridOffset}px ${gridOffset * 0.5}px`,
        }}
      />

      {/* Coarse blueprint overlay grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${COLORS.indigo}07 1px, transparent 1px), linear-gradient(90deg, ${COLORS.indigo}07 1px, transparent 1px)`,
          backgroundSize: '200px 200px',
          backgroundPosition: `${gridOffset}px ${gridOffset * 0.5}px`,
        }}
      />

      {/* Cross-hair center marker */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${COLORS.indigo}08, transparent)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          bottom: 0,
          width: 1,
          background: `linear-gradient(180deg, transparent, ${COLORS.indigo}08, transparent)`,
        }}
      />

      {/* Ambient particles — indigo */}
      <AmbientParticles frame={frame} color={COLORS.indigo} count={14} />

      {/* Floating code symbols */}
      <FloatingCodeSymbols frame={frame} sceneType="diagram" count={10} />

      {/* Cinematic atmosphere */}
      <CinematicAtmosphere
        frame={frame}
        sceneType={sceneType}
        vignetteColor="#060810AA"
        vignetteInnerStop={40}
        subtlety={0.85}
      />
    </AbsoluteFill>
  );
};

// ============= REVIEW / QUIZ: Teal (#20C997) — challenge mode =============
const ReviewBackground: React.FC<{ frame: number; sceneType: string }> = ({ frame, sceneType }) => {
  const spotlightSize = interpolate(Math.sin(frame * 0.02), [-1, 1], [300, 420]);
  // Teal intensity pulse for challenge feel
  const challengePulse = interpolate(Math.sin(frame * 0.035), [-1, 1], [0.35, 0.75]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#050E0C' }}>
      {/* PRIMARY: Teal spotlight cone from top */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          left: '50%',
          width: spotlightSize * 2,
          height: '140%',
          transform: 'translateX(-50%)',
          background: `conic-gradient(from 180deg at 50% 0%, transparent 40%, ${COLORS.teal}07 48%, ${COLORS.teal}0C 50%, ${COLORS.teal}07 52%, transparent 60%)`,
        }}
      />

      {/* Teal radial on center stage */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          width: 800,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${COLORS.teal}10, transparent 70%)`,
          transform: 'translateX(-50%)',
          filter: 'blur(50px)',
          opacity: challengePulse,
          pointerEvents: 'none',
        }}
      />

      {/* SECONDARY: Indigo ambient depth */}
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

      {/* Subtle teal grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${COLORS.teal}02 1px, transparent 1px), linear-gradient(90deg, ${COLORS.teal}02 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Ambient particles — teal */}
      <AmbientParticles frame={frame} color={COLORS.teal} count={16} />

      {/* Floating code symbols */}
      <FloatingCodeSymbols frame={frame} sceneType="review" count={12} />

      {/* Cinematic atmosphere — green/teal shifted */}
      <CinematicAtmosphere
        frame={frame}
        sceneType={sceneType}
        vignetteColor="#050E0CCC"
        vignetteInnerStop={25}
        subtlety={0.8}
      />
    </AbsoluteFill>
  );
};

// ============= SUMMARY: Gold (#FFD700) — celebration / achievement feel =============
const SummaryBackground: React.FC<{ frame: number; sceneType: string }> = ({ frame, sceneType }) => {
  const celebrationGlow = interpolate(Math.sin(frame * 0.04), [-1, 1], [0.35, 0.8]);
  // Expanding ring pulse
  const ringScale = interpolate(Math.sin(frame * 0.02), [-1, 1], [0.95, 1.05]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0A0C08' }}>
      {/* PRIMARY: Gold celebration glow */}
      <div
        style={{
          position: 'absolute',
          top: '5%',
          left: '35%',
          width: 900,
          height: 650,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${COLORS.gold}0F, ${COLORS.teal}05, transparent 70%)`,
          opacity: celebrationGlow,
          filter: 'blur(70px)',
          pointerEvents: 'none',
        }}
      />

      {/* SECONDARY: Teal accent bottom edge */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 300,
          background: `linear-gradient(to top, ${COLORS.teal}05, transparent)`,
        }}
      />

      {/* Achievement rings — gold, pulsing */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 500,
          height: 500,
          borderRadius: '50%',
          border: `1px solid ${COLORS.gold}10`,
          transform: `translate(-50%, -50%) scale(${ringScale})`,
          pointerEvents: 'none',
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
          border: `1px solid ${COLORS.gold}08`,
          transform: `translate(-50%, -50%) scale(${1 / ringScale})`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 900,
          height: 900,
          borderRadius: '50%',
          border: `1px solid ${COLORS.teal}05`,
          transform: `translate(-50%, -50%) scale(${ringScale * 0.98})`,
          pointerEvents: 'none',
        }}
      />

      {/* Ambient particles — gold */}
      <AmbientParticles frame={frame} color={COLORS.gold} count={20} />

      {/* Subtle grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${COLORS.white}02 1px, transparent 1px), linear-gradient(90deg, ${COLORS.white}02 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />

      {/* Floating code symbols — low density for celebration */}
      <FloatingCodeSymbols frame={frame} sceneType="summary" count={6} />

      {/* Cinematic atmosphere */}
      <CinematicAtmosphere
        frame={frame}
        sceneType={sceneType}
        vignetteColor="#0A0C08AA"
        vignetteInnerStop={40}
        subtlety={0.7}
      />
    </AbsoluteFill>
  );
};

export default BackgroundLayer;
