#!/usr/bin/env npx tsx
/**
 * Render viral shorts from an existing storyboard using the ViralShort composition.
 * Uses smart-clip-selector to pick the best subtopic clips.
 *
 * Usage:
 *   npx tsx scripts/render-viral-shorts.ts --topic "Load Balancing" --session 1 --props output/test-props-s1.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { Storyboard } from '../src/types';
import {
  selectSubtopicClips,
  buildMiniStoryboard,
} from '../src/pipeline/smart-clip-selector';

const args = process.argv.slice(2);
const topic = getArg('--topic') || 'Load Balancing';
const session = parseInt(getArg('--session') || '1', 10);
const propsOverride = getArg('--props');

const DOCS_DIR = path.resolve(process.env.HOME || '~', 'Documents/guru-sishya');
const FPS = 30;

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

// ── Topic slug for folder names ──────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // 1. Load storyboard from props JSON
  const propsPath = propsOverride || `output/test-props-s${session}.json`;
  const absPropsPath = path.resolve(propsPath);
  if (!fs.existsSync(absPropsPath)) {
    console.error(`\u274C Props file not found: ${absPropsPath}`);
    console.error('  Run render-session.ts first to generate the storyboard');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(absPropsPath, 'utf-8'));
  const storyboard: Storyboard = raw.storyboard ?? raw;

  if (!storyboard.scenes || storyboard.scenes.length === 0) {
    console.error('\u274C Storyboard has no scenes.');
    process.exit(1);
  }

  console.log(`\n\uD83D\uDD25 Viral Shorts Renderer (ViralShort composition)`);
  console.log(`  Topic: ${topic} (Session ${session})`);
  console.log(`  Scenes: ${storyboard.scenes.length}`);

  // 2. Select best subtopic clips
  const clips = selectSubtopicClips(storyboard.scenes, topic, FPS);

  if (clips.length === 0) {
    console.error('\u274C No suitable clips found in storyboard.');
    console.error('  (Need clips between 20-58 seconds with non-title scenes)');
    process.exit(1);
  }

  console.log(`  Clips selected: ${clips.length}\n`);
  for (const clip of clips) {
    console.log(
      `    [${clip.archetype}] scenes ${clip.startScene}-${clip.endScene} ` +
      `(${clip.duration}s, score=${clip.score}) "${clip.heading}"`,
    );
  }
  console.log('');

  // 3. Create output directories
  const topicSlug = slugify(topic);
  const shortsDir = path.join(DOCS_DIR, topicSlug, `session-${session}`, 'shorts');
  const reelsDir = path.join(DOCS_DIR, topicSlug, `session-${session}`, 'reels');
  fs.mkdirSync(shortsDir, { recursive: true });
  fs.mkdirSync(reelsDir, { recursive: true });

  // Local output directories for CI/pipeline use
  const localShortsDir = path.join(path.resolve('output'), 'shorts', 'youtube');
  const localReelsDir = path.join(path.resolve('output'), 'shorts', 'instagram');
  fs.mkdirSync(localShortsDir, { recursive: true });
  fs.mkdirSync(localReelsDir, { recursive: true });

  // 4. Bundle Remotion project ONCE
  const entryPoint = path.resolve(__dirname, '../src/compositions/index.tsx');
  console.log('  Bundling Remotion project...');
  const bundleLocation = await bundle({ entryPoint });
  console.log('  Bundle ready.\n');

  let successCount = 0;
  const clipMetadata: Array<{
    index: number;
    heading: string;
    archetype: string;
    scenes: string;
    duration: number;
    score: number;
    hookText: string;
    youtubeTitle: string;
    instagramCaption: string;
    youtubeShort: string;
    instagramReel: string;
  }> = [];

  // 5. Render each clip
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];

    // a. Build mini storyboard
    const miniStoryboard = buildMiniStoryboard(storyboard, clip.startScene, clip.endScene);

    // Write temp props JSON for debugging
    const tempPropsPath = path.join(
      path.resolve('output'), 'shorts', `viral-props-${i + 1}.json`,
    );
    fs.mkdirSync(path.dirname(tempPropsPath), { recursive: true });
    fs.writeFileSync(tempPropsPath, JSON.stringify({ storyboard: miniStoryboard }, null, 2));

    console.log(
      `  \uD83D\uDCF1 Short #${i + 1} (${clip.archetype}): ` +
      `scenes ${clip.startScene}-${clip.endScene}, ` +
      `${miniStoryboard.scenes.length} scenes, ` +
      `${miniStoryboard.durationInFrames} frames (~${clip.duration}s)`,
    );
    console.log(`     Hook: "${clip.hookText}"`);

    try {
      // b. Select the ViralShort composition with our mini storyboard
      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: 'ViralShort',
        inputProps: { storyboard: miniStoryboard },
      });

      // c. Render 1080x1920 MP4
      const ytOutput = path.join(localShortsDir, `short-${i + 1}.mp4`);
      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: 'h264',
        outputLocation: ytOutput,
        inputProps: { storyboard: miniStoryboard },
        concurrency: 6,
        onProgress: ({ progress }) => {
          process.stdout.write(
            `\r    Rendering short-${i + 1}: ${(progress * 100).toFixed(0)}%`,
          );
        },
      });

      const size = (fs.statSync(ytOutput).size / 1024 / 1024).toFixed(1);
      console.log(`\n    \u2705 Short #${i + 1}: ${ytOutput} (${size}MB)`);

      // d. Copy to Documents/guru-sishya/{topic}/session-{n}/shorts/
      const docsShortPath = path.join(shortsDir, `short-${i + 1}.mp4`);
      fs.copyFileSync(ytOutput, docsShortPath);

      // e. Copy as Instagram Reel
      const reelLocalPath = path.join(localReelsDir, `reel-${i + 1}.mp4`);
      const reelDocsPath = path.join(reelsDir, `reel-${i + 1}.mp4`);
      fs.copyFileSync(ytOutput, reelLocalPath);
      fs.copyFileSync(ytOutput, reelDocsPath);
      console.log(`    \u2705 Reel #${i + 1}: ${reelDocsPath}`);

      // Build metadata for this clip
      const youtubeTitle = `${clip.hookText} | ${topic} #shorts`;
      const instagramCaption = [
        clip.hookText,
        '',
        `Full video on YouTube: GuruSishya-India`,
        `Free prep: guru-sishya.in`,
        '',
        '#coding #interview #faang #dsa #systemdesign #gurusishya #shorts',
      ].join('\n');

      clipMetadata.push({
        index: i + 1,
        heading: clip.heading,
        archetype: clip.archetype,
        scenes: `${clip.startScene}-${clip.endScene}`,
        duration: clip.duration,
        score: clip.score,
        hookText: clip.hookText,
        youtubeTitle,
        instagramCaption,
        youtubeShort: `shorts/short-${i + 1}.mp4`,
        instagramReel: `reels/reel-${i + 1}.mp4`,
      });

      successCount++;
    } catch (err: any) {
      console.error(
        `\n    \u274C Short #${i + 1} failed: ${err.message?.slice(0, 200)}`,
      );
    }
  }

  // 6. Write metadata.json with YouTube titles + Instagram captions
  const metadata = {
    topic,
    topicSlug,
    sessionNumber: session,
    generatedAt: new Date().toISOString(),
    renderer: 'remotion-ViralShort',
    totalClips: clips.length,
    successfulRenders: successCount,
    clips: clipMetadata,
  };

  const metadataPath = path.join(path.resolve('output'), 'shorts', 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  // Also write to docs directory
  const docsMetadataPath = path.join(shortsDir, 'metadata.json');
  fs.writeFileSync(docsMetadataPath, JSON.stringify(metadata, null, 2));

  // 7. Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`\u2705 Done! ${successCount}/${clips.length} viral shorts rendered`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Shorts:   ${shortsDir}`);
  console.log(`  Reels:    ${reelsDir}`);
  console.log(`  Local:    output/shorts/`);
  console.log(`  Metadata: ${metadataPath}`);
  console.log('');

  if (successCount > 0) {
    console.log('  YouTube titles:');
    for (const cm of clipMetadata) {
      console.log(`    #${cm.index}: ${cm.youtubeTitle}`);
    }
    console.log('');
  }
}

main().catch((err) => {
  console.error('\u274C Fatal error:', err);
  process.exit(1);
});
