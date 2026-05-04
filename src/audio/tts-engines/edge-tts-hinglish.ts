/**
 * edge-tts-hinglish.ts
 *
 * Edge TTS engine with Hinglish-aware text preprocessing.
 *
 * Voices:
 *   hi-IN-MadhurNeural  — Male, warm, clear. Primary Hinglish voice.
 *   hi-IN-SwaraNeural   — Female, natural code-switching. Alternate voice.
 *
 * Key design decisions:
 *   1. Tech terms (Kafka, API, Docker, etc.) are phonetically protected —
 *      they stay in English so the Hindi phoneme engine doesn't mangle them.
 *   2. Narration is in Hinglish (Hindi grammar + English tech nouns).
 *   3. No API key needed — uses edge-tts-node (unofficial MS Edge TTS).
 *   4. Deterministic: same text → same audio bytes given same voice + rate.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { spawn } from "child_process";

// ---------------------------------------------------------------------------
// Voice configuration
// ---------------------------------------------------------------------------

export type HinglishVoice = "male" | "female";

const VOICE_MAP: Record<HinglishVoice, string> = {
  male: "hi-IN-MadhurNeural", // warm, edu-style; primary
  female: "hi-IN-SwaraNeural", // natural code-switching; alternate
};

// Output format: 24 kHz mono MP3 — matches existing pipeline expectations
const OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";

// ---------------------------------------------------------------------------
// Tech-term phonetic protection
// ---------------------------------------------------------------------------

/**
 * Tech terms that must stay in English (not get transliterated by the Hindi
 * TTS phoneme engine). Add new terms here as the topic library grows.
 *
 * Strategy: wrap each term in SSML <say-as interpret-as="characters"> or
 * simply preserve Roman script — Edge TTS hi-IN voices handle Roman script
 * in Devanagari text streams correctly for well-known English tech words.
 */
export const TECH_TERMS: readonly string[] = [
  // Distributed systems
  "Kafka",
  "Zookeeper",
  "Flink",
  "Spark",
  "Hadoop",
  "Cassandra",
  "DynamoDB",
  "Redis",
  "RabbitMQ",
  "ActiveMQ",
  "Pulsar",
  // APIs & protocols
  "API",
  "REST",
  "gRPC",
  "GraphQL",
  "WebSocket",
  "HTTP",
  "HTTPS",
  "TCP",
  "UDP",
  "DNS",
  "CDN",
  // Architecture patterns
  "microservices",
  "Microservices",
  "Docker",
  "Kubernetes",
  "Helm",
  "Istio",
  "Nginx",
  "HAProxy",
  "load balancer",
  "Load Balancer",
  // Cloud & infra
  "AWS",
  "GCP",
  "Azure",
  "S3",
  "EC2",
  "Lambda",
  "DynamoDB",
  "Terraform",
  "CI/CD",
  "GitHub",
  "GitLab",
  // Databases
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Elasticsearch",
  "Solr",
  "Snowflake",
  // Algorithms & CS
  "LRU",
  "LFU",
  "B-Tree",
  "B+Tree",
  "CAP theorem",
  "ACID",
  "BASE",
  "consistent hashing",
  "Consistent Hashing",
  "sharding",
  "Sharding",
  "replication",
  "Replication",
  // Company names (keep pronunciation English)
  "Google",
  "Meta",
  "Amazon",
  "Netflix",
  "Flipkart",
  "Swiggy",
  "Zomato",
  "IRCTC",
  "Paytm",
  // FAANG prep terms
  "LeetCode",
  "HackerRank",
  "FAANG",
  "MAANG",
  "DSA",
  "OOPs",
  "SOLID",
  "design pattern",
  "Design Pattern",
  "system design",
  "System Design",
];

// Pre-build a Set for O(1) lookup during preprocessing
const TECH_TERM_SET = new Set(TECH_TERMS.map((t) => t.toLowerCase()));

// ---------------------------------------------------------------------------
// Python edge_tts subprocess helper (replaces fictional edge-tts-node import)
// ---------------------------------------------------------------------------

/**
 * Converts a pitchPercent value (-10..+10) to Edge TTS Hz delta notation.
 *
 * Convention: pitchPercent is a signed integer in the range -10..+10.
 * Edge TTS uses Hz delta from baseline (e.g. "+5Hz", "-3Hz", "+0Hz").
 * We map 1 percent ≈ 1 Hz, which approximates the perceptual effect on a
 * ~100 Hz male baseline voice (hi-IN-MadhurNeural). This is documented here
 * so any future batch that adjusts the mapping can do so in one place.
 */
