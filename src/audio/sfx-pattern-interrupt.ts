/**
 * src/audio/sfx-pattern-interrupt.ts
 *
 * Pattern-interrupt SFX registry — vinyl scratch + rimshot.
 *
 * These 200-400ms micro-SFX are inserted at structural scene transitions
 * (mid-promise reveal + closing end-card open) to re-engage attention
 * following the MrBeast / Hormozi / Gadzhi pattern-interrupt playbook.
 *
 * Assets: assets/audio/sfx/pattern-interrupt/{vinyl-scratch,rimshot}.wav
 * License: CC0 — procedurally synthesised via ffmpeg aevalsrc. No external
 *   source, no network fetch, byte-deterministic from the synthesis command
 *   documented in assets/audio/MANIFEST.json.
 *
 * Batch-NN Audio P1 Huang.
 */

import { existsSync, createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve as pathResolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const ASSETS: Record<'vinyl' | 'rimshot', { relPath: string; durationMs: number }> = {
  vinyl: {
    relPath: 'assets/audio/sfx/pattern-interrupt/vinyl-scratch.wav',
    durationMs: 320,
  },
  rimshot: {
    relPath: 'assets/audio/sfx/pattern-interrupt/rimshot.wav',
    durationMs: 220,
  },
};

/** Expected SHA-256 hex digests of the vendored WAV files (byte-determinism guard). */
export const PATTERN_INTERRUPT_CHECKSUMS: Record<'vinyl' | 'rimshot', string> = {
  vinyl: '0f670de835525c3c57ced8d1762ad82dcb81f651a7972e37e062e29aace4d209',
  rimshot: '3cb111869b0d8e8b84e07b9a8881829bd8c422472d20042cbca4609522d0ae6c',
};

export interface PatternInterruptSfx {
  /** Absolute path to the WAV asset. */
  path: string;
  /** Duration in milliseconds (deterministic, derived from synthesis parameters). */
  durationMs: number;
}

/**
 * Returns the absolute path and duration of the requested pattern-interrupt SFX.
 * Pure data lookup — no I/O, no randomness, deterministic across invocations.
 */
export function getPatternInterruptSfx(kind: 'vinyl' | 'rimshot'): PatternInterruptSfx {
  const asset = ASSETS[kind];
  return {
    path: pathResolve(PACKAGE_ROOT, asset.relPath),
    durationMs: asset.durationMs,
  };
}

// ─── Checksum verification ────────────────────────────────────────────────────

/** Memoised checksum results so repeated calls within a process don't rehash. */
const checksumCache: Partial<Record<'vinyl' | 'rimshot', string>> = {};

/**
 * Computes the SHA-256 hex digest of the given SFX file.
 * Returns null if the file does not exist (graceful degradation on cold clones).
 */
export async function computePatternInterruptChecksum(
  kind: 'vinyl' | 'rimshot',
): Promise<string | null> {
  if (checksumCache[kind] !== undefined) return checksumCache[kind]!;
  const { path: sfxPath } = getPatternInterruptSfx(kind);
  if (!existsSync(sfxPath)) return null;
  const hash = createHash('sha256');
  return new Promise((resolve, reject) => {
    const stream = createReadStream(sfxPath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => {
      const digest = hash.digest('hex');
      checksumCache[kind] = digest;
      resolve(digest);
    });
    stream.on('error', reject);
  });
}

/**
 * Verifies that the on-disk asset matches the expected checksum.
 * Throws if the file exists but the checksum does not match (asset drift).
 * Returns false (no-throw) if the file is absent (cold-clone fallback).
 */
export async function verifyPatternInterruptChecksum(
  kind: 'vinyl' | 'rimshot',
): Promise<boolean> {
  const actual = await computePatternInterruptChecksum(kind);
  if (actual === null) return false; // file absent — degrade gracefully
  const expected = PATTERN_INTERRUPT_CHECKSUMS[kind];
  if (actual !== expected) {
    throw new Error(
      `[sfx-pattern-interrupt] asset drift detected for '${kind}': ` +
        `expected ${expected}, got ${actual}. ` +
        `Re-run the synthesis command in assets/audio/MANIFEST.json to regenerate.`,
    );
  }
  return true;
}
