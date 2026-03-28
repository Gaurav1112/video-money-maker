import { Scene, Storyboard, TTSResult } from '../types';
import { TIMING } from '../lib/constants';

interface StoryboardOptions {
  topic: string;
  sessionNumber: number;
  fps?: number;
  width?: number;
  height?: number;
}

export function generateStoryboard(
  scenes: Scene[],
  audioResults: TTSResult[],
  options: StoryboardOptions
): Storyboard {
  const { topic, sessionNumber, fps = 30, width = 1920, height = 1080 } = options;

  let currentFrame = 0;
  const timedScenes: Scene[] = [];

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
    const paddingFrames = i > 0 ? TIMING.secondsToFrames(1.5) : 0;
    const startFrame = currentFrame + paddingFrames;
    const durationFrames = TIMING.secondsToFrames(duration);
    const endFrame = startFrame + durationFrames;

    timedScenes.push({
      ...scene,
      startFrame,
      endFrame,
      duration,
      audioFile: audio?.audioPath || undefined,
    });

    currentFrame = endFrame;
  }

  // Combine all audio into one file path (or use first available)
  const audioFile = audioResults.find(a => a.audioPath)?.audioPath || '';

  return {
    fps,
    width,
    height,
    durationInFrames: currentFrame,
    scenes: timedScenes,
    audioFile,
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
