/**
 * short-arc-builder.ts
 *
 * World-class YouTube Shorts arc builder implementing:
 * - TER (Tension → Escalation → Resolution) structural arc
 * - 5 hook transformation formulas (status threat, loss aversion, etc.)
 * - Micro-reward injection every 6-8 seconds
 * - Zeigarnik open-loop ending
 * - TER arc validation
 */

import type {
  WorldClassScene,
  Scene,
  HookScript,
  HookType,
  EmotionalBeat,
  MicroRewardType,
  MicroReward,
  BTConnector,
  TERValidationResult,
  TERError,
  TERWarning,
  ShortGenerationOptions,
} from '../types';

// ─── Viewer Identity Anchors ─────────────────────────────────────────────────
// Makes hooks personally relevant by referencing pain points the viewer has felt

const VIEWER_IDENTITY_ANCHORS: Record<string, string> = {
  'kafka': 'If you\'ve seen a consumer lag spike you couldn\'t explain — ',
  'kubernetes': 'If your pods restart at 3am for no reason — ',
  'redis': 'If you\'ve had Redis evict a key you needed — ',
  'database': 'If you\'ve run EXPLAIN and still not understood the slow query — ',
  'load-balancing': 'If requests pile up even after scaling horizontally — ',
  'caching': 'If your cache hit rate drops for no reason — ',
  'microservices': 'If a single service failure brought down your whole system — ',
  'docker': 'If a container works locally but breaks in production — ',
  'distributed-systems': 'If your system behaves differently under load — ',
  'message-queue': 'If messages disappear without any error — ',
  'default': 'If you\'ve shipped something that broke in production but not locally — ',
};

export function getViewerIdentityAnchor(topicSlug: string): string {
  return VIEWER_IDENTITY_ANCHORS[topicSlug] || VIEWER_IDENTITY_ANCHORS['default'];
}

// ─── Hook Transformation Patterns ────────────────────────────────────────────
// Each formula targets a specific psychological trigger

const HOOK_PATTERNS: Record<HookType, (topic: string, subtopic: string, misconception?: string) => HookScript> = {
  lossAversion: (topic, subtopic) => ({
    spokenLine: `Your ${subtopic} is silently losing data right now.`,
    displayText: `YOUR ${subtopic.toUpperCase()}\nIS BROKEN`,
    hookType: 'lossAversion',
    topicSlug: topic,
    tensionVector: 'loss',
    misconceptionSeeded: null,
  }),

  statusThreat: (topic, subtopic) => ({
    spokenLine: `Senior engineers configure ${subtopic} differently than you do.`,
    displayText: `SENIOR ENGINEERS\nDO THIS DIFFERENTLY`,
    hookType: 'statusThreat',
    topicSlug: topic,
    tensionVector: 'status',
    misconceptionSeeded: null,
  }),

  cognitiveDissonance: (topic, subtopic, misconception) => {
    const mc = misconception || `${subtopic} is safe by default`;
    return {
      spokenLine: `You think ${mc}. That's exactly why your system will fail.`,
      displayText: `EVERYONE THINKS\nTHIS IS SAFE`,
      hookType: 'cognitiveDissonance',
      topicSlug: topic,
      tensionVector: 'dissonance',
      misconceptionSeeded: mc,
    };
  },

  curiosityGap: (topic, subtopic) => ({
    spokenLine: `Nobody tells you the most dangerous thing about ${subtopic}.`,
    displayText: `THE HIDDEN DANGER\nNO ONE MENTIONS`,
    hookType: 'curiosityGap',
    topicSlug: topic,
    tensionVector: 'loss',
    misconceptionSeeded: null,
  }),

  misconception: (topic, subtopic, misconception) => {
    const mc = misconception || `${subtopic} handles failures automatically`;
    return {
      spokenLine: `${mc}. Wrong — here's what actually happens.`,
      displayText: `"${mc.toUpperCase()}"`,
      hookType: 'misconception',
      topicSlug: topic,
      tensionVector: 'dissonance',
      misconceptionSeeded: mc,
    };
  },
};

// Internal helper: apply viewer identity anchor to any hook result
function withViewerAnchor(hookResult: HookScript, topic: string): HookScript {
  return {
    ...hookResult,
    spokenLine: `${getViewerIdentityAnchor(topic)}${hookResult.spokenLine}`,
  };
}

