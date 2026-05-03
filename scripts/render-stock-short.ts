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
import type { StockStoryboard, PickedClip } from '../src/stock/types.js';

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
    })),
  };
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
  await compose({
    scenes: storyboard.scenes.map((scene, i) => ({
      clipPath: clipPaths[i],
      durationSec: scene.durationFrames / storyboard.fps,
      sceneIndex: scene.sceneIndex,
    })),
    voicePath: hasVoice ? voicePath : undefined,
    outputPath,
    workDir: path.join(finalOutDir, '_work'),
  });
  console.log(`[orchestrator] ✓ output: ${outputPath}`);

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

main().catch((err: unknown) => {
  console.error('[orchestrator] fatal:', err);
  process.exit(1);
});
