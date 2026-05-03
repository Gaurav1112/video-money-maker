/**
 * seeded-noise.ts
 *
 * Replaces the shared module-scoped `new Noise(42)` singleton in wobble.ts.
 * Every b-roll component takes a `seed` prop so renders are fully deterministic
 * per-component. Same seed + same frame = identical output across runs.
 *
 * Uses a fast, dependency-free mulberry32 PRNG to avoid importing noisejs
 * twice and to avoid the shared-state bug where one component's noise bleeds
 * into another's sequence.
 */

// ---------------------------------------------------------------------------
// Mulberry32 PRNG — fast, good distribution, no external dep
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Value noise (1D) — smooth interpolated noise from PRNG
// ---------------------------------------------------------------------------
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Build a look-up table of random values for fast value-noise queries. */
function buildLut(seed: number, size = 512): Float32Array {
  const rng = mulberry32(seed);
  const lut = new Float32Array(size);
  for (let i = 0; i < size; i++) lut[i] = rng() * 2 - 1; // [-1, 1]
  return lut;
}

// Cache LUTs so repeated calls with same seed don't rebuild
const lutCache = new Map<number, Float32Array>();
function getLut(seed: number): Float32Array {
  if (!lutCache.has(seed)) lutCache.set(seed, buildLut(seed));
  return lutCache.get(seed)!;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SeededNoise {
  /** 1D value noise in [-1, 1] */
  noise1d(x: number): number;
  /** 2D value noise in [-1, 1] — uses two interleaved 1D lookups */
  noise2d(x: number, y: number): number;
  /** Smooth random value in [min, max] at time t */
  smoothAt(t: number, min?: number, max?: number): number;
}

/**
 * Create a seeded noise source. Each component should call this once with its
 * own `seed` prop so its noise is independent of all other components.
 *
 * @example
 * const n = createNoise(seed);
 * const wobbleX = n.smoothAt(frame * 0.02) * 5; // ±5px wobble
 */
export function createNoise(seed: number): SeededNoise {
  const lut = getLut(seed >>> 0);
  const lut2 = getLut((seed * 1664525 + 1013904223) >>> 0); // second stream
  const size = lut.length;

  function noise1d(x: number): number {
    const xi = Math.floor(x) & (size - 1);
    const xf = x - Math.floor(x);
    const a = lut[xi];
    const b = lut[(xi + 1) & (size - 1)];
    return lerp(a, b, smoothstep(xf));
  }

  function noise2d(x: number, y: number): number {
    const xi = Math.floor(x) & (size - 1);
    const yi = Math.floor(y) & (size - 1);
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const aa = lut[(xi + yi * 57) & (size - 1)];
    const ba = lut[(xi + 1 + yi * 57) & (size - 1)];
    const ab = lut2[(xi + (yi + 1) * 57) & (size - 1)];
    const bb = lut2[(xi + 1 + (yi + 1) * 57) & (size - 1)];
    return lerp(lerp(aa, ba, smoothstep(xf)), lerp(ab, bb, smoothstep(xf)), smoothstep(yf));
  }

  function smoothAt(t: number, min = -1, max = 1): number {
    const v = noise1d(t); // [-1, 1]
    return lerp(min, max, (v + 1) / 2);
  }

  return { noise1d, noise2d, smoothAt };
}

/**
 * Deterministic wobble helper — drop-in replacement for getWobble() in wobble.ts
 * but scoped to a specific seed so components don't share state.
 */
export function getSeededWobble(frame: number, seed: number, index = 0) {
  const n = createNoise(seed + index * 1000);
  const speed = 0.02;
  return {
    x: n.noise1d(frame * speed) * 2.5,
    y: n.noise2d(frame * speed, index * 3.7) * 2.5,
    rotate: n.noise1d(frame * speed * 0.5 + index * 50) * 0.4,
  };
}
