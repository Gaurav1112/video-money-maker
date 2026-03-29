# Viral Shorts v3 — Ground-Up Vertical Composition

**Date:** 2026-03-29
**Status:** Approved

## Problem
6 previous shorts approaches all failed. FFmpeg crop splits overlays. Remotion ShortVideo reused horizontal components that broke at 1080x1920.

## Solution
Purpose-built `ViralShort.tsx` Remotion composition at 1080x1920 with **alternating full-screen frames** (text OR diagram, never split panels).

## Layout (1080x1920)
- Each frame is either ALL text or ALL diagram — no split panels
- Text frame: heading (52px) + bullets (32px), full 1080px width
- Diagram frame: ConceptViz fills full 1080px width natively
- Bottom bar subtitles: CaptionOverlay repositioned, karaoke word highlight
- CTA bar: "guru-sishya.in" above 150px YouTube/IG safe zone

## Structure per short
- 0-2s: HOOK — giant text from narration (52px bold)
- 2s-end: Alternating text/diagram scenes from one subtopic
- Last 3s: OUTRO — CTA + cliffhanger

## Clip Selection
- Group storyboard scenes by `heading` = 1 subtopic = 1 short
- Duration filter: 20-58 seconds
- Score: interview > code > problem > text
- Generate hook text from heading + narration

## Audio + Subtitle Sync
- Same master MP3 with `startFrom` offset (seek to subtopic position)
- Same `wordTimestamps` from storyboard → CaptionOverlay syncs perfectly
- Same `audioOffsetSeconds` per scene → no drift
- No re-encoding, no re-generating timestamps

## Files to Create
- `src/compositions/ViralShort.tsx` — the composition
- `scripts/render-viral-shorts.ts` — CLI script

## Files to Delete (broken approaches)
- `src/pipeline/shorts-converter.ts`
- `src/pipeline/viral-shorts-converter.ts`
- `scripts/convert-shorts.ts`
- `scripts/make-viral-shorts.ts`
- `scripts/make-shorts-v2.ts`

## Files to Keep
- `src/compositions/ShortVideo.tsx` — keep but deprecate
- `scripts/render-vertical-shorts.ts` — keep but deprecate
- `scripts/render-shorts.ts` — keep but deprecate
