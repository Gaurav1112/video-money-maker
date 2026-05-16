/**
 * Pexels Videos search provider.
 *
 * API: https://api.pexels.com/videos/search?query=<q>&per_page=15&orientation=portrait
 * Auth: Authorization header.
 * Requires PEXELS_API_KEY env var; silently returns [] if missing.
 */

import type { ClipQuery, StockClip, StockSearchProvider } from '../types.js';

interface PexelsVideoFile {
  quality: string;
  width: number;
  height: number;
  link: string;
}

interface PexelsVideoUser {
  name: string;
}

interface PexelsVideo {
  id: number;
  url: string;
  duration: number;
  user: PexelsVideoUser;
  video_files: PexelsVideoFile[];
}

interface PexelsSearchResponse {
  videos: PexelsVideo[];
}

function bestFile(files: PexelsVideoFile[]): PexelsVideoFile | undefined {
  const hd = files.filter((f) => f.quality === 'hd');
  const pool = hd.length > 0 ? hd : files;
  return pool.slice().sort((a, b) => b.width - a.width)[0];
}

export class PexelsProvider implements StockSearchProvider {
  readonly name = 'pexels' as const;

  async search(query: ClipQuery): Promise<StockClip[]> {
    const key = process.env['PEXELS_API_KEY'];
    if (!key) return [];

    const q = query.keywords.slice(0, 3).join(' ');
    if (!q) return [];

    const orientation = query.portrait ? 'portrait' : 'landscape';
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=15&orientation=${orientation}`;

    let data: PexelsSearchResponse;
    try {
      const res = await fetch(url, { headers: { Authorization: key } });
      if (!res.ok) {
        console.warn(`[pexels] HTTP ${res.status} for query "${q}"`);
        return [];
      }
      data = (await res.json()) as PexelsSearchResponse;
    } catch (err) {
      console.warn(`[pexels] fetch error: ${String(err)}`);
      return [];
    }

    const clips: StockClip[] = [];
    for (const video of data.videos ?? []) {
      const file = bestFile(video.video_files ?? []);
      if (!file) continue;
      clips.push({
        id: `pexels-${video.id}`,
        provider: 'pexels',
        url: file.link,
        tags: query.keywords.map((k) => k.toLowerCase()),
        durationSec: video.duration,
        width: file.width,
        height: file.height,
        license: 'Pexels License',
        pageUrl: video.url,
        credit: video.user.name,
      });
    }
    return clips;
  }
}
