# Feature 007 — Implementation Plan

**Branch**: `007-weekly-opinion-piece`
**Spec**: [`spec.md`](./spec.md)
**Created**: 2026-05-21

---

## Decision: thin orchestrator + reuse

We will NOT modify the F006 compositions or `upload-youtube.ts`. F007 is a thin layer that:

1. Adds metadata-shaping + thumbnail rendering to `render-opinion-piece.ts`.
2. Adds an orchestrator that picks the episode, renders, then shells out to `upload-youtube.ts` twice.
3. Adds a workflow YAML that wires the orchestrator to cron + workflow_dispatch.

| Path | Risk | Verdict |
| --- | --- | --- |
| A. Build a generic "multi-format auto-publish" framework that handles opinions + quizzes + topic-long | Cross-contamination; one bug bricks the entire pipeline (violates VIII) | Reject |
| B. Thin opinion-piece-specific orchestrator (this plan) | Isolated; quiz pipeline untouched; only `render-opinion-piece.ts` is shared | **Accept** |

---

## Tech Stack

- **Composition**: new `src/compositions/OpinionThumbnail.tsx` — 1280×720, 30fps, durationInFrames=1 single-frame poster.
- **Render orchestrator**: existing `scripts/render-opinion-piece.ts`, modified to (a) render the thumbnail still via `npx remotion still`, (b) emit two distinct metadata files instead of one combined sidecar.
- **Upload orchestrator**: new `scripts/upload-opinion-piece.ts` — TypeScript CLI that does picker → render-opinion-piece → upload long → upload short → write dedupe record.
- **CI**: new `.github/workflows/weekly-opinion.yml` — cron + workflow_dispatch.
- **Storage**: new `data/opinions-published/` directory (with `.gitkeep`).
- **Tests**: new `scripts/__tests__/upload-opinion-piece.test.ts` (Vitest) covering picker + dedupe writer.

---

## File Structure

| Path | Type | Purpose |
| --- | --- | --- |
| `src/compositions/OpinionThumbnail.tsx` | new | 1280×720 single-frame movie-poster thumbnail |
| `src/compositions/index.tsx` | modify | Register `OpinionThumbnail` composition |
| `scripts/render-opinion-piece.ts` | modify | Emit `long-metadata.json` + `short-metadata.json` + render `long-thumbnail.jpg` |
| `scripts/upload-opinion-piece.ts` | new | End-to-end orchestrator (picker → render → 2 uploads → dedupe write) |
| `scripts/__tests__/upload-opinion-piece.test.ts` | new | TDD: picker behavior + dedupe-record schema |
| `.github/workflows/weekly-opinion.yml` | new | Cron Sundays 12 UTC + workflow_dispatch |
| `data/opinions-published/.gitkeep` | new | Force-track empty dedupe directory |

Files NOT modified: `src/compositions/OpinionLong.tsx`, `src/compositions/OpinionShort.tsx`, `src/lib/opinion-piece-parser.ts`, `scripts/upload-youtube.ts`, all quiz/topic-long pipeline files.

---

## Data Flow

```
GH Actions cron (Sun 12 UTC)  OR  workflow_dispatch -f episode=<slug>
  └─→ npx tsx scripts/upload-opinion-piece.ts [--episode <slug>] [--dry-run]
        ├─→ pickEpisode()                       # walk content/opinions/, exclude data/opinions-published/
        ├─→ npx tsx scripts/render-opinion-piece.ts <slug>
        │     ├─→ parse + TTS + props (existing)
        │     ├─→ remotion still OpinionThumbnail → long-thumbnail.jpg
        │     ├─→ remotion render OpinionLong → long.mp4
        │     ├─→ remotion render OpinionShort → short.mp4
        │     ├─→ write long-metadata.json
        │     └─→ write short-metadata.json
        ├─→ npx tsx scripts/upload-youtube.ts long.mp4 long-metadata.json --thumbnail long-thumbnail.jpg
        ├─→ npx tsx scripts/upload-youtube.ts short.mp4 short-metadata.json --shorts
        └─→ write data/opinions-published/<slug>.json with both video IDs
              └─→ workflow step: git commit + push the dedupe record
```

