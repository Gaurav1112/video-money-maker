import React from 'react';
import { useCurrentFrame, AbsoluteFill, Sequence, Audio, staticFile, interpolate } from 'remotion';
import { TransitionSeries, linearTiming, TransitionPresentation } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { Storyboard, Scene } from '../types';
import { COLORS } from '../lib/theme';
import {
  TitleSlide,
  CodeReveal,
  TextSection,
  DiagramSlide,
  ComparisonTable,
  InterviewInsight,
  ReviewQuestion,
  SummarySlide,
  ProgressBar,
  TopicHeader,
  BackgroundLayer,
  CaptionOverlay,
  NarratorIndicator,
  SceneTransitionFlash,
} from '../components';

interface LongVideoProps {
  storyboard: Storyboard;
}

const SCENE_COMPONENT_MAP: Record<string, React.FC<any>> = {
  title: TitleSlide,
  code: CodeReveal,
  text: TextSection,
  diagram: DiagramSlide,
  table: ComparisonTable,
  interview: InterviewInsight,
  review: ReviewQuestion,
  summary: SummarySlide,
};

const TRANSITION_DURATION = 15; // 0.5 seconds at 30fps

function getTransitionForScene(sceneType: string): TransitionPresentation<Record<string, unknown>> {
  switch (sceneType) {
    case 'title':
      return fade() as TransitionPresentation<Record<string, unknown>>;
    case 'code':
      return slide({ direction: 'from-right' }) as TransitionPresentation<Record<string, unknown>>;
    case 'text':
      return fade() as TransitionPresentation<Record<string, unknown>>;
    case 'interview':
      return wipe({ direction: 'from-left' }) as TransitionPresentation<Record<string, unknown>>;
    case 'summary':
      return fade() as TransitionPresentation<Record<string, unknown>>;
    case 'diagram':
      return slide({ direction: 'from-bottom' }) as TransitionPresentation<Record<string, unknown>>;
    case 'table':
      return slide({ direction: 'from-left' }) as TransitionPresentation<Record<string, unknown>>;
    case 'review':
      return wipe({ direction: 'from-right' }) as TransitionPresentation<Record<string, unknown>>;
    default:
      return fade() as TransitionPresentation<Record<string, unknown>>;
  }
}

function getSceneProps(scene: Scene, storyboard: Storyboard): Record<string, any> {
  switch (scene.type) {
    case 'title':
      return {
        topic: storyboard.topic,
        sessionNumber: storyboard.sessionNumber,
        title: scene.content,
        objectives: scene.bullets || [],
      };
    case 'code':
      return {
        code: scene.content,
        language: scene.language || 'typescript',
        title: scene.heading,
        highlightLines: scene.highlightLines,
        startFrame: 0,
      };
    case 'text':
      return {
        heading: scene.heading || '',
        bullets: scene.bullets || [scene.content],
        startFrame: 0,
      };
    case 'diagram':
      return {
        svgContent: scene.content,
        title: scene.heading || '',
        startFrame: 0,
      };
    case 'table': {
      const lines = scene.content.split('\n').filter(l => l.includes('|'));
      const parsed = lines.map(l => l.split('|').map(c => c.trim()).filter(Boolean));
      const headers = parsed[0] || [];
      const rows = parsed.slice(1) || [];
      return { headers, rows, title: scene.heading || '', startFrame: 0 };
    }
    case 'interview':
      return {
        insight: scene.content,
        tip: scene.narration,
        startFrame: 0,
      };
    case 'review':
      return {
        question: scene.content,
        answer: scene.narration,
        startFrame: 0,
      };
    case 'summary':
      return {
        takeaways: scene.bullets || [scene.content],
        topic: storyboard.topic,
        sessionNumber: storyboard.sessionNumber,
        startFrame: 0,
      };
    default:
      return {};
  }
}

/**
 * Determine the active scene at a given frame for caption overlay.
 */
