/**
 * CartoonFace.tsx — Programmatic SVG cartoon faces for ThumbnailV2 Layout A.
 *
 * Why this file exists:
 *   ThumbnailV2 Layout A (face + text + arrow) requires a `faceImageSrc` PNG.
 *   The original design depended on SadTalker output at
 *   `tools/sadtalker-env/output/<topic>/peak-emotion.png` — that pipeline was
 *   never run in CI, so Layout A degraded to Layout B for every render. The
 *   audit (MASTER-GAP-LIST.md A1) flagged "faces with emotion = +30% CTR"
 *   per MrBeast / India-creator benchmarks but the assets never existed.
 *
 * What this delivers:
 *   A pure-SVG, pure-React cartoon face with 6 emotions:
 *     shocked   — wide eyes, oh-shaped mouth (best for "WRONG" titles)
 *     confused  — asymmetric brows, neutral mouth (best for "Why?" titles)
 *     smug      — narrowed eyes, smirk (best for "secret/hack" titles)
 *     scared    — wide eyes, downturn mouth (best for "STOP/FAIL" titles)
 *     excited   — sparkle eyes, big smile (best for "discover/learn" titles)
 *     smirk     — half-smile, raised brow (best for "obvious/easy" titles)
 *
 *   Picks an emotion deterministically from topic+title sentiment:
 *     - title contains WRONG/FAIL → shocked
 *     - title contains STOP/NEVER → scared
 *     - title contains FAANG/SECRET → smug
 *     - title contains WHY/HOW → confused
 *     - title contains 90%/COST → shocked
 *     - default → smirk (safe, mildly positive)
 *
 *   Rendered at 486×720 (matches LayoutA face zone). Pure SVG — Remotion
 *   captures it directly via the same path as Img, with no asset round-trip
 *   to disk, no SadTalker dependency, no PNG storage in repo.
 *
 * Skin / accent colours pull from the Palette so the face harmonises with
 * the topic's colour scheme (Kafka green, Redis red, etc.).
 */

import React from 'react';

export type FaceEmotion =
  | 'shocked'
  | 'confused'
  | 'smug'
  | 'scared'
  | 'excited'
  | 'smirk';

export interface CartoonFaceProps {
  emotion: FaceEmotion;
  /** Background fill behind the face (usually palette.bg). */
  backgroundColor: string;
  /** Accent for hair / shirt collar. */
  accentColor: string;
  /** Width and height in CSS px. Default 486×720 for Layout A. */
  width?: number;
  height?: number;
}

/**
 * Map a (topic, hookText) pair to a deterministic emotion. Used by callers
 * that don't have an explicit emotion preference — keeps thumbnail output
 * consistent across re-renders.
 */
