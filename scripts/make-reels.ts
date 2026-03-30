#!/usr/bin/env npx tsx
/**
 * Instagram Reel Maker — extracts best 5-minute segment from long videos
 *
 * Instead of re-rendering, this simply TRIMS the existing long-form video
 * to the meatiest 5-minute window (skipping intro/setup). The result is a
 * 1920x1080 horizontal clip that Instagram will display natively.
 *
 * At 1.6x playback speed, 5 min = ~3:07 actual watch time.
 *
 * Usage:
 *   npx tsx scripts/make-reels.ts --topic "Load Balancing"
 *   npx tsx scripts/make-reels.ts --topic "Load Balancing" --session 3
 *   npx tsx scripts/make-reels.ts --all
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ── Config ──────────────────────────────────────────────────────────────────

const DOCS_DIR = path.join(process.env.HOME || '~', 'Documents', 'guru-sishya');
const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');
const REEL_DURATION = 300; // 5 minutes in seconds
const SITE_URL = 'https://guru-sishya.in';

const HASHTAGS = [
  '#coding', '#programming', '#interviewprep', '#faang',
  '#dsa', '#tech', '#developer', '#codinginterview',
  '#systemdesign', '#softwareengineering', '#instagram',
  '#reels', '#learntocode', '#gurusishya',
];

// ── Session titles for metadata (Load Balancing) ────────────────────────────

const SESSION_TITLES: Record<string, string[]> = {
  'load-balancing': [
    'Why Load Balancing Matters',
    'Round Robin & Weighted Round Robin',
    'Least Connections & IP Hash',
    'Health Checks & Failover',
    'Layer 4 vs Layer 7 Load Balancing',
    'Consistent Hashing Deep Dive',
    'Global Server Load Balancing',
    'Load Balancing at Scale — Netflix & Google',
    'Auto Scaling + Load Balancing',
    'Interview Questions & System Design',
  ],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getVideoDuration(videoPath: string): number {
  try {
    const result = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${videoPath}"`,
      { encoding: 'utf-8' }
    ).trim();
    return parseFloat(result);
  } catch {
    return 0;
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function findLongVideo(topicSlug: string, sessionNum: number): string | null {
  // Primary: ~/Documents/guru-sishya/{slug}/session-{n}/long/{slug}-s{n}.mp4
  const primary = path.join(
    DOCS_DIR, topicSlug, `session-${sessionNum}`, 'long', `${topicSlug}-s${sessionNum}.mp4`
  );
  if (fs.existsSync(primary)) return primary;

  // Fallback: output/{slug}-s{n}.mp4
  const fallback = path.join(OUTPUT_DIR, `${topicSlug}-s${sessionNum}.mp4`);
  if (fs.existsSync(fallback)) return fallback;

  return null;
}

/**
 * Picks the best 5-minute start time from a long video.
 *
 * Strategy:
 *   - Under 5 min  → use entire video (start=0)
 *   - 5-10 min     → start at 5s (skip intro), take 5 min
 *   - 10+ min      → start at 15% in (skip intro + problem setup), take 5 min
 *                     This lands us right in the core explanation / deep dive.
 *
 * The 15% offset typically skips:
 *   - 0:00-0:05  hook/intro text
 *   - 0:05-1:00  problem statement
 *   - 1:00-1:30  why-it-matters motivation
 * and drops us into the first meaty subtopic.
 */
function selectBestSegment(
  durationSec: number,
): { startSec: number; clipDuration: number } {
  if (durationSec <= REEL_DURATION) {
    // Video is shorter than 5 min — use it all
    return { startSec: 0, clipDuration: durationSec };
  }

  if (durationSec <= REEL_DURATION * 2) {
    // 5-10 min: skip 5s intro, take 5 min
    return { startSec: 5, clipDuration: REEL_DURATION };
  }

  // 10+ min: start at 15% to hit the core content
  const startSec = Math.round(durationSec * 0.15);

  // Make sure we don't overshoot the end
  const maxStart = durationSec - REEL_DURATION - 2; // 2s safety margin
  const finalStart = Math.min(startSec, maxStart);

  return { startSec: Math.max(5, finalStart), clipDuration: REEL_DURATION };
}

