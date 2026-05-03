/**
 * generate-thumbnail-batch.ts
 *
 * Render all three layout variants (A, B, C) for a given storyboard so that
 * GitHub Actions can upload all three to YouTube's custom thumbnail slot and
 * pick the winner via CTR data (Rank 14 A/B hook integration).
 *
 * Usage:
 *   npx tsx scripts/generate-thumbnail-batch.ts output/test-props.json
 *   # Outputs:
 *   #   output/thumbnail-A.png  (face-text-arrow)
 *   #   output/thumbnail-B.png  (comparison-split)
 *   #   output/thumbnail-C.png  (before-after)
 *   #   output/thumbnail-meta.json  (props + variant mapping)
 *
 * Environment variables (all optional):
 *   FACE_IMAGE_PATH  — absolute path to SadTalker peak-emotion PNG
 *                      If unset, variant A will render as variant B (graceful fallback)
 *   THUMBNAIL_TOPIC_OVERRIDE — override topic for testing
 */

import path from 'path';
import fs from 'fs';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import type { Storyboard } from '../src/types';
import { hookTextFor, variantFor, djb2 } from '../src/lib/thumbnail-text';

// ---------------------------------------------------------------------------
// Helpers — same inference logic as the original generate-thumbnail.ts
// ---------------------------------------------------------------------------

function inferCategory(storyboard: Storyboard): string {
  const topic = storyboard.topic.toLowerCase();
  if (['system design', 'load balanc', 'caching', 'cdn', 'microservice', 'database', 'rate limit', 'message queue'].some(k => topic.includes(k))) return 'System Design';
  if (['array', 'tree', 'graph', 'linked list', 'stack', 'queue', 'sort', 'search', 'dynamic', 'dp', 'recursion', 'heap', 'trie', 'bfs', 'dfs'].some(k => topic.includes(k))) return 'DSA';
  if (['react', 'css', 'html', 'javascript', 'typescript', 'frontend', 'next'].some(k => topic.includes(k))) return 'Frontend';
  if (['java', 'python', 'go', 'rust', 'c++', 'spring'].some(k => topic.includes(k))) return 'Backend';
  if (['docker', 'kubernetes', 'ci/cd', 'deploy', 'aws', 'cloud'].some(k => topic.includes(k))) return 'DevOps';
  return 'Interview Prep';
}

function wrongLabelFor(topic: string): string {
  const lower = topic.toLowerCase();
  if (lower.includes('kafka') || lower.includes('queue') || lower.includes('stream')) return 'MOST ENGINEERS DO THIS';
  if (lower.includes('database') || lower.includes('sql') || lower.includes('redis')) return 'MOST DEVS QUERY WRONG';
  if (['algo', 'sort', 'tree', 'graph', 'array', 'dp', 'recursion'].some(k => lower.includes(k))) return '90% BRUTE FORCE THIS';
  if (lower.includes('system design')) return 'JUNIORS DESIGN THIS WAY';
  return 'MOST DEVS DO THIS';
}

function correctLabelFor(topic: string): string {
  const lower = topic.toLowerCase();
  if (lower.includes('kafka') || lower.includes('queue')) return 'FAANG ARCHITECTS DO THIS';
  if (lower.includes('database') || lower.includes('sql')) return 'FAANG QUERY PATTERN';
  if (['algo', 'sort', 'tree', 'graph', 'array', 'dp', 'recursion'].some(k => lower.includes(k))) return 'OPTIMAL APPROACH HERE';
  if (lower.includes('system design')) return 'SENIOR ENGINEERS DO THIS';
  return 'FAANG DOES THIS';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const propsPath = process.argv[2];
  if (!propsPath) {
    console.error('Usage: npx tsx scripts/generate-thumbnail-batch.ts <storyboard-props.json>');
    process.exit(1);
  }

  const absPropsPath = path.resolve(propsPath);
  if (!fs.existsSync(absPropsPath)) {
    console.error(`File not found: ${absPropsPath}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(absPropsPath, 'utf-8'));
  const storyboard: Storyboard = raw.storyboard ?? raw;
  const topic = process.env.THUMBNAIL_TOPIC_OVERRIDE ?? storyboard.topic;

  const hookText = hookTextFor(topic);
  const primaryVariant = variantFor(topic);
  const topicHash = djb2(topic.toLowerCase().trim());

  // Face image: from env, or auto-detect from standard SadTalker output path
  const autoFacePath = path.resolve(
    __dirname,
    '../tools/sadtalker-env/output',
    topic.toLowerCase().replace(/\s+/g, '-'),
    'peak-emotion.png',
  );
  const faceImageSrc =
    process.env.FACE_IMAGE_PATH ??
    (fs.existsSync(autoFacePath) ? autoFacePath : undefined);

  console.log(`\n🎨 Thumbnail Batch Generator`);
  console.log(`   Topic:        ${topic}`);
  console.log(`   Hook text:    ${hookText}`);
  console.log(`   Primary var:  ${primaryVariant} (hash ${topicHash})`);
  console.log(`   Face image:   ${faceImageSrc ?? '(none — A will fallback to B)'}`);
  console.log('');

  // Bundle once, render 3×
  const entryPoint = path.resolve(__dirname, '../src/compositions/index.tsx');
  console.log('📦 Bundling Remotion project...');
  const bundleLocation = await bundle({ entryPoint });
  console.log('   Bundle ready.');

  const outputDir = path.dirname(absPropsPath);
  const variants: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];
  const renderedFiles: Record<string, string> = {};

  for (const variant of variants) {
    const outputPath = path.join(outputDir, `thumbnail-${variant}.png`);

    const inputProps = {
      topic,
      hookText,
      faceImageSrc: faceImageSrc ?? undefined,
      variantOverride: variant,
      wrongLabel: wrongLabelFor(topic),
      correctLabel: correctLabelFor(topic),
    };

    console.log(`🖼  Rendering variant ${variant}...`);

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'ThumbnailV2',
      inputProps,
    });

    await renderStill({
      composition,
      serveUrl: bundleLocation,
      output: outputPath,
      inputProps,
      imageFormat: 'png',
    });

    console.log(`   ✓ Saved → ${outputPath}`);
    renderedFiles[variant] = outputPath;
  }

  // Write metadata file for downstream GHA steps and Rank 14 A/B hook
  const metaPath = path.join(outputDir, 'thumbnail-meta.json');
  const meta = {
    topic,
    hookText,
    primaryVariant,
    topicHash,
    category: inferCategory(storyboard),
    faceImageSrc: faceImageSrc ?? null,
    wrongLabel: wrongLabelFor(topic),
    correctLabel: correctLabelFor(topic),
    renderedFiles,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  console.log(`\n📋 Metadata → ${metaPath}`);
  console.log(`\n✅ Done. 3 variants rendered for A/B testing.`);
  console.log(`   Primary pick (hash-deterministic): thumbnail-${primaryVariant}.png`);
}

main().catch((err) => {
  console.error('❌ Thumbnail batch generation failed:', err);
  process.exit(1);
});
