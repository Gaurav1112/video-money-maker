import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { CalculateMetadataFunction } from 'remotion';
import type { OpinionPiece } from '../lib/opinion-piece-parser';
import {
  HookCard,
  ThenNowSplit,
  ProsConsList,
  PivotCard,
  LessonCard,
  QuestionCard,
} from '../components/opinion';
import { COLORS, FONTS } from '../lib/theme';

const FPS = 30;
const MIN_TAIL_FRAMES = 12;

// ─── Props ────────────────────────────────────────────────────────────────

export interface OpinionSceneAudio {
  /** Section key — used for chapter labels and debugging. */
  type: 'hook' | 'then-now' | 'pros' | 'cons' | 'pivot' | 'lesson' | 'question';
  /** Path to audio file (absolute or relative to public/). */
  audioFile: string;
  /** Duration in seconds. */
  duration: number;
}

export interface OpinionLongProps {
  opinion: OpinionPiece;
  sceneAudios: OpinionSceneAudio[];
  /** Optional BGM file path under public/. */
  bgmFile?: string;
}

// ─── Metadata ─────────────────────────────────────────────────────────────

export const calculateOpinionLongMetadata: CalculateMetadataFunction<
  OpinionLongProps & Record<string, unknown>
> = ({ props }) => {
  const audios = props.sceneAudios || [];
  const totalSec = audios.reduce((a, s) => a + (s?.duration || 0), 0);
  // Hard cap at 15 min to match spec edge-case clause
  const cappedSec = Math.min(totalSec, 900);
  const durationInFrames = Math.max(FPS * 60, Math.ceil(cappedSec * FPS) + MIN_TAIL_FRAMES);
  return {
    durationInFrames,
    fps: FPS,
    width: 1920,
    height: 1080,
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function resolveAudio(audioFile: string): string {
  if (!audioFile) return '';
  if (
    audioFile.startsWith('http://') ||
    audioFile.startsWith('https://') ||
    audioFile.startsWith('/')
  ) {
    return audioFile;
  }
  // Treat as public/ relative path
  return staticFile(audioFile.replace(/^public\//, ''));
}

// ─── Chapter banner overlay ───────────────────────────────────────────────

const ChapterBanner: React.FC<{ label: string }> = ({ label }) => {
  const frame = useCurrentFrame();
  // Show banner for first 60 frames (2s)
  const op = interpolate(frame, [0, 6, 50, 60], [0, 1, 1, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  return (
    <div
      style={{
        position: 'absolute',
        top: 48,
        left: 48,
        background: 'rgba(15, 23, 42, 0.85)',
        color: '#F8FAFC',
        padding: '12px 24px',
        borderRadius: 8,
        fontFamily: FONTS.heading,
        fontWeight: 700,
        fontSize: 24,
        letterSpacing: 2,
        textTransform: 'uppercase',
        opacity: op,
      }}
    >
      {label}
    </div>
  );
};

// ─── Composition ──────────────────────────────────────────────────────────

const SECTION_LABEL: Record<OpinionSceneAudio['type'], string> = {
  hook: 'Hook',
  'then-now': '1995 vs 2026',
  pros: 'The Pros',
  cons: 'The Reality',
  pivot: 'The Real Question',
  lesson: 'The Lesson',
  question: 'Your Turn',
};

export const OpinionLong: React.FC<OpinionLongProps> = ({ opinion, sceneAudios, bgmFile }) => {
  const { fps } = useVideoConfig();

  // Build absolute frame offsets from cumulative audio durations
  const offsets: number[] = [];
  let acc = 0;
  for (const a of sceneAudios) {
    offsets.push(Math.round(acc * fps));
    acc += a.duration;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      {/* Optional BGM bed — kept very quiet so narration dominates */}
      {bgmFile ? <Audio src={resolveAudio(bgmFile)} volume={0.08} loop /> : null}

      {sceneAudios.map((scene, i) => {
        const startFrame = offsets[i];
        const durFrames = Math.max(1, Math.round(scene.duration * fps));
        return (
          <Sequence key={i} from={startFrame} durationInFrames={durFrames}>
            <SceneRouter opinion={opinion} type={scene.type} durFrames={durFrames} />
            {scene.audioFile ? <Audio src={resolveAudio(scene.audioFile)} /> : null}
            <ChapterBanner label={SECTION_LABEL[scene.type]} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

interface SceneRouterProps {
  opinion: OpinionPiece;
  type: OpinionSceneAudio['type'];
  durFrames: number;
}

const SceneRouter: React.FC<SceneRouterProps> = ({ opinion, type, durFrames }) => {
  switch (type) {
    case 'hook':
      return <HookCard text={opinion.hook} />;
    case 'then-now':
      return (
        <ThenNowSplit
          thenLines={opinion.thenNow.thenLines}
          nowLines={opinion.thenNow.nowLines}
          sceneDurationFrames={durFrames}
        />
      );
    case 'pros':
      return <ProsConsList mode="pros" items={opinion.pros} sceneDurationFrames={durFrames} />;
    case 'cons':
      return <ProsConsList mode="cons" items={opinion.cons} sceneDurationFrames={durFrames} />;
    case 'pivot':
      return <PivotCard text={opinion.pivot} />;
    case 'lesson':
      return <LessonCard text={opinion.lesson} />;
    case 'question':
      return <QuestionCard text={opinion.question || ''} />;
    default:
      return null;
  }
};
