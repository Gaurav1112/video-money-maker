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
  red: '#EF4444',
  green: '#22C55E',
};

interface TrafficFlowProps {
  sync: SyncState;
  frame: number;
  keywords: string[];
  variant?: string;
}

// Clamps a value between min and max
function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

// Maps sceneProgress to a local [0,1] window
function progressWindow(p: number, start: number, end: number) {
  return clamp((p - start) / (end - start), 0, 1);
}

/**
 * Compute a reliable progress value from frame, fps, and sync.
 * Uses frame-based progress as the primary driver so animations
 * always advance, even when sync.sceneProgress is stuck at 0.
 * The scene is assumed to be ~8 seconds if no better info is available.
 */
function useReliableProgress(frame: number, fps: number, sync: SyncState): number {
  // If sync is providing meaningful data, use it
  if (sync.sceneProgress > 0.01 && sync.sceneProgress < 0.99) {
    return sync.sceneProgress;
  }
  // Fallback: assume ~8 second scene duration
  const assumedDuration = 8 * fps;
  return Math.min(1, frame / assumedDuration);
}

// ---- Sub-components ----

interface ClientDotProps {
  x: string;
  y: string;
  revealSpring: number;
  isActive: boolean;
  frame: number;
  color?: string;
  label?: string;
}

const ClientDot: React.FC<ClientDotProps> = ({ x, y, revealSpring, isActive, frame, color, label }) => {
  const dotColor = color || C.indigo;
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
          background: `linear-gradient(135deg, ${dotColor}33, ${dotColor}66)`,
          border: `2px solid ${isActive ? dotColor : C.gray}`,
          boxShadow: isActive ? `0 0 12px ${dotColor}88` : 'none',
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
            background: isActive ? dotColor : C.gray,
            opacity: 0.6,
          }}
        />
      </div>
      <span
        style={{
          fontSize: 11,
          color: isActive ? dotColor : C.gray,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 600,
          letterSpacing: 1,
        }}
      >
        {label || 'CLIENT'}
      </span>
    </div>
  );
};

interface LoadBalancerBoxProps {
  springVal: number;
  isActive: boolean;
  frame: number;
  subtitle?: string;
}

const LoadBalancerBox: React.FC<LoadBalancerBoxProps> = ({ springVal, isActive, frame, subtitle }) => {
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
        {subtitle || 'Round Robin'}
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
  dashed?: boolean;
  strokeWidth?: number;
  pulseFrame?: number;
}

const Arrow: React.FC<ArrowProps> = ({ x1, y1, x2, y2, drawProgress, color, dashed, strokeWidth = 2.5, pulseFrame }) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const drawnLength = length * drawProgress;

  if (drawnLength < 2) return null;

  const ex = x1 + (dx / length) * drawnLength;
  const ey = y1 + (dy / length) * drawnLength;

  const showHead = drawProgress > 0.85;
  const headSize = 8;
  const headAngle = Math.atan2(dy, dx);
  const hx1 = ex - headSize * Math.cos(headAngle - Math.PI / 6);
  const hy1 = ey - headSize * Math.sin(headAngle - Math.PI / 6);
  const hx2 = ex - headSize * Math.cos(headAngle + Math.PI / 6);
  const hy2 = ey - headSize * Math.sin(headAngle + Math.PI / 6);

  // Subtle pulse on the line when active
  const pulseOpacity = pulseFrame !== undefined
    ? 0.5 + 0.3 * Math.sin(pulseFrame * 0.06)
    : 0.7;

  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={ex}
        y2={ey}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={dashed ? '6 4' : undefined}
        opacity={pulseOpacity}
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
  status?: 'healthy' | 'overloaded' | 'down' | 'new';
}

