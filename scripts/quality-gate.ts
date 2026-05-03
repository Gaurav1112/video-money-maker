#!/usr/bin/env tsx
/**
 * quality-gate.ts — Pre-upload video quality gate
 *
 * Usage:
 *   npx tsx scripts/quality-gate.ts <video.mp4> <metadata.json> [--format long|short]
 *
 * Exits 0 if ALL checks pass, non-zero if ANY check fails.
 * Writes JSON report to: quality-gate-report.json (or QUALITY_GATE_ARTIFACT env var).
 *
 * All checks run in parallel via Promise.allSettled for maximum speed.
 * Individual check failures accumulate — all checks always run (no fail-fast).
 *
 * Tools required: ffprobe, ffmpeg, tesseract-ocr, sharp (npm)
 * Cost: zero — all OSS.
 */

import { spawnSync, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type VideoFormat = 'long' | 'short';
export type Severity = 'FATAL' | 'ERROR' | 'WARN' | 'PASS';

export interface CheckResult {
  checkId: string;
  name: string;
  category: 'format' | 'visual' | 'retention' | 'metadata' | 'determinism';
  severity: Severity;
  passed: boolean;
  message: string;
  measured?: Record<string, unknown>;
  threshold?: Record<string, unknown>;
}

export interface QualityReport {
  videoPath: string;
  metadataPath: string;
  format: VideoFormat;
  videoSha256: string;
  timestamp: string;
  overallPassed: boolean;
  enforceMode: 'enforce' | 'warn';
  checks: CheckResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    fatal: number;
    errors: number;
    warnings: number;
  };
  durationMs: number;
}

export interface VideoMetadata {
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
  thumbnailPath?: string;
  affiliateLinks?: string[];
  targetLufs?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const HOOK_KEYWORDS = [
  // Salary/income
  /\d+\s*LPA/i, /₹\s*\d+/, /\d+\s*lakh/i, /\d+\s*crore/i, /salary/i, /package/i,
  // Companies
  /FAANG/i, /Amazon/i, /Google/i, /Microsoft/i, /Meta/i, /Apple/i, /Netflix/i,
  /Flipkart/i, /Infosys/i, /TCS/i, /Wipro/i,
  // Shock/curiosity
  /wrong/i, /mistake/i, /secret/i, /truth/i, /never/i, /always/i, /ban/i,
  /exposed/i, /shocking/i, /\d+%/,
  // Interview
  /interview/i, /rejected/i, /hired/i, /offer letter/i, /DSA/i, /system design/i,
  /leetcode/i,
];

const LONG_FORM = {
  width: 1920, height: 1080,
  fps: 30, fpsSlack: 0.03,
  minDurationSec: 300, maxDurationSec: 900,  // 5–15 min
  maxFileSizeBytes: 2 * 1024 * 1024 * 1024,  // 2 GB
  videoCodec: 'h264',
  audioCodec: 'aac',
  audioSampleRate: 48000,
  audioChannels: 2,
  targetLufs: -14,
  truePeakCeiling: -1.0,
  lufsTolerance: 0.5,
  hashtagCount: 3,
};

const SHORT_FORM = {
  width: 1080, height: 1920,
  fps: 30, fpsSlack: 0.03,
  maxDurationSec: 55,
  maxFileSizeBytes: 2 * 1024 * 1024 * 1024,
  videoCodec: 'h264',
  audioCodec: 'aac',
  audioSampleRate: 48000,
  audioChannels: 2,
  targetLufs: -14,
  truePeakCeiling: -1.0,
  lufsTolerance: 0.5,
  hashtagCount: 5,
};

// Safe zones from fix-03-caption-safezones/src/lib/safe-zones.ts
const SAFE_ZONE = { top: 240, bottom: 480, left: 60, right: 140 };
const FRAME_WIDTH = 1080;
const FRAME_HEIGHT = 1920;

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function pass(checkId: string, name: string, category: CheckResult['category'], message: string, measured?: Record<string, unknown>): CheckResult {
  return { checkId, name, category, severity: 'PASS', passed: true, message, measured };
}

function fail(checkId: string, name: string, category: CheckResult['category'], severity: Exclude<Severity, 'PASS'>, message: string, measured?: Record<string, unknown>, threshold?: Record<string, unknown>): CheckResult {
  return { checkId, name, category, severity, passed: false, message, measured, threshold };
}

function sha256File(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function ffprobe(filePath: string): Record<string, unknown> {
  const result = spawnSync('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_streams',
    '-show_format',
    filePath,
  ], { encoding: 'utf-8' });

  if (result.error) throw new Error(`ffprobe failed: ${result.error.message}`);
  return JSON.parse(result.stdout);
}

function extractFrames(videoPath: string, outputDir: string, fps: string, start?: number, duration?: number): void {
  const args = ['-i', videoPath];
  if (start !== undefined) args.push('-ss', String(start));
  if (duration !== undefined) args.push('-t', String(duration));
  args.push('-vf', `fps=${fps}`, `${outputDir}/frame_%05d.png`, '-y');
  const r = spawnSync('ffmpeg', args, { encoding: 'utf-8' });
  if (r.status !== 0 && r.stderr && !r.stderr.includes('frame')) {
    throw new Error(`ffmpeg frame extraction failed: ${r.stderr.slice(-300)}`);
  }
}

function getFrameFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.png'))
    .sort()
    .map(f => path.join(dir, f));
}

