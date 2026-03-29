import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';
import type { SyncState } from '../../types';

interface SortingVizProps {
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
  comparing: '#E85D26',
  sorted: '#20C997',
  default: '#818CF8',
};

// Initial bar heights (0–1 normalised), 6 bars
const INITIAL_HEIGHTS = [0.65, 0.30, 0.85, 0.45, 0.70, 0.20];

// Bubble sort steps: each step is [i, j] — the pair being compared/swapped
interface SortStep {
  comparing: [number, number];
  swaps: boolean;
  sortedIndices: number[];
}

const SORT_STEPS: SortStep[] = [
  { comparing: [0, 1], swaps: true,  sortedIndices: [] },
  { comparing: [1, 2], swaps: false, sortedIndices: [] },
  { comparing: [2, 3], swaps: true,  sortedIndices: [] },
  { comparing: [3, 4], swaps: true,  sortedIndices: [] },
  { comparing: [4, 5], swaps: true,  sortedIndices: [5] },
  { comparing: [0, 1], swaps: false, sortedIndices: [5] },
  { comparing: [1, 2], swaps: true,  sortedIndices: [5] },
  { comparing: [2, 3], swaps: false, sortedIndices: [5] },
  { comparing: [3, 4], swaps: true,  sortedIndices: [4, 5] },
  { comparing: [0, 1], swaps: false, sortedIndices: [4, 5] },
  { comparing: [1, 2], swaps: false, sortedIndices: [4, 5] },
  { comparing: [2, 3], swaps: false, sortedIndices: [3, 4, 5] },
  { comparing: [0, 1], swaps: true,  sortedIndices: [3, 4, 5] },
  { comparing: [1, 2], swaps: false, sortedIndices: [2, 3, 4, 5] },
  { comparing: [0, 1], swaps: false, sortedIndices: [0, 1, 2, 3, 4, 5] },
];

// Apply all swaps up to (not including) stepIndex to get current order
function getOrderAtStep(stepIndex: number): number[] {
  const order = [0, 1, 2, 3, 4, 5];
  for (let s = 0; s < stepIndex; s++) {
    const step = SORT_STEPS[s];
    if (step.swaps) {
      const [a, b] = step.comparing;
      [order[a], order[b]] = [order[b], order[a]];
    }
  }
  return order;
}