function getActiveScene(scenes: Scene[], frame: number): Scene | null {
  for (const scene of scenes) {
    if (frame >= scene.startFrame && frame < scene.endFrame) {
      return scene;
    }
  }
  return null;
}

/**
 * Generate scene markers for the progress bar.
 */
function getSceneMarkers(scenes: Scene[], totalFrames: number) {
  return scenes.map((scene) => ({
    position: scene.startFrame / totalFrames,
    type: scene.type,
    label: scene.heading || scene.type,
  }));
}

export const LongVideo: React.FC<LongVideoProps> = ({ storyboard }) => {
  const frame = useCurrentFrame();
  const totalFrames = storyboard.durationInFrames;
  const progress = frame / totalFrames;

  // Get active scene for captions and overlays
  const activeScene = getActiveScene(storyboard.scenes, frame);
  const hasNarration = activeScene && activeScene.narration && activeScene.narration.trim() !== '';
  const currentSceneType = activeScene?.type || 'text';

  // Scene markers for progress bar
  const sceneMarkers = getSceneMarkers(storyboard.scenes, totalFrames);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      {/* Animated background layer - adapts to scene type */}
      <BackgroundLayer sceneType={currentSceneType} />

      {/* Render each scene with transitions */}
      <TransitionSeries>
        {storyboard.scenes.map((scene, idx) => {
          const Component = SCENE_COMPONENT_MAP[scene.type];
          if (!Component) return null;

          const duration = scene.endFrame - scene.startFrame;
          const props = getSceneProps(scene, storyboard);
          const isFirst = idx === 0;

          return (
            <React.Fragment key={idx}>
              {/* Add transition before each scene (except the first) */}
              {!isFirst && (
                <TransitionSeries.Transition
                  presentation={getTransitionForScene(scene.type)}
                  timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
                />
              )}
              <TransitionSeries.Sequence durationInFrames={duration}>
                <AbsoluteFill>
                  <Component {...props} />
                  {/* Scene transition flash effect */}
                  {!isFirst && (
                    <SceneTransitionFlash sceneType={scene.type} />
                  )}
                  {scene.audioFile && scene.audioFile !== '' && (
                    <Audio
                      src={staticFile(`audio/${scene.audioFile.split('/').pop()}`)}
                      volume={(f) => {
                        // Fade out in last 15 frames to prevent overlap during transition
                        const fadeOutStart = duration - 20;
                        if (f >= fadeOutStart) {
                          return interpolate(f, [fadeOutStart, duration], [1, 0], { extrapolateRight: 'clamp' });
                        }
                        return 1;
                      }}
                    />
                  )}
                </AbsoluteFill>
              </TransitionSeries.Sequence>
            </React.Fragment>
          );
        })}
      </TransitionSeries>

      {/* Persistent overlays */}
      <TopicHeader
        topic={storyboard.topic}
        sessionNumber={storyboard.sessionNumber}
        language="TypeScript"
        sceneType={currentSceneType}
      />
      <ProgressBar
        progress={progress}
        sceneMarkers={sceneMarkers}
        currentSceneType={currentSceneType}
      />

      {/* Caption overlay - shows narration text word by word */}
      {hasNarration && activeScene && (
        <CaptionOverlay
          key={`caption-${activeScene.startFrame}`}
          text={activeScene.narration}
          startFrame={0}
          durationInFrames={activeScene.endFrame - activeScene.startFrame}
        />
      )}

      {/* Narrator indicator */}
      <NarratorIndicator
        isActive={hasNarration || false}
        label="Guru Sishya"
      />

      {/* Background music */}
      {storyboard.bgmFile && (
        <Sequence from={0}>
          <Audio
            src={staticFile(storyboard.bgmFile)}
            volume={(f) => {
              return interpolate(f, [0, 60], [0, 0.12], { extrapolateRight: 'clamp' });
            }}
            loop
          />
        </Sequence>
      )}

      {/* No global audio — each scene has its own audio track via TransitionSeries.
         This prevents audio overlap between scenes. */}
    </AbsoluteFill>
  );
};

export default LongVideo;
