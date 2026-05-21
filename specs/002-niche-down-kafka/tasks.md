# Tasks: Niche-Down to Kafka + Auto LinkedIn Cross-Post

**Input**: [spec.md](./spec.md), [plan.md](./plan.md)

**Branch**: `002-niche-down-kafka`

**Tests**: TDD required for T1 and T4 (logic-heavy). T2, T3, T5, T6, T7, T8 are config / glue / docs.

---

## Phase 1: Setup

No new dependencies. `axios` and `vitest` already installed. Skip language/framework init.

---

## Phase 2: Foundational

None. Each user story below can be implemented independently of the others; no shared infrastructure is created in this feature.

---

## Phase 3: User Story 1 — Niche-down quiz selection (P1) — MVP

**Goal**: `getDailyQuiz()` returns Kafka quizzes between today and 2026-06-20 unless overridden.

**Independent Test**: Run `npm test -- quiz-content` — all new specs green; manually run `npx tsx scripts/render-daily-short.ts` and confirm rendered prop quiz has `topic === 'kafka'`.

### T1 [US1] Extend `getDailyQuiz()` with topic lock (TDD)

**Files**: `src/lib/__tests__/quiz-content.test.ts` (new), `src/lib/quiz-content.ts` (modify).

Sub-steps:

1. Write failing tests covering:
   - default lock active: date `2026-05-25`, no env, returns `topic === 'kafka'`.
   - lock expired: date `2026-06-25`, no env, returns whatever the unfiltered rotation gives (Kafka still possible — assert just that the function does NOT throw and returns a valid quiz).
   - explicit env: `QUIZ_TOPIC_LOCK=redis` → `topic === 'redis'`.
   - env disable: `QUIZ_TOPIC_LOCK=off` → unfiltered (same behavior as expired).
   - explicit param wins over env: `getDailyQuiz(date, 'database')` → `topic === 'database'` even when env says redis.
   - unknown topic: `getDailyQuiz(date, 'nosuchtopic')` falls back to unfiltered (do not crash).
2. Add `LOCK_EXPIRES = new Date('2026-06-20T23:59:59Z')` constant.
3. Add `resolveTopicLock(date, envValue)` helper.
4. Change `getDailyQuiz` signature to `getDailyQuiz(date: Date = new Date(), topicFilter?: string)`.
5. Re-run tests until green.
6. Commit.

### T2 [US1] Add `--topic <slug>` CLI flag to `render-daily-short.ts`

**Files**: `scripts/render-daily-short.ts`.

Parse `--topic` from argv; pass into `getDailyQuiz(date, topic)`. Log the resolved topic at start. Commit.

**Checkpoint**: US1 deliverable. Channel-wide niche-down is live.

---

## Phase 4: User Story 2 — Auto LinkedIn cross-post (P1)

**Goal**: After each YouTube upload, a text-first LinkedIn post is published with the link in the first comment.

**Independent Test**: Local smoke — set placeholder LinkedIn env vars to dummy strings, run `npx tsx scripts/cross-post-linkedin.ts --video-id smoketest --title "x" --quote "y"`. Expect fail-fast "401" or "URN format invalid" — NOT a crash.

### T3 [US2] Create `scripts/lib/linkedin-oauth.ts`

**Files**: `scripts/lib/linkedin-oauth.ts` (new).

Export `getLinkedInClient(): { accessToken: string, userUrn: string, axios: AxiosInstance }`. Pull from env. Validate `userUrn` matches `^urn:li:person:[A-Za-z0-9_-]+$`. Fail-fast with explicit messages if any of the 4 env vars missing. Configure axios baseURL `https://api.linkedin.com`, Authorization header, and the two required LinkedIn-Version / X-Restli-Protocol headers.

Commit.

### T4 [US2] Create `scripts/cross-post-linkedin.ts` + tests (TDD)

**Files**: `scripts/__tests__/cross-post-linkedin.test.ts` (new), `scripts/cross-post-linkedin.ts` (new).

Sub-steps:

