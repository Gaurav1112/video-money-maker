# Tasks: Harden Dev Harness

**Input**: Design documents from `/specs/008-harden-dev-harness/`

**Prerequisites**: plan.md, spec.md

**Organization**: Each task is one or more commits. T4 and T6 are highest-risk.

## Format: `[ID] [Story] Description`

---

### T1 [US3] Add dev dependencies

Run `npm install -D husky lint-staged eslint @typescript-eslint/parser
@typescript-eslint/eslint-plugin prettier eslint-config-prettier @eslint/js
typescript-eslint`. Commit `package.json` + `package-lock.json`.

**Done when**: devDeps present in `package.json`, lockfile updated, committed.

---

### T2 [US3] ESLint flat config

Create `eslint.config.js` — flat config, TypeScript-aware, warn-heavy.
`error` only on: `no-debugger`, `no-dupe-keys`, `no-unreachable`. Everything
stylistic deferred to Prettier (`eslint-config-prettier` last). Run
`npx eslint . --max-warnings=99999` to confirm it parses without crashing.

**Done when**: `eslint.config.js` committed; `npx eslint .` completes (warnings OK, no crash).

---

### T3 [US3] Prettier config

Create `.prettierrc.json` (2-space, single quotes, trailing comma es5, print
width 100) and `.prettierignore` (node_modules, output, public, tools,
.specify, dist).

**Done when**: both files committed.

---

### T4 [US2] Constitution drift suite (TDD)

Create `tests/constitution.test.ts`. Three test groups using `fs` recursive
readdir + regex:
1. No real `Math.random()` call in `src/**` (strip comments first; exclude test files).
2. No `en-US-` substring in `src/**` / `scripts/**` non-test files.
3. No `KumarGaurav.jpg` / `guru-avatar-large.jpg` in `src/compositions/**`.

Write tests first; run them. If real violations exist, report them and add a
visible `ALLOWLIST` array with a `reason` per entry — do not silently pass.

**Done when**: `npx vitest run tests/constitution.test.ts` passes; allowlist visible + commented; committed.

---

### T5 [US1] Husky pre-commit hook + lint-staged

Create `.husky/pre-commit` running `npx lint-staged` then `npx tsc --noEmit`.
Add to `package.json`: `lint-staged` block (`*.{ts,tsx}` → `eslint --fix` +
`prettier --write`), and `lint`/`format`/`prepare` scripts (`prepare: husky`).

**Done when**: hook executable, `lint-staged` block + scripts committed.

---

### T6 [US3] One-time Prettier format pass

Run `npx prettier --write` over `src/` and `scripts/`. SEPARATE commit.
CRITICAL: after formatting, run `npx tsc --noEmit` (must be clean) and
`npx vitest run` (pass/fail count must equal 1471/18 baseline). If the count
changes, STOP and report.

**Done when**: format-only commit landed; tsc clean; vitest count unchanged.

---

### T7 [US3] CI gates in test.yml

Edit `.github/workflows/test.yml`: add an explicit `tsc --noEmit` step
(blocking) and an ESLint step (`continue-on-error: true`) to the `unit` job,
with a comment noting the intent to flip eslint to blocking later.

**Done when**: `test.yml` updated and committed.

---

### T8 [US4] Burn-down doc + audit update

Run `npx vitest run 2>&1 | grep FAIL` to enumerate the 18 known failures.
Create `docs/test-burndown.md` classifying each FIX or QUARANTINE with a
target. Update the "missing" table in `.specify/memory/dev-harness-audit.md`
— mark pre-commit, eslint/prettier, tsc-gate, and drift-test as DONE.

**Done when**: both files committed.

---

### T9 [US1] Merge + push

Verify `npx tsc --noEmit` clean. Merge `008-harden-dev-harness` to `main`
fast-forward only, push, delete the feature branch.

**Done when**: `main` contains all commits, pushed, branch deleted.

---

## Dependency graph

```
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9
```

T1 must precede all (deps). T6 must follow T2/T3/T5 (prettier installed +
configured). T9 is last.
