# Viral Shorts 10/10 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring quiz Shorts to ≥70% median completion rate via closed-loop measurement, retention bug fixes, and free-leverage additions — zero spend.

**Architecture:** Closed-loop optimization. Tier 0 wires up YouTube Analytics ingestion (no fix is ship-able without it). Tier 1 deletes retention killers (end-black, audio/duration mismatch, hook clutter, blank thumbnail, wrong categoryId, unvalidated titles). Tier 2 adds high-leverage features (burned captions, SFX, loudnorm, SRT, end CTA). Tier 3 polishes (description length, hook autofit, cron schedule). Explicit ship gate between each tier — no proceeding without evidence.

**Tech Stack:** Remotion 4, TypeScript, vitest, ffmpeg, googleapis (YouTube Data + YouTube Analytics), Edge TTS (`en-IN-PrabhatNeural`).

**Spec:** `docs/superpowers/specs/2026-05-20-viral-shorts-10outof10-design.md`

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| **Create** | `scripts/ingest-analytics.ts` | Pull per-video metrics from YouTube Analytics API; write `data/analytics/<videoId>.json`. |
| **Create** | `scripts/weekly-report.ts` | Aggregate JSONs into Markdown report; highlights regressions vs prior week. |
| **Create** | `scripts/lib/youtube-analytics-client.ts` | Thin wrapper over `googleapis` analytics client. Reuses `getYouTubeAuthClient`. |
| **Create** | `scripts/validate-quizzes.ts` | CI gate. Fails if any quiz title > 60 chars, options ≠ 3, or endQuestion empty. |
| **Create** | `src/lib/srt.ts` | Pure function: word timestamps → SRT string. Vitest-tested. |
| **Create** | `src/components/EndCardCTA.tsx` | Last-1.5s overlay showing `quiz.endQuestion`. |
| **Create** | `.github/workflows/analytics.yml` | Daily cron — runs `ingest-analytics.ts`, commits JSONs. |
| **Create** | `data/analytics/.gitkeep` | Directory placeholder. |
| **Create** | `src/lib/__tests__/srt.test.ts` | TDD for SRT generation. |
| **Create** | `scripts/__tests__/validate-quizzes.test.ts` | TDD for quiz validation. |
| **Create** | `scripts/__tests__/ingest-analytics.test.ts` | TDD for the per-video JSON shape (uses fixture). |
| **Modify** | `src/compositions/QuizShort.tsx` | Audio-driven duration; cut LoopTrigger phase 3 (end-black); frame-0 hook visible; delete `warning-triangle` + bottom red bar + smaller avatar; import CaptionOverlay (explain only); inline SFX `<Sequence>` cues; BGM → `study-pad.mp3`; add `<EndCardCTA>`; `calculateMetadata` reads audio duration from props. |
| **Modify** | `src/compositions/index.tsx` | Pass `calculateMetadata` to `<Composition id="QuizShort">`. |
| **Modify** | `scripts/render-daily-short.ts` | Pass `audioDurationSec` + `wordTimestamps` as props; `categoryId 27→28`; emit `.srt`; emit `-thumbnail.jpg` via Remotion still; post-render ffmpeg two-pass loudnorm; description expanded to ≥150 words. |
| **Modify** | `scripts/upload-youtube.ts` | Add `--captions <srt>` and `--thumbnail <jpg>` flags; call `captions().insert()` and `thumbnails().set()`. |
| **Modify** | `.github/workflows/auto-shorts.yml` | Cron schedule audit (`45 7 * * 1,3,5` UTC = 1:15 PM IST Mon/Wed/Fri). |

---

## Tier 0 — Measurement (prerequisite)

### Task 1: YouTube Analytics client wrapper

**Files:**
- Create: `scripts/lib/youtube-analytics-client.ts`

- [ ] **Step 1: Inspect existing YouTube OAuth helper**

Run: `grep -n "export" scripts/lib/youtube-oauth.ts`
Expected: `getYouTubeAuthClient` is exported. We will reuse it.

- [ ] **Step 2: Create the wrapper**

```typescript
// scripts/lib/youtube-analytics-client.ts
import { google, youtubeAnalytics_v2 } from 'googleapis';
import { getYouTubeAuthClient } from './youtube-oauth.js';

export interface VideoMetrics {
  videoId: string;
  fetchedAt: string;           // ISO datetime
  views: number;
  likes: number;
  comments: number;
  averageViewDuration: number; // seconds
  averageViewPercentage: number; // 0-100
  shares: number;
  estimatedMinutesWatched: number;
}

export async function getYouTubeAnalyticsClient(): Promise<youtubeAnalytics_v2.Youtubeanalytics> {
  const auth = await getYouTubeAuthClient();
  return google.youtubeAnalytics({ version: 'v2', auth });
}

/**
 * Pull aggregate per-video metrics for the last `days` days.
 * Returns one VideoMetrics per video.
 */
export async function fetchVideoMetrics(videoIds: string[], days = 30): Promise<VideoMetrics[]> {
  if (videoIds.length === 0) return [];
  const analytics = await getYouTubeAnalyticsClient();
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const out: VideoMetrics[] = [];
  for (const videoId of videoIds) {
    const resp = await analytics.reports.query({
      ids: 'channel==MINE',
      startDate, endDate,
      metrics: 'views,likes,comments,averageViewDuration,averageViewPercentage,shares,estimatedMinutesWatched',
      filters: `video==${videoId}`,
    });
    const row = resp.data.rows?.[0];
    if (!row) continue;
    out.push({
      videoId,
      fetchedAt: new Date().toISOString(),
      views: Number(row[0] ?? 0),
      likes: Number(row[1] ?? 0),
      comments: Number(row[2] ?? 0),
      averageViewDuration: Number(row[3] ?? 0),
      averageViewPercentage: Number(row[4] ?? 0),
      shares: Number(row[5] ?? 0),
      estimatedMinutesWatched: Number(row[6] ?? 0),
    });
  }
  return out;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit scripts/lib/youtube-analytics-client.ts 2>&1 | head -20`
Expected: No errors. Warnings about missing `youtubeAnalytics_v2` types are OK if they appear — adjust import path if needed.

- [ ] **Step 4: Commit**

```bash
git add scripts/lib/youtube-analytics-client.ts
git commit -m "feat(analytics): YouTube Analytics client wrapper"
```

---

### Task 2: Analytics ingestion script

**Files:**
- Create: `scripts/ingest-analytics.ts`
- Create: `data/analytics/.gitkeep`
- Create: `scripts/__tests__/ingest-analytics.test.ts`

- [ ] **Step 1: Create data directory + placeholder**

Run: `mkdir -p data/analytics && touch data/analytics/.gitkeep`
Expected: Directory exists with empty `.gitkeep`.

- [ ] **Step 2: Write the failing test**

