import React from 'react';
import { Sequence, Audio, staticFile } from 'remotion';
import { SyncTimeline } from '../lib/sync-engine';
import { sfxDuration } from '../lib/sfx-durations';
import type { SfxTrigger } from '../types';

interface SfxLayerProps {
  triggers: SfxTrigger[];
  syncTimeline: SyncTimeline;
}

export const SfxLayer: React.FC<SfxLayerProps> = ({ triggers, syncTimeline }) => {
  return (
    <>
      {triggers.map((trigger, i) => {
        const frame = syncTimeline.wordIndexToAbsoluteFrame(
          trigger.sceneIndex,
          trigger.wordIndex,
        );
        const duration = sfxDuration(trigger.effect);

        return (
          <Sequence key={`sfx-${i}`} from={frame} durationInFrames={duration}>
            <Audio
              src={staticFile(`audio/sfx/${trigger.effect}.wav`)}
              volume={trigger.volume ?? 1.0}
            />
          </Sequence>
        );
      })}
    </>
  );
};