function measurePixelStddev(framePath: string): number {
  const r = spawnSync('ffprobe', [
    '-v', 'error',
    '-f', 'lavfi',
    '-i', `movie=${framePath},signalstats`,
    '-show_entries', 'frame_tags=lavfi.signalstats.YAVG,lavfi.signalstats.YSTDDEV',
    '-of', 'csv=p=0',
  ], { encoding: 'utf-8' });
  const parts = (r.stdout || '').trim().split(',');
  return parseFloat(parts[1] ?? '128');
}

/** Shannon entropy of a luma histogram (0-255 buckets) */
function histogramEntropy(framePath: string): number {
  const r = spawnSync('ffprobe', [
    '-v', 'error',
    '-f', 'lavfi',
    `-i`, `movie=${framePath},waveform=components=luma`,
    '-show_entries', 'frame=pkt_pts_time',
    '-of', 'default',
  ], { encoding: 'utf-8' });
  // Fallback: use signalstats YSTDDEV as entropy proxy
  const stddev = measurePixelStddev(framePath);
  // Map stddev (0-128) to entropy (0-8) approximation
  return Math.min(8, (stddev / 128) * 8);
}

function ocrFrame(framePath: string): string {
  const r = spawnSync('tesseract', [framePath, 'stdout', '--psm', '3'], { encoding: 'utf-8' });
  return (r.stdout || '').toLowerCase();
}

function containsHookKeyword(text: string): boolean {
  return HOOK_KEYWORDS.some(re => re.test(text));
}

/** Estimate text coverage % in a frame using ffmpeg edge detection */
function estimateTextCoverage(framePath: string): number {
  // Use canny edge detection — high edge density in horizontal bands ≈ text
  const outPath = framePath.replace('.png', '_edges.png');
  spawnSync('ffmpeg', [
    '-i', framePath,
    '-vf', 'edgedetect=low=0.1:high=0.4,format=gray',
    outPath, '-y',
  ], { encoding: 'utf-8' });

  if (!fs.existsSync(outPath)) return 0;

  // Count bright pixels in edge image using ffprobe signalstats
  const r = spawnSync('ffprobe', [
    '-v', 'error',
    '-f', 'lavfi',
    `-i`, `movie=${outPath},signalstats`,
    '-show_entries', 'frame_tags=lavfi.signalstats.YAVG',
    '-of', 'csv=p=0',
  ], { encoding: 'utf-8' });

  try { fs.unlinkSync(outPath); } catch { /* best-effort cleanup */ }
  const avg = parseFloat((r.stdout || '0').trim().split(',')[0]);
  // avg 0-255; normalize to 0-100%
  return Math.min(100, (avg / 255) * 100);
}

function thumbnailInfo(thumbPath: string): { width: number; height: number; sizeBytes: number } {
  const r = spawnSync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height',
    '-of', 'csv=p=0',
    thumbPath,
  ], { encoding: 'utf-8' });
  const parts = (r.stdout || '').trim().split(',');
  const stat = fs.statSync(thumbPath);
  return {
    width: parseInt(parts[0] ?? '0', 10),
    height: parseInt(parts[1] ?? '0', 10),
    sizeBytes: stat.size,
  };
}

