import { describe, it, expect } from 'vitest';
import { normalizeTitle, buildDuplicateGroups, type DedupRecord } from '../channel-dedup';

describe('normalizeTitle', () => {
  it('strips emoji and #Shorts so variants collapse to the same key', () => {
    const a = normalizeTitle('This Kafka bug cost Uber $10M 😱 #Shorts');
    const b = normalizeTitle('This Kafka bug cost Uber $10M #Shorts');
    expect(a).toBe(b);
    expect(a).toBe('this kafka bug cost uber 10m');
  });

  it('collapses whitespace and lowercases', () => {
    expect(normalizeTitle('  90% of   DEVS get Kafka  WRONG 😳 ')).toBe(
      '90 of devs get kafka wrong'
    );
  });
});

describe('buildDuplicateGroups', () => {
  const rec = (
    videoId: string,
    title: string,
    views: number,
    publishedAt: string,
    privacyStatus = 'public',
    durationISO?: string
  ): DedupRecord => ({ videoId, title, views, publishedAt, privacyStatus, durationISO });

  it('returns only groups with >=2 public members', () => {
    const groups = buildDuplicateGroups([
      rec('a', 'Kafka acks WRONG #Shorts', 100, '2026-05-01'),
      rec('b', 'Kafka acks WRONG 😳 #Shorts', 50, '2026-05-02'),
      rec('c', 'Unique video', 10, '2026-05-03'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].duplicates).toHaveLength(1);
  });

  it('keeps the highest-view video as keeper', () => {
    const groups = buildDuplicateGroups([
      rec('low', 'Redis as a DATABASE #Shorts', 36, '2026-05-01'),
      rec('high', 'Redis as a DATABASE 🔥 #Shorts', 108, '2026-05-02'),
    ]);
    expect(groups[0].keeper.videoId).toBe('high');
    expect(groups[0].duplicates[0].videoId).toBe('low');
  });

  it('on a view tie, keeps the earliest publishedAt', () => {
    const groups = buildDuplicateGroups([
      rec('newer', 'API Gateway SPOF #Shorts', 5, '2026-05-19'),
      rec('older', 'API Gateway SPOF 🔥 #Shorts', 5, '2026-05-10'),
    ]);
    expect(groups[0].keeper.videoId).toBe('older');
  });

  it('does not group a Short with its companion long-form', () => {
    const groups = buildDuplicateGroups([
      rec('short', 'Are Microservices Killing CX? #Shorts', 18, '2026-05-21'),
      rec('long', 'Are Microservices Killing CX?', 1, '2026-05-21', 'public', 'PT3M53S'),
    ]);
    expect(groups).toHaveLength(0);
  });

  it('still groups two long-form videos with the same title', () => {
    const groups = buildDuplicateGroups([
      rec('l1', 'Microservices Deep Dive', 50, '2026-05-01', 'public', 'PT8M'),
      rec('l2', 'Microservices Deep Dive 🔥', 10, '2026-05-02', 'public', 'PT9M'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].keeper.videoId).toBe('l1');
  });

  it('ignores private videos', () => {
    const groups = buildDuplicateGroups([
      rec('pub', 'Caching explained #Shorts', 100, '2026-05-01', 'public'),
      rec('priv', 'Caching explained 🔥 #Shorts', 50, '2026-05-02', 'private'),
    ]);
    expect(groups).toHaveLength(0); // only 1 public member → no group
  });
});
