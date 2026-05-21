# Implementation Plan: Niche-Down to Kafka + Auto LinkedIn Cross-Post

**Branch**: `002-niche-down-kafka` | **Date**: 2026-05-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-niche-down-kafka/spec.md`

---

## Summary

Two surgical changes to the daily-shorts pipeline:

1. **Filter `getDailyQuiz()`** to a single topic for a fixed window (env-overridable, CLI-overridable, auto-expiring 2026-06-20).
2. **Add `scripts/cross-post-linkedin.ts`** that runs after each YouTube upload in `auto-shorts.yml`, publishes a text-first LinkedIn post, then comments the YouTube URL on its own post, with a per-videoId dedup file gate.

No new dependencies. No new render path. No new composition. Reuses `axios` (already in package.json) and the operator-OAuth pattern from `scripts/lib/youtube-oauth.ts`.

---

## Technical Context

**Language/Version**: TypeScript 5.5, Node 20 (matches existing pipeline).

**Primary Dependencies**: `axios` (HTTP), `fs`/`path` (dedup file IO), `vitest` (TDD). No new packages.

**Storage**: Filesystem — `data/linkedin-posted/<videoId>.json` for dedup records; existing `data/variants/<videoId>.json` is unrelated and untouched.

**Testing**: vitest (`npm test`). New test files: `src/lib/__tests__/quiz-content.test.ts`, `scripts/__tests__/cross-post-linkedin.test.ts`. Network calls are not unit-tested (test only the body-builder and dedup logic).

**Target Platform**: GitHub Actions runner (`ubuntu-latest`) + local Mac dev.

**Project Type**: Single Node project (existing).

**Performance Goals**: Cross-post step adds approximately 2 seconds per upload (one POST + one POST). Workflow stays well under its 70-minute budget.

**Constraints**: Determinism (Constitution I); offline-first except `api.linkedin.com` (Constitution II); no Math.random; no new pre-existing test failures.

**Scale/Scope**: 2 uploads per cron run, 3 cron runs per week = approximately 24 LinkedIn posts in the first 30 days. Well under LinkedIn's 100/day per-user limit.

---

## Architecture

```
auto-shorts.yml (cron Mon/Wed/Fri 1:15 PM IST)
  │
  ├─ Render Quiz Short 1 ──→ Render Quiz Short 2
  │     │                          │
  │     ▼                          ▼
  │  output/daily-short/*.mp4   (uses getDailyQuiz with topic lock)
  │
  ├─ Upload Short 1 variants ──→ Upload Short 2 variants
  │     │ (existing YouTube OAuth flow)
  │     ▼
  │  videoId emitted to data/variants/<id>.json
  │
  ├─ [NEW] Cross-post Short 1 variants to LinkedIn   ← continue-on-error: true
  ├─ [NEW] Cross-post Short 2 variants to LinkedIn   ← continue-on-error: true
  │     │
  │     │  scripts/cross-post-linkedin.ts
  │     │   1. read --video-id, --title, --quote
  │     │   2. check data/linkedin-posted/<videoId>.json → skip if exists
  │     │   3. assert body has no https:// (FR-007)
  │     │   4. POST /v2/ugcPosts  → ugcPostUrn
  │     │   5. POST /v2/socialActions/{urn}/comments  → commentUrn
  │     │   6. write data/linkedin-posted/<videoId>.json
  │     ▼
  │  scripts/lib/linkedin-oauth.ts  (env-var only; mirrors youtube-oauth.ts)
  │
  └─ Commit variant + linkedin-posted records ──→ Distribute (existing)
```

Inside `quiz-content.ts`:

```
QUIZ_BANK (full)
  └─ getDailyQuiz(date, topicFilter?)
        │
        ├─ resolve filter: topicFilter ?? envQuizTopicLock(date)
        ├─ envQuizTopicLock(date):
        │     QUIZ_TOPIC_LOCK === 'off' → undefined
        │     QUIZ_TOPIC_LOCK set       → use it
        │     date ≤ LOCK_EXPIRES       → 'kafka'   (default lock)
        │     date > LOCK_EXPIRES       → undefined
        │
        └─ candidate pool: filter ? QUIZ_BANK.filter(q => q.topic === filter) : QUIZ_BANK
              return pool[dayOfYear % pool.length]
```

---

## File Structure

| Path | Change | Purpose |
|------|--------|---------|
| `src/lib/quiz-content.ts` | MODIFY | Add `LOCK_EXPIRES`, extend `getDailyQuiz` signature, add `resolveTopicLock` helper |
| `src/lib/__tests__/quiz-content.test.ts` | CREATE | TDD: lock active / expired / env override / CLI semantics |
| `scripts/lib/linkedin-oauth.ts` | CREATE | Env-driven OAuth client (mirrors `youtube-oauth.ts`) |
| `scripts/cross-post-linkedin.ts` | CREATE | CLI: post + comment + dedup |
| `scripts/__tests__/cross-post-linkedin.test.ts` | CREATE | TDD: body builder + dedup gate |
| `scripts/render-daily-short.ts` | MODIFY | Accept `--topic <slug>` flag, plumb into `getDailyQuiz` |
| `.github/workflows/auto-shorts.yml` | MODIFY | Add LinkedIn secrets env, add 2 cross-post steps + commit-records update |
| `data/linkedin-posted/.gitkeep` | CREATE | Reserve directory in git |
| `docs/linkedin-setup.md` | CREATE | Operator setup guide |

---

## Constitution Pre-Check

| Principle | Status | Note |
|-----------|--------|------|
| I. Deterministic Everything | PASS | Post text is `f(title, twist, videoId)`; no random; no LLM. |
| II. All-Local, Offline-First | PASS | Only new egress: `api.linkedin.com`. Mirrors YouTube exception class. |
| III. Automation Over Manual | PASS | Cron-driven; one-time OAuth setup is operator install. |
| IV. Measure Before Optimize | PASS | SC-004 ties to 2026-06-25 audit. |
| V. Subtraction Before Addition | PASS | Removing 11 of 12 topics; adding 1 script. |
| VI. Indian Voice + AI Avatar | N/A | Not touched. |
| VII. Render-Preview | N/A | No render changes. |
| VIII. Single-Path Pipelines | NOTE | `daily-short.yml` exists in parallel to `auto-shorts.yml`. v1 wires cross-post only into `auto-shorts.yml`; deprecation of `daily-short.yml` is tracked as separate work (out-of-scope here, but flagged). |
| IX. Secret Hygiene | PASS | Env-only secrets; dedup files store URNs only, never tokens. |
| X. Branch-Per-Feature | PASS | On `002-niche-down-kafka`. |

No violations requiring justification in Complexity Tracking.

---

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Cross-post to Twitter/X simultaneously | 280-char limit forces a different body template; defer until LinkedIn baseline is measured. Also a separate OAuth flow. |
| Cross-post to Reddit | Reddit shadow-bans new accounts that post their own links; needs karma we don't have. Defer. |
| Put YouTube URL in LinkedIn post body | Materially worse reach per LinkedIn algo guidance and operator's prior testing. The whole point is link-in-first-comment. |
| Store dedup state in `data/variants/*.json` (extend existing file) | Couples two concerns. Variant-records are part of the A/B feature; LinkedIn records should not pollute that schema. Separate dir is cleaner and easier to gitignore later if needed. |
| Lock by branch-name or env var instead of date constant | Date constant is greppable and obviously expires. Env-only would be invisible to a future Claude session re-reading code. We keep BOTH: the env wins, the date is the default. |
| LLM-driven post body | Violates Constitution I. Also makes posts non-reproducible and harder to audit for the `https://` guard. |
| Refresh-token rotation in v1 | LinkedIn refresh tokens require an additional 401 retry loop. Out-of-scope; operator re-auths quarterly per documented checklist. |

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| LinkedIn access token expires (60-day default) → silent failure | Medium | `continue-on-error: true` keeps YouTube pipeline green; script logs `401 → re-auth required`; operator checklist reminds quarterly. |
| LinkedIn rate limit hit | Low | 2 posts/day vs 100/day limit. Not a practical concern. |
| LinkedIn policy change re self-comment-link tactic | Low | Pattern is widespread and recommended by LinkedIn creators; if changed, swap to in-body URL with a single line of code in `linkedinPostBody.ts`. |
| Kafka quiz repetition over 30-day window | Low | 12 quizzes wrap modulo. Acceptable for v1; expansion is a content task, not a code task. |
| Operator misconfigures `LINKEDIN_USER_URN` (forgets the `urn:li:person:` prefix) | Medium | `linkedin-oauth.ts` validates the URN format on load; fail-fast with explicit message. |
| `data/linkedin-posted/` not committed → dedup useless across runs | High if not addressed | Workflow commits this directory in the same step as variant records (FR-012). |

---

## Operator Setup Steps (one-time)

These steps MUST be completed before the workflow's first run after merge. Detailed walkthrough lives in `docs/linkedin-setup.md` (task T8).

1. Create a LinkedIn Developer App at `https://www.linkedin.com/developers/apps` → New app → fill in operator's company / personal name.
2. In the new app's Auth tab, add OAuth 2.0 redirect URL `http://localhost:3000/callback` (only used during one-time auth).
3. In the Products tab, request access to **Share on LinkedIn** (this grants the `w_member_social` scope; usually instant approval).
4. Copy the Client ID and Client Secret.
5. Run an operator-side OAuth flow once (manual curl or a tiny helper script — documented in `docs/linkedin-setup.md`) to obtain a 60-day access token. Capture it.
6. With the access token, call `GET https://api.linkedin.com/v2/me` to obtain the operator's URN. It looks like `urn:li:person:XXXXXXXX`.
7. Add four GitHub Secrets to the repo:
   - `LINKEDIN_CLIENT_ID`
   - `LINKEDIN_CLIENT_SECRET`
   - `LINKEDIN_ACCESS_TOKEN`
   - `LINKEDIN_USER_URN` (full `urn:li:person:XXXXX` string)
8. Re-run `auto-shorts.yml` via workflow_dispatch with `dry_run: false` to verify end-to-end.
9. Add a calendar reminder for `2026-07-20` to re-auth (token expiry is 60 days from issue).

---

## Project Structure

### Documentation (this feature)

```text
specs/002-niche-down-kafka/
├── spec.md   (Phase 1)
├── plan.md   (this file, Phase 2)
└── tasks.md  (Phase 3)
```

### Source Code (repository root)

```text
src/
└── lib/
    ├── quiz-content.ts                 # MODIFY: add topic lock
    └── __tests__/
        └── quiz-content.test.ts        # CREATE: TDD for lock

scripts/
├── render-daily-short.ts               # MODIFY: --topic flag
├── cross-post-linkedin.ts              # CREATE: post + comment + dedup
├── lib/
│   ├── youtube-oauth.ts                # unchanged, reference pattern
│   └── linkedin-oauth.ts               # CREATE
└── __tests__/
    └── cross-post-linkedin.test.ts     # CREATE

data/
└── linkedin-posted/
    └── .gitkeep                        # CREATE

docs/
└── linkedin-setup.md                   # CREATE

.github/workflows/
└── auto-shorts.yml                     # MODIFY: env + 2 cross-post steps
```

**Structure Decision**: Single project (existing). New files live alongside existing peers (test files under `__tests__/`, OAuth helpers under `scripts/lib/`).

---

## Complexity Tracking

No violations; section intentionally empty.
