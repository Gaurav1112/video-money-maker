/**
 * short-arc-builder.test.ts
 *
 * Comprehensive TDD tests for:
 * - generateStatusThreatHook
 * - validateTERarc
 * - injectMicroRewards
 * - buildTERarcFromScenes
 */

import {
  generateStatusThreatHook,
  validateTERarc,
  injectMicroRewards,
  buildTERarcFromScenes,
} from '../short-arc-builder';

import type { Scene, WorldClassScene } from '../../types';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    type: 'text',
    content: '',
    narration: '',
    duration: 10,
    startFrame: 0,
    endFrame: 300,
    ...overrides,
  };
}

function makeWorldClassScene(overrides: Partial<WorldClassScene> = {}): WorldClassScene {
  return {
    type: 'text',
    content: '',
    narration: '',
    duration: 10,
    startFrame: 0,
    endFrame: 300,
    emotionalBeat: 'tension',
    microRewardType: 'cliffhanger',
    tensionScore: 0.9,
    arcPosition: 'hook',
    ...overrides,
  };
}

// ─── generateStatusThreatHook ─────────────────────────────────────────────────

describe('generateStatusThreatHook', () => {
  describe('formula selection by keyword', () => {
    it('selects lossAversion when subtopic contains "drop"', () => {
      const hook = generateStatusThreatHook('kafka', 'message drop');
      expect(hook.hookType).toBe('lossAversion');
    });

    it('selects lossAversion when subtopic contains "los" (e.g. "losing")', () => {
      const hook = generateStatusThreatHook('kafka', 'losing messages');
      expect(hook.hookType).toBe('lossAversion');
    });

    it('selects lossAversion when subtopic contains "miss"', () => {
      const hook = generateStatusThreatHook('kafka', 'missed events');
      expect(hook.hookType).toBe('lossAversion');
    });

    it('selects lossAversion when subtopic contains "fail"', () => {
      const hook = generateStatusThreatHook('kafka', 'failure modes');
      expect(hook.hookType).toBe('lossAversion');
    });

    it('selects statusThreat when subtopic contains "senior"', () => {
      const hook = generateStatusThreatHook('kubernetes', 'senior engineer patterns');
      expect(hook.hookType).toBe('statusThreat');
    });

    it('selects statusThreat when subtopic contains "config"', () => {
      const hook = generateStatusThreatHook('nginx', 'config tuning');
      expect(hook.hookType).toBe('statusThreat');
    });

    it('selects statusThreat when subtopic contains "expert"', () => {
      const hook = generateStatusThreatHook('redis', 'expert tips');
      expect(hook.hookType).toBe('statusThreat');
    });

    it('selects statusThreat when subtopic contains "best"', () => {
      const hook = generateStatusThreatHook('postgres', 'best practices');
      expect(hook.hookType).toBe('statusThreat');
    });

    it('selects cognitiveDissonance when subtopic contains "safe"', () => {
      const hook = generateStatusThreatHook('tls', 'safe by default');
      expect(hook.hookType).toBe('cognitiveDissonance');
    });

    it('selects cognitiveDissonance when subtopic contains "default"', () => {
      const hook = generateStatusThreatHook('docker', 'default networking');
      expect(hook.hookType).toBe('cognitiveDissonance');
    });

    it('selects cognitiveDissonance when subtopic contains "auto"', () => {
      const hook = generateStatusThreatHook('kubernetes', 'auto scaling');
      expect(hook.hookType).toBe('cognitiveDissonance');
    });

    it('selects curiosityGap when subtopic contains "secret"', () => {
      const hook = generateStatusThreatHook('linux', 'secret kernel flag');
      expect(hook.hookType).toBe('curiosityGap');
    });

    it('selects curiosityGap when subtopic contains "hidden"', () => {
      const hook = generateStatusThreatHook('grpc', 'hidden overhead');
      expect(hook.hookType).toBe('curiosityGap');
    });

    it('selects curiosityGap when subtopic contains "nobody"', () => {
      const hook = generateStatusThreatHook('react', 'nobody talks about re-renders');
      expect(hook.hookType).toBe('curiosityGap');
    });

    it('selects curiosityGap when subtopic contains "danger"', () => {
      const hook = generateStatusThreatHook('sql', 'danger of ORM');
      expect(hook.hookType).toBe('curiosityGap');
    });
  });

  describe('misconception override', () => {
    it('selects misconception formula when misconception provided and subtopic has no matching keyword', () => {
      const hook = generateStatusThreatHook('kafka', 'partitions', 'Kafka guarantees order globally');
      expect(hook.hookType).toBe('misconception');
    });

    it('embeds the provided misconception text in spokenLine', () => {
      const mc = 'Kafka guarantees order globally';
      const hook = generateStatusThreatHook('kafka', 'partitions', mc);
      expect(hook.spokenLine).toContain(mc);
    });

    it('seeds the misconceptionSeeded field', () => {
      const mc = 'Redis is always durable';
      const hook = generateStatusThreatHook('redis', 'persistence', mc);
      expect(hook.misconceptionSeeded).toBe(mc);
    });

    it('keyword match takes priority over misconception override', () => {
      // "drop" → lossAversion, even though misconception is provided
      const hook = generateStatusThreatHook('kafka', 'drop messages', 'some misconception');
      expect(hook.hookType).toBe('lossAversion');
    });
  });

  describe('unknown subtopic fallback (deterministic by topic hash)', () => {
    it('returns statusThreat or lossAversion for unknown subtopic', () => {
      const hook = generateStatusThreatHook('xyz', 'unknown thing');
      expect(['statusThreat', 'lossAversion']).toContain(hook.hookType);
    });

    it('is deterministic — same topic always returns same formula', () => {
      const hook1 = generateStatusThreatHook('deterministic-topic', 'unknown subtopic');
      const hook2 = generateStatusThreatHook('deterministic-topic', 'unknown subtopic');
      expect(hook1.hookType).toBe(hook2.hookType);
    });

    it('topic "ab" (hash=195, odd) → lossAversion', () => {
      // 'a'.charCodeAt(0)=97, 'b'.charCodeAt(0)=98 → sum=195, 195%2=1 → lossAversion
      const hook = generateStatusThreatHook('ab', 'unknown');
      expect(hook.hookType).toBe('lossAversion');
    });

    it('topic "aa" (hash=194, even) → statusThreat', () => {
      // 97+97=194, 194%2=0 → statusThreat
      const hook = generateStatusThreatHook('aa', 'unknown');
      expect(hook.hookType).toBe('statusThreat');
    });
  });

  describe('output completeness', () => {
    const SUBTOPICS = ['drop', 'senior', 'safe', 'secret', 'unknown'];

    it.each(SUBTOPICS)('spokenLine is never empty for subtopic "%s"', (sub) => {
      const hook = generateStatusThreatHook('topic', sub);
      expect(hook.spokenLine).toBeTruthy();
      expect(hook.spokenLine.length).toBeGreaterThan(0);
    });

    it.each(SUBTOPICS)('displayText is never empty for subtopic "%s"', (sub) => {
      const hook = generateStatusThreatHook('topic', sub);
      expect(hook.displayText).toBeTruthy();
      expect(hook.displayText.length).toBeGreaterThan(0);
    });

    it.each(SUBTOPICS)('hookType matches the returned formula for subtopic "%s"', (sub) => {
      const hook = generateStatusThreatHook('topic', sub);
      const validTypes = ['lossAversion', 'statusThreat', 'cognitiveDissonance', 'curiosityGap', 'misconception'];
      expect(validTypes).toContain(hook.hookType);
    });

    it('topicSlug is set to the provided topic', () => {
      const hook = generateStatusThreatHook('my-topic', 'drop data');
      expect(hook.topicSlug).toBe('my-topic');
    });
  });
});

