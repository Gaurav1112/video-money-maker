import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';
import type { SyncState } from '../../types';

interface SystemArchVizProps {
  sync: SyncState;
  frame: number;
  keywords: string[];
  variant?: string;
}

const LAYERS = [
  { label: 'Client', color: '#818CF8', icon: '\uD83D\uDDA5\uFE0F', latency: '~2ms', reqRate: '10K' },
  { label: 'API Gateway', color: '#E85D26', icon: '\uD83D\uDD00', latency: '~5ms', reqRate: '8.2K' },
  { label: 'Service', color: '#FFD700', icon: '\u2699\uFE0F', latency: '~50ms', reqRate: '6.1K' },
  { label: 'Database', color: '#20C997', icon: '\uD83D\uDDC4\uFE0F', latency: '~200ms', reqRate: '1.2K' },
];

const THEME = {
  saffron: '#E85D26',
  gold: '#FFD700',
  teal: '#20C997',
  indigo: '#818CF8',
  dark: '#0C0A15',
  darkAlt: '#16132A',
  border: 'rgba(255,255,255,0.08)',
  gray: '#A9ACB3',
  red: '#EF4444',
};

// Helper
function clampVal(v: number, min: number, max: number) { return Math.min(Math.max(v, min), max); }
function pRange(p: number, start: number, end: number) { return clampVal((p - start) / (end - start), 0, 1); }

