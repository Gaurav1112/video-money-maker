#!/usr/bin/env npx tsx
/**
 * Generate viral-level SEO metadata for video sessions and their shorts.
 *
 * Usage:
 *   npx tsx scripts/generate-metadata.ts output/test-props.json
 *   npx tsx scripts/generate-metadata.ts output/test-props.json output/test-props-s2.json output/test-props-s3.json
 *   npx tsx scripts/generate-metadata.ts output/test-props.json --shorts
 *   npx tsx scripts/generate-metadata.ts output/test-props.json --language java
 *
 * Options:
 *   --shorts         Also generate shorts metadata files
 *   --language <lang> Override language (default: python)
 *   --dry-run        Print to stdout instead of writing files
 *   --outdir <dir>   Output directory (default: output/)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, basename, dirname } from 'path';
import { generateMetadata, generateShortsMetadataFromStoryboard } from '../src/pipeline/metadata-generator';

// ─── CLI Args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = {
  shorts: args.includes('--shorts'),
  dryRun: args.includes('--dry-run'),
  language: 'python',
  outdir: 'output',
};

// Parse --language <value>
const langIdx = args.indexOf('--language');
if (langIdx !== -1 && args[langIdx + 1]) {
  flags.language = args[langIdx + 1];
}

// Parse --outdir <value>
const outdirIdx = args.indexOf('--outdir');
if (outdirIdx !== -1 && args[outdirIdx + 1]) {
  flags.outdir = args[outdirIdx + 1];
}

// Filter out flags to get prop file paths
const propFiles = args.filter(a => !a.startsWith('--') && (
  !args.includes('--language') || a !== flags.language
) && (
  !args.includes('--outdir') || a !== flags.outdir
));

if (propFiles.length === 0) {
  console.error('Usage: npx tsx scripts/generate-metadata.ts <props-file> [props-file-2] [--shorts] [--language python]');
  console.error('');
  console.error('Examples:');
  console.error('  npx tsx scripts/generate-metadata.ts output/test-props.json');
  console.error('  npx tsx scripts/generate-metadata.ts output/test-props.json output/test-props-s2.json --shorts');
  process.exit(1);
}

// ─── Process Each Props File ──────────────────────────────────────────────────

const outdir = resolve(process.cwd(), flags.outdir);
mkdirSync(outdir, { recursive: true });

let totalGenerated = 0;

for (const propFile of propFiles) {
  const fullPath = resolve(process.cwd(), propFile);
  console.log(`\n📄 Reading: ${propFile}`);

  let data: any;
  try {
    data = JSON.parse(readFileSync(fullPath, 'utf-8'));
  } catch (err) {
    console.error(`  ❌ Failed to read ${propFile}: ${(err as Error).message}`);
    continue;
  }

  const storyboard = data.storyboard;
  if (!storyboard) {
    console.error(`  ❌ No storyboard found in ${propFile}`);
    continue;
  }

  const { topic, sessionNumber } = storyboard;
  const durationSecs = Math.round(storyboard.durationInFrames / storyboard.fps);
  const mins = Math.round(durationSecs / 60);

  console.log(`  📺 Topic: ${topic} | Session: ${sessionNumber} | Duration: ${mins}min`);

  // Generate long-form metadata
  const metadata = generateMetadata(storyboard, flags.language);

  const topicSlug = topic.toLowerCase().replace(/\s+/g, '-');
  const metaFile = resolve(outdir, `metadata-s${sessionNumber}.json`);

  if (flags.dryRun) {
    console.log(`\n  ── Long-form metadata (would write to ${metaFile}) ──`);
    console.log(`  Title: ${metadata.youtube.title}`);
    console.log(`  Tags: ${metadata.youtube.tags.length} tags`);
    console.log(`  Chapters: ${metadata.youtube.chapters.length} chapters`);
    console.log(`  Thumbnail: ${metadata.youtube.thumbnailText}`);
    console.log(`  Playlist: ${metadata.youtube.playlist}`);
    console.log(`  SEO Keywords: ${metadata.seo.keywords.length}`);
  } else {
    writeFileSync(metaFile, JSON.stringify(metadata, null, 2), 'utf-8');
    console.log(`  ✅ Written: ${metaFile}`);
    totalGenerated++;
  }

  // Generate shorts metadata if requested
  if (flags.shorts) {
    const shortsMetadata = generateShortsMetadataFromStoryboard(storyboard, flags.language);
    const shortsFile = resolve(outdir, `metadata-s${sessionNumber}-shorts.json`);

    if (flags.dryRun) {
      console.log(`\n  ── Shorts metadata (would write to ${shortsFile}) ──`);
      for (const short of shortsMetadata.shorts) {
        console.log(`  Short: ${short.youtube.title}`);
      }
    } else {
      writeFileSync(shortsFile, JSON.stringify(shortsMetadata, null, 2), 'utf-8');
      console.log(`  ✅ Written: ${shortsFile}`);
      totalGenerated++;
    }
  }
}

console.log(`\n🎬 Done! Generated ${totalGenerated} metadata files.`);
