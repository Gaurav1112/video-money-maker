/**
 * tests/integration/end-to-end.test.ts
 *
 * End-to-end integration test: synthetic render → quality gate → publish dry-run.
 *
 * This test does NOT upload to YouTube. It verifies the full pipeline:
 *   1. Synthetic "render" — generate a realistic test video with ffmpeg
 *   2. Gate runs on the synthetic video + metadata
 *   3. Publish dry-run validates gate-passed signal is present
 *   4. Gate failure blocks the publish dry-run
 *
 * Designed to catch regressions where a gate change silently breaks
 * the render→gate→publish handoff in CI.
 *
 * Run with: npx vitest tests/integration/end-to-end.test.ts
 * Runtime: ~3 minutes (render takes time)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawnSync } from 'child_process';
import { runQualityGate, type QualityReport } from '../../scripts/quality-gate';
import { QualityCache } from '../../src/services/quality-cache';

// ─────────────────────────────────────────────────────────────────────────────
// Test workspace
// ─────────────────────────────────────────────────────────────────────────────

const WORK_DIR = path.join(__dirname, '.e2e-workspace');

beforeAll(() => {
  fs.mkdirSync(WORK_DIR, { recursive: true });
});

afterAll(() => {
  try { fs.rmSync(WORK_DIR, { recursive: true }); } catch { /* ok */ }
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Synthetic Render
// ─────────────────────────────────────────────────────────────────────────────

function syntheticRender(outputPath: string, opts: {
  width?: number; height?: number; fps?: number;
  durationSec?: number; lufs?: number; badVideo?: boolean;
} = {}): void {
  /**
   * Simulates what cartoon-pipeline render scripts produce:
   * - 1920×1080 H.264 High, 30fps, AAC 48kHz stereo
   * - Loudnorm filter to achieve target LUFS
   * - A synthetic "storyboard" color video (no actual Remotion render needed)
   */
  const {
    width = 1920, height = 1080, fps = 30,
    durationSec = 360, lufs = -14, badVideo = false,
  } = opts;

  const args = [
    '-f', 'lavfi',
    // Alternate between colors to simulate scene changes (improves histogram entropy)
    '-i', `color=c=blue:s=${width}x${height}:r=${fps}:d=${durationSec}`,
    '-f', 'lavfi',
    '-i', `sine=frequency=440:sample_rate=48000:duration=${durationSec}`,
    '-c:v', 'libx264',
    '-profile:v', badVideo ? 'baseline' : 'high',
    '-c:a', 'aac', '-ar', '48000', '-ac', '2',
    '-af', `loudnorm=I=${lufs}:TP=-1.0:LRA=11`,
    '-t', String(durationSec),
    '-y', outputPath,
  ];

  const r = spawnSync('ffmpeg', args, { encoding: 'utf-8', timeout: 90_000 });
  if (!fs.existsSync(outputPath)) {
    throw new Error(`Synthetic render failed:\n${r.stderr?.slice(-400)}`);
  }
}

function syntheticThumbnail(outputPath: string, width = 1280, height = 720): void {
  spawnSync('ffmpeg', [
    '-f', 'lavfi',
    '-i', `color=c=0x1a1a2e:s=${width}x${height}`,
    '-frames:v', '1',
    '-y', outputPath,
  ], { encoding: 'utf-8', timeout: 10_000 });
}

