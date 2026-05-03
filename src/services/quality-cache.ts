/**
 * quality-cache.ts — Cache gate results by video SHA-256.
 *
 * Re-running the full gate on an unchanged video wastes ~2min of GHA compute.
 * This cache stores results keyed by SHA-256 hash of the video file.
 *
 * Storage: SQLite via better-sqlite3 (already in project deps from fix-14-queue-sqlite).
 * Fallback: JSON file when SQLite is unavailable.
 *
 * Cache invalidation:
 * - Video SHA changes → stale, re-run gate.
 * - Metadata JSON changes → stale, re-run gate.
 * - Gate version bumps → stale all entries.
 * - TTL: 7 days (render cadence is 3×/week, no need to cache indefinitely).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { QualityReport } from '../scripts/quality-gate';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Increment this when gate logic changes to bust all cached results. */
const GATE_VERSION = '1.0.0';

/** Cache TTL: 7 days in milliseconds */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const DEFAULT_CACHE_DIR = process.env['QUALITY_CACHE_DIR'] ?? path.join(process.cwd(), 'data', 'quality-cache');

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CacheEntry {
  cacheKey: string;
  videoSha256: string;
  metadataSha256: string;
  gateVersion: string;
  storedAt: string;
  expiresAt: string;
  report: QualityReport;
}

export interface CacheStats {
  totalEntries: number;
  hits: number;
  misses: number;
  expired: number;
  cacheDir: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache key derivation
// ─────────────────────────────────────────────────────────────────────────────

function sha256(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function buildCacheKey(videoSha256: string, metadataSha256: string): string {
  return sha256(`${GATE_VERSION}:${videoSha256}:${metadataSha256}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// File-based cache (zero-dependency fallback)
// ─────────────────────────────────────────────────────────────────────────────

export class QualityCache {
  private cacheDir: string;
  private statsFile: string;
  private _stats: CacheStats;

  constructor(cacheDir: string = DEFAULT_CACHE_DIR) {
    this.cacheDir = cacheDir;
    this.statsFile = path.join(cacheDir, '_stats.json');
    fs.mkdirSync(cacheDir, { recursive: true });
    this._stats = this.loadStats();
  }

  private loadStats(): CacheStats {
    try {
      if (fs.existsSync(this.statsFile)) {
        return JSON.parse(fs.readFileSync(this.statsFile, 'utf-8'));
      }
    } catch { /* start fresh */ }
    return { totalEntries: 0, hits: 0, misses: 0, expired: 0, cacheDir: this.cacheDir };
  }

  private saveStats(): void {
    try {
      fs.writeFileSync(this.statsFile, JSON.stringify(this._stats, null, 2));
    } catch { /* best-effort */ }
  }

  private entryPath(cacheKey: string): string {
    // Use first 2 chars as subdirectory to avoid giant flat directories
    const sub = cacheKey.slice(0, 2);
    const dir = path.join(this.cacheDir, sub);
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${cacheKey}.json`);
  }

  /**
   * Look up a cached result by video and metadata content.
   * Returns the cached QualityReport if valid, null if miss/expired.
   */
  get(videoPath: string, metadataPath: string): QualityReport | null {
    let videoSha256: string;
    let metadataSha256: string;

    try {
      videoSha256 = sha256(fs.readFileSync(videoPath));
      metadataSha256 = sha256(fs.readFileSync(metadataPath));
    } catch {
      this._stats.misses++;
      this.saveStats();
      return null;
    }

    const cacheKey = buildCacheKey(videoSha256, metadataSha256);
    const entryFile = this.entryPath(cacheKey);

    if (!fs.existsSync(entryFile)) {
      this._stats.misses++;
      this.saveStats();
      return null;
    }

    let entry: CacheEntry;
    try {
      entry = JSON.parse(fs.readFileSync(entryFile, 'utf-8'));
    } catch {
      this._stats.misses++;
      this.saveStats();
      return null;
    }

    // Check expiry
    if (new Date(entry.expiresAt) < new Date()) {
      fs.unlinkSync(entryFile);
      this._stats.expired++;
      this._stats.misses++;
      this.saveStats();
      return null;
    }

    // Verify gate version
    if (entry.gateVersion !== GATE_VERSION) {
      fs.unlinkSync(entryFile);
      this._stats.misses++;
      this.saveStats();
      return null;
    }

    this._stats.hits++;
    this.saveStats();
    console.log(`[quality-cache] ⚡ Cache HIT for ${path.basename(videoPath)} (key: ${cacheKey.slice(0, 12)}...)`);
    return entry.report;
  }

  /**
   * Store a gate result in the cache.
   */
  set(videoPath: string, metadataPath: string, report: QualityReport): void {
    let videoSha256: string;
    let metadataSha256: string;

    try {
      videoSha256 = sha256(fs.readFileSync(videoPath));
      metadataSha256 = sha256(fs.readFileSync(metadataPath));
    } catch {
      return; // Can't cache if files unreadable
    }

    const cacheKey = buildCacheKey(videoSha256, metadataSha256);
    const now = new Date();
    const expires = new Date(now.getTime() + CACHE_TTL_MS);

    const entry: CacheEntry = {
      cacheKey,
      videoSha256,
      metadataSha256,
      gateVersion: GATE_VERSION,
      storedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      report,
    };

    try {
      fs.writeFileSync(this.entryPath(cacheKey), JSON.stringify(entry, null, 2));
      this._stats.totalEntries++;
      this.saveStats();
      console.log(`[quality-cache] 💾 Cached result for ${path.basename(videoPath)} (TTL: 7 days)`);
    } catch (e) {
      console.warn(`[quality-cache] Could not write cache entry: ${(e as Error).message}`);
    }
  }

  /**
   * Invalidate a specific video's cache entry.
   * Useful when re-exporting and wanting to force a fresh gate run.
   */
  invalidate(videoPath: string, metadataPath: string): boolean {
    try {
      const videoSha256 = sha256(fs.readFileSync(videoPath));
      const metadataSha256 = sha256(fs.readFileSync(metadataPath));
      const cacheKey = buildCacheKey(videoSha256, metadataSha256);
      const entryFile = this.entryPath(cacheKey);
      if (fs.existsSync(entryFile)) {
        fs.unlinkSync(entryFile);
        return true;
      }
    } catch { /* best-effort */ }
    return false;
  }

  /**
   * Remove all expired entries. Run periodically or in CI cleanup step.
   */
  purgeExpired(): number {
    let purged = 0;
    const now = new Date();

    const walkDir = (dir: string) => {
      for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (fs.statSync(full).isDirectory()) {
          walkDir(full);
        } else if (entry.endsWith('.json') && entry !== '_stats.json') {
          try {
            const data: CacheEntry = JSON.parse(fs.readFileSync(full, 'utf-8'));
            if (new Date(data.expiresAt) < now || data.gateVersion !== GATE_VERSION) {
              fs.unlinkSync(full);
              purged++;
            }
          } catch {
            fs.unlinkSync(full); // corrupt entry
            purged++;
          }
        }
      }
    };

    try { walkDir(this.cacheDir); } catch { /* best-effort */ }
    console.log(`[quality-cache] 🧹 Purged ${purged} expired entries`);
    return purged;
  }