export const SystemArchViz: React.FC<SystemArchVizProps> = ({ sync, frame, keywords, variant }) => {
  const { fps } = useVideoConfig();
  const progress = sync.sceneProgress;

  // --- VARIANT ROUTING ---
  if (variant === 'failure') return <ArchFailureVariant sync={sync} frame={frame} keywords={keywords} />;
  if (variant === 'scale-up') return <ArchScaleUpVariant sync={sync} frame={frame} keywords={keywords} />;
  if (variant === 'caching') return <ArchCachingVariant sync={sync} frame={frame} keywords={keywords} />;

  // --- DEFAULT variant: 'request-flow' ---

  // Each layer springs in progressively
  const layerSprings = LAYERS.map((_, i) => {
    const triggerProgress = i * 0.2;
    const triggerFrame = Math.round(triggerProgress * fps * 8);
    return spring({
      frame: frame - triggerFrame,
      fps,
      config: { damping: 14, stiffness: 90, mass: 1.1 },
    });
  });

  // Arrow draw progress between layers
  const arrowProgress = LAYERS.slice(0, -1).map((_, i) => {
    const layerRevealProgress = (i + 1) * 0.2;
    return interpolate(progress, [layerRevealProgress, layerRevealProgress + 0.15], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  });

  // Request dot animation — cycles between 0 and 1
  const dotCycle = ((frame * 0.015) % 1 + 1) % 1;

  const containerH = 520;
  const blockH = 72;
  const blockW = 320;
  const gapY = 36;
  const totalBlockSpan = LAYERS.length * blockH + (LAYERS.length - 1) * gapY;
  const startY = (containerH - totalBlockSpan) / 2;

  // Determine which layer the narrator is currently discussing (based on progress)
  const activeLayerIndex = Math.min(LAYERS.length - 1, Math.floor(progress * LAYERS.length));

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: THEME.dark,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 24,
          left: 0,
          right: 0,
          textAlign: 'center',
          color: THEME.gold,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 2,
          opacity: interpolate(layerSprings[0], [0, 1], [0, 1]),
        }}
      >
        SYSTEM ARCHITECTURE
      </div>

      {/* SVG layer — arrows, dots, latency labels */}
      <svg
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        viewBox={`0 0 600 ${containerH + 80}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {LAYERS.slice(0, -1).map((layer, i) => {
          const blockCenterX = 300;
          const topBlockBottom = startY + 60 + i * (blockH + gapY) + blockH;
          const bottomBlockTop = topBlockBottom + gapY;
          const arrowMid = (topBlockBottom + bottomBlockTop) / 2;
          const ap = arrowProgress[i];

          // Arrow line
          const lineY2 = interpolate(ap, [0, 1], [topBlockBottom + 4, bottomBlockTop - 8]);
          const arrowVisible = ap > 0.05;

          // Request dot position along the arrow
          const dotY = interpolate(dotCycle, [0, 1], [topBlockBottom + 4, bottomBlockTop - 8]);
          const dotVisible = ap > 0.9 && progress > (i + 1) * 0.2 + 0.1;

          // Latency for this connection (between layer i and i+1)
          const nextLayer = LAYERS[i + 1];
          const latencyLabel = nextLayer.latency;

          // Bottleneck indicator: show warning if latency >= 200ms
          const isBottleneck = nextLayer.latency.includes('200');

          return (
            <g key={`arrow-${i}`}>
              {arrowVisible && (
                <>
                  <line
                    x1={blockCenterX}
                    y1={topBlockBottom + 4}
                    x2={blockCenterX}
                    y2={lineY2}
                    stroke={THEME.indigo}
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    opacity={0.7}
                  />
                  {/* Arrowhead */}
                  {ap > 0.95 && (
                    <polygon
                      points={`${blockCenterX - 6},${bottomBlockTop - 10} ${blockCenterX + 6},${bottomBlockTop - 10} ${blockCenterX},${bottomBlockTop - 2}`}
                      fill={THEME.indigo}
                      opacity={0.9}
                    />
                  )}
                  {/* Protocol label — left side */}
                  {ap > 0.8 && (
                    <text
                      x={blockCenterX + 16}
                      y={arrowMid + 4}
                      fill={THEME.indigo}
                      fontSize={11}
                      opacity={interpolate(ap, [0.8, 1], [0, 0.8])}
                      fontFamily="Inter, system-ui, sans-serif"
                    >
                      {i === 0 ? 'HTTP/REST' : i === 1 ? 'RPC/gRPC' : 'SQL/NoSQL'}
                    </text>
                  )}
                  {/* Latency label — right side */}
                  {ap > 0.8 && (
                    <g opacity={interpolate(ap, [0.8, 1], [0, 1])}>
                      <rect
                        x={blockCenterX - 100}
                        y={arrowMid - 10}
                        width={52}
                        height={18}
                        rx={4}
                        fill={isBottleneck ? `${THEME.red}22` : `${THEME.gray}15`}
                        stroke={isBottleneck ? THEME.red : `${THEME.gray}44`}
                        strokeWidth={1}
                      />
                      <text
                        x={blockCenterX - 74}
                        y={arrowMid + 3}
                        fill={isBottleneck ? THEME.red : THEME.gray}
                        fontSize={10}
                        fontWeight={600}
                        fontFamily="'JetBrains Mono', 'SF Mono', monospace"
                        textAnchor="middle"
                      >
                        {latencyLabel}
                      </text>
                      {/* Bottleneck warning icon */}
                      {isBottleneck && (
                        <text
                          x={blockCenterX - 104}
                          y={arrowMid + 4}
                          fill={THEME.red}
                          fontSize={12}
                          fontFamily="Inter, system-ui, sans-serif"
                          textAnchor="end"
                          opacity={0.6 + 0.4 * Math.sin(frame * 0.15)}
                        >
                          {'\u26A0'}
                        </text>
                      )}
                    </g>
                  )}
                </>
              )}
              {/* Animated request dot */}
              {dotVisible && (
                <circle
                  cx={blockCenterX}
                  cy={dotY}
                  r={5}
                  fill={THEME.saffron}
                  opacity={0.9}
                  style={{ filter: `drop-shadow(0 0 3px ${THEME.saffron})` }}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Architecture blocks */}
      <div
        style={{
          position: 'relative',
          width: blockW,
          height: containerH,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: gapY,
        }}
      >
        {LAYERS.map((layer, i) => {
          const s = layerSprings[i];
          const isActive = i === activeLayerIndex && progress > 0.05;

          return (
            <div
              key={layer.label}
              style={{
                width: '100%',
                height: blockH,
                borderRadius: 12,
                background: `linear-gradient(135deg, ${layer.color}22, ${layer.color}11)`,
                border: `${isActive ? 2.5 : 1.5}px solid ${isActive ? layer.color : THEME.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '0 20px',
                opacity: interpolate(s, [0, 1], [0, 1]),
                transform: `translateX(${interpolate(s, [0, 1], [60, 0])}px) scale(${interpolate(s, [0, 1], [0.85, 1])})`,
                boxShadow: isActive ? `0 0 24px ${layer.color}55, inset 0 0 12px ${layer.color}11` : 'none',
                flexShrink: 0,
                position: 'relative',
              }}
            >
              <span style={{ fontSize: 28 }}>{layer.icon}</span>
              <div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: layer.color,
                    letterSpacing: 0.5,
                  }}
                >
                  {layer.label}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                  {i === 0
                    ? 'Browser / Mobile App'
                    : i === 1
                    ? 'Load Balancer + Rate Limit'
                    : i === 2
                    ? 'Business Logic Layer'
                    : 'Persistent Storage'}
                </div>
              </div>

              {/* Request rate badge — right side */}
              <div style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <div style={{
                  background: `${layer.color}15`,
                  border: `1px solid ${layer.color}44`,
                  borderRadius: 6,
                  padding: '2px 8px',
                  opacity: interpolate(s, [0, 1], [0, 0.9]),
                }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: layer.color,
                    fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
                  }}>
                    {layer.reqRate}
                  </span>
                  <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginLeft: 2 }}>
                    req/s
                  </span>
                </div>

                {/* Active pulse indicator */}
                {isActive && (
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: layer.color,
                      boxShadow: `0 0 10px ${layer.color}`,
                      opacity: 0.5 + 0.5 * Math.sin(frame * 0.18),
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom progress label */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          color: 'rgba(255,255,255,0.3)',
          fontSize: 11,
          letterSpacing: 1,
        }}
      >
        {Math.round(progress * 100)}% loaded
      </div>
    </div>
  );
};

