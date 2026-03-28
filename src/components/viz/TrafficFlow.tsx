import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';
import type { SyncState } from '../../types';

// Theme colors
const C = {
  saffron: '#E85D26',
  gold: '#FFD700',
  teal: '#20C997',
  indigo: '#818CF8',
  gray: '#A9ACB3',
  dark: '#0C0A15',
  darkAlt: '#1A1625',
  white: '#FFFFFF',
};

interface TrafficFlowProps {
  sync: SyncState;
  frame: number;
  keywords: string[];
}

// Clamps a value between min and max
function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

// Maps sceneProgress to a local [0,1] window
function progressWindow(p: number, start: number, end: number) {
  return clamp((p - start) / (end - start), 0, 1);
}

// ---- Sub-components ----

interface ClientDotProps {
  x: string;
  y: string;
  revealSpring: number;
  isActive: boolean;
  frame: number;
}

const ClientDot: React.FC<ClientDotProps> = ({ x, y, revealSpring, isActive, frame }) => {
  const pulse = isActive
    ? 1 + 0.18 * Math.sin(frame * 0.18)
    : 1;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${revealSpring * pulse})`,
        opacity: revealSpring,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {/* Client icon — two stacked rectangles */}
      <div
        style={{
          width: 40,
          height: 28,
          borderRadius: 6,
          background: `linear-gradient(135deg, ${C.indigo}33, ${C.indigo}66)`,
          border: `2px solid ${isActive ? C.indigo : C.gray}`,
          boxShadow: isActive ? `0 0 12px ${C.indigo}88` : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 22,
            height: 14,
            borderRadius: 3,
            background: isActive ? C.indigo : C.gray,
            opacity: 0.6,
          }}
        />
      </div>
      <span
        style={{
          fontSize: 11,
          color: isActive ? C.indigo : C.gray,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 600,
          letterSpacing: 1,
        }}
      >
        CLIENT
      </span>
    </div>
  );
};

interface LoadBalancerBoxProps {
  springVal: number;
  isActive: boolean;
  frame: number;
}

const LoadBalancerBox: React.FC<LoadBalancerBoxProps> = ({ springVal, isActive, frame }) => {
  const glowPulse = isActive ? 0.5 + 0.5 * Math.sin(frame * 0.12) : 0.3;

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '44%',
        transform: `translate(-50%, -50%) scale(${springVal})`,
        opacity: springVal,
        width: 140,
        height: 56,
        borderRadius: 10,
        background: `linear-gradient(135deg, ${C.saffron}22, ${C.gold}22)`,
        border: `2.5px solid ${isActive ? C.gold : C.saffron}`,
        boxShadow: `0 0 ${24 * glowPulse}px ${C.saffron}${Math.floor(glowPulse * 160).toString(16).padStart(2, '0')}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: C.gold,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: 0.5,
        }}
      >
        LOAD BALANCER
      </span>
      <span
        style={{
          fontSize: 10,
          color: C.saffron,
          fontFamily: 'Inter, sans-serif',
          opacity: 0.8,
        }}
      >
        Round Robin
      </span>
    </div>
  );
};

interface ArrowProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  drawProgress: number;
  color: string;
  label?: string;
}

const Arrow: React.FC<ArrowProps> = ({ x1, y1, x2, y2, drawProgress, color }) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const drawnLength = length * drawProgress;

  // Angle for rotation
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  if (drawnLength < 2) return null;

  // Clip the arrow to drawnLength
  const ex = x1 + (dx / length) * drawnLength;
  const ey = y1 + (dy / length) * drawnLength;

  // Arrowhead only when sufficiently drawn
  const showHead = drawProgress > 0.85;
  const headSize = 8;
  const headAngle = Math.atan2(dy, dx);
  const hx1 = ex - headSize * Math.cos(headAngle - Math.PI / 6);
  const hy1 = ey - headSize * Math.sin(headAngle - Math.PI / 6);
  const hx2 = ex - headSize * Math.cos(headAngle + Math.PI / 6);
  const hy2 = ey - headSize * Math.sin(headAngle + Math.PI / 6);

  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={ex}
        y2={ey}
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        opacity={0.7}
      />
      {showHead && (
        <polygon
          points={`${ex},${ey} ${hx1},${hy1} ${hx2},${hy2}`}
          fill={color}
          opacity={0.9}
        />
      )}
    </g>
  );
};

interface ServerBoxProps {
  x: string;
  y: string;
  label: string;
  springVal: number;
  color: string;
  isActive: boolean;
  frame: number;
  delay: number;
}

const ServerBox: React.FC<ServerBoxProps> = ({ x, y, label, springVal, color, isActive, frame, delay }) => {
  const scale = springVal;
  const glow = isActive ? 0.5 + 0.4 * Math.sin(frame * 0.14 + delay) : 0;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity: scale,
        width: 88,
        height: 64,
        borderRadius: 8,
        background: `linear-gradient(160deg, ${color}18, ${color}30)`,
        border: `2px solid ${color}`,
        boxShadow: `0 0 ${16 * glow}px ${color}88`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
      }}
    >
      {/* Server rack icon */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 40,
              height: 6,
              borderRadius: 2,
              background: isActive && i === Math.floor(frame / 8) % 3 ? color : `${color}55`,
              transition: 'background 0.1s',
            }}
          />
        ))}
      </div>
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: 1,
        }}
      >
        {label}
      </span>
    </div>
  );
};