/**
 * Generate a status-threat or loss-aversion hook for a topic/subtopic.
 * Automatically selects the most psychologically potent formula.
 */
export function generateStatusThreatHook(
  topic: string,
  subtopic: string,
  misconception?: string,
): HookScript {
  const lower = subtopic.toLowerCase();

  // Select formula based on subtopic keywords
  if (lower.includes('drop') || lower.includes('los') || lower.includes('miss') || lower.includes('fail')) {
    return withViewerAnchor(HOOK_PATTERNS.lossAversion(topic, subtopic, misconception), topic);
  }
  if (lower.includes('config') || lower.includes('senior') || lower.includes('expert') || lower.includes('best')) {
    return withViewerAnchor(HOOK_PATTERNS.statusThreat(topic, subtopic, misconception), topic);
  }
  if (lower.includes('safe') || lower.includes('default') || lower.includes('auto') || lower.includes('think')) {
    return withViewerAnchor(HOOK_PATTERNS.cognitiveDissonance(topic, subtopic, misconception), topic);
  }
  if (lower.includes('secret') || lower.includes('hidden') || lower.includes('nobody') || lower.includes('danger')) {
    return withViewerAnchor(HOOK_PATTERNS.curiosityGap(topic, subtopic, misconception), topic);
  }
  if (misconception) {
    return withViewerAnchor(HOOK_PATTERNS.misconception(topic, subtopic, misconception), topic);
  }

  // Default: alternate between statusThreat and lossAversion based on topic hash
  const hash = topic.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const selectedFormula = hash % 2 === 0
    ? HOOK_PATTERNS.statusThreat(topic, subtopic, misconception)
    : HOOK_PATTERNS.lossAversion(topic, subtopic, misconception);
  return {
    ...selectedFormula,
    spokenLine: `${getViewerIdentityAnchor(topic)}${selectedFormula.spokenLine}`,
  };
}

// ─── TER Arc Validator ────────────────────────────────────────────────────────

/**
 * Validate that a sequence of WorldClassScenes follows the TER arc rules:
 * 1. Scene 0 tensionScore >= 0.8 (hook must be high tension)
 * 2. Tension peak must occur in scenes 2–4
 * 3. Escalation zone is monotonically non-decreasing
 * 4. Resolution scene must lower tension below peak
 * 5. Every open loop must be closed OR be on the last scene (Zeigarnik)
 * 6. but/therefore connectors must be coherent
 */
