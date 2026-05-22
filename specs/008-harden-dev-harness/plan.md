# Implementation Plan: Harden Dev Harness

**Branch**: `008-harden-dev-harness` | **Date**: 2026-05-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-harden-dev-harness/spec.md`

## Summary

Make the constitution machine-enforced: add a pre-commit hook (type-check +
lint staged files), a constitution-drift test suite, ESLint + Prettier with a
one-time format pass, CI gates, and a documented burn-down plan for the 18
known-failing tests. No runtime/render behavior changes.

## Technical Context

**Language/Version**: TypeScript 5.5, Node 20, React 18.3 (Remotion 4.0.457)

**Primary Dependencies (new devDeps)**: `husky`, `lint-staged`, `eslint`,
`@eslint/js`, `typescript-eslint`, `@typescript-eslint/parser`,
`@typescript-eslint/eslint-plugin`, `prettier`, `eslint-config-prettier`

**Testing**: vitest 4.1.5 (already present); baseline 1471 pass / 18 fail

**Target Platform**: local dev (macOS) + GitHub Actions CI (ubuntu-latest)

**Project Type**: single project — `src/`, `scripts/`, `tests/` at root

**Constraints**: warn-heavy lint config (existing 100+-file codebase — must not
produce thousands of errors); format pass must not change behavior

**Scale/Scope**: ~100+ TS/TSX source files, 61 test files

## Constitution Check

- **I. Deterministic**: drift suite enforces it; this feature adds no runtime randomness. ✓
- **II. All-Local**: husky/eslint/prettier all run offline; devDeps only. ✓
- **VI. Indian Voice + Avatar**: drift suite codifies the brand constraints. ✓
- **X. Branch-per-feature + FF merge**: delivered on `008-harden-dev-harness`. ✓
- No principle is amended; only the audit status table changes. ✓

## Technical Approach

### Files created / changed

| File | Change |
|---|---|
| `.husky/pre-commit` | NEW — runs `npx lint-staged` then `npx tsc --noEmit` |
| `package.json` | add `lint-staged` block, `lint`/`format`/`prepare` scripts, devDeps |
| `eslint.config.js` | NEW — flat config, TS-aware, warn-heavy |
| `.prettierrc.json` | NEW — 2-space, single quotes, trailing comma es5, width 100 |
| `.prettierignore` | NEW — ignore node_modules, output, public, tools, .specify, dist |
| `tests/constitution.test.ts` | NEW — drift suite (3 groups) |
| `.github/workflows/test.yml` | add explicit `tsc --noEmit` step + eslint step (`continue-on-error`) |
| `.specify/memory/dev-harness-audit.md` | mark closed gaps DONE |
| `docs/test-burndown.md` | NEW — 18-failure burn-down plan |

### ESLint config strategy

Flat config (`eslint.config.js`). Extends `@eslint/js` recommended +
`typescript-eslint` recommended, then `eslint-config-prettier` to disable
stylistic rules. Override block downgrades to `warn`: `no-unused-vars`,
`no-explicit-any`, etc. Only three rules stay `error`: `no-debugger`,
`no-dupe-keys`, `no-unreachable` — real bugs, not style. Stylistic concerns
are owned entirely by Prettier.

### Drift suite strategy

`tests/constitution.test.ts` uses `fs` recursive readdir + regex:
- Group 1: real `Math.random()` calls in `src/**` (strip `//` and `/* */`
  comments before matching; exclude `__tests__` / `*.test.ts`).
- Group 2: `en-US-` substring in `src/**` + `scripts/**` non-test files.
- Group 3: `KumarGaurav.jpg` / `guru-avatar-large.jpg` in `src/compositions/**`.
A visible `ALLOWLIST` array holds known-accepted violations, each with a
`reason`. The suite asserts `violations ⊆ allowlist`.

### CI strategy

Add to the existing `unit` job a dedicated `tsc --noEmit` step (the job
already runs `npm run typecheck`, so add a clearly-labelled lint step). New
`lint` step uses `continue-on-error: true` so day-1 CI is not broken; a
comment documents the intent to flip to blocking once warnings are burned down.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| ESLint surfaces hundreds of issues on the existing codebase | Config is warn-heavy; only 3 error rules. Warnings do not fail anything. |
| Prettier format pass changes behavior | Pass is whitespace-only; verify `tsc --noEmit` clean + vitest count unchanged (1471/18) after. SEPARATE commit for reviewability. |
| Real constitution violations found by drift suite | Report every one; allowlist only with explicit `// constitution-allowlist:` reason. `en-US-` voices in TTS scripts are expected and will be allowlisted. |
| Pre-commit hook slows commits | `tsc --noEmit` is ~seconds; acceptable. lint-staged only touches staged files. |

## Sequencing

T1 (deps) → T2 (eslint) → T3 (prettier) → T4 (drift suite, TDD) → T5 (husky) →
T6 (format pass, separate commit) → T7 (CI) → T8 (burn-down + audit) →
T9 (merge + push). T4 and T6 are the riskiest.
