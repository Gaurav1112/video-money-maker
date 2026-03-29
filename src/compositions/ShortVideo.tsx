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
import { Storyboard, Scene } from '../types';
import { COLORS, FONTS } from '../lib/theme';
import { SyncTimeline } from '../lib/sync-engine';
import { setSyncTimeline } from '../hooks/useSync';
import { MAX_SHORT_DURATION_FRAMES } from '../lib/constants';
import { ConceptViz } from '../components/ConceptViz';
import { BrandingLayer } from '../components/BrandingLayer';
import { BgmLayer } from '../components/BgmLayer';
import { SfxLayer } from '../components/SfxLayer';
import {
  CaptionOverlay,
  BackgroundLayer,
  TextSection,
  CodeReveal,
  InterviewInsight,
  ComparisonTable,
  DiagramSlide,
} from '../components';
import { PatternInterrupt } from '../components/PatternInterrupt';

// ── Layout Constants ──────────────────────────────────────────────────────────
// Vertical (9:16) at 1080x1920

const SHORT_INTRO = 60;  // 2 seconds at 30fps
const SHORT_OUTRO = 90;  // 3 seconds at 30fps

// ── Zone Layout (1080x1920, stacked — mirrors LongVideo components) ──────────
// y=0    → Header (80px)       : topic + session badge
// y=80   → Text (40% = 768px)  : TextSection / CodeReveal / InterviewInsight
// y=848  → Viz (40% = 768px)   : ConceptViz (same as LongVideo right panel)
// y=1616 → Captions (~304px)   : CaptionOverlay (same as LongVideo)
// y=1694 → CTA bar (76px)      : guru-sishya.in branding (overlaps caption zone)
// y=1770 → Safe zone (150px)   : reserved for YT/IG UI buttons
const HEADER_HEIGHT = 80;
const CTA_BAR_HEIGHT = 76;               // Bigger for mobile readability
const SAFE_ZONE_HEIGHT = 150;            // YouTube/Instagram UI buttons

const SCENE_FADE_FRAMES = 8;             // Cross-fade between scenes (~267ms)

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Find the active scene based on audio playback time.
 * Mirrors the approach from LongVideo for accurate caption sync.
 */
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

// ── Props ─────────────────────────────────────────────────────────────────────

