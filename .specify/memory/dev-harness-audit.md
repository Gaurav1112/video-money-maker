# Dev Harness Audit — 2026-05-21

Snapshot of the development harness as it stands when spec-kit was initialized.

## Present and working ✓

| Component | Status | Where |
|---|---|---|
| **Test runner** | ✓ vitest 4.1.5 with `test`, `test:watch`, `test:ui`, `test:coverage`, `test:manifest`, `test:retention`, `test:integrity`, `test:publishing`, `test:format` scripts | `package.json` |
| **Type checker** | ✓ `tsc --noEmit` runs cleanly on production code (test files have pre-existing `@types/jest` gap) | `tsconfig.json` |
| **CI test gate** | ✓ `.github/workflows/test.yml` runs vitest per layer matrix on every push | |
| **CI security audit** | ✓ `.github/workflows/security-audit.yml` runs `tests/workflow-security.test.ts` | |
| **Secret scanning** | ✓ GitHub Push Protection enforced (caught the OAuth-in-doc leak on 2026-05-20) | |
| **Worktree discipline** | ✓ Native `EnterWorktree`/`ExitWorktree` tools wired; fallback to `git worktree add` for tools that conflict | `.claude/worktrees/` |
| **Memory / constitution / specs** | ✓ Triple stack: `.specify/memory/` (spec-kit), `docs/superpowers/{specs,plans}/` (superpowers), `~/.claude/projects/.../memory/` (auto-memory) | |
| **Render-preview convention** | ✓ Documented: `--frames=150-1050` for long-form previews (CLAUDE.md rule #3) | `scripts/render-pipeline.py` |
| **24 GitHub Actions workflows** | ✓ Auto-shorts, daily-short, analytics, inventory, cleanup, batch-render, trend-short, hinglish-track, security-audit, test, etc. | `.github/workflows/` |

## Missing — would harden the harness ❌

| Gap | Risk | Fix | Status |
|---|---|---|---|
| **No pre-commit hooks** | Broken code reaches `main`. Today's session caught the secrets-in-doc leak only because GitHub Push Protection caught it server-side. | Add `husky` + `lint-staged`: pre-commit runs `tsc --noEmit` on staged TS + `vitest related` on touched files + `git secrets`-style local scan. | ✅ **DONE** (F008) — `.husky/pre-commit` runs `lint-staged` (eslint --fix + prettier --write on staged `*.ts/*.tsx`) then `tsc --noEmit -p tsconfig.build.json`. |
| **No ESLint / Prettier** | Style drift across 100+ TS files (different quote styles, trailing-comma inconsistency, semicolon use vary). | Add `eslint` with `@typescript-eslint` + `prettier`; one-time format pass; CI lint gate. | ✅ **DONE** (F008) — `eslint.config.js` (warn-heavy flat config, 0 errors / 588 warnings), `.prettierrc.json`, one-time format pass over `src/`+`scripts/`, non-blocking CI lint step. |
| **Type-check is `noEmit` only** | TS errors in non-test code don't fail CI gate unless `test.yml` happens to import them. | Add explicit `tsc --noEmit` step in `test.yml` (fails build on any new TS error). | ✅ **DONE** (F008) — `test.yml` `unit` job runs `npm run typecheck:build` (blocking) against `tsconfig.build.json` (production code only). |
| **Test failures sitting at 18** | Constitution §X says CI failures must be fixed OR documented; the 18 are documented now but not on a deprecation timeline. | Decide: fix shorts-format, drop shorts-generator, add concurrency to flagged workflows. ETA in §X amendment. | 🟡 **PARTIAL** (F008) — actual count is **25** (estimate was stale). All 25 enumerated with FIX/QUARANTINE dispositions + target dates in `docs/test-burndown.md`. Burn-down execution itself is follow-up work. |
| **No coverage threshold** | vitest has `test:coverage` available but no CI enforcement of minimum %. | Add `--coverage --reporter=text-summary` gate at e.g. 70% lines on new files only. | ❌ Not in F008 scope — future feature. |
| **No render smoke test in CI** | Composition changes can break renders silently (we found out only when a manual render failed). | Add a CI job that runs `npx tsx scripts/render-daily-short.ts --short 0` (or `--dry-run` + a fast smoke render at 1080×540) on every PR touching `src/compositions/`. | ❌ Not in F008 scope — future feature. |
| **No drift check vs constitution** | The constitution lives in `.specify/memory/constitution.md` but nothing enforces it. | Add a lightweight `tests/constitution.test.ts`: forbid `Math.random()` in `src/**`, forbid `en-US-*` voice names, forbid `KumarGaurav.jpg` references in `src/compositions/`. | ✅ **DONE** (F008) — `tests/constitution.test.ts` enforces Principles I + VI. Scan findings: zero real `Math.random()` calls; four `en-US-` files allowlisted with reasons; zero raw-photo avatar refs. |

## Harness layers in this repo (so you know what owns what)

```
┌─ Claude Code CLI ────────────────── the agent runtime (this conversation)
│
├─ Plugins / Skills (loaded on session start)
│   ├─ superpowers — brainstorming, writing-plans, subagent-driven-development,
│   │                executing-plans, verification-before-completion, etc.
│   ├─ spec-kit — speckit-constitution, speckit-specify, speckit-plan,
│   │              speckit-tasks, speckit-implement, speckit-clarify,
│   │              speckit-analyze, speckit-checklist, speckit-git-*
│   ├─ pr-review-toolkit — review-pr, code-reviewer, code-simplifier,
│   │                       comment-analyzer, pr-test-analyzer,
│   │                       silent-failure-hunter, type-design-analyzer
│   └─ Notion, Slack, Datadog, Playwright, etc.
│
├─ Local dev harness
│   ├─ Test: vitest (61 files, 1471 pass, 18 known-fail)
│   ├─ Type: tsc --noEmit (clean on production code)
│   ├─ Render: Remotion 4.0.441 → MP4
│   ├─ TTS: Edge TTS (primary) → Kokoro (fallback) → macOS native
│   └─ Worktrees: .claude/worktrees/<feature>/
│
└─ CI harness (24 workflows on GitHub Actions)
    ├─ Render: auto-shorts.yml, daily-short.yml, batch-render.yml, ...
    ├─ Publish: auto-publish.yml, complete-render-publish.yml, ...
    ├─ Analytics: analytics.yml (daily), channel-inventory.yml (daily)
    ├─ Cleanup: channel-cleanup.yml (manual)
    ├─ Quality: test.yml, security-audit.yml
    └─ Other: pre-render.yml, trend-short.yml, hinglish-track.yml, ...
```

## How spec-kit fits with what we already have

spec-kit's 6 commands map roughly to superpowers skills we've been using:

| spec-kit | superpowers (existing) |
|---|---|
| `/speckit-constitution` | (new — `.specify/memory/constitution.md`) |
| `/speckit-specify` | `brainstorming` (writes spec in `docs/superpowers/specs/`) |
| `/speckit-plan` | `writing-plans` (writes plan in `docs/superpowers/plans/`) |
| `/speckit-tasks` | `subagent-driven-development` task extraction |
| `/speckit-implement` | `subagent-driven-development` execution loop |
| `/speckit-clarify` (optional) | brainstorming clarifying questions |
| `/speckit-analyze` (optional) | `verification-before-completion` |
| `/speckit-checklist` (optional) | requesting-code-review pre-merge gates |

Both can coexist. The advantage of using spec-kit alongside superpowers is the standardized directory layout (`specs/NNN-feature/spec.md|plan.md|tasks.md`) which other agents (Copilot, Gemini, Cursor) understand identically — useful if the project ever switches agents or has multiple contributors using different harnesses.

## Recommended next moves

1. **Use the new `/speckit-*` slash commands** for the next non-trivial feature (e.g., "auto-derive quizzes from `content/*.json` to unlock 108-topic scale"). The CLI will create `specs/001-auto-derive-quizzes/` and a feature branch.
2. **Patch the harness gaps** marked ❌ above — start with pre-commit hooks (highest leverage for catching mistakes early).
3. **Burn down the 18 known-fail tests** — pick a date by which they're either fixed or quarantined.
