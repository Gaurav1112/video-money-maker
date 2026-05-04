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
import { join, dirname, resolve as pathResolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { FFMPEG_BIN, FFPROBE_BIN } from '../lib/ffmpeg-bin.js';

const execFileP = promisify(execFile);

// ─── Vendored audio assets ──────────────────────────────────────────────────
// Pixabay Content License (commercial-use, no-attribution). Vendored at
// repo root so byte-determinism is preserved -- no runtime download, no
// network. Resolved package-root-relative (NOT cwd-relative) so any
// invocation site picks up the same bytes; absent paths fall back to
// the procedural synthesis path in mixBgmBed.
// Manifest: assets/audio/MANIFEST.json (license + per-file source URL).
// (Batch-18 Phase A.)
const PACKAGE_ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const VENDORED_BGM_PATH = pathResolve(PACKAGE_ROOT, 'assets/audio/bgm/tense-suspense.mp3');
const VENDORED_HOOK_STING_PATH = pathResolve(PACKAGE_ROOT, 'assets/audio/sfx/hook-sting.mp3');
const VENDORED_END_CARD_SFX_PATH = pathResolve(PACKAGE_ROOT, 'assets/audio/sfx/end-card-uplift.mp3');

// Panel-16 Eng E2 Hejlsberg: end-card SFX offset was a duplicated magic
// literal (1.6) used by both the SFX delay computation and the totalDur
// extension. Naming it makes the relationship explicit and prevents
// silent drift if one is changed without the other.
const END_CARD_OFFSET_S = 1.6;

// Panel-16 Eng E2 Hejlsberg: discoverVendoredAudio was called twice per
// render (once from compose, once from the metadata writer downstream).
// Each call hit existsSync three times. Memoise — paths are package-root
// constants, the answer cannot change within a process lifetime.
type VendoredAudioPaths = {
  bgm: string | undefined;
  hookSting: string | undefined;
  endCardSfx: string | undefined;
};
let vendoredAudioCache: VendoredAudioPaths | null = null;
function discoverVendoredAudio(): VendoredAudioPaths {
  if (vendoredAudioCache) return vendoredAudioCache;
  vendoredAudioCache = {
    bgm: existsSync(VENDORED_BGM_PATH) ? VENDORED_BGM_PATH : undefined,
    hookSting: existsSync(VENDORED_HOOK_STING_PATH) ? VENDORED_HOOK_STING_PATH : undefined,
    endCardSfx: existsSync(VENDORED_END_CARD_SFX_PATH) ? VENDORED_END_CARD_SFX_PATH : undefined,
  };
  return vendoredAudioCache;
}


// Memoised filter-availability probes. Some ffmpeg builds (e.g. macOS
// homebrew default) ship without libass; we skip captions gracefully
// rather than failing the whole render.
//
// Panel-16 Eng E3 Linus: the previous implementation shelled out to
// `ffmpeg -hide_banner -filters` TWICE per render (once for `ass`, once
// for `drawtext`) — same command, parsed for different rows. Collapsed
// to a single shared list-fetch that both probes consume.
let availableFiltersCache: Set<string> | null = null;
async function getAvailableFilters(): Promise<Set<string>> {
  if (availableFiltersCache) return availableFiltersCache;
  const set = new Set<string>();
  try {
    const { stdout } = await execFileP(FFMPEG_BIN, ['-hide_banner', '-filters'], {
      maxBuffer: 4 * 1024 * 1024,
    });
    // Each row of `-filters` output looks like ` T.. ass    Render text…`
    // — the filter name is the second whitespace-separated column.
    for (const line of stdout.split('\n')) {
      const m = line.match(/^\s*\S+\s+(\S+)\s/);
      if (m) set.add(m[1]);
    }
  } catch {
    // leave set empty — both probes return false
  }
  availableFiltersCache = set;
  return availableFiltersCache;
}

async function isAssFilterAvailable(): Promise<boolean> {
  return (await getAvailableFilters()).has('ass');
}

async function isDrawtextAvailable(): Promise<boolean> {
  return (await getAvailableFilters()).has('drawtext');
}

// ─── Types ────────────────────────────────────────────────────────────────────

// Memoised font-file discovery. Tried in order; first existing file wins.
// Keeps drawtext overlays working on macOS dev + Ubuntu CI without
// fontconfig drama.
//
// We discover TWO fonts: a primary Latin font and a Devanagari fallback.
// drawtext can fall back to the secondary via fontconfig pattern matching,
// but on minimal Ubuntu runners fontconfig may be empty — so we prefer an
// explicit fontfile that already includes Devanagari coverage. Noto Sans
// is the gold standard (covers Latin + Devanagari + ~all scripts); when
// not available we fall back to DejaVu (Latin) + Lohit (Devanagari) or
// just DejaVu alone (Devanagari renders as tofu — better than crashing).
let fontFileCache: string | null | undefined = undefined;
let devanagariFontCache: string | null | undefined = undefined;

async function discoverFontFile(): Promise<string | null> {
  if (fontFileCache !== undefined) return fontFileCache;
  const fs = await import('node:fs');
  const candidates = [
    // Prefer fonts with Latin+Devanagari coverage so Hindi text doesn't tofu.
    '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',           // Ubuntu noto
    '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
    '/Library/Fonts/NotoSans-Bold.ttf',                           // macOS user-installed
    '/System/Library/Fonts/Supplemental/Devanagari MT Bold.ttf',  // macOS Devanagari MT
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',          // macOS fallback
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/System/Library/Fonts/HelveticaNeue.ttc',
    '/System/Library/Fonts/Helvetica.ttc',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',       // Ubuntu/Debian
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',                // Fedora
    '/usr/share/fonts/dejavu-sans-fonts/DejaVuSans-Bold.ttf',
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        fontFileCache = c;
        return c;
      }
    } catch { /* ignore */ }
  }
  fontFileCache = null;
  return null;
}

