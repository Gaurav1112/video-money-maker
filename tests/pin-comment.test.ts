/**
 * B1 — pin-comment text builder tests
 *
 * We don't test the real YouTube API call (network/auth). The
 * deterministic pure-function under test is buildPinnedCommentText.
 */
import { describe, it, expect } from 'vitest';
import { buildPinnedCommentText } from '../scripts/pin-comment';

describe('buildPinnedCommentText', () => {
  it('templates topic into the comment', () => {
    const text = buildPinnedCommentText({ topic: 'Kafka Consumer Groups' });
    expect(text).toContain('Kafka Consumer Groups');
    expect(text).toContain('https://guru-sishya.in');
    expect(text).toContain('🔥');
  });

  it('falls back to a generic phrase when no topic is supplied', () => {
    const text = buildPinnedCommentText(null);
    expect(text).toContain('this concept');
    expect(text).toContain('https://guru-sishya.in');
  });

  it('prompts for replies (early-comment velocity signal)', () => {
    const text = buildPinnedCommentText({ topic: 'Caching' });
    // The reply prompt is part of why the pinned comment matters
    expect(text.toLowerCase()).toMatch(/comment|drop a|reply/);
  });

  it('keeps comment under YouTube top-level comment limit (10000 chars)', () => {
    const text = buildPinnedCommentText({ topic: 'A'.repeat(500) });
    expect(text.length).toBeLessThan(10000);
  });
});
