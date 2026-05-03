#!/usr/bin/env ts-node
/**
 * retention-cli.ts — Fix #26
 *
 * CLI: npm run retention:check <video.mp4> [--topic <topic>] [--title <title>]
 *
 * Uses ffprobe to extract video metrics, then runs:
 *   1. retention-proxy (composite 0-100 score + section breakdown)
 *   2. dropoff-predictor (at-risk windows + counter-tactics)
 *
 * Outputs:
 *   - Console: formatted score + recommendations
 *   - JSON: <video>.retention-report.json (same dir as input)
 *
 * Exits with code 1 if retention score < 70 (CI gate).
 *
 * DETERMINISTIC: given the same video + ffprobe output, always returns same score.
 * Zero external API calls — pure ffprobe + rule-based math.
 */

import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import {
  type VideoMetrics,
  scoreRetention,
  formatRetentionComment,
} from '../src/lib/retention-proxy';
import {
  predictDropoffs,
  formatDropoffReport,
  type ScriptSegmentInput,
} from '../src/lib/dropoff-predictor';

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const videoPath = args[0];
const topicFlagIdx = args.indexOf('--topic');
const titleFlagIdx = args.indexOf('--title');
const topic = topicFlagIdx >= 0 ? args[topicFlagIdx + 1] : 'system design';
const titleArg = titleFlagIdx >= 0 ? args[titleFlagIdx + 1] : undefined;

if (!videoPath) {
  console.error(
    'Usage: npm run retention:check <video.mp4> [--topic <topic>] [--title <title>]',
  );
  process.exit(1);
}

if (!fs.existsSync(videoPath)) {
  console.error(`Error: file not found: ${videoPath}`);
  process.exit(1);
}

// ─── ffprobe extraction ───────────────────────────────────────────────────────

interface FfprobeStream {
  codec_type: string;
  codec_name: string;
  r_frame_rate: string;
  duration?: string;
  nb_frames?: string;
  tags?: Record<string, string>;
}

interface FfprobeResult {
  streams: FfprobeStream[];
  format: {
    duration: string;
    filename: string;
    tags?: Record<string, string>;
  };
}

function runFfprobe(file: string): FfprobeResult {
  const result = spawnSync(
    'ffprobe',
    [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      file,
    ],
    { encoding: 'utf8' },
  );

  if (result.status !== 0) {
    throw new Error(
      `ffprobe failed: ${result.stderr ?? 'unknown error'}. Is ffprobe installed? (brew install ffmpeg)`,
    );
  }

  return JSON.parse(result.stdout) as FfprobeResult;
}

/** Count scene cuts using ffmpeg scene change detection */
function countSceneCuts(file: string, durationSeconds: number): number {
  try {
    const result = spawnSync(
      'ffprobe',
      [
        '-v', 'quiet',
        '-select_streams', 'v',
        '-show_frames',
        '-read_intervals', `%+${Math.min(durationSeconds, 120)}`,
        '-f', 'lavfi',
        '-i', `movie=${file},select=gt(scene\\,0.3)`,
        '-show_entries', 'frame=pts_time',
        '-of', 'csv=p=0',
        file,
      ],
      { encoding: 'utf8' },
    );
    // Count non-empty lines = number of scene cuts
    const lines = (result.stdout ?? '').split('\n').filter(Boolean);
    return lines.length;
  } catch {
    // Fallback: estimate from video duration (2 cuts/min for a video with no data)
    return Math.round((durationSeconds / 60) * 2);
  }
}

/** Extract audio loudness stats using ffmpeg loudnorm analysis */
function getAudioDynamicRange(file: string): number {
  try {
    const result = spawnSync(
      'ffmpeg',
      [
        '-i', file,
        '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json',
        '-f', 'null',
        '-',
      ],
      { encoding: 'utf8' },
    );
    // loudnorm outputs JSON to stderr
    const stderr = result.stderr ?? '';
    const jsonMatch = stderr.match(/\{[\s\S]*"input_i"[\s\S]*\}/);
    if (jsonMatch) {
      const stats = JSON.parse(jsonMatch[0]) as {
        input_i: string;
        input_lra: string;
      };
      return parseFloat(stats.input_lra) || 6.0;
    }
    return 6.0; // Default: reasonable dynamic range
  } catch {
    return 6.0;
  }
}