---

## Metadata Shape

`long-metadata.json`:
```json
{
  "youtube": {
    "title": "<opinion.title>",
    "description": "<hook>\n\n<then-now expanded>\n\n<pros bullets>\n\n<cons bullets>\n\n<pivot>\n\n<lesson>\n\n<question>\n\nChapters:\n00:00 Hook\nmm:ss Then vs Now\n...",
    "tags": ["opinion","leadership","microservices","architecture","software-engineering","tech-leadership"],
    "categoryId": "28",
    "chapters": "00:00 Hook\n..."
  },
  "thumbnailText": "<opinion.title>"
}
```

`short-metadata.json`:
```json
{
  "youtube": {
    "title": "<opinion.title (truncated <90 chars to leave room for #Shorts)>",
    "description": "<opinion.hook>\n\nFull essay: youtube.com/@channel",
    "tags": ["shorts","opinion","leadership","tech"],
    "categoryId": "28",
    "chapters": ""
  },
  "thumbnailText": "<opinion.title>"
}
```

Tags = static base set (`opinion`, `leadership`, `software-engineering`, `tech-leadership`) + first 2-3 keywords lifted from `opinion.slug` (`microservices-vs-monolith` → `microservices`, `monolith`, `architecture`).

---

## Operator Setup

**NONE**. All required GitHub Secrets (`YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`) are already configured per `auto-shorts.yml` line 45-47.

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Long-form render on CI takes > 30 min | Low | F006 local timings ~10 min; CI is similar Linux runner. Budget 50 min wall-clock. |
| Long upload succeeds, Short fails → partial state | Medium | Atomicity: only write dedupe record after BOTH uploads return 2xx. Retry runs both. |
| YouTube duplicates if long succeeds twice across retries | Low | Accepted; operator deletes by hand. Documented in spec edge cases. |
| `remotion still` flag for thumbnail differs from `remotion render` flag | Low | Use `--props=<path>` consistently; `--frame=0` for stills. Smoke-test locally before CI. |
| Concurrent runs (operator triggers manual during cron window) | Low | Add `concurrency: group: weekly-opinion / cancel-in-progress: false` to YAML. |

---

## Constitution Compliance Re-check

- ✅ I Deterministic — picker sorts by slug ascending; metadata purely derived from markdown.
- ✅ III Automation — cron + workflow_dispatch; zero manual steps.
- ✅ VI Indian voice + avatar — reuses F006 unchanged.
- ✅ VII Render-preview — `render-opinion-piece.ts` still runs the 30s preview pass (do NOT pass `--no-preview` in workflow YAML).
- ✅ VIII Single-path — separate workflow, separate orchestrator; quiz/topic-long paths untouched.
- ✅ IX Secret hygiene — reuses existing secrets; no new credential material introduced.
- ✅ X Branch-per-feature — work on `007-weekly-opinion-piece`, FF merge to main.

---

## Definition of Done

- [ ] `OpinionThumbnail` composition renders a 1280×720 JPEG with the title.
- [ ] `render-opinion-piece.ts` emits BOTH `long-metadata.json` + `short-metadata.json` AND `long-thumbnail.jpg`.
- [ ] `upload-opinion-piece.ts --dry-run` prints the planned uploads without calling YouTube.
- [ ] Vitest suite passes (new picker + dedupe-writer tests + no regressions).
- [ ] `weekly-opinion.yml` triggers on cron Sundays 12 UTC and workflow_dispatch.
- [ ] Branch merged FF to main and pushed.
- [ ] Episode 001 workflow run UPLOADS both videos and writes the dedupe record.
