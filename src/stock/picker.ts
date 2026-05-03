/**
 * Clip picker for the stock footage pipeline.
 *
 * For each scene in the storyboard, queries all providers in parallel,
 * merges and re-scores results, deduplicates across scenes, and returns
 * exactly one PickedClip per scene (falling back to FALLBACK_CLIP).
 *
 * Deterministic: same storyboard + same providers → same output, every run.
 */

import { extractKeywords } from './keyword-extractor.js';
import { FALLBACK_CLIP } from './fallback.js';
import type {
  PickedClip,
  StockClip,
  StockSearchProvider,
  StockStoryboard,
  StockScene,
} from './types.js';

export interface PickOptions {
  /** Minimum clip duration multiplier (default: 1 — scene duration). */
  minDurationMultiplier?: number;
}

/**
 * Picks one clip per scene. Never repeats a clip across scenes — dedup by
 * BOTH id and URL so manifest entries with distinct ids but identical CDN
 * URLs (14 such pairs in the current Mixkit manifest) cannot produce
 * back-to-back identical visuals.
 */
export async function pickClipsForStoryboard(
  storyboard: StockStoryboard,
  providers: StockSearchProvider[],
  opts: PickOptions = {}
): Promise<PickedClip[]> {
  const usedIds = new Set<string>();
  const usedUrls = new Set<string>();
  const results: PickedClip[] = [];
  const multiplier = opts.minDurationMultiplier ?? 1;

  for (const scene of storyboard.scenes) {
    const keywords = extractKeywords(scene, storyboard.topic);
    const durationSec = scene.durationFrames / storyboard.fps;
    const picked = await pickForScene(
      scene,
      keywords,
      durationSec * multiplier,
      providers,
      usedIds,
      usedUrls
    );
    if (picked.clip.id !== FALLBACK_CLIP.id) {
      usedIds.add(picked.clip.id);
      usedUrls.add(picked.clip.url);
    }
    results.push(picked);
  }

  return results;
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function pickForScene(
  scene: StockScene,
  keywords: string[],
  minDurationSec: number,
  providers: StockSearchProvider[],
  usedIds: Set<string>,
  usedUrls: Set<string>
): Promise<PickedClip> {
  if (keywords.length === 0) {
    console.warn(`[picker] scene ${scene.sceneIndex}: no keywords — using fallback`);
    return { clip: FALLBACK_CLIP, score: 0, matchedTags: [] };
  }

  const allResults = await Promise.all(
    providers.map((p) =>
      p.search({
        keywords,
        minDurationSec,
        portrait: true,
        excludeIds: [...usedIds],
      }).catch((err: unknown) => {
        console.warn(`[picker] provider ${p.name} error: ${String(err)}`);
        return [] as StockClip[];
      })
    )
  );

  // Merge from all providers; annotate with provider list-rank for scoring
  interface Candidate {
    clip: StockClip;
    score: number;
    matchedTags: string[];
  }

  const candidates: Candidate[] = [];
  for (let pi = 0; pi < allResults.length; pi++) {
    const providerClips = allResults[pi];
    for (let rank = 0; rank < providerClips.length; rank++) {
      const clip = providerClips[rank];
      if (usedIds.has(clip.id)) continue;
      if (usedUrls.has(clip.url)) continue;

      const lcKeywords = keywords.map((k) => k.toLowerCase());
      const tagSet = new Set(clip.tags.map((t) => t.toLowerCase()));
      const matchedTags: string[] = [];
      let score = 0;

      for (let ki = 0; ki < lcKeywords.length; ki++) {
        if (tagSet.has(lcKeywords[ki])) {
          score += lcKeywords.length - ki;
          matchedTags.push(lcKeywords[ki]);
        }
      }

      // Penalise by provider rank (position in merged list)
      score -= rank * 0.1;

      if (clip.height > clip.width) score += 3; // portrait bonus
      if (clip.durationSec >= minDurationSec) score += 5;

      candidates.push({ clip, score, matchedTags });
    }
  }

  if (candidates.length === 0) {
    console.warn(`[picker] scene ${scene.sceneIndex}: no clips for [${keywords.join(', ')}] — using fallback`);
    return { clip: FALLBACK_CLIP, score: 0, matchedTags: [] };
  }

  // Stable sort: score desc, then clip id asc (deterministic tie-break)
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.clip.id.localeCompare(b.clip.id);
  });

  const best = candidates[0];
  return best;
}
