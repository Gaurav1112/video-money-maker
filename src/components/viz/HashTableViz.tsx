import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';
import type { SyncState } from '../../types';

// Theme colors
const COLORS = {
  dark: '#0C0A15',
  darkAlt: '#1A1625',
  saffron: '#E85D26',
  gold: '#FFD700',
  teal: '#20C997',
  indigo: '#818CF8',
  gray: '#A9ACB3',
  white: '#FFFFFF',
  border: '#2A2640',
};

interface HashTableVizProps {
  sync: SyncState;
  frame: number;
  keywords: string[];
}

// Clamp a value between min and max
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Map progress within a sub-range [start, end] → [0, 1]
function progressInRange(overall: number, start: number, end: number): number {
  return clamp((overall - start) / (end - start), 0, 1);
}

// A single bucket slot label + rectangle
const BucketSlot: React.FC<{
  index: number;
  opacity: number;
  translateX: number;
  highlighted?: boolean;
}> = ({ index, opacity, translateX, highlighted }) => {
  const bg = highlighted ? COLORS.saffron : COLORS.darkAlt;
  const border = highlighted ? COLORS.gold : COLORS.border;

  return (
    <div
      style={{
        position: 'absolute',
        top: 60 + index * 76,
        left: 40 + translateX,
        width: 100,
        height: 60,
        opacity,
        display: 'flex',
        alignItems: 'center',
        border: `2px solid ${border}`,
        borderRadius: 8,
        background: bg,
        fontFamily: 'JetBrains Mono, monospace',
        overflow: 'hidden',
        transition: 'background 0.2s',
      }}
    >
      {/* Index label */}
      <div
        style={{
          width: 36,
          height: '100%',
          background: COLORS.indigo,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 18,
          color: COLORS.white,
          flexShrink: 0,
        }}
      >
        {index}
      </div>
      {/* Empty bucket indicator */}
      <div
        style={{
          flex: 1,
          textAlign: 'center',
          color: COLORS.gray,
          fontSize: 18,
          fontStyle: 'italic',
        }}
      >
        —
      </div>
    </div>
  );
};

// A hash node (key in a chain)
const HashNode: React.FC<{
  label: string;
  x: number;
  y: number;
  opacity: number;
  scale: number;
  color: string;
  isCollision?: boolean;
}> = ({ label, x, y, opacity, scale, color, isCollision }) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: 'left center',
        display: 'flex',
        alignItems: 'center',
        gap: 0,
      }}
    >
      {isCollision && (
        // Chain link connector
        <div
          style={{
            width: 28,
            height: 3,
            background: COLORS.teal,
            alignSelf: 'center',
          }}
        />
      )}
      <div
        style={{
          padding: '10px 18px',
          borderRadius: 8,
          background: color,
          border: `2px solid ${COLORS.gold}`,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 20,
          fontWeight: 700,
          color: COLORS.dark,
          letterSpacing: 1,
          whiteSpace: 'nowrap',
          boxShadow: `0 0 16px ${color}88`,
        }}
      >
        {label}
      </div>
      {/* Next pointer stub */}
      <div
        style={{
          width: 18,
          height: 3,
          background: COLORS.gray,
          alignSelf: 'center',
        }}
      />
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: COLORS.gray,
          alignSelf: 'center',
        }}
      />
    </div>
  );
};

// Animated arrow that "draws" from right to left toward a bucket
const HashArrow: React.FC<{
  fromX: number;
  toX: number;
  y: number;
  progress: number; // 0 → 1, draws the arrow
  label: string;
  color: string;
}> = ({ fromX, toX, y, progress, label, color }) => {
  const totalLen = fromX - toX;
  const drawnLen = totalLen * progress;

  return (
    <div style={{ position: 'absolute', left: toX, top: y - 14, pointerEvents: 'none' }}>
      {/* Arrow shaft */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 14,
          width: drawnLen,
          height: 3,
          background: color,
          borderRadius: 2,
          transformOrigin: 'right center',
        }}
      />
      {/* Arrowhead */}
      {progress > 0.05 && (
        <div
          style={{
            position: 'absolute',
            left: drawnLen - 10,
            top: 7,
            width: 0,
            height: 0,
            borderTop: '10px solid transparent',
            borderBottom: '10px solid transparent',
            borderRight: `14px solid ${color}`,
          }}
        />
      )}
      {/* Key label above arrow */}
      <div
        style={{
          position: 'absolute',
          left: drawnLen / 2 - 20,
          top: -22,
          fontSize: 16,
          fontFamily: 'JetBrains Mono, monospace',
          color,
          fontWeight: 600,
          opacity: progress,
          whiteSpace: 'nowrap',
        }}
      >
        hash("{label}")
      </div>
    </div>
  );
};