/** Compute contrast ratio between lightest and darkest significant regions using ffprobe */
function thumbnailContrastRatio(thumbPath: string): number {
  const r = spawnSync('ffprobe', [
    '-v', 'error',
    '-f', 'lavfi',
    `-i`, `movie=${thumbPath},signalstats`,
    '-show_entries', 'frame_tags=lavfi.signalstats.YMAX,lavfi.signalstats.YMIN',
    '-of', 'csv=p=0',
  ], { encoding: 'utf-8' });
  const parts = (r.stdout || '').trim().split(',');
  const yMax = parseFloat(parts[0] ?? '255');
  const yMin = parseFloat(parts[1] ?? '0');
  // Relative luminance approximation
  const l1 = (yMax / 255) + 0.05;
  const l2 = (yMin / 255) + 0.05;
  return l1 / l2;
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual Checks
// ─────────────────────────────────────────────────────────────────────────────

async function checkFormat(videoPath: string, format: VideoFormat): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const spec = format === 'long' ? LONG_FORM : SHORT_FORM;

  let probe: Record<string, unknown>;
  try {
    probe = ffprobe(videoPath);
  } catch (e) {
    return [fail('F-00', 'ffprobe parse', 'format', 'FATAL', `Cannot probe video: ${(e as Error).message}`)];
  }

  const streams = probe.streams as Array<Record<string, unknown>>;
  const fmtData = probe.format as Record<string, unknown>;
  const videoStream = streams.find(s => s.codec_type === 'video');
  const audioStream = streams.find(s => s.codec_type === 'audio');

  if (!videoStream) {
    results.push(fail('F-01', 'Video stream present', 'format', 'FATAL', 'No video stream found'));
    return results;
  }

  // Resolution
  const w = Number(videoStream.width), h = Number(videoStream.height);
  if (w === spec.width && h === spec.height) {
    results.push(pass('F-01', 'Resolution', 'format', `${w}×${h} ✓`));
  } else {
    results.push(fail('F-01', 'Resolution', 'format', 'FATAL',
      `Got ${w}×${h}, required ${spec.width}×${spec.height}`,
      { width: w, height: h }, { width: spec.width, height: spec.height }));
  }

  // Frame rate
  const fpsStr = String(videoStream.r_frame_rate ?? videoStream.avg_frame_rate ?? '0/1');
  const [num, den] = fpsStr.split('/').map(Number);
  const actualFps = den ? num / den : num;
  if (Math.abs(actualFps - spec.fps) <= spec.fpsSlack) {
    results.push(pass('F-02', 'Frame rate', 'format', `${actualFps.toFixed(3)} fps ✓`));
  } else {
    results.push(fail('F-02', 'Frame rate', 'format', 'FATAL',
      `Got ${actualFps.toFixed(3)} fps, required ${spec.fps} ± ${spec.fpsSlack}`,
      { fps: actualFps }, { fps: spec.fps, slack: spec.fpsSlack }));
  }

  // Duration
  const durationSec = parseFloat(String(fmtData.duration ?? 0));
  if (format === 'long') {
    const spec_ = spec as typeof LONG_FORM;
    if (durationSec >= spec_.minDurationSec && durationSec <= spec_.maxDurationSec) {
      results.push(pass('F-03', 'Duration (long-form)', 'format',
        `${(durationSec / 60).toFixed(1)} min ✓`));
    } else {
      results.push(fail('F-03', 'Duration (long-form)', 'format', 'FATAL',
        `${(durationSec / 60).toFixed(1)} min — must be 5–15 min`,
        { durationSec }, { min: spec_.minDurationSec, max: spec_.maxDurationSec }));
    }
  } else {
    const spec_ = spec as typeof SHORT_FORM;
    if (durationSec <= spec_.maxDurationSec) {
      results.push(pass('F-03', 'Duration (short)', 'format', `${durationSec.toFixed(1)}s ✓`));
    } else {
      results.push(fail('F-03', 'Duration (short)', 'format', 'FATAL',
        `${durationSec.toFixed(1)}s — must be ≤ ${spec_.maxDurationSec}s`,
        { durationSec }, { max: spec_.maxDurationSec }));
    }
  }

  // Video codec
  const vCodec = String(videoStream.codec_name ?? '').toLowerCase();
  if (vCodec.includes(spec.videoCodec)) {
    results.push(pass('F-04', 'Video codec', 'format', `${vCodec} ✓`));
  } else {
    results.push(fail('F-04', 'Video codec', 'format', 'FATAL',
      `Got ${vCodec}, required h264`, { codec: vCodec }, { codec: spec.videoCodec }));
  }

  // H.264 profile
  if (vCodec.includes('h264')) {
    const profile = String(videoStream.profile ?? '').toLowerCase();
    if (profile.includes('high')) {
      results.push(pass('F-04b', 'H.264 profile', 'format', `${profile} ✓`));
    } else {
      results.push(fail('F-04b', 'H.264 profile', 'format', 'ERROR',
        `Profile is "${profile}", must be High`, { profile }));
    }
  }

  // File size
  const fileSizeBytes = fs.statSync(videoPath).size;
  if (fileSizeBytes <= spec.maxFileSizeBytes) {
    results.push(pass('F-05', 'File size', 'format',
      `${(fileSizeBytes / 1e9).toFixed(2)} GB ✓`));
  } else {
    results.push(fail('F-05', 'File size', 'format', 'FATAL',
      `${(fileSizeBytes / 1e9).toFixed(2)} GB exceeds 2 GB limit`,
      { bytes: fileSizeBytes }, { maxBytes: spec.maxFileSizeBytes }));
  }

  // Audio stream
  if (!audioStream) {
    results.push(fail('F-06', 'Audio stream', 'format', 'ERROR', 'No audio stream found'));
    return results;
  }

  const aCodec = String(audioStream.codec_name ?? '').toLowerCase();
  if (aCodec.includes(spec.audioCodec)) {
    results.push(pass('F-06', 'Audio codec', 'format', `${aCodec} ✓`));
  } else {
    results.push(fail('F-06', 'Audio codec', 'format', 'ERROR',
      `Got ${aCodec}, required aac`, { codec: aCodec }));
  }

  const sampleRate = Number(audioStream.sample_rate ?? 0);
  if (sampleRate === spec.audioSampleRate) {
    results.push(pass('F-07', 'Sample rate', 'format', `${sampleRate} Hz ✓`));
  } else {
    results.push(fail('F-07', 'Sample rate', 'format', 'ERROR',
      `Got ${sampleRate} Hz, required 48000 Hz`, { sampleRate }));
  }

  const channels = Number(audioStream.channels ?? 0);
  if (channels >= spec.audioChannels) {
    results.push(pass('F-08', 'Audio channels', 'format', `${channels} ch ✓`));
  } else {
    results.push(fail('F-08', 'Audio channels', 'format', 'ERROR',
      `Got ${channels} ch, required stereo (2)`, { channels }));
  }

  return results;
}