interface ShortVideoProps {
  storyboard: Storyboard;
  clipStart?: number;   // scene index to start from (default 0)
  clipEnd?: number;     // scene index to end at (exclusive, default 3)
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ShortVideo: React.FC<ShortVideoProps> = ({
  storyboard,
  clipStart = 0,
  clipEnd = 3,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Scene selection ──
  const allScenes = storyboard.scenes;
  const rawScenes = allScenes.slice(clipStart, clipEnd);
  const firstScene = rawScenes[0];

  // Cap scenes to fit within 60-second max duration
  const maxContentForScenes = MAX_SHORT_DURATION_FRAMES - SHORT_INTRO - SHORT_OUTRO;
  let totalSceneFrames = 0;
  const scenes = rawScenes.filter(scene => {
    const dur = scene.endFrame - scene.startFrame;
    if (totalSceneFrames + dur > maxContentForScenes) return false;
    totalSceneFrames += dur;
    return true;
  });
  const lastScene = scenes[scenes.length - 1];

  // Content duration is relative to the selected clip
  const clipAudioStart = firstScene?.startFrame ?? 0;
  const clipAudioEnd = lastScene?.endFrame ?? 0;
  const rawContentFrames = clipAudioEnd - clipAudioStart;

  // ── Enforce 60-second max for Shorts (1800 frames at 30fps) ──
  const maxContentFrames = MAX_SHORT_DURATION_FRAMES - SHORT_INTRO - SHORT_OUTRO;
  const contentFrames = Math.min(rawContentFrames, maxContentFrames);
  const totalFrames = SHORT_INTRO + contentFrames + SHORT_OUTRO;
  const progress = frame / totalFrames;

  // ── Sync timeline (mirrors LongVideo pattern) ──
  const syncTimeline = React.useMemo(() => {
    const offsets = storyboard.sceneOffsets || [];
    const timestamps = scenes.map(s => s.wordTimestamps || []);
    // Use only the offsets for our capped scenes
    const clipOffsets = offsets.slice(clipStart, clipStart + scenes.length);
    return new SyncTimeline(clipOffsets, timestamps, fps, SHORT_INTRO);
  }, [storyboard, fps, clipStart, clipEnd]);

  // Set synchronously during render (safe: no side effects)
  setSyncTimeline(syncTimeline);

  // ── Audio timing for caption sync ──
  const audioTimeSeconds = (frame - SHORT_INTRO) / fps;
  const clipSceneOffsets = (storyboard.sceneOffsets || []).slice(clipStart, clipStart + scenes.length);
  const activeScene = getActiveSceneByAudioTime(scenes, audioTimeSeconds, clipSceneOffsets);
  const hasNarration = activeScene && activeScene.narration && activeScene.narration.trim() !== '';
  const currentSceneType = activeScene?.type || 'text';

  // ── Phase detection ──
  const isIntro = frame < SHORT_INTRO;
  const isOutro = frame >= SHORT_INTRO + contentFrames;
  const isContent = !isIntro && !isOutro;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      {/* Animated background - subtle, adapts to scene type */}
      {isContent && <BackgroundLayer sceneType={currentSceneType} />}

      {/* ────────────────────────────────────────────────────────────────────
       *  INTRO: Topic name + hook (2 seconds)
       * ──────────────────────────────────────────────────────────────────── */}
      <Sequence from={0} durationInFrames={SHORT_INTRO}>
        <IntroSequence
          topic={storyboard.topic}
          sessionNumber={storyboard.sessionNumber}
          fps={fps}
          hookText={scenes[0]?.narration?.split(/[.!?]/)[0] || storyboard.topic}
        />
      </Sequence>

      {/* ────────────────────────────────────────────────────────────────────
       *  PERSISTENT TOPIC HEADER (during content)
       * ──────────────────────────────────────────────────────────────────── */}
      {isContent && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: HEADER_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          background: 'linear-gradient(180deg, rgba(12,10,21,0.95) 0%, rgba(12,10,21,0.7) 100%)',
          zIndex: 20,
        }}>
          <div style={{
            fontSize: 28,
            fontWeight: 800,
            color: COLORS.white,
            fontFamily: FONTS.heading,
            letterSpacing: '-0.01em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '68%',
          }}>
            {storyboard.topic}
          </div>
          <div style={{
            fontSize: 20,
            fontWeight: 700,
            color: COLORS.dark,
            background: COLORS.saffron,
            padding: '6px 16px',
            borderRadius: 24,
            fontFamily: FONTS.text,
          }}>
            S{storyboard.sessionNumber}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────
       *  CONTENT SCENES - VERTICAL STACKED LAYOUT
       * ──────────────────────────────────────────────────────────────────── */}
      {scenes.map((scene, idx) => {
        const sceneLocalStart = scene.startFrame - clipAudioStart;
        const sceneAbsoluteStart = SHORT_INTRO + sceneLocalStart;
        const duration = scene.endFrame - scene.startFrame;

        return (
          <Sequence key={idx} from={sceneAbsoluteStart} durationInFrames={duration}>
            <VerticalSceneLayout
              scene={scene}
              sceneIndex={idx}
              sceneStartFrame={sceneAbsoluteStart}
              topic={storyboard.topic}
              storyboard={storyboard}
              fps={fps}
              duration={duration}
              isFirstScene={idx === 0}
            />
          </Sequence>
        );
      })}

      {/* ────────────────────────────────────────────────────────────────────
       *  OUTRO: CTA (3 seconds)
       * ──────────────────────────────────────────────────────────────────── */}
      <Sequence from={SHORT_INTRO + contentFrames} durationInFrames={SHORT_OUTRO}>
        <OutroSequence
          fps={fps}
          topic={storyboard.topic}
          hookText={firstScene?.heading || storyboard.topic}
        />
      </Sequence>

