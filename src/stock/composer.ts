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
import { FFMPEG_BIN, FFPROBE_BIN } from '../lib/ffmpeg-bin.js';

const execFileP = promisify(execFile);

// Memoised filter-availability probes. Some ffmpeg builds (e.g. macOS
// homebrew default) ship without libass; we skip captions gracefully
// rather than failing the whole render.
let assAvailableCache: boolean | null = null;
async function isAssFilterAvailable(): Promise<boolean> {
  if (assAvailableCache !== null) return assAvailableCache;
  try {
    const { stdout } = await execFileP(FFMPEG_BIN, ['-hide_banner', '-filters'], {
      maxBuffer: 4 * 1024 * 1024,
    });
    assAvailableCache = /^\s*\S+\s+ass\s/m.test(stdout);
  } catch {
    assAvailableCache = false;
  }
  return assAvailableCache;
}

let drawtextAvailableCache: boolean | null = null;
async function isDrawtextAvailable(): Promise<boolean> {
  if (drawtextAvailableCache !== null) return drawtextAvailableCache;
  try {
    const { stdout } = await execFileP(FFMPEG_BIN, ['-hide_banner', '-filters'], {
      maxBuffer: 4 * 1024 * 1024,
    });
    drawtextAvailableCache = /^\s*\S+\s+drawtext\s/m.test(stdout);
  } catch {
    drawtextAvailableCache = false;
  }
  return drawtextAvailableCache;
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
    if (scene.sceneIndex % 2 === 0) {
      // Zoom in: 1.00 → 1.20 over the scene
      const zoomInVel = (0.20 / durFrames).toFixed(6);
      zoompanFilter = `zoompan=z='1+${zoomInVel}*on':d=${durFrames}:s=1080x1920:fps=${FPS}`;
    } else {
      // Panel-8 Ret P1 (McKinnon): previous hardcoded 0.00133 never
      // resolved to 1.00× at end of scene — at 105 frames (3.5s × 30)
      // the math left zoom at 1.06×, breaking the in/out symmetry.
      // Compute the velocity from durFrames so the ramp ALWAYS ends
      // exactly at 1.00× regardless of cap changes.
      const zoomOutVel = (0.20 / durFrames).toFixed(6);
      zoompanFilter = `zoompan=z='max(1,1.20-${zoomOutVel}*on)':d=${durFrames}:s=1080x1920:fps=${FPS}`;
    }
  }
  // Panel-9 Ret P0 (McKinnon): zero color grading on raw stock clips
  // is the single largest perceived-production-value ceiling. A subtle
  // saturation lift (1.06) + small contrast bump (1.04) gives a
  // consistent "house look" across heterogeneous Mixkit/Pexels/Pixabay
  // sources without crushing skin tones. Applied AFTER zoompan so it
  // composes the final color over the zoomed crop.
  const colorGrade = ',eq=saturation=1.06:contrast=1.04';
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
  if (scene.sceneIndex >= 3 && scene.sceneIndex % 3 === 0) {
    filters.push(`eq=brightness=0.20:enable='lt(t,0.08)'`);
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
      const hookLines = wrapText(scene.bigText, 14).split('\n').slice(0, 3);
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
      const endCardStart = Math.max(0, scene.durationSec - 1.5);
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
    audioPath = await mixBgmBed(audioPath, input.bgmPath, totalDur, workDir);
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
  const bgmActive = (input.enableBgm || !!input.bgmPath) && hasVoice;
  if (hasVoice && !bgmActive) {
    args.push('-af', 'loudnorm=I=-14:LRA=11:tp=-1.5');
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
 */
async function mixBgmBed(
  voicePath: string,
  bgmPath: string | undefined,
  totalDur: number,
  workDir: string,
): Promise<string> {
  const out = join(workDir, 'voice-plus-bgm.m4a');

  if (bgmPath && existsSync(bgmPath)) {
    // External asset path: load → loop → trim → duck under voice.
    await runFfmpeg([
      '-i', voicePath,
      '-stream_loop', '-1',
      '-i', bgmPath,
      '-filter_complex',
      [
        '[1:a]aformat=channel_layouts=stereo,volume=-26dB,atrim=duration=' + totalDur.toFixed(3) + ',asetpts=PTS-STARTPTS[bgm]',
        '[bgm][0:a]sidechaincompress=threshold=0.04:ratio=8:attack=10:release=300[ducked]',
        '[0:a][ducked]amix=inputs=2:duration=first:dropout_transition=0[mix]',
        '[mix]loudnorm=I=-14:LRA=11:tp=-1.5[aout]',
      ].join(';'),
      '-map', '[aout]',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      out,
    ]);
    return out;
  }

  // Procedural pad — same filter graph, but [bgm] is synthesised inline.
  // aevalsrc emits mono; we duplicate via aformat to stereo before the
  // sidechain compressor (which expects matching channel layouts).
  const padExpr =
    "aevalsrc='0.04*sin(2*PI*196*t)+0.035*sin(2*PI*261.63*t)+0.03*sin(2*PI*329.63*t)'" +
    `:s=44100:d=${totalDur.toFixed(3)}`;
  // Hook SFX impact (Ret1 P0): a 350ms exponentially-decaying frequency
  // sweep at t=0 of the voice track — fires the brain's attention reset
  // *just before* the hook word lands. Amplitude 0.45 → mixed at -3 dB
  // peak which sits ~6 dB above the BGM pad and ~3 dB below voice.
  // Padded with `apad` to totalDur so the amix doesn't hold open due to
  // a short input. After the 350ms strike the input is silence, so it
  // costs nothing on subsequent body scenes.
  // Panel-9 Ret P1 (Huang): decay constant -12 gave a ~58ms half-life
  // — the strike was over before the hook word landed. Slowed decay to
  // -4 (half-life ~173ms) so the impact body carries through 350ms.
  const sfxExpr =
    "aevalsrc='if(lt(t\\,0.35)\\,0.45*exp(-4*t)*sin(2*PI*(180+800*t)*t)\\,0)'" +
    `:s=44100:d=${totalDur.toFixed(3)}`;
  await runFfmpeg([
    '-i', voicePath,
    '-f', 'lavfi',
    '-i', padExpr,
    '-f', 'lavfi',
    '-i', sfxExpr,
    '-filter_complex',
    [
      '[1:a]aformat=channel_layouts=stereo,lowpass=f=700,tremolo=f=0.25:d=0.10,volume=-26dB[bgm]',
      '[2:a]aformat=channel_layouts=stereo[sfx]',
      '[bgm][0:a]sidechaincompress=threshold=0.04:ratio=8:attack=10:release=300[ducked]',
      '[0:a][ducked][sfx]amix=inputs=3:duration=first:dropout_transition=0:weights=1 0.35 0.6[mix]',
      '[mix]loudnorm=I=-14:LRA=11:tp=-1.5[aout]',
    ].join(';'),
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
        if (err) reject(err);
        else resolve(parseFloat(stdout.trim()) || 0);
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