```typescript
// scripts/__tests__/ingest-analytics.test.ts
import { describe, it, expect } from 'vitest';
import { buildVideoIdList, persistMetrics } from '../ingest-analytics';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('buildVideoIdList', () => {
  it('extracts videoIds from upload-result JSONs', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-'));
    fs.writeFileSync(path.join(tmp, 'a.upload-result.json'), JSON.stringify({ videoId: 'aaa' }));
    fs.writeFileSync(path.join(tmp, 'b.upload-result.json'), JSON.stringify({ videoId: 'bbb' }));
    fs.writeFileSync(path.join(tmp, 'c.mp4'), 'not a result');
    const ids = buildVideoIdList(tmp);
    expect(ids.sort()).toEqual(['aaa', 'bbb']);
  });
});

describe('persistMetrics', () => {
  it('writes one JSON per video keyed by videoId', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-out-'));
    persistMetrics(tmp, [
      { videoId: 'xyz', fetchedAt: '2026-05-20T00:00:00Z', views: 100, likes: 5, comments: 1,
        averageViewDuration: 12, averageViewPercentage: 60, shares: 0, estimatedMinutesWatched: 20 },
    ]);
    const written = fs.readFileSync(path.join(tmp, 'xyz.json'), 'utf8');
    expect(JSON.parse(written).views).toBe(100);
  });
});
```

- [ ] **Step 3: Run the test — confirm failure**

Run: `npx vitest run scripts/__tests__/ingest-analytics.test.ts`
Expected: FAIL with "Cannot find module '../ingest-analytics'".

- [ ] **Step 4: Implement ingest-analytics.ts**

```typescript
// scripts/ingest-analytics.ts
#!/usr/bin/env npx tsx
import * as fs from 'fs';
import * as path from 'path';
import { fetchVideoMetrics, VideoMetrics } from './lib/youtube-analytics-client';

const UPLOAD_DIRS = [
  'output/daily-short',
  'output/shorts',
];
const OUT_DIR = 'data/analytics';

export function buildVideoIdList(uploadsDir: string): string[] {
  if (!fs.existsSync(uploadsDir)) return [];
  return fs.readdirSync(uploadsDir)
    .filter(f => f.endsWith('.upload-result.json'))
    .flatMap(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(uploadsDir, f), 'utf8'));
        return data.videoId ? [data.videoId as string] : [];
      } catch { return []; }
    });
}

export function persistMetrics(outDir: string, metrics: VideoMetrics[]): void {
  fs.mkdirSync(outDir, { recursive: true });
  for (const m of metrics) {
    fs.writeFileSync(path.join(outDir, `${m.videoId}.json`), JSON.stringify(m, null, 2));
  }
}

async function main() {
  const videoIds = [...new Set(UPLOAD_DIRS.flatMap(buildVideoIdList))];
  console.log(`Ingesting analytics for ${videoIds.length} videos...`);
  if (videoIds.length === 0) {
    console.log('No upload-result.json files found. Nothing to ingest.');
    return;
  }
  const metrics = await fetchVideoMetrics(videoIds, 30);
  persistMetrics(OUT_DIR, metrics);
  console.log(`Wrote ${metrics.length} metric files to ${OUT_DIR}/`);
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}
```

- [ ] **Step 5: Run test — confirm pass**

Run: `npx vitest run scripts/__tests__/ingest-analytics.test.ts`
Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/ingest-analytics.ts scripts/__tests__/ingest-analytics.test.ts data/analytics/.gitkeep
git commit -m "feat(analytics): ingest YouTube Analytics into data/analytics/"
```

---

### Task 3: Weekly report generator

**Files:**
- Create: `scripts/weekly-report.ts`

- [ ] **Step 1: Implement weekly-report.ts**

```typescript
// scripts/weekly-report.ts
#!/usr/bin/env npx tsx
import * as fs from 'fs';
import * as path from 'path';
import type { VideoMetrics } from './lib/youtube-analytics-client';

const ANALYTICS_DIR = 'data/analytics';

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function loadAll(): VideoMetrics[] {
  if (!fs.existsSync(ANALYTICS_DIR)) return [];
  return fs.readdirSync(ANALYTICS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(ANALYTICS_DIR, f), 'utf8')) as VideoMetrics);
}

function main() {
  const all = loadAll();
  if (all.length === 0) {
    console.log('# Weekly Report\n\nNo analytics data yet.');
    return;
  }
  const completionPct = all.map(m => m.averageViewPercentage);
  const views = all.map(m => m.views);
  const lines = [
    `# Weekly Report — ${new Date().toISOString().slice(0, 10)}`,
    '',
    `**Videos analyzed:** ${all.length}`,
    `**Median completion %:** ${median(completionPct).toFixed(1)}%  (target: ≥70%)`,
    `**Median views:** ${median(views).toFixed(0)}`,
    `**Median comments per 1k views:** ${(median(all.map(m => (m.comments / Math.max(1, m.views)) * 1000))).toFixed(2)}`,
    '',
    '## Per-Video',
    '',
    '| Video | Views | Completion % | AVD (s) | Likes | Comments |',
    '|---|---|---|---|---|---|',
    ...all
      .sort((a, b) => b.averageViewPercentage - a.averageViewPercentage)
      .map(m =>
        `| \`${m.videoId}\` | ${m.views} | ${m.averageViewPercentage.toFixed(1)}% | ${m.averageViewDuration.toFixed(1)} | ${m.likes} | ${m.comments} |`),
  ];
  console.log(lines.join('\n'));
}

if (require.main === module) main();
```

- [ ] **Step 2: Smoke test the empty case**

Run: `npx tsx scripts/weekly-report.ts`
Expected: Outputs `# Weekly Report` heading; no crash even if `data/analytics/` is empty.

- [ ] **Step 3: Commit**

```bash
git add scripts/weekly-report.ts
git commit -m "feat(analytics): weekly Markdown report from data/analytics/"
```

---

### Task 4: Analytics GitHub Actions workflow

**Files:**
- Create: `.github/workflows/analytics.yml`

- [ ] **Step 1: Create the workflow**

```yaml
# .github/workflows/analytics.yml
name: Daily Analytics Ingestion

on:
  schedule:
    - cron: '0 4 * * *'   # 4:00 UTC daily = 9:30 AM IST
  workflow_dispatch:

permissions:
  contents: write

jobs:
  ingest:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    env:
      YOUTUBE_CLIENT_ID: ${{ secrets.YOUTUBE_CLIENT_ID }}
      YOUTUBE_CLIENT_SECRET: ${{ secrets.YOUTUBE_CLIENT_SECRET }}
      YOUTUBE_REFRESH_TOKEN: ${{ secrets.YOUTUBE_REFRESH_TOKEN }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx tsx scripts/ingest-analytics.ts
      - run: npx tsx scripts/weekly-report.ts > data/analytics/weekly-report.md
      - name: Commit analytics
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/analytics/
          git diff --staged --quiet || git commit -m "chore(analytics): daily ingestion $(date -u +%Y-%m-%d)"
          git push
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/analytics.yml
git commit -m "ci(analytics): daily ingestion workflow"
```

---

### Gate 0 — Analytics pipeline verification

- [ ] **Step 1: Run locally against existing uploads**