      {/* ────────────────────────────────────────────────────────────────────
       *  SUBTITLES — same CaptionOverlay as long video, constrained to
       *  the bottom 20% zone. clipPath: 'inset(0)' creates a new
       *  containing block so CaptionOverlay's absolute positioning
       *  stays within this container instead of escaping to viewport.
       * ──────────────────────────────────────────────────────────────────── */}
      {isContent && hasNarration && activeScene && (
        <div style={{
          position: 'absolute',
          bottom: SAFE_ZONE_HEIGHT + CTA_BAR_HEIGHT,
          left: 0,
          right: 0,
          height: 304,
          zIndex: 50,
          clipPath: 'inset(0)',
        }}>
          <CaptionOverlay
            key={`caption-${activeScene.audioOffsetSeconds ?? activeScene.startFrame}`}
            text={activeScene.narration!}
            startFrame={
              activeScene.audioOffsetSeconds != null && activeScene.audioOffsetSeconds >= 0
                ? SHORT_INTRO + Math.round(activeScene.audioOffsetSeconds * fps)
                : SHORT_INTRO + activeScene.startFrame
            }
            durationInFrames={activeScene.endFrame - activeScene.startFrame}
            wordTimestamps={activeScene.wordTimestamps}
          />
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────
       *  PATTERN INTERRUPT OVERLAYS - re-hook viewers at key moments
       * ──────────────────────────────────────────────────────────────────── */}
      <PatternInterrupt
        totalFrames={totalFrames}
        introFrames={SHORT_INTRO}
        outroFrames={SHORT_OUTRO}
      />

      {/* ────────────────────────────────────────────────────────────────────
       *  BOTTOM CTA BAR - persistent across all phases
       * ──────────────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        bottom: SAFE_ZONE_HEIGHT,
        left: 0,
        right: 0,
        height: CTA_BAR_HEIGHT,
        background: 'linear-gradient(0deg, rgba(12,10,21,0.95) 0%, rgba(12,10,21,0.85) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        zIndex: 60,
      }}>
        <span style={{
          fontSize: 26,
          fontWeight: 800,
          color: COLORS.saffron,
          fontFamily: FONTS.heading,
          letterSpacing: '0.02em',
        }}>
          guru-sishya.in
        </span>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          background: COLORS.gray,
          display: 'inline-block',
        }} />
        <span style={{
          fontSize: 22,
          color: COLORS.gray,
          fontFamily: FONTS.text,
          fontWeight: 600,
        }}>
          FREE Interview Prep
        </span>
      </div>

      {/* ────────────────────────────────────────────────────────────────────
       *  AUDIO LAYERS
       * ──────────────────────────────────────────────────────────────────── */}

      {/* Master narration audio — seek to clip position, starts after intro */}
      {storyboard.audioFile && (
        <Sequence from={SHORT_INTRO}>
          <Audio
            src={staticFile(`audio/${storyboard.audioFile.split('/').pop()}`)}
            startFrom={Math.round(((storyboard as any)._audioStartOffset ?? 0) * fps)}
            volume={(f) => {
              const fadeIn = interpolate(f, [0, 9], [0, 1], { extrapolateRight: 'clamp' });
              const fadeOut = interpolate(
                f,
                [contentFrames - 9, contentFrames],
                [1, 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );
              return fadeIn * fadeOut;
            }}
          />
        </Sequence>
      )}

      {/* Background music with sidechain ducking */}
      {storyboard.bgmFile && syncTimeline && (
        <BgmLayer syncTimeline={syncTimeline} bgmFile={storyboard.bgmFile} />
      )}

      {/* Sound effects tied to word timestamps */}
      {syncTimeline && storyboard.allSfxTriggers && storyboard.allSfxTriggers.length > 0 && (
        <SfxLayer triggers={storyboard.allSfxTriggers} syncTimeline={syncTimeline} />
      )}

      {/* BrandingLayer DISABLED for shorts — ShortVideo has its own
       * header, CTA bar, intro brand, and outro CTA. BrandingLayer's
       * watermark, lower-third, and mid-CTA all collide with these. */}
    </AbsoluteFill>
  );
};

// ── Intro Sub-Component ───────────────────────────────────────────────────────

const IntroSequence: React.FC<{
  topic: string;
  sessionNumber: number;
  fps: number;
  hookText: string; // First sentence of narration, used as scroll-stopping text
}> = ({ topic, sessionNumber, fps, hookText }) => {
  const frame = useCurrentFrame();

  // Hook text appears INSTANTLY (frame 0) — the scroll-stopper
  const hookScale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 300, mass: 0.5 },
  });

  // Brand fades in after hook has grabbed attention (frame 20-35)
  const brandOpacity = interpolate(frame, [20, 35], [0, 0.7], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Fade out into first content scene (frame 45-60)
  const exitOpacity = interpolate(frame, [45, 60], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 40px',
      background: `radial-gradient(ellipse at center, rgba(232,93,38,0.12) 0%, ${COLORS.dark} 70%)`,
      opacity: exitOpacity,
    }}>
      {/* HOOK TEXT — visible from frame 0, large, bold, stops the scroll */}
      <div style={{
        fontSize: 44,
        fontWeight: 900,
        color: COLORS.white,
        fontFamily: FONTS.heading,
        textAlign: 'center',
        lineHeight: 1.2,
        maxWidth: '95%',
        transform: `scale(${interpolate(hookScale, [0, 1], [1.3, 1])})`,
        textShadow: '0 0 30px rgba(232,93,38,0.4), 0 2px 4px rgba(0,0,0,0.8)',
      }}>
        {hookText}
      </div>

      {/* Small brand below — fades in after hook */}
      <div style={{
        marginTop: 30,
        fontSize: 16,
        fontWeight: 700,
        color: COLORS.saffron,
        fontFamily: FONTS.heading,
        letterSpacing: '0.1em',
        opacity: brandOpacity,
      }}>
        GURU SISHYA
      </div>
    </AbsoluteFill>
  );
};

