# Feature 006 — Tasks

**Spec**: [`spec.md`](./spec.md) | **Plan**: [`plan.md`](./plan.md)

---

## T1 — Define `OpinionPiece` types

Create `src/lib/opinion-piece-parser.ts` with type-only exports:

```ts
export interface OpinionFrontmatter { title: string; slug?: string; publishDate?: string; durationSec?: number; }
export interface OpinionThenNow { thenLines: string[]; nowLines: string[]; }
export interface OpinionPiece {
  slug: string; title: string; publishDate: string; durationSec: number;
  hook: string; thenNow: OpinionThenNow; pros: string[]; cons: string[];
  pivot: string; lesson: string; question?: string;
}
```

Plus a stub `parseOpinionPiece(markdown: string, fallbackSlug: string): OpinionPiece` that throws `not implemented`.

**Done when**: file compiles; `npx tsc --noEmit` clean.

---

## T2 — TDD parser

Write `src/lib/__tests__/opinion-piece-parser.test.ts` first. Cases:

1. Parses Episode 001 markdown end-to-end → all seven sections populated.
2. Missing `## Pivot` throws with section name in message.
3. Missing `## Question` does NOT throw; field is `undefined`.
4. Frontmatter `slug` missing → uses `fallbackSlug` param.
5. Then-vs-Now: lines under `In 1995:` go to `thenLines`, lines under `In 2026:` go to `nowLines`.
6. Pros: lines starting with ✅ are extracted as bullets; trailing text on each kept.

Then implement parser to pass. **Done when**: `npx vitest run src/lib/__tests__/opinion-piece-parser.test.ts` shows 6 passing.

---

## T3 — Author Episode 001 markdown

Create `content/opinions/001-microservices-vs-monolith.md` with frontmatter (`title`, `slug`, `publishDate: 2026-05-21`, `durationSec: 600`) and the seven sections containing the verbatim user-supplied source text (preserve all emojis).

**Done when**: parser test #1 passes against this file as the fixture.

---

## T4 — Opinion visual components

Create `src/components/opinion/`:

- `HookCard.tsx` — large centered hook quote, accent ring.
- `ThenNowSplit.tsx` — two-column 1995 / 2026 split, list reveal.
- `ProsConsList.tsx` — two-column ✅ pros / ❌ cons with staggered fade-in.
- `PivotCard.tsx` — full-screen card with "The real question is…" + the pivot text.
- `LessonCard.tsx` — large lesson statement.
- `QuestionCard.tsx` — closing question, prompts engagement.

All pure: props in, JSX out. No global state. Reuse `FONTS`, `COLORS` from `src/lib/theme`.

**Done when**: `npx tsc --noEmit` clean.

---

## T5 — `OpinionLong` composition

Create `src/compositions/OpinionLong.tsx` — 1920x1080, 30fps. Consumes `{ opinion: OpinionPiece; sceneAudios: { audioFile: string; duration: number }[]; bgmFile?: string }`. Renders a `Sequence` per section (Hook → ThenNow → Pros → Cons → Pivot → Lesson → Question?), each playing its section audio. Adds `<BgmLayer>` and `<AvatarBubble>`.

Include `calculateMetadata` that derives `durationInFrames` from the sum of `sceneAudios[i].duration`.

**Done when**: `npx tsc --noEmit` clean.

---

## T6 — `OpinionShort` composition

Create `src/compositions/OpinionShort.tsx` — 1080x1920, 30fps. Consumes `{ hookText: string; thenNowFirstLine: string; audio: { audioFile: string; duration: number } }`. Single Sequence, 55-65s. Reuses styling cues from `QuizShort` (dark theme, accent ring) but **does NOT import quiz code**.

**Done when**: `npx tsc --noEmit` clean.

---

## T7 — Register compositions

Edit `src/compositions/index.tsx` to add two `<Composition>` entries for `OpinionLong` and `OpinionShort` with their `calculateMetadata`. Use safe default props so studio preview doesn't crash.

**Done when**: `npx remotion studio` would list both (we don't run it; type-check is enough).

---

## T8 — Render orchestrator

Create `scripts/render-opinion-piece.ts`:

1. Read `content/opinions/<slug>.md`.
2. `parseOpinionPiece(md, slug)`.
3. Build a `narrationPlan: { type: string; narration: string }[]` from the opinion.
4. `generateSceneAudios(narrationPlan, 'en-IN-PrabhatNeural', 'indian-english')`.
5. Write a `output/opinions/<slug>/long-props.json` and `short-props.json`.
6. Shell out to `npx remotion render src/compositions/index.tsx OpinionLong …` — first with `--frames=0-900` for a 30s preview, then full (Constitution VII).
7. Shell out to `npx remotion render … OpinionShort` for the Short.
8. Write `metadata.json` with title, description, chapters, thumbnailText.

**Done when**: invoking `npx tsx scripts/render-opinion-piece.ts 001-microservices-vs-monolith --skip-render` writes the three JSON files without errors.

---

## T9 — Smoke render of Episode 001

Run the orchestrator end-to-end (with rendering enabled):

```bash
npx tsx scripts/render-opinion-piece.ts 001-microservices-vs-monolith
```

Verify:
- `output/opinions/001-microservices-vs-monolith/long.mp4` exists, duration 480-720s.
- `output/opinions/001-microservices-vs-monolith/short.mp4` exists, duration 55-65s.
- `npx tsc --noEmit` clean.

Document visual concerns (if any) in the final commit message.

**Done when**: both MP4s exist and meet the duration windows.

---

## T10 — Commit + push (NO MERGE)

Per Constitution X — commit each task atomically, push branch, do NOT open PR. Operator opens PR after reviewing T9 visuals.

**Done when**: `git status` clean on `006-opinion-piece-long`, branch pushed to origin.
