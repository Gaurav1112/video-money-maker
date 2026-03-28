import { Scene, Storyboard, TTSResult } from '../types';
import { TIMING, INTRO_DURATION, OUTRO_DURATION, TRANSITION_DURATION } from '../lib/constants';
import { stitchAudio } from './audio-stitcher';
import { assignVizVariants } from './script-generator';

interface StoryboardOptions {
  topic: string;
  sessionNumber: number;
  fps?: number;
  width?: number;
  height?: number;
}

// Type-based fallback durations (seconds) used when a scene has no audio offset.
const FALLBACK_SCENE_DURATION: Record<string, number> = {
  title: 5,
  code: 8,
  table: 6,
  interview: 6,
  review: 7,
  summary: 6,
  text: 5,
  diagram: 6,
};

export function generateStoryboard(
  scenes: Scene[],
  audioResults: TTSResult[],
  options: StoryboardOptions
): Storyboard {
  const { topic, sessionNumber, fps = 30, width = 1920, height = 1080 } = options;

  // ── Stitch all scene audio into ONE master track ──
  // This eliminates audio overlap during TransitionSeries crossfades.
  const { masterPath, sceneOffsets, allSfxTriggers } = stitchAudio(
    audioResults,
    0.8, // 0.8s silence gap between scenes
    `master-${topic.replace(/[^a-z0-9]/gi, '-')}-s${sessionNumber}.mp3`
  ) as ReturnType<typeof stitchAudio> & { allSfxTriggers?: Storyboard['allSfxTriggers'] };

  // Prepend branded intro scene
  const introScene: Scene = {
    type: 'title' as const,
    content: 'Guru Sishya',
    narration: 'Welcome to Guru Sishya... Your path to mastering technical interviews.',
    duration: 3,
    startFrame: 0,
    endFrame: INTRO_DURATION,
  };

  // ── SYNC MATH — aligning visual scene timing to audio offsets ──
  //
  // The master audio track has each scene's audio at sceneOffsets[i] seconds.
  // The visual content is rendered inside a TransitionSeries where crossfade
  // transitions of TRANSITION_DURATION frames overlap adjacent scenes.
  //
  // In TransitionSeries, scene[i] starts at:
  //   sum(D0..D(i-1)) - i * TRANSITION_DURATION   (in frames)
  //
  // We want this to equal sceneOffsets[i] * fps so audio and visuals align.
  // Solving: D(i) = (sceneOffsets[i+1] - sceneOffsets[i]) * fps + TRANSITION_DURATION
  //
  // For the last scene (no next offset), we use audio.duration + breathing room.
  //
  // This ensures that inside each TransitionSeries.Sequence, frame 0 corresponds
  // to the start of that scene's audio in the master track. Without this, the
  // visual breathing room (+1.0s) and audio gap (+0.8s) diverge by 0.2s per scene,
  // plus the TRANSITION_DURATION adds another 0.5s drift — totalling ~0.7s per scene.
  // By scene 10, captions would be 7 seconds out of sync with the audio.
  //
  // Content scenes are 0-based; the intro offset is applied in LongVideo.tsx
  // via <Sequence from={INTRO_DURATION}>. Starting at INTRO_DURATION here would
  // cause a double-offset (BUG 6).
  let currentFrame = 0;
  const timedScenes: Scene[] = [introScene];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const audio = audioResults[i];
    const offset = sceneOffsets[i]; // seconds, or -1 if no audio

    let durationFrames: number;

    if (offset !== -1 && audio?.duration > 0) {
      // Find the next valid scene offset to determine how long this scene should last
      let nextOffset = -1;
      for (let j = i + 1; j < scenes.length; j++) {
        if (sceneOffsets[j] !== -1) {
          nextOffset = sceneOffsets[j];
          break;
        }
      }

      if (nextOffset !== -1) {
        // Duration = time until next scene's audio starts + transition overlap compensation.
        // This ensures TransitionSeries places the next scene exactly when its audio starts.
        durationFrames = TIMING.secondsToFrames(nextOffset - offset) + TRANSITION_DURATION;
      } else {
        // Last scene with audio: use actual audio duration + 1s breathing room + transition
        durationFrames = TIMING.secondsToFrames(audio.duration + 1.0) + TRANSITION_DURATION;
      }
    } else {
      // No audio for this scene — use type-based default + transition compensation
      const durationSeconds = FALLBACK_SCENE_DURATION[scene.type] ?? 5;
      durationFrames = TIMING.secondsToFrames(durationSeconds) + TRANSITION_DURATION;
    }

    const startFrame = currentFrame;
    const endFrame = startFrame + durationFrames;

    timedScenes.push({
      ...scene,
      startFrame,
      endFrame,
      duration: durationFrames / TIMING.fps,
      audioFile: undefined, // cleared: master audio handles all narration
      wordTimestamps: audio?.wordTimestamps ?? scene.wordTimestamps,
      audioOffsetSeconds: offset, // -1 if no audio; seconds into master track
    });

    currentFrame = endFrame;
  }

  // Append branded outro scene
  const outroScene: Scene = {
    type: 'summary' as const,
    content: 'Thanks for watching',
    narration: 'Thanks for watching. Practice this topic on guru-sishya.in... Subscribe for daily lessons. Your dream job is one interview away.',
    duration: 5,
    startFrame: currentFrame,
    endFrame: currentFrame + OUTRO_DURATION,
  };
  timedScenes.push(outroScene);
  currentFrame = outroScene.endFrame;

  // ── Assign per-scene visualization variants ──
  // This enriches text/interview scenes with vizVariant so each scene
  // shows a UNIQUE animation state instead of repeating the same viz.
  const enrichedScenes = assignVizVariants(timedScenes, topic);

  return {
    fps,
    width,
    height,
    durationInFrames: currentFrame,
    scenes: enrichedScenes,
    audioFile: masterPath,
    topic,
    sessionNumber,
    sceneOffsets,
    ...(allSfxTriggers ? { allSfxTriggers } : {}),
  };
}

export function getStoryboardDuration(storyboard: Storyboard): {
  frames: number;
  seconds: number;
  minutes: string;
} {
  const seconds = TIMING.framesToSeconds(storyboard.durationInFrames);
  return {
    frames: storyboard.durationInFrames,
    seconds,
    minutes: `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`,
  };
}

export function validateStoryboard(storyboard: Storyboard): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (storyboard.scenes.length === 0) {
    issues.push('Storyboard has no scenes');
  }

  // Check for overlapping scenes
  for (let i = 1; i < storyboard.scenes.length; i++) {
    const prev = storyboard.scenes[i - 1];
    const curr = storyboard.scenes[i];
    if (curr.startFrame < prev.endFrame) {
      issues.push(`Scene ${i} overlaps with scene ${i - 1}: ${curr.startFrame} < ${prev.endFrame}`);
    }
  }

  // Check duration limits
  const duration = TIMING.framesToSeconds(storyboard.durationInFrames);
  if (duration > 15 * 60) {
    issues.push(`Video too long: ${duration}s (max 15 min)`);
  }
  if (duration < 30) {
    issues.push(`Video too short: ${duration}s (min 30s)`);
  }

  return { valid: issues.length === 0, issues };
}