export function validateTERarc(scenes: WorldClassScene[]): TERValidationResult {
  const errors: TERError[] = [];
  const warnings: TERWarning[] = [];
  const arcScores = scenes.map((s, i) => ({
    scene: i,
    tensionScore: s.tensionScore,
    beat: s.emotionalBeat,
  }));

  if (scenes.length === 0) {
    return { valid: false, errors: [{ rule: 'minLength', message: 'Must have at least 3 scenes' }], warnings: [], arcScores };
  }

  // Rule 1: Hook must be high tension
  if (scenes[0].tensionScore < 0.8) {
    errors.push({
      rule: 'hookTension',
      message: `Scene 0 tensionScore is ${scenes[0].tensionScore} — must be >= 0.8`,
      sceneIndex: 0,
    });
  }

  // Rule 2: Tension peak in scenes 2–4
  const searchEnd = Math.min(5, scenes.length);
  const peakScene = scenes
    .slice(0, searchEnd)
    .reduce((maxIdx, s, i) => (s.tensionScore > scenes[maxIdx].tensionScore ? i : maxIdx), 0);
  if (peakScene < 2 || peakScene > 4) {
    warnings.push({
      rule: 'tensionPeak',
      message: `Tension peak at scene ${peakScene} — optimal range is 2–4`,
      sceneIndex: peakScene,
    });
  }

  // Rule 3: Escalation zone monotonically non-decreasing
  const escalationScenes = scenes.filter(s => s.emotionalBeat === 'escalation');
  for (let i = 1; i < escalationScenes.length; i++) {
    if (escalationScenes[i].tensionScore < escalationScenes[i - 1].tensionScore - 0.1) {
      warnings.push({
        rule: 'escalationMonotone',
        message: `Escalation tension dropped at index ${i}: ${escalationScenes[i - 1].tensionScore} → ${escalationScenes[i].tensionScore}`,
      });
    }
  }

  // Rule 4: Resolution must lower tension below peak
  const resolutionScenes = scenes.filter(s => s.emotionalBeat === 'resolution');
  const peakTension = Math.max(...scenes.map(s => s.tensionScore));
  for (const rs of resolutionScenes) {
    if (rs.tensionScore >= peakTension) {
      errors.push({
        rule: 'resolutionTension',
        message: `Resolution scene tensionScore (${rs.tensionScore}) must be below peak (${peakTension})`,
      });
    }
  }

  // Rule 5: Open loops must be closed (or be Zeigarnik on last scene)
  const openLoops = new Map<string, number>();
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    if (s.loopId) openLoops.set(s.loopId, i);
    if (s.closesLoopId) openLoops.delete(s.closesLoopId);
  }
  for (const [loopId, sceneIdx] of openLoops) {
    const isLastScene = sceneIdx === scenes.length - 1;
    const isZeigarnik = scenes[sceneIdx].emotionalBeat === 'zeigarnik_loop';
    if (!isLastScene || !isZeigarnik) {
      warnings.push({
        rule: 'openLoop',
        message: `Loop "${loopId}" opened at scene ${sceneIdx} but never closed (non-Zeigarnik)`,
        sceneIndex: sceneIdx,
      });
    }
  }

  // Rule 6: but/therefore coherence
  for (let i = 1; i < scenes.length; i++) {
    const prev = scenes[i - 1];
    const curr = scenes[i];
    if (curr.btConnector === 'but' && prev.emotionalBeat === 'resolution') {
      warnings.push({
        rule: 'btCoherence',
        message: `Scene ${i}: "but" connector after a resolution beat is incoherent`,
        sceneIndex: i,
      });
    }
    if (curr.btConnector === 'therefore' && prev.emotionalBeat === 'tension') {
      warnings.push({
        rule: 'btCoherence',
        message: `Scene ${i}: "therefore" after tension (should be "but" to escalate)`,
        sceneIndex: i,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    arcScores,
  };
}

// ─── Micro Reward Injector ────────────────────────────────────────────────────

const REWARD_TYPE_MATRIX: Record<EmotionalBeat, MicroRewardType> = {
  tension: 'cliffhanger',
  escalation: 'revelation',
  resolution: 'confirmation',
  zeigarnik_loop: 'setup',
};

/**
 * Inject micro-rewards into scenes at regular intervals.
 * Each reward fires a visual pulse / caption highlight in the composition.
 */
export function injectMicroRewards(
  scenes: WorldClassScene[],
  intervalSec: number = 6,
): WorldClassScene[] {
  let cumulativeSec = 0;
  let nextRewardSec = intervalSec;

  return scenes.map(scene => {
    const sceneDuration = scene.duration || 8;
    const sceneEndSec = cumulativeSec + sceneDuration;
    const rewards: MicroReward[] = [];

    // Inject rewards that fall within this scene
    while (nextRewardSec < sceneEndSec) {
      const triggerSec = nextRewardSec - cumulativeSec;
      rewards.push({
        triggerSec,
        type: REWARD_TYPE_MATRIX[scene.emotionalBeat],
        displayText: scene.retentionHook,
      });
      nextRewardSec += intervalSec;
    }

    cumulativeSec = sceneEndSec;

    return rewards.length > 0
      ? { ...scene, microRewards: [...(scene.microRewards || []), ...rewards] }
      : scene;
  });
}

// ─── Scene Wrapper ────────────────────────────────────────────────────────────

/**
 * Wrap existing Scene objects with WorldClassScene defaults.
 * Used when upgrading legacy pipeline scenes to the TER arc model.
 */
export function wrapSceneWithArc(
  scene: Scene,
  overrides: Partial<WorldClassScene>,
): WorldClassScene {
  return {
    ...scene,
    emotionalBeat: 'escalation',
    microRewardType: 'revelation',
    tensionScore: 0.5,
    arcPosition: 'escalation',
    ...overrides,
  };
}

/**
 * Build a TER arc from a flat list of existing Scene objects.
 * Maps scenes to arc positions based on their index relative to total count.
 */
export function buildTERarcFromScenes(
  scenes: Scene[],
  topic: string,
  subtopic: string,
  options: ShortGenerationOptions = {},
): WorldClassScene[] {
  const n = scenes.length;
  const hookScript = generateStatusThreatHook(topic, subtopic, options.misconceptionOverride);

  const worldScenes: WorldClassScene[] = scenes.map((scene, i) => {
    const ratio = i / Math.max(n - 1, 1);

    // Determine arc position
    let arcPosition: WorldClassScene['arcPosition'];
    let emotionalBeat: EmotionalBeat;
    let tensionScore: number;
    let btConnector: BTConnector | undefined;

    // TER arc with natural curve: hook(0.9) → rise(0.75→0.88) → peak(0.95) → valley(0.5) → resolution(0.2)
    // valley at ~60% creates the "relief before final revelation" beat
    function arcTensionScore(r: number, ap: WorldClassScene['arcPosition']): number {
      if (ap === 'hook') return 0.9;
      if (ap === 'open_end') return 0.85;
      if (ap === 'resolution') return Math.max(0.2, 0.5 - r * 0.3);
      // Natural sine curve: rises to 0.95 at 50%, dips to 0.55 at 65%, back up to 0.85 before resolution
      const angle = r * Math.PI;
      const base = 0.7 + 0.25 * Math.sin(angle);
      // Add valley dip at 60-70% (the "relief beat" before final revelation)
      const valleyDip = (r > 0.55 && r < 0.72) ? -0.35 * Math.sin((r - 0.55) / 0.17 * Math.PI) : 0;
      return Math.max(0.2, Math.min(0.98, base + valleyDip));
    }

    if (i === 0) {
      arcPosition = 'hook';
      emotionalBeat = 'tension';
      tensionScore = arcTensionScore(ratio, 'hook');
      btConnector = undefined;
    } else if (i === n - 1) {
      // Last scene: Zeigarnik open loop (if forceOpenLoop) or resolution
      if (options.forceOpenLoop ?? true) {
        arcPosition = 'open_end';
        emotionalBeat = 'zeigarnik_loop';
        tensionScore = arcTensionScore(ratio, 'open_end');
        btConnector = 'therefore';
      } else {
        arcPosition = 'resolution';
        emotionalBeat = 'resolution';
        tensionScore = arcTensionScore(ratio, 'resolution');
        btConnector = 'therefore';
      }
    } else if (ratio < 0.35) {
      arcPosition = 'tension_build';
      emotionalBeat = 'tension';
      tensionScore = arcTensionScore(ratio, 'tension_build');
      btConnector = 'but';
    } else if (ratio < 0.7) {
      arcPosition = 'escalation';
      emotionalBeat = 'escalation';
      tensionScore = arcTensionScore(ratio, 'escalation');
      btConnector = 'but';
    } else {
      arcPosition = 'resolution';
      emotionalBeat = 'resolution';
      tensionScore = arcTensionScore(ratio, 'resolution');
      btConnector = 'therefore';
    }

    // Hook scene gets special display text
    const displayText = i === 0 ? hookScript.displayText : scene.heading;
    const spokenHookLine = i === 0 ? hookScript.spokenLine : undefined;
    const openLoopQuestion = i === n - 1 && (options.forceOpenLoop ?? true)
      ? `But there's one more thing you need to know about ${subtopic}...`
      : undefined;
    const loopId = i === 0 ? `${topic}-main` : undefined;
    const closesLoopId = i === n - 1 && !options.forceOpenLoop ? `${topic}-main` : undefined;

    return {
      ...scene,
      emotionalBeat,
      hookType: i === 0 ? hookScript.hookType : undefined,
      microRewardType: REWARD_TYPE_MATRIX[emotionalBeat],
      btConnector,
      tensionScore,
      arcPosition,
      displayText,
      spokenHookLine,
      openLoopQuestion,
      loopId,
      closesLoopId,
      misconceptionText: i === 0 ? hookScript.misconceptionSeeded ?? undefined : undefined,
    };
  });

  // Inject micro-rewards
  return injectMicroRewards(worldScenes, 6);
}
