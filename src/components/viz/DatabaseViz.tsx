import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';
import type { SyncState } from '../../types';

const C = {
  saffron: '#E85D26',
  gold: '#FDB813',
  teal: '#1DD1A1',
  indigo: '#818CF8',
  gray: '#A9ACB3',
  dark: '#0C0A15',
  darkAlt: '#1A1625',
  white: '#FFFFFF',
  red: '#EF4444',
  green: '#22C55E',
};

interface DatabaseVizProps {
  sync: SyncState;
  frame: number;
  keywords: string[];
  variant?: string;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function progressWindow(p: number, start: number, end: number) {
  return clamp((p - start) / (end - start), 0, 1);
}

function useReliableProgress(frame: number, fps: number, sync: SyncState): number {
  if (sync.sceneProgress > 0.01 && sync.sceneProgress < 0.99) {
    return sync.sceneProgress;
  }
  const assumedDuration = 8 * fps;
  return Math.min(1, frame / assumedDuration);
}

// ---- Sub-components ----

interface DbNodeProps {
  x: string;
  y: string;
  label: string;
  sublabel?: string;
  width: number;
  height: number;
  borderColor: string;
  springVal: number;
  isActive: boolean;
  frame: number;
  isDead?: boolean;
}

const DbNode: React.FC<DbNodeProps> = ({
  x, y, label, sublabel, width, height, borderColor, springVal, isActive, frame, isDead,
}) => {
  const glow = isActive ? 0.4 + 0.4 * Math.sin(frame * 0.12) : 0.2;
  const shake = isDead ? Math.sin(frame * 0.5) * 4 : 0;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${springVal}) translateX(${shake}px)`,
        opacity: isDead ? 0.3 : springVal,
        width,
        height,
        borderRadius: 12,
        background: `linear-gradient(160deg, ${borderColor}15, ${borderColor}28)`,
        border: `2.5px solid ${borderColor}`,
        boxShadow: `0 0 ${20 * glow}px ${borderColor}66`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Cylinder icon */}
      <svg width={32} height={28} viewBox="0 0 32 28">
        <ellipse cx={16} cy={6} rx={12} ry={5} fill={`${borderColor}44`} stroke={borderColor} strokeWidth={1.5} />
        <rect x={4} y={6} width={24} height={16} fill={`${borderColor}22`} />
        <line x1={4} y1={6} x2={4} y2={22} stroke={borderColor} strokeWidth={1.5} />
        <line x1={28} y1={6} x2={28} y2={22} stroke={borderColor} strokeWidth={1.5} />
        <ellipse cx={16} cy={22} rx={12} ry={5} fill={`${borderColor}33`} stroke={borderColor} strokeWidth={1.5} />
        {/* Data rows blinking */}
        {[10, 14, 18].map((row, i) => (
          <rect
            key={i}
            x={8}
            y={row}
            width={16}
            height={2}
            rx={1}
            fill={isActive && i === Math.floor(frame / 10) % 3 ? borderColor : `${borderColor}55`}
          />
        ))}
      </svg>
      <span style={{ fontSize: 13, fontWeight: 700, color: borderColor, letterSpacing: 0.5 }}>
        {label}
      </span>
      {sublabel && (
        <span style={{ fontSize: 9, color: C.gray, letterSpacing: 0.5 }}>
          {sublabel}
        </span>
      )}
      {isDead && (
        <div style={{
          position: 'absolute', top: -14, right: -10,
          fontSize: 9, fontWeight: 700, color: C.white,
          background: C.red, borderRadius: 4, padding: '1px 6px',
        }}>
          DOWN
        </div>
      )}
    </div>
  );
};

interface FlowArrowProps {
  x1: number; y1: number; x2: number; y2: number;
  progress: number; color: string; frame: number;
  dashed?: boolean; label?: string;
}

const FlowArrow: React.FC<FlowArrowProps> = ({ x1, y1, x2, y2, progress, color, frame, dashed, label }) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const drawnLen = length * progress;
  if (drawnLen < 2) return null;

  const ex = x1 + (dx / length) * drawnLen;
  const ey = y1 + (dy / length) * drawnLen;
  const showHead = progress > 0.85;
  const headSize = 8;
  const angle = Math.atan2(dy, dx);
  const hx1 = ex - headSize * Math.cos(angle - Math.PI / 6);
  const hy1 = ey - headSize * Math.sin(angle - Math.PI / 6);
  const hx2 = ex - headSize * Math.cos(angle + Math.PI / 6);
  const hy2 = ey - headSize * Math.sin(angle + Math.PI / 6);
  const pulse = 0.5 + 0.3 * Math.sin(frame * 0.06);

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  return (
    <g>
      <line
        x1={x1} y1={y1} x2={ex} y2={ey}
        stroke={color} strokeWidth={2.5} strokeLinecap="round"
        strokeDasharray={dashed ? '6 4' : undefined}
        opacity={pulse}
      />
      {showHead && (
        <polygon points={`${ex},${ey} ${hx1},${hy1} ${hx2},${hy2}`} fill={color} opacity={0.9} />
      )}
      {label && progress > 0.5 && (
        <text x={midX} y={midY - 8} fill={color} fontSize={10} fontWeight={600}
          fontFamily="Inter, sans-serif" textAnchor="middle" opacity={0.8}>
          {label}
        </text>
      )}
    </g>
  );
};

interface DataPacketProps {
  t: number; x1: number; y1: number; x2: number; y2: number;
  color: string; visible: boolean;
}

const DataPacket: React.FC<DataPacketProps> = ({ t, x1, y1, x2, y2, color, visible }) => {
  if (!visible) return null;
  const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  const cx = x1 + (x2 - x1) * eased;
  const cy = y1 + (y2 - y1) * eased;
  const alpha = t < 0.1 ? t / 0.1 : t > 0.9 ? (1 - t) / 0.1 : 1;

  return (
    <g>
      <rect x={cx - 6} y={cy - 4} width={12} height={8} rx={2}
        fill={color} opacity={alpha * 0.85}
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
      <rect x={cx - 3} y={cy - 2} width={6} height={1.5} rx={0.5}
        fill={C.white} opacity={alpha * 0.6}
      />
      <rect x={cx - 3} y={cy + 0.5} width={4} height={1.5} rx={0.5}
        fill={C.white} opacity={alpha * 0.4}
      />
    </g>
  );
};

// =====================================================================
// REPLICATION VARIANT (default)
// =====================================================================
const ReplicationVariant: React.FC<Omit<DatabaseVizProps, 'variant'>> = ({ sync, frame }) => {
  const { fps, width, height } = useVideoConfig();
  const p = useReliableProgress(frame, fps, sync);
  const svgW = width;
  const svgH = height;

  // Positions
  const primary = { fx: 0.25, fy: 0.45 };
  const replicas = [
    { fx: 0.70, fy: 0.20 },
    { fx: 0.75, fy: 0.50 },
    { fx: 0.70, fy: 0.80 },
  ];
  const clientPos = { fx: 0.05, fy: 0.20 };

  // Reveals — SPREAD across full 0-1 scene progress
  const primaryRevealP = progressWindow(p, 0, 0.20);
  const primarySpring = spring({
    frame, fps,
    config: { damping: 12, stiffness: 100, mass: 0.9 },
    from: 0, to: primaryRevealP > 0 ? 1 : 0,
  });

  const replicaRevealP = progressWindow(p, 0.20, 0.40);
  const replicaSprings = replicas.map((_, i) =>
    spring({
      frame: Math.max(0, frame - i * 6), fps,
      config: { damping: 13, stiffness: 110, mass: 0.8 },
      from: 0, to: replicaRevealP > 0 ? 1 : 0,
    })
  );

  const arrowDrawP = progressWindow(p, 0.40, 0.60);
  const flowActive = p > 0.60;
  const dotPeriod = fps * 1.8;

  // Write arrows: client -> primary
  const writeArrow = {
    x1: clientPos.fx * svgW + 40, y1: clientPos.fy * svgH,
    x2: primary.fx * svgW - 60, y2: primary.fy * svgH,
  };

  // Replication arrows: primary -> each replica
  const repArrows = replicas.map((r) => ({
    x1: primary.fx * svgW + 60, y1: primary.fy * svgH,
    x2: r.fx * svgW - 50, y2: r.fy * svgH,
  }));

  // Read arrows: replicas back (shown as labels)
  const readClientPositions = [
    { fx: 0.92, fy: 0.20 },
    { fx: 0.95, fy: 0.50 },
    { fx: 0.92, fy: 0.80 },
  ];

  const readArrows = replicas.map((r, i) => ({
    x1: r.fx * svgW + 50, y1: r.fy * svgH,
    x2: readClientPositions[i].fx * svgW, y2: readClientPositions[i].fy * svgH,
  }));

  // Active replica cycles
  const activeReplicaIdx = flowActive ? Math.floor(frame / 25) % 3 : -1;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'transparent', fontFamily: 'Inter, sans-serif' }}>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}
        viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">

        {/* Write arrow */}
        <FlowArrow {...writeArrow} progress={arrowDrawP} color={C.saffron} frame={frame} label="WRITE" />

        {/* Replication arrows */}
        {repArrows.map((a, i) => (
          <FlowArrow key={`rep-${i}`} {...a} progress={arrowDrawP} color={C.gold} frame={frame}
            label={i === 1 ? 'REPLICATE' : undefined} />
        ))}

        {/* Read arrows */}
        {readArrows.map((a, i) => (
          <FlowArrow key={`read-${i}`} {...a} progress={arrowDrawP} color={C.teal} frame={frame}
            dashed label={i === 0 ? 'READ' : undefined} />
        ))}

        {/* Write packets */}
        {[0, 1].map((d) => {
          const offset = d * Math.floor(dotPeriod / 2);
          const rawT = ((frame - offset) % dotPeriod) / dotPeriod;
          const t = rawT < 0 ? rawT + 1 : rawT;
          return (
            <DataPacket key={`wp-${d}`} t={t}
              x1={writeArrow.x1} y1={writeArrow.y1}
              x2={writeArrow.x2} y2={writeArrow.y2}
              color={C.saffron} visible={flowActive}
            />
          );
        })}

        {/* Replication packets */}
        {repArrows.map((a, i) => {
          const dots = [];
          for (let d = 0; d < 2; d++) {
            const offset = i * Math.floor(dotPeriod / 3) + d * Math.floor(dotPeriod / 2) + Math.floor(dotPeriod / 4);
            const rawT = ((frame - offset) % dotPeriod) / dotPeriod;
            const t = rawT < 0 ? rawT + 1 : rawT;
            dots.push(
              <DataPacket key={`rp-${i}-${d}`} t={t}
                x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
                color={C.gold} visible={flowActive}
              />
            );
          }
          return dots;
        })}

        {/* Read packets from active replica */}
        {activeReplicaIdx >= 0 && [0, 1].map((d) => {
          const a = readArrows[activeReplicaIdx];
          const offset = d * Math.floor(dotPeriod / 2);
          const rawT = ((frame - offset) % dotPeriod) / dotPeriod;
          const t = rawT < 0 ? rawT + 1 : rawT;
          return (
            <DataPacket key={`rdp-${d}`} t={t}
              x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
              color={C.teal} visible={flowActive}
            />
          );
        })}
      </svg>

      {/* Client write node */}
      <div style={{
        position: 'absolute', left: `${clientPos.fx * 100}%`, top: `${clientPos.fy * 100}%`,
        transform: `translate(-50%, -50%) scale(${primarySpring})`,
        opacity: primarySpring,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}>
        <div style={{
          width: 36, height: 26, borderRadius: 6,
          background: `${C.saffron}33`, border: `2px solid ${C.saffron}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 14, color: C.saffron }}>W</span>
        </div>
        <span style={{ fontSize: 10, color: C.saffron, fontWeight: 600 }}>WRITER</span>
      </div>

      {/* Read clients */}
      {readClientPositions.map((pos, i) => (
        <div key={`rc-${i}`} style={{
          position: 'absolute', left: `${pos.fx * 100}%`, top: `${pos.fy * 100}%`,
          transform: `translate(-50%, -50%) scale(${replicaSprings[i]})`,
          opacity: replicaSprings[i],
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}>
          <div style={{
            width: 30, height: 22, borderRadius: 5,
            background: `${C.teal}33`, border: `2px solid ${C.teal}`,
            boxShadow: activeReplicaIdx === i ? `0 0 10px ${C.teal}66` : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 11, color: C.teal }}>R</span>
          </div>
          <span style={{ fontSize: 9, color: C.teal, fontWeight: 600 }}>READ</span>
        </div>
      ))}

      {/* Primary DB */}
      <DbNode x={`${primary.fx * 100}%`} y={`${primary.fy * 100}%`}
        label="PRIMARY" sublabel="Read/Write"
        width={120} height={100} borderColor={C.gold}
        springVal={primarySpring} isActive={flowActive} frame={frame}
      />

      {/* Replicas */}
      {replicas.map((r, i) => (
        <DbNode key={`rep-${i}`} x={`${r.fx * 100}%`} y={`${r.fy * 100}%`}
          label={`REPLICA ${i + 1}`} sublabel="Read Only"
          width={100} height={80} borderColor={C.teal}
          springVal={replicaSprings[i]} isActive={activeReplicaIdx === i} frame={frame}
        />
      ))}

      {/* Replication lag indicator */}
      {flowActive && (
        <div style={{
          position: 'absolute', bottom: '6%', left: '50%', transform: 'translateX(-50%)',
          background: `${C.gold}18`, border: `1.5px solid ${C.gold}55`, borderRadius: 8,
          padding: '6px 20px', display: 'flex', gap: 16, alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, color: C.gray }}>Replication Lag:</span>
          <span style={{
            fontSize: 13, fontWeight: 700, color: C.green,
            fontFamily: 'Inter, sans-serif',
          }}>
            {(2 + Math.sin(frame * 0.03) * 1.5).toFixed(1)}ms
          </span>
        </div>
      )}
    </div>
  );
};

