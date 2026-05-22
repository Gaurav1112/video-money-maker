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
import { HookCardShort } from './HookCardShort';
import { OutroCardShort } from './OutroCardShort';
import { ThumbnailShortPortrait } from './ThumbnailShortPortrait';
import { QuizShort, calculateQuizShortMetadata } from './QuizShort';
import { QuizThumbnail, calculateQuizThumbnailMetadata } from './QuizThumbnail';
import { OpinionLong, calculateOpinionLongMetadata } from './OpinionLong';
import { OpinionShort, calculateOpinionShortMetadata } from './OpinionShort';
import { OpinionThumbnail, calculateOpinionThumbnailMetadata } from './OpinionThumbnail';
import type { OpinionLongProps } from './OpinionLong';
import type { OpinionShortProps } from './OpinionShort';
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
      {(
        ['hook', 'code-highlight', 'aha-moment', 'comparison', 'review-challenge'] as ClipType[]
      ).map((clipType) => (
        <Composition
          key={`MultiShort-${clipType}`}
          id={`MultiShort-${clipType}`}
          component={asCompositionComponent(MultiShort)}
          calculateMetadata={({ props }: { props: Record<string, unknown> }) => {
            const storyboard = props.storyboard as Storyboard;
            // Estimate: up to 3 scenes × avg 10s + 1s intro (30f) + 2s CTA (60f), capped at 900 frames (30s)
            const estimatedDuration = Math.min(
              30 + 3 * 10 * 30 + 60,
              storyboard?.durationInFrames || 900
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

      {/* Stock-pipeline book-end cards (rendered standalone, then ffmpeg-muxed) */}
      <Composition
        id="HookCardShort"
        component={asCompositionComponent(HookCardShort)}
        durationInFrames={90}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ hookText: 'Master CAP Theorem in 60s', topic: 'CAP Theorem' }}
      />
      <Composition
        id="OutroCardShort"
        component={asCompositionComponent(OutroCardShort)}
        durationInFrames={90}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          topic: 'CAP Theorem',
          ctaText: 'Follow @GuruSishya-India for daily tech in 60 seconds',
        }}
      />
      <Composition
        id="ThumbnailShortPortrait"
        component={asCompositionComponent(ThumbnailShortPortrait)}
        durationInFrames={1}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ topic: 'CAP Theorem', subtitle: '60-Second System Design' }}
      />

      <Composition
        id="QuizShort"
        component={asCompositionComponent(QuizShort)}
        calculateMetadata={calculateQuizShortMetadata}
        durationInFrames={750}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          quiz: {
            topic: 'kafka',
            hookText: 'Only 2% of devs\nget this right',
            spokenHook: 'Only two percent of developers get this Kafka question right.',
            question:
              'If your Kafka producer sets acks=0 and the broker crashes, what happens to your message?',
            options: ['It retries automatically', 'Gone forever', 'Consumer replays it'],
            correctIndex: 1,
            explanation: 'The answer is B — gone forever. acks=0 means fire and forget.',
            twist:
              'acks=1 is the default — and that is ALSO unsafe if the leader crashes before replication.',
            endQuestion: 'Are you acks=all or acks=1? Comment below.',
            title: '90% of devs get Kafka acks WRONG 😳',
          },
          hookFormula: 'specific_stat',
        }}
      />
      <Composition
        id="QuizThumbnail"
        component={asCompositionComponent(QuizThumbnail)}
        {...calculateQuizThumbnailMetadata()}
        defaultProps={{
          quiz: {
            topic: 'kafka',
            hookText: 'Only 2% of devs\nget this right',
            spokenHook: 'Only two percent of developers get this Kafka question right.',
            question:
              'If your Kafka producer sets acks=0 and the broker crashes, what happens to your message?',
            options: ['It retries automatically', 'Gone forever', 'Consumer replays it'],
            correctIndex: 1,
            explanation: 'The answer is B — gone forever. acks=0 means fire and forget.',
            twist:
              'acks=1 is the default — and that is ALSO unsafe if the leader crashes before replication.',
            endQuestion: 'Are you acks=all or acks=1? Comment below.',
            title: '90% of devs get Kafka acks WRONG 😳',
          },
          hookFormula: 'specific_stat',
        }}
      />
      {/* Feature 006 — Opinion-Piece long-form (1920x1080) */}
      <Composition
        id="OpinionLong"
        component={asCompositionComponent(OpinionLong)}
        calculateMetadata={calculateOpinionLongMetadata as never}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={defaultOpinionLongProps as unknown as Record<string, unknown>}
      />
      {/* Feature 006 — Opinion-Piece 60s vertical cold-open Short */}
      <Composition
        id="OpinionShort"
        component={asCompositionComponent(OpinionShort)}
        calculateMetadata={calculateOpinionShortMetadata as never}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultOpinionShortProps as unknown as Record<string, unknown>}
      />
      {/* Feature 007 — Opinion-Piece 1280x720 long-form YouTube thumbnail */}
      <Composition
        id="OpinionThumbnail"
        component={asCompositionComponent(OpinionThumbnail)}
        {...calculateOpinionThumbnailMetadata()}
        defaultProps={{
          title: 'Are Microservices Killing Customer Experience?',
          slug: '001-microservices-vs-monolith',
        }}
      />
    </>
  );
};

// ─── Feature 006 default props ───────────────────────────────────────────
const defaultOpinionLongProps: OpinionLongProps = {
  opinion: {
    slug: 'demo',
    title: 'Are Microservices Killing Customer Experience?',
    publishDate: '2026-05-21',
    durationSec: 600,
    hook: 'From 30 minutes delivery to please verify OTP again.',
    thenNow: {
      thenLines: ['Simple flow.', 'Limited options.', 'Fast outcome.'],
      nowLines: ['Apps are smarter.', 'Features are richer.', 'Customization is endless.'],
    },
    pros: ['Independent scaling', 'Faster deployments', 'Team autonomy'],
    cons: ['40+ services for a simple workflow', 'API dependency chains nobody understands'],
    pivot: 'Did the architecture improve customer experience and operational efficiency?',
    lesson:
      'Technology evolution should reduce friction, not transfer it from developers to customers.',
    question:
      'Have microservices simplified your ecosystem or introduced a new layer of operational drama?',
  },
  sceneAudios: [
    { type: 'hook', audioFile: '', duration: 6 },
    { type: 'then-now', audioFile: '', duration: 12 },
    { type: 'pros', audioFile: '', duration: 8 },
    { type: 'cons', audioFile: '', duration: 10 },
    { type: 'pivot', audioFile: '', duration: 8 },
    { type: 'lesson', audioFile: '', duration: 8 },
    { type: 'question', audioFile: '', duration: 8 },
  ],
};

const defaultOpinionShortProps: OpinionShortProps = {
  hookText: 'From 30 minutes delivery to please verify OTP again.',
  thenNowFirstLine: 'Apps are smarter — but the user journey became exhausting.',
  audio: { audioFile: '', duration: 60 },
};

registerRoot(RemotionRoot);
