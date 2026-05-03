#!/usr/bin/env npx tsx
/**
 * verify-deterministic-render.ts
 *
 * Renders the SAME storyboard props twice in a fresh process each time, then
 * compares the SHA-256 hash of both output MP4s.  If they differ, the script
 * exits with code 1 and prints a detailed diff of the two hashes.
 *
 * This script is the executable specification for render determinism.
 * It is run by .github/workflows/determinism-check.yml on every PR.
 *
 * ─── What it tests ───────────────────────────────────────────────────────────
 *   Given a fixed storyboard JSON (no network, no TTS — uses pre-baked audio),
 *   two independent `npx remotion render` invocations must produce bit-identical
 *   MP4 output.  This exercises the full Remotion render pipeline including:
 *     • Perlin noise wobble (seed.ts → wobble.ts → Noise(42))
 *     • Spring animations (frame-based)
 *     • BGM ducking (Float32Array pre-computed from storyboard)
 *     • All template renderers (CaptionOverlay, ArchitectureRenderer, etc.)
 *
 * ─── What it does NOT test ───────────────────────────────────────────────────
 *   • TTS audio generation (Edge TTS is network-dependent; cache handles this)
 *   • Whisper timestamp extraction (pinned model version handles this)
 *   • publish metadata timestamps (wall-clock by design; out of render scope)
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *   npx tsx scripts/verify-deterministic-render.ts
 *   npx tsx scripts/verify-deterministic-render.ts --topic load-balancing --session 1
 *   npx tsx scripts/verify-deterministic-render.ts --props path/to/storyboard.json
 *   npx tsx scripts/verify-deterministic-render.ts --composition VerticalLong
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawnSync } from 'child_process';

// ─── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_TOPIC = 'load-balancing';
const DEFAULT_SESSION = 1;
const COMPOSITIONS = ['LongVideo', 'VerticalLong', 'ShortVideo'] as const;
type Composition = typeof COMPOSITIONS[number];

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'output', '_determinism_check');
const FIXTURE_DIR = path.join(PROJECT_ROOT, 'tests', 'fixtures', 'determinism');

// ─── CLI Args ─────────────────────────────────────────────────────────────────

interface Config {
  topic: string;
  session: number;
  propsFile: string | null;
  composition: Composition;
  keepOutput: boolean;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  let topic = DEFAULT_TOPIC;
  let session = DEFAULT_SESSION;
  let propsFile: string | null = null;
  let composition: Composition = 'LongVideo';
  let keepOutput = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--topic' && args[i + 1]) { topic = args[++i]; }
    else if (args[i] === '--session' && args[i + 1]) { session = parseInt(args[++i], 10); }
    else if (args[i] === '--props' && args[i + 1]) { propsFile = path.resolve(args[++i]); }
    else if (args[i] === '--composition' && args[i + 1]) {
      const c = args[++i] as Composition;
      if (!COMPOSITIONS.includes(c)) {
        console.error(`Unknown composition "${c}". Valid: ${COMPOSITIONS.join(', ')}`);
        process.exit(1);
      }
      composition = c;
    } else if (args[i] === '--keep-output') { keepOutput = true; }
  }

  return { topic, session, propsFile, composition, keepOutput };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sha256File(filePath: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Locate or generate a storyboard props JSON file for the given topic+session.
 * Uses a pre-baked fixture if available so we skip TTS (which is non-deterministic
 * on first run).  Falls back to `scripts/render-session.ts --dry-run` which
 * writes `output/props-<topic>-<session>.json` without invoking Remotion.
 */
function resolvePropsFile(topic: string, session: number, propsFile: string | null): string {
  if (propsFile) {
    if (!fs.existsSync(propsFile)) {
      console.error(`ERROR: --props file not found: ${propsFile}`);
      process.exit(1);
    }
    return propsFile;
  }

  // Check for pre-baked fixture (preferred — no network dependency).
  const fixtureFile = path.join(FIXTURE_DIR, `${topic}-${session}.json`);
  if (fs.existsSync(fixtureFile)) {
    console.log(`  Using fixture: ${path.relative(PROJECT_ROOT, fixtureFile)}`);
    return fixtureFile;
  }

  // Generate via dry-run (requires TTS cache to be warm for determinism).
  console.log(`  No fixture found for ${topic}:${session}. Generating via dry-run…`);
  console.log(`  (Tip: commit tests/fixtures/determinism/${topic}-${session}.json for CI speed.)`);

  const generatedFile = path.join(OUTPUT_DIR, `props-${topic}-${session}.json`);
  const result = spawnSync(
    'npx', ['tsx', 'scripts/render-session.ts',
      '--topic', topic,
      '--session', String(session),
      '--dry-run',
      '--out', generatedFile,
    ],
    { cwd: PROJECT_ROOT, stdio: 'inherit', shell: true },
  );

  if (result.status !== 0) {
    console.error('ERROR: Could not generate props via dry-run. Is TTS cache warm?');
    console.error('  Run a full render first:  npx tsx scripts/render-session.ts --topic', topic, '--session', String(session));
    process.exit(1);
  }

  if (!fs.existsSync(generatedFile)) {
    console.error(`ERROR: dry-run did not write props file to ${generatedFile}`);
    process.exit(1);
  }

  return generatedFile;
}

