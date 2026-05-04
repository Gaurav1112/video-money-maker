# Test Pyramid Strategy — video-money-maker

**Vision:** Balanced test distribution for fast feedback + high confidence.

```
         /\
        /  \
       / E2E \          10% — Full workflow tests
      /______\         (~120 tests, 1-10 min each)
      
      /      \
     /  INT   \        20% — Integration tests
    /         \        (~240 tests, 100-500ms each)
   /__________\
   
   /          \
  /   UNIT     \       70% — Unit tests
 /             \       (~840 tests, <10ms each)
/______________\

Total: ~1200 tests | Execution: <10s | Coverage: 75%+
```

---

## Test Distribution Target

| Layer | Tests | Coverage % | Avg Time | Total Time | Reliability |
|-------|-------|-----------|----------|-----------|------------|
| **Unit** | 840 | 60% | <10ms | 8.4s | 99.9% |
| **Integration** | 240 | 15% | 200ms | 48s | 95% |
| **E2E** | 120 | 10% | 5s | 600s | 90% |
| **Visual/Perceptual** | 20 | 5% | 2s | 40s | 80% |
| **Total** | **1,220** | **90%** | — | **~700s** | — |

**Current state:** 1,211 passing tests (slight inversion — more E2E than planned)  
**Target by end of Q2:** Rebalance to 70/20/10 pyramid

---

## Layer 1: Unit Tests (70%) — Fast, Isolated

### Purpose
- Test individual functions/classes in isolation
- Mock all external dependencies
- No network, file I/O, or timers
- **Target: <10ms per test, 100% pass rate**

### Examples

#### Example 1: Hook Generation (Unit)
```typescript
// tests/unit/hook-generator.unit.test.ts
describe('Hook Generator — UNIT', () => {
  describe('generateShockValue()', () => {
    it('calculates shock from contradiction strength', () => {
      const shock = generateShockValue({
        wrong: 'Most use X',
        right: 'Use Y instead',
      });
      
      expect(shock).toBeGreaterThan(5);
      expect(shock).toBeLessThanOrEqual(10);
    });

    it('handles edge case: no contradiction', () => {
      const shock = generateShockValue({
        wrong: 'Some use X',
        right: 'Some also use X',
      });
      
      expect(shock).toBeLessThan(3); // Low shock
    });
  });

  describe('rankHooks() with mocked dependencies', () => {
    it('sorts by shock score descending', () => {
      const hooks = [
        { id: '1', text: 'Hook 1', shockScore: 5 },
        { id: '2', text: 'Hook 2', shockScore: 8 },
        { id: '3', text: 'Hook 3', shockScore: 3 },
      ];
      
      const ranked = rankHooks(hooks);
      expect(ranked[0].shockScore).toBe(8);
      expect(ranked[1].shockScore).toBe(5);
      expect(ranked[2].shockScore).toBe(3);
    });
  });
});
```

#### Example 2: Clip Duration Validation (Unit)
```typescript
// tests/unit/broll-validator.unit.test.ts
describe('B-Roll Validator — UNIT', () => {
  describe('isValidClipDuration()', () => {
    it('accepts 10-15 second clips', () => {
      expect(isValidClipDuration(10)).toBe(true);
      expect(isValidClipDuration(12.5)).toBe(true);
      expect(isValidClipDuration(15)).toBe(true);
    });

    it('rejects clips <10s or >15s', () => {
      expect(isValidClipDuration(9.9)).toBe(false);
      expect(isValidClipDuration(15.1)).toBe(false);
    });
  });

  describe('validateClip() — mocked I/O', () => {
    it('returns valid for all required fields present', () => {
      const clip = {
        id: 'test-1',
        url: 'https://example.com/clip.mp4',
        durationSec: 12,
        orientation: 'landscape',
        codec: 'h264',
      };
      
      const result = validateClip(clip);
      expect(result.isValid).toBe(true);
    });

    it('returns error if URL is invalid format', () => {
      const clip = {
        id: 'test-1',
        url: 'not-a-url',
        durationSec: 12,
        orientation: 'landscape',
      };
      
      const result = validateClip(clip);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid URL');
    });
  });
});
```

