/**
 * tests/integrity/metadata-generator.test.ts
 *
 * RED:
 *  1. tags.length check may fail — TAGS arrays in metadata-generator.ts have
 *     < 5 entries for some languages or the slice truncates them.
 *  2. "kids" / "children" ban may fail if a new template accidentally
 *     contains those words (regression lock).
 *  3. determinism check: simpleHash uses string.charCodeAt — deterministic ✓
 *     but the template pick is `seed % templates.length` which is stable.
 *     Fails today because zod is not yet importable.
 *
 * GREEN after: add zod to devDependencies; ensure tags ≥ 5; audit templates.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { generateEpisode } from '../../src/story/story-engine';
import { generateMetadata } from '../../src/pipeline/metadata-generator';
import { LANGUAGES } from '../../src/types';

const BANNED_WORDS = ['kids', 'children', 'बच्चों', 'बच्चे'];

const MetadataSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(20),
  tags: z.array(z.string()).min(5),
  playlistTitle: z.string().min(1),
  language: z.enum(['hi', 'te', 'ta', 'kn', 'mr', 'bn', 'en']),
  episodeNumber: z.number().int().positive(),
});

describe('integrity: metadata-generator output', () => {
  const episode = generateEpisode(1, 1);

  it.each(LANGUAGES)('metadata for "%s" satisfies MetadataSchema', (lang) => {
    const meta = generateMetadata(episode, lang, 1);
    expect(() => MetadataSchema.parse(meta)).not.toThrow();
  });

  it.each(LANGUAGES)('no banned "kids/children" words in metadata for "%s"', (lang) => {
    const meta = generateMetadata(episode, lang, 1);
    const blob = [meta.title, meta.description, ...meta.tags].join(' ').toLowerCase();
    for (const banned of BANNED_WORDS) {
      expect(blob).not.toContain(banned.toLowerCase());
    }
  });

  it('title contains episode number or story title', () => {
    const meta = generateMetadata(episode, 'hi', 1);
    // Either Ep 1 or the story title should appear
    const hasEp = meta.title.includes('1') || meta.title.includes(episode.title);
    expect(hasEp).toBe(true);
  });

  it('tags have at least 5 entries and are non-empty strings', () => {
    for (const lang of LANGUAGES) {
      const meta = generateMetadata(episode, lang, 1);
      expect(meta.tags.length).toBeGreaterThanOrEqual(5);
      for (const tag of meta.tags) expect(tag.trim().length).toBeGreaterThan(0);
    }
  });

  it('is deterministic: same (episode, lang, ep#) → identical output', () => {
    const a = generateMetadata(episode, 'hi', 1);
    const b = generateMetadata(episode, 'hi', 1);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('thumbnailFrame, if set, is a non-negative integer', () => {
    const meta = generateMetadata(episode, 'hi', 1);
    if (meta.thumbnailFrame !== undefined) {
      expect(Number.isInteger(meta.thumbnailFrame)).toBe(true);
      expect(meta.thumbnailFrame).toBeGreaterThanOrEqual(0);
    }
  });
});
