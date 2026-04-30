import Noise from 'noisejs';

// Single noise instance with fixed seed for determinism
const noise = new (Noise as any).Noise(42);

/**
 * Get deterministic wobble values for a given frame and element index.
 * Same frame + index always produces same wobble.
 */
export function getWobble(frame: number, index: number = 0) {
  const speed = 0.02;
  return {
    x: noise.simplex2(frame * speed + index * 100, 0) * 2.5,
    y: noise.simplex2(0, frame * speed + index * 100) * 2.5,
    rotate: noise.simplex2(frame * speed * 0.5, index * 50) * 0.4,
  };
}