### Unit Test Checklist
- ✅ No network calls (mock API clients)
- ✅ No file I/O (mock fs module)
- ✅ No timers (use `vi.useFakeTimers()`)
- ✅ All dependencies injected or mocked
- ✅ One assertion per test (or tightly related)
- ✅ Fast (<10ms execution)
- ✅ Deterministic (no flakes)

### Folder Structure
```
tests/unit/
├── hook-generator.unit.test.ts
├── broll-validator.unit.test.ts
├── shock-duration.unit.test.ts
├── course-validator.unit.test.ts
├── war-story-parser.unit.test.ts
├── audio-encoder.unit.test.ts
├── thumbnail-generator.unit.test.ts
└── mocks/
    ├── stock-provider.mock.ts
    ├── hooks-generator.mock.ts
    ├── audio-engine.mock.ts
    └── youtube-api.mock.ts
```

### Mocking Strategy
```typescript
// tests/unit/mocks/youtube-api.mock.ts
import { vi } from 'vitest';

export const mockYouTubeAPI = () => {
  return {
    upload: vi.fn().mockResolvedValue({ videoId: 'dQw4w9WgXcQ' }),
    getMetadata: vi.fn().mockResolvedValue({
      views: 1000,
      retention: 0.75,
    }),
  };
};

// Usage in test:
it('uploads video and gets ID', async () => {
  const api = mockYouTubeAPI();
  const result = await uploadVideo(api, videoFile);
  expect(api.upload).toHaveBeenCalled();
  expect(result.videoId).toBe('dQw4w9WgXcQ');
});
```

### Unit Test Execution
```bash
# Run all unit tests
npm test -- tests/unit/

# Run specific unit test
npm test -- tests/unit/hook-generator.unit.test.ts

# Watch mode
npm test:watch -- tests/unit/

# Coverage for units only
npm run test:coverage -- tests/unit/
```

---

## Layer 2: Integration Tests (20%) — Component Interaction

### Purpose
- Test multiple components working together
- Mock external services (YouTube API, TTS, etc.)
- Verify data flows correctly between layers
- **Target: 100-500ms per test, 95% pass rate**

### Examples

#### Example 1: B-Roll Picker Integration
```typescript
// tests/integration/broll-picker.integration.test.ts
describe('B-Roll Picker — INTEGRATION', () => {
  let cache: MockCache;
  let providers: MockProviders;
  let picker: BrollPicker;

  beforeEach(() => {
    cache = new MockCache();
    providers = new MockProviders();
    picker = new BrollPicker(cache, providers);
  });

  it('picks clips for full storyboard (cache + provider)', async () => {
    const storyboard = [
      { keywords: ['kubernetes'], duration: 30 },
      { keywords: ['microservices'], duration: 30 },
      { keywords: ['docker'], duration: 30 },
    ];

    const selectedClips = await picker.pickClipsForStoryboard(storyboard);

    // Verify:
    // 1. Cache was checked
    expect(cache.get).toHaveBeenCalled();
    
    // 2. Provider was called for missing results
    expect(providers.search).toHaveBeenCalled();
    
    // 3. Results are correct
    expect(selectedClips.length).toBe(3);
    selectedClips.forEach((clip, idx) => {
      expect(clip.durationSec).toBeGreaterThanOrEqual(10);
      expect(clip.keywords).toContain(storyboard[idx].keywords[0]);
    });
  });

  it('falls back to FALLBACK_CLIP when no results found', async () => {
    const storyboard = [{ keywords: ['nonexistent-topic'], duration: 30 }];
    
    providers.search.mockResolvedValue([]); // Empty results

    const selectedClips = await picker.pickClipsForStoryboard(storyboard);

    expect(selectedClips[0].id).toBe('FALLBACK_CLIP');
  });

  it('caches results for future requests', async () => {
    const keywords = ['kubernetes'];
    
    // First call
    await picker.pickClipsForStoryboard([
      { keywords, duration: 30 },
    ]);
    expect(cache.set).toHaveBeenCalled();

    // Second call
    await picker.pickClipsForStoryboard([
      { keywords, duration: 30 },
    ]);
    
    // Provider should not be called again (cache hit)
    expect(providers.search.mock.callCount).toBe(1);
  });
});
```

