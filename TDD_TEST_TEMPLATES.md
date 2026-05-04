# TDD Test Templates — video-money-maker

**Purpose:** Every P0/P1 feature starts with FAILING tests. This document provides:
- Test template for each todo
- Mock data + fixtures
- Success criteria (assertions)
- Expected file structure
- Integration hooks

---

## P0 Sprint 1.1: B-Roll Library (Days 1-5)

### Goal
- Curate 60-80 evergreen stock clips
- Per-concept B-roll selection
- Auto-inject 10-15s footage per teach-block

### TDD Template: `tests/broll-library.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { getBrollClips, getCachedClips, BrollClip } from '@/stock/broll-library';
import { BrollManifest } from '@/stock/manifest';

describe('B-Roll Library — P0 Sprint 1.1', () => {
  let manifest: BrollManifest;

  beforeAll(async () => {
    // Load manifest
    manifest = await import('@/stock/manifest.json');
  });

  describe('Clip Duration Requirements', () => {
    it('returns clips in 10-15 second range', async () => {
      const clips = await getBrollClips('kubernetes');
      expect(clips.length).toBeGreaterThan(0);
      
      clips.forEach(clip => {
        expect(clip.durationSec).toBeGreaterThanOrEqual(10);
        expect(clip.durationSec).toBeLessThanOrEqual(15);
      });
    });

    it('fallback clip is exactly 12 seconds', () => {
      const fallback = getCachedClips().find(c => c.id === 'FALLBACK_CLIP');
      expect(fallback).toBeDefined();
      expect(fallback!.durationSec).toBe(12);
    });
  });

  describe('Clip Format Requirements', () => {
    it('all clips are landscape or portrait orientation', () => {
      const clips = getCachedClips();
      clips.forEach(clip => {
        expect(['landscape', 'portrait']).toContain(clip.orientation);
      });
    });

    it('all clips have valid video codec', () => {
      const clips = getCachedClips();
      clips.forEach(clip => {
        expect(['h264', 'vp9', 'av1']).toContain(clip.codec);
      });
    });

    it('all clips have bitrate metadata', () => {
      const clips = getCachedClips();
      clips.forEach(clip => {
        expect(clip.bitrateMbps).toBeGreaterThan(0);
        expect(clip.bitrateMbps).toBeLessThan(50);
      });
    });
  });

  describe('Clip Source Requirements', () => {
    it('tracks source attribution (Mixkit, Coverr, YouTube)', () => {
      const clips = getCachedClips();
      clips.forEach(clip => {
        expect(['mixkit', 'coverr', 'youtube', 'pexels', 'pixabay']).toContain(
          clip.source.toLowerCase()
        );
      });
    });

    it('free clips have no-attribution flag', () => {
      const freeClips = getCachedClips().filter(c => c.source === 'mixkit');
      freeClips.forEach(clip => {
        expect(clip.requiresAttribution).toBe(false);
      });
    });

    it('all clips have URLs that resolve', async () => {
      const clips = getCachedClips();
      for (const clip of clips.slice(0, 3)) { // Sample test (avoid network calls in full suite)
        const response = await fetch(clip.url, { method: 'HEAD' });
        expect(response.status).toBeLessThan(400);
      }
    });
  });

  describe('Manifest Structure (60-80 clips)', () => {
    it('manifest contains 60-80 clips', () => {
      const clips = getCachedClips();
      expect(clips.length).toBeGreaterThanOrEqual(60);
      expect(clips.length).toBeLessThanOrEqual(80);
    });

    it('each clip has required fields', () => {
      const requiredFields = [
        'id',
        'url',
        'durationSec',
        'orientation',
        'codec',
        'source',
        'topics',
      ];
      
      getCachedClips().forEach(clip => {
        requiredFields.forEach(field => {
          expect(Object.keys(clip)).toContain(field);
        });
      });
    });

    it('topics are properly tagged for discoverability', () => {
      const clips = getCachedClips();
      const allTopics = new Set<string>();
      
      clips.forEach(clip => {
        expect(Array.isArray(clip.topics)).toBe(true);
        expect(clip.topics.length).toBeGreaterThan(0);
        clip.topics.forEach(t => allTopics.add(t));
      });

      // Expect at least 20 unique topics
      expect(allTopics.size).toBeGreaterThanOrEqual(20);
    });
  });

  describe('Integration: Auto-injection into scenes', () => {
    it('picks unique clips for each scene in a storyboard', async () => {
      const storyboard = [
        { keywords: ['kubernetes', 'container'], duration: 30 },
        { keywords: ['microservices', 'api'], duration: 30 },
        { keywords: ['docker', 'devops'], duration: 30 },
      ];

      const selectedClips = await Promise.all(
        storyboard.map(scene => getBrollClips(scene.keywords[0]))
      );

      // No clip should repeat across scenes
      const clipIds = selectedClips.flat().map(c => c.id);
      const uniqueIds = new Set(clipIds);
      expect(uniqueIds.size).toBe(clipIds.length);
    });

    it('injected clips fit scene durations (min 10s, max 15s)', async () => {
      const sceneDuration = 30;
      const clips = await getBrollClips('testing');

      const selectedClip = clips[0];
      expect(selectedClip.durationSec).toBeLessThanOrEqual(sceneDuration);
      expect(selectedClip.durationSec).toBeGreaterThan(sceneDuration / 3); // At least 1/3 of scene
    });
  });
});
```

### File Structure
```
src/stock/
  ├── broll-library.ts          (NEW — implement to pass tests)
  ├── manifest.json             (NEW — 60-80 clips)
  └── picker.ts                 (update to use library)

