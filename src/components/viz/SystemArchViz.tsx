import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';
import type { SyncState } from '../../types';

interface SystemArchVizProps {
  sync: SyncState;
  frame: number;
  keywords: string[];
}

const LAYERS = [
  { label: 'Client', color: '#818CF8', icon: '🖥️' },
  { label: 'API Gateway', color: '#E85D26', icon: '🔀' },
  { label: 'Service', color: '#FFD700', icon: '⚙️' },
  { label: 'Database', color: '#20C997', icon: '🗄️' },
];

const THEME = {
  saffron: '#E85D26',
  gold: '#FFD700',
  teal: '#20C997',
  indigo: '#818CF8',
  dark: '#0C0A15',
  darkAlt: '#16132A',
  border: 'rgba(255,255,255,0.08)',
};

export const SystemArchViz: React.FC<SystemArchVizProps> = ({ sync, frame }) => {
  const { fps } = useVideoConfig();
  const progress = sync.sceneProgress;

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

      {/* SVG layer — arrows and dots */}
      <svg
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        viewBox={`0 0 600 ${containerH + 80}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {LAYERS.slice(0, -1).map((_, i) => {
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
                  {/* Label */}
                  {ap > 0.8 && (
                    <text
                      x={blockCenterX + 14}
                      y={arrowMid + 4}
                      fill={THEME.indigo}
                      fontSize={11}
                      opacity={interpolate(ap, [0.8, 1], [0, 0.8])}
                      fontFamily="Inter, system-ui, sans-serif"
                    >
                      {i === 0 ? 'HTTP/REST' : i === 1 ? 'RPC/gRPC' : 'SQL/NoSQL'}
                    </text>
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
          const isActive =
            progress > i * 0.2 + 0.05 && progress < (i + 1) * 0.2 + 0.3;

          return (
            <div
              key={layer.label}
              style={{
                width: '100%',
                height: blockH,
                borderRadius: 12,
                background: `linear-gradient(135deg, ${layer.color}22, ${layer.color}11)`,
                border: `1.5px solid ${isActive ? layer.color : THEME.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '0 20px',
                opacity: interpolate(s, [0, 1], [0, 1]),
                transform: `translateX(${interpolate(s, [0, 1], [60, 0])}px) scale(${interpolate(s, [0, 1], [0.85, 1])})`,
                boxShadow: isActive ? `0 0 20px ${layer.color}44` : 'none',
                transition: 'box-shadow 0.3s',
                flexShrink: 0,
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
              {/* Right-side ping indicator */}
              {isActive && (
                <div
                  style={{
                    marginLeft: 'auto',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: layer.color,
                    boxShadow: `0 0 8px ${layer.color}`,
                    opacity: 0.5 + 0.5 * Math.sin(frame * 0.18),
                  }}
                />
              )}
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
