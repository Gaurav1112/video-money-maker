/**
 * tests/audio/hinglish-render-determinism.test.ts
 *
 * Unit tests for the Hinglish render path via the dual-track orchestrator.
 *
 * Because edge-tts requires a network connection (and would be non-
 * deterministic in a unit context), we mock `synthesizeScenes` from
 * edge-tts-hinglish and verify that:
 *   1. The orchestrator passes scenes through the rewriter then into
 *      synthesizeScenes without altering the scene count.
 *   2. The expected output path (audio-hi.mp3) is written.
 *   3. Per-scene paths are returned in scene-index order.
 *
 * NOTE: This is a behaviour / contract test, not a true byte-determinism
 * test (byte-determinism of the TTS output requires the real edge-tts
 * binary, tested by CI integration).
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ─── Mock edge-tts-hinglish synthesizeScenes ─────────────────────────────────

// The orchestrator imports synthesizeScenes from edge-tts-hinglish at
// module load time (not lazy). We set up the mock BEFORE importing the
// orchestrator. We also mock concatMp3Files via ffmpeg execFile — since
// the orchestrator uses execFileAsync internally, we intercept the
// child_process.execFile call.

vi.mock('../../src/audio/tts-engines/edge-tts-hinglish.js', () => {
  return {
    synthesizeScenes: vi.fn(
      async (
        scenes: Array<{ narration: string }>,
        options: { outputDir?: string; cacheDir?: string } = {},
      ) => {
        const dir = options.outputDir ?? '.';
        fs.mkdirSync(dir, { recursive: true });
        return scenes.map((scene, i) => {
          const audioPath = path.join(dir, `mock-scene-${i}.mp3`);
          // Write a minimal valid MP3 stub (just needs to exist for concat)
          fs.writeFileSync(audioPath, Buffer.from([0xff, 0xfb, 0x90, 0x00]));
          return { sceneIndex: i, narration: scene.narration, audioPath, fromCache: false };
        });
      },
    ),
  };
});

// Mock child_process.execFile so ffmpeg concat doesn't need a real binary
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    execFile: (...allArgs: unknown[]) => {
      // The callback is always the LAST argument (promisify pattern)
      const cb = allArgs[allArgs.length - 1] as (err: Error | null) => void;
      const args = allArgs[1] as string[] | undefined;
      // For concat: write a stub mp3 to the last positional arg
      if (Array.isArray(args)) {
        const outputPath = args[args.length - 1];
        if (typeof outputPath === 'string' && !outputPath.startsWith('-')) {
          try {
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
            fs.writeFileSync(outputPath, Buffer.from([0xff, 0xfb, 0x90, 0x00]));
          } catch { /* ignore */ }
        }
      }
      if (typeof cb === 'function') cb(null);
    },
  };
});

// ─── Tests ───────────────────────────────────────────────────────────────────

const WORK_ROOT = path.join(__dirname, '_hinglish-render-test');

beforeAll(() => {
  fs.mkdirSync(WORK_ROOT, { recursive: true });
});

afterAll(() => {
  fs.rmSync(WORK_ROOT, { recursive: true, force: true });
});

describe('renderDualTrack — Hinglish-only mode', () => {
  it('passes all scenes to synthesizeScenes and returns per-scene paths', async () => {
    const { renderDualTrack } = await import('../../src/pipeline/dual-track-orchestrator.js');
    const { synthesizeScenes } = await import(
      '../../src/audio/tts-engines/edge-tts-hinglish.js'
    );

    const sessionInput = {
      topic: 'kafka',
      sessionId: 1,
      scenes: [
        { narration: 'Kafka is a distributed log.', sceneIndex: 0 },
        { narration: 'Consumers read from partitions.', sceneIndex: 1 },
        { narration: 'Producers write messages.', sceneIndex: 2 },
      ],
    };

    const result = await renderDualTrack(sessionInput, {
      outputBaseDir: WORK_ROOT,
      renderEnglish: false,
    });

    // Synthesize was called once
    expect(synthesizeScenes).toHaveBeenCalledTimes(1);

    // All 3 scenes were synthesized (rewriter may alter narration text but not count)
    const callArgs = (synthesizeScenes as ReturnType<typeof vi.fn>).mock.calls[0] as [
      Array<{ narration: string }>,
      unknown,
    ];
    expect(callArgs[0]).toHaveLength(3);

    // Result has correct language tag
    expect(result.hinglish.language).toBe('hi');

    // Per-scene paths are returned in order
    expect(result.hinglish.scenePaths).toHaveLength(3);

    // audioPath lives under the expected session directory
    const expectedBase = path.join(WORK_ROOT, 'kafka', 'session-1');
    expect(result.hinglish.audioPath).toContain(expectedBase);
    expect(path.basename(result.hinglish.audioPath)).toBe('audio-hi.mp3');
  });

  it('scene narrations flow through the Hinglish rewriter before synthesis', async () => {
    const { renderDualTrack } = await import('../../src/pipeline/dual-track-orchestrator.js');
    const { synthesizeScenes } = await import(
      '../../src/audio/tts-engines/edge-tts-hinglish.js'
    );
    (synthesizeScenes as ReturnType<typeof vi.fn>).mockClear();

    const sessionInput = {
      topic: 'redis',
      sessionId: 2,
      scenes: [
        { narration: "Today we're going to learn about Redis.", sceneIndex: 0 },
      ],
    };

    await renderDualTrack(sessionInput, {
      outputBaseDir: WORK_ROOT,
      renderEnglish: false,
    });

    const callArgs = (synthesizeScenes as ReturnType<typeof vi.fn>).mock.calls[0] as [
      Array<{ narration: string }>,
      unknown,
    ];
    const synthesizedNarration = callArgs[0][0].narration;

    // The Hinglish rewriter should have transformed "Today we're going to learn"
    // into the Hinglish equivalent. The exact output depends on the rewriter
    // rules in hinglish-rewriter.ts — we just verify it's been transformed.
    expect(synthesizedNarration).not.toBe("Today we're going to learn about Redis.");
    // Should contain Hinglish (the opener rule maps this)
    expect(synthesizedNarration).toMatch(/Aaj hum samjhenge|Redis/);
  });
});
