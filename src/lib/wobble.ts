/**
 * wobble.ts — PATCHED for fix-15 (render determinism).
 *
 * Change: the Noise seed is now sourced from getSeed().noiseVal instead of
 * a bare magic number `42`.  The effective value remains 42 (backwards-compat),
 * but the seed now has a single traceable home in src/lib/seed.ts.
 *
 * Original: `const noise = new (Noise as any).Noise(42);`
 * Patched:  `const noise = new (Noise as any).Noise(WOBBLE_NOISE_SEED);`
 *            where WOBBLE_NOISE_SEED is exported so tests can assert on it.
 *
 * No pixel output changes — noiseVal is still 42.
 */

import Noise from 'noisejs';
import { getSeed } from './seed';

// The canonical wobble seed comes from the topic-agnostic default seed.
// getSeed().noiseVal is always 42 until a deliberate re-render campaign.
const _defaultSeed = getSeed('__wobble__', 0);

/** Exported so tests can assert the seed hasn't drifted. */
export const WOBBLE_NOISE_SEED: number = _defaultSeed.noiseVal; // 42

// Single noise instance — module-level singleton for performance.
const noise = new (Noise as any).Noise(WOBBLE_NOISE_SEED);

/**
 * Get deterministic wobble values for a given frame and element index.
 * Same (frame, index) always produces the same (x, y, rotate) triplet.
 *
 * @param frame  Remotion frame number (0-based)
 * @param index  Element index for per-element variation (default 0)
 */
export function getWobble(frame: number, index: number = 0) {
  const speed = 0.02;
  return {
    x: noise.simplex2(frame * speed + index * 100, 0) * 2.5,
    y: noise.simplex2(0, frame * speed + index * 100) * 2.5,
    rotate: noise.simplex2(frame * speed * 0.5, index * 50) * 0.4,
  };
}