// ─── validateTERarc ───────────────────────────────────────────────────────────

describe('validateTERarc', () => {
  describe('minLength rule', () => {
    it('empty scenes array → valid=false with error rule "minLength"', () => {
      const result = validateTERarc([]);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.rule === 'minLength')).toBe(true);
    });

    it('empty scenes array → arcScores is empty array', () => {
      const result = validateTERarc([]);
      expect(result.arcScores).toEqual([]);
    });
  });

  describe('hookTension rule', () => {
    it('scene 0 tensionScore=0.6 → valid=false with hookTension error', () => {
      const scenes = [
        makeWorldClassScene({ tensionScore: 0.6, arcPosition: 'hook' }),
        makeWorldClassScene({ tensionScore: 0.9, emotionalBeat: 'escalation', arcPosition: 'escalation' }),
        makeWorldClassScene({ tensionScore: 0.2, emotionalBeat: 'resolution', arcPosition: 'resolution' }),
      ];
      const result = validateTERarc(scenes);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.rule === 'hookTension')).toBe(true);
    });

    it('scene 0 tensionScore=0.7 (< 0.8) → hookTension error', () => {
      const scenes = [
        makeWorldClassScene({ tensionScore: 0.7, arcPosition: 'hook' }),
        makeWorldClassScene({ tensionScore: 0.9, emotionalBeat: 'escalation', arcPosition: 'escalation' }),
        makeWorldClassScene({ tensionScore: 0.2, emotionalBeat: 'resolution', arcPosition: 'resolution' }),
      ];
      const result = validateTERarc(scenes);
      expect(result.errors.some(e => e.rule === 'hookTension')).toBe(true);
    });

    it('scene 0 tensionScore=0.8 (boundary) → no hookTension error', () => {
      const scenes = [
        makeWorldClassScene({ tensionScore: 0.8, arcPosition: 'hook' }),
        makeWorldClassScene({ tensionScore: 0.85, emotionalBeat: 'escalation', arcPosition: 'escalation' }),
        makeWorldClassScene({ tensionScore: 0.2, emotionalBeat: 'resolution', arcPosition: 'resolution' }),
      ];
      const result = validateTERarc(scenes);
      expect(result.errors.some(e => e.rule === 'hookTension')).toBe(false);
    });

    it('scene 0 tensionScore=0.9 → no hookTension error', () => {
      const scenes = [
        makeWorldClassScene({ tensionScore: 0.9, arcPosition: 'hook' }),
        makeWorldClassScene({ tensionScore: 0.95, emotionalBeat: 'escalation', arcPosition: 'escalation' }),
        makeWorldClassScene({ tensionScore: 0.2, emotionalBeat: 'resolution', arcPosition: 'resolution' }),
      ];
      const result = validateTERarc(scenes);
      expect(result.errors.some(e => e.rule === 'hookTension')).toBe(false);
    });
  });

  describe('resolutionTension rule', () => {
    it('resolution scene with tensionScore >= peak → error resolutionTension', () => {
      const scenes = [
        makeWorldClassScene({ tensionScore: 0.9, arcPosition: 'hook' }),
        makeWorldClassScene({ tensionScore: 0.95, emotionalBeat: 'escalation', arcPosition: 'escalation' }),
        // Resolution at 0.95 == peak → should error
        makeWorldClassScene({ tensionScore: 0.95, emotionalBeat: 'resolution', arcPosition: 'resolution' }),
      ];
      const result = validateTERarc(scenes);
      expect(result.errors.some(e => e.rule === 'resolutionTension')).toBe(true);
    });

    it('resolution scene with tensionScore > peak → error resolutionTension', () => {
      const scenes = [
        makeWorldClassScene({ tensionScore: 0.9, arcPosition: 'hook' }),
        makeWorldClassScene({ tensionScore: 0.85, emotionalBeat: 'escalation', arcPosition: 'escalation' }),
        makeWorldClassScene({ tensionScore: 0.95, emotionalBeat: 'resolution', arcPosition: 'resolution' }),
      ];
      const result = validateTERarc(scenes);
      expect(result.errors.some(e => e.rule === 'resolutionTension')).toBe(true);
    });

    it('resolution scene with tensionScore well below peak → no resolutionTension error', () => {
      const scenes = [
        makeWorldClassScene({ tensionScore: 0.9, arcPosition: 'hook' }),
        makeWorldClassScene({ tensionScore: 0.95, emotionalBeat: 'escalation', arcPosition: 'escalation' }),
        makeWorldClassScene({ tensionScore: 0.3, emotionalBeat: 'resolution', arcPosition: 'resolution' }),
      ];
      const result = validateTERarc(scenes);
      expect(result.errors.some(e => e.rule === 'resolutionTension')).toBe(false);
    });
  });

  describe('openLoop rule', () => {
    it('open loop not closed on a non-last scene → warning "openLoop"', () => {
      const scenes = [
        makeWorldClassScene({ tensionScore: 0.9, arcPosition: 'hook', loopId: 'loop-1' }),
        makeWorldClassScene({ tensionScore: 0.85, emotionalBeat: 'escalation', arcPosition: 'escalation' }),
        makeWorldClassScene({ tensionScore: 0.3, emotionalBeat: 'resolution', arcPosition: 'resolution' }),
      ];
      const result = validateTERarc(scenes);
      expect(result.warnings.some(w => w.rule === 'openLoop')).toBe(true);
    });

    it('open loop on last scene with zeigarnik_loop beat → NO openLoop warning', () => {
      const scenes = [
        makeWorldClassScene({ tensionScore: 0.9, arcPosition: 'hook' }),
        makeWorldClassScene({ tensionScore: 0.85, emotionalBeat: 'escalation', arcPosition: 'escalation' }),
        makeWorldClassScene({
          tensionScore: 0.6,
          emotionalBeat: 'zeigarnik_loop',
          arcPosition: 'open_end',
          loopId: 'loop-main',
        }),
      ];
      const result = validateTERarc(scenes);
      expect(result.warnings.some(w => w.rule === 'openLoop')).toBe(false);
    });

    it('closed loop → no openLoop warning', () => {
      const scenes = [
        makeWorldClassScene({ tensionScore: 0.9, arcPosition: 'hook', loopId: 'loop-main' }),
        makeWorldClassScene({ tensionScore: 0.85, emotionalBeat: 'escalation', arcPosition: 'escalation' }),
        makeWorldClassScene({
          tensionScore: 0.3,
          emotionalBeat: 'resolution',
          arcPosition: 'resolution',
          closesLoopId: 'loop-main',
        }),
      ];
      const result = validateTERarc(scenes);
      expect(result.warnings.some(w => w.rule === 'openLoop')).toBe(false);
    });
  });

  describe('btCoherence rule', () => {
    it('"therefore" connector after "tension" beat → btCoherence warning', () => {
      const scenes = [
        makeWorldClassScene({ tensionScore: 0.9, arcPosition: 'hook' }),
        makeWorldClassScene({
          tensionScore: 0.85,
          emotionalBeat: 'escalation',
          arcPosition: 'escalation',
          btConnector: 'therefore',
        }),
        makeWorldClassScene({ tensionScore: 0.3, emotionalBeat: 'resolution', arcPosition: 'resolution' }),
      ];
      const result = validateTERarc(scenes);
      expect(result.warnings.some(w => w.rule === 'btCoherence')).toBe(true);
    });

    it('"but" connector after "resolution" beat → btCoherence warning', () => {
      const scenes = [
        makeWorldClassScene({ tensionScore: 0.9, arcPosition: 'hook' }),
        makeWorldClassScene({ tensionScore: 0.3, emotionalBeat: 'resolution', arcPosition: 'resolution' }),
        makeWorldClassScene({
          tensionScore: 0.85,
          emotionalBeat: 'escalation',
          arcPosition: 'escalation',
          btConnector: 'but',
        }),
      ];
      const result = validateTERarc(scenes);
      expect(result.warnings.some(w => w.rule === 'btCoherence')).toBe(true);
    });

    it('"but" after "tension" → no btCoherence warning', () => {
      const scenes = [
        makeWorldClassScene({ tensionScore: 0.9, arcPosition: 'hook' }),
        makeWorldClassScene({
          tensionScore: 0.95,
          emotionalBeat: 'escalation',
          arcPosition: 'escalation',
          btConnector: 'but',
        }),
        makeWorldClassScene({ tensionScore: 0.3, emotionalBeat: 'resolution', arcPosition: 'resolution' }),
      ];
      const result = validateTERarc(scenes);
      expect(result.warnings.some(w => w.rule === 'btCoherence')).toBe(false);
    });
  });

  describe('valid TER arc', () => {
    it('well-formed 0.9 tension → 0.8/0.9 escalation → 0.3 resolution → valid=true, no errors', () => {
      const scenes = [
        makeWorldClassScene({ tensionScore: 0.9, arcPosition: 'hook', btConnector: undefined }),
        makeWorldClassScene({
          tensionScore: 0.8,
          emotionalBeat: 'escalation',
          arcPosition: 'tension_build',
          btConnector: 'but',
        }),
        makeWorldClassScene({
          tensionScore: 0.9,
          emotionalBeat: 'escalation',
          arcPosition: 'escalation',
          btConnector: 'but',
        }),
        makeWorldClassScene({
          tensionScore: 0.3,
          emotionalBeat: 'resolution',
          arcPosition: 'resolution',
          btConnector: 'therefore',
        }),
      ];
      const result = validateTERarc(scenes);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('arcScores length matches scenes length', () => {
      const scenes = [
        makeWorldClassScene({ tensionScore: 0.9, arcPosition: 'hook' }),
        makeWorldClassScene({ tensionScore: 0.95, emotionalBeat: 'escalation', arcPosition: 'escalation' }),
        makeWorldClassScene({ tensionScore: 0.3, emotionalBeat: 'resolution', arcPosition: 'resolution' }),
      ];
      const result = validateTERarc(scenes);
      expect(result.arcScores).toHaveLength(3);
    });

    it('arcScores contains correct tensionScore and beat per scene', () => {
      const scenes = [
        makeWorldClassScene({ tensionScore: 0.9, arcPosition: 'hook' }),
        makeWorldClassScene({ tensionScore: 0.3, emotionalBeat: 'resolution', arcPosition: 'resolution' }),
      ];
      const result = validateTERarc(scenes);
      expect(result.arcScores[0]).toMatchObject({ scene: 0, tensionScore: 0.9, beat: 'tension' });
      expect(result.arcScores[1]).toMatchObject({ scene: 1, tensionScore: 0.3, beat: 'resolution' });
    });
  });
});