/**
 * Run one Remotion render synchronously and return the output file path.
 */
function runRender(
  propsFile: string,
  composition: Composition,
  outputFile: string,
  runLabel: string,
): void {
  console.log(`\n  [${runLabel}] npx remotion render ${composition} → ${path.basename(outputFile)}`);

  const result = spawnSync(
    'npx', [
      'remotion', 'render',
      composition,
      outputFile,
      '--props', propsFile,
      '--log', 'error',   // suppress Remotion progress noise in CI
    ],
    { cwd: PROJECT_ROOT, stdio: 'inherit', shell: true },
  );

  if (result.status !== 0) {
    console.error(`  [${runLabel}] Render failed (exit ${result.status}).`);
    process.exit(1);
  }

  if (!fs.existsSync(outputFile)) {
    console.error(`  [${runLabel}] Render succeeded but output file not found: ${outputFile}`);
    process.exit(1);
  }

  const sizeBytes = fs.statSync(outputFile).size;
  const sizeMb = (sizeBytes / 1024 / 1024).toFixed(2);
  console.log(`  [${runLabel}] Done. Size: ${sizeMb} MB`);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const config = parseArgs();
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  Deterministic Render Verifier (fix-15)          ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`  Topic:       ${config.topic}`);
  console.log(`  Session:     ${config.session}`);
  console.log(`  Composition: ${config.composition}`);

  ensureDir(OUTPUT_DIR);

  const propsFile = resolvePropsFile(config.topic, config.session, config.propsFile);
  console.log(`  Props:       ${path.relative(PROJECT_ROOT, propsFile)}`);

  // ── Render #1 ─────────────────────────────────────────────────────────────
  const out1 = path.join(OUTPUT_DIR, `render_1.mp4`);
  const out2 = path.join(OUTPUT_DIR, `render_2.mp4`);

  // Remove any stale outputs from a previous run.
  [out1, out2].forEach(f => { if (fs.existsSync(f)) fs.unlinkSync(f); });

  runRender(propsFile, config.composition, out1, 'render 1');
  runRender(propsFile, config.composition, out2, 'render 2');

  // ── Compare ───────────────────────────────────────────────────────────────
  console.log('\n  Computing SHA-256 hashes…');
  const hash1 = sha256File(out1);
  const hash2 = sha256File(out2);

  console.log(`  Render 1:  ${hash1}`);
  console.log(`  Render 2:  ${hash2}`);

  if (hash1 === hash2) {
    console.log('\n  ✅ DETERMINISTIC — both renders are byte-identical.\n');

    if (!config.keepOutput) {
      cleanDir(OUTPUT_DIR);
    }
    process.exit(0);
  } else {
    console.error('\n  ❌ NON-DETERMINISTIC — renders differ!\n');
    console.error('  Diff details:');
    console.error(`    Render 1 hash: ${hash1}`);
    console.error(`    Render 2 hash: ${hash2}`);
    console.error(`    Render 1 size: ${fs.statSync(out1).size} bytes`);
    console.error(`    Render 2 size: ${fs.statSync(out2).size} bytes`);
    console.error('\n  The output files have been kept for inspection:');
    console.error(`    ${out1}`);
    console.error(`    ${out2}`);
    console.error('\n  Checklist for debugging:');
    console.error('    1. grep "Math.random\\|Date.now\\|new Date(" src/');
    console.error('    2. Check if any component reads process.env dynamically at render time.');
    console.error('    3. Check if any component reads the filesystem at render time.');
    console.error('    4. Run with --log verbose to see which frames differ (use ffmpeg framemd5).');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
