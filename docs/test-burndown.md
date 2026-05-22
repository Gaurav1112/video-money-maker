# Test Burn-Down Plan

**Created**: 2026-05-22 (Feature 008 — harden dev harness)
**Owner**: Kumar Gaurav

Constitution §"Currently Accepted Known Issues" requires every CI failure to
be either fixed or documented on a deprecation timeline. This file is that
timeline. The constitution names "~18 pre-existing failures"; the actual
measured count on `008-harden-dev-harness` is **25 failures across 3 test
files** (the estimate was stale). This document is the authoritative list.

## Baseline

```
npx vitest run  →  1546 pass | 25 fail | 2 skipped  (70 files)
```

The CI test count must not increase. New failures fail CI. The 25 below are
the grandfathered set; each carries a disposition (FIX or QUARANTINE) and a
target date.

## Failure inventory

### Group A — `tests/shorts-format.test.ts` (3 failures) — QUARANTINE

| # | Test | Disposition | Target |
|---|---|---|---|
| 1 | `fps is 30` | QUARANTINE | 2026-06-15 |
| 2 | `durationInFrames is ≤ 1650 even when scene duration is very long` | QUARANTINE | 2026-06-15 |
| 3 | `returns safe defaults when storyboard has no scenes` | QUARANTINE | 2026-06-15 |

**Reason**: These assert behavior of the `ViralShort` composition, which is
one of two parallel Shorts pipelines (constitution Principle VIII). The
resolution per the constitution is to *deprecate one of the two Shorts
pipelines*, not to patch the test. Until that pipeline decision is made, this
file is quarantined. **Action**: pick the surviving Shorts pipeline, delete
the loser, then delete or rewrite this file. Tracked as a follow-up feature.

### Group B — `tests/workflow-security.test.ts` (15 failures) — FIX

| # | Test | Disposition | Target |
|---|---|---|---|
| 4 | `[auto-shorts.yml] must NOT contain "${{ inputs.* }} in run:"` | FIX | 2026-06-08 |
| 5 | `[auto-shorts.yml] must NOT contain "${{ steps.*.outputs.* }} in run:"` | FIX | 2026-06-08 |
| 6 | `[channel-cleanup.yml] must NOT contain "${{ inputs.* }} in run:"` | FIX | 2026-06-08 |
| 7 | `[trend-short.yml] must NOT contain "${{ steps.*.outputs.* }} in run:"` | FIX | 2026-06-08 |
| 8 | `[weekly-article.yml] must NOT contain "${{ github.event.* }} in run:"` | FIX | 2026-06-08 |
| 9 | `[weekly-opinion.yml] must NOT contain "${{ inputs.* }} in run:"` | FIX | 2026-06-08 |
| 10 | `[auto-shorts.yml] all external uses: must be SHA-pinned` | FIX | 2026-06-08 |
| 11 | `[trend-short.yml] all external uses: must be SHA-pinned` | FIX | 2026-06-08 |
| 12 | `[weekly-article.yml] must have a top-level permissions: key` | FIX | 2026-06-08 |
| 13 | `[analytics.yml] must have a concurrency: key` | FIX | 2026-06-08 |
| 14 | `[auto-shorts.yml] must have a concurrency: key` | FIX | 2026-06-08 |
| 15 | `[channel-cleanup.yml] must have a concurrency: key` | FIX | 2026-06-08 |
| 16 | `[channel-inventory.yml] must have a concurrency: key` | FIX | 2026-06-08 |
| 17 | `[trend-short.yml] must have a concurrency: key` | FIX | 2026-06-08 |
| 18 | `[weekly-opinion.yml] must have a concurrency: key` | FIX | 2026-06-08 |

**Reason**: These are real workflow-hardening gaps — shell-injection surface
via template expressions in `run:`, unpinned `uses:` actions, missing
`concurrency:` and `permissions:` keys. They are all mechanical, low-risk
fixes (move expressions into `env:`, pin actions to commit SHAs, add the
missing keys). **Action**: a dedicated workflow-hardening commit; no code
logic changes. This is the highest-value group — secret/supply-chain hygiene.

### Group C — `src/pipeline/__tests__/shorts-generator.test.ts` (7 failures) — QUARANTINE

| # | Test | Disposition | Target |
|---|---|---|---|
| 19 | `truncTitle — every format index 0-9 produces a title ≤ 55 chars` | QUARANTINE | 2026-06-15 |
| 20 | `clampedNarration — narration is ≤ 120 words for index 0` | QUARANTINE | 2026-06-15 |
| 21 | `clampedNarration — narration is ≤ 120 words across all 10 format indices` | QUARANTINE | 2026-06-15 |
| 22 | `clampedNarration — narration is ≤ 120 words for multiple topics` | QUARANTINE | 2026-06-15 |
| 23 | `Title viral-hook formulas — shortIndex=0 title contains "Using" or "Wrong"` | QUARANTINE | 2026-06-15 |
| 24 | `resolveShortNumber — shortNumber 14 resolves to second topic, shortIndex 0` | QUARANTINE | 2026-06-15 |
| 25 | `resolveShortNumber — shortNumber 1 resolves to first topic, shortIndex 1` | QUARANTINE | 2026-06-15 |

**Reason**: `shorts-generator.ts` is a generator no longer used directly in
the published pipeline (per the dev-harness audit and constitution §Known
Issues). The tests assert constraints (title length, narration word count,
short-number resolution) that have drifted from current behavior.
**Action**: confirm `shorts-generator.ts` is dead code; if so, delete the
module and this test file. If still referenced, fix the assertions. Decide
alongside the Group A pipeline-deprecation call.

## Enforcement

- CI `test.yml` runs the full vitest suite. The 25 failures above are the
  accepted ceiling.
- A new failure (count > 25) is a regression and must be fixed before merge.
- As failures are burned down, decrement the ceiling — never let it rise.
- When a group reaches zero, delete its section here.

## Summary

| Group | File | Count | Disposition | Target |
|---|---|---|---|---|
| A | `tests/shorts-format.test.ts` | 3 | QUARANTINE | 2026-06-15 |
| B | `tests/workflow-security.test.ts` | 15 | FIX | 2026-06-08 |
| C | `src/pipeline/__tests__/shorts-generator.test.ts` | 7 | QUARANTINE | 2026-06-15 |
| | **Total** | **25** | | |
