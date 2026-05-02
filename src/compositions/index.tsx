import { registerRoot, Composition } from 'remotion';
import type { ComponentType } from 'react';
import React from 'react';
import { LongVideo } from './LongVideo';
import { ShortVideo } from './ShortVideo';
import { MultiShort } from './MultiShort';
import { ViralShort, calculateViralShortMetadata } from './ViralShort';
import { VerticalLong, calculateVerticalLongMetadata } from './VerticalLong';
import { AtomicShort, calculateAtomicShortMetadata } from './AtomicShort';
import { ThumbnailComposition } from './Thumbnail';
import type { Storyboard } from '../types';
import type { ClipType } from './MultiShort';

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
        calculateMetadata={({ props }: { props: Record<string, unknown> }) => ({
          durationInFrames: ((props.storyboard as Storyboard)?.durationInFrames || 9000) + 240, // +240 for intro(90) + outro(150)
          fps: 30,
          width: 1920,
          height: 1080,
        })}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ storyboard: defaultStoryboard }}
      />
      {/* Clean version — no overlays, for split-stack shorts conversion */}
      <Composition
        id="LongVideoClean"
        component={asCompositionComponent(LongVideo)}
        calculateMetadata={({ props }: { props: Record<string, unknown> }) => ({
          durationInFrames: ((props.storyboard as Storyboard)?.durationInFrames || 9000) + 240,
          fps: 30,
          width: 1920,
          height: 1080,
        })}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ storyboard: defaultStoryboard, noOverlays: true }}
      />
      {/* 4K variant — same component, double resolution */}
      <Composition
        id="LongVideo4K"
        component={asCompositionComponent(LongVideo)}
        calculateMetadata={({ props }: { props: Record<string, unknown> }) => ({
          durationInFrames: ((props.storyboard as Storyboard)?.durationInFrames || 9000) + 240,
          fps: 30,
          width: 3840,
          height: 2160,
        })}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ storyboard: defaultStoryboard }}
      />
      <Composition
        id="ShortVideo"
        component={asCompositionComponent(ShortVideo)}
        calculateMetadata={({ props }: { props: Record<string, unknown> }) => ({
          durationInFrames: ((props.storyboard as Storyboard)?.durationInFrames || 2700) + 135, // +135 for short intro(45) + outro(90)
          fps: 30,
          width: 1080,
          height: 1920,
        })}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ storyboard: defaultStoryboard }}
      />
      <Composition
        id="ViralShort"
        component={asCompositionComponent(ViralShort)}
        calculateMetadata={calculateViralShortMetadata}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ storyboard: defaultStoryboard }}
      />
      <Composition
        id="VerticalLong"
        component={asCompositionComponent(VerticalLong)}
        calculateMetadata={calculateVerticalLongMetadata}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ storyboard: defaultStoryboard }}
      />
      <Composition
        id="Thumbnail"
        component={asCompositionComponent(ThumbnailComposition)}
        durationInFrames={1}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{ topic: 'Demo', sessionNumber: 1, hookText: 'Why 90% Get This WRONG' }}
      />

      <Composition
        id="AtomicShort"
        component={asCompositionComponent(AtomicShort)}
        calculateMetadata={calculateAtomicShortMetadata}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ storyboard: defaultStoryboard }}
      />

      {/* MultiShort compositions — one per clip type (4-5 targeted Shorts per long-form video) */}
      {(['hook', 'code-highlight', 'aha-moment', 'comparison', 'review-challenge'] as ClipType[]).map((clipType) => (
        <Composition
          key={`MultiShort-${clipType}`}
          id={`MultiShort-${clipType}`}
          component={asCompositionComponent(MultiShort)}
          calculateMetadata={({ props }: { props: Record<string, unknown> }) => {
            const storyboard = props.storyboard as Storyboard;
            // Estimate: up to 3 scenes × avg 10s + 1s intro (30f) + 2s CTA (60f), capped at 900 frames (30s)
            const estimatedDuration = Math.min(
              30 + 3 * 10 * 30 + 60,
              storyboard?.durationInFrames || 900,
            );
            return {
              durationInFrames: estimatedDuration,
              fps: 30,
              width: 1080,
              height: 1920,
            };
          }}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{ storyboard: defaultStoryboard, clipType }}
        />
      ))}
    </>
  );
};

registerRoot(RemotionRoot);
