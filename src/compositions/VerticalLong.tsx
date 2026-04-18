import React from 'react';
import { useCurrentFrame, useVideoConfig, AbsoluteFill, Sequence, Audio, staticFile, interpolate, spring } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import type { TransitionPresentation } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { Storyboard, Scene } from '../types';
import { COLORS, FONTS } from '../lib/theme';
import { SyncTimeline } from '../lib/sync-engine';
import { setSyncTimeline } from '../hooks/useSync';
import { AvatarBubble } from '../components/AvatarBubble';
import { BgmLayer } from '../components/BgmLayer';
import { SfxLayer } from '../components/SfxLayer';
import { INTRO_DURATION, OUTRO_DURATION } from '../lib/constants';
import { REGIONS, VERTICAL_SIZES, SAFE_ZONE } from '../lib/vertical-layouts';
import { selectBestHook } from '../lib/hook-formulas';
import { getStyleForFormat, getTransitionDuration } from '../lib/video-styles';
import { VerticalCaptionOverlay } from '../components/vertical/VerticalCaptionOverlay';
import {
  TitleSlide,
  TextSection,
  DiagramSlide,
  ComparisonTable,
  InterviewInsight,
  ReviewQuestion,
  SummarySlide,
} from '../components';
import { IDEScene } from '../components/scenes/IDEScene';

// ── Dimensions ─────────────────────────────────────────────────────────────────
const WIDTH = 1080;
const HEIGHT = 1920;

// ── Props ──────────────────────────────────────────────────────────────────────
interface VerticalLongProps {
  storyboard: Storyboard;
}

// ── Transition pool (vertical-friendly) ───────────────────────────────────────
type TransitionFactory = () => TransitionPresentation<Record<string, unknown>>;

const TRANSITION_POOL: TransitionFactory[] = [
  () => fade() as TransitionPresentation<Record<string, unknown>>,
  () => slide({ direction: 'from-bottom' }) as TransitionPresentation<Record<string, unknown>>,
  () => wipe({ direction: 'from-left' }) as TransitionPresentation<Record<string, unknown>>,
  () => slide({ direction: 'from-right' }) as TransitionPresentation<Record<string, unknown>>,
  () => fade() as TransitionPresentation<Record<string, unknown>>,
  () => slide({ direction: 'from-top' }) as TransitionPresentation<Record<string, unknown>>,
  () => wipe({ direction: 'from-right' }) as TransitionPresentation<Record<string, unknown>>,
  () => slide({ direction: 'from-left' }) as TransitionPresentation<Record<string, unknown>>,
];

function getTransitionForScene(sceneIndex: number): TransitionPresentation<Record<string, unknown>> {
  return TRANSITION_POOL[sceneIndex % TRANSITION_POOL.length]();
}

// ── Subtle vertical background (dark-mode optimised) ──────────────────────────
const VerticalBg: React.FC = () => (
  <div style={{ position: 'absolute', inset: 0 }}>
    {/* Very subtle grid — visible on dark bg */}
    <div style={{
      position: 'absolute',
      inset: 0,
      backgroundImage: `
        linear-gradient(${COLORS.saffron}08 1px, transparent 1px),
        linear-gradient(90deg, ${COLORS.saffron}08 1px, transparent 1px)
      `,
      backgroundSize: '54px 54px',
    }} />
    {/* Subtle saffron glow from top-center */}
    <div style={{
      position: 'absolute',
      inset: 0,
      background: `radial-gradient(ellipse at 50% 20%, ${COLORS.saffron}12 0%, transparent 55%)`,
    }} />
  </div>
);

