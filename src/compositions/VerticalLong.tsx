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
import { BgmLayer } from '../components/BgmLayer';
import { SfxLayer } from '../components/SfxLayer';
import { INTRO_DURATION, OUTRO_DURATION } from '../lib/constants';
import { REGIONS, VERTICAL_SIZES, SAFE_ZONE } from '../lib/vertical-layouts';
import { selectBestHook } from '../lib/hook-formulas';
import { getStyleForFormat, getTransitionDuration } from '../lib/video-styles';
import { VerticalCaptionOverlay } from '../components/vertical/VerticalCaptionOverlay';

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

// ── Subtle vertical background ─────────────────────────────────────────────────
const VerticalBg: React.FC = () => (
  <div style={{ position: 'absolute', inset: 0 }}>
    <div style={{
      position: 'absolute',
      inset: 0,
      backgroundImage: `
        linear-gradient(${COLORS.saffron}04 1px, transparent 1px),
        linear-gradient(90deg, ${COLORS.saffron}04 1px, transparent 1px)
      `,
      backgroundSize: '54px 54px',
    }} />
    <div style={{
      position: 'absolute',
      inset: 0,
      background: `radial-gradient(ellipse at 50% 30%, ${COLORS.saffron}06 0%, transparent 55%)`,
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
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
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
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
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

// ── Vertical code scene ────────────────────────────────────────────────────────
const VerticalCodeScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const codeLines = (scene.content || '').split('\n').slice(0, CODE_LIMITS_MAX_LINES);
  const activeLineIdx = Math.min(codeLines.length - 1, Math.floor(frame / 8));

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      <VerticalBg />
      <SceneHeading heading={scene.heading || ''} />
      <div style={{
        position: 'absolute',
        top: REGIONS.mainContent.y + 80,
        left: SAFE_ZONE.left - 20,
        right: SAFE_ZONE.right - 20,
        bottom: HEIGHT - (REGIONS.captionZone.y - 20),
        backgroundColor: '#1E1E2E',
        borderRadius: 16,
        padding: '20px 18px',
        overflow: 'hidden',
        borderTop: `3px solid ${COLORS.saffron}44`,
      }}>
        {codeLines.map((line, i) => {
          const lineOpacity = interpolate(
            frame - i * 5,
            [0, 10],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );
          const isActive = i === activeLineIdx;
          return (
            <div key={i} style={{
              fontSize: CODE_FONT_SIZE,
              fontFamily: FONTS.code,
              color: isActive ? COLORS.white : `${COLORS.white}BB`,
              lineHeight: 1.6,
              whiteSpace: 'pre',
              opacity: lineOpacity,
              borderLeft: isActive ? `3px solid ${COLORS.saffron}` : '3px solid transparent',
              paddingLeft: 10,
              backgroundColor: isActive ? `${COLORS.saffron}12` : 'transparent',
            }}>
              {line || ' '}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// Max lines and font size for code — sourced from CODE_LIMITS in vertical-layouts
const CODE_LIMITS_MAX_LINES = 18;
const CODE_FONT_SIZE = VERTICAL_SIZES.code;

// ── Vertical text scene ────────────────────────────────────────────────────────
const VerticalTextScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bullets = scene.bullets && scene.bullets.length > 0
    ? scene.bullets
    : scene.content
      ? scene.content.split(/\n+/).filter(Boolean)
      : [];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      <VerticalBg />
      <SceneHeading heading={scene.heading || ''} />
      <div style={{
        position: 'absolute',
        top: REGIONS.mainContent.y + 90,
        left: SAFE_ZONE.left,
        right: SAFE_ZONE.right,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        {bullets.slice(0, 6).map((bullet, idx) => {
          const bulletSpring = spring({
            frame: Math.max(0, frame - idx * 20),
            fps,
            config: { damping: 12, stiffness: 160, mass: 0.5 },
          });
          return (
            <div key={idx} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
              opacity: interpolate(bulletSpring, [0, 1], [0, 1]),
              transform: `translateX(${interpolate(bulletSpring, [0, 1], [32, 0])}px)`,
            }}>
              <div style={{
                width: 4,
                minHeight: 32,
                borderRadius: 2,
                backgroundColor: idx === 0 ? COLORS.saffron : idx === 1 ? COLORS.gold : COLORS.teal,
                marginTop: 6,
                flexShrink: 0,
              }} />
              <span style={{
                fontFamily: FONTS.text,
                fontSize: VERTICAL_SIZES.bullet,
                fontWeight: idx === 0 ? 700 : 500,
                color: idx === 0 ? COLORS.white : `${COLORS.white}DD`,
                lineHeight: 1.5,
              }}>
                {typeof bullet === 'string' ? bullet.trim() : ''}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ── Vertical interview/review scene ───────────────────────────────────────────
const VerticalInterviewScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardSpring = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 140, mass: 0.7 },
  });

  const isReview = scene.type === 'review';
  const bullets = scene.bullets && scene.bullets.length > 0
    ? scene.bullets
    : [];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      <VerticalBg />

      {/* Question card */}
      <div style={{
        position: 'absolute',
        top: REGIONS.mainContent.y,
        left: SAFE_ZONE.left,
        right: SAFE_ZONE.right,
        backgroundColor: isReview ? `${COLORS.saffron}12` : `${COLORS.teal}10`,
        border: `1.5px solid ${isReview ? COLORS.saffron : COLORS.teal}44`,
        borderRadius: 20,
        padding: '32px 28px',
        opacity: interpolate(cardSpring, [0, 1], [0, 1]),
        transform: `scale(${interpolate(cardSpring, [0, 1], [0.92, 1])})`,
      }}>
        <div style={{
          fontFamily: FONTS.heading,
          fontSize: VERTICAL_SIZES.bodySmall,
          fontWeight: 800,
          color: isReview ? COLORS.saffron : COLORS.teal,
          marginBottom: 12,
          textTransform: 'uppercase' as const,
          letterSpacing: 1,
        }}>
          {isReview ? '🎯 Quiz Time' : '💼 Interview Tip'}
        </div>
        <div style={{
          fontFamily: FONTS.text,
          fontSize: VERTICAL_SIZES.body,
          fontWeight: 700,
          color: COLORS.white,
          lineHeight: 1.4,
        }}>
          {scene.heading || scene.content || ''}
        </div>
      </div>

      {/* Bullets / answer */}
      {bullets.length > 0 && (
        <div style={{
          position: 'absolute',
          top: REGIONS.mainContent.y + 260,
          left: SAFE_ZONE.left,
          right: SAFE_ZONE.right,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          {bullets.slice(0, 4).map((bullet, idx) => {
            const bSpring = spring({
              frame: Math.max(0, frame - 20 - idx * 18),
              fps,
              config: { damping: 12, stiffness: 150, mass: 0.5 },
            });
            return (
              <div key={idx} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                opacity: interpolate(bSpring, [0, 1], [0, 1]),
                transform: `translateX(${interpolate(bSpring, [0, 1], [28, 0])}px)`,
              }}>
                <div style={{
                  fontFamily: FONTS.heading,
                  fontSize: VERTICAL_SIZES.bodySmall,
                  fontWeight: 800,
                  color: COLORS.gold,
                  minWidth: 28,
                }}>
                  {idx + 1}.
                </div>
                <span style={{
                  fontFamily: FONTS.text,
                  fontSize: VERTICAL_SIZES.bullet,
                  fontWeight: 500,
                  color: `${COLORS.white}EE`,
                  lineHeight: 1.45,
                }}>
                  {typeof bullet === 'string' ? bullet.trim() : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};

// ── Vertical summary scene ─────────────────────────────────────────────────────
const VerticalSummaryScene: React.FC<{ scene: Scene; topic: string }> = ({ scene, topic }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const takeaways = scene.bullets && scene.bullets.length > 0
    ? scene.bullets
    : scene.content
      ? scene.content.split(/\n+/).filter(Boolean)
      : [];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      <VerticalBg />

      <div style={{
        position: 'absolute',
        top: REGIONS.mainContent.y,
        left: SAFE_ZONE.left,
        right: SAFE_ZONE.right,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{
          fontFamily: FONTS.heading,
          fontSize: VERTICAL_SIZES.heading2,
          fontWeight: 900,
          color: COLORS.gold,
          marginBottom: 20,
        }}>
          Key Takeaways
        </div>

        {takeaways.slice(0, 5).map((item, idx) => {
          const s = spring({
            frame: Math.max(0, frame - idx * 18),
            fps,
            config: { damping: 12, stiffness: 140, mass: 0.6 },
          });
          return (
            <div key={idx} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
              paddingTop: 14,
              paddingBottom: 14,
              paddingLeft: 16,
              paddingRight: 16,
              borderRadius: 12,
              backgroundColor: `${COLORS.saffron}0D`,
              borderLeft: `4px solid ${COLORS.saffron}`,
              opacity: interpolate(s, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(s, [0, 1], [20, 0])}px)`,
            }}>
              <div style={{
                fontFamily: FONTS.heading,
                fontSize: VERTICAL_SIZES.bodySmall,
                fontWeight: 800,
                color: COLORS.saffron,
                minWidth: 24,
              }}>
                ✓
              </div>
              <span style={{
                fontFamily: FONTS.text,
                fontSize: VERTICAL_SIZES.bullet,
                fontWeight: 500,
                color: `${COLORS.white}EE`,
                lineHeight: 1.45,
              }}>
                {typeof item === 'string' ? item.trim() : ''}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ── Generic fallback scene ─────────────────────────────────────────────────────
const VerticalGenericScene: React.FC<{ scene: Scene }> = ({ scene }) => (
  <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
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

// ── Scene renderer dispatch ────────────────────────────────────────────────────
const VerticalSceneContent: React.FC<{ scene: Scene; topic: string }> = ({ scene, topic }) => {
  switch (scene.type) {
    case 'code':
      return <VerticalCodeScene scene={scene} />;
    case 'text':
    case 'diagram':
    case 'table':
      return <VerticalTextScene scene={scene} />;
    case 'interview':
    case 'review':
      return <VerticalInterviewScene scene={scene} />;
    case 'summary':
      return <VerticalSummaryScene scene={scene} topic={topic} />;
    default:
      return <VerticalGenericScene scene={scene} />;
  }
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
    <AbsoluteFill style={{ backgroundColor: COLORS.dark, width: WIDTH, height: HEIGHT }}>

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
                    <VerticalSceneContent scene={scene} topic={storyboard.topic} />
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