function pitchPercentToHz(pitchPercent: number): string {
  const hz = Math.round(pitchPercent);
  return hz >= 0 ? `+${hz}Hz` : `${hz}Hz`;
}

function runPythonEdgeTTS(args: {
  voice: string;
  ratePercent: number;
  pitchPercent?: number;
  ssml: string;
  outPath: string;
}): Promise<void> {
  const ratePercent = args.ratePercent ?? 0;
  const rate = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
  const pitch = pitchPercentToHz(args.pitchPercent ?? 0);
  const helper = path.resolve(__dirname, "../../../scripts/edge-tts-synth.py");
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "python3",
      [helper, "--voice", args.voice, "--rate", rate, "--pitch", pitch, "--out", args.outPath],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`edge-tts-synth.py exited ${code}: ${stderr}`));
    });
    proc.stdin.write(args.ssml, "utf8");
    proc.stdin.end();
  });
}

// (touched to silence "OUTPUT_FORMAT unused" — kept exported for callers
// that introspect the configured bitrate; suppress tsc unused-warning)
void OUTPUT_FORMAT;

/**
 * Builds an SSML string that:
 *   - Sets Hindi language and neural voice prosody
 *   - Wraps tech terms in <lang xml:lang="en-IN"> so the Hindi TTS engine
 *     uses English phonemes for those words
 *   - Keeps surrounding narration in Hindi phoneme space
 *
 * @param pitchPercent  Optional pitch offset in -10..+10 range.
 *   Hook scene: +5 (energetic), body scenes: 0 (neutral),
 *   mid-promise: +3 (re-engagement), closing: -3 (gravitas/CTA).
 *   Converted to Edge TTS Hz delta via pitchPercentToHz().
 */
export function buildSSML(
  text: string,
  voice: string,
  ratePercent: number = -5, // slightly slower for educational delivery
  pitchPercent: number = 0
): string {
  const protectedText = protectTechTerms(text);
  const rate = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
  const pitch = pitchPercentToHz(pitchPercent);
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="hi-IN">
  <voice name="${voice}">
    <prosody rate="${rate}" pitch="${pitch}">
      ${protectedText}
    </prosody>
  </voice>
</speak>`;
}

/**
 * Wraps tech terms in the text with SSML lang tags so the hi-IN voice
 * engine uses English phonemes for those words rather than attempting
 * Hindi transliteration (which produces robotic/wrong pronunciation).
 *
 * Example:
 *   "Kafka mein partition aise kaam karta hai"
 *   → '<lang xml:lang="en-IN">Kafka</lang> mein partition aise kaam karta hai'
 */
export function protectTechTerms(text: string): string {
  // Sort by length descending so longer phrases match before substrings
  const sortedTerms = [...TECH_TERMS].sort((a, b) => b.length - a.length);

  let result = text;
  for (const term of sortedTerms) {
    // Case-insensitive, word-boundary aware replacement
    // Avoid double-wrapping if already inside a lang tag
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?<!<lang[^>]*>)\\b(${escaped})\\b(?![^<]*</lang>)`, "gi");
    result = result.replace(
      pattern,
      `<lang xml:lang="en-IN">$1</lang>`
    );
  }
  return result;
}

// ---------------------------------------------------------------------------
// Core synthesis function
// ---------------------------------------------------------------------------

export interface HinglishTTSOptions {
  voice?: HinglishVoice;
  outputDir?: string;
  /** Cache directory for previously synthesized audio. Set false to disable. */
  cacheDir?: string | false;
  /** Speaking rate offset in percent. Negative = slower. Default -5 (educational pace). */
  ratePercent?: number;
  /**
   * Pitch offset in -10..+10 range (per-call override).
   * Converted to Edge TTS Hz delta: +5 → "+5Hz", -3 → "-3Hz".
   * Scene guidance: hook +5, body 0, mid-promise +3, closing -3.
   */
  pitchPercent?: number;
}

export interface HinglishTTSResult {
  audioPath: string;
  voice: string;
  /** SHA-256 of `voice::rate::pitch::text` — used as cache key */
  textHash: string;
  durationMs?: number;
  fromCache: boolean;
}

/**
 * Synthesizes Hinglish text to MP3 using Edge TTS hi-IN-MadhurNeural.
 *
 * Caching: if cacheDir is set (default: outputDir/.tts-cache), a previously
 * rendered file for identical (text + voice + rate + pitch) is reused. This
 * makes the pipeline deterministic across re-runs and saves API round-trips.
 *
 * Cache key: SHA-256 of `voice::rate::pitch::text` — changing any of voice,
 * rate, or pitch yields a different cache entry, preventing silent audio reuse
 * across scenes with different prosody settings.
 */