#### Example 2: Shock Opener + Audio Integration
```typescript
// tests/integration/shock-opener-audio.integration.test.ts
describe('Shock Opener + Audio — INTEGRATION', () => {
  it('renders shock opener with audio placeholder', async () => {
    const config = {
      wrong: 'Most use REST',
      right: 'Use gRPC',
      topic: 'api-patterns',
    };

    const rendered = await renderShockOpenerWithAudio(config);

    // Verify composition:
    expect(rendered.videoDurationMs).toBe(3000);
    expect(rendered.audioDurationMs).toBe(3000); // Silence
    expect(rendered.hasAudioTrack).toBe(true);
  });

  it('audio + video stay in sync (lip-sync ready)', async () => {
    const config = { wrong: 'X', right: 'Y', topic: 'test' };
    
    const rendered = await renderShockOpenerWithAudio(config);
    
    // Both tracks exactly 3s
    expect(rendered.videoDurationMs).toBe(rendered.audioDurationMs);
    expect(rendered.videoFrames).toBe(90); // 3s @ 30fps
  });
});
```

#### Example 3: Course Curriculum + Lesson Rendering
```typescript
// tests/integration/course-rendering.integration.test.ts
describe('Course Curriculum Rendering — INTEGRATION', () => {
  let curriculum: Course;
  let renderer: VideoRenderer;
  let ttsEngine: TTSEngine;

  beforeEach(async () => {
    curriculum = await loadCourseCurriculum();
    renderer = new MockVideoRenderer();
    ttsEngine = new MockTTSEngine();
  });

  it('renders full course (8 modules × 2 lessons)', async () => {
    const videos: RenderedLesson[] = [];

    for (const module of curriculum.modules) {
      for (const lesson of module.lessons) {
        const video = await renderer.render({
          lessonId: lesson.id,
          duration: lesson.videoDurationMin,
          narration: lesson.narration,
          tts: ttsEngine,
        });

        videos.push(video);
      }
    }

    // Verify all 16 lessons rendered
    expect(videos.length).toBe(16);
    
    // Verify each is 5-7 minutes
    videos.forEach(video => {
      expect(video.durationMin).toBeGreaterThanOrEqual(5);
      expect(video.durationMin).toBeLessThanOrEqual(7);
    });
  });

  it('lesson narration + visuals synchronize', async () => {
    const lesson = curriculum.modules[0].lessons[0];
    
    const narration = await ttsEngine.generate(lesson.script);
    const video = await renderer.render({
      lessonId: lesson.id,
      narration,
    });

    // Audio and video duration match
    expect(video.audioDurationMs).toBe(video.videoDurationMs);
  });
});
```

### Integration Test Checklist
- ✅ 2-4 real components (rest mocked)
- ✅ Data flows between components
- ✅ External services mocked (API calls, DB, etc.)
- ✅ State changes verified across components
- ✅ Deterministic (no race conditions)
- ✅ 100-500ms execution

### Folder Structure
```
tests/integration/
├── broll-picker.integration.test.ts
├── shock-opener-audio.integration.test.ts
├── course-rendering.integration.test.ts
├── hook-generator-ranker.integration.test.ts
├── war-story-flow.integration.test.ts
├── audio-pipeline.integration.test.ts
├── thumbnail-rendering.integration.test.ts
└── mocks/
    ├── video-renderer.mock.ts
    ├── tts-engine.mock.ts
    ├── youtube-api.mock.ts
    └── cache.mock.ts
```

