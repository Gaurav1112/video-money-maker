/**
 * B3 — playlist auto-assignment tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { playlistFor, _resetCacheForTests } from '../scripts/lib/playlist-mapping';

beforeEach(() => {
  _resetCacheForTests();
});

describe('playlistFor', () => {
  it('maps a system-design topic-bank entry to System Design playlist', () => {
    const result = playlistFor('Kafka Consumer Groups');
    expect(result).toContain('System Design');
  });

  it('maps a known DSA topic via slug heuristic', () => {
    const result = playlistFor('Two Pointer Technique');
    expect(result).toContain('DSA');
  });

  it('maps an OS/Networking topic via heuristic', () => {
    const result = playlistFor('TCP Three Way Handshake');
    expect(result).toContain('OS & Networking');
  });

  it('maps a DB internals topic via heuristic', () => {
    const result = playlistFor('LSM Trees and WAL');
    expect(result).toContain('Database Internals');
  });

  it('maps a behavioral topic via heuristic', () => {
    const result = playlistFor('STAR Method for Behavioral Interviews');
    expect(result).toContain('Behavioral');
  });

  it('returns null for an unmappable topic', () => {
    const result = playlistFor('Quantum Cooking with Aliens 42');
    expect(result).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(playlistFor('KAFKA CONSUMER GROUPS')).toBe(
      playlistFor('kafka consumer groups'),
    );
  });

  // Regressions caught by code-review of PR #56:
  it('does not let a 2-letter input "OS" fuzzy-match unrelated topics', () => {
    // 'os' < 6 chars so fuzzy match is skipped; no heuristic 'os' alone.
    expect(playlistFor('OS')).toBeNull();
  });

  it('does not miscategorize "Saga Pattern for Distributed Transactions" as db-internals', () => {
    // Has "transaction" (DB) and "saga-pattern" (system-design). Either:
    // direct topic-bank lookup wins, or system-design heuristic fires
    // before db-internals. Both paths must yield system-design.
    const result = playlistFor('Saga Pattern for Distributed Transactions');
    expect(result).not.toContain('Database Internals');
  });

  it('does not miscategorize "GraphQL vs REST" as DSA (no bare "graph" keyword)', () => {
    const result = playlistFor('GraphQL vs REST');
    expect(result).not.toContain('DSA');
    expect(result).toContain('System Design');
  });
});
