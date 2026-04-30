/**
 * generate-thumbnail.ts — Generate a YouTube thumbnail (1280x720) from a storyboard.
 *
 * Uses Remotion's renderStill() API to render the Thumbnail composition as a PNG.
 *
 * Usage:
 *   npx tsx scripts/generate-thumbnail.ts output/test-props.json
 *   # Output: output/thumbnail.png
 */

import path from 'path';
import fs from 'fs';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import type { Storyboard } from '../src/types';

// ---------------------------------------------------------------------------
// Derive thumbnail props from storyboard
// ---------------------------------------------------------------------------

function inferCategory(storyboard: Storyboard): string {
  const topic = storyboard.topic.toLowerCase();
  if (['system design', 'load balanc', 'caching', 'cdn', 'microservice', 'database', 'rate limit', 'message queue']
    .some(k => topic.includes(k))) return 'System Design';
  if (['array', 'tree', 'graph', 'linked list', 'stack', 'queue', 'sort', 'search', 'dynamic', 'dp', 'recursion', 'heap', 'trie', 'bfs', 'dfs']
    .some(k => topic.includes(k))) return 'DSA';
  if (['react', 'css', 'html', 'javascript', 'typescript', 'frontend', 'next']
    .some(k => topic.includes(k))) return 'Frontend';
  if (['java', 'python', 'go', 'rust', 'c++', 'spring']
    .some(k => topic.includes(k))) return 'Backend';
  if (['docker', 'kubernetes', 'ci/cd', 'deploy', 'aws', 'cloud']
    .some(k => topic.includes(k))) return 'DevOps';
  return 'Interview Prep';
}

function inferLanguage(storyboard: Storyboard): string {
  // Look through scenes for code language
  for (const scene of storyboard.scenes) {
    if (scene.type === 'code' && scene.language) {
      // Capitalize first letter
      const lang = scene.language;
      return lang.charAt(0).toUpperCase() + lang.slice(1);
    }
  }
  return 'Java + Python';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const propsPath = process.argv[2];
  if (!propsPath) {
    console.error('Usage: npx tsx scripts/generate-thumbnail.ts <storyboard-props.json>');
    process.exit(1);
  }

  const absPropsPath = path.resolve(propsPath);
  if (!fs.existsSync(absPropsPath)) {
    console.error(`File not found: ${absPropsPath}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(absPropsPath, 'utf-8'));
  const storyboard: Storyboard = raw.storyboard ?? raw;

  const thumbnailProps = {
    topic: storyboard.topic,
    sessionNumber: storyboard.sessionNumber ?? 1,
    category: inferCategory(storyboard),
    language: inferLanguage(storyboard),
  };

  console.log('Thumbnail props:', thumbnailProps);

  // Bundle the Remotion project
  const entryPoint = path.resolve(__dirname, '../src/compositions/index.tsx');
  console.log('Bundling Remotion project...');
  const bundleLocation = await bundle({ entryPoint });

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'Thumbnail',
    inputProps: thumbnailProps,
  });

  const outputDir = path.dirname(absPropsPath);
  const outputPath = path.join(outputDir, 'thumbnail.png');

  console.log('Rendering thumbnail...');

  await renderStill({
    composition,
    serveUrl: bundleLocation,
    output: outputPath,
    inputProps: thumbnailProps,
    imageFormat: 'png',
  });

  console.log(`Thumbnail saved to: ${outputPath}`);
}

main().catch((err) => {
  console.error('Thumbnail generation failed:', err);
  process.exit(1);
});
