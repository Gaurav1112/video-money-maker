import React from 'react';
import { useCurrentFrame, AbsoluteFill, Sequence, Audio, staticFile } from 'remotion';
import { Storyboard } from '../types';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn } from '../lib/animations';
import { TIMING } from '../lib/constants';
import {
  TitleSlide,
  CodeReveal,
  TextSection,
  ProgressBar,
  IntroSlide,
  OutroSlide,
} from '../components';

const SHORT_INTRO_DURATION = 45; // 1.5 seconds at 30fps
const SHORT_OUTRO_DURATION = 90; // 3 seconds at 30fps

interface ShortVideoProps {
  storyboard: Storyboard;
  maxScenes?: number;
}

export const ShortVideo: React.FC<ShortVideoProps> = ({ storyboard, maxScenes = 3 }) => {
  const frame = useCurrentFrame();
  const scenes = storyboard.scenes.slice(0, maxScenes);
  const lastScene = scenes[scenes.length - 1];
  const contentEndFrame = lastScene ? lastScene.endFrame : 0;
  const totalFrames = SHORT_INTRO_DURATION + contentEndFrame + SHORT_OUTRO_DURATION;
  const progress = frame / totalFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      {/* Branded Intro (short version) */}
      <Sequence from={0} durationInFrames={SHORT_INTRO_DURATION}>
        <IntroSlide durationInFrames={SHORT_INTRO_DURATION} />
      </Sequence>

      {/* Content scenes (first 2-3 only), offset by intro */}
      {scenes.map((scene, idx) => {
        const duration = scene.endFrame - scene.startFrame;
        let Component: React.FC<any> = TextSection;
        let props: Record<string, any> = {
          heading: scene.heading || '',
          bullets: [scene.content],
          startFrame: 0,
        };

        if (scene.type === 'title') {
          Component = TitleSlide;
          props = {
            topic: storyboard.topic,
            sessionNumber: storyboard.sessionNumber,
            title: scene.content,
            objectives: (scene.bullets || []).slice(0, 2),
          };
        } else if (scene.type === 'code') {
          Component = CodeReveal;
          props = {
            code: scene.content,
            language: scene.language || 'typescript',
            title: scene.heading,
            startFrame: 0,
          };
        }

        return (
          <Sequence key={idx} from={SHORT_INTRO_DURATION + scene.startFrame} durationInFrames={duration}>
            <Component {...props} />
          </Sequence>
        );
      })}

      {/* Branded Outro (short version) */}
      <Sequence from={SHORT_INTRO_DURATION + contentEndFrame} durationInFrames={SHORT_OUTRO_DURATION}>
        <OutroSlide
          topic={storyboard.topic}
          durationInFrames={SHORT_OUTRO_DURATION}
        />
      </Sequence>

      {/* Progress bar */}
      <ProgressBar progress={progress} />

      {/* Audio */}
      {storyboard.audioFile && (
        <Audio src={staticFile(storyboard.audioFile)} />
      )}
    </AbsoluteFill>
  );
};

export default ShortVideo;
