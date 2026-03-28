#!/usr/bin/env npx tsx
/**
 * Render a video at 4K (3840x2160) using Remotion's --scale=2 upscale.
 *
 * Usage:
 *   npx tsx scripts/render-4k.ts <props-file> [output-file]
 *
 * Examples:
 *   npx tsx scripts/render-4k.ts output/test-props.json
 *   npx tsx scripts/render-4k.ts output/test-props-s2.json output/my-4k-video.mp4
 *
 * This renders the LongVideo composition at 1920x1080 and upscales 2x to 3840x2160.
 * Using --scale=2 is faster than native 4K rendering since component layout stays at 1080p.
 *
 * Alternatively, use the native 4K composition (slower, sharper text):
 *   npx remotion render src/compositions/index.tsx LongVideo4K output/native-4k.mp4 --props=output/test-props.json --concurrency=4
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Usage: npx tsx scripts/render-4k.ts <props-file> [output-file]');
    console.log('');
    console.log('Options:');
    console.log('  --native    Use LongVideo4K composition instead of --scale=2');
    console.log('  --fast      Use higher concurrency + lower quality for preview');
    console.log('');
    console.log('Examples:');
    console.log('  npx tsx scripts/render-4k.ts output/test-props.json');
    console.log('  npx tsx scripts/render-4k.ts output/test-props.json output/4k-final.mp4 --native');
    process.exit(1);
  }

  const useNative = args.includes('--native');
  const useFast = args.includes('--fast');
  const positionalArgs = args.filter(a => !a.startsWith('--'));

  const propsFile = positionalArgs[0];
  if (!fs.existsSync(propsFile)) {
    console.error(`Props file not found: ${propsFile}`);
    process.exit(1);
  }

  const defaultOutput = propsFile.replace(/\.json$/, '-4k.mp4');
  const outputFile = positionalArgs[1] || defaultOutput;

  const compositionEntry = path.resolve(__dirname, '../src/compositions/index.tsx');

  const concurrency = useFast ? 10 : 4;
  const jpegQuality = useFast ? 70 : 85;

  let cmd: string;
  if (useNative) {
    // Native 4K: renders at 3840x2160 natively (sharper text, slower)
    cmd = [
      'npx remotion render',
      compositionEntry,
      'LongVideo4K',
      outputFile,
      `--props=${propsFile}`,
      `--concurrency=${concurrency}`,
      `--jpeg-quality=${jpegQuality}`,
    ].join(' ');
  } else {
    // Scale 2x: renders at 1080p then upscales (faster, slightly softer)
    cmd = [
      'npx remotion render',
      compositionEntry,
      'LongVideo',
      outputFile,
      `--props=${propsFile}`,
      '--scale=2',
      `--concurrency=${concurrency}`,
      `--jpeg-quality=${jpegQuality}`,
    ].join(' ');
  }

  const mode = useNative ? 'Native 4K (3840x2160)' : 'Upscale 2x (1920x1080 -> 3840x2160)';
  console.log(`\n=== 4K Render ===`);
  console.log(`Mode:        ${mode}`);
  console.log(`Props:       ${propsFile}`);
  console.log(`Output:      ${outputFile}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`JPEG Quality: ${jpegQuality}`);
  console.log(`Command:     ${cmd}\n`);

  const start = Date.now();
  try {
    execSync(cmd, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n4K render complete in ${elapsed}s`);
    console.log(`Output: ${outputFile}`);
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`\nRender failed after ${elapsed}s`);
    process.exit(1);
  }
}

main();
