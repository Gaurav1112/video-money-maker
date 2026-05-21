# Feature Specification: Opinion-Piece Long-Form + Short Pipeline

**Feature Branch**: `006-opinion-piece-long`

**Created**: 2026-05-21

**Status**: Draft

**Input**: User description: "Author writes a leadership-opinion markdown file (e.g. the microservices `30-min pizza vs OTP verification` post). Pipeline emits an 8-12 min animated long-form video AND an optional 60s vertical Short cold-open. Episode 001 is the microservices piece."

---

## Why this exists

The 2026-05-20 brutal-truth review concluded the channel was failing to break out because the content lacks "perspective only you have" — generic quiz Shorts won't differentiate. Opinion-pieces (LinkedIn-style leadership essays) are the missing content type. This feature gives that content type a deterministic, repeatable pipeline.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Author renders a long-form opinion video from a markdown file (Priority: P1)

The author writes `content/opinions/<slug>.md` with frontmatter (title, slug, durationSec, publishDate) and a set of structured headed sections (`## Hook`, `## Then-vs-Now`, `## Pros`, `## Cons`, `## Pivot`, `## Lesson`, `## Question`). A single command turns that file into an 8-12 min long-form MP4 with chapter markers per section, generated via the new `OpinionLong` composition.

**Why this priority**: This is the differentiator that the brutal-truth review identified as missing. Without an opinion-piece path, the channel keeps shipping generic quiz Shorts.

**Independent Test**: Run `npx tsx scripts/render-opinion-piece.ts 001-microservices-vs-monolith` against the Episode 001 markdown. Verify (a) the resulting MP4 exists, (b) duration is between 480s and 720s, (c) `npx tsc --noEmit` exits clean.

**Acceptance Scenarios**:

1. **Given** a valid `content/opinions/001-microservices-vs-monolith.md` with all seven sections, **When** the author runs `npx tsx scripts/render-opinion-piece.ts 001-microservices-vs-monolith`, **Then** an MP4 is written to `output/opinions/001-microservices-vs-monolith/long.mp4` with duration between 8 and 12 minutes.
2. **Given** the same markdown, **When** the author re-runs the same command, **Then** the output is byte-equivalent (deterministic — same TTS cache hits, same scene timings).
3. **Given** the rendered MP4, **When** an operator inspects it, **Then** there is one logical chapter per section header in the markdown.

---

### User Story 2 - Same markdown produces a 60s vertical Short cold-open (Priority: P1)

From the same source markdown, the pipeline also emits a 60-second vertical (1080x1920) MP4 that uses only the `## Hook` section and the first `## Then-vs-Now` line as a cold-open. This is the cross-platform distribution unit for Instagram Reels / YouTube Shorts / TikTok.

**Why this priority**: Without a Shorts cut, the opinion-piece doesn't enter the discovery loop. Long-form alone cannot bootstrap an audience on YouTube in 2026.

**Independent Test**: Run the same `render-opinion-piece.ts` command. Verify `output/opinions/<slug>/short.mp4` exists, dimensions are 1080x1920, duration is between 55s and 65s.

**Acceptance Scenarios**:

1. **Given** Episode 001 markdown, **When** the render script runs, **Then** `short.mp4` is produced at 1080x1920, between 55s and 65s.
2. **Given** the Short, **When** played, **Then** the narration covers only the `## Hook` text plus the first `## Then-vs-Now` line — not the full essay.

---

### User Story 3 - Episode metadata is generated deterministically (Priority: P2)

YouTube title, description, chapter markers (`MM:SS Section`), and a thumbnail prompt are emitted as a JSON sidecar derived purely from the markdown frontmatter and section structure — no LLM call, no manual edit.

**Why this priority**: Upload automation (Feature 003/004) needs structured metadata. Today metadata is hand-curated; this blocks autonomous publishing of opinion pieces.

**Independent Test**: Render Episode 001 → assert `output/opinions/001-microservices-vs-monolith/metadata.json` exists and contains `title`, `description`, `chapters[]` (one per section), `thumbnailText`.

**Acceptance Scenarios**:

1. **Given** Episode 001 markdown with frontmatter `title: "Are Microservices Killing Customer Experience?"`, **When** the pipeline runs, **Then** `metadata.json.title` exactly equals that frontmatter title.
2. **Given** the long-form MP4 has scenes at known offsets, **When** metadata is generated, **Then** `metadata.json.chapters[]` contains one `{ start: number, label: string }` per section in `MM:SS` rounding.

---

### Edge Cases