/**
 * Discovers a Devanagari-capable font for Hindi/Hinglish narration overlays.
 * Returns null when none found; caller should fall back to Latin font (text
 * will render as tofu — caller is expected to detect Devanagari and route
 * through this font when available).
 */
async function discoverDevanagariFont(): Promise<string | null> {
  if (devanagariFontCache !== undefined) return devanagariFontCache;
  const fs = await import('node:fs');
  const candidates = [
    '/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf',
    '/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf',
    '/usr/share/fonts/truetype/lohit-devanagari/Lohit-Devanagari.ttf',
    '/Library/Fonts/NotoSansDevanagari-Bold.ttf',
    '/System/Library/Fonts/Supplemental/Devanagari MT Bold.ttf',
    '/System/Library/Fonts/Supplemental/Devanagari Sangam MN.ttc',
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        devanagariFontCache = c;
        return c;
      }
    } catch { /* ignore */ }
  }
  devanagariFontCache = null;
  return null;
}

const DEVANAGARI_RE = /[\u0900-\u097F]/;

/**
 * Escapes a single text line for ffmpeg drawtext `text='...'` arg.
 * Covers the FFmpeg drawtext filter's special characters AND the filter-
 * graph delimiters (`,`, `;`, `[`, `]`) which would otherwise terminate
 * the filter chain mid-string and crash the render. Eng2/3 P0.
 */
export function escapeDrawtext(line: string): string {
  return line
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

/**
 * Wraps `text` to lines of at most `maxChars` chars (whitespace-aware).
 * Returns the wrapped string with REAL newline characters — caller is
 * expected to write to a textfile and pass via drawtext `textfile=` (the
 * `text=` syntax requires unwieldy double-escape for newlines).
 */
function wrapText(text: string, maxChars: number): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur.length === 0) {
      cur = w;
    } else if ((cur + ' ' + w).length <= maxChars) {
      cur += ' ' + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.join('\n');
}

export interface SceneInput {
  clipPath: string;
  durationSec: number;
  sceneIndex: number;
  /** Big hook/narration text burned-in (upper-third). If omitted, no overlay. */
  bigText?: string;
  /** Caption strip (lower-third). Smaller, multi-line, scene narration. */
  captionText?: string;
  /**
   * Loop-CTA text drawn ONLY during the final 1.5 s of this scene
   * (Panel-8 Dist P0 — Shorts feed promotion is gated on loop-rate;
   * shipping with no closing argument flatlines algorithmic reach).
   * Newlines split into lines on screen. Typically set on the last
   * scene only.
   */
  endCardText?: string;
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
  /**
   * When true, mixes a procedurally-synthesised soft ambient pad under
   * the voice track with sidechain ducking (≈‑22 dB under speech,
   * ‑12 dB in voiceless gaps). Generated deterministically inside the
   * mux step — no external asset needed.
   */
  enableBgm?: boolean;
  /**
   * When provided, use this audio file as the BGM bed instead of the
   * procedural pad. Must be ≥ video length (will be looped & trimmed).
   */
  bgmPath?: string;
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