export function emotionFor(hookText: string): FaceEmotion {
  const t = hookText.toUpperCase();
  if (/\b(WRONG|FAIL|BROKEN|BUG|MISTAKE)\b/.test(t)) return 'shocked';
  if (/\b(STOP|NEVER|DON'T|AVOID|DANGER)\b/.test(t)) return 'scared';
  if (/\b(SECRET|HACK|TRICK|FAANG|TRUTH|PRO)\b/.test(t)) return 'smug';
  if (/\b(WHY|HOW|WHAT|CONFUSING)\b/.test(t)) return 'confused';
  if (/(90%|99%|COST|₹|RUPEE|LPA|LAKH)/.test(t)) return 'shocked';
  if (/\b(LEARN|MASTER|UNLOCK|DISCOVER|NEW)\b/.test(t)) return 'excited';
  return 'smirk';
}

const SKIN = '#F5C9A0';
const SKIN_SHADOW = '#D8A678';
const HAIR_DARK = '#2A1810';
const EYE_WHITE = '#FFFFFF';
const PUPIL = '#1A1A1A';
const MOUTH_RED = '#C84444';
const TEETH = '#FFF8E8';

/**
 * CartoonFace — single SVG, fixed viewBox, scales to any size.
 * The viewBox is 0 0 486 720 to match the LayoutA face slot.
 */
export const CartoonFace: React.FC<CartoonFaceProps> = ({
  emotion,
  backgroundColor,
  accentColor,
  width = 486,
  height = 720,
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 486 720"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {/* Background tint */}
      <rect width="486" height="720" fill={backgroundColor} />

      {/* Shoulder / shirt — accent colour collar */}
      <ellipse cx="243" cy="780" rx="280" ry="120" fill={accentColor} />
      <ellipse cx="243" cy="770" rx="220" ry="80" fill={HAIR_DARK} opacity="0.15" />

      {/* Neck */}
      <rect x="200" y="540" width="86" height="100" fill={SKIN_SHADOW} />

      {/* Face oval */}
      <ellipse cx="243" cy="380" rx="170" ry="200" fill={SKIN} />

      {/* Hair — depends slightly on emotion (excited has hair-up vibe) */}
      <path
        d={
          emotion === 'excited'
            ? 'M 90 280 Q 130 130 243 130 Q 360 130 396 280 Q 380 220 320 200 Q 300 140 243 150 Q 200 140 170 200 Q 110 220 90 280 Z'
            : 'M 90 290 Q 110 170 243 160 Q 380 170 396 290 Q 380 230 350 220 Q 350 200 320 190 Q 300 180 243 180 Q 190 180 170 195 Q 145 210 138 230 Q 110 230 90 290 Z'
        }
        fill={HAIR_DARK}
      />

      {/* Ears */}
      <ellipse cx="78" cy="380" rx="20" ry="35" fill={SKIN_SHADOW} />
      <ellipse cx="408" cy="380" rx="20" ry="35" fill={SKIN_SHADOW} />

      {/* Eyebrows — emotion-driven */}
      {renderBrows(emotion)}

      {/* Eyes — emotion-driven */}
      {renderEyes(emotion)}

      {/* Nose — same for all emotions */}
      <path
        d="M 230 380 Q 220 430 235 450 Q 250 455 256 445"
        stroke={SKIN_SHADOW}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />

      {/* Mouth — emotion-driven */}
      {renderMouth(emotion)}

      {/* Cheek blush — softens the shocked / excited emotions */}
      {(emotion === 'excited' || emotion === 'shocked') && (
        <>
          <ellipse cx="135" cy="450" rx="25" ry="15" fill="#F2A8A8" opacity="0.55" />
          <ellipse cx="350" cy="450" rx="25" ry="15" fill="#F2A8A8" opacity="0.55" />
        </>
      )}
    </svg>
  );
};

// ── Per-emotion sub-renderers ────────────────────────────────────────────────

function renderBrows(e: FaceEmotion): React.ReactElement {
  switch (e) {
    case 'shocked':
      return (
        <g>
          <path d="M 130 290 Q 165 260 200 285" stroke={HAIR_DARK} strokeWidth="8" fill="none" strokeLinecap="round" />
          <path d="M 290 285 Q 325 260 360 290" stroke={HAIR_DARK} strokeWidth="8" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'confused':
      return (
        <g>
          {/* asymmetric brows — left tilted up, right tilted down */}
          <path d="M 130 295 Q 165 270 200 290" stroke={HAIR_DARK} strokeWidth="8" fill="none" strokeLinecap="round" />
          <path d="M 290 290 L 360 305" stroke={HAIR_DARK} strokeWidth="8" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'smug':
      return (
        <g>
          {/* both brows raised slightly */}
          <path d="M 130 290 L 200 285" stroke={HAIR_DARK} strokeWidth="8" fill="none" strokeLinecap="round" />
          <path d="M 290 285 L 360 290" stroke={HAIR_DARK} strokeWidth="8" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'scared':
      return (
        <g>
          {/* furrowed centre */}
          <path d="M 130 305 Q 165 290 200 305" stroke={HAIR_DARK} strokeWidth="8" fill="none" strokeLinecap="round" />
          <path d="M 290 305 Q 325 290 360 305" stroke={HAIR_DARK} strokeWidth="8" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'excited':
      return (
        <g>
          {/* high arched */}
          <path d="M 130 280 Q 165 250 200 280" stroke={HAIR_DARK} strokeWidth="8" fill="none" strokeLinecap="round" />
          <path d="M 290 280 Q 325 250 360 280" stroke={HAIR_DARK} strokeWidth="8" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'smirk':
    default:
      return (
        <g>
          {/* one brow raised (right) */}
          <path d="M 130 295 L 200 295" stroke={HAIR_DARK} strokeWidth="8" fill="none" strokeLinecap="round" />
          <path d="M 290 285 Q 325 270 360 285" stroke={HAIR_DARK} strokeWidth="8" fill="none" strokeLinecap="round" />
        </g>
      );
  }
}

function renderEyes(e: FaceEmotion): React.ReactElement {
  // Eye centres at (168, 350) and (318, 350)
  const wide = e === 'shocked' || e === 'scared';
  const narrow = e === 'smug' || e === 'smirk';
  const sparkle = e === 'excited';

  if (sparkle) {
    return (
      <g>
        {/* Star-shaped eyes for excited */}
        {[168, 318].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy={350} r={28} fill={EYE_WHITE} stroke={HAIR_DARK} strokeWidth="2" />
            <path
              d={`M ${cx} 330 L ${cx + 6} 348 L ${cx + 22} 350 L ${cx + 8} 360 L ${cx + 12} 376 L ${cx} 366 L ${cx - 12} 376 L ${cx - 8} 360 L ${cx - 22} 350 L ${cx - 6} 348 Z`}
              fill={PUPIL}
            />
          </g>
        ))}
      </g>
    );
  }

  const ry = wide ? 32 : narrow ? 8 : 22;
  const rx = narrow ? 30 : 26;
  const pupilR = wide ? 8 : narrow ? 5 : 7;

  return (
    <g>
      {[168, 318].map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy={350} rx={rx} ry={ry} fill={EYE_WHITE} stroke={HAIR_DARK} strokeWidth="2" />
          {/* Pupil — slightly off-centre for shocked (looking up) */}
          <circle cx={cx} cy={wide ? 345 : 352} r={pupilR + 4} fill={PUPIL} />
          <circle cx={cx + 2} cy={(wide ? 345 : 352) - 2} r={2} fill={EYE_WHITE} />
        </g>
      ))}
    </g>
  );
}

function renderMouth(e: FaceEmotion): React.ReactElement {
  switch (e) {
    case 'shocked':
      return (
        <g>
          {/* O-shaped mouth */}
          <ellipse cx="243" cy="500" rx="32" ry="40" fill={MOUTH_RED} />
          <ellipse cx="243" cy="510" rx="20" ry="22" fill="#7A2222" />
        </g>
      );
    case 'confused':
      return (
        <path
          d="M 200 510 Q 243 495 286 515"
          stroke={MOUTH_RED}
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
        />
      );
    case 'smug':
      return (
        <g>
          {/* Smirk — one corner up, one corner straight */}
          <path
            d="M 200 510 Q 243 500 286 485"
            stroke={MOUTH_RED}
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      );
    case 'scared':
      return (
        <g>
          <path
            d="M 200 525 Q 243 545 286 525"
            stroke={MOUTH_RED}
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
          />
          {/* slight teeth */}
          <path d="M 215 525 L 230 525 L 230 535 L 215 535 Z" fill={TEETH} />
        </g>
      );
    case 'excited':
      return (
        <g>
          {/* Big open smile */}
          <path
            d="M 190 490 Q 243 560 296 490 Q 243 540 190 490 Z"
            fill={MOUTH_RED}
            stroke={HAIR_DARK}
            strokeWidth="2"
          />
          {/* Top teeth */}
          <path d="M 200 495 L 286 495 L 280 510 L 206 510 Z" fill={TEETH} />
        </g>
      );
    case 'smirk':
    default:
      return (
        <path
          d="M 205 500 Q 243 520 280 495"
          stroke={MOUTH_RED}
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
        />
      );
  }
}

export default CartoonFace;
