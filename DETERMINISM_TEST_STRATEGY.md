# Determinism Testing Strategy — video-money-maker

**Challenge:** Remotion renders are non-deterministic — same input ≠ same output.
- Compression artifacts vary
- Font rendering differs by system/build
- GPU/CPU variations cause pixel differences
- Frame timing can vary by ±1-2ms

**Solution:** Multi-layered determinism validation (advisory, not strict)

---

## Determinism Testing Layers

### Layer 1: Structural Determinism ✅ STRICT (CI Gate)

**What:** Input always produces same structure (duration, dimensions, format)

**Why:** Structure must be identical — encoding parameters, video length, resolution

#### Tests
```typescript
// tests/determinism/structural.test.ts
describe('Structural Determinism — STRICT', () => {
  describe('Shock Opener Duration', () => {
    it('always renders 3000ms (90 frames @ 30fps)', async () => {
      const configs = [
        { wrong: 'A', right: 'B' },
        { wrong: 'X', right: 'Y' },
        { wrong: '123', right: '456' },
      ];

      for (const config of configs) {
        const video = await renderShockOpener(config);
        expect(video.durationMs).toBe(3000); // EXACT
        expect(video.frameCount).toBe(90); // EXACT
        expect(video.fps).toBe(30); // EXACT
      }
    });

    it('video format is always 1080x1920 H.264', async () => {
      const videos = await Promise.all([
        renderShockOpener({ wrong: 'A', right: 'B' }),
        renderShockOpener({ wrong: 'X', right: 'Y' }),
        renderShockOpener({ wrong: '123', right: '456' }),
      ]);

      videos.forEach(video => {
        expect(video.width).toBe(1080); // EXACT
        expect(video.height).toBe(1920); // EXACT
        expect(video.codec).toBe('h264'); // EXACT
        expect(video.bitrate).toBe(5000000); // 5Mbps target
      });
    });
  });

  describe('Course Lesson Duration', () => {
    it('all 16 lessons render within tolerance (±0.5%)', async () => {
      const curriculum = await loadCourseCurriculum();
      
      for (const module of curriculum.modules) {
        for (const lesson of module.lessons) {
          const video1 = await renderLesson(lesson);
          const video2 = await renderLesson(lesson);
          
          // Duration should match within 0.5% (frame jitter)
          const delta = Math.abs(video1.durationMs - video2.durationMs);
          const tolerance = video1.durationMs * 0.005; // 0.5%
          
          expect(delta).toBeLessThanOrEqual(tolerance);
        }
      }
    });
  });

  describe('B-Roll Composition', () => {
    it('clip duration always matches metadata', async () => {
      const manifest = await loadBrollManifest();
      
      for (const clip of manifest.clips.slice(0, 5)) { // Test sample
        const actual = await measureClipDuration(clip.url);
        
        // Allow ±100ms tolerance (file format variance)
        expect(Math.abs(actual - clip.durationSec * 1000)).toBeLessThan(100);
      }
    });
  });

  describe('Audio Sync', () => {
    it('video + audio duration match exactly', async () => {
      const video = await renderShockOpener({ wrong: 'A', right: 'B' });
      
      expect(video.videoDurationMs).toBe(video.audioDurationMs);
    });

    it('narration + video lip-sync within 40ms', async () => {
      const lesson = await loadLesson('module-1-lesson-1');
      const video = await renderLesson(lesson);
      
      // Check lip-sync frames
      const syncOffsets = await measureLipSync(video);
      
      syncOffsets.forEach(offset => {
        expect(Math.abs(offset)).toBeLessThan(40); // 40ms tolerance
      });
    });
  });
});
```

**Assertions:** ✅ Exact values (no tolerance)
**Pass Rate Target:** 100%
**CI Gate:** BLOCKING (fails build if violated)

---

### Layer 2: Semantic Determinism ✅ STRICT (CI Gate)

**What:** Same input always produces same content/meaning (text, colors, layout)

**Why:** Users must see identical video structure, text, composition

