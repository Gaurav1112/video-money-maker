import { describe, it, expect } from 'vitest';
import { buildTags, TOPIC_TAGS, GENERIC_TAGS } from '../quiz-content';

describe('buildTags', () => {
  it('returns generic tags for unknown topic', () => {
    const tags = buildTags('unknown-topic');
    expect(tags).toEqual(expect.arrayContaining(GENERIC_TAGS));
  });
  it('merges topic + generic for known topic', () => {
    const tags = buildTags('kafka');
    expect(tags).toContain('apache kafka');
    expect(tags).toContain('system design');
  });
  it('deduplicates', () => {
    const tags = buildTags('kafka');
    expect(new Set(tags).size).toBe(tags.length);
  });
  it('total chars under 500', () => {
    for (const topic of Object.keys(TOPIC_TAGS)) {
      const tags = buildTags(topic);
      expect(tags.join(',').length).toBeLessThan(500);
    }
  });
});
