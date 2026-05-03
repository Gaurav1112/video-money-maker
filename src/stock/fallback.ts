/**
 * Fallback clip used when the stock picker cannot find a real clip for a scene.
 *
 * The composer recognises FALLBACK_CLIP.url === 'synthetic://solid-color' and
 * generates a solid-black 1080×1920 frame via ffmpeg lavfi instead of
 * downloading and decoding a real file.
 */

import type { StockClip } from './types.js';

export const FALLBACK_CLIP: StockClip = {
  id: 'fallback-synthetic-solid',
  provider: 'coverr',
  url: 'synthetic://solid-color',
  tags: [],
  durationSec: 60,
  width: 1080,
  height: 1920,
  license: 'CC0',
};
