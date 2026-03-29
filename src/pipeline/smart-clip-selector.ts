/**
 * Smart Clip Selector — picks the best subtopic clips from a long-form storyboard
 * for rendering as viral shorts via the ViralShort composition.
 */

import type { Scene, Storyboard } from '../types';

// ── Exported interface ───────────────────────────────────────────────────────

export interface SubtopicClip {
  startScene: number;
  endScene: number;       // inclusive
  heading: string;
  archetype: 'interview' | 'code' | 'problem' | 'subtopic';
  duration: number;       // seconds
  score: number;
  hookText: string;
}

// ── Internal: scene group (consecutive scenes sharing a heading) ─────────────

interface SceneGroup {
  heading: string;
  startScene: number;   // index into the original scenes array
  endScene: number;     // inclusive
  archetype: 'interview' | 'code' | 'problem' | 'subtopic';
  duration: number;     // seconds
  sceneCount: number;
}

// ── Archetype detection ──────────────────────────────────────────────────────

function detectArchetype(scenes: Scene[]): SceneGroup['archetype'] {
  const types = scenes.map((s) => s.type);
  if (types.includes('interview') || types.includes('review')) return 'interview';
  if (types.includes('code')) return 'code';

  // Check narration/content for problem-like keywords
  const text = scenes.map((s) => `${s.narration ?? ''} ${s.content ?? ''}`).join(' ').toLowerCase();
  if (/problem|challenge|edge.?case|tricky|pitfall|mistake|wrong|fail|bug/.test(text)) {
    return 'problem';
  }

  return 'subtopic';
}

// ── selectSubtopicClips ──────────────────────────────────────────────────────

export function selectSubtopicClips(
  scenes: Scene[],
  topic: string,
  fps: number,
): SubtopicClip[] {
  // 1. Filter out title scenes (keep everything else)
  const indexedScenes = scenes
    .map((s, i) => ({ scene: s, originalIndex: i }))
    .filter(({ scene }) => scene.type !== 'title');

  if (indexedScenes.length === 0) return [];

  // 2. Group consecutive scenes by heading
  const groups: SceneGroup[] = [];
  let currentHeading = indexedScenes[0].scene.heading ?? '';
  let groupStart = 0;

  for (let i = 1; i <= indexedScenes.length; i++) {
    const heading = i < indexedScenes.length
      ? (indexedScenes[i].scene.heading ?? '')
      : '__END__';

    if (heading !== currentHeading || i === indexedScenes.length) {
      const groupScenes = indexedScenes.slice(groupStart, i);
      const duration = groupScenes.reduce(
        (sum, { scene }) => sum + (scene.endFrame - scene.startFrame) / fps,
        0,
      );

      groups.push({
        heading: currentHeading || `Segment ${groups.length + 1}`,
        startScene: groupScenes[0].originalIndex,
        endScene: groupScenes[groupScenes.length - 1].originalIndex,
        archetype: detectArchetype(groupScenes.map((g) => g.scene)),
        duration: Math.round(duration * 10) / 10,
        sceneCount: groupScenes.length,
      });

      if (i < indexedScenes.length) {
        currentHeading = heading;
        groupStart = i;
      }
    }
  }

  // 3. Score each group
  const scored = groups.map((group) => {
    // Base score by archetype
    let score = 0;
    switch (group.archetype) {
      case 'interview': score = 100; break;
      case 'code':      score = 80;  break;
      case 'problem':   score = 70;  break;
      case 'subtopic':  score = 50;  break;
    }

    // Bonus for sweet-spot duration (30-50 seconds)
    if (group.duration >= 30 && group.duration <= 50) {
      score += 20;
    }

    // Bonus for having multiple scenes (richer content)
    if (group.sceneCount > 1) {
      score += 10;
    }

    return { group, score };
  });

  // 4. Filter: 20-58 seconds only (YouTube Shorts must be under 60s)
  const eligible = scored.filter(
    ({ group }) => group.duration >= 20 && group.duration <= 58,
  );

  // 5. Sort by score descending
  eligible.sort((a, b) => b.score - a.score);

  // 6. Select top 5 non-overlapping clips
  const selected: SubtopicClip[] = [];

  for (const { group, score } of eligible) {
    if (selected.length >= 5) break;

    // Check for overlap with already-selected clips
    const overlaps = selected.some(
      (c) => group.startScene <= c.endScene && group.endScene >= c.startScene,
    );
    if (overlaps) continue;

    selected.push({
      startScene: group.startScene,
      endScene: group.endScene,
      heading: group.heading,
      archetype: group.archetype,
      duration: group.duration,
      score,
      hookText: generateHookText(group, topic),
    });
  }

  // 7. Return in chronological order
  selected.sort((a, b) => a.startScene - b.startScene);

  return selected;
}

// ── buildMiniStoryboard ──────────────────────────────────────────────────────

export function buildMiniStoryboard(
  original: Storyboard,
  clipStartScene: number,
  clipEndScene: number,
): Storyboard {
  // 1. Slice scenes (clipEndScene is inclusive)
  const selectedScenes = original.scenes.slice(clipStartScene, clipEndScene + 1);

  // 2. Re-index frames starting from 0
  let cursor = 0;
  const reindexed: Scene[] = selectedScenes.map((scene) => {
    const duration = scene.endFrame - scene.startFrame;
    const reindexedScene: Scene = {
      ...scene,
      startFrame: cursor,
      endFrame: cursor + duration,
    };
    cursor += duration;
    return reindexedScene;
  });

  const totalContentFrames = cursor;

  // 3. Calculate _audioStartOffset from first scene's audio position
  const firstScene = selectedScenes[0];
  const audioStartOffset = firstScene?.audioOffsetSeconds ??
    (original.sceneOffsets?.[clipStartScene] ?? 0);

  // 4. Re-map sceneOffsets relative to clip start
  const clipSceneOffsets = reindexed.map((_, i) => {
    const origIdx = clipStartScene + i;
    const origOffset = original.sceneOffsets?.[origIdx] ??
      (original.scenes[origIdx]?.audioOffsetSeconds ?? 0);
    return origOffset - audioStartOffset;
  });

  // 5 & 6. Keep audioFile, set dimensions
  return {
    ...original,
    width: 1080,
    height: 1920,
    scenes: reindexed,
    durationInFrames: totalContentFrames,
    audioFile: original.audioFile,
    sceneOffsets: clipSceneOffsets,
    _audioStartOffset: audioStartOffset,
  } as Storyboard & { _audioStartOffset: number };
}

// ── generateHookText ─────────────────────────────────────────────────────────

export function generateHookText(
  group: { heading: string; archetype: string },
  topic: string,
): string {
  const heading = group.heading || topic;

  switch (group.archetype) {
    case 'problem':
      return `90% of devs get ${heading} WRONG`;
    case 'code':
      return `This ${heading} code changes everything`;
    case 'interview':
      return `What Google asks about ${heading}`;
    case 'subtopic':
    default:
      return `${heading} — explained in 60 seconds`;
  }
}