### Integration Test Execution
```bash
# Run all integration tests
npm test -- tests/integration/

# Run specific integration test
npm test -- tests/integration/broll-picker.integration.test.ts

# Watch mode
npm test:watch -- tests/integration/
```

---

## Layer 3: E2E Tests (10%) — Full Workflow

### Purpose
- Test complete feature workflows end-to-end
- Minimal mocking (only truly external services)
- Verify real data flows through system
- **Target: 2-10 seconds per test, 90% pass rate**

### Examples

#### Example 1: Full B-Roll Pipeline
```typescript
// tests/e2e/broll-pipeline.e2e.test.ts
describe('B-Roll Pipeline — E2E', () => {
  it('loads manifest → picks clips → injects into scenes', async () => {
    // No mocks — real manifest.json, real picker logic
    
    const storyboard = [
      { keywords: ['kubernetes', 'container'], duration: 30 },
      { keywords: ['microservices', 'api'], duration: 30 },
    ];

    // Full flow:
    // 1. Load manifest
    const manifest = await loadBrollManifest();
    expect(manifest.clips.length).toBeGreaterThanOrEqual(60);

    // 2. Pick clips for storyboard
    const clipPicker = new BrollPicker(manifest);
    const selectedClips = await clipPicker.pickClipsForStoryboard(storyboard);
    
    // 3. Verify selections
    expect(selectedClips.length).toBe(2);
    selectedClips.forEach(clip => {
      expect(clip.durationSec).toBeLessThanOrEqual(15);
    });
  });
});
```

#### Example 2: Shock Opener → Full Video
```typescript
// tests/e2e/shock-to-video.e2e.test.ts
describe('Shock Opener Integration — E2E', () => {
  it('renders shock opener + main content → complete video', async () => {
    const config = {
      wrong: 'Most use REST APIs',
      right: 'gRPC is 10x faster',
      topic: 'api-patterns',
      mainContentDuration: 180, // 3min main content
    };

    // Render shock opener
    const shockVideo = await renderShockOpener(config);
    expect(shockVideo.durationMs).toBe(3000);

    // Compose with main content
    const fullVideo = await composeVideos([shockVideo, mainContentVideo]);
    
    // Verify:
    expect(fullVideo.durationMs).toBe(3000 + 180000); // 3m3s total
    expect(fullVideo.format).toBe('1080x1920'); // Portrait
    expect(fullVideo.codec).toBe('h264');
  });
});
```

#### Example 3: Full Course Rendering
```typescript
// tests/e2e/course-full-render.e2e.test.ts
describe('Full Course Rendering — E2E', () => {
  it('renders all 16 course lessons end-to-end', async () => {
    const curriculum = await loadCourseCurriculum();

    const renderedLessons = await Promise.all(
      curriculum.modules.flatMap(mod =>
        mod.lessons.map(lesson =>
          renderLesson(lesson, {
            includeNarration: true,
            includeSubtitles: true,
            format: '1080x1920',
          })
        )
      )
    );

    // Verify:
    expect(renderedLessons.length).toBe(16);
    renderedLessons.forEach(video => {
      expect(video.durationMin).toBeGreaterThanOrEqual(5);
      expect(video.durationMin).toBeLessThanOrEqual(7);
      expect(video.hasAudioTrack).toBe(true);
      expect(video.hasSubtitles).toBe(true);
    });

    // Total runtime for all lessons
    const totalHours = renderedLessons.reduce(
      (sum, v) => sum + v.durationMin,
      0
    ) / 60;
    expect(totalHours).toBeGreaterThanOrEqual(1.5); // At least 1.5 hours
    expect(totalHours).toBeLessThanOrEqual(2.2); // At most 2.2 hours
  });
});
```

