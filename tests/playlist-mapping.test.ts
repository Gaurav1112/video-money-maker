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
});