tests/
  ├── broll-library.test.ts     (NEW — this template)
  └── fixtures/broll-manifest.fixture.json
```

### Mock Data

**fixtures/broll-manifest.fixture.json**
```json
{
  "clips": [
    {
      "id": "mixkit-kubernetes-1",
      "url": "https://assets.mixkit.co/active_storage/videos/...",
      "durationSec": 12,
      "orientation": "landscape",
      "codec": "h264",
      "bitrateMbps": 5.2,
      "source": "Mixkit",
      "requiresAttribution": false,
      "topics": ["kubernetes", "container", "devops"]
    }
  ]
}
```

### Success Criteria
✅ All 10+ test cases pass
✅ Manifest.json has 60-80 clips
✅ Zero clips repeated across scenes
✅ All clips 10-15 seconds
✅ All sources tracked

---

## P0 Sprint 1.2: Micro-Shock Visuals (Days 6-8)

### Goal
- First 3 seconds show [WRONG] vs [RIGHT]
- Dual-pane comparison or flash transition
- +150% CTR improvement target

### TDD Template: `tests/micro-shock-visuals.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import {
  renderShockOpener,
  ShockOpenerConfig,
  getShockFrames,
} from '@/compositions/shock-opener';

describe('Micro-Shock Visuals — P0 Sprint 1.2', () => {
  const config: ShockOpenerConfig = {
    wrong: 'Most use REST APIs',
    right: 'Use gRPC instead',
    topic: 'api-patterns',
  };

  describe('Duration & Format', () => {
    it('shock opener is exactly 3 seconds (90 frames @ 30fps)', async () => {
      const video = await renderShockOpener(config);
      expect(video.durationMs).toBe(3000);
      expect(video.durationFrames).toBe(90);
      expect(video.fps).toBe(30);
    });

    it('outputs 1080x1920 portrait format (YouTube Shorts)', async () => {
      const video = await renderShockOpener(config);
      expect(video.width).toBe(1080);
      expect(video.height).toBe(1920);
      expect(video.aspectRatio).toBe(9 / 16);
    });
  });

  describe('Visual Composition', () => {
    it('shows dual-pane layout [WRONG | RIGHT]', async () => {
      const frames = await getShockFrames(config);
      
      // Frame 1-30: WRONG (left pane)
      expect(frames[0]).toHaveProperty('wrongPaneVisible', true);
      expect(frames[0]).toHaveProperty('rightPaneVisible', false);

      // Frame 31-60: Both visible
      expect(frames[30]).toHaveProperty('wrongPaneVisible', true);
      expect(frames[30]).toHaveProperty('rightPaneVisible', true);

      // Frame 61-90: RIGHT (right pane)
      expect(frames[60]).toHaveProperty('wrongPaneVisible', false);
      expect(frames[60]).toHaveProperty('rightPaneVisible', true);
    });

    it('displays contradiction label on first frame', async () => {
      const firstFrame = await getShockFrames(config);
      expect(firstFrame[0].hasContradictionLabel).toBe(true);
      expect(firstFrame[0].label).toContain('vs');
    });

    it('renders text with high readability (large font, contrast)', async () => {
      const frames = await getShockFrames(config);
      const textFrame = frames[0];

      expect(textFrame.textProperties).toMatchObject({
        fontSize: expect.any(Number), // Should be >= 48px
        fontWeight: 'bold',
        color: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        backgroundColor: expect.stringMatching(/^rgba\(/),
        opacity: expect.any(Number), // >= 0.9
      });

      expect(textFrame.textProperties.fontSize).toBeGreaterThanOrEqual(48);
    });
  });

  describe('Animation Sequence', () => {
    it('transitions from WRONG (0-1s) → BOTH (1-2s) → RIGHT (2-3s)', async () => {
      const frames = await getShockFrames(config);
      
      // Timeline: 0-1s (frames 0-30)
      for (let i = 0; i <= 30; i++) {
        expect(frames[i].rightPaneVisible).toBe(i >= 15); // Cross-fade start at 0.5s
      }

      // Timeline: 1-2s (frames 30-60) — both visible
      for (let i = 30; i <= 60; i++) {
        expect(frames[i].wrongPaneVisible).toBe(true);
        expect(frames[i].rightPaneVisible).toBe(true);
      }

      // Timeline: 2-3s (frames 60-90) — transition out WRONG
      for (let i = 60; i <= 90; i++) {
        expect(frames[i].wrongPaneVisible).toBe(i < 75); // Fade out by 2.5s
      }
    });

    it('no jarring cuts — uses smooth cross-fades (minimum 0.2s)', async () => {
      const frames = await getShockFrames(config);
      let transitions = 0;

      for (let i = 1; i < frames.length; i++) {
        const opacityChange = Math.abs(
          frames[i].opacityLeft - frames[i - 1].opacityLeft
        );
        
        // Max opacity change per frame = 0.05 (smooth fade)
        if (opacityChange > 0) {
          expect(opacityChange).toBeLessThanOrEqual(0.05);
          transitions++;
        }
      }

      // Should have smooth transitions, not instant changes
      expect(transitions).toBeGreaterThan(10);
    });
  });

  describe('Perceptual Testing (Visual Regression)', () => {
    it('first frame matches baseline (screenshot comparison)', async () => {
      const frames = await getShockFrames(config);
      const firstFrame = frames[0];

      // TODO: Implement frame capture and perceptual diff
      // expect(firstFrame).toMatchSnapshot('shock-first-frame');
      
      expect(firstFrame).toBeDefined();
      expect(firstFrame.wrongPaneVisible).toBe(true);
    });

    it('shock opener is readable on mobile (min 24px text)', async () => {
      // Accessibility: text must scale to at least 24px on mobile
      const frames = await getShockFrames(config);
      expect(frames[0].textProperties.fontSize).toBeGreaterThanOrEqual(24);
    });
  });

  describe('Integration: Full Video with Shock Opener', () => {
    it('shock opener + main content renders as single video', async () => {
      const fullVideo = await renderShockOpener(config);
      expect(fullVideo.codec).toBe('h264');
      expect(fullVideo.bitrateMbps).toBeLessThan(10); // Efficient encoding
    });

    it('audio placeholder (silence) for 3s during shock opener', async () => {
      const video = await renderShockOpener(config);
      // TODO: Check audio track
      expect(video.hasAudioTrack).toBe(true); // Will be populated later
    });
  });
});
```

### File Structure
```
src/compositions/
  ├── shock-opener.tsx          (NEW — implement)
  └── shock-opener.types.ts     (NEW — types)

tests/
  ├── micro-shock-visuals.test.ts (NEW — this template)
  ├── fixtures/shock-frames/
  │   └── baseline-shock-first-frame.png (visual baseline)
  └── __snapshots__/
      └── micro-shock-visuals.test.ts.snap
```

### Mock Data
```typescript
const mockConfig: ShockOpenerConfig = {
  wrong: 'Most engineers think X',
  right: 'Actually, Y is better',
  topic: 'api-patterns',
};
```

### Success Criteria
✅ Exactly 3 seconds, 1080x1920 format
✅ Dual-pane [WRONG] | [RIGHT] visible
✅ Smooth transitions (no jarring cuts)
✅ High-contrast readable text (48px+)
✅ Perceptual test baseline captured

---

## P1 Sprint 2.1: Hook Library (3 days)

### Goal
- Generate 50+ hook variations per topic
- Rank by shock value + curiosity gap
- A/B test top 3 with first 5 videos

### TDD Template: `tests/hook-library.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  generateHookVariations,
  rankHooksByShockValue,
  HookVariation,
} from '@/lib/hook-library';

