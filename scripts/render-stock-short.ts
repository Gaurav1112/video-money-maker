/**
 * scripts/render-stock-short.ts
 *
 * CLI orchestrator for the stock-footage pipeline.
 *
 * Usage:
 *   npx tsx scripts/render-stock-short.ts --storyboard <path> --out <dir>
 *
 * Steps:
 *   1. Load storyboard JSON
 *   2. Build providers (ManifestProvider × 2, Pexels, Pixabay)
 *   3. Pick one clip per scene
 *   4. Download / cache all clips in parallel
 *   5. Compose final mp4
 *   6. Write licenses.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ManifestProvider } from '../src/stock/providers/manifest.js';
import { PexelsProvider } from '../src/stock/providers/pexels.js';
import { PixabayProvider } from '../src/stock/providers/pixabay.js';
import { pickClipsForStoryboard } from '../src/stock/picker.js';
import { StockCache } from '../src/stock/cache.js';
import { compose } from '../src/stock/composer.js';
import { FALLBACK_CLIP } from '../src/stock/fallback.js';
import type { StockStoryboard, PickedClip, StockScene } from '../src/stock/types.js';
import { generateAssSubtitles } from '../src/stock/captions/ass-generator.js';
import { runQualityGate } from '../src/stock/quality-gate.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = path.resolve(__dirname, '..');
const MANIFEST   = path.join(REPO_ROOT, 'assets', 'stock', 'manifest.json');

// ─── CLI arg parsing ──────────────────────────────────────────────────────────

function parseArgs(): { storyboard: string; out: string } {
  const args = process.argv.slice(2);
  let storyboard = '';
  let out = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--storyboard' && args[i + 1]) storyboard = args[++i];
    if (args[i] === '--out' && args[i + 1]) out = args[++i];
  }
  if (!storyboard) { console.error('--storyboard <path> is required'); process.exit(1); }
  if (!out)        { console.error('--out <dir> is required');          process.exit(1); }
  return { storyboard, out };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeTopic(topic: string): string {
  return topic.replace(/[^a-z0-9\-_]/gi, '-').replace(/-+/g, '-').toLowerCase();
}

interface LicenseEntry {
  sceneIndex: number;
  id: string;
  provider: string;
  url: string;
  license: string;
  pageUrl: string;
  credit: string;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { storyboard: sbPath, out: outDir } = parseArgs();

  // 1. Load storyboard — normalise to StockStoryboard regardless of source format
  const sbRaw = fs.readFileSync(sbPath, 'utf8');
  const raw = JSON.parse(sbRaw) as Record<string, unknown>;
  const rawScenes = (raw['scenes'] as Array<Record<string, unknown>>) ?? [];
  const fps = (raw['fps'] as number) ?? 30;

  const storyboard: StockStoryboard = {
    fps,
    width:            (raw['width'] as number)  ?? 1920,
    height:           (raw['height'] as number) ?? 1080,
    topic:            (raw['topic'] as string)  ?? 'Untitled',
    audioFile:        raw['audioFile'] as string | undefined,
    durationInFrames: (raw['durationInFrames'] as number) ?? 0,
    scenes: rawScenes.map((s, i) => ({
      sceneIndex:    (s['sceneIndex'] as number) ?? i,
      startFrame:    (s['startFrame'] as number) ?? 0,
      endFrame:      (s['endFrame']   as number) ?? 0,
      // Support both durationFrames (new format) and duration in seconds (legacy)
      durationFrames: s['durationFrames'] != null
        ? (s['durationFrames'] as number)
        : Math.round(((s['duration'] as number) ?? 0) * fps),
      type:          (s['type']      as string) ?? 'text',
      narration:     (s['narration'] as string) ?? '',
      templateId:    s['templateId'] as string | undefined,
      wordTimestamps: s['wordTimestamps'] as StockScene['wordTimestamps'],
    })),
  };

  // ── Retention SLA: clamp scene durations ─────────────────────────────────
  // YT Shorts retention dies after ~3s on the hook, then again at ~10s/15s/30s.
  // Hard cap: hook ≤ 3s, body scenes ≤ 4s. Word-timestamps (if present) keep
  // their relative timing inside the clamp.
  const HOOK_MAX_FRAMES = Math.round(3 * fps);   // 3.0s
  const BODY_MAX_FRAMES = Math.round(4 * fps);   // 4.0s
  storyboard.scenes = storyboard.scenes.map((scene, i) => {
    const cap = i === 0 ? HOOK_MAX_FRAMES : BODY_MAX_FRAMES;
    if (scene.durationFrames > cap) {
      console.log(`[orchestrator] clamping scene ${i}: ${scene.durationFrames}f → ${cap}f (retention SLA)`);
      const ratio = cap / scene.durationFrames;
      const wt = scene.wordTimestamps?.map((w) => ({
        word: w.word,
        startMs: Math.round(w.startMs * ratio),
        endMs: Math.round(w.endMs * ratio),
      }));
      return { ...scene, durationFrames: cap, wordTimestamps: wt };
    }
    return scene;
  });
  console.log(`[orchestrator] topic: ${storyboard.topic} | scenes: ${storyboard.scenes.length}`);

  // 2. Build providers
  const providers = await buildProviders();
  console.log(`[orchestrator] providers: ${providers.map((p) => p.name).join(', ')}`);

  // 3. Pick clips
  console.log('[orchestrator] picking clips…');
  const picked = await pickClipsForStoryboard(storyboard, providers);
  picked.forEach((p, i) => {
    const isFallback = p.clip.id === FALLBACK_CLIP.id;
    console.log(`  scene ${i}: ${isFallback ? 'FALLBACK' : p.clip.id} (score=${p.score.toFixed(1)})`);
  });

  // 4. Download clips in parallel
  console.log('[orchestrator] downloading clips…');
  const cache = new StockCache(path.join(REPO_ROOT, 'assets', 'stock-cache'));
  const clipPaths = await Promise.all(
    picked.map(async ({ clip }, i) => {
      const localPath = await cache.download(clip);
      console.log(`  scene ${i}: ${localPath}`);
      return localPath;
    })
  );

  // 5. Determine voice path
  const voicePath = storyboard.audioFile
    ? path.resolve(path.dirname(sbPath), storyboard.audioFile)
    : undefined;
  const hasVoice = !!(voicePath && fs.existsSync(voicePath));
  if (!hasVoice) console.log('[orchestrator] no voice track found — composing with silent audio');

  // 6. Compose
  const slug = safeTopic(storyboard.topic);
  const finalOutDir = path.join(outDir, slug);
  const outputPath = path.join(finalOutDir, 'short-stock.mp4');
  fs.mkdirSync(finalOutDir, { recursive: true });

  console.log(`[orchestrator] composing → ${outputPath}`);

  // ── Build merged ASS captions covering all scenes (offsets accumulate) ──
  const workDir = path.join(finalOutDir, '_work');
  fs.mkdirSync(workDir, { recursive: true });
  const captionsPath = path.join(workDir, 'captions.ass');
  await buildMergedAssCaptions(storyboard, captionsPath);
  const hasCaptions = fs.existsSync(captionsPath) && fs.statSync(captionsPath).size > 0;

  // ── Generate channel watermark PNG on the fly (no artist asset committed) ──
  const watermarkPath = path.join(workDir, 'watermark.png');
  await generateWatermarkPng(watermarkPath);

  await compose({
    scenes: storyboard.scenes.map((scene, i) => ({
      clipPath: clipPaths[i],
      durationSec: scene.durationFrames / storyboard.fps,
      sceneIndex: scene.sceneIndex,
    })),
    voicePath: hasVoice ? voicePath : undefined,
    captionsPath: hasCaptions ? captionsPath : undefined,
    watermarkPath,
    outputPath,
    workDir,
  });
  console.log(`[orchestrator] ✓ output: ${outputPath}`);

  // ── Quality gate: refuse to ship solid-black / frozen-frame renders ──
  const qg = await runQualityGate(outputPath);
  console.log(`[orchestrator] quality-gate: passed=${qg.passed} meanVariance=${qg.meanVariance.toFixed(1)}${qg.reason ? ' reason=' + qg.reason : ''}`);
  if (!qg.passed) {
    console.error(`[orchestrator] ✗ QUALITY GATE FAILED — refusing to publish`);
    process.exit(2);
  }

  // 7. Write licenses.json
  const licenses: LicenseEntry[] = picked.map((p, i) => ({
    sceneIndex: i,
    id: p.clip.id,
    provider: p.clip.provider,
    url: p.clip.url,
    license: p.clip.license,
    pageUrl: p.clip.pageUrl ?? '',
    credit: p.clip.credit ?? '',
  }));
  const licensesPath = path.join(finalOutDir, 'licenses.json');
  fs.writeFileSync(licensesPath, JSON.stringify({ clips: licenses }, null, 2), 'utf8');
  console.log(`[orchestrator] ✓ licenses: ${licensesPath}`);
}

async function buildProviders() {
  const manifestData = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as { clips: import('../src/stock/types.js').StockClip[] };

  const coverr = new ManifestProvider('coverr', manifestData.clips);
  const mixkit = new ManifestProvider('mixkit', manifestData.clips);
  const pexels = new PexelsProvider();
  const pixabay = new PixabayProvider();

  return [coverr, mixkit, pexels, pixabay];
}

/**
 * Builds one ASS file covering all scenes. Each scene's wordTimestamps are
 * offset by the cumulative duration of preceding scenes so captions land on
 * the right frames in the muxed output.
 */
