import React from 'react';
import { AbsoluteFill, Sequence, Audio, staticFile, useVideoConfig } from 'remotion';
import { SyncTimeline } from '../lib/sync-engine';
import { setSyncTimeline } from '../hooks/useSync';
import type { Storyboard, Scene } from '../types';

import {
  TitleSlide,
  CodeReveal,
  TextSection,
  ComparisonTable,
  InterviewInsight,
  ReviewQuestion,
  SummarySlide,
  DiagramSlide,
  IntroSlide,
  OutroSlide,
  BackgroundLayer,
  CaptionOverlay,
} from '../components';
import { BgmLayer } from '../components/BgmLayer';

export type ClipType = 'hook' | 'code-highlight' | 'aha-moment' | 'comparison' | 'review-challenge';

interface MultiShortProps {
  storyboard: Storyboard;
  clipType: ClipType;
}

/** Select which scenes to include based on clip type */
function selectScenes(scenes: Scene[], clipType: ClipType): Scene[] {
  switch (clipType) {
    case 'hook':
      // First 2-3 scenes (hook + problem setup)
      return scenes.filter(s => s.type === 'title' || s.type === 'text').slice(0, 3);
    case 'code-highlight': {
      // First code scene + its surrounding context
      const codeIdx = scenes.findIndex(s => s.type === 'code');
      if (codeIdx === -1) return scenes.slice(0, 2);
      return scenes.slice(Math.max(0, codeIdx - 1), codeIdx + 2);
    }
    case 'aha-moment':
      // Interview insight scenes
      return scenes.filter(s => s.type === 'interview').slice(0, 2);
    case 'comparison':
      // Table/diagram scenes
      return scenes.filter(s => s.type === 'table' || s.type === 'diagram').slice(0, 2);
    case 'review-challenge':
      // Review question + summary
      return scenes.filter(s => s.type === 'review' || s.type === 'summary').slice(0, 2);
    default:
      return scenes.slice(0, 3);
  }
}

const SCENE_MAP: Record<string, React.FC<any>> = {
  title: TitleSlide,
  code: CodeReveal,
  text: TextSection,
  diagram: DiagramSlide,
  table: ComparisonTable,
  interview: InterviewInsight,
  review: ReviewQuestion,
  summary: SummarySlide,
};

const MINI_INTRO_DURATION = 30; // 1 second at 30fps
const CTA_DURATION = 60;        // 2 seconds at 30fps

export const MultiShort: React.FC<MultiShortProps> = ({ storyboard, clipType }) => {
  const { fps } = useVideoConfig();
  const selectedScenes = selectScenes(storyboard.scenes, clipType);

  // Build a mini sync timeline for just the selected scenes.
  // Use 8s per scene as an estimate for offsets when startFrame data is absent.
  const syncTimeline = React.useMemo(() => {
    const offsets = selectedScenes.map((_, i) => i * 8);
    const timestamps = selectedScenes.map(s => s.wordTimestamps || []);
    return new SyncTimeline(offsets, timestamps, fps, MINI_INTRO_DURATION);
  }, [selectedScenes, fps]);

  React.useEffect(() => {
    setSyncTimeline(syncTimeline);
  }, [syncTimeline]);

  const ctaText: Record<ClipType, string> = {
    'hook': '🔥 Full lesson on guru-sishya.in',
    'code-highlight': '💻 Complete code walkthrough → Link in bio',
    'aha-moment': '🧠 More interview secrets on guru-sishya.in',
    'comparison': '📊 Deep dive → guru-sishya.in',
    'review-challenge': '🎯 Test yourself → guru-sishya.in',
  };

  // Compute per-scene start frames sequentially after the mini intro
  let cursor = MINI_INTRO_DURATION;
  const sceneSequences = selectedScenes.map((scene, i) => {
    const SceneComp = SCENE_MAP[scene.type];
    const sceneDuration = Math.round(scene.duration * fps);
    const sceneStart = cursor;
    cursor += sceneDuration;
    return { scene, SceneComp, sceneStart, sceneDuration, index: i };
  });

  const contentEnd = cursor;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0C0A15' }}>
      {/* Mini branded intro (1 second) */}
      <Sequence durationInFrames={MINI_INTRO_DURATION}>
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0C0A15, #1a1a2e)',
          }}
        >
          <div
            style={{
              fontSize: 36,
              fontWeight: 700,
              color: '#E85D26',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            Guru Sishya
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Selected scenes */}
      {sceneSequences.map(({ scene, SceneComp, sceneStart, sceneDuration, index }) => {
        if (!SceneComp) return null;
        return (
          <Sequence key={index} from={sceneStart} durationInFrames={sceneDuration}>
            <BackgroundLayer sceneType={scene.type} />
            <SceneComp
              {...scene}
              startFrame={0}
              endFrame={sceneDuration}
              sceneIndex={index}
              sceneStartFrame={sceneStart}
              animationCues={scene.animationCues}
            />
          </Sequence>
        );
      })}

      {/* CTA overlay in last 2 seconds */}
      {contentEnd > CTA_DURATION && (
        <Sequence from={contentEnd - CTA_DURATION} durationInFrames={CTA_DURATION}>
          <AbsoluteFill
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: 80,
            }}
          >
            <div
              style={{
                background: 'rgba(232, 93, 38, 0.9)',
                padding: '12px 24px',
                borderRadius: 12,
                fontSize: 22,
                fontWeight: 700,
                color: '#fff',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              {ctaText[clipType]}
            </div>
          </AbsoluteFill>
        </Sequence>
      )}

      {/* BGM with sidechain ducking */}
      {storyboard.bgmFile && syncTimeline && (
        <BgmLayer syncTimeline={syncTimeline} bgmFile={storyboard.bgmFile} />
      )}
    </AbsoluteFill>
  );
};

export default MultiShort;
