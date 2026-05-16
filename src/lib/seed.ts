/**
 * seed.ts — Single source of truth for all deterministic seeding.
 *
 * Philosophy:
 *   Every number that affects render output must trace back to HERE.
 *   No Math.random(). No Date.now(). No crypto.randomBytes().
 *   Same (topic, sessionNumber) → same seed → same pixels → same MP4.
 *
 * Usage:
 *   import { getSeed, seededInt, seededFloat, seededPick } from '../lib/seed';
 *
 *   const seed = getSeed('load-balancing', 3);
 *   const idx   = seededInt(seed, 'style', 6);      // [0, 6)
 *   const val   = seededFloat(seed, 'opacity');      // [0, 1)
 *   const item  = seededPick(seed, 'bgm', ['a','b','c']);
 *
 * The noiseVal (42 for the default seed) is forwarded to wobble.ts so
 * the Perlin noise instance stays bit-identical with the pre-existing renders.
 */

// ─── FNV-1a 32-bit ────────────────────────────────────────────────────────────
// Chosen for: fast, no external deps, proven avalanche, stable across JS engines.

const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;
const MOD_32 = 0x100000000; // 2^32

/** Returns a non-negative 32-bit integer for any string. */
export function fnv1a32(input: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    // Handle characters > U+00FF by processing both bytes.
    hash = (((hash ^ (code & 0xff)) * FNV_PRIME) % MOD_32 + MOD_32) % MOD_32;
    if (code > 0xff) {
      hash = (((hash ^ ((code >> 8) & 0xff)) * FNV_PRIME) % MOD_32 + MOD_32) % MOD_32;
    }
  }
  return hash >>> 0;
}

// ─── Seed Object ──────────────────────────────────────────────────────────────

export interface RenderSeed {
  /** The canonical key that produced this seed (for debugging). */
  readonly key: string;
  /** The raw 32-bit hash value. */
  readonly value: number;
  /**
   * The Perlin-noise constructor seed (integer 0–65535).
   * Kept as a named field so wobble.ts can use it explicitly.
   * Default: 42 (matches pre-existing Noise(42) — preserving backwards-compat).
   */
  readonly noiseVal: number;
}

/**
 * getSeed — derive a fully deterministic seed from topic + sessionNumber.
 *
 * The seed is stable across:
 *   - machine architectures
 *   - Node.js versions (FNV-1a does not use engine builtins)
 *   - time (no Date.now())
 *   - locale / TZ settings
 *
 * @param topic         The topic slug, e.g. 'load-balancing'
 * @param sessionNumber The 1-based session number, e.g. 3
 * @returns             A RenderSeed object
 *
 * @example
 * getSeed('load-balancing', 3)
 * // → { key: 'load-balancing:3', value: 1234567890, noiseVal: 42 }
 */
export function getSeed(topic: string, sessionNumber: number): RenderSeed {
  const key = `${topic}:${sessionNumber}`;
  const value = fnv1a32(key);
  // noiseVal must stay at 42 for all existing renders to remain bit-identical.
  // Change ONLY after a deliberate full re-render campaign.
  const noiseVal = 42;
  return Object.freeze({ key, value, noiseVal });
}

// ─── Derived helpers ──────────────────────────────────────────────────────────

/**
 * seededInt — deterministic integer in [0, max) from a RenderSeed + namespace.
 *
 * The `namespace` string separates independent draws from the same seed so that
 * style and bgm selections don't collide.
 *
 * @param seed      From getSeed()
 * @param namespace A short stable label, e.g. 'style', 'bgm', 'transition'
 * @param max       Upper bound (exclusive)
 * @returns         Integer in [0, max)
 */
export function seededInt(seed: RenderSeed, namespace: string, max: number): number {
  if (max <= 0) throw new RangeError(`seededInt: max must be > 0, got ${max}`);
  const mixed = fnv1a32(`${seed.key}:${namespace}`);
  return mixed % max;
}

/**
 * seededFloat — deterministic float in [0, 1) from a RenderSeed + namespace.
 */
export function seededFloat(seed: RenderSeed, namespace: string): number {
  const mixed = fnv1a32(`${seed.key}:${namespace}`);
  return mixed / 0x100000000; // divide by 2^32 → [0, 1)
}

/**
 * seededPick — deterministically pick one element from an array.
 *
 * @param seed      From getSeed()
 * @param namespace Stable label for this draw
 * @param items     Non-empty array to pick from
 * @returns         One element, always the same for the same seed+namespace
 */
export function seededPick<T>(seed: RenderSeed, namespace: string, items: readonly T[]): T {
  if (items.length === 0) throw new RangeError('seededPick: items must be non-empty');
  return items[seededInt(seed, namespace, items.length)];
}

/**
 * seededShuffle — deterministically shuffle a copy of an array (Fisher-Yates).
 *
 * Does NOT mutate the original array.
 *
 * @param seed      From getSeed()
 * @param namespace Stable label for this shuffle
 * @param items     Array to shuffle
 * @returns         A new array in deterministic order
 */
export function seededShuffle<T>(seed: RenderSeed, namespace: string, items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const key = `${seed.key}:${namespace}:swap:${i}`;
    const j = fnv1a32(key) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
