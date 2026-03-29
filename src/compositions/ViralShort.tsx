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
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { Storyboard, Scene } from '../types';
import { COLORS, FONTS } from '../lib/theme';
import { SyncTimeline } from '../lib/sync-engine';
import { setSyncTimeline } from '../hooks/useSync';
import { ConceptViz } from '../components/ConceptViz';
import { CaptionOverlay } from '../components';
import { TRANSITION_DURATION } from '../lib/constants';

// ── Layout Constants (1080x1920) ──────────────────────────────────────────────
const WIDTH = 1080;
const SAFE_ZONE = 150;       // YouTube/Instagram UI buttons
const CTA_BAR_HEIGHT = 76;
const CAPTION_HEIGHT = 200;
const CONTENT_TOP = 0;
const CONTENT_HEIGHT = 1920 - SAFE_ZONE - CTA_BAR_HEIGHT - CAPTION_HEIGHT; // 1494
const HOOK_DURATION_FRAMES = 60;  // 2 seconds at 30fps
const OUTRO_DURATION_FRAMES = 90; // 3 seconds at 30fps
const FADE_TRANSITION = 8;        // frames between scenes

// ── Props ─────────────────────────────────────────────────────────────────────
interface ViralShortProps {
  storyboard: Storyboard;
  clipStart?: number;   // scene index to start from (default 0)
  clipEnd?: number;     // scene index to end at (exclusive, default all)
}

// ── Helper: get active scene by audio time ────────────────────────────────────
function getActiveSceneByAudioTime(
  scenes: Scene[],
  audioTimeSeconds: number,
  sceneOffsets: number[],
): Scene | null {
  if (audioTimeSeconds < 0) return null;
  for (let i = scenes.length - 1; i >= 0; i--) {
    const offset = sceneOffsets[i] ?? scenes[i].audioOffsetSeconds ?? -1;
    if (offset === -1) continue;
    if (audioTimeSeconds >= offset) return scenes[i];
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── HookFrame ─────────────────────────────────────────────────────────────────
const HookFrame: React.FC<{ hookText: string }> = ({ hookText }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scaleSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.9 },
    from: 1.2,
    to: 1.0,
  });

  const textOpacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const brandOpacity = interpolate(frame, [20, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const brandY = interpolate(frame, [20, 35], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 40%, rgba(232, 93, 38, 0.15), ${COLORS.dark} 70%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 60px',
      }}
    >
      <div
        style={{
          fontSize: 56,
          fontWeight: 900,
          color: COLORS.white,
          fontFamily: FONTS.heading,
          textAlign: 'center',
          lineHeight: 1.3,
          letterSpacing: '-0.02em',
          transform: `scale(${scaleSpring})`,
          opacity: textOpacity,
          textShadow: `0 0 40px rgba(232, 93, 38, 0.5), 0 4px 12px rgba(0, 0, 0, 0.8)`,
          maxWidth: WIDTH - 120,
        }}
      >
        {hookText}
      </div>

      <div
        style={{
          marginTop: 40,
          fontSize: 22,
          fontWeight: 700,
          color: COLORS.saffron,
          fontFamily: FONTS.heading,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          opacity: brandOpacity,
          transform: `translateY(${brandY}px)`,
        }}
      >
        GURU SISHYA
      </div>
    </AbsoluteFill>
  );
};

