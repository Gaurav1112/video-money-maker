#!/usr/bin/env npx tsx
/**
 * Render vertical Shorts/Reels from an existing storyboard.
 * Uses Remotion ShortVideo composition (1080x1920) — NOT ffmpeg crop.
 *
 * Usage:
 *   npx tsx scripts/render-vertical-shorts.ts --topic load-balancing --session 1
 *   npx tsx scripts/render-vertical-shorts.ts --props output/test-props-s1.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { Scene, Storyboard } from '../src/types';

const args = process.argv.slice(2);
const topic = getArg('--topic') || 'load-balancing';
const session = parseInt(getArg('--session') || '1', 10);
const propsOverride = getArg('--props');
const DOCS_DIR = path.resolve(process.env.HOME || '~', 'Documents/guru-sishya');

const FPS = 30;
const MAX_SHORT_SECONDS = 58; // keep under 60s for YouTube Shorts
const MAX_SHORT_FRAMES = MAX_SHORT_SECONDS * FPS;
const SHORT_INTRO_FRAMES = 45; // matches ShortVideo component (1.5s)
const SHORT_OUTRO_FRAMES = 90; // matches ShortVideo component (3s)

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

// ---------------------------------------------------------------------------
// Clip selection — pick the best 2-3 segments from a long storyboard
// ---------------------------------------------------------------------------

interface Clip {
  startScene: number;
  endScene: number;
  estimatedDuration: number;
  type: string;
  label: string;
}

function selectBestClips(scenes: Scene[]): Clip[] {
  const clips: Clip[] = [];
  const sceneDur = (i: number) => (scenes[i].endFrame - scenes[i].startFrame) / FPS;

  // Helper: greedily add scenes starting from `start` until we hit MAX_SHORT_SECONDS
  function greedyClip(start: number, maxScenes: number = 5): { end: number; dur: number } {
    let dur = 0;
    let end = start;
    for (let i = start; i < Math.min(start + maxScenes, scenes.length); i++) {
      const sd = sceneDur(i);
      if (dur + sd > MAX_SHORT_SECONDS) break;
      dur += sd;
      end = i;
    }
    return { end, dur: Math.round(dur) };
  }

  // Clip 1: Hook — first scene(s) that fit in 60s
  {
    const { end, dur } = greedyClip(0, 3);
    if (dur > 0) {
      clips.push({ startScene: 0, endScene: end, estimatedDuration: dur, type: 'hook', label: 'hook' });
    }
  }

  // Clip 2: Best code scene (single scene, capped at 60s)
  const codeIdx = scenes.findIndex(s => s.type === 'code');
  if (codeIdx >= 0) {
    const dur = Math.min(sceneDur(codeIdx), MAX_SHORT_SECONDS);
    clips.push({
      startScene: codeIdx,
      endScene: codeIdx,
      estimatedDuration: Math.round(dur),
      type: 'code',
      label: 'code-walkthrough',
    });
  }

  // Clip 3: Interview / review scene
  const interviewIdx = scenes.findIndex(s =>
    s.type === 'interview' || s.type === 'review',
  );
  if (interviewIdx >= 0) {
    const { end, dur } = greedyClip(interviewIdx, 2);
    if (dur > 0) {
      clips.push({
        startScene: interviewIdx,
        endScene: end,
        estimatedDuration: dur,
        type: 'interview',
        label: 'interview-secret',
      });
    }
  }

  // Fallback: if less than 2 clips, grab interesting text scenes
  if (clips.length < 2) {
    for (let i = 2; i < scenes.length && clips.length < 3; i++) {
      if (scenes[i].type === 'text' && sceneDur(i) <= MAX_SHORT_SECONDS) {
        const used = clips.some(c => i >= c.startScene && i <= c.endScene);
        if (!used) {
          clips.push({
            startScene: i,
            endScene: i,
            estimatedDuration: Math.round(sceneDur(i)),
            type: 'text',
            label: 'insight',
          });
        }
      }
    }
  }

  return clips.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Build a mini storyboard for the ShortVideo composition
// ---------------------------------------------------------------------------

function buildMiniStoryboard(
  original: Storyboard,
  clip: Clip,
): Storyboard {
  const selectedScenes = original.scenes.slice(clip.startScene, clip.endScene + 1);

  // Re-index scene frames sequentially so ShortVideo can render them
  let cursor = 0;
  const reindexed: Scene[] = [];

  for (const scene of selectedScenes) {
    const sceneDuration = scene.endFrame - scene.startFrame;
    // Cap total content to stay under max (minus intro + outro overhead)
    const availableFrames = MAX_SHORT_FRAMES - SHORT_INTRO_FRAMES - SHORT_OUTRO_FRAMES - cursor;
    if (availableFrames <= 0) break;

    const clampedDuration = Math.min(sceneDuration, availableFrames);
    reindexed.push({
      ...scene,
      startFrame: cursor,
      endFrame: cursor + clampedDuration,
      duration: clampedDuration / FPS,
    });
    cursor += clampedDuration;
  }

  const totalContentFrames = cursor;

  // Calculate audio start offset — the first selected scene's audio offset
  // in the master track, so the short plays the RIGHT section of audio
  const firstOrigScene = selectedScenes[0];
  const audioStartOffset = firstOrigScene?.audioOffsetSeconds ??
    (original.sceneOffsets?.[clip.startScene] ?? 0);

  // Re-map scene offsets relative to the clip's audio start
  const clipSceneOffsets = reindexed.map((_, i) => {
    const origIdx = clip.startScene + i;
    const origOffset = original.sceneOffsets?.[origIdx] ??
      (original.scenes[origIdx]?.audioOffsetSeconds ?? 0);
    return origOffset - audioStartOffset;
  });

  return {
    ...original,
    width: 1080,
    height: 1920,
    scenes: reindexed,
    durationInFrames: totalContentFrames,
    // Keep master audio but tell ShortVideo where to seek
    audioFile: original.audioFile,
    sceneOffsets: clipSceneOffsets,
    // Store the audio start offset so ShortVideo can seek the master audio
    _audioStartOffset: audioStartOffset,
  } as any;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Load storyboard
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

  console.log(`\n\uD83C\uDFAC Vertical Shorts Renderer (Remotion ShortVideo)`);
  console.log(`  Topic: ${topic} (Session ${session})`);
  console.log(`  Scenes: ${storyboard.scenes.length}`);

  // Select best clips for shorts
  const clips = selectBestClips(storyboard.scenes);

  if (clips.length === 0) {
    console.error('\u274C No suitable clips found in storyboard.');
    process.exit(1);
  }

  console.log(`  Clips: ${clips.length}\n`);

  // Create output directories
  const shortsDir = path.join(DOCS_DIR, topic, `session-${session}`, 'shorts');
  const reelsDir = path.join(DOCS_DIR, topic, `session-${session}`, 'reels');
  fs.mkdirSync(shortsDir, { recursive: true });
  fs.mkdirSync(reelsDir, { recursive: true });

  // Also create local output directory for CI/pipeline use
  const localShortsDir = path.join(path.resolve('output'), 'shorts', 'youtube');
  const localReelsDir = path.join(path.resolve('output'), 'shorts', 'instagram');
  fs.mkdirSync(localShortsDir, { recursive: true });
  fs.mkdirSync(localReelsDir, { recursive: true });

  // Bundle the Remotion project once (reuse for all clips)
  const entryPoint = path.resolve(__dirname, '../src/compositions/index.tsx');
  console.log('  Bundling Remotion project...');
  const bundleLocation = await bundle({ entryPoint });
  console.log('  Bundle ready.\n');

  let successCount = 0;

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const miniStoryboard = buildMiniStoryboard(storyboard, clip);

    console.log(
      `  \uD83D\uDCF1 Short #${i + 1} (${clip.label}): ` +
      `scenes ${clip.startScene}-${clip.endScene}, ` +
      `${miniStoryboard.scenes.length} scenes, ` +
      `${miniStoryboard.durationInFrames} frames (~${clip.estimatedDuration}s)`,
    );

    try {
      // Select the ShortVideo composition with our mini storyboard
      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: 'ShortVideo',
        inputProps: { storyboard: miniStoryboard },
      });

      // Render YouTube Short (1080x1920)
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

      // Copy to Documents/guru-sishya shorts folder
      const docsShortPath = path.join(shortsDir, `short-${i + 1}.mp4`);
      fs.copyFileSync(ytOutput, docsShortPath);

      // Copy as Instagram Reel (same 9:16 file — Reels accept this format)
      const reelLocalPath = path.join(localReelsDir, `reel-${i + 1}.mp4`);
      const reelDocsPath = path.join(reelsDir, `reel-${i + 1}.mp4`);
      fs.copyFileSync(ytOutput, reelLocalPath);
      fs.copyFileSync(ytOutput, reelDocsPath);
      console.log(`    \u2705 Reel #${i + 1}: ${reelDocsPath}`);

      successCount++;
    } catch (err: any) {
      console.error(
        `\n    \u274C Short #${i + 1} failed: ${err.message?.slice(0, 200)}`,
      );
    }
  }

  // Write metadata summary
  const metadata = {
    topic,
    sessionNumber: session,
    generatedAt: new Date().toISOString(),
    renderer: 'remotion-ShortVideo',
    clips: clips.map((clip, i) => ({
      index: i + 1,
      label: clip.label,
      type: clip.type,
      scenes: `${clip.startScene}-${clip.endScene}`,
      estimatedDuration: clip.estimatedDuration,
      youtubeShort: `shorts/short-${i + 1}.mp4`,
      instagramReel: `reels/reel-${i + 1}.mp4`,
    })),
  };
  const metadataPath = path.join(
    path.resolve('output'), 'shorts', 'metadata.json',
  );
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  console.log(`\n\u2705 Done! ${successCount}/${clips.length} shorts + reels rendered`);
  console.log(`  Shorts: ${shortsDir}`);
  console.log(`  Reels:  ${reelsDir}`);
  console.log(`  Local:  output/shorts/`);
  console.log(`  Meta:   ${metadataPath}\n`);
}

main().catch((err) => {
  console.error('\u274C Fatal error:', err);
  process.exit(1);
});
