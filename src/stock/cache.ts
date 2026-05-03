/**
 * Content-addressed download cache for stock footage clips.
 *
 * Cache root: assets/stock-cache/  (overridable via constructor)
 * Filename  : <sha256(url).slice(0,16)>.mp4
 *
 * Atomic write: download to <hash>.mp4.tmp then rename.
 *
 * STOCK_CACHE_OFFLINE=1 throws on a cache miss (used in CI to enforce
 * that the pre-warm step ran before the render step).
 */

import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { rename, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { StockClip } from './types.js';

export class StockCache {
  private readonly root: string;

  constructor(root = 'assets/stock-cache') {
    this.root = root;
    mkdirSync(this.root, { recursive: true });
  }

  /** Returns the local path for a clip, downloading it if necessary. */
  async download(clip: StockClip, ephemeralDir?: string): Promise<string> {
    // Fallback synthetic clips are never downloaded
    if (clip.url.startsWith('synthetic://')) {
      return clip.url;
    }

    // Pexels TOS: clips must not be cached persistently
    if (clip.provider === 'pexels') {
      const dir = ephemeralDir ?? tmpdir();
      mkdirSync(dir, { recursive: true });
      const hash = createHash('sha256').update(clip.url).digest('hex').slice(0, 16);
      const dest = join(dir, `pexels-${hash}.mp4`);
      await this.fetchToFile(clip.url, dest);
      return dest;
    }

    const hash = createHash('sha256').update(clip.url).digest('hex').slice(0, 16);
    const dest = join(this.root, `${hash}.mp4`);

    if (existsSync(dest)) {
      try {
        const st = await stat(dest);
        if (st.size > 0) return dest;
      } catch {
        // fall through to re-download
      }
    }

    if (process.env['STOCK_CACHE_OFFLINE'] === '1') {
      throw new Error(`[cache] offline mode: cache miss for ${clip.url}`);
    }

    const tmp = `${dest}.tmp`;
    await this.fetchToFile(clip.url, tmp);
    await rename(tmp, dest);
    return dest;
  }

  private async fetchToFile(url: string, dest: string): Promise<void> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`[cache] HTTP ${res.status} downloading ${url}`);
    }
    if (!res.body) {
      throw new Error(`[cache] empty body downloading ${url}`);
    }
    const ws = createWriteStream(dest);
    await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), ws);
  }
}
