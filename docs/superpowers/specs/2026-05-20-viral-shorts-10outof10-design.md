# Viral Shorts 10/10 — Design Spec

**Date:** 2026-05-20
**Author:** Kumar Gaurav (with Claude)
**Status:** Draft → User review pending
**Predecessor plan:** `docs/superpowers/plans/2026-05-18-viral-shorts-pivot.md` (quiz format pivot — substantially shipped)

---

## 1. Goal

Bring the quiz Shorts pipeline to **10/10 viral quality with zero spend** by closing the measurement loop, fixing retention-killing bugs, and adding only the free-leverage features that survive a critical-review pass.

## 2. Success criteria

**Primary metric:** Median completion rate (`avgViewDuration ÷ duration`) **≥ 70%** across the next 10 quiz Shorts, measured via YouTube Analytics API 48h after each upload.

**Secondary metrics (tracked, not optimized):**
- CTR from Shorts shelf ≥ 5%
- Comments per 1k views ≥ 3
- Median absolute views ≥ 3,000 within 7 days

**Stop rule:** If after 10 uploads under this design the median completion is < 60%, the design is wrong — the quiz format itself is the bottleneck, not the polish. Revisit format before iterating fixes.

## 3. Non-goals (explicit out-of-scope)

| Excluded | Reason |
|---|---|
| Hindi localizations | Violates `feedback_deterministic_no_llm` without a manual translation table. Revisit when an automated, no-LLM translation path exists, or when a one-time manual exception is approved. |
| A/B hook variants | Doubles render cost and adds upload-picker logic. Only pursue if Tier 1+2 do not hit 70% completion. |
| Trending CapCut/IG audio | Licensing risk + YouTube Shorts API does not allow arbitrary BGM injection on upload. |
| First-comment auto-post | Requires separate OAuth flow + posting logic. Manual first comment for now; automate in a follow-up. |
| Removing the avatar from hook | Brand requirement per `feedback_voice_avatar`. |
| Lip-syncing the avatar in QuizShort | Memory flags this as desired, but per-quiz SadTalker rendering adds minutes to render time and is a separate initiative. The static avatar stays for v1; lip-sync is a future spec. |
| Inventing additional Short formats | Not the bottleneck. Bottleneck is completion rate of the *existing* quiz format. |

## 4. Architecture

Closed-loop optimization: render → upload → measure → adjust.

```
                       ┌──────────────────┐
                       │  GitHub Actions  │
                       │  cron @1:15 IST  │
                       └────────┬─────────┘
                                ▼
   ┌────────────┐    ┌──────────────────────┐    ┌─────────────┐
   │ quiz-      │───▶│  render-daily-short  │───▶│  upload-    │
   │ content.ts │    │  (audio-driven dur)  │    │  youtube.ts │
   └────────────┘    └──────────┬───────────┘    └──────┬──────┘
                                ▼                       │
                       ┌─────────────────┐              │
                       │  QuizShort.tsx  │              │
                       │  (no end-black, │              │
                       │   captions in   │              │
                       │   explain only) │              │
                       └─────────────────┘              │
                                                        ▼
                                              ┌──────────────────┐
                                              │  YouTube         │
                                              │  Analytics API   │◀──┐
                                              └────────┬─────────┘   │
                                                       ▼             │
                                              ┌──────────────────┐   │
                                              │ data/analytics/  │   │
                                              │ <video_id>.json  │   │
                                              └────────┬─────────┘   │
                                                       ▼             │
                                              ┌──────────────────┐   │
                                              │ weekly-report.ts │   │
                                              │ (retention, CTR, │   │
                                              │  completion)     │───┘
                                              └──────────────────┘
```

The closed loop is the central design difference from prior plans. Without analytics ingestion the pipeline ships blind; with it every fix is falsifiable.

## 5. Components

### 5.1 New components

| Path | Responsibility |
|---|---|
| `scripts/ingest-analytics.ts` | Pull `views`, `avgViewDuration`, `averageViewPercentage`, `likes`, `comments`, retention curve per uploaded Short via YouTube Analytics API. Write to `data/analytics/<videoId>.json`. Deterministic; no LLM. |
| `scripts/weekly-report.ts` | Read `data/analytics/*.json`, emit Markdown summary: median completion, CTR, retention curve, top/bottom Shorts. Identifies regressions. |
| `.github/workflows/analytics.yml` | Daily cron — runs `ingest-analytics.ts` for all uploads in the last 30 days. |
| `scripts/validate-quizzes.ts` | CI gate — fails if any quiz title > 60 chars, `endQuestion` empty, or `options.length ≠ 3`. |
| `src/components/EndCardCTA.tsx` | Last-1.5s overlay showing `quiz.endQuestion`. Replaces dead air. |

### 5.2 Modified components