interface HealthBarProps {
  x: string;
  y: string;
  fill: number;   // 0 → 1
  color: string;
  opacity: number;
}

const HealthBar: React.FC<HealthBarProps> = ({ x, y, fill, color, opacity }) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: 'translate(-50%, 0)',
      opacity,
      width: 80,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 3,
    }}
  >
    <span style={{ fontSize: 9, color: C.gray, fontFamily: 'Inter, sans-serif', letterSpacing: 0.5 }}>
      CPU
    </span>
    <div
      style={{
        width: 80,
        height: 7,
        borderRadius: 4,
        background: `${C.gray}33`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${fill * 100}%`,
          height: '100%',
          borderRadius: 4,
          background: fill > 0.75 ? C.saffron : color,
          transition: 'width 0.05s',
        }}
      />
    </div>
  </div>
);

interface FlowingDotProps {
  t: number;           // 0..1 position along the path
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  visible: boolean;
}

const FlowingDot: React.FC<FlowingDotProps> = ({ t, x1, y1, x2, y2, color, visible }) => {
  if (!visible) return null;

  // Ease in/out along path
  const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  const cx = x1 + (x2 - x1) * eased;
  const cy = y1 + (y2 - y1) * eased;

  // Fade at start/end of path
  const alpha = t < 0.1
    ? t / 0.1
    : t > 0.9
    ? (1 - t) / 0.1
    : 1;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={color}
      opacity={alpha * 0.9}
      style={{ filter: `drop-shadow(0 0 4px ${color})` }}
    />
  );
};

// ---- Main component ----

export const TrafficFlow: React.FC<TrafficFlowProps> = ({ sync, frame, keywords }) => {
  const { fps, width, height } = useVideoConfig();
  const p = sync.sceneProgress; // 0..1

  // ── Stage reveal springs ──────────────────────────────────────────────────
  // Clients: 0–0.15
  const clientsRevealProgress = progressWindow(p, 0, 0.15);
  const clientSprings = [0, 1, 2].map((i) =>
    spring({
      frame: Math.max(0, frame - i * 6),
      fps,
      config: { damping: 14, stiffness: 120, mass: 0.7 },
      from: 0,
      to: clientsRevealProgress > 0 ? 1 : 0,
    })
  );

  // LB: 0.15–0.3
  const lbRevealProgress = progressWindow(p, 0.15, 0.3);
  const lbSpring = spring({
    frame: frame,
    fps,
    config: { damping: 12, stiffness: 100, mass: 0.9 },
    from: 0,
    to: lbRevealProgress > 0 ? 1 : 0,
  });

  // Arrows: 0.3–0.5 — draw progress (0..1) per arrow
  const arrowDrawProgress = progressWindow(p, 0.3, 0.5);

  // Servers: 0.5–0.7
  const serverRevealProgress = progressWindow(p, 0.5, 0.7);
  const serverSprings = [0, 1, 2].map((i) =>
    spring({
      frame: Math.max(0, frame - i * 7),
      fps,
      config: { damping: 13, stiffness: 110, mass: 0.8 },
      from: 0,
      to: serverRevealProgress > 0 ? 1 : 0,
    })
  );

  // Health bars: 0.7–0.9
  const healthFillProgress = progressWindow(p, 0.7, 0.9);
  const healthBarOpacity = interpolate(healthFillProgress, [0, 0.2], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const healthFills = [0.42, 0.67, 0.31].map((base) =>
    base * healthFillProgress
  );

  // Flowing dots: active after p > 0.5
  const flowingActive = p > 0.5;

  // Dot loop period: 45 frames per dot
  const dotPeriod = 45;
  const serverColors = [C.teal, C.indigo, C.gold];

  // Three "channels": client 0 → LB → server 0,1,2 in round-robin
  // Dots travel: top → LB (phase A) then LB → server (phase B)
  // We create 3 dots, one per server lane, offset by 15 frames each
  const flowDots = [0, 1, 2].map((i) => {
    const offset = i * 15;
    const t = ((frame - offset) % dotPeriod) / dotPeriod;
    return { t: t < 0 ? t + 1 : t, lane: i };
  });

  // ── SVG layout coords (viewport 100% × 100% → we use pixel coords for SVG) ──
  // We'll overlay an SVG at 100%×100% for arrows & flowing dots
  const svgW = width;
  const svgH = height;

  // Key positions as fractions then scaled to SVG
  const clientPositions = [
    { fx: 0.25, fy: 0.15 },
    { fx: 0.50, fy: 0.12 },
    { fx: 0.75, fy: 0.15 },
  ];
  const lbCenter = { fx: 0.50, fy: 0.44 };
  const serverPositions = [
    { fx: 0.22, fy: 0.76 },
    { fx: 0.50, fy: 0.79 },
    { fx: 0.78, fy: 0.76 },
  ];

  // Arrows: each client → LB (upward fan-in), then LB → each server (fan-out)
  const clientToLbArrows = clientPositions.map((c) => ({
    x1: c.fx * svgW,
    y1: (c.fy + 0.04) * svgH,
    x2: lbCenter.fx * svgW,
    y2: (lbCenter.fy - 0.04) * svgH,
  }));

  const lbToServerArrows = serverPositions.map((s) => ({
    x1: lbCenter.fx * svgW,
    y1: (lbCenter.fy + 0.04) * svgH,
    x2: s.fx * svgW,
    y2: (s.fy - 0.05) * svgH,
  }));

  // Active server highlight: cycle every 20 frames when flowing
  const activeServerIdx = flowingActive ? Math.floor(frame / 20) % 3 : -1;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: 'transparent',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* ── SVG layer: arrows + flowing dots ── */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
        }}
        viewBox={`0 0 ${svgW} ${svgH}`}
        preserveAspectRatio="none"
      >
        {/* Client → LB arrows (fan-in, gray) */}
        {clientToLbArrows.map((a, i) => (
          <Arrow
            key={`cin-${i}`}
            x1={a.x1} y1={a.y1}
            x2={a.x2} y2={a.y2}
            drawProgress={arrowDrawProgress}
            color={C.gray}
          />
        ))}

        {/* LB → Server arrows (fan-out, saffron) */}
        {lbToServerArrows.map((a, i) => (
          <Arrow
            key={`cout-${i}`}
            x1={a.x1} y1={a.y1}
            x2={a.x2} y2={a.y2}
            drawProgress={arrowDrawProgress}
            color={C.saffron}
          />
        ))}

        {/* Flowing dots: travel along LB → server paths */}
        {flowDots.map((dot) => {
          const lane = dot.lane;
          const a = lbToServerArrows[lane];
          return (
            <FlowingDot
              key={`dot-${lane}`}
              t={dot.t}
              x1={a.x1} y1={a.y1}
              x2={a.x2} y2={a.y2}
              color={serverColors[lane]}
              visible={flowingActive && serverRevealProgress > 0.5}
            />
          );
        })}

        {/* Flowing dots: travel along client → LB paths (lighter, gray) */}
        {[0, 1, 2].map((i) => {
          const offset = i * 15 + 8;
          const rawT = ((frame - offset) % dotPeriod) / dotPeriod;
          const t = rawT < 0 ? rawT + 1 : rawT;
          const a = clientToLbArrows[i];
          return (
            <FlowingDot
              key={`cldot-${i}`}
              t={t}
              x1={a.x1} y1={a.y1}
              x2={a.x2} y2={a.y2}
              color={C.gray}
              visible={flowingActive && serverRevealProgress > 0.5}
            />
          );
        })}
      </svg>

      {/* ── Client dots (DOM layer) ── */}
      {clientPositions.map((pos, i) => (
        <ClientDot
          key={`client-${i}`}
          x={`${pos.fx * 100}%`}
          y={`${pos.fy * 100}%`}
          revealSpring={clientSprings[i]}
          isActive={flowingActive}
          frame={frame}
        />
      ))}

      {/* ── Load Balancer box ── */}
      <LoadBalancerBox
        springVal={lbSpring}
        isActive={flowingActive}
        frame={frame}
      />

      {/* ── Server boxes ── */}
      {serverPositions.map((pos, i) => (
        <ServerBox
          key={`server-${i}`}
          x={`${pos.fx * 100}%`}
          y={`${pos.fy * 100}%`}
          label={`S${i + 1}`}
          springVal={serverSprings[i]}
          color={serverColors[i]}
          isActive={activeServerIdx === i}
          frame={frame}
          delay={i * 0.8}
        />
      ))}

      {/* ── Health bars (below servers) ── */}
      {serverPositions.map((pos, i) => (
        <HealthBar
          key={`hbar-${i}`}
          x={`${pos.fx * 100}%`}
          y={`${(pos.fy + 0.055) * 100}%`}
          fill={healthFills[i]}
          color={serverColors[i]}
          opacity={healthBarOpacity}
        />
      ))}

      {/* ── Legend label (top-left) ── */}
      <div
        style={{
          position: 'absolute',
          top: '4%',
          left: '4%',
          opacity: interpolate(p, [0, 0.1], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: C.gold,
            letterSpacing: 1,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Traffic Distribution
        </span>
        {keywords.slice(0, 3).map((kw, i) => (
          <span
            key={kw}
            style={{
              fontSize: 11,
              color: C.gray,
              fontFamily: 'Inter, sans-serif',
              opacity: interpolate(p, [0.05 + i * 0.05, 0.15 + i * 0.05], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            • {kw}
          </span>
        ))}
      </div>
    </div>
  );
};