// ── FullScreenText ────────────────────────────────────────────────────────────
const FullScreenText: React.FC<{ scene: Scene; fps: number }> = ({ scene, fps }) => {
  const frame = useCurrentFrame();
  const hasBullets = scene.bullets && scene.bullets.length > 0;
  const bullets = hasBullets ? scene.bullets!.slice(0, 4) : [];
  const fallbackText = scene.narration?.split(/[.!?]/)[0] || scene.content || '';

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        padding: '60px 80px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      {/* Heading */}
      {scene.heading && (
        <div
          style={{
            borderLeft: `6px solid ${COLORS.saffron}`,
            paddingLeft: 24,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              fontSize: 52,
              fontWeight: 900,
              color: COLORS.white,
              fontFamily: FONTS.heading,
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
            }}
          >
            {scene.heading}
          </div>
        </div>
      )}

      {/* Bullets with staggered spring reveal */}
      {hasBullets ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {bullets.map((bullet, i) => {
            const delay = i * 10; // 10-frame stagger
            const bulletSpring = spring({
              frame: frame - delay,
              fps,
              config: { damping: 18, stiffness: 200, mass: 0.8 },
            });
            const bulletOpacity = interpolate(bulletSpring, [0, 1], [0, 1]);
            const bulletX = interpolate(bulletSpring, [0, 1], [30, 0]);

            return (
              <div
                key={i}
                style={{
                  fontSize: 32,
                  fontWeight: i === 0 ? 700 : 500,
                  color: i === 0 ? COLORS.white : i === 1 ? '#DDDDDD' : '#AAAAAA',
                  fontFamily: FONTS.text,
                  lineHeight: 1.5,
                  paddingLeft: 20,
                  borderLeft: i === 0
                    ? `4px solid ${COLORS.gold}`
                    : '4px solid transparent',
                  opacity: bulletOpacity,
                  transform: `translateX(${bulletX}px)`,
                }}
              >
                {bullet}
              </div>
            );
          })}
        </div>
      ) : (
        /* Fallback: first sentence of narration */
        <div
          style={{
            borderLeft: `6px solid ${COLORS.teal}`,
            paddingLeft: 24,
          }}
        >
          <div
            style={{
              fontSize: 36,
              fontWeight: 600,
              color: COLORS.white,
              fontFamily: FONTS.text,
              lineHeight: 1.5,
            }}
          >
            {fallbackText}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ── FullScreenViz ─────────────────────────────────────────────────────────────
const FullScreenViz: React.FC<{
  scene: Scene;
  topic: string;
  sceneIndex: number;
  sceneStartFrame: number;
}> = ({ scene, topic, sceneIndex, sceneStartFrame }) => {
  const duration = scene.endFrame - scene.startFrame;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        padding: '20px 40px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Small heading for context */}
      {scene.heading && (
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: COLORS.saffron,
            fontFamily: FONTS.heading,
            textAlign: 'center',
            marginBottom: 12,
            flexShrink: 0,
          }}
        >
          {scene.heading}
        </div>
      )}

      {/* ConceptViz fills remaining space */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <ConceptViz
          topic={topic}
          sceneIndex={sceneIndex}
          sceneStartFrame={sceneStartFrame}
          keywords={scene.bullets || []}
          sceneDuration={duration}
          vizVariant={scene.vizVariant}
        />
      </div>
    </AbsoluteFill>
  );
};

