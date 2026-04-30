import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate,
  spring,
} from 'remotion';
import { COLORS, FONTS, SIZES } from '../../lib/theme';

/* ─── Types ────────────────────────────────────────────────────────────────── */

export interface MetricConfig {
  name: string;
  values: number[];
  threshold?: number;
  color: string;
  beatIndex: number;
}

export interface MonitoringConfig {
  metrics: MetricConfig[];
  alertMessage?: string;
  title?: string;
}

interface MonitoringRendererProps {
  config: MonitoringConfig;
  startFrame?: number;
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

const CHART_LEFT = 100;
const CHART_TOP = 60;
const CHART_WIDTH = 700;
const CHART_HEIGHT = 260;
const CHART_BOTTOM = CHART_TOP + CHART_HEIGHT;

/** Map data values into SVG coordinates. */
function toSvgPoints(
  values: number[],
  minY: number,
  maxY: number,
): Array<{ x: number; y: number }> {
  const range = maxY - minY || 1;
  return values.map((v, i) => ({
    x: CHART_LEFT + (i / Math.max(1, values.length - 1)) * CHART_WIDTH,
    y: CHART_BOTTOM - ((v - minY) / range) * CHART_HEIGHT,
  }));
}

/** Build an SVG polyline `points` string, truncated to `ratio` (0-1). */
function polylinePoints(
  pts: Array<{ x: number; y: number }>,
  ratio: number,
): string {
  const count = Math.max(1, Math.ceil(pts.length * ratio));
  return pts
    .slice(0, count)
    .map((p) => `${p.x},${p.y}`)
    .join(' ');
}

/* ─── Component ────────────────────────────────────────────────────────────── */

const MonitoringRenderer: React.FC<MonitoringRendererProps> = ({
  config,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { metrics, alertMessage, title } = config;
  const elapsed = frame - startFrame;

  /* ── Title entrance ─────────────────────────────────────────────────────── */
  const titleSpring = spring({
    frame: Math.max(0, elapsed),
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });

  /* ── Compute global min/max across all metrics for consistent Y axis ──── */
  const allValues = metrics.flatMap((m) => [
    ...m.values,
    ...(m.threshold !== undefined ? [m.threshold] : []),
  ]);
  const globalMin = Math.min(...allValues) * 0.9;
  const globalMax = Math.max(...allValues) * 1.1;

  /* ── Grid lines ─────────────────────────────────────────────────────────── */
  const gridLines = 5;
  const gridStep = (globalMax - globalMin) / gridLines;

  /* ── Alert detection: does any metric breach its threshold? ─────────────── */
  let breachDetected = false;
  let breachFrame = Infinity;

  for (const metric of metrics) {
    if (metric.threshold === undefined) continue;
    const metricDelay = 10 + metric.beatIndex * 15;
    const drawDuration = 60;
    const pts = toSvgPoints(metric.values, globalMin, globalMax);

    for (let i = 0; i < metric.values.length; i++) {
      const exceeds = metric.values[i] > metric.threshold;
      if (exceeds) {
        const ratio = i / Math.max(1, metric.values.length - 1);
        const frameWhenReached = startFrame + metricDelay + ratio * drawDuration;
        if (frameWhenReached < breachFrame) {
          breachFrame = frameWhenReached;
          breachDetected = true;
        }
      }
    }
  }

  const alertActive = breachDetected && frame >= breachFrame;
  const alertElapsed = alertActive ? frame - breachFrame : 0;
  const alertShake = alertActive
    ? Math.sin(alertElapsed * 0.8) * Math.max(0, 6 - alertElapsed * 0.15)
    : 0;
  const alertOpacity = alertActive
    ? interpolate(alertElapsed, [0, 10], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  /* ── SVG dimensions ─────────────────────────────────────────────────────── */
  const svgWidth = CHART_LEFT + CHART_WIDTH + 40;
  const svgHeight = CHART_BOTTOM + 50;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        justifyContent: 'flex-start',
        alignItems: 'center',
        padding: '48px 60px',
        fontFamily: FONTS.text,
      }}
    >
      {/* ── Title ─────────────────────────────────────────────────────────── */}
      {title && (
        <div
          style={{
            opacity: interpolate(titleSpring, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(titleSpring, [0, 1], [-20, 0])}px)`,
            fontSize: SIZES.heading2,
            fontWeight: 800,
            color: COLORS.white,
            marginBottom: 28,
            textAlign: 'center',
            fontFamily: FONTS.heading,
            letterSpacing: '-0.5px',
            textShadow: `0 0 40px ${COLORS.teal}44`,
          }}
        >
          {title}
        </div>
      )}

      {/* ── Dashboard container ───────────────────────────────────────────── */}
      <div
        style={{
          width: '100%',
          maxWidth: 1760,
          display: 'flex',
          gap: 32,
          alignItems: 'flex-start',
        }}
      >
        {/* ── Chart panel ─────────────────────────────────────────────────── */}
        <div
          style={{
            flex: '1 1 65%',
            background: COLORS.darkAlt,
            borderRadius: 16,
            border: `1.5px solid ${COLORS.indigo}33`,
            padding: '24px 28px',
            boxShadow: `0 8px 48px ${COLORS.dark}AA`,
          }}
        >
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ width: '100%', height: 'auto' }}
          >
            {/* Grid lines */}
            {Array.from({ length: gridLines + 1 }).map((_, i) => {
              const yVal = globalMin + i * gridStep;
              const y =
                CHART_BOTTOM -
                ((yVal - globalMin) / (globalMax - globalMin || 1)) * CHART_HEIGHT;
              return (
                <g key={`grid-${i}`}>
                  <line
                    x1={CHART_LEFT}
                    y1={y}
                    x2={CHART_LEFT + CHART_WIDTH}
                    y2={y}
                    stroke={`${COLORS.indigo}22`}
                    strokeWidth={1}
                  />
                  <text
                    x={CHART_LEFT - 10}
                    y={y + 4}
                    textAnchor="end"
                    fill={COLORS.gray}
                    fontSize={12}
                    fontFamily={FONTS.code}
                  >
                    {Math.round(yVal)}
                  </text>
                </g>
              );
            })}

            {/* Axes */}
            <line
              x1={CHART_LEFT}
              y1={CHART_TOP}
              x2={CHART_LEFT}
              y2={CHART_BOTTOM}
              stroke={`${COLORS.indigo}44`}
              strokeWidth={2}
            />
            <line
              x1={CHART_LEFT}
              y1={CHART_BOTTOM}
              x2={CHART_LEFT + CHART_WIDTH}
              y2={CHART_BOTTOM}
              stroke={`${COLORS.indigo}44`}
              strokeWidth={2}
            />

            {/* Metric lines */}
            {metrics.map((metric) => {
              const metricDelay = 10 + metric.beatIndex * 15;
              const drawDuration = 60;
              const drawProgress = interpolate(
                elapsed,
                [metricDelay, metricDelay + drawDuration],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );

              const pts = toSvgPoints(metric.values, globalMin, globalMax);
              const visibleCount = Math.max(
                1,
                Math.ceil(pts.length * drawProgress),
              );

              // Check if line has crossed threshold
              const crossedThreshold =
                metric.threshold !== undefined &&
                metric.values
                  .slice(0, visibleCount)
                  .some((v) => v > metric.threshold!);

              const lineColor = crossedThreshold ? COLORS.red : metric.color;

              return (
                <g key={metric.name}>
                  {/* Threshold line */}
                  {metric.threshold !== undefined && (
                    <line
                      x1={CHART_LEFT}
                      y1={
                        CHART_BOTTOM -
                        ((metric.threshold - globalMin) /
                          (globalMax - globalMin || 1)) *
                          CHART_HEIGHT
                      }
                      x2={CHART_LEFT + CHART_WIDTH}
                      y2={
                        CHART_BOTTOM -
                        ((metric.threshold - globalMin) /
                          (globalMax - globalMin || 1)) *
                          CHART_HEIGHT
                      }
                      stroke={COLORS.red}
                      strokeWidth={1.5}
                      strokeDasharray="8 4"
                      opacity={0.7}
                    />
                  )}

                  {/* Data line */}
                  <polyline
                    points={polylinePoints(pts, drawProgress)}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Glow for the line */}
                  <polyline
                    points={polylinePoints(pts, drawProgress)}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.15}
                  />

                  {/* Dot at the current head of the line */}
                  {drawProgress > 0 && (
                    <circle
                      cx={pts[visibleCount - 1].x}
                      cy={pts[visibleCount - 1].y}
                      r={5}
                      fill={lineColor}
                      opacity={drawProgress}
                    >
                      {/* Pulse animation via opacity cycle */}
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div
            style={{
              display: 'flex',
              gap: 24,
              marginTop: 12,
              justifyContent: 'center',
            }}
          >
            {metrics.map((metric) => {
              const metricDelay = 10 + metric.beatIndex * 15;
              const legendOpacity = interpolate(
                elapsed,
                [metricDelay, metricDelay + 15],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );
              return (
                <div
                  key={metric.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    opacity: legendOpacity,
                  }}
                >
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: metric.color,
                    }}
                  />
                  <span
                    style={{
                      fontSize: SIZES.caption,
                      color: COLORS.gray,
                      fontWeight: 500,
                    }}
                  >
                    {metric.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Alert / status panel ────────────────────────────────────────── */}
        <div
          style={{
            flex: '0 0 30%',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Metric cards */}
          {metrics.map((metric, i) => {
            const cardDelay = 10 + metric.beatIndex * 15 + 20;
            const cardSpring = spring({
              frame: Math.max(0, elapsed - cardDelay),
              fps,
              config: { damping: 14, stiffness: 120, mass: 0.7 },
            });
            const latestValue = metric.values[metric.values.length - 1];
            const isAboveThreshold =
              metric.threshold !== undefined && latestValue > metric.threshold;

            return (
              <div
                key={metric.name}
                style={{
                  opacity: interpolate(cardSpring, [0, 0.3], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  }),
                  transform: `translateX(${interpolate(cardSpring, [0, 1], [40, 0])}px)`,
                  background: COLORS.darkAlt,
                  borderRadius: 12,
                  padding: '20px 24px',
                  border: `1.5px solid ${isAboveThreshold ? `${COLORS.red}66` : `${COLORS.indigo}33`}`,
                  boxShadow: isAboveThreshold
                    ? `0 0 20px ${COLORS.red}22`
                    : `0 4px 16px ${COLORS.dark}88`,
                }}
              >
                <div
                  style={{
                    fontSize: SIZES.caption,
                    color: COLORS.gray,
                    fontWeight: 500,
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                  }}
                >
                  {metric.name}
                </div>
                <div
                  style={{
                    fontSize: SIZES.heading3,
                    fontWeight: 800,
                    color: isAboveThreshold ? COLORS.red : metric.color,
                    fontFamily: FONTS.code,
                  }}
                >
                  {latestValue}
                </div>
                {metric.threshold !== undefined && (
                  <div
                    style={{
                      fontSize: 14,
                      color: `${COLORS.gray}88`,
                      marginTop: 4,
                    }}
                  >
                    threshold: {metric.threshold}
                  </div>
                )}
              </div>
            );
          })}

          {/* Alert banner */}
          {alertMessage && (
            <div
              style={{
                opacity: alertOpacity,
                transform: `translateX(${alertShake}px)`,
                background: `linear-gradient(135deg, ${COLORS.red}22, ${COLORS.red}11)`,
                borderRadius: 12,
                padding: '20px 24px',
                border: `2px solid ${COLORS.red}88`,
                boxShadow: `0 0 30px ${COLORS.red}33`,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 28 }}>{'\u26A0\uFE0F'}</span>
              <div>
                <div
                  style={{
                    fontSize: SIZES.bodySmall,
                    fontWeight: 700,
                    color: COLORS.red,
                    marginBottom: 4,
                  }}
                >
                  ALERT
                </div>
                <div
                  style={{
                    fontSize: SIZES.caption,
                    color: COLORS.white,
                    lineHeight: 1.4,
                  }}
                >
                  {alertMessage}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default MonitoringRenderer;
