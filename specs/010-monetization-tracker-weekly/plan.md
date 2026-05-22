# Implementation Plan: Monetization Tracker + Engagement Fix

**Branch**: `010-monetization-tracker-weekly` | **Spec**: `spec.md`

## Summary

Two independent P1 slices on one branch. Part A adds a deterministic
monetization report that measures YPP distance daily. Part B fixes the
dead-comments problem with an on-screen comment ask, a reply-baiting first
comment, and a weak-prompt audit.

## File Structure

```
scripts/
  monetization-report.ts          NEW  — Part A entry point + pure calc exports
  audit-end-questions.ts          NEW  — Part B weak endQuestion auditor
  lib/
    engagement.ts                 NEW  — buildFirstComment(quiz) helper
  __tests__/
    monetization-report.test.ts   NEW  — yppProgress + verdict-picker tests
    engagement.test.ts            NEW  — buildFirstComment tests
src/components/
  EndCardCTA.tsx                  EDIT — add "👇 COMMENT YOUR ANSWER" line
.github/workflows/
  channel-inventory.yml           EDIT — add monetization-report step
data/analytics/
  monetization.md                 GEN  — committed by cron
```

## Part A — monetization-report.ts design

- Read `data/channel-inventory.json` → `subscriberCount`, `records[]`.
- Pure exports (testable, no I/O):
  - `yppProgress(current, threshold)` → `{ pct, gap }` where
    `pct = min(100, current/threshold*100)` and `gap = max(0, threshold-current)`.
  - `pickVerdict(subsPct, shortsPct, hoursPct)` → string naming the path with
    the higher non-subscriber percent, or noting subscribers are the blocker.
- API layer (best-effort, wrapped in try/catch):
  - `getYouTubeAnalyticsClient()` → `reports.query` with `ids: 'channel==MINE'`,
    `metrics: 'views,estimatedMinutesWatched'`, two date windows (90d, 365d).
  - 90-day Shorts views = approximation. Primary: channel-level 90d `views`
    with an explicit caveat line. Secondary cross-check: sum of inventory
    `views` for records whose `durationISO` ≤ 180s.
  - 12-month watch hours = 365d `estimatedMinutesWatched / 60`.
- Any failed metric → string `unavailable`; never a number.
- Emit Markdown to stdout AND write `data/analytics/monetization.md`.
- Always `process.exit(0)` — the cron must commit even a degraded report.

## Part B design

- `EndCardCTA.tsx`: add a bold "👇 COMMENT YOUR ANSWER" header above the
  question in both the VS branch and the flat branch. The arrow pulses via a
  frame-derived `interpolate` sine (deterministic, no `Math.random`).
- `engagement.ts`: `buildFirstComment(quiz)` derives a short binary question
  from `quiz.endQuestion` (reusing the existing `" or "` debate split logic)
  and guarantees the string ends with a "👇" prompt — idempotent if already
  ends with one. Pure and deterministic.
- `audit-end-questions.ts`: iterate `QUIZ_BANK`, flag any `endQuestion` lacking
  a `?` or lacking a binary/openable signal (no `" or "`, no "YES or NO", etc.).
  Print count + list. Exit 0 (report-only).

## Risks & Mitigations

- **Shorts-vs-long ambiguity**: The Analytics API cannot cleanly split Shorts
  views. Mitigation: label the number "approx" and show the inventory-based
  duration-filtered cross-check so the reader sees both estimates.
- **Credentials absent locally**: `monetization-report.ts` must degrade to
  `unavailable` and exit 0 — verified by running locally without creds.
- **Pre-commit hooks (eslint/prettier)**: write files prettier-clean; let
  hooks run.
- **Double prompt in first comment**: `buildFirstComment` checks for a trailing
  "👇" before appending.

## Constitution Check

- Deterministic pure functions; frame-derived pulse; no `Math.random`. PASS.
- No TTS/avatar change. PASS.
- No LLM, no new cloud surface (Analytics API already used by the cron). PASS.

## Test Strategy

- TDD for `yppProgress`, `pickVerdict` (4+ tests) and `buildFirstComment`
  (3+ tests) — written before implementation.
- Smoke: run `monetization-report.ts` locally; run `audit-end-questions.ts`;
  `tsc --noEmit`.
