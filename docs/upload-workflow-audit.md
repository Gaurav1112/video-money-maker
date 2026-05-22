# Upload Workflow Audit (F009)

**Date:** 2026-05-22
**Problem:** The `@GuruSishya-India` YouTube channel has 91 uploads, many of them
duplicates ("90% of devs get Kafka acks WRONG" appears 3+ times, etc.). Root
cause: 13 workflows can upload to YouTube and ~7-8 run on overlapping cron
schedules with no coordination. This violates Constitution VIII (Single-Path
Pipelines).

**Canonical Shorts pipeline:** `auto-shorts.yml` (v3 QuizShort, 2 quizzes ×
A/B daily). All other auto-uploading Shorts/long-form workflows have their
`schedule:` cron commented out (file kept so they remain manually
dispatchable).

## Verdict table

| # | Workflow | Trigger | Uploads | Last run | Verdict | Reason |
|---|----------|---------|---------|----------|---------|--------|
| 1 | `auto-shorts.yml` | cron `45 7 * * 1,3,5` + dispatch | QuizShort Shorts (2/day, A/B) | 2026-05-21 dispatch, success | **KEEP** | Canonical Shorts pipeline. Schedule UNTOUCHED. |
| 2 | `daily-short.yml` | cron `0 7 * * *`, `30 13 * * *` + dispatch | ViralShort / render:stock Shorts | 2026-05-21 schedule, failure | **DISABLE** | Redundant Shorts path, separate cooldown ledger — collides with auto-shorts. |
| 3 | `trend-short.yml` | cron `30 0,6,12,18 * * *` (4×/day) + dispatch | trend-detector quiz Shorts | 2026-05-21 schedule, success | **DISABLE** | Fires 4×/day, uploads Shorts with no coordination — primary duplicate source. |
| 4 | `auto-publish.yml` | cron `30 4 * * 1,3,5`, `30 4 * * 2,4,6` + dispatch | Cartoon-pipeline multi-lang long-form | 2026-05-21 schedule, failure | **DISABLE** | Auto-uploads long-form to YouTube; overlapping multi-lang publish path. |
| 5 | `morning-upload-7-15-am.yml` | cron `0 0 * * *` + dispatch | batch-render-all long-form | 2026-05-21 schedule, cancelled | **DISABLE** | Auto-uploads long-form daily; redundant with upload-scheduled / cloud. |
| 6 | `evening-upload-7-15-pm.yml` | cron `0 12 * * *` + dispatch | batch-render-all long-form | 2026-05-21 schedule, cancelled | **DISABLE** | Auto-uploads long-form daily; redundant with morning + upload-scheduled. |
| 7 | `daily-publish-hinglish.yml` | cron `30 13 * * *` + dispatch | Hinglish-track Shorts | 2026-05-21 schedule, success | **DISABLE** | Auto-uploads to the SAME channel at the SAME 19:00 IST slot as daily-short — splits views. |
| 8 | `complete-render-publish.yml` | `workflow_dispatch` only | batch-render-all long-form | 2026-05-04 dispatch, failure | **KEEP** | No `schedule:` block — manual only, cannot auto-duplicate. Nothing to disable. |
| 9 | `cloud-render-and-publish.yml` | `workflow_dispatch` only (schedule already commented) | long-form + vertical part Shorts | no runs | **KEEP** | `schedule:` already disabled in-file ("use upload-scheduled.yml instead"). Manual only. |
| 10 | `publish-pipeline.yml` | cron `30 0 * * *` + dispatch | `scripts/render.ts` episode upload | 2026-05-21 schedule, failure | **DISABLE** | Auto-uploads daily; redundant episode publish path. |
| 11 | `render-and-publish.yml` | cron `30 0 * * *` + dispatch | long-form + 3 part Shorts | 2026-05-21 schedule, cancelled | **DISABLE** | Auto-uploads long-form + Shorts daily; overlaps render-episodes + upload-scheduled. |
| 12 | `upload-scheduled.yml` | cron 8× (`45 12 * * 2,6`, `45 7 * * 0,1,3,4,5`, `0 16 * * 2`) + dispatch | long-form + part Shorts + atomic Short | 2026-05-21 schedule, success | **DISABLE** | 8 weekly cron entries auto-uploading Shorts + long-form — major duplicate source. |
| 13 | `render-episodes.yml` | cron `30 4 * * 1,3,5`, `30 4 * * 2,4,6`, `0 4 * * 1,3,5` + dispatch | Cartoon-pipeline multi-lang long-form | 2026-05-21 schedule, failure | **DISABLE** | Auto-uploads long-form; duplicate of auto-publish.yml (both named "Cartoon Pipeline"). The `0 4` teaser cron is community-post only — also disabled since the workflow is off. |

## Summary

- **KEEP (3):** `auto-shorts.yml` (canonical, schedule untouched),
  `complete-render-publish.yml` (already manual-only),
  `cloud-render-and-publish.yml` (schedule already commented in-file).
- **DISABLE (10):** `daily-short.yml`, `trend-short.yml`, `auto-publish.yml`,
  `morning-upload-7-15-am.yml`, `evening-upload-7-15-pm.yml`,
  `daily-publish-hinglish.yml`, `publish-pipeline.yml`,
  `render-and-publish.yml`, `upload-scheduled.yml`, `render-episodes.yml`.

For each DISABLE workflow with a `schedule:` block, the cron triggers are
commented out (workflow_dispatch retained). `gh workflow disable` was NOT used
— commenting the cron keeps the change version-controlled and reviewable.

Out of audit scope (read-only / CI / different content, per the decision
rule): `analytics.yml`, `channel-inventory.yml`, `weekly-article.yml`,
`weekly-opinion.yml`, `channel-cleanup.yml`, `test.yml`, `security-audit.yml`.

## Defense-in-depth

Even the canonical `auto-shorts.yml` can re-upload a quiz once rotation wraps
(61 quizzes, 2/day). F009 adds a per-quiz upload-ledger
(`scripts/lib/upload-ledger.ts` + `data/uploaded/`) so the same quiz key
(`${topic}-quiz-${index}`, A/B variants suffixed `-variantA`/`-variantB`)
never uploads twice.