const ServerBox: React.FC<ServerBoxProps> = ({ x, y, label, springVal, color, isActive, frame, delay, status }) => {
  const scale = springVal;

  // Color override based on status
  const displayColor = status === 'down' ? C.red
    : status === 'overloaded' ? C.saffron
    : status === 'new' ? C.green
    : color;

  const glow = isActive ? 0.5 + 0.4 * Math.sin(frame * 0.14 + delay) : 0;
  const shake = status === 'overloaded' ? Math.sin(frame * 0.6) * 3 : 0;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale}) translateX(${shake}px)`,
        opacity: status === 'down' ? 0.35 : scale,
        width: 88,
        height: 64,
        borderRadius: 8,
        background: `linear-gradient(160deg, ${displayColor}18, ${displayColor}30)`,
        border: `2px solid ${displayColor}`,
        boxShadow: `0 0 ${16 * glow}px ${displayColor}88`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
      }}
    >
      {/* Server rack icon — blinks active row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 40,
              height: 6,
              borderRadius: 2,
              background: status === 'down'
                ? `${C.red}44`
                : isActive && i === Math.floor(frame / 8) % 3
                ? displayColor
                : `${displayColor}55`,
            }}
          />
        ))}
      </div>
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: displayColor,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: 1,
        }}
      >
        {label}
      </span>
      {/* Status badge */}
      {status && status !== 'healthy' && (
        <div style={{
          position: 'absolute',
          top: -12,
          right: -8,
          fontSize: 9,
          fontWeight: 700,
          color: C.white,
          background: displayColor,
          borderRadius: 4,
          padding: '1px 6px',
          letterSpacing: 0.5,
          fontFamily: 'Inter, sans-serif',
        }}>
          {status === 'overloaded' ? 'OVERLOADED' : status === 'down' ? 'DOWN' : 'NEW'}
        </div>
      )}
    </div>
  );
};

interface HealthBarProps {
  x: string;
  y: string;
  fill: number;
  color: string;
  opacity: number;
  pulsing?: boolean;
  frame?: number;
}

const HealthBar: React.FC<HealthBarProps> = ({ x, y, fill, color, opacity, pulsing, frame = 0 }) => {
  // Pulse the fill slightly for visual liveliness
  const pulseAmount = pulsing ? 0.04 * Math.sin(frame * 0.15) : 0;
  const displayFill = clamp(fill + pulseAmount, 0, 1);

  return (
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
            width: `${displayFill * 100}%`,
            height: '100%',
            borderRadius: 4,
            background: displayFill > 0.9 ? C.red : displayFill > 0.75 ? C.saffron : color,
          }}
        />
      </div>
    </div>
  );
};

interface FlowingDotProps {
  t: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  visible: boolean;
  size?: number;
}

const FlowingDot: React.FC<FlowingDotProps> = ({ t, x1, y1, x2, y2, color, visible, size = 5 }) => {
  if (!visible) return null;

  const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  const cx = x1 + (x2 - x1) * eased;
  const cy = y1 + (y2 - y1) * eased;

  const alpha = t < 0.1
    ? t / 0.1
    : t > 0.9
    ? (1 - t) / 0.1
    : 1;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={size}
      fill={color}
      opacity={alpha * 0.9}
      style={{ filter: `drop-shadow(0 0 4px ${color})` }}
    />
  );
};

// =====================================================================
// MAIN COMPONENT
// =====================================================================

export const TrafficFlow: React.FC<TrafficFlowProps> = ({ sync, frame, keywords, variant }) => {
  const { fps, width, height } = useVideoConfig();

  // Route to variant-specific rendering
  if (variant === 'overload') return <OverloadVariant sync={sync} frame={frame} keywords={keywords} />;
  if (variant === 'healthcheck') return <HealthcheckVariant sync={sync} frame={frame} keywords={keywords} />;
  if (variant === 'sticky') return <StickyVariant sync={sync} frame={frame} keywords={keywords} />;
  if (variant === 'scale') return <ScaleVariant sync={sync} frame={frame} keywords={keywords} />;

  // ─── DEFAULT variant: 'distribute' / original round-robin ─────────────

  // Use reliable progress that always advances
  const p = useReliableProgress(frame, fps, sync);

  // ── SPREAD stage reveals across full 0-1 scene progress ──
  const clientsRevealProgress = progressWindow(p, 0, 0.15);
  const clientSprings = [0, 1, 2].map((i) =>
    spring({
      frame: Math.max(0, frame - i * 4),
      fps,
      config: { damping: 14, stiffness: 120, mass: 0.7 },
      from: 0,
      to: clientsRevealProgress > 0 ? 1 : 0,
    })
  );

  const lbRevealProgress = progressWindow(p, 0.15, 0.30);
  const lbSpring = spring({
    frame: frame,
    fps,
    config: { damping: 12, stiffness: 100, mass: 0.9 },
    from: 0,
    to: lbRevealProgress > 0 ? 1 : 0,
  });

  const arrowDrawProgress = progressWindow(p, 0.50, 0.70);

  const serverRevealProgress = progressWindow(p, 0.30, 0.50);
  const serverSprings = [0, 1, 2].map((i) =>
    spring({
      frame: Math.max(0, frame - i * 5),
      fps,
      config: { damping: 13, stiffness: 110, mass: 0.8 },
      from: 0,
      to: serverRevealProgress > 0 ? 1 : 0,
    })
  );

  // Health bars appear once servers are in
  const healthFillProgress = progressWindow(p, 0.85, 1.0);
  const healthBarOpacity = interpolate(healthFillProgress, [0, 0.3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Health bars pulse continuously using frame
  const healthFills = [0.42, 0.67, 0.31].map((base, i) =>
    base * healthFillProgress + (healthFillProgress > 0 ? 0.06 * Math.sin(frame * 0.08 + i * 2) : 0)
  );

  // Flow starts as soon as servers appear — frame-driven, not progress-gated
  const flowingActive = p > 0.70;

  // --- FRAME-DRIVEN flowing dots (always animate when visible) ---
  const dotPeriod = fps * 1.5; // 1.5-second loop cycle
  const serverColors = [C.teal, C.indigo, C.gold];

  // Multiple dots per lane for denser traffic
  const flowDots: Array<{ t: number; lane: number }> = [];
  for (let lane = 0; lane < 3; lane++) {
    for (let dotIdx = 0; dotIdx < 2; dotIdx++) {
      const offset = lane * Math.floor(dotPeriod / 3) + dotIdx * Math.floor(dotPeriod / 2);
      const rawT = ((frame - offset) % dotPeriod) / dotPeriod;
      flowDots.push({ t: rawT < 0 ? rawT + 1 : rawT, lane });
    }
  }

  // Client-to-LB dots
  const clientFlowDots: Array<{ t: number; lane: number }> = [];
  for (let lane = 0; lane < 3; lane++) {
    for (let dotIdx = 0; dotIdx < 2; dotIdx++) {
      const offset = lane * Math.floor(dotPeriod / 3) + dotIdx * Math.floor(dotPeriod / 2) + Math.floor(dotPeriod / 4);
      const rawT = ((frame - offset) % dotPeriod) / dotPeriod;
      clientFlowDots.push({ t: rawT < 0 ? rawT + 1 : rawT, lane });
    }
  }

  const svgW = width;
  const svgH = height;

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

  // Active server cycles using frame for smooth round-robin
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
      <svg
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}
        viewBox={`0 0 ${svgW} ${svgH}`}
        preserveAspectRatio="none"
      >
        {clientToLbArrows.map((a, i) => (
          <Arrow key={`cin-${i}`} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} drawProgress={arrowDrawProgress} color={C.gray} pulseFrame={flowingActive ? frame : undefined} />
        ))}

        {lbToServerArrows.map((a, i) => (
          <Arrow key={`cout-${i}`} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} drawProgress={arrowDrawProgress} color={C.saffron} pulseFrame={flowingActive ? frame : undefined} />
        ))}

        {/* LB -> Server flowing dots (multiple per lane) */}
        {flowDots.map((dot, idx) => {
          const a = lbToServerArrows[dot.lane];
          return (
            <FlowingDot key={`dot-${idx}`} t={dot.t} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} color={serverColors[dot.lane]} visible={flowingActive && serverRevealProgress > 0.3} />
          );
        })}

        {/* Client -> LB flowing dots */}
        {clientFlowDots.map((dot, idx) => {
          const a = clientToLbArrows[dot.lane];
          return (
            <FlowingDot key={`cldot-${idx}`} t={dot.t} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} color={C.gray} visible={flowingActive && serverRevealProgress > 0.3} size={4} />
          );
        })}
      </svg>

      {clientPositions.map((pos, i) => (
        <ClientDot key={`client-${i}`} x={`${pos.fx * 100}%`} y={`${pos.fy * 100}%`} revealSpring={clientSprings[i]} isActive={flowingActive} frame={frame} />
      ))}

      <LoadBalancerBox springVal={lbSpring} isActive={flowingActive} frame={frame} />

      {serverPositions.map((pos, i) => (
        <ServerBox key={`server-${i}`} x={`${pos.fx * 100}%`} y={`${pos.fy * 100}%`} label={`S${i + 1}`} springVal={serverSprings[i]} color={serverColors[i]} isActive={activeServerIdx === i} frame={frame} delay={i * 0.8} />
      ))}

      {serverPositions.map((pos, i) => (
        <HealthBar key={`hbar-${i}`} x={`${pos.fx * 100}%`} y={`${(pos.fy + 0.055) * 100}%`} fill={healthFills[i]} color={serverColors[i]} opacity={healthBarOpacity} pulsing={flowingActive} frame={frame} />
      ))}

    </div>
  );
};

// =====================================================================
// OVERLOAD VARIANT COMPONENT
// One server getting overwhelmed — turns red, requests pile up
// =====================================================================
const OverloadVariant: React.FC<Omit<TrafficFlowProps, 'variant'>> = ({ sync, frame, keywords }) => {
  const { fps, width, height } = useVideoConfig();
  const p = useReliableProgress(frame, fps, sync);

  // 5 clients hammering a single server (no LB)
  const clientPositions = [
    { fx: 0.15, fy: 0.14 }, { fx: 0.32, fy: 0.10 }, { fx: 0.50, fy: 0.08 },
    { fx: 0.68, fy: 0.10 }, { fx: 0.85, fy: 0.14 },
  ];
  const serverPos = { fx: 0.50, fy: 0.72 };
  const svgW = width;
  const svgH = height;

  // SPREAD reveals across full scene progress
  const clientRevealP = progressWindow(p, 0, 0.15);
  const clientSprings = clientPositions.map((_, i) =>
    spring({ frame: Math.max(0, frame - i * 3), fps, config: { damping: 14, stiffness: 120, mass: 0.7 }, from: 0, to: clientRevealP > 0 ? 1 : 0 })
  );

  const serverRevealP = progressWindow(p, 0.15, 0.30);
  const serverSpring = spring({ frame, fps, config: { damping: 13, stiffness: 110, mass: 0.8 }, from: 0, to: serverRevealP > 0 ? 1 : 0 });

  const arrowDrawP = progressWindow(p, 0.30, 0.50);

  // Overload builds up over most of the scene (starts at 50%)
  const overloadP = progressWindow(p, 0.50, 0.90);
  const healthFill = 0.15 + overloadP * 0.83;
  const serverStatus: 'healthy' | 'overloaded' | 'down' = healthFill > 0.88 ? 'down' : healthFill > 0.55 ? 'overloaded' : 'healthy';

  // Queue dots that pile up around server — frame-driven for smooth orbiting
  const queueCount = Math.min(12, Math.floor(overloadP * 14));
  const flowActive = p > 0.50;
  const dotPeriod = fps * 1.2; // 1.2-second loop

  // Arrows: each client -> server directly
  const clientArrows = clientPositions.map((c) => ({
    x1: c.fx * svgW, y1: (c.fy + 0.04) * svgH,
    x2: serverPos.fx * svgW, y2: (serverPos.fy - 0.06) * svgH,
  }));

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'transparent', fontFamily: 'Inter, sans-serif' }}>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }} viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">
        {/* Arrows from each client to single server */}
        {clientArrows.map((a, i) => (
          <Arrow key={`a-${i}`} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} drawProgress={arrowDrawP} color={C.saffron} pulseFrame={flowActive ? frame : undefined} />
        ))}

        {/* Flowing dots from clients — frame-driven, multiple per lane */}
        {clientPositions.map((_, i) => {
          const dots = [];
          for (let d = 0; d < 2; d++) {
            const offset = i * Math.floor(dotPeriod / 5) + d * Math.floor(dotPeriod / 2);
            const rawT = ((frame - offset) % dotPeriod) / dotPeriod;
            const t = rawT < 0 ? rawT + 1 : rawT;
            dots.push(
              <FlowingDot key={`fd-${i}-${d}`} t={t} x1={clientArrows[i].x1} y1={clientArrows[i].y1} x2={clientArrows[i].x2} y2={clientArrows[i].y2} color={C.saffron} visible={flowActive} size={4} />
            );
          }
          return dots;
        })}

        {/* Queue circles orbiting around overwhelmed server — frame-driven rotation */}
        {Array.from({ length: queueCount }).map((_, i) => {
          const angle = (i / Math.max(1, queueCount)) * Math.PI * 2 + frame * 0.03;
          const radius = 60 + Math.floor(i / 6) * 25;
          const cx = serverPos.fx * svgW + Math.cos(angle) * radius;
          const cy = serverPos.fy * svgH + Math.sin(angle) * radius;
          const pulse = 0.6 + 0.4 * Math.sin(frame * 0.1 + i);
          return (
            <circle key={`q-${i}`} cx={cx} cy={cy} r={4} fill={C.red} opacity={pulse * 0.7}
              style={{ filter: `drop-shadow(0 0 3px ${C.red})` }}
            />
          );
        })}
      </svg>

      {/* Clients */}
      {clientPositions.map((pos, i) => (
        <ClientDot key={`c-${i}`} x={`${pos.fx * 100}%`} y={`${pos.fy * 100}%`} revealSpring={clientSprings[i]} isActive={flowActive} frame={frame} />
      ))}

      {/* Single server */}
      <ServerBox x={`${serverPos.fx * 100}%`} y={`${serverPos.fy * 100}%`} label="S1" springVal={serverSpring} color={C.teal} isActive={flowActive} frame={frame} delay={0} status={serverStatus} />

      {/* Health bar — pulsing */}
      <HealthBar x={`${serverPos.fx * 100}%`} y={`${(serverPos.fy + 0.06) * 100}%`} fill={healthFill} color={healthFill > 0.7 ? C.red : C.teal} opacity={serverRevealP} pulsing frame={frame} />

      {/* Warning text */}
      {overloadP > 0.3 && (
        <div style={{
          position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)',
          background: `${C.red}22`, border: `2px solid ${C.red}`, borderRadius: 10,
          padding: '10px 24px', fontFamily: 'Inter, sans-serif',
          opacity: interpolate(overloadP, [0.3, 0.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: C.red }}>
            {serverStatus === 'down' ? 'SERVER DOWN - 503 Service Unavailable' : 'WARNING: CPU at ' + Math.round(healthFill * 100) + '%'}
          </span>
        </div>
      )}

    </div>
  );
};

// =====================================================================
// HEALTHCHECK VARIANT COMPONENT
// Server goes down, LB detects via health check, reroutes traffic
// =====================================================================
const HealthcheckVariant: React.FC<Omit<TrafficFlowProps, 'variant'>> = ({ sync, frame, keywords }) => {
  const { fps, width, height } = useVideoConfig();
  const p = useReliableProgress(frame, fps, sync);
  const svgW = width;
  const svgH = height;

  const clientPositions = [
    { fx: 0.25, fy: 0.15 }, { fx: 0.50, fy: 0.12 }, { fx: 0.75, fy: 0.15 },
  ];
  const lbCenter = { fx: 0.50, fy: 0.44 };
  const serverPositions = [
    { fx: 0.22, fy: 0.76 }, { fx: 0.50, fy: 0.79 }, { fx: 0.78, fy: 0.76 },
  ];
  const serverColors = [C.teal, C.indigo, C.gold];

  // Phase timing — SPREAD reveals, more time for the drama
  const failureP = progressWindow(p, 0.55, 0.70);
  const downP = progressWindow(p, 0.70, 0.80);
  const rerouteP = progressWindow(p, 0.80, 1.0);

  const server2Status: 'healthy' | 'overloaded' | 'down' =
    downP > 0.5 ? 'down' : failureP > 0.5 ? 'overloaded' : 'healthy';

  // SPREAD reveals across full scene progress (healthcheck variant)
  const clientRevealP = progressWindow(p, 0, 0.15);
  const clientSprings = [0, 1, 2].map((i) =>
    spring({ frame: Math.max(0, frame - i * 4), fps, config: { damping: 14, stiffness: 120, mass: 0.7 }, from: 0, to: clientRevealP > 0 ? 1 : 0 })
  );

  const lbRevealP = progressWindow(p, 0.15, 0.30);
  const lbSpring = spring({ frame, fps, config: { damping: 12, stiffness: 100, mass: 0.9 }, from: 0, to: lbRevealP > 0 ? 1 : 0 });

  const arrowDrawP = progressWindow(p, 0.30, 0.50);

  const serverRevealP = progressWindow(p, 0.35, 0.55);
  const serverSprings = [0, 1, 2].map((i) =>
    spring({ frame: Math.max(0, frame - i * 5), fps, config: { damping: 13, stiffness: 110, mass: 0.8 }, from: 0, to: serverRevealP > 0 ? 1 : 0 })
  );

  const flowActive = p > 0.55;
  const dotPeriod = fps * 1.5;

  // Arrow coords
  const lbToServerArrows = serverPositions.map((s) => ({
    x1: lbCenter.fx * svgW, y1: (lbCenter.fy + 0.04) * svgH,
    x2: s.fx * svgW, y2: (s.fy - 0.05) * svgH,
  }));

  const clientToLbArrows = clientPositions.map((c) => ({
    x1: c.fx * svgW, y1: (c.fy + 0.04) * svgH,
    x2: lbCenter.fx * svgW, y2: (lbCenter.fy - 0.04) * svgH,
  }));

  // Health check pulses — frame-driven heartbeat
  const healthCheckActive = p > 0.50;
  const healthCheckPulse = Math.sin(frame * 0.08) > 0;

  // Determine which servers receive traffic (server 1 is idx=1)
  const activeServers = server2Status === 'down' ? [0, 2] : [0, 1, 2];
  const activeServerIdx = flowActive ? activeServers[Math.floor(frame / 20) % activeServers.length] : -1;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'transparent', fontFamily: 'Inter, sans-serif' }}>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }} viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">
        {/* Client -> LB arrows */}
        {clientToLbArrows.map((a, i) => (
          <Arrow key={`cin-${i}`} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} drawProgress={arrowDrawP} color={C.gray} pulseFrame={flowActive ? frame : undefined} />
        ))}

        {/* LB -> Server arrows (crossed out for dead server) */}
        {lbToServerArrows.map((a, i) => (
          <Arrow key={`cout-${i}`} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} drawProgress={arrowDrawP}
            color={i === 1 && server2Status === 'down' ? C.red : C.saffron}
            dashed={i === 1 && server2Status === 'down'}
            strokeWidth={i === 1 && server2Status === 'down' ? 1.5 : 2.5}
            pulseFrame={flowActive ? frame : undefined}
          />
        ))}

        {/* Health check pulses (visual heartbeat from LB to each server) */}
        {healthCheckActive && serverPositions.map((s, i) => {
          const hcY = (lbCenter.fy + 0.08) * svgH;
          const sx = s.fx * svgW;
          const sy = (s.fy - 0.08) * svgH;
          const lx = lbCenter.fx * svgW;
          const midX = (lx + sx) / 2 + (i - 1) * 30;
          const midY = (hcY + sy) / 2;
          // Frame-driven pulse creates a flashing heartbeat effect
          const pulseOpacity = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(frame * 0.12 + i * 1.2));
          const responseColor = i === 1 && server2Status !== 'healthy' ? C.red : C.green;
          // Heartbeat ring grows and fades
          const ringSize = 6 + 4 * (0.5 + 0.5 * Math.sin(frame * 0.12 + i * 1.2));
          return (
            <g key={`hc-${i}`} opacity={pulseOpacity}>
              <circle cx={midX} cy={midY} r={ringSize} fill="none" stroke={responseColor} strokeWidth={1.5} opacity={0.4} />
              <circle cx={midX} cy={midY} r={5} fill={responseColor} opacity={0.6} />
              <text x={midX + 12} y={midY + 4} fill={responseColor} fontSize={9} fontFamily="Inter, sans-serif" fontWeight={600}>
                {i === 1 && server2Status === 'down' ? 'FAIL' : i === 1 && server2Status === 'overloaded' ? 'SLOW' : 'OK'}
              </text>
            </g>
          );
        })}

        {/* Traffic dots — only to active servers, frame-driven */}
        {activeServers.map((lane, di) => {
          const dots = [];
          for (let d = 0; d < 2; d++) {
            const offset = di * Math.floor(dotPeriod / 3) + d * Math.floor(dotPeriod / 2);
            const rawT = ((frame - offset) % dotPeriod) / dotPeriod;
            const t = rawT < 0 ? rawT + 1 : rawT;
            dots.push(
              <FlowingDot key={`dot-${lane}-${d}`} t={t} x1={lbToServerArrows[lane].x1} y1={lbToServerArrows[lane].y1} x2={lbToServerArrows[lane].x2} y2={lbToServerArrows[lane].y2} color={serverColors[lane]} visible={flowActive && serverRevealP > 0.3} />
            );
          }
          return dots;
        })}

        {/* Client -> LB dots */}
        {[0, 1, 2].map((i) => {
          const offset = i * Math.floor(dotPeriod / 3) + Math.floor(dotPeriod / 4);
          const rawT = ((frame - offset) % dotPeriod) / dotPeriod;
          const t = rawT < 0 ? rawT + 1 : rawT;
          return (
            <FlowingDot key={`cldot-${i}`} t={t} x1={clientToLbArrows[i].x1} y1={clientToLbArrows[i].y1} x2={clientToLbArrows[i].x2} y2={clientToLbArrows[i].y2} color={C.gray} visible={flowActive && serverRevealP > 0.3} size={4} />
          );
        })}

        {/* X mark over dead server's arrow */}
        {server2Status === 'down' && (
          <g opacity={0.6 + 0.4 * Math.sin(frame * 0.1)}>
            <line x1={lbCenter.fx * svgW - 15} y1={(lbCenter.fy + 0.15) * svgH} x2={lbCenter.fx * svgW + 15} y2={(lbCenter.fy + 0.15) * svgH + 30} stroke={C.red} strokeWidth={3} />
            <line x1={lbCenter.fx * svgW + 15} y1={(lbCenter.fy + 0.15) * svgH} x2={lbCenter.fx * svgW - 15} y2={(lbCenter.fy + 0.15) * svgH + 30} stroke={C.red} strokeWidth={3} />
          </g>
        )}
      </svg>

      {/* Clients */}
      {clientPositions.map((pos, i) => (
        <ClientDot key={`c-${i}`} x={`${pos.fx * 100}%`} y={`${pos.fy * 100}%`} revealSpring={clientSprings[i]} isActive={flowActive} frame={frame} />
      ))}

      {/* LB with health check subtitle */}
      <LoadBalancerBox springVal={lbSpring} isActive={flowActive} frame={frame} subtitle="Health Check" />

      {/* Servers */}
      {serverPositions.map((pos, i) => (
        <ServerBox key={`s-${i}`} x={`${pos.fx * 100}%`} y={`${pos.fy * 100}%`} label={`S${i + 1}`} springVal={serverSprings[i]} color={serverColors[i]} isActive={activeServerIdx === i} frame={frame} delay={i * 0.8}
          status={i === 1 ? server2Status : 'healthy'}
        />
      ))}

    </div>
  );
};

// =====================================================================
// STICKY VARIANT COMPONENT
// Client-to-server affinity — each client always goes to same server
// =====================================================================
const StickyVariant: React.FC<Omit<TrafficFlowProps, 'variant'>> = ({ sync, frame, keywords }) => {
  const { fps, width, height } = useVideoConfig();
  const p = useReliableProgress(frame, fps, sync);
  const svgW = width;
  const svgH = height;

  const clientPositions = [
    { fx: 0.22, fy: 0.14 }, { fx: 0.50, fy: 0.10 }, { fx: 0.78, fy: 0.14 },
  ];
  const lbCenter = { fx: 0.50, fy: 0.44 };
  const serverPositions = [
    { fx: 0.22, fy: 0.76 }, { fx: 0.50, fy: 0.79 }, { fx: 0.78, fy: 0.76 },
  ];
  // Each client has a dedicated color matching its assigned server
  const affinityColors = [C.teal, C.indigo, C.gold];

  // SPREAD reveals across full scene progress
  const clientRevealP = progressWindow(p, 0, 0.15);
  const clientSprings = [0, 1, 2].map((i) =>
    spring({ frame: Math.max(0, frame - i * 4), fps, config: { damping: 14, stiffness: 120, mass: 0.7 }, from: 0, to: clientRevealP > 0 ? 1 : 0 })
  );

  const lbRevealP = progressWindow(p, 0.15, 0.30);
  const lbSpring = spring({ frame, fps, config: { damping: 12, stiffness: 100, mass: 0.9 }, from: 0, to: lbRevealP > 0 ? 1 : 0 });

  const arrowDrawP = progressWindow(p, 0.30, 0.50);

  const serverRevealP = progressWindow(p, 0.40, 0.55);
  const serverSprings = [0, 1, 2].map((i) =>
    spring({ frame: Math.max(0, frame - i * 5), fps, config: { damping: 13, stiffness: 110, mass: 0.8 }, from: 0, to: serverRevealP > 0 ? 1 : 0 })
  );

  const flowActive = p > 0.55;
  const dotPeriod = fps * 1.6; // 1.6-second loop

  // Each client has a FIXED affinity to its corresponding server
  const clientToLbArrows = clientPositions.map((c) => ({
    x1: c.fx * svgW, y1: (c.fy + 0.04) * svgH,
    x2: lbCenter.fx * svgW, y2: (lbCenter.fy - 0.04) * svgH,
  }));

  const lbToServerArrows = serverPositions.map((s) => ({
    x1: lbCenter.fx * svgW, y1: (lbCenter.fy + 0.04) * svgH,
    x2: s.fx * svgW, y2: (s.fy - 0.05) * svgH,
  }));

  // Affinity labels shown earlier
  const affinityRevealP = progressWindow(p, 0.60, 0.75);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'transparent', fontFamily: 'Inter, sans-serif' }}>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }} viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">
        {/* Colored arrows: each client->LB in its affinity color */}
        {clientToLbArrows.map((a, i) => (
          <Arrow key={`cin-${i}`} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} drawProgress={arrowDrawP} color={affinityColors[i]} strokeWidth={3} pulseFrame={flowActive ? frame : undefined} />
        ))}

        {/* Colored arrows: LB->server in matching color */}
        {lbToServerArrows.map((a, i) => (
          <Arrow key={`cout-${i}`} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} drawProgress={arrowDrawP} color={affinityColors[i]} strokeWidth={3} pulseFrame={flowActive ? frame : undefined} />
        ))}

        {/* Flowing dots — each in its affinity color, frame-driven, multiple per lane */}
        {[0, 1, 2].map((i) => {
          const dots = [];
          for (let d = 0; d < 2; d++) {
            const offset = i * Math.floor(dotPeriod / 3) + d * Math.floor(dotPeriod / 2);
            // Client -> LB
            const rawT1 = ((frame - offset) % dotPeriod) / dotPeriod;
            const t1 = rawT1 < 0 ? rawT1 + 1 : rawT1;
            // LB -> Server (delayed by half period)
            const rawT2 = ((frame - offset - Math.floor(dotPeriod / 3)) % dotPeriod) / dotPeriod;
            const t2 = rawT2 < 0 ? rawT2 + 1 : rawT2;
            dots.push(
              <React.Fragment key={`sticky-${i}-${d}`}>
                <FlowingDot t={t1} x1={clientToLbArrows[i].x1} y1={clientToLbArrows[i].y1} x2={clientToLbArrows[i].x2} y2={clientToLbArrows[i].y2} color={affinityColors[i]} visible={flowActive} size={6} />
                <FlowingDot t={t2} x1={lbToServerArrows[i].x1} y1={lbToServerArrows[i].y1} x2={lbToServerArrows[i].x2} y2={lbToServerArrows[i].y2} color={affinityColors[i]} visible={flowActive} size={6} />
              </React.Fragment>
            );
          }
          return dots;
        })}

        {/* Session ID labels on arrows */}
        {affinityRevealP > 0 && [0, 1, 2].map((i) => {
          const midX = (clientToLbArrows[i].x1 + clientToLbArrows[i].x2) / 2;
          const midY = (clientToLbArrows[i].y1 + clientToLbArrows[i].y2) / 2;
          // Gentle bobbing animation
          const bob = Math.sin(frame * 0.06 + i * 1.5) * 3;
          return (
            <text key={`sid-${i}`} x={midX + 12} y={midY + bob} fill={affinityColors[i]} fontSize={10} fontWeight={600} fontFamily="Inter, sans-serif" opacity={affinityRevealP}>
              SID-{i + 1}
            </text>
          );
        })}

        {/* Glowing connection lines behind arrows (affinity highlight) */}
        {flowActive && [0, 1, 2].map((i) => {
          const glowPulse = 0.1 + 0.15 * Math.sin(frame * 0.05 + i * 2);
          return (
            <React.Fragment key={`glow-${i}`}>
              <line
                x1={clientToLbArrows[i].x1} y1={clientToLbArrows[i].y1}
                x2={clientToLbArrows[i].x2} y2={clientToLbArrows[i].y2}
                stroke={affinityColors[i]} strokeWidth={8} opacity={glowPulse}
                strokeLinecap="round"
              />
              <line
                x1={lbToServerArrows[i].x1} y1={lbToServerArrows[i].y1}
                x2={lbToServerArrows[i].x2} y2={lbToServerArrows[i].y2}
                stroke={affinityColors[i]} strokeWidth={8} opacity={glowPulse}
                strokeLinecap="round"
              />
            </React.Fragment>
          );
        })}
      </svg>

      {/* Clients — colored to match affinity */}
      {clientPositions.map((pos, i) => (
        <ClientDot key={`c-${i}`} x={`${pos.fx * 100}%`} y={`${pos.fy * 100}%`} revealSpring={clientSprings[i]} isActive={flowActive} frame={frame} color={affinityColors[i]} label={`USER ${i + 1}`} />
      ))}

      <LoadBalancerBox springVal={lbSpring} isActive={flowActive} frame={frame} subtitle="Sticky Sessions" />

      {serverPositions.map((pos, i) => (
        <ServerBox key={`s-${i}`} x={`${pos.fx * 100}%`} y={`${pos.fy * 100}%`} label={`S${i + 1}`} springVal={serverSprings[i]} color={affinityColors[i]} isActive={flowActive} frame={frame} delay={i * 0.8} />
      ))}

    </div>
  );
};

// =====================================================================
// SCALE VARIANT COMPONENT
// Starts with 2 servers, adds new ones dynamically
// =====================================================================
const ScaleVariant: React.FC<Omit<TrafficFlowProps, 'variant'>> = ({ sync, frame, keywords }) => {
  const { fps, width, height } = useVideoConfig();
  const p = useReliableProgress(frame, fps, sync);
  const svgW = width;
  const svgH = height;

  const clientPositions = [
    { fx: 0.25, fy: 0.14 }, { fx: 0.50, fy: 0.10 }, { fx: 0.75, fy: 0.14 },
  ];
  const lbCenter = { fx: 0.50, fy: 0.44 };

  // Server positions for up to 5 servers
  const allServerPositions = [
    { fx: 0.20, fy: 0.76 },
    { fx: 0.40, fy: 0.79 },
    { fx: 0.60, fy: 0.76 },
    { fx: 0.80, fy: 0.79 },
    { fx: 0.50, fy: 0.90 },
  ];
  const serverColors = [C.teal, C.indigo, C.gold, C.saffron, C.green];

  // How many servers are visible — SPREAD transitions
  const visibleServerCount = p < 0.35 ? 2
    : p < 0.55 ? 3
    : p < 0.75 ? 4
    : 5;

  const activeServerPositions = allServerPositions.slice(0, visibleServerCount);

  // SPREAD reveals across full scene progress (scale variant)
  const clientRevealP = progressWindow(p, 0, 0.15);
  const clientSprings = [0, 1, 2].map((i) =>
    spring({ frame: Math.max(0, frame - i * 4), fps, config: { damping: 14, stiffness: 120, mass: 0.7 }, from: 0, to: clientRevealP > 0 ? 1 : 0 })
  );

  const lbRevealP = progressWindow(p, 0.15, 0.30);
  const lbSpring = spring({ frame, fps, config: { damping: 12, stiffness: 100, mass: 0.9 }, from: 0, to: lbRevealP > 0 ? 1 : 0 });

  const arrowDrawP = progressWindow(p, 0.30, 0.45);

  const serverSprings = allServerPositions.map((_, i) => {
    // Each new server springs in at its reveal time
    const revealStart = i < 2 ? 0.28 : i === 2 ? 0.35 : i === 3 ? 0.55 : 0.75;
    const revealEnd = revealStart + 0.10;
    const sRevealP = progressWindow(p, revealStart, revealEnd);
    return spring({
      frame: Math.max(0, frame - i * 4),
      fps,
      config: { damping: 13, stiffness: 110, mass: 0.8 },
      from: 0,
      to: sRevealP > 0 ? 1 : 0,
    });
  });

  const flowActive = p > 0.38;
  const dotPeriod = fps * 1.3; // 1.3-second loop

  const clientToLbArrows = clientPositions.map((c) => ({
    x1: c.fx * svgW, y1: (c.fy + 0.04) * svgH,
    x2: lbCenter.fx * svgW, y2: (lbCenter.fy - 0.04) * svgH,
  }));

  const lbToServerArrows = allServerPositions.map((s) => ({
    x1: lbCenter.fx * svgW, y1: (lbCenter.fy + 0.04) * svgH,
    x2: s.fx * svgW, y2: (s.fy - 0.05) * svgH,
  }));

  const activeServerIdx = flowActive ? Math.floor(frame / 18) % visibleServerCount : -1;

  // "Scale-up" alert flashes — SPREAD timing
  const scaleAlerts = [
    { trigger: 0.35, text: '+1 Server (3 total)' },
    { trigger: 0.55, text: '+1 Server (4 total)' },
    { trigger: 0.75, text: '+1 Server (5 total)' },
  ];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'transparent', fontFamily: 'Inter, sans-serif' }}>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }} viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">
        {clientToLbArrows.map((a, i) => (
          <Arrow key={`cin-${i}`} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} drawProgress={arrowDrawP} color={C.gray} pulseFrame={flowActive ? frame : undefined} />
        ))}

        {activeServerPositions.map((_, i) => (
          <Arrow key={`cout-${i}`} x1={lbToServerArrows[i].x1} y1={lbToServerArrows[i].y1} x2={lbToServerArrows[i].x2} y2={lbToServerArrows[i].y2} drawProgress={arrowDrawP} color={serverColors[i]} pulseFrame={flowActive ? frame : undefined} />
        ))}

        {/* Client -> LB dots */}
        {[0, 1, 2].map((i) => {
          const offset = i * Math.floor(dotPeriod / 3) + Math.floor(dotPeriod / 4);
          const rawT = ((frame - offset) % dotPeriod) / dotPeriod;
          const t = rawT < 0 ? rawT + 1 : rawT;
          return (
            <FlowingDot key={`cldot-${i}`} t={t} x1={clientToLbArrows[i].x1} y1={clientToLbArrows[i].y1} x2={clientToLbArrows[i].x2} y2={clientToLbArrows[i].y2} color={C.gray} visible={flowActive} size={4} />
          );
        })}

        {/* Traffic dots — frame-driven, multiple per active server lane */}
        {activeServerPositions.map((_, i) => {
          const dots = [];
          for (let d = 0; d < 2; d++) {
            const offset = i * Math.floor(dotPeriod / activeServerPositions.length) + d * Math.floor(dotPeriod / 2);
            const rawT = ((frame - offset) % dotPeriod) / dotPeriod;
            const t = rawT < 0 ? rawT + 1 : rawT;
            dots.push(
              <FlowingDot key={`dot-${i}-${d}`} t={t} x1={lbToServerArrows[i].x1} y1={lbToServerArrows[i].y1} x2={lbToServerArrows[i].x2} y2={lbToServerArrows[i].y2} color={serverColors[i]} visible={flowActive} />
            );
          }
          return dots;
        })}
      </svg>

      {/* Clients */}
      {clientPositions.map((pos, i) => (
        <ClientDot key={`c-${i}`} x={`${pos.fx * 100}%`} y={`${pos.fy * 100}%`} revealSpring={clientSprings[i]} isActive={flowActive} frame={frame} />
      ))}

      <LoadBalancerBox springVal={lbSpring} isActive={flowActive} frame={frame} subtitle="Auto-Scale" />

      {/* All potentially visible servers */}
      {allServerPositions.map((pos, i) => (
        <ServerBox key={`s-${i}`} x={`${pos.fx * 100}%`} y={`${pos.fy * 100}%`} label={`S${i + 1}`} springVal={serverSprings[i]} color={serverColors[i]} isActive={activeServerIdx === i} frame={frame} delay={i * 0.8}
          status={i >= 2 && serverSprings[i] > 0.3 && serverSprings[i] < 0.9 ? 'new' : undefined}
        />
      ))}

      {/* Scale-up alerts */}
      {scaleAlerts.map((alert, i) => {
        const alertP = progressWindow(p, alert.trigger, alert.trigger + 0.06);
        if (alertP <= 0 || alertP >= 1) return null;
        const alertOpacity = alertP < 0.5 ? alertP * 2 : (1 - alertP) * 2;
        // Slight scale bounce
        const alertScale = 0.8 + 0.2 * Math.min(1, alertP * 3);
        return (
          <div key={`alert-${i}`} style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: `translate(-50%, -50%) scale(${alertScale})`,
            background: `${C.green}22`, border: `2px solid ${C.green}`, borderRadius: 12,
            padding: '12px 28px', zIndex: 20,
            opacity: alertOpacity,
            boxShadow: `0 0 20px ${C.green}44`,
          }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: C.green, fontFamily: 'Inter, sans-serif' }}>
              {alert.text}
            </span>
          </div>
        );
      })}

    </div>
  );
};
