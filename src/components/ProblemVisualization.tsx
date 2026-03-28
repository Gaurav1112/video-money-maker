import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate, Easing } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, springIn } from '../lib/animations';

interface ProblemVisualizationProps {
  problemLabel: string;
  solutionLabel: string;
  startFrame: number;
  durationInFrames: number;
}

/**
 * ProblemVisualization — visual metaphor for problem → solution.
 * Left side: RED overloaded state. Right side: GREEN balanced state.
 * Animated dots flow from problem to solution with color transition.
 */
const ProblemVisualization: React.FC<ProblemVisualizationProps> = ({
  problemLabel,
  solutionLabel,
  startFrame,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();

  // Phase timing
  const problemPhaseEnd = startFrame + durationInFrames * 0.35;
  const transitionPhaseEnd = startFrame + durationInFrames * 0.65;

  // Problem side opacity and scale
  const problemOpacity = fadeIn(frame, startFrame, 20);
  const problemSpring = springIn(frame, startFrame);

  // Solution side appears later
  const solutionStart = startFrame + durationInFrames * 0.3;
  const solutionOpacity = fadeIn(frame, solutionStart, 25);
  const solutionSpring = springIn(frame, solutionStart);

  // Arrow animation (draws from left to right)
  const arrowProgress = interpolate(
    frame,
    [startFrame + durationInFrames * 0.25, startFrame + durationInFrames * 0.5],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) },
  );

  // Labels
  const problemLabelOpacity = fadeIn(frame, startFrame + 10, 15);
  const solutionLabelOpacity = fadeIn(frame, solutionStart + 15, 15);

  // Problem server pulse (stressed)
  const stressPulse = interpolate(
    Math.sin(frame * 0.15),
    [-1, 1],
    [0.85, 1.1],
  );

  // Problem dots — requests hitting a single server
  const DOT_COUNT = 8;
  const SOLUTION_NODES = 3;

  // Overall progress: 0 = full problem, 1 = full solution
  const overallProgress = interpolate(
    frame,
    [problemPhaseEnd, transitionPhaseEnd],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Problem glow intensity (red, fading as solution takes over)
  const problemGlow = interpolate(
    overallProgress,
    [0, 0.5, 1],
    [0.6, 0.3, 0.1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Solution glow intensity (green, growing)
  const solutionGlow = interpolate(
    overallProgress,
    [0, 0.5, 1],
    [0, 0.3, 0.6],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, #0C0A15 0%, #0E0B1A 50%, #0C0A15 100%)`,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: FONTS.text,
        overflow: 'hidden',
      }}
    >
      {/* Problem side glow */}
      <div
        style={{
          position: 'absolute',
          left: '5%',
          top: '20%',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.red}18, transparent 70%)`,
          opacity: problemGlow,
          filter: 'blur(60px)',
        }}
      />

      {/* Solution side glow */}
      <div
        style={{
          position: 'absolute',
          right: '5%',
          top: '20%',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.teal}18, transparent 70%)`,
          opacity: solutionGlow,
          filter: 'blur(60px)',
        }}
      />

      {/* Main layout: Problem | Arrow | Solution */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 60,
          width: '100%',
          padding: '0 100px',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* === PROBLEM SIDE === */}
        <div
          style={{
            opacity: problemOpacity,
            transform: `scale(${problemSpring})`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 24,
            flex: 1,
          }}
        >
          {/* Problem label */}
          <div
            style={{
              opacity: problemLabelOpacity,
              fontSize: SIZES.heading3,
              fontWeight: 700,
              color: COLORS.red,
              textTransform: 'uppercase',
              letterSpacing: 2,
              textShadow: `0 0 20px ${COLORS.red}44`,
            }}
          >
            {problemLabel}
          </div>

          {/* Single overloaded server */}
          <div style={{ position: 'relative', width: 200, height: 200 }}>
            {/* Server box */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: `translate(-50%, -50%) scale(${stressPulse})`,
                width: 80,
                height: 80,
                borderRadius: 12,
                backgroundColor: interpolate(overallProgress, [0, 0.5, 1], [0, 0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) > 0.5
                  ? `${COLORS.red}88`
                  : `${COLORS.red}CC`,
                border: `2px solid ${COLORS.red}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 0 ${30 * (1 - overallProgress)}px ${COLORS.red}66`,
              }}
            >
              <div style={{ fontSize: 28, color: COLORS.white, fontWeight: 800, fontFamily: FONTS.code }}>
                &#9646;
              </div>
            </div>

            {/* Animated request dots swarming the server */}
            {Array.from({ length: DOT_COUNT }).map((_, i) => {
              const angle = (i / DOT_COUNT) * Math.PI * 2 + frame * 0.04;
              const radius = 60 + Math.sin(frame * 0.08 + i * 1.5) * 15;
              const dotX = Math.cos(angle) * radius;
              const dotY = Math.sin(angle) * radius;
              const dotOpacity = interpolate(
                overallProgress,
                [0, 0.3, 0.7, 1],
                [0.9, 0.8, 0.3, 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );

              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `calc(50% + ${dotX}px)`,
                    top: `calc(50% + ${dotY}px)`,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: COLORS.red,
                    opacity: dotOpacity * problemOpacity,
                    boxShadow: `0 0 8px ${COLORS.red}88`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              );
            })}
          </div>

          {/* Status text */}
          <div
            style={{
              fontSize: SIZES.bodySmall,
              color: COLORS.red,
              fontFamily: FONTS.code,
              opacity: 1 - overallProgress,
            }}
          >
            &#9888; OVERLOADED
          </div>
        </div>

        {/* === ARROW === */}
        <div
          style={{
            width: 200,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {/* Arrow line */}
          <div style={{ position: 'relative', width: '100%', height: 40 }}>
            {/* Arrow body */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                width: `${arrowProgress * 100}%`,
                height: 4,
                background: `linear-gradient(90deg, ${COLORS.red}, ${COLORS.gold}, ${COLORS.teal})`,
                borderRadius: 2,
                transform: 'translateY(-50%)',
                boxShadow: `0 0 12px ${COLORS.gold}44`,
              }}
            />
            {/* Arrow head */}
            {arrowProgress > 0.8 && (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: 0,
                  width: 0,
                  height: 0,
                  borderTop: '10px solid transparent',
                  borderBottom: '10px solid transparent',
                  borderLeft: `14px solid ${COLORS.teal}`,
                  transform: 'translateY(-50%)',
                  opacity: fadeIn(frame, startFrame + durationInFrames * 0.45, 10),
                  filter: `drop-shadow(0 0 6px ${COLORS.teal}66)`,
                }}
              />
            )}

            {/* Traveling dots along arrow */}
            {[0, 1, 2].map((i) => {
              const dotProgress = interpolate(
                (frame + i * 15) % 45,
                [0, 45],
                [0, 1],
              );
              const dotX = dotProgress * 100;
              const dotColor = interpolate(dotProgress, [0, 0.5, 1], [0, 0.5, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });

              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: `${dotX}%`,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: dotColor > 0.5 ? COLORS.teal : COLORS.saffron,
                    transform: 'translate(-50%, -50%)',
                    opacity: arrowProgress > 0.3 ? 0.8 : 0,
                    boxShadow: `0 0 6px ${dotColor > 0.5 ? COLORS.teal : COLORS.saffron}66`,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* === SOLUTION SIDE === */}
        <div
          style={{
            opacity: solutionOpacity,
            transform: `scale(${solutionSpring})`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 24,
            flex: 1,
          }}
        >
          {/* Solution label */}
          <div
            style={{
              opacity: solutionLabelOpacity,
              fontSize: SIZES.heading3,
              fontWeight: 700,
              color: COLORS.teal,
              textTransform: 'uppercase',
              letterSpacing: 2,
              textShadow: `0 0 20px ${COLORS.teal}44`,
            }}
          >
            {solutionLabel}
          </div>

          {/* Multiple balanced servers */}
          <div style={{ display: 'flex', gap: 24, position: 'relative' }}>
            {Array.from({ length: SOLUTION_NODES }).map((_, i) => {
              const nodeDelay = solutionStart + i * 10;
              const nodeSpring = springIn(frame, nodeDelay);

              // Balanced dots around each server
              const dotsPerNode = Math.ceil(DOT_COUNT / SOLUTION_NODES);

              return (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    opacity: nodeSpring,
                    transform: `scale(${nodeSpring})`,
                  }}
                >
                  {/* Server box */}
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 10,
                      backgroundColor: `${COLORS.teal}30`,
                      border: `2px solid ${COLORS.teal}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 0 20px ${COLORS.teal}22`,
                    }}
                  >
                    <div style={{ fontSize: 20, color: COLORS.teal, fontWeight: 800, fontFamily: FONTS.code }}>
                      &#9646;
                    </div>
                  </div>

                  {/* Balanced dots */}
                  {Array.from({ length: dotsPerNode }).map((_, j) => {
                    const dotAngle = (j / dotsPerNode) * Math.PI * 2 + frame * 0.03 + i * 2;
                    const dotRadius = 38 + Math.sin(frame * 0.05 + j) * 5;
                    const dx = Math.cos(dotAngle) * dotRadius;
                    const dy = Math.sin(dotAngle) * dotRadius;
                    const dotFade = interpolate(
                      overallProgress,
                      [0.3, 0.6, 1],
                      [0, 0.5, 0.9],
                      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                    );

                    return (
                      <div
                        key={j}
                        style={{
                          position: 'absolute',
                          left: `calc(50% + ${dx}px)`,
                          top: `calc(50% + ${dy}px)`,
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: COLORS.teal,
                          opacity: dotFade * nodeSpring,
                          boxShadow: `0 0 6px ${COLORS.teal}66`,
                          transform: 'translate(-50%, -50%)',
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Status text */}
          <div
            style={{
              fontSize: SIZES.bodySmall,
              color: COLORS.teal,
              fontFamily: FONTS.code,
              opacity: overallProgress,
            }}
          >
            &#10003; BALANCED
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default ProblemVisualization;