// ─── injectMicroRewards ───────────────────────────────────────────────────────

describe('injectMicroRewards', () => {
  it('empty scenes → returns empty array', () => {
    expect(injectMicroRewards([])).toEqual([]);
  });

  it('single 10s tension scene → 1 reward at triggerSec=6', () => {
    const scenes = [makeWorldClassScene({ duration: 10, emotionalBeat: 'tension' })];
    const result = injectMicroRewards(scenes, 6);
    expect(result[0].microRewards).toHaveLength(1);
    expect(result[0].microRewards![0].triggerSec).toBe(6);
  });

  it('single 10s scene → reward interval ends before scene end (6 < 10)', () => {
    const scenes = [makeWorldClassScene({ duration: 10, emotionalBeat: 'tension' })];
    const result = injectMicroRewards(scenes, 6);
    // triggerSec=6, next=12 which is >= 10 so only 1 reward
    expect(result[0].microRewards).toHaveLength(1);
  });

  it('single 20s scene → 3 rewards at triggerSec=6, 12, and 18', () => {
    // With intervalSec=6 and duration=20: rewards at 6, 12, 18 (all < 20)
    const scenes = [makeWorldClassScene({ duration: 20, emotionalBeat: 'tension' })];
    const result = injectMicroRewards(scenes, 6);
    expect(result[0].microRewards).toHaveLength(3);
    expect(result[0].microRewards![0].triggerSec).toBe(6);
    expect(result[0].microRewards![1].triggerSec).toBe(12);
    expect(result[0].microRewards![2].triggerSec).toBe(18);
  });

  describe('reward type matches emotional beat', () => {
    it('tension beat scene → cliffhanger reward type', () => {
      const scenes = [makeWorldClassScene({ duration: 10, emotionalBeat: 'tension' })];
      const result = injectMicroRewards(scenes, 6);
      expect(result[0].microRewards![0].type).toBe('cliffhanger');
    });

    it('escalation beat scene → revelation reward type', () => {
      const scenes = [makeWorldClassScene({ duration: 10, emotionalBeat: 'escalation' })];
      const result = injectMicroRewards(scenes, 6);
      expect(result[0].microRewards![0].type).toBe('revelation');
    });

    it('resolution beat scene → confirmation reward type', () => {
      const scenes = [makeWorldClassScene({ duration: 10, emotionalBeat: 'resolution' })];
      const result = injectMicroRewards(scenes, 6);
      expect(result[0].microRewards![0].type).toBe('confirmation');
    });

    it('zeigarnik_loop beat scene → setup reward type', () => {
      const scenes = [makeWorldClassScene({ duration: 10, emotionalBeat: 'zeigarnik_loop' })];
      const result = injectMicroRewards(scenes, 6);
      expect(result[0].microRewards![0].type).toBe('setup');
    });
  });

  it('existing microRewards are preserved (accumulate, not overwritten)', () => {
    const existingReward = { triggerSec: 2, type: 'cliffhanger' as const };
    const scenes = [
      makeWorldClassScene({
        duration: 10,
        emotionalBeat: 'tension',
        microRewards: [existingReward],
      }),
    ];
    const result = injectMicroRewards(scenes, 6);
    // Should have the existing reward + the new one at t=6
    expect(result[0].microRewards).toHaveLength(2);
    expect(result[0].microRewards![0]).toEqual(existingReward);
    expect(result[0].microRewards![1].triggerSec).toBe(6);
  });

  it('scene shorter than interval → no rewards injected', () => {
    const scenes = [makeWorldClassScene({ duration: 5, emotionalBeat: 'tension' })];
    const result = injectMicroRewards(scenes, 6);
    // nextRewardSec=6, sceneEndSec=5: 6 < 5 is false → no rewards
    expect(result[0].microRewards).toBeUndefined();
  });

  it('rewards span across multiple scenes correctly', () => {
    // Scene 0: 0–8s, Scene 1: 8–16s
    // Rewards at 6, 12 → scene 0 gets reward at triggerSec=6, scene 1 gets reward at triggerSec=4 (12-8)
    const scenes = [
      makeWorldClassScene({ duration: 8, emotionalBeat: 'tension' }),
      makeWorldClassScene({ duration: 8, emotionalBeat: 'escalation' }),
    ];
    const result = injectMicroRewards(scenes, 6);
    expect(result[0].microRewards).toHaveLength(1);
    expect(result[0].microRewards![0].triggerSec).toBe(6);
    expect(result[1].microRewards).toHaveLength(1);
    expect(result[1].microRewards![0].triggerSec).toBe(4); // 12 - 8 = 4
  });

  it('scene with no duration defaults to 8s', () => {
    const scenes = [makeWorldClassScene({ duration: undefined as any, emotionalBeat: 'tension' })];
    const result = injectMicroRewards(scenes, 6);
    // duration defaults to 8, nextRewardSec=6 < 8 → 1 reward at triggerSec=6
    expect(result[0].microRewards).toHaveLength(1);
    expect(result[0].microRewards![0].triggerSec).toBe(6);
  });
});