Run: `npx tsx scripts/ingest-analytics.ts`
Expected: Logs how many videos found, writes JSONs to `data/analytics/`. (May fail if no `.upload-result.json` files exist yet — that's OK; document and proceed.)

- [ ] **Step 2: Verify report renders**

Run: `npx tsx scripts/weekly-report.ts`
Expected: Markdown report prints with median completion %.

- [ ] **Step 3: Gate decision**

If ingestion succeeded for ≥1 video: proceed to Tier 1. If no uploads exist yet: document in commit message and proceed — Tier 1 will produce the first uploads.

---

## Tier 1 — Retention bug fixes

### Task 5: Title length validator (CI gate)

**Files:**
- Create: `scripts/validate-quizzes.ts`
- Create: `scripts/__tests__/validate-quizzes.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// scripts/__tests__/validate-quizzes.test.ts
import { describe, it, expect } from 'vitest';
import { validateQuizzes } from '../validate-quizzes';
import type { QuizQuestion } from '../../src/lib/quiz-content';

const good: QuizQuestion = {
  topic: 'kafka',
  hookText: 'h',
  spokenHook: 'h',
  question: 'q?',
  options: ['a', 'b', 'c'],
  correctIndex: 0,
  explanation: 'e',
  twist: 't',
  endQuestion: 'eq?',
  title: 'Short title',
};

describe('validateQuizzes', () => {
  it('passes well-formed quizzes', () => {
    expect(validateQuizzes([good])).toEqual([]);
  });
  it('flags title > 60 chars', () => {
    const bad = { ...good, title: 'x'.repeat(61) };
    const errs = validateQuizzes([bad]);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatch(/title.*61.*60/);
  });
  it('flags options length != 3', () => {
    const bad = { ...good, options: ['a', 'b'] as any };
    expect(validateQuizzes([bad])).toContainEqual(expect.stringMatching(/options/));
  });
  it('flags empty endQuestion', () => {
    const bad = { ...good, endQuestion: '' };
    expect(validateQuizzes([bad])).toContainEqual(expect.stringMatching(/endQuestion/));
  });
});
```

- [ ] **Step 2: Run — confirm failure**

Run: `npx vitest run scripts/__tests__/validate-quizzes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement validator**

```typescript
// scripts/validate-quizzes.ts
#!/usr/bin/env npx tsx
import { QUIZ_BANK, type QuizQuestion } from '../src/lib/quiz-content';

const MAX_TITLE_LEN = 60;

export function validateQuizzes(quizzes: QuizQuestion[]): string[] {
  const errors: string[] = [];
  for (const [i, q] of quizzes.entries()) {
    const ref = `[${i}] ${q.topic} "${q.title.slice(0, 30)}"`;
    if (q.title.length > MAX_TITLE_LEN) {
      errors.push(`${ref}: title is ${q.title.length} chars, max ${MAX_TITLE_LEN}`);
    }
    if (q.options.length !== 3) {
      errors.push(`${ref}: options.length is ${q.options.length}, expected 3`);
    }
    if (!q.endQuestion?.trim()) {
      errors.push(`${ref}: endQuestion is empty`);
    }
  }
  return errors;
}

function main() {
  const errors = validateQuizzes(QUIZ_BANK);
  if (errors.length) {
    console.error(`Validation failed (${errors.length} errors):`);
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log(`✓ All ${QUIZ_BANK.length} quizzes valid.`);
}

if (require.main === module) main();
```

- [ ] **Step 4: Run test — confirm pass**

Run: `npx vitest run scripts/__tests__/validate-quizzes.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Run validator against real quiz bank**

Run: `npx tsx scripts/validate-quizzes.ts`
Expected: Either `✓ All N quizzes valid.` or a list of flagged quizzes. **If flagged: manually edit `src/lib/quiz-content.ts` to shorten titles to ≤60 chars before proceeding.**

- [ ] **Step 6: Commit**

```bash
git add scripts/validate-quizzes.ts scripts/__tests__/validate-quizzes.test.ts
# also stage any quiz-content.ts edits if titles needed shortening:
git add src/lib/quiz-content.ts 2>/dev/null || true
git commit -m "feat(quiz): validate-quizzes CI gate (title ≤60 chars, options=3, endQuestion present)"
```

---

### Task 6: Fix categoryId 27 → 28

**Files:**
- Modify: `scripts/render-daily-short.ts` (the `categoryId` line)

- [ ] **Step 1: Locate the line**

Run: `grep -n "categoryId" scripts/render-daily-short.ts`
Expected: One match, currently `categoryId: '27'`.

- [ ] **Step 2: Edit**

Change:
```typescript
      categoryId: '27', // Education
```
to:
```typescript
      categoryId: '28', // Science & Technology (per optimal_schedule memory)
```

- [ ] **Step 3: Commit**

```bash
git add scripts/render-daily-short.ts
git commit -m "fix(metadata): categoryId 27 → 28 for better tech algo signal"
```

---

### Task 7: Audio-driven composition duration (calculateMetadata)

**Files:**
- Modify: `src/compositions/QuizShort.tsx`
- Modify: `src/compositions/index.tsx`
- Modify: `scripts/render-daily-short.ts`

This is the trickiest single task in the plan. It allows narration of any length (18-30s) to drive composition duration, fixing trailing-silence and mid-twist-cutoff bugs.

- [ ] **Step 1: Extend QuizShort props with `audioDurationSec`**

In `src/compositions/QuizShort.tsx`, modify the interface:

```typescript
interface QuizShortProps {
  quiz: QuizQuestion;
  audioFile?: string;
  /** Total narration duration in seconds. Drives composition length. */
  audioDurationSec?: number;
}
```

- [ ] **Step 2: Derive phase boundaries from audioDurationSec**

Replace the top-of-file constants:

```typescript
const FPS = 30;
const DEFAULT_DURATION_S = 25;

// Phase ratios within total duration (sums to 1.0)
const HOOK_RATIO = 2 / 25;        // 0-2s of 25s baseline
const QUESTION_RATIO = 4 / 25;    // +4s for question reveal
const FLASH_RATIO = 0.5 / 25;     // +0.5s for flash cut
const LOOP_RATIO = 2.5 / 25;      // last 2.5s for "But wait..." loop trigger
```

Inside `QuizShort`, derive frame counts from props:

```typescript
export const QuizShort: React.FC<QuizShortProps> = ({ quiz, audioFile, audioDurationSec }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: TOTAL_FRAMES } = useVideoConfig();

  const HOOK_END = Math.round(HOOK_RATIO * TOTAL_FRAMES);
  const QUESTION_END = HOOK_END + Math.round(QUESTION_RATIO * TOTAL_FRAMES);
  const FLASH_END = QUESTION_END + Math.round(FLASH_RATIO * TOTAL_FRAMES);
  const LOOP_START = TOTAL_FRAMES - Math.round(LOOP_RATIO * TOTAL_FRAMES);
  const EXPLAIN_END = LOOP_START;
  // ... rest unchanged, but references to constants now use these locals
```

**Subcomponent fix:** Only `OptionCard` reads the module-level constants directly (it uses `HOOK_END` for `entryFrame` and `FLASH_END` for `revealAge`). Update its props and the call site:

```typescript
// Update OptionCard signature:
const OptionCard: React.FC<{
  label: string; text: string; index: number;
  revealed: boolean; isCorrect: boolean;
  compact?: boolean;
  hookEnd: number;     // <-- new
  flashEnd: number;    // <-- new
}> = ({ label, text, index, revealed, isCorrect, compact = false, hookEnd, flashEnd }) => {
  // Inside, replace HOOK_END with hookEnd and FLASH_END with flashEnd.
```

And the call site inside `QuizShort`:

```tsx
<OptionCard
  key={i}
  label={String.fromCharCode(65 + i)}
  text={opt}
  index={i}
  revealed={isRevealed}
  isCorrect={i === quiz.correctIndex}
  compact={isExplainPhase || isLoopPhase}
  hookEnd={HOOK_END}
  flashEnd={FLASH_END}
/>
```

Other helpers (`KeyPhraseReveal`, `FlashCut`, `LoopTrigger`, `DramaticFlash`) already take their phase frames as props — no change needed.

Inside the main `QuizShort` body, the existing references to `TOTAL_FRAMES` in the audio fadeout and progress-bar calculations should be replaced with the `TOTAL_FRAMES` local destructured from `useVideoConfig`. No code change needed if you destructured as shown above.

- [ ] **Step 3: Export calculateMetadata**

At the bottom of `QuizShort.tsx`:

```typescript
export const calculateQuizShortMetadata: CalculateMetadataFunction<QuizShortProps> = ({ props }) => {
  const seconds = props.audioDurationSec ?? DEFAULT_DURATION_S;
  return {
    durationInFrames: Math.ceil(seconds * FPS) + FPS, // audio + 1s tail
    fps: FPS,
    width: 1080,
    height: 1920,
  };
};
```

Add at top: `import type { CalculateMetadataFunction } from 'remotion';`

- [ ] **Step 4: Wire calculateMetadata in index.tsx**

In `src/compositions/index.tsx`, change the `<Composition id="QuizShort">` element:

```tsx
<Composition
  id="QuizShort"
  component={asCompositionComponent(QuizShort)}
  calculateMetadata={calculateQuizShortMetadata}
  durationInFrames={750}   // fallback default
  fps={30}
  width={1080}
  height={1920}
  defaultProps={{ quiz: /* unchanged */ }}
/>
```

Remove the spread `{...calculateQuizShortMetadata()}` (it's no longer a no-arg function).

- [ ] **Step 5: Pass audioDurationSec from render-daily-short.ts**

In `scripts/render-daily-short.ts`, after audio generation:

```typescript
  const audioDuration = audioResults[0]?.duration ?? 25;
  // ...
  const propsData = {
    quiz,
    audioFile: storyboard.audioFile ? path.basename(storyboard.audioFile) : undefined,
    audioDurationSec: audioDuration,
  };
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "QuizShort|render-daily-short" | head -20`
Expected: No new errors.

- [ ] **Step 7: Render smoke test**

Run: `npx tsx scripts/render-daily-short.ts --short 0`
Expected: Renders. Final duration ≈ audio + 1s (~ 22-27s depending on quiz).

- [ ] **Step 8: Verify duration**

Run: `ffprobe -v error -show_entries format=duration -of csv=p=0 output/daily-short/kafka-quiz-0.mp4`
Expected: A value within audio_duration ± 1s.

- [ ] **Step 9: Commit**

```bash
git add src/compositions/QuizShort.tsx src/compositions/index.tsx scripts/render-daily-short.ts
git commit -m "fix(quiz): audio-driven composition duration via calculateMetadata"
```

---

### Task 8: Cut LoopTrigger phase-3 black screen

**Files:**
- Modify: `src/compositions/QuizShort.tsx` (the `LoopTrigger` component)

- [ ] **Step 1: Locate LoopTrigger**

Run: `grep -n "LoopTrigger\|Hard cut to black" src/compositions/QuizShort.tsx`
Expected: Component starts around line 569; phase-3 black at ~line 638.

- [ ] **Step 2: Delete phase 3**

In the `LoopTrigger` component, after the `phase2End` block, **delete** the final `return <AbsoluteFill ... backgroundColor: '#000000' />` block. Replace with `return null;`.

```typescript
  if (age < phase2End) {
    // ... unchanged
  }

  return null; // <-- previously: <AbsoluteFill backgroundColor: #000 />
```

- [ ] **Step 3: Also tighten LoopTrigger duration**

Since Task 7 already made `LOOP_RATIO = 2.5/25` (2.5s at 25s baseline), the LoopTrigger phase1 (1s) + phase2 (1.5s) sum exactly to 2.5s. No black tail.

If you locally see `phase2End = 2.5 * fps` (= 75 frames), confirm it matches `Math.round(LOOP_RATIO * TOTAL_FRAMES)` derived in Task 7. Adjust phase2End if needed:

```typescript
const phase1End = Math.round(1 * fps);  // 30 frames
const phase2End = Math.round(2.5 * fps); // 75 frames
```

- [ ] **Step 4: Render + visually verify**

Run: `npx tsx scripts/render-daily-short.ts --short 0`
Then run: `ffprobe -v error -show_entries format=duration -of csv=p=0 output/daily-short/kafka-quiz-0.mp4`
And: `ffmpeg -ss 00:00:23 -i output/daily-short/kafka-quiz-0.mp4 -vframes 1 /tmp/last-frame.png 2>&1 | tail -3`
Open `/tmp/last-frame.png`. Expected: **NOT black** — should show "But wait..." or "Most tutorials..." overlay.

- [ ] **Step 5: Commit**

```bash
git add src/compositions/QuizShort.tsx
git commit -m "fix(quiz): drop LoopTrigger phase-3 black screen (was 2.5s retention killer)"
```

---

### Task 9: Frame-0 thumbnail readability + explicit thumbnail JPG

**Files:**
- Modify: `src/compositions/QuizShort.tsx` (hook block — frame-0 visibility)
- Modify: `scripts/render-daily-short.ts` (thumbnail export)
- Modify: `scripts/upload-youtube.ts` (thumbnail upload)

- [ ] **Step 1: Make hook visible at frame 0**

In `QuizShort.tsx`, locate the hook block (`isHookPhase` AbsoluteFill, currently using `spring()` for the bold text container). Replace the spring-from-zero with a clamped spring that starts visible:

```typescript
{(() => {
  // Frame-0 must show the hook readably (YouTube auto-grabs early frames as thumbnail).
  const s = spring({ frame, fps, config: { stiffness: 180, damping: 12, mass: 0.7 } });
  const opacity = Math.max(0.85, interpolate(s, [0, 1], [0.85, 1]));
  const scale = interpolate(s, [0, 1], [0.92, 1]);
  const lines = hookText.split('\n');
  return (
    <div style={{
      transform: `scale(${scale})`,
      opacity,
      textAlign: 'center',
      padding: '0 50px',
    }}>
      {/* unchanged inner lines.map(...) */}
    </div>
  );
})()}
```

- [ ] **Step 2: Add thumbnail export to render-daily-short.ts**

After the main `execSync(renderCmd, ...)` line, add:

```typescript
  // ── Export frame-0 thumbnail ──
  const thumbnailPath = path.join(OUTPUT_DIR, `${episodeId}-thumbnail.jpg`);
  const thumbCmd = [
    'npx', 'remotion', 'still',
    'src/compositions/index.tsx',
    'QuizShort',
    thumbnailPath,
    `--props=${propsPath}`,
    '--frame=0',
    '--image-format=jpeg',
    '--jpeg-quality=92',
  ].join(' ');
  try {
    execSync(thumbCmd, { stdio: 'inherit', cwd: PROJECT_ROOT });
    console.log(`   Thumbnail: ${thumbnailPath}`);
  } catch (err) {
    console.warn(`   [warn] thumbnail export failed; YouTube will auto-pick`);
  }
```

- [ ] **Step 3: Add --thumbnail flag to upload-youtube.ts**

In `scripts/upload-youtube.ts`, near the existing CLI flag parsing (search for `--shorts`):

```typescript
  const thumbnailIdx = process.argv.indexOf('--thumbnail');
  const thumbnailPath = thumbnailIdx > -1 ? process.argv[thumbnailIdx + 1] : undefined;
```

After the existing `youtube.videos.insert()` call returns a `videoId`, add:

```typescript
  if (thumbnailPath && fs.existsSync(thumbnailPath)) {
    await youtube.thumbnails.set({
      videoId,
      media: { mimeType: 'image/jpeg', body: fs.createReadStream(thumbnailPath) },
    });
    console.log(`   ✓ Custom thumbnail uploaded`);
  }
```

- [ ] **Step 4: Wire --thumbnail in render-daily-short.ts (if it invokes upload)**

If `scripts/render-daily-short.ts` does NOT invoke upload (it doesn't in current code), then the auto-shorts workflow must pass the flag. Add to `.github/workflows/auto-shorts.yml` in Task 17 (Tier 3).

- [ ] **Step 5: Smoke test**

Run: `npx tsx scripts/render-daily-short.ts --short 0`
Then: `open output/daily-short/kafka-quiz-0-thumbnail.jpg`
Expected: Image shows hook text legibly (not blank).

- [ ] **Step 6: Commit**

```bash
git add src/compositions/QuizShort.tsx scripts/render-daily-short.ts scripts/upload-youtube.ts
git commit -m "fix(thumbnail): readable frame-0 + explicit thumbnail upload via API"
```

---

### Task 10: Hook clutter reduction

**Files:**
- Modify: `src/compositions/QuizShort.tsx` (hook block)

- [ ] **Step 1: Delete the warning-triangle Lottie overlay**

In `QuizShort.tsx` hook block (`isHookPhase`), **remove** the `<LottieOverlay file="lottie/warning-triangle.json" ... />` block entirely.

- [ ] **Step 2: Remove the bottom red bar**

In the same hook block, find the two `<div style={{ position: 'absolute', ...accent bars... }}>` elements. **Delete** the bottom one (the one with `bottom: 0`), keep the top one.

- [ ] **Step 3: Shrink avatar from 140 → 110px**

Find the hook block's avatar container:

```typescript
width: 140, height: 140, borderRadius: '50%',
```

Change to:

```typescript
width: 110, height: 110, borderRadius: '50%',
```

And adjust `border: 4px → 3px` and the `boxShadow` blur 30px → 20px to keep it visually balanced.

- [ ] **Step 4: Render + visual check**

Run: `npx tsx scripts/render-daily-short.ts --short 0`
Open the result. Expected: hook still impactful, less busy; avatar is smaller, only top red bar, no warning triangle.

- [ ] **Step 5: Commit**

```bash
git add src/compositions/QuizShort.tsx
git commit -m "refactor(quiz hook): delete warning triangle + bottom bar; smaller avatar"
```

---

### Gate 1 — Tier 1 verification

- [ ] **Step 1: Type-check the whole repo**

Run: `npx tsc --noEmit 2>&1 | grep -v "broll\|ffmpeg-bin\|sadtalker" | head -20`
Expected: No errors related to QuizShort or render-daily-short.

- [ ] **Step 2: Render a baseline Short**

Run: `npx tsx scripts/render-daily-short.ts --short 0`
Then: `ffprobe -v error -show_entries format=duration -of csv=p=0 output/daily-short/kafka-quiz-0.mp4`
Expected: Duration matches `audioDuration + 1s`.

- [ ] **Step 3: Visual sanity**

```bash
ffmpeg -ss 00:00:00 -i output/daily-short/kafka-quiz-0.mp4 -vframes 1 /tmp/f0.png
ffmpeg -ss 00:00:22 -i output/daily-short/kafka-quiz-0.mp4 -vframes 1 /tmp/flast.png
open /tmp/f0.png /tmp/flast.png
```
Expected:
- `/tmp/f0.png` shows readable hook text + avatar (NOT blank).
- `/tmp/flast.png` shows "But wait..." or "Most tutorials..." overlay (NOT pure black).

- [ ] **Step 4: Upload one Short (optional, manual)**

If you want to gather analytics now, manually upload and tag the Short. Otherwise the next auto-shorts run will pick it up.

- [ ] **Step 5: Gate decision**

If Steps 1-3 pass, proceed to Tier 2. If not, fix and re-verify.

---

## Tier 2 — Free-leverage additions

### Task 11: SRT generation utility (TDD)

**Files:**
- Create: `src/lib/srt.ts`
- Create: `src/lib/__tests__/srt.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/srt.test.ts
import { describe, it, expect } from 'vitest';
import { wordTimestampsToSrt } from '../srt';

describe('wordTimestampsToSrt', () => {
  it('returns empty string for no words', () => {
    expect(wordTimestampsToSrt([])).toBe('');
  });

  it('groups words into ~6-word cues', () => {
    const words = Array.from({ length: 12 }, (_, i) => ({
      word: `w${i}`, start: i * 0.5, end: (i + 1) * 0.5,
    }));
    const srt = wordTimestampsToSrt(words, { wordsPerCue: 6 });
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:03,000\nw0 w1 w2 w3 w4 w5\n');
    expect(srt).toContain('2\n00:00:03,000 --> 00:00:06,000\nw6 w7 w8 w9 w10 w11\n');
  });

  it('handles single word', () => {
    const srt = wordTimestampsToSrt([{ word: 'Hello', start: 0, end: 1.234 }]);
    expect(srt).toBe('1\n00:00:00,000 --> 00:00:01,234\nHello\n\n');
  });
});
```

- [ ] **Step 2: Run — confirm failure**

Run: `npx vitest run src/lib/__tests__/srt.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/lib/srt.ts

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface SrtOptions {
  wordsPerCue?: number;
}

function fmtTime(t: number): string {
  const ms = Math.round(t * 1000);
  const hh = String(Math.floor(ms / 3_600_000)).padStart(2, '0');
  const mm = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, '0');
  const ss = String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0');
  const mmm = String(ms % 1000).padStart(3, '0');
  return `${hh}:${mm}:${ss},${mmm}`;
}

export function wordTimestampsToSrt(
  words: WordTimestamp[],
  opts: SrtOptions = {},
): string {
  if (words.length === 0) return '';
  const wordsPerCue = opts.wordsPerCue ?? 6;
  const cues: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerCue) {
    const group = words.slice(i, i + wordsPerCue);
    const start = group[0].start;
    const end = group[group.length - 1].end;
    const text = group.map(w => w.word).join(' ');
    const idx = cues.length + 1;
    cues.push(`${idx}\n${fmtTime(start)} --> ${fmtTime(end)}\n${text}\n`);
  }
  return cues.join('\n');
}
```

- [ ] **Step 4: Run — confirm pass**

Run: `npx vitest run src/lib/__tests__/srt.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/srt.ts src/lib/__tests__/srt.test.ts
git commit -m "feat(srt): word-timestamps → SRT cue blocks"
```

---

### Task 12: Emit SRT + caption upload

**Files:**
- Modify: `scripts/render-daily-short.ts`
- Modify: `scripts/upload-youtube.ts`

- [ ] **Step 1: Emit SRT in render-daily-short.ts**

After audio generation (where `audioResults` is available), add before the render step:

```typescript
  // ── Emit SRT from TTS word timestamps ──
  const wordTimestamps = audioResults[0]?.wordTimestamps ?? [];
  if (wordTimestamps.length > 0) {
    const { wordTimestampsToSrt } = await import('../src/lib/srt');
    const srt = wordTimestampsToSrt(wordTimestamps);
    const srtPath = path.join(OUTPUT_DIR, `${episodeId}.srt`);
    fs.writeFileSync(srtPath, srt);
    console.log(`   Captions: ${srtPath}`);
  }
```

- [ ] **Step 2: Add --captions flag to upload-youtube.ts**

In `scripts/upload-youtube.ts`, near the existing flag parsing:

```typescript
  const captionsIdx = process.argv.indexOf('--captions');
  const captionsPath = captionsIdx > -1 ? process.argv[captionsIdx + 1] : undefined;
```

After the video upload succeeds (`videoId` is known):

```typescript
  if (captionsPath && fs.existsSync(captionsPath)) {
    await youtube.captions.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          videoId,
          language: 'en',
          name: 'English (auto)',
          isDraft: false,
        },
      },
      media: { mimeType: 'application/octet-stream', body: fs.createReadStream(captionsPath) },
    });
    console.log(`   ✓ Captions uploaded`);
  }
```

- [ ] **Step 3: Smoke test SRT generation**

Run: `npx tsx scripts/render-daily-short.ts --short 0`
Then: `head -10 output/daily-short/kafka-quiz-0.srt`
Expected: Valid SRT cues with timecodes.

- [ ] **Step 4: Commit**

```bash
git add scripts/render-daily-short.ts scripts/upload-youtube.ts
git commit -m "feat(captions): emit .srt + upload via captions API"
```

---

### Task 13: Burned-in captions during explain phase

**Files:**
- Modify: `src/compositions/QuizShort.tsx`

- [ ] **Step 1: Extend props to accept wordTimestamps**

```typescript
interface QuizShortProps {
  quiz: QuizQuestion;
  audioFile?: string;
  audioDurationSec?: number;
  wordTimestamps?: Array<{ word: string; start: number; end: number }>;
}
```

- [ ] **Step 2: Add CaptionOverlay import**

At the top:

```typescript
import CaptionOverlay from '../components/CaptionOverlay';
```

- [ ] **Step 3: Render captions during explain phase only**

Inside the `showDiagram && (...)` AbsoluteFill, after the `isExplainPhase` confetti block, add:

```tsx
{isExplainPhase && wordTimestamps && wordTimestamps.length > 0 && (
  <div style={{
    position: 'absolute',
    bottom: 380,    // above progress bar + below avatar
    left: 0, right: 0,
    zIndex: 30,
  }}>
    <CaptionOverlay
      text={quiz.explanation}
      startFrame={FLASH_END}
      durationInFrames={EXPLAIN_END - FLASH_END}
      wordTimestamps={wordTimestamps}
      captionMode="hormozi"
    />
  </div>
)}
```

- [ ] **Step 4: Pass wordTimestamps from render-daily-short.ts**

In `propsData`:

```typescript
  const propsData = {
    quiz,
    audioFile: storyboard.audioFile ? path.basename(storyboard.audioFile) : undefined,
    audioDurationSec: audioDuration,
    wordTimestamps,    // from audioResults[0].wordTimestamps
  };
```

- [ ] **Step 5: Render + visual check**

Run: `npx tsx scripts/render-daily-short.ts --short 0`
Open: `output/daily-short/kafka-quiz-0.mp4`
Expected: During explain phase (~7-20s mark) captions appear at bottom, bouncing hormozi-style.

- [ ] **Step 6: If overlap with options, adjust**

If captions visually overlap option cards: change `bottom: 380` to `bottom: 280` or move option cards higher. Test until no overlap.

- [ ] **Step 7: Commit**

```bash
git add src/compositions/QuizShort.tsx scripts/render-daily-short.ts
git commit -m "feat(quiz): burned-in hormozi captions during explain phase"
```

---

### Task 14: SFX cue layer (inline Sequences)

**Files:**
- Modify: `src/compositions/QuizShort.tsx`

- [ ] **Step 1: Add SFX helper**

Near the top of `QuizShort.tsx` (after imports), add:

```typescript
const Sfx: React.FC<{ name: string; from: number; durationFrames?: number; volume?: number }> = ({
  name, from, durationFrames = 30, volume = 1,
}) => (
  <Sequence from={from} durationInFrames={durationFrames}>
    <Audio src={staticFile(`audio/sfx/${name}.wav`)} volume={volume} />
  </Sequence>
);
```

- [ ] **Step 2: Place cues inside the composition**

Inside the main `<AbsoluteFill>` of `QuizShort`, just before the closing tag (and after the existing `<Audio>` BGM block), add:

```tsx
{/* ── SFX cues ── */}
<Sfx name="whoosh-in" from={0} volume={0.8} />
<Sfx name="tension-build" from={HOOK_END} durationFrames={QUESTION_END - HOOK_END} volume={0.4} />
<Sfx name="impact" from={FLASH_END - 5} durationFrames={20} volume={1.0} />
<Sfx name="success-chime" from={FLASH_END} volume={0.7} />
<Sfx name="riser" from={Math.max(0, FLASH_END + 5)} durationFrames={45} volume={0.5} />
<Sfx name="swoosh-out" from={Math.max(0, EXPLAIN_END - 10)} durationFrames={20} volume={0.8} />
```

- [ ] **Step 3: Verify SFX files exist**

Run: `ls public/audio/sfx/{whoosh-in,tension-build,impact,success-chime,riser,swoosh}*.wav`
Expected: All 6 files listed. (Note: file may be `swoosh.wav` not `swoosh-out.wav` — use whichever exists; adjust the `Sfx` name accordingly.)

- [ ] **Step 4: Render + listen**

Run: `npx tsx scripts/render-daily-short.ts --short 0`
Open: `output/daily-short/kafka-quiz-0.mp4`
Expected: Audible whoosh at start, tension during question, impact + chime at reveal, swoosh near end.

- [ ] **Step 5: If SFX too loud/quiet, adjust volumes**

If TTS is drowned out: reduce SFX volumes by 0.2 each. If SFX inaudible: raise by 0.2.

- [ ] **Step 6: Commit**

```bash
git add src/compositions/QuizShort.tsx
git commit -m "feat(quiz): SFX cue layer (whoosh, tension, impact, chime, riser, swoosh)"
```

---

### Task 15: BGM swap to study-pad

**Files:**
- Modify: `src/compositions/QuizShort.tsx`

- [ ] **Step 1: Locate BGM line**

Run: `grep -n "warm-ambient\|bgm" src/compositions/QuizShort.tsx`
Expected: One match at the BGM `<Audio>` block.

- [ ] **Step 2: Change BGM file**

Edit the line:

```tsx
<Audio src={staticFile('audio/bgm/warm-ambient.mp3')} volume={0.06} loop />
```

to:

```tsx
<Audio src={staticFile('audio/bgm/study-pad.mp3')} volume={0.06} loop />
```

- [ ] **Step 3: Verify file exists**

Run: `ls -la public/audio/bgm/study-pad.mp3`
Expected: File exists, non-zero size.

- [ ] **Step 4: Render + listen**

Run: `npx tsx scripts/render-daily-short.ts --short 0`
Expected: New BGM bed, less sleepy than warm-ambient.

- [ ] **Step 5: Commit**

```bash
git add src/compositions/QuizShort.tsx
git commit -m "feat(quiz): BGM swap warm-ambient → study-pad for forward momentum"
```

---

### Task 16: EndCardCTA component

**Files:**
- Create: `src/components/EndCardCTA.tsx`
- Modify: `src/compositions/QuizShort.tsx`

- [ ] **Step 1: Create EndCardCTA**

```tsx
// src/components/EndCardCTA.tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { FONTS } from '../lib/theme';

interface Props {
  endQuestion: string;
  startFrame: number;
  durationFrames: number;
}

export const EndCardCTA: React.FC<Props> = ({ endQuestion, startFrame, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const age = frame - startFrame;
  if (age < 0 || age > durationFrames) return null;
  const s = spring({ frame: age, fps, config: { stiffness: 200, damping: 14, mass: 0.5 } });
  return (
    <div style={{
      position: 'absolute',
      bottom: 180, left: 60, right: 60,
      zIndex: 70,
      textAlign: 'center',
      opacity: interpolate(s, [0, 1], [0, 1]),
      transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px)`,
    }}>
      <div style={{
        display: 'inline-block',
        backgroundColor: 'rgba(255, 68, 68, 0.18)',
        border: '2px solid #FF4444',
        borderRadius: 32,
        padding: '14px 32px',
        fontSize: 32, fontFamily: FONTS.heading, fontWeight: 700,
        color: '#fff',
        boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
      }}>
        💬 {endQuestion}
      </div>
    </div>
  );
};

