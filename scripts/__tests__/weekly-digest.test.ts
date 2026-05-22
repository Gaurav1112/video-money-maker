// Tests for the pure helpers of the weekly decision digest (F011).
// Covers computeDelta and every branch of the recommendAction decision tree.
//
// Constitution I: deterministic — these functions are pure, no I/O, no random.

import { describe, it, expect } from 'vitest';
import { computeDelta, recommendAction } from '../weekly-digest';

describe('computeDelta', () => {
  it('computes a positive delta', () => {
    expect(computeDelta(12, 14)).toEqual({ prev: 12, curr: 14, delta: 2 });
  });

  it('computes a negative delta', () => {
    expect(computeDelta(31, 22)).toEqual({ prev: 31, curr: 22, delta: -9 });
  });

  it('computes a zero delta', () => {
    expect(computeDelta(8, 8)).toEqual({ prev: 8, curr: 8, delta: 0 });
  });

  it('returns null delta when prev is missing (first run)', () => {
    expect(computeDelta(null, 14)).toEqual({ prev: null, curr: 14, delta: null });
  });

  it('returns null delta when curr is missing', () => {
    expect(computeDelta(12, null)).toEqual({ prev: 12, curr: null, delta: null });
  });
});

describe('recommendAction decision tree', () => {
  it('branch 1: holds when <3 days since last change', () => {
    const r = recommendAction({
      daysSinceLastChange: 1,
      completionDeltaPp: 8,
      subscriberDeltaPerWeek: 20,
      weeksFlat: 0,
    });
    expect(r).toMatch(/^Hold/);
  });

  it('branch 2: flags regression when completion dropped', () => {
    const r = recommendAction({
      daysSinceLastChange: 10,
      completionDeltaPp: -4,
      subscriberDeltaPerWeek: 5,
      weeksFlat: 0,
    });
    expect(r).toMatch(/regressed/i);
  });

  it('branch 3: doubles down when completion rose >=5pp', () => {
    const r = recommendAction({
      daysSinceLastChange: 10,
      completionDeltaPp: 9,
      subscriberDeltaPerWeek: 2,
      weeksFlat: 0,
    });
    expect(r).toMatch(/worked/i);
  });

  it('branch 4: healthy when subscribers grew >=10/week', () => {
    const r = recommendAction({
      daysSinceLastChange: 10,
      completionDeltaPp: 1,
      subscriberDeltaPerWeek: 15,
      weeksFlat: 0,
    });
    expect(r).toMatch(/growth healthy/i);
  });

  it('branch 5: flags plateau when subs and completion flat for 2+ weeks', () => {
    const r = recommendAction({
      daysSinceLastChange: 10,
      completionDeltaPp: 0,
      subscriberDeltaPerWeek: 0,
      weeksFlat: 3,
    });
    expect(r).toMatch(/plateau/i);
  });

  it('branch 6: steady state as the default', () => {
    const r = recommendAction({
      daysSinceLastChange: 10,
      completionDeltaPp: 2,
      subscriberDeltaPerWeek: 3,
      weeksFlat: 0,
    });
    expect(r).toMatch(/steady state/i);
  });

  it('handles all-null signals as steady state (first run)', () => {
    const r = recommendAction({
      daysSinceLastChange: null,
      completionDeltaPp: null,
      subscriberDeltaPerWeek: null,
      weeksFlat: 0,
    });
    expect(r).toMatch(/steady state/i);
  });
});