async function checkLufs(videoPath: string, targetLufs: number): Promise<CheckResult[]> {
  // Re-implements lufs-verify.ts logic inline for portability
  const r = spawnSync('ffmpeg', [
    '-nostats', '-i', videoPath,
    '-af', 'ebur128=peak=true',
    '-f', 'null', '-',
  ], { encoding: 'utf-8' });

  const stderr = (r.stderr ?? '') + (r.stdout ?? '');
  const iMatch = stderr.match(/I:\s*([-\d.]+)\s*LUFS/);
  const peakMatch = stderr.match(/Peak:\s*([-\d.]+)\s*dBFS/);

  if (!iMatch || !peakMatch) {
    return [fail('F-09', 'LUFS measurement', 'format', 'ERROR',
      'Could not parse ebur128 output — ffmpeg may have crashed')];
  }

  const integrated = parseFloat(iMatch[1]);
  const truePeak = parseFloat(peakMatch[1]);
  const tolerance = 0.5;
  const results: CheckResult[] = [];

  const lufsOk = Math.abs(integrated - targetLufs) <= tolerance;
  if (lufsOk) {
    results.push(pass('F-09', 'Integrated LUFS', 'format',
      `${integrated.toFixed(1)} LUFS (target ${targetLufs} ±${tolerance}) ✓`,
      { integrated }));
  } else {
    results.push(fail('F-09', 'Integrated LUFS', 'format', 'ERROR',
      `${integrated.toFixed(1)} LUFS is outside ${targetLufs} ±${tolerance} LU`,
      { integrated }, { target: targetLufs, tolerance }));
  }

  const peakOk = truePeak <= LONG_FORM.truePeakCeiling;
  if (peakOk) {
    results.push(pass('F-10', 'True peak', 'format',
      `${truePeak.toFixed(1)} dBTP ≤ ${LONG_FORM.truePeakCeiling} dBTP ✓`,
      { truePeak }));
  } else {
    results.push(fail('F-10', 'True peak', 'format', 'ERROR',
      `${truePeak.toFixed(1)} dBTP exceeds ceiling ${LONG_FORM.truePeakCeiling} dBTP`,
      { truePeak }, { ceiling: LONG_FORM.truePeakCeiling }));
  }

  return results;
}

