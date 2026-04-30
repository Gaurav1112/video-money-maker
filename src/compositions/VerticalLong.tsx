import React from 'react';
import { useCurrentFrame, useVideoConfig, AbsoluteFill, Sequence, Audio, staticFile, interpolate, spring } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import type { TransitionPresentation } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { Storyboard, Scene } from '../types';
import { FONTS } from '../lib/theme';

// ── Dark-mode colors for vertical — theme.ts is LIGHT mode (charcoal text, white bg).
// Using COLORS from theme.ts on dark #0C0A15 background would render invisible text.
const COLORS = {
  saffron: '#E85D26',
  gold: '#FDB813',
  teal: '#1DD1A1',
  white: '#FFFFFF',
  dark: '#0C0A15',
} as const;
import { SyncTimeline } from '../lib/sync-engine';
import { setSyncTimeline } from '../hooks/useSync';
import { AvatarBubble } from '../components/AvatarBubble';
import { BgmLayer } from '../components/BgmLayer';
import { SfxLayer } from '../components/SfxLayer';
import { VERTICAL_INTRO_DURATION, VERTICAL_OUTRO_DURATION } from '../lib/constants';
import { REGIONS, VERTICAL_SIZES, SAFE_ZONE } from '../lib/vertical-layouts';
import { generateDualHook } from '../lib/hook-generator';
import { getStyleForFormat, getTransitionDuration } from '../lib/video-styles';
import { VerticalCaptionOverlay } from '../components/vertical/VerticalCaptionOverlay';
import { VerticalTitleSlide } from '../components/vertical/VerticalTitleSlide';
import VerticalComparisonTable from '../components/vertical/VerticalComparisonTable';
import { VerticalTextSection } from '../components/vertical/VerticalTextSection';
import VerticalCodeReveal from '../components/vertical/VerticalCodeReveal';
import { VerticalInterviewInsight } from '../components/vertical/VerticalInterviewInsight';
import { VerticalReviewQuestion } from '../components/vertical/VerticalReviewQuestion';
import { VerticalSummarySlide } from '../components/vertical/VerticalSummarySlide';
import { PatternInterruptLayer } from '../components/PatternInterruptLayer';
import { CameraDrift } from '../components/CameraDrift';
import { BrandingLayer } from '../components/BrandingLayer';
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

// ── Dark-mode scene-tinted backgrounds with bokeh depth ─────────────────────
// Matches horizontal BackgroundLayer richness but with dark palette
const DARK_SCENE_TINTS: Record<string, string> = {
  title:     '#0C0A15',
  text:      '#0C0A15',
  code:      '#0A0C1A', // dark blue tint for code
  diagram:   '#0C0A18', // dark indigo for diagrams
  table:     '#140E0A', // warm dark amber for comparisons
  interview: '#0A120C', // dark green tint for interview
  review:    '#14100A', // warm dark orange for quiz
  summary:   '#0C0A15',
};