// ── Vertical Intro Screen ──────────────────────────────────────────────────────
const VerticalIntro: React.FC<{
  topic: string;
  sessionNumber: number;
  hookText: string;
  durationInFrames: number;
}> = ({ topic, sessionNumber, hookText, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const s = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 180, mass: 0.5 },
  });
  const scaleIn = interpolate(s, [0, 1], [0.75, 1]);
  const opacityIn = interpolate(s, [0, 1], [0, 1]);

  // Fade out last 15 frames
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const springBadge = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.4 },
  });
  const badgeOpacity = interpolate(springBadge, [0, 1], [0, 1]);
  const badgeY = interpolate(springBadge, [0, 1], [20, 0]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0C0A15' }}>
      <VerticalBg />

      {/* Session badge */}
      <div style={{
        position: 'absolute',
        top: REGIONS.header.y + 16,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity: badgeOpacity,
        transform: `translateY(${badgeY}px)`,
      }}>
        <div style={{
          backgroundColor: `${COLORS.saffron}22`,
          border: `1.5px solid ${COLORS.saffron}`,
          borderRadius: 40,
          paddingTop: 10,
          paddingBottom: 10,
          paddingLeft: 28,
          paddingRight: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: COLORS.saffron,
          }} />
          <span style={{
            fontFamily: FONTS.heading,
            fontSize: VERTICAL_SIZES.bodySmall,
            fontWeight: 700,
            color: COLORS.saffron,
            letterSpacing: 2,
            textTransform: 'uppercase' as const,
          }}>
            {topic} · Session {sessionNumber}
          </span>
        </div>
      </div>

      {/* Hook text — big, bold, centered */}
      <div style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: SAFE_ZONE.left,
        right: SAFE_ZONE.right,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: opacityIn * fadeOut,
        transform: `scale(${scaleIn})`,
        gap: 24,
      }}>
        <div style={{
          fontSize: VERTICAL_SIZES.heading1,
          fontFamily: FONTS.heading,
          fontWeight: 900,
          color: COLORS.white,
          textAlign: 'center',
          lineHeight: 1.2,
          textShadow: '0 4px 24px rgba(0,0,0,0.8)',
        }}>
          {hookText}
        </div>

        {/* Accent line */}
        <div style={{
          width: 80,
          height: 4,
          borderRadius: 2,
          background: `linear-gradient(90deg, ${COLORS.saffron}, ${COLORS.gold})`,
        }} />

        <div style={{
          fontSize: VERTICAL_SIZES.bodySmall,
          fontFamily: FONTS.text,
          fontWeight: 500,
          color: `${COLORS.white}99`,
          textAlign: 'center',
          letterSpacing: 0.5,
        }}>
          guru-sishya.in
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Vertical Outro Screen ──────────────────────────────────────────────────────
const VerticalOutro: React.FC<{
  topic: string;
  nextTopic?: string;
  durationInFrames: number;
}> = ({ topic, nextTopic, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const s = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 150, mass: 0.6 },
  });
  const scale = interpolate(s, [0, 1], [0.7, 1]);
  const opacity = interpolate(s, [0, 1], [0, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0C0A15' }}>
      <VerticalBg />
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        opacity,
        transform: `scale(${scale})`,
        padding: '0 60px',
      }}>
        <div style={{
          fontFamily: FONTS.heading,
          fontSize: VERTICAL_SIZES.heading2,
          fontWeight: 900,
          color: COLORS.white,
          textAlign: 'center',
          lineHeight: 1.2,
        }}>
          Mastering {topic}?
        </div>
        <div style={{
          fontFamily: FONTS.text,
          fontSize: VERTICAL_SIZES.body,
          fontWeight: 500,
          color: `${COLORS.white}CC`,
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          Practice 5,800+ interview questions at
        </div>
        <div style={{
          fontFamily: FONTS.heading,
          fontSize: VERTICAL_SIZES.heading3,
          fontWeight: 800,
          color: COLORS.gold,
        }}>
          guru-sishya.in
        </div>
        {nextTopic && (
          <div style={{
            marginTop: 20,
            fontFamily: FONTS.text,
            fontSize: VERTICAL_SIZES.bodySmall,
            fontWeight: 500,
            color: COLORS.teal,
            textAlign: 'center',
          }}>
            Next: {nextTopic} →
          </div>
        )}
        <div style={{
          marginTop: 8,
          fontFamily: FONTS.heading,
          fontSize: VERTICAL_SIZES.body,
          fontWeight: 700,
          color: COLORS.saffron,
        }}>
          Follow @guru_sishya.in
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Progress Bar (thin, top or bottom of content area) ────────────────────────
const VerticalProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <div style={{
    position: 'absolute',
    top: REGIONS.bottomBar.y,
    left: SAFE_ZONE.left,
    right: SAFE_ZONE.right,
    height: 6,
    borderRadius: 3,
    backgroundColor: `${COLORS.white}18`,
  }}>
    <div style={{
      height: '100%',
      width: `${Math.min(100, Math.max(0, progress * 100))}%`,
      borderRadius: 3,
      background: `linear-gradient(90deg, ${COLORS.saffron}, ${COLORS.gold})`,
    }} />
  </div>
);

// ── Topic Header (top strip) ───────────────────────────────────────────────────
const VerticalTopicHeader: React.FC<{ topic: string; sessionNumber: number }> = ({ topic, sessionNumber }) => (
  <div style={{
    position: 'absolute',
    top: REGIONS.header.y,
    left: SAFE_ZONE.left,
    right: SAFE_ZONE.right,
    height: REGIONS.header.height,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }}>
    <span style={{
      fontFamily: FONTS.heading,
      fontSize: VERTICAL_SIZES.bodySmall,
      fontWeight: 800,
      color: COLORS.saffron,
      letterSpacing: 1,
      textTransform: 'uppercase' as const,
    }}>
      {topic}
    </span>
    <span style={{
      fontFamily: FONTS.code,
      fontSize: VERTICAL_SIZES.bodySmall,
      fontWeight: 600,
      color: `${COLORS.white}66`,
    }}>
      S{sessionNumber}
    </span>
  </div>
);

// ── Scene heading ──────────────────────────────────────────────────────────────
const SceneHeading: React.FC<{ heading: string }> = ({ heading }) => {
  if (!heading) return null;
  return (
    <div style={{
      position: 'absolute',
      top: REGIONS.mainContent.y,
      left: SAFE_ZONE.left,
      right: SAFE_ZONE.right,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
    }}>
      <div style={{
        width: 5,
        height: 36,
        borderRadius: 3,
        backgroundColor: COLORS.saffron,
        flexShrink: 0,
      }} />
      <div style={{
        fontFamily: FONTS.heading,
        fontSize: VERTICAL_SIZES.heading3,
        fontWeight: 800,
        color: COLORS.gold,
        textTransform: 'uppercase' as const,
        letterSpacing: 1.5,
        lineHeight: 1.25,
      }}>
        {heading}
      </div>
    </div>
  );
};

// ── Scale constants: fit 1920×1080 components into full 1080px vertical width ─
const CONTENT_SCALE = 1080 / 1920; // 0.5625 — fills full width
const ACCENT_COLORS = ['#2563EB', '#059669', '#D97706', '#7C3AED'];

// ── Scene component map (same as LongVideo) ────────────────────────────────────
const SCENE_COMPONENT_MAP: Record<string, React.FC<any>> = {
  title: TitleSlide,
  code: IDEScene,
  text: TextSection,
  diagram: DiagramSlide,
  table: ComparisonTable,
  interview: InterviewInsight,
  review: ReviewQuestion,
  summary: SummarySlide,
};

// ── Helper: extract a clean answer from narration (same logic as LongVideo) ───
function extractAnswerFromNarration(narration: string, question: string): string {
  const introPatterns = [
    /^okay,?\s*pop\s*quiz\s*time\.?\s*/i,
    /^alright,?\s*let'?s\s*test\s*if\s*you\s*were\s*really\s*paying\s*attention\.?\s*/i,
    /^now\s*i\s*want\s*you\s*to\s*pause.*?seconds?\s*and\s*think\s*about\s*this\.?\s*seriously\.?\s*pausing\s*and\s*thinking\s*is\s*how\s*you\s*actually\s*learn\.?\s*/i,
    /^here'?s\s*a\s*question\s*that\s*trips\s*up\s*even\s*experienced\s*developers\.?\s*see\s*if\s*you\s*can\s*get\s*it\s*right\.?\s*/i,
    /^before\s*we\s*wrap\s*up,?\s*let\s*me\s*challenge\s*you\s*with\s*this\.?\s*if\s*you\s*can\s*answer\s*it.*?\.?\s*/i,
    /^don'?t\s*scroll\s*ahead\.?\s*think\s*about\s*this.*?\.?\s*/i,
    /^time\s*to\s*test\s*yourself\.?\s*/i,
  ];
  let cleaned = narration;
  for (const pattern of introPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  const ctaPatterns = [
    /\s*you\s*can\s*practice\s*more\s*questions?\s*like\s*this.*$/i,
    /\s*head\s*over\s*to\s*guru-sishya\.in.*$/i,
    /\s*practice\s*this\s*on\s*guru-sishya\.in.*$/i,
  ];
  for (const pattern of ctaPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  if (question && cleaned.includes(question)) {
    cleaned = cleaned.replace(question, '').trim();
  }
  cleaned = cleaned.trim();
  if (cleaned.length < 10) {
    return 'Consider the core concepts, trade-offs, and real-world applications.';
  }
  return cleaned;
}

// ── Build props for each scene type (same logic as LongVideo.getSceneProps) ───
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
        filename: scene.heading || `main.${(scene.language || 'ts').replace('typescript', 'ts').replace('javascript', 'js').replace('python', 'py')}`,
        highlightLines: scene.highlightLines,
        startFrame: 0,
        sceneDurationFrames: scene.endFrame - scene.startFrame,
      };
    case 'text':
      return {
        heading: scene.heading || '',
        bullets: scene.bullets || [scene.content],
        content: scene.content || '',
        narration: scene.narration || '',
        startFrame: 0,
        endFrame: scene.endFrame - scene.startFrame,
        visualBeats: scene.visualBeats,
        templateId: scene.templateId,
        templateVariant: scene.templateVariant,
        accentColor: ACCENT_COLORS[storyboard.sessionNumber % 4],
        topic: storyboard.topic,
        d2Svg: scene.d2Svg,
      };
    case 'diagram':
      return {
        svgContent: scene.content,
        title: scene.heading || '',
        startFrame: 0,
      };
    case 'table': {
      const lines = scene.content.split('\n').filter(l => l.includes('|'));
      const parsed = lines
        .map(l => l.split('|').map(c => c.trim()).filter(Boolean))
        .filter(cells => !cells.every(c => /^[-:]+$/.test(c)));
      const headers = parsed[0] || [];
      const rows = parsed.slice(1) || [];
      return {
        headers,
        rows,
        title: scene.heading || '',
        startFrame: 0,
        endFrame: scene.endFrame - scene.startFrame,
      };
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
        answer: scene.heading || extractAnswerFromNarration(scene.narration || '', scene.content),
        startFrame: 0,
        endFrame: scene.endFrame - scene.startFrame,
        quizOptions: scene.quizOptions,
      };
    case 'summary':
      return {
        takeaways: scene.bullets || [scene.content],
        topic: storyboard.topic,
        sessionNumber: storyboard.sessionNumber,
        startFrame: 0,
        templateId: scene.templateId,
        visualBeats: scene.visualBeats,
      };
    default:
      return {};
  }
}

