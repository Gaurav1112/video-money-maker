# Tasks: Weekly Decision Digest

**Branch**: `011-weekly-decision-digest` | **Plan**: `plan.md`

One commit per task. TDD where marked.

## T001 — Spec-kit docs [US1]

Add `spec.md`, `plan.md`, `tasks.md` under
`specs/011-weekly-decision-digest/`. Commit.

## T002 — Test: pure helpers [TDD, US1]

Write `scripts/__tests__/weekly-digest.test.ts` covering `computeDelta`
(positive/negative/zero delta, null prev → null delta) and `recommendAction`
(all six decision-tree branches). 5+ tests. Tests fail to compile until T003
exports the helpers.

## T003 — Implement weekly-digest.ts core + helpers [US1]

Create `scripts/weekly-digest.ts`. Export pure `computeDelta(prev, curr)` and
`recommendAction(signals)`. Implement the decision tree per plan.md. Make T002
pass.

## T004 — Sections 1–4 assembly [US1]

In `weekly-digest.ts` add `gitShowPrev` git-history helper and the four data
sections: monetization delta, retention trend (median completion + new-vs-old
split), top/bottom video, A/B hook status via `variant-store.ts`. Each section
degrades to "unavailable" / "first run" when data is absent.

## T005 — Section 5 + stdout wiring [US1]

Assemble Section 5 from `recommendAction`, gather signals from Sections 1–2,
print the full five-section Markdown digest to stdout, exit 0. Smoke-run
locally.

## T006 — Sunday cron workflow [US1]

Add `.github/workflows/weekly-digest.yml`: cron `0 5 * * 0` + `workflow_dispatch`,
`actions/checkout@v4` with `fetch-depth: 0`, runs
`npx tsx scripts/weekly-digest.ts > data/analytics/weekly-digest.md`, commits it.
