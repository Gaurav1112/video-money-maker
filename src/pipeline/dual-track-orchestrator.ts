/**
 * dual-track-orchestrator.ts
 *
 * Orchestrates parallel English + Hinglish audio rendering from a single
 * SessionInput. Outputs two MP3 files and optionally muxes them as a
 * multi-track video via ffmpeg.
 *
 * Architecture:
 *   SessionInput
 *       ├─→ English track  → existing tts-engine.ts pipeline (unchanged)
 *       └─→ Hinglish track → HinglishRewriter → EdgeTTSHinglish
 *
 * Both tracks render in parallel (Promise.all). Total overhead vs. English-
 * only: ~0 extra seconds (parallel) + edge-tts network latency for Hinglish.
 *
 * Output structure:
 *   output/{topic}/session-{N}/
 *       audio-en.mp3      ← English narration (existing)
 *       audio-hi.mp3      ← Hinglish narration (new)
 *       video-multi.mp4   ← optional: video + dual audio tracks (ffmpeg)
 */

import * as fs from "fs";
import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { synthesizeScenes, HinglishTTSOptions } from "../audio/tts-engines/edge-tts-hinglish";
import { rewriteScenes, RewriteOptions, getHinglishHook, HookCategory } from "../lib/hinglish-rewriter";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Scene {
  narration: string;
  [key: string]: unknown;
}

export interface SessionInput {
  topic: string;
  sessionId: string | number;
  scenes: Scene[];
  /** Hook category for Hinglish opening hook selection */
  hookCategory?: HookCategory;
  [key: string]: unknown;
}

export interface TrackResult {
  language: "en" | "hi";
  /** Concatenated MP3 path for all scenes */
  audioPath: string;
  /** Per-scene audio paths */
  scenePaths: string[];
  fromCache: boolean[];
}

export interface DualTrackResult {
  sessionInput: SessionInput;
  outputDir: string;
  english: TrackResult;
  hinglish: TrackResult;
  /** Path to multi-track video (only set if muxVideo was called) */
  multiTrackVideoPath?: string;
}

// ---------------------------------------------------------------------------
// English track (wraps existing tts-engine interface)
// ---------------------------------------------------------------------------

/**
 * Renders the English track using the existing pipeline's TTS engine.
 *
 * This function is deliberately thin — it calls whatever the project's
 * current tts-engine exports. No logic is duplicated here.
 *
 * Replace the body if tts-engine.ts changes its export shape.
 */
