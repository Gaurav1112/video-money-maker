# Feature Specification: Cut Quiz Short to ~30s

**Feature Branch**: `009-cut-quiz-short`

**Created**: 2026-05-22

**Status**: Draft

**Input**: User description: "Revert the QuizShort timeline from the 120s F006-era format back to a retention-optimized ~30s Short."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - QuizShort renders as a ~30s retention-optimized Short (Priority: P1)

The daily quiz pipeline produces a vertical Short that runs ~28-32 seconds end to
end. A viewer watching on the YouTube Shorts feed sees the hook, the question with
three options and a countdown, a flash cut, the answer splash, a single tight
explanation sentence, and an end CTA — all within the ~10-15 second attention window
that Shorts viewers actually give a video, with enough margin that most viewers finish.

**Why this priority**: This is the entire feature. The YouTube Analytics API (newly
enabled) shows old 25-50s Shorts hit 100-126% completion (viewers finish and loop),
while the new 120s v3 Shorts only reach 8-13s average view duration — a 22-34%
completion rate. Shorts viewers give any Short ~10-15s of attention regardless of
length. At 120s that is ~10% completion; at 30s it is ~50%. The 2-minute format is
actively suppressing the Shorts algorithm signal. Reverting to ~30s is the single
highest-leverage change available.

**Independent Test**: Run `npx tsx scripts/render-daily-short.ts --short 0`, then
`ffprobe` the output MP4 — duration must be 28-34s (not 120s), audio duration must
roughly equal video duration (no long silent tail). Extract frames at 1s/8s/15s/27s
and confirm hook / options / answer / CTA are each present.

**Acceptance Scenarios**:

1. **Given** quiz index 0, **When** `render-daily-short.ts` runs, **Then** the
   rendered MP4 duration is between 28 and 34 seconds.
2. **Given** the short narration, **When** TTS produces audio, **Then** audio
   duration is within ~2s of video duration (no silent tail).
3. **Given** `--force-formula both`, **When** the script runs, **Then** two ~30s
   variant MP4s render (A/B hook variants still work).
4. **Given** the Short renders, **Then** CodeSnippetPanel, ExplanationBeats, and
   WorkedExample are NOT visible anywhere in the video.

### Edge Cases

- A quiz whose `explanation` first sentence is very long: the one-sentence answer
  is taken from the punchiest single line of `quiz.explanation` or `quiz.twist`;
  total narration must still keep the video under ~32s.
- A quiz with a `codeSnippet` payload: the panel must NOT render in the Short
  (the component file stays for long-form reuse).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: QuizShort MUST default to a ~30s composition (`DEFAULT_DURATION_S = 30`).
- **FR-002**: QuizShort MUST NOT render `CodeSnippetPanel`, `ExplanationBeats`, or
  `WorkedExample`.
- **FR-003**: Phase timings MUST be compressed to: HOOK 0-3s, QUESTION+options+
  countdown 3-12s, FLASH+ANSWER SPLASH 12-14s, one-sentence answer 14-25s, END CTA
  25-30s.
- **FR-004**: `render-daily-short.ts` MUST assemble a SHORT narration =
  `spokenHook + question + one-sentence-answer + endQuestion` (~28-32s of TTS).
- **FR-005**: `calculateQuizShortMetadata` MUST floor at ~30s, not 120s.
- **FR-006**: A/B hook variants (`--force-formula both`) MUST still render two
  variants.
- **FR-007**: Captions, SFX, BGM, channel branding, logo bug, animated stat
  counter (brief), sticky question strip, countdown timer, flash cut, and answer
  splash MUST be retained.

### Non-Goals

- Do NOT delete the `CodeSnippetPanel.tsx`, `ExplanationBeats.tsx`, or
  `WorkedExample.tsx` component files — they may be reused by long-form.
- Do NOT touch long-form compositions, OpinionLong/OpinionShort, or
  `quiz-content.ts` data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Rendered QuizShort MP4 duration is 28-34 seconds.
- **SC-002**: Audio duration is within ~2s of video duration (no silent tail).
- **SC-003**: Median completion rate on new uploads rises toward 50%+ when
  measured 7 days post-merge (vs the 22-34% on 120s v3 Shorts).
- **SC-004**: `npx tsc --noEmit -p tsconfig.build.json` reports no new errors in
  `QuizShort` or `render-daily-short`.

## Constitution Alignment

- **Deterministic**: All animations remain frame-derived; no `Math.random` is
  introduced. Phase boundaries become fixed seconds.
- **Indian voice**: TTS still uses `en-IN-PrabhatNeural` — unchanged.
- **All local**: No new cloud calls; analytics data justifying the change is
  already exported locally.

## Assumptions

- Shorts viewers give ~10-15s of attention regardless of total length (per the
  50-video retention sample).
- The first sentence of `quiz.explanation` (or `quiz.twist`) is a self-contained,
  punchy answer line suitable for a single ~10s narration beat.
- TTS at `+10%` rate produces ~28-32s for the assembled short narration.
