/**
 * tests/scripts/mark-hinglish-published.test.ts
 *
 * Unit tests for mark-hinglish-published core logic.
 * Tests markHinglishPublished() and atomicWrite() with mocked fs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import {
  markHinglishPublished,
  atomicWrite,
  type PublishQueue,
} from '../../scripts/mark-hinglish-published.js';

// ─── Fixture factory ──────────────────────────────────────────────────────────

function makeQueue(entries: Array<{
  topic: string;
  session: number;
  hinglishPublished?: boolean;
  hinglishVideoId?: string | null;
  someOtherField?: string;
}>): PublishQueue {
  return {
    version: 2,
    lastUpdated: '2025-01-01',
    schedule: { pattern: 'test', note: 'test' },
    entries: entries.map((e) => ({
      id: `${e.topic}/s${e.session}`,
      topic: e.topic,
      session: e.session,
      slotType: 'long',
      youtubeVideoId: 'some-vid-id',
      hinglishPublished: e.hinglishPublished,
      hinglishVideoId: e.hinglishVideoId,
      someOtherField: e.someOtherField,
      files: { video: 'x.mp4', metadata: 'x.json' },
    })),
  };
}

// ─── Core logic tests ──────────────────────────────────────────────────────────

describe('markHinglishPublished', () => {
  it('marks the correct entry and sets hinglishPublished=true', () => {
    const queue = makeQueue([
      { topic: 'kafka', session: 1 },
      { topic: 'redis', session: 2 },
    ]);

    const { queue: updated, changed } = markHinglishPublished(queue, {
      topic: 'kafka',
      session: 1,
    });

    expect(changed).toBe(true);
    const entry = updated.entries.find((e) => e.topic === 'kafka');
    expect(entry!.hinglishPublished).toBe(true);
    expect(entry!.hinglishPublishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('sets hinglishVideoId when --video-id is provided', () => {
    const queue = makeQueue([{ topic: 'docker', session: 3 }]);

    const { queue: updated } = markHinglishPublished(queue, {
      topic: 'docker',
      session: 3,
      videoId: 'ABC123xyz',
    });

    const entry = updated.entries.find((e) => e.topic === 'docker');
    expect(entry!.hinglishVideoId).toBe('ABC123xyz');
  });

  it('updates top-level lastUpdated', () => {
    const queue = makeQueue([{ topic: 'nginx', session: 1 }]);
    const today = new Date().toISOString().split('T')[0];

    const { queue: updated } = markHinglishPublished(queue, { topic: 'nginx', session: 1 });
    expect(updated.lastUpdated).toBe(today);
  });

  it('preserves all other fields on the mutated entry', () => {
    const queue = makeQueue([{ topic: 'grpc', session: 2, someOtherField: 'keep-me' }]);

    const { queue: updated } = markHinglishPublished(queue, { topic: 'grpc', session: 2 });
    const entry = updated.entries.find((e) => e.topic === 'grpc')!;

    expect(entry.someOtherField).toBe('keep-me');
    expect(entry.slotType).toBe('long');
    expect(entry.youtubeVideoId).toBe('some-vid-id');
    expect(entry.id).toBe('grpc/s2');
  });

  it('is idempotent: changed=false on re-run', () => {
    const queue = makeQueue([
      { topic: 'kafka', session: 1, hinglishPublished: true, hinglishVideoId: 'OLD' },
    ]);

    const { changed } = markHinglishPublished(queue, {
      topic: 'kafka',
      session: 1,
      videoId: 'NEW',
    });

    expect(changed).toBe(false);
    // Should NOT overwrite the existing video id
    const entry = queue.entries.find((e) => e.topic === 'kafka')!;
    expect(entry.hinglishVideoId).toBe('OLD');
  });

  it('throws if entry not found', () => {
    const queue = makeQueue([{ topic: 'redis', session: 1 }]);
    expect(() =>
      markHinglishPublished(queue, { topic: 'missing-topic', session: 99 }),
    ).toThrow(/not found/i);
  });

  it('does not mutate other entries', () => {
    const queue = makeQueue([
      { topic: 'kafka', session: 1 },
      { topic: 'redis', session: 2 },
    ]);

    markHinglishPublished(queue, { topic: 'kafka', session: 1 });

    const redisEntry = queue.entries.find((e) => e.topic === 'redis')!;
    expect(redisEntry.hinglishPublished).toBeUndefined();
  });
});

// ─── Atomic write tests ───────────────────────────────────────────────────────

describe('atomicWrite', () => {
  const testFile = '/tmp/vmmtest-mark-hinglish-published.json';

  afterEach(() => {
    try { fs.unlinkSync(testFile); } catch { /* ignore */ }
    try { fs.unlinkSync(`${testFile}.tmp`); } catch { /* ignore */ }
  });

  it('writes content to the target file', () => {
    atomicWrite(testFile, '{"ok":true}\n');
    const content = fs.readFileSync(testFile, 'utf-8');
    expect(content).toBe('{"ok":true}\n');
  });

  it('leaves no .tmp file behind after successful write', () => {
    atomicWrite(testFile, '{"x":1}\n');
    expect(fs.existsSync(`${testFile}.tmp`)).toBe(false);
  });

  it('overwrites existing content atomically', () => {
    fs.writeFileSync(testFile, '{"old":true}\n');
    atomicWrite(testFile, '{"new":true}\n');
    expect(fs.readFileSync(testFile, 'utf-8')).toBe('{"new":true}\n');
  });
});
