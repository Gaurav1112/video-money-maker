import { describe, it, expect } from 'vitest';
import { findTopicBankEntry } from '../../src/data/topic-bank-loader.js';

describe('topic-bank-loader', () => {
  it('returns the curated entry for a known slug', () => {
    const entry = findTopicBankEntry('kafka-consumer-groups');
    expect(entry).toBeDefined();
    expect(entry?.hookHinglish).toContain('Kafka');
    expect(entry?.shortTitle).toBeTruthy();
  });

  it('returns undefined for an unknown slug', () => {
    expect(findTopicBankEntry('this-slug-does-not-exist-xyz')).toBeUndefined();
  });
});