### E2E Test Checklist
- ✅ Real data (manifest.json, curriculum, etc.)
- ✅ Minimal mocking (only external APIs)
- ✅ Full workflow from input to output
- ✅ Measures real-world behavior
- ✅ 2-10s execution per test
- ✅ <5 E2E tests per feature (too slow)

### Folder Structure
```
tests/e2e/
├── broll-pipeline.e2e.test.ts
├── shock-to-video.e2e.test.ts
├── course-full-render.e2e.test.ts
├── hook-generation-ranking.e2e.test.ts
├── war-story-flow.e2e.test.ts
└── fixtures/
    ├── sample-storyboard.json
    ├── sample-curriculum.json
    └── sample-hooks.json
```

### E2E Test Execution
```bash
# Run all E2E tests (can be slow)
npm test -- tests/e2e/

# Run specific E2E test
npm test -- tests/e2e/broll-pipeline.e2e.test.ts

# E2E tests only (skip unit/integration)
npm test -- --include="**/e2e/**"
```

---

## Layer 4: Visual/Perceptual Tests (5%) — Rendering Consistency

### Purpose
- Verify visual output consistency (Remotion renders)
- Detect unintended visual regressions
- Non-blocking (advisory, not strict)
- **Target: 1-2 seconds per test, 80% pass rate (visual diffs tracked)**

### Examples

#### Example 1: Shock Opener Visual Regression
```typescript
// tests/visual/shock-opener.visual.test.ts
import { compareFrames, VisualDiff } from '@/test-utils/visual-diff';

describe('Shock Opener — VISUAL REGRESSION', () => {
  it('first frame matches baseline', async () => {
    const frames = await captureShockOpenerFrames({
      wrong: 'Most use REST',
      right: 'Use gRPC',
    });

    const firstFrame = frames[0];
    const baseline = await loadBaseline('shock-opener-first-frame');

    const diff = compareFrames(firstFrame, baseline);

    // Allow max 5% pixel diff (perceptual tolerance)
    expect(diff.pixelDifferencePercent).toBeLessThan(5);
    
    // If diff exceeds 5%, fail but save new baseline
    if (diff.pixelDifferencePercent > 5) {
      await saveVisualDiff(
        'shock-opener-first-frame',
        firstFrame,
        baseline,
        diff
      );
    }
  });

  it('text is readable on first frame', async () => {
    const firstFrame = await captureShockOpenerFrames({
      wrong: 'Most use REST',
      right: 'Use gRPC',
    })[0];

    // Verify contrast ratio (WCAG AA = 4.5:1)
    const contrast = analyzeContrast(firstFrame);
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });
});
```

#### Example 2: Thumbnail Visual Consistency
```typescript
// tests/visual/thumbnail-consistency.visual.test.ts
describe('Thumbnail Generation — VISUAL CONSISTENCY', () => {
  it('thumbnail renders same way each time (seeded)', async () => {
    const config = {
      title: 'Kubernetes 101',
      seed: 'deterministic-seed',
    };

    // Render twice with same seed
    const thumb1 = await renderThumbnail(config);
    const thumb2 = await renderThumbnail(config);

    const diff = compareFrames(thumb1, thumb2);
    
    // Should be pixel-perfect identical (seed ensures determinism)
    expect(diff.pixelDifferencePercent).toBe(0);
  });
});
```

### Visual Test Checklist
- ✅ Compare frames against baseline
- ✅ Allow perceptual tolerance (5% diff)
- ✅ Track visual diffs (advisory)
- ✅ Deterministic (use seeds)
- ✅ 1-2s per test
- ✅ Non-blocking (CI still passes)

### Folder Structure
```
tests/visual/
├── shock-opener.visual.test.ts
├── thumbnail-consistency.visual.test.ts
├── composition-rendering.visual.test.ts
├── baselines/
│   ├── shock-opener-first-frame.png
│   ├── thumbnail-sample.png
│   └── course-lesson-intro.png
└── diffs/
    └── (generated on failure)
```

