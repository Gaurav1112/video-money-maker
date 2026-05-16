/**
 * quality-gate.test.ts — Unit tests for the quality gate.
 *
 * Strategy:
 * - Known-BAD fixtures: gate must REJECT each (exit non-zero / overallPassed=false)
 * - Known-GOOD fixtures: gate must PASS each (exit zero / overallPassed=true)
 *
 * Fixtures are synthetic 5MB-class test videos generated via ffmpeg in beforeAll().
 * No real video required — we generate minimal H.264/AAC files that satisfy
 * exactly the properties we want to test, then deliberately corrupt them.
 *
 * Tools: vitest, ffmpeg (must be on PATH)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { runQualityGate, type QualityReport } from '../scripts/quality-gate';

// ─────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_DIR = path.join(__dirname, 'fixtures');

function mkFixtureDir() {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
}

/** Generate a minimal H.264/AAC video with ffmpeg */
function makeVideo(opts: {
  output: string;
  width?: number;
  height?: number;
  fps?: number;
  durationSec?: number;
  audioChannels?: number;
  sampleRate?: number;
  audioCodec?: string;
  videoCodec?: string;
  lufs?: number;   // approximate target LUFS via volume filter
}): void {
  const {
    output,
    width = 1920, height = 1080,
    fps = 30,
    durationSec = 360,  // 6 min default (long-form)
    audioChannels = 2,
    sampleRate = 48000,
    audioCodec = 'aac',
    videoCodec = 'libx264',
    lufs = -14,
  } = opts;

  // Use color source for video (no disk reads needed)
  // Use sine tone at appropriate volume for LUFS proxy
  const args = [
    '-f', 'lavfi', '-i', `color=c=blue:s=${width}x${height}:r=${fps}:d=${durationSec}`,
    '-f', 'lavfi', '-i', `sine=frequency=440:sample_rate=${sampleRate}:duration=${durationSec}`,
    '-c:v', videoCodec,
    '-profile:v', videoCodec === 'libx264' ? 'high' : 'baseline',
    '-c:a', audioCodec,
    '-ar', String(sampleRate),
    '-ac', String(audioChannels),
    '-af', `loudnorm=I=${lufs}:TP=-1.0:LRA=11`,
    '-t', String(durationSec),
    '-y', output,
  ];

  const r = spawnSync('ffmpeg', args, { encoding: 'utf-8', timeout: 60000 });
  if (!fs.existsSync(output)) {
    throw new Error(`Failed to create fixture ${output}:\n${r.stderr?.slice(-300)}`);
  }
}

function makeGoodMetadata(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'I Was Wrong About FAANG Salaries — Real 90% Offer Reality',
    description: [
      'Get mentoring: https://guru-sishya.in/mentoring',
      'Free DSA sheet: https://guru-sishya.in/dsa',
      '',
      'Amazon SDE2 rejected me. Here is what they never tell you.',
      '',
      'Links:',
      '- NeetCode Pro [affiliate]: https://neetcode.io/pro?ref=gaurav #ad',
      '- AlgoExpert [affiliate]: https://algoexpert.io?ref=gaurav #ad',
      '- Educative.io [affiliate]: https://educative.io?ref=gaurav #ad',
    ].join('\n'),
    tags: [
      'FAANG interview', 'Amazon SDE2', 'software engineer salary India',
      'system design interview', 'DSA preparation', 'LeetCode tips',
      'coding interview', 'tech career India', 'software engineer jobs',
      'placement tips', 'FAANG preparation',
    ],
    hashtags: ['#faang', '#amazon', '#techcareer'],
    thumbnailPath: path.join(FIXTURE_DIR, 'thumbnail-good.jpg'),
    affiliateLinks: [
      'https://neetcode.io/pro?ref=gaurav #ad',
      'https://algoexpert.io?ref=gaurav #ad',
      'https://educative.io?ref=gaurav #ad',
    ],
    targetLufs: -14,
    ...overrides,
  };
}