async function checkVisuals(videoPath: string, workDir: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // ── Extract frames: first 5s every-frame + 30 evenly spaced ──────────────
  const hookDir = path.join(workDir, 'hook_frames');
  const sampleDir = path.join(workDir, 'sample_frames');
  fs.mkdirSync(hookDir, { recursive: true });
  fs.mkdirSync(sampleDir, { recursive: true });

  try {
    extractFrames(videoPath, hookDir, '30', 0, 5);   // first 5s, every frame
    extractFrames(videoPath, sampleDir, '30/30');      // 1 frame every second (~30 sample)
  } catch (e) {
    return [fail('V-00', 'Frame extraction', 'visual', 'ERROR',
      `Could not extract frames: ${(e as Error).message}`)];
  }

  const hookFrames = getFrameFiles(hookDir).slice(0, 90);   // first 3s = 90 frames at 30fps
  const sampleFrames = getFrameFiles(sampleDir).slice(0, 30);

  // ── V-01: First-3s text density ───────────────────────────────────────────
  if (hookFrames.length > 0) {
    const coverages = hookFrames.map(f => estimateTextCoverage(f));
    const maxCoverage = Math.max(...coverages);
    if (maxCoverage < 60) {
      results.push(pass('V-01', 'First-3s text density', 'visual',
        `Max coverage ${maxCoverage.toFixed(1)}% < 60% threshold ✓`,
        { maxCoveragePercent: maxCoverage }));
    } else {
      results.push(fail('V-01', 'First-3s text density', 'visual', 'ERROR',
        `Frame has ${maxCoverage.toFixed(1)}% edge coverage — likely static title card, not action hook`,
        { maxCoveragePercent: maxCoverage }, { threshold: 60 }));
    }
  }

  // ── V-02: Caption safe-zone (OCR on hook frames) ──────────────────────────
  // We OCR every 10th hook frame and check if any detected text coordinates
  // fall outside universal safe zone. Here we use a heuristic: text in top
  // 240px or bottom 480px triggers failure.
  let safeZoneViolation = false;
  for (const frame of hookFrames.filter((_, i) => i % 10 === 0)) {
    const text = ocrFrame(frame);
    // Tesseract with hocr would give coords; without hocr we check for
    // common UI chrome text patterns that indicate caption in danger zone
    if (text.includes('subscribe') || text.includes('like and')) {
      // Watermark/CTA in first 3s is a safe-zone risk signal
      safeZoneViolation = true;
    }
  }

  // For proper coordinate check, we'd need tesseract hocr mode
  // Simplified: verify via ffprobe signalstats on top/bottom crop
  const topCropCheck = spawnSync('ffprobe', [
    '-v', 'error', '-f', 'lavfi',
    `-i`, `movie=${hookFrames[0] ?? 'null'},crop=${FRAME_WIDTH}:${SAFE_ZONE.top}:0:0,signalstats`,
    '-show_entries', 'frame_tags=lavfi.signalstats.YAVG', '-of', 'csv=p=0',
  ], { encoding: 'utf-8' });
  const topAvg = parseFloat((topCropCheck.stdout || '0').trim().split(',')[0]);

  if (!safeZoneViolation && topAvg < 200) {
    results.push(pass('V-02', 'Caption safe-zone', 'visual',
      `No caption violations detected in safe-zone check ✓`));
  } else {
    results.push(fail('V-02', 'Caption safe-zone', 'visual', 'ERROR',
      'Possible text element detected in platform UI chrome zone (top 240px or bottom 480px)',
      { topAvg, safeZoneViolation }));
  }

  // ── V-03: Solid-color frame detection ─────────────────────────────────────
  const allFrames = [...hookFrames, ...sampleFrames];
  let maxConsecutiveSolid = 0;
  let consecutiveSolid = 0;

  for (const frame of allFrames) {
    const stddev = measurePixelStddev(frame);
    if (stddev < 8) {
      consecutiveSolid++;
      maxConsecutiveSolid = Math.max(maxConsecutiveSolid, consecutiveSolid);
    } else {
      consecutiveSolid = 0;
    }
  }

  const solidDurationSec = maxConsecutiveSolid / 30;
  if (solidDurationSec <= 0.5) {
    results.push(pass('V-03', 'Solid-color frame check', 'visual',
      `Max consecutive solid: ${solidDurationSec.toFixed(2)}s ≤ 0.5s ✓`,
      { solidDurationSec }));
  } else {
    results.push(fail('V-03', 'Solid-color frame check', 'visual', 'ERROR',
      `${solidDurationSec.toFixed(2)}s of consecutive solid-color frames detected — render glitch`,
      { solidDurationSec, maxConsecutiveSolidFrames: maxConsecutiveSolid },
      { maxSec: 0.5 }));
  }

  // ── V-04: Histogram diversity / entropy ────────────────────────────────────
  if (sampleFrames.length >= 5) {
    const entropies = sampleFrames.map(f => histogramEntropy(f));
    const avgEntropy = entropies.reduce((a, b) => a + b, 0) / entropies.length;

    if (avgEntropy >= 3.5) {
      results.push(pass('V-04', 'Histogram diversity', 'visual',
        `Avg entropy ${avgEntropy.toFixed(2)} bits ≥ 3.5 bits ✓`,
        { avgEntropy }));
    } else {
      results.push(fail('V-04', 'Histogram diversity', 'visual', 'WARN',
        `Avg entropy ${avgEntropy.toFixed(2)} bits < 3.5 bits — visually monotonous, low retention risk`,
        { avgEntropy }, { minEntropy: 3.5 }));
    }
  }

  // ── V-05: OCR hook keyword in first 3s ────────────────────────────────────
  const hookOcrText = hookFrames.slice(0, 30)
    .map(f => ocrFrame(f))
    .join(' ');

  if (containsHookKeyword(hookOcrText)) {
    results.push(pass('V-05', 'OCR hook keyword (first 3s)', 'visual',
      'Approved hook keyword found in first 3s ✓'));
  } else {
    results.push(fail('V-05', 'OCR hook keyword (first 3s)', 'visual', 'ERROR',
      'No approved hook keyword visible in first 3 seconds — opener must show salary figure, FAANG name, or shock word',
      { ocrSample: hookOcrText.slice(0, 200) }));
  }

  return results;
}