export default EndCardCTA;
```

- [ ] **Step 2: Render EndCardCTA during last 1.5s**

In `QuizShort.tsx`, after the `<LoopTrigger ... />`, add:

```tsx
<EndCardCTA
  endQuestion={quiz.endQuestion}
  startFrame={Math.max(0, TOTAL_FRAMES - Math.round(1.5 * fps))}
  durationFrames={Math.round(1.5 * fps)}
/>
```

And add the import:

```typescript
import EndCardCTA from '../components/EndCardCTA';
```

- [ ] **Step 3: Render + visual check**

Run: `npx tsx scripts/render-daily-short.ts --short 0`
Open the resulting MP4. Expected: in the last 1.5s, a red-bordered CTA box appears with `💬 Are you acks=all or acks=1? Comment below.`

- [ ] **Step 4: Commit**

```bash
git add src/components/EndCardCTA.tsx src/compositions/QuizShort.tsx
git commit -m "feat(quiz): EndCardCTA showing quiz.endQuestion in last 1.5s"
```

---

### Task 17: Two-pass loudness normalization

**Files:**
- Modify: `scripts/render-daily-short.ts`

- [ ] **Step 1: Add loudnorm helper at top of file**

```typescript
function loudnormPass(inputPath: string, outputPath: string): void {
  console.log('   [loudnorm] pass 1 (measure)...');
  const measureCmd = `ffmpeg -y -i ${inputPath} -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | tail -20`;
  const measureOut = execSync(measureCmd, { cwd: PROJECT_ROOT, encoding: 'utf8' });
  // Extract JSON block from stderr (loudnorm prints it after a header)
  const jsonStart = measureOut.indexOf('{');
  const jsonEnd = measureOut.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd < 0) {
    console.warn('   [loudnorm] could not parse pass-1 output; falling back to single-pass');
    execSync(`ffmpeg -y -i ${inputPath} -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:v copy ${outputPath}`, { cwd: PROJECT_ROOT, stdio: 'inherit' });
    return;
  }
  const m = JSON.parse(measureOut.slice(jsonStart, jsonEnd + 1));
  console.log(`   [loudnorm] pass 2 (apply, measured_I=${m.input_i})...`);
  const applyFilter = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_LRA=${m.input_lra}:measured_TP=${m.input_tp}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  execSync(`ffmpeg -y -i ${inputPath} -af ${applyFilter} -c:v copy ${outputPath}`, { cwd: PROJECT_ROOT, stdio: 'inherit' });
}
```

- [ ] **Step 2: Invoke loudnorm after render**

After the `execSync(renderCmd, ...)` block:

```typescript
  // ── Two-pass loudness normalize to -14 LUFS ──
  const normalizedPath = outputPath.replace(/\.mp4$/, '-normalized.mp4');
  try {
    loudnormPass(outputPath, normalizedPath);
    fs.renameSync(normalizedPath, outputPath); // replace original
    console.log(`   ✓ Loudness normalized to -14 LUFS`);
  } catch (err) {
    console.warn(`   [warn] loudnorm failed: ${String(err).slice(0, 100)} — keeping original`);
  }
