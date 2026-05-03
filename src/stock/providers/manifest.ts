import { readFile } from 'node:fs/promises';
import type {
  ClipQuery,
  StockClip,
  StockProvider,
  StockSearchProvider,
} from '../types.js';

/**
 * Provider that searches a static JSON manifest of pre-curated clips.
 * Used for Coverr and Mixkit where there is no public search API.
 *
 * The manifest is just `{ clips: StockClip[] }`.
 *
 * Search ranks clips by:
 *   1. count of matched keywords (higher = better)
 *   2. earlier-keyword matches outrank later-keyword matches
 *   3. clips meeting `minDurationSec` outrank shorter clips
 *   4. clips matching `portrait` orientation outrank mismatched ones
 *
 * Deterministic: same query → same order, every time.
 */
export class ManifestProvider implements StockSearchProvider {
  readonly name: StockProvider;
  private clips: StockClip[];

  constructor(name: StockProvider, clips: StockClip[]) {
    this.name = name;
    this.clips = clips.filter((c) => c.provider === name);
  }

  static async fromFile(name: StockProvider, manifestPath: string): Promise<ManifestProvider> {
    const raw = await readFile(manifestPath, 'utf8');
    const parsed = JSON.parse(raw) as { clips: StockClip[] };
    if (!Array.isArray(parsed.clips)) {
      throw new Error(`Manifest at ${manifestPath} missing 'clips' array`);
    }
    return new ManifestProvider(name, parsed.clips);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async search(query: ClipQuery): Promise<StockClip[]> {
    const exclude = new Set(query.excludeIds ?? []);
    const lcKeywords = query.keywords.map((k) => k.toLowerCase());

    const scored: { clip: StockClip; score: number; firstHit: number }[] = [];

    for (const clip of this.clips) {
      if (exclude.has(clip.id)) continue;

      const tagSet = new Set(clip.tags.map((t) => t.toLowerCase()));
      let score = 0;
      let firstHit = Number.POSITIVE_INFINITY;
      for (let i = 0; i < lcKeywords.length; i++) {
        if (tagSet.has(lcKeywords[i])) {
          // earlier keyword = higher weight
          score += lcKeywords.length - i;
          firstHit = Math.min(firstHit, i);
        }
      }
      if (score === 0) continue;

      if (clip.durationSec >= query.minDurationSec) score += 5;
      const isPortrait = clip.height > clip.width;
      if (isPortrait === query.portrait) score += 3;

      scored.push({ clip, score, firstHit });
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.firstHit !== b.firstHit) return a.firstHit - b.firstHit;
      return a.clip.id.localeCompare(b.clip.id); // deterministic tie-break
    });

    return scored.map((s) => s.clip);
  }
}
