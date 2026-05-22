# Tasks: Monetization Tracker + Engagement Fix

**Branch**: `010-monetization-tracker-weekly` | **Plan**: `plan.md`

One commit per task. TDD where marked.

## T001 — Test: monetization calc functions [TDD, US1]

Write `scripts/__tests__/monetization-report.test.ts` covering `yppProgress`
(pct + gap, clamping at 100%, zero/over-threshold) and `pickVerdict`. 4+ tests.
Tests fail to compile initially (functions not yet exported).

## T002 — Implement monetization-report.ts [US1]

Create `scripts/monetization-report.ts`: export `yppProgress` and `pickVerdict`;
read `data/channel-inventory.json`; best-effort YouTube Analytics queries for
90d views and 365d watch hours; degrade to `unavailable`; emit Markdown to
stdout and `data/analytics/monetization.md`; exit 0. Make T001 pass.

## T003 — Wire monetization report into channel-inventory cron [US1]

Edit `.github/workflows/channel-inventory.yml`: add a `continue-on-error` step
`npx tsx scripts/monetization-report.ts > data/analytics/monetization.md`
after the inventory step. The existing `git add data/` already commits it.

## T004 — Test: buildFirstComment [TDD, US2]

Write `scripts/__tests__/engagement.test.ts`: assert `buildFirstComment(quiz)`
returns a string ending with a "👇" prompt, is deterministic across calls, and
does not double-append when `endQuestion` already ends in a binary prompt.
3+ tests.

## T005 — Implement engagement.ts [US2]

Create `scripts/lib/engagement.ts` exporting `buildFirstComment(quiz)` — a
short binary reply-baiting comment ending with "👇". Pure, deterministic.
Make T004 pass.

## T006 — Strengthen EndCardCTA comment ask [US2]

Edit `src/components/EndCardCTA.tsx`: add a bold "👇 COMMENT YOUR ANSWER" line
above the question in both VS and flat layouts, with a frame-derived pulsing
arrow. No `Math.random`.

## T007 — audit-end-questions.ts [US2]

Create `scripts/audit-end-questions.ts`: scan `QUIZ_BANK`, flag `endQuestion`
entries that are not binary/openable prompts, print count + list, exit 0.

## T008 — Smoke + type-check + verify [US1, US2]

Run `npm test` for the two new test files, `npx tsc --noEmit`,
`npx tsx scripts/monetization-report.ts`, and `npx tsx
scripts/audit-end-questions.ts`. Confirm clean. Final verification commit if any
fixups needed.