// ─── buildTERarcFromScenes ────────────────────────────────────────────────────

describe('buildTERarcFromScenes', () => {
  const TOPIC = 'kafka';
  const SUBTOPIC = 'drop messages'; // "drop" → lossAversion hook

  describe('single scene', () => {
    it('single scene → arcPosition="hook"', () => {
      const scenes = [makeScene({ duration: 10 })];
      const result = buildTERarcFromScenes(scenes, TOPIC, SUBTOPIC);
      expect(result[0].arcPosition).toBe('hook');
    });

    it('single scene → emotionalBeat="tension"', () => {
      const scenes = [makeScene({ duration: 10 })];
      const result = buildTERarcFromScenes(scenes, TOPIC, SUBTOPIC);
      expect(result[0].emotionalBeat).toBe('tension');
    });

    it('single scene → tensionScore=0.9', () => {
      const scenes = [makeScene({ duration: 10 })];
      const result = buildTERarcFromScenes(scenes, TOPIC, SUBTOPIC);
      expect(result[0].tensionScore).toBe(0.9);
    });
  });

  describe('5 scenes', () => {
    const fiveScenes = Array.from({ length: 5 }, (_, i) =>
      makeScene({ duration: 10, heading: `Scene ${i}` }),
    );

    it('first scene is hook', () => {
      const result = buildTERarcFromScenes(fiveScenes, TOPIC, SUBTOPIC);
      expect(result[0].arcPosition).toBe('hook');
    });

    it('last scene is zeigarnik_loop open end when forceOpenLoop=true (default)', () => {
      const result = buildTERarcFromScenes(fiveScenes, TOPIC, SUBTOPIC);
      expect(result[4].emotionalBeat).toBe('zeigarnik_loop');
    });

    it('last scene arcPosition is "open_end" when forceOpenLoop=true (default)', () => {
      const result = buildTERarcFromScenes(fiveScenes, TOPIC, SUBTOPIC);
      expect(result[4].arcPosition).toBe('open_end');
    });
  });

  describe('forceOpenLoop=false', () => {
    const fiveScenes = Array.from({ length: 5 }, () => makeScene({ duration: 10 }));

    it('last scene is resolution', () => {
      const result = buildTERarcFromScenes(fiveScenes, TOPIC, SUBTOPIC, { forceOpenLoop: false });
      expect(result[4].arcPosition).toBe('resolution');
    });

    it('last scene emotionalBeat is "resolution"', () => {
      const result = buildTERarcFromScenes(fiveScenes, TOPIC, SUBTOPIC, { forceOpenLoop: false });
      expect(result[4].emotionalBeat).toBe('resolution');
    });

    it('last scene (resolution) tensionScore is below 0.35', () => {
      const result = buildTERarcFromScenes(fiveScenes, TOPIC, SUBTOPIC, { forceOpenLoop: false });
      expect(result[4].tensionScore).toBeLessThanOrEqual(0.35);
      expect(result[4].tensionScore).toBeGreaterThanOrEqual(0.1);
    });
  });

  describe('btConnector assignments', () => {
    const fiveScenes = Array.from({ length: 5 }, () => makeScene({ duration: 10 }));

    it('scene 0 (hook) → btConnector is undefined', () => {
      const result = buildTERarcFromScenes(fiveScenes, TOPIC, SUBTOPIC);
      expect(result[0].btConnector).toBeUndefined();
    });

    it('escalation scenes → btConnector is "but"', () => {
      const result = buildTERarcFromScenes(fiveScenes, TOPIC, SUBTOPIC);
      const escalationScenes = result.filter(s => s.emotionalBeat === 'escalation');
      for (const scene of escalationScenes) {
        expect(scene.btConnector).toBe('but');
      }
    });

    it('resolution scenes → btConnector is "therefore"', () => {
      const result = buildTERarcFromScenes(fiveScenes, TOPIC, SUBTOPIC);
      const resolutionScenes = result.filter(s => s.emotionalBeat === 'resolution');
      for (const scene of resolutionScenes) {
        expect(scene.btConnector).toBe('therefore');
      }
    });

    it('last scene (open_end / zeigarnik_loop) → btConnector is "therefore"', () => {
      const result = buildTERarcFromScenes(fiveScenes, TOPIC, SUBTOPIC);
      expect(result[4].btConnector).toBe('therefore');
    });
  });

  describe('hook script injection on scene 0', () => {
    const scenes = [makeScene({ duration: 10, heading: 'Original Heading' })];

    it('scene 0 displayText is set to hookScript.displayText', () => {
      const result = buildTERarcFromScenes(scenes, TOPIC, SUBTOPIC);
      const expectedHook = result[0].displayText;
      // Should not be the original heading (which we left undefined/empty)
      expect(expectedHook).toBeTruthy();
      // Should match the generated hook display text (uppercase per lossAversion pattern)
      expect(expectedHook).toContain('BROKEN');
    });

    it('scene 0 spokenHookLine is set to hookScript.spokenLine', () => {
      const result = buildTERarcFromScenes(scenes, TOPIC, SUBTOPIC);
      expect(result[0].spokenHookLine).toBeTruthy();
      expect(result[0].spokenHookLine!.length).toBeGreaterThan(0);
    });

    it('non-hook scenes do not have spokenHookLine', () => {
      const twoScenes = [makeScene({ duration: 10 }), makeScene({ duration: 10 })];
      const result = buildTERarcFromScenes(twoScenes, TOPIC, SUBTOPIC);
      expect(result[1].spokenHookLine).toBeUndefined();
    });

    it('non-hook scenes get their original heading as displayText', () => {
      const twoScenes = [makeScene({ duration: 10 }), makeScene({ duration: 10, heading: 'My Heading' })];
      const result = buildTERarcFromScenes(twoScenes, TOPIC, SUBTOPIC);
      expect(result[1].displayText).toBe('My Heading');
    });
  });

  describe('micro-rewards are injected', () => {
    it('long enough scenes get microRewards', () => {
      const scenes = Array.from({ length: 3 }, () => makeScene({ duration: 10 }));
      const result = buildTERarcFromScenes(scenes, TOPIC, SUBTOPIC);
      // With 10s scenes and 6s interval: scene 0 gets reward at t=6, scene 1 at t=2 (12-10)
      const withRewards = result.filter(s => s.microRewards && s.microRewards.length > 0);
      expect(withRewards.length).toBeGreaterThan(0);
    });
  });

  describe('loopId and closesLoopId', () => {
    it('scene 0 gets loopId = "<topic>-main"', () => {
      const scenes = [makeScene({ duration: 10 })];
      const result = buildTERarcFromScenes(scenes, TOPIC, SUBTOPIC);
      expect(result[0].loopId).toBe(`${TOPIC}-main`);
    });

    it('non-first scenes do not get loopId', () => {
      const twoScenes = [makeScene({ duration: 10 }), makeScene({ duration: 10 })];
      const result = buildTERarcFromScenes(twoScenes, TOPIC, SUBTOPIC);
      expect(result[1].loopId).toBeUndefined();
    });

    it('last scene with forceOpenLoop=false gets closesLoopId', () => {
      const twoScenes = [makeScene({ duration: 10 }), makeScene({ duration: 10 })];
      const result = buildTERarcFromScenes(twoScenes, TOPIC, SUBTOPIC, { forceOpenLoop: false });
      expect(result[1].closesLoopId).toBe(`${TOPIC}-main`);
    });

    it('last scene with forceOpenLoop=true does not close loop', () => {
      const twoScenes = [makeScene({ duration: 10 }), makeScene({ duration: 10 })];
      const result = buildTERarcFromScenes(twoScenes, TOPIC, SUBTOPIC, { forceOpenLoop: true });
      expect(result[1].closesLoopId).toBeUndefined();
    });
  });

  describe('output array length matches input', () => {
    it('returns same number of scenes as input', () => {
      const scenes = Array.from({ length: 7 }, () => makeScene());
      const result = buildTERarcFromScenes(scenes, TOPIC, SUBTOPIC);
      expect(result).toHaveLength(7);
    });
  });

  describe('misconception override propagation', () => {
    it('misconceptionText is set on scene 0 when misconception is seeded', () => {
      const scenes = [makeScene({ duration: 10 })];
      const mc = 'Kafka delivers exactly-once by default';
      const result = buildTERarcFromScenes(scenes, 'kafka', 'unknown subtopic', {
        misconceptionOverride: mc,
      });
      expect(result[0].misconceptionText).toBe(mc);
    });

    it('misconceptionText is undefined on scene 0 when no misconception is seeded (null → undefined)', () => {
      const scenes = [makeScene({ duration: 10 })];
      // lossAversion hook has misconceptionSeeded=null → should become undefined
      const result = buildTERarcFromScenes(scenes, 'kafka', 'drop data');
      expect(result[0].misconceptionText).toBeUndefined();
    });
  });
});
