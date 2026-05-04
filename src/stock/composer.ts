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
import { verifyLufs } from '../audio/lufs-verify.js';
import { buildDiagramFilters } from './concept-diagram.js';

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
const VENDORED_RIMSHOT_PATH = pathResolve(PACKAGE_ROOT, 'assets/audio/sfx/rimshot.mp3');
const VENDORED_VINYL_SCRATCH_PATH = pathResolve(PACKAGE_ROOT, 'assets/audio/sfx/vinyl-scratch.mp3');

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
  rimshot: string | undefined;
  vinylScratch: string | undefined;
};
let vendoredAudioCache: VendoredAudioPaths | null = null;
function discoverVendoredAudio(): VendoredAudioPaths {
  if (vendoredAudioCache) return vendoredAudioCache;
  vendoredAudioCache = {
    bgm: existsSync(VENDORED_BGM_PATH) ? VENDORED_BGM_PATH : undefined,
    hookSting: existsSync(VENDORED_HOOK_STING_PATH) ? VENDORED_HOOK_STING_PATH : undefined,
    endCardSfx: existsSync(VENDORED_END_CARD_SFX_PATH) ? VENDORED_END_CARD_SFX_PATH : undefined,
    rimshot: existsSync(VENDORED_RIMSHOT_PATH) ? VENDORED_RIMSHOT_PATH : undefined,
    vinylScratch: existsSync(VENDORED_VINYL_SCRATCH_PATH) ? VENDORED_VINYL_SCRATCH_PATH : undefined,
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
  /**
   * Panel-17 Retention P0 (Bilyeu): tombstone text drawn after the
   * narration ends but before the end-card fires (typically t=12-17s
   * window on a 17.5-19s last scene). Without this, the body of the
   * last scene plays empty dark navy with only a watermark — the algo's
   * 50% completion checkpoint falls inside the dead zone, killing
   * retention. The tombstone is a static "key takeaway" recap line
   * that sits in the captionText band (lower-mid) and bridges the
   * silence between voice EOF and end-card reveal.
   */
  tombstoneText?: string;
  /**
   * Panel-20 Retention P0-A (Bilyeu/MrBeast): mid-point promise text.
   * Drawn for the first 1.8s of this scene's local timeline as a
   * curiosity-gap line that bridges the algo's 50% completion window
   * (typically t≈8-10s on a 17.45s short). Without it, viewers hit
   * the body scene, see "more talking", and swipe before the payoff
   * lands. The promise injects a stake reset: "ruko, last 5 sec mein
   * twist hai" / "Number 2 ne mera offer cancel karaaya tha". Drawn
   * in the y=480-680 band — between the bigText hook band (240) and
   * the tombstone band (880) — with a 60% black backdrop and a
   * yellow accent strip on the left. Set on the body scene (typically
   * sceneIndex=1) only.
   */
  midPromiseText?: string;
  /**
   * Panel-21 Retention P0 (user-reported gap): the body scene was
   * showing stock B-roll + caption text but never the actual concept
   * graph. Viewers heard "consumer group reads partitions" and stared
   * at a generic developer typing on a laptop — zero teaching value.
   *
   * `conceptDiagram` is a topic-keyed, ffmpeg-only architecture
   * diagram (boxes + arrows + labels) drawn over the body scene with
   * progressive reveal. Stages pace from t=1.9s (right after the
   * mid-promise drawer fades) through t=sceneDur-0.3 so the diagram
   * BUILDS as the narration explains it. Set on body scenes only —
   * the hook (sceneIndex 0) carries the punchy headline, the closing
   * scene carries the end-card CTA, and the body needs the visual.
   *
   * Built with drawbox/drawtext primitives only (no Mermaid/D2/PNG
   * pipeline) to preserve byte-determinism: the same input produces
   * the same SHA on every cold-cache render.
   */
  conceptDiagram?: import('./concept-diagram.js').ConceptDiagram;
  /**
   * Panel-21 Distribution P0 (user-reported brand gap): the watermark
   * showed only @GuruSishya-India — no off-platform funnel, no value
   * promise. `brandSubline` (e.g. "guru-sishya.in · Interview Ready
   * in 21 Days") sits one line BELOW the @handle in the watermark
   * stack, giving viewers a domain to type into a browser AND a
   * concrete time-bound promise. Surfaced via watermark on every
   * scene; suppressed during the last 2s end-card window so the CTA
   * owns that frame zone unchallenged.
   */
  brandSubline?: string;
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
  // Panel-18 Eng P1 (Carmack/Torvalds): wrap scene processing + concat
  // + mux in try/finally so workDir is always reaped even when a step
  // throws. Without this, a failing pass-1 loudnorm leaves
  // voice-plus-bgm.pre-loudnorm.wav (~3 MB) on disk, and the CI 3×
  // retry loop multiplies that 3×.
  try {
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

    // Panel-18 Audio P0-3 (Katz): post-render LUFS gate. The two-pass
    // loudnorm in mixBgmBed targets I=-14.0 LUFS / TPK=-1.0 dBFS but
    // ships without a verification assertion. If pass-1 silently
    // degrades to single-pass (e.g. measure JSON parse path that
    // doesn't trigger our finiteness guard), the render passes
    // quality-gate and uploads a broken master. verifyLufs throws a
    // descriptive error if I or TPK fall outside spec; toleranceLu=0.5
    // is conservative — two-pass typically lands within ±0.05 LU.
    //
    // Guard: silent-audio test fixtures and renders without a voice
    // track skip the gate — ebur128 cannot integrate near-DC silence
    // and the gate would block legitimate determinism tests. Production
    // path always has voice; SKIP_LUFS_VERIFY=1 escapes for explicit
    // override.
    const skipLufs =
      !input.voicePath || process.env['SKIP_LUFS_VERIFY'] === '1';
    if (!skipLufs) {
      await verifyLufs(input.outputPath, {
        targetLufs: -14,
        targetTruePeak: -1.0,
        toleranceLu: 0.5,
      });
    }
  } finally {
    // Cleanup work dir
    rmSync(workDir, { recursive: true, force: true });
  }
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

  const hasOverlay = !!(scene.bigText || scene.captionText || scene.endCardText || scene.tombstoneText || scene.conceptDiagram || scene.brandSubline);
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

    // ── Persistent brand subline (Panel-21 Distribution P0) ──────────────
    // Off-platform funnel + value-prop tagline pinned at y=1545 — the
    // 25px gap between the caption band ceiling (1540) and the YT
    // Shorts like-strip safe-zone floor (1570). Fontsize 22 fits in
    // 25px with proper border. Suppressed during the end-card window
    // on the closing scene so the CTA owns the full frame; visible
    // every other second. This is the FIRST off-platform funnel signal
    // the channel has shipped — viewers can read "guru-sishya.in" the
    // entire ~15s body and have a typeable URL to take with them.
    if (scene.brandSubline) {
      const brandY = 1545;
      const brandFs = 22;
      // If this scene also carries an endCardText (i.e. closing scene),
      // suppress the subline during the end-card window so the CTA
      // text doesn't compete with the persistent watermark line.
      const brandEnable = scene.endCardText
        ? `:enable='lt(t,${Math.max(0, scene.durationSec - 2.0).toFixed(3)})'`
        : '';
      filters.push(
        `drawtext=text='${escapeDrawtext(scene.brandSubline)}'${fontArgFor(scene.brandSubline)}:` +
        `fontcolor=white:fontsize=${brandFs}:borderw=3:bordercolor=black@0.95:` +
        `x=(w-text_w)/2:y=${brandY}${brandEnable}`,
      );
    }

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

    // Panel-17 Retention P0 (Bilyeu): tombstone "key takeaway" recap
    // that fills the dead-zone between voice-EOF (~t=12s on the last
    // scene) and end-card reveal (~scene.durationSec - 2.0s). Eye-track
    // research puts the algo's 50% completion checkpoint inside this
    // window — without it, viewers see 5+ seconds of dark void and
    // swipe. The tombstone is a static yellow line in the upper-mid
    // band so it's clearly distinct from the karaoke caption band
    // below and the bigText hook band above. Visible from ~2s into
    // the scene until the end-card fades in.
    if (scene.tombstoneText) {
      const endCardStart = Math.max(0, scene.durationSec - 2.0);
      const tombStart = Math.min(2.0, scene.durationSec * 0.15);
      const tombEnable = `enable='between(t,${tombStart.toFixed(3)},${endCardStart.toFixed(3)})'`;
      const tombLines = wrapText(scene.tombstoneText, 24).split('\n').slice(0, 2);
      const FS = 56;
      const LH = 80;
      const startY = 880;
      const tombFade = `alpha='if(lt(t,${tombStart.toFixed(3)}),0,if(gt(t,${endCardStart.toFixed(3)}),0,min((t-${tombStart.toFixed(3)})/0.5,1)))'`;
      // Panel-18 Retention P2-A (Edge): on a real B-roll last scene the
      // bare yellow text + 4px border at y=880 becomes nearly unreadable
      // against complex footage. Add a 60% black drawbox behind the
      // tombstone band that only fires while the tombstone is visible
      // — mirrors the pattern already used for bigText (y=240) and the
      // end-card (y=680). On synthetic navy this is harmless overlap.
      filters.push(
        `drawbox=x=0:y=860:w=1080:h=200:color=black@0.60:t=fill:${tombEnable}`,
      );
      tombLines.forEach((line, idx) => {
        const escaped = escapeDrawtext(line);
        filters.push(
          `drawtext=text='${escaped}'${fontArgFor(line)}:fontcolor=#FFEB3B:fontsize=${FS}:` +
          `borderw=4:bordercolor=black@0.92:${tombFade}:` +
          `x=(w-text_w)/2:y=${Math.round(startY + idx * LH)}:${tombEnable}`
        );
      });
    }

    // ── Mid-point promise (Panel-20 Ret P0-A Bilyeu/MrBeast) ─────────────
    // Drawn for the first 1.8s of THIS scene's local timeline. Sits in
    // the y=480-680 band between the hook (240) and tombstone (880).
    // Yellow accent strip on the left + 60% black backdrop reads as
    // "stake reset / important promise" without colliding with caption
    // band. enable= is scoped to scene-local time so the promise fires
    // exactly when the viewer enters the body scene — straddling the
    // algo's 50% checkpoint with a "wait, the payoff is coming" signal.
    if (scene.midPromiseText) {
      const promiseEnd = Math.min(1.8, scene.durationSec - 0.5);
      const promiseEnable = `enable='lt(t,${promiseEnd.toFixed(3)})'`;
      const promiseFade = `alpha='if(lt(t,${promiseEnd.toFixed(3)}),1-(t/${promiseEnd.toFixed(3)})*0.0,0)'`;
      const promLines = wrapText(scene.midPromiseText, 26).split('\n').slice(0, 2);
      const PFS = 50;
      const PLH = 70;
      const promStartY = 500;
      filters.push(
        `drawbox=x=0:y=480:w=1080:h=200:color=black@0.62:t=fill:${promiseEnable}`,
      );
      filters.push(
        `drawbox=x=24:y=480:w=10:h=200:color=#FFEB3B@0.95:t=fill:${promiseEnable}`,
      );
      promLines.forEach((line, idx) => {
        const escaped = escapeDrawtext(line);
        filters.push(
          `drawtext=text='${escaped}'${fontArgFor(line)}:fontcolor=white:fontsize=${PFS}:` +
          `borderw=3:bordercolor=black@0.85:${promiseFade}:` +
          `x=70:y=${Math.round(promStartY + idx * PLH)}:${promiseEnable}`,
        );
      });
    }

    // ── Concept diagram (Panel-21 Retention P0) ──────────────────────────
    // Topic-keyed architecture diagram drawn over the body scene with
    // progressive reveal — boxes/arrows fade in stage-by-stage so the
    // diagram BUILDS as the narration explains it. Sits in y=200..1060,
    // post-mid-promise (stages start at t=1.9s). Drives the actual
    // teaching: viewers SEE the producer→partition→consumer-group
    // graph instead of staring at generic stock footage of a developer
    // typing. Suppressed on hook/end-card scenes via the caller (the
    // hook owns the bigText band y=240..720, the end-card owns y=680..
    // 1080 during the last 2s).
    if (scene.conceptDiagram) {
      const diagramFilters = buildDiagramFilters(scene.conceptDiagram, scene.durationSec, {
        fontArg,
        fontArgFor,
      });
      filters.push(...diagramFilters);
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

  // Panel-19 Eng/Eich P2 + Panel-20 Eng P1-4 (brightness pulse scope):
  // the pulse was added for the dead-zone tombstone scene. The previous
  // gate `isSynthetic && tombstoneText` excluded a real B-roll clip
  // that the orchestrator might mark with tombstoneText (perfectly
  // valid case post-B24 since render-stock-short.ts now recycles a
  // real clip onto the last scene). Drop the isSynthetic clause so
  // the brightness pulse applies whenever the scene is acting as the
  // dead-zone bridge, regardless of whether the underlying clip is
  // synthetic or real B-roll.
  const filterChain = scene.tombstoneText
    ? `eq=brightness='0.06*sin(2*PI*t/2.5)':eval=frame,${filters.join(',')}`
    : filters.join(',');

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
      vendored.rimshot,
      vendored.vinylScratch,
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
    //
    // Panel-19 Retention P1-B (Bilyeu): the watermark is competing with
    // the end-card CTA visually during the last 2s — Subscribe + handle
    // + "Rewatch karo phir se" text fight the watermark for attention
    // exactly when we want the viewer's eye on the loop driver. Suppress
    // the watermark during the end-card window (last END_CARD_SEC=2s)
    // so the CTA owns that frame zone unchallenged.
    const endCardStart = Math.max(0, totalDur - 2.0).toFixed(3);
    const overlayFilter = `${vf ? `[0:v]${vf}[captioned];[captioned]` : '[0:v]'}[2:v]overlay=W-w-30:H-h-380:enable='lt(t,${endCardStart})'[outv]`;
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
  rimshotPath?: string,
  vinylScratchPath?: string,
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
  // Panel-19 Audio P1 (Padilla): width=1.5 octaves over-cuts presence
  // (4.5-5.6 kHz vowel-formant range) along with sibilance. Narrow to
  // 0.8 oct + slightly deeper g=-4.0 — surgical de-ess on the 7-9 kHz
  // band only, restoring intelligibility on PrabhatNeural's vowel
  // attack. Voice highpass=80 + de-ess chain stays in this order so
  // sidechain sees the same processed signal as the amix dominant.
  filters.push(
    '[0:a]aresample=44100,highpass=f=80:poles=2,' +
      'equalizer=f=7500:width_type=o:width=0.8:g=-4.0,' +
      'asplit=3[voice44k][voice44k_sc][voice44k_hsc]',
  );

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
    // Panel-17 Audio P0 (Rogers/Beato): vendored BGM (tense-suspense.mp3
    // is full-spectrum 256kbps) carries energy to ~16kHz; even at
    // -27 dBr its 1-4kHz harmonics mask T/K/S/F consonants on
    // en-IN-PrabhatNeural voice through consumer earbuds. The
    // procedural-pad branch below uses lowpass=f=700 specifically to
    // sit below the 2-4kHz consonant intelligibility band — apply the
    // same protection to the vendored branch.
    // lowpass=f=1000 cuts above 1kHz (preserves bass+low-mid bed
    // warmth, removes consonant-masking energy). highshelf -6dB above
    // 3kHz adds a second tier of attenuation on residual harmonics so
    // any leakage past the lowpass slope (12 dB/oct) is also tamed.
    // Panel-19 Audio P1 (Pensado): the highshelf=f=3000:gain=-6 added
    // in P17 was redundant with `lowpass=f=1000` — the lowpass already
    // attenuates -24 dB/oct above 1 kHz so by 3 kHz it's at -38 dB,
    // making the additional -6 dB shelf inaudible. Removing it
    // simplifies the chain and saves one filter pass.
    const bgmFadeOutStart = Math.max(0, totalDur - 1.0).toFixed(3);
    filters.push(
      `[${bgmIdx}:a]aformat=channel_layouts=stereo,highpass=f=80:poles=2,volume=-18dB,` +
        `lowpass=f=1000,` +
        `atrim=duration=${totalDurStr},asetpts=PTS-STARTPTS,` +
        `afade=t=in:st=0:d=1.5,afade=t=out:st=${bgmFadeOutStart}:d=1.0[bgm]`,
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
        `atrim=duration=${END_CARD_OFFSET_S},asetpts=PTS-STARTPTS,volume=-9dB,` +
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

  // Panel-19 Audio P2 (Huang): pattern-interrupt SFX layer.
  // Vinyl-scratch lands at the first scene boundary (scene 0 → 1) —
  // the "okay, here's the meat" handoff from hook to body content.
  // Rimshot lands at the second boundary (scene 1 → 2) — the punchline
  // / reveal moment before the takeaway. Both are short transients
  // (≤500ms) so we trim conservatively, fade-in 5ms to remove any
  // pre-roll click, fade-out 80ms to soften the tail. Volume kept at
  // -10 to -8 dBFS so they punch but don't dominate the voice mix.
  // Boundaries are deterministic (frame-quantised in compose()), so
  // the adelay values are byte-stable across runs.
  let vinylLabel = '';
  if (
    vinylScratchPath &&
    existsSync(vinylScratchPath) &&
    sceneBoundariesSec.length >= 1
  ) {
    const vIdx = nextIdx++;
    inputs.push('-i', vinylScratchPath);
    const delayMs = Math.max(0, Math.round(sceneBoundariesSec[0]! * 1000));
    filters.push(
      `[${vIdx}:a]aformat=channel_layouts=stereo,` +
        `atrim=duration=0.6,asetpts=PTS-STARTPTS,` +
        `afade=t=in:st=0:d=0.005,afade=t=out:st=0.52:d=0.08,` +
        `volume=-10dB,` +
        `adelay=${delayMs}|${delayMs},apad=whole_dur=${totalDurStr}[vinyl]`,
    );
    vinylLabel = '[vinyl]';
  }

  let rimshotLabel = '';
  if (
    rimshotPath &&
    existsSync(rimshotPath) &&
    sceneBoundariesSec.length >= 2
  ) {
    const rIdx = nextIdx++;
    inputs.push('-i', rimshotPath);
    const delayMs = Math.max(0, Math.round(sceneBoundariesSec[1]! * 1000));
    filters.push(
      `[${rIdx}:a]aformat=channel_layouts=stereo,` +
        `atrim=duration=0.5,asetpts=PTS-STARTPTS,` +
        `afade=t=in:st=0:d=0.005,afade=t=out:st=0.42:d=0.08,` +
        `volume=-8dB,` +
        `adelay=${delayMs}|${delayMs},apad=whole_dur=${totalDurStr}[rimshot]`,
    );
    rimshotLabel = '[rimshot]';
  }

  // Sidechain duck BGM under voice (always). Uses the rate-normalized
  // voice signal as the sidechain control so attack/release envelopes
  // are calibrated correctly (Panel-16 Eng E4 Carmack Gap 2).
  // Panel-17 Audio P1 (Beato): release=400ms left a 400ms BGM-recovery
  // dip after each voice clause — detectable in the silence-detect
  // reading at t=17.48s (voice ends ~17.1s, BGM not fully recovered
  // by 17.5s before end-card SFX fires). release=250ms halves the
  // recovery tail to one BS.1770 short-term block boundary, eliminating
  // the audible post-voice dip.
  filters.push(
    '[bgm][voice44k_sc]sidechaincompress=threshold=0.04:ratio=6:' +
      'attack=10:release=250[ducked]',
  );

  // Panel-19 Audio P1 (Pensado): hook sting was firing at amix
  // weight=0.6 simultaneously with the voice attack at t=0 — most
  // intelligibility-critical moment. Sidechain duck the sting under
  // the voice control signal so the sting's body recedes the moment
  // the voice starts. Threshold=0.04 / ratio=3 / attack=30 / release=
  // 500 chosen for a SOFT duck (the sting still establishes presence
  // in the first 200-300ms before voice attack but yields cleanly).
  // Lower ratio than BGM duck because the sting is short (≤2.5s) and
  // we want it heard, just not on top of the first syllable.
  filters.push(
    '[hooksfx][voice44k_hsc]sidechaincompress=threshold=0.04:ratio=3:' +
      'attack=30:release=500[hookducked]',
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
  const mixLabels: string[] = ['[voice44k]', '[ducked]', '[hookducked]'];
  const weights: number[] = [1, 0.35, 0.6];
  if (endCardLabel) {
    mixLabels.push(endCardLabel);
    weights.push(0.55);
  }
  if (whooshLabel) {
    mixLabels.push(whooshLabel);
    weights.push(0.5);
  }
  if (vinylLabel) {
    mixLabels.push(vinylLabel);
    weights.push(0.5);
  }
  if (rimshotLabel) {
    mixLabels.push(rimshotLabel);
    weights.push(0.55);
  }
  const mixSpec =
    `${mixLabels.join('')}amix=inputs=${mixLabels.length}` +
    `:duration=longest:dropout_transition=2` +
    `:weights=${weights.join(' ')}[mix]`;
  filters.push(mixSpec);
  // Panel-17 Audio P0 (Beato/Katz): Batch-20 added dynaudnorm before
  // loudnorm with the comment claiming "lifts LRA toward 6-8 LU". That
  // claim was wrong. dynaudnorm with p=0.95 is a per-frame PEAK
  // NORMALISER — it pushes every 200ms window's peak toward -0.45 dBFS,
  // uniformising loudness and NARROWING LRA. Measured impact: LRA went
  // from 3.5 LU (B19) to 3.0 LU (B20), the opposite of the design
  // intent. It also flattened the hook-sting transient at t=0,
  // weakening the stop-the-scroll punch. Reverted to single-pass
  // loudnorm — for voiceover-dominant content 3-5 LU is the natural
  // landing range and matches Spotify/YouTube podcast playback spec.
  // The B19 measurement (-14.9 LUFS, TPK -1.8 dBFS) is acceptable; if
  // we want sub-0.05 dB LUFS accuracy the proper fix is a true two-pass
  // loudnorm (measure → apply with measured_*+linear=true), deferred
  // to B22.
  // Panel-17 Audio P1 (Katz): true two-pass loudnorm — measure with
  // print_format=json, then apply with linear=true + measured_*
  // values for sub-0.05 dB LUFS accuracy. Single-pass loudnorm has
  // ±0.5 dB inherent error which the YouTube/Spotify -0.2 dB silent
  // attenuate-on-upload then compounds. Two-pass eliminates the gap.
  //
  // Implementation:
  //  Pass 0: render filter_complex to PCM intermediate WAV (no
  //          loudnorm, no AAC).
  //  Pass 1: ffmpeg -i wav -af loudnorm=...:print_format=json measure
  //          → parse stderr for measured_I/_LRA/_TP/_thresh/offset.
  //  Pass 2: ffmpeg -i wav -af loudnorm=...:linear=true:measured_*=...
  //          encode AAC to final .m4a.
  // All three steps are pure functions of identical input → fully
  // deterministic. Pass 1 measurements drive Pass 2 linear scaling so
  // there's no compression artifacting and LRA is preserved exactly.
  const intermediateWav = join(workDir, 'voice-plus-bgm.pre-loudnorm.wav');
  filters.push('[mix]anull[aout_pre]');

  await runFfmpeg([
    ...inputs,
    '-filter_complex', filters.join(';'),
    '-map', '[aout_pre]',
    // Panel-18 Audio P1 (Katz): 24-bit intermediate. With BGM tail
    // running at -40 dBr after sidechain, 16-bit gives only ~38 dB
    // headroom above the noise floor for that stem — quantization
    // noise biases the loudnorm pass-1 measurement by 0.1-0.2 LU.
    // pcm_s24le eliminates this for free.
    '-c:a', 'pcm_s24le', '-ar', '48000', '-ac', '2',
    intermediateWav,
  ]);

  const loudnormMeasured = await measureLoudnorm(intermediateWav);

  await runFfmpeg([
    '-i', intermediateWav,
    '-af',
      `loudnorm=I=-14:LRA=11:tp=-1.0:` +
      `measured_I=${loudnormMeasured.input_i}:` +
      `measured_LRA=${loudnormMeasured.input_lra}:` +
      `measured_TP=${loudnormMeasured.input_tp}:` +
      `measured_thresh=${loudnormMeasured.input_thresh}:` +
      `offset=${loudnormMeasured.target_offset}:` +
      `linear=true:print_format=summary`,
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    out,
  ]);
  return out;
}

// Panel-17 Audio P1 (Katz): two-pass loudnorm support — Pass 1.
// Runs loudnorm with print_format=json on a PCM intermediate and
// extracts the 5 measured values needed for Pass 2's linear scaling.
// The JSON block sits at the END of stderr; we slice from the last
// '{' to ensure we don't catch ffmpeg's preamble braces.
type LoudnormMeasure = {
  input_i: string;
  input_lra: string;
  input_tp: string;
  input_thresh: string;
  target_offset: string;
};
async function measureLoudnorm(wavPath: string): Promise<LoudnormMeasure> {
  return new Promise((resolve, reject) => {
    execFile(
      FFMPEG_BIN,
      [
        '-hide_banner', '-nostats',
        '-i', wavPath,
        '-af', 'loudnorm=I=-14:LRA=11:tp=-1.0:print_format=json',
        '-f', 'null', '-',
      ],
      { maxBuffer: 8 * 1024 * 1024 },
      (err, _stdout, stderr) => {
        if (err) {
          reject(new Error(`loudnorm pass-1 measure failed: ${stderr}`));
          return;
        }
        const lastBrace = stderr.lastIndexOf('{');
        if (lastBrace < 0) {
          reject(new Error(`loudnorm pass-1 produced no JSON: ${stderr}`));
          return;
        }
        const jsonChunk = stderr.slice(lastBrace);
        const closeBrace = jsonChunk.lastIndexOf('}');
        if (closeBrace < 0) {
          reject(new Error(`loudnorm pass-1 JSON unterminated: ${jsonChunk}`));
          return;
        }
        try {
          const parsed = JSON.parse(jsonChunk.slice(0, closeBrace + 1));
          // Panel-18 Engineering+Audio P0 (Eich/Hejlsberg/Katz):
          // ffmpeg loudnorm emits "-inf" for input_i/input_thresh and
          // "nan" for target_offset on near-silent input (documented
          // behavior when the integrated window contains <-70 dBFS
          // material). Passing these through unchanged into pass-2's
          // filter string causes either an ffmpeg exit-1 crash or a
          // silent fallback to single-pass that destroys the ±0.05 dB
          // accuracy guarantee. Validate finiteness before resolving.
          const measuredFields = {
            input_i: String(parsed.input_i),
            input_lra: String(parsed.input_lra),
            input_tp: String(parsed.input_tp),
            input_thresh: String(parsed.input_thresh),
            target_offset: String(parsed.target_offset),
          };
          for (const [key, raw] of Object.entries(measuredFields)) {
            const num = parseFloat(raw);
            if (!Number.isFinite(num)) {
              reject(
                new Error(
                  `loudnorm pass-1 returned non-finite "${raw}" for ${key} ` +
                    `(near-silent input?). Full JSON: ${JSON.stringify(parsed)}`,
                ),
              );
              return;
            }
            // Panel-19 Audio P0 (Katz): ffmpeg's loudnorm pass-2
            // hard-clamps target_offset to ±12 dB and silently
            // substitutes single-pass behaviour when the measured
            // offset exceeds that window — which destroys the
            // ±0.05 dB accuracy guarantee. Reject explicitly so the
            // caller sees a deterministic failure instead of a quiet
            // measurement-mode regression.
            if (key === 'target_offset' && Math.abs(num) > 12) {
              reject(
                new Error(
                  `loudnorm pass-1 target_offset=${num} dB exceeds ffmpeg's ±12 dB clamp window — ` +
                    `pass-2 will silently fall back to single-pass and break determinism. ` +
                    `Full JSON: ${JSON.stringify(parsed)}`,
                ),
              );
              return;
            }
          }
          // ffmpeg returns values as strings already (e.g. "-14.9");
          // pass them through unchanged so the second pass sees the
          // exact byte representation it expects.
          resolve(measuredFields);
        } catch (e) {
          reject(new Error(`loudnorm pass-1 JSON parse failed: ${(e as Error).message}\nchunk: ${jsonChunk}`));
        }
      },
    );
  });
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
