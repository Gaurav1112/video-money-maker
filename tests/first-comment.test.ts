/**
 * B1 — first-comment text builder tests
 *
 * We don't test the real YouTube API call (network/auth). The
 * deterministic pure-function under test is buildFirstCommentText.
 */
import { describe, it, expect } from 'vitest';
import { buildFirstCommentText } from '../scripts/first-comment';

describe('buildFirstCommentText', () => {
  it('templates topic into the comment', () => {
    const text = buildFirstCommentText({ topic: 'Kafka Consumer Groups' });
    expect(text).toContain('Kafka Consumer Groups');
    expect(text).toContain('https://guru-sishya.in');
    expect(text).toContain('🔥');
  });

  it('falls back to a generic phrase when no topic is supplied', () => {
    const text = buildFirstCommentText(null);
    expect(text).toContain('this concept');
    expect(text).toContain('https://guru-sishya.in');
  });

  it('prompts for replies (early-comment velocity signal)', () => {
    const text = buildFirstCommentText({ topic: 'Caching' });
    expect(text.toLowerCase()).toMatch(/comment|drop a|reply/);
  });

  it('keeps comment under YouTube top-level comment limit (10000 chars)', () => {
    const text = buildFirstCommentText({ topic: 'A'.repeat(500) });
    expect(text.length).toBeLessThan(10000);
  });
});

