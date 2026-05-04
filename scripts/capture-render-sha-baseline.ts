#!/usr/bin/env tsx
/**
 * Capture render determinism baseline after render completes.
 * Records SHA-256 hashes of rendered videos for future verification.
 *
 * Usage: npx tsx scripts/capture-render-sha-baseline.ts
 * Output: data/expected-render-shas.json
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

interface ShaBaseline {
  capturedAt: string;
  renderCount: number;
  videos: Record<string, {
    filename: string;
    sha256: string;
    sizeBytes: number;
  }>;
}

const outputDir = join(process.cwd(), 'output');
const baselineFile = join(process.cwd(), 'data', 'expected-render-shas.json');

function hashFile(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

function captureBaseline(): void {
  const baseline: ShaBaseline = {
    capturedAt: new Date().toISOString(),
    renderCount: 0,
    videos: {},
  };

  try {
    const files = readdirSync(outputDir);
    const videoFiles = files.filter((f) => f.endsWith('.mp4'));

    if (videoFiles.length === 0) {
      console.log('⚠️ No MP4 files found in output/ directory.');
      console.log('   Render may still be in progress. Try again after render completes.');
      process.exit(1);
    }

    for (const file of videoFiles) {
      const filePath = join(outputDir, file);
      const stat = statSync(filePath);
      const sha = hashFile(filePath);

      baseline.videos[file] = {
        filename: file,
        sha256: sha,
        sizeBytes: stat.size,
      };
      baseline.renderCount++;

      console.log(`✓ ${file}: ${sha.substring(0, 16)}... (${stat.size} bytes)`);
    }

    writeFileSync(baselineFile, JSON.stringify(baseline, null, 2), 'utf8');
    console.log(`\n✅ Baseline captured: ${baseline.renderCount} videos`);
    console.log(`   File: data/expected-render-shas.json`);
  } catch (err) {
    console.error('❌ Error capturing baseline:', err);
    process.exit(1);
  }
}

captureBaseline();
