import { registerRoot, Composition } from 'remotion';
import React from 'react';
import { LongVideo } from './LongVideo';
import { ShortVideo } from './ShortVideo';
import { Storyboard } from '../types';

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
        component={LongVideo}
        durationInFrames={9000}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ storyboard: defaultStoryboard }}
      />
      <Composition
        id="ShortVideo"
        component={ShortVideo}
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
