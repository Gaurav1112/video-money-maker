import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate, spring } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';

interface CaptionOverlayProps {
  /** The full narration text for the current scene */
  text: string;
  /** Frame offset within the scene where narration starts */
  startFrame?: number;
  /** How many frames the narration lasts */
  durationInFrames?: number;
  /** Words per minute for timing calculation */
  wordsPerMinute?: number;
}

/**
 * CaptionOverlay - Shows animated subtitles at the bottom of the screen.
 * Words highlight one by one as they are "spoken", creating a karaoke effect.
 * Critical for: accessibility, muted viewing, engagement, tutorial feel.
 */
const CaptionOverlay: React.FC<CaptionOverlayProps> = ({
  text,
  startFrame = 0,
  durationInFrames,
  wordsPerMinute = 160,
}) => {
  const frame = useCurrentFrame();

  if (!text || text.trim() === '') return null;

  // Split text into sentences (groups of ~8-12 words for readability)
  const words = text.split(/\s+/).filter(Boolean);
  const WORDS_PER_LINE = 10;
  const sentences: string[][] = [];
  for (let i = 0; i < words.length; i += WORDS_PER_LINE) {
    sentences.push(words.slice(i, i + WORDS_PER_LINE));
  }

  // Calculate timing
  const totalWords = words.length;
  const totalNarrationFrames = durationInFrames || Math.round((totalWords / wordsPerMinute) * 60 * 30);
  const framesPerWord = totalNarrationFrames / totalWords;

  // Which word index are we on globally?
  const elapsed = Math.max(0, frame - startFrame);
  const currentWordIndex = Math.floor(elapsed / framesPerWord);

  // Which sentence chunk is active?
  let wordOffset = 0;
  let activeSentenceIdx = 0;
  for (let i = 0; i < sentences.length; i++) {
    if (currentWordIndex < wordOffset + sentences[i].length) {
      activeSentenceIdx = i;
      break;
    }
    wordOffset += sentences[i].length;
    if (i === sentences.length - 1) {
      activeSentenceIdx = i;
      wordOffset = words.length - sentences[i].length;
    }
  }

  const activeSentence = sentences[activeSentenceIdx] || [];
  const localWordIndex = currentWordIndex - wordOffset;

  // Container fade in/out
  const containerOpacity = interpolate(
    frame,
    [startFrame, startFrame + 15, startFrame + totalNarrationFrames - 15, startFrame + totalNarrationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  if (containerOpacity <= 0) return null;

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: containerOpacity,
          zIndex: 100,
        }}
      >
        {/* Dark strip background - more prominent */}
        <div
          style={{
            backgroundColor: `${COLORS.dark}F0`,
            backdropFilter: 'blur(16px)',
            borderRadius: 14,
            padding: '18px 40px',
            maxWidth: 1300,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '0 10px',
            border: `1px solid ${COLORS.saffron}18`,
            boxShadow: `0 6px 40px ${COLORS.dark}AA, 0 0 0 1px ${COLORS.gray}08`,
          }}
        >
          {activeSentence.map((word, idx) => {
            const isPast = idx < localWordIndex;
            const isCurrent = idx === localWordIndex;
            const isFuture = idx > localWordIndex;

            // Highlight spring for current word
            const wordProgress = isCurrent
              ? interpolate(
                  elapsed - (wordOffset + idx) * framesPerWord,
                  [0, framesPerWord * 0.3],
                  [0, 1],
                  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                )
              : isPast
              ? 1
              : 0;

            const color = isCurrent
              ? COLORS.saffron
              : isPast
              ? COLORS.white
              : `${COLORS.white}55`;

            const fontWeight = isCurrent ? 700 : isPast ? 500 : 400;

            // Subtle scale bump on current word
            const wordScale = isCurrent
              ? interpolate(wordProgress, [0, 0.5, 1], [1, 1.08, 1.04])
              : 1;

            return (
              <span
                key={idx}
                style={{
                  color,
                  fontWeight,
                  fontSize: SIZES.body + 2,
                  fontFamily: FONTS.text,
                  lineHeight: 1.6,
                  transform: `scale(${wordScale})`,
                  display: 'inline-block',
                  transition: 'color 0.1s ease',
                  textShadow: isCurrent ? `0 0 24px ${COLORS.saffron}55` : 'none',
                  letterSpacing: 0.3,
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
};

export default CaptionOverlay;
