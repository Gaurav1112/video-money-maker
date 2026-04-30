/**
 * Split a full session storyboard into connected parts for Reels/Shorts.
 * Each part is ~2 min (under 3 min), split at scene boundaries.
 * Deterministic: same storyboard always produces the same split.
 */

import { Storyboard, Scene } from '../types';
import { TIMING } from './constants';

export interface VideoPart {
  partNumber: number;       // 1-based
  totalParts: number;
  scenes: Scene[];
  durationInFrames: number;
  durationSeconds: number;
  audioStartSeconds: number;   // where to start in master audio
  audioEndSeconds: number;     // where to end in master audio
  isFirst: boolean;
  isLast: boolean;
  hookText: string;            // "Part 1/4" or cliffhanger
  ctaText: string;             // "Follow for Part 2" or final CTA
}

/** Platform-specific split configurations */
export type SplitMode = 'connected-series' | 'youtube-short' | 'instagram-reel';

const SPLIT_CONFIGS: Record<SplitMode, { target: number; max: number; min: number }> = {
  'connected-series': { target: 150, max: 180, min: 60 },   // ~2:30 parts, 3 per session
  'youtube-short':    { target: 50,  max: 58,  min: 15 },   // <60s for Shorts shelf
  'instagram-reel':   { target: 55,  max: 88,  min: 15 },   // <90s for Reels
};

// Default config (backward compat)
const TARGET_PART_DURATION = 150;
const MAX_PART_DURATION = 180;
const MIN_PART_DURATION = 60;

/**
 * Split storyboard into parts at scene boundaries.
 * Algorithm:
 * 1. Accumulate scenes until we hit TARGET_PART_DURATION
 * 2. Look for next scene boundary to split at
 * 3. Prefer splitting after summary/review scenes (natural break points)
 * 4. Never split mid-scene
 * 5. Each part gets intro/outro metadata for rendering
 */
export function splitIntoParts(storyboard: Storyboard, mode: SplitMode = 'connected-series'): VideoPart[] {
  const fps = storyboard.fps || 30;
  const scenes = storyboard.scenes;
  const sceneOffsets = storyboard.sceneOffsets || [];
  const config = SPLIT_CONFIGS[mode];

  // Skip the title scene (index 0) for splitting purposes
  // It always goes in Part 1
  const contentScenes = scenes.slice(1);
  const contentOffsets = sceneOffsets.slice(1);

  const parts: VideoPart[] = [];
  let currentScenes: Scene[] = [];
  let currentStartOffset = 0;
  let currentDuration = 0;

  // Always include title scene in part 1
  const titleScene = scenes[0];
  const titleDuration = titleScene ? (titleScene.endFrame - titleScene.startFrame) / fps : 0;
  if (titleScene) {
    currentScenes.push(titleScene);
    currentDuration = titleDuration;
  }

  for (let i = 0; i < contentScenes.length; i++) {
    const scene = contentScenes[i];
    const sceneDuration = (scene.endFrame - scene.startFrame) / fps;

    // Would adding this scene exceed MAX?
    if (currentDuration + sceneDuration > config.max && currentScenes.length > 1) {
      // Finalize current part
      const audioStart = currentStartOffset;
      const audioEnd = contentOffsets[i] ?? (audioStart + currentDuration);

      parts.push(createPart(
        parts.length + 1,
        0, // totalParts set later
        currentScenes,
        currentDuration,
        audioStart,
        audioEnd,
        storyboard.topic,
      ));

      // Start new part
      currentScenes = [];
      currentStartOffset = contentOffsets[i] ?? audioEnd;
      currentDuration = 0;
    }

    currentScenes.push(scene);
    currentDuration += sceneDuration;

    // Check for natural break points (after TARGET reached)
    if (currentDuration >= config.target) {
      const isNaturalBreak =
        scene.type === 'summary' ||
        scene.type === 'review' ||
        (i < contentScenes.length - 1 && contentScenes[i + 1].type === 'title');

      const nextSceneDuration = i < contentScenes.length - 1
        ? (contentScenes[i + 1].endFrame - contentScenes[i + 1].startFrame) / fps
        : 0;

      // Split if natural break OR would exceed MAX with next scene
      if (isNaturalBreak || currentDuration + nextSceneDuration > config.max) {
        if (i < contentScenes.length - 1) { // Don't split if this is the last scene
          const audioStart = currentStartOffset;
          const audioEnd = contentOffsets[i + 1] ?? (audioStart + currentDuration);

          parts.push(createPart(
            parts.length + 1,
            0,
            currentScenes,
            currentDuration,
            audioStart,
            audioEnd,
            storyboard.topic,
          ));

          currentScenes = [];
          currentStartOffset = audioEnd;
          currentDuration = 0;
        }
      }
    }
  }

  // Add remaining scenes as final part
  if (currentScenes.length > 0) {
    const audioStart = currentStartOffset;
    const audioEnd = audioStart + currentDuration;

    parts.push(createPart(
      parts.length + 1,
      0,
      currentScenes,
      currentDuration,
      audioStart,
      audioEnd,
      storyboard.topic,
    ));
  }

  // Set totalParts and fix isFirst/isLast
  const totalParts = parts.length;
  for (const part of parts) {
    part.totalParts = totalParts;
    part.isFirst = part.partNumber === 1;
    part.isLast = part.partNumber === totalParts;
    // Content-aware hook: use previous part's last heading as context bridge
    if (part.isFirst) {
      part.hookText = `${storyboard.topic} — Part 1/${totalParts}`;
    } else {
      const prevPart = parts[part.partNumber - 2];
      const lastHeading = prevPart?.scenes[prevPart.scenes.length - 1]?.heading;
      part.hookText = lastHeading
        ? `Part ${part.partNumber}/${totalParts} — "${lastHeading}" changes everything`
        : `Part ${part.partNumber}/${totalParts}`;
    }
    // Cliffhanger CTA: tease the next part's first scene
    if (part.isLast) {
      part.ctaText = 'Subscribe · @guru_sishya';
    } else {
      const nextPart = parts[part.partNumber];
      const nextHeading = nextPart?.scenes[0]?.heading;
      part.ctaText = nextHeading
        ? `Next: "${nextHeading}" — where most candidates fail. Part ${part.partNumber + 1} →`
        : `Follow for Part ${part.partNumber + 1} →`;
    }
  }

  return parts;
}