// ── Vertical scene wrapper: scales rich 1920×1080 component to fill full 1080px width ─
const VerticalSceneContent: React.FC<{ scene: Scene; storyboard: Storyboard }> = ({ scene, storyboard }) => {
  const Component = SCENE_COMPONENT_MAP[scene.type];
  const sceneProps = getSceneProps(scene, storyboard);

  if (!Component) {
    // Minimal fallback for unknown scene types
    return (
      <AbsoluteFill style={{ backgroundColor: '#0C0A15' }}>
        <VerticalBg />
        <SceneHeading heading={scene.heading || ''} />
        <div style={{
          position: 'absolute',
          top: REGIONS.mainContent.y + 90,
          left: SAFE_ZONE.left,
          right: SAFE_ZONE.right,
        }}>
          <div style={{
            fontFamily: FONTS.text,
            fontSize: VERTICAL_SIZES.body,
            fontWeight: 500,
            color: COLORS.white,
            lineHeight: 1.6,
          }}>
            {scene.content || ''}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#0C0A15' }}>
      <VerticalBg />

      {/* Scaled content area: full 1080px width, centered vertically in tall content region */}
      <div style={{
        position: 'absolute',
        top: REGIONS.mainContent.y,
        left: 0,
        width: 1080,
        height: REGIONS.mainContent.height,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: 1920,
          height: 1080,
          transform: `scale(${CONTENT_SCALE})`,
          transformOrigin: 'center center',
          flexShrink: 0,
        }}>
          <Component {...sceneProps} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Active scene detection (same logic as LongVideo) ──────────────────────────
function getActiveSceneByAudioTime(
  scenes: Scene[],
  audioTimeSeconds: number,
  sceneOffsets: number[],
): Scene | null {
  if (audioTimeSeconds < 0) return null;
  for (let i = scenes.length - 1; i >= 0; i--) {
    const offset = sceneOffsets[i] ?? scenes[i].audioOffsetSeconds ?? -1;
    if (offset === -1) continue;
    if (audioTimeSeconds >= offset) {
      return scenes[i];
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPOSITION
// ═══════════════════════════════════════════════════════════════════════════════
export const VerticalLong: React.FC<VerticalLongProps> = ({ storyboard }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const contentFrames = storyboard.durationInFrames;
  const totalFrames = INTRO_DURATION + contentFrames + OUTRO_DURATION;
  const style = getStyleForFormat('vertical');

  // Content scenes (exclude title + summary wrapper scenes)
  const contentScenes = storyboard.scenes.slice(1, storyboard.scenes.length - 1);

  // Build SyncTimeline — same pattern as LongVideo
  const syncTimeline = React.useMemo(() => {
    const offsets = storyboard.sceneOffsets || [];
    const timestamps = contentScenes.map(s => s.wordTimestamps || []);
    return new SyncTimeline(offsets, timestamps, fps, INTRO_DURATION);
  }, [storyboard, fps]);

  // Set synchronously during render (no useEffect — see LongVideo comment)
  setSyncTimeline(syncTimeline);

  // Active scene for captions — use audio timing, not visual frame
  const audioTimeSeconds = (frame - INTRO_DURATION) / fps;
  const activeScene = getActiveSceneByAudioTime(
    contentScenes,
    audioTimeSeconds,
    storyboard.sceneOffsets || [],
  );
  const hasNarration = !!(activeScene && activeScene.narration && activeScene.narration.trim() !== '');

  // Progress (based on content only)
  const contentProgress = contentFrames > 0
    ? Math.min(1, Math.max(0, (frame - INTRO_DURATION) / contentFrames))
    : 0;

  const isIntro = frame < INTRO_DURATION;
  const isOutro = frame >= INTRO_DURATION + contentFrames;

  // Hook text for intro
  const hookText = React.useMemo(
    () => selectBestHook(storyboard.topic, storyboard.sessionNumber),
    [storyboard.topic, storyboard.sessionNumber],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#0C0A15', width: WIDTH, height: HEIGHT }}>

      {/* ── Intro ── */}
      <Sequence from={0} durationInFrames={INTRO_DURATION}>
        <VerticalIntro
          topic={storyboard.topic}
          sessionNumber={storyboard.sessionNumber}
          hookText={hookText}
          durationInFrames={INTRO_DURATION}
        />
      </Sequence>

      {/* ── Content scenes via TransitionSeries ── */}
      <Sequence from={INTRO_DURATION} durationInFrames={contentFrames}>
        <TransitionSeries>
          {contentScenes.map((scene, idx) => {
            const duration = scene.endFrame - scene.startFrame;
            const isFirst = idx === 0;

            return (
              <React.Fragment key={idx}>
                {!isFirst && (
                  <TransitionSeries.Transition
                    presentation={getTransitionForScene(idx)}
                    timing={linearTiming({
                      durationInFrames: getTransitionDuration(
                        idx > 0 ? contentScenes[idx - 1].type : 'title',
                        scene.type,
                        style,
                      ),
                    })}
                  />
                )}
                <TransitionSeries.Sequence durationInFrames={duration}>
                  <AbsoluteFill>
                    <VerticalSceneContent scene={scene} storyboard={storyboard} />
                  </AbsoluteFill>
                </TransitionSeries.Sequence>
              </React.Fragment>
            );
          })}
        </TransitionSeries>
      </Sequence>

      {/* ── Outro ── */}
      <Sequence from={INTRO_DURATION + contentFrames} durationInFrames={OUTRO_DURATION}>
        <VerticalOutro
          topic={storyboard.topic}
          nextTopic={storyboard.nextTopic}
          durationInFrames={OUTRO_DURATION}
        />
      </Sequence>

      {/* ── Persistent overlays (content phase only) ── */}
      {!isIntro && !isOutro && (
        <>
          <VerticalTopicHeader
            topic={storyboard.topic}
            sessionNumber={storyboard.sessionNumber}
          />
          <VerticalProgressBar progress={contentProgress} />

          {/* Avatar bubble — bottom-right, between content and captions */}
          <div style={{
            position: 'absolute',
            bottom: 420,
            right: 30,
            zIndex: 90,
          }}>
            <AvatarBubble
              mouthCues={storyboard.mouthCues}
              startFrame={0}
              endFrame={INTRO_DURATION + contentFrames}
            />
          </div>
        </>
      )}

      {/* ── Vertical caption overlay ── */}
      {!isIntro && !isOutro && hasNarration && activeScene && (
        <VerticalCaptionOverlay
          key={`vcaption-${activeScene.audioOffsetSeconds ?? activeScene.startFrame}`}
          text={activeScene.narration!}
          startFrame={
            activeScene.audioOffsetSeconds != null && activeScene.audioOffsetSeconds >= 0
              ? INTRO_DURATION + Math.round(activeScene.audioOffsetSeconds * fps)
              : INTRO_DURATION + activeScene.startFrame
          }
          durationInFrames={activeScene.endFrame - activeScene.startFrame}
          wordTimestamps={activeScene.wordTimestamps}
          captionMode={style.captionMode}
        />
      )}

      {/* ── Master narration audio ── */}
      {storyboard.audioFile && (
        <Sequence from={INTRO_DURATION}>
          <Audio
            src={staticFile(`audio/${storyboard.audioFile.split('/').pop()}`)}
            volume={(f) => {
              const baseVolume = 1.0;
              const fadeIn = interpolate(f, [0, 9], [0, 1], { extrapolateRight: 'clamp' });
              const totalAudioFrames = storyboard.durationInFrames - INTRO_DURATION - OUTRO_DURATION;
              const fadeOut = interpolate(
                f,
                [totalAudioFrames - 9, totalAudioFrames],
                [1, 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );
              return baseVolume * fadeIn * fadeOut;
            }}
          />
        </Sequence>
      )}

      {/* ── BGM with sidechain ducking ── */}
      {storyboard.bgmFile && syncTimeline && (
        <BgmLayer
          syncTimeline={syncTimeline}
          bgmFile={storyboard.bgmFile}
          baseVolume={style.bgmVolume}
          trackChangeInterval={style.bgmChangeInterval}
        />
      )}

      {/* ── SFX triggers ── */}
      {syncTimeline && storyboard.allSfxTriggers && storyboard.allSfxTriggers.length > 0 && (
        <SfxLayer triggers={storyboard.allSfxTriggers} syncTimeline={syncTimeline} />
      )}

    </AbsoluteFill>
  );
};

// ── calculateMetadata for registration ────────────────────────────────────────
export function calculateVerticalLongMetadata({
  props,
}: {
  props: Record<string, unknown>;
}) {
  const sb = props.storyboard as Storyboard;
  const contentFrames = sb?.durationInFrames || 9000;
  return {
    durationInFrames: contentFrames + INTRO_DURATION + OUTRO_DURATION,
    fps: 30,
    width: WIDTH,
    height: HEIGHT,
  };
}

export default VerticalLong;
