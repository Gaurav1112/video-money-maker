import { registerRoot, Composition } from 'remotion';
import type { ComponentType } from 'react';
import React from 'react';
import { LongVideo } from './LongVideo';
import { ShortVideo } from './ShortVideo';
import type { Storyboard } from '../types';

// Remotion's Composition generic expects Props extends Record<string, unknown>.
// We cast components to satisfy this constraint while preserving runtime behavior.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asCompositionComponent = <T,>(c: ComponentType<T>) =>
  c as ComponentType<Record<string, unknown>>;

const defaultStoryboard: Storyboard = {
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 300,
  scenes: [],
  audioFile: '',
  topic: 'Demo Topic',
  sessionNumber: 1,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LongVideo"
        component={asCompositionComponent(LongVideo)}
        durationInFrames={9000}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ storyboard: defaultStoryboard }}
      />
      <Composition
        id="ShortVideo"
        component={asCompositionComponent(ShortVideo)}
        durationInFrames={2700}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ storyboard: defaultStoryboard }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
