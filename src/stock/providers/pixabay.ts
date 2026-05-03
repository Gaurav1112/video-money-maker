/**
 * Pixabay Videos search provider.
 *
 * API: https://pixabay.com/api/videos/?key=<key>&q=<q>&per_page=15
 * Requires PIXABAY_API_KEY env var; silently returns [] if missing.
 */

import type { ClipQuery, StockClip, StockSearchProvider } from '../types.js';

interface PixabayVideoSize {
  url: string;
  width: number;
  height: number;
  size: number;
}

interface PixabayVideoSizes {
  large?: PixabayVideoSize;
  medium?: PixabayVideoSize;
  small?: PixabayVideoSize;
  tiny?: PixabayVideoSize;
}

interface PixabayHit {
  id: number;
  pageURL: string;
  user: string;
  duration: number;
  videos: PixabayVideoSizes;
}

interface PixabaySearchResponse {
  hits: PixabayHit[];
}

function bestSize(videos: PixabayVideoSizes): PixabayVideoSize | undefined {
  return videos.large ?? videos.medium ?? undefined;
}

export class PixabayProvider implements StockSearchProvider {
  readonly name = 'pixabay' as const;

  async search(query: ClipQuery): Promise<StockClip[]> {
    const key = process.env['PIXABAY_API_KEY'];
    if (!key) return [];

    const q = query.keywords.slice(0, 3).join('+');
    if (!q) return [];

    const url = `https://pixabay.com/api/videos/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&per_page=15`;

    let data: PixabaySearchResponse;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[pixabay] HTTP ${res.status} for query "${q}"`);
        return [];
      }
      data = (await res.json()) as PixabaySearchResponse;
    } catch (err) {
      console.warn(`[pixabay] fetch error: ${String(err)}`);
      return [];
    }

    const clips: StockClip[] = [];
    for (const hit of data.hits ?? []) {
      const size = bestSize(hit.videos ?? {});
      if (!size) continue;
      clips.push({
        id: `pixabay-${hit.id}`,
        provider: 'pixabay',
        url: size.url,
        tags: query.keywords.map((k) => k.toLowerCase()),
        durationSec: hit.duration,
        width: size.width,
        height: size.height,
        license: 'Pixabay License',
        pageUrl: hit.pageURL,
        credit: hit.user,
      });
    }
    return clips;
  }
}