| Path | Change |
|---|---|
| `src/compositions/QuizShort.tsx` | (a) Eliminate 2.5s end-black from LoopTrigger; (b) accept `audioDurationSec` prop and derive frame counts from it; (c) hook visible at frame 0 (no opacity-0 spring entry); (d) delete `warning-triangle` Lottie + one red bar (clutter reduction); (e) import `CaptionOverlay` in hormozi mode for explain phase only; (f) schedule 5 SFX cues; (g) BGM → `study-pad.mp3`; (h) render `EndCardCTA` for last 1.5s. |
| `scripts/render-daily-short.ts` | (a) `categoryId: '27' → '28'`; (b) compute `audioDurationSec` from TTS result and pass to composition + override `calculateQuizShortMetadata`; (c) generate `.srt` from TTS `wordTimestamps`; (d) extract frame-0 still as `<id>-thumbnail.jpg` via Remotion still-frame API; (e) post-render two-pass ffmpeg `loudnorm=I=-14:TP=-1.5:LRA=11`; (f) description expanded to ≥150 words. |
| `scripts/upload-youtube.ts` | (a) Attach `.srt` via `captions().insert()`; (b) attach explicit `-thumbnail.jpg` via `thumbnails().set()`. |
| `.github/workflows/auto-shorts.yml` | Audit cron schedule → `45 7 * * 1,3,5` UTC (1:15 PM IST Mon/Wed/Fri). |

## 6. Implementation tiers and ship gates

Each gate must pass before proceeding to the next tier. Gates produce evidence, not opinion.

### Tier 0 — Measurement (prerequisite)

| # | Change | Verification |
|---|---|---|
| 0.1 | `ingest-analytics.ts` pulls per-video metrics | `data/analytics/<id>.json` exists for ≥ 1 prior upload |
| 0.2 | `weekly-report.ts` emits Markdown summary | Run on existing uploads produces non-empty report |
| 0.3 | `.github/workflows/analytics.yml` cron daily | Workflow runs in CI, commits `data/analytics/*.json` |

**Gate 0:** Analytics pipeline working end-to-end on at least one existing upload.

### Tier 1 — Retention bug fixes

| # | Bug | Fix | Location |
|---|---|---|---|
| 1.1 | 2.5s solid black at end (LoopTrigger phase 3) | Eliminate phase 3; composition ends at `EXPLAIN_END + 2.5s` (LoopTrigger phase 1+2 only) | `QuizShort.tsx:29-33, 569-642` |
| 1.2 | Audio/composition duration mismatch (hard-coded 25s vs variable TTS) | `audioDurationSec` becomes a prop; `TOTAL_FRAMES`, `EXPLAIN_END`, etc. derive from it. Use Remotion's `calculateMetadata` pattern on the `<Composition>` so the render command can compute frame count from the audio file path passed in props (no CLI duration flag needed). | `QuizShort.tsx`, `src/compositions/index.tsx`, `render-daily-short.ts` |
| 1.3 | `categoryId: 27` (Education) | Change to `'28'` (Science & Tech) per `optimal_schedule` memory | `render-daily-short.ts` (categoryId line) |
| 1.4 | No title length validation | New `validate-quizzes.ts` script run in CI; fails build if any `quiz.title.length > 60` | `scripts/validate-quizzes.ts` (new) |
| 1.5 | Frame-0 thumbnail is near-blank | Hook text rendered at full opacity/scale at frame 0; spring animation applies only to avatar + vignette. Plus: explicit thumbnail JPG uploaded via API. | `QuizShort.tsx` hook block; `upload-youtube.ts` |
| 1.6 | Hook clutter (6 simultaneous overlays) | Delete `warning-triangle.json`. Keep fire (subtle, behind text). Smaller avatar (140→110px). Top red bar only (drop bottom). Net: 6 → 4 elements. | `QuizShort.tsx` hook block |

**Gate 1:** Re-render `kafka-quiz-0`; verify (a) first frame is readable, (b) no black at end, (c) duration matches `audio + 1s`. Upload one Short. Wait 48h. Ingest analytics. Record baseline completion %.

### Tier 2 — Free-leverage additions

| # | Change | Justification |
|---|---|---|
| 2.1 | Burn-in captions (`CaptionOverlay` hormozi mode, explain phase **only**) | Mid-Short retention support. Excluded from hook to avoid clutter. |
| 2.2 | SFX layer — 5 cues at phase boundaries: `whoosh-in` at frame 0 (HOOK entry), `tension-build` from `HOOK_END` to `QUESTION_END` (the 2-6s window while user reads options — currently has no narration sound), `impact` + `success-chime` at `FLASH_END` (reveal), `riser` 10 frames before big-stat appears, `swoosh-out` at `EXPLAIN_END` (transition to LoopTrigger) | Pacing punctuation, fills dead air |
| 2.3 | BGM swap warm-ambient → study-pad | Less sleepy, more forward momentum |
| 2.4 | Two-pass loudness normalize (-14 LUFS) post-render | YouTube standard; avoids loudness penalty |
| 2.5 | SRT generation + upload via captions API | SEO + accessibility |
| 2.6 | `EndCardCTA` showing `quiz.endQuestion` for last 1.5s | Drives comments; `endQuestion` is currently unused |

**Gate 2:** Re-render `kafka-quiz-0`. Visual diff vs Gate 1. Upload, wait 48h, compare completion to Tier 1 baseline.