```

- [ ] **Step 3: Render + verify loudness**

Run: `npx tsx scripts/render-daily-short.ts --short 0`
Then: `ffmpeg -i output/daily-short/kafka-quiz-0.mp4 -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=summary -f null - 2>&1 | grep -E "Input Integrated|Output Integrated" | head -4`
Expected: Output Integrated within -14 ± 1 LUFS.

- [ ] **Step 4: Commit**

```bash
git add scripts/render-daily-short.ts
git commit -m "feat(audio): two-pass loudnorm to -14 LUFS (YouTube standard)"
```

---

### Gate 2 — Tier 2 verification

- [ ] **Step 1: Full pipeline render**

Run: `npx tsx scripts/render-daily-short.ts --short 0`
Expected:
- Outputs `kafka-quiz-0.mp4` (loudnormed)
- Outputs `kafka-quiz-0.srt`
- Outputs `kafka-quiz-0-thumbnail.jpg`
- Outputs `kafka-quiz-0-metadata.json`

- [ ] **Step 2: Visual inspection checklist**

Open `kafka-quiz-0.mp4` and verify:
- Frame 0: hook text visible.
- 2-6s: tension-build SFX audible during question.
- 6-6.5s: flash cut with impact + success-chime.
- 7-20s: bouncing hormozi captions at bottom; explanation visible; no option/caption overlap.
- 20s+: "But wait..." overlay, no black screen.
- Last 1.5s: EndCardCTA visible with `quiz.endQuestion`.

- [ ] **Step 3: Audio loudness**

Run: `ffmpeg -i output/daily-short/kafka-quiz-0.mp4 -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=summary -f null - 2>&1 | grep "Output Integrated"`
Expected: -14 ± 1 LUFS.

- [ ] **Step 4: Gate decision**

If checklist passes, proceed to Tier 3. Otherwise: fix the failed item and re-verify.

---

## Tier 3 — Polish

### Task 18: Description expanded to ≥150 words

**Files:**
- Modify: `scripts/render-daily-short.ts`

- [ ] **Step 1: Replace the metadata description block**

In `render-daily-short.ts`, find the `description: [...].join('\n')` block. Replace with:

```typescript
      description: [
        quiz.question,
        '',
        `A) ${quiz.options[0]}`,
        `B) ${quiz.options[1]}`,
        `C) ${quiz.options[2]}`,
        '',
        `📌 The answer: ${String.fromCharCode(65 + quiz.correctIndex)} — ${quiz.options[quiz.correctIndex]}`,
        '',
        '🧠 WHY THIS MATTERS',
        quiz.explanation,
        '',
        '⚡ THE TWIST',
        quiz.twist,
        '',
        `💬 ${quiz.endQuestion}`,
        '',
        '🎓 FULL SYSTEM DESIGN COURSE',
        'Master Kafka, Load Balancers, API Gateways, Databases and more:',
        'https://guru-sishya.in',
        '',
        '📺 RELATED VIDEOS',
        '• System Design Interview Playlist',
        '• Kafka Deep Dive Series',
        '• Free Course: Distributed Systems',
        '',
        '🔔 Subscribe for daily system design Shorts.',
        '',
        `#systemdesign #${quiz.topic.replace(/-/g, '')} #codinginterview #softwareengineer #techinterview #backend #distributedsystems`,
      ].join('\n'),
