import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { VisualBeat } from '../types';

interface VisualBeatState {
  activeBeat: VisualBeat | null;
  beatIndex: number;
  progress: number;
  isTransitioning: boolean;
}

/**
 * Hook that returns the current active visual beat based on frame position.
 * Used by scene components to sync visual reveals to narration.
 */
export function useVisualBeat(
  beats: VisualBeat[],
  sceneStartFrame: number = 0,
): VisualBeatState {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!beats || beats.length === 0) {
    return { activeBeat: null, beatIndex: -1, progress: 0, isTransitioning: false };
  }

  const elapsedSec = (frame - sceneStartFrame) / fps;

  // Find active beat
  let beatIndex = -1;
  for (let i = beats.length - 1; i >= 0; i--) {
    if (elapsedSec >= beats[i].startTime) {
      beatIndex = i;
      break;
    }
  }

  if (beatIndex < 0) {
    return { activeBeat: null, beatIndex: -1, progress: 0, isTransitioning: false };
  }

  const beat = beats[beatIndex];
  const beatDuration = beat.endTime - beat.startTime;
  const progress = beatDuration > 0
    ? Math.min(1, (elapsedSec - beat.startTime) / beatDuration)
    : 1;

  // Transitioning = within first 0.3s of a beat
  const isTransitioning = (elapsedSec - beat.startTime) < 0.3;

  return {
    activeBeat: beat,
    beatIndex,
    progress,
    isTransitioning,
  };
}
