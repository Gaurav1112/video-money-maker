import React from 'react';
import { useCurrentFrame, useVideoConfig, AbsoluteFill, Sequence, Audio, staticFile, interpolate } from 'remotion';
import { TransitionSeries, linearTiming, TransitionPresentation } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { Storyboard, Scene } from '../types';
import { COLORS } from '../lib/theme';
import { SyncTimeline } from '../lib/sync-engine';
import { setSyncTimeline } from '../hooks/useSync';
import { BgmLayer } from '../components/BgmLayer';
import { SfxLayer } from '../components/SfxLayer';
import { SplitLayout } from '../components/SplitLayout';
import { ConceptViz } from '../components/ConceptViz';
import { INTRO_DURATION, OUTRO_DURATION, TRANSITION_DURATION } from '../lib/constants';
import { BrandingLayer } from '../components/BrandingLayer';
import { AnimatedOverlay } from '../components/AnimatedOverlay';
import {
  TitleSlide,
  CodeReveal,
  TextSection,
  DiagramSlide,
  ComparisonTable,
  InterviewInsight,
  ReviewQuestion,
  SummarySlide,
  ProgressBar,
  TopicHeader,
  BackgroundLayer,
  CaptionOverlay,
  NarratorIndicator,
  SceneTransitionFlash,
  IntroSlide,
  OutroSlide,
} from '../components';
import { SpeedReminder } from '../components/SpeedReminder';

interface LongVideoProps {
  storyboard: Storyboard;
  noOverlays?: boolean; // When true, skip CaptionOverlay, TopicHeader, BrandingLayer, ProgressBar, NarratorIndicator, SpeedReminder — for clean split-stack shorts conversion
}

const SCENE_COMPONENT_MAP: Record<string, React.FC<any>> = {
  title: TitleSlide,
  code: CodeReveal,
  text: TextSection,
  diagram: DiagramSlide,
  table: ComparisonTable,
  interview: InterviewInsight,
  review: ReviewQuestion,
  summary: SummarySlide,
};

function getTransitionForScene(sceneType: string): TransitionPresentation<Record<string, unknown>> {
  switch (sceneType) {
    case 'title':
      return fade() as TransitionPresentation<Record<string, unknown>>;
    case 'code':
      return slide({ direction: 'from-right' }) as TransitionPresentation<Record<string, unknown>>;
    case 'text':
      return fade() as TransitionPresentation<Record<string, unknown>>;
    case 'interview':
      return wipe({ direction: 'from-left' }) as TransitionPresentation<Record<string, unknown>>;
    case 'summary':
      return fade() as TransitionPresentation<Record<string, unknown>>;
    case 'diagram':
      return slide({ direction: 'from-bottom' }) as TransitionPresentation<Record<string, unknown>>;
    case 'table':
      return slide({ direction: 'from-left' }) as TransitionPresentation<Record<string, unknown>>;
    case 'review':
      return wipe({ direction: 'from-right' }) as TransitionPresentation<Record<string, unknown>>;
    default:
      return fade() as TransitionPresentation<Record<string, unknown>>;
  }
}

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
        title: scene.heading,
        highlightLines: scene.highlightLines,
        startFrame: 0,
      };
    case 'text':
      return {
        heading: scene.heading || '',
        bullets: scene.bullets || [scene.content],
        content: scene.content || '',
        narration: scene.narration || '',
        startFrame: 0,
        endFrame: scene.endFrame - scene.startFrame,
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
        // Filter out markdown separator rows (e.g. |---|---|---|)
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
        // Use heading field for clean visual answer; fall back to extracting from narration
        answer: scene.heading || extractAnswerFromNarration(scene.narration, scene.content),
        startFrame: 0,
        endFrame: scene.endFrame - scene.startFrame,
      };
    case 'summary':
      return {
        takeaways: scene.bullets || [scene.content],
        topic: storyboard.topic,
        sessionNumber: storyboard.sessionNumber,
        startFrame: 0,
      };
    default:
      return {};
  }
}

/**
 * Extract a clean answer from narration text that was meant for TTS.
 * Strips intro phrases like "Alright, let's test..." and "You can practice..."
 * and returns only the question + a concise answer summary.
 */