function writeMetadata(p: string, data: Record<string, unknown>): void {
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function makeThumbnail(output: string, width = 1280, height = 720): void {
  const r = spawnSync('ffmpeg', [
    '-f', 'lavfi', '-i', `color=c=red:s=${width}x${height}`,
    '-frames:v', '1', '-y', output,
  ], { encoding: 'utf-8', timeout: 10000 });
  if (!fs.existsSync(output)) {
    throw new Error(`Failed to create thumbnail: ${r.stderr?.slice(-200)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup / Teardown
// ─────────────────────────────────────────────────────────────────────────────

beforeAll(() => {
  mkFixtureDir();

  // Good thumbnail (all good videos share this)
  if (!fs.existsSync(path.join(FIXTURE_DIR, 'thumbnail-good.jpg'))) {
    makeThumbnail(path.join(FIXTURE_DIR, 'thumbnail-good.jpg'));
  }

  // Generate fixtures only if not cached (they take ~5s each)
  const fixtures = [
    { file: 'good-long.mp4',    width: 1920, height: 1080, fps: 30, dur: 360 },
    { file: 'good-short.mp4',   width: 1080, height: 1920, fps: 30, dur: 45 },
    { file: 'bad-resolution.mp4', width: 1280, height: 720, fps: 30, dur: 360 },
    { file: 'bad-fps.mp4',      width: 1920, height: 1080, fps: 24, dur: 360 },
    { file: 'bad-too-short.mp4', width: 1920, height: 1080, fps: 30, dur: 120 },
    { file: 'bad-too-long.mp4', width: 1920, height: 1080, fps: 30, dur: 1200 },
    { file: 'bad-short-too-long.mp4', width: 1080, height: 1920, fps: 30, dur: 65 },
    { file: 'bad-lufs-loud.mp4', width: 1920, height: 1080, fps: 30, dur: 360, lufs: -9 },
  ];

  for (const f of fixtures) {
    const p = path.join(FIXTURE_DIR, f.file);
    if (!fs.existsSync(p)) {
      try {
        makeVideo({
          output: p,
          width: f.width, height: f.height,
          fps: f.fps, durationSec: f.dur,
          lufs: f.lufs ?? -14,
        });
      } catch (e) {
        console.warn(`[fixture] Could not generate ${f.file}: ${(e as Error).message}`);
      }
    }
  }
}, 120_000);

afterAll(() => {
  // Keep fixtures for re-use; cleanup only work dirs
  const dirs = fs.readdirSync(FIXTURE_DIR).filter(d => d.startsWith('.qg_'));
  for (const d of dirs) {
    try { fs.rmSync(path.join(FIXTURE_DIR, d), { recursive: true }); } catch { /* ok */ }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: run gate and expect pass/fail
// ─────────────────────────────────────────────────────────────────────────────

async function runGate(videoFile: string, meta: Record<string, unknown>, format: 'long' | 'short' = 'long'): Promise<QualityReport> {
  const videoPath = path.join(FIXTURE_DIR, videoFile);
  const metaPath = path.join(FIXTURE_DIR, videoFile.replace('.mp4', '-meta.json'));
  writeMetadata(metaPath, meta);
  process.env['QUALITY_GATE_ENFORCE'] = 'enforce';
  process.env['QUALITY_GATE_ARTIFACT'] = path.join(FIXTURE_DIR, videoFile.replace('.mp4', '-report.json'));
  return runQualityGate(videoPath, metaPath, { format, workDir: path.join(FIXTURE_DIR, `.qg_${Date.now()}`) });
}

function expectCheckFailed(report: QualityReport, checkId: string) {
  const check = report.checks.find(c => c.checkId === checkId);
  expect(check, `Check ${checkId} should exist`).toBeDefined();
  expect(check!.passed, `Check ${checkId} should have failed`).toBe(false);
}

function expectCheckPassed(report: QualityReport, checkId: string) {
  const check = report.checks.find(c => c.checkId === checkId);
  expect(check, `Check ${checkId} should exist`).toBeDefined();
  expect(check!.passed, `Check ${checkId} should have passed`).toBe(true);
}

// ─────────────────────────────────────────────────────────────────────────────
// KNOWN-GOOD Tests — gate must PASS
// ─────────────────────────────────────────────────────────────────────────────

describe('Known-GOOD videos — gate must PASS', () => {
  it('good long-form video passes all format checks', async () => {
    const report = await runGate('good-long.mp4', makeGoodMetadata(), 'long');
    expect(report.summary.fatal).toBe(0);
    expect(report.summary.errors).toBe(0);
    expectCheckPassed(report, 'F-01');
    expectCheckPassed(report, 'F-02');
    expectCheckPassed(report, 'F-03');
    expectCheckPassed(report, 'F-04');
  }, 120_000);

  it('good short video passes all short-form format checks', async () => {
    const report = await runGate(
      'good-short.mp4',
      makeGoodMetadata({
        hashtags: ['#faang', '#amazon', '#techcareer', '#coding', '#interview'],
      }),
      'short',
    );
    expectCheckPassed(report, 'F-01');
    expectCheckPassed(report, 'F-03');
  }, 120_000);

  it('good metadata passes all metadata checks', async () => {
    const report = await runGate('good-long.mp4', makeGoodMetadata(), 'long');
    expectCheckPassed(report, 'M-01');
    expectCheckPassed(report, 'M-04');
    expectCheckPassed(report, 'M-06');
  }, 120_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// KNOWN-BAD Tests — gate must REJECT each
// ─────────────────────────────────────────────────────────────────────────────

describe('Known-BAD videos — gate must FAIL', () => {

  // ── Format failures ────────────────────────────────────────────────────────

  it('REJECTS wrong resolution (1280×720 long-form)', async () => {
    const report = await runGate('bad-resolution.mp4', makeGoodMetadata(), 'long');
    expect(report.overallPassed).toBe(false);
    expectCheckFailed(report, 'F-01');
    expect(report.summary.fatal).toBeGreaterThan(0);
  }, 120_000);

  it('REJECTS wrong frame rate (24fps)', async () => {
    const report = await runGate('bad-fps.mp4', makeGoodMetadata(), 'long');
    expect(report.overallPassed).toBe(false);
    expectCheckFailed(report, 'F-02');
  }, 120_000);

  it('REJECTS long-form video that is too short (2 min)', async () => {
    const report = await runGate('bad-too-short.mp4', makeGoodMetadata(), 'long');
    expect(report.overallPassed).toBe(false);
    expectCheckFailed(report, 'F-03');
  }, 120_000);

  it('REJECTS long-form video that is too long (20 min)', async () => {
    const report = await runGate('bad-too-long.mp4', makeGoodMetadata(), 'long');
    expect(report.overallPassed).toBe(false);
    expectCheckFailed(report, 'F-03');
  }, 120_000);

  it('REJECTS short video over 55 seconds (65s)', async () => {
    const report = await runGate('bad-short-too-long.mp4', makeGoodMetadata({
      hashtags: ['#faang', '#amazon', '#techcareer', '#coding', '#interview'],
    }), 'short');
    expect(report.overallPassed).toBe(false);
    expectCheckFailed(report, 'F-03');
  }, 120_000);

  it('REJECTS video with LUFS too hot (-9 LUFS, target -14)', async () => {
    const report = await runGate('bad-lufs-loud.mp4', makeGoodMetadata(), 'long');
    expect(report.overallPassed).toBe(false);
    expectCheckFailed(report, 'F-09');
  }, 120_000);

  // ── Metadata failures ──────────────────────────────────────────────────────

  it('REJECTS title over 70 characters', async () => {
    const report = await runGate('good-long.mp4', makeGoodMetadata({
      title: 'This Is An Extremely Long Title That Goes Way Over The Seventy Character Limit For YouTube',
    }), 'long');
    expectCheckFailed(report, 'M-01');
  }, 120_000);

  it('REJECTS title without hook keyword', async () => {
    const report = await runGate('good-long.mp4', makeGoodMetadata({
      title: 'How to write clean code effectively',
    }), 'long');
    expectCheckFailed(report, 'M-02');
  }, 120_000);

  it('REJECTS description missing guru-sishya.in in first 3 lines', async () => {
    const report = await runGate('good-long.mp4', makeGoodMetadata({
      description: [
        'Line one without the url',
        'Line two still no url',
        'Line three no url',
        '',
        'guru-sishya.in is buried here instead',
      ].join('\n'),
    }), 'long');
    expectCheckFailed(report, 'M-04');
  }, 120_000);

  it('REJECTS description with insufficient affiliate disclosures (only 1)', async () => {
    const report = await runGate('good-long.mp4', makeGoodMetadata({
      affiliateLinks: [
        'https://neetcode.io #ad',
        'https://undisclosed-link.com',
        'https://another-undisclosed.com',
      ],
    }), 'long');
    expectCheckFailed(report, 'M-05');
  }, 120_000);

  it('REJECTS tag count below minimum (5 tags)', async () => {
    const report = await runGate('good-long.mp4', makeGoodMetadata({
      tags: ['FAANG', 'Amazon', 'coding', 'interview', 'salary'],
    }), 'long');
    expectCheckFailed(report, 'M-06');
  }, 120_000);

  it('REJECTS missing thumbnail', async () => {
    const report = await runGate('good-long.mp4', makeGoodMetadata({
      thumbnailPath: '/nonexistent/thumb.jpg',
    }), 'long');
    expectCheckFailed(report, 'M-07');
  }, 120_000);

  it('REJECTS thumbnail with wrong dimensions', async () => {
    const badThumb = path.join(FIXTURE_DIR, 'thumbnail-bad-dims.jpg');
    if (!fs.existsSync(badThumb)) makeThumbnail(badThumb, 640, 480);

    const report = await runGate('good-long.mp4', makeGoodMetadata({
      thumbnailPath: badThumb,
    }), 'long');
    expectCheckFailed(report, 'M-08');
  }, 120_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Warn Mode Tests — errors logged but don't block
// ─────────────────────────────────────────────────────────────────────────────

describe('Warn mode — WARN-level failures should not block upload', () => {
  it('emoji spam (4 emojis) is WARN not ERROR', async () => {
    process.env['QUALITY_GATE_ENFORCE'] = 'warn';
    const report = await runGate('good-long.mp4', makeGoodMetadata({
      title: '🔥🚀💡✅ FAANG salary secrets nobody tells you',
    }), 'long');

    const emojiCheck = report.checks.find(c => c.checkId === 'M-03');
    expect(emojiCheck?.severity).toBe('WARN');
    // In warn mode, warn-level failures should not cause overallPassed=false on their own
    // (only FATALs block in warn mode)
    process.env['QUALITY_GATE_ENFORCE'] = 'enforce';
  }, 120_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Idempotency Test — running gate twice on same video gives same result
// ─────────────────────────────────────────────────────────────────────────────

describe('Gate determinism', () => {
  it('produces identical pass/fail result on two runs of same video', async () => {
    const run1 = await runGate('good-long.mp4', makeGoodMetadata(), 'long');
    const run2 = await runGate('good-long.mp4', makeGoodMetadata(), 'long');

    expect(run1.overallPassed).toBe(run2.overallPassed);
    expect(run1.summary.fatal).toBe(run2.summary.fatal);
    expect(run1.summary.errors).toBe(run2.summary.errors);
    // SHA of video should be identical
    expect(run1.videoSha256).toBe(run2.videoSha256);
  }, 240_000);
});
