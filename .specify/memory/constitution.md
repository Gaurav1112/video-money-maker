# Video Pipeline Constitution

> Distilled from `CLAUDE.md` + the user-memory feedback files in
> `~/.claude/projects/-Users-racit-PersonalProject-video-pipeline/memory/`.
> Every `/speckit-specify`, `/speckit-plan`, and `/speckit-implement`
> step must respect these principles.

## Core Principles

### I. Deterministic Everything (NON-NEGOTIABLE)
All animations, content generation, metadata, thumbnails, and rendering MUST be deterministic.
Same input → same output, always. Seeded noise via `noisejs` only; **never `Math.random()`**.
No LLM calls at runtime — `feedback_deterministic_no_llm` is binding.
Why: the pipeline is intended to run autonomously for years across 1,080+ sessions; any randomness or LLM dependency makes failures non-reproducible.

### II. All-Local, Offline-First
Every tool MUST run 100% offline after initial install. The only network egress allowed in the rendering path is the YouTube upload OAuth flow at the end. No data sent to any third-party server for content generation. Safe for an office laptop running 24/7.

### III. Automation Over Manual Intervention
Every pipeline MUST run end-to-end without human-in-the-loop. Render, upload, distribute (Instagram/TikTok/LinkedIn/Twitter/Reddit), and ingest analytics — all autonomous via GitHub Actions cron.
**Manual voice recording is forbidden** (`feedback_fully_automated`).

### IV. Measure Before You Optimize
No "viral optimization" change ships unless an analytics feedback loop is in place that can measure its effect within 7 days. Decisions about what to ship next are driven by `data/analytics/<videoId>.json` (completion %, AVD, comments-per-1k), not intuition.
The default success metric for Shorts is **median completion rate ≥ 70% over the next 10 uploads**.

### V. Subtraction Before Addition
When improving a video format, the default move is to DELETE underperforming elements (clutter, dead air, broken layout) before ADDING new ones. Reviewer agents and code-quality checks should flag "additive thinking" as a red flag. Famous tech YouTube hooks show ONE thing — we have a recurring tendency to layer six overlays.

### VI. Indian Voice + AI Avatar (Brand Constraints)
TTS MUST use `en-IN-PrabhatNeural` (Edge TTS, primary) or `af_heart` (Kokoro, fallback) — **never American English defaults** (`feedback_voice_avatar`).
The on-screen avatar MUST be `public/images/guru-avatar-crop.png`. The raw photo `KumarGaurav.jpg` may exist as a source for avatar generation but MUST NEVER be rendered into a video (`feedback_avatar`).

### VII. Render-Preview-Before-Render-Full
For long-form (8-12 min) videos, run a 30s preview with `npx remotion render ... --frames=150-1050` before committing to a full ~20 min render. CLAUDE.md rule #3 makes this mandatory because composition bugs surface in seconds and a wrong full render is a 20-minute mistake.

### VIII. Single-Path Pipelines
One pipeline per output format. When two parallel implementations exist (e.g., QuizShort + ViralShort, or auto-shorts.yml + daily-short.yml), one MUST have an explicit deprecation plan within the same iteration that introduces the divergence. Lesson learned 2026-05-20: local QuizShort work + origin ViralShort drift cost half a day of reconciliation.

### IX. Secret Hygiene
Never commit OAuth credentials, API keys, refresh tokens, or `.env` files. Use environment variables at runtime (loaded from GitHub Secrets in CI, from local `.env` for dev). GitHub Push Protection is enforced and MUST NOT be bypassed via "allow secret" URLs. If a secret leaks into history, scrub via `git filter-branch` AND rotate the credential in its issuing service.

### X. Branch-Per-Feature + Fast-Forward Merges
All non-trivial work happens on a feature branch in `.claude/worktrees/<name>/` via the `using-git-worktrees` skill. Merge to `main` is fast-forward only. Push triggers CI; CI failures are NOT silently ignored — either fix the test or document the failure here as an accepted-known-issue.

## Currently Accepted Known Issues

None. All tests pass as of 2026-05-26.

Previous deferred failures resolved:
- `tests/shorts-format.test.ts` — fixed (FPS constant + calculateViralShortMetadata)
- `tests/workflow-security.test.ts` — fixed (concurrency blocks + pinned action SHAs)
- `src/pipeline/__tests__/shorts-generator.test.ts` — fixed (title max 55, clamp 120, resolveShortNumber algorithm)
- `tests/retention-proxy.test.ts` — fixed (expectedScoreRange monotonicity, CTA buyback ordering)
- `tests/retention-engine.test.ts` — fixed (CTA buyback inserted after shifted CTA segment)

## Governance

- This constitution supersedes ad-hoc preferences. Conflicting code should be flagged and either fixed or this constitution amended.
- Amendments require a commit on `main` that updates this file alongside the implementation that changes the principle.
- The constitution is referenced by every `/speckit-*` command via `.specify/memory/constitution.md`.

**Version:** 1.0.0 | **Established:** 2026-05-21 | **Last Amended:** 2026-05-26
