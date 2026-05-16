import { describe, it, expect } from 'vitest';
import { runQualityGate } from '../../src/stock/quality-gate.js';

describe('runQualityGate', () => {
  it('returns a result object with required fields', async () => {
    const result = await runQualityGate('/nonexistent/file.mp4');
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('meanVariance');
    expect(typeof result.passed).toBe('boolean');
    expect(typeof result.meanVariance).toBe('number');
  }, 15_000);

  it('fails gracefully for non-existent file', async () => {
    const result = await runQualityGate('/nonexistent/bad.mp4');
    expect(result.passed).toBe(false);
  }, 15_000);
});
