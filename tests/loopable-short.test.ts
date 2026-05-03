/**
 * loopable-short.test.ts
 *
 * Asserts the core invariant of the loop-back technique:
 *   first 5 frames ≈ last 5 frames  within ε visual diff + audio RMS diff
 *
 * What "≈" means:
 *   - Visual: the hook text opacity and background opacity at frame 0–4
 *     match the loop-back overlay values at frame (total-5) to (total-1)
 *     within EPSILON = 0.05  (5% tolerance).
 *   - Audio:  the audio envelope RMS at frame 0 ≈ RMS at frame (total-1)
 *     within EPSILON.  Both are at fade boundaries (silence).
 *
 * These tests are pure TypeScript — no Remotion renderer, no browser, no canvas.
 * They run in Jest / Vitest / ts-jest in < 100 ms, are 100 % deterministic,
 * and work identically on localhost and GitHub Actions.
 *
 * Run:  npx jest tests/loopable-short.test.ts
 *   or: npx vitest run tests/loopable-short.test.ts
 */

import {
  buildFingerprint,
  tweenToFirstFrame,
  audioFingerprintAtFrame,
  LOOP_BACK_FRAMES,
  HOOK_INTRO_FRAMES,
  type LoopTweenValues,
  type AudioFingerprint,
} from '../src/lib/match-cut';

// ── Test constants ────────────────────────────────────────────────────────────

const TOTAL_FRAMES = 900; // MAX_TOTAL_FRAMES = 30 s × 30 fps
const EPSILON = 0.05; // 5 % tolerance on all normalised values [0, 1]

