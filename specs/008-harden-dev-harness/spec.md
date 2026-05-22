# Feature Specification: Harden Dev Harness

**Feature Branch**: `008-harden-dev-harness`

**Created**: 2026-05-22

**Status**: Draft

**Input**: Close the gaps in `.specify/memory/dev-harness-audit.md` so the
constitution at `.specify/memory/constitution.md` is machine-enforced rather
than aspirational.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pre-commit hook blocks broken code (Priority: P1)

A developer (human or agent) runs `git commit`. Before the commit lands, a
pre-commit hook type-checks the project (`tsc --noEmit`) and lints the staged
TypeScript files. If type-checking or linting fails, the commit is rejected.

**Why this priority**: Broken code currently reaches `main`; today the only
safety net is GitHub Push Protection (server-side, secret-only). A local gate
catches mistakes seconds after they are made.

**Independent Test**: Stage a file with a TypeScript error, attempt a commit,
confirm the commit is rejected. Stage clean code, confirm the commit succeeds.

**Acceptance Scenarios**:

1. **Given** a staged `.ts` file with a type error, **When** `git commit` runs, **Then** the commit is blocked and `tsc` output is shown.
2. **Given** only well-typed staged files, **When** `git commit` runs, **Then** `lint-staged` auto-fixes and the commit succeeds.

---

### User Story 2 - Constitution drift test suite (Priority: P1)

A "constitution drift" test suite fails CI when forbidden patterns appear:
`Math.random()` in `src/**` (Principle I), `en-US-` voice identifiers in
`src/**` or `scripts/**` (Principle VI), and `KumarGaurav.jpg` /
`guru-avatar-large.jpg` references in `src/compositions/**` (Principle VI).

**Why this priority**: The constitution is referenced by every spec-kit
command but nothing enforces it. A drift suite makes violations fail the build.

**Independent Test**: Run `npx vitest run tests/constitution.test.ts`; it
passes on the current tree (via a documented allowlist for known violations)
and would fail if a new forbidden pattern were introduced.

**Acceptance Scenarios**:

1. **Given** the current tree, **When** the drift suite runs, **Then** it passes (known violations are on a visible allowlist with reasons).
2. **Given** a new `Math.random()` call added to `src/`, **When** the drift suite runs, **Then** it fails and names the offending file.

---

### User Story 3 - ESLint + Prettier with CI lint gate (Priority: P2)

ESLint (flat config, TypeScript-aware, warn-heavy) and Prettier are configured.
A one-time mechanical format pass normalizes the codebase. CI gains a lint
step (non-blocking initially).

**Why this priority**: Style drift across 100+ TS files; foundation for
consistent diffs. P2 because it does not catch correctness bugs by itself.

**Independent Test**: Run `npx eslint .` and `npx prettier --check src` and
confirm both run without crashing.

**Acceptance Scenarios**:

1. **Given** the flat config, **When** `npx eslint .` runs, **Then** it parses every file and reports only warnings (zero crashes).
2. **Given** the format pass is done, **When** `npx prettier --check src scripts` runs, **Then** it reports no changes needed.

---

### User Story 4 - Documented test burn-down plan (Priority: P2)

The 18 pre-existing failing tests (constitution §"Currently Accepted Known
Issues") are enumerated in `docs/test-burndown.md`, each classified FIX or
QUARANTINE with a target. The test count is gated so new failures fail CI.

**Why this priority**: The 18 failures are documented but not on a timeline.
P2 because it is process/documentation, not a runtime gate by itself.

**Independent Test**: Open `docs/test-burndown.md`; confirm every failing test
is listed with a disposition and a target.

**Acceptance Scenarios**:

1. **Given** the burn-down doc, **When** reviewed, **Then** all 18 failures appear with FIX/QUARANTINE and an owner/date.
2. **Given** a new test failure, **When** CI runs, **Then** the failure-count gate flags the increase.

---

### Edge Cases

- A staged file that is deleted (not modified) must not break `lint-staged`.
- ESLint must not crash on `.tsx`, `.py`, or generated files — non-TS files are out of scope for lint.
- The drift suite must exclude test files themselves (they legitimately mention forbidden strings).
- Comments mentioning `Math.random()` ("no Math.random() here") must NOT be flagged — only real calls.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST run `tsc --noEmit` and lint staged TS files in a pre-commit hook, blocking the commit on failure.
- **FR-002**: System MUST provide a `tests/constitution.test.ts` suite that fails on forbidden patterns (Principles I and VI).
- **FR-003**: System MUST provide ESLint flat config + Prettier config; the config MUST be warn-heavy (error only on real bugs) to avoid thousands of errors on the existing codebase.
- **FR-004**: System MUST apply a one-time Prettier format pass as a separate, reviewable commit that does NOT change runtime behavior.
- **FR-005**: CI MUST run an explicit `tsc --noEmit` step (blocking) and an ESLint step (`continue-on-error: true` initially).
- **FR-006**: System MUST document the 18 known failures in `docs/test-burndown.md` with FIX/QUARANTINE disposition.
- **FR-007**: System MUST update the "missing" table in `.specify/memory/dev-harness-audit.md` to reflect closed gaps.
- **FR-008**: Any real constitution violation found MUST be reported and, if benign, placed on a visible allowlist with a `// constitution-allowlist:` reason.

### Key Entities

- **Constitution drift suite**: a vitest file scanning `src/**` and `scripts/**` for forbidden substrings.
- **Allowlist**: an explicit, commented array of known-accepted violations inside the drift suite.
- **Burn-down doc**: a markdown table of the 18 known failures.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A commit with a TypeScript error is rejected locally 100% of the time.
- **SC-002**: `npx vitest run tests/constitution.test.ts` passes on the current tree and would fail on a newly-introduced violation.
- **SC-003**: `npx eslint .` runs to completion with zero crashes (warnings allowed).
- **SC-004**: The Prettier format pass leaves the vitest pass/fail count unchanged (baseline 1471 pass / 18 fail).
- **SC-005**: `npx tsc --noEmit` remains clean after the format pass.
- **SC-006**: `docs/test-burndown.md` accounts for all 18 known failures.

## Constitution Alignment Checklist

- **Principle I (Deterministic)**: Drift suite enforces no `Math.random()` in `src/**`. ✓
- **Principle VI (Indian Voice + Avatar)**: Drift suite enforces no `en-US-` voices and no `KumarGaurav.jpg` in compositions. ✓
- **Principle IX (Secret Hygiene)**: Pre-commit hook is a second local gate alongside Push Protection. ✓
- **Principle X (Branch + FF Merge)**: Feature delivered on `008-harden-dev-harness`, merged fast-forward to `main`. ✓
- This feature does not amend any principle; only the audit doc's status table changes.

## Non-Goals

- Hand-fixing the hundreds of ESLint warnings the new config will surface (config is warn-heavy by design).
- Changing composition or render behavior — the format pass is whitespace-only.
- Adding a coverage threshold gate or a render smoke test (separate audit gaps, future features).
- Flipping the CI ESLint step to blocking (documented as a follow-up).

## Assumptions

- vitest 4.1.5 is already present and the baseline is 1471 pass / 18 fail.
- The codebase already uses seeded noise (`src/lib/seed.ts`) so `Math.random()` should appear only in comments.
- `en-US-` voice identifiers may genuinely exist in non-composition TTS/utility scripts; these are allowlisted with reasons rather than rewritten in this feature.
- Merge to `main` is fast-forward and pushed (the user follows a GitHub-on-main workflow).
