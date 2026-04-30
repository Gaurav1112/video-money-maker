/**
 * render-shorts.ts — Generate 4 YouTube Shorts from a long-form storyboard.
 *
 * Picks the 4 best segments:
 *   Short 1: HOOK (title + first content scene)
 *   Short 2: PYTHON code walkthrough
 *   Short 3: JAVA code walkthrough
 *   Short 4: REVIEW QUESTION scene (interactive/engaging)
 *
 * Usage:
 *   npx tsx scripts/render-shorts.ts output/test-props.json
 */

import path from 'path';
import fs from 'fs';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { Scene, Storyboard } from '../src/types';

const FPS = 30;
const MAX_SHORT_SECONDS = 58; // keep under 60s for Shorts
const MAX_SHORT_FRAMES = MAX_SHORT_SECONDS * FPS;
const MINI_INTRO_FRAMES = 30; // 1 second
const CTA_FRAMES = 60; // 2 seconds

// ---------------------------------------------------------------------------
// Scene selection helpers
// ---------------------------------------------------------------------------

interface ShortDefinition {
  label: string;
  clipType: string;
  selectScenes: (scenes: Scene[]) => Scene[];
}

function selectHookScenes(scenes: Scene[]): Scene[] {
  // Title scene(s) + first text/content scene — the hook
  const result: Scene[] = [];
  for (const s of scenes) {
    if (s.type === 'title' || s.type === 'text') {
      result.push(s);
      if (result.length >= 3) break;
    }
    // Stop after we have at least 1 title + 1 content
    if (result.length >= 2 && result.some(r => r.type === 'title') && result.some(r => r.type !== 'title')) {
      break;
    }
  }
  return result.length > 0 ? result : scenes.slice(0, 2);
}

function selectCodeScenesByLanguage(scenes: Scene[], targetLang: string): Scene[] {
  // Find the first code scene matching the target language and include surrounding context
  const codeIdx = scenes.findIndex(
    s => s.type === 'code' && s.language?.toLowerCase() === targetLang,
  );
  if (codeIdx === -1) {
    // Fallback: any code scene
    const anyCodeIdx = scenes.findIndex(s => s.type === 'code');
    if (anyCodeIdx === -1) {
      // Fallback: pick a table or diagram scene
      const alt = scenes.filter(s => s.type === 'table' || s.type === 'diagram');
      return alt.length > 0 ? alt.slice(0, 2) : scenes.slice(0, 2);
    }
    const start = Math.max(0, anyCodeIdx - 1);
    const end = Math.min(scenes.length, anyCodeIdx + 2);
    return scenes.slice(start, end);
  }
  const start = Math.max(0, codeIdx - 1);
  const end = Math.min(scenes.length, codeIdx + 2);
  return scenes.slice(start, end);
}

function selectPythonCodeScenes(scenes: Scene[]): Scene[] {
  return selectCodeScenesByLanguage(scenes, 'python');
}

function selectJavaCodeScenes(scenes: Scene[]): Scene[] {
  return selectCodeScenesByLanguage(scenes, 'java');
}

function selectReviewScenes(scenes: Scene[]): Scene[] {
  // Review question + summary scenes
  const reviewScenes = scenes.filter(s => s.type === 'review' || s.type === 'summary');
  if (reviewScenes.length > 0) return reviewScenes.slice(0, 3);
  // Fallback: interview scenes
  const interview = scenes.filter(s => s.type === 'interview');
  if (interview.length > 0) return interview.slice(0, 2);
  // Last resort: last 2 scenes
  return scenes.slice(-2);
}

const SHORT_DEFINITIONS: ShortDefinition[] = [
  { label: 'hook', clipType: 'hook', selectScenes: selectHookScenes },
  { label: 'python-code', clipType: 'code-highlight', selectScenes: selectPythonCodeScenes },
  { label: 'java-code', clipType: 'code-highlight', selectScenes: selectJavaCodeScenes },
  { label: 'review', clipType: 'review-challenge', selectScenes: selectReviewScenes },
];

// ---------------------------------------------------------------------------
// Build a mini-storyboard from selected scenes
// ---------------------------------------------------------------------------

function buildMiniStoryboard(
  original: Storyboard,
  selectedScenes: Scene[],
): Storyboard {
  // Re-index scene frames sequentially starting after the mini intro
  let cursor = 0;
  const reindexed: Scene[] = [];

  for (const scene of selectedScenes) {
    const sceneDuration = scene.endFrame - scene.startFrame;
    // Cap total so we stay under MAX_SHORT_FRAMES (minus intro + CTA)
    const availableFrames = MAX_SHORT_FRAMES - MINI_INTRO_FRAMES - CTA_FRAMES - cursor;
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

  const totalFrames = MINI_INTRO_FRAMES + cursor + CTA_FRAMES;

  return {
    ...original,
    width: 1080,
    height: 1920,
    scenes: reindexed,
    durationInFrames: totalFrames,
    // Strip audio — Shorts won't use the long-form master audio
    audioFile: '',
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const propsPath = process.argv[2];
  if (!propsPath) {
    console.error('Usage: npx tsx scripts/render-shorts.ts <storyboard-props.json>');
    process.exit(1);
  }

  const absPropsPath = path.resolve(propsPath);
  if (!fs.existsSync(absPropsPath)) {
    console.error(`File not found: ${absPropsPath}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(absPropsPath, 'utf-8'));
  const storyboard: Storyboard = raw.storyboard ?? raw;

  if (!storyboard.scenes || storyboard.scenes.length === 0) {
    console.error('Storyboard has no scenes.');
    process.exit(1);
  }

  // Output directory
  const outputDir = path.join(path.dirname(absPropsPath), 'shorts');
  fs.mkdirSync(outputDir, { recursive: true });

  // Bundle the Remotion project
  const entryPoint = path.resolve(__dirname, '../src/compositions/index.tsx');
  console.log('Bundling Remotion project...');
  const bundleLocation = await bundle({ entryPoint });

  for (let i = 0; i < SHORT_DEFINITIONS.length; i++) {
    const def = SHORT_DEFINITIONS[i];
    const selectedScenes = def.selectScenes(storyboard.scenes);

    if (selectedScenes.length === 0) {
      console.log(`Short ${i + 1} (${def.label}): No suitable scenes found, skipping.`);
      continue;
    }

    const miniStoryboard = buildMiniStoryboard(storyboard, selectedScenes);

    console.log(
      `\nShort ${i + 1} (${def.label}): ${miniStoryboard.scenes.length} scenes, ` +
      `${miniStoryboard.durationInFrames} frames (${(miniStoryboard.durationInFrames / FPS).toFixed(1)}s)`,
    );

    // Use MultiShort composition for richer rendering (scene backgrounds, CTA overlay)
    const compositionId = `MultiShort-${def.clipType}`;

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps: { storyboard: miniStoryboard, clipType: def.clipType },
    });

    const outputPath = path.join(outputDir, `short-${i + 1}.mp4`);

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: { storyboard: miniStoryboard, clipType: def.clipType },
      onProgress: ({ progress }) => {
        process.stdout.write(`\r  Rendering short-${i + 1}: ${(progress * 100).toFixed(0)}%`);
      },
    });

    console.log(`\n  -> ${outputPath}`);
  }

  console.log('\nAll Shorts rendered successfully!');
}

main().catch((err) => {
  console.error('Render failed:', err);
  process.exit(1);
});
