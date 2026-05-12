/**
 * TDD tests for smart-clip-selector.ts
 *
 * Covers:
 *  - generateHookText() — all hook-type branches + uppercase guarantee
 *  - selectSubtopicClips() — empty inputs, title-only, single valid group,
 *    clip shape, archetype score ordering
 *  - buildMiniStoryboard() — frame reindexing, audioFile preservation,
 *    dimensions, durationInFrames
 */

import type { Scene, Storyboard } from '../../types';
import {
  generateHookText,
  selectSubtopicClips,
  buildMiniStoryboard,
  type SubtopicClip,
} from '../smart-clip-selector';

// ─── createMockScene helper ───────────────────────────────────────────────────

interface MockSceneOptions {
  type?: Scene['type'];
  heading?: string;
  narration?: string;
  content?: string;
  startFrame?: number;
  endFrame?: number;
  audioFile?: string;
  audioOffsetSeconds?: number;
}

function createMockScene(opts: MockSceneOptions = {}): Scene {
  const startFrame = opts.startFrame ?? 0;
  const endFrame = opts.endFrame ?? 900; // 30s at 30fps by default
  return {
    type: opts.type ?? 'text',
    heading: opts.heading ?? 'Test Heading',
    narration: opts.narration ?? 'This is a test narration sentence.',
    content: opts.content ?? 'Test content',
    duration: (endFrame - startFrame) / 30,
    startFrame,
    endFrame,
    audioFile: opts.audioFile,
    audioOffsetSeconds: opts.audioOffsetSeconds,
  };
}

/** Build N mock scenes sequentially with given frames-per-scene. */
function createSceneSequence(
  count: number,
  framesPerScene: number,
  overrides: Partial<MockSceneOptions> = {},
): Scene[] {
  return Array.from({ length: count }, (_, i) =>
    createMockScene({
      startFrame: i * framesPerScene,
      endFrame: (i + 1) * framesPerScene,
      ...overrides,
    }),
  );
}

/** Build a minimal Storyboard for buildMiniStoryboard tests. */
function createMockStoryboard(scenes: Scene[], audioFile = 'audio/test.mp3'): Storyboard {
  const totalFrames = scenes.reduce((max, s) => Math.max(max, s.endFrame), 0);
  return {
    fps: 30,
    width: 1920,
    height: 1080,
    durationInFrames: totalFrames,
    scenes,
    audioFile,
    topic: 'test-topic',
    sessionNumber: 1,
    sceneOffsets: scenes.map((s) => s.audioOffsetSeconds ?? 0),
  };
}

// ─── generateHookText() ──────────────────────────────────────────────────────