// ── Vertical Scene Layout Sub-Component ───────────────────────────────────────
// Reuses the SAME components as LongVideo (TextSection, CodeReveal, etc.)
// but stacks them vertically: text on top (40%), viz on bottom (40%).

const VerticalSceneLayout: React.FC<{
  scene: Scene;
  sceneIndex: number;
  sceneStartFrame: number;
  topic: string;
  storyboard: Storyboard;
  fps: number;
  duration: number;
  isFirstScene: boolean;
}> = ({ scene, sceneIndex, sceneStartFrame, topic, storyboard, fps, duration, isFirstScene }) => {
  const frame = useCurrentFrame();

  // Scene fade
  const enterFade = interpolate(
    frame,
    [0, SCENE_FADE_FRAMES],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const exitFade = interpolate(
    frame,
    [duration - SCENE_FADE_FRAMES, duration],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const sceneFade = isFirstScene ? exitFade : Math.min(enterFade, exitFade);

  // Scene props — same as LongVideo's getSceneProps
  const syncProps = { sceneIndex, sceneStartFrame, animationCues: scene.animationCues };

  const isFullWidthScene = scene.type === 'table' || scene.type === 'diagram';
  const isSplitScene = scene.type === 'text' || scene.type === 'interview';
  const isCodeScene = scene.type === 'code';

  // ── Table parsing (mirrors LongVideo getSceneProps for 'table') ──
  const tableProps = React.useMemo(() => {
    if (scene.type !== 'table') return { headers: [] as string[], rows: [] as string[][] };
    const lines = scene.content.split('\n').filter((l: string) => l.includes('|'));
    const parsed = lines
      .map((l: string) => l.split('|').map((c: string) => c.trim()).filter(Boolean))
      .filter((cells: string[]) => !cells.every((c: string) => /^[-:\s]+$/.test(c)));
    return {
      headers: parsed[0] || [],
      rows: parsed.slice(1) || [],
    };
  }, [scene.content, scene.type]);

  return (
    <AbsoluteFill style={{ opacity: sceneFade }}>
      {/* ── TOP HALF: Text/Code Content (40% of 1920 = 768px) ── */}
      <div style={{
        position: 'absolute',
        top: HEADER_HEIGHT,
        left: 0,
        right: 0,
        height: 768,
        overflow: 'hidden',
      }}>
        {isSplitScene && scene.type === 'text' && (
          <TextSection
            heading={scene.heading || ''}
            bullets={scene.bullets || [scene.content]}
            content={scene.content || ''}
            narration={scene.narration || ''}
            startFrame={0}
            endFrame={duration}
            {...syncProps}
          />
        )}
        {isCodeScene && (
          <CodeReveal
            code={scene.content}
            language={scene.language || 'python'}
            title={scene.heading}
            startFrame={0}
            {...syncProps}
          />
        )}
        {scene.type === 'interview' && (
          <InterviewInsight
            insight={scene.content}
            tip={scene.narration}
            startFrame={0}
            {...syncProps}
          />
        )}
        {isFullWidthScene && scene.type === 'table' && (
          <ComparisonTable
            headers={tableProps.headers}
            rows={tableProps.rows}
            title={scene.heading || ''}
            startFrame={0}
            endFrame={duration}
            {...syncProps}
          />
        )}
        {isFullWidthScene && scene.type === 'diagram' && (
          <DiagramSlide
            svgContent={scene.content}
            title={scene.heading || ''}
            startFrame={0}
            {...syncProps}
          />
        )}
      </div>

      {/* ── BOTTOM HALF: Visualization (40% of 1920 = 768px) ── */}
      <div style={{
        position: 'absolute',
        top: HEADER_HEIGHT + 768,
        left: 0,
        right: 0,
        height: 768,
        overflow: 'hidden',
        borderTop: '1px solid rgba(232,93,38,0.2)',
      }}>
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

// ── Outro Sub-Component (Viral: Cliffhanger → CTA → Seamless Loop) ──────────

const OutroSequence: React.FC<{
  fps: number;
  topic: string;
  hookText: string; // For seamless loop callback
}> = ({ fps, topic, hookText }) => {
  const frame = useCurrentFrame();

  // Phase 1 (0-30 frames / 0-1s): Cliffhanger — creates open loop
  const cliffOpacity = interpolate(frame, [0, 8, 25, 30], [0, 1, 1, 0], {
    extrapolateRight: 'clamp',
  });

  // Phase 2 (25-70 frames / 0.8-2.3s): Quick CTA
  const ctaSpring = spring({
    frame: Math.max(0, frame - 25),
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.7 },
  });

  // Phase 3 (70-90 frames / 2.3-3s): Loop callback — fades into hook text
  const loopOpacity = interpolate(frame, [70, 80, 90], [0, 0.8, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: `radial-gradient(ellipse at center, rgba(232,93,38,0.06) 0%, ${COLORS.dark} 70%)`,
    }}>
      {/* Phase 1: Cliffhanger — open loop keeps viewers watching */}
      {frame < 35 && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 48,
          opacity: cliffOpacity,
        }}>
          <div style={{
            fontSize: 36,
            fontWeight: 900,
            color: '#FFFFFF',
            textAlign: 'center',
            lineHeight: 1.3,
            fontFamily: FONTS.heading,
            textShadow: '0 0 20px rgba(232,93,38,0.5)',
          }}>
            But there's ONE thing{'\n'}most people miss...
          </div>
        </div>
      )}

      {/* Phase 2: Quick CTA — brand + link + value */}
      {frame >= 25 && frame < 75 && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 48,
          opacity: interpolate(ctaSpring, [0, 1], [0, 1]),
        }}>
          <div style={{
            fontSize: 32,
            fontWeight: 800,
            color: COLORS.saffron,
            fontFamily: FONTS.heading,
            letterSpacing: '0.06em',
            marginBottom: 16,
          }}>
            GURU SISHYA
          </div>
          <div style={{
            fontSize: 20,
            color: '#FFF',
            fontFamily: FONTS.text,
            fontWeight: 600,
            marginBottom: 12,
          }}>
            Full video → guru-sishya.in
          </div>
          <div style={{
            fontSize: 22,
            fontWeight: 700,
            color: '#20C997',
            background: 'rgba(32,201,151,0.12)',
            padding: '10px 28px',
            borderRadius: 28,
            border: '2px solid #20C997',
            fontFamily: FONTS.heading,
          }}>
            1,988 FREE Questions
          </div>
        </div>
      )}

      {/* Phase 3: Loop callback — repeats the hook text to trigger seamless loop */}
      {frame >= 70 && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 40px',
          opacity: loopOpacity,
          background: `radial-gradient(ellipse at center, rgba(232,93,38,0.12) 0%, ${COLORS.dark} 70%)`,
        }}>
          <div style={{
            fontSize: 44,
            fontWeight: 900,
            color: '#FFFFFF',
            textAlign: 'center',
            lineHeight: 1.2,
            fontFamily: FONTS.heading,
            textShadow: '0 0 30px rgba(232,93,38,0.4)',
          }}>
            {hookText}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export default ShortVideo;