async function buildMergedAssCaptions(sb: StockStoryboard, outPath: string): Promise<void> {
  const allWords: Array<{ word: string; startMs: number; endMs: number }> = [];
  let cumulativeMs = 0;
  for (const scene of sb.scenes) {
    if (scene.wordTimestamps && scene.wordTimestamps.length > 0) {
      for (const w of scene.wordTimestamps) {
        allWords.push({
          word: w.word,
          startMs: cumulativeMs + w.startMs,
          endMs: cumulativeMs + w.endMs,
        });
      }
    }
    cumulativeMs += (scene.durationFrames / sb.fps) * 1000;
  }
  if (allWords.length === 0) {
    console.log('[orchestrator] no wordTimestamps in any scene — skipping captions');
    return;
  }
  await generateAssSubtitles({
    narration: sb.scenes.map((s) => s.narration).join(' '),
    wordTimestamps: allWords,
    outputPath: outPath,
  });
  console.log(`[orchestrator] captions: ${outPath} (${allWords.length} words)`);
}

/**
 * Renders a 360×100 PNG watermark with the channel handle. Generated each
 * run so we don't commit binary assets and the handle is configurable via
 * env var (CHANNEL_HANDLE; default "@GuruSishya-India").
 */
async function generateWatermarkPng(outPath: string): Promise<void> {
  const handle = process.env['CHANNEL_HANDLE'] ?? '@GuruSishya-India';
  const safeHandle = handle.replace(/[^A-Za-z0-9@_\- ]/g, '');

  // Try a few common fontfile locations; fall back to default font.
  const candidateFonts = [
    '/System/Library/Fonts/Helvetica.ttc',                       // macOS
    '/System/Library/Fonts/Supplemental/Arial.ttf',              // macOS
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',      // Ubuntu/Debian
    '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',               // Fedora/RHEL
  ];
  let fontfileArg = '';
  for (const f of candidateFonts) {
    try {
      const fs = await import('node:fs');
      if (fs.existsSync(f)) {
        fontfileArg = `:fontfile='${f.replace(/'/g, "\\'")}'`;
        break;
      }
    } catch { /* ignore */ }
  }

  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', 'color=color=black@0.0:s=440x80:d=1',
    '-vf', `drawtext=text='${safeHandle}':fontcolor=white:fontsize=42:borderw=3:bordercolor=black@0.85:x=(w-text_w)/2:y=(h-text_h)/2${fontfileArg}`,
    '-frames:v', '1',
    outPath,
  ], { maxBuffer: 4 * 1024 * 1024 }).catch((err) => {
    console.warn('[orchestrator] watermark generation failed (non-fatal):', String(err).slice(0, 200));
  });
}

main().catch((err: unknown) => {
  console.error('[orchestrator] fatal:', err);
  process.exit(1);
});
