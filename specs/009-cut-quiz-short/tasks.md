# Tasks: Cut Quiz Short to ~30s

**Branch**: `009-cut-quiz-short` | **Plan**: `specs/009-cut-quiz-short/plan.md`

- [ ] **T1** — Commit spec.md, plan.md, tasks.md for Feature 009-cut-quiz-short.
- [ ] **T2** — `src/compositions/QuizShort.tsx`: set `DEFAULT_DURATION_S = 30`;
      compress phase boundary constants (HOOK 3s / QUESTION 12s / FLASH 13s /
      ANSWER SPLASH 14s / ANSWER 25s / END CTA 5s); remove the `CodeSnippetPanel`,
      `ExplanationBeats`, and `WorkedExample` imports + renders; replace the
      explain phase with a single one-sentence answer beat (keep brief stat
      counter + captions).
- [ ] **T3** — `scripts/render-daily-short.ts`: revert narration assembly to
      `spokenHook + question + one-sentence-answer + endQuestion`; drop
      `deriveSpokenCode` / `deriveSpokenExample` / key-insight repeat / bridge
      sentences; default audio duration floor 30s.
- [ ] **T4** — `calculateQuizShortMetadata`: floor at ~30s (uses the new
      `DEFAULT_DURATION_S`).
- [ ] **T5** — Smoke render `--short 0`; verify `ffprobe` duration 28-34s, audio ≈
      video; extract frames at 1s/8s/15s/27s; run `tsc` + `vitest`.
- [ ] **T6** — Commit, merge `009-cut-quiz-short` into `main` (`--ff-only`), push.
