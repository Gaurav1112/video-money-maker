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
import { compose, escapeDrawtext } from '../src/stock/composer.js';
import { FALLBACK_CLIP } from '../src/stock/fallback.js';
import type { StockStoryboard, PickedClip, StockScene } from '../src/stock/types.js';
import { generateAssSubtitles } from '../src/stock/captions/ass-generator.js';
import { runQualityGate } from '../src/stock/quality-gate.js';
import { synthesize as ttsSynthesize } from '../src/voice/tts.js';
import { generateShortMetadata, BRAND_AT, BRAND_HANDLE_RAW } from '../src/services/short-metadata.js';
import { execFile } from 'node:child_process';
import { FFMPEG_BIN, FFPROBE_BIN } from '../src/lib/ffmpeg-bin.js';
import { promisify } from 'node:util';
import * as crypto from 'node:crypto';

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
  let voicePath: string | undefined = storyboard.audioFile
    ? path.resolve(path.dirname(sbPath), storyboard.audioFile)
    : undefined;
  let hasVoice = !!(voicePath && fs.existsSync(voicePath));

  // 6. Compose
  const slug = safeTopic(storyboard.topic);
  const finalOutDir = path.join(outDir, slug);
  const outputPath = path.join(finalOutDir, 'short-stock.mp4');
  fs.mkdirSync(finalOutDir, { recursive: true });

  const workDir = path.join(finalOutDir, '_work');
  fs.mkdirSync(workDir, { recursive: true });

  // Hook headline is the SINGLE source of truth for scene-0 visual text,
  // scene-0 TTS audio, and the YT title — computed once here so all three
  // surfaces stay in lock-step. Fixes the v9 regression where scene-0 audio
  // (synthesised from full narration) overran the 3s visual cap and bled
  // into scene-1 visuals.
  const hookHeadline = buildHookHeadline(
    storyboard.topic,
    storyboard.scenes[0]?.narration ?? '',
  );

  // ── Auto-generate TTS narration if storyboard didn't ship a voice ────────
  if (!hasVoice && process.env['TTS_DISABLED'] !== '1') {
    try {
      const ttsResult = await generateNarrationForScenes(storyboard, workDir, hookHeadline);
      voicePath = ttsResult.audioPath;
      hasVoice = true;
      // Re-write each scene's duration to its narration audio length so the
      // visual cuts line up with speech beats. Audio is now the source of
      // truth — we keep the algorithm-critical 3s hook SLA (scene 0) by
      // capping it independently from body scenes.
      // Hook scene cap is sized to the natural duration of a 6-9 word hook
      // headline at TTS rate +8% (~3.5s). 4s gives a safety buffer so the
      // visual never gets cut short of the audio (which would cause the
      // tail of the hook to play over scene-1 visuals).
      // Per Panel-6/7 retention consensus: faster cuts read as higher
      // production value on Shorts. Hook fires at ≤3s (the algorithm
      // SLA); body scenes are capped at 3.5s — fast enough to feel
      // edited, slow enough that an idea fits.
      const HOOK_HARD_CAP = Math.round(3.0 * storyboard.fps);    // 3.0s — Dist1 P1
      const PER_SCENE_HARD_CAP = Math.round(3.5 * storyboard.fps); // 3.5s — Ret2 P0
      const TOTAL_HARD_CAP = 55 * storyboard.fps;                  // YT Shorts ≤60s
      let runningTotal = 0;
      storyboard.scenes = storyboard.scenes.map((scene, i) => {
        const segDur = ttsResult.sceneDurations[i];
        const wt = ttsResult.sceneWordTimestamps[i];
        if (segDur && segDur > 0) {
          let newFrames = Math.round((segDur + 0.2) * storyboard.fps);
          const cap = i === 0 ? HOOK_HARD_CAP : PER_SCENE_HARD_CAP;
          newFrames = Math.min(newFrames, cap);
          const remaining = TOTAL_HARD_CAP - runningTotal;
          if (newFrames > remaining) newFrames = Math.max(remaining, storyboard.fps);
          runningTotal += newFrames;
          return { ...scene, durationFrames: newFrames, wordTimestamps: wt };
        }
        return { ...scene, wordTimestamps: wt };
      });
      console.log(`[orchestrator] tts: ${voicePath} (scenes: ${ttsResult.sceneDurations.map((d) => d.toFixed(2)).join('s + ')}s)`);
    } catch (err) {
      console.warn(`[orchestrator] TTS failed (${String(err).slice(0, 160)}) — composing with silent audio`);
    }
  }
  if (!hasVoice) console.log('[orchestrator] no voice track found — composing with silent audio');

  console.log(`[orchestrator] composing → ${outputPath}`);

  // ── Build merged ASS karaoke captions across all scenes ──────────────────
  // Word-level timestamps (captured via Edge-TTS --write-subtitles) feed
  // the karaoke layer that highlights each word as it's spoken — the
  // single highest-leverage retention lever per Ret3 panel-5. If any
  // scene lacks timestamps we fall through to drawtext captions; if all
  // do, drawtext is suppressed to prevent double-caption stacking.
  const captionsPath = path.join(workDir, 'captions.ass');
  await buildMergedAssCaptions(storyboard, captionsPath);
  const hasAssCaptions = fs.existsSync(captionsPath);

  // ── Generate channel watermark PNG on the fly ────────────────────────────
  const watermarkPath = path.join(workDir, 'watermark.png');
  await generateWatermarkPng(watermarkPath);

  await compose({
    scenes: storyboard.scenes.map((scene, i) => {
      const isHook = i === 0;
      // Hook scene: short, punchy 4-6 word hook in giant text.
      // Body scenes: narration sentence as caption strip — but only when
      // ASS karaoke captions are NOT active, otherwise we double-stack.
      const bigText = isHook
        ? hookHeadline
        : undefined;
      const captionText = isHook
        ? undefined // hook text already dominates the upper third
        : hasAssCaptions
          ? undefined // Ret3 P1: ASS karaoke owns the caption layer
          : buildCaptionPhrase(scene.narration || '');
      return {
        clipPath: clipPaths[i],
        durationSec: scene.durationFrames / storyboard.fps,
        sceneIndex: scene.sceneIndex,
        bigText,
        captionText,
      };
    }),
    voicePath: hasVoice ? voicePath : undefined,
    watermarkPath,
    captionsPath: hasAssCaptions ? captionsPath : undefined,
    // Ret2 P0: ken-burns motion on by default for body scenes — static
    // stock clips on a 60s vertical kill perceived pacing. The composer
    // already supports zoompan; the call site just had it disabled.
    enableZoompan: process.env['DISABLE_KEN_BURNS'] === '1' ? false : true,
    // Ret4 P0: BGM ambient bed with sidechain ducking. Procedurally
    // synthesised inside the composer — no external assets, fully
    // deterministic. Disabled in tests via DISABLE_BGM=1 because the
    // longer mux step bloats the test suite by ~3-4s per fixture.
    enableBgm: process.env['DISABLE_BGM'] === '1' ? false : true,
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

  // 8. Write metadata.json — title/description/tags consumed by the
  // youtube-upload + cross-post-x + telegram steps in CI.
  const metadata = generateShortMetadata(storyboard, {
    licenses: licenses.map((l) => ({
      id: l.id,
      provider: l.provider,
      url: l.url,
      attribution: l.credit || l.id,
    })),
    siteTopicSlug: slug,
    hookHeadline,
  });
  const metadataPath = path.join(finalOutDir, 'metadata.json');
  fs.writeFileSync(
    metadataPath,
    JSON.stringify({
      slug,
      topic: storyboard.topic,
      hook: hookHeadline,
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
      youtube: { title: metadata.title, description: metadata.description, tags: metadata.tags },
      // Cross-platform contracts so adapters in CI don't have to reverse-
      // engineer the field shape per platform. Each sub-object is a strict
      // subset of YT metadata adapted to platform character/format limits.
      //
      // UTM attribution: YT description URLs carry `utm_source=yt_shorts`.
      // For other platforms we rewrite that to the correct source so
      // analytics segments traffic by origin (Aud2 P0 / Dist P0).
      instagram_reels: {
        caption: `${metadata.title}\n\n${metadata.description.split('\n').slice(0, 6).join('\n')}`
          .replace(/utm_source=yt_shorts/g, 'utm_source=ig_reels')
          .slice(0, 2200),
        hashtags: metadata.tags.slice(0, 30).map((t) => `#${t}`).join(' '),
      },
      x_post: {
        // Hook + brand handle + ICP hashtags. cross-post-x.ts appends the
        // video URL separately so we don't include it in `text`.
        text: `${hookHeadline}\n\n${BRAND_AT} · ${metadata.tags.slice(0, 4).map((t) => `#${t}`).join(' ')}`.slice(0, 280),
      },
      linkedin: {
        title: metadata.title.replace(/\s*#\w+\s*/g, '').trim(),
        body: metadata.description
          .replace(/utm_source=yt_shorts/g, 'utm_source=linkedin')
          .split('\n').slice(0, 8).join('\n'),
      },
      telegram: {
        text: `🆕 ${metadata.title}\n\n${metadata.description.replace(/utm_source=yt_shorts/g, 'utm_source=telegram').split('\n').slice(0, 4).join('\n')}`,
      },
    }, null, 2),
    'utf8',
  );
  console.log(`[orchestrator] ✓ metadata: ${metadataPath}`);

  // 9. Generate thumbnail PNG: frame extracted at t=0.5s, with a bold hook
  // banner overlay. YT Shorts auto-picks frame 1 if no custom thumbnail is
  // provided — and frame 1 is rarely the most engaging visual. We render
  // a separate branded thumbnail so the upload step has it.
  const thumbnailPath = path.join(finalOutDir, 'thumbnail.png');
  await generateThumbnailPng({
    sourceVideoPath: outputPath,
    hook: hookHeadline,
    handle: process.env['CHANNEL_HANDLE'] ?? BRAND_AT,
    outPath: thumbnailPath,
  });
  console.log(`[orchestrator] ✓ thumbnail: ${thumbnailPath}`);
}

/**
 * Builds a punchy 4-7 word hook headline from the topic + scene-0 narration.
 * Used as the giant upper-third drawtext in the first 3 seconds.
 */
/**
 * Hook headline templates validated across Fireship / NeetCode / ByteByteGo
 * / Striver / Aman Dhattarwal Shorts. Each beats the inert "{topic} in 60s"
 * baseline by triggering one of: number-lead, stakes, contrarian-claim,
 * curiosity-gap, or peer-Hinglish. Picked deterministically by hash(topic)
 * so re-renders for the same topic produce the same hook copy (idempotent
 * uploads).
 *
 * Keep each rendered string ≤ 36 chars after `${topic}` substitution so it
 * fits on 3 wrapped lines @ 14 chars on the 1080×1920 hook band.
 */
const HOOK_TEMPLATES: Array<(topic: string) => string> = [
  (t) => `${t} sirf 60 sec me`,                // H1 density (Hinglish)
  (t) => `${t} galat samjhe the?`,             // H3 contrarian (Hinglish)
  (t) => `${t} — FAANG ka favourite`,          // H2 stakes (Hinglish)
  (t) => `${t} kyun zaruri hai`,               // H4 curiosity (Hinglish)
  (t) => `3 baatein ${t} ke baare me`,         // H1 number-lead (Hinglish)
  (t) => `Bhai, ${t} ek line me`,              // H5 peer (Hinglish)
  (t) => `${t} — ye mistake mat karna`,        // H5 loss-aversion (Hinglish)
  (t) => `${t} — placement walo ke liye`,      // H5 ICP (Hinglish)
  (t) => `${t} ka asli concept`,               // H5 authority (Hinglish)
];

/**
 * Builds a punchy 4-8 word hook headline. Deterministic per-topic via SHA1
 * hash. Falls back to first 5 narration words if every template overflows.
 */
function buildHookHeadline(topic: string, narration: string): string {
  const cleanTopic = topic.replace(/\s+/g, ' ').trim();
  const firstSentence = (narration || '')
    .split(/[.!?]/)[0]
    .replace(/\s+/g, ' ')
    .trim();

  const HOOK_MAX = 42; // covers 3 lines × 14 chars
  if (cleanTopic.length > 0 && cleanTopic.length <= 28) {
    const hash = crypto.createHash('sha1').update(cleanTopic).digest();
    const idx = hash.readUInt32BE(0) % HOOK_TEMPLATES.length;
    const candidate = HOOK_TEMPLATES[idx]!(cleanTopic);
    if (candidate.length <= HOOK_MAX) return candidate;
  }
  const narrWords = firstSentence.split(' ').filter(Boolean);
  if (narrWords.length >= 3 && narrWords.length <= 6) return firstSentence;
  if (narrWords.length > 6) return narrWords.slice(0, 5).join(' ') + '…';
  return cleanTopic.length > 28 ? cleanTopic.slice(0, 25) + '…' : cleanTopic;
}

/**
 * Extracts a key caption phrase from a scene narration. Truncates at a
 * sentence/comma boundary ≤ 100 chars (word-bounded ellipsis fallback).
 * Replaces the previous brittle `narration.slice(0, 160)` which clipped
 * mid-word and floods the lower-third with too-long lines.
 */
function buildCaptionPhrase(narration: string): string {
  const cleaned = (narration || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  // Prefer first clause break (.,!?;) within 100 chars
  const m = cleaned.match(/^([^.!?;]{1,100})[.!?;]/);
  if (m) return m[1].trim();
  // Else word-bounded slice at 100 chars
  if (cleaned.length <= 100) return cleaned;
  const slice = cleaned.slice(0, 100);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 60 ? slice.slice(0, lastSpace) : slice).trim() + '…';
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
  const handle = process.env['CHANNEL_HANDLE'] ?? BRAND_AT;
  const safeHandle = escapeDrawtext(handle.replace(/[^A-Za-z0-9@_\- ]/g, ''));

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

  await execFileAsync(FFMPEG_BIN, [
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

/**
 * Generates per-scene narration via Edge-TTS, concatenates into a single
 * voice track, and returns the path + per-scene durations.
 *
 * Per-scene durations are returned so the orchestrator can resize each
 * scene's video to match its narration length (audio drives video timing).
 */
async function generateNarrationForScenes(
  sb: StockStoryboard,
  workDir: string,
  hookHeadline?: string,
): Promise<{ audioPath: string; sceneDurations: number[]; sceneWordTimestamps: Array<Array<{ word: string; startMs: number; endMs: number }> | undefined> }> {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const sceneAudioPaths: string[] = [];
  const sceneDurations: number[] = [];
  const sceneWordTimestamps: Array<Array<{ word: string; startMs: number; endMs: number }> | undefined> = [];

  for (let i = 0; i < sb.scenes.length; i++) {
    const scene = sb.scenes[i]!;
    // Scene 0 uses the on-screen hook headline as the spoken text so audio,
    // visual hook, and title all say the same 4-7 words. That keeps audio
    // duration inside the 3s HOOK_HARD_CAP and prevents the prior regression
    // where 5s of narration leaked over scene-1 visuals.
    const text = (
      i === 0 && hookHeadline ? hookHeadline : (scene.narration ?? '')
    ).trim();
    if (!text) {
      // Synthesize a 0.5s silent placeholder so concat math stays consistent.
      const silentPath = path.join(workDir, `voice-${i}.mp3`);
      await execFileAsync(FFMPEG_BIN, [
        '-y',
        '-f', 'lavfi',
        '-i', 'anullsrc=channel_layout=mono:sample_rate=24000',
        '-t', '0.5',
        '-c:a', 'libmp3lame', '-b:a', '128k',
        silentPath,
      ], { maxBuffer: 4 * 1024 * 1024 });
      sceneAudioPaths.push(silentPath);
      sceneDurations.push(0.5);
      sceneWordTimestamps.push(undefined);
      continue;
    }
    const outPath = path.join(workDir, `voice-${i}.mp3`);
    const rawPath = path.join(workDir, `voice-${i}-raw.mp3`);
    // Per-scene rate: hook scene (i=0) at +0% for emphasis/gravitas; body
    // scenes at +8% for density. Ret4 P1.
    const rate = i === 0 ? '+0%' : '+8%';
    const { durationSec: rawDur, wordTimestamps } = await ttsSynthesize({
      text,
      outPath: rawPath,
      rate,
      wantSubtitles: true,
    });
    sceneWordTimestamps.push(wordTimestamps);
    // Per-segment loudnorm so a quiet sentence next to a loud one doesn't
    // jump 4-6 LU after global normalisation. Single-pass loudnorm at
    // segment level is cheap and removes the within-video pump.
    await execFileAsync(FFMPEG_BIN, [
      '-y',
      '-i', rawPath,
      '-af', 'loudnorm=I=-16:LRA=11:tp=-1.5',
      '-ar', '48000',
      '-ac', '1',
      '-c:a', 'libmp3lame', '-b:a', '160k',
      outPath,
    ], { maxBuffer: 8 * 1024 * 1024 });
    sceneAudioPaths.push(outPath);
    sceneDurations.push(rawDur);
  }

  // Concat with ffmpeg concat demuxer (safe across mp3 segments — all are
  // now 48kHz mono libmp3lame after per-segment normalisation).
  const listFile = path.join(workDir, 'voice-list.txt');
  fs.writeFileSync(
    listFile,
    sceneAudioPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n') + '\n',
    'utf8',
  );
  const finalAudio = path.join(workDir, 'voice.mp3');
  await execFileAsync(FFMPEG_BIN, [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listFile,
    '-c:a', 'libmp3lame',
    '-b:a', '160k',
    finalAudio,
  ], { maxBuffer: 16 * 1024 * 1024 });

  return { audioPath: finalAudio, sceneDurations, sceneWordTimestamps };
}

/**
 * Renders a 1080×1920 portrait thumbnail PNG: source-frame at t=0.5s of the
 * final mp4 + dim overlay + giant hook headline + channel handle. ffmpeg
 * drawtext only — no Puppeteer, no Remotion, no headless Chrome — so this
 * runs deterministically in any CI environment.
 */
async function generateThumbnailPng(opts: {
  sourceVideoPath: string;
  hook: string;
  handle: string;
  outPath: string;
}): Promise<void> {
  const { sourceVideoPath, hook, handle, outPath } = opts;
  // Word-wrap the hook to ≤14 chars/line, max 3 lines, draw each line as
  // its own drawtext filter (newline-glyph workaround consistent with
  // composer.ts hook rendering).
  const words = hook.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) { cur = w; continue; }
    if ((cur + ' ' + w).length <= 14) cur += ' ' + w; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  const hookLines = lines.slice(0, 3);

  // Discover a font (Latin) for drawtext.
  const candidates = [
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  ];
  let fontfile = '';
  for (const c of candidates) {
    if (fs.existsSync(c)) { fontfile = `:fontfile='${c.replace(/'/g, "\\'")}'`; break; }
  }

  const FS = 110;
  const LH = 140;
  const totalH = hookLines.length * LH;
  const startY = 480 + Math.max(0, (560 - totalH) / 2);

  const filters: string[] = [
    'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
    // Dim middle band where the hook sits
    'drawbox=x=0:y=440:w=1080:h=640:color=black@0.65:t=fill',
  ];
  hookLines.forEach((line, idx) => {
    filters.push(
      `drawtext=text='${escapeDrawtext(line)}'${fontfile}:fontcolor=white:fontsize=${FS}:` +
      `borderw=8:bordercolor=black@0.95:` +
      `x=(w-text_w)/2:y=${Math.round(startY + idx * LH)}`
    );
  });
  // Channel handle bottom-right
  filters.push(
    `drawtext=text='${escapeDrawtext(handle)}'${fontfile}:fontcolor=#FFEB3B:fontsize=44:` +
    `borderw=4:bordercolor=black@0.95:x=w-text_w-40:y=h-text_h-160`
  );

  await execFileAsync(FFMPEG_BIN, [
    '-y',
    '-ss', '0.5',
    '-i', sourceVideoPath,
    '-frames:v', '1',
    '-vf', filters.join(','),
    outPath,
  ], { maxBuffer: 8 * 1024 * 1024 });
}