```

- [ ] **Step 2: Verify word count**

Run: `npx tsx scripts/render-daily-short.ts --dry-run --short 0` then manually inspect description length. Or:

```bash
npx tsx scripts/render-daily-short.ts --short 0
node -e "const m=require('./output/daily-short/kafka-quiz-0-metadata.json'); console.log(m.youtube.description.split(/\s+/).length, 'words');"
```
Expected: ≥150 words.

- [ ] **Step 3: Commit**

```bash
git add scripts/render-daily-short.ts
git commit -m "feat(metadata): expand description to ≥150 words with quiz context + course CTA"
```

---

### Task 19: Hook autofit for long text

**Files:**
- Modify: `src/compositions/QuizShort.tsx`

- [ ] **Step 1: Compute font size based on line count**

In the hook block (`isHookPhase`), replace the hardcoded `fontSize: 88` with:

```typescript
// Inside the lines.map render — auto-fit by line count
const lineCount = lines.length;
const autoFontSize = lineCount <= 2 ? 88 : lineCount === 3 ? 70 : 58;
```

Use `fontSize: autoFontSize` in the inner line `<div>` style.

- [ ] **Step 2: Render with a 3-line hook**

Run: `npx tsx scripts/render-daily-short.ts --short 0` (kafka-0 has 3 lines: "LinkedIn serves / 7 TRILLION messages/day / with THIS setting").
Expected: Text fits within the 1080px width without overflow.

- [ ] **Step 3: Commit**

```bash
git add src/compositions/QuizShort.tsx
git commit -m "feat(hook): auto-fit font size to line count (88/70/58)"
```

---

### Task 20: Cron schedule audit

**Files:**
- Modify: `.github/workflows/auto-shorts.yml`

- [ ] **Step 1: Update cron schedule**

In `.github/workflows/auto-shorts.yml`, change:

```yaml
    - cron: '0 1 * * *'
