/**
 * Seeded Pseudorandom Number Generator (PRNG) for deterministic renders.
 * Replaces Math.random() which varies per run.
 *
 * Usage:
 *   import { SeededRandom } from './seeded-random';
 *   const rng = new SeededRandom(topic + '::' + sessionN);
 *   const pitch = rng.next() * 2 - 1;  // [-1, 1]
 */

export class SeededRandom {
  private seed: number;

  constructor(seedStr: string) {
    // Hash string to 32-bit integer (deterministic)
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      const char = seedStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32-bit integer
    }
    this.seed = Math.abs(hash);
  }

  /**
   * Returns next random number [0, 1)
   * Deterministic: same seed → same sequence
   */
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0; // linear congruential
    return (this.seed >>> 0) / 0x100000000; // normalize to [0, 1)
  }

  /**
   * Returns random integer [min, max)
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /**
   * Returns random element from array
   */
  pick<T>(arr: T[]): T {
    return arr[this.nextInt(0, arr.length)];
  }
}