/** Check if video has subtitle/caption streams */
function hasCaptions(probe: FfprobeResult): boolean {
  return probe.streams.some(
    (s) => s.codec_type === 'subtitle' || s.codec_type === 'data',
  );
}

/** Extract title from video metadata tags or CLI arg */
function extractTitle(probe: FfprobeResult, cliTitle?: string): string {
  if (cliTitle) return cliTitle;
  const formatTitle = probe.format.tags?.title;
  if (formatTitle) return formatTitle;
  // Fall back to filename without extension
  return path.basename(videoPath, path.extname(videoPath));
}

/** Estimate hook duration from video (heuristic: first scene cut or 5s) */
function estimateHookDuration(file: string): number {
  try {
    const result = spawnSync(
      'ffprobe',
      [
        '-v', 'quiet',
        '-select_streams', 'v',
        '-show_frames',
        '-read_intervals', '%+10',
        '-f', 'lavfi',
        '-i', `movie=${file},select=gt(scene\\,0.4)`,
        '-show_entries', 'frame=pts_time',
        '-of', 'csv=p=0',
      ],
      { encoding: 'utf8' },
    );
    const firstLine = (result.stdout ?? '').split('\n')[0];
    const firstCut = parseFloat(firstLine);
    if (!isNaN(firstCut) && firstCut > 0 && firstCut < 30) {
      return firstCut;
    }
    return 5.0; // Default if no early cut found
  } catch {
    return 5.0;
  }
}