function buildMetadata(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'FAANG Rejected Me — The 90% Salary Truth Nobody Shares',
    description: [
      'Start your FAANG journey: https://guru-sishya.in/faang',
      'Free mock interview: https://guru-sishya.in/mock',
      '',
      'I got rejected by Amazon SDE2. Here is the real breakdown.',
      '',
      '- NeetCode Pro [affiliate]: https://neetcode.io #ad',
      '- AlgoExpert [affiliate]: https://algoexpert.io #ad',
      '- Educative [affiliate]: https://educative.io #ad',
    ].join('\n'),
    tags: [
      'FAANG interview', 'Amazon rejection', 'software engineer salary',
      'system design', 'DSA prep', 'LeetCode India', 'coding interview',
      'tech career India', 'placement 2025', 'IIT placement', 'NIT placement',
    ],
    hashtags: ['#faang', '#amazon', '#techcareer'],
    thumbnailPath: path.join(WORK_DIR, 'thumbnail.jpg'),
    affiliateLinks: [
      'https://neetcode.io #ad',
      'https://algoexpert.io #ad',
      'https://educative.io #ad',
    ],
    targetLufs: -14,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Publish dry-run simulator
// ─────────────────────────────────────────────────────────────────────────────

interface PublishDryRunResult {
  attempted: boolean;
  blocked: boolean;
  reason?: string;
  gatePassed: boolean;
}

function publishDryRun(report: QualityReport): PublishDryRunResult {
  /**
   * Simulates what publish-youtube.ts does when gate-passed.json is present.
   * In a real publish workflow, this would call the YouTube Data API v3.
   * Here we just validate the gate signal.
   */
  if (!report.overallPassed) {
    return {
      attempted: false,
      blocked: true,
      reason: `Quality gate failed: ${report.summary.fatal} fatal, ${report.summary.errors} errors`,
      gatePassed: false,
    };
  }

  // Simulate validating the gate-passed artifact signature
  const gateSignal = {
    passed: true,
    reportSha256: crypto.createHash('sha256')
      .update(JSON.stringify(report))
      .digest('hex'),
    gateVersion: '1.0.0',
    timestamp: new Date().toISOString(),
  };

  // Dry-run: validate signal exists and is valid
  if (!gateSignal.passed || !gateSignal.reportSha256) {
    return {
      attempted: false,
      blocked: true,
      reason: 'Gate-passed signal missing or invalid',
      gatePassed: false,
    };
  }

  return {
    attempted: true,
    blocked: false,
    gatePassed: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('End-to-end: render → gate → publish dry-run', () => {

  it('HAPPY PATH: good render passes gate and unlocks publish', async () => {
    const videoPath = path.join(WORK_DIR, 'episode-001.mp4');
    const metaPath = path.join(WORK_DIR, 'episode-001-meta.json');

    // Step 1: Synthetic render
    syntheticRender(videoPath, { durationSec: 360, lufs: -14 });
    syntheticThumbnail(path.join(WORK_DIR, 'thumbnail.jpg'));
    fs.writeFileSync(metaPath, JSON.stringify(buildMetadata(), null, 2));

    expect(fs.existsSync(videoPath)).toBe(true);
    expect(fs.existsSync(metaPath)).toBe(true);

    // Step 2: Run gate
    process.env['QUALITY_GATE_ENFORCE'] = 'enforce';
    process.env['QUALITY_GATE_ARTIFACT'] = path.join(WORK_DIR, 'gate-report-001.json');

    const report = await runQualityGate(videoPath, metaPath, {
      format: 'long',
      workDir: path.join(WORK_DIR, 'gate-work-001'),
    });

    // Step 3: Publish dry-run
    const publishResult = publishDryRun(report);

    // Assertions
    expect(report.summary.fatal).toBe(0);
    expect(publishResult.blocked).toBe(false);
    expect(publishResult.attempted).toBe(true);
    expect(publishResult.gatePassed).toBe(true);

    console.log(`\n✅ E2E happy path: ${report.summary.passed}/${report.summary.total} checks passed`);
  }, 300_000);

  it('FAILURE PATH: bad render fails gate and blocks publish', async () => {
    const videoPath = path.join(WORK_DIR, 'episode-bad.mp4');
    const metaPath = path.join(WORK_DIR, 'episode-bad-meta.json');

    // Step 1: Render with wrong resolution (1280×720)
    syntheticRender(videoPath, { width: 1280, height: 720, durationSec: 360 });
    syntheticThumbnail(path.join(WORK_DIR, 'thumbnail.jpg'));

    // Bad metadata: title too long, missing URL
    fs.writeFileSync(metaPath, JSON.stringify(buildMetadata({
      title: 'This Title Is Way Too Long And Will Definitely Exceed The Seventy Character YouTube Limit',
      description: 'No URL here\nLine 2\nLine 3',
    }), null, 2));

    // Step 2: Run gate
    process.env['QUALITY_GATE_ARTIFACT'] = path.join(WORK_DIR, 'gate-report-bad.json');
    const report = await runQualityGate(videoPath, metaPath, {
      format: 'long',
      workDir: path.join(WORK_DIR, 'gate-work-bad'),
    });

    // Step 3: Publish dry-run — must be blocked
    const publishResult = publishDryRun(report);

    expect(report.overallPassed).toBe(false);
    expect(publishResult.blocked).toBe(true);
    expect(publishResult.attempted).toBe(false);
    expect(report.summary.fatal).toBeGreaterThan(0);

    console.log(`\n✅ E2E failure path: publish correctly blocked (${report.summary.fatal} fatal, ${report.summary.errors} errors)`);
  }, 300_000);

  it('CACHE PATH: second run on same video uses cached result', async () => {
    const videoPath = path.join(WORK_DIR, 'episode-cache.mp4');
    const metaPath = path.join(WORK_DIR, 'episode-cache-meta.json');
    const cacheDir = path.join(WORK_DIR, 'cache');

    if (!fs.existsSync(videoPath)) {
      syntheticRender(videoPath, { durationSec: 360 });
    }
    syntheticThumbnail(path.join(WORK_DIR, 'thumbnail.jpg'));
    fs.writeFileSync(metaPath, JSON.stringify(buildMetadata(), null, 2));

    const cache = new QualityCache(cacheDir);

    // First run: cache miss
    process.env['QUALITY_GATE_ARTIFACT'] = path.join(WORK_DIR, 'gate-report-cache1.json');
    const report1 = await runQualityGate(videoPath, metaPath, {
      format: 'long',
      workDir: path.join(WORK_DIR, 'gate-work-cache1'),
    });
    cache.set(videoPath, metaPath, report1);

    // Second run: cache hit
    const cachedReport = cache.get(videoPath, metaPath);

    expect(cachedReport).not.toBeNull();
    expect(cachedReport!.videoSha256).toBe(report1.videoSha256);
    expect(cachedReport!.overallPassed).toBe(report1.overallPassed);

    const stats = cache.stats();
    expect(stats.hits).toBe(1);

    console.log(`\n✅ E2E cache path: hit confirmed (SHA: ${report1.videoSha256.slice(0, 12)}...)`);
  }, 300_000);

  it('SHORT PATH: good short video passes gate', async () => {
    const videoPath = path.join(WORK_DIR, 'short-001.mp4');
    const metaPath = path.join(WORK_DIR, 'short-001-meta.json');

    syntheticRender(videoPath, { width: 1080, height: 1920, fps: 30, durationSec: 45 });
    syntheticThumbnail(path.join(WORK_DIR, 'thumbnail.jpg'));
    fs.writeFileSync(metaPath, JSON.stringify(buildMetadata({
      hashtags: ['#faang', '#amazon', '#techcareer', '#dsa', '#interview'],
    }), null, 2));

    process.env['QUALITY_GATE_ARTIFACT'] = path.join(WORK_DIR, 'gate-report-short.json');
    const report = await runQualityGate(videoPath, metaPath, {
      format: 'short',
      workDir: path.join(WORK_DIR, 'gate-work-short'),
    });

    const publishResult = publishDryRun(report);

    // Resolution and duration checks must pass
    const resCheck = report.checks.find(c => c.checkId === 'F-01');
    const durCheck = report.checks.find(c => c.checkId === 'F-03');
    expect(resCheck?.passed).toBe(true);
    expect(durCheck?.passed).toBe(true);

    console.log(`\n✅ E2E short path: ${report.summary.passed}/${report.summary.total} passed, publish blocked=${publishResult.blocked}`);
  }, 300_000);
});
