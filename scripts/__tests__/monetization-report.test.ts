import { describe, it, expect } from 'vitest';
import { yppProgress, pickVerdict } from '../monetization-report';

describe('yppProgress', () => {
  it('computes percent and gap below threshold', () => {
    const r = yppProgress(250, 1000);
    expect(r.pct).toBeCloseTo(25);
    expect(r.gap).toBe(750);
  });

  it('clamps percent at 100 and gap at 0 when over threshold', () => {
    const r = yppProgress(1500, 1000);
    expect(r.pct).toBe(100);
    expect(r.gap).toBe(0);
  });

  it('handles zero current without dividing by zero', () => {
    const r = yppProgress(0, 10_000_000);
    expect(r.pct).toBe(0);
    expect(r.gap).toBe(10_000_000);
  });

  it('handles a non-positive threshold gracefully', () => {
    const r = yppProgress(5, 0);
    expect(Number.isFinite(r.pct)).toBe(true);
    expect(r.gap).toBe(0);
  });
});

describe('pickVerdict', () => {
  it('flags subscribers as the blocker when subs percent is lowest', () => {
    const v = pickVerdict(1, 40, 60);
    expect(v.toLowerCase()).toContain('subscriber');
  });

  it('names the Shorts path when it leads the watch-hours path', () => {
    const v = pickVerdict(80, 50, 10);
    expect(v.toLowerCase()).toContain('shorts');
  });

  it('names the watch-hours path when it leads the Shorts path', () => {
    const v = pickVerdict(80, 10, 55);
    expect(v.toLowerCase()).toContain('watch');
  });

  it('is deterministic for identical inputs', () => {
    expect(pickVerdict(80, 30, 30)).toBe(pickVerdict(80, 30, 30));
  });
});
