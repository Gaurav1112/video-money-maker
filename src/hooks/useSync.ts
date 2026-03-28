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

  const relativeFrame = frame - sceneStartFrame;
  return globalTimeline.getSyncState(sceneIndex, Math.max(0, relativeFrame));
}
