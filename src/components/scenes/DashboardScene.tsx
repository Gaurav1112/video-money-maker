import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate, useVideoConfig, spring } from 'remotion';

interface Metric {
  label: string;
  value: number;
  unit?: string;
  color?: string;
  trend?: 'up' | 'down' | 'stable';
}

interface DashboardSceneProps {
  metrics: Metric[];
  chartData?: number[];
  title?: string;
  startFrame?: number;
  sceneIndex?: number;
  sceneStartFrame?: number;
  sceneDurationFrames?: number;
}

// Trend arrow component
const TrendArrow: React.FC<{ trend: 'up' | 'down' | 'stable'; color: string }> = ({ trend, color }) => {
  if (trend === 'stable') {
    return (
      <span style={{ color, fontSize: 18 }}>→</span>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      {trend === 'up' ? (
        <path d="M10 4L16 12H4L10 4Z" fill={color} />
      ) : (
        <path d="M10 16L4 8H16L10 16Z" fill={color} />
      )}
    </svg>
  );
};

/**
 * Monitoring dashboard with animated metric cards and a line chart.
 */
export const DashboardScene: React.FC<DashboardSceneProps> = ({
  metrics,
  chartData,
  title = 'System Dashboard — Production',
  startFrame = 0,
  sceneDurationFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Window entrance
  const entrance = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 80, mass: 1 },
  });
  const windowScale = interpolate(entrance, [0, 1], [0.92, 1]);
  const windowOpacity = interpolate(entrance, [0, 1], [0, 1]);

  // Status dot pulse
  const statusPulse = Math.sin(frame * 0.1) * 0.3 + 0.7;

  // Chart drawing: generate SVG path from data
  const chartPoints = chartData || [10, 25, 18, 35, 28, 45, 40, 55, 48, 62, 58, 72, 65, 80, 75, 85];
  const chartWidth = 1400;
  const chartHeight = 280;
  const chartPadding = 40;

  const maxVal = Math.max(...chartPoints, 1);
  const minVal = Math.min(...chartPoints, 0);
  const range = maxVal - minVal || 1;

  const pathPoints = chartPoints.map((val, i) => {
    const x = chartPadding + (i / (chartPoints.length - 1)) * (chartWidth - 2 * chartPadding);
    const y = chartPadding + (1 - (val - minVal) / range) * (chartHeight - 2 * chartPadding);
    return { x, y };
  });

  const pathD = pathPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  // Area fill path (closes to bottom)
  const areaD = pathD +
    ` L ${pathPoints[pathPoints.length - 1].x} ${chartHeight - chartPadding}` +
    ` L ${pathPoints[0].x} ${chartHeight - chartPadding} Z`;

  // Animate chart draw (strokeDasharray)
  const pathLength = 3000; // approximate
  const chartRevealProgress = interpolate(
    frame,
    [15, 90],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const dashOffset = pathLength * (1 - chartRevealProgress);

  const hasChart = chartData !== undefined || metrics.length > 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0B0F19',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          maxWidth: 1600,
          maxHeight: 920,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 25px 80px rgba(0,0,0,0.6)',
          transform: `scale(${windowScale})`,
          opacity: windowOpacity,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#111827',
        }}
      >
        {/* Top bar */}
        <div
          style={{
            height: 52,
            backgroundColor: '#1F2937',
            display: 'flex',
            alignItems: 'center',
            padding: '0 24px',
            gap: 12,
            borderBottom: '1px solid #374151',
            flexShrink: 0,
          }}
        >
          {/* Status dot */}
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: '#4ADE80',
              opacity: statusPulse,
              boxShadow: '0 0 8px rgba(74, 222, 128, 0.5)',
            }}
          />
          {/* Title */}
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#F9FAFB',
              fontFamily: "'Inter', system-ui, sans-serif",
              flex: 1,
            }}
          >
            {title}
          </span>
          {/* LIVE badge */}
          <div
            style={{
              backgroundColor: 'rgba(74, 222, 128, 0.15)',
              border: '1px solid rgba(74, 222, 128, 0.3)',
              borderRadius: 6,
              padding: '3px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#4ADE80',
                opacity: statusPulse,
              }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#4ADE80',
                fontFamily: "'Inter', system-ui, sans-serif",
                letterSpacing: '0.08em',
              }}
            >
              LIVE
            </span>
          </div>
        </div>

        {/* Metrics grid */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            padding: '20px 24px',
            flexShrink: 0,
            flexWrap: 'wrap',
          }}
        >
          {metrics.slice(0, 4).map((metric, idx) => {
            // Stagger: each card fades in 15 frames after the previous
            const cardDelay = idx * 15;
            const cardEntrance = spring({
              frame: Math.max(0, frame - cardDelay),
              fps,
              config: { damping: 15, stiffness: 100 },
            });
            const cardOpacity = interpolate(cardEntrance, [0, 1], [0, 1]);
            const cardY = interpolate(cardEntrance, [0, 1], [20, 0]);

            // Counter animation
            const counterValue = interpolate(
              frame,
              [cardDelay, cardDelay + 60],
              [0, metric.value],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            );

            const trendColor = metric.trend === 'up'
              ? '#4ADE80'
              : metric.trend === 'down'
                ? '#F87171'
                : '#9CA3AF';

            const accentColor = metric.color || '#60A5FA';

            return (
              <div
                key={idx}
                style={{
                  flex: '1 1 calc(50% - 12px)',
                  minWidth: 280,
                  backgroundColor: '#1F2937',
                  borderRadius: 12,
                  padding: '20px 24px',
                  border: `1px solid #374151`,
                  opacity: cardOpacity,
                  transform: `translateY(${cardY}px)`,
                }}
              >
                {/* Label */}
                <div
                  style={{
                    fontSize: 14,
                    color: '#9CA3AF',
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontWeight: 500,
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {metric.label}
                </div>
                {/* Value + trend */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    style={{
                      fontSize: 36,
                      fontWeight: 700,
                      color: '#F9FAFB',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {metric.value >= 1000
                      ? `${(counterValue / 1000).toFixed(1)}k`
                      : counterValue < 10
                        ? counterValue.toFixed(1)
                        : Math.round(counterValue).toLocaleString()}
                  </span>
                  {metric.unit && (
                    <span
                      style={{
                        fontSize: 16,
                        color: '#6B7280',
                        fontFamily: "'Inter', system-ui, sans-serif",
                        fontWeight: 500,
                      }}
                    >
                      {metric.unit}
                    </span>
                  )}
                  {metric.trend && (
                    <TrendArrow trend={metric.trend} color={trendColor} />
                  )}
                </div>
                {/* Accent bar at bottom */}
                <div
                  style={{
                    marginTop: 12,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: `${accentColor}20`,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${(counterValue / metric.value) * 100}%`,
                      backgroundColor: accentColor,
                      borderRadius: 2,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Line chart */}
        <div
          style={{
            flex: 1,
            padding: '8px 24px 24px',
            minHeight: 200,
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#1F2937',
              borderRadius: 12,
              border: '1px solid #374151',
              padding: 16,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              style={{ width: '100%', height: '100%' }}
              preserveAspectRatio="none"
            >
              {/* Grid lines */}
              {[0.25, 0.5, 0.75].map((ratio) => {
                const y = chartPadding + ratio * (chartHeight - 2 * chartPadding);
                return (
                  <line
                    key={ratio}
                    x1={chartPadding}
                    y1={y}
                    x2={chartWidth - chartPadding}
                    y2={y}
                    stroke="#374151"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                );
              })}

              {/* Area fill */}
              <path
                d={areaD}
                fill="url(#chartGradient)"
                opacity={chartRevealProgress * 0.3}
              />

              {/* Line */}
              <path
                d={pathD}
                fill="none"
                stroke="#4ADE80"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={pathLength}
                strokeDashoffset={dashOffset}
              />

              {/* Data points */}
              {pathPoints.map((p, i) => {
                const pointDelay = 15 + (i / pathPoints.length) * 75;
                const pointOpacity = interpolate(
                  frame,
                  [pointDelay, pointDelay + 8],
                  [0, 1],
                  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                );
                return (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r="4"
                    fill="#4ADE80"
                    opacity={pointOpacity}
                  />
                );
              })}

              {/* Gradient definition */}
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4ADE80" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#4ADE80" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default DashboardScene;