- **Missing section**: If `## Pivot` (or any non-Hook section) is missing, the parser MUST throw a clear error naming the missing section. Hook is the only strictly mandatory section for the Short path.
- **Very long section**: A single section over 200 spoken words risks overflowing the 12-minute cap; the parser MUST warn and the renderer MUST still produce a video (allow up to 15 min hard cap before erroring).
- **Emoji / Unicode in body**: Section text contains emojis (✅ ❌ ➡️ ⚡ 🎯 😊 💡); these MUST pass through the parser unchanged and the visual components MUST render them. TTS preprocesses to drop emojis before narration.
- **Missing `## Question`**: Question section is optional. Long-form ends with `## Lesson` if Question absent; the Short never uses Question regardless.
- **Frontmatter missing `slug`**: Parser falls back to deriving the slug from the markdown filename (`001-microservices-vs-monolith.md` → `001-microservices-vs-monolith`).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST parse a markdown file with YAML frontmatter and named `##` sections into a typed `OpinionPiece` object — pure function, no I/O beyond reading the file.
- **FR-002**: System MUST produce an 8-12 min long-form MP4 at 1920x1080 from the parsed `OpinionPiece`, using the new `OpinionLong` composition.
- **FR-003**: System MUST produce a 55-65 second vertical MP4 at 1080x1920 from only the `## Hook` and first `## Then-vs-Now` line, using the new `OpinionShort` composition.
- **FR-004**: System MUST use Edge TTS voice `en-IN-PrabhatNeural` for all narration (Constitution VI).
- **FR-005**: System MUST render a 30-second preview pass before any full long-form render is invoked (Constitution VII).
- **FR-006**: System MUST NOT modify `LongVideo.tsx` or `script-generator.ts` (Constitution VIII — single-path; preserve the topic-quiz pipeline).
- **FR-007**: System MUST emit deterministic output: same markdown input → byte-equivalent MP4 across re-runs (Constitution I).
- **FR-008**: System MUST emit a `metadata.json` sidecar with `title`, `description`, `chapters[]`, `thumbnailText`.
- **FR-009**: System MUST throw a typed error naming the missing section if any required section (other than Question) is absent.
- **FR-010**: System MUST NOT make any network call other than the Edge TTS call already used by the existing `tts-engine` (Constitution II).
- **FR-011**: System MUST place the `guru-avatar-crop.png` avatar in the long-form composition; the raw photo MUST NEVER be referenced.

### Key Entities

- **OpinionPiece**: parsed representation of a `.md` file. Fields: `slug`, `title`, `publishDate`, `durationSec`, `hook` (string), `thenNow` ({ thenLines: string[]; nowLines: string[] }), `pros` (string[]), `cons` (string[]), `pivot` (string), `lesson` (string), `question?` (string).
- **OpinionScene**: discriminated union of the four visual scene types used by `OpinionLong`: `'opinion-hook'`, `'opinion-then-now'`, `'opinion-pros-cons'`, `'opinion-pivot'`, `'opinion-lesson'`, `'opinion-question'`. Each carries narration + duration + section-specific payload.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Episode 001 renders to a long-form MP4 whose duration falls between 480s and 720s.
- **SC-002**: Episode 001 renders to a Short MP4 whose duration falls between 55s and 65s.
- **SC-003**: `npx tsc --noEmit` exits clean (0 new type errors introduced).
- **SC-004**: `npx vitest run src/lib/__tests__/opinion-piece-parser.test.ts` passes with ≥ 6 test cases (one per major section + at least one edge case).
- **SC-005**: `metadata.json` contains exactly one chapter per `##` header in the source markdown.

---

## Constitution Alignment Checklist

| Principle | How this feature complies |
| --- | --- |
| I. Deterministic | Parser is pure; no LLM calls; Remotion render is deterministic by default. |
| II. All-Local | Only network egress is Edge TTS (already approved by existing pipeline). |
| III. Automation | One command renders both formats + metadata; no manual steps. |
| IV. Measure | Long-form metadata sidecar lets analytics jobs (Feature 003) ingest opinion-piece IDs. |
| V. Subtraction | Reuses existing TTS, BGM, avatar, theme — no new overlay system added. |
| VI. Indian voice + avatar | Hardcodes `en-IN-PrabhatNeural` + `guru-avatar-crop.png`. |
| VII. Render-preview-first | Render script always emits a 30s preview before the full long-form render. |
| VIII. Single-path | New composition (`OpinionLong`) — does NOT mutate `LongVideo.tsx`. New orchestrator script — does NOT mutate `script-generator.ts`. |
| IX. Secrets | No secrets read or written. |
| X. Branch-per-feature | All work on `006-opinion-piece-long`. |

---

## Assumptions

- The author writes markdown by hand or via an LLM at content-authoring time (not at render time) — the renderer never calls an LLM.
- Edge TTS service remains available (or the existing Kokoro/macOS fallback chain kicks in).
- The existing `tts-engine.generateSceneAudios` function can be reused with arbitrary section narration strings.
- 8-12 min long-form length is achievable from ~700 narration words at Edge TTS PrabhatNeural pace (~135 wpm).
- Episode 001's markdown is the canonical fixture for the parser test suite.
