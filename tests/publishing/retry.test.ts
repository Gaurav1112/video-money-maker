/**
 * tests/publishing/retry.test.ts
 *
 * RED: upload-youtube.ts uses a fire-and-forget pattern with no retry logic.
 *
 * GREEN after: wrap YouTube insert call in withRetry(fn, {maxAttempts:3,
 *              retryOn: (e) => e.status >= 500}).
 */
import { describe, it, expect, vi } from 'vitest';

// withRetry must be exported from a utility module
let withRetry: <T>(fn: () => Promise<T>, opts?: { maxAttempts?: number }) => Promise<T>;
try {
  const mod = await import('../../src/pipeline/upload-youtube');
  withRetry = (mod as any).withRetry;
} catch {
  withRetry = undefined as any;
}

const makeFlaky = (failTimes: number, finalValue: string) => {
  let calls = 0;
  return vi.fn(async () => {
    calls++;
    if (calls <= failTimes) {
      const err: any = new Error('Server Error');
      err.status = 503;
      throw err;
    }
    return finalValue;
  });
};

describe('publishing: retry logic', () => {
  it('withRetry is exported', () => {
    expect(typeof withRetry).toBe('function');
  });

  it('succeeds on second attempt after one 5xx failure', async () => {
    const fn = makeFlaky(1, 'ok');
    const result = await withRetry(fn, { maxAttempts: 3 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after maxAttempts exhausted', async () => {
    const fn = makeFlaky(5, 'ok');
    await expect(withRetry(fn, { maxAttempts: 3 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry on 4xx errors', async () => {
    const fn = vi.fn(async () => {
      const err: any = new Error('Bad Request');
      err.status = 400;
      throw err;
    });
    await expect(withRetry(fn, { maxAttempts: 3 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
