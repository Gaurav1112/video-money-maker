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
// We'll do simplified bubble sort steps for 6 elements
// Array: [0.65, 0.30, 0.85, 0.45, 0.70, 0.20]
// Step-by-step comparison pairs and whether a swap happens
interface SortStep {
  comparing: [number, number];
  swaps: boolean;
  // After this step, which indices are in their final sorted position
  sortedIndices: number[];
}

const SORT_STEPS: SortStep[] = [
  { comparing: [0, 1], swaps: true,  sortedIndices: [] },          // 0.65 > 0.30 → swap
  { comparing: [1, 2], swaps: false, sortedIndices: [] },          // 0.65 < 0.85 → no swap
  { comparing: [2, 3], swaps: true,  sortedIndices: [] },          // 0.85 > 0.45 → swap
  { comparing: [3, 4], swaps: true,  sortedIndices: [] },          // 0.85 > 0.70 → swap
  { comparing: [4, 5], swaps: true,  sortedIndices: [5] },         // 0.85 > 0.20 → swap; 0.85 sorted at end
  { comparing: [0, 1], swaps: false, sortedIndices: [5] },         // pass 2 start
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
  const order = [0, 1, 2, 3, 4, 5]; // indices into INITIAL_HEIGHTS
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

  // Compute X positions for each slot (0..5)
  function slotX(slot: number) {
    return BAR_START_X + slot * (BAR_W + GAP);
  }

  // Determine whether this step is swapping and animate bar positions
  const isSwapStep = step?.swaps ?? false;
  const [swapA, swapB] = step?.comparing ?? [0, 0];

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
      }}
    >
      {/* Title */}
      <div
        style={{
          color: THEME.gold,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 2,
          marginBottom: 4,
          opacity: interpolate(progress, [0, 0.08], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        BUBBLE SORT
      </div>

      {/* Step counter */}
      <div
        style={{
          color: 'rgba(255,255,255,0.3)',
          fontSize: 12,
          letterSpacing: 1,
          marginBottom: 8,
        }}
      >
        Step {Math.min(currentStep + 1, totalSteps)} / {totalSteps}
      </div>

      <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
        {/* Baseline */}
        <line
          x1={BAR_START_X - 10}
          y1={BAR_BOTTOM_Y + 2}
          x2={BAR_START_X + TOTAL_W + 10}
          y2={BAR_BOTTOM_Y + 2}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1.5}
        />

        {INITIAL_HEIGHTS.map((_, barIndexInOrder) => {
          // Where is this bar's value currently sitting?
          const currentSlot = prevOrder.indexOf(barIndexInOrder);
          const nextSlot = nextOrder.indexOf(barIndexInOrder);

          // Animate X position if this bar is one of the swapped pair
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

          const h = INITIAL_HEIGHTS[barIndexInOrder] * BAR_MAX_H;
          const barY = BAR_BOTTOM_Y - h;

          const isSorted = step && step.sortedIndices.includes(currentSlot);
          const barColor = isSorted
            ? THEME.sorted
            : isComparing
            ? THEME.comparing
            : THEME.default;

          // Entrance: bars slide up from bottom
          const entranceSpring = spring({
            frame: frame - barIndexInOrder * 5,
            fps,
            config: { damping: 14, stiffness: 100 },
          });
          const displayH = h * entranceSpring;
          const displayY = BAR_BOTTOM_Y - displayH;

          return (
            <g key={`bar-${barIndexInOrder}`}>
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
              {/* Glow on comparing bars */}
              {isComparing && (
                <rect
                  x={barX - 2}
                  y={displayY - 2}
                  width={BAR_W + 4}
                  height={displayH + 4}
                  rx={8}
                  fill="none"
                  stroke={barColor}
                  strokeWidth={1}
                  opacity={0.3 + 0.2 * Math.sin(frame * 0.2)}
                />
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
              {/* Comparison arrows */}
              {isComparing && entranceSpring > 0.8 && (
                <>
                  {/* Down chevron */}
                  <polygon
                    points={`${barX + BAR_W / 2 - 6},${displayY - 22} ${barX + BAR_W / 2 + 6},${displayY - 22} ${barX + BAR_W / 2},${displayY - 14}`}
                    fill={barColor}
                    opacity={0.7 + 0.2 * Math.sin(frame * 0.25)}
                  />
                </>
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
            {step.swaps ? ' → SWAP' : ' → no swap'}
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
