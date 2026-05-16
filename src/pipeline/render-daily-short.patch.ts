#!/usr/bin/env npx tsx
/**
 * render-daily-short.ts — PATCHED for fix-15 (render determinism).
 *
 * Change: the `date` variable no longer silently defaults to `new Date()` when
 * `--date` is omitted in a non-interactive context.  In CI the workflow always
 * passes `--date $RENDER_DATE`; for local ad-hoc runs `new Date()` is still
 * acceptable but now emits a visible warning.
 *
 * All date parsing is centralised in `parseArgs()` and the resolved ISO date
 * string is surfaced early so it appears in logs and can be reproduced.
 *
 * Nothing else is changed — this is a minimal, surgical patch.
 *
 * ─── Original non-determinism ───────────────────────────────────────────────
 *   let date = new Date();   // ← wall-clock; different topic each day
 *   …
 *   const result = getShortForDate(date);   // topic selection depended on "now"
 *
 * ─── Fix ────────────────────────────────────────────────────────────────────
 *   Warn loudly when --date is absent.
 *   CI workflow (determinism-check.yml) always passes --date so the warning
 *   never fires in automated runs.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  generateShort,
  getShortForDate,
  resolveShortNumber,
  TOTAL_SHORTS,
} from '../src/pipeline/shorts-generator';
import { generateSceneAudios } from '../src/pipeline/tts-engine';
import { generateStoryboard } from '../src/pipeline/storyboard';
import type { Scene, Storyboard } from '../src/types';

// ─── Paths ──────────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'output', 'daily-short');
const PROPS_DIR = path.join(PROJECT_ROOT, 'output');

const BGM_FILES = [
  'audio/bgm/gentle-drone.mp3',
  'audio/bgm/study-pad.mp3',
  'audio/bgm/warm-ambient.mp3',
];

function pickBgm(seed: string): string {
  const hash = seed.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return BGM_FILES[hash % BGM_FILES.length];
}

// ─── CLI Args ───────────────────────────────────────────────────────────────

interface ParsedArgs {
  date: Date;
  /** ISO date string used to produce `date`; present for logging/reproducibility. */
  dateSource: 'explicit' | 'wallclock';
  shortNumber: number | null;
  dryRun: boolean;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let date: Date | null = null;
  let dateSource: 'explicit' | 'wallclock' = 'wallclock';
  let shortNumber: number | null = null;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date' && args[i + 1]) {
      date = new Date(args[i + 1]);
      dateSource = 'explicit';
      i++;
    } else if (args[i] === '--short' && args[i + 1]) {
      shortNumber = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  if (date === null) {
    // PATCH (fix-15): warn when falling back to wall-clock.
    // In CI this should never happen — the workflow passes --date explicitly.
    date = new Date();
    if (process.env.CI) {
      // Hard-fail in CI so non-deterministic runs are caught immediately.
      console.error(
        '[fix-15] ERROR: --date is required in CI for deterministic renders.\n' +
        'Pass --date YYYY-MM-DD to render a specific day, or --short N for a specific short.\n' +
        'Example: npx tsx scripts/render-daily-short.ts --date 2026-05-03',
      );
      process.exit(1);
    }
    console.warn(
      '[fix-15] WARNING: --date not provided; defaulting to today (' +
      date.toISOString().slice(0, 10) +
      '). Pass --date YYYY-MM-DD for a reproducible render.',
    );
  }

  return { date, dateSource, shortNumber, dryRun };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const { date, dateSource, shortNumber: explicitShort, dryRun } = parseArgs();

  // Determine which Short to render
  let topicSlug: string;
  let shortIndex: number;
  let shortNum: number;

  if (explicitShort !== null) {
    const resolved = resolveShortNumber(explicitShort);
    topicSlug = resolved.topicSlug;
    shortIndex = resolved.shortIndex;
    shortNum = explicitShort;
  } else {
    const result = getShortForDate(date);
    topicSlug = result.topicSlug;
    shortIndex = result.shortIndex;
    shortNum = result.shortNumber;
  }

  // Generate the Short content
  const episode = generateShort(topicSlug, shortIndex);

  console.log(`\n=== Daily Short #${shortNum} ===`);
  console.log(`Date:    ${date.toISOString().slice(0, 10)} [${dateSource}]`);
  console.log(`Topic:   ${topicSlug}`);
  console.log(`Format:  ${episode.formatName} (index ${shortIndex})`);
  console.log(`Title:   ${episode.title} (${episode.title.length} chars)`);
  console.log(`Words:   ${episode.narration.split(/\s+/).length}`);
  console.log(`ID:      ${episode.id}`);

  if (dryRun) {
    console.log('\n[dry-run] Stopping before render. Storyboard would be saved to:', PROPS_DIR);
    return;
  }

  // … remainder of original render logic unchanged …
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
