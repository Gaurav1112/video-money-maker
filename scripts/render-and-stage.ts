#!/usr/bin/env npx tsx
/**
 * render-and-stage.ts — Expert 1: Anil Kumar — Render-to-Upload Pipeline Orchestrator
 *
 * Complete end-to-end pipeline: render all formats, generate metadata, stage for upload.
 *
 * Usage:
 *   npx tsx scripts/render-and-stage.ts <topic-slug> <session-number>
 *   npx tsx scripts/render-and-stage.ts kafka 2
 *   npx tsx scripts/render-and-stage.ts load-balancing 1 --skip-vertical
 *   npx tsx scripts/render-and-stage.ts kafka 2 --dry-run
 *   npx tsx scripts/render-and-stage.ts --next                # auto-pick next unrendered session
 *   npx tsx scripts/render-and-stage.ts --status              # show pipeline status
 *
 * Pipeline steps:
 *   1. Generate storyboard + TTS audio (render-session.ts)
 *   2. Render long-form horizontal video (LongVideo)
 *   3. Render full vertical video (VerticalLong)
 *   4. Split + render vertical parts (render-vertical-parts.ts)
 *   5. Generate thumbnail (Remotion still)
 *   6. Generate all metadata files (generate-upload-metadata.ts)
 *   7. Stage everything to ~/guru-sishya-uploads/{topic}/session-{N}/
 *   8. Update manifest ~/guru-sishya-uploads/manifest.json
 *   9. Print summary
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ─── Queue Integration (Expert 5: Priya Shah) ───────────────────────────────

const CONFIG_DIR_PATH = path.resolve(__dirname, '..', 'config');
const TOPIC_QUEUE_FILE = path.join(CONFIG_DIR_PATH, 'topic-queue.json');

interface TopicQueueEntry {
  slug: string;
  name: string;
  sessions: number;
  category: string;
  priority: 'high' | 'medium' | 'low';
  rendered: number[];
  published: number[];
}

interface TopicQueueFile {
  version: number;
  lastUpdated: string;
  topics: TopicQueueEntry[];
}

function loadTopicQueue(): TopicQueueFile | null {
  if (!fs.existsSync(TOPIC_QUEUE_FILE)) return null;
  return JSON.parse(fs.readFileSync(TOPIC_QUEUE_FILE, 'utf-8'));
}

function markSessionRendered(topicSlug: string, sessionNumber: number): void {
  const queue = loadTopicQueue();
  if (!queue) return;
  const topic = queue.topics.find(t => t.slug === topicSlug);
  if (topic && !topic.rendered.includes(sessionNumber)) {
    topic.rendered.push(sessionNumber);
    topic.rendered.sort((a, b) => a - b);
    queue.lastUpdated = new Date().toISOString().split('T')[0];
    fs.writeFileSync(TOPIC_QUEUE_FILE, JSON.stringify(queue, null, 2) + '\n');
    log('SUCCESS', `Queue updated: ${topicSlug} session ${sessionNumber} marked as rendered`);
  }
}

function pickNextUnrendered(): { slug: string; session: number; name: string } | null {
  const queue = loadTopicQueue();
  if (!queue) return null;
  const pw: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const sorted = [...queue.topics].sort((a, b) => (pw[b.priority] || 1) - (pw[a.priority] || 1));
  for (const topic of sorted) {
    for (let s = 1; s <= topic.sessions; s++) {
      if (!topic.rendered.includes(s)) {
        return { slug: topic.slug, session: s, name: topic.name };
      }
    }
  }
  return null;
}

function showPipelineStatus(): void {
  const queue = loadTopicQueue();
  const manifest = loadManifest();

  console.log('\n=== Render & Stage Pipeline Status ===\n');

  if (queue) {
    let totalSessions = 0;
    let totalRendered = 0;
    let totalPublished = 0;

    for (const t of queue.topics) {
      totalSessions += t.sessions;
      totalRendered += t.rendered.length;
      totalPublished += t.published.length;
      const unrendered = t.sessions - t.rendered.length;
      if (unrendered > 0) {
        const bar = '|'.repeat(t.rendered.length) + '.'.repeat(unrendered);
        console.log(`  ${t.slug.padEnd(25)} [${bar}] ${t.rendered.length}/${t.sessions} (${t.priority})`);
      }
    }

    console.log(`\n  Total: ${totalRendered}/${totalSessions} rendered, ${totalPublished} published`);
    console.log(`  Ready to publish: ${totalRendered - totalPublished}`);
    console.log(`  Remaining: ${totalSessions - totalRendered} sessions`);
    console.log(`  Est. time: ${((totalSessions - totalRendered) * 8 / 60).toFixed(1)} hours`);
  }

  const entryKeys = Object.keys(manifest.entries);
  if (entryKeys.length > 0) {
    console.log('\n--- Recent Renders ---');
    const recent = entryKeys.slice(-10);
    for (const key of recent) {
      const e = manifest.entries[key];
      const dur = e.timings.total ? formatDuration(e.timings.total) : '?';
      console.log(`  ${key.padEnd(20)} ${e.status.padEnd(10)} ${dur} ${e.errors.length > 0 ? `(${e.errors.length} errors)` : ''}`);
    }
  }

  const next = pickNextUnrendered();
  if (next) {
    console.log(`\n  Next: ${next.slug} session ${next.session} (${next.name})`);
  } else {
    console.log('\n  All sessions rendered!');
  }
  console.log('');
}

// ─── Paths ──────────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '..');
const HOME = process.env.HOME || '/tmp';
const STAGING_BASE = path.join(HOME, 'guru-sishya-uploads');
const GURU_SISHYA_BASE = path.join(HOME, 'Documents', 'guru-sishya');
const MANIFEST_PATH = path.join(STAGING_BASE, 'manifest.json');
const LOG_DIR = path.join(HOME, 'guru-sishya-logs');

// ─── Types ──────────────────────────────────────────────────────────────────

interface ManifestEntry {
  topic: string;
  session: number;
  status: 'rendering' | 'rendered' | 'staged' | 'uploading' | 'uploaded' | 'failed';
  startedAt: string;
  completedAt: string | null;
  files: {
    long?: string;
    verticalFull?: string;
    parts: string[];
    thumbnail?: string;
    metadata?: string;
    partMetadata: string[];
  };
  timings: {
    storyboard?: number;
    longRender?: number;
    verticalRender?: number;
    partsRender?: number;
    thumbnail?: number;
    metadata?: number;
    staging?: number;
    total?: number;
  };
  errors: string[];
}

interface Manifest {
  version: number;
  lastUpdated: string;
  entries: Record<string, ManifestEntry>; // key: "topic:session"
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function log(level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | 'STEP', msg: string): void {
  const ts = new Date().toISOString();
  const prefix = {
    INFO: '   ',
    WARN: ' ! ',
    ERROR: ' X ',
    SUCCESS: ' + ',
    STEP: '>>>',
  }[level];
  const line = `[${ts}] ${prefix} ${msg}`;
  console.log(line);

  ensureDir(LOG_DIR);
  fs.appendFileSync(
    path.join(LOG_DIR, 'render-and-stage.log'),
    line + '\n',
  );
}

function runCmd(cmd: string, label: string): void {
  log('INFO', `Running: ${label}`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: PROJECT_ROOT, timeout: 30 * 60 * 1000 });
  } catch (err) {
    throw new Error(`${label} failed: ${(err as Error).message}`);
  }
}

function timedRun<T>(fn: () => T): { result: T; elapsed: number } {
  const start = Date.now();
  const result = fn();
  return { result, elapsed: Date.now() - start };
}

function copyFile(src: string, dest: string): boolean {
  if (!fs.existsSync(src)) {
    log('WARN', `Source not found: ${src}`);
    return false;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  const size = (fs.statSync(dest).size / (1024 * 1024)).toFixed(1);
  log('SUCCESS', `Staged: ${path.basename(dest)} (${size} MB)`);
  return true;
}

function loadManifest(): Manifest {
  if (fs.existsSync(MANIFEST_PATH)) {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  }
  return { version: 1, lastUpdated: '', entries: {} };
}

function saveManifest(manifest: Manifest): void {
  manifest.lastUpdated = new Date().toISOString();
  ensureDir(STAGING_BASE);
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  if (mins > 0) return `${mins}m ${remainSecs}s`;
  return `${secs}s`;
}

// ─── Main Pipeline ──────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--status')) {
    showPipelineStatus();
    return;
  }

  let topic: string;
  let session: number;

  if (args.includes('--next')) {
    const next = pickNextUnrendered();
    if (!next) {
      log('INFO', 'All sessions in the queue are rendered. Nothing to do.');
      return;
    }
    topic = next.slug;
    session = next.session;
    log('INFO', `Auto-picked next: ${next.name} (${topic}) session ${session}`);
  } else {
    const positional = args.filter(a => !a.startsWith('--'));
    if (positional.length < 2) {
      console.log('Usage: npx tsx scripts/render-and-stage.ts <topic-slug> <session-number>');
      console.log('       npx tsx scripts/render-and-stage.ts kafka 2');
      console.log('       npx tsx scripts/render-and-stage.ts kafka 2 --skip-vertical');
      console.log('       npx tsx scripts/render-and-stage.ts kafka 2 --dry-run');
      console.log('       npx tsx scripts/render-and-stage.ts --next');
      console.log('       npx tsx scripts/render-and-stage.ts --status');
      process.exit(1);
    }

    topic = positional[0];
    session = parseInt(positional[1], 10);

    if (isNaN(session) || session < 1) {
      log('ERROR', 'Session number must be a positive integer.');
      process.exit(1);
    }
  }

  const skipVertical = args.includes('--skip-vertical');
  const dryRun = args.includes('--dry-run');

  const pipelineStart = Date.now();
  const key = `${topic}:${session}`;
  const stagingDir = path.join(STAGING_BASE, topic, `session-${session}`);
  const propsFile = path.join(PROJECT_ROOT, `output/test-props-s${session}.json`);
  const longOutputDir = path.join(GURU_SISHYA_BASE, topic, `session-${session}`, 'long');
  const verticalDir = path.join(GURU_SISHYA_BASE, topic, `session-${session}`, 'vertical');
  const verticalPartsDir = path.join(GURU_SISHYA_BASE, topic, `session-${session}`, 'vertical-parts');

  console.log('');
  console.log('================================================================');
  console.log('  RENDER & STAGE PIPELINE');
  console.log(`  Topic: ${topic} | Session: ${session}`);
  console.log(`  Staging: ${stagingDir}`);
  console.log('================================================================');
  console.log('');

  // Initialize manifest entry
  const manifest = loadManifest();
  const entry: ManifestEntry = {
    topic,
    session,
    status: 'rendering',
    startedAt: new Date().toISOString(),
    completedAt: null,
    files: { parts: [], partMetadata: [] },
    timings: {},
    errors: [],
  };
  manifest.entries[key] = entry;
  saveManifest(manifest);

  if (dryRun) {
    log('INFO', 'DRY RUN — showing what would be done:');
    log('INFO', `  1. Generate storyboard: render-session.ts ${topic} ${session}`);
    log('INFO', `  2. Render long video: LongVideo -> ${longOutputDir}`);
    if (!skipVertical) {
      log('INFO', `  3. Render vertical: VerticalLong -> ${verticalDir}`);
      log('INFO', `  4. Render vertical parts -> ${verticalPartsDir}`);
    }
    log('INFO', `  5. Generate thumbnail`);
    log('INFO', `  6. Generate metadata`);
    log('INFO', `  7. Stage to: ${stagingDir}`);
    log('INFO', `  8. Update manifest: ${MANIFEST_PATH}`);
    process.exit(0);
  }

  try {
    // ── Step 1: Generate storyboard + TTS ─────────────────────────────────
    log('STEP', '[1/8] Generating storyboard + TTS audio...');
    const t1 = timedRun(() => {
      runCmd(`npx tsx scripts/render-session.ts ${topic} ${session}`, 'Storyboard generation');
    });
    entry.timings.storyboard = t1.elapsed;
    log('SUCCESS', `Storyboard generated in ${formatDuration(t1.elapsed)}`);

    if (!fs.existsSync(propsFile)) {
      throw new Error(`Props file not generated: ${propsFile}`);
    }

    // ── Step 2: Render long-form horizontal video ─────────────────────────
    log('STEP', '[2/8] Rendering long-form horizontal video (LongVideo)...');
    ensureDir(longOutputDir);
    const longOutput = path.join(longOutputDir, `${topic}-s${session}.mp4`);
    const t2 = timedRun(() => {
      runCmd(
        `npx remotion render src/compositions/index.tsx LongVideo "${longOutput}" ` +
        `--props="${propsFile}" --concurrency=50% --gl=angle --crf=23`,
        'LongVideo render',
      );
    });
    entry.timings.longRender = t2.elapsed;
    log('SUCCESS', `Long video rendered in ${formatDuration(t2.elapsed)}`);

    if (!skipVertical) {
      // ── Step 3: Render full vertical video ──────────────────────────────
      log('STEP', '[3/8] Rendering full vertical video (VerticalLong)...');
      ensureDir(verticalDir);
      const vertOutput = path.join(verticalDir, `${topic}-s${session}-vertical.mp4`);
      const t3 = timedRun(() => {
        runCmd(
          `npx remotion render src/compositions/index.tsx VerticalLong "${vertOutput}" ` +
          `--props="${propsFile}" --codec=h264 --crf=18 --audio-bitrate=192K --concurrency=4`,
          'VerticalLong render',
        );
      });
      entry.timings.verticalRender = t3.elapsed;
      log('SUCCESS', `Vertical video rendered in ${formatDuration(t3.elapsed)}`);

      // ── Step 4: Split and render vertical parts ─────────────────────────
      log('STEP', '[4/8] Splitting + rendering vertical parts...');
      const t4 = timedRun(() => {
        runCmd(
          `npx tsx scripts/render-vertical-parts.ts ${topic} ${session}`,
          'Vertical parts render',
        );
      });
      entry.timings.partsRender = t4.elapsed;
      log('SUCCESS', `Vertical parts rendered in ${formatDuration(t4.elapsed)}`);
    } else {
      log('INFO', '[3/8] Skipping vertical render (--skip-vertical)');
      log('INFO', '[4/8] Skipping vertical parts (--skip-vertical)');
    }

    // ── Step 5: Generate thumbnail ────────────────────────────────────────
    log('STEP', '[5/8] Generating thumbnail...');
    const thumbnailOutput = path.join(PROJECT_ROOT, `output/${topic}-s${session}-thumbnail.png`);
    const t5 = timedRun(() => {
      runCmd(
        `npx tsx scripts/generate-thumbnail.ts ${propsFile}`,
        'Thumbnail generation',
      );
    });
    entry.timings.thumbnail = t5.elapsed;
    log('SUCCESS', `Thumbnail generated in ${formatDuration(t5.elapsed)}`);

    // ── Step 6: Generate metadata ─────────────────────────────────────────
    log('STEP', '[6/8] Generating upload metadata...');
    const t6 = timedRun(() => {
      runCmd(
        `npx tsx scripts/generate-upload-metadata.ts ${topic} ${session}`,
        'Metadata generation',
      );
    });
    entry.timings.metadata = t6.elapsed;
    log('SUCCESS', `Metadata generated in ${formatDuration(t6.elapsed)}`);

    // ── Step 7: Stage everything ──────────────────────────────────────────
    log('STEP', '[7/8] Staging files to upload directory...');
    ensureDir(stagingDir);
    const t7 = timedRun(() => {
      // Long-form video
      const longSrc = path.join(longOutputDir, `${topic}-s${session}.mp4`);
      if (copyFile(longSrc, path.join(stagingDir, 'long.mp4'))) {
        entry.files.long = 'long.mp4';
      }

      // Full vertical video
      if (!skipVertical) {
        const vertSrc = path.join(verticalDir, `${topic}-s${session}-vertical.mp4`);
        if (copyFile(vertSrc, path.join(stagingDir, 'vertical-full.mp4'))) {
          entry.files.verticalFull = 'vertical-full.mp4';
        }

        // Vertical parts
        for (let p = 1; p <= 5; p++) {
          // Find part files — they use the format topic-s{N}-part{P}of{T}.mp4
          const partFiles = fs.existsSync(verticalPartsDir)
            ? fs.readdirSync(verticalPartsDir).filter(f => f.includes(`-part${p}of`) && f.endsWith('.mp4'))
            : [];
          if (partFiles.length > 0) {
            const partSrc = path.join(verticalPartsDir, partFiles[0]);
            const partDest = `part${p}.mp4`;
            if (copyFile(partSrc, path.join(stagingDir, partDest))) {
              entry.files.parts.push(partDest);
            }
          }
        }
      }

      // Thumbnail — check multiple possible locations
      const thumbCandidates = [
        thumbnailOutput,
        path.join(PROJECT_ROOT, 'output', 'thumbnail.png'),
        path.join(PROJECT_ROOT, 'output', `${topic}-s${session}-thumbnail.png`),
      ];
      for (const thumbSrc of thumbCandidates) {
        if (fs.existsSync(thumbSrc)) {
          if (copyFile(thumbSrc, path.join(stagingDir, 'thumbnail.png'))) {
            entry.files.thumbnail = 'thumbnail.png';
          }
          break;
        }
      }

      // Metadata files
      const metaDir = path.join(GURU_SISHYA_BASE, topic, `session-${session}`);
      const metaSrc = path.join(metaDir, 'metadata.json');
      const metaOutputSrc = path.join(PROJECT_ROOT, 'output', `${topic}-s${session}-metadata.json`);

      const metaSource = fs.existsSync(metaSrc) ? metaSrc : metaOutputSrc;
      if (copyFile(metaSource, path.join(stagingDir, 'metadata.json'))) {
        entry.files.metadata = 'metadata.json';
      }

      // Part metadata files
      for (let p = 1; p <= 5; p++) {
        const partMetaCandidates = [
          path.join(metaDir, 'vertical-parts', `part${p}-metadata.json`),
          path.join(PROJECT_ROOT, 'output', `${topic}-s${session}-part${p}-metadata.json`),
        ];
        for (const src of partMetaCandidates) {
          if (fs.existsSync(src)) {
            const dest = `part${p}-metadata.json`;
            if (copyFile(src, path.join(stagingDir, dest))) {
              entry.files.partMetadata.push(dest);
            }
            break;
          }
        }
      }
    });
    entry.timings.staging = t7.elapsed;
    log('SUCCESS', `Files staged in ${formatDuration(t7.elapsed)}`);

    // ── Step 8: Update manifest + queue ──────────────────────────────────
    log('STEP', '[8/8] Updating manifest + topic queue...');
    entry.status = 'staged';
    entry.completedAt = new Date().toISOString();
    entry.timings.total = Date.now() - pipelineStart;
    manifest.entries[key] = entry;
    saveManifest(manifest);
    markSessionRendered(topic, session);
    log('SUCCESS', 'Manifest + queue updated');

  } catch (err) {
    entry.status = 'failed';
    entry.errors.push((err as Error).message);
    entry.completedAt = new Date().toISOString();
    entry.timings.total = Date.now() - pipelineStart;
    manifest.entries[key] = entry;
    saveManifest(manifest);
    log('ERROR', `Pipeline failed: ${(err as Error).message}`);
    process.exit(1);
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  const totalTime = formatDuration(Date.now() - pipelineStart);

  console.log('');
  console.log('================================================================');
  console.log('  PIPELINE COMPLETE');
  console.log('================================================================');
  console.log('');
  console.log(`  Topic:    ${topic}`);
  console.log(`  Session:  ${session}`);
  console.log(`  Status:   ${entry.status}`);
  console.log(`  Time:     ${totalTime}`);
  console.log('');
  console.log('  Staged files:');
  if (entry.files.long) console.log(`    long.mp4`);
  if (entry.files.verticalFull) console.log(`    vertical-full.mp4`);
  entry.files.parts.forEach(p => console.log(`    ${p}`));
  if (entry.files.thumbnail) console.log(`    thumbnail.png`);
  if (entry.files.metadata) console.log(`    metadata.json`);
  entry.files.partMetadata.forEach(m => console.log(`    ${m}`));
  console.log('');
  console.log(`  Staging dir: ${stagingDir}`);
  console.log(`  Manifest:    ${MANIFEST_PATH}`);
  console.log('');
  console.log('  Timings:');
  if (entry.timings.storyboard) console.log(`    Storyboard:      ${formatDuration(entry.timings.storyboard)}`);
  if (entry.timings.longRender) console.log(`    Long render:     ${formatDuration(entry.timings.longRender)}`);
  if (entry.timings.verticalRender) console.log(`    Vertical render: ${formatDuration(entry.timings.verticalRender)}`);
  if (entry.timings.partsRender) console.log(`    Parts render:    ${formatDuration(entry.timings.partsRender)}`);
  if (entry.timings.thumbnail) console.log(`    Thumbnail:       ${formatDuration(entry.timings.thumbnail)}`);
  if (entry.timings.metadata) console.log(`    Metadata:        ${formatDuration(entry.timings.metadata)}`);
  if (entry.timings.staging) console.log(`    Staging:         ${formatDuration(entry.timings.staging)}`);
  console.log(`    TOTAL:           ${totalTime}`);
  console.log('');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