  // Ret2 P1 (panel-7): alternating zoompan direction by scene index
  // doubles perceived motion variety vs a single zoom-in across all
  // scenes. Velocity is now COMPUTED from durFrames so both lanes
  // (zoom-in and zoom-out) resolve to exactly the symmetric endpoints
  // regardless of cap changes — Panel-9 Ret P1 (McKinnon): the
  // hardcoded 0.0016/frame zoom-in left scenes ending at 1.14×–1.17×
  // (asymmetric with the zoom-out lane that nails 1.00× exactly).
  let zoompanFilter = '';
  if (enableZoompan) {
    // Panel-13 Ret P0 (McKinnon): zoompan defaults x=0:y=0 (top-left),
    // which on portrait stock with faces near vertical center causes
    // the "ken burns" to walk the visible window towards the
    // top-left corner — the subject drifts off-frame as the zoom
    // progresses. Anchoring x/y at the geometric center keeps the
    // focal subject locked while the zoom breathes around it.
    const center = `:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`;
    if (scene.sceneIndex % 2 === 0) {
      // Zoom in: 1.00 → 1.20 over the scene
      const zoomInVel = (0.20 / durFrames).toFixed(6);
      zoompanFilter = `zoompan=z='1+${zoomInVel}*on'${center}:d=${durFrames}:s=1080x1920:fps=${FPS}`;
    } else {
      // Panel-8 Ret P1 (McKinnon): previous hardcoded 0.00133 never
      // resolved to 1.00× at end of scene — at 105 frames (3.5s × 30)
      // the math left zoom at 1.06×, breaking the in/out symmetry.
      // Compute the velocity from durFrames so the ramp ALWAYS ends
      // exactly at 1.00× regardless of cap changes.
      const zoomOutVel = (0.20 / durFrames).toFixed(6);
      zoompanFilter = `zoompan=z='max(1,1.20-${zoomOutVel}*on)'${center}:d=${durFrames}:s=1080x1920:fps=${FPS}`;
    }
  }
  // Panel-10 Ret P1 (McKinnon): saturation=1.06/contrast=1.04 was
  // sub-perceptual on AMOLED panels. Bumped to saturation=1.10 and
  // contrast=1.08 for visible house-look without crushing skin tones.
  const colorGrade = ',eq=saturation=1.10:contrast=1.08';
  const baseScale = enableZoompan
    ? `scale=-2:1920,crop=1080:1920,${zoompanFilter}${colorGrade}`
    : `scale=-2:1920,crop=1080:1920${colorGrade}`;
  const filters: string[] = [`${baseScale},fps=${FPS},setpts=PTS-STARTPTS`];

  // Panel-8 Ret P0 (Schiffer): pattern-interrupt brightness flash on
  // every 3rd body scene (sceneIndex 3, 6, 9 …). 80ms at +0.20
  // brightness creates a frame-accurate cut signal that resets the
  // viewer's foveal attention — the same trick TikTok/Reels editors
  // use mid-clip to defeat doom-scroll fatigue. Skipped for the hook
  // (sceneIndex 0) and scene-1/scene-2 to keep the open clean.
  // Panel-10 Ret P0 (Stuart Edge): 80ms ≈ 2.4 frames at 30fps — below
  // the perceptual threshold for a pattern interrupt. Bumped to 167ms
  // (5 frames) at +0.30 brightness so the flash is consciously
  // detectable but still reads as a "cut feel" not a defect.
  // Panel-14 Ret P0 (Edge): previous gate `>= 3 && % 3 === 0` was dead
  // code for the standard 3-scene storyboard (sceneIndex maxes at 2).
  // Fire on every odd scene from 1 onward — that's scene 1 (mid-video)
  // for 3-scene stories, scenes 1+3 for 4+, etc. Hook (scene 0) and
  // closing scene of an odd-count story stay flash-free.
  if (scene.sceneIndex >= 1 && scene.sceneIndex % 2 === 1) {
    filters.push(`eq=brightness=0.30:enable='lt(t,0.167)'`);
  }

  const hasOverlay = !!(scene.bigText || scene.captionText || scene.endCardText);
  const drawtextAvailable = hasOverlay ? await isDrawtextAvailable() : false;

