import { Scene, Storyboard, TTSResult } from '../types';
import { TIMING } from '../lib/constants';
import { stitchAudio } from './audio-stitcher';

interface StoryboardOptions {
  topic: string;
  sessionNumber: number;
  fps?: number;
  width?: number;
  height?: number;
}

const INTRO_FRAMES = 90; // 3 seconds at 30fps
const OUTRO_FRAMES = 150; // 5 seconds at 30fps

export function generateStoryboard(
  scenes: Scene[],
  audioResults: TTSResult[],
  options: StoryboardOptions
): Storyboard {
  const { topic, sessionNumber, fps = 30, width = 1920, height = 1080 } = options;

  // ── Stitch all scene audio into ONE master track ──
  // This eliminates audio overlap during TransitionSeries crossfades.
  const { masterPath, totalDuration: masterDuration, sceneOffsets } = stitchAudio(
    audioResults,
    0.8, // 0.8s silence gap between scenes
    `master-${topic.replace(/[^a-z0-9]/gi, '-')}-s${sessionNumber}.mp3`
  );

  // Prepend branded intro scene
  const introScene: Scene = {
    type: 'title' as const,
    content: 'Guru Sishya',
    narration: 'Welcome to Guru Sishya... Your path to mastering technical interviews.',
    duration: 3,
    startFrame: 0,
    endFrame: INTRO_FRAMES,
  };

  let currentFrame = INTRO_FRAMES;
  const timedScenes: Scene[] = [introScene];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const audio = audioResults[i];

    // Use audio duration if available, otherwise estimate from scene duration
    const audioDuration = audio && audio.duration > 0 ? audio.duration : scene.duration;

    // Add breathing room AFTER narration ends so teacher doesn't feel rushed
    // Title: +2s for objectives to sink in
    // Code: +3s for viewer to read the code
    // Table: +2s for viewer to scan rows
    // Interview: +2s for the insight to land
    // Review: +3s for viewer to think about the answer
    // Summary: +2s for takeaways
    // Text: +1.5s
    const breathingRoom: Record<string, number> = {
      title: 2, code: 3, table: 2, interview: 2,
      review: 3, summary: 2, text: 1.5, diagram: 2,
    };
    const extraTime = breathingRoom[scene.type] || 1.5;
    const duration = audioDuration + extraTime;

    // Add 1.5 second gap between scenes (enough for transition + pause)
    const paddingFrames = TIMING.secondsToFrames(1.5);
    const startFrame = currentFrame + paddingFrames;
    const durationFrames = TIMING.secondsToFrames(duration);
    const endFrame = startFrame + durationFrames;

    // No per-scene audioFile — we use the master track instead
    timedScenes.push({
      ...scene,
      startFrame,
      endFrame,
      duration,
      audioFile: undefined, // cleared: master audio handles all narration
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
    endFrame: currentFrame + OUTRO_FRAMES,
  };
  timedScenes.push(outroScene);
  currentFrame = outroScene.endFrame;

  return {
    fps,
    width,
    height,
    durationInFrames: currentFrame,
    scenes: timedScenes,
    audioFile: masterPath,
    topic,
    sessionNumber,
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