1. Write failing tests covering the pure helpers (extracted from the script for testability):
   - `buildPostBody({title, twist})` returns the templated string AND contains no `https://`.
   - `buildPostBody` returns the same output for the same input (determinism).
   - `buildCommentBody({videoId})` contains `https://youtu.be/<videoId>` and the CTA.
   - `dedupRecordPath(videoId)` resolves under `data/linkedin-posted/`.
   - `isAlreadyPosted(videoId, fsMock)` returns true when record file exists, false otherwise.
   - `assertNoUrlInBody(body)` throws on `https://`, accepts plain text.
2. Implement the helpers in `cross-post-linkedin.ts` so tests pass.
3. Implement the CLI main(): parse argv, check dedup, build body, assert no URL, post, comment, write record. Network calls live in main(); helpers stay pure for test purposes.
4. Commit.

Template (deterministic, per plan.md):

```
{title}

The 90-second answer most engineers get wrong:

{twist}

Watch the full breakdown 👇 (link in first comment)

#kafka #systemdesign #faanginterview #indiantech
```

Comment body: `Full breakdown: https://youtu.be/{videoId} — what would you have answered?`

### T5 [US2] Wire cross-post into `auto-shorts.yml`

**Files**: `.github/workflows/auto-shorts.yml`.

Sub-steps:

1. Add to job-level `env:`: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_USER_URN` (all from `secrets.*`).
2. After each "Upload Short N variants" step, add a "Cross-post Short N variants to LinkedIn" step with `continue-on-error: true` that iterates the same `BASE` variants and calls `npx tsx scripts/cross-post-linkedin.ts --video-id <id> --title "$TITLE" --quote "$QUOTE"`. Pull title + twist from `output/daily-short-$ID.json` props.
3. Update the existing "Commit variant records" step to also `git add data/linkedin-posted/*.json`.
4. Commit.

**Checkpoint**: US2 deliverable. Distribution flywheel is live (pending operator secrets).

### T6 [US2] Create `data/linkedin-posted/.gitkeep`

**Files**: `data/linkedin-posted/.gitkeep` (new).

Commit.

---

## Phase 5: User Story 3 — Per-post deduplication (P2)

Already covered by T4 (the test for `isAlreadyPosted` + the CLI main's dedup gate). No additional implementation tasks.

**Checkpoint**: US3 verified by the existing T4 tests + by running the smoke test (T7) twice and observing the second run says "already cross-posted".

---

## Phase 6: Polish

### T7 [POLISH] Smoke test locally with placeholder secrets

Run:

```bash
LINKEDIN_CLIENT_ID=x LINKEDIN_CLIENT_SECRET=y LINKEDIN_ACCESS_TOKEN=z LINKEDIN_USER_URN=urn:li:person:abc \
  npx tsx scripts/cross-post-linkedin.ts --video-id smoketest --title "Hello" --quote "World"
```

Expect: clean log lines, no stack trace, exits with the LinkedIn 401 error code from the API call (since the access token is fake). Verify no `data/linkedin-posted/smoketest.json` was written. Commit (no file changes; just record outcome in PR description).

### T8 [POLISH] Document operator setup

**Files**: `docs/linkedin-setup.md` (new).

Step-by-step (numbered, no screenshots, written as if for a junior operator). Mirror the "Operator Setup Steps" section of plan.md but expand each step with exact UI labels and example curl commands. Commit.

### T9 [DEFER] Merge to main

NOT executed by Claude. Operator reviews the PR; if happy, fast-forward merge.

---

## Dependencies & Execution Order

- T1 → T2 (T2 imports from quiz-content.ts after the signature change).
- T3 → T4 (T4 imports getLinkedInClient).
- T4 → T5 (T5 calls the script).
- T6 independent — anytime.
- T7 after T4.
- T8 anytime after T3 and T4 (can be drafted in parallel; written last for accuracy).

### Parallel Opportunities

- T2 and T3 can run in parallel after T1 completes (T3 has no dependency on T1).
- T6 and T8 can be done at any point.

---

## Implementation Strategy

MVP path: T1 → T2 (US1 fully shipped, channel niches to Kafka on the next cron). Then T3 → T4 → T5 → T6 (US2 + US3 ship together; dedup is folded into T4). Then T7 → T8 (polish + docs). T9 left for operator.

Estimated effort: 90 minutes of focused work plus one operator OAuth session (about 20 minutes).
