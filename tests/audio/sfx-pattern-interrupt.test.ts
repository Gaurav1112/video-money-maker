/**
 * tests/audio/sfx-pattern-interrupt.test.ts
 *
 * Unit tests for src/audio/sfx-pattern-interrupt.ts
 *
 * Verifies:
 *   1. getPatternInterruptSfx returns valid absolute paths and expected durations.
 *   2. Durations are within the 200-400ms pattern-interrupt range.
 *   3. On-disk asset checksums match the expected SHA-256 values (asset drift guard).
 *   4. verifyPatternInterruptChecksum resolves true when files are present + intact.
 *
 * Batch-NN Audio P1 Huang.
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import {
  getPatternInterruptSfx,
  PATTERN_INTERRUPT_CHECKSUMS,
  computePatternInterruptChecksum,
  verifyPatternInterruptChecksum,
} from '../../src/audio/sfx-pattern-interrupt.js';

describe('getPatternInterruptSfx', () => {
  it('returns a non-empty absolute path for vinyl', () => {
    const sfx = getPatternInterruptSfx('vinyl');
    expect(sfx.path).toBeTruthy();
    expect(sfx.path).toMatch(/\//); // absolute path contains a slash
    expect(sfx.path).toMatch(/vinyl-scratch\.wav$/);
  });

  it('returns a non-empty absolute path for rimshot', () => {
    const sfx = getPatternInterruptSfx('rimshot');
    expect(sfx.path).toBeTruthy();
    expect(sfx.path).toMatch(/rimshot\.wav$/);
  });

  it('vinyl durationMs is within pattern-interrupt range (200-400ms)', () => {
    const sfx = getPatternInterruptSfx('vinyl');
    expect(sfx.durationMs).toBeGreaterThanOrEqual(200);
    expect(sfx.durationMs).toBeLessThanOrEqual(400);
  });

  it('rimshot durationMs is within pattern-interrupt range (200-400ms)', () => {
    const sfx = getPatternInterruptSfx('rimshot');
    expect(sfx.durationMs).toBeGreaterThanOrEqual(200);
    expect(sfx.durationMs).toBeLessThanOrEqual(400);
  });

  it('vinyl durationMs is deterministic (same value on every call)', () => {
    expect(getPatternInterruptSfx('vinyl').durationMs).toBe(
      getPatternInterruptSfx('vinyl').durationMs,
    );
  });

  it('rimshot durationMs is deterministic (same value on every call)', () => {
    expect(getPatternInterruptSfx('rimshot').durationMs).toBe(
      getPatternInterruptSfx('rimshot').durationMs,
    );
  });

  it('returns separate paths for vinyl vs rimshot', () => {
    expect(getPatternInterruptSfx('vinyl').path).not.toBe(
      getPatternInterruptSfx('rimshot').path,
    );
  });
});

describe('PATTERN_INTERRUPT_CHECKSUMS', () => {
  it('has expected SHA-256 entries for vinyl and rimshot', () => {
    expect(PATTERN_INTERRUPT_CHECKSUMS.vinyl).toMatch(/^[0-9a-f]{64}$/);
    expect(PATTERN_INTERRUPT_CHECKSUMS.rimshot).toMatch(/^[0-9a-f]{64}$/);
  });

  it('vinyl and rimshot checksums are different', () => {
    expect(PATTERN_INTERRUPT_CHECKSUMS.vinyl).not.toBe(
      PATTERN_INTERRUPT_CHECKSUMS.rimshot,
    );
  });
});

describe('asset files on disk', () => {
  it('vinyl-scratch.wav exists on disk', () => {
    const sfx = getPatternInterruptSfx('vinyl');
    expect(existsSync(sfx.path)).toBe(true);
  });

  it('rimshot.wav exists on disk', () => {
    const sfx = getPatternInterruptSfx('rimshot');
    expect(existsSync(sfx.path)).toBe(true);
  });
});

describe('computePatternInterruptChecksum', () => {
  it('vinyl checksum matches expected value', async () => {
    const digest = await computePatternInterruptChecksum('vinyl');
    expect(digest).toBe(PATTERN_INTERRUPT_CHECKSUMS.vinyl);
  });

  it('rimshot checksum matches expected value', async () => {
    const digest = await computePatternInterruptChecksum('rimshot');
    expect(digest).toBe(PATTERN_INTERRUPT_CHECKSUMS.rimshot);
  });
});

describe('verifyPatternInterruptChecksum', () => {
  it('resolves true for vinyl when file is intact', async () => {
    const ok = await verifyPatternInterruptChecksum('vinyl');
    expect(ok).toBe(true);
  });

  it('resolves true for rimshot when file is intact', async () => {
    const ok = await verifyPatternInterruptChecksum('rimshot');
    expect(ok).toBe(true);
  });
});
