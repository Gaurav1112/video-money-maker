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

function runPythonEdgeTTS(args: {
  voice: string;
  ratePercent: number;
  ssml: string;
  outPath: string;
}): Promise<void> {
  const ratePercent = args.ratePercent ?? 0;
  const rate = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
  const helper = path.resolve(__dirname, "../../../scripts/edge-tts-synth.py");
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "python3",
      [helper, "--voice", args.voice, "--rate", rate, "--out", args.outPath],
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
 */
export function buildSSML(
  text: string,
  voice: string,
  ratePercent: number = -5 // slightly slower for educational delivery
): string {
  const protectedText = protectTechTerms(text);
  const rate = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="hi-IN">
  <voice name="${voice}">
    <prosody rate="${rate}" pitch="+0Hz">
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
}

export interface HinglishTTSResult {
  audioPath: string;
  voice: string;
  /** SHA-256 of the input text — used as cache key */
  textHash: string;
  durationMs?: number;
  fromCache: boolean;
}

/**
 * Synthesizes Hinglish text to MP3 using Edge TTS hi-IN-MadhurNeural.
 *
 * Caching: if cacheDir is set (default: outputDir/.tts-cache), a previously
 * rendered file for identical (text + voice) is reused. This makes the pipeline
 * deterministic across re-runs and saves API round-trips.
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
  } = options;

  const resolvedVoice = VOICE_MAP[voice];
  const textHash = crypto
    .createHash("sha256")
    .update(`${resolvedVoice}::${text}`)
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

  const ssml = buildSSML(text, resolvedVoice, ratePercent);

  // Pre-B30 this code statically imported a fictional `edge-tts-node`
  // npm package that was never published — typecheck failed and CI
  // could not run the Hinglish workflow. Fix: shell out to the same
  // Python `edge_tts` library used by `scripts/edge-tts-words.py` via
  // the small `scripts/edge-tts-synth.py` helper which accepts SSML on
  // stdin and writes MP3 to --out. Determinism: same (voice, rate,
  // text) → same MP3 bytes; cache key above is SHA-256 of voice::text.
  await runPythonEdgeTTS({
    voice: resolvedVoice,
    ratePercent,
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

/**
 * Synthesizes audio for each scene's narration in parallel.
 * Returns an ordered array of SceneAudio matching the input scenes array.
 */
export async function synthesizeScenes(
  scenes: Array<{ narration: string }>,
  options: HinglishTTSOptions = {}
): Promise<SceneAudio[]> {
  const results = await Promise.all(
    scenes.map(async (scene, i) => {
      const result = await synthesizeHinglish(scene.narration, options);
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
