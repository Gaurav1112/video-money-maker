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
  IntroSlide,
  OutroSlide,
} from '../components';

const INTRO_DURATION = 90; // 3 seconds at 30fps
const OUTRO_DURATION = 150; // 5 seconds at 30fps

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
  const contentFrames = storyboard.durationInFrames;
  const totalFrames = INTRO_DURATION + contentFrames + OUTRO_DURATION;
  const progress = frame / totalFrames;

  // Get active scene for captions and overlays (offset by intro duration)
  const contentFrame = frame - INTRO_DURATION;
  const activeScene = getActiveScene(storyboard.scenes, contentFrame);
  const hasNarration = activeScene && activeScene.narration && activeScene.narration.trim() !== '';
  const currentSceneType = activeScene?.type || 'text';

  // Scene markers for progress bar
  const sceneMarkers = getSceneMarkers(storyboard.scenes, totalFrames);

  // Whether we are in the intro or outro phase
  const isIntro = frame < INTRO_DURATION;
  const isOutro = frame >= INTRO_DURATION + contentFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      {/* Animated background layer - adapts to scene type */}
      {!isIntro && !isOutro && <BackgroundLayer sceneType={currentSceneType} />}

      {/* Branded Intro */}
      <Sequence from={0} durationInFrames={INTRO_DURATION}>
        <IntroSlide durationInFrames={INTRO_DURATION} />
      </Sequence>

      {/* Render each scene with transitions, offset by intro duration */}
      <Sequence from={INTRO_DURATION} durationInFrames={contentFrames}>
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
                    {/* Per-scene audio REMOVED — single master audio track below */}
                  </AbsoluteFill>
                </TransitionSeries.Sequence>
              </React.Fragment>
            );
          })}
        </TransitionSeries>
      </Sequence>

      {/* Branded Outro */}
      <Sequence from={INTRO_DURATION + contentFrames} durationInFrames={OUTRO_DURATION}>
        <OutroSlide
          topic={storyboard.topic}
          nextTopic={storyboard.nextTopic}
          durationInFrames={OUTRO_DURATION}
        />
      </Sequence>

      {/* Persistent overlays (only during content) */}
      {!isIntro && !isOutro && (
        <>
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
        </>
      )}

      {/* Caption overlay - shows narration text word by word */}
      {!isIntro && !isOutro && hasNarration && activeScene && (
        <CaptionOverlay
          key={`caption-${activeScene.startFrame}`}
          text={activeScene.narration}
          startFrame={0}
          durationInFrames={activeScene.endFrame - activeScene.startFrame}
        />
      )}

      {/* Narrator indicator */}
      {!isIntro && !isOutro && (
        <NarratorIndicator
          isActive={hasNarration || false}
          label="Guru Sishya"
        />
      )}

      {/* Single master narration audio — no overlap possible */}
      {storyboard.audioFile && (
        <Audio
          src={staticFile(`audio/${storyboard.audioFile.split('/').pop()}`)}
          volume={(f) => {
            // Gentle fade-in over the first second
            const fadeIn = interpolate(f, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
            // Gentle fade-out over the last 2 seconds
            const fadeOutStart = totalFrames - 60;
            const fadeOut = f >= fadeOutStart
              ? interpolate(f, [fadeOutStart, totalFrames], [1, 0], { extrapolateRight: 'clamp' })
              : 1;
            return fadeIn * fadeOut;
          }}
        />
      )}

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
    </AbsoluteFill>
  );
};

export default LongVideo;
