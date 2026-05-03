/**
 * render-orchestrator.ts PATCH — Fix #26
 *
 * Runs the retention proxy after every render and fails fast if score < 70.
 *
 * HOW TO APPLY:
 *   1. In `src/pipeline/render-orchestrator.ts`, find the function that
 *      completes a render (after npx remotion render ... completes).
 *   2. Import `runRetentionCheck` from this patch.
 *   3. Call `await runRetentionCheck(outputPath, topic, title)` after render.
 *   4. If it throws, catch it and mark the render job as FAILED in the queue.
 *
 * DETERMINISTIC: pure function of video file + metadata.
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import {
  type VideoMetrics,
  scoreRetention,
  formatRetentionComment,
} from '../lib/retention-proxy';

// ─── Retention threshold ──────────────────────────────────────────────────────

const RETENTION_GATE_THRESHOLD = 70;

// ─── Post-render retention check ─────────────────────────────────────────────

export interface RetentionCheckResult {
  score: number;
  passed: boolean;
  reportPath: string;
  prCommentText: string;
}

/**
 * runRetentionCheck — runs after render completes.
 *
 * Extracts video metrics via ffprobe and scores the video.
 * Throws if score < 70 (CI gate).
 *
 * @param videoPath  Absolute path to rendered MP4
 * @param topic      Topic string (for retention engine context)
 * @param title      Video title (for shock-hook scoring)
 */
export async function runRetentionCheck(
  videoPath: string,
  topic: string,
  title: string,
): Promise<RetentionCheckResult> {
  if (!fs.existsSync(videoPath)) {
    throw new Error(
      `[retention-gate] Rendered video not found at: ${videoPath}`,
    );
  }

  console.log(`\n[retention-gate] Checking retention for: ${path.basename(videoPath)}`);

  // Extract metrics via ffprobe
  const metrics = extractMetricsFromVideo(videoPath, title);

  // Score
  const result = scoreRetention(metrics);

  console.log(`[retention-gate] Score: ${result.totalScore}/100 (threshold: ${RETENTION_GATE_THRESHOLD})`);
  for (const section of result.sections) {
    const icon = section.score >= 70 ? '✅' : section.score >= 50 ? '⚠️' : '❌';
    console.log(`  ${icon} ${section.section}: ${section.score}/100`);
  }

  if (result.recommendations.length > 0) {
    console.log('[retention-gate] Top recommendations:');
    result.recommendations.slice(0, 3).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r}`);
    });
  }

  // Write report
  const reportPath = videoPath.replace(/\.(mp4|mov|webm)$/, '') + '.retention-report.json';
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        video: path.basename(videoPath),
        topic,
        title,
        timestamp: new Date().toISOString(),
        totalScore: result.totalScore,
        passed: result.passed,
        sections: result.sections,
        recommendations: result.recommendations,
        metrics,
        prComment: formatRetentionComment(result),
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(`[retention-gate] Report written to: ${reportPath}`);

  if (!result.passed) {
    throw new Error(
      `[retention-gate] FAIL: Score ${result.totalScore}/100 < ${RETENTION_GATE_THRESHOLD}. ` +
        `Video will NOT be uploaded. Fix the following:\n` +
        result.recommendations.slice(0, 3).join('\n'),
    );
  }

  return {
    score: result.totalScore,
    passed: true,
    reportPath,
    prCommentText: formatRetentionComment(result),
  };
}

// ─── Video metrics extractor ──────────────────────────────────────────────────

function extractMetricsFromVideo(videoPath: string, title: string): VideoMetrics {
  // ffprobe for duration + streams
  const probeResult = spawnSync(
    'ffprobe',
    ['-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format', videoPath],
    { encoding: 'utf8' },
  );

  let durationSeconds = 60; // safe default
  let captionPresence = false;

  if (probeResult.status === 0) {
    try {
      const probe = JSON.parse(probeResult.stdout) as {
        format: { duration: string };
        streams: Array<{ codec_type: string }>;
      };
      durationSeconds = parseFloat(probe.format.duration) || 60;
      captionPresence = probe.streams.some(
        (s) => s.codec_type === 'subtitle' || s.codec_type === 'data',
      );
    } catch {
      // Use defaults
    }
  }

  // Audio dynamic range via loudnorm
  let audioDynamicRangeDb = 6.0;
  const loudnormResult = spawnSync(
    'ffmpeg',
    ['-i', videoPath, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'],
    { encoding: 'utf8' },
  );
  if (loudnormResult.status === 0 || loudnormResult.stderr) {
    const jsonMatch = (loudnormResult.stderr ?? '').match(/\{[\s\S]*"input_lra"[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const stats = JSON.parse(jsonMatch[0]) as { input_lra: string };
        audioDynamicRangeDb = parseFloat(stats.input_lra) || 6.0;
      } catch {
        // Use default
      }
    }
  }

  // Scene cuts (proxy for cuts/min)
  const sceneResult = spawnSync(
    'ffprobe',
    [
      '-v', 'quiet', '-select_streams', 'v', '-show_frames',
      '-read_intervals', `%+${Math.min(durationSeconds, 120)}`,
      '-f', 'lavfi', '-i', `movie=${videoPath},select=gt(scene\\,0.3)`,
      '-show_entries', 'frame=pts_time', '-of', 'csv=p=0', videoPath,
    ],
    { encoding: 'utf8' },
  );
  const sceneCuts = (sceneResult.stdout ?? '').split('\n').filter(Boolean).length;
  const cutsPerMinute = (sceneCuts / durationSeconds) * 60;

  // Conservative heuristics for script-level signals
  return {
    title,
    hookDurationSeconds: durationSeconds <= 60 ? 1.0 : 5.0,
    cutsPerMinute,
    audioDynamicRangeDb,
    captionPresence,
    ctaTimingFraction: 0.55,
    videoLengthSeconds: durationSeconds,
    openLoopCount: 1,
    patternInterruptCount: Math.max(0, sceneCuts - 2),
    loopBackMatch: false, // requires frame comparison — skipped in fast mode
    retentionBeatCount: Math.max(0, sceneCuts - 4),
    voiceAtFrameZero: durationSeconds <= 60, // Shorts assumed to have voice at 0
    visualAtFrameZero: true,
  };
}

// ─── Render orchestrator integration comment ─────────────────────────────────
//
// In src/pipeline/render-orchestrator.ts, find the render completion handler.
// It typically looks like:
//
//   const exitCode = await runRemotionRender(job);
//   if (exitCode !== 0) { ... handle failure ... }
//   await markJobComplete(job.id);
//
// Replace with:
//
//   const exitCode = await runRemotionRender(job);
//   if (exitCode !== 0) { ... handle failure ... }
//
//   // ── Retention gate ──────────────────────────────────────────────
//   try {
//     await runRetentionCheck(job.outputPath, job.topic, job.title);
//   } catch (retentionError) {
//     console.error(retentionError.message);
//     await markJobFailed(job.id, 'retention_gate', retentionError.message);
//     return; // Do NOT upload — retention gate failed
//   }
//   // ── End retention gate ──────────────────────────────────────────
//
//   await markJobComplete(job.id);
//   await uploadVideo(job);
//
