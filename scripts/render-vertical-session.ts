#!/usr/bin/env tsx
/**
 * Render a single session as a 9:16 vertical video.
 * Usage: tsx scripts/render-vertical-session.ts <topic> <session>
 * Example: tsx scripts/render-vertical-session.ts load-balancing 1
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const topic = process.argv[2];
const session = parseInt(process.argv[3] || '1', 10);

if (!topic) {
  console.error('Usage: tsx scripts/render-vertical-session.ts <topic> <session>');
  process.exit(1);
}

const propsFile = path.resolve(__dirname, '..', `output/test-props-s${session}.json`);
if (!existsSync(propsFile)) {
  console.error(`Props file not found: ${propsFile}`);
  console.error('Run the pipeline first to generate props.');
  process.exit(1);
}

const outputDir = path.resolve(
  process.env.HOME || '~',
  `Documents/guru-sishya/${topic}/session-${session}/vertical`,
);
mkdirSync(outputDir, { recursive: true });

const outputFile = path.join(outputDir, `${topic}-s${session}-vertical.mp4`);

console.log(`Rendering vertical video...`);
console.log(`  Topic: ${topic}`);
console.log(`  Session: ${session}`);
console.log(`  Output: ${outputFile}`);

const cmd = [
  'npx remotion render',
  'src/compositions/index.tsx',
  'VerticalLong',
  `--props="${propsFile}"`,
  `--output="${outputFile}"`,
  '--codec=h264',
  '--crf=18',
  '--audio-bitrate=192K',
  '--concurrency=6',
].join(' ');

try {
  execSync(cmd, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
  console.log(`\nVertical video saved: ${outputFile}`);
} catch (err) {
  console.error('Render failed:', (err as Error).message);
  process.exit(1);
}