#### Tests
```typescript
// tests/determinism/semantic.test.ts
describe('Semantic Determinism — STRICT', () => {
  describe('Text Content', () => {
    it('shock opener text is identical on re-renders', async () => {
      const config = { wrong: 'REST APIs', right: 'gRPC' };
      
      const [render1, render2] = await Promise.all([
        renderShockOpener(config),
        renderShockOpener(config),
      ]);

      // Extract text from both renders
      const text1 = extractTextFromVideo(render1);
      const text2 = extractTextFromVideo(render2);

      expect(text1).toEqual(text2);
    });

    it('course lesson narration is identical', async () => {
      const lesson = await loadLesson('module-1-lesson-1');
      
      const [audio1, audio2] = await Promise.all([
        generateNarration(lesson.script, { seed: 'deterministic' }),
        generateNarration(lesson.script, { seed: 'deterministic' }),
      ]);

      // Audio content should be identical (TTS with seed)
      const hash1 = hashAudioContent(audio1);
      const hash2 = hashAudioContent(audio2);

      expect(hash1).toBe(hash2);
    });
  });

  describe('Layout & Positioning', () => {
    it('shock opener [WRONG | RIGHT] panes always positioned identically', async () => {
      const configs = [
        { wrong: 'A', right: 'B' },
        { wrong: 'A very long text', right: 'B' },
      ];

      for (const config of configs) {
        const [render1, render2] = await Promise.all([
          renderShockOpener(config),
          renderShockOpener(config),
        ]);

        const layout1 = extractLayout(render1);
        const layout2 = extractLayout(render2);

        // Panes must be at exact same coordinates
        expect(layout1.wrongPaneX).toBe(layout2.wrongPaneX);
        expect(layout1.wrongPaneY).toBe(layout2.wrongPaneY);
        expect(layout1.rightPaneX).toBe(layout2.rightPaneX);
        expect(layout1.rightPaneY).toBe(layout2.rightPaneY);
      }
    });
  });

  describe('Color Consistency', () => {
    it('thumbnail colors match design spec', async () => {
      const thumbnail = await renderThumbnail({
        title: 'Kubernetes 101',
      });

      const colors = extractColors(thumbnail);
      
      // Primary brand color (e.g., #3B82F6)
      expect(colors.primary).toBe('#3B82F6');
      
      // Background color
      expect(colors.background).toBe('#000000');
    });
  });
});
```

**Assertions:** ✅ Semantic equality (content, not pixels)
**Pass Rate Target:** 100%
**CI Gate:** BLOCKING

---

### Layer 3: Perceptual Determinism ⚠️ ADVISORY (Not Strict)

