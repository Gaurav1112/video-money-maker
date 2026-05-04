/**
 * tests/scripts/get-next-hinglish-session.test.ts
 *
 * Unit tests for the get-next-hinglish-session core logic.
 * We test the exported `findNextHinglishEntry` function with synthetic
 * queue fixtures — no filesystem I/O, no process.exit.
 */

import { describe, it, expect } from 'vitest';
import {
  findNextHinglishEntry,
  type PublishQueue,
} from '../../scripts/get-next-hinglish-session.js';

// ─── Fixture factory ─────────────────────────────────────────────────────────

function makeQueue(entries: Array<{
  topic: string;
  session: number;
  youtubeVideoId?: string | null;
  hinglishPublished?: boolean;
}>): PublishQueue {
  return {
    version: 2,
    lastUpdated: '2025-01-01',
    entries: entries.map((e) => ({
      id: `${e.topic}/s${e.session}`,
      topic: e.topic,
      session: e.session,
      youtubeVideoId: e.youtubeVideoId ?? null,
      hinglishPublished: e.hinglishPublished,
      slotType: 'long',
      dayOfWeek: 'Tuesday',
      scheduledDate: '2025-01-01',
      status: 'published',
      attempts: 1,
      instagramMediaId: null,
      lastUpdated: '2025-01-01',
      errorMessage: null,
      files: {
        video: `${e.topic}/s${e.session}/video.mp4`,
        metadata: `${e.topic}/s${e.session}/metadata.json`,
      },
    })),
  };
}

// ─── Case (a): finds first unpublished entry that has a youtubeVideoId ────────

describe('findNextHinglishEntry', () => {
  it('(a) finds the first unpublished entry with youtubeVideoId set', () => {
    const queue = makeQueue([
      { topic: 'kafka', session: 1, youtubeVideoId: 'vid-kafka-1', hinglishPublished: true },
      { topic: 'redis', session: 1, youtubeVideoId: 'vid-redis-1' }, // not yet hinglish
      { topic: 'docker', session: 1, youtubeVideoId: 'vid-docker-1' },
    ]);

    const entry = findNextHinglishEntry(queue);
    expect(entry).toBeDefined();
    expect(entry!.topic).toBe('redis');
    expect(entry!.session).toBe(1);
  });

  // ─── Case (b): skips entries without youtubeVideoId ───────────────────────

  it('(b) skips entries that have no youtubeVideoId (null)', () => {
    const queue = makeQueue([
      { topic: 'api-gw', session: 1, youtubeVideoId: null },    // English not uploaded
      { topic: 'api-gw', session: 2, youtubeVideoId: '' },      // empty string — also no upload
      { topic: 'cdn', session: 1, youtubeVideoId: 'vid-cdn-1' }, // this should be picked
    ]);

    const entry = findNextHinglishEntry(queue);
    expect(entry).toBeDefined();
    expect(entry!.topic).toBe('cdn');
  });

  it('(b) skips entry where youtubeVideoId is null even if hinglishPublished=false', () => {
    const queue = makeQueue([
      { topic: 'load-balancer', session: 1, youtubeVideoId: null, hinglishPublished: false },
    ]);
    const entry = findNextHinglishEntry(queue);
    expect(entry).toBeUndefined();
  });

  // ─── Case (c): returns undefined when all entries are marked ─────────────

  it('(c) returns undefined when all entries are marked hinglishPublished=true', () => {
    const queue = makeQueue([
      { topic: 'k8s', session: 1, youtubeVideoId: 'vid-k8s-1', hinglishPublished: true },
      { topic: 'k8s', session: 2, youtubeVideoId: 'vid-k8s-2', hinglishPublished: true },
    ]);

    const entry = findNextHinglishEntry(queue);
    expect(entry).toBeUndefined();
  });

  it('(c) returns undefined when remaining entries have no youtubeVideoId', () => {
    const queue = makeQueue([
      { topic: 'grpc', session: 1, youtubeVideoId: null },                              // no English upload
      { topic: 'grpc', session: 2, youtubeVideoId: 'vid-grpc-2', hinglishPublished: true }, // done
    ]);

    const entry = findNextHinglishEntry(queue);
    expect(entry).toBeUndefined();
  });

  it('returns undefined for an empty queue', () => {
    const queue = makeQueue([]);
    expect(findNextHinglishEntry(queue)).toBeUndefined();
  });
});