async function renderEnglishTrack(
  scenes: Scene[],
  outputDir: string
): Promise<TrackResult> {
  // Dynamic import so this file compiles even when tts-engine.ts is absent
  // in the patch context (the orchestrator is a drop-in addition).
  let synthesizeFn: (text: string, options?: unknown) => Promise<{ audioPath: string }>;
  try {
    const mod = (await import("../pipeline/tts-engine")) as {
      synthesize?: (text: string, opts?: unknown) => Promise<{ audioPath: string }>;
      default?: (text: string, opts?: unknown) => Promise<{ audioPath: string }>;
      generateAudio?: (text: string, opts?: unknown) => Promise<{ audioPath: string }>;
    };
    const candidate = mod.synthesize ?? mod.default ?? mod.generateAudio;
    if (!candidate) {
      throw new Error("tts-engine has no synthesize/default/generateAudio export");
    }
    synthesizeFn = candidate;
  } catch {
    // Fallback: shell out to scripts/edge-tts-synth.py (same path used by
    // edge-tts-hinglish.ts). The earlier `await import("edge-tts-node")`
    // never worked because that npm package was never published — this
    // path now uses the actual project TTS provider (Python edge_tts).
    const { spawn } = await import("child_process");
    const crypto = await import("crypto");
    const helperPath = path.resolve(__dirname, "../../scripts/edge-tts-synth.py");
    synthesizeFn = async (text: string) => {
      const hash = crypto.createHash("sha256").update(text).digest("hex").slice(0, 12);
      const audioPath = path.join(outputDir, `.tts-cache`, `en-${hash}.mp3`);
      fs.mkdirSync(path.dirname(audioPath), { recursive: true });
      if (!fs.existsSync(audioPath)) {
        const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-IN">
            <voice name="en-IN-PrabhatNeural"><prosody rate="-5%">${text}</prosody></voice>
           </speak>`;
        await new Promise<void>((resolve, reject) => {
          const proc = spawn(
            "python3",
            [helperPath, "--voice", "en-IN-PrabhatNeural", "--rate", "-5%", "--out", audioPath],
            { stdio: ["pipe", "pipe", "pipe"] },
          );
          let stderr = "";
          proc.stderr.on("data", (d) => { stderr += d.toString(); });
          proc.on("error", reject);
          proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`edge-tts-synth.py exited ${code}: ${stderr}`)));
          proc.stdin.write(ssml, "utf8");
          proc.stdin.end();
        });
      }
      return { audioPath };
    };
  }

  const scenePaths: string[] = [];
  const fromCache: boolean[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const sceneDir = path.join(outputDir, "en");
    fs.mkdirSync(sceneDir, { recursive: true });
    const result = await synthesizeFn(scenes[i].narration, { outputDir: sceneDir });
    scenePaths.push(result.audioPath);
    fromCache.push(false); // tts-engine handles its own caching internally
  }

  const concatPath = path.join(outputDir, "audio-en.mp3");
  await concatMp3Files(scenePaths, concatPath);

  return {
    language: "en",
    audioPath: concatPath,
    scenePaths,
    fromCache,
  };
}

// ---------------------------------------------------------------------------
// Hinglish track
// ---------------------------------------------------------------------------

async function renderHinglishTrack(
  sessions: SessionInput,
  outputDir: string,
  ttsOptions?: HinglishTTSOptions,
  rewriteOptions?: RewriteOptions
): Promise<TrackResult> {
  // 1. Rewrite scenes to Hinglish
  const hinglishScenes = rewriteScenes(sessions.scenes, rewriteOptions);

  // Prepend Hinglish hook to the first scene's narration if a hookCategory is set
  if (sessions.hookCategory && hinglishScenes.length > 0) {
    const hook = getHinglishHook(sessions.hookCategory, Number(sessions.sessionId) ?? 0);
    hinglishScenes[0].narration = `${hook} ${hinglishScenes[0].narration}`;
  }

  // 2. Synthesize all scenes in parallel
  const hiOutputDir = path.join(outputDir, "hi");
  const sceneResults = await synthesizeScenes(hinglishScenes, {
    outputDir: hiOutputDir,
    cacheDir: path.join(hiOutputDir, ".tts-cache"),
    ...ttsOptions,
  });

  const scenePaths = sceneResults.map((r) => r.audioPath);
  const fromCache = sceneResults.map((r) => r.fromCache);

  // 3. Concatenate all scene MP3s into single track file
  const concatPath = path.join(outputDir, "audio-hi.mp3");
  await concatMp3Files(scenePaths, concatPath);

  return {
    language: "hi",
    audioPath: concatPath,
    scenePaths,
    fromCache,
  };
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export interface OrchestratorOptions {
  outputBaseDir?: string;
  /** TTS options for Hinglish synthesis */
  hinglishTTS?: HinglishTTSOptions;
  /** Text rewrite options */
  hinglishRewrite?: RewriteOptions;
  /**
   * If true, also render English track. Set false to render Hinglish only
   * (e.g., when English was already rendered by the existing pipeline).
   */
  renderEnglish?: boolean;
}

/**
 * Renders English and Hinglish audio tracks in parallel for a given session.
 *
 * Usage:
 *   const result = await renderDualTrack(sessionInput);
 *   // result.english.audioPath  → output/kafka/session-2/audio-en.mp3
 *   // result.hinglish.audioPath → output/kafka/session-2/audio-hi.mp3
 */
export async function renderDualTrack(
  sessionInput: SessionInput,
  options: OrchestratorOptions = {}
): Promise<DualTrackResult> {
  const {
    outputBaseDir = "output",
    hinglishTTS = {},
    hinglishRewrite = {},
    renderEnglish = true,
  } = options;

  const outputDir = path.join(
    outputBaseDir,
    sanitizePathSegment(sessionInput.topic),
    `session-${sessionInput.sessionId}`
  );
  fs.mkdirSync(outputDir, { recursive: true });

  // Render both tracks in parallel
  const [englishResult, hinglishResult] = await Promise.all([
    renderEnglish
      ? renderEnglishTrack(sessionInput.scenes, outputDir)
      : Promise.resolve<TrackResult>({
          language: "en",
          audioPath: path.join(outputDir, "audio-en.mp3"),
          scenePaths: [],
          fromCache: [],
        }),
    renderHinglishTrack(sessionInput, outputDir, hinglishTTS, hinglishRewrite),
  ]);

  return {
    sessionInput,
    outputDir,
    english: englishResult,
    hinglish: hinglishResult,
  };
}

// ---------------------------------------------------------------------------
// Optional: mux dual-audio into one video (ffmpeg)
// ---------------------------------------------------------------------------

export interface MuxOptions {
  /** Path to the base video (no audio, or English audio will be replaced) */
  videoPath: string;
  /** Output path for multi-track video */
  outputPath?: string;
}

/**
 * Uses ffmpeg to produce a single MP4 with two audio tracks:
 *   Stream 0: video
 *   Stream 1: English narration (language tag: en)
 *   Stream 2: Hinglish narration (language tag: hi)
 *
 * NOTE: YouTube as of 2025 does NOT expose viewer-selectable audio tracks
 * for standard uploads. This is useful for local preview / future readiness.
 * For live deployment, use separate video uploads (Option A in PATCH.md).
 */
export async function muxDualAudio(
  dualTrack: DualTrackResult,
  muxOptions: MuxOptions
): Promise<string> {
  const outputPath =
    muxOptions.outputPath ??
    path.join(dualTrack.outputDir, "video-multi.mp4");

  const args = [
    "-y",
    "-i", muxOptions.videoPath,
    "-i", dualTrack.english.audioPath,
    "-i", dualTrack.hinglish.audioPath,
    "-map", "0:v",
    "-map", "1:a",
    "-map", "2:a",
    "-metadata:s:a:0", "language=en",
    "-metadata:s:a:0", "title=English",
    "-metadata:s:a:1", "language=hi",
    "-metadata:s:a:1", "title=Hinglish",
    "-c:v", "copy",
    "-c:a", "aac",
    "-shortest",
    outputPath,
  ];

  await execFileAsync("ffmpeg", args);
  return outputPath;
}

// ---------------------------------------------------------------------------
// Utility: concatenate MP3 files via ffmpeg concat demuxer
// ---------------------------------------------------------------------------

async function concatMp3Files(inputPaths: string[], outputPath: string): Promise<void> {
  if (inputPaths.length === 0) {
    throw new Error("concatMp3Files: no input files provided");
  }
  if (inputPaths.length === 1) {
    fs.copyFileSync(inputPaths[0], outputPath);
    return;
  }

  // Write ffmpeg concat list file in the same directory as output
  const listPath = outputPath.replace(/\.mp3$/, "-concat-list.txt");
  const listContent = inputPaths
    .map((p) => `file '${path.resolve(p).replace(/'/g, "'\\''")}'`)
    .join("\n");
  fs.writeFileSync(listPath, listContent, "utf-8");

  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", listPath,
      "-c", "copy",
      outputPath,
    ]);
  } finally {
    fs.unlinkSync(listPath);
  }
}

function sanitizePathSegment(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
}
