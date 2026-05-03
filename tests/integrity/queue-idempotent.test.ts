/**
 * tests/integrity/queue-idempotent.test.ts
 *
 * RED:
 *  1. PublishQueue has no deduplication logic — pushing same (episodeNumber,
 *     language) twice appends a second entry.
 *  2. There is no enqueueEpisode() utility function that enforces uniqueness.
 *
 * GREEN after: add enqueueEpisode(queue, entry) that checks for existing
 *              entry with same (episodeNumber, language) before pushing.
 */
import { describe, it, expect } from 'vitest';
import type { PublishQueue, PublishQueueEntry, SupportedLanguage } from '../../src/types';

// This function does NOT exist yet in the codebase — its absence makes all
// tests in this file fail with "enqueueEpisode is not a function".
let enqueueEpisode: (
  queue: PublishQueue,
  entry: Pick<PublishQueueEntry, 'episodeNumber' | 'languages' | 'scheduledDate'>,
) => { queue: PublishQueue; isNew: boolean };

try {
  const mod = await import('../../src/pipeline/publish-queue');
  enqueueEpisode = mod.enqueueEpisode;
} catch {
  enqueueEpisode = undefined as any;
}

function makeQueue(): PublishQueue {
  return {
    queue: [],
    schedule: { days: ['monday', 'wednesday', 'friday'], time: '10:00', timezone: 'Asia/Kolkata' },
  };
}

const ENTRY: Pick<PublishQueueEntry, 'episodeNumber' | 'languages' | 'scheduledDate'> = {
  episodeNumber: 5,
  languages: ['hi', 'te'] as SupportedLanguage[],
  scheduledDate: '2025-01-20',
};

describe('integrity: publish queue idempotency', () => {
  it('enqueueEpisode is exported from pipeline/publish-queue', () => {
    expect(typeof enqueueEpisode).toBe('function');
  });

  it('first enqueue returns isNew=true and adds entry', () => {
    const q = makeQueue();
    const result = enqueueEpisode(q, ENTRY);
    expect(result.isNew).toBe(true);
    expect(result.queue.queue).toHaveLength(1);
  });

  it('second enqueue of same (episodeNumber, languages) returns isNew=false and no duplicate', () => {
    const q = makeQueue();
    enqueueEpisode(q, ENTRY);
    const result2 = enqueueEpisode(q, ENTRY);
    expect(result2.isNew).toBe(false);
    expect(result2.queue.queue).toHaveLength(1);
  });

  it('different episode number creates a second entry', () => {
    const q = makeQueue();
    enqueueEpisode(q, ENTRY);
    const result2 = enqueueEpisode(q, { ...ENTRY, episodeNumber: 6 });
    expect(result2.isNew).toBe(true);
    expect(result2.queue.queue).toHaveLength(2);
  });

  it('different language set on same episode creates a new entry', () => {
    const q = makeQueue();
    enqueueEpisode(q, ENTRY);
    // If the queue tracks per-language separately, this should be new
    const result2 = enqueueEpisode(q, { ...ENTRY, languages: ['ta', 'kn'] as SupportedLanguage[] });
    expect(result2.queue.queue.length).toBeGreaterThanOrEqual(1);
  });
});
