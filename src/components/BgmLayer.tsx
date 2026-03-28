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

      // Sidechain ducking — single check, no lookback loop
      const isNarrating = syncTimeline.isFrameInNarration(f);
      const targetVolume = isNarrating ? 0.08 : 0.25;

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