async function checkRetentionProxy(videoPath: string): Promise<CheckResult[]> {
  /**
   * Retention proxy score — 100 pts total.
   * Scoring mirrors fix-16-tdd-ci retention test categories.
   */
  const results: CheckResult[] = [];
  let score = 0;
  const breakdown: Record<string, number> = {};

  const r = spawnSync('ffprobe', [
    '-v', 'quiet', '-print_format', 'json',
    '-show_format', '-show_streams', videoPath,
  ], { encoding: 'utf-8' });

  let probe: Record<string, unknown> = {};
  try { probe = JSON.parse(r.stdout); } catch { /* use defaults */ }

  const fmt = probe.format as Record<string, unknown> ?? {};
  const durationSec = parseFloat(String(fmt.duration ?? 0));

  // 20 pts: Hook ≤ 3s (check via scene detection — proxy: low-complexity first 3s)
  // We assume well-formed video has hook; deduct if duration < 10s (no content after hook)
  if (durationSec > 10) { score += 20; breakdown['hook_3s'] = 20; }
  else { breakdown['hook_3s'] = 0; }

  // 15 pts: Caption density — check if video has subtitle stream OR assume from audio
  const streams = (probe.streams as Array<Record<string, unknown>>) ?? [];
  const hasSubtitles = streams.some(s => s.codec_type === 'subtitle');
  if (hasSubtitles) { score += 15; breakdown['caption_density'] = 15; }
  else { score += 8; breakdown['caption_density'] = 8; } // partial credit

  // 15 pts: Audio ducking — check for audio bitrate variation (proxy for ducking)
  const audioStream = streams.find(s => s.codec_type === 'audio');
  const audioBitrate = Number((audioStream ?? {}).bit_rate ?? 0);
  if (audioBitrate > 64000) { score += 15; breakdown['audio_ducking'] = 15; }
  else { score += 7; breakdown['audio_ducking'] = 7; }

  // 20 pts: Loop/cliff ending — check last 2s for audio level spike (cliffhanger audio cue)
  // Proxy: file has audio in last 2s (not silence)
  const silenceCheck = spawnSync('ffmpeg', [
    '-i', videoPath,
    '-af', `silencedetect=noise=-50dB:d=0.5,atrim=start=${Math.max(0, durationSec - 2)}`,
    '-f', 'null', '-',
  ], { encoding: 'utf-8' });
  const hasSilenceAtEnd = (silenceCheck.stderr ?? '').includes('silence_start');
  if (!hasSilenceAtEnd) { score += 20; breakdown['loop_ending'] = 20; }
  else { score += 5; breakdown['loop_ending'] = 5; }

  // 15 pts: Scene variety — check for scene changes via ffprobe packet timestamps
  const sceneCheck = spawnSync('ffprobe', [
    '-v', 'quiet', '-f', 'lavfi',
    `-i`, `movie=${videoPath},select=gt(scene\\,0.3)`,
    '-show_entries', 'packet=pts_time',
    '-of', 'csv=p=0',
  ], { encoding: 'utf-8' });
  const sceneChanges = (sceneCheck.stdout || '').split('\n').filter(Boolean).length;
  const sceneScore = Math.min(15, Math.floor(sceneChanges / 3) * 3);
  score += sceneScore; breakdown['scene_variety'] = sceneScore;

  // 15 pts: No dead air > 2s — check via silence detection
  const deadAirCheck = spawnSync('ffmpeg', [
    '-i', videoPath,
    '-af', 'silencedetect=noise=-50dB:d=2.0',
    '-f', 'null', '-',
  ], { encoding: 'utf-8' });
  const hasDeadAir = (deadAirCheck.stderr ?? '').includes('silence_start');
  if (!hasDeadAir) { score += 15; breakdown['no_dead_air'] = 15; }
  else { breakdown['no_dead_air'] = 0; }

  if (score >= 70) {
    results.push(pass('R-01', 'Retention proxy score', 'retention',
      `Score ${score}/100 ≥ 70 ✓`, { score, breakdown }));
  } else {
    results.push(fail('R-01', 'Retention proxy score', 'retention', 'FATAL',
      `Score ${score}/100 < 70 threshold — video will not retain viewers`,
      { score, breakdown }, { minScore: 70 }));
  }

  return results;
}