function generateCaption(
  topicName: string,
  sessionNum: number,
  topicSlug: string,
): string {
  const titles = SESSION_TITLES[topicSlug] || [];
  const sessionTitle = titles[sessionNum - 1] || `Session ${sessionNum}`;

  const lines = [
    `${topicName} — ${sessionTitle} (Part ${sessionNum}/10)`,
    '',
    `The BEST 5 minutes from our deep-dive. Save this for your next interview!`,
    '',
    `Full course FREE at ${SITE_URL}/${topicSlug}`,
    `1,988 questions across 141 topics`,
    '',
    HASHTAGS.slice(0, 10).join(' '),
  ];
  return lines.join('\n');
}

function generateMetadata(
  topicName: string,
  topicSlug: string,
  sessionNum: number,
  startSec: number,
  clipDuration: number,
  sourceDuration: number,
  sourcePath: string,
) {
  const titles = SESSION_TITLES[topicSlug] || [];
  const sessionTitle = titles[sessionNum - 1] || `Session ${sessionNum}`;

  return {
    topic: topicName,
    topicSlug,
    sessionNumber: sessionNum,
    sessionTitle,
    platform: 'instagram',
    type: 'reel',
    generatedAt: new Date().toISOString(),
    source: {
      file: sourcePath,
      durationSec: Math.round(sourceDuration),
      durationFormatted: formatTime(sourceDuration),
    },
    clip: {
      startSec,
      durationSec: clipDuration,
      startFormatted: formatTime(startSec),
      endFormatted: formatTime(startSec + clipDuration),
    },
    instagram: {
      caption: generateCaption(topicName, sessionNum, topicSlug),
      coverText: `${topicName.toUpperCase()} — ${sessionTitle.toUpperCase()}`,
      hashtags: HASHTAGS,
    },
    publishUrl: `${SITE_URL}/${topicSlug}`,
  };
}

// ── Core: trim video with ffmpeg ────────────────────────────────────────────