### Visual Test Execution
```bash
# Run visual tests (non-blocking)
npm test -- tests/visual/

# Update baselines (when intentional changes made)
npm test -- tests/visual/ -- --update-baselines

# Generate visual diff report
npm test -- tests/visual/ -- --reporter=visual-diff
```

---

## Test Execution & CI/CD Integration

### Local Development
```bash
# Run all tests (unit + integration + E2E + visual)
npm test

# Run only unit tests (fast feedback)
npm test -- tests/unit/

# Run with watch mode
npm test:watch

# Run specific test file
npm test -- tests/unit/hook-generator.unit.test.ts

# Run with coverage
npm run test:coverage

# Debug a specific test
npm test -- --inspect-brk tests/unit/hook-generator.unit.test.ts
```

### CI/CD Pipeline
```yaml
# .github/workflows/test.yml (example)
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      # Step 1: Unit tests (fast gate)
      - name: Run unit tests
        run: npm test -- tests/unit/ --reporter=verbose
        if: always()

      # Step 2: Integration tests
      - name: Run integration tests
        run: npm test -- tests/integration/ --reporter=verbose
        if: always()

      # Step 3: E2E tests (slower, but essential)
      - name: Run E2E tests
        run: npm test -- tests/e2e/ --reporter=verbose
        if: always()

      # Step 4: Visual tests (non-blocking)
      - name: Run visual tests
        run: npm test -- tests/visual/ --reporter=verbose
        continue-on-error: true

      # Step 5: Coverage check
      - name: Check coverage thresholds
        run: npm run test:coverage

      # Report results
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Parallel Execution Strategy
```bash
# Run unit + integration in parallel (fast)
npm test -- tests/unit/ & npm test -- tests/integration/

# Follow with E2E (can run while above finishes)
npm test -- tests/e2e/

# Visual tests last (non-blocking)
npm test -- tests/visual/ &
```

---

## Quality Metrics & Targets

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Total Tests | 1,200 | 1,211 | ✅ |
| Pass Rate | 100% | 99.3% | ⚠️ (fix security) |
| Avg Test Time | <10ms | ~3ms | ✅ |
| Total Run Time | <10s | ~4s | ✅ |
| Unit Coverage | 70% | 900 | ✅ |
| Integration Coverage | 20% | 150 | ✅ |
| E2E Coverage | 10% | 161 | ✅ |
| Code Coverage % | 75% | 40% | 🔴 (focus P0s) |
| Flake Rate | <1% | ~0% | ✅ |

---

## Migration Plan (Current → Target Pyramid)

### Week 1: Analyze
- ✅ Document current test distribution
- ✅ Identify mislabeled tests
- ✅ Create test migration plan

### Week 2-3: Migrate
- Move E2E tests to integration where appropriate
- Extract unit tests from integrated tests
- Add missing unit test coverage

### Week 4+: Maintain
- Enforce 70/20/10 ratio in code reviews
- Monitor pyramid via CI metrics
- Update tests as features evolve

---

## Best Practices

### ✅ Do
- Write unit tests for all business logic
- Mock external dependencies (APIs, databases, file I/O)
- Keep tests focused (one assertion per test, or tightly related)
- Use descriptive test names
- Run tests locally before pushing
- Keep tests deterministic (no flakes)

### ❌ Don't
- Test implementation details (test behavior)
- Mock too much (defeats integration tests)
- Ignore test failures
- Leave tests broken in main branch
- Skip testing for "simple" code
- Write tests that are slower than code

---

## Next Steps

1. ✅ Reorganize existing tests into unit/integration/e2e folders
2. ✅ Label each test with layer (unit/int/e2e/visual)
3. ✅ Add missing unit tests for business logic
4. ✅ Implement visual regression baseline capture
5. 📊 Set up CI metrics for pyramid monitoring
6. 🔄 Monthly pyramid rebalance reviews
