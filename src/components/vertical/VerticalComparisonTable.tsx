import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate,
  spring,
} from 'remotion';
import { FONTS } from '../../lib/theme';
import { SAFE_ZONE, COMPONENT_DIMS } from '../../lib/vertical-layouts';
import type { AnimationCue } from '../../types';

/* ─── Dark theme constants ──────────────────────────────────────────────────── */

const DARK = {
  bg: '#0C0A15',
  cardBg: '#1A1A2E',
  cardBorder: 'rgba(255,255,255,0.08)',
  teal: '#1DD1A1',
  saffron: '#E85D26',
  gold: '#FDB813',
  labelColor: 'rgba(255,255,255,0.5)',
  valueColor: '#FFFFFF',
  titleColor: '#FFFFFF',
} as const;

/* ─── Winner auto-detection (mirrors ComparisonTable) ──────────────────────── */

const WINNER_KEYWORDS =
  /\b(faster|better|yes|lower|higher throughput|more scalable|built-in|native|optimal|efficient|unlimited|redundancy|strong)\b/i;
const LOSER_KEYWORDS =
  /\b(slower|worse|no|higher latency|single point|limited|manual|complex|exponential|ceiling)\b/i;

function autoDetectWinner(a: string, b: string): 'A' | 'B' | 'tie' {
  const aNet =
    (a.match(WINNER_KEYWORDS) || []).length -
    (a.match(LOSER_KEYWORDS) || []).length;
  const bNet =
    (b.match(WINNER_KEYWORDS) || []).length -
    (b.match(LOSER_KEYWORDS) || []).length;
  if (aNet > bNet) return 'A';
  if (bNet > aNet) return 'B';
  return 'tie';
}

/* ─── Props ─────────────────────────────────────────────────────────────────── */

interface VerticalComparisonTableProps {
  headers?: string[];
  rows?: string[][];
  title?: string;
  startFrame?: number;
  endFrame?: number;
  sceneIndex?: number;
  sceneStartFrame?: number;
  animationCues?: AnimationCue[];
}

/* ─── Parsed row data ───────────────────────────────────────────────────────── */

interface ParsedRow {
  label: string;
  valueA: string;
  valueB: string;
  winner: 'A' | 'B' | 'tie';
}

function parseRows(headers: string[], rows: string[][]): ParsedRow[] {
  const cleanRows = rows.filter(
    (row) => !row.every((cell) => /^[-:]+$/.test(cell) || cell.trim() === ''),
  );
  return cleanRows.map((row) => {
    const label = row[0] || '';
    const valueA = row[1] || '—';
    const valueB = row[2] || '—';
    const winner =
      headers.length >= 3 ? autoDetectWinner(valueA, valueB) : 'tie';
    return { label, valueA, valueB, winner };
  });
}

/* ─── Card component ─────────────────────────────────────────────────────────── */

interface CardProps {
  name: string;
  accentColor: string;
  rows: ParsedRow[];
  valueKey: 'valueA' | 'valueB';
  winner: 'A' | 'B' | null;
  /** translateX spring value (pixels) */
  translateX: number;
  opacity: number;
  /** starting frame offset for row stagger */
  rowStaggerBase: number;
  elapsed: number;
  fps: number;
  /** layout */
  x: number;
  y: number;
  width: number;
  height: number;
}

