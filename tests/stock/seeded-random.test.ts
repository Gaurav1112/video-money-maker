import { describe, it, expect } from 'vitest';
import { SeededRandom } from '../../src/stock/seeded-random';

describe('SeededRandom', () => {
  it('produces deterministic sequence from same seed', () => {
    const rng1 = new SeededRandom('kafka::session1');
    const rng2 = new SeededRandom('kafka::session1');

    for (let i = 0; i < 100; i++) {
      expect(rng1.next()).toBe(rng2.next());
    }
  });

  it('produces different sequence from different seed', () => {
    const rng1 = new SeededRandom('kafka::session1');
    const rng2 = new SeededRandom('kafka::session2');

    const seq1 = [rng1.next(), rng1.next(), rng1.next()];
    const seq2 = [rng2.next(), rng2.next(), rng2.next()];

    expect(seq1).not.toEqual(seq2);
  });

  it('returns values in [0, 1)', () => {
    const rng = new SeededRandom('test');
    for (let i = 0; i < 1000; i++) {
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('nextInt returns value in [min, max)', () => {
    const rng = new SeededRandom('test');
    for (let i = 0; i < 100; i++) {
      const val = rng.nextInt(10, 20);
      expect(val).toBeGreaterThanOrEqual(10);
      expect(val).toBeLessThan(20);
    }
  });

  it('pick returns element from array', () => {
    const rng = new SeededRandom('test');
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(rng.pick(arr));
    }
  });
});