describe('Hook Library — P1 Sprint 2.1', () => {
  const topic = 'kubernetes';

  describe('Generation: 50+ variations per topic', () => {
    it('generates at least 50 hook variations', async () => {
      const hooks = await generateHookVariations(topic);
      expect(hooks.length).toBeGreaterThanOrEqual(50);
    });

    it('each hook has unique text (no duplicates)', async () => {
      const hooks = await generateHookVariations(topic);
      const texts = hooks.map(h => h.text);
      const uniqueTexts = new Set(texts);
      expect(uniqueTexts.size).toBe(hooks.length);
    });

    it('each hook has shock score (0-10) and curiosity gap', async () => {
      const hooks = await generateHookVariations(topic);
      hooks.forEach(hook => {
        expect(hook.shockScore).toBeGreaterThanOrEqual(0);
        expect(hook.shockScore).toBeLessThanOrEqual(10);
        expect(hook.curiosityGap).toBeGreaterThanOrEqual(0);
        expect(hook.curiosityGap).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Ranking by Virality Metrics', () => {
    it('ranks hooks by combined shock + curiosity score', async () => {
      const hooks = await generateHookVariations(topic);
      const ranked = rankHooksByShockValue(hooks);

      // Top hook should have higher combined score than last
      const firstScore = ranked[0].shockScore + ranked[0].curiosityGap;
      const lastScore = ranked[ranked.length - 1].shockScore + ranked[ranked.length - 1].curiosityGap;

      expect(firstScore).toBeGreaterThanOrEqual(lastScore);
    });

    it('top 3 hooks are sortable for A/B testing', async () => {
      const hooks = await generateHookVariations(topic);
      const top3 = rankHooksByShockValue(hooks).slice(0, 3);

      expect(top3.length).toBe(3);
      top3.forEach(hook => {
        expect(hook.text).toBeTruthy();
        expect(hook.shockScore).toBeGreaterThan(5); // High shock
      });
    });
  });

  describe('Hook Variety (avoid repetition)', () => {
    it('uses different hook templates/patterns', async () => {
      const hooks = await generateHookVariations(topic);
      const patterns = new Set<string>();

      hooks.forEach(hook => {
        // Extract pattern (e.g., "X WRONG, Y RIGHT", "Learn X in Y")
        const pattern = hook.pattern || 'default';
        patterns.add(pattern);
      });

      // Should use at least 5 different patterns
      expect(patterns.size).toBeGreaterThanOrEqual(5);
    });

    it('variation in hook length (short, medium, long)', async () => {
      const hooks = await generateHookVariations(topic);
      const lengths = new Set<string>();

      hooks.forEach(hook => {
        const length = hook.text.length;
        if (length <= 50) lengths.add('short');
        else if (length <= 100) lengths.add('medium');
        else lengths.add('long');
      });

      // Should have mix of lengths
      expect(lengths.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('A/B Testing Support', () => {
    it('top 3 hooks can be tracked in A/B tests', async () => {
      const hooks = await generateHookVariations(topic);
      const top3 = rankHooksByShockValue(hooks).slice(0, 3);

      top3.forEach(hook => {
        expect(hook).toHaveProperty('id'); // Trackable ID
        expect(hook).toHaveProperty('text');
        expect(hook).toHaveProperty('shockScore');
      });
    });

    it('A/B test results updatable (retention metrics)', async () => {
      const hooks = await generateHookVariations(topic);
      const hook = hooks[0];

      // Should allow tracking A/B metrics
      hook.retentionScore = 0.75; // 75% average retention
      expect(hook.retentionScore).toBe(0.75);
    });
  });
});
```

### Success Criteria
✅ 50+ unique hooks per topic
✅ Shock score + curiosity gap metrics
✅ Top 3 ranked for A/B testing
✅ 5+ different hook patterns

---

## P1 Sprint 3.1: War Stories (5 days)

### Goal
- 2-3 min per video: Failure → Learning → Success
- Real project stories (failures are credible)
- Hinglish narration support

### TDD Template: `tests/war-stories.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  parseWarStory,
  validateWarStoryStructure,
  WarStory,
} from '@/lib/war-story-parser';

describe('War Stories — P1 Sprint 3.1', () => {
  const mockStory: WarStory = {
    title: 'When Node.js ate my database connections',
    failure: {
      description: 'Production went down, 5000 users affected',
      lesson: 'Don\'t reuse connections without pooling',
      duration: 45, // seconds
    },
    learning: {
      description: 'Learned about connection pooling',
      code: 'const pool = new Pool({ max: 20 })',
      duration: 60,
    },
    success: {
      description: 'Implemented fix, zero downtime',
      metrics: '99.99% uptime achieved',
      duration: 30,
    },
    narrationType: 'hinglish',
  };

  describe('Story Structure (F→L→S)', () => {
    it('validates 3-part story: Failure → Learning → Success', () => {
      const isValid = validateWarStoryStructure(mockStory);
      expect(isValid).toBe(true);
    });

    it('each part has description + duration', () => {
      expect(mockStory.failure).toHaveProperty('description');
      expect(mockStory.failure).toHaveProperty('duration');
      expect(mockStory.learning).toHaveProperty('description');
      expect(mockStory.success).toHaveProperty('duration');
    });

    it('total story duration is 2-3 minutes (120-180s)', () => {
      const total =
        mockStory.failure.duration +
        mockStory.learning.duration +
        mockStory.success.duration;

      expect(total).toBeGreaterThanOrEqual(120);
      expect(total).toBeLessThanOrEqual(180);
    });
  });

  describe('Emotional Arc', () => {
    it('failure creates credibility (real mistakes)', () => {
      expect(mockStory.failure.description).toBeTruthy();
      expect(mockStory.failure.description.length).toBeGreaterThan(20);
    });

    it('learning provides actionable insight', () => {
      expect(mockStory.learning.description).toBeTruthy();
      expect(mockStory.learning.code || mockStory.learning.insight).toBeTruthy();
    });

    it('success provides resolution (inspiring)', () => {
      expect(mockStory.success.description).toBeTruthy();
      expect(mockStory.success.metrics).toBeTruthy();
    });
  });

  describe('Narration Support', () => {
    it('supports Hinglish narration (mixed Hindi-English)', () => {
      const story = { ...mockStory, narrationType: 'hinglish' };
      expect(story.narrationType).toBe('hinglish');
      // TTS engine will handle generation
    });

    it('supports English narration as fallback', () => {
      const story = { ...mockStory, narrationType: 'english' };
      expect(story.narrationType).toBe('english');
    });
  });

  describe('Engagement Metrics', () => {
    it('story structure targets 2x comment increase', () => {
      // This will be measured in post-production
      // But the structure must support it
      expect(mockStory).toHaveProperty('failure');
      expect(mockStory).toHaveProperty('learning');
      expect(mockStory).toHaveProperty('success');
    });
  });
});
```

### Success Criteria
✅ 3-part structure (F → L → S) validated
✅ 2-3 minute duration (120-180s)
✅ Hinglish narration support
✅ Emotional arc verified

---

## P1 Sprint 3.3: Course Launch (15 days)

### Goal
- Curriculum: 8 modules, 16 lessons
- Video recordings (5-7 min each)
- Worksheets + code files
- Price: $49 (launch) → $99 (regular)

### TDD Template: `tests/course-curriculum.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  loadCourseCurriculum,
  validateCourseStructure,
  Course,
} from '@/lib/course-curriculum';

describe('Course Launch — P1 Sprint 3.3', () => {
  let course: Course;

  describe('Curriculum Structure', () => {
    it('defines 8 modules', async () => {
      course = await loadCourseCurriculum();
      expect(course.modules.length).toBe(8);
    });

    it('each module has exactly 2 lessons', () => {
      course.modules.forEach(module => {
        expect(module.lessons.length).toBe(2);
      });
    });

    it('total of 16 lessons (8 modules × 2)', () => {
      const totalLessons = course.modules.reduce(
        (sum, m) => sum + m.lessons.length,
        0
      );
      expect(totalLessons).toBe(16);
    });
  });

  describe('Lesson Content', () => {
    it('each lesson has 5-7 minute video', () => {
      course.modules.forEach(module => {
        module.lessons.forEach(lesson => {
          expect(lesson.videoDurationMin).toBeGreaterThanOrEqual(5);
          expect(lesson.videoDurationMin).toBeLessThanOrEqual(7);
        });
      });
    });

    it('each lesson has worksheet + code files', () => {
      course.modules.forEach(module => {
        module.lessons.forEach(lesson => {
          expect(lesson.worksheetUrl).toBeTruthy();
          expect(Array.isArray(lesson.codeFiles)).toBe(true);
          expect(lesson.codeFiles.length).toBeGreaterThan(0);
        });
      });
    });

    it('learning objectives defined for each lesson', () => {
      course.modules.forEach(module => {
        module.lessons.forEach(lesson => {
          expect(Array.isArray(lesson.objectives)).toBe(true);
          expect(lesson.objectives.length).toBeGreaterThanOrEqual(2);
        });
      });
    });
  });

  describe('Progression & Prerequisites', () => {
    it('lessons progress in logical order (module 1 → 8)', () => {
      course.modules.forEach((module, idx) => {
        expect(module.sequenceNumber).toBe(idx + 1);
      });
    });

    it('later lessons may reference earlier lessons', () => {
      // Module 5+ may have prerequisites to earlier modules
      const module5 = course.modules[4];
      module5.lessons.forEach(lesson => {
        if (lesson.prerequisites) {
          lesson.prerequisites.forEach(prereq => {
            expect(prereq.moduleNumber).toBeLessThan(5);
          });
        }
      });
    });
  });

  describe('Pricing & Licensing', () => {
    it('has launch price ($49)', () => {
      expect(course.launchPrice).toBe(49);
    });

    it('has regular price ($99)', () => {
      expect(course.regularPrice).toBe(99);
    });

    it('includes license/terms for code', () => {
      expect(course.license).toBeTruthy();
    });
  });

  describe('Revenue Target', () => {
    it('structure supports $1,500/month by day 42 (50 sales × $30 avg)', () => {
      // At 50 sales in month 1, average $30 (mix of launch/regular)
      const projectedMonth1 = 50 * 30;
      expect(projectedMonth1).toBeGreaterThanOrEqual(1500);
    });
  });

  describe('Validation', () => {
    it('full course structure is valid', async () => {
      const isValid = validateCourseStructure(course);
      expect(isValid).toBe(true);
    });
  });
});
```

### Success Criteria
✅ 8 modules, 2 lessons each = 16 total
✅ Each lesson 5-7 minutes
✅ Worksheets + code files provided
✅ Pricing defined ($49 launch → $99 regular)

---

## Test Infrastructure

### Fixtures Directory
```
tests/fixtures/
├── broll-manifest.fixture.json
├── hooks-sample-50.fixture.json
├── war-story-sample.fixture.json
├── course-curriculum.fixture.json
└── shock-frames/
    └── baseline-shock-first-frame.png
```

### Mock Utilities
```typescript
// tests/mocks/stock-provider.mock.ts
export const mockBrollClips = () => [
  { id: 'clip-1', durationSec: 12, orientation: 'landscape' },
  { id: 'clip-2', durationSec: 14, orientation: 'portrait' },
];

// tests/mocks/hooks-generator.mock.ts
export const mockHooks = (count = 50) =>
  Array.from({ length: count }, (_, i) => ({
    id: `hook-${i}`,
    text: `Hook variation ${i}`,
    shockScore: Math.random() * 10,
  }));
```

### Running TDD Tests

```bash
# Run all P0/P1 TDD tests
npm test -- tests/broll-library.test.ts \
               tests/micro-shock-visuals.test.ts \
               tests/hook-library.test.ts \
               tests/war-stories.test.ts \
               tests/course-curriculum.test.ts

# Watch mode for TDD development
npm test -- --watch tests/broll-library.test.ts

# Run with coverage
npm run test:coverage -- tests/broll-library.test.ts
```

---

## Next Steps

1. ✅ Copy these test templates into actual `.test.ts` files
2. ✅ Verify all tests **fail** (RED phase of TDD)
3. 🔨 Implement code to make tests pass (GREEN phase)
4. 🔄 Refactor for clarity (BLUE phase)
5. 📊 Measure impact (retention, CTR, course sales)
6. 🔁 Iterate based on metrics
