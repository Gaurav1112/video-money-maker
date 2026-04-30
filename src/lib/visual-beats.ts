import type { VisualBeat, WordTimestamp } from '../types';
import { isTechTerm } from './tech-terms';

/**
 * Compute visual beats from narration text + word timestamps.
 * Each sentence = one beat = one visual element revealed on screen.
 */
export function computeVisualBeats(
  narration: string,
  wordTimestamps: WordTimestamp[],
): VisualBeat[] {
  if (!narration || !wordTimestamps.length) return [];

  const words = narration.split(/\s+/).filter(Boolean);
  const beats: VisualBeat[] = [];

  // Find sentence boundary word indices (., ?, !)
  const sentenceEnds: number[] = [];
  words.forEach((word, i) => {
    if (/[.!?]$/.test(word)) {
      sentenceEnds.push(i);
    }
  });
  // Ensure last word is a boundary
  if (sentenceEnds.length === 0 || sentenceEnds[sentenceEnds.length - 1] !== words.length - 1) {
    sentenceEnds.push(words.length - 1);
  }

  let startIdx = 0;
  sentenceEnds.forEach((endIdx, beatIdx) => {
    const sentenceWords = words.slice(startIdx, endIdx + 1);
    const text = sentenceWords.join(' ');

    // Get timing from word timestamps
    const startTs = wordTimestamps[startIdx];
    const endTs = wordTimestamps[Math.min(endIdx, wordTimestamps.length - 1)];
    const startTime = startTs ? startTs.start : 0;
    const endTime = endTs ? endTs.end : startTime + 2;

    // Extract keywords (tech terms, ALL CAPS, numbers)
    const keywords = sentenceWords.filter(w => {
      const clean = w.replace(/[^a-zA-Z0-9]/g, '');
      return isTechTerm(w) ||
        (clean.length >= 2 && clean === clean.toUpperCase() && /[A-Z]/.test(clean)) ||
        /\d{2,}/.test(w);
    });

    beats.push({
      startTime,
      endTime,
      text,
      beatIndex: beatIdx,
      totalBeats: sentenceEnds.length,
      keywords,
    });

    startIdx = endIdx + 1;
  });

  // Update totalBeats now that we know the count
  beats.forEach(b => { b.totalBeats = beats.length; });

  return beats;
}