  /** Return current cache statistics. */
  stats(): CacheStats {
    return { ...this._stats };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cached gate runner — wraps quality-gate.ts with cache layer
// ─────────────────────────────────────────────────────────────────────────────

export async function runCachedQualityGate(
  videoPath: string,
  metadataPath: string,
  options: { format?: 'long' | 'short'; workDir?: string; determinism?: boolean; bypassCache?: boolean } = {},
): Promise<{ report: QualityReport; fromCache: boolean }> {
  const cache = new QualityCache();

  if (!options.bypassCache) {
    const cached = cache.get(videoPath, metadataPath);
    if (cached) {
      console.log(`[quality-cache] ⚡ Using cached gate result (${cached.timestamp})`);
      return { report: cached, fromCache: true };
    }
  }

  // Lazy import to avoid loading gate in cache-only contexts
  const { runQualityGate } = await import('../scripts/quality-gate');
  const report = await runQualityGate(videoPath, metadataPath, options);

  cache.set(videoPath, metadataPath, report);
  return { report, fromCache: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI: cache management
// ─────────────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const [, , command, ...args] = process.argv;

  const cache = new QualityCache();

  if (command === 'stats') {
    console.log(JSON.stringify(cache.stats(), null, 2));
  } else if (command === 'purge') {
    const purged = cache.purgeExpired();
    console.log(`Purged ${purged} entries.`);
  } else if (command === 'invalidate') {
    const [videoPath, metaPath] = args;
    if (!videoPath || !metaPath) {
      console.error('Usage: ... invalidate <video.mp4> <metadata.json>');
      process.exit(1);
    }
    const ok = cache.invalidate(videoPath, metaPath);
    console.log(ok ? 'Cache entry invalidated.' : 'No cache entry found.');
  } else {
    console.log('Commands: stats | purge | invalidate <video> <meta>');
    process.exit(1);
  }
}