// ── FullScreenCode ────────────────────────────────────────────────────────────
const FullScreenCode: React.FC<{ scene: Scene; fps: number }> = ({ scene, fps }) => {
  const frame = useCurrentFrame();
  const codeLines = (scene.content || '').split('\n').slice(0, 20);

  const revealSpring = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 160, mass: 1.0 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        padding: '48px 48px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Heading */}
      {scene.heading && (
        <div
          style={{
            fontSize: 36,
            fontWeight: 800,
            color: COLORS.white,
            fontFamily: FONTS.heading,
            marginBottom: 24,
            lineHeight: 1.2,
            flexShrink: 0,
          }}
        >
          {scene.heading}
        </div>
      )}

      {/* Code block */}
      <div
        style={{
          flex: 1,
          backgroundColor: '#1A1625',
          borderRadius: 16,
          padding: '24px 28px',
          overflow: 'hidden',
          border: `1px solid rgba(232, 93, 38, 0.2)`,
          opacity: interpolate(revealSpring, [0, 1], [0, 1]),
        }}
      >
        {codeLines.map((line, i) => {
          const lineDelay = i * 3;
          const lineOpacity = interpolate(
            frame - lineDelay,
            [0, 8],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          // Basic syntax highlighting
          const isComment = line.trimStart().startsWith('//') || line.trimStart().startsWith('#');
          const isKeyword = /^\s*(def |class |function |const |let |var |if |else |for |while |return |import |from |public |private |static )/.test(line);

          let lineColor: string = COLORS.white;
          if (isComment) lineColor = COLORS.gray;
          else if (isKeyword) lineColor = COLORS.teal;

          return (
            <div
              key={i}
              style={{
                fontSize: 22,
                fontFamily: FONTS.code,
                color: lineColor,
                lineHeight: 1.6,
                whiteSpace: 'pre',
                opacity: lineOpacity,
              }}
            >
              {line || ' '}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ── OutroFrame ────────────────────────────────────────────────────────────────
const OutroFrame: React.FC<{ topicSlug: string }> = ({ topicSlug }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1 (0-1s = 0-30 frames): Cliffhanger text
  // Phase 2 (1-3s = 30-90 frames): Brand + link + stats
  const isPhase2 = frame >= 30;

  const cliffhangerSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.9 },
  });

  const cliffhangerScale = interpolate(cliffhangerSpring, [0, 1], [1.15, 1.0]);
  const cliffhangerOpacity = interpolate(cliffhangerSpring, [0, 1], [0, 1]);

  // Phase 2 springs
  const brandSpring = spring({
    frame: frame - 30,
    fps,
    config: { damping: 16, stiffness: 200, mass: 0.8 },
  });
  const linkSpring = spring({
    frame: frame - 38,
    fps,
    config: { damping: 16, stiffness: 200, mass: 0.8 },
  });
  const statsSpring = spring({
    frame: frame - 46,
    fps,
    config: { damping: 16, stiffness: 200, mass: 0.8 },
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 50%, rgba(232, 93, 38, 0.12), ${COLORS.dark} 70%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        padding: '80px 60px',
      }}
    >
      {/* Phase 1: Cliffhanger */}
      <div
        style={{
          fontSize: 40,
          fontWeight: 800,
          color: COLORS.white,
          fontFamily: FONTS.heading,
          textAlign: 'center',
          lineHeight: 1.3,
          transform: `scale(${cliffhangerScale})`,
          opacity: cliffhangerOpacity,
          textShadow: '0 4px 12px rgba(0, 0, 0, 0.8)',
        }}
      >
        But there's ONE thing most people miss...
      </div>

      {/* Phase 2: Branding */}
      {isPhase2 && (
        <>
          <div
            style={{
              fontSize: 36,
              fontWeight: 900,
              color: COLORS.saffron,
              fontFamily: FONTS.heading,
              letterSpacing: '0.08em',
              opacity: interpolate(brandSpring, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(brandSpring, [0, 1], [20, 0])}px)`,
            }}
          >
            GURU SISHYA
          </div>

          <div
            style={{
              backgroundColor: 'rgba(29, 209, 161, 0.15)',
              border: `2px solid ${COLORS.teal}`,
              borderRadius: 40,
              padding: '10px 28px',
              opacity: interpolate(linkSpring, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(linkSpring, [0, 1], [16, 0])}px)`,
            }}
          >
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: COLORS.teal,
                fontFamily: FONTS.text,
              }}
            >
              guru-sishya.in/{topicSlug}
            </span>
          </div>

          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: COLORS.white,
              fontFamily: FONTS.text,
              opacity: interpolate(statsSpring, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(statsSpring, [0, 1], [12, 0])}px)`,
            }}
          >
            1,988 FREE Questions
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};

// ── CTA Bar ───────────────────────────────────────────────────────────────────
const CTABar: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      bottom: SAFE_ZONE,
      left: 0,
      right: 0,
      height: CTA_BAR_HEIGHT,
      background: 'linear-gradient(0deg, rgba(12,10,21,0.95), rgba(12,10,21,0.85))',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      zIndex: 60,
    }}
  >
    <span
      style={{
        fontSize: 26,
        fontWeight: 800,
        color: COLORS.saffron,
        fontFamily: FONTS.heading,
      }}
    >
      guru-sishya.in
    </span>
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        background: COLORS.gray,
      }}
    />
    <span
      style={{
        fontSize: 22,
        color: COLORS.gray,
        fontWeight: 600,
        fontFamily: FONTS.text,
      }}
    >
      FREE Interview Prep
    </span>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPOSITION
// ═══════════════════════════════════════════════════════════════════════════════

export const ViralShort: React.FC<ViralShortProps> = ({
  storyboard,
  clipStart = 0,
  clipEnd,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Slice scenes to the requested clip range ──
  // Strip intro (title) and outro (summary) scenes from the storyboard
  const allContentScenes = storyboard.scenes.filter(
    (s) => s.type !== 'title' && s.type !== 'summary',
  );
  const endIdx = clipEnd ?? allContentScenes.length;
  const clipScenes = allContentScenes.slice(clipStart, endIdx);

  if (clipScenes.length === 0) {
    return (
      <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
        <div style={{ color: COLORS.white, fontSize: 40, textAlign: 'center', marginTop: 400 }}>
          No scenes in clip range
        </div>
      </AbsoluteFill>
    );
  }

  // ── Audio offset ──
  const audioStartOffset = (storyboard as any)._audioStartOffset ?? 0;
  const audioStartFrames = Math.round(audioStartOffset * fps);

  // ── Compute scene durations and total content frames ──
  const sceneDurations = clipScenes.map((s) => s.endFrame - s.startFrame);
  const totalContentFrames = sceneDurations.reduce((a, b) => a + b, 0);
  const totalFrames = HOOK_DURATION_FRAMES + totalContentFrames + OUTRO_DURATION_FRAMES;

  // ── Build SyncTimeline for caption sync ──
  const contentScenes = storyboard.scenes.slice(1, storyboard.scenes.length - 1);
  const syncTimeline = React.useMemo(() => {
    const offsets = storyboard.sceneOffsets || [];
    const timestamps = contentScenes.map((s) => s.wordTimestamps || []);
    return new SyncTimeline(offsets, timestamps, fps, HOOK_DURATION_FRAMES);
  }, [storyboard, fps]);

  setSyncTimeline(syncTimeline);

  // ── Active scene for captions (audio-time based) ──
  const audioTimeSeconds = (frame - HOOK_DURATION_FRAMES) / fps + audioStartOffset;
  const activeScene = getActiveSceneByAudioTime(
    contentScenes,
    audioTimeSeconds,
    storyboard.sceneOffsets || [],
  );
  const hasNarration =
    activeScene && activeScene.narration && activeScene.narration.trim() !== '';

  // ── Phase detection ──
  const isHook = frame < HOOK_DURATION_FRAMES;
  const isOutro = frame >= HOOK_DURATION_FRAMES + totalContentFrames;

  // ── Topic slug for outro link ──
  const topicSlug = storyboard.topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // ── Hook text: first sentence of first scene's narration ──
  const hookText =
    clipScenes[0].narration?.split(/[.!?]/)[0]?.trim() ||
    clipScenes[0].heading ||
    storyboard.topic;

  // ── Compute cumulative scene start frames for sceneStartFrame prop ──
  const cumulativeStarts: number[] = [];
  let cumulative = 0;
  for (const d of sceneDurations) {
    cumulativeStarts.push(cumulative);
    cumulative += d;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark, width: WIDTH, height: 1920 }}>
      {/* ── Hook Intro (2 seconds) ── */}
      <Sequence from={0} durationInFrames={HOOK_DURATION_FRAMES}>
        <AbsoluteFill style={{ height: CONTENT_HEIGHT + CAPTION_HEIGHT + CTA_BAR_HEIGHT }}>
          <HookFrame hookText={hookText} />
        </AbsoluteFill>
      </Sequence>

      {/* ── Content Scenes with transitions ── */}
      <Sequence from={HOOK_DURATION_FRAMES} durationInFrames={totalContentFrames}>
        <AbsoluteFill style={{ height: CONTENT_HEIGHT }}>
          <TransitionSeries>
            {clipScenes.map((scene, idx) => {
              const duration = sceneDurations[idx];
              const sceneStartFrame = HOOK_DURATION_FRAMES + cumulativeStarts[idx];
              const isFirst = idx === 0;

              let sceneContent: React.ReactNode;
              if (scene.type === 'text' || scene.type === 'interview') {
                sceneContent = <FullScreenText scene={scene} fps={fps} />;
              } else if (scene.type === 'code') {
                sceneContent = <FullScreenCode scene={scene} fps={fps} />;
              } else {
                // diagram, table, review — all use viz
                sceneContent = (
                  <FullScreenViz
                    scene={scene}
                    topic={storyboard.topic}
                    sceneIndex={idx}
                    sceneStartFrame={sceneStartFrame}
                  />
                );
              }

              return (
                <React.Fragment key={idx}>
                  {!isFirst && (
                    <TransitionSeries.Transition
                      presentation={fade()}
                      timing={linearTiming({ durationInFrames: FADE_TRANSITION })}
                    />
                  )}
                  <TransitionSeries.Sequence durationInFrames={duration}>
                    <AbsoluteFill>{sceneContent}</AbsoluteFill>
                  </TransitionSeries.Sequence>
                </React.Fragment>
              );
            })}
          </TransitionSeries>
        </AbsoluteFill>
      </Sequence>

      {/* ── Outro (3 seconds) ── */}
      <Sequence
        from={HOOK_DURATION_FRAMES + totalContentFrames}
        durationInFrames={OUTRO_DURATION_FRAMES}
      >
        <AbsoluteFill style={{ height: CONTENT_HEIGHT + CAPTION_HEIGHT + CTA_BAR_HEIGHT }}>
          <OutroFrame topicSlug={topicSlug} />
        </AbsoluteFill>
      </Sequence>

      {/* ── Caption Overlay (clipped container) ── */}
      {!isHook && !isOutro && hasNarration && activeScene && (
        <div
          style={{
            position: 'absolute',
            bottom: SAFE_ZONE + CTA_BAR_HEIGHT, // 150 + 76 = 226
            left: 0,
            right: 0,
            height: CAPTION_HEIGHT,
            zIndex: 50,
            clipPath: 'inset(0)', // Prevents CaptionOverlay from escaping
          }}
        >
          <CaptionOverlay
            key={`caption-${activeScene.audioOffsetSeconds ?? activeScene.startFrame}`}
            text={activeScene.narration!}
            startFrame={
              activeScene.audioOffsetSeconds != null && activeScene.audioOffsetSeconds >= 0
                ? HOOK_DURATION_FRAMES + Math.round(activeScene.audioOffsetSeconds * fps)
                : HOOK_DURATION_FRAMES + activeScene.startFrame
            }
            durationInFrames={activeScene.endFrame - activeScene.startFrame}
            wordTimestamps={activeScene.wordTimestamps}
          />
        </div>
      )}

      {/* ── CTA Bar (persistent) ── */}
      <CTABar />

      {/* ── Master Audio with startFrom for clip offset ── */}
      {storyboard.audioFile && (
        <Sequence from={HOOK_DURATION_FRAMES}>
          <Audio
            src={staticFile(`audio/${storyboard.audioFile.split('/').pop()}`)}
            startFrom={audioStartFrames}
            volume={(f) => {
              const baseVolume = 1.0;
              const fadeIn = interpolate(f, [0, 9], [0, 1], {
                extrapolateRight: 'clamp',
              });
              const fadeOut = interpolate(
                f,
                [totalContentFrames - 9, totalContentFrames],
                [1, 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );
              return baseVolume * fadeIn * fadeOut;
            }}
          />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};

export default ViralShort;