export const HashTableViz: React.FC<HashTableVizProps> = ({ sync, frame }) => {
  const { fps } = useVideoConfig();
  const p = sync.sceneProgress; // 0 → 1

  // ─── 1. Bucket array reveal (progress 0 → 0.2) ───────────────────────────
  const bucketRevealP = progressInRange(p, 0, 0.2);
  const bucketSlots = [0, 1, 2, 3, 4];

  // ─── 2. "cat" hashes into bucket [0] (progress 0.2 → 0.35) ───────────────
  const catP = progressInRange(p, 0.2, 0.35);
  const catArrowP = clamp(catP * 2, 0, 1);         // arrow draws first half
  const catNodeP = clamp((catP - 0.5) * 2, 0, 1);  // node slides in second half

  const catNodeSpring = spring({
    frame: Math.max(0, frame - Math.round(0.275 * fps * 90)),
    fps,
    config: { damping: 12, stiffness: 120, mass: 0.7 },
  });

  const catNodeScale = interpolate(catNodeSpring, [0, 1], [0.5, 1]);
  const catNodeX = interpolate(catNodeP, [0, 1], [220, 160]);

  // ─── 3. "dog" hashes into bucket [2] (progress 0.35 → 0.5) ───────────────
  const dogP = progressInRange(p, 0.35, 0.5);
  const dogArrowP = clamp(dogP * 2, 0, 1);
  const dogNodeP = clamp((dogP - 0.5) * 2, 0, 1);

  const dogNodeSpring = spring({
    frame: Math.max(0, frame - Math.round(0.425 * fps * 90)),
    fps,
    config: { damping: 12, stiffness: 120, mass: 0.7 },
  });

  const dogNodeScale = interpolate(dogNodeSpring, [0, 1], [0.5, 1]);
  const dogNodeX = interpolate(dogNodeP, [0, 1], [220, 160]);

  // ─── 4. "fox" collides with "dog" at bucket [2], chains (0.5 → 0.7) ──────
  const foxP = progressInRange(p, 0.5, 0.7);
  const foxArrowP = clamp(foxP * 1.5, 0, 1);
  const foxNodeP = clamp((foxP - 0.5) * 2, 0, 1);
  const chainDrawP = clamp((foxP - 0.6) * 2.5, 0, 1);

  const foxNodeSpring = spring({
    frame: Math.max(0, frame - Math.round(0.6 * fps * 90)),
    fps,
    config: { damping: 12, stiffness: 120, mass: 0.7 },
  });

  const foxNodeScale = interpolate(foxNodeSpring, [0, 1], [0.5, 1]);
  const foxNodeX = interpolate(foxNodeP, [0, 1], [290, 248]);

  // ─── 5. Load factor bar (progress 0.7 → 1.0) ─────────────────────────────
  const loadP = progressInRange(p, 0.7, 1.0);
  const loadFillWidth = interpolate(loadP, [0, 1], [0, 60]); // 3/5 = 60%
  const loadBarOpacity = interpolate(loadP, [0, 0.1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Bucket highlight states
  const bucket0Highlighted = catP > 0.8;
  const bucket2Highlighted = dogP > 0.8 || foxP > 0.2;

  // Arrow origins (from the right side, toward the bucket edge at x=140)
  const ARROW_FROM_X = 340;
  const ARROW_TO_X = 142;

  // Bucket Y positions
  const bucketY = (i: number) => 60 + i * 76 + 30; // center of bucket

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: COLORS.dark,
        overflow: 'hidden',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* ── Title label ── */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 40,
          fontSize: 22,
          fontWeight: 700,
          color: COLORS.indigo,
          opacity: bucketRevealP,
          letterSpacing: 1,
          fontFamily: 'Inter, sans-serif',
        }}
      >
        Hash Table (chaining)
      </div>

      {/* ── Bucket array header ── */}
      <div
        style={{
          position: 'absolute',
          top: 44,
          left: 40,
          fontSize: 14,
          color: COLORS.gray,
          opacity: bucketRevealP,
          fontFamily: 'JetBrains Mono, monospace',
          letterSpacing: 1,
        }}
      >
        buckets[5]
      </div>

      {/* ── Bucket slots ── */}
      {bucketSlots.map((i) => {
        // Stagger each slot's reveal
        const slotP = progressInRange(p, i * 0.04, i * 0.04 + 0.12);
        const slotOpacity = interpolate(slotP, [0, 1], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const slotTranslateX = interpolate(slotP, [0, 1], [-30, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        const isHighlighted =
          (i === 0 && bucket0Highlighted) || (i === 2 && bucket2Highlighted);

        return (
          <BucketSlot
            key={i}
            index={i}
            opacity={slotOpacity}
            translateX={slotTranslateX}
            highlighted={isHighlighted}
          />
        );
      })}

      {/* ── Bracket / array border ── */}
      <div
        style={{
          position: 'absolute',
          top: 55,
          left: 36,
          width: 4,
          height: bucketSlots.length * 76 + 8,
          background: COLORS.indigo,
          borderRadius: 2,
          opacity: bucketRevealP,
        }}
      />

      {/* ── Arrow: "cat" → bucket[0] ── */}
      {catP > 0 && (
        <HashArrow
          fromX={ARROW_FROM_X}
          toX={ARROW_TO_X}
          y={bucketY(0)}
          progress={catArrowP}
          label="cat"
          color={COLORS.teal}
        />
      )}

      {/* ── Node: "cat" in bucket[0] ── */}
      {catNodeP > 0 && (
        <HashNode
          label='"cat"'
          x={catNodeX}
          y={bucketY(0) - 22}
          opacity={catNodeP}
          scale={catNodeScale}
          color={COLORS.teal}
        />
      )}

      {/* ── Arrow: "dog" → bucket[2] ── */}
      {dogP > 0 && (
        <HashArrow
          fromX={ARROW_FROM_X}
          toX={ARROW_TO_X}
          y={bucketY(2)}
          progress={dogArrowP}
          label="dog"
          color={COLORS.gold}
        />
      )}

      {/* ── Node: "dog" in bucket[2] ── */}
      {dogNodeP > 0 && (
        <HashNode
          label='"dog"'
          x={dogNodeX}
          y={bucketY(2) - 22}
          opacity={dogNodeP}
          scale={dogNodeScale}
          color={COLORS.gold}
        />
      )}

      {/* ── Arrow: "fox" → bucket[2] (collision) ── */}
      {foxP > 0 && (
        <HashArrow
          fromX={ARROW_FROM_X + 40}
          toX={ARROW_TO_X}
          y={bucketY(2) + 18}
          progress={foxArrowP}
          label="fox"
          color={COLORS.saffron}
        />
      )}

      {/* ── Chain draw indicator ── */}
      {chainDrawP > 0 && dogNodeP > 0.5 && (
        <div
          style={{
            position: 'absolute',
            left: dogNodeX + 118,
            top: bucketY(2) - 2,
            width: 28 * chainDrawP,
            height: 3,
            background: COLORS.teal,
            borderRadius: 2,
          }}
        />
      )}

      {/* ── Collision badge ── */}
      {foxP > 0.3 && (
        <div
          style={{
            position: 'absolute',
            left: foxNodeX - 10,
            top: bucketY(2) - 58,
            fontSize: 13,
            fontWeight: 700,
            color: COLORS.saffron,
            background: `${COLORS.saffron}22`,
            border: `1px solid ${COLORS.saffron}`,
            borderRadius: 6,
            padding: '3px 10px',
            opacity: interpolate(foxP, [0.3, 0.5], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            fontFamily: 'Inter, sans-serif',
            letterSpacing: 0.5,
          }}
        >
          COLLISION — chaining!
        </div>
      )}

      {/* ── Node: "fox" chained after "dog" ── */}
      {foxNodeP > 0 && (
        <HashNode
          label='"fox"'
          x={foxNodeX}
          y={bucketY(2) + 12}
          opacity={foxNodeP}
          scale={foxNodeScale}
          color={COLORS.saffron}
          isCollision={chainDrawP > 0.5}
        />
      )}

      {/* ── Load factor bar ── */}
      {loadP > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: 40,
            right: 40,
            opacity: loadBarOpacity,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 6,
              fontSize: 16,
              color: COLORS.gray,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <span>
              Load Factor{' '}
              <span style={{ color: COLORS.gold, fontWeight: 700 }}>
                λ = {(0.6 * loadP).toFixed(2)}
              </span>
            </span>
            <span style={{ color: COLORS.gray, fontSize: 13 }}>
              3 keys / 5 buckets = 0.60
            </span>
          </div>

          {/* Track */}
          <div
            style={{
              width: '100%',
              height: 16,
              borderRadius: 8,
              background: COLORS.darkAlt,
              border: `1px solid ${COLORS.border}`,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Fill */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${loadFillWidth}%`,
                borderRadius: 8,
                background: `linear-gradient(90deg, ${COLORS.teal}, ${COLORS.gold})`,
                transition: 'width 0.1s',
                boxShadow: `0 0 10px ${COLORS.teal}66`,
              }}
            />
          </div>

          {/* Threshold marker at 75% */}
          <div
            style={{
              position: 'relative',
              height: 20,
              marginTop: 2,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '75%',
                top: 0,
                width: 2,
                height: 12,
                background: COLORS.saffron,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 'calc(75% + 4px)',
                top: 0,
                fontSize: 12,
                color: COLORS.saffron,
                fontFamily: 'Inter, sans-serif',
                whiteSpace: 'nowrap',
              }}
            >
              rehash threshold (0.75)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
