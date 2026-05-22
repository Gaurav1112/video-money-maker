# Implementation Plan: Cut Long-Form to 4-6 Minutes

**Branch**: `012-cut-long-form` | **Spec**: `spec.md`

## Summary

Retarget both long-form pipelines from 8-12 min to 4-6 min (240-360 s). Two
surgical changes plus an analytics-window widening. No new compositions, no new
runtime dependencies.

## File Structure

```
src/lib/opinion-piece-parser.ts   # add narration-cap helper + use it
src/lib/__tests__/opinion-narration-cap.test.ts  # NEW — TDD for the helper
src/pipeline/script-generator.ts  # maxScenes default 30 -> 16
scripts/ingest-analytics.ts       # MAX_VIDEOS 50 -> 200
specs/012-cut-long-form/*         # spec / plan / tasks
```

## Duration-Budget Findings — BOTH Pipelines

### OpinionLong pipeline

- Budget lives in `buildNarrationPlan` (`opinion-piece-parser.ts`). It wraps
  each markdown section with verbose deterministic boilerplate to *inflate*
  terse markdown toward the old 8-12 min spec.
- `calculateOpinionLongMetadata` (`OpinionLong.tsx`) is already audio-driven:
  `durationInFrames = max(FPS*60, ceil(cappedSec*FPS)+tail)`, capped at 900 s.
  The `FPS*60` term is a 60 s floor only — well below 240 s, so no change
  needed there. The 900 s ceiling also untouched.
- Measured: the microservices episode already produces only ~566 words
  (~3.8 min) — the wrappers do not over-inflate *this* episode. The risk is a
  *verbose* future markdown blowing past 900 words. Fix: a deterministic
  per-section word cap (`capNarrationPlan`) enforcing a 600-900 word total
  budget. It truncates at a sentence boundary, never mid-word, never random.
- BEFORE: no cap — total = sum of wrapper-expanded sections (unbounded;
  verbose markdown could reach 8-12 min). AFTER: hard 900-word ceiling
  (~6 min at 150 wpm), proportionally distributed across sections.

### LongVideo / script-generator pipeline

- Budget is the `maxScenes` option of `generateScript`
  (`script-generator.ts`), default `30`. No caller passes it, so the default
  is the channel-wide budget. The whole scene-emission loop is gated on
  `maxScenes` (anchors at 0.3/0.6/0.7 ratios, `scenes.length >= maxScenes-3`
  break, etc.) — reducing the default scales the entire video down
  proportionally with no structural change.
- Average scene ~16-24 s including long intro/title scenes; 30 scenes
  ~ 8-12 min.
- BEFORE: `maxScenes = 30` (~8-12 min). AFTER: `maxScenes = 16` (~4-6 min).
  16 chosen so the fixed intro/title/summary/CTA scenes plus ~10-12 content
  scenes land mid-window.

## Risks

- **script-generator.ts is large (2500+ lines) and fragile.** The only edit is
  the single `maxScenes = 30` default literal -> `16`. All ratio math
  (`maxScenes * 0.3`, etc.) is relative and self-adjusts. No loop logic
  rewritten. If the budget had been unclear, the plan was to report it as a
  concern rather than guess — it was NOT unclear, so a surgical change applies.
- **Narration cap truncation** could clip a section mid-thought. Mitigation:
  truncate only at sentence boundaries; if a single section exceeds its share,
  keep whole sentences up to the share.

## Watch-Hours Caveat

Shortening videos does NOT reduce absolute watch time — viewers already stop at
2-4 min. It *raises completion %* on the same watch minutes, which is the
signal the algorithm ranks on. Total channel watch-hours are expected flat or
up (better ranking -> more impressions); average-view-duration in seconds may
dip, which is expected and not a regression.

## Testing Strategy

- TDD the pure `capNarrationPlan` helper: under-budget input untouched,
  over-budget input truncated to <= 900 words, sentence-boundary truncation,
  determinism.
- `script-generator.ts`: constant change verified by reading the budget;
  optional `--frames=` preview render per Constitution VII.
- Opinion path: full render + `ffprobe` duration in 240-360 s.
- `npx tsc --noEmit -p tsconfig.build.json`; `npx vitest run` — no new failures.

## Phasing

1. Spec-kit docs.
2. TDD narration-cap helper.
3. Wire cap into `buildNarrationPlan`.
4. `maxScenes` 30 -> 16.
5. `MAX_VIDEOS` 50 -> 200.
6. Verify (render + ffprobe + tsc + vitest).
