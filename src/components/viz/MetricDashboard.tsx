import React from 'react';
import { interpolate, useVideoConfig } from 'remotion';
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
    icon: '👥',
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
    icon: '⚡',
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
    icon: '✅',
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

export const MetricDashboard: React.FC<MetricDashboardProps> = ({ sync, frame }) => {
  const { fps } = useVideoConfig();
  const progress = sync.sceneProgress;

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
      }}
    >
      {/* Dashboard title */}
      <div
        style={{
          color: THEME.gold,
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: 2,
          opacity: interpolate(progress, [0, 0.15], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
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
          // Card entrance: slide + fade from trigger point
          const cardEntrance = interpolate(
            progress,
            [metric.triggerProgress - 0.05, metric.triggerProgress + 0.12],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          // Number counts up with easeOutExpo from trigger point
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
                transform: `translateY(${interpolate(cardEntrance, [0, 1], [30, 0])}px) scale(${interpolate(cardEntrance, [0, 1], [0.88, 1])})`,
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

              {/* Progress bar beneath */}
              <div
                style={{
                  width: '100%',
                  height: 3,
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 2,
                  marginTop: 8,
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

      {/* Bottom bar chart — decorative */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 6,
          height: 48,
          opacity: interpolate(progress, [0.65, 0.85], [0, 0.4], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.75, 0.55, 0.95, 0.65].map((h, i) => (
          <div
            key={i}
            style={{
              width: 12,
              height: h * 48,
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
        ))}
      </div>
    </div>
  );
};
