/**
 * tests/scripts/upload-hinglish-youtube-payload.test.ts
 *
 * Unit tests for buildHinglishUploadPayload() — a pure function exported
 * from upload-hinglish-youtube.ts. No I/O, no network, no process.exit.
 */

import { describe, it, expect } from 'vitest';
import {
  buildHinglishUploadPayload,
  type MetadataFile,
} from '../../scripts/upload-hinglish-youtube.js';

// ─── Fixture factory ──────────────────────────────────────────────────────────

function makeMetadata(overrides: Partial<MetadataFile['youtube']> = {}): MetadataFile {
  return {
    youtube: {
      title: 'API Gateway Explained in 60 Seconds',
      description: 'Learn how API gateway works in this short.\n\n#SystemDesign',
      tags: ['api', 'gateway', 'system-design', 'shorts'],
      categoryId: '27',
      ...overrides,
    },
  };
}

// ─── Title format ─────────────────────────────────────────────────────────────

describe('buildHinglishUploadPayload — title', () => {
  it('appends " (Hinglish)" to the original title', () => {
    const payload = buildHinglishUploadPayload(makeMetadata(), 'dQw4w9WgXcQ');
    expect(payload.title).toBe('API Gateway Explained in 60 Seconds (Hinglish)');
  });

  it('title is ≤100 characters', () => {
    const longTitle = 'A'.repeat(95);
    const payload = buildHinglishUploadPayload(makeMetadata({ title: longTitle }), 'vid123');
    expect(payload.title.length).toBeLessThanOrEqual(100);
    expect(payload.title).toContain('(Hinglish)');
  });

  it('truncates but always ends with " (Hinglish)"', () => {
    const veryLongTitle = 'Understanding '.repeat(10).trim(); // 140 chars
    const payload = buildHinglishUploadPayload(makeMetadata({ title: veryLongTitle }), 'vid123');
    expect(payload.title.endsWith(' (Hinglish)')).toBe(true);
    expect(payload.title.length).toBeLessThanOrEqual(100);
  });

  it('short title remains unchanged + suffix', () => {
    const payload = buildHinglishUploadPayload(makeMetadata({ title: 'Kafka' }), 'vid');
    expect(payload.title).toBe('Kafka (Hinglish)');
  });
});

// ─── Description prepend ──────────────────────────────────────────────────────

describe('buildHinglishUploadPayload — description', () => {
  it('prepends Hinglish banner with original title', () => {
    const payload = buildHinglishUploadPayload(makeMetadata(), 'dQw4w9WgXcQ');
    expect(payload.description).toMatch(/^🇮🇳 Hinglish version of: API Gateway Explained in 60 Seconds/);
  });

  it('includes a link to the English original', () => {
    const payload = buildHinglishUploadPayload(makeMetadata(), 'dQw4w9WgXcQ');
    expect(payload.description).toContain('https://youtube.com/shorts/dQw4w9WgXcQ');
  });

  it('retains the original description content after the banner', () => {
    const payload = buildHinglishUploadPayload(makeMetadata(), 'abc');
    expect(payload.description).toContain('Learn how API gateway works');
  });

  it('description does not exceed 5000 chars', () => {
    const longDesc = 'x'.repeat(6000);
    const payload = buildHinglishUploadPayload(makeMetadata({ description: longDesc }), 'vid');
    expect(payload.description.length).toBeLessThanOrEqual(5000);
  });
});

// ─── Language settings ────────────────────────────────────────────────────────

describe('buildHinglishUploadPayload — language', () => {
  it('sets defaultLanguage to "hi"', () => {
    const payload = buildHinglishUploadPayload(makeMetadata(), 'vid');
    expect(payload.defaultLanguage).toBe('hi');
  });

  it('sets defaultAudioLanguage to "hi"', () => {
    const payload = buildHinglishUploadPayload(makeMetadata(), 'vid');
    expect(payload.defaultAudioLanguage).toBe('hi');
  });
});

// ─── Tags ─────────────────────────────────────────────────────────────────────

describe('buildHinglishUploadPayload — tags', () => {
  it('preserves original tags', () => {
    const payload = buildHinglishUploadPayload(makeMetadata(), 'vid');
    expect(payload.tags).toContain('api');
    expect(payload.tags).toContain('gateway');
    expect(payload.tags).toContain('system-design');
  });

  it('respects 500-char tag limit', () => {
    // Each tag is 50 chars; 500/51 ≈ 9 tags should fit
    const manyTags = Array.from({ length: 30 }, (_, i) => `tag-${'x'.repeat(46)}-${i}`);
    const payload = buildHinglishUploadPayload(makeMetadata({ tags: manyTags }), 'vid');
    const totalChars = payload.tags.reduce((s, t, i) => s + t.length + (i > 0 ? 1 : 0), 0);
    expect(totalChars).toBeLessThanOrEqual(500);
  });

  it('preserves categoryId', () => {
    const payload = buildHinglishUploadPayload(makeMetadata({ categoryId: '22' }), 'vid');
    expect(payload.categoryId).toBe('22');
  });
});
