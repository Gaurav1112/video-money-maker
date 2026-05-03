/**
 * hash-select.ts — Deterministic index selection via FNV-1a hash
 *
 * No Math.random(). No Date.now(). No network. No side-effects.
 * Given the same topic slug, always returns the same style index.
 * That index is stable across machines, across CI runs, across re-renders.
 *
 * Algorithm: FNV-1a 32-bit
 *   offset_basis = 2166136261
 *   FNV_prime    = 16777619
 *   for each byte b: hash = (hash ^ b) * FNV_prime  (mod 2^32)
 */

const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;
const MOD_32 = 0x100000000; // 2^32

/**
 * fnv1a32 — returns a non-negative 32-bit integer for any string input.
 * Empty string → 2166136261 (the offset basis itself, still valid).
 */
export function fnv1a32(input: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i++) {
    // charCodeAt returns 0–65535; we XOR byte by byte (low byte first)
    const code = input.charCodeAt(i);
    hash = (((hash ^ (code & 0xff)) * FNV_PRIME) % MOD_32 + MOD_32) % MOD_32;
    if (code > 0xff) {
      hash = (((hash ^ ((code >> 8) & 0xff)) * FNV_PRIME) % MOD_32 + MOD_32) % MOD_32;
    }
  }
  return hash >>> 0; // coerce to unsigned 32-bit
}

/**
 * hashSelect — pick a stable index in [0, count) for a given key string.
 *
 * @param key    Topic slug or any stable string identifier
 * @param count  Number of options to choose from (e.g. 6 styles)
 * @returns      Integer in [0, count), same value every time for the same key
 *
 * @example
 * hashSelect('load-balancing', 6)  // always → e.g. 3
 * hashSelect('load-balancing', 6)  // → 3  (deterministic)
 * hashSelect('caching',        6)  // → different stable value
 */
export function hashSelect(key: string, count: number): number {
  if (count <= 0) throw new RangeError('hashSelect: count must be > 0');
  return fnv1a32(key) % count;
}

/**
 * topicSlug — normalise a topic string to a stable slug before hashing.
 * Trims whitespace, lowercases, collapses runs of non-alphanumeric chars to '-'.
 *
 * @example
 * topicSlug('Load Balancing')  // → 'load-balancing'
 * topicSlug('  CAP Theorem ')  // → 'cap-theorem'
 */
export function topicSlug(topic: string): string {
  return topic
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
