#!/usr/bin/env tsx
/**
 * Render a session as multiple connected vertical parts (~2 min each).
 * Usage: tsx scripts/render-vertical-parts.ts <topic> <session>
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import path from 'path';
import { splitIntoParts, createPartStoryboard, getSplitSummary } from '../src/lib/part-splitter';

const topic = process.argv[2];
const session = parseInt(process.argv[3] || '1', 10);

if (!topic) {
  console.error('Usage: tsx scripts/render-vertical-parts.ts <topic> <session>');
  process.exit(1);
}

const propsFile = path.resolve(__dirname, '..', `output/test-props-s${session}.json`);
if (!existsSync(propsFile)) {
  console.error(`Props file not found: ${propsFile}`);
  process.exit(1);
}

const propsData = JSON.parse(readFileSync(propsFile, 'utf-8'));
const storyboard = propsData.storyboard || propsData;

// Split into parts
const parts = splitIntoParts(storyboard);
console.log(getSplitSummary(storyboard));
console.log('');

const outputDir = path.resolve(
  process.env.HOME || '~',
  `Documents/guru-sishya/${topic}/session-${session}/vertical-parts`,
);
mkdirSync(outputDir, { recursive: true });

// Render each part
for (const part of parts) {
  const partStoryboard = createPartStoryboard(storyboard, part);

  // Write part-specific props file
  const partPropsFile = path.resolve(__dirname, '..', `output/temp-part-${part.partNumber}.json`);
  writeFileSync(partPropsFile, JSON.stringify({ storyboard: partStoryboard }, null, 2));

  const outputFile = path.join(
    outputDir,
    `${topic}-s${session}-part${part.partNumber}of${part.totalParts}.mp4`,
  );

  const mins = Math.floor(part.durationSeconds / 60);
  const secs = (part.durationSeconds % 60).toString().padStart(2, '0');
  console.log(`\n--- Rendering Part ${part.partNumber}/${part.totalParts} (${mins}:${secs}) ---`);

  const cmd = [
    'npx remotion render',
    'src/compositions/index.tsx',
    'VerticalLong',
    `--props="${partPropsFile}"`,
    `--output="${outputFile}"`,
    '--codec=h264',
    '--crf=18',
    '--concurrency=4',
  ].join(' ');

  try {
    execSync(cmd, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    console.log(`Part ${part.partNumber} saved: ${outputFile}`);
  } catch (err) {
    console.error(`Part ${part.partNumber} render failed:`, (err as Error).message);
  }

  // Clean up temp props
  try { unlinkSync(partPropsFile); } catch { /* ignore */ }
}

console.log(`\n=== Done! ${parts.length} parts rendered for ${topic} S${session} ===`);
