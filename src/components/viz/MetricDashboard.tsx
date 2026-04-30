import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';
import type { SyncState } from '../../types';

interface MetricDashboardProps {
  sync: SyncState;
  frame: number;
  keywords: string[];
  variant?: string;
}

const THEME = {
  saffron: '#E85D26',
  gold: '#FFD700',
  teal: '#20C997',
  indigo: '#818CF8',
  dark: '#0C0A15',
  darkAlt: '#16132A',
  gray: '#A9ACB3',
};

// easeOutExpo easing
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

interface MetricConfig {
  label: string;
  value: number;
  unit: string;
  color: string;
  triggerProgress: number;
  decimals: number;
  suffix: string;
  icon: string;
  description: string;
}

const METRICS: MetricConfig[] = [
  {
    label: 'Users',
    value: 10_000_000,
    unit: '',
    color: '#E85D26',
    triggerProgress: 0.2,
    decimals: 0,
    suffix: '',
    icon: '\uD83D\uDC65',
    description: 'Monthly Active',
  },
  {
    label: 'Latency',
    value: 2.3,
    unit: 'ms',
    color: '#FFD700',
    triggerProgress: 0.4,
    decimals: 1,
    suffix: 'ms',
    icon: '\u26A1',
    description: 'Avg Response',
  },
  {
    label: 'Uptime',
    value: 99.99,
    unit: '%',
    color: '#20C997',
    triggerProgress: 0.6,
    decimals: 2,
    suffix: '%',
    icon: '\u2705',
    description: 'SLA Guarantee',
  },
];

function formatNumber(value: number, decimals: number): string {
  if (decimals === 0) {
    if (value >= 1_000_000) {
      return (value / 1_000_000).toFixed(1) + 'M';
    }
    if (value >= 1_000) {
      return (value / 1_000).toFixed(1) + 'K';
    }
    return Math.round(value).toLocaleString();
  }
  return value.toFixed(decimals);
}

