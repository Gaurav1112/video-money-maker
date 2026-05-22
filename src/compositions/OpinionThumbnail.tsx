// src/compositions/OpinionThumbnail.tsx
//
// Feature 007 — Dedicated 1280x720 still for YouTube long-form opinion-piece
// thumbnail. Movie-poster style: deep gradient, brand bar at top, OPINION
// eyebrow label, big title (max 3 lines), brand watermark.
//
// Constitution I: pure deterministic render. No randomness, no LLM. Same
// `{ title, slug }` props always produce the same pixels.

import React from 'react';
import { AbsoluteFill, staticFile, Img } from 'remotion';
import { FONTS } from '../lib/theme';

export interface OpinionThumbnailProps {
  title: string;
  slug: string;
}

/** Pick an auto-fit font size from the title length. Bigger when terser. */
function pickTitleFontSize(title: string): number {
  const len = title.length;
  if (len <= 30) return 110;
  if (len <= 45) return 92;
  if (len <= 65) return 78;
  return 66;
}

/** Break a long title into at most 3 lines on word boundaries. */
function wrapTitle(title: string, maxCharsPerLine: number): string[] {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
    if (lines.length === 2 && current.length > maxCharsPerLine) {
      // force-flush to keep at most 3 lines
      lines.push(current);
      current = '';
      break;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

export const OpinionThumbnail: React.FC<OpinionThumbnailProps> = ({ title, slug }) => {
  const fontSize = pickTitleFontSize(title);
  const maxChars = fontSize >= 100 ? 22 : fontSize >= 90 ? 26 : fontSize >= 75 ? 30 : 36;
  const lines = wrapTitle(title, maxChars);
  const avatarSrc = staticFile('images/guru-avatar-crop.png');

  // Episode number, e.g. "001-foo-bar" → "001"
  const episodeMatch = slug.match(/^(\d+)/);
  const episodeLabel = episodeMatch ? `EP ${episodeMatch[1]}` : '';

  return (
    <AbsoluteFill
      style={{
        // Deep editorial gradient — newspaper-meets-cinema palette
        background: 'radial-gradient(ellipse at 30% 30%, #1F2937 0%, #0B1220 60%, #050810 100%)',
        width: 1280,
        height: 720,
      }}
    >
      {/* Top brand bar — gradient like QuizThumbnail but blue/teal for opinions */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 56,
          background: 'linear-gradient(90deg, #2563EB, #06B6D4, #2563EB)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontFamily: FONTS.heading,
            fontWeight: 900,
            color: '#0B1220',
            letterSpacing: 4,
            textTransform: 'uppercase',
          }}
        >
          GURU SISHYA · WEEKLY OPINION · guru-sishya.in
        </span>
      </div>

      {/* OPINION eyebrow label */}
      <div
        style={{
          position: 'absolute',
          top: 100,
          left: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            background: '#FBBF24',
            color: '#0B1220',
            padding: '6px 18px',
            fontSize: 24,
            fontFamily: FONTS.heading,
            fontWeight: 900,
            letterSpacing: 4,
            textTransform: 'uppercase',
          }}
        >
          Opinion
        </div>
        {episodeLabel && (
          <div
            style={{
              color: '#94A3B8',
              fontSize: 22,
              fontFamily: FONTS.heading,
              fontWeight: 700,
              letterSpacing: 3,
            }}
          >
            {episodeLabel}
          </div>
        )}
      </div>

      {/* Title — centered vertically, left-aligned text */}
      <div
        style={{
          position: 'absolute',
          top: 170,
          left: 60,
          right: 280, // leave room for avatar on the right
          bottom: 100,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              fontSize,
              fontFamily: FONTS.heading,
              fontWeight: 900,
              color: i === 1 ? '#FBBF24' : '#FFFFFF',
              lineHeight: 1.05,
              letterSpacing: -2,
              textShadow: '0 4px 24px rgba(0,0,0,0.85), 0 0 60px rgba(37,99,235,0.25)',
            }}
          >
            {line}
          </div>
        ))}
      </div>

      {/* Avatar on the right — circular crop, subtle ring */}
      <div
        style={{
          position: 'absolute',
          right: 50,
          bottom: 80,
          width: 220,
          height: 220,
          borderRadius: '50%',
          overflow: 'hidden',
          border: '4px solid #FBBF24',
          boxShadow: '0 0 40px rgba(37,99,235,0.5)',
        }}
      >
        <Img src={avatarSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>

      {/* Bottom brand strip */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 50,
          background: 'rgba(11,18,32,0.85)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 60,
        }}
      >
        <span
          style={{
            fontSize: 20,
            fontFamily: FONTS.text,
            fontWeight: 700,
            color: '#94A3B8',
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          A leadership perspective · 8 min read · {slug}
        </span>
      </div>
    </AbsoluteFill>
  );
};

/** Single-frame composition metadata, exported for Composition registration. */
export const calculateOpinionThumbnailMetadata = () => ({
  durationInFrames: 1,
  fps: 30,
  width: 1280,
  height: 720,
});
