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
} from '../components';

interface ShortVideoProps {
  storyboard: Storyboard;
  maxScenes?: number;
}

export const ShortVideo: React.FC<ShortVideoProps> = ({ storyboard, maxScenes = 3 }) => {
  const frame = useCurrentFrame();
  const scenes = storyboard.scenes.slice(0, maxScenes);
  const lastScene = scenes[scenes.length - 1];
  const contentEndFrame = lastScene ? lastScene.endFrame : 0;
  const ctaStartFrame = contentEndFrame;
  const ctaDuration = TIMING.secondsToFrames(5);
  const totalFrames = ctaStartFrame + ctaDuration;
  const progress = frame / totalFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      {/* Content scenes (first 2-3 only) */}
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
          <Sequence key={idx} from={scene.startFrame} durationInFrames={duration}>
            <Component {...props} />
          </Sequence>
        );
      })}

      {/* CTA Slide at the end */}
      <Sequence from={ctaStartFrame} durationInFrames={ctaDuration}>
        <AbsoluteFill
          style={{
            backgroundColor: COLORS.dark,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 60,
          }}
        >
          <div
            style={{
              fontSize: SIZES.heading2,
              fontFamily: FONTS.heading,
              fontWeight: 700,
              color: COLORS.saffron,
              textAlign: 'center',
              opacity: fadeIn(frame - ctaStartFrame, 0),
              marginBottom: 30,
            }}
          >
            Full lesson on YouTube
          </div>
          <div
            style={{
              fontSize: SIZES.body,
              fontFamily: FONTS.text,
              color: COLORS.gold,
              textAlign: 'center',
              opacity: fadeIn(frame - ctaStartFrame, 15),
            }}
          >
            Subscribe for daily interview prep
          </div>
        </AbsoluteFill>
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