```

to:

```yaml
    # 1:15 PM IST (07:45 UTC) Mon/Wed/Fri — lunch break scrolling peak
    - cron: '45 7 * * 1,3,5'
```

Also update the header comment to reflect the new schedule.

- [ ] **Step 2: Verify schedule in workflow_dispatch event still works**

Run: `gh workflow view auto-shorts.yml` (if you have `gh` and access).
Expected: Lists `schedule` and `workflow_dispatch` triggers.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/auto-shorts.yml
git commit -m "ci(auto-shorts): cron to 1:15 PM IST Mon/Wed/Fri per optimal_schedule memory"
```

---

### Gate 3 — Tier 3 verification

- [ ] **Step 1: Full smoke test**

Run all of these and verify each produces expected output:

```bash
npx vitest run                                    # all tests pass
npx tsx scripts/validate-quizzes.ts               # all quizzes valid
npx tsx scripts/render-daily-short.ts --short 0   # full render
ls -la output/daily-short/kafka-quiz-0.{mp4,srt,jpg} \
       output/daily-short/kafka-quiz-0-metadata.json
```
Expected: All files present, MP4 plays, SRT has timecodes, JPG is non-blank, metadata description ≥150 words.

- [ ] **Step 2: Upload one Short to gather data**

Either manually or via auto-shorts workflow. Wait 48h.