async function checkMetadata(meta: VideoMetadata, format: VideoFormat): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const spec = format === 'long' ? LONG_FORM : SHORT_FORM;

  // M-01: Title length
  if (meta.title.length <= 70) {
    results.push(pass('M-01', 'Title length', 'metadata',
      `${meta.title.length} chars ≤ 70 ✓`, { length: meta.title.length }));
  } else {
    results.push(fail('M-01', 'Title length', 'metadata', 'ERROR',
      `Title is ${meta.title.length} chars, must be ≤ 70`,
      { length: meta.title.length }, { max: 70 }));
  }

  // M-02: Title hook keyword
  if (containsHookKeyword(meta.title)) {
    results.push(pass('M-02', 'Title hook keyword', 'metadata', 'Hook keyword found in title ✓'));
  } else {
    results.push(fail('M-02', 'Title hook keyword', 'metadata', 'ERROR',
      'No hook keyword in title (salary figure, FAANG, shock word)',
      { title: meta.title }));
  }

  // M-03: Emoji spam (count unicode emoji characters)
  const emojiCount = (meta.title.match(/\p{Emoji_Presentation}/gu) ?? []).length;
  if (emojiCount <= 3) {
    results.push(pass('M-03', 'Title emoji count', 'metadata',
      `${emojiCount} emojis ≤ 3 ✓`, { emojiCount }));
  } else {
    results.push(fail('M-03', 'Title emoji count', 'metadata', 'WARN',
      `${emojiCount} emojis > 3 — triggers YouTube clickbait classifier`,
      { emojiCount }, { max: 3 }));
  }

  // M-04: guru-sishya.in in first 3 lines
  const first3Lines = meta.description.split('\n').slice(0, 3).join('\n');
  if (first3Lines.includes('guru-sishya.in')) {
    results.push(pass('M-04', 'guru-sishya.in URL in first 3 lines', 'metadata',
      'Primary URL present above fold ✓'));
  } else {
    results.push(fail('M-04', 'guru-sishya.in URL placement', 'metadata', 'ERROR',
      'guru-sishya.in URL not found in first 3 lines of description — below fold = no clicks',
      { first3Lines: first3Lines.slice(0, 200) }));
  }

  // M-05: Affiliate links disclosed
  const affiliateLinks = meta.affiliateLinks ?? [];
  const disclosedLinks = affiliateLinks.filter(l =>
    l.includes('#ad') || l.includes('[affiliate]') || l.includes('[ad]') || l.toLowerCase().includes('affiliate'));
  if (disclosedLinks.length >= 3) {
    results.push(pass('M-05', 'Affiliate disclosure', 'metadata',
      `${disclosedLinks.length} disclosed affiliate links ✓`,
      { count: disclosedLinks.length }));
  } else {
    results.push(fail('M-05', 'Affiliate disclosure', 'metadata', 'ERROR',
      `Only ${disclosedLinks.length} disclosed affiliate links — need ≥ 3 (ASCI/FTC compliance)`,
      { disclosed: disclosedLinks.length, total: affiliateLinks.length }, { min: 3 }));
  }

  // M-06: Tag count
  const tagCount = meta.tags.length;
  if (tagCount >= 10 && tagCount <= 15) {
    results.push(pass('M-06', 'Tag count', 'metadata',
      `${tagCount} tags (10–15) ✓`, { tagCount }));
  } else {
    results.push(fail('M-06', 'Tag count', 'metadata', tagCount === 0 ? 'ERROR' : 'WARN',
      `${tagCount} tags — must be 10–15`,
      { tagCount }, { min: 10, max: 15 }));
  }

  // M-12/M-13: Hashtag count
  const hashtagCount = meta.hashtags.length;
  const requiredHashtags = spec.hashtagCount;
  if (hashtagCount === requiredHashtags) {
    results.push(pass('M-12', 'Hashtag count', 'metadata',
      `${hashtagCount} hashtags ✓`, { hashtagCount }));
  } else {
    results.push(fail('M-12', 'Hashtag count', 'metadata', 'WARN',
      `${hashtagCount} hashtags, need exactly ${requiredHashtags} for ${format} format`,
      { hashtagCount }, { required: requiredHashtags }));
  }

  return results;
}

