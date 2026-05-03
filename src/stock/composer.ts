/**
 * Stock footage composer.
 *
 * Takes one clip path per scene, trims + scales each to 1080×1920,
 * concatenates them, muxes with the voice track, and optionally overlays
 * an ASS subtitle file and a watermark PNG.
 *
 * All work is done via native ffmpeg (no fluent-ffmpeg).
 *
 * Output: a single 1080×1920 H.264/AAC mp4.
 */

import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

// Memoised filter-availability probes. Some ffmpeg builds (e.g. macOS
// homebrew default) ship without libass; we skip captions gracefully
// rather than failing the whole render.
let assAvailableCache: boolean | null = null;
async function isAssFilterAvailable(): Promise<boolean> {
  if (assAvailableCache !== null) return assAvailableCache;
  try {
    const { stdout } = await execFileP('ffmpeg', ['-hide_banner', '-filters'], {
      maxBuffer: 4 * 1024 * 1024,
    });
    assAvailableCache = /^\s*\S+\s+ass\s/m.test(stdout);
  } catch {
    assAvailableCache = false;
  }
  return assAvailableCache;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SceneInput {
  clipPath: string;
  durationSec: number;
  sceneIndex: number;
}

export interface ComposeInput {
  scenes: SceneInput[];
  /** Master voice mp3; if missing or nonexistent a silent track is added. */
  voicePath?: string;
  /** Optional ASS subtitles file to burn in. */
  captionsPath?: string;
  /** Optional watermark PNG to overlay bottom-right. */
  watermarkPath?: string;
  outputPath: string;
  /** Working directory for intermediate files. Defaults to <outputDir>/_work */
  workDir?: string;
  /** Apply slow zoompan ken-burns effect. Disabled by default for speed. */
  enableZoompan?: boolean;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function compose(input: ComposeInput): Promise<void> {
  const outDir = dirname(input.outputPath);
  const workDir = input.workDir ?? join(outDir, '_work');
  mkdirSync(workDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  // Step 1: process each scene clip → scene-N.mp4
  const scenePaths: string[] = [];
  for (const scene of input.scenes) {
    const scenePath = join(workDir, `scene-${scene.sceneIndex}.mp4`);
    await processScene(scene, scenePath, input.enableZoompan ?? false);
    scenePaths.push(scenePath);
  }

  // Step 2: concat all processed scenes
  const concatPath = join(workDir, 'body.mp4');
  await concatScenes(scenePaths, workDir, concatPath);

  // Step 3: mux audio + optional watermark + optional captions → final output
  await muxFinal(concatPath, input, workDir);

  // Cleanup work dir
  rmSync(workDir, { recursive: true, force: true });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function processScene(
  scene: SceneInput,
  outputPath: string,
  enableZoompan: boolean
): Promise<void> {
  const isSynthetic = scene.clipPath.startsWith('synthetic://');
  const FPS = 30;
  const durFrames = Math.ceil(scene.durationSec * FPS);

  // Always normalize to 30fps so concat -c copy can splice without
  // duration drift, and force pix_fmt + GOP closure for clean concat.
  let filterChain: string;
  if (enableZoompan) {
    filterChain = `scale=-2:1920,crop=1080:1920,zoompan=z='1+0.0008*on':d=${durFrames}:s=1080x1920:fps=${FPS},fps=${FPS},setpts=PTS-STARTPTS`;
  } else {
    filterChain = `scale=-2:1920,crop=1080:1920,fps=${FPS},setpts=PTS-STARTPTS`;
  }

  if (isSynthetic) {
    await runFfmpeg([
      '-f', 'lavfi',
      '-i', `color=c=black:s=1080x1920:r=${FPS}`,
      '-t', String(scene.durationSec),
      '-vf', filterChain,
      '-r', String(FPS),
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-pix_fmt', 'yuv420p',
      '-g', String(FPS),
      '-keyint_min', String(FPS),
      '-sc_threshold', '0',
      '-an',
      outputPath,
    ]);
  } else {
    await runFfmpeg([
      '-stream_loop', '-1',
      '-i', scene.clipPath,
      '-t', String(scene.durationSec),
      '-vf', filterChain,
      '-r', String(FPS),
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-pix_fmt', 'yuv420p',
      '-g', String(FPS),
      '-keyint_min', String(FPS),
      '-sc_threshold', '0',
      '-an',
      outputPath,
    ]);
  }
}

async function concatScenes(
  scenePaths: string[],
  workDir: string,
  outputPath: string
): Promise<void> {
  if (scenePaths.length === 1) {
    // Nothing to concat — copy/rename
    await runFfmpeg(['-i', scenePaths[0], '-c', 'copy', outputPath]);
    return;
  }

  const concatTxt = join(workDir, 'concat.txt');
  // Use absolute paths so ffmpeg resolves them correctly regardless of cwd
  const { resolve: resolvePath } = await import('node:path');
  const lines = scenePaths
    .map((p) => `file '${resolvePath(p).replace(/'/g, "'\\''")}'`)
    .join('\n');
  writeFileSync(concatTxt, lines + '\n', 'utf8');

  await runFfmpeg([
    '-f', 'concat',
    '-safe', '0',
    '-i', concatTxt,
    '-c', 'copy',
    outputPath,
  ]);
}

async function muxFinal(
  bodyPath: string,
  input: ComposeInput,
  workDir: string
): Promise<void> {
  const hasVoice = !!(input.voicePath && existsSync(input.voicePath));
  const hasWatermark = !!(input.watermarkPath && existsSync(input.watermarkPath));
  const captionsRequested = !!(input.captionsPath && existsSync(input.captionsPath));
  const hasCaptions = captionsRequested && (await isAssFilterAvailable());
  if (captionsRequested && !hasCaptions) {
    console.warn('[composer] ffmpeg lacks libass — skipping captions burn-in');
  }

  // Determine total duration from body video
  const totalDur = await probeDuration(bodyPath);

  // If no real voice, generate silent audio of same duration
  let audioPath: string;
  if (hasVoice) {
    audioPath = input.voicePath!;
  } else {
    audioPath = join(workDir, 'silence.aac');
    await runFfmpeg([
      '-f', 'lavfi',
      '-i', `aevalsrc=0:channel_layout=stereo:sample_rate=44100:duration=${totalDur}`,
      '-c:a', 'aac',
      '-b:a', '128k',
      audioPath,
    ]);
  }

  const args: string[] = [];

  // Build video filter for watermark + captions
  let vf = '';
  if (hasCaptions) {
    vf = `ass=${input.captionsPath!.replace(/\\/g, '/')}`;
  }

  if (hasWatermark) {
    args.push('-i', bodyPath, '-i', audioPath, '-i', input.watermarkPath!);
    const overlayFilter = `${vf ? `[0:v]${vf}[captioned];[captioned]` : '[0:v]'}[2:v]overlay=W-w-30:H-h-440[outv]`;
    args.push(
      '-filter_complex', overlayFilter,
      '-map', '[outv]',
      '-map', '1:a',
    );
  } else if (vf) {
    args.push('-i', bodyPath, '-i', audioPath);
    args.push('-vf', vf, '-map', '0:v', '-map', '1:a');
  } else {
    args.push('-i', bodyPath, '-i', audioPath);
    args.push('-map', '0:v', '-map', '1:a');
  }

  args.push(
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-color_primaries', 'bt709',
    '-color_trc', 'bt709',
    '-colorspace', 'bt709',
    '-color_range', 'tv',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ar', '48000',
  );
  // loudnorm crashes ffmpeg's aac encoder on near-silent input (NaN/Inf
  // averages). Only apply when we have a real voice track.
  if (hasVoice) {
    args.push('-af', 'loudnorm=I=-14:LRA=7:tp=-1.0');
  }
  args.push(
    '-shortest',
    '-movflags', '+faststart',
    input.outputPath,
  );

  await runFfmpeg(args);
}

async function probeDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    execFile(
      'ffprobe',
      [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'csv=p=0',
        videoPath,
      ],
      (err, stdout) => {
        if (err) reject(err);
        else resolve(parseFloat(stdout.trim()) || 0);
      }
    );
  });
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', ['-y', ...args], { maxBuffer: 10 * 1024 * 1024 }, (err, _stdout, stderr) => {
      if (err) {
        reject(new Error(`ffmpeg failed:\n${stderr}`));
      } else {
        resolve();
      }
    });
  });
}