export const SortingViz: React.FC<SortingVizProps> = ({ sync, frame }) => {
  const { fps } = useVideoConfig();
  const progress = sync.sceneProgress;
  const totalSteps = SORT_STEPS.length;

  // Map progress to step index (float)
  const stepFloat = interpolate(progress, [0.05, 0.95], [0, totalSteps - 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const currentStep = Math.floor(stepFloat);
  const stepProgress = stepFloat - currentStep; // 0→1 within step

  const step = SORT_STEPS[Math.min(currentStep, totalSteps - 1)];
  const prevOrder = getOrderAtStep(currentStep);
  const nextOrder = getOrderAtStep(currentStep + 1);

  const BAR_W = 56;
  const BAR_MAX_H = 260;
  const GAP = 12;
  const N = 6;
  const TOTAL_W = N * BAR_W + (N - 1) * GAP;
  const SVG_W = 600;
  const SVG_H = 440;
  const BAR_BOTTOM_Y = 340;
  const BAR_START_X = (SVG_W - TOTAL_W) / 2;

  function slotX(slot: number) {
    return BAR_START_X + slot * (BAR_W + GAP);
  }

  const isSwapStep = step?.swaps ?? false;

  // Pulsing glow intensity for comparing bars
  const glowPulse = 0.4 + 0.6 * ((Math.sin(frame * 0.15) + 1) / 2);

  const titleOpacity = interpolate(progress, [0, 0.08], [0, 1], {
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
        position: 'relative',
      }}
    >
      {/* Complexity badge — top-left */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 20,
          background: `${THEME.saffron}18`,
          border: `1.5px solid ${THEME.saffron}55`,
          borderRadius: 8,
          padding: '4px 12px',
          opacity: titleOpacity,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: THEME.saffron, letterSpacing: 0.5 }}>
          O(n{'\u00B2'})
        </span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
          worst case
        </span>
      </div>

      {/* Step counter — top-right */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 20,
          background: `${THEME.indigo}18`,
          border: `1.5px solid ${THEME.indigo}44`,
          borderRadius: 8,
          padding: '4px 12px',
          opacity: titleOpacity,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: THEME.indigo }}>
          Step {Math.min(currentStep + 1, totalSteps)} of {totalSteps}
        </span>
      </div>

      {/* Title */}
      <div
        style={{
          color: THEME.gold,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 2,
          marginBottom: 4,
          opacity: titleOpacity,
        }}
      >
        BUBBLE SORT
      </div>

      {/* Swap/Compare indicator */}
      <div
        style={{
          color: isSwapStep ? THEME.saffron : 'rgba(255,255,255,0.3)',
          fontSize: 12,
          letterSpacing: 1,
          marginBottom: 8,
          fontWeight: isSwapStep ? 700 : 400,
        }}
      >
        {isSwapStep ? 'SWAPPING' : 'COMPARING'}
      </div>

      <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
        {/* SVG defs for glow filter */}
        <defs>
          <filter id="comparing-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={3 * glowPulse} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Baseline */}
        <line
          x1={BAR_START_X - 10}
          y1={BAR_BOTTOM_Y + 2}
          x2={BAR_START_X + TOTAL_W + 10}
          y2={BAR_BOTTOM_Y + 2}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1.5}
        />

        {/* Curved comparison arrow between the two bars being compared */}
        {step && (() => {
          const slotA = step.comparing[0];
          const slotB = step.comparing[1];
          const xA = slotX(slotA) + BAR_W / 2;
          const xB = slotX(slotB) + BAR_W / 2;
          const idxA = prevOrder[slotA];
          const idxB = prevOrder[slotB];
          const hA = INITIAL_HEIGHTS[idxA] * BAR_MAX_H;
          const hB = INITIAL_HEIGHTS[idxB] * BAR_MAX_H;
          const minTop = BAR_BOTTOM_Y - Math.max(hA, hB);
          const arcY = minTop - 44;
          const midX = (xA + xB) / 2;

          return (
            <g opacity={0.5 + 0.4 * Math.sin(frame * 0.18)}>
              <path
                d={`M ${xA} ${minTop - 10} Q ${midX} ${arcY} ${xB} ${minTop - 10}`}
                fill="none"
                stroke={isSwapStep ? THEME.saffron : THEME.comparing}
                strokeWidth={2}
                strokeDasharray={isSwapStep ? 'none' : '4 3'}
              />
              {/* Arrowheads at both ends */}
              <polygon
                points={`${xB},${minTop - 10} ${xB - 5},${minTop - 18} ${xB + 5},${minTop - 18}`}
                fill={isSwapStep ? THEME.saffron : THEME.comparing}
              />
              <polygon
                points={`${xA},${minTop - 10} ${xA - 5},${minTop - 18} ${xA + 5},${minTop - 18}`}
                fill={isSwapStep ? THEME.saffron : THEME.comparing}
              />
              {/* Label on arc */}
              <text
                x={midX}
                y={arcY - 4}
                textAnchor="middle"
                fill={isSwapStep ? THEME.saffron : 'rgba(255,255,255,0.5)'}
                fontSize={10}
                fontWeight={700}
                fontFamily="Inter, system-ui, sans-serif"
              >
                {isSwapStep ? 'SWAP' : 'compare'}
              </text>
            </g>
          );
        })()}

        {INITIAL_HEIGHTS.map((_, barIndexInOrder) => {
          const currentSlot = prevOrder.indexOf(barIndexInOrder);
          const nextSlot = nextOrder.indexOf(barIndexInOrder);

          const isComparing =
            step &&
            (step.comparing[0] === currentSlot || step.comparing[1] === currentSlot);
          const isSwapping = isSwapStep && isComparing;

          let barX: number;
          if (isSwapping && currentSlot !== nextSlot) {
            barX = interpolate(
              stepProgress,
              [0, 1],
              [slotX(currentSlot), slotX(nextSlot)]
            );
          } else {
            barX = slotX(currentSlot);
          }

          // Spring arc Y offset during swap — bars arc up/down via parabolic path
          const isMovingRight = isSwapping && nextSlot > currentSlot;
          const isMovingLeft = isSwapping && nextSlot < currentSlot;
          const arcAmount = isSwapping ? Math.sin(stepProgress * Math.PI) : 0;
          const arcYOffset = isMovingRight ? -arcAmount * 24 : isMovingLeft ? arcAmount * 16 : 0;

          const h = INITIAL_HEIGHTS[barIndexInOrder] * BAR_MAX_H;

          const isSorted = step && step.sortedIndices.includes(currentSlot);
          const barColor = isSorted
            ? THEME.sorted
            : isComparing
            ? THEME.comparing
            : THEME.default;

          const entranceSpring = spring({
            frame: frame - barIndexInOrder * 5,
            fps,
            config: { damping: 14, stiffness: 100 },
          });
          const displayH = h * entranceSpring;
          const displayY = BAR_BOTTOM_Y - displayH + arcYOffset;

          return (
            <g key={`bar-${barIndexInOrder}`} filter={isComparing ? 'url(#comparing-glow)' : undefined}>
              {/* Bar body */}
              <rect
                x={barX}
                y={displayY}
                width={BAR_W}
                height={displayH}
                rx={6}
                fill={`${barColor}33`}
                stroke={barColor}
                strokeWidth={isComparing ? 2.5 : 1.5}
                opacity={entranceSpring}
              />
              {/* Pulsing glow rings on comparing bars */}
              {isComparing && (
                <>
                  <rect
                    x={barX - 3}
                    y={displayY - 3}
                    width={BAR_W + 6}
                    height={displayH + 6}
                    rx={9}
                    fill="none"
                    stroke={barColor}
                    strokeWidth={1.5}
                    opacity={glowPulse * 0.5}
                  />
                  <rect
                    x={barX - 6}
                    y={displayY - 6}
                    width={BAR_W + 12}
                    height={displayH + 12}
                    rx={12}
                    fill="none"
                    stroke={barColor}
                    strokeWidth={1}
                    opacity={glowPulse * 0.2}
                  />
                </>
              )}
              {/* Sorted checkmark */}
              {isSorted && entranceSpring > 0.8 && (
                <text
                  x={barX + BAR_W / 2}
                  y={BAR_BOTTOM_Y + 18}
                  textAnchor="middle"
                  fill={THEME.sorted}
                  fontSize={14}
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {'\u2713'}
                </text>
              )}
              {/* Height label at top */}
              <text
                x={barX + BAR_W / 2}
                y={displayY - 6}
                textAnchor="middle"
                fill={barColor}
                fontSize={12}
                fontWeight={700}
                fontFamily="Inter, system-ui, sans-serif"
                opacity={entranceSpring * 0.9}
              >
                {Math.round(INITIAL_HEIGHTS[barIndexInOrder] * 100)}
              </text>
              {/* Down chevron indicator */}
              {isComparing && entranceSpring > 0.8 && (
                <polygon
                  points={`${barX + BAR_W / 2 - 6},${displayY - 22} ${barX + BAR_W / 2 + 6},${displayY - 22} ${barX + BAR_W / 2},${displayY - 14}`}
                  fill={barColor}
                  opacity={0.7 + 0.2 * Math.sin(frame * 0.25)}
                />
              )}
            </g>
          );
        })}

        {/* "Comparing" label */}
        {step && (
          <text
            x={SVG_W / 2}
            y={390}
            textAnchor="middle"
            fill="rgba(255,255,255,0.5)"
            fontSize={13}
            fontFamily="Inter, system-ui, sans-serif"
          >
            Comparing positions {step.comparing[0]} and {step.comparing[1]}
            {step.swaps ? ' \u2192 SWAP' : ' \u2192 no swap'}
          </text>
        )}

        {/* Legend */}
        <g transform="translate(60, 410)">
          <rect x={0} y={-8} width={14} height={14} rx={3} fill={`${THEME.default}44`} stroke={THEME.default} strokeWidth={1.5} />
          <text x={20} y={4} fill="rgba(255,255,255,0.4)" fontSize={11} fontFamily="Inter, system-ui, sans-serif">unsorted</text>
          <rect x={110} y={-8} width={14} height={14} rx={3} fill={`${THEME.comparing}44`} stroke={THEME.comparing} strokeWidth={1.5} />
          <text x={130} y={4} fill="rgba(255,255,255,0.4)" fontSize={11} fontFamily="Inter, system-ui, sans-serif">comparing</text>
          <rect x={240} y={-8} width={14} height={14} rx={3} fill={`${THEME.sorted}44`} stroke={THEME.sorted} strokeWidth={1.5} />
          <text x={260} y={4} fill="rgba(255,255,255,0.4)" fontSize={11} fontFamily="Inter, system-ui, sans-serif">sorted</text>
        </g>
      </svg>
    </div>
  );
};