### Tier 3 — Polish (conditional on Gate 2 measurement)

| # | Change |
|---|---|
| 3.1 | Description expanded to ≥150 words: quiz context + learning resources + hashtag block at bottom |
| 3.2 | Auto-fit hook text (shrink font when 3 lines would overflow at fontSize 88) |
| 3.3 | Audit CI cron schedule matches `45 7 * * 1,3,5` UTC |

**Gate 3:** Only enter Tier 3 if Gate 2 has not yet hit 70% median completion.

## 7. Failure modes & rollback

| Failure | Detection | Rollback |
|---|---|---|
| Captions overlap with options or diagram | Visual diff after first render | Move captions to bottom 200px band; if still bad, disable for explain phase, keep only for end CTA |
| Audio-driven duration breaks composition | Render fails or duration < 18s | Fall back to `min(audioDur + 1, 25)`s with a warning |
| Two-pass loudnorm times out in CI | CI job timeout | Single-pass loudnorm (less accurate, still adequate) |
| Tier 1 fixes do not improve completion rate | Analytics ingestion shows no change after 10 uploads | Stop. Revisit format itself — quiz may not be viable. |
| Frame-0 still-frame export fails | Empty thumbnail JPG | Fall back to letting YouTube auto-pick; do not block render |

## 8. Determinism & no-LLM compliance

Per `feedback_deterministic_no_llm` and `feedback_fully_automated`:
- All content is template-generated from `quiz-content.ts`.
- All metadata (title, description, tags, hashtags) is computed from quiz fields.
- TTS uses `en-IN-PrabhatNeural` (Indian male, mandatory per `feedback_voice_avatar`).
- Analytics ingestion uses YouTube Analytics API → deterministic JSON.
- No call to any LLM at any point in the render-upload-ingest path.

## 9. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| YouTube Analytics API quota exhausted | Low | Medium | Daily ingestion is well within 10K quota |
| Loudnorm changes audio character unpleasantly | Medium | Low | Two-pass is industry standard; if user objects, revert |
| Cutting LoopTrigger phase 3 (black) breaks the Zeigarnik loop concept | Low | Medium | Phase 1 ("But wait...") and Phase 2 ("Most tutorials...") still loop emotionally; only the literal black is removed |
| Removing warning triangle weakens hook | Low | Low | Fire Lottie + vignette + bold red text still convey urgency |
| Title length validator breaks existing quizzes | Medium | Low | Pre-flight scan; manually trim flagged titles before merging |

## 10. Expected file diff

```
+ scripts/ingest-analytics.ts                 (new)
+ scripts/weekly-report.ts                    (new)
+ scripts/validate-quizzes.ts                 (new)
+ src/components/EndCardCTA.tsx               (new)
+ .github/workflows/analytics.yml             (new)
+ data/analytics/.gitkeep                     (new)
~ src/compositions/QuizShort.tsx              (significant: ~150 lines changed)
~ scripts/render-daily-short.ts               (significant: ~50 lines changed)
~ scripts/upload-youtube.ts                   (moderate: ~30 lines for SRT + thumbnail upload)
~ .github/workflows/auto-shorts.yml           (small: cron schedule)
- public/lottie/warning-triangle.json         (delete reference; file may stay on disk)
```

## 11. Decisions captured

| Decision | Rationale |
|---|---|
| Primary metric = median completion rate | Most direct algo signal; falsifiable in 48h; one number |
| Subtract before adding (delete 2 hook overlays, end-black, etc. *before* adding captions/SFX) | Most v1-style "viral optimization" designs fail because they are additive — they make clutter worse |
| Tier 0 (analytics) is a prerequisite, not nice-to-have | Without it, downstream tiers cannot be validated |
| Hindi deferred | LLM constraint not yet resolved |
| 25s composition length kept (not shortened to 17-20s) | Audio-driven duration replaces it; quizzes will self-size to TTS length |

## 12. Open questions deferred to implementation

- Should `study-pad.mp3` be the BGM or should we test all three (`gentle-drone`, `study-pad`, `warm-ambient`) over the first 10 uploads and let Gate 2 measurement pick? — **Defer**; pick `study-pad` for v1, instrument later.
- Should captions appear in hook? — **No**, would worsen clutter (already 4 elements after deletions).
- Should `endQuestion` be both spoken AND shown? — **No**, shown only; current narration already ends with the twist which is a stronger note.

## 13. References

- `~/.claude/projects/-Users-racit-PersonalProject-video-pipeline/memory/MEMORY.md`
- `~/.claude/projects/-Users-racit-PersonalProject-video-pipeline/memory/feedback_deterministic_no_llm.md`
- `~/.claude/projects/-Users-racit-PersonalProject-video-pipeline/memory/feedback_fully_automated.md`
- `~/.claude/projects/-Users-racit-PersonalProject-video-pipeline/memory/feedback_voice_avatar.md`
- `~/.claude/projects/-Users-racit-PersonalProject-video-pipeline/memory/optimal_schedule.md`
- `docs/superpowers/plans/2026-05-18-viral-shorts-pivot.md`
- `CLAUDE.md` (project rules)
