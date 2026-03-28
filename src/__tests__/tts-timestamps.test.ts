import { makeTimestampsProportional } from '../pipeline/tts-engine';

describe('makeTimestampsProportional', () => {
  it('distributes timestamps by character count, not evenly', () => {
    const text = 'A longword short';
    const duration = 3.0;
    const result = makeTimestampsProportional(text, duration);

    expect(result).toHaveLength(3);
    expect(result[0].word).toBe('A');
    expect(result[1].word).toBe('longword');
    expect(result[2].word).toBe('short');

    expect(result[0].end - result[0].start).toBeLessThan(0.5);
    expect(result[1].end - result[1].start).toBeGreaterThan(1.0);

    expect(result[0].start).toBe(0);
    expect(result[1].start).toBeCloseTo(result[0].end, 2);
    expect(result[2].end).toBeCloseTo(duration, 2);
  });

  it('handles single word', () => {
    const result = makeTimestampsProportional('hello', 1.0);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ word: 'hello', start: 0, end: 1.0 });
  });

  it('handles empty text', () => {
    const result = makeTimestampsProportional('', 1.0);
    expect(result).toHaveLength(0);
  });
});
