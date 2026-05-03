import { describe, it, expect } from 'vitest';
import { selectHookTemplate, HOOK_TEMPLATES } from '../../src/services/hook-template-selector.js';

describe('selectHookTemplate', () => {
  it('returns a valid hook template for numeric id', () => {
    for (let i = 1; i <= 100; i++) {
      const t = selectHookTemplate(i);
      expect(HOOK_TEMPLATES).toContain(t);
    }
  });

  it('100 topics produce ≥4 distinct templates', () => {
    const seen = new Set<string>();
    for (let i = 1; i <= 100; i++) {
      seen.add(selectHookTemplate(i));
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });

  it('distributes evenly across 5 templates for ids 1-5', () => {
    const templates = [1, 2, 3, 4, 5].map(selectHookTemplate);
    const unique = new Set(templates);
    expect(unique.size).toBe(5);
  });

  it('string topics are also valid', () => {
    const t = selectHookTemplate('Kafka Consumer Groups');
    expect(HOOK_TEMPLATES).toContain(t);
  });
});