describe('generateHookText()', () => {
  const TOPIC = 'caching';

  it('result is always uppercase', () => {
    const headings = ['fail', 'wrong', 'myth', 'code', 'random heading'];
    const archetypes = ['interview', 'code', 'problem', 'subtopic'] as const;
    for (const heading of headings) {
      for (const archetype of archetypes) {
        const result = generateHookText({ heading, archetype }, TOPIC);
        expect(result).toBe(result.toUpperCase());
      }
    }
  });

  describe('loss-aversion pattern (fail / break keywords)', () => {
    it('heading with "fail" → contains "FAILING" or "BROKEN" or "BUG" or "FAILING"', () => {
      const result = generateHookText({ heading: 'Why Systems fail', archetype: 'subtopic' }, TOPIC);
      expect(result).toMatch(/FAILING|BROKEN|BUG|SILENTLY/i);
    });

    it('heading with "break" → contains loss-aversion copy', () => {
      const result = generateHookText({ heading: 'When things break', archetype: 'subtopic' }, TOPIC);
      expect(result).toMatch(/FAILING|SILENTLY|BUG/i);
    });

    it('heading with "silent" → contains "SILENTLY" or "FAILING"', () => {
      const result = generateHookText({ heading: 'Silent failure', archetype: 'subtopic' }, TOPIC);
      expect(result).toMatch(/SILENT|FAILING/i);
    });
  });

  describe('cognitive-dissonance pattern (wrong / myth keywords)', () => {
    it('heading with "wrong" → contains "WRONG" or "EVERYTHING"', () => {
      const result = generateHookText({ heading: 'Everything is wrong here', archetype: 'subtopic' }, TOPIC);
      expect(result).toMatch(/WRONG|EVERYTHING/i);
    });

    it('heading with "myth" → contains "WRONG" or "EVERYTHING"', () => {
      const result = generateHookText({ heading: 'The Myth of caching', archetype: 'subtopic' }, TOPIC);
      expect(result).toMatch(/WRONG|EVERYTHING/i);
    });

    it('heading with "mistake" → contains "WRONG" or "EVERYTHING"', () => {
      const result = generateHookText({ heading: 'Common mistakes', archetype: 'subtopic' }, TOPIC);
      expect(result).toMatch(/WRONG|EVERYTHING/i);
    });
  });

  describe('archetype-driven hooks', () => {
    it('archetype="interview" → contains "FAILS" or "ENGINEERS"', () => {
      const result = generateHookText({ heading: 'Generic Subtopic', archetype: 'interview' }, TOPIC);
      expect(result).toMatch(/FAILS|ENGINEERS/i);
    });

    it('archetype="code" → contains "SENIOR" or "ENGINEERS"', () => {
      const result = generateHookText({ heading: 'Generic Subtopic', archetype: 'code' }, TOPIC);
      expect(result).toMatch(/SENIOR|ENGINEERS/i);
    });

    it('archetype="problem" → contains "BUG" or "FAILING" or "HIDDEN"', () => {
      const result = generateHookText({ heading: 'Generic Subtopic', archetype: 'problem' }, TOPIC);
      expect(result).toMatch(/BUG|FAILING|HIDDEN/i);
    });
  });

  describe('default (status-threat) hook', () => {
    it('heading with no special keywords and subtopic archetype → contains "WRONG"', () => {
      const result = generateHookText({ heading: 'Introduction', archetype: 'subtopic' }, TOPIC);
      expect(result).toMatch(/WRONG/i);
    });

    it('empty heading → contains "WRONG"', () => {
      const result = generateHookText({ heading: '', archetype: 'subtopic' }, TOPIC);
      expect(result).toMatch(/WRONG/i);
    });
  });

  describe('topic name is embedded in result', () => {
    it('result contains the uppercased topic for non-default hooks', () => {
      const result = generateHookText({ heading: 'fail case', archetype: 'subtopic' }, 'kafka');
      expect(result).toContain('KAFKA');
    });

    it('default hook result contains the uppercased topic', () => {
      const result = generateHookText({ heading: 'Overview', archetype: 'subtopic' }, 'kafka');
      expect(result).toContain('KAFKA');
    });
  });
});

// ─── selectSubtopicClips() ───────────────────────────────────────────────────

