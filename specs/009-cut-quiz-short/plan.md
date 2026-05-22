# Implementation Plan: Cut Quiz Short to ~30s

**Branch**: `009-cut-quiz-short` | **Spec**: `specs/009-cut-quiz-short/spec.md`

## Summary

Revert the QuizShort composition + daily-short render pipeline from the 120s
F006-era format back to a ~30s retention-optimized Short. Compress phase timings,
stop rendering the three 2-min-era components, and shorten the TTS narration.

## File Structure

| File | Change |
|------|--------|
| `src/compositions/QuizShort.tsx` | `DEFAULT_DURATION_S` 120 → 30; compress phase boundary constants; remove `CodeSnippetPanel` / `ExplanationBeats` / `WorkedExample` renders; add a single one-sentence answer beat; fix metadata floor |
| `scripts/render-daily-short.ts` | Revert narration assembly to the short 4-part form; drop `deriveSpokenCode` / `deriveSpokenExample` / bridge sentences; default audio duration floor 30s |

Component files `CodeSnippetPanel.tsx`, `ExplanationBeats.tsx`, `WorkedExample.tsx`
are NOT deleted (long-form may reuse them) — only their imports/renders in
QuizShort are removed.

## Phase-Timing Table (~30s Short)

| Phase | Window | Notes |
|-------|--------|-------|
| HOOK | 0 - 3s | A/B hook formulas, avatar, Lottie fire |
| QUESTION + 3 options + countdown | 3 - 12s | sticky question strip, countdown ring |
| FLASH + ANSWER SPLASH | 12 - 14s | flash cut + green answer splash |
| ONE-sentence answer + reveal | 14 - 25s | single tight sentence (first sentence of `quiz.explanation` or `quiz.twist`), animated stat counter (brief), captions |
| END CTA | 25 - 30s | EndCardCTA |

Phase constants in seconds: `HOOK_END_S=3`, `QUESTION_END_S=12`, `FLASH_END_S=13`,
`ANSWER_SPLASH_END_S=14`, `ANSWER_END_S=25`, `END_CTA_DURATION_S=5`,
`DEFAULT_DURATION_S=30`.

## Removed vs Kept

**Removed from the Short** (F006 2-min-era additions):
- `CodeSnippetPanel` render
- `ExplanationBeats` render (full sentence-by-sentence walkthrough)
- `WorkedExample` render (BEFORE/AFTER split)
- `deriveSpokenCode` / `deriveSpokenExample` narration + key-insight repeat + bridge
  sentences in `render-daily-short.ts`

**Kept**: hook (A/B formulas), sticky question strip, countdown timer, flash cut,
ANSWER splash, animated stat counter (brief), ONE-sentence explanation, EndCardCTA,
captions, SFX, BGM, channel branding, logo bug, A/B hook variants.

## Risk

- **TTS narration length**: the one-sentence answer must keep total narration under
  ~32s. Mitigation: take only the FIRST sentence of `quiz.explanation` (fallback
  `quiz.twist`); verify with the T5 smoke render `ffprobe` duration check.
- **Audio shorter than 30s**: composition floors at 30s; the audio `fadeOut`
  handles the short silent tail (acceptable — far better than a 90s silent tail).
- **Captions slicing**: the explanation caption window must rebase against the new
  shorter narration; verified in the smoke render frame checks.

## Verification

- `npx tsx scripts/render-daily-short.ts --short 0`
- `ffprobe -v error -show_entries format=duration -of csv=p=0 output/daily-short/kafka-quiz-0*.mp4` → 28-34s
- Frame extracts at 1s/8s/15s/27s → hook / options / answer / CTA present
- `npx tsc --noEmit -p tsconfig.build.json` → clean for QuizShort + render-daily-short
- `npx vitest run` → no new failures vs the 25 known
