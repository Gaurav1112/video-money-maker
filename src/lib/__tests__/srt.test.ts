import { describe, it, expect } from 'vitest';
import { wordTimestampsToSrt } from '../srt';

describe('wordTimestampsToSrt', () => {
  it('returns empty string for no words', () => {
    expect(wordTimestampsToSrt([])).toBe('');
  });

  it('groups words into ~6-word cues', () => {
    const words = Array.from({ length: 12 }, (_, i) => ({
      word: `w${i}`,
      start: i * 0.5,
      end: (i + 1) * 0.5,
    }));
    const srt = wordTimestampsToSrt(words, { wordsPerCue: 6 });
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:03,000\nw0 w1 w2 w3 w4 w5\n');
    expect(srt).toContain('2\n00:00:03,000 --> 00:00:06,000\nw6 w7 w8 w9 w10 w11\n');
  });

  it('handles single word', () => {
    const srt = wordTimestampsToSrt([{ word: 'Hello', start: 0, end: 1.234 }]);
    expect(srt).toBe('1\n00:00:00,000 --> 00:00:01,234\nHello\n\n');
  });
});
