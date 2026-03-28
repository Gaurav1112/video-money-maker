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
  variant?: string;
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

export const HashTableViz: React.FC<HashTableVizProps> = ({ sync, frame, keywords, variant }) => {
  const { fps } = useVideoConfig();
  const p = sync.sceneProgress; // 0 → 1

  // ─── VARIANT ROUTING ──────────────────────────────────────────────────────
  if (variant === 'collision') return <HashCollisionVariant sync={sync} frame={frame} keywords={keywords} />;
  if (variant === 'resize') return <HashResizeVariant sync={sync} frame={frame} keywords={keywords} />;
  if (variant === 'lookup') return <HashLookupVariant sync={sync} frame={frame} keywords={keywords} />;

  // ─── DEFAULT variant: 'insert' — original behavior ────────────────────────

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

// =====================================================================
// COLLISION VARIANT — Multiple keys hashing to same bucket, chain grows
// =====================================================================
const HashCollisionVariant: React.FC<Omit<HashTableVizProps, 'variant'>> = ({ sync, frame }) => {
  const { fps } = useVideoConfig();
  const p = sync.sceneProgress;

  const bucketRevealP = progressInRange(p, 0, 0.15);
  const bucketSlots = [0, 1, 2, 3, 4];

  // 4 items all hash to bucket[2] — long chain
  const items = ['ant', 'bat', 'cow', 'elk'];
  const itemColors = [COLORS.teal, COLORS.gold, COLORS.saffron, COLORS.indigo];
  const itemTriggers = [0.2, 0.35, 0.5, 0.65]; // when each appears

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: COLORS.dark, overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ position: 'absolute', top: 16, left: 40, fontSize: 22, fontWeight: 700, color: COLORS.saffron, opacity: bucketRevealP, letterSpacing: 1 }}>
        Hash Collision (Chaining)
      </div>

      <div style={{ position: 'absolute', top: 44, left: 40, fontSize: 14, color: COLORS.gray, opacity: bucketRevealP, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 1 }}>
        All keys hash to bucket[2]
      </div>

      {/* Bucket slots */}
      {bucketSlots.map((i) => {
        const slotP = progressInRange(p, i * 0.03, i * 0.03 + 0.1);
        const isHighlighted = i === 2 && p > 0.2;
        return (
          <BucketSlot key={i} index={i} opacity={slotP} translateX={interpolate(slotP, [0, 1], [-30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} highlighted={isHighlighted} />
        );
      })}

      {/* Bracket */}
      <div style={{ position: 'absolute', top: 55, left: 36, width: 4, height: bucketSlots.length * 76 + 8, background: COLORS.indigo, borderRadius: 2, opacity: bucketRevealP }} />

      {/* Chain of nodes at bucket[2] */}
      {items.map((item, idx) => {
        const itemP = progressInRange(p, itemTriggers[idx], itemTriggers[idx] + 0.12);
        if (itemP <= 0) return null;
        const nodeSpring = spring({ frame: Math.max(0, frame - Math.round(itemTriggers[idx] * fps * 10)), fps, config: { damping: 12, stiffness: 120, mass: 0.7 } });
        return (
          <HashNode key={item} label={`"${item}"`} x={160 + idx * 100} y={60 + 2 * 76 + 8} opacity={itemP} scale={nodeSpring} color={itemColors[idx]} isCollision={idx > 0} />
        );
      })}

      {/* Collision counter */}
      {p > 0.4 && (
        <div style={{
          position: 'absolute', bottom: 50, left: 40, right: 40,
          display: 'flex', justifyContent: 'center', gap: 20,
          opacity: interpolate(p, [0.4, 0.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}>
          <div style={{ background: `${COLORS.saffron}22`, border: `1px solid ${COLORS.saffron}`, borderRadius: 8, padding: '8px 20px' }}>
            <span style={{ fontSize: 14, color: COLORS.saffron, fontWeight: 700 }}>
              Collisions: {Math.min(items.length - 1, Math.floor(progressInRange(p, 0.3, 0.7) * items.length))}
            </span>
          </div>
          <div style={{ background: `${COLORS.indigo}22`, border: `1px solid ${COLORS.indigo}`, borderRadius: 8, padding: '8px 20px' }}>
            <span style={{ fontSize: 14, color: COLORS.indigo, fontWeight: 700 }}>
              Lookup: O({Math.min(items.length, Math.floor(progressInRange(p, 0.3, 0.7) * items.length) + 1)})
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// =====================================================================
// RESIZE VARIANT — Table doubles when load factor exceeds threshold
// =====================================================================
const HashResizeVariant: React.FC<Omit<HashTableVizProps, 'variant'>> = ({ sync, frame }) => {
  const { fps } = useVideoConfig();
  const p = sync.sceneProgress;

  // Phase 1 (0-0.4): Fill 4/5 buckets (load factor rising to 0.8)
  // Phase 2 (0.4-0.6): Threshold exceeded — "RESIZE!" alert
  // Phase 3 (0.6-1.0): New array of 10 buckets, items rehash

  const fillP = progressInRange(p, 0, 0.4);
  const resizeP = progressInRange(p, 0.4, 0.6);
  const rehashP = progressInRange(p, 0.6, 1.0);

  const oldBuckets = 5;
  const newBuckets = 10;
  const filledCount = Math.floor(fillP * 4);
  const loadFactor = filledCount / oldBuckets;

  const showOld = rehashP < 0.5;
  const showNew = resizeP > 0.5;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: COLORS.dark, overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ position: 'absolute', top: 16, left: 40, fontSize: 22, fontWeight: 700, color: COLORS.gold, letterSpacing: 1 }}>
        Dynamic Resizing
      </div>

      {/* Load factor bar at top */}
      <div style={{ position: 'absolute', top: 50, left: 40, right: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: COLORS.gray, marginBottom: 4 }}>
          <span>Load Factor: <span style={{ color: loadFactor > 0.75 ? COLORS.saffron : COLORS.gold, fontWeight: 700 }}>{loadFactor.toFixed(2)}</span></span>
          <span style={{ color: COLORS.saffron }}>Threshold: 0.75</span>
        </div>
        <div style={{ width: '100%', height: 12, borderRadius: 6, background: COLORS.darkAlt, overflow: 'hidden' }}>
          <div style={{ width: `${loadFactor * 100}%`, height: '100%', borderRadius: 6, background: loadFactor > 0.75 ? COLORS.saffron : COLORS.teal, transition: 'width 0.2s' }} />
        </div>
      </div>

      {/* Old array (left side) */}
      {showOld && (
        <div style={{ position: 'absolute', left: 40, top: 100, opacity: showNew ? 0.3 : 1, transition: 'opacity 0.3s' }}>
          <div style={{ fontSize: 12, color: COLORS.gray, fontFamily: 'JetBrains Mono, monospace', marginBottom: 6 }}>
            buckets[{oldBuckets}]
          </div>
          {Array.from({ length: oldBuckets }).map((_, i) => (
            <div key={i} style={{
              width: 80, height: 36, marginBottom: 4, borderRadius: 6,
              background: i < filledCount ? `${COLORS.teal}33` : COLORS.darkAlt,
              border: `1.5px solid ${i < filledCount ? COLORS.teal : COLORS.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: i < filledCount ? COLORS.teal : COLORS.gray, fontFamily: 'JetBrains Mono, monospace',
            }}>
              {i < filledCount ? `k${i}` : '\u2014'}
            </div>
          ))}
        </div>
      )}

      {/* Resize alert */}
      {resizeP > 0 && resizeP < 1 && (
        <div style={{
          position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)',
          background: `${COLORS.saffron}22`, border: `2px solid ${COLORS.saffron}`, borderRadius: 12,
          padding: '16px 32px', zIndex: 20,
          opacity: interpolate(resizeP, [0, 0.3, 0.7, 1], [0, 1, 1, 0]),
        }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: COLORS.saffron }}>
            RESIZE! {oldBuckets} {'\u2192'} {newBuckets} buckets
          </span>
        </div>
      )}

      {/* New array (right side) */}
      {showNew && (
        <div style={{ position: 'absolute', right: 40, top: 100, opacity: rehashP }}>
          <div style={{ fontSize: 12, color: COLORS.gold, fontFamily: 'JetBrains Mono, monospace', marginBottom: 6, fontWeight: 700 }}>
            buckets[{newBuckets}] (new)
          </div>
          {Array.from({ length: newBuckets }).map((_, i) => {
            const rehashed = i < filledCount && rehashP > (i + 1) / filledCount;
            return (
              <div key={i} style={{
                width: 80, height: 28, marginBottom: 3, borderRadius: 5,
                background: rehashed ? `${COLORS.gold}33` : COLORS.darkAlt,
                border: `1.5px solid ${rehashed ? COLORS.gold : COLORS.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: rehashed ? COLORS.gold : COLORS.gray, fontFamily: 'JetBrains Mono, monospace',
                transform: `scale(${rehashed ? 1 : 0.9})`, transition: 'all 0.2s',
              }}>
                {rehashed ? `k${i}` : '\u2014'}
              </div>
            );
          })}
        </div>
      )}

      {/* Rehash arrow */}
      {showNew && showOld && (
        <div style={{
          position: 'absolute', top: '55%', left: '50%', transform: 'translate(-50%, -50%)',
          fontSize: 36, color: COLORS.gold, opacity: rehashP * 0.8,
        }}>
          {'\u27A1'}
        </div>
      )}
    </div>
  );
};

// =====================================================================
// LOOKUP VARIANT — Searching for a key: hash, find bucket, traverse chain
// =====================================================================
const HashLookupVariant: React.FC<Omit<HashTableVizProps, 'variant'>> = ({ sync, frame }) => {
  const { fps } = useVideoConfig();
  const p = sync.sceneProgress;

  const bucketRevealP = progressInRange(p, 0, 0.15);
  const bucketSlots = [0, 1, 2, 3, 4];

  // Pre-populated table with items
  const prePopulated = [
    { key: 'cat', bucket: 0, chainPos: 0, color: COLORS.teal },
    { key: 'dog', bucket: 2, chainPos: 0, color: COLORS.gold },
    { key: 'fox', bucket: 2, chainPos: 1, color: COLORS.saffron },
    { key: 'pig', bucket: 4, chainPos: 0, color: COLORS.indigo },
  ];

  // Search phases: hash("fox") -> bucket[2] -> traverse chain -> found!
  const hashPhaseP = progressInRange(p, 0.3, 0.45);   // compute hash
  const bucketPhaseP = progressInRange(p, 0.45, 0.6);  // jump to bucket[2]
  const traverseP = progressInRange(p, 0.6, 0.8);      // check dog, then fox
  const foundP = progressInRange(p, 0.8, 0.95);        // highlight fox

  // Highlight states
  const searchTarget = 'fox';
  const highlightBucket = bucketPhaseP > 0.5 ? 2 : -1;
  const checkingNode = traverseP < 0.5 ? 0 : 1; // 0=dog, 1=fox
  const isFound = foundP > 0.3;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: COLORS.dark, overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ position: 'absolute', top: 16, left: 40, fontSize: 22, fontWeight: 700, color: COLORS.indigo, opacity: bucketRevealP, letterSpacing: 1 }}>
        Hash Lookup: get("{searchTarget}")
      </div>

      {/* Bucket slots */}
      {bucketSlots.map((i) => {
        const slotP = progressInRange(p, i * 0.03, i * 0.03 + 0.1);
        return (
          <BucketSlot key={i} index={i} opacity={slotP} translateX={interpolate(slotP, [0, 1], [-30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} highlighted={i === highlightBucket} />
        );
      })}

      {/* Bracket */}
      <div style={{ position: 'absolute', top: 55, left: 36, width: 4, height: bucketSlots.length * 76 + 8, background: COLORS.indigo, borderRadius: 2, opacity: bucketRevealP }} />

      {/* Pre-populated nodes */}
      {prePopulated.map((item) => {
        const nodeP = progressInRange(p, 0.1, 0.25);
        const bucketY = 60 + item.bucket * 76;
        const isBeingChecked = item.bucket === 2 && traverseP > 0 && checkingNode === item.chainPos;
        const isFoundNode = item.key === searchTarget && isFound;
        const nodeColor = isFoundNode ? COLORS.teal : isBeingChecked ? COLORS.gold : item.color;
        return (
          <HashNode key={item.key} label={`"${item.key}"`} x={160 + item.chainPos * 100} y={bucketY + 8} opacity={nodeP} scale={nodeP} color={nodeColor} isCollision={item.chainPos > 0} />
        );
      })}

      {/* Hash computation display */}
      {hashPhaseP > 0 && (
        <div style={{
          position: 'absolute', top: 50, right: 40, background: `${COLORS.indigo}22`, border: `1px solid ${COLORS.indigo}`, borderRadius: 8, padding: '10px 16px',
          opacity: hashPhaseP, fontFamily: 'JetBrains Mono, monospace',
        }}>
          <div style={{ fontSize: 13, color: COLORS.indigo }}>hash("{searchTarget}") = 2</div>
          <div style={{ fontSize: 11, color: COLORS.gray, marginTop: 4 }}>{'\u2192'} go to bucket[2]</div>
        </div>
      )}

      {/* Traversal indicator */}
      {traverseP > 0 && !isFound && (
        <div style={{
          position: 'absolute', top: 60 + 2 * 76 - 28, left: 160 + checkingNode * 100,
          fontSize: 11, fontWeight: 700, color: COLORS.gold, background: `${COLORS.gold}22`, border: `1px solid ${COLORS.gold}`,
          borderRadius: 4, padding: '2px 8px', opacity: 0.5 + 0.5 * Math.sin(frame * 0.2),
        }}>
          {checkingNode === 0 ? '"dog" != "fox" \u2192 next' : 'checking...'}
        </div>
      )}

      {/* Found! badge */}
      {isFound && (
        <div style={{
          position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
          background: `${COLORS.teal}22`, border: `2px solid ${COLORS.teal}`, borderRadius: 10, padding: '12px 28px',
          opacity: foundP,
        }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: COLORS.teal }}>
            FOUND "{searchTarget}" in O(2) steps
          </span>
        </div>
      )}
    </div>
  );
};