// =====================================================================
// FAILURE VARIANT
// =====================================================================
const FAILURE_LAYERS = [
  { label: 'Client', color: '#818CF8', icon: '\uD83D\uDDA5\uFE0F', subtitle: 'Browser / Mobile App', reqRate: '10K' },
  { label: 'API Gateway', color: '#E85D26', icon: '\uD83D\uDD00', subtitle: 'Load Balancer + Rate Limit', reqRate: '8.2K' },
  { label: 'Service A', color: '#FFD700', icon: '\u2699\uFE0F', subtitle: 'Order Service', reqRate: '6.1K' },
  { label: 'Service B', color: '#20C997', icon: '\u2699\uFE0F', subtitle: 'Payment Service', reqRate: '0' },
  { label: 'Database', color: '#818CF8', icon: '\uD83D\uDDC4\uFE0F', subtitle: 'Persistent Storage', reqRate: '1.2K' },
];

const ArchFailureVariant: React.FC<Omit<SystemArchVizProps, 'variant'>> = ({ sync, frame }) => {
  const { fps } = useVideoConfig();
  const progress = sync.sceneProgress;

  const normalP = pRange(progress, 0, 0.35);
  const failP = pRange(progress, 0.35, 0.55);
  const cascadeP = pRange(progress, 0.55, 0.75);
  const breakerP = pRange(progress, 0.75, 1.0);

  const layerSprings = FAILURE_LAYERS.map((_, i) => {
    const triggerProgress = i * 0.06;
    const triggerFrame = Math.round(triggerProgress * fps * 8);
    return spring({ frame: frame - triggerFrame, fps, config: { damping: 14, stiffness: 90, mass: 1.1 } });
  });

  const blockH = 62;
  const blockW = 300;

  const getStatus = (i: number): 'normal' | 'failing' | 'down' | 'protected' => {
    if (i === 3 && failP > 0.5) return 'down';
    if (i === 2 && cascadeP > 0.3 && breakerP < 0.5) return 'failing';
    if (i === 2 && breakerP > 0.5) return 'protected';
    return 'normal';
  };

  return (
    <div style={{ width: '100%', height: '100%', background: THEME.dark, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 24, left: 0, right: 0, textAlign: 'center', color: '#EF4444', fontSize: 18, fontWeight: 700, letterSpacing: 2, opacity: interpolate(layerSprings[0], [0, 1], [0, 1]) }}>
        FAILURE CASCADE + CIRCUIT BREAKER
      </div>

      <div style={{ position: 'relative', width: blockW, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, marginTop: 30 }}>
        {FAILURE_LAYERS.map((layer, i) => {
          const s = layerSprings[i];
          const status = getStatus(i);
          const borderColor = status === 'down' ? '#EF4444'
            : status === 'failing' ? THEME.saffron
            : status === 'protected' ? THEME.teal
            : layer.color;
          const bgOpacity = status === 'down' ? '44' : '22';

          return (
            <div key={layer.label} style={{
              width: '100%', height: blockH, borderRadius: 12,
              background: `linear-gradient(135deg, ${borderColor}${bgOpacity}, ${borderColor}11)`,
              border: `1.5px solid ${borderColor}`,
              display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px',
              opacity: interpolate(s, [0, 1], [0, 1]),
              transform: `translateX(${interpolate(s, [0, 1], [60, 0])}px) scale(${interpolate(s, [0, 1], [0.85, 1])})${status === 'failing' ? ` translateX(${Math.sin(frame * 0.5) * 4}px)` : ''}`,
              boxShadow: status === 'down' ? '0 0 20px rgba(239,68,68,0.4)' : status === 'protected' ? `0 0 20px ${THEME.teal}44` : 'none',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 28 }}>{layer.icon}</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: borderColor, letterSpacing: 0.5 }}>{layer.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{layer.subtitle}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Request rate */}
                <div style={{
                  background: `${borderColor}15`,
                  border: `1px solid ${borderColor}44`,
                  borderRadius: 6,
                  padding: '2px 8px',
                }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: status === 'down' ? THEME.red : borderColor,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {status === 'down' ? '0' : layer.reqRate}
                  </span>
                  <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginLeft: 2 }}>req/s</span>
                </div>
                {status !== 'normal' && (
                  <div style={{
                    fontSize: 10, fontWeight: 700,
                    color: status === 'down' ? '#EF4444' : status === 'protected' ? THEME.teal : THEME.saffron,
                    background: status === 'down' ? 'rgba(239,68,68,0.2)' : status === 'protected' ? `${THEME.teal}22` : `${THEME.saffron}22`,
                    padding: '2px 8px', borderRadius: 4,
                  }}>
                    {status === 'down' ? '\u26A0 DOWN' : status === 'protected' ? 'CIRCUIT OPEN' : 'DEGRADED'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Circuit breaker explanation */}
      {breakerP > 0.3 && (
        <div style={{
          position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
          background: `${THEME.teal}22`, border: `1.5px solid ${THEME.teal}`, borderRadius: 10, padding: '10px 24px',
          opacity: breakerP,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: THEME.teal }}>
            Circuit Breaker: returning cached/fallback response
          </span>
        </div>
      )}
    </div>
  );
};

// =====================================================================
// SCALE-UP VARIANT
// =====================================================================
const ArchScaleUpVariant: React.FC<Omit<SystemArchVizProps, 'variant'>> = ({ sync, frame }) => {
  const { fps } = useVideoConfig();
  const progress = sync.sceneProgress;

  const revealP = pRange(progress, 0, 0.2);
  const scaleP = pRange(progress, 0.3, 0.7);
  const metricsP = pRange(progress, 0.7, 1.0);

  const serviceCount = Math.min(4, 1 + Math.floor(scaleP * 3));
  const serviceColors = [THEME.gold, THEME.teal, THEME.saffron, THEME.indigo];

  return (
    <div style={{ width: '100%', height: '100%', background: THEME.dark, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 24, left: 0, right: 0, textAlign: 'center', color: THEME.gold, fontSize: 18, fontWeight: 700, letterSpacing: 2, opacity: revealP }}>
        HORIZONTAL SCALING
      </div>

      {/* Gateway */}
      <div style={{
        position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)',
        width: 260, height: 60, borderRadius: 12,
        background: `${THEME.saffron}22`, border: `1.5px solid ${THEME.saffron}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        opacity: revealP,
      }}>
        <span style={{ fontSize: 28 }}>{'\uD83D\uDD00'}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: THEME.saffron }}>API Gateway</span>
        <div style={{
          marginLeft: 'auto', marginRight: 12,
          background: `${THEME.saffron}15`, border: `1px solid ${THEME.saffron}44`,
          borderRadius: 6, padding: '2px 8px',
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: THEME.saffron, fontFamily: "'JetBrains Mono', monospace" }}>
            {serviceCount * 1000}
          </span>
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginLeft: 2 }}>req/s</span>
        </div>
      </div>

      {/* Service replicas */}
      <div style={{ position: 'absolute', top: 180, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 16 }}>
        {Array.from({ length: serviceCount }).map((_, i) => {
          const sSpring = spring({ frame: Math.max(0, frame - (10 + i * 8)), fps, config: { damping: 12, stiffness: 100 } });
          const isNew = i === serviceCount - 1 && scaleP > 0.1 && scaleP < 0.9;
          return (
            <div key={i} style={{
              width: 100, height: 70, borderRadius: 10,
              background: `${serviceColors[i]}22`, border: `1.5px solid ${serviceColors[i]}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              opacity: sSpring, transform: `scale(${sSpring})`,
              boxShadow: isNew ? `0 0 16px ${serviceColors[i]}66` : 'none',
            }}>
              <span style={{ fontSize: 22 }}>{'\u2699\uFE0F'}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: serviceColors[i] }}>Replica {i + 1}</span>
              {isNew && <span style={{ fontSize: 9, color: '#22C55E', fontWeight: 700 }}>NEW</span>}
            </div>
          );
        })}
      </div>

      {/* Database */}
      <div style={{
        position: 'absolute', top: 310, left: '50%', transform: 'translateX(-50%)',
        width: 260, height: 60, borderRadius: 12,
        background: `${THEME.teal}22`, border: `1.5px solid ${THEME.teal}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        opacity: revealP,
      }}>
        <span style={{ fontSize: 28 }}>{'\uD83D\uDDC4\uFE0F'}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: THEME.teal }}>Database</span>
        <div style={{
          marginLeft: 'auto', marginRight: 12,
          background: `${THEME.teal}15`, border: `1px solid ${THEME.teal}44`,
          borderRadius: 6, padding: '2px 8px',
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: THEME.teal, fontFamily: "'JetBrains Mono', monospace" }}>
            1.2K
          </span>
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginLeft: 2 }}>req/s</span>
        </div>
      </div>

      {/* Throughput metric */}
      {metricsP > 0 && (
        <div style={{
          position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 20, opacity: metricsP,
        }}>
          <div style={{ background: `${THEME.gold}22`, border: `1px solid ${THEME.gold}`, borderRadius: 8, padding: '8px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: THEME.gold }}>{serviceCount * 1000}</div>
            <div style={{ fontSize: 10, color: THEME.gray }}>req/sec</div>
          </div>
          <div style={{ background: `${THEME.teal}22`, border: `1px solid ${THEME.teal}`, borderRadius: 8, padding: '8px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: THEME.teal }}>{Math.round(25 / serviceCount)}ms</div>
            <div style={{ fontSize: 10, color: THEME.gray }}>P99 latency</div>
          </div>
        </div>
      )}
    </div>
  );
};

// =====================================================================
// CACHING VARIANT
// =====================================================================
const ArchCachingVariant: React.FC<Omit<SystemArchVizProps, 'variant'>> = ({ sync, frame }) => {
  const { fps } = useVideoConfig();
  const progress = sync.sceneProgress;

  const normalP = pRange(progress, 0, 0.25);
  const slowP = pRange(progress, 0.25, 0.45);
  const cacheAddP = pRange(progress, 0.45, 0.65);
  const cacheHitP = pRange(progress, 0.65, 1.0);

  const showCache = cacheAddP > 0;
  const isCacheHit = cacheHitP > 0.3;

  const cacheSpring = spring({ frame: frame - Math.round(0.5 * fps * 8), fps, config: { damping: 12, stiffness: 100, mass: 0.9 } });

  const latencyWithout = '200ms';
  const latencyWith = '3ms';

  return (
    <div style={{ width: '100%', height: '100%', background: THEME.dark, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 24, left: 0, right: 0, textAlign: 'center', color: '#EF4444', fontSize: 18, fontWeight: 700, letterSpacing: 2, opacity: normalP }}>
        CACHING LAYER
      </div>

      {/* Service */}
      <div style={{
        position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)',
        width: 260, height: 60, borderRadius: 12,
        background: `${THEME.gold}22`, border: `1.5px solid ${THEME.gold}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        opacity: normalP,
      }}>
        <span style={{ fontSize: 28 }}>{'\u2699\uFE0F'}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: THEME.gold }}>Service</span>
        <div style={{
          marginLeft: 'auto', marginRight: 12,
          background: `${THEME.gold}15`, border: `1px solid ${THEME.gold}44`,
          borderRadius: 6, padding: '2px 8px',
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: THEME.gold, fontFamily: "'JetBrains Mono', monospace" }}>
            6.1K
          </span>
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginLeft: 2 }}>req/s</span>
        </div>
      </div>

      {/* Cache (Redis) */}
      {showCache && (
        <div style={{
          position: 'absolute', top: 170, left: '50%', transform: `translateX(-50%) scale(${cacheSpring})`,
          width: 260, height: 60, borderRadius: 12,
          background: 'rgba(239,68,68,0.15)', border: '1.5px solid #EF4444',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          opacity: cacheSpring, boxShadow: isCacheHit ? '0 0 20px rgba(239,68,68,0.4)' : 'none',
        }}>
          <span style={{ fontSize: 28 }}>{'\u26A1'}</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#EF4444' }}>Redis Cache</span>
          {isCacheHit && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#22C55E', background: 'rgba(34,197,94,0.2)', padding: '2px 8px', borderRadius: 4 }}>HIT!</span>
          )}
          {/* Latency label on cache */}
          <div style={{
            marginLeft: 'auto', marginRight: 12,
            background: isCacheHit ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${isCacheHit ? '#22C55E44' : '#EF444444'}`,
            borderRadius: 6, padding: '2px 8px',
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: isCacheHit ? '#22C55E' : '#EF4444',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {isCacheHit ? '~3ms' : '~5ms'}
            </span>
          </div>
        </div>
      )}

      {/* Database */}
      <div style={{
        position: 'absolute', top: showCache ? 290 : 200, left: '50%', transform: 'translateX(-50%)',
        width: 260, height: 60, borderRadius: 12,
        background: `${THEME.teal}22`, border: `1.5px solid ${THEME.teal}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        opacity: isCacheHit ? 0.3 : normalP, transition: 'opacity 0.3s',
      }}>
        <span style={{ fontSize: 28 }}>{'\uD83D\uDDC4\uFE0F'}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: THEME.teal }}>Database</span>
        {isCacheHit && <span style={{ fontSize: 11, color: THEME.gray }}>(skipped)</span>}
        {/* Latency label */}
        <div style={{
          marginLeft: 'auto', marginRight: 12,
          background: `${THEME.red}22`,
          border: `1px solid ${THEME.red}44`,
          borderRadius: 6, padding: '2px 8px',
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: THEME.red,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            ~200ms
          </span>
        </div>
      </div>

      {/* Latency comparison */}
      {(slowP > 0 || cacheHitP > 0) && (
        <div style={{
          position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 24,
        }}>
          <div style={{
            background: `${THEME.saffron}22`, border: `1px solid ${THEME.saffron}`, borderRadius: 8, padding: '8px 16px', textAlign: 'center',
            opacity: slowP > 0 ? 1 : 0.4,
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: THEME.saffron }}>{latencyWithout}</div>
            <div style={{ fontSize: 10, color: THEME.gray }}>Without Cache</div>
          </div>
          {showCache && (
            <div style={{
              background: 'rgba(34,197,94,0.15)', border: '1px solid #22C55E', borderRadius: 8, padding: '8px 16px', textAlign: 'center',
              opacity: cacheHitP,
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#22C55E' }}>{latencyWith}</div>
              <div style={{ fontSize: 10, color: THEME.gray }}>Cache HIT</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
