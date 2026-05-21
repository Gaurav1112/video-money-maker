# Feature 006 — Implementation Plan

**Branch**: `006-opinion-piece-long`
**Spec**: [`spec.md`](./spec.md)
**Created**: 2026-05-21

---

## Decision: parallel orchestrator (NOT script-generator extension)

We evaluated two paths:

| Path | Risk | Effort | Verdict |
| --- | --- | --- | --- |
| A. Extend `script-generator.ts` (2500 LOC) with new `opinion-*` scene types + extend `LongVideo.tsx` props | Cross-contamination with the topic-quiz path; any regression breaks 784 sessions | High | **Reject** — violates Constitution VIII single-path |
| B. New orchestrator `scripts/render-opinion-piece.ts` + new `OpinionLong.tsx` composition + new `OpinionShort.tsx` | Isolated; quiz pipeline untouched; parser is the only shared abstraction | Medium | **Accept** |

Path B is the implementation. The existing `tts-engine.generateSceneAudios` is the only reused pipeline primitive.

---

## Tech Stack

- **Parser**: new `src/lib/opinion-piece-parser.ts` — pure TypeScript, uses `gray-matter` (already in `node_modules`? confirm; if not, hand-roll a 30-line YAML+section splitter — simpler and zero new deps).
- **Audio**: existing `src/pipeline/tts-engine.ts → generateSceneAudios()` with voice `en-IN-PrabhatNeural`, voiceLanguage `indian-english`.
- **Long-form composition**: new `src/compositions/OpinionLong.tsx` — 1920x1080, 30fps, consumes `{ opinion: OpinionPiece; sceneAudios: TTSResult[]; bgmFile?: string }`.
- **Short composition**: new `src/compositions/OpinionShort.tsx` — 1080x1920, 30fps, ~60s, consumes `{ hookText: string; thenNowFirstLine: string; audio: TTSResult }`.
- **Visual components**: new `src/components/opinion/` directory with four leaf components, each pure (props in, JSX out).

---

## File Structure

| Path | Type | Purpose |
| --- | --- | --- |
| `src/lib/opinion-piece-parser.ts` | new | Parser + `OpinionPiece` types |
| `src/lib/__tests__/opinion-piece-parser.test.ts` | new | TDD fixture for parser |
| `content/opinions/001-microservices-vs-monolith.md` | new | Episode 001 source |
| `src/components/opinion/ThenNowSplit.tsx` | new | 1995-left / 2026-right split-screen |
| `src/components/opinion/ProsConsList.tsx` | new | ✅ / ❌ two-column with stagger reveal |
| `src/components/opinion/PivotCard.tsx` | new | Center-screen "The real question is…" card |
| `src/components/opinion/QuestionCard.tsx` | new | Large closing question card |
| `src/compositions/OpinionLong.tsx` | new | 16:9 long-form composition |
| `src/compositions/OpinionShort.tsx` | new | 9:16 60s cold-open Short |
| `src/compositions/index.tsx` | modify | Register `OpinionLong` + `OpinionShort` compositions |
| `scripts/render-opinion-piece.ts` | new | Orchestrator: md → audio → props → render long + short + metadata |
| `output/opinions/<slug>/long.mp4` | output | Long-form render |
| `output/opinions/<slug>/short.mp4` | output | 60s vertical Short |
| `output/opinions/<slug>/metadata.json` | output | YouTube/IG metadata sidecar |

Existing files NOT modified: `src/compositions/LongVideo.tsx`, `src/pipeline/script-generator.ts`, all quiz-related files.

---

## Data Flow

```
content/opinions/<slug>.md
  └─→ opinion-piece-parser.parse()
        └─→ OpinionPiece (typed object)
              └─→ render-opinion-piece.ts orchestrator
                    ├─→ generateSceneAudios([{narration: hook}, {narration: thenNow}, …])
                    │     └─→ TTSResult[] (per-section audio + word timestamps)
                    ├─→ buildLongProps(opinion, audios) → OpinionLongProps
                    │     └─→ remotion render OpinionLong → long.mp4
                    │           (30s PREVIEW first per Constitution VII, then full)
                    ├─→ buildShortProps(opinion, hookAudio) → OpinionShortProps
                    │     └─→ remotion render OpinionShort → short.mp4
                    └─→ buildMetadata(opinion, sceneTimings) → metadata.json
```

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Section narration overflows 12 min cap | Medium | Parser warns when total spoken words > 1500; renderer hard-caps at 15 min, then errors. |
| New components introduce visual clutter (Constitution V) | Medium | Keep each component to ONE central element; no overlay stack; reuse existing `BgmLayer` only. |
| Edge TTS rate limits on six parallel scenes | Low | `generateSceneAudios` already batches at concurrency 4 with cache. |
| 60s Short can't fit Hook + first Then-Now line of Episode 001 | Low | Hook is ~75 words at 135wpm ≈ 33s; one Then-Now line ~15 words ≈ 7s; comfortable inside 60s budget. |
| Emoji passthrough breaks `<Text>` render | Low | Existing components already render emojis (QuizShort hook). |

---

## Alternatives Considered

1. **Reuse `ViralShort` for the 60s cold-open** — rejected: `ViralShort` is tightly coupled to quiz content and word-by-word captions. Cleaner to fork than to shoehorn.
2. **Render long-form as a sequence of `Sequence` blocks calling existing `TextSection` etc. components** — rejected: existing `TextSection` is keyword-template-driven; opinion sections have prescribed structure (then-vs-now split, pros-cons, etc.) that don't map cleanly.
3. **One composition `OpinionMedia` with format prop** — rejected: complicates `calculateMetadata` (different fps/resolution) and violates single-responsibility.

---

## Constitution Compliance Re-check

- ✅ Deterministic — no randomness; all scene durations come from TTS word timestamps; no LLM.
- ✅ All-local — only Edge TTS network call (already in pipeline).
- ✅ Indian voice — `en-IN-PrabhatNeural` hardcoded in orchestrator.
- ✅ Render-preview — orchestrator runs preview before full.
- ✅ Single-path — `LongVideo.tsx` and `script-generator.ts` are untouched.
- ✅ No secrets — no new credentials introduced.

---

## Definition of Done

- [ ] Episode 001 markdown exists at `content/opinions/001-microservices-vs-monolith.md` with full source text.
- [ ] Parser tests pass (≥ 6 cases).
- [ ] `OpinionLong` + `OpinionShort` registered in `compositions/index.tsx`.
- [ ] `scripts/render-opinion-piece.ts 001-microservices-vs-monolith` produces `long.mp4` (480-720s), `short.mp4` (55-65s), `metadata.json`.
- [ ] `npx tsc --noEmit` clean.
- [ ] No modifications to `LongVideo.tsx`, `ShortVideo.tsx`, `ViralShort.tsx`, `QuizShort.tsx`, `script-generator.ts`.
- [ ] Branch `006-opinion-piece-long` pushed; PR NOT opened (operator review first).