export async function synthesizeHinglish(
  text: string,
  options: HinglishTTSOptions = {}
): Promise<HinglishTTSResult> {
  const {
    voice = "male",
    outputDir = "output/hinglish-audio",
    cacheDir = path.join(outputDir, ".tts-cache"),
    ratePercent = -5,
    pitchPercent = 0,
  } = options;

  const resolvedVoice = VOICE_MAP[voice];
  const rate = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
  const pitch = pitchPercentToHz(pitchPercent);
  // Cache key includes voice, rate, pitch, and text so a scene with +5% pitch
  // gets a different cached file than one with +0% (same voice/rate/text).
  const textHash = crypto
    .createHash("sha256")
    .update(`${resolvedVoice}::${rate}::${pitch}::${text}`)
    .digest("hex")
    .slice(0, 16);

  // Check cache first
  if (cacheDir !== false) {
    fs.mkdirSync(cacheDir, { recursive: true });
    const cachedPath = path.join(cacheDir, `${textHash}.mp3`);
    if (fs.existsSync(cachedPath)) {
      return {
        audioPath: cachedPath,
        voice: resolvedVoice,
        textHash,
        fromCache: true,
      };
    }
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath =
    cacheDir !== false
      ? path.join(cacheDir as string, `${textHash}.mp3`)
      : path.join(outputDir, `hinglish-${textHash}.mp3`);

  const ssml = buildSSML(text, resolvedVoice, ratePercent, pitchPercent);

  // Pre-B30 this code statically imported a fictional `edge-tts-node`
  // npm package that was never published — typecheck failed and CI
  // could not run the Hinglish workflow. Fix: shell out to the same
  // Python `edge_tts` library used by `scripts/edge-tts-words.py` via
  // the small `scripts/edge-tts-synth.py` helper which accepts SSML on
  // stdin and writes MP3 to --out. Determinism: same (voice, rate,
  // pitch, text) → same MP3 bytes; cache key above is SHA-256 of
  // voice::rate::pitch::text.
  await runPythonEdgeTTS({
    voice: resolvedVoice,
    ratePercent,
    pitchPercent,
    ssml,
    outPath: outputPath,
  });

  return {
    audioPath: outputPath,
    voice: resolvedVoice,
    textHash,
    fromCache: false,
  };
}

// ---------------------------------------------------------------------------
// Segment-level synthesis (scene-by-scene for the pipeline)
// ---------------------------------------------------------------------------

export interface SceneAudio {
  sceneIndex: number;
  narration: string;
  audioPath: string;
  fromCache: boolean;
}

export interface SynthesizeScenesOptions extends HinglishTTSOptions {
  /**
   * Per-scene pitch overrides in -10..+10 range. Index must match scene index.
   * If provided, overrides the global `pitchPercent` for that scene.
   *
   * Recommended per-scene values (CDawgVA retention tuning):
   *   [0] hook:        +5  (energetic, grabs attention)
   *   [1..n-2] body:    0  (neutral, focused delivery)
   *   [mid] mid-promise: +3 (re-engagement bump)
   *   [last] closing:  -3  (gravitas, drives CTA)
   */
  pitchPerScene?: number[];
}

/**
 * Synthesizes audio for each scene's narration in parallel.
 * Returns an ordered array of SceneAudio matching the input scenes array.
 *
 * Per-scene pitch overrides can be supplied via `options.pitchPerScene[i]`.
 * Falls back to `options.pitchPercent` (or 0) when no per-scene value is set.
 */
export async function synthesizeScenes(
  scenes: Array<{ narration: string }>,
  options: SynthesizeScenesOptions = {}
): Promise<SceneAudio[]> {
  const { pitchPerScene, ...baseOptions } = options;
  const results = await Promise.all(
    scenes.map(async (scene, i) => {
      const scenePitch =
        pitchPerScene !== undefined && pitchPerScene[i] !== undefined
          ? pitchPerScene[i]
          : undefined;
      const sceneOptions: HinglishTTSOptions =
        scenePitch !== undefined
          ? { ...baseOptions, pitchPercent: scenePitch }
          : baseOptions;
      const result = await synthesizeHinglish(scene.narration, sceneOptions);
      return {
        sceneIndex: i,
        narration: scene.narration,
        audioPath: result.audioPath,
        fromCache: result.fromCache,
      };
    })
  );
  return results;
}