function createPart(
  partNumber: number,
  totalParts: number,
  scenes: Scene[],
  durationSeconds: number,
  audioStartSeconds: number,
  audioEndSeconds: number,
  _topic: string,
): VideoPart {
  const fps = 30;
  return {
    partNumber,
    totalParts,
    scenes,
    durationInFrames: Math.round(durationSeconds * fps),
    durationSeconds: Math.round(durationSeconds),
    audioStartSeconds,
    audioEndSeconds,
    isFirst: false,
    isLast: false,
    hookText: '',
    ctaText: '',
  };
}

/**
 * Create a sub-storyboard for a specific part.
 * This can be passed directly to VerticalLong for rendering.
 */
export function createPartStoryboard(
  originalStoryboard: Storyboard,
  part: VideoPart,
): Storyboard {
  const fps = originalStoryboard.fps || 30;

  // Re-index scenes starting from frame 0
  let frameOffset = 0;
  const reindexedScenes = part.scenes.map(scene => {
    const duration = scene.endFrame - scene.startFrame;
    const newScene: Scene = {
      ...scene,
      startFrame: frameOffset,
      endFrame: frameOffset + duration,
    };
    frameOffset += duration;
    return newScene;
  });

  // Compute new scene offsets relative to part start
  const originalOffsets = originalStoryboard.sceneOffsets || [];
  const newOffsets = part.scenes.map((scene, i) => {
    const origIdx = originalStoryboard.scenes.indexOf(scene);
    if (origIdx >= 0 && origIdx < originalOffsets.length) {
      return originalOffsets[origIdx] - part.audioStartSeconds;
    }
    return i * (part.durationSeconds / part.scenes.length);
  });

  return {
    ...originalStoryboard,
    scenes: reindexedScenes,
    durationInFrames: part.durationInFrames,
    sceneOffsets: newOffsets,
    // Part metadata for rendering
    partHookText: part.hookText,
    partCtaText: part.ctaText,
    partNumber: part.partNumber,
    totalParts: part.totalParts,
    // Audio file stays the same — VerticalLong will seek to the right position
  };
}

/**
 * Get a summary of how a storyboard would be split.
 * Useful for logging/debugging.
 */
export function getSplitSummary(storyboard: Storyboard): string {
  const parts = splitIntoParts(storyboard);
  const lines = [
    `${storyboard.topic} S${storyboard.sessionNumber}: ${parts.length} parts`,
  ];
  for (const part of parts) {
    const mins = Math.floor(part.durationSeconds / 60);
    const secs = part.durationSeconds % 60;
    lines.push(
      `  Part ${part.partNumber}/${part.totalParts}: ${mins}:${secs.toString().padStart(2, '0')} (${part.scenes.length} scenes) — ${part.ctaText}`,
    );
  }
  return lines.join('\n');
}

// Re-export TIMING so consumers can reference it without a separate import
export { TIMING };
