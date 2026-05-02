/**
 * AtomicShort.tsx — Remotion composition for standalone 45-second YouTube Shorts
 *
 * Layout (1080x1920, 9:16):
 *   - Bold title at top (inside safe zone)
 *   - Key visual/diagram in middle
 *   - Bullet points below (max 3)
 *   - Caption overlay per scene
 *   - Avatar bubble
 *   - Progress bar at bottom
 *
 * Duration: exactly 1350 frames (45s at 30fps)
 */

import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  Sequence,
  Audio,
  staticFile,
  interpolate,
  spring,
} from 'remotion';
import type { Storyboard, Scene } from '../types';
import { SAFE_ZONE } from '../lib/vertical-layouts';
import { VerticalCaptionOverlay } from '../components/vertical/VerticalCaptionOverlay';
import { AvatarBubble } from '../components/AvatarBubble';
import { CameraDrift } from '../components/CameraDrift';

// ── Dark-mode palette for vertical (matches VerticalLong.tsx) ──
const COLORS = {
  saffron: '#E85D26',
  gold: '#FDB813',
  teal: '#1DD1A1',
  white: '#FFFFFF',
  dark: '#0C0A15',
  darkAlt: '#141020',
  accent: '#2563EB',
  muted: '#94A3B8',
} as const;

// ── Props ──────────────────────────────────────────��────────────────────────

interface AtomicShortProps {
  storyboard: Storyboard;
  /** Override heading text (from ShortEpisode) */
  heading?: string;
  /** Override bullet points (from ShortEpisode) */
  bullets?: string[];
  /** Visual cue type */
  visualCue?: 'concept' | 'comparison' | 'list' | 'interview' | 'cheatsheet';
}

// ── Component ───────────────────────────────────────────────────────────────

