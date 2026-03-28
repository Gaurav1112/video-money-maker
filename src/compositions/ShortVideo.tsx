import React from 'react';
import { useCurrentFrame, AbsoluteFill, Sequence, Audio, staticFile, useVideoConfig } from 'remotion';
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
import { SyncTimeline } from '../lib/sync-engine';
import { setSyncTimeline } from '../hooks/useSync';
import { BgmLayer } from '../components/BgmLayer';
import { SfxLayer } from '../components/SfxLayer';
import { BrandingLayer } from '../components/BrandingLayer';

const SHORT_INTRO_DURATION = 45; // 1.5 seconds at 30fps
const SHORT_OUTRO_DURATION = 90; // 3 seconds at 30fps

interface ShortVideoProps {
  storyboard: Storyboard;
  maxScenes?: number;
}

export const ShortVideo: React.FC<ShortVideoProps> = ({ storyboard, maxScenes = 3 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scenes = storyboard.scenes.slice(0, maxScenes);
  const lastScene = scenes[scenes.length - 1];
  const contentEndFrame = lastScene ? lastScene.endFrame : 0;
  const totalFrames = SHORT_INTRO_DURATION + contentEndFrame + SHORT_OUTRO_DURATION;
  const progress = frame / totalFrames;

  const syncTimeline = React.useMemo(() => {
    const offsets = storyboard.sceneOffsets || [];
    const timestamps = storyboard.scenes.map(s => s.wordTimestamps || []);
    return new SyncTimeline(offsets, timestamps, fps, 45); // SHORT_INTRO = 45 frames
  }, [storyboard, fps]);

  React.useEffect(() => {
    setSyncTimeline(syncTimeline);
  }, [syncTimeline]);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      {/* Branded Intro (short version) */}
      <Sequence from={0} durationInFrames={SHORT_INTRO_DURATION}>
        <IntroSlide durationInFrames={SHORT_INTRO_DURATION} />
      </Sequence>

      {/* Content scenes (first 2-3 only), offset by intro */}
      {scenes.map((scene, idx) => {
        const duration = scene.endFrame - scene.startFrame;
        const sceneStartFrame = SHORT_INTRO_DURATION + scene.startFrame;
        let Component: React.FC<any> = TextSection;
        let props: Record<string, any> = {
          heading: scene.heading || '',
          bullets: [scene.content],
          startFrame: 0,
          sceneIndex: idx,
          sceneStartFrame,
          animationCues: scene.animationCues,
        };

        if (scene.type === 'title') {
          Component = TitleSlide;
          props = {
            topic: storyboard.topic,
            sessionNumber: storyboard.sessionNumber,
            title: scene.content,
            objectives: (scene.bullets || []).slice(0, 2),
            sceneIndex: idx,
            sceneStartFrame,
            animationCues: scene.animationCues,
          };
        } else if (scene.type === 'code') {
          Component = CodeReveal;
          props = {
            code: scene.content,
            language: scene.language || 'typescript',
            title: scene.heading,
            startFrame: 0,
            sceneIndex: idx,
            sceneStartFrame,
            animationCues: scene.animationCues,
          };
        }

        return (
          <Sequence key={idx} from={sceneStartFrame} durationInFrames={duration}>
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

      {/* Single master narration audio — wrapped in Sequence to start after intro */}
      {storyboard.audioFile && (
        <Sequence from={SHORT_INTRO_DURATION}>
          <Audio src={staticFile(`audio/${storyboard.audioFile.split('/').pop()}`)} />
        </Sequence>
      )}

      {/* Background music with sidechain ducking */}
      {storyboard.bgmFile && syncTimeline && (
        <BgmLayer syncTimeline={syncTimeline} bgmFile={storyboard.bgmFile} />
      )}

      {/* Sound effects tied to word timestamps */}
      {syncTimeline && storyboard.allSfxTriggers && storyboard.allSfxTriggers.length > 0 && (
        <SfxLayer triggers={storyboard.allSfxTriggers} syncTimeline={syncTimeline} />
      )}

      {/* Guru-sishya.in branding */}
      <BrandingLayer durationInFrames={storyboard.durationInFrames + 135} format="short" />
    </AbsoluteFill>
  );
};

export default ShortVideo;
