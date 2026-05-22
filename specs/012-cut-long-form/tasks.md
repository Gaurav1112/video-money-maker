# Tasks: Cut Long-Form to 4-6 Minutes

**Branch**: `012-cut-long-form` | **Plan**: `plan.md`

One commit per task. TDD where marked.

## T001 — Spec-kit docs [US1]

Add `spec.md`, `plan.md`, `tasks.md` under `specs/012-cut-long-form/`. Commit.

## T002 — Test: narration-cap helper [TDD, US1]

Write `src/lib/__tests__/opinion-narration-cap.test.ts` covering
`capNarrationPlan`: under-budget plan returned unchanged; over-budget plan
truncated to <= 900 words total; truncation lands on a sentence boundary (no
mid-word cut); determinism (same input -> same output). 5+ tests. Fails to
compile until T003 exports the helper.

## T003 — Implement capNarrationPlan + wire into buildNarrationPlan [US1]

In `src/lib/opinion-piece-parser.ts` add an exported pure
`capNarrationPlan(plan, maxWords = 900)` that proportionally trims each scene's
narration at sentence boundaries so the total word count <= `maxWords`. Call it
at the end of `buildNarrationPlan`. Make T002 pass.

## T004 — script-generator scene budget 30 -> 16 [US1]

In `src/pipeline/script-generator.ts` change the `maxScenes` default from `30`
to `16`. Surgical one-literal edit only — no loop logic touched. Update the
adjacent comment block if it cites the old 8-12 min target.

## T005 — Widen analytics window 50 -> 200 [US2]

In `scripts/ingest-analytics.ts` change `MAX_VIDEOS` from `50` to `200`. Update
the inline comment.

## T006 — Verify: tsc + vitest [US1, US2]

Run `npx tsc --noEmit -p tsconfig.build.json` (clean for touched files) and
`npx vitest run` (no new failures beyond known ~27). Record results.

**Result**: `tsc` exit 0 — clean. `vitest run`: 28 failed / 1598 passed /
2 skipped. All 28 failures are in the three constitution-listed known-issue
files (`shorts-generator.test.ts`, `shorts-format.test.ts`,
`workflow-security.test.ts`). Zero failures in F012-touched files
(`opinion-piece-parser.ts`, `script-generator.ts`, `ingest-analytics.ts`,
new `opinion-narration-cap.test.ts` — all green). No new failures introduced.

## T007 — Verify: render opinion long-form + ffprobe [US1]

Run `npx tsx scripts/render-opinion-piece.ts --episode
001-microservices-vs-monolith` and `ffprobe` the output `long.mp4`. Confirm
duration is 240-360 s. Record the result.

**Result**: rendered `long.mp4` = **256.19 s** — within the 240-360 s
window (SC-001 met). The microservices markdown is terse (~566 source words);
`padNarrationPlan` lifts it to an 880-word floor (883 words) so it fills the
4-6 min window instead of the pre-F012 ~175 s undershoot.