**What:** Visual output is perceptually similar (humans see same video)
- Allows up to 5% pixel difference
- Tracks visual diffs for analysis
- Non-blocking (warns, but doesn't fail CI)

**Why:** Compression, anti-aliasing, font rendering differ by OS/GPU

#### Tests
```typescript
// tests/determinism/perceptual.test.ts
import {
  captureFrame,
  compareFramesPerceptual,
  VisualDiff,
} from '@/test-utils/visual-diff';

describe('Perceptual Determinism — ADVISORY', () => {
  describe('Frame Pixel Consistency', () => {
    it('shock opener first frame differs <5% pixel-wise', async () => {
      const config = { wrong: 'REST', right: 'gRPC' };
      
      // Render multiple times
      const frames = await Promise.all([
        captureFrame(renderShockOpener(config), 0),
        captureFrame(renderShockOpener(config), 0),
        captureFrame(renderShockOpener(config), 0),
      ]);

      // Compare each to first
      for (let i = 1; i < frames.length; i++) {
        const diff = compareFramesPerceptual(frames[0], frames[i]);

        console.log(
          `Render ${i}: ${diff.pixelDifferencePercent.toFixed(2)}% difference`
        );

        // Advisory: log but don't fail
        if (diff.pixelDifferencePercent > 5) {
          console.warn(
            `⚠️  Pixel diff exceeds 5% for frame ${i}. Saving visual diff...`
          );
          await saveVisualDiff(
            `shock-opener-frame-0-render-${i}`,
            frames[0],
            frames[i],
            diff
          );
        }
      }
    });

    it('thumbnail renders with consistent quality', async () => {
      const configs = [
        { title: 'Kubernetes', seed: 'test-1' },
        { title: 'Kubernetes', seed: 'test-1' }, // Same seed
      ];

      const [thumb1, thumb2] = await Promise.all([
        renderThumbnail(configs[0]),
        renderThumbnail(configs[1]),
      ]);

      const firstFrame1 = captureFrame(thumb1, 0);
      const firstFrame2 = captureFrame(thumb2, 0);

      const diff = compareFramesPerceptual(firstFrame1, firstFrame2);

      // With seeding, should be nearly identical
      console.log(`Thumbnail perceptual diff: ${diff.pixelDifferencePercent}%`);

      if (diff.pixelDifferencePercent > 2) {
        console.warn('⚠️  Determinism warning: unusual pixel diff');
      }
    });
  });

  describe('Audio Waveform Consistency', () => {
    it('TTS narration waveforms are similar', async () => {
      const script = 'Learn about Kubernetes';
      const seed = 'deterministic';

      const [audio1, audio2] = await Promise.all([
        generateNarration(script, { seed }),
        generateNarration(script, { seed }),
      ]);

      const waveform1 = extractWaveform(audio1);
      const waveform2 = extractWaveform(audio2);

      // Perceptual comparison (not sample-by-sample)
      const diff = compareWaveformsPerceptual(waveform1, waveform2);

      console.log(`Audio perceptual diff: ${diff.percentDifferent}%`);

      if (diff.percentDifferent > 1) {
        console.warn(
          '⚠️  Audio waveform differs — re-generate narration if needed'
        );
      }
    });
  });
});
```

**Assertions:** ⚠️ Perceptual similarity (logged, not enforced)
**Pass Rate Target:** 95%+ (visual diffs tracked)
**CI Gate:** NON-BLOCKING (advisory only)

---

### Layer 4: Visual Regression Baseline Capture

**What:** Capture baseline frames for future regression detection

#### Baseline Capture Process
```typescript
// tests/determinism/baseline-capture.test.ts
describe('Baseline Capture — SETUP (run before first regression test)', () => {
  it('captures shock opener first frame baseline', async () => {
    const config = { wrong: 'REST', right: 'gRPC', topic: 'api' };
    const video = await renderShockOpener(config);
    const frame = captureFrame(video, 0);

    // Save baseline
    await fs.promises.mkdir('tests/determinism/baselines', {
      recursive: true,
    });
    await saveFrame(frame, 'tests/determinism/baselines/shock-opener-frame-0');

    console.log('✅ Baseline captured: shock-opener-frame-0');
  });

  it('captures thumbnail baseline', async () => {
    const thumbnail = await renderThumbnail({ title: 'Test' });
    const frame = captureFrame(thumbnail, 0);

    await saveFrame(frame, 'tests/determinism/baselines/thumbnail-frame-0');
    console.log('✅ Baseline captured: thumbnail-frame-0');
  });

  it('captures course lesson first frame baseline', async () => {
    const lesson = await loadLesson('module-1-lesson-1');
    const video = await renderLesson(lesson);
    const frame = captureFrame(video, 0);

    await saveFrame(frame, 'tests/determinism/baselines/lesson-frame-0');
    console.log('✅ Baseline captured: lesson-frame-0');
  });
});

// Run once:
// npm test -- tests/determinism/baseline-capture.test.ts
```

#### Baseline Storage
```
tests/determinism/
├── baselines/
│   ├── shock-opener-frame-0.png
│   ├── shock-opener-frame-45.png (mid-animation)
│   ├── shock-opener-frame-89.png (end)
│   ├── thumbnail-frame-0.png
│   ├── lesson-frame-0.png
│   └── broll-clip-sample.png
├── determinism-metadata.json
└── visual-diff-reports/
    └── (generated on failures)
```

**Metadata file** (determinism-metadata.json)
```json
{
  "baselines": [
    {
      "id": "shock-opener-frame-0",
      "description": "Shock opener first frame [WRONG pane visible]",
      "format": "1080x1920",
      "fps": 30,
      "capturedAt": "2025-05-15T10:30:00Z",
      "renderConfig": {
        "wrong": "REST APIs",
        "right": "gRPC",
        "topic": "api-patterns"
      }
    },
    {
      "id": "thumbnail-frame-0",
      "description": "Course thumbnail",
      "format": "1280x720",
      "capturedAt": "2025-05-15T10:35:00Z"
    }
  ],
  "pixelTolerancePercent": 5,
  "perceptualTolerancePercent": 5
}
```

---

## Determinism Testing in CI/CD

### GitHub Actions Workflow
```yaml
# .github/workflows/determinism-tests.yml
name: Determinism Tests

on: [push, pull_request]

jobs:
  structural:
    name: Structural Determinism (STRICT)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test -- tests/determinism/structural.test.ts
      - name: ❌ Fail if structural test fails
        if: failure()
        run: exit 1

  semantic:
    name: Semantic Determinism (STRICT)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test -- tests/determinism/semantic.test.ts
      - name: ❌ Fail if semantic test fails
        if: failure()
        run: exit 1

  perceptual:
    name: Perceptual Determinism (ADVISORY)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test -- tests/determinism/perceptual.test.ts
      - name: ⚠️  Warn on perceptual diff
        if: failure()
        run: echo "::warning::Perceptual diff detected — check visual diffs"
      - name: 📊 Upload visual diffs
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: visual-diff-reports
          path: tests/determinism/visual-diff-reports/

  # Report results
  summary:
    name: Determinism Summary
    runs-on: ubuntu-latest
    needs: [structural, semantic, perceptual]
    if: always()
    steps:
      - name: 📋 Summary
        run: |
          echo "Structural: ${{ needs.structural.result }}"
          echo "Semantic: ${{ needs.semantic.result }}"
          echo "Perceptual: ${{ needs.perceptual.result }} (advisory)"
      - name: Check gates
        if: needs.structural.result != 'success' || needs.semantic.result != 'success'
        run: |
          echo "::error::Determinism gates failed"
          exit 1
```

### Local Testing
```bash
# Run structural tests (must pass)
npm test -- tests/determinism/structural.test.ts

# Run semantic tests (must pass)
npm test -- tests/determinism/semantic.test.ts

# Run perceptual tests (advisory)
npm test -- tests/determinism/perceptual.test.ts

# Run all determinism tests
npm test -- tests/determinism/

# Capture new baselines (one-time)
npm test -- tests/determinism/baseline-capture.test.ts

# Run with detailed output
npm test -- tests/determinism/ --reporter=verbose
```

---

## Handling Determinism Failures

### Scenario 1: Structural Test Fails (Duration Mismatch)
```
❌ FAIL: Duration doesn't match (expected 3000ms, got 3016ms)

Action Plan:
1. Check Remotion version — upgrade if stale
2. Check ffmpeg version — ensure consistency
3. Check system load — rerun on idle machine
4. If persists: Update expected duration (backward incompatibility?)
```

### Scenario 2: Semantic Test Fails (Text Content Different)
```
❌ FAIL: Extracted text differs

Action Plan:
1. Check font files — ensure installed correctly
2. Check locale settings — text rendering can vary
3. Check environment variables — may affect rendering
4. If persists: Update text content
```

### Scenario 3: Perceptual Test Warns (Pixel Diff 6%)
```
⚠️  WARN: Visual diff 6% (threshold 5%)

Action Plan:
1. Review visual diff report (saved in artifacts)
2. If acceptable: Update baseline
3. If not acceptable: Debug rendering pipeline
4. Document reason in commit message
```

---

## Determinism Testing Strategy Summary

| Layer | Type | Assertion | Pass Rate | CI Gate | Action |
|-------|------|-----------|-----------|---------|--------|
| **Structural** | Duration, format, codec | Exact values | 100% | BLOCKING | Fix |
| **Semantic** | Text, layout, colors | Content equality | 100% | BLOCKING | Fix |
| **Perceptual** | Pixel similarity | <5% diff | 95%+ | Advisory | Track |

**CI/CD Gate:**
- ✅ Structural + Semantic = MUST PASS (blocks merge)
- ⚠️ Perceptual = WARNED (doesn't block, but tracked)

**Metrics to Track:**
- Structural pass rate (target: 100%)
- Semantic pass rate (target: 100%)
- Perceptual diff average (target: <2%)
- Visual diff false positives (track across PR lifetime)

---

## Tools & Utilities

### Visual Diff Comparison
```typescript
// src/test-utils/visual-diff.ts
import sharp from 'sharp';
import { pixelmatch } from 'pixelmatch';

export async function compareFramesPerceptual(
  frame1: Buffer,
  frame2: Buffer,
  tolerance = 0.05
): Promise<VisualDiff> {
  const img1 = await sharp(frame1).raw().toBuffer({ resolveWithObject: true });
  const img2 = await sharp(frame2).raw().toBuffer({ resolveWithObject: true });

  const { data: data1, info: info1 } = img1;
  const { data: data2 } = img2;

  // Use pixelmatch for perceptual comparison
  const diff = pixelmatch(
    data1,
    data2,
    null,
    info1.width,
    info1.height,
    { threshold: 0.1 }
  );

  const pixelDifferencePercent = (diff / (info1.width * info1.height)) * 100;

  return {
    pixelDifferencePercent,
    diffPixels: diff,
    totalPixels: info1.width * info1.height,
  };
}

export interface VisualDiff {
  pixelDifferencePercent: number;
  diffPixels: number;
  totalPixels: number;
}
```

### Audio Waveform Comparison
```typescript
// src/test-utils/audio-diff.ts
import * as wav from 'wav';

export function extractWaveform(audioBuffer: Buffer): number[] {
  const reader = new wav.Reader();
  const waveform: number[] = [];

  reader.on('data', (chunk: Buffer) => {
    const samples = chunk.length / 2; // 16-bit samples
    for (let i = 0; i < samples; i++) {
      waveform.push(chunk.readInt16LE(i * 2) / 32768); // Normalize to -1 to 1
    }
  });

  reader.end(audioBuffer);
  return waveform;
}

export function compareWaveformsPerceptual(w1: number[], w2: number[]): AudioDiff {
  // Compare RMS, frequency content, etc.
  const rms1 = calculateRMS(w1);
  const rms2 = calculateRMS(w2);
  const rmsDiff = Math.abs(rms1 - rms2) / Math.max(rms1, rms2);

  return {
    percentDifferent: rmsDiff * 100,
    rmsDiff,
  };
}
```

---

## Monitoring & Reporting

### Visual Diff Report (Auto-generated)
```html
<!-- tests/determinism/visual-diff-reports/report.html -->
<h1>Determinism Test Report</h1>

<h2>Structural Determinism</h2>
<p>✅ All tests passed (100%)</p>

<h2>Semantic Determinism</h2>
<p>✅ All tests passed (100%)</p>

<h2>Perceptual Determinism</h2>
<p>⚠️  Average pixel diff: 2.3% (threshold: 5%)</p>

<h3>Visual Diffs Detected:</h3>
<table>
  <tr>
    <th>Test</th>
    <th>Diff %</th>
    <th>Status</th>
    <th>Visual Diff</th>
  </tr>
  <tr>
    <td>shock-opener-frame-0</td>
    <td>1.2%</td>
    <td>✅ Within threshold</td>
    <td><img src="shock-opener-diff.png"></td>
  </tr>
  <tr>
    <td>thumbnail-frame-0</td>
    <td>0.8%</td>
    <td>✅ Within threshold</td>
    <td><img src="thumbnail-diff.png"></td>
  </tr>
</table>
```

---

## Next Steps

1. ✅ Set up structural + semantic tests (CI gate)
2. ✅ Capture visual baselines (one-time setup)
3. ✅ Configure perceptual tests (advisory)
4. ✅ Integrate into CI/CD (.github/workflows/determinism-tests.yml)
5. 📊 Monitor determinism metrics weekly
6. 🔄 Review + update baselines as features evolve
