import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS, FONTS } from '../../lib/theme';
import { SAFE_ZONE, VERTICAL_SIZES, REGIONS } from '../../lib/vertical-layouts';

interface VerticalCaptionOverlayProps {
  text: string;
  startFrame?: number;
  durationInFrames?: number;
  wordTimestamps?: Array<{ word: string; start: number; end: number }>;
  captionMode?: 'fireship' | 'hormozi';
}

/**
 * Caption overlay optimized for 9:16 vertical video.
 * Positioned in the center vertical zone (REGIONS.captionZone).
 * 3-4 words per line max, centered horizontally.
 * No captions for first 1.5 seconds (visual hook zone).
 * Keyword highlighting with saffron (#E85D26).
 */
export const VerticalCaptionOverlay: React.FC<VerticalCaptionOverlayProps> = ({
  text,
  startFrame = 0,
  durationInFrames = 300,
  wordTimestamps = [],
  captionMode = 'fireship',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const HOOK_ZONE_FRAMES = 12; // was 45 — show captions within 0.4s, not 1.5s
  const effectiveStart = startFrame + HOOK_ZONE_FRAMES;

  if (frame < effectiveStart || frame > startFrame + durationInFrames) return null;

  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return null;

  const relativeTime = (frame - startFrame) / fps;

  let activeWordIndex = 0;
  if (wordTimestamps.length > 0) {
    for (let i = 0; i < wordTimestamps.length; i++) {
      if (relativeTime >= wordTimestamps[i].start && relativeTime <= wordTimestamps[i].end) {
        activeWordIndex = i;
        break;
      }
      if (relativeTime > wordTimestamps[i].end) {
        activeWordIndex = i;
      }
    }
  } else {
    const wordsPerSecond = 2.5;
    activeWordIndex = Math.min(Math.floor(relativeTime * wordsPerSecond), words.length - 1);
  }

  const groupSize = captionMode === 'hormozi' ? 3 : 4;
  const groupIndex = Math.floor(activeWordIndex / groupSize);
  const groupStart = groupIndex * groupSize;
  const groupEnd = Math.min(groupStart + groupSize, words.length);
  const visibleWords = words.slice(groupStart, groupEnd);
  const activeInGroup = activeWordIndex - groupStart;

  const HIGH_ENERGY = new Set([
    // urgency
    'important', 'critical', 'never', 'always', 'key', 'secret', 'wrong', 'mistake', 'problem', 'solution',
    // emotional triggers
    'but', 'actually', 'wait', 'stop', 'look', 'remember', 'exactly', 'literally', 'seriously',
    // tech emphasis
    'crash', 'bug', 'hack', 'dangerous', 'deprecated', 'breaking', 'fastest', 'slowest', 'best', 'worst',
    'free', 'dead', 'powerful', 'simple', 'complex', 'broken', 'secure', 'unsafe',
    // scale words
    'zero', 'million', 'billion', 'hundred', 'thousand', 'every', 'none', 'all',
    // interview power words
    'interview', 'hired', 'rejected', 'cracked', 'production', 'failed',
  ]);

  const containerOpacity = interpolate(
    frame,
    [effectiveStart, effectiveStart + 8, startFrame + durationInFrames - 8, startFrame + durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  if (captionMode === 'hormozi') {
    return (
      <div style={{
        position: 'absolute',
        left: SAFE_ZONE.left,
        right: SAFE_ZONE.right,
        top: REGIONS.captionZone.y,
        height: REGIONS.captionZone.height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: containerOpacity,
        zIndex: 100,
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '8px 16px',
          padding: '0 20px',
        }}>
          {visibleWords.map((word, i) => {
            const isActive = i === activeInGroup;
            const isKeyword = HIGH_ENERGY.has(word.toLowerCase().replace(/[^a-z]/g, ''));
            // Per-word pop — triggered from when THIS word became active (not a fixed timer)
            const wordGlobalIdx = groupStart + i;
            const wordStartFrame = wordTimestamps.length > 0 && wordGlobalIdx < wordTimestamps.length
              ? startFrame + Math.round(wordTimestamps[wordGlobalIdx].start * fps)
              : effectiveStart + Math.round(wordGlobalIdx / 2.5 * fps);
            const wordAge = Math.max(0, frame - wordStartFrame);
            const scale = isActive
              ? spring({ frame: wordAge, fps, config: { stiffness: 400, damping: 15 } }) * 0.12 + 1.0
              : isKeyword ? 1.0 : 0.92;

            return (
              <span
                key={`${groupIndex}-${i}`}
                style={{
                  fontFamily: FONTS.heading,
                  fontSize: VERTICAL_SIZES.caption,
                  fontWeight: 900,
                  textTransform: 'uppercase' as const,
                  // 2-color system: pop yellow for active/keyword, white for rest
                  color: (isActive || isKeyword) ? '#FFDD00' : '#FFFFFF',
                  textShadow: '0 3px 12px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.6)',
                  WebkitTextStroke: '3px #000000',
                  paintOrder: 'stroke fill' as const,
                  transform: `scale(${scale})`,
                  display: 'inline-block',
                  lineHeight: 1.4,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'absolute',
      left: SAFE_ZONE.left,
      right: SAFE_ZONE.right,
      top: REGIONS.captionZone.y,
      height: REGIONS.captionZone.height,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: containerOpacity,
      zIndex: 100,
    }}>
      <div style={{
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 12,
        padding: '16px 28px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '4px 10px',
      }}>
        {visibleWords.map((word, i) => {
          const isActive = i === activeInGroup;
          const isKeyword = HIGH_ENERGY.has(word.toLowerCase().replace(/[^a-z]/g, ''));

          return (
            <span
              key={`${groupIndex}-${i}`}
              style={{
                fontFamily: FONTS.heading, // was FONTS.code — monospace is hard to read on mobile
                fontSize: VERTICAL_SIZES.heading3, // was body (32px) — too small for captions
                fontWeight: isActive ? 700 : 400,
                color: isActive ? '#E85D26' : isKeyword ? '#FDB813' : '#FFFFFF',
                opacity: i <= activeInGroup ? 1 : 0.4,
                lineHeight: 1.5,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