- [ ] **Step 3: First analytics check**

Run: `npx tsx scripts/ingest-analytics.ts && npx tsx scripts/weekly-report.ts`
Expected: Report shows the new Short's completion %.

- [ ] **Step 4: Gate decision**

If median completion ≥70% over 10 uploads under this design: SUCCESS — design hit target.
If <60% after 10 uploads: per spec stop rule, revisit format itself, not iterate fixes.

---

## Summary

| Tier | Tasks | Adds | Deletes | Verified by |
|---|---|---|---|---|
| 0 | 1-4 | Analytics ingestion + report + workflow | — | `data/analytics/*.json` populated; weekly report generates |
| 1 | 5-10 | Title validator | Warning triangle, bottom red bar, 2.5s end-black, 15px from avatar, hardcoded 25s | Type-check clean; first/last frame visual sanity; duration matches audio + 1s |
| 2 | 11-17 | SRT, captions, SFX, EndCardCTA, study-pad BGM, loudnorm | warm-ambient BGM (replaced) | Visual checklist; -14 LUFS measured |
| 3 | 18-20 | 150-word description, hook autofit, cron schedule | — | Word count ≥150; 3-line hook fits; cron at 1:15 PM IST |

Total: **20 tasks** with **4 ship gates**. Each commit is independently revertable.