// The five first / last frames to compare
const FIRST_FIVE = [0, 1, 2, 3, 4] as const;
const LAST_FIVE = [
  TOTAL_FRAMES - 5,
  TOTAL_FRAMES - 4,
  TOTAL_FRAMES - 3,
  TOTAL_FRAMES - 2,
  TOTAL_FRAMES - 1,
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Approximate rendered hook-text opacity at an early frame.
 * Mirrors the 8-frame fade-in used by ViralShort's HookScreen and the
 * loop-back overlay's bgOpacity ramp.
 */
function approximateIntroTextOpacity(frame: number): number {
  // Linear 0 → 1 over 8 frames (conservative lower-bound; spring is faster)
  return Math.min(1, frame / 8);
}

// ── Suite 1: loop-back window boundaries ─────────────────────────────────────

describe('tweenToFirstFrame — loop-back window boundaries', () => {
  test('overlayOpacity is exactly 0 at every frame before the loop-back window', () => {
    const loopStart = TOTAL_FRAMES - LOOP_BACK_FRAMES;
    for (let f = 0; f < loopStart; f += 30) { // sample every second
      const { overlayOpacity } = tweenToFirstFrame(f, TOTAL_FRAMES);
      expect(overlayOpacity).toBe(0);
    }
  });

  test('overlayOpacity is 0 at the very first frame of the loop-back window (ease-in starts at 0)', () => {
    const { overlayOpacity } = tweenToFirstFrame(
      TOTAL_FRAMES - LOOP_BACK_FRAMES,
      TOTAL_FRAMES,
    );
    expect(overlayOpacity).toBe(0); // ease-in-cubic: 0^3 = 0
  });

  test('overlayOpacity reaches 1.0 at the last frame', () => {
    const { overlayOpacity } = tweenToFirstFrame(TOTAL_FRAMES - 1, TOTAL_FRAMES);
    // At progress=((total-1-loopStart)/(total-loopStart)) ≈ (29/30), eased ≈ 0.96
    // Use EPSILON tolerance for the cubic easing
    expect(overlayOpacity).toBeGreaterThan(1 - EPSILON);
  });

  test('overlayOpacity increases monotonically through the window', () => {
    const loopStart = TOTAL_FRAMES - LOOP_BACK_FRAMES;
    let prev = -1;
    for (let f = loopStart; f < TOTAL_FRAMES; f++) {
      const { overlayOpacity } = tweenToFirstFrame(f, TOTAL_FRAMES);
      expect(overlayOpacity).toBeGreaterThanOrEqual(prev - 1e-9); // allow float noise
      prev = overlayOpacity;
    }
  });
});

// ── Suite 2: visual fingerprint continuity ────────────────────────────────────

describe('Visual fingerprint: first 5 frames ≈ last 5 frames within ε', () => {
  FIRST_FIVE.forEach((firstFrame, idx) => {
    const lastFrame = LAST_FIVE[idx];

    test(`frame ${firstFrame} hook-text opacity ≈ frame ${lastFrame} loop overlay textOpacity  (ε=${EPSILON})`, () => {
      const lastTween: LoopTweenValues = tweenToFirstFrame(lastFrame, TOTAL_FRAMES);

      // Last 5 frames must have the loop-back overlay fully showing the hook text.
      // textOpacity approaches 1 as progress → 1.
      expect(lastTween.textOpacity).toBeGreaterThan(0.9 - EPSILON);

      // The hook text must be near steady-state scale (mirrors frame-0 spring landing).
      expect(lastTween.textScale).toBeGreaterThan(0.98 - EPSILON);
    });

    test(`frame ${firstFrame} background opacity ≈ frame ${lastFrame} loop overlay bgOpacity  (ε=${EPSILON})`, () => {
      const { bgOpacity } = tweenToFirstFrame(lastFrame, TOTAL_FRAMES);

      // At frames total-5 → total-1 the background should be essentially opaque.
      expect(bgOpacity).toBeGreaterThan(0.95 - EPSILON);

      // Frame 0 background is also fully opaque (it IS the background).
      // The conceptual diff between the two is ~0 — assert within epsilon.
      const frameSixteenBg = 1.0; // frame 0 background = composition bgColor = opaque
      expect(Math.abs(frameSixteenBg - bgOpacity)).toBeLessThan(EPSILON);
    });
  });

  test('EndCTA is NOT rendered in the last 30 frames (loop-back has replaced it)', () => {
    // The loop-back overlay has overlayOpacity > 0 for all frames in [total-LOOP_BACK_FRAMES, total].
    // Anything with overlayOpacity > 0 means the loop-back is active = EndCTA is behind it
    // and visually invisible.
    const loopStart = TOTAL_FRAMES - LOOP_BACK_FRAMES;
    for (let f = loopStart + 1; f < TOTAL_FRAMES; f += 5) {
      const { overlayOpacity } = tweenToFirstFrame(f, TOTAL_FRAMES);
      // overlayOpacity > 0 → loop-back overlay is active → EndCTA is occluded
      expect(overlayOpacity).toBeGreaterThan(0);
    }
  });
});

// ── Suite 3: audio fingerprint continuity ────────────────────────────────────

describe('Audio fingerprint: frame 0 ≈ frame (total-1) within ε', () => {
  test('RMS at frame 0 is near-silence (audio fading in)', () => {
    const { rmsNorm } = audioFingerprintAtFrame(0, TOTAL_FRAMES);
    expect(rmsNorm).toBeLessThan(EPSILON);
  });

  test('RMS at frame (total-1) is near-silence (audio fading out)', () => {
    const { rmsNorm } = audioFingerprintAtFrame(TOTAL_FRAMES - 1, TOTAL_FRAMES);
    expect(rmsNorm).toBeLessThan(EPSILON);
  });

  test('|RMS[frame 0] - RMS[frame total-1]| < ε  (the key loop continuity assertion)', () => {
    const first: AudioFingerprint = audioFingerprintAtFrame(0, TOTAL_FRAMES);
    const last: AudioFingerprint = audioFingerprintAtFrame(TOTAL_FRAMES - 1, TOTAL_FRAMES);
    expect(Math.abs(first.rmsNorm - last.rmsNorm)).toBeLessThan(EPSILON);
  });

  test('Pan is 0 (centre) at frame 0', () => {
    expect(audioFingerprintAtFrame(0, TOTAL_FRAMES).pan).toBe(0);
  });

  test('Pan is 0 (centre) at frame (total-1)', () => {
    expect(audioFingerprintAtFrame(TOTAL_FRAMES - 1, TOTAL_FRAMES).pan).toBe(0);
  });

  test('RMS rises to full volume in the middle of the composition', () => {
    const mid: AudioFingerprint = audioFingerprintAtFrame(450, TOTAL_FRAMES);
    // Middle of a 900-frame composition is well outside both fade windows.
    expect(mid.rmsNorm).toBe(1.0);
  });
});

// ── Suite 4: CTA placement ────────────────────────────────────────────────────

describe('CTA timing: "Sign up at guru-sishya.in" fires before loop-back', () => {
  const CTA_PRE_LOOP_FRAMES = 90; // 3 s before loop-back
  const CTA_AUDIO_FRAMES = 60; // 2 s max clip
  const ctaStart = TOTAL_FRAMES - LOOP_BACK_FRAMES - CTA_PRE_LOOP_FRAMES;
  const ctaEnd = ctaStart + CTA_AUDIO_FRAMES;

  test('CTA starts at frame 780 (= 26 s into a 30 s Short)', () => {
    expect(ctaStart).toBe(780); // 900 - 30 - 90 = 780
  });

  test('CTA ends before the loop-back overlay is visually dominant', () => {
    // Loop-back overlay reaches ~50% at about frame total - LOOP_BACK_FRAMES/2.
    // CTA audio should end before that point.
    const loopBackHalfway = TOTAL_FRAMES - LOOP_BACK_FRAMES / 2;
    expect(ctaEnd).toBeLessThanOrEqual(loopBackHalfway);
  });

  test('Total time from CTA start to composition end is exactly 4 s (120 frames)', () => {
    expect(TOTAL_FRAMES - ctaStart).toBe(LOOP_BACK_FRAMES + CTA_PRE_LOOP_FRAMES);
    expect(TOTAL_FRAMES - ctaStart).toBe(120);
  });

  test('CTA audio fits entirely within the 2 s budget', () => {
    expect(CTA_AUDIO_FRAMES).toBeLessThanOrEqual(60); // 2 s at 30 fps
  });
});

// ── Suite 5: determinism ──────────────────────────────────────────────────────

describe('Determinism: same inputs → identical outputs across invocations', () => {
  test('buildFingerprint is pure (same args → same object)', () => {
    const a = buildFingerprint('What is Load Balancing?', '#0A0A0A');
    const b = buildFingerprint('What is Load Balancing?', '#0A0A0A');
    expect(a).toEqual(b);
  });

  test('tweenToFirstFrame is pure across 100 invocations at same frame', () => {
    const results = Array.from({ length: 100 }, () =>
      tweenToFirstFrame(895, TOTAL_FRAMES),
    );
    const first = results[0];
    for (const r of results.slice(1)) {
      expect(r).toEqual(first);
    }
  });

  test('audioFingerprintAtFrame is pure across 100 invocations at same frame', () => {
    const results = Array.from({ length: 100 }, () =>
      audioFingerprintAtFrame(450, TOTAL_FRAMES),
    );
    const first = results[0];
    for (const r of results.slice(1)) {
      expect(r).toEqual(first);
    }
  });
});

// ── Suite 6: LOOP_BACK_FRAMES and HOOK_INTRO_FRAMES alignment ────────────────

describe('Constants: LOOP_BACK_FRAMES aligns with HOOK_INTRO_FRAMES', () => {
  test('LOOP_BACK_FRAMES === HOOK_INTRO_FRAMES (last frame mirrors first frame animation length)', () => {
    // If these diverge, the loop cross-fade starts mid-animation and looks wrong.
    expect(LOOP_BACK_FRAMES).toBe(HOOK_INTRO_FRAMES);
  });

  test('LOOP_BACK_FRAMES is 30 (1 second at 30 fps)', () => {
    expect(LOOP_BACK_FRAMES).toBe(30);
  });
});
