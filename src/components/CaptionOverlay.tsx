import React from 'react';
import {
  useCurrentFrame,
  AbsoluteFill,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';
import { COLORS, FONTS } from '../lib/theme';

interface CaptionOverlayProps {
  /** The full narration text for the current scene */
  text: string;
  /** Frame offset within the scene where narration starts */
  startFrame?: number;
  /** How many frames the narration lasts */
  durationInFrames?: number;
  /** Words per minute for timing calculation */
  wordsPerMinute?: number;
  /** Real word-level timestamps from TTS (overrides WPM estimate when provided) */
  wordTimestamps?: Array<{ word: string; start: number; end: number }>;
  /** Caption style: 'fireship' (clean monospace) or 'hormozi' (bounce box) */
  captionMode?: 'fireship' | 'hormozi';
}

// ── Detection Helpers ────────────────────────────────────────────────────────

/** Detect emphasis words: ALL CAPS with 2+ alpha chars (NEVER, ALWAYS, CRITICAL) */
const isEmphasis = (word: string): boolean => {
  const clean = word.replace(/[^a-zA-Z]/g, '');
  return clean.length >= 2 && clean === clean.toUpperCase() && /[A-Z]/.test(clean);
};

/** Natural phrase break points — prefer splitting lines after these */
const isBreakPoint = (word: string): boolean => {
  if (/[,.:;!?]$/.test(word)) return true;
  const lower = word.toLowerCase().replace(/[^a-z]/g, '');
  return [
    'and', 'but', 'or', 'so', 'then', 'when', 'while',
    'because', 'which', 'that', 'where', 'since', 'after',
  ].includes(lower);
};

// ── Sentence Grouping ────────────────────────────────────────────────────────

/**
 * Split words into display groups, breaking at natural phrase boundaries.
 * Each group shows max ~2 lines (~8-10 words per line).
 */
const buildSentenceGroups = (
  words: string[],
  maxWords: number = 14,
): Array<{ start: number; end: number }> => {
  const MAX_WORDS = maxWords;
  const MIN_WORDS = Math.min(4, maxWords);
  const groups: Array<{ start: number; end: number }> = [];
  let cursor = 0;

  while (cursor < words.length) {
    const remaining = words.length - cursor;
    if (remaining <= MAX_WORDS) {
      groups.push({ start: cursor, end: words.length });
      break;
    }

    let bestBreak = -1;
    for (
      let i = cursor + MIN_WORDS - 1;
      i < cursor + MAX_WORDS && i < words.length;
      i++
    ) {
      if (isBreakPoint(words[i])) {
        bestBreak = i + 1;
      }
    }

    const end = bestBreak > 0 ? bestBreak : cursor + MAX_WORDS;
    groups.push({ start: cursor, end: Math.min(end, words.length) });
    cursor = end;
  }

  return groups;
};

/**
 * Split a group's words into at most 2 display lines, preferring
 * natural break points near the midpoint.
 */
const splitIntoLines = (groupWords: string[]): string[][] => {
  if (groupWords.length <= 6) return [groupWords];

  const mid = Math.floor(groupWords.length / 2);
  let bestSplit = mid;
  let bestDist = Infinity;

  for (
    let i = Math.max(2, mid - 3);
    i <= Math.min(groupWords.length - 2, mid + 3);
    i++
  ) {
    if (isBreakPoint(groupWords[i])) {
      const dist = Math.abs(i - mid);
      if (dist < bestDist) {
        bestDist = dist;
        bestSplit = i + 1;
      }
    }
  }

  if (bestDist === Infinity) bestSplit = mid;

  return [groupWords.slice(0, bestSplit), groupWords.slice(bestSplit)];
};

// ── Component ────────────────────────────────────────────────────────────────

/**
 * CaptionOverlay - Professional YouTube-style animated subtitles.
 *
 * Design philosophy: READABLE, CLEAN, PROFESSIONAL.
 * Think Netflix subtitles meets MrBeast/Fireship creator style.
 *
 * Features:
 *  1. Word-by-word reveal (only spoken words visible, new words fade in)
 *  2. Active word: saffron, scale(1.15) spring bounce
 *  3. Smart sentence grouping with smooth slide-up transitions
 *  4. Natural phrase-boundary line breaks (max 2 lines)
 *  5. Clean dark background strip (no frosted glass)
 *  6. ALL-CAPS emphasis detection (saffron color)
 */
const CaptionOverlay: React.FC<CaptionOverlayProps> = ({
  text = '',
  startFrame = 0,
  durationInFrames,
  wordsPerMinute = 160,
  wordTimestamps,
  captionMode = 'fireship',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!text || text.trim() === '') return null;

  const words = text.split(/\s+/).filter(Boolean);
  const totalWords = words.length;
  const totalNarrationFrames =
    durationInFrames ||
    Math.round((totalWords / wordsPerMinute) * 60 * fps);
  const framesPerWord = totalNarrationFrames / totalWords;

  // ── Current word index ──
  const elapsed = Math.max(0, frame - startFrame);
  let currentWordIndex: number;

  if (wordTimestamps && wordTimestamps.length > 0) {
    const elapsedSec = elapsed / fps;
    currentWordIndex = wordTimestamps.findIndex((wt) => elapsedSec < wt.end);
    if (currentWordIndex === -1) {
      currentWordIndex = wordTimestamps.length - 1;
    }
  } else {
    currentWordIndex = Math.floor(elapsed / framesPerWord);
  }

  currentWordIndex = Math.min(currentWordIndex, totalWords - 1);

  // ── Active sentence group ──
  const groups = buildSentenceGroups(words, captionMode === 'hormozi' ? 3 : 14);
  let activeGroupIdx = 0;
  for (let i = 0; i < groups.length; i++) {
    if (currentWordIndex < groups[i].end) {
      activeGroupIdx = i;
      break;
    }
    if (i === groups.length - 1) activeGroupIdx = i;
  }

  const activeGroup = groups[activeGroupIdx];
  const activeWords = words.slice(activeGroup.start, activeGroup.end);
  const localWordIndex = currentWordIndex - activeGroup.start;
  const displayLines = splitIntoLines(activeWords);

  // ── Container fade in/out ──
  const containerOpacity = interpolate(
    frame,
    [
      startFrame,
      startFrame + 8,
      startFrame + totalNarrationFrames - 8,
      startFrame + totalNarrationFrames,
    ],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  if (containerOpacity <= 0) return null;

  // ── Slide-up transition on group change ──
  const groupStartWordIdx = activeGroup.start;
  const groupEntryFrame =
    wordTimestamps &&
    wordTimestamps.length > 0 &&
    groupStartWordIdx < wordTimestamps.length
      ? startFrame + wordTimestamps[groupStartWordIdx].start * fps
      : startFrame + groupStartWordIdx * framesPerWord;

  const slideSpring = spring({
    frame: frame - groupEntryFrame,
    fps,
    config: { damping: 22, stiffness: 260, mass: 0.7 },
  });

  const slideY = interpolate(slideSpring, [0, 1], [14, 0]);
  const slideOpacity = interpolate(slideSpring, [0, 1], [0, 1]);

  // ── Helper: get word start frame (relative to scene start) ──
  const getWordStartFrame = (globalIdx: number): number => {
    if (
      wordTimestamps &&
      wordTimestamps.length > 0 &&
      globalIdx < wordTimestamps.length
    ) {
      return wordTimestamps[globalIdx].start * fps;
    }
    return globalIdx * framesPerWord;
  };

  // ── Render ──
  if (captionMode === 'hormozi') {
    // Hormozi mode: bold centered words, slam-in animation, full-width color bar
    const hormoziGroup = activeWords;

    const slamSpring = spring({
      frame: elapsed - getWordStartFrame(currentWordIndex),
      fps,
      config: { damping: 10, stiffness: 280, mass: 0.5 },
    });
    const slamY = interpolate(slamSpring, [0, 1], [-20, 0]);
    const slamScale = interpolate(slamSpring, [0, 1], [0.8, 1.0]);

    return (
      <AbsoluteFill>
        <div
          style={{
            position: 'absolute',
            bottom: 100,
            left: '5%',
            right: '22%',
            display: 'flex',
            justifyContent: 'center',
            opacity: containerOpacity,
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: `linear-gradient(135deg, ${COLORS.saffron}EE, ${COLORS.saffron}CC)`,
              borderRadius: 8,
              padding: '20px 48px',
              display: 'flex',
              gap: 14,
              alignItems: 'center',
              justifyContent: 'center',
              transform: `translateY(${slamY}px) scale(${slamScale})`,
              boxShadow: `0 8px 32px ${COLORS.saffron}44`,
            }}
          >
            {hormoziGroup.map((word, wIdx) => {
              const localIdx = wIdx;
              const isCurrent = localIdx === localWordIndex;
              const isFuture = localIdx > localWordIndex;

              if (isFuture) return null;

              const emphasis = isEmphasis(word);
              const wordSpring = isCurrent
                ? spring({
                    frame: elapsed - getWordStartFrame(activeGroup.start + localIdx),
                    fps,
                    config: { damping: 8, stiffness: 250, mass: 0.4 },
                  })
                : 0;
              const wordScale = isCurrent
                ? interpolate(wordSpring, [0, 1], [1.0, 1.3])
                : 1.0;

              return (
                <span
                  key={`hormozi-${activeGroupIdx}-${localIdx}`}
                  style={{
                    display: 'inline-block',
                    fontFamily: FONTS.text,
                    fontSize: isCurrent ? 44 : 38,
                    fontWeight: 800,
                    color: isCurrent ? '#FFFFFF' : (emphasis ? COLORS.gold : '#FFFFFFdd'),
                    textTransform: 'uppercase',
                    transform: `scale(${wordScale})`,
                    transformOrigin: 'center bottom',
                    textShadow: '0 2px 6px rgba(0,0,0,0.4)',
                    letterSpacing: 1,
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          bottom: 50,
          left: '5%',
          right: '22%',
          display: 'flex',
          justifyContent: 'center',
          opacity: containerOpacity,
          zIndex: 100,
        }}
      >
        {/* Minimal caption strip — small, at bottom, doesn't hide content */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.8)',
            borderRadius: 6,
            padding: '6px 18px',
            maxWidth: '60%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transform: `translateY(${slideY}px)`,
            opacity: slideOpacity,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          }}
        >
          {displayLines.map((lineWords, lineIdx) => {
            // Calculate word offset within the group for this line
            let lineStartLocal = 0;
            for (let l = 0; l < lineIdx; l++) {
              lineStartLocal += displayLines[l].length;
            }

            return (
              <div
                key={`${activeGroupIdx}-line-${lineIdx}`}
                style={{
                  display: 'flex',
                  flexWrap: 'nowrap',
                  alignItems: 'baseline',
                  justifyContent: 'center',
                  gap: 10,
                  lineHeight: 1.5,
                }}
              >
                {lineWords.map((word, wIdx) => {
                  const localIdx = lineStartLocal + wIdx;
                  const globalIdx = activeGroup.start + localIdx;
                  const isPast = localIdx < localWordIndex;
                  const isCurrent = localIdx === localWordIndex;
                  const isFuture = localIdx > localWordIndex;

                  // Future words are hidden (reveal as spoken)
                  if (isFuture) {
                    return (
                      <span
                        key={`${activeGroupIdx}-${localIdx}`}
                        style={{
                          display: 'inline-block',
                          fontFamily: FONTS.text,
                          fontSize: 32,
                          fontWeight: 700,
                          color: 'transparent',
                          lineHeight: 1.5,
                        }}
                      >
                        {word}
                      </span>
                    );
                  }

                  const emphasis = isEmphasis(word);

                  // ── Spring scale for active word ──
                  const scaleSpring = isCurrent
                    ? spring({
                        frame: elapsed - getWordStartFrame(globalIdx),
                        fps,
                        config: { damping: 15, stiffness: 200, mass: 0.8 },
                      })
                    : 0;
                  const wordScale = isCurrent
                    ? interpolate(scaleSpring, [0, 1], [1.0, 1.15])
                    : 1.0;

                  // ── Fade-in for newly revealed words ──
                  const wordAge = elapsed - getWordStartFrame(globalIdx);
                  const fadeIn = isPast
                    ? 1
                    : interpolate(
                        wordAge,
                        [0, 4], // ~4 frames fade-in (~130ms at 30fps)
                        [0, 1],
                        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                      );

                  // ── Determine color (white text on dark bg) ──
                  let color: string;
                  if (isCurrent) {
                    color = COLORS.gold; // highlighted current word
                  } else if (emphasis) {
                    color = COLORS.saffron; // emphasis words
                  } else {
                    color = '#FFFFFF'; // white on dark bg
                  }

                  return (
                    <span
                      key={`${activeGroupIdx}-${localIdx}`}
                      style={{
                        display: 'inline-block',
                        fontFamily: FONTS.text,
                        fontSize: isCurrent ? 26 : 22,
                        fontWeight: isCurrent ? 800 : 600,
                        color,
                        lineHeight: 1.4,
                        letterSpacing: 0.3,
                        transform: `scale(${wordScale})`,
                        transformOrigin: 'center bottom',
                        opacity: fadeIn,
                        textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                      }}
                    >
                      {word}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default CaptionOverlay;