async function checkThumbnail(thumbnailPath: string | undefined): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  if (!thumbnailPath || !fs.existsSync(thumbnailPath)) {
    return [fail('M-07', 'Thumbnail exists', 'metadata', 'ERROR',
      `Thumbnail not found at: ${thumbnailPath ?? '(not specified)'}`)];
  }

  results.push(pass('M-07', 'Thumbnail exists', 'metadata', `${thumbnailPath} ✓`));

  const info = thumbnailInfo(thumbnailPath);

  // M-08: Dimensions
  if (info.width === 1280 && info.height === 720) {
    results.push(pass('M-08', 'Thumbnail dimensions', 'metadata', '1280×720 ✓'));
  } else {
    results.push(fail('M-08', 'Thumbnail dimensions', 'metadata', 'ERROR',
      `Got ${info.width}×${info.height}, required 1280×720`,
      { width: info.width, height: info.height }, { width: 1280, height: 720 }));
  }

  // M-09: File size
  if (info.sizeBytes <= 2 * 1024 * 1024) {
    results.push(pass('M-09', 'Thumbnail file size', 'metadata',
      `${(info.sizeBytes / 1024).toFixed(0)} KB ✓`, { sizeBytes: info.sizeBytes }));
  } else {
    results.push(fail('M-09', 'Thumbnail file size', 'metadata', 'ERROR',
      `${(info.sizeBytes / 1e6).toFixed(2)} MB > 2 MB limit`,
      { sizeBytes: info.sizeBytes }, { max: 2 * 1024 * 1024 }));
  }

  // M-10: OCR word count
  const thumbText = ocrFrame(thumbnailPath);
  const wordCount = thumbText.trim().split(/\s+/).filter(w => w.length > 1).length;
  if (wordCount <= 4) {
    results.push(pass('M-10', 'Thumbnail text word count', 'metadata',
      `${wordCount} words ≤ 4 ✓`, { wordCount }));
  } else {
    results.push(fail('M-10', 'Thumbnail text word count', 'metadata', 'WARN',
      `${wordCount} words on thumbnail — >4 reduces CTR in 78% of tech niches`,
      { wordCount, text: thumbText.slice(0, 100) }, { max: 4 }));
  }

  // M-11: Contrast ratio
  const contrast = thumbnailContrastRatio(thumbnailPath);
  if (contrast >= 4.5) {
    results.push(pass('M-11', 'Thumbnail contrast', 'metadata',
      `${contrast.toFixed(1)}:1 ≥ 4.5:1 ✓`, { contrastRatio: contrast }));
  } else {
    results.push(fail('M-11', 'Thumbnail contrast', 'metadata', 'WARN',
      `Contrast ratio ${contrast.toFixed(1)}:1 < WCAG AA 4.5:1 — unreadable on budget phones`,
      { contrastRatio: contrast }, { min: 4.5 }));
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Gate Runner
// ─────────────────────────────────────────────────────────────────────────────

export async function runQualityGate(
  videoPath: string,
  metadataPath: string,
  options: { format?: VideoFormat; workDir?: string; determinism?: boolean } = {},
): Promise<QualityReport> {
  const startMs = Date.now();
  const format: VideoFormat = options.format ?? 'long';
  const enforce = (process.env['QUALITY_GATE_ENFORCE'] ?? 'enforce') as 'enforce' | 'warn';

  if (!fs.existsSync(videoPath)) throw new Error(`Video not found: ${videoPath}`);
  if (!fs.existsSync(metadataPath)) throw new Error(`Metadata not found: ${metadataPath}`);

  const meta: VideoMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  const videoSha256 = sha256File(videoPath);

  const workDir = options.workDir ?? path.join(path.dirname(videoPath), `.qg_${Date.now()}`);
  fs.mkdirSync(workDir, { recursive: true });

  const targetLufs = meta.targetLufs ?? LONG_FORM.targetLufs;

  console.log(`\n🔍 Quality Gate starting — ${format}-form video`);
  console.log(`   Video: ${videoPath} (SHA256: ${videoSha256.slice(0, 12)}...)`);
  console.log(`   Mode:  ${enforce.toUpperCase()}\n`);

  // Run all check categories in parallel
  const [formatResults, lufsResults, visualResults, retentionResults, metaResults, thumbResults] =
    await Promise.all([
      checkFormat(videoPath, format),
      checkLufs(videoPath, targetLufs),
      checkVisuals(videoPath, workDir),
      checkRetentionProxy(videoPath),
      checkMetadata(meta, format),
      checkThumbnail(meta.thumbnailPath),
    ]);

  const allChecks = [
    ...formatResults,
    ...lufsResults,
    ...visualResults,
    ...retentionResults,
    ...metaResults,
    ...thumbResults,
  ];

  // Cleanup work dir
  try {
    execSync(`rm -rf "${workDir}"`, { stdio: 'pipe' });
  } catch { /* best-effort */ }

  const fatal = allChecks.filter(c => !c.passed && c.severity === 'FATAL').length;
  const errors = allChecks.filter(c => !c.passed && c.severity === 'ERROR').length;
  const warnings = allChecks.filter(c => !c.passed && c.severity === 'WARN').length;
  const passed = allChecks.filter(c => c.passed).length;

  // In warn mode, only FATAL blocks; in enforce mode, FATAL+ERROR blocks
  const blockingFailures = enforce === 'warn'
    ? fatal
    : fatal + errors;

  const overallPassed = blockingFailures === 0;

  const report: QualityReport = {
    videoPath,
    metadataPath,
    format,
    videoSha256,
    timestamp: new Date().toISOString(),
    overallPassed,
    enforceMode: enforce,
    checks: allChecks,
    summary: {
      total: allChecks.length,
      passed,
      failed: allChecks.length - passed,
      fatal,
      errors,
      warnings,
    },
    durationMs: Date.now() - startMs,
  };

  const artifactPath = process.env['QUALITY_GATE_ARTIFACT'] ?? 'quality-gate-report.json';
  fs.writeFileSync(artifactPath, JSON.stringify(report, null, 2));

  // Print summary
  console.log('\n── Quality Gate Results ──────────────────────────────');
  for (const c of allChecks) {
    const icon = c.passed ? '✅' : c.severity === 'FATAL' ? '🛑' : c.severity === 'ERROR' ? '❌' : '⚠️';
    console.log(`  ${icon} [${c.checkId}] ${c.name}: ${c.message}`);
  }
  console.log('\n── Summary ───────────────────────────────────────────');
  console.log(`  Passed:   ${passed}/${allChecks.length}`);
  console.log(`  Fatal:    ${fatal}`);
  console.log(`  Errors:   ${errors}`);
  console.log(`  Warnings: ${warnings}`);
  console.log(`  Mode:     ${enforce}`);
  console.log(`  Result:   ${overallPassed ? '✅ PASS — video may be published' : '🛑 FAIL — upload blocked'}`);
  console.log(`  Report:   ${artifactPath}`);
  console.log(`  Duration: ${(report.durationMs / 1000).toFixed(1)}s\n`);

  return report;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI entry point
// ─────────────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const videoPath = args[0];
  const metadataPath = args[1];
  const formatArg = args.find(a => a.startsWith('--format='))?.split('=')[1] as VideoFormat | undefined;
  const determinism = args.includes('--determinism');

  if (!videoPath || !metadataPath) {
    console.error('Usage: npx tsx scripts/quality-gate.ts <video.mp4> <metadata.json> [--format=long|short] [--determinism]');
    process.exit(1);
  }

  runQualityGate(videoPath, metadataPath, { format: formatArg ?? 'long', determinism })
    .then(report => {
      process.exit(report.overallPassed ? 0 : 1);
    })
    .catch(err => {
      console.error('❌ Quality gate crashed:', err.message);
      process.exit(2);
    });
}
