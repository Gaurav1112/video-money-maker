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
import { generateShortMetadata, BRAND_AT, BRAND_HANDLE_RAW, BRAND_SITE, BRAND_TAGLINE_HINGLISH } from '../src/services/short-metadata.js';
import { getConceptDiagram } from '../src/stock/concept-diagram.js';
import { findTopicBankEntry } from '../src/data/topic-bank-loader.js';
import { rotateBankHook } from '../src/data/hook-rotator.js';
import { hookTextFor } from '../src/lib/thumbnail-text.js';
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

interface AudioLicenseEntry {
  path: string;
  role: string;
  source: string;
  author: string;
  license: string;
  pixabayId?: number;
}

/**
 * Read assets/audio/MANIFEST.json (Pixabay-vendored tracks) and surface
 * per-track license info for the pipeline's licenses.json. Only the
 * three roles actually composited into the render (bgm-primary,
 * hook-sting, end-card-uplift) are emitted; reserved/alt tracks stay
 * out of the public license bookkeeping until they're wired in.
 *
 * Returns [] if the manifest is missing or no in-use track is present
 * on disk so determinism on cold-cloned environments degrades gracefully.
 */
function collectVendoredAudioLicenses(): AudioLicenseEntry[] {
  const manifestPath = path.join(REPO_ROOT, 'assets', 'audio', 'MANIFEST.json');
  if (!fs.existsSync(manifestPath)) return [];
  const ACTIVE_ROLES = new Set(['bgm-primary', 'hook-sting', 'end-card-uplift']);
  try {
    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      license: string;
      tracks: Array<{
        path: string;
        role: string;
        source: string;
        author: string;
        pixabay_id?: number;
      }>;
    };
    return m.tracks
      .filter((t) => ACTIVE_ROLES.has(t.role))
      .filter((t) => fs.existsSync(path.join(REPO_ROOT, t.path)))
      .map((t) => ({
        path: t.path,
        role: t.role,
        source: t.source,
        author: t.author,
        license: m.license,
        ...(t.pixabay_id ? { pixabayId: t.pixabay_id } : {}),
      }));
  } catch {
    return [];
  }
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
  // Hard cap: hook ≤ 4s (Panel-11 Aud P0 — 3s mid-syllable cuts on Hindi),
  // body scenes ≤ 4s. Word-timestamps (if present) keep their relative
  // timing inside the clamp.
  // Panel-11 Eng P1-A (Brendan/Hashimoto) + Aud P0 (Kunal/Harkirat): the
  // static clamp HERE (pre-TTS) was still 3.0s while the TTS-path clamp
  // (~line 240) was already bumped to 4.0s. Pre-baked-audio storyboards
  // (test fixtures, manual production) hit only this clamp and lost the
  // tail of every Hindi hook. Unified to 4.0s here.
  const HOOK_MAX_FRAMES = Math.round(4 * fps);   // 4.0s — Aud P0
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

  // Panel-19 Retention P0-A (Bilyeu/Neistat/MrBeast/Edge): the synthetic
  // last scene (flat #0d2538 navy) creates a 7-10s motion-dead window
  // exactly at the algo's 50% completion checkpoint. Brightness pulse
  // (B23) was a temporary stim — the real fix is to never SHIP a
  // synthetic clip on the last scene. If pickForScene fell back for
  // the takeaway scene, recycle the first real clip from an earlier
  // body scene. Deterministic: same storyboard → same first-real-index
  // pick. Hooked here so the composer downstream sees a real clipPath
  // and the brightness-pulse gate (now keyed on tombstoneText, not
  // synthetic flag) stays consistent.
  if (clipPaths.length > 1) {
    const lastIdx = clipPaths.length - 1;
    if (clipPaths[lastIdx]?.startsWith('synthetic://')) {
      const realIdx = clipPaths.findIndex(
        (p, i) => i !== lastIdx && !p.startsWith('synthetic://')
      );
      if (realIdx >= 0) {
        console.log(
          `[orchestrator] last scene was synthetic — recycling clip from scene ${realIdx} for retention`
        );
        clipPaths[lastIdx] = clipPaths[realIdx]!;
      }
    }
  }

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

  // Topic-bank wire-up (Panel-8 Dist + Audience P0): the 110 curated
  // hookHinglish strings in src/data/topic-bank.json were previously
  // dead-code — the renderer always picked from generic templates. We
  // now look up by safeTopic-slug and, if found, route the curated
  // hook through TTS+title while keeping the visual hook short for the
  // 1080×1920 hook band.
  const bankEntry = findTopicBankEntry(slug);
  // Panel-10 Dist/Aud P0 (MrBeast/Casey/Striver/Apna): the raw bank
  // strings are 100% template-stamped — all 37 system-design hooks
  // read "Kal Amazon interview hai? Ye {name} mistake mat karna 🔥",
  // all 37 titles read "90% of Engineers Get {name} WRONG 😳". We
  // deterministically rotate each topic across a 5-template-per-
  // category pool keyed on slug-hash, killing shelf-fatigue without
  // a 110-row JSON rewrite. Original strings kept in the file as a
  // schema reference but ignored at runtime.
  const rotated = bankEntry ? rotateBankHook(bankEntry) : null;
  if (bankEntry && rotated) {
    console.log(`[orchestrator] topic-bank hit: ${slug} → rotated h/${rotated.hinglishIdx} t/${rotated.titleIdx}: "${rotated.hookHinglish}"`);
  }

  const hookHeadline = buildHookHeadline(
    storyboard.topic,
    storyboard.scenes[0]?.narration ?? '',
  );
  // hookSpoken: full Hinglish hook for TTS scene-0 audio.
  // hookVisual: scene-0 on-screen big text. Panel-10 Dist P0-A (MrBeast
  // regression fix): visual hook MUST match the thumbnail + YT title or
  // we ship a click-coherence break. Thumbnail/title both use rotated
  // shortTitle, so visual hook now also uses rotated shortTitle (English,
  // matches what the viewer just clicked). Audio stays Hinglish for ICP
  // authenticity — Indian dev audiences are bilingual; the EN visual +
  // Hinglish audio combo is normal for the niche (cf. Apna College,
  // Striver, 100xDevs).
  // Panel-17 Retention P0 (MrBeast/Bilyeu) + Distribution P0 (Blake/Schiffer):
  // B20 wired hookTextFor() into thumbnailHook only — leaving in-video
  // drawtext hook, YT title, and X-post text on the long shortTitle.
  // Result was a *click-coherence break*: viewer clicks "FAANG USES
  // KAFKA WHY", lands on "The Kafka Consumer Groups Mistake That Costs
  // Freshers..." in the first 1.5s. Panel-17 Retention regressed
  // 5.68→5.13 *because of this gap*. Compute punchyHook here (top of
  // hook-derivation block) so it can flow into hookVisual, the YT title
  // (via metadata input), AND the X-post text — same 4-word string
  // everywhere the viewer might see it.
  const punchyHook = hookTextFor(storyboard.topic);

  const hookSpoken: string = rotated?.hookHinglish || bankEntry?.hookHinglish?.trim() || hookHeadline;
  // Panel-17 Retention P0 (MrBeast): visualSource now prefers punchyHook
  // so the in-video drawtext at scene-0 matches what the thumbnail
  // promised. shortTitle survives as the secondary line / fallback.
  const visualSource: string = punchyHook
    || rotated?.shortTitle
    || bankEntry?.shortTitle?.trim()
    || hookSpoken;
  const hookVisual: string = (() => {
    const trimmed = visualSource.replace(/\s+/g, ' ').trim();
    if (trimmed.length <= 42) return trimmed;
    // Panel-10 Dist P1 (Casey): truncate from the END (preserve the punchy
    // start), not the middle. Word-boundary cut ≤39 chars + ellipsis.
    const cut = trimmed.slice(0, 40);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut.slice(0, 39)) + '…';
  })();

  // ── Auto-generate TTS narration if storyboard didn't ship a voice ────────
  if (!hasVoice && process.env['TTS_DISABLED'] !== '1') {
    try {
      const ttsResult = await generateNarrationForScenes(storyboard, workDir, hookSpoken);
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
      // Panel-10 Aud P0 (Kunal/Harkirat): 3.0s mid-syllable cuts on
      // Hindi sentences ("Kal Amazon interview hai? Ye…" needs ~3.7s
      // breath). Bumped to 4.0s — still well under the 5s pre-skip
      // window where YT measures hook attention.
      const HOOK_HARD_CAP = Math.round(4.0 * storyboard.fps);    // 4.0s — Aud P0
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

      // Panel-8 Eng P0 (Carmack): when summed scene narration exceeds
      // the cap budget, ffmpeg's `-shortest` silently truncates audio
      // at the end of the last visual frame — last-line voice loss is
      // the single biggest hidden defect in the pipeline (a viewer
      // hears "the answer is" and the video ends mid-sentence). Detect
      // here, then EXTEND the final scene to absorb the audio tail
      // plus a 1.5s end-card pad. Bounded by TOTAL_HARD_CAP so we never
      // ship > 60s. If we'd blow the cap, we fail loud — never ship a
      // half-narrated short.
      const totalAudioSec = ttsResult.sceneDurations.reduce((a, b) => a + (b ?? 0), 0);
      const totalVideoSec = runningTotal / storyboard.fps;
      const END_CARD_SEC = 2.0;
      const desiredVideoSec = totalAudioSec + END_CARD_SEC;
      if (desiredVideoSec > totalVideoSec + 0.05) {
        const totalCapSec = TOTAL_HARD_CAP / storyboard.fps;
        if (desiredVideoSec > totalCapSec + 0.05) {
          throw new Error(
            `[orchestrator] audio (${totalAudioSec.toFixed(2)}s) + end-card (${END_CARD_SEC}s) ` +
            `exceeds TOTAL_HARD_CAP (${totalCapSec.toFixed(1)}s). Author shorter narration ` +
            `or split into multiple shorts.`
          );
        }
        const lastIdx = storyboard.scenes.length - 1;
        const last = storyboard.scenes[lastIdx]!;
        const extraFrames = Math.ceil((desiredVideoSec - totalVideoSec) * storyboard.fps);
        const newLastFrames = last.durationFrames + extraFrames;
        storyboard.scenes[lastIdx] = { ...last, durationFrames: newLastFrames };
        console.log(
          `[orchestrator] extended last scene by ${extraFrames}f (` +
          `${(extraFrames / storyboard.fps).toFixed(2)}s) to fit ` +
          `audio ${totalAudioSec.toFixed(2)}s + end-card ${END_CARD_SEC}s`
        );
      }
    } catch (err) {
      // Panel-9 Eng P1 (Eich): silently shipping a muted video when
      // TTS fails is the worst-of-both-worlds outcome — broken upload
      // disguised as success. Allow the legacy "carry-on with silent
      // audio" behaviour ONLY when explicitly opted-in via the
      // ALLOW_SILENT_FALLBACK=1 env (test fixtures rely on it). In
      // production, hard-fail the render.
      if (process.env['ALLOW_SILENT_FALLBACK'] === '1') {
        console.warn(`[orchestrator] TTS failed (${String(err).slice(0, 160)}) — composing with silent audio (ALLOW_SILENT_FALLBACK=1)`);
      } else {
        throw new Error(
          `[orchestrator] TTS synthesis failed: ${String(err).slice(0, 240)}. ` +
          `Refusing to ship a muted video. Set ALLOW_SILENT_FALLBACK=1 to override (tests only).`
        );
      }
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
      const isLast = i === storyboard.scenes.length - 1;
      const isBody = !isHook && !isLast;
      // Diagram lives on body + closing scenes for cross-cut persistence.
      // Defined here at the top so downstream tombstone/midPromise can
      // make placement decisions that DEPEND on whether the diagram is
      // claiming the y=200..1060 region this scene.
      const wantsDiagram = isBody || isLast;
      // Hook scene: short, punchy 4-6 word hook in giant text.
      // Body scenes: narration sentence as caption strip — but only when
      // ASS karaoke captions are NOT active, otherwise we double-stack.
      const bigText = isHook
        ? hookVisual
        : undefined;
      const captionText = isHook
        ? undefined // hook text already dominates the upper third
        : hasAssCaptions
          ? undefined // Ret3 P1: ASS karaoke owns the caption layer
          : buildCaptionPhrase(scene.narration || '');
      // Panel-8 Dist P0: end-card loop hook. The Shorts recommender
      // reads loop-rate as a primary promotion signal in the cold-start
      // 48-hour window. We draw a final-1.5s overlay on the LAST scene
      // with a comment-bait + subscribe ask so every video closes with
      // an explicit replay/subscribe pull. Localised Hinglish to match
      // the @GuruSishya-India brand voice.
      // Panel-17 Retention P0 (Bilyeu): previous end-card line 2
      // ("Subscribe @GuruSishya-India — kal milte hain") was ~48 chars
      // at fontsize=64 → ~1728px against a 1080px canvas → BOTH edges
      // clipped. 🔥 emoji also rendered as a □ box because the vendored
      // DejaVu/NotoSans-Bold has no color-emoji glyphs. Fixed: split
      // into 3 short lines (each ≤22 chars), drop the emoji entirely
      // (Beato: ASCII-only renders crisp at any fontsize, on any font).
      // Panel-18 Retention P0 (Bilyeu): the prior end-card was a polite
      // farewell ("Drop a comment / Subscribe / kal milte hain") — zero
      // open loop, zero unresolved tension. Loop-rate is the #1 cold-
      // start promotion signal in the 48h window. Replaced line 1 with
      // a guilt/threat-avoidance question ("Tu ne ye galti ki?") that
      // plants an unanswered loop right before the cut, and line 3 with
      // a rewatch-pull ("Rewatch karo phir se") so the viewer has an
      // explicit reason to either replay or comment. Subscribe sits in
      // line 2 unchanged. All three lines remain ≤22 chars (no edge
      // clipping) and are ASCII-only (no emoji glyph fallback).
      // Panel-21 Distribution P0 + user-reported brand gap: previously
      // the end-card was Subscribe + rewatch-loop only — zero off-
      // platform funnel. Now bakes in the .in domain (a typeable URL
      // viewers can take off YT) and a concrete time-bound promise
      // ("Interview Ready in 21 Din") that anchors the value-prop
      // beyond the generic Subscribe CTA. Three lines, ≤22 chars each,
      // ASCII + standard Devanagari only (Lohit/Noto fonts pinned in
      // workflows for tofu-free rendering).
      const endCardText = isLast
        ? `${BRAND_TAGLINE_HINGLISH}\n${BRAND_SITE}\nSubscribe ${BRAND_AT}`
        : undefined;
      // Panel-17 Retention P0 (Bilyeu): the last scene is extended ~6
      // frames to fit voice tail + 2s end-card pad. Voice EOF lands at
      // ~t=12s but end-card doesn't fire until scene.durationSec - 2.0s
      // (~t=15.4s). The 3-5 second window in between rendered as dark
      // navy with no captions, no text — the algorithm's 50% completion
      // checkpoint falls right inside this dead zone. Tombstone bridges
      // the silence with a static "key takeaway" recap line so viewers
      // have something to read until the end-card lands.
      // Source: rotated.shortTitle ("The Kafka Consumer Groups Mistake")
      // is the descriptive sentence form already curated in topic-bank;
      // perfect for a recap tombstone. Truncate to ≤36 chars at last
      // word boundary so the 2-line wrap doesn't end mid-word.
      const tombstoneText = (() => {
        if (!isLast) return undefined;
        // Panel-21 follow-up (user-reported): on the closing scene the
        // tombstone band y=860-1060 collides with the concept-diagram's
        // consumer row y=880-960. The diagram IS the visual recap, so
        // when a diagram is rendered on the last scene we suppress the
        // tombstone — keeping ONE clean recap signal instead of two
        // overlapping ones. The tombstone path remains in place for
        // topics that ever ship without a diagram (currently every
        // topic resolves via the generic fallback, but the guard is
        // future-proof).
        if (wantsDiagram) return undefined;
        const raw = (rotated?.shortTitle || bankEntry?.shortTitle || '').trim();
        if (!raw) return undefined;
        if (raw.length <= 36) return raw;
        const trimmed = raw.slice(0, 36);
        const lastSpace = trimmed.lastIndexOf(' ');
        return lastSpace > 18 ? trimmed.slice(0, lastSpace) : trimmed;
      })();

      // Panel-20 Retention P0-A (Bilyeu/MrBeast): mid-point promise on
      // the BODY scene that straddles the algo's 50% completion
      // checkpoint with a stake reset that pushes viewers past the
      // "should I swipe?" decision. Topic-bank salaryBand
      // (₹35-55LPA / ₹40-65LPA) anchors the stake when available —
      // Edge's "salary anchor in audio/video" finding — otherwise
      // falls back to the generic curiosity-gap promise.
      // Panel-22 Carmack P1: previously fired on EVERY body scene
      // (`isBody` boolean). For a 4-scene storyboard scenes[1] AND
      // scenes[2] are both body, so two identical mid-promise overlays
      // landed on consecutive cuts — repeated banner, not a midpoint
      // mechanic. Now gated to the EXACT midpoint scene using a
      // floor(N/2) index so every storyboard length lands the
      // mid-promise on the true 50% checkpoint scene only.
      const midpointSceneIdx = Math.floor(storyboard.scenes.length / 2);
      const isMidpointScene = isBody && i === midpointSceneIdx;
      const midPromiseText = isMidpointScene
        ? (bankEntry?.salaryBand
            ? `Last 5 sec mein ${bankEntry.salaryBand} ka twist`
            : 'Ruko — last 5 sec mein twist hai')
        : undefined;

      // Panel-21 Retention P0 (user follow-up: "graphic should stay,
      // it is going away in 1 sec or 2"): render the diagram on the
      // BODY scene AND on the CLOSING scene so it persists across
      // the cut.
      // Panel-22 MrBeast/Beggs P0: body-scene `startT=0.4` was making
      // the diagram reveal stages compete with the mid-promise
      // drawer (t=0..1.8s). Spec at concept-diagram.ts:DiagramFilter-
      // Options says "pass startT=1.95" on body scenes carrying the
      // drawer; implementation now matches the spec — diagram begins
      // assembling at t=1.95s (just after the mid-promise window
      // closes), giving the 50% checkpoint defense its full saliency.
      // Closing-scene reveal stays INSTANT at t=0.05 (instant=true
      // skips paceStage) so the diagram appears already-built the
      // moment the cut lands. Panel-22 MrBeast P1: hideAfter floored
      // at 2.0s so the diagram is visible for ≥2.0s even when the
      // closing scene hits the PER_SCENE_HARD_CAP=3.5s ceiling
      // (eye-tracking minimum for a 4-stage architecture graph).
      const conceptDiagram = wantsDiagram
        ? getConceptDiagram(storyboard.topic, bankEntry?.shortTitle ?? rotated?.shortTitle)
        : undefined;
      const sceneSec = scene.durationFrames / storyboard.fps;
      // End-card window: Panel-22 Beggs P1 raised the floor from 2.0 →
      // 3.0s (3-line CTA at FS=64 needs ≥2.8-3.2s for click-through
      // reads on phone screens). Sync this constant with composer.ts
      // endCardStart calculation if either changes.
      const END_CARD_WINDOW = 3.0;
      const conceptDiagramOptions = isLast
        ? {
            startT: 0.05,
            // Diagram hides exactly when end-card claims the frame.
            // Math.max(2.0, ...) floor: even on a hard-capped 3.5s
            // closing scene the diagram gets at least 2.0s of visible
            // assembled time before the CTA takes over.
            hideAfter: Math.max(2.0, sceneSec - END_CARD_WINDOW),
            instant: true,
          }
        : isBody
          ? { startT: 1.95 }
          : undefined;

      // Brand subline appears on EVERY scene below the watermark
      // handle stack (drawn in composer scene-overlay path). Off-
      // platform funnel + value promise visible the entire ~17s.
      const brandSubline = `${BRAND_SITE} · ${BRAND_TAGLINE_HINGLISH}`;

      return {
        clipPath: clipPaths[i],
        durationSec: scene.durationFrames / storyboard.fps,
        sceneIndex: scene.sceneIndex,
        bigText,
        captionText,
        endCardText,
        tombstoneText,
        midPromiseText,
        conceptDiagram,
        conceptDiagramOptions,
        brandSubline,
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
  // Batch-18 Phase A: also list any vendored Pixabay audio assets that
  // were composited into this render (BGM bed + hook sting + end-card
  // uplift). Pixabay Content License is no-attribution, but surfacing
  // the source URLs in licenses.json keeps the audit trail clean and
  // matches the per-clip video license bookkeeping.
  const audioLicenses = collectVendoredAudioLicenses();
  const licensesPath = path.join(finalOutDir, 'licenses.json');
  fs.writeFileSync(
    licensesPath,
    JSON.stringify({ clips: licenses, audio: audioLicenses }, null, 2),
    'utf8',
  );
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
    siteTopicSlug: bankEntry?.siteTopicSlug ?? slug,
    hookHeadline,
    shortTitle: (() => {
      // Panel-17 Distribution P0 (Blake/Schiffer): YT title now leads
      // with the same 4-word punchyHook the thumbnail shows, then the
      // descriptive shortTitle, then `#Shorts` (appended downstream).
      // Result: shelf shows thumbnail "WHY FAANG RUNS KAFKA" stacked
      // directly above title "WHY FAANG RUNS KAFKA — Consumer Groups…"
      // — single coherent hook signal instead of two competing ones.
      // Title cap at 100 chars handled by generateShortMetadata.
      //
      // Panel-18 Distribution P1 (Blake): YT Shorts shelf truncates
      // mobile titles at ~50-60 visible chars. Prior behavior shipped
      // 100-char titles where the descriptive tail was invisible
      // without tapping ("WHY FAANG RUNS KAFKA — The Kafka Consumer
      // Groups Mistake That Costs Freshers Their First Of… #Shorts").
      // Cap the descriptive suffix to leave the resulting title at
      // ≤56 chars + " #Shorts" = 64 absolute, well within shelf
      // visibility. Truncate at last word boundary to avoid mid-word
      // cuts that read as low-production-value.
      const longTitle = (rotated?.shortTitle || bankEntry?.shortTitle || '').trim();
      if (!punchyHook) return longTitle || undefined;
      if (!longTitle) return punchyHook;
      // Avoid double-prefix when bank already starts with the punchyHook.
      if (longTitle.toUpperCase().startsWith(punchyHook.toUpperCase())) return longTitle;
      const SHELF_BUDGET = 56;
      const SEPARATOR = ' — ';
      const remaining = SHELF_BUDGET - punchyHook.length - SEPARATOR.length;
      let suffix = longTitle;
      if (suffix.length > remaining) {
        const trimmed = suffix.slice(0, Math.max(8, remaining));
        const lastSpace = trimmed.lastIndexOf(' ');
        suffix = lastSpace > 8 ? trimmed.slice(0, lastSpace) : trimmed;
      }
      return `${punchyHook}${SEPARATOR}${suffix}`;
    })(),
    salaryBand: bankEntry?.salaryBand,
    stake: bankEntry?.stake,
    hookHinglish: rotated?.hookHinglish || bankEntry?.hookHinglish,
    category: bankEntry?.category,
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
        // Panel-18 Distribution P1 (Mogilko): prior IG caption was a
        // verbatim copy of the YT title + first 6 lines of YT
        // description. IG feed shows the first 125 chars before the
        // "more" fold, and that window was burned on a YT-native
        // string with `#Shorts` (a non-IG hashtag) and raw URLs (which
        // are not clickable in IG captions). Result: zero hook value
        // on the IG surface. Native adaptation: open with the
        // hookHinglish if available (already curated for the brand
        // voice) → 1-line value → "Link in bio" CTA. Strip raw URLs
        // and the `#Shorts` tag. Result is a tight IG-native caption
        // that respects the 125-char fold and uses platform-correct
        // CTA conventions.
        caption: (() => {
          const igHook = (rotated?.hookHinglish || bankEntry?.hookHinglish || metadata.title)
            .replace(/\s*#\w+\s*/g, '')
            .trim();
          const igStake = bankEntry?.salaryBand
            ? `Yeh galti = ${bankEntry.salaryBand} offer cancel 🔥`
            : 'Yeh galti = FAANG offer cancel 🔥';
          const igCta = `Link in bio → free 80-Q FAANG sheet\n${BRAND_AT}`;
          return [igHook, '', igStake, '', igCta].join('\n').slice(0, 2200);
        })(),
        hashtags: metadata.tags
          .filter((t) => !/^shorts$/i.test(t))
          .slice(0, 30)
          .map((t) => `#${t}`)
          .join(' '),
      },
      x_post: {
        // Panel-17 Distribution P0 (Schiffer): use punchyHook (4-word
        // thumbnail copy) instead of hookHeadline so the X-post matches
        // what the click delivers. Was: ${hookHeadline} — the long
        // descriptive hook — which broke cross-platform coherence.
        text: `${punchyHook}\n\n${BRAND_AT} · ${metadata.tags.slice(0, 4).map((t) => `#${t}`).join(' ')}`.slice(0, 280),
      },
      linkedin: {
        title: metadata.title.replace(/\s*#\w+\s*/g, '').trim(),
        // Panel-21 Dist P1-1 + Panel-22 Torvalds P1: filter out lines
        // that read as a hashtag wall (tagRatio≥0.7) — same threshold
        // applied in seed-telegram.ts so the Telegram + LinkedIn
        // bodies derive from a consistent definition of "hashtag spam".
        // Pre-B28 the YT description had hashtags on line index 1;
        // post-B28 they live at the bottom — so this filter
        // preserves prose anywhere in the file regardless of position
        // (no positional slicing).
        body: (() => {
          const raw = metadata.description.replace(/utm_source=yt_shorts/g, 'utm_source=linkedin');
          const lines = raw.split('\n');
          // Strip any line that is purely hashtags (or hashtag-spam).
          const cleaned = lines.filter(line => {
            const trimmed = line.trim();
            if (!trimmed) return true;
            const tokens = trimmed.split(/\s+/);
            const tagRatio = tokens.filter(t => t.startsWith('#')).length / tokens.length;
            return tagRatio < 0.7;
          });
          return cleaned.slice(0, 7).join('\n').trim();
        })(),
      },
      telegram: {
        text: `🆕 ${metadata.title}\n\n${metadata.description.replace(/utm_source=yt_shorts/g, 'utm_source=telegram').split('\n').slice(0, 4).join('\n')}`,
      },
    }, null, 2),
    'utf8',
  );
  console.log(`[orchestrator] ✓ metadata: ${metadataPath}`);

  // 9. Generate thumbnail PNG: PROCEDURAL gradient backdrop with bold hook
  // typography. YT Shorts auto-picks frame 1 if no custom thumbnail is
  // provided — and frame 1 is rarely the most engaging visual. Panel-12
  // Dist P0 (MKBHD): we previously used the rendered video frame at
  // t=1.5s as the backdrop, which made the thumbnail look like a
  // landscape stock-footage screenshot — actively misleading on the
  // YT Shorts shelf where the click is the only signal we control.
  // Now we render a clean designed thumbnail entirely with ffmpeg
  // primitives (gradient + drawtext) so it stays deterministic, has
  // zero external assets, and clearly signals "tech short" not "stock
  // landscape". Category drives an accent gradient stop.
  const thumbnailPath = path.join(finalOutDir, 'thumbnail.png');
  // Panel-17 Retention/Distribution coherence: punchyHook is now computed
  // at the top of the hook-derivation block (line ~261). Same 4-word
  // string flows into in-video drawtext, YT title prefix, X-post text,
  // and thumbnail — so every surface a viewer sees carries the same
  // promise. Falls back to shortTitle if the topic doesn't match a
  // pattern bank (rare — covers all our CSE/FAANG categories).
  const thumbnailHook = punchyHook
    || rotated?.shortTitle
    || bankEntry?.shortTitle?.trim()
    || hookSpoken
    || hookHeadline;
  await generateThumbnailPng({
    hook: thumbnailHook,
    handle: process.env['CHANNEL_HANDLE'] ?? BRAND_AT,
    category: bankEntry?.category,
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

// Only run the orchestrator when this file is invoked directly (CLI),
// NOT when it is imported (e.g. by the thumbnail-render.test.ts smoke
// test which only needs the exported `generateThumbnailPng`).
const isDirectInvocation = (() => {
  try {
    const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
    const thisPath = fileURLToPath(import.meta.url);
    return invokedPath === thisPath;
  } catch {
    return false;
  }
})();
if (isDirectInvocation) {
  main().catch((err: unknown) => {
    console.error('[orchestrator] fatal:', err);
    process.exit(1);
  });
}

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
    // Panel-9 Eng P0 (Carmack): segment-level `loudnorm I=-16` followed
    // by the full-track `loudnorm I=-14` in muxFinal/mixBgmBed produces
    // measurable inter-segment pump on 2-3s clips (single-pass loudnorm
    // is unstable below the EBU R128 measurement gate). Switched to
    // `dynaudnorm` which smooths within-segment level variation without
    // engaging the full EBU normaliser — the I=-14 master pass at the
    // end is still the single source of truth for output loudness.
    await execFileAsync(FFMPEG_BIN, [
      '-y',
      '-i', rawPath,
      '-af', 'dynaudnorm=p=0.7:m=10:s=12',
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
 * Renders a 1080×1920 portrait thumbnail PNG: PROCEDURAL gradient
 * backdrop (no video frame — Panel-12 Dist P0) + giant hook headline +
 * channel handle + category accent stripe. ffmpeg drawtext + lavfi
 * color sources only — no Puppeteer, no Remotion, no headless Chrome —
 * so this runs deterministically in any CI environment.
 *
 * Category gradients are picked deterministically; defaults to a neutral
 * deep-blue → indigo for unknown/empty category. Each palette is tuned
 * for ≥4.5:1 WCAG contrast against pure white (#ffffff) hook text.
 */
export async function generateThumbnailPng(opts: {
  hook: string;
  handle: string;
  category?: string;
  outPath: string;
}): Promise<void> {
  const { hook, handle, category, outPath } = opts;
  // ─── Safe-zone-aware wrap + adaptive font-size ────────────────────────────
  // Panel-16 Dist P0 (Schiffer/Bilyeu): the prior `<=14 chars/line @ FS=165`
  // produced lines ~1340px wide on a 1080px canvas, clipping both edges
  // on long titles like "The Kafka Consumer Groups Mistake". CTR
  // collapsed to ~0.5% vs the 4-5% needed for first-cycle Shorts-shelf
  // expansion -- effectively a CTR kill that compounded the algorithm
  // trust ceiling.
  //
  // New contract: 90% safe-zone (972px max line width) at all times.
  // Strategy: cap chars/line at MAX_LINE_CHARS @ baseline FS; allow up
  // to 4 lines (was 3); if a single word exceeds MAX_LINE_CHARS, scale
  // the *effective* FS down proportionally so even an unbreakable
  // string fits inside the 90% safe-zone.
  //
  // Char-width estimate for Arial Bold sans-serif: width(px) ≈ 0.58 × FS.
  // At FS=140, a 11-char line ≈ 11 × 81.2 = 893px (under 972 target).
  const MAX_LINE_CHARS = 11;
  const BASELINE_FS = 140;
  const LH = 160;
  const MAX_LINES = 4;
  const SAFE_WIDTH_PX = 972; // 90% of 1080 canvas

  const words = hook.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) { cur = w; continue; }
    if ((cur + ' ' + w).length <= MAX_LINE_CHARS) cur += ' ' + w; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  const hookLines = lines.slice(0, MAX_LINES);

  // If the wrap produced a single word longer than MAX_LINE_CHARS (e.g.,
  // a topic with a 14-char canonical name like "elasticsearch"), shrink
  // the effective font size so it still fits in the safe zone.
  const widestChars = hookLines.length === 0 ? 1 : Math.max(...hookLines.map(l => l.length));
  const FS = widestChars > MAX_LINE_CHARS
    ? Math.floor(BASELINE_FS * MAX_LINE_CHARS / widestChars)
    : BASELINE_FS;

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

  // Panel-12 Dist P0: category-driven backdrop palette. Top color is the
  // saturated accent (signals topic at a glance on the shelf), bottom
  // color is the deep base (keeps hook copy readable). Verified ≥4.5:1
  // WCAG against #ffffff hook text (the dim band drops ratios further).
  const PALETTES: Record<string, { top: string; bottom: string; accent: string }> = {
    'system-design': { top: '0x1e3a8a', bottom: '0x0a0a23', accent: '0xfbbf24' }, // navy → near-black, amber accent
    'dsa':           { top: '0x065f46', bottom: '0x0f1a14', accent: '0xfde047' }, // emerald → near-black, yellow
    'behavioral':    { top: '0x7c2d12', bottom: '0x1a0a05', accent: '0xfde047' }, // burnt orange → near-black, yellow
    'db-internals':  { top: '0x4c1d95', bottom: '0x0d0a1f', accent: '0x60a5fa' }, // violet → near-black, sky-blue
  };
  const cat = (category ?? '').toLowerCase();
  const palette = PALETTES[cat] ?? { top: '0x1e3a8a', bottom: '0x0a0a23', accent: '0xfbbf24' };

  // Type sizing already computed safe-zone-aware FS above.
  const totalH = hookLines.length * LH;
  const startY = 460 + Math.max(0, (640 - totalH) / 2);

  // Procedural backdrop: blend two solid color sources with a vertical
  // alpha gradient via geq. This is fully deterministic and adds no
  // dependencies. We render the two colours at 1080×1920 then
  // alphablend top → bottom.
  const filters: string[] = [
    // Inputs are two color sources (declared in the cmdline below).
    // [0] = top, [1] = bottom. Build a vertical gradient by blending
    // [0] over [1] with a top-to-bottom alpha fade.
    '[0:v]format=rgba,geq=r=\'r(X,Y)\':g=\'g(X,Y)\':b=\'b(X,Y)\':a=\'255*(1-Y/H)\'[topa]',
    '[1:v][topa]overlay=0:0[bg]',
    // Bottom accent stripe (3% of canvas height = ~58px) — adds the
    // category accent color as a clear shelf-readable signal.
    '[bg]drawbox=x=0:y=1862:w=1080:h=58:color=' + paletteHexToColor(palette.accent) + ':t=fill[bg2]',
    // Dim middle band where the hook sits (less aggressive than before
    // since the backdrop is no longer photographic).
    '[bg2]drawbox=x=0:y=420:w=1080:h=720:color=black@0.45:t=fill[band]',
  ];
  let chain = '[band]';
  hookLines.forEach((line, idx) => {
    const next = `[t${idx}]`;
    filters.push(
      `${chain}drawtext=text='${escapeDrawtext(line)}'${fontfile}:fontcolor=white:fontsize=${FS}:` +
      `borderw=10:bordercolor=black@0.95:` +
      `x=(w-text_w)/2:y=${Math.round(startY + idx * LH)}${next}`
    );
    chain = next;
  });
  // Channel handle bottom-right (yellow accent). Panel-13 Eng P0 (Maeda):
  // y=h-text_h-160 collided with the YT Shorts subscribe-button overlay
  // zone — the button is rendered ~120-180px from the bottom on the
  // mobile shelf, so the handle was being either obscured or visually
  // double-stamped. Bumped to y=h-text_h-300 to clear the entire YT
  // UI overlay band (subscribe + scroll affordance + like/share row).
  filters.push(
    `${chain}drawtext=text='${escapeDrawtext(handle)}'${fontfile}:fontcolor=#FFEB3B:fontsize=64:` +
    `borderw=5:bordercolor=black@0.95:x=w-text_w-40:y=h-text_h-300[out]`
  );

  await execFileAsync(FFMPEG_BIN, [
    '-y',
    '-f', 'lavfi', '-i', `color=c=${palette.top}:s=1080x1920:d=1`,
    '-f', 'lavfi', '-i', `color=c=${palette.bottom}:s=1080x1920:d=1`,
    '-filter_complex', filters.join(';'),
    '-map', '[out]',
    '-frames:v', '1',
    outPath,
  ], { maxBuffer: 8 * 1024 * 1024 });
}

/**
 * Convert an ffmpeg `0xRRGGBB` color string to the `#RRGGBB` form
 * accepted by the drawbox `color=` parameter.
 */
function paletteHexToColor(hex0x: string): string {
  return '0x' + hex0x.replace(/^0x/, '');
}