export const AtomicShort: React.FC<AtomicShortProps> = ({
  storyboard,
  heading,
  bullets,
  visualCue = 'concept',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const totalDuration = durationInFrames;
  const progress = frame / totalDuration;

  // Resolve heading from props or first scene
  const displayHeading = heading || storyboard.scenes[0]?.heading || storyboard.topic;
  const displayBullets = bullets || storyboard.scenes[0]?.bullets || [];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      {/* Background gradient */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 30%, ${COLORS.darkAlt} 0%, ${COLORS.dark} 100%)`,
        }}
      />

      {/* Camera drift for Ken Burns effect */}
      <CameraDrift>
        <AbsoluteFill>
          {/* ── Title Section (top safe zone) ── */}
          <TitleBanner
            text={displayHeading}
            frame={frame}
            fps={fps}
          />

          {/* ── Main Content Area ── */}
          <MainContent
            scenes={storyboard.scenes}
            visualCue={visualCue}
            frame={frame}
            fps={fps}
            totalDuration={totalDuration}
          />

          {/* ── Bullet Points ── */}
          <BulletSection
            bullets={displayBullets}
            frame={frame}
            fps={fps}
          />
        </AbsoluteFill>
      </CameraDrift>

      {/* ── Caption Overlay (one per scene) ── */}
      {storyboard.scenes.map((scene, i) => (
        <Sequence
          key={i}
          from={scene.startFrame}
          durationInFrames={scene.endFrame - scene.startFrame}
        >
          <VerticalCaptionOverlay
            text={scene.narration || scene.content}
            wordTimestamps={scene.wordTimestamps}
            captionMode="hormozi"
          />
        </Sequence>
      ))}

      {/* ── Avatar Bubble (bottom right) ── */}
      <div style={{
        position: 'absolute',
        bottom: 440,
        right: 40,
        width: 160,
        height: 160,
      }}>
        <AvatarBubble />
      </div>

      {/* ── Progress Bar ─�� */}
      <ProgressBar progress={progress} />

      {/* ── Audio ── */}
      {storyboard.audioFile && (
        <Audio src={staticFile(`audio/${storyboard.audioFile.split('/').pop()}`)} />
      )}
      {storyboard.bgmFile && (
        <Audio src={staticFile(storyboard.bgmFile.startsWith('audio/') ? storyboard.bgmFile : `audio/${storyboard.bgmFile.split('/').pop()}`)} volume={0.15} />
      )}
    </AbsoluteFill>
  );
};

// ── Title Banner ────────────────���───────────────────────────────────────────

const TitleBanner: React.FC<{ text: string; frame: number; fps: number }> = ({
  text,
  frame,
  fps,
}) => {
  const enterProgress = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const opacity = interpolate(enterProgress, [0, 1], [0, 1]);
  const translateY = interpolate(enterProgress, [0, 1], [-40, 0]);

  return (
    <div
      style={{
        position: 'absolute',
        top: SAFE_ZONE.top + 10,
        left: SAFE_ZONE.left,
        width: SAFE_ZONE.contentWidth,
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      {/* Accent line */}
      <div
        style={{
          width: 60,
          height: 4,
          backgroundColor: COLORS.saffron,
          borderRadius: 2,
          marginBottom: 16,
        }}
      />
      <div
        style={{
          fontSize: 52,
          fontWeight: 800,
          fontFamily: 'Space Grotesk, sans-serif',
          color: COLORS.white,
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          textShadow: '0 2px 20px rgba(0,0,0,0.6)',
        }}
      >
        {text}
      </div>
    </div>
  );
};

// ── Main Content ───────��───────────────────────────────��────────────────────

const MainContent: React.FC<{
  scenes: Scene[];
  visualCue: string;
  frame: number;
  fps: number;
  totalDuration: number;
}> = ({ scenes, visualCue, frame, fps }) => {
  // Find the active scene based on frame
  const activeScene = scenes.find(
    (s) => frame >= s.startFrame && frame < s.endFrame
  ) || scenes[0];

  if (!activeScene) return null;

  const sceneProgress = (frame - activeScene.startFrame) / (activeScene.endFrame - activeScene.startFrame);

  const enterSpring = spring({
    frame: frame - (activeScene.startFrame || 0),
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  return (
    <div
      style={{
        position: 'absolute',
        top: SAFE_ZONE.top + 160,
        left: SAFE_ZONE.left,
        width: SAFE_ZONE.contentWidth,
        height: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: enterSpring,
        transform: `scale(${interpolate(enterSpring, [0, 1], [0.9, 1])})`,
      }}
    >
      <ContentCard
        scene={activeScene}
        visualCue={visualCue}
      />
    </div>
  );
};

// ── Content Card ────────────────────────────────────────────────────────────

const ContentCard: React.FC<{
  scene: Scene;
  visualCue: string;
}> = ({ scene, visualCue }) => {
  const bgColor = visualCue === 'comparison' ? 'rgba(37, 99, 235, 0.08)'
    : visualCue === 'interview' ? 'rgba(232, 93, 38, 0.08)'
    : 'rgba(255, 255, 255, 0.04)';

  const borderColor = visualCue === 'comparison' ? 'rgba(37, 99, 235, 0.25)'
    : visualCue === 'interview' ? 'rgba(232, 93, 38, 0.25)'
    : 'rgba(255, 255, 255, 0.1)';

  const narrationText = scene.narration || scene.content || '';
  const displayText = narrationText.length > 200
    ? narrationText.slice(0, 200) + '...'
    : narrationText;

  return (
    <div
      style={{
        width: '100%',
        padding: 40,
        borderRadius: 24,
        backgroundColor: bgColor,
        border: `2px solid ${borderColor}`,
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Visual cue icon */}
      <div style={{
        fontSize: 48,
        marginBottom: 20,
        opacity: 0.7,
      }}>
        {visualCue === 'comparison' && '\u2194'}
        {visualCue === 'interview' && '\uD83C\uDFA4'}
        {visualCue === 'list' && '\uD83D\uDCCB'}
        {visualCue === 'cheatsheet' && '\u26A1'}
        {visualCue === 'concept' && '\uD83D\uDCA1'}
      </div>

      {/* Scene content text */}
      <div
        style={{
          fontSize: 34,
          fontFamily: 'Inter, sans-serif',
          color: COLORS.white,
          lineHeight: 1.5,
          fontWeight: 500,
          opacity: 0.9,
        }}
      >
        {displayText}
      </div>
    </div>
  );
};

// ── Bullet Section ───────────��──────────────────────────────────────────────

const BulletSection: React.FC<{
  bullets: string[];
  frame: number;
  fps: number;
}> = ({ bullets, frame, fps }) => {
  if (!bullets || bullets.length === 0) return null;

  const bulletDelay = 30; // frames between bullets
  const startFrame = fps * 2; // bullets start at 2 seconds

  return (
    <div
      style={{
        position: 'absolute',
        top: SAFE_ZONE.top + 800,
        left: SAFE_ZONE.left + 20,
        width: SAFE_ZONE.contentWidth - 40,
      }}
    >
      {bullets.slice(0, 3).map((bullet, i) => {
        const bulletFrame = startFrame + i * bulletDelay;
        const enterProgress = spring({
          frame: Math.max(0, frame - bulletFrame),
          fps,
          config: { damping: 15, stiffness: 100 },
        });

        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
              marginBottom: 20,
              opacity: enterProgress,
              transform: `translateX(${interpolate(enterProgress, [0, 1], [40, 0])}px)`,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: COLORS.teal,
                marginTop: 14,
                flexShrink: 0,
              }}
            />
            <div
              style={{
                fontSize: 30,
                fontFamily: 'Inter, sans-serif',
                color: COLORS.white,
                lineHeight: 1.4,
                fontWeight: 400,
                opacity: 0.85,
              }}
            >
              {bullet}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Progress Bar ────────────────────────────────────────────────────��───────

const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 410,
        left: SAFE_ZONE.left,
        width: SAFE_ZONE.contentWidth,
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${progress * 100}%`,
          height: '100%',
          backgroundColor: COLORS.saffron,
          borderRadius: 2,
        }}
      />
    </div>
  );
};

// ── Metadata for Remotion ──���────────────────────────��───────────────────────

export const calculateAtomicShortMetadata = ({
  props,
}: {
  props: Record<string, unknown>;
}): { durationInFrames: number; fps: number; width: number; height: number } => {
  const storyboard = props.storyboard as Storyboard | undefined;
  return {
    durationInFrames: storyboard?.durationInFrames || 1350, // 45s at 30fps
    fps: 30,
    width: 1080,
    height: 1920,
  };
};