describe('selectSubtopicClips()', () => {
  const FPS = 30;
  const TOPIC = 'kafka';

  describe('edge cases', () => {
    it('empty scenes → returns []', () => {
      expect(selectSubtopicClips([], TOPIC, FPS)).toEqual([]);
    });

    it('all title-type scenes → returns []', () => {
      const scenes = createSceneSequence(3, 900, { type: 'title' });
      expect(selectSubtopicClips(scenes, TOPIC, FPS)).toEqual([]);
    });
  });

  describe('clip shape', () => {
    /** Build a valid single group that fits in 60-175s (use ~75s = 2250 frames each scene). */
    function buildValidGroup(): Scene[] {
      // 3 text scenes × 25s each = 75s total
      const framesPerScene = 750; // 25s at 30fps
      return createSceneSequence(3, framesPerScene, {
        type: 'text',
        heading: 'Deep Dive into Kafka',
      });
    }

    it('single valid group → returns exactly 1 clip', () => {
      const clips = selectSubtopicClips(buildValidGroup(), TOPIC, FPS);
      expect(clips).toHaveLength(1);
    });

    it('clip has all required properties', () => {
      const clips = selectSubtopicClips(buildValidGroup(), TOPIC, FPS);
      expect(clips).toHaveLength(1);
      const clip = clips[0];
      expect(clip).toHaveProperty('hookText');
      expect(clip).toHaveProperty('heading');
      expect(clip).toHaveProperty('duration');
      expect(clip).toHaveProperty('archetype');
      expect(clip).toHaveProperty('score');
      expect(clip).toHaveProperty('startScene');
      expect(clip).toHaveProperty('endScene');
    });

    it('clip.hookText is a non-empty string', () => {
      const clips = selectSubtopicClips(buildValidGroup(), TOPIC, FPS);
      expect(typeof clips[0].hookText).toBe('string');
      expect(clips[0].hookText.length).toBeGreaterThan(0);
    });

    it('clip.duration is approximately the sum of scene durations', () => {
      const scenes = buildValidGroup();
      const clips = selectSubtopicClips(scenes, TOPIC, FPS);
      expect(clips).toHaveLength(1);
      // 3 scenes × 750 frames / 30fps = 75s
      expect(clips[0].duration).toBeCloseTo(75, 0);
    });

    it('clip.archetype is one of the valid union members', () => {
      const clips = selectSubtopicClips(buildValidGroup(), TOPIC, FPS);
      const valid = ['interview', 'code', 'problem', 'subtopic'];
      expect(valid).toContain(clips[0].archetype);
    });
  });

  describe('archetype scoring', () => {
    /** Build a group of size ≥3 with 25s per scene so it fits in the 60-175s window. */
    function buildGroupWithType(type: Scene['type'], heading: string, count = 3): Scene[] {
      const framesPerScene = 750; // 25s at 30fps — fits 60-175s range
      return createSceneSequence(count, framesPerScene, { type, heading });
    }

    it('problem archetype score (90) > subtopic archetype score (50)', () => {
      // 'problem' archetype detected via narration keyword
      const problemScenes = createSceneSequence(3, 750, {
        type: 'text',
        heading: 'Edge Case Bugs',
        narration: 'This is a tricky pitfall that causes bugs and failures.',
      });
      const subtopicScenes = createSceneSequence(3, 750, {
        type: 'text',
        heading: 'Overview',
        narration: 'This covers the basics of the topic.',
      });

      const problemClips = selectSubtopicClips(problemScenes, TOPIC, FPS);
      const subtopicClips = selectSubtopicClips(subtopicScenes, TOPIC, FPS);

      expect(problemClips).toHaveLength(1);
      expect(subtopicClips).toHaveLength(1);
      expect(problemClips[0].score).toBeGreaterThan(subtopicClips[0].score);
    });

    it('interview archetype has the highest base score (100)', () => {
      const interviewScenes = buildGroupWithType('interview', 'Mock Interview');
      const codeScenes = buildGroupWithType('code', 'Implementation');
      const problemScenes = createSceneSequence(3, 750, {
        type: 'text',
        heading: 'Common Failures',
        narration: 'This bug and pitfall causes a problem.',
      });

      const interviewClips = selectSubtopicClips(interviewScenes, TOPIC, FPS);
      const codeClips = selectSubtopicClips(codeScenes, TOPIC, FPS);
      const problemClips = selectSubtopicClips(problemScenes, TOPIC, FPS);

      expect(interviewClips).toHaveLength(1);
      expect(codeClips).toHaveLength(1);
      expect(problemClips).toHaveLength(1);

      expect(interviewClips[0].score).toBeGreaterThanOrEqual(codeClips[0].score);
      expect(interviewClips[0].score).toBeGreaterThanOrEqual(problemClips[0].score);
    });
  });

  describe('scenes containing title mixed with content scenes', () => {
    it('title scenes are excluded, content scenes are kept', () => {
      const scenes: Scene[] = [
        createMockScene({ type: 'title', startFrame: 0, endFrame: 300 }),
        ...createSceneSequence(3, 750, {
          type: 'text',
          heading: 'Kafka Deep Dive',
          startFrame: 300,
        }).map((s, i) => ({
          ...s,
          startFrame: 300 + i * 750,
          endFrame: 300 + (i + 1) * 750,
        })),
      ];
      const clips = selectSubtopicClips(scenes, TOPIC, FPS);
      // Should still produce a clip from the 3 text scenes (75s total)
      expect(clips).toHaveLength(1);
    });
  });
});

// ─── buildMiniStoryboard() ───────────────────────────────────────────────────