const ComparisonCard: React.FC<CardProps> = ({
  name,
  accentColor,
  rows,
  valueKey,
  winner,
  translateX,
  opacity,
  rowStaggerBase,
  elapsed,
  fps,
  x,
  y,
  width,
  height,
}) => {
  const HEADER_H = 90;
  const ROW_H = Math.min(72, Math.floor((height - HEADER_H - 40) / Math.max(rows.length, 1)));
  const paddingH = 40;
  const paddingV = 20;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        transform: `translateX(${translateX}px)`,
        opacity,
        backgroundColor: DARK.cardBg,
        borderRadius: 20,
        border: `1px solid ${DARK.cardBorder}`,
        overflow: 'hidden',
        boxShadow: `0 4px 40px rgba(0,0,0,0.4)`,
      }}
    >
      {/* Accent bar at top */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          backgroundColor: accentColor,
        }}
      />

      {/* Header */}
      <div
        style={{
          position: 'absolute',
          top: 6,
          left: paddingH,
          right: paddingH,
          height: HEADER_H,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* Accent dot */}
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            backgroundColor: accentColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: FONTS.heading,
            fontSize: 40,
            fontWeight: 700,
            color: DARK.titleColor,
            letterSpacing: '-0.5px',
            lineHeight: 1,
          }}
        >
          {name}
        </span>
        {winner && (
          <span
            style={{
              marginLeft: 'auto',
              backgroundColor: accentColor,
              color: '#0C0A15',
              fontFamily: FONTS.heading,
              fontSize: 22,
              fontWeight: 800,
              padding: '4px 16px',
              borderRadius: 100,
              flexShrink: 0,
            }}
          >
            WINNER
          </span>
        )}
      </div>

      {/* Divider */}
      <div
        style={{
          position: 'absolute',
          top: 6 + HEADER_H,
          left: paddingH,
          right: paddingH,
          height: 1,
          backgroundColor: DARK.cardBorder,
        }}
      />

      {/* Rows */}
      <div
        style={{
          position: 'absolute',
          top: 6 + HEADER_H + 8,
          left: 0,
          right: 0,
          bottom: 0,
          padding: `${paddingV}px ${paddingH}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {rows.map((row, i) => {
          const rowFrame = rowStaggerBase + i * 8;
          const rowSpring = spring({
            frame: Math.max(0, elapsed - rowFrame),
            fps,
            config: { damping: 12, stiffness: 180, mass: 0.6 },
          });
          const rowOpacity = interpolate(rowSpring, [0, 1], [0, 1]);
          const rowTranslateY = interpolate(rowSpring, [0, 1], [12, 0]);

          const isRowWinner =
            (valueKey === 'valueA' && row.winner === 'A') ||
            (valueKey === 'valueB' && row.winner === 'B');

          return (
            <div
              key={i}
              style={{
                opacity: rowOpacity,
                transform: `translateY(${rowTranslateY}px)`,
                height: ROW_H,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                borderBottom:
                  i < rows.length - 1
                    ? `1px solid ${DARK.cardBorder}`
                    : 'none',
                paddingBottom: i < rows.length - 1 ? 4 : 0,
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.text,
                  fontSize: 24,
                  color: DARK.labelColor,
                  lineHeight: 1.2,
                  marginBottom: 2,
                }}
              >
                {row.label}
              </span>
              <span
                style={{
                  fontFamily: FONTS.text,
                  fontSize: 30,
                  fontWeight: 600,
                  color: isRowWinner ? accentColor : DARK.valueColor,
                  lineHeight: 1.25,
                }}
              >
                {row[valueKey]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ─── VS Badge ──────────────────────────────────────────────────────────────── */

interface VSBadgeProps {
  scale: number;
  opacity: number;
  x: number;
  y: number;
  size: number;
}

const VSBadge: React.FC<VSBadgeProps> = ({ scale, opacity, x, y, size }) => (
  <div
    style={{
      position: 'absolute',
      left: x - size / 2,
      top: y - size / 2,
      width: size,
      height: size,
      transform: `scale(${scale})`,
      opacity,
      backgroundColor: DARK.gold,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: `0 0 30px rgba(253, 184, 19, 0.6), 0 0 60px rgba(253, 184, 19, 0.3)`,
      zIndex: 10,
    }}
  >
    <span
      style={{
        fontFamily: FONTS.heading,
        fontSize: size * 0.35,
        fontWeight: 900,
        color: '#0C0A15',
        letterSpacing: '-1px',
        lineHeight: 1,
      }}
    >
      VS
    </span>
  </div>
);

/* ─── Main Component ─────────────────────────────────────────────────────────── */

const VerticalComparisonTable: React.FC<VerticalComparisonTableProps> = ({
  headers = [],
  rows = [],
  title = '',
  startFrame = 0,
  sceneStartFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const effectiveStart = sceneStartFrame ?? startFrame;
  const elapsed = Math.max(0, frame - effectiveStart);

  /* ── Parse data ─────────────────────────────────────────────────────────── */
  const optionAName = headers.length >= 2 ? headers[1] : 'Option A';
  const optionBName = headers.length >= 3 ? headers[2] : 'Option B';
  const parsedRows = parseRows(headers, rows);

  /* ── Determine overall winner for badge ─────────────────────────────────── */
  const aWins = parsedRows.filter((r) => r.winner === 'A').length;
  const bWins = parsedRows.filter((r) => r.winner === 'B').length;
  const overallWinner: 'A' | 'B' | null =
    aWins > bWins ? 'A' : bWins > aWins ? 'B' : null;

  /* ── Layout constants ───────────────────────────────────────────────────── */
  const CANVAS_W = 1080;

  // Title region
  const TITLE_Y = 210; // was 60 — must be below SAFE_ZONE.top (200)
  const TITLE_H = 110;

  // Cards from vertical-layouts comparison dims
  const compDims = COMPONENT_DIMS.comparison;
  const CARD_X = SAFE_ZONE.left;
  const CARD_W = SAFE_ZONE.contentWidth;

  const CARD_A_Y = TITLE_Y + TITLE_H + 20;
  const CARD_A_H = compDims.topHeight;    // 700

  const VS_Y = CARD_A_Y + CARD_A_H + 55; // midpoint between cards
  const VS_SIZE = 90;

  const CARD_B_Y = VS_Y + VS_SIZE / 2 + 20;
  const CARD_B_H = compDims.bottomHeight; // 700

  /* ── Animations ─────────────────────────────────────────────────────────── */

  // Title fade-in
  const titleSpring = spring({
    frame: Math.max(0, elapsed),
    fps,
    config: { damping: 14, stiffness: 200, mass: 0.5 },
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleTranslateY = interpolate(titleSpring, [0, 1], [-20, 0]);

  // Card A: slide from left, starts at frame 0
  const cardASpring = spring({
    frame: Math.max(0, elapsed),
    fps,
    config: { damping: 14, stiffness: 160, mass: 0.7 },
  });
  const cardATranslateX = interpolate(cardASpring, [0, 1], [-100, 0]);
  const cardAOpacity = interpolate(cardASpring, [0, 1], [0, 1]);

  // VS badge: scale up at frame 20
  const vsSpring = spring({
    frame: Math.max(0, elapsed - 20),
    fps,
    config: { damping: 8, stiffness: 200, mass: 0.5 },
  });
  const vsScale = interpolate(vsSpring, [0, 1], [0, 1]);
  const vsOpacity = interpolate(vsSpring, [0, 1], [0, 1]);

  // Card B: slide from right, starts at frame 25
  const cardBSpring = spring({
    frame: Math.max(0, elapsed - 25),
    fps,
    config: { damping: 14, stiffness: 160, mass: 0.7 },
  });
  const cardBTranslateX = interpolate(cardBSpring, [0, 1], [100, 0]);
  const cardBOpacity = interpolate(cardBSpring, [0, 1], [0, 1]);

  // Row stagger offsets: Card A rows start at frame 8, Card B at frame 33
  const rowStaggerA = 8;
  const rowStaggerB = 33;

  return (
    <AbsoluteFill style={{ backgroundColor: DARK.bg }}>
      {/* ── Scene Title ──────────────────────────────────────────────────────── */}
      {title ? (
        <div
          style={{
            position: 'absolute',
            left: CARD_X,
            top: TITLE_Y,
            width: CARD_W,
            opacity: titleOpacity,
            transform: `translateY(${titleTranslateY}px)`,
          }}
        >
          {/* Saffron accent bar */}
          <div
            style={{
              width: 60,
              height: 6,
              backgroundColor: DARK.saffron,
              borderRadius: 3,
              marginBottom: 16,
            }}
          />
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 44,
              fontWeight: 800,
              color: DARK.titleColor,
              lineHeight: 1.1,
              letterSpacing: '-0.5px',
              display: 'block',
            }}
          >
            {title}
          </span>
        </div>
      ) : null}

      {/* ── Card A ────────────────────────────────────────────────────────────── */}
      <ComparisonCard
        name={optionAName}
        accentColor={DARK.teal}
        rows={parsedRows}
        valueKey="valueA"
        winner={overallWinner === 'A' ? 'A' : null}
        translateX={cardATranslateX}
        opacity={cardAOpacity}
        rowStaggerBase={rowStaggerA}
        elapsed={elapsed}
        fps={fps}
        x={CARD_X}
        y={CARD_A_Y}
        width={CARD_W}
        height={CARD_A_H}
      />

      {/* ── VS Badge ──────────────────────────────────────────────────────────── */}
      <VSBadge
        scale={vsScale}
        opacity={vsOpacity}
        x={CANVAS_W / 2}
        y={VS_Y}
        size={VS_SIZE}
      />

      {/* ── Card B ────────────────────────────────────────────────────────────── */}
      <ComparisonCard
        name={optionBName}
        accentColor={DARK.saffron}
        rows={parsedRows}
        valueKey="valueB"
        winner={overallWinner === 'B' ? 'B' : null}
        translateX={cardBTranslateX}
        opacity={cardBOpacity}
        rowStaggerBase={rowStaggerB}
        elapsed={elapsed}
        fps={fps}
        x={CARD_X}
        y={CARD_B_Y}
        width={CARD_W}
        height={CARD_B_H}
      />
    </AbsoluteFill>
  );
};

export default VerticalComparisonTable;
