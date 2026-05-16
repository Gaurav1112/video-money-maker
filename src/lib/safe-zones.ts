/**
 * safe-zones.ts — Platform-specific safe-zone constants for 9:16 vertical video (1080×1920).
 *
 * Chrome measurements based on 2025 Q1 device-lab testing:
 *  - YouTube Shorts:  220px top (search + camera icons),  420px bottom (player chrome + description)
 *  - Instagram Reels: 240px top (story rings + DM icon),  380px bottom (likes, comments, share, audio)
 *  - TikTok:          200px top (status bar + profile),   480px bottom (nav bar + captions + CTA)
 *
 * Safe-zone rule: keep ALL critical text inside the rect
 *   { top: ZONE.top ... bottom: 1920 − ZONE.bottom }
 *
 * For cross-platform publishing, use SAFE_ZONES.universal (worst-case union of all three).
 *
 * Usage:
 *   import { getSafeZone, CAPTION_SAFE_BOTTOM } from './safe-zones';
 *   style={{ bottom: CAPTION_SAFE_BOTTOM }}
 */

export const FRAME_WIDTH  = 1080;
export const FRAME_HEIGHT = 1920;

export type Platform  = 'youtube_shorts' | 'instagram_reels' | 'tiktok' | 'universal';
export type Dimension = 'top' | 'bottom' | 'left' | 'right';

/** Pixel counts reserved by platform UI chrome on a 1080×1920 frame. */
export const SAFE_ZONES: Record<Platform, Record<Dimension, number>> = {
  youtube_shorts: { top: 220, bottom: 420, left: 60, right: 140 },
  instagram_reels: { top: 240, bottom: 380, left: 60, right: 130 },
  tiktok:          { top: 200, bottom: 480, left: 50, right: 120 },
  /** Worst-case union — safe on ALL three platforms simultaneously. */
  universal:       { top: 240, bottom: 480, left: 60, right: 140 },
} as const;

/**
 * Returns the number of pixels reserved by platform UI chrome on the specified edge.
 * Caption containers must never have their visible content enter this zone.
 *
 * @example
 *   getSafeZone('youtube_shorts', 'bottom') // → 420
 *   getSafeZone('tiktok', 'bottom')         // → 480
 *   getSafeZone('universal', 'top')         // → 240
 */
export function getSafeZone(platform: Platform, dimension: Dimension): number {
  return SAFE_ZONES[platform][dimension];
}

/**
 * Validate that a bounding box does NOT enter any reserved area.
 * Coordinates are measured from the TOP-LEFT of the 1920px-tall frame.
 *
 * Returns true if the element is fully inside the platform safe zone.
 *
 * @param bbox     - { top, bottom, left?, right? } in absolute frame pixels (top-left origin)
 * @param platform - platform to check against (default: 'universal')
 *
 * @example
 *   isInSafeZone({ top: 240, bottom: 1440 }, 'universal') // → true
 *   isInSafeZone({ top: 100, bottom: 1500 }, 'tiktok')    // → false (top:100 < reserved 200)
 */
export function isInSafeZone(
  bbox: { top: number; bottom: number; left?: number; right?: number },
  platform: Platform = 'universal',
): boolean {
  const zone = SAFE_ZONES[platform];
  if (bbox.top    <  zone.top)                  return false;
  if (bbox.bottom >  FRAME_HEIGHT - zone.bottom) return false;
  if (bbox.left  !== undefined && bbox.left  < zone.left)                  return false;
  if (bbox.right !== undefined && bbox.right > FRAME_WIDTH - zone.right)   return false;
  return true;
}

// ── Derived constants (use these at call sites) ──────────────────────────────

/**
 * Bottom offset (px from frame bottom) every caption component MUST use.
 * Based on YouTube Shorts (420px) — primary publication target.
 *
 * ⚠️  If TikTok is added as a publish target, change to:
 *      export const CAPTION_SAFE_BOTTOM = getSafeZone('tiktok', 'bottom'); // 480
 */
export const CAPTION_SAFE_BOTTOM: number = getSafeZone('youtube_shorts', 'bottom'); // 420

/**
 * Top offset (px from frame top) safe for captions.
 * Use as the minimum `top` value so status bar icons are not covered.
 */
export const CAPTION_SAFE_TOP: number = getSafeZone('universal', 'top'); // 240

/** Content area height available for captions (between top and bottom chrome). */
export const CAPTION_SAFE_HEIGHT: number =
  FRAME_HEIGHT - CAPTION_SAFE_TOP - CAPTION_SAFE_BOTTOM; // 1920 − 240 − 420 = 1260

/** Center y-coordinate of the safe caption zone. */
export const CAPTION_SAFE_CENTER_Y: number =
  CAPTION_SAFE_TOP + Math.round(CAPTION_SAFE_HEIGHT / 2); // 240 + 630 = 870