/** Check if first and last frames are visually similar (loop-back detection) */
function checkLoopBack(file: string, durationSeconds: number): boolean {
  try {
    // Extract first frame at 0.1s and last frame at (duration - 0.5s)
    const firstFramePath = `${file}.frame_first.png`;
    const lastFramePath = `${file}.frame_last.png`;

    spawnSync('ffmpeg', [
      '-y', '-ss', '0.1', '-i', file, '-frames:v', '1', '-q:v', '2', firstFramePath,
    ]);
    spawnSync('ffmpeg', [
      '-y', '-ss', String(Math.max(0, durationSeconds - 0.5)),
      '-i', file, '-frames:v', '1', '-q:v', '2', lastFramePath,
    ]);

    // Use ffmpeg SSIM to compare (score > 0.8 = visually similar = loop-back)
    const result = spawnSync('ffmpeg', [
      '-i', firstFramePath, '-i', lastFramePath,
      '-lavfi', 'ssim', '-f', 'null', '-',
    ], { encoding: 'utf8' });

    // Clean up temp frames
    [firstFramePath, lastFramePath].forEach((f) => {
      try { fs.unlinkSync(f); } catch { /* ok */ }
    });

    const ssimMatch = result.stderr?.match(/All:(\d+\.\d+)/);
    if (ssimMatch) {
      return parseFloat(ssimMatch[1]) > 0.80;
    }
    return false;
  } catch {
    return false;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n🎬 Retention Check: ${path.basename(videoPath)}\n`);

  // 1. ffprobe
  console.log('📊 Extracting video metrics via ffprobe...');
  let probe: FfprobeResult;
  try {
    probe = runFfprobe(videoPath);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  const durationStr = probe.format.duration;
  const durationSeconds = parseFloat(durationStr);
  if (isNaN(durationSeconds) || durationSeconds <= 0) {
    console.error('Could not determine video duration from ffprobe output.');
    process.exit(1);
  }

  const title = extractTitle(probe, titleArg);
  console.log(`   Duration: ${durationSeconds.toFixed(1)}s`);
  console.log(`   Title: "${title}"`);

  // 2. Metrics extraction
  console.log('🔬 Analysing scene cuts, audio dynamics, captions...');
  const sceneCuts = countSceneCuts(videoPath, durationSeconds);
  const cutsPerMinute = (sceneCuts / durationSeconds) * 60;
  const audioDynamicRangeDb = getAudioDynamicRange(videoPath);
  const captionPresence = hasCaptions(probe);
  const hookDurationSeconds = estimateHookDuration(videoPath);
  const loopBackMatch = checkLoopBack(videoPath, durationSeconds);

  console.log(`   Cuts/min: ${cutsPerMinute.toFixed(1)} (${sceneCuts} cuts)`);
  console.log(`   Audio range: ${audioDynamicRangeDb.toFixed(1)}dB`);
  console.log(`   Captions: ${captionPresence ? 'yes' : 'no'}`);
  console.log(`   Hook duration: ~${hookDurationSeconds.toFixed(1)}s`);
  console.log(`   Loop-back match: ${loopBackMatch ? 'yes' : 'no'}`);

  // ─── Metrics object ───────────────────────────────────────────────────────
  // Note: openLoopCount, patternInterruptCount, retentionBeatCount, voiceAtFrameZero,
  // visualAtFrameZero, ctaTimingFraction are script-level signals we can't extract
  // from the rendered MP4 alone. We use conservative heuristics here:
  //
  //   - voiceAtFrameZero: proxy = hookDuration ≤ 0.5s
  //   - visualAtFrameZero: proxy = first scene cut ≤ 1s
  //   - openLoopCount: proxy = 1 (conservative)
  //   - patternInterruptCount: proxy = sceneCuts
  //   - retentionBeatCount: proxy = max(0, sceneCuts - 5)
  //   - ctaTimingFraction: proxy = 0.55 (mid-video default)
  //
  // For accurate scoring, pass a --script-report <json> flag (see INTEGRATION.md).

  const metrics: VideoMetrics = {
    title,
    hookDurationSeconds,
    cutsPerMinute,
    audioDynamicRangeDb,
    captionPresence,
    ctaTimingFraction: 0.55, // heuristic default
    videoLengthSeconds: durationSeconds,
    openLoopCount: 1,         // heuristic
    patternInterruptCount: Math.max(0, sceneCuts - 2),
    loopBackMatch,
    retentionBeatCount: Math.max(0, sceneCuts - 4),
    voiceAtFrameZero: hookDurationSeconds <= 0.5,
    visualAtFrameZero: hookDurationSeconds <= 1.0,
  };

  // 3. Score
  console.log('\n🧮 Computing retention proxy score...');
  const result = scoreRetention(metrics);

  // 4. Dropoff prediction (using heuristic segments)
  const heuristicSegments: ScriptSegmentInput[] = [
    { id: 'hook', type: 'hook', startSeconds: 0, endSeconds: hookDurationSeconds },
    { id: 'content', type: 'content', startSeconds: hookDurationSeconds, endSeconds: durationSeconds * 0.7 },
    { id: 'cta', type: 'cta', startSeconds: durationSeconds * 0.55, endSeconds: durationSeconds * 0.6 },
    { id: 'summary', type: 'summary', startSeconds: durationSeconds * 0.7, endSeconds: durationSeconds },
  ];
  const dropoffPrediction = predictDropoffs(heuristicSegments, topic);

  // 5. Output
  console.log('\n' + '═'.repeat(60));
  console.log(result.summary);
  console.log('─'.repeat(60));

  for (const section of result.sections) {
    const icon = section.score >= 70 ? '✅' : section.score >= 50 ? '⚠️' : '❌';
    console.log(
      `  ${icon} ${section.section.padEnd(28)} ${String(section.score).padStart(3)}/100  (${section.contribution}pts)`,
    );
  }

  console.log('─'.repeat(60));
  if (result.recommendations.length > 0) {
    console.log('\n🔧 Top Recommendations:');
    result.recommendations.slice(0, 5).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r}`);
    });
  }

  console.log('\n' + formatDropoffReport(dropoffPrediction, topic));

  // 6. Write JSON report
  const reportPath = videoPath.replace(/\.(mp4|mov|webm)$/, '') + '.retention-report.json';
  const report = {
    video: path.basename(videoPath),
    timestamp: new Date().toISOString(),
    totalScore: result.totalScore,
    passed: result.passed,
    sections: result.sections,
    recommendations: result.recommendations,
    dropoffPrediction,
    metrics,
    prComment: formatRetentionComment(result),
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n📄 JSON report: ${reportPath}`);

  // 7. Exit code
  if (!result.passed) {
    console.error(
      `\n❌ CI GATE FAILED: Retention score ${result.totalScore}/100 < 70. Fix the above issues before uploading.`,
    );
    process.exit(1);
  }

  console.log(`\n✅ CI GATE PASSED: Retention score ${result.totalScore}/100 ≥ 70.\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