  if (hasOverlay && drawtextAvailable) {
    const fontFile = await discoverFontFile();
    const devFontFile = await discoverDevanagariFont();
    const fontArg = fontFile ? `:fontfile='${fontFile}'` : '';
    // Picks the right font for a given line: Devanagari script triggers the
    // dedicated CJK/Indic font; otherwise the Latin Bold fallback. Caller
    // expected to pass `null` to mean "use Latin".
    const fontArgFor = (line: string): string => {
      if (DEVANAGARI_RE.test(line) && devFontFile) {
        return `:fontfile='${devFontFile}'`;
      }
      return fontArg;
    };

    // ── Big hook text in upper-third ──────────────────────────────────────
    // Safe zone: y=220 → 1570 (Subscribe button overlaps y<220, like-strip
    // overlaps y>1570 on the 1080×1920 portrait canvas). Hook band starts
    // at y=240 to clear the Subscribe overlap, height 480 ⇒ ends at 720.
    if (scene.bigText) {
      filters.push('drawbox=x=0:y=240:w=1080:h=480:color=black@0.55:t=fill');
      // Panel-10 Ret P0 (Linus): wrap=14 fragments natural 2-word phrases
      // ("Round / Robin", "Consumer / Groups"). Widened to 18 — still
      // fits 1080-wide hook band at FS=92 with safe-zone margins.
      const hookLines = wrapText(scene.bigText, 18).split('\n').slice(0, 3);
      const FS = 92;
      const LH = 120;
      const totalH = hookLines.length * LH;
      const startY = 260 + Math.max(0, (440 - totalH) / 2);
      hookLines.forEach((line, idx) => {
        const escaped = escapeDrawtext(line);
        filters.push(
          `drawtext=text='${escaped}'${fontArgFor(line)}:fontcolor=white:fontsize=${FS}:` +
          `borderw=6:bordercolor=black@0.95:` +
          `x=(w-text_w)/2:y=${Math.round(startY + idx * LH)}`
        );
      });
    }

    // ── Caption strip in mid-lower band ───────────────────────────────────
    // Band: y=1080 → 1540 (well above the 1570 like-strip safe zone).
    // 5 lines @ LH=76 = 380 px; 4 lines = 304 px — both fit comfortably.
    if (scene.captionText) {
      filters.push('drawbox=x=0:y=1080:w=1080:h=460:color=black@0.55:t=fill');
      const capLines = wrapText(scene.captionText, 22).split('\n').slice(0, 5);
      const FS = 56;
      const LH = 76;
      const totalH = capLines.length * LH;
      const startY = 1100 + Math.max(0, (420 - totalH) / 2);
      capLines.forEach((line, idx) => {
        const escaped = escapeDrawtext(line);
        filters.push(
          `drawtext=text='${escaped}'${fontArgFor(line)}:fontcolor=#FFEB3B:fontsize=${FS}:` +
          `borderw=4:bordercolor=black@0.95:` +
          `x=(w-text_w)/2:y=${Math.round(startY + idx * LH)}`
        );
      });
    }

    // ── End-card loop CTA (last 1.5s of last scene only) ──────────────────
    // Panel-8 Dist P0 (Roberto Blake): Shorts feed promotion is gated
    // on loop-rate in the first 48-hour cold-start window. We draw a
    // black-band overlay with the comment-bait + subscribe pull during
    // the final 1.5s — explicit replay/subscribe ask without losing
    // the underlying B-roll. enable= timing is scoped to this scene's
    // local timestamp (relative to scene start, not absolute).
    if (scene.endCardText) {
      // Panel-10 Ret P1 (Edge): 1.5s is too short for a 3-line CTA read
      // (eye-track studies put 3-line readability floor at 1.8-2.0s).
      // Extended to 2.0s so the viewer has time to actually parse the
      // ask before the loop bumps them back to scene-0.
      const endCardStart = Math.max(0, scene.durationSec - 2.0);
      const endCardEnable = `enable='gte(t,${endCardStart.toFixed(3)})'`;
      // Panel-9 Ret/Dist P1 (MKBHD/Schiffer): drawbox at y=760+400 ended
      // at 1160, overlapping the ASS caption band 1080-1540 by 80 px on
      // the last scene. Lifted to y=680 + h=400 ⇒ ends at 1080 — sits
      // exactly above the caption band with zero overlap.
      filters.push(
        `drawbox=x=0:y=680:w=1080:h=400:color=black@0.78:t=fill:${endCardEnable}`
      );
      const ecLines = scene.endCardText.split('\n').slice(0, 3);
      const FS = 64;
      const LH = 96;
      const totalH = ecLines.length * LH;
      const startY = 720 + Math.max(0, (340 - totalH) / 2);
      // 400ms fade-in on the text alpha so the end-card lands as a
      // designed reveal, not a pop-in artifact (Panel-9 Dist P1 MKBHD).
      // alpha expression: 0 before endCardStart, ramps 0→1 over 0.4s,
      // capped at 1. drawbox stays static (a fading background pad
      // looks like a flicker; the text fade alone is enough).
      const fadeAlpha = `alpha='if(lt(t,${endCardStart.toFixed(3)}),0,min((t-${endCardStart.toFixed(3)})/0.4,1))'`;
      ecLines.forEach((line, idx) => {
        const escaped = escapeDrawtext(line);
        filters.push(
          `drawtext=text='${escaped}'${fontArgFor(line)}:fontcolor=#FFEB3B:fontsize=${FS}:` +
          `borderw=5:bordercolor=black@0.95:${fadeAlpha}:` +
          `x=(w-text_w)/2:y=${Math.round(startY + idx * LH)}:${endCardEnable}`
        );
      });
    }
  } else if (hasOverlay && !drawtextAvailable) {
    console.warn('[composer] ffmpeg lacks drawtext — skipping text overlays');
  }

  const filterChain = filters.join(',');

