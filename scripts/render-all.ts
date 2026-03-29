#!/usr/bin/env npx tsx
/**
 * Render ALL topics in parallel with organized folder structure.
 *
 * Usage:
 *   npx tsx scripts/render-all.ts              # Full quality, all topics
 *   npx tsx scripts/render-all.ts --fast       # Half-res preview mode
 *   npx tsx scripts/render-all.ts --topic "load-balancing"  # Single topic
 *   npx tsx scripts/render-all.ts --skip-tts   # Skip TTS if audio cached
 *   npx tsx scripts/render-all.ts --max 3      # Max parallel renders
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, exec } from 'child_process';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.resolve(PROJECT_ROOT, '../guru-sishya/public/content');
const OUTPUT_DIR = path.resolve(PROJECT_ROOT, 'output');
const DOCS_DIR = path.resolve(process.env.HOME || '~', 'Documents/guru-sishya');

// Parse CLI args
const args = process.argv.slice(2);
const isFast = args.includes('--fast');
const skipTts = args.includes('--skip-tts');
const maxParallel = parseInt(getArg('--max') || '3', 10);
const singleTopic = getArg('--topic');

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

interface TopicFile {
  slug: string;
  filename: string;
  sessions: number;
}

function discoverTopics(): TopicFile[] {
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.json'));
  const topics: TopicFile[] = [];

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, file), 'utf-8'));
      const slug = file.replace('.json', '');
      if (singleTopic && slug !== singleTopic) continue;

      let sessionCount = 0;

      if (Array.isArray(data)) {
        // Guru-sishya format: array of topic objects
        const firstItem = data[0];
        if (firstItem?.sessions && typeof firstItem.sessions === 'object') {
          // Nested: [{topic, sessions: {"1": "md", "2": "md"}}]
          sessionCount = data.reduce((sum: number, t: any) => {
            return sum + (t.sessions ? Object.keys(t.sessions).length : 0);
          }, 0);
        } else {
          // Flat: each array item = 1 session
          sessionCount = data.length;
        }
      } else if (data.plan?.sessions?.length) {
        sessionCount = data.plan.sessions.length;
      }

      if (sessionCount > 0) {
        topics.push({ slug, filename: file, sessions: sessionCount });
      }
    } catch {
      // Skip non-topic files
    }
  }

  return topics;
}

async function renderSession(
  topicSlug: string,
  sessionNum: number,
  totalSessions: number,
  topicIndex: number,
  totalTopics: number,
): Promise<{ success: boolean; time: number }> {
  const start = Date.now();
  const outputFolder = path.join(OUTPUT_DIR, topicSlug);
  fs.mkdirSync(outputFolder, { recursive: true });

  const outputFile = path.join(outputFolder, `s${sessionNum}.mp4`);
  const propsFile = path.join(outputFolder, `props-s${sessionNum}.json`);

  // Check if already rendered
  if (fs.existsSync(outputFile) && !args.includes('--force')) {
    console.log(`  \u23ED  Skip ${topicSlug} s${sessionNum} (already exists, use --force to re-render)`);
    return { success: true, time: 0 };
  }

  const label = `[${topicIndex + 1}/${totalTopics}] ${topicSlug} s${sessionNum}/${totalSessions}`;
  console.log(`  \uD83C\uDFAC Rendering ${label}...`);

  try {
    // Step 1: Generate storyboard + TTS
    const ttsFlag = skipTts ? '--skip-tts' : '';
    execSync(
      `npx tsx scripts/render-session.ts ${topicSlug} ${sessionNum} ${ttsFlag}`,
      { cwd: path.resolve(__dirname, '..'), stdio: 'pipe' },
    );

    // Step 2: Render video
    const quality = isFast ? '--jpeg-quality 60' : '--jpeg-quality 90';
    const scale = isFast ? '--scale 0.5' : '';
    const propsArg = fs.existsSync(propsFile)
      ? `--props='${propsFile}'`
      : `--props='output/test-props-s${sessionNum}.json'`;

    execSync(
      `npx remotion render src/compositions/index.tsx LongVideo ${propsArg} --output='${outputFile}' ${quality} ${scale} --concurrency=6`,
      { cwd: path.resolve(__dirname, '..'), stdio: 'pipe' },
    );

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const size = (fs.statSync(outputFile).size / 1024 / 1024).toFixed(1);
    console.log(`  \u2705 ${label} done (${elapsed}s, ${size}MB)`);

    // Step 3: Copy to Documents/guru-sishya/{topic}/session-{n}/
    const docsSessionDir = path.join(DOCS_DIR, topicSlug, `session-${sessionNum}`);
    const docsLongDir = path.join(docsSessionDir, 'long');
    const docsShortsDir = path.join(docsSessionDir, 'shorts');
    const docsReelsDir = path.join(docsSessionDir, 'reels');
    fs.mkdirSync(docsLongDir, { recursive: true });
    fs.mkdirSync(docsShortsDir, { recursive: true });
    fs.mkdirSync(docsReelsDir, { recursive: true });

    // Copy long-form
    fs.copyFileSync(outputFile, path.join(docsLongDir, `${topicSlug}-s${sessionNum}.mp4`));

    // Step 4: Render vertical shorts + reels using Remotion ShortVideo composition
    try {
      console.log(`  \uD83D\uDCF1 Rendering ${topicSlug} s${sessionNum} vertical shorts (Remotion)...`);
      const propsForShorts = fs.existsSync(propsFile) ? propsFile : `output/test-props-s${sessionNum}.json`;
      execSync(
        `npx tsx scripts/render-vertical-shorts.ts --topic "${topicSlug}" --session ${sessionNum} --props "${propsForShorts}"`,
        { cwd: path.resolve(__dirname, '..'), stdio: 'pipe' },
      );

      // Copy shorts/reels from local output to Documents
      const shortsYtDir = path.resolve(__dirname, '..', 'output/shorts/youtube');
      const shortsIgDir = path.resolve(__dirname, '..', 'output/shorts/instagram');
      const shortsMetaFile = path.resolve(__dirname, '..', 'output/shorts/metadata.json');

      if (fs.existsSync(shortsYtDir)) {
        fs.readdirSync(shortsYtDir).filter(f => f.endsWith('.mp4')).forEach(f => {
          fs.copyFileSync(path.join(shortsYtDir, f), path.join(docsShortsDir, f));
        });
      }
      if (fs.existsSync(shortsIgDir)) {
        fs.readdirSync(shortsIgDir).filter(f => f.endsWith('.mp4')).forEach(f => {
          fs.copyFileSync(path.join(shortsIgDir, f), path.join(docsReelsDir, f));
        });
      }
      if (fs.existsSync(shortsMetaFile)) {
        fs.copyFileSync(shortsMetaFile, path.join(docsSessionDir, 'metadata.json'));
      }

      const shortCount = fs.existsSync(shortsYtDir) ? fs.readdirSync(shortsYtDir).filter(f => f.endsWith('.mp4')).length : 0;
      const reelCount = fs.existsSync(shortsIgDir) ? fs.readdirSync(shortsIgDir).filter(f => f.endsWith('.mp4')).length : 0;
      console.log(`  \u2705 ${label} \u2192 ${shortCount} shorts + ${reelCount} reels \u2192 Documents/guru-sishya/`);
    } catch (shortsErr: any) {
      console.warn(`  \u26A0\uFE0F  Shorts rendering failed for ${label}: ${shortsErr.message?.slice(0, 100)}`);
    }

    return { success: true, time: Date.now() - start };
  } catch (err: any) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`  \u274C ${label} FAILED after ${elapsed}s: ${err.message?.slice(0, 200)}`);
    return { success: false, time: Date.now() - start };
  }
}

async function renderWithConcurrency(
  tasks: Array<() => Promise<any>>,
  limit: number,
): Promise<void> {
  const executing: Set<Promise<void>> = new Set();

  for (const task of tasks) {
    const p = task().then(() => { executing.delete(p); });
    executing.add(p);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}

async function main() {
  const topics = discoverTopics();

  if (topics.length === 0) {
    console.error('\u274C No topics found in', CONTENT_DIR);
    if (singleTopic) console.error(`  Looking for: ${singleTopic}.json`);
    process.exit(1);
  }

  const totalSessions = topics.reduce((sum, t) => sum + t.sessions, 0);

  console.log(`\n\uD83D\uDE80 Video Pipeline — Render All`);
  console.log(`  Topics: ${topics.length}`);
  console.log(`  Sessions: ${totalSessions}`);
  console.log(`  Mode: ${isFast ? 'FAST (540p preview)' : 'FULL (1080p)'}`);
  console.log(`  Parallel: ${maxParallel} simultaneous renders`);
  console.log(`  TTS: ${skipTts ? 'SKIP (use cached)' : 'Generate fresh'}`);
  console.log(`  Output: ${OUTPUT_DIR}/{topic-slug}/s{n}.mp4\n`);

  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;

  // Build task list
  const tasks: Array<() => Promise<void>> = [];
  topics.forEach((topic, topicIdx) => {
    for (let s = 1; s <= topic.sessions; s++) {
      const sessionNum = s;
      tasks.push(async () => {
        const result = await renderSession(
          topic.slug, sessionNum, topic.sessions, topicIdx, topics.length,
        );
        if (result.success) successCount++;
        else failCount++;
      });
    }
  });

  await renderWithConcurrency(tasks, maxParallel);

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n\uD83C\uDFC1 Done! ${successCount} rendered, ${failCount} failed (${totalTime} minutes)`);
  console.log(`  Output: ${OUTPUT_DIR}/\n`);

  // Print folder structure
  console.log('  Folder structure:');
  for (const topic of topics) {
    const dir = path.join(OUTPUT_DIR, topic.slug);
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.mp4'));
      console.log(`    ${topic.slug}/ (${files.length} videos)`);
    }
  }
}

main().catch((err) => {
  console.error('\u274C Fatal error:', err);
  process.exit(1);
});