describe('buildMiniStoryboard()', () => {
  function buildStoryboard(): { storyboard: Storyboard; scenes: Scene[] } {
    // 5 scenes × 300 frames = 10s each = 50s total
    const scenes = Array.from({ length: 5 }, (_, i) =>
      createMockScene({
        startFrame: i * 300,
        endFrame: (i + 1) * 300,
        heading: `Scene ${i}`,
        audioFile: `audio/scene-${i}.mp3`,
        audioOffsetSeconds: i * 10,
      }),
    );
    const storyboard = createMockStoryboard(scenes, 'audio/master.mp3');
    storyboard.sceneOffsets = scenes.map((_, i) => i * 10);
    return { storyboard, scenes };
  }

  describe('frame reindexing', () => {
    it('first scene of mini storyboard has startFrame = 0', () => {
      const { storyboard } = buildStoryboard();
      const mini = buildMiniStoryboard(storyboard, 1, 3);
      expect(mini.scenes[0].startFrame).toBe(0);
    });

    it('scenes are contiguous (each startFrame = previous endFrame)', () => {
      const { storyboard } = buildStoryboard();
      const mini = buildMiniStoryboard(storyboard, 0, 4);
      for (let i = 1; i < mini.scenes.length; i++) {
        expect(mini.scenes[i].startFrame).toBe(mini.scenes[i - 1].endFrame);
      }
    });

    it('preserves per-scene frame duration from original', () => {
      const { storyboard } = buildStoryboard();
      // slice scenes 1–3 (indices 1, 2, 3)
      const mini = buildMiniStoryboard(storyboard, 1, 3);
      const originalDurations = storyboard.scenes.slice(1, 4).map((s) => s.endFrame - s.startFrame);
      const miniDurations = mini.scenes.map((s) => s.endFrame - s.startFrame);
      expect(miniDurations).toEqual(originalDurations);
    });
  });

  describe('audioFile preservation', () => {
    it('preserves the original audioFile path', () => {
      const { storyboard } = buildStoryboard();
      const mini = buildMiniStoryboard(storyboard, 0, 2);
      expect(mini.audioFile).toBe('audio/master.mp3');
    });
  });

  describe('dimensions', () => {
    it('sets width = 1080', () => {
      const { storyboard } = buildStoryboard();
      const mini = buildMiniStoryboard(storyboard, 0, 2);
      expect(mini.width).toBe(1080);
    });

    it('sets height = 1920', () => {
      const { storyboard } = buildStoryboard();
      const mini = buildMiniStoryboard(storyboard, 0, 2);
      expect(mini.height).toBe(1920);
    });
  });

  describe('durationInFrames', () => {
    it('equals sum of selected scene frame durations', () => {
      const { storyboard } = buildStoryboard();
      // scenes 1–3: 3 scenes × 300 frames = 900
      const mini = buildMiniStoryboard(storyboard, 1, 3);
      const expectedFrames = storyboard.scenes.slice(1, 4).reduce(
        (sum, s) => sum + (s.endFrame - s.startFrame),
        0,
      );
      expect(mini.durationInFrames).toBe(expectedFrames);
    });

    it('single scene clip has correct durationInFrames', () => {
      const { storyboard } = buildStoryboard();
      const mini = buildMiniStoryboard(storyboard, 2, 2); // just scene index 2
      const expected = storyboard.scenes[2].endFrame - storyboard.scenes[2].startFrame;
      expect(mini.durationInFrames).toBe(expected);
    });

    it('full storyboard slice has durationInFrames = all frames', () => {
      const { storyboard } = buildStoryboard();
      const mini = buildMiniStoryboard(storyboard, 0, 4);
      expect(mini.durationInFrames).toBe(storyboard.durationInFrames);
    });
  });

  describe('scenes count', () => {
    it('returns the correct number of scenes for the slice', () => {
      const { storyboard } = buildStoryboard();
      const mini = buildMiniStoryboard(storyboard, 1, 3); // scenes 1,2,3 → 3 scenes
      expect(mini.scenes).toHaveLength(3);
    });

    it('single-scene slice returns 1 scene', () => {
      const { storyboard } = buildStoryboard();
      const mini = buildMiniStoryboard(storyboard, 2, 2);
      expect(mini.scenes).toHaveLength(1);
    });
  });
});
