import React from 'react';
import { Audio, interpolate, useCurrentFrame, useVideoConfig, staticFile } from 'remotion';
import { SyncTimeline } from '../lib/sync-engine';

interface BgmLayerProps {
  syncTimeline: SyncTimeline;
  bgmFile: string;
}

export const BgmLayer: React.FC<BgmLayerProps> = ({ syncTimeline, bgmFile }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const volume = React.useCallback(
    (f: number) => {
      // Fade in over first 60 frames (2s)
      const fadeIn = interpolate(f, [0, 60], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

      // Fade out over last 90 frames (3s)
      const fadeOut = interpolate(
        f,
        [durationInFrames - 90, durationInFrames],
        [1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      );

      // Sidechain ducking with 10-frame smoothing
      const isNarrating = syncTimeline.isFrameInNarration(f);

      // Count consecutive frames in current state (up to 10) for smooth transition
      let framesInState = 0;
      for (let i = 0; i < 10; i++) {
        if (syncTimeline.isFrameInNarration(f - i) === isNarrating) {
          framesInState++;
        } else {
          break;
        }
      }

      const duckProgress = Math.min(1, framesInState / 10);
      const targetVolume = isNarrating
        ? interpolate(duckProgress, [0, 1], [0.25, 0.08])
        : interpolate(duckProgress, [0, 1], [0.08, 0.25]);

      return fadeIn * fadeOut * targetVolume;
    },
    [syncTimeline, durationInFrames],
  );

  return (
    <Audio
      src={staticFile(bgmFile)}
      volume={volume}
      loop
    />
  );
};