// =====================================================================
// SHARDING VARIANT
// =====================================================================
const ShardingVariant: React.FC<Omit<DatabaseVizProps, 'variant'>> = ({ sync, frame }) => {
  const { fps, width, height } = useVideoConfig();
  const p = useReliableProgress(frame, fps, sync);
  const svgW = width;
  const svgH = height;

  const routerPos = { fx: 0.50, fy: 0.20 };
  const shards = [
    { fx: 0.20, fy: 0.65, label: 'SHARD A', range: 'Users A-H', color: C.saffron },
    { fx: 0.50, fy: 0.70, label: 'SHARD B', range: 'Users I-P', color: C.gold },
    { fx: 0.80, fy: 0.65, label: 'SHARD C', range: 'Users Q-Z', color: C.teal },
  ];

  const routerRevealP = progressWindow(p, 0, 0.20);
  const routerSpring = spring({ frame, fps, config: { damping: 12, stiffness: 100, mass: 0.9 }, from: 0, to: routerRevealP > 0 ? 1 : 0 });

  const shardRevealP = progressWindow(p, 0.20, 0.40);
  const shardSprings = shards.map((_, i) =>
    spring({ frame: Math.max(0, frame - i * 6), fps, config: { damping: 13, stiffness: 110, mass: 0.8 }, from: 0, to: shardRevealP > 0 ? 1 : 0 })
  );

  const arrowDrawP = progressWindow(p, 0.40, 0.60);
  const flowActive = p > 0.60;
  const dotPeriod = fps * 1.5;

  const arrows = shards.map((s) => ({
    x1: routerPos.fx * svgW, y1: routerPos.fy * svgH + 40,
    x2: s.fx * svgW, y2: s.fy * svgH - 50,
  }));

  const activeShard = flowActive ? Math.floor(frame / 22) % 3 : -1;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'transparent', fontFamily: 'Inter, sans-serif' }}>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}
        viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">

        {arrows.map((a, i) => (
          <FlowArrow key={`sa-${i}`} {...a} progress={arrowDrawP} color={shards[i].color} frame={frame} />
        ))}

        {arrows.map((a, i) => {
          const dots = [];
          for (let d = 0; d < 2; d++) {
            const offset = i * Math.floor(dotPeriod / 3) + d * Math.floor(dotPeriod / 2);
            const rawT = ((frame - offset) % dotPeriod) / dotPeriod;
            const t = rawT < 0 ? rawT + 1 : rawT;
            dots.push(
              <DataPacket key={`sp-${i}-${d}`} t={t}
                x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
                color={shards[i].color} visible={flowActive && activeShard === i}
              />
            );
          }
          return dots;
        })}

        {/* Hash function visualization */}
        {flowActive && (
          <g>
            <rect x={svgW * 0.38} y={svgH * 0.38} width={svgW * 0.24} height={28} rx={6}
              fill={`${C.indigo}22`} stroke={C.indigo} strokeWidth={1.5} />
            <text x={svgW * 0.50} y={svgH * 0.38 + 18} fill={C.indigo} fontSize={11}
              fontWeight={600} fontFamily="Inter, sans-serif" textAnchor="middle">
              hash(key) % 3
            </text>
          </g>
        )}
      </svg>

      {/* Router */}
      <div style={{
        position: 'absolute', left: `${routerPos.fx * 100}%`, top: `${routerPos.fy * 100}%`,
        transform: `translate(-50%, -50%) scale(${routerSpring})`,
        opacity: routerSpring,
        width: 130, height: 50, borderRadius: 10,
        background: `linear-gradient(135deg, ${C.indigo}22, ${C.indigo}33)`,
        border: `2.5px solid ${C.indigo}`,
        boxShadow: flowActive ? `0 0 16px ${C.indigo}44` : 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.indigo }}>SHARD ROUTER</span>
        <span style={{ fontSize: 9, color: C.gray }}>Consistent Hashing</span>
      </div>

      {/* Shards */}
      {shards.map((s, i) => (
        <React.Fragment key={`shard-${i}`}>
          <DbNode x={`${s.fx * 100}%`} y={`${s.fy * 100}%`}
            label={s.label} sublabel={s.range}
            width={110} height={90} borderColor={s.color}
            springVal={shardSprings[i]} isActive={activeShard === i} frame={frame}
          />
          {/* Data volume bar under each shard */}
          {shardSprings[i] > 0.5 && (
            <div style={{
              position: 'absolute',
              left: `${s.fx * 100}%`, top: `${(s.fy + 0.09) * 100}%`,
              transform: 'translate(-50%, 0)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              opacity: shardSprings[i],
            }}>
              <div style={{
                width: 80, height: 6, borderRadius: 3, background: `${C.gray}33`, overflow: 'hidden',
              }}>
                <div style={{
                  width: `${30 + i * 15 + Math.sin(frame * 0.04 + i) * 5}%`,
                  height: '100%', borderRadius: 3, background: s.color,
                }} />
              </div>
              <span style={{ fontSize: 9, color: C.gray }}>
                {Math.floor(28 + i * 8 + Math.sin(frame * 0.03 + i) * 3)}GB
              </span>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// =====================================================================
// FAILOVER VARIANT
// =====================================================================
const FailoverVariant: React.FC<Omit<DatabaseVizProps, 'variant'>> = ({ sync, frame }) => {
  const { fps, width, height } = useVideoConfig();
  const p = useReliableProgress(frame, fps, sync);
  const svgW = width;
  const svgH = height;

  const primary = { fx: 0.30, fy: 0.35 };
  const standby = { fx: 0.70, fy: 0.35 };
  const clientPos = { fx: 0.50, fy: 0.10 };

  // Phase: normal -> failure -> promotion
  const failureP = progressWindow(p, 0.35, 0.50);
  const promotionP = progressWindow(p, 0.55, 0.70);
  const primaryDead = failureP > 0.8;
  const standbyPromoted = promotionP > 0.5;

  const revealP = progressWindow(p, 0, 0.10);
  const nodeSpring = spring({ frame, fps, config: { damping: 12, stiffness: 100, mass: 0.9 }, from: 0, to: revealP > 0 ? 1 : 0 });

  const arrowDrawP = progressWindow(p, 0.08, 0.18);
  const flowActive = p > 0.15;
  const dotPeriod = fps * 1.5;

  // Traffic goes to primary normally, then switches to standby after promotion
  const target = standbyPromoted ? standby : primary;
  const trafficArrow = {
    x1: clientPos.fx * svgW, y1: clientPos.fy * svgH + 30,
    x2: target.fx * svgW, y2: target.fy * svgH - 50,
  };

  // Heartbeat arrow between primary and standby
  const heartbeatArrow = {
    x1: primary.fx * svgW + 60, y1: primary.fy * svgH,
    x2: standby.fx * svgW - 60, y2: standby.fy * svgH,
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'transparent', fontFamily: 'Inter, sans-serif' }}>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}
        viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">

        {/* Traffic arrow */}
        <FlowArrow {...trafficArrow} progress={arrowDrawP} color={standbyPromoted ? C.teal : C.saffron} frame={frame}
          label={standbyPromoted ? 'REDIRECTED' : 'TRAFFIC'} />

        {/* Heartbeat */}
        {!primaryDead && (
          <FlowArrow {...heartbeatArrow} progress={arrowDrawP} color={C.green} frame={frame} dashed label="HEARTBEAT" />
        )}

        {/* Heartbeat pulse dots */}
        {!primaryDead && flowActive && (
          <circle
            cx={(heartbeatArrow.x1 + heartbeatArrow.x2) / 2}
            cy={(heartbeatArrow.y1 + heartbeatArrow.y2) / 2}
            r={4 + 3 * Math.sin(frame * 0.15)}
            fill={C.green}
            opacity={0.4 + 0.4 * Math.sin(frame * 0.15)}
          />
        )}

        {/* Dead X on primary */}
        {primaryDead && (
          <g opacity={0.6 + 0.4 * Math.sin(frame * 0.1)}>
            <line x1={primary.fx * svgW - 30} y1={primary.fy * svgH - 30}
              x2={primary.fx * svgW + 30} y2={primary.fy * svgH + 30}
              stroke={C.red} strokeWidth={4} />
            <line x1={primary.fx * svgW + 30} y1={primary.fy * svgH - 30}
              x2={primary.fx * svgW - 30} y2={primary.fy * svgH + 30}
              stroke={C.red} strokeWidth={4} />
          </g>
        )}

        {/* Traffic packets */}
        {flowActive && [0, 1].map((d) => {
          const offset = d * Math.floor(dotPeriod / 2);
          const rawT = ((frame - offset) % dotPeriod) / dotPeriod;
          const t = rawT < 0 ? rawT + 1 : rawT;
          return (
            <DataPacket key={`tp-${d}`} t={t}
              x1={trafficArrow.x1} y1={trafficArrow.y1}
              x2={trafficArrow.x2} y2={trafficArrow.y2}
              color={standbyPromoted ? C.teal : C.saffron} visible
            />
          );
        })}
      </svg>

      {/* Client */}
      <div style={{
        position: 'absolute', left: `${clientPos.fx * 100}%`, top: `${clientPos.fy * 100}%`,
        transform: `translate(-50%, -50%) scale(${nodeSpring})`, opacity: nodeSpring,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}>
        <div style={{
          width: 40, height: 28, borderRadius: 6,
          background: `${C.indigo}33`, border: `2px solid ${C.indigo}`,
        }} />
        <span style={{ fontSize: 10, color: C.indigo, fontWeight: 600 }}>APPLICATION</span>
      </div>

      {/* Primary DB */}
      <DbNode x={`${primary.fx * 100}%`} y={`${primary.fy * 100}%`}
        label="PRIMARY" sublabel={primaryDead ? 'FAILED' : 'Active'}
        width={120} height={100} borderColor={primaryDead ? C.red : C.gold}
        springVal={nodeSpring} isActive={!primaryDead && flowActive} frame={frame}
        isDead={primaryDead}
      />

      {/* Standby/Promoted DB */}
      <DbNode x={`${standby.fx * 100}%`} y={`${standby.fy * 100}%`}
        label={standbyPromoted ? 'NEW PRIMARY' : 'STANDBY'}
        sublabel={standbyPromoted ? 'Promoted!' : 'Hot Standby'}
        width={120} height={100}
        borderColor={standbyPromoted ? C.gold : C.teal}
        springVal={nodeSpring}
        isActive={standbyPromoted && flowActive} frame={frame}
      />

      {/* Status banner */}
      {failureP > 0.3 && (
        <div style={{
          position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)',
          background: standbyPromoted ? `${C.green}22` : `${C.red}22`,
          border: `2px solid ${standbyPromoted ? C.green : C.red}`,
          borderRadius: 10, padding: '10px 24px',
          opacity: interpolate(failureP, [0.3, 0.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: standbyPromoted ? C.green : C.red }}>
            {standbyPromoted ? 'FAILOVER COMPLETE - Standby Promoted' : 'PRIMARY FAILURE DETECTED'}
          </span>
        </div>
      )}
    </div>
  );
};

// =====================================================================
// MAIN EXPORT
// =====================================================================
export const DatabaseViz: React.FC<DatabaseVizProps> = (props) => {
  if (props.variant === 'sharding') return <ShardingVariant {...props} />;
  if (props.variant === 'failover') return <FailoverVariant {...props} />;
  return <ReplicationVariant {...props} />;
};
