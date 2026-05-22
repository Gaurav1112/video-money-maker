import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import type { CalculateMetadataFunction } from 'remotion';
import { FONTS } from '../lib/theme';

const FPS = 30;
const MIN_FRAMES = 55 * FPS;
const MAX_FRAMES = 65 * FPS;

// ─── Props ────────────────────────────────────────────────────────────────

export interface OpinionShortAudio {
  audioFile: string;
  duration: number;
}

export interface OpinionShortProps {
  hookText: string;
  thenNowFirstLine: string;
  audio: OpinionShortAudio;
}

// ─── Metadata ─────────────────────────────────────────────────────────────

export const calculateOpinionShortMetadata: CalculateMetadataFunction<
  OpinionShortProps & Record<string, unknown>
> = ({ props }) => {
  const sec = props.audio?.duration || 60;
  const raw = Math.ceil(sec * FPS) + 30; // small tail
  const durationInFrames = Math.min(MAX_FRAMES, Math.max(MIN_FRAMES, raw));
  return {
    durationInFrames,
    fps: FPS,
    width: 1080,
    height: 1920,
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
  return staticFile(audioFile.replace(/^public\//, ''));
}

// ─── Visuals ──────────────────────────────────────────────────────────────

const HookPhase: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const op = interpolate(enter, [0, 1], [0, 1]);
  const ty = interpolate(enter, [0, 1], [24, 0]);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 50% 30%, #1a1a2e 0%, #0A0A12 75%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 64px',
      }}
    >
      <div
        style={{
          opacity: op,
          transform: `translateY(${ty}px)`,
          textAlign: 'center',
          color: '#F8FAFC',
          fontFamily: FONTS.heading,
          fontSize: 64,
          lineHeight: 1.25,
          fontWeight: 800,
          letterSpacing: -1,
          maxWidth: 920,
        }}
      >
        <div
          style={{
            fontSize: 22,
            color: '#FBBF24',
            textTransform: 'uppercase',
            letterSpacing: 6,
            marginBottom: 32,
            fontWeight: 700,
          }}
        >
          Opinion · Tech Leadership
        </div>
        {text}
      </div>
    </div>
  );
};

const ThenNowPhase: React.FC<{ line: string }> = ({ line }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#0A0A12',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 64px',
        opacity: op,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.heading,
          fontSize: 96,
          color: '#22D3EE',
          fontWeight: 900,
          marginBottom: 48,
        }}
      >
        1995 → 2026
      </div>
      <div
        style={{
          fontFamily: FONTS.text,
          fontSize: 56,
          color: '#F8FAFC',
          textAlign: 'center',
          lineHeight: 1.4,
          maxWidth: 920,
        }}
      >
        {line}
      </div>
    </div>
  );
};

// ─── Composition ──────────────────────────────────────────────────────────

export const OpinionShort: React.FC<OpinionShortProps> = ({
  hookText,
  thenNowFirstLine,
  audio,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  // Split visuals: 60% hook, 40% then-now reveal
  const hookFrames = Math.floor(durationInFrames * 0.6);
  const thenFrames = durationInFrames - hookFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0A0A12' }}>
      <Sequence from={0} durationInFrames={hookFrames}>
        <HookPhase text={hookText} />
      </Sequence>
      <Sequence from={hookFrames} durationInFrames={thenFrames}>
        <ThenNowPhase line={thenNowFirstLine} />
      </Sequence>
      {audio?.audioFile ? <Audio src={resolveAudio(audio.audioFile)} /> : null}
    </AbsoluteFill>
  );
};
