/**
 * tests/publishing/dead-letter.test.ts
 *
 * RED: No dead-letter queue concept exists. After 3 retries, the episode
 *      is simply logged as failed with no persistent record.
 *
 * GREEN after: Add moveToDeadLetter(registry, episodeNumber, language, error)
 *              and expose it. Entries in registry with status 'failed' after
 *              maxAttempts get a deadLetter timestamp + reason.
 */
import { describe, it, expect } from 'vitest';
import type { EpisodeRegistry } from '../../src/types';

let moveToDeadLetter: (
  registry: EpisodeRegistry,
  episodeNumber: number,
  language: string,
  reason: string,
) => EpisodeRegistry;

try {
  const mod = await import('../../src/pipeline/upload-youtube');
  moveToDeadLetter = (mod as any).moveToDeadLetter;
} catch {
  moveToDeadLetter = undefined as any;
}

function makeRegistry(): EpisodeRegistry {
  return {
    episodes: {
      7: { episodeNumber: 7, languages: { hi: { rendered: true, uploaded: false } } },
    },
    lastRendered: 7,
    lastUploaded: 0,
  };
}

describe('publishing: dead-letter queue', () => {
  it('moveToDeadLetter is exported', () => {
    expect(typeof moveToDeadLetter).toBe('function');
  });

  it('marks the episode as failed in registry', () => {
    const reg = makeRegistry();
    const updated = moveToDeadLetter(reg, 7, 'hi', 'quota exceeded after 3 retries');
    expect((updated.episodes[7].languages as any).hi?.uploaded).toBe(false);
    expect((updated.episodes[7].languages as any).hi?.failedAt).toBeTruthy();
    expect((updated.episodes[7].languages as any).hi?.failReason).toContain('quota');
  });

  it('does not mutate the original registry', () => {
    const reg = makeRegistry();
    moveToDeadLetter(reg, 7, 'hi', 'reason');
    expect((reg.episodes[7].languages as any).hi?.failedAt).toBeUndefined();
  });

  it('non-existent episode is handled without throwing', () => {
    const reg = makeRegistry();
    expect(() => moveToDeadLetter(reg, 99, 'hi', 'not found')).not.toThrow();
  });
});