  if (isSynthetic) {
    await runFfmpeg([
      '-f', 'lavfi',
      '-i', `color=c=#0d2538:s=1080x1920:r=${FPS}`,
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

  // If no real voice, generate silent audio of same duration. Use a
  // .m4a container instead of raw .aac (ADTS) — ffmpeg-static decodes
  // ADTS audio through some mux paths as 0-length, dropping the audio
  // stream entirely from the final output. .m4a (ISO/MP4) round-trips
  // cleanly.
  let audioPath: string;
  if (hasVoice) {
    audioPath = input.voicePath!;
  } else {
    audioPath = join(workDir, 'silence.m4a');
    await runFfmpeg([
      '-f', 'lavfi',
      '-i', `anullsrc=channel_layout=stereo:sample_rate=44100`,
      '-t', `${totalDur}`,
      '-c:a', 'aac',
      '-b:a', '128k',
      audioPath,
    ]);
  }

  // ── BGM bed + sidechain ducking ─────────────────────────────────────────
  // Retention panel highest-leverage P0 (Ret4): voiceover-only audio reads
  // as "AI slop" to YT viewers. A soft ambient pad mixed under the VO with
  // sidechain ducking keyed to speech transforms the perceived production
  // value. We synthesise the pad procedurally (3 detuned sine carriers
  // through a low-pass + tremolo) so the pipeline ships zero binary
  // assets while staying byte-deterministic.
  if ((input.enableBgm || input.bgmPath) && hasVoice) {
    // Panel-13 Ret P0 (Huang): per-scene-transition whoosh SFX. Compute
    // each scene's start time (cumulative durations, excluding scene 0)
    // and pass to the BGM mix step which adds them as procedural
    // aevalsrc impulses. Skips boundaries that fall after totalDur to
    // be safe against last-scene-extension drift.
    const boundaries: number[] = [];
    let cum = 0;
    for (let i = 0; i < input.scenes.length; i++) {
      const dur = input.scenes[i]!.durationSec;
      // Panel-14 Eng P1 (Brendan): NaN/Infinity in any scene's
      // durationSec must not poison cum for subsequent scenes (NaN
      // propagates through addition, comparisons all return false).
      // Panel-15 Eng P1 (Eich) doc-fix: previous comment claimed
      // "fall back to no-whoosh for the run" — actual behaviour is
      // skip that scene's duration contribution AND skip pushing its
      // boundary, then continue. Downstream boundaries are computed
      // off the partial cum, so a corrupt scene-1 dur leaves scenes
      // 2..N's whooshes shifted earlier by the missing dur. Strictly
      // better than NaN injection into aevalsrc, but not "no whoosh".
      if (!Number.isFinite(dur) || dur <= 0) continue;
      cum += dur;
      if (i < input.scenes.length - 1 && cum > 0.05 && cum < totalDur - 0.20) {
        boundaries.push(cum);
      }
    }
    // Batch-18 Phase A: discover vendored Pixabay assets and let them
    // override the procedural BGM/hook-sting branches. Discovery is
    // cwd-relative; absent paths fall back to procedural synthesis so
    // tests / out-of-tree invocations still work.
    const vendored = discoverVendoredAudio();
    const effectiveBgmPath = input.bgmPath ?? vendored.bgm;
    audioPath = await mixBgmBed(
      audioPath,
      effectiveBgmPath,
      totalDur,
      workDir,
      boundaries,
      vendored.hookSting,
      vendored.endCardSfx,
    );
  }

  // Panel-9 Eng P0 (Carmack): when the renderer extends the last scene
  // to absorb audio + an end-card pad, the audio track is shorter than
  // the video. With `-shortest` below this would drop the trailing
  // pad — making the end-card invisible. Pad audio with silence to
  // match video duration so `-shortest` becomes harmless.
  const audioDur = await probeDuration(audioPath);
  if (audioDur + 0.05 < totalDur) {
    const padded = join(workDir, 'audio-padded.m4a');
    const padSec = (totalDur - audioDur).toFixed(3);
    await runFfmpeg([
      '-i', audioPath,
      '-af', `apad=pad_dur=${padSec}`,
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      padded,
    ]);
    audioPath = padded;
  }

  const args: string[] = [];

  // Build video filter for watermark + captions
  let vf = '';
  if (hasCaptions) {
    vf = `ass=${input.captionsPath!.replace(/\\/g, '/')}`;
  }

  if (hasWatermark) {
    args.push('-i', bodyPath, '-i', audioPath, '-i', input.watermarkPath!);
    // Watermark anchored bottom-right with safe-zone insets:
    //   x = W - w - 30  (30 px from right edge)
    //   y = H - h - 200 (above the YT Shorts bottom UI strip 1570→1920)
    // Spec: bottom-right per ComposeInput.watermarkPath JSDoc — do not move
    // to top-left, that collides with the hook headline at y=240.
    // Watermark sits bottom-right ABOVE the YT Shorts UI strip. The like/
    // comment/share/subscribe column starts at y≈1570 on a 1920-tall canvas
    // (220 px UI strip). H-h-200 placed it at y≈1720 — INSIDE the UI strip,
    // collision per Eng2 audit. Push it to H-h-380 so its bottom edge sits
    // at y≈1540, fully above the safe-zone boundary.
    const overlayFilter = `${vf ? `[0:v]${vf}[captioned];[captioned]` : '[0:v]'}[2:v]overlay=W-w-30:H-h-380[outv]`;
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
    // Closed GOP: required by YouTube ingest for frame-accurate seek; the
    // per-scene encodes already set these but the final mux re-encodes the
    // concatenated body so we must re-assert.
    '-g', '30',
    '-keyint_min', '30',
    '-sc_threshold', '0',
    '-color_primaries', 'bt709',
    '-color_trc', 'bt709',
    '-colorspace', 'bt709',
    '-color_range', 'tv',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ar', '48000',
    // Stereo upmix from mono — mono AAC plays narrow on earphones; YT does
    // not auto-upmix, so we explicitly duplicate mono → L/R channels.
    '-ac', '2',
  );
  // loudnorm crashes ffmpeg's aac encoder on near-silent input (NaN/Inf
  // averages). Only apply when we have a real voice track. LRA=11 is the
  // sweet spot for narrative speech (LRA=7 sounds compressed).
  // When BGM ducking is active, loudnorm has already been applied to the
  // pre-mixed voice+bgm track — do NOT re-apply (Eng3 P1: double-loudnorm
  // pumps).
  // Panel-13 Ret P1 (Huang): tp=-1.5 was loose vs the YT platform spec
  // of tp=-1.0 dBTP. Tightened to -1.0 across all three loudnorm
  // sites (no-BGM, BGM-file, BGM-procedural) for consistent inter-
  // sample peak compliance.
  const bgmActive = (input.enableBgm || !!input.bgmPath) && hasVoice;
  if (hasVoice && !bgmActive) {
    args.push('-af', 'loudnorm=I=-14:LRA=11:tp=-1.0');
  }
  args.push(
    '-shortest',
    '-movflags', '+faststart',
    input.outputPath,
  );

  await runFfmpeg(args);
}

/**
 * Generates a procedural ambient pad and ducks it under the voice with
 * a sidechain compressor. Returns the path to a pre-mixed `voice+bgm`
 * stereo m4a that can be plugged into the final mux as a single audio
 * input — keeping the existing video filter graph unchanged.
 *
 * Pad recipe (deterministic, no external assets):
 *   • 3 detuned sine carriers @ 196 / 261.6 / 329.6 Hz (G3 / C4 / E4 — Cmaj triad)
 *   • mixed at low gain (0.04 / 0.035 / 0.03)
 *   • low-pass @ 700 Hz to soften
 *   • slow tremolo (0.25 Hz × 0.10 depth) for life
 *   • dual-channel duplication for stereo
 *   • final pad gain ‑26 dB before duck, ‑40 dB during speech (8:1 ratio)
 *
 * Panel-13 Ret P0 (Huang): per-scene-transition whoosh SFX. When
 * `sceneBoundariesSec` is non-empty we synthesise a brief
 * frequency-sweep + exponential-decay impulse at each boundary
 * (180ms each). This is the same pattern-interrupt every
 * MrBeast/Reels/TikTok cut uses to defeat doom-scroll fatigue.
 * Procedural so it stays deterministic and adds no binary assets.
 */
/**
 * Whoosh chirp coefficient k. Symbolic derivation kept inline so the
 * audio-math invariant (sweep f0 -> f1 over duration D) is auditable
 * without grepping the comment. sin(2*PI*(f0 + k*Δ)*Δ) has phase
 * derivative 2*PI*(f0 + 2*k*Δ); instantaneous freq f0 + 2*k*Δ.
 * Solving f0 + 2*k*D = f1 for k yields (f1 - f0) / (2*D).
 *   f0 = 1200 Hz, f1 = 7200 Hz, D = 0.180 s
 *   k = (7200 - 1200) / (2 * 0.180) = 16666.6666...
 * Keep the symbolic form so any future tuning of f0/f1/D updates the
 * coefficient by recomputation, not by guessing a magic literal.
 * (Panel-15 Eng P1 Hejlsberg.)
 */
export const WHOOSH_F0_HZ = 1200;
export const WHOOSH_F1_HZ = 7200;
export const WHOOSH_DUR_S = 0.180;
export const WHOOSH_K = (WHOOSH_F1_HZ - WHOOSH_F0_HZ) / (2 * WHOOSH_DUR_S);

export function buildWhooshExpr(boundariesSec: number[], totalDur: number): string {
  if (!boundariesSec.length) return '';
  // Each whoosh: WHOOSH_DUR_S exponentially-decaying frequency sweep
  // from WHOOSH_F0_HZ to WHOOSH_F1_HZ, amplitude 0.30, gated by
  // gte(t,T) * lt(t-T,WHOOSH_DUR_S). Sum of all boundary impulses.
  const k = WHOOSH_K.toFixed(3);
  const dur = WHOOSH_DUR_S.toFixed(3);
  const f0 = WHOOSH_F0_HZ.toFixed(0);
  const terms = boundariesSec.map((t) => {
    const T = t.toFixed(3);
    return `gte(t\\,${T})*lt(t-${T}\\,${dur})*0.30*exp(-7*(t-${T}))*sin(2*PI*(${f0}+${k}*(t-${T}))*(t-${T}))`;
  });
  const expr = terms.join('+');
  return `aevalsrc='${expr}':s=44100:d=${totalDur.toFixed(3)}`;
}

async function mixBgmBed(
  voicePath: string,
  bgmPath: string | undefined,
  totalDur: number,
  workDir: string,
  sceneBoundariesSec: number[] = [],
  hookStingPath?: string,
  endCardSfxPath?: string,
): Promise<string> {
  const out = join(workDir, 'voice-plus-bgm.m4a');
  const totalDurStr = totalDur.toFixed(3);
  const whooshExpr = buildWhooshExpr(sceneBoundariesSec, totalDur);
  const hasWhoosh = whooshExpr.length > 0;

  // ─── Unified asset-aware filter graph ────────────────────────────────────
  // Single branch: voice + BGM (file OR procedural) + hook-sting (file OR
  // procedural) + optional end-card SFX (file only) + optional whoosh
  // (procedural). Each input fans into the amix; sidechain ducks BGM
  // under voice; loudnorm tames final master to -14 LUFS / -1.0 dBTP.
  // Batch-18 Phase A: replaces the two-branch (external-bgm / procedural)
  // dispatch with a unified pipeline so vendored Pixabay assets, when
  // present, drop straight in without losing the procedural hook sting
  // or whoosh paths.
  const inputs: string[] = ['-i', voicePath];
  const filters: string[] = [];
  let nextIdx = 1;

  // Voice rate-normalize: Edge-TTS emits 24kHz mono. The vendored BGM is
  // 44.1kHz stereo; the procedural lavfi inputs are 44.1kHz. amix
  // auto-resamples internally, but the sidechain compressor evaluates
  // attack/release envelopes against its CONTROL input's native rate --
  // so a 24kHz voice control → 44.1kHz BGM target effectively scales
  // attack=10ms to ~18.4ms and release=400ms to ~735ms (Panel-16 Eng E4
  // Carmack: ducking digs in slower and recovers faster than spec).
  // Pre-resampling voice to 44.1kHz fixes the envelope timing AND keeps
  // the procedural-pad path (which was previously coincidentally
  // matched) byte-identical.
  // asplit fans out the resampled voice to two consumers: the sidechain
  // compressor (control input) AND the final amix (mix dominant). A
  // single labelled stream cannot feed two filters; this is the
  // canonical ffmpeg pattern for shared signals.
  filters.push('[0:a]aresample=44100,asplit=2[voice44k][voice44k_sc]');

  // Source 1: BGM bed (always present — file or procedural).
  // Panel-16 Audio A1+A4 P0 (Huang+Beato): prior `volume=-26dB` × amix
  // weight=0.35 gave effective -35 dBr below voice -- silence-detect
  // confirmed BGM was below the audible floor on consumer earbuds.
  // Bumped to -18dB for vendored BGM (× 0.35 = -27 dBr, in the
  // broadcast "felt-but-not-heard" range). Procedural pad stays at
  // -26dB because aevalsrc triad-sine has a much higher peak-to-RMS
  // ratio (closer to a pure tone) and would mask voice if matched.
  const bgmIdx = nextIdx++;
  if (bgmPath && existsSync(bgmPath)) {
    inputs.push('-stream_loop', '-1', '-i', bgmPath);
    filters.push(
      `[${bgmIdx}:a]aformat=channel_layouts=stereo,volume=-18dB,` +
        `atrim=duration=${totalDurStr},asetpts=PTS-STARTPTS[bgm]`,
    );
  } else {
    // Procedural pad — three detuned sines (G3 / C4 / E4 = G major triad)
    // with low-pass + slow tremolo to imitate a sustained synth bed.
    const padExpr =
      "aevalsrc='0.04*sin(2*PI*196*t)+0.035*sin(2*PI*261.63*t)+0.03*sin(2*PI*329.63*t)'" +
      `:s=44100:d=${totalDurStr}`;
    inputs.push('-f', 'lavfi', '-i', padExpr);
    filters.push(
      `[${bgmIdx}:a]aformat=channel_layouts=stereo,lowpass=f=700,` +
        `tremolo=f=0.25:d=0.25,volume=-26dB[bgm]`,
    );
  }

  // Source 2: Hook sting (always present — file or procedural).
  // File path: trim to first 2.5s, peak-normalised to -3 dB, padded to
  // totalDur so amix doesn't hold open. Procedural: existing 350ms
  // exp-decay chirp from Panel-9.
  const hookIdx = nextIdx++;
  if (hookStingPath && existsSync(hookStingPath)) {
    inputs.push('-i', hookStingPath);
    filters.push(
      `[${hookIdx}:a]aformat=channel_layouts=stereo,` +
        `atrim=duration=2.5,asetpts=PTS-STARTPTS,` +
        `volume=-3dB,apad=whole_dur=${totalDurStr}[hooksfx]`,
    );
  } else {
    // Procedural fallback (Panel-9 Ret P1 Huang: -4 decay → ~173ms
    // half-life so the body of the impact carries through 350ms).
    const sfxExpr =
      "aevalsrc='if(lt(t\\,0.35)\\,0.45*exp(-4*t)*sin(2*PI*(180+800*t)*t)\\,0)'" +
      `:s=44100:d=${totalDurStr}`;
    inputs.push('-f', 'lavfi', '-i', sfxExpr);
    filters.push(
      `[${hookIdx}:a]aformat=channel_layouts=stereo[hooksfx]`,
    );
  }

  // Source 3: End-card uplift SFX (optional — file only, no procedural
  // fallback). Placed at totalDur - 1.6s so it lifts the CTA frame.
  // adelay shifts the input forward; apad pads tail to totalDur.
  let endCardLabel = '';
  if (endCardSfxPath && existsSync(endCardSfxPath)) {
    const endIdx = nextIdx++;
    inputs.push('-i', endCardSfxPath);
    const delayMs = Math.max(0, Math.round((totalDur - END_CARD_OFFSET_S) * 1000));
    filters.push(
      `[${endIdx}:a]aformat=channel_layouts=stereo,` +
        `atrim=duration=${END_CARD_OFFSET_S},asetpts=PTS-STARTPTS,volume=-6dB,` +
        `adelay=${delayMs}|${delayMs},apad=whole_dur=${totalDurStr}[endsfx]`,
    );
    endCardLabel = '[endsfx]';
  }

  // Source 4: Per-scene-transition whoosh (optional — procedural,
  // boundaries from compose()).
  let whooshLabel = '';
  if (hasWhoosh) {
    const whooshIdx = nextIdx++;
    inputs.push('-f', 'lavfi', '-i', whooshExpr);
    filters.push(`[${whooshIdx}:a]aformat=channel_layouts=stereo[whoosh]`);
    whooshLabel = '[whoosh]';
  }

  // Sidechain duck BGM under voice (always). Uses the rate-normalized
  // voice signal as the sidechain control so attack/release envelopes
  // are calibrated correctly (Panel-16 Eng E4 Carmack Gap 2).
  filters.push(
    '[bgm][voice44k_sc]sidechaincompress=threshold=0.04:ratio=6:' +
      'attack=10:release=400[ducked]',
  );

  // Build amix dynamically. Order: voice, ducked-BGM, hook-sting,
  // [end-card], [whoosh]. Weights tuned so voice dominates, BGM sits
  // ~9 dB under, hook ~5 dB under, end-card ~6 dB under, whoosh ~6 dB
  // under.
  // Panel-16 Eng E4 Carmack Gap 1: was `duration=first` which terminated
  // amix when the FIRST input ([voice44k]) ended. Voice EOF (~14s) lands
  // BEFORE totalDur (~17s after end-card-pad extension), so the entire
  // last 2-3s -- the CTA window the end-card uplift SFX was *designed*
  // to hit -- played in dead silence. The outer apad step then masked
  // the kill with silence so the bug was sha1-stable and meanVariance
  // gate-passing -- only audible. `duration=longest` keeps amix running
  // until ALL inputs end (BGM/hooksfx/endsfx/whoosh are all bounded to
  // totalDur), which restores the end-card uplift and BGM tail. Voice
  // contributes silence after EOF (amix fills exhausted inputs with
  // silence), and the sidechain compressor responds correctly (no
  // signal → no ducking → BGM at base -26dB during CTA tail).
  // dropout_transition=2 prevents the hard cut that would click the
  // loudnorm pass.
  const mixLabels: string[] = ['[voice44k]', '[ducked]', '[hooksfx]'];
  const weights: number[] = [1, 0.35, 0.6];
  if (endCardLabel) {
    mixLabels.push(endCardLabel);
    weights.push(0.55);
  }
  if (whooshLabel) {
    mixLabels.push(whooshLabel);
    weights.push(0.5);
  }
  const mixSpec =
    `${mixLabels.join('')}amix=inputs=${mixLabels.length}` +
    `:duration=longest:dropout_transition=2` +
    `:weights=${weights.join(' ')}[mix]`;
  filters.push(mixSpec);
  // Panel-16 Audio P1 #2 (Beato/Huang): single-pass loudnorm landed at
  // I=-14.9 LUFS (target -14.0) and LRA=3.5 LU — half the broadcast
  // floor (7-9 LU). Narrow LRA = "loud-but-flat" which streaming
  // listeners read as podcast-grade not viral-Short-grade.
  // dynaudnorm before loudnorm expands per-frame dynamics within a
  // sliding window without colouring tone (f=200ms frame, g=11 frames
  // gauss = ~2.2s context). This lifts LRA toward 6-8 LU and gives the
  // master a more musical envelope. dynaudnorm is fully deterministic
  // on identical input — no internal randomness.
  filters.push('[mix]dynaudnorm=f=200:g=11:p=0.95:m=10[mixexp]');
  filters.push('[mixexp]loudnorm=I=-14:LRA=11:tp=-1.0[aout]');

  await runFfmpeg([
    ...inputs,
    '-filter_complex', filters.join(';'),
    '-map', '[aout]',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    out,
  ]);
  return out;
}

async function probeDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    execFile(FFPROBE_BIN,
      [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'csv=p=0',
        videoPath,
      ],
      (err, stdout) => {
        if (err) {
          reject(err);
          return;
        }
        const dur = parseFloat(stdout.trim());
        // Panel-16 Eng E1 Eich P0: previous implementation `parseFloat(...) || 0`
        // silently returned 0 on parse failure or NaN. A 0 totalDur poisons
        // downstream computations: end-card adelay becomes negative-clamped
        // to 0 (SFX fires at t=0, masking voice), apad whole_dur=0 produces
        // an empty audio stream, and the final `-t 0` flag would emit a
        // zero-frame mp4 that still passes the meanVariance gate as garbage.
        // Throw loud rather than silently corrupt the render.
        if (!Number.isFinite(dur) || dur <= 0) {
          reject(new Error(
            `probeDuration(${videoPath}): ffprobe returned non-finite or non-positive ` +
            `duration (raw stdout: ${JSON.stringify(stdout)}). Refusing to render with ` +
            `corrupted timing — the upstream concat/encode step likely failed silently.`,
          ));
          return;
        }
        resolve(dur);
      }
    );
  });
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG_BIN, ['-y', ...args], { maxBuffer: 10 * 1024 * 1024 }, (err, _stdout, stderr) => {
      if (err) {
        reject(new Error(`ffmpeg failed:\n${stderr}`));
      } else {
        resolve();
      }
    });
  });
}
