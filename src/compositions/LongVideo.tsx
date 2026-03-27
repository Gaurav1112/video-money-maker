import React from 'react';
import { useCurrentFrame, AbsoluteFill, Sequence, Audio, staticFile } from 'remotion';
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
      // Parse table content from scene (pipe-separated markdown)
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
        startFrame: 0,
      };
    default:
      return {};
  }
}

export const LongVideo: React.FC<LongVideoProps> = ({ storyboard }) => {
  const frame = useCurrentFrame();
  const totalFrames = storyboard.durationInFrames;
  const progress = frame / totalFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      {/* Render each scene as a Sequence */}
      {storyboard.scenes.map((scene, idx) => {
        const Component = SCENE_COMPONENT_MAP[scene.type];
        if (!Component) return null;

        const duration = scene.endFrame - scene.startFrame;
        const props = getSceneProps(scene, storyboard);

        return (
          <Sequence
            key={idx}
            from={scene.startFrame}
            durationInFrames={duration}
            name={`${scene.type}-${idx}`}
          >
            <Component {...props} />
            {scene.audioFile && scene.audioFile !== '' && (
              <Audio src={staticFile(`audio/${scene.audioFile.split('/').pop()}`)} />
            )}
          </Sequence>
        );
      })}

      {/* Persistent overlays */}
      <TopicHeader
        topic={storyboard.topic}
        sessionNumber={storyboard.sessionNumber}
        language="TypeScript"
      />
      <ProgressBar progress={progress} />

      {/* Audio: per-scene audio is rendered inside each Sequence above.
         Fall back to global audio only if no per-scene audio exists. */}
      {storyboard.audioFile && storyboard.audioFile !== '' && !storyboard.scenes.some(s => s.audioFile) && (
        <Audio src={staticFile(`audio/${storyboard.audioFile.split('/').pop()}`)} />
      )}
    </AbsoluteFill>
  );
};

export default LongVideo;