const VerticalBg: React.FC<{ sceneType?: string }> = ({ sceneType = 'text' }) => {
  const bgFrame = useCurrentFrame();
  const tint = DARK_SCENE_TINTS[sceneType] || '#0C0A15';
  const glowOpacity = 0.08 + Math.sin(bgFrame * 0.025) * 0.04;

  return (
  <div style={{ position: 'absolute', inset: 0, backgroundColor: tint }}>
    {/* Subtle grid */}
    <div style={{
      position: 'absolute', inset: 0,
      backgroundImage: `
        linear-gradient(${COLORS.saffron}06 1px, transparent 1px),
        linear-gradient(90deg, ${COLORS.saffron}06 1px, transparent 1px)
      `,
      backgroundSize: '54px 54px',
    }} />
    {/* Bokeh depth circles — scene-aware accent color */}
    {[0.15, 0.7, 0.35, 0.85].map((x, i) => (
      <div key={`bokeh-${i}`} style={{
        position: 'absolute',
        left: `${x * 100}%`, top: `${(i * 22 + 8)}%`,
        width: 140 + i * 50, height: 140 + i * 50,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${COLORS.saffron}08 0%, transparent 70%)`,
        filter: 'blur(40px)',
      }} />
    ))}
    {/* Pulsing radial glow */}
    <div style={{
      position: 'absolute', inset: 0,
      background: `radial-gradient(ellipse at 50% 25%, ${COLORS.saffron}10 0%, transparent 55%)`,
      opacity: glowOpacity / 0.08,
    }} />
  </div>
  );
};

// ── Vertical Intro Screen ──────────────────────────────────────────────────────
const VerticalIntro: React.FC<{
  topic: string;
  sessionNumber: number;
  hookText: string;
  durationInFrames: number;
}> = ({ topic, sessionNumber, hookText, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Snap-in: visible by frame 3 (~0.1s) — no slow fade on vertical
  const s = spring({
    frame,
    fps,
    config: { damping: 25, stiffness: 500, mass: 0.2 },
  });
  const scaleIn = interpolate(s, [0, 1], [0.92, 1]);
  const opacityIn = interpolate(s, [0, 1], [0.5, 1]);

  // Fade out last 15 frames
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const springBadge = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 20, stiffness: 400, mass: 0.3 },
  });
  const badgeOpacity = interpolate(springBadge, [0, 1], [0, 1]);
  const badgeY = interpolate(springBadge, [0, 1], [20, 0]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0C0A15' }}>
      <VerticalBg />

      {/* Session badge */}
      <div style={{
        position: 'absolute',
        top: SAFE_ZONE.top + 16, // below platform status bar/search icons
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
        {/* Hook text split: keyword (big, saffron) + context (smaller, white) */}
        {(() => {
          const words = hookText.split(' ');
          // Smart split: if ≤3 words, show ALL as keyword (no context)
          // If 4-6 words, split at 2 (short punchy keyword)
          // If 7+ words, split at 3
          const splitAt = words.length <= 3 ? words.length
            : words.length <= 6 ? 2
            : 3;
          const keyword = words.slice(0, splitAt).join(' ');
          const context = words.slice(splitAt).join(' ');
          return (
            <>
              <div style={{
                fontSize: 96,
                fontFamily: FONTS.heading,
                fontWeight: 900,
                color: COLORS.saffron,
                textAlign: 'center',
                lineHeight: 1.1,
                textShadow: '0 4px 24px rgba(0,0,0,0.8), 0 0 40px rgba(232,93,38,0.3)',
              }}>
                {keyword}
              </div>
              {context && (
                <div style={{
                  fontSize: 48,
                  fontFamily: FONTS.heading,
                  fontWeight: 700,
                  color: COLORS.white,
                  textAlign: 'center',
                  lineHeight: 1.3,
                  opacity: 0.85,
                  textShadow: '0 2px 12px rgba(0,0,0,0.6)',
                }}>
                  {context}
                </div>
              )}
            </>
          );
        })()}

        {/* Accent line */}
        <div style={{
          width: 80,
          height: 4,
          borderRadius: 2,
          background: `linear-gradient(90deg, ${COLORS.saffron}, ${COLORS.gold})`,
        }} />

        {/* Branding removed from intro — every pixel is for the hook */}
      </div>
    </AbsoluteFill>
  );
};

// ── Vertical Outro Screen ──────────────────────────────────────────────────────
const VerticalOutro: React.FC<{
  topic: string;
  nextTopic?: string;
  sessionNumber: number;
  totalSessions?: number;
  ctaText?: string;
  durationInFrames: number;
}> = ({ topic, nextTopic, sessionNumber, totalSessions, ctaText, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const s = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 300, mass: 0.4 }, // snappier than before
  });
  const scale = interpolate(s, [0, 1], [0.85, 1]);
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
        {/* Series progress */}
        {totalSessions && totalSessions > 1 && (
          <div style={{
            fontFamily: FONTS.heading,
            fontSize: VERTICAL_SIZES.bodySmall,
            fontWeight: 700,
            color: COLORS.saffron,
            textAlign: 'center',
            letterSpacing: 1,
          }}>
            Session {sessionNumber} of {totalSessions} complete · {Math.round((sessionNumber / totalSessions) * 100)}% interview-ready
          </div>
        )}
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
        {/* Part cliffhanger CTA or next topic tease */}
        {ctaText ? (
          <div style={{
            marginTop: 20,
            fontFamily: FONTS.heading,
            fontSize: VERTICAL_SIZES.body,
            fontWeight: 700,
            color: COLORS.teal,
            textAlign: 'center',
            lineHeight: 1.4,
          }}>
            {ctaText}
          </div>
        ) : nextTopic ? (
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
        ) : null}
        <div style={{
          marginTop: 8,
          fontFamily: FONTS.heading,
          fontSize: VERTICAL_SIZES.body,
          fontWeight: 700,
          color: COLORS.saffron,
        }}>
          Subscribe · @guru_sishya
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

// ── Scale: horizontal components at 75% fill vertical well ────────────────────
// At 0.75: 1920→1440px wide (180px cropped per side), 1080→810px tall (fills content zone)
// This preserves ALL the rich horizontal graphics (TemplateFactory diagrams, etc.)
const CONTENT_SCALE = 0.75;
const ACCENT_COLORS = ['#2563EB', '#059669', '#D97706', '#7C3AED'];

// ── Only title + code get native vertical (they're well-designed for 9:16) ────
// Text/diagram/table/interview/review/summary use HORIZONTAL components at 75% scale
// to keep all the rich TemplateFactory diagrams and visual templates visible.
const NATIVE_VERTICAL_SCENES = new Set(['title', 'code']);

// ── Scene component map — vertical-native where available, horizontal fallback ─
const VERTICAL_SCENE_MAP: Record<string, React.FC<any>> = {
  title: VerticalTitleSlide,
  text: VerticalTextSection,
  table: VerticalComparisonTable,
  diagram: VerticalTextSection, // diagrams use text section with d2Svg prop
  code: VerticalCodeReveal,
  interview: VerticalInterviewInsight,
  review: VerticalReviewQuestion,
  summary: VerticalSummarySlide,
};

// ── Horizontal fallback map (for code, interview, review, summary) ────────────
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

// ── Map scene data to native vertical component props ─────────────────────────
function getNativeSceneProps(scene: Scene, storyboard: Storyboard): Record<string, any> {
  const base = {
    sceneIndex: storyboard.scenes.indexOf(scene),
    sceneStartFrame: scene.startFrame,
  };

  switch (scene.type) {
    case 'title':
      return {
        ...base,
        topic: storyboard.topic,
        sessionNumber: storyboard.sessionNumber,
        title: scene.content,
        objectives: scene.bullets || [],
      };
    case 'text':
    case 'diagram':
      return {
        ...base,
        heading: scene.heading || '',
        // Pass bullets only if non-empty; let getEffectiveBullets handle fallback from content/narration
        bullets: (scene.bullets && scene.bullets.length > 0) ? scene.bullets : undefined,
        content: scene.content || '',
        narration: scene.narration || '',
        d2Svg: scene.d2Svg,
        templateId: scene.templateId,
        topic: storyboard.topic,
      };
    case 'table': {
      const lines = (scene.content || '').split('\n').filter(l => l.trim());
      const headers = lines[0] ? lines[0].split('|').map(h => h.trim()).filter(Boolean) : [];
      const rows = lines.slice(1)
        .filter(l => !l.match(/^[\s|:-]+$/))
        .map(l => l.split('|').map(c => c.trim()).filter(Boolean));
      return {
        ...base,
        headers,
        rows,
        title: scene.heading || '',
      };
    }
    case 'code':
      return {
        ...base,
        code: scene.content || '',
        language: scene.language || 'typescript',
        title: scene.heading || `main.${scene.language === 'python' ? 'py' : 'ts'}`,
        highlightLines: scene.highlightLines,
        startFrame: 0,
        sceneDurationFrames: scene.endFrame - scene.startFrame,
        output: (scene as any).output,
      };
    case 'interview':
      return {
        ...base,
        insight: scene.content || scene.narration || '',
        tip: scene.narration || '',
        heading: scene.heading || '',
      };
    case 'review':
      return {
        ...base,
        question: scene.content || '',
        answer: scene.heading || '',
        heading: scene.heading || '',
        quizOptions: scene.quizOptions || [],
      };
    case 'summary':
      return {
        ...base,
        takeaways: scene.bullets || [scene.content],
        topic: storyboard.topic,
        sessionNumber: storyboard.sessionNumber,
      };
    default:
      return { ...base, ...scene };
  }
}

// ── Vertical scene wrapper ─────────────────────────────────────────────────────
// Native vertical components render at 1080x1920 with no scaling.
// Horizontal fallback scales 1920x1080 to fit 1080px wide (for code, interview, review, summary).
const VerticalSceneContent: React.FC<{ scene: Scene; storyboard: Storyboard }> = ({ scene, storyboard }) => {
  const sceneFrame = useCurrentFrame();
  // Only use native vertical component if the scene type is in NATIVE_VERTICAL_SCENES
  // Everything else uses the HORIZONTAL component (rich graphics) at 75% scale
  const useNative = NATIVE_VERTICAL_SCENES.has(scene.type);
  const NativeComponent = useNative ? VERTICAL_SCENE_MAP[scene.type] : undefined;

  if (NativeComponent) {
    // NATIVE — render directly at full 1080x1920, no scaling
    // Wrapped in CameraDrift for Ken Burns motion (matches horizontal quality)
    const nativeProps = getNativeSceneProps(scene, storyboard);
    return (
      <CameraDrift>
        <AbsoluteFill style={{ backgroundColor: '#0C0A15' }}>
          <VerticalBg sceneType={scene.type} />
          <NativeComponent {...nativeProps} />
        </AbsoluteFill>
      </CameraDrift>
    );
  }

  // FALLBACK — scale horizontal component (for code, interview, review, summary)
  const Component = SCENE_COMPONENT_MAP[scene.type];
  const sceneProps = getSceneProps(scene, storyboard);

  if (!Component) {
    // Minimal fallback for unknown scene types
    return (
      <AbsoluteFill style={{ backgroundColor: '#0C0A15' }}>
        <VerticalBg />
        <div style={{
          position: 'absolute',
          top: 200,
          left: 60,
          right: 60,
          fontFamily: FONTS.text,
          fontSize: 32,
          color: '#FFFFFF',
          lineHeight: 1.6,
        }}>
          {scene.content || ''}
        </div>
      </AbsoluteFill>
    );
  }

  // Extract key info from scene for the context zone below the diagram
  const sceneHeading = scene.heading || '';
  const sceneBullets = (scene.bullets && scene.bullets.length > 0)
    ? scene.bullets.slice(0, 3)
    : (scene.content || '').split(/(?<=[.!?])\s+/).filter(s => s.length > 15).slice(0, 2);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0C0A15' }}>
      <VerticalBg sceneType={scene.type} />

      {/* ── TOP: Horizontal content card (diagrams, templates, full graphics) ── */}
      <CameraDrift>
        <div style={{
          position: 'absolute',
          top: 30,
          left: 10,
          right: 10,
          height: 620,
          overflow: 'hidden',
          borderRadius: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <div style={{
            position: 'absolute',
            width: 1920,
            height: 1080,
            left: 0,
            top: 0,
            transform: `scale(${1060 / 1920})`,
            transformOrigin: 'top left',
          }}>
            <Component {...sceneProps} />
          </div>
        </div>
      </CameraDrift>

      {/* ── MIDDLE: Scene heading + key bullets (fills the gap) ── */}
      <div style={{
        position: 'absolute',
        top: 680,
        left: 60,
        right: 60,
      }}>
        {/* Scene heading with accent bar */}
        {sceneHeading && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 16,
          }}>
            <div style={{
              width: 5, height: 36, borderRadius: 3,
              backgroundColor: COLORS.saffron, flexShrink: 0,
            }} />
            <div style={{
              fontFamily: FONTS.heading,
              fontSize: 38,
              fontWeight: 800,
              color: '#FFFFFF',
              lineHeight: 1.2,
            }}>
              {sceneHeading.length > 40 ? sceneHeading.slice(0, 40) + '...' : sceneHeading}
            </div>
          </div>
        )}

        {/* Key bullets */}
        {sceneBullets.map((bullet, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 10,
            padding: '10px 16px',
            backgroundColor: i === 0 ? 'rgba(232,93,38,0.08)' : 'rgba(255,255,255,0.03)',
            borderRadius: 12,
            borderLeft: `4px solid ${[COLORS.saffron, COLORS.gold, COLORS.teal][i % 3]}`,
          }}>
            <span style={{
              fontFamily: FONTS.text,
              fontSize: 30,
              fontWeight: i === 0 ? 600 : 400,
              color: i === 0 ? '#FFFFFF' : 'rgba(255,255,255,0.85)',
              lineHeight: 1.4,
            }}>
              {(typeof bullet === 'string' && bullet.length > 80) ? bullet.slice(0, 80) + '...' : bullet}
            </span>
          </div>
        ))}
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
  const totalFrames = VERTICAL_INTRO_DURATION + contentFrames + VERTICAL_OUTRO_DURATION;
  const style = getStyleForFormat('vertical');

  // Content scenes (exclude title + summary wrapper scenes)
  const contentScenes = storyboard.scenes.slice(1, storyboard.scenes.length - 1);

  // Build SyncTimeline — same pattern as LongVideo
  const syncTimeline = React.useMemo(() => {
    const offsets = storyboard.sceneOffsets || [];
    const timestamps = contentScenes.map(s => s.wordTimestamps || []);
    return new SyncTimeline(offsets, timestamps, fps, VERTICAL_INTRO_DURATION);
  }, [storyboard, fps]);

  // Set synchronously during render (no useEffect — see LongVideo comment)
  setSyncTimeline(syncTimeline);

  // Active scene for captions — use audio timing, not visual frame
  const audioTimeSeconds = (frame - VERTICAL_INTRO_DURATION) / fps;
  const activeScene = getActiveSceneByAudioTime(
    contentScenes,
    audioTimeSeconds,
    storyboard.sceneOffsets || [],
  );
  const hasNarration = !!(activeScene && activeScene.narration && activeScene.narration.trim() !== '');

  // Progress (based on content only)
  const contentProgress = contentFrames > 0
    ? Math.min(1, Math.max(0, (frame - VERTICAL_INTRO_DURATION) / contentFrames))
    : 0;

  const isIntro = frame < VERTICAL_INTRO_DURATION;
  const isOutro = frame >= VERTICAL_INTRO_DURATION + contentFrames;

  // Hook text for intro
  const hookText = React.useMemo(
    () => generateDualHook(
      storyboard.topic,
      storyboard.sessionNumber,
      storyboard.scenes,
      storyboard.scenes[0]?.content,
    ).textHook, // textHook = max 8 words (India-first companies), spokenHook = full sentence
    [storyboard.topic, storyboard.sessionNumber],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#0C0A15', width: WIDTH, height: HEIGHT }}>

      {/* ── Intro ── */}
      <Sequence from={0} durationInFrames={VERTICAL_INTRO_DURATION}>
        <VerticalIntro
          topic={storyboard.topic}
          sessionNumber={storyboard.sessionNumber}
          hookText={hookText}
          durationInFrames={VERTICAL_INTRO_DURATION}
        />
      </Sequence>

      {/* ── Content scenes via TransitionSeries ── */}
      <Sequence from={VERTICAL_INTRO_DURATION} durationInFrames={contentFrames}>
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
      <Sequence from={VERTICAL_INTRO_DURATION + contentFrames} durationInFrames={VERTICAL_OUTRO_DURATION}>
        <VerticalOutro
          topic={storyboard.topic}
          nextTopic={storyboard.nextTopic}
          sessionNumber={storyboard.sessionNumber}
          totalSessions={(storyboard as any).totalSessions}
          ctaText={(storyboard as any).partCtaText}
          durationInFrames={VERTICAL_OUTRO_DURATION}
        />
      </Sequence>

      {/* ── Avatar — visible from frame 0 (faces boost algorithm) ── */}
      {!isOutro && (
        <div style={{
          position: 'absolute',
          right: 40,
          top: 1310, // below captions (1050+220=1270), in the bottom strip
          width: 140,
          height: 140,
          zIndex: 90,
        }}>
          <AvatarBubble
            avatarVideo="video/teacher-talking.mp4"
            avatarPhoto="images/guru-avatar.jpg"
            mouthCues={storyboard.mouthCues}
            startFrame={0}
            endFrame={VERTICAL_INTRO_DURATION + contentFrames}
          />
        </div>
      )}

      {/* ── Persistent overlays (content phase only) ── */}
      {!isIntro && !isOutro && (
        <>
          <VerticalTopicHeader
            topic={storyboard.topic}
            sessionNumber={storyboard.sessionNumber}
          />
          <VerticalProgressBar progress={contentProgress} />

          {/* Pattern interrupts — zoom, callout, color pulse every 3-5s */}
          {activeScene && (
            <PatternInterruptLayer
              wordTimestamps={activeScene.wordTimestamps || []}
              sceneType={activeScene.type}
              narration={activeScene.narration || ''}
              style={style}
              fps={fps}
              sceneDurationFrames={activeScene.endFrame - activeScene.startFrame}
            />
          )}
        </>
      )}

      {/* ── Vertical caption overlay ── */}
      {!isIntro && !isOutro && hasNarration && activeScene && (
        <VerticalCaptionOverlay
          key={`vcaption-${activeScene.audioOffsetSeconds ?? activeScene.startFrame}`}
          text={activeScene.narration!}
          startFrame={
            activeScene.audioOffsetSeconds != null && activeScene.audioOffsetSeconds >= 0
              ? VERTICAL_INTRO_DURATION + Math.round(activeScene.audioOffsetSeconds * fps)
              : VERTICAL_INTRO_DURATION + activeScene.startFrame
          }
          durationInFrames={activeScene.endFrame - activeScene.startFrame}
          wordTimestamps={activeScene.wordTimestamps}
          captionMode={style.captionMode}
        />
      )}

      {/* ── Intro SFX — audio hook at frame 0 (silence = instant swipe) ── */}
      <Sequence from={0} durationInFrames={VERTICAL_INTRO_DURATION}>
        <Audio src={staticFile('audio/sfx/whoosh-in.wav')} volume={0.45} />
      </Sequence>

      {/* ── Master narration audio ── */}
      {storyboard.audioFile && (
        <Sequence from={VERTICAL_INTRO_DURATION}>
          <Audio
            src={staticFile(`audio/${storyboard.audioFile.split('/').pop()}`)}
            volume={(f) => {
              const baseVolume = 1.0;
              const fadeIn = interpolate(f, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
              // contentFrames is already the content-only duration (no intro/outro)
              const fadeOut = interpolate(
                f,
                [contentFrames - 8, contentFrames],
                [1, 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );
              return baseVolume * fadeIn * fadeOut;
            }}
          />
        </Sequence>
      )}

      {/* ── BGM — starts from frame 0 (not just content phase) ── */}
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

      {/* ── Branding layer — watermark + mid-video CTA (matches horizontal) ── */}
      <BrandingLayer
        durationInFrames={totalFrames}
        format="short"
        topicSlug={storyboard.topic.toLowerCase().replace(/\s+/g, '-')}
      />

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
    durationInFrames: contentFrames + VERTICAL_INTRO_DURATION + VERTICAL_OUTRO_DURATION,
    fps: 30,
    width: WIDTH,
    height: HEIGHT,
  };
}

export default VerticalLong;