// Mini sparkline chart component
const SparkLine: React.FC<{
  color: string;
  frame: number;
  width: number;
  height: number;
  progress: number;
}> = ({ color, frame, width, height, progress }) => {
  const points = 20;
  const data: number[] = [];

  // Generate smooth pseudo-random data based on frame
  for (let i = 0; i < points; i++) {
    const seed = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    const base = (seed - Math.floor(seed));
    const wave = 0.3 * Math.sin((frame * 0.02) + i * 0.5);
    data.push(0.2 + base * 0.6 + wave);
  }

  const stepX = width / (points - 1);
  const pathParts = data.map((v, i) => {
    const x = i * stepX;
    const y = height - v * height;
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
  });

  // Fill area path
  const areaPath = pathParts.join(' ') + ` L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((frac) => (
        <line
          key={`grid-${frac}`}
          x1={0}
          y1={height * frac}
          x2={width}
          y2={height * frac}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={0.5}
        />
      ))}
      {/* Y-axis labels */}
      <text x={-4} y={4} fill="rgba(255,255,255,0.2)" fontSize={5} fontFamily="'JetBrains Mono', monospace" textAnchor="end">hi</text>
      <text x={-4} y={height} fill="rgba(255,255,255,0.2)" fontSize={5} fontFamily="'JetBrains Mono', monospace" textAnchor="end">lo</text>
      {/* Area fill */}
      <path d={areaPath} fill={`${color}12`} opacity={progress} />
      {/* Line */}
      <path d={pathParts.join(' ')} fill="none" stroke={color} strokeWidth={1.5} opacity={progress * 0.8} />
      {/* Current value dot */}
      {progress > 0.5 && (
        <circle
          cx={width}
          cy={height - data[data.length - 1] * height}
          r={3}
          fill={color}
          opacity={0.6 + 0.4 * Math.sin(frame * 0.12)}
          style={{ filter: `drop-shadow(0 0 3px ${color})` }}
        />
      )}
    </svg>
  );
};

export const MetricDashboard: React.FC<MetricDashboardProps> = ({ sync, frame }) => {
  const { fps } = useVideoConfig();
  const progress = sync.sceneProgress;

  const titleOpacity = interpolate(progress, [0, 0.15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

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
        gap: 32,
        position: 'relative',
      }}
    >
      {/* Live indicator — top-right */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          opacity: titleOpacity,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#22C55E',
            boxShadow: `0 0 8px #22C55E`,
            opacity: 0.5 + 0.5 * Math.sin(frame * 0.1),
          }}
        />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#22C55E', letterSpacing: 1 }}>LIVE</span>
      </div>

      {/* Dashboard title */}
      <div
        style={{
          color: THEME.gold,
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: 2,
          opacity: titleOpacity,
          transform: `translateY(${interpolate(progress, [0, 0.15], [-12, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })}px)`,
        }}
      >
        PERFORMANCE METRICS
      </div>

      {/* Metrics row */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 20,
          alignItems: 'stretch',
          justifyContent: 'center',
          width: '100%',
          padding: '0 32px',
        }}
      >
        {METRICS.map((metric) => {
          // Card entrance with spring animation
          const cardSpring = spring({
            frame: frame - Math.round(metric.triggerProgress * fps * 8),
            fps,
            config: { damping: 14, stiffness: 90, mass: 1 },
          });

          const cardEntrance = interpolate(
            progress,
            [metric.triggerProgress - 0.05, metric.triggerProgress + 0.12],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          // Number counts up with easeOutExpo
          const countDuration = 0.25;
          const rawT = interpolate(
            progress,
            [metric.triggerProgress, metric.triggerProgress + countDuration],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );
          const easedT = easeOutExpo(rawT);
          const displayValue = metric.value * easedT;

          // Glow pulse once the count finishes
          const glowPhase = progress > metric.triggerProgress + countDuration;
          const glowIntensity = glowPhase ? 0.4 + 0.15 * Math.sin(frame * 0.12) : 0;

          // Sparkline progress
          const sparkP = interpolate(
            progress,
            [metric.triggerProgress + 0.1, metric.triggerProgress + 0.3],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          return (
            <div
              key={metric.label}
              style={{
                flex: 1,
                maxWidth: 200,
                background: `linear-gradient(145deg, ${metric.color}18, ${metric.color}08)`,
                border: `1.5px solid ${metric.color}44`,
                borderRadius: 16,
                padding: '28px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                opacity: cardEntrance,
                transform: `translateY(${interpolate(cardSpring, [0, 1], [30, 0])}px) scale(${interpolate(cardSpring, [0, 1], [0.88, 1])})`,
                boxShadow: glowPhase
                  ? `0 0 ${20 + glowIntensity * 20}px ${metric.color}${Math.round(glowIntensity * 80).toString(16).padStart(2, '0')}`
                  : 'none',
              }}
            >
              {/* Icon */}
              <span style={{ fontSize: 32, lineHeight: 1 }}>{metric.icon}</span>

              {/* Metric value */}
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 800,
                  color: metric.color,
                  letterSpacing: -1,
                  lineHeight: 1,
                  minHeight: 44,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {formatNumber(displayValue, metric.decimals)}
                {metric.suffix && (
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      marginLeft: 2,
                      opacity: 0.8,
                    }}
                  >
                    {metric.suffix}
                  </span>
                )}
              </div>

              {/* Label */}
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.85)',
                  letterSpacing: 0.5,
                }}
              >
                {metric.label}
              </div>

              {/* Description */}
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.35)',
                  letterSpacing: 0.3,
                }}
              >
                {metric.description}
              </div>

              {/* Sparkline chart */}
              <div style={{ width: '100%', marginTop: 4 }}>
                <SparkLine
                  color={metric.color}
                  frame={frame}
                  width={160}
                  height={32}
                  progress={sparkP}
                />
              </div>

              {/* Progress bar beneath */}
              <div
                style={{
                  width: '100%',
                  height: 3,
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 2,
                  marginTop: 4,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${easedT * 100}%`,
                    background: metric.color,
                    borderRadius: 2,
                    transition: 'none',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom bar chart — with axis labels and grid */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 6,
          height: 60,
          position: 'relative',
          opacity: interpolate(progress, [0.65, 0.85], [0, 0.5], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        {/* Y axis label */}
        <div style={{
          position: 'absolute',
          left: -28,
          top: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', fontFamily: "'JetBrains Mono', monospace" }}>100%</span>
          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', fontFamily: "'JetBrains Mono', monospace" }}>0%</span>
        </div>
        {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.75, 0.55, 0.95, 0.65].map((h, i) => {
          // Spring animation for each bar
          const barSpring = spring({
            frame: frame - Math.round((0.7 + i * 0.02) * fps * 8),
            fps,
            config: { damping: 12, stiffness: 80, mass: 0.8 },
          });
          const animH = h * 60 * barSpring;

          return (
            <div
              key={i}
              style={{
                width: 12,
                height: animH,
                borderRadius: 3,
                background:
                  i % 3 === 0
                    ? THEME.saffron
                    : i % 3 === 1
                    ? THEME.teal
                    : THEME.indigo,
                opacity: 0.6 + 0.4 * Math.sin(frame * 0.08 + i * 0.7),
              }}
            />
          );
        })}
        {/* X axis labels */}
        <div style={{
          position: 'absolute',
          bottom: -14,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', fontFamily: "'JetBrains Mono', monospace" }}>1h</span>
          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', fontFamily: "'JetBrains Mono', monospace" }}>now</span>
        </div>
      </div>
    </div>
  );
};