function trimVideo(
  inputPath: string,
  outputPath: string,
  startSec: number,
  clipDuration: number,
): boolean {
  ensureDir(path.dirname(outputPath));

  const cmd = [
    'ffmpeg -y',
    `-ss ${startSec}`,
    `-t ${clipDuration}`,
    `-i "${inputPath}"`,
    '-c:v libx264 -crf 22 -preset fast',
    '-c:a aac -b:a 128k',
    '-movflags +faststart',
    `"${outputPath}"`,
  ].join(' ');

  try {
    execSync(cmd, { stdio: 'pipe', timeout: 120_000 });
    return true;
  } catch (err: any) {
    console.error(`    FFMPEG ERROR: ${err.stderr?.toString().slice(-200) || err.message}`);
    return false;
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 && idx + 1 < process.argv.length
    ? process.argv[idx + 1]
    : undefined;
}

function discoverSessions(topicSlug: string): number[] {
  const sessions: number[] = [];

  // Check ~/Documents/guru-sishya/{slug}/session-{n}/
  const topicDir = path.join(DOCS_DIR, topicSlug);
  if (fs.existsSync(topicDir)) {
    const entries = fs.readdirSync(topicDir);
    for (const e of entries) {
      const match = e.match(/^session-(\d+)$/);
      if (match) sessions.push(parseInt(match[1], 10));
    }
  }

  // Also check output/ for {slug}-s{n}.mp4
  if (fs.existsSync(OUTPUT_DIR)) {
    const entries = fs.readdirSync(OUTPUT_DIR);
    for (const e of entries) {
      const match = e.match(new RegExp(`^${topicSlug}-s(\\d+)\\.mp4$`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (!sessions.includes(num)) sessions.push(num);
      }
    }
  }

  return sessions.sort((a, b) => a - b);
}

function discoverTopics(): string[] {
  const topics: string[] = [];
  if (fs.existsSync(DOCS_DIR)) {
    for (const entry of fs.readdirSync(DOCS_DIR)) {
      const fullPath = path.join(DOCS_DIR, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        // Check if it has session-* subdirs with long videos
        const subs = fs.readdirSync(fullPath);
        if (subs.some(s => s.match(/^session-\d+$/))) {
          topics.push(entry);
        }
      }
    }
  }
  return topics.sort();
}

async function main() {
  const topicArg = getArg('--topic');
  const sessionArg = getArg('--session');
  const runAll = process.argv.includes('--all');

  console.log('');
  console.log('  INSTAGRAM REEL MAKER');
  console.log('  Extracts best 5-min segment from long videos');
  console.log('  ─────────────────────────────────────────────');
  console.log('');

  // Determine which topics to process
  let topicSlugs: string[] = [];

  if (runAll) {
    topicSlugs = discoverTopics();
    if (topicSlugs.length === 0) {
      console.log('  No topics found in ' + DOCS_DIR);
      process.exit(1);
    }
    console.log(`  Found ${topicSlugs.length} topics: ${topicSlugs.join(', ')}`);
  } else if (topicArg) {
    topicSlugs = [slugify(topicArg)];
  } else {
    console.log('  Usage:');
    console.log('    npx tsx scripts/make-reels.ts --topic "Load Balancing"');
    console.log('    npx tsx scripts/make-reels.ts --topic "Load Balancing" --session 3');
    console.log('    npx tsx scripts/make-reels.ts --all');
    process.exit(0);
  }

  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  const results: { session: string; status: string; output?: string }[] = [];

  for (const topicSlug of topicSlugs) {
    const topicName = topicSlug
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    console.log(`  Topic: ${topicName} (${topicSlug})`);
    console.log('');

    // Discover sessions
    let sessionNums = discoverSessions(topicSlug);
    if (sessionArg) {
      const target = parseInt(sessionArg, 10);
      sessionNums = sessionNums.filter(n => n === target);
    }

    if (sessionNums.length === 0) {
      console.log(`  No sessions found for ${topicSlug}`);
      console.log('');
      continue;
    }

    console.log(`  Sessions: ${sessionNums.join(', ')} (${sessionNums.length} total)`);
    console.log('');

    for (const sessionNum of sessionNums) {
      const label = `${topicSlug} S${sessionNum}`;
      process.stdout.write(`  [S${sessionNum}] `);

      // Find source video
      const videoPath = findLongVideo(topicSlug, sessionNum);
      if (!videoPath) {
        console.log('SKIP — no long video found');
        totalSkipped++;
        results.push({ session: label, status: 'skipped (no video)' });
        continue;
      }

      // Get duration
      const duration = getVideoDuration(videoPath);
      if (duration <= 0) {
        console.log('SKIP — could not read duration');
        totalSkipped++;
        results.push({ session: label, status: 'skipped (bad file)' });
        continue;
      }

      // Select best segment
      const { startSec, clipDuration } = selectBestSegment(duration);

      process.stdout.write(
        `${formatTime(duration)} total, trimming ${formatTime(startSec)}-${formatTime(startSec + clipDuration)} ... `
      );

      // Clean old shorts/reels directories
      const sessionDir = path.join(DOCS_DIR, topicSlug, `session-${sessionNum}`);
      const oldShorts = path.join(sessionDir, 'shorts');
      const oldReels = path.join(sessionDir, 'reels');
      if (fs.existsSync(oldShorts)) {
        fs.rmSync(oldShorts, { recursive: true, force: true });
      }
      if (fs.existsSync(oldReels)) {
        fs.rmSync(oldReels, { recursive: true, force: true });
      }

      // Output path
      const reelsDir = path.join(sessionDir, 'reels');
      ensureDir(reelsDir);
      const outputPath = path.join(reelsDir, 'reel.mp4');

      // Trim
      const ok = trimVideo(videoPath, outputPath, startSec, clipDuration);

      if (ok) {
        // Verify output exists and has size
        const stat = fs.statSync(outputPath);
        const sizeMB = (stat.size / (1024 * 1024)).toFixed(1);
        console.log(`OK (${sizeMB} MB)`);

        // Write metadata
        const meta = generateMetadata(
          topicName, topicSlug, sessionNum,
          startSec, clipDuration, duration, videoPath,
        );
        fs.writeFileSync(
          path.join(reelsDir, 'metadata.json'),
          JSON.stringify(meta, null, 2),
        );

        totalProcessed++;
        results.push({
          session: label,
          status: `OK (${sizeMB} MB)`,
          output: outputPath,
        });
      } else {
        console.log('FAILED');
        totalFailed++;
        results.push({ session: label, status: 'FAILED' });
      }
    }

    console.log('');
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('  ═══════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('  ═══════════════════════════════════════════════');
  console.log(`  Processed: ${totalProcessed}`);
  if (totalSkipped > 0) console.log(`  Skipped:   ${totalSkipped}`);
  if (totalFailed > 0) console.log(`  Failed:    ${totalFailed}`);
  console.log('');

  for (const r of results) {
    const icon = r.status.startsWith('OK') ? 'OK' : r.status.startsWith('FAIL') ? 'XX' : '--';
    console.log(`  [${icon}] ${r.session}: ${r.status}`);
  }

  console.log('');
  console.log('  Output: ~/Documents/guru-sishya/{topic}/session-{n}/reels/reel.mp4');
  console.log('  Upload: Instagram Reels @ @guru_sishya.in');
  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
