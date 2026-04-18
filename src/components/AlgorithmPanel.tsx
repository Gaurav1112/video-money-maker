import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

const COLORS = {
  saffron: '#E85D26',
  gold: '#FFD700',
  teal: '#20C997',
  dark: '#0C0A15',
  darkAlt: '#1A1625',
  white: '#FFFFFF',
  gray: '#A9ACB3',
  indigo: '#818CF8',
};

const FONTS = {
  code: 'JetBrains Mono, Fira Code, monospace',
  main: 'Inter, sans-serif',
};

interface AlgorithmPanelProps {
  vizComponent: React.ReactNode;
  pseudocode: string[];
  activeLine: number;
  variables: Record<string, string | number>;
  sceneProgress?: number;
}

export const AlgorithmPanel: React.FC<AlgorithmPanelProps> = ({
  vizComponent,
  pseudocode,
  activeLine,
  variables,
  sceneProgress = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Staggered panel entrance
  const vizEntrance = spring({
    frame: Math.max(0, sceneProgress * 200),
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.9 },
  });

  const codeEntrance = spring({
    frame: Math.max(0, (sceneProgress - 0.1) * 200),
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.9 },
  });

  const varsEntrance = spring({
    frame: Math.max(0, (sceneProgress - 0.2) * 200),
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.9 },
  });

  const varEntries = Object.entries(variables);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        gap: 12,
        padding: '50px 24px 24px',
        fontFamily: FONTS.main,
      }}
    >
      {/* LEFT: Algorithm Visualization (60%) */}
      <div
        style={{
          flex: '0 0 58%',
          position: 'relative',
          opacity: vizEntrance,
          transform: `translateX(${interpolate(vizEntrance, [0, 1], [-40, 0])}px)`,
          borderRadius: 12,
          overflow: 'hidden',
          border: `1px solid ${COLORS.indigo}22`,
        }}
      >
        {vizComponent}
      </div>

      {/* RIGHT: Pseudocode + Variables (40%) */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Pseudocode Panel */}
        <div
          style={{
            flex: 1,
            opacity: codeEntrance,
            transform: `translateX(${interpolate(codeEntrance, [0, 1], [40, 0])}px)`,
            background: `${COLORS.darkAlt}DD`,
            border: `1px solid ${COLORS.indigo}33`,
            borderRadius: 12,
            padding: '16px 12px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: COLORS.indigo,
              marginBottom: 10,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
            }}
          >
            Pseudocode
          </div>
          {pseudocode.map((line, i) => {
            const isActive = i === activeLine;
            const isPast = i < activeLine;
            const isFuture = i > activeLine;

            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 8px',
                  borderRadius: 6,
                  background: isActive ? `${COLORS.saffron}22` : 'transparent',
                  borderLeft: isActive ? `3px solid ${COLORS.saffron}` : '3px solid transparent',
                  opacity: isFuture ? 0.2 : isPast ? 0.5 : 1,
                  marginBottom: 2,
                  transition: 'opacity 0.15s, background 0.15s',
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: isActive ? COLORS.saffron : COLORS.gray,
                    fontFamily: FONTS.code,
                    width: 18,
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontFamily: FONTS.code,
                    color: isActive ? "#FFFFFF" : COLORS.gray,
                    fontWeight: isActive ? 600 : 400,
                    whiteSpace: 'pre',
                  }}
                >
                  {line}
                </span>
              </div>
            );
          })}
        </div>

        {/* Variable State Panel */}
        <div
          style={{
            flex: '0 0 auto',
            minHeight: 120,
            opacity: varsEntrance,
            transform: `translateY(${interpolate(varsEntrance, [0, 1], [30, 0])}px)`,
            background: `${COLORS.darkAlt}DD`,
            border: `1px solid ${COLORS.teal}33`,
            borderRadius: 12,
            padding: '12px 16px',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: COLORS.teal,
              marginBottom: 10,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
            }}
          >
            Variables
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {varEntries.map(([key, value], i) => {
              const valSpring = spring({
                frame: Math.max(0, frame - i * 3),
                fps,
                config: { damping: 12, stiffness: 200, mass: 0.5 },
              });

              return (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 8,
                    background: `${COLORS.dark}`,
                    border: `1px solid ${COLORS.teal}33`,
                    transform: `scale(${0.95 + 0.05 * valSpring})`,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: FONTS.code,
                      color: COLORS.gray,
                    }}
                  >
                    {key}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: COLORS.teal,
                    }}
                  >
                    =
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontFamily: FONTS.code,
                      fontWeight: 700,
                      color: COLORS.saffron,
                    }}
                  >
                    {String(value)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