function extractAnswerFromNarration(narration: string, question: string): string {
  // The narration format is: "[intro phrase] [question text] [CTA text]"
  // We want to strip the intro and CTA, leaving just a clean answer.

  // Known intro patterns to strip
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

  // Strip CTA suffix patterns
  const ctaPatterns = [
    /\s*you\s*can\s*practice\s*more\s*questions?\s*like\s*this.*$/i,
    /\s*head\s*over\s*to\s*guru-sishya\.in.*$/i,
    /\s*practice\s*this\s*on\s*guru-sishya\.in.*$/i,
  ];
  for (const pattern of ctaPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // If the cleaned text still contains the question, strip it out
  if (question && cleaned.includes(question)) {
    cleaned = cleaned.replace(question, '').trim();
  }

  // If we're left with very little, return a generic prompt
  cleaned = cleaned.trim();
  if (cleaned.length < 10) {
    return 'Consider the core concepts, trade-offs, and real-world applications.';
  }

  return cleaned;
}

/**
 * Determine the active scene for caption overlay based on AUDIO timing.
 *
 * CRITICAL FIX: We must NOT use scene.startFrame/endFrame here because those
 * values are raw cumulative sums of TransitionSeries.Sequence durations.
 * TransitionSeries overlaps adjacent scenes by TRANSITION_DURATION frames at
 * each transition, so the actual visual start of scene[i] is:
 *   sum(D0..D(i-1)) - i * TRANSITION_DURATION
 * The raw startFrame drifts by +0.5s per scene (TRANSITION_DURATION/fps).
 * By scene 29, captions were 14.5 seconds out of sync with audio.
 *
 * Instead, we find the scene whose audioOffsetSeconds range covers the current
 * audio playback time. This is the ground truth — audioOffsetSeconds comes
 * directly from the stitched master audio file and never drifts.
 *
 * @param scenes - Content scenes (no intro/outro)
 * @param audioTimeSeconds - Current time in the master audio (seconds)
 * @param sceneOffsets - Per-scene audio offsets from storyboard
 */
function getActiveSceneByAudioTime(
  scenes: Scene[],
  audioTimeSeconds: number,
  sceneOffsets: number[],
): Scene | null {
  if (audioTimeSeconds < 0) return null;

  // Find the scene whose audio offset range contains the current playback time.
  // Scene i covers [sceneOffsets[i], sceneOffsets[i+1]) in the master audio.
  for (let i = scenes.length - 1; i >= 0; i--) {
    const offset = sceneOffsets[i] ?? scenes[i].audioOffsetSeconds ?? -1;
    if (offset === -1) continue;
    if (audioTimeSeconds >= offset) {
      return scenes[i];
    }
  }
  return null;
}

/**
 * Generate scene markers for the progress bar.
 */
function getSceneMarkers(scenes: Scene[], totalFrames: number) {
  return scenes.map((scene) => ({
    position: scene.startFrame / totalFrames,
    type: scene.type,
    label: scene.heading || scene.type,
  }));
}

export const LongVideo: React.FC<LongVideoProps> = ({ storyboard, noOverlays = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const contentFrames = storyboard.durationInFrames;
  const totalFrames = INTRO_DURATION + contentFrames + OUTRO_DURATION;
  const progress = frame / totalFrames;

  // Build SyncTimeline for audio/word sync across content scenes only.
  // scenes[0] = intro, scenes[last] = outro — sceneOffsets covers only content scenes.
  // Using all scenes caused an off-by-one: timestamps[0] mapped to the intro (empty),
  // not the first content scene (BUG 1).
  const contentScenes = storyboard.scenes.slice(1, storyboard.scenes.length - 1);
  const syncTimeline = React.useMemo(() => {
    const offsets = storyboard.sceneOffsets || [];
    const timestamps = contentScenes.map(s => s.wordTimestamps || []);
    return new SyncTimeline(offsets, timestamps, fps, INTRO_DURATION);
  }, [storyboard, fps]);

  // Set synchronously during render — setSyncTimeline is a simple variable assignment
  // with no side effects, so calling it during render is safe. Using useEffect caused
  // globalTimeline to be null on frame 0 (BUG 5).
  setSyncTimeline(syncTimeline);

  // Get active scene for captions — use audio timing, not visual frame position.
  // audioTimeSeconds = how far into the master audio we are right now.
  // The master Audio element starts at absolute frame INTRO_DURATION, so:
  const audioTimeSeconds = (frame - INTRO_DURATION) / fps;
  const activeScene = getActiveSceneByAudioTime(
    contentScenes,
    audioTimeSeconds,
    storyboard.sceneOffsets || [],
  );
  const hasNarration = activeScene && activeScene.narration && activeScene.narration.trim() !== '';
  const currentSceneType = activeScene?.type || 'text';

  // Scene markers for progress bar
  const sceneMarkers = getSceneMarkers(storyboard.scenes, totalFrames);

  // Whether we are in the intro or outro phase
  const isIntro = frame < INTRO_DURATION;
  const isOutro = frame >= INTRO_DURATION + contentFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      {/* Animated background layer - adapts to scene type */}
      {!isIntro && !isOutro && <BackgroundLayer sceneType={currentSceneType} />}

      {/* Animated overlay — particles, scan line, vignette, tech grid on every content frame */}
      {!isIntro && !isOutro && <AnimatedOverlay sceneType={currentSceneType} />}

      {/* Branded Intro */}
      <Sequence from={0} durationInFrames={INTRO_DURATION}>
        <IntroSlide durationInFrames={INTRO_DURATION} topic={storyboard.topic} />
      </Sequence>

      {/* Render each scene with transitions, offset by intro duration */}
      <Sequence from={INTRO_DURATION} durationInFrames={contentFrames}>
        <TransitionSeries>
          {contentScenes.map((scene, idx) => {
            const Component = SCENE_COMPONENT_MAP[scene.type];
            if (!Component) return null;

            const duration = scene.endFrame - scene.startFrame;
            const props = getSceneProps(scene, storyboard);
            const isFirst = idx === 0;
            // Absolute frame at which this scene starts (relative to the full composition)
            const sceneStartFrame = INTRO_DURATION + scene.startFrame;
            const syncProps = {
              sceneIndex: idx,
              sceneStartFrame,
              animationCues: scene.animationCues,
            };

            // FULL-WIDTH scenes: table + diagram render their own component at 100% width.
            // They contain structured data (table cells, SVG diagrams) that need all 1920px.
            const isFullWidthScene = scene.type === 'table' || scene.type === 'diagram';

            // SPLIT LAYOUT: Left 42% text panel + Right 58% full ConceptViz
            // The visualization is the STAR — it fills the right side completely
            const isSplitScene = scene.type === 'text' || scene.type === 'interview';
            const renderedScene = isFullWidthScene ? (
              <AbsoluteFill style={{ zIndex: 2 }}>
                <Component {...props} {...syncProps} />
              </AbsoluteFill>
            ) : isSplitScene ? (
              <div style={{
                display: 'flex',
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                zIndex: 2,
              }}>
                {/* LEFT PANEL — 42% — heading + bullets */}
                <div style={{
                  flex: '0 0 42%',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  padding: '40px 32px 40px 40px',
                  background: 'rgba(12, 10, 21, 0.85)',
                  borderRight: '2px solid rgba(232, 93, 38, 0.25)',
                }}>
                  {/* Heading badge */}
                  <div style={{
                    borderLeft: '5px solid #E85D26',
                    paddingLeft: 20,
                    marginBottom: 24,
                  }}>
                    <div style={{
                      fontSize: 34,
                      fontWeight: 800,
                      color: '#E85D26',
                      fontFamily: "'Inter', system-ui, sans-serif",
                      letterSpacing: '-0.02em',
                      lineHeight: 1.2,
                    }}>
                      {scene.heading || ''}
                    </div>
                  </div>
                  {/* Bullets / narration */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}>
                    {(scene.bullets && scene.bullets.length > 0)
                      ? scene.bullets.slice(0, 4).map((b, i) => (
                          <div key={i} style={{
                            fontSize: 22,
                            color: i === 0 ? '#fff' : i === 1 ? '#ddd' : '#aaa',
                            fontFamily: "'Inter', system-ui, sans-serif",
                            fontWeight: i === 0 ? 600 : 400,
                            lineHeight: 1.45,
                            paddingLeft: 16,
                            borderLeft: i === 0 ? '3px solid #FDB813' : '3px solid transparent',
                          }}>
                            {b}
                          </div>
                        ))
                      : <div style={{
                          fontSize: 24,
                          color: '#fff',
                          fontFamily: "'Inter', system-ui, sans-serif",
                          fontWeight: 500,
                          lineHeight: 1.5,
                        }}>
                          {scene.narration?.split(/[.!?]/)[0] || ''}
                        </div>
                    }
                  </div>
                </div>
                {/* RIGHT PANEL — 58% — FULL ConceptViz visualization */}
                <div style={{
                  flex: '0 0 58%',
                  position: 'relative',
                  overflow: 'hidden',
                  height: '100%',
                }}>
                  <ConceptViz
                    topic={storyboard.topic}
                    sceneIndex={idx}
                    sceneStartFrame={sceneStartFrame}
                    keywords={scene.bullets || []}
                    sceneDuration={duration}
                    vizVariant={scene.vizVariant}
                  />
                </div>
              </div>
            ) : (
              <Component {...props} {...syncProps} />
            );

            return (
              <React.Fragment key={idx}>
                {/* Add transition before each scene (except the first) */}
                {!isFirst && (
                  <TransitionSeries.Transition
                    presentation={getTransitionForScene(scene.type)}
                    timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
                  />
                )}
                <TransitionSeries.Sequence durationInFrames={duration}>
                  <AbsoluteFill>
                    {renderedScene}
                    {/* Scene transition flash effect */}
                    {!isFirst && (
                      <SceneTransitionFlash sceneType={scene.type} sceneNumber={idx + 1} totalScenes={contentScenes.length} />
                    )}
                  </AbsoluteFill>
                </TransitionSeries.Sequence>
              </React.Fragment>
            );
          })}
        </TransitionSeries>
      </Sequence>

      {/* Branded Outro */}
      <Sequence from={INTRO_DURATION + contentFrames} durationInFrames={OUTRO_DURATION}>
        <OutroSlide
          topic={storyboard.topic}
          nextTopic={storyboard.nextTopic}
          durationInFrames={OUTRO_DURATION}
        />
      </Sequence>

      {/* Persistent overlays (only during content, skipped for noOverlays mode) */}
      {!noOverlays && !isIntro && !isOutro && (
        <>
          <TopicHeader
            topic={storyboard.topic}
            sessionNumber={storyboard.sessionNumber}
            language={storyboard.scenes[0]?.language || 'Python'}
            sceneType={currentSceneType}
          />
          <ProgressBar
            progress={progress}
            sceneMarkers={sceneMarkers}
            currentSceneType={currentSceneType}
          />
        </>
      )}

      {/* Caption overlay (skipped for noOverlays — re-added after split-stack) */}
      {!noOverlays && !isIntro && !isOutro && hasNarration && activeScene && (
        <CaptionOverlay
          key={`caption-${activeScene.audioOffsetSeconds ?? activeScene.startFrame}`}
          text={activeScene.narration!}
          startFrame={
            activeScene.audioOffsetSeconds != null && activeScene.audioOffsetSeconds >= 0
              ? INTRO_DURATION + Math.round(activeScene.audioOffsetSeconds * fps)
              : INTRO_DURATION + activeScene.startFrame
          }
          durationInFrames={activeScene.endFrame - activeScene.startFrame}
          wordTimestamps={activeScene.wordTimestamps}
        />
      )}

      {/* Narrator indicator (skipped for noOverlays) */}
      {!noOverlays && !isIntro && !isOutro && (
        <NarratorIndicator
          isActive={hasNarration || false}
          label="Guru Sishya"
        />
      )}

      {/* Single master narration audio — no overlap possible */}
      {storyboard.audioFile && (
        <Sequence from={INTRO_DURATION}>
          <Audio
            src={staticFile(`audio/${storyboard.audioFile.split('/').pop()}`)}
            volume={(f) => {
              // Base narration volume — master audio is loudnorm'd to -14 LUFS,
              // so 1.0 is the correct baseline (full volume, no attenuation).
              const baseVolume = 1.0;
              // Gentle fade-in over 0.3s (9 frames) — shorter so narration hits fast
              const fadeIn = interpolate(f, [0, 9], [0, 1], { extrapolateRight: 'clamp' });
              // Gentle fade-out over the last 0.3s
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

      {/* Background music with sidechain ducking during narration */}
      {storyboard.bgmFile && syncTimeline && (
        <BgmLayer syncTimeline={syncTimeline} bgmFile={storyboard.bgmFile} />
      )}

      {/* 1.5x speed reminder overlay (skipped for noOverlays) */}
      {!noOverlays && !isIntro && !isOutro && (
        <SpeedReminder
          totalFrames={totalFrames}
          introFrames={INTRO_DURATION}
          outroFrames={OUTRO_DURATION}
        />
      )}

      {/* Guru-sishya.in branding (skipped for noOverlays) */}
      {!noOverlays && <BrandingLayer durationInFrames={totalFrames} format="long" />}

      {/* SFX triggers synced to word timestamps */}
      {syncTimeline && storyboard.allSfxTriggers && storyboard.allSfxTriggers.length > 0 && (
        <SfxLayer triggers={storyboard.allSfxTriggers} syncTimeline={syncTimeline} />
      )}
    </AbsoluteFill>
  );
};

export default LongVideo;
