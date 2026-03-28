import { useCurrentFrame } from 'remotion';
import { SyncTimeline } from '../lib/sync-engine';
import type { SyncState } from '../types';

let globalTimeline: SyncTimeline | null = null;

export function setSyncTimeline(timeline: SyncTimeline): void {
  globalTimeline = timeline;
}

export function useSync(sceneIndex: number, sceneStartFrame: number): SyncState {
  const frame = useCurrentFrame();

  if (!globalTimeline) {
    return {
      currentWord: '',
      wordIndex: 0,
      sceneProgress: 0,
      phraseBoundaries: [],
      isNarrating: false,
      wordsSpoken: 0,
    };
  }

  // IMPORTANT: When called inside TransitionSeries.Sequence, useCurrentFrame()
  // returns scene-RELATIVE frames (0 to sceneDuration), NOT absolute frames.
  // If sceneStartFrame is absolute (e.g., INTRO_DURATION + offset), then
  // relativeFrame = (small scene frame) - (large absolute frame) = negative.
  //
  // We detect this case: if the computed relative frame is negative, it means
  // useCurrentFrame() is already scene-relative. In that case, use `frame`
  // directly as the relative frame for sync lookup.
  const computedRelative = frame - sceneStartFrame;
  const relativeFrame = computedRelative >= 0 ? computedRelative : frame;
  return globalTimeline.getSyncState(sceneIndex, Math.max(0, relativeFrame));
}
