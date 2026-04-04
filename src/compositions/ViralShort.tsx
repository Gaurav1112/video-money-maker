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
import type { Storyboard, Scene, WordTimestamp } from '../types';
import { COLORS, FONTS } from '../lib/theme';
import { TemplateFactory } from '../components/templates/TemplateFactory';
import { getVisualTemplate } from '../lib/visual-templates';
import { computeVisualBeats } from '../lib/visual-beats';

// ── Constants ─────────────────────────────────────────────────────────────────
const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const HOOK_FRAMES = 30; // 1 second
const CTA_FRAMES = 60; // 2 seconds
const MAX_TOTAL_FRAMES = 900; // 30 seconds

// ── Props ─────────────────────────────────────────────────────────────────────
interface ViralShortProps {
  storyboard: Storyboard;
  clipStart?: number; // scene index (default: auto-select best)
  clipEnd?: number;
}

// ── Scene Selection: pick the single best content scene ───────────────────────
function selectBestScene(scenes: Scene[]): { scene: Scene; index: number } {
  const contentScenes = scenes.filter(
    (s) =>
      s.type !== 'title' &&
      s.type !== 'summary' &&
      s.narration &&
      s.narration.trim().length > 0,
  );

  // Prefer text, interview, review types — pick longest narration
  const preferred = contentScenes.filter(
    (s) => s.type === 'text' || s.type === 'interview' || s.type === 'review',
  );
  const pool = preferred.length > 0 ? preferred : contentScenes;

  let best = pool[0];
  for (const s of pool) {
    if ((s.narration?.length ?? 0) > (best.narration?.length ?? 0)) {
      best = s;
    }
  }

  const index = scenes.indexOf(best);
  return { scene: best, index };
}

// ── Trim word timestamps to fit maxSeconds ─────────────────────────────────────
function trimTimestamps(
  timestamps: WordTimestamp[],
  maxSeconds: number,
): WordTimestamp[] {
  return timestamps.filter((w) => w.start < maxSeconds);
}

// ── Get content duration from word timestamps ──────────────────────────────────
function getAudioDuration(scene: Scene): number {
  const wt = scene.wordTimestamps;
  if (wt && wt.length > 0) {
    return wt[wt.length - 1].end;
  }
  return scene.duration || 10;
}

// ── Subtle background ──────────────────────────────────────────────────────────
const SubtleBg: React.FC = () => (
  <div style={{ position: 'absolute', inset: 0 }}>
    {/* Very faint grid */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(${COLORS.saffron}04 1px, transparent 1px),
          linear-gradient(90deg, ${COLORS.saffron}04 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
      }}
    />
    {/* Subtle radial glow */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse at 50% 40%, ${COLORS.saffron}08 0%, transparent 60%)`,
      }}
    />
  </div>
);

// ── Hook Screen (1 second) ─────────────────────────────────────────────────────
const HookScreen: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const s = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 200, mass: 0.5 },
  });
  const scale = interpolate(s, [0, 1], [0.7, 1]);
  const opacity = interpolate(s, [0, 1], [0, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      <SubtleBg />
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 60,
          right: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${scale})`,
          opacity,
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontFamily: FONTS.heading,
            fontWeight: 900,
            color: COLORS.white,
            textAlign: 'center',
            lineHeight: 1.25,
            textShadow: '0 4px 20px rgba(0,0,0,0.8)',
          }}
        >
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Center Captions (word-by-word, saffron active word) ────────────────────────
const CenterCaptions: React.FC<{
  wordTimestamps: WordTimestamp[];
  audioOffset: number;
}> = ({ wordTimestamps, audioOffset }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!wordTimestamps || wordTimestamps.length === 0) return null;

  // Current time relative to scene audio start
  const currentTime = frame / fps;

  // Find current word index
  let currentWordIdx = -1;
  for (let i = wordTimestamps.length - 1; i >= 0; i--) {
    if (currentTime >= wordTimestamps[i].start) {
      currentWordIdx = i;
      break;
    }
  }

  if (currentWordIdx < 0) return null;

  // Show window of 4 words centered on current
  const windowStart = Math.max(0, currentWordIdx - 1);
  const windowEnd = Math.min(wordTimestamps.length, windowStart + 4);
  const visibleWords = wordTimestamps.slice(windowStart, windowEnd);

  return (
    <div
      style={{
        position: 'absolute',
        top: 850,
        left: 40,
        right: 40,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 10,
        zIndex: 50,
      }}
    >
      {visibleWords.map((wt, i) => {
        const globalIdx = windowStart + i;
        const isActive = globalIdx === currentWordIdx;
        return (
          <span
            key={`${globalIdx}-${wt.word}`}
            style={{
              fontSize: 52,
              fontFamily: FONTS.heading,
              fontWeight: 700,
              color: isActive ? COLORS.saffron : COLORS.white,
              textShadow: '0 0 8px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8), 2px 0 4px rgba(0,0,0,0.8), -2px 0 4px rgba(0,0,0,0.8)',
              WebkitTextStroke: isActive ? undefined : '1px rgba(0,0,0,0.3)',
              transition: 'color 0.05s',
            }}
          >
            {wt.word}
          </span>
        );
      })}
    </div>
  );
};

// ── Text Content ───────────────────────────────────────────────────────────────
const TextContent: React.FC<{
  scene: Scene;
  contentDurationFrames: number;
}> = ({ scene, contentDurationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Compute visual beats for progressive diagram reveal
  const beats = React.useMemo(() => {
    if (scene.wordTimestamps && scene.wordTimestamps.length > 0) {
      return computeVisualBeats(scene.narration || '', scene.wordTimestamps);
    }
    return [];
  }, [scene]);

  // Zoom pulse every 3 seconds
  const zoomFrame = frame % 90;
  const zoomScale = zoomFrame < 15
    ? interpolate(zoomFrame, [0, 7, 15], [1.0, 1.03, 1.0])
    : 1.0;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      <SubtleBg />

      {/* Scene heading */}
      {scene.heading && (
        <div
          style={{
            position: 'absolute',
            top: 260,
            left: 60,
            right: 60,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 4,
              height: 32,
              backgroundColor: COLORS.saffron,
              borderRadius: 2,
            }}
          />
          <span
            style={{
              fontSize: 28,
              fontFamily: FONTS.heading,
              fontWeight: 800,
              color: COLORS.gold,
              textTransform: 'uppercase',
              letterSpacing: 2,
            }}
          >
            {scene.heading}
          </span>
        </div>
      )}

      {/* Visual template diagram — center area */}
      <div
        style={{
          position: 'absolute',
          top: 320,
          bottom: 920,
          left: 20,
          right: 20,
          transform: `scale(${zoomScale})`,
          transformOrigin: 'center center',
        }}
      >
        <TemplateFactory
          templateId={scene.templateId || 'ConceptDiagram'}
          variant={scene.templateVariant || 'auto'}
          beats={beats}
          accentColor={COLORS.saffron}
          fps={fps}
          sceneHeading={scene.heading}
          bullets={scene.bullets}
          content={scene.content}
        />
      </div>
    </AbsoluteFill>
  );
};

// ── Code Content ───────────────────────────────────────────────────────────────
const CodeContent: React.FC<{
  scene: Scene;
}> = ({ scene }) => {
  const frame = useCurrentFrame();
  const codeLines = (scene.content || '').split('\n').slice(0, 14);
  const activeLineIdx = Math.min(
    codeLines.length - 1,
    Math.floor(frame / 8),
  );

  // Zoom pulse
  const zoomFrame = frame % 90;
  const zoomScale = zoomFrame < 15
    ? interpolate(zoomFrame, [0, 7, 15], [1.0, 1.03, 1.0])
    : 1.0;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      <SubtleBg />

      <div
        style={{
          position: 'absolute',
          top: 280,
          left: 40,
          right: 40,
          bottom: 920,
          backgroundColor: '#1E1E2E',
          borderRadius: 12,
          padding: 24,
          overflow: 'hidden',
          transform: `scale(${zoomScale})`,
        }}
      >
        {codeLines.map((line, i) => {
          const lineOpacity = interpolate(
            frame - i * 6,
            [0, 10],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );
          const isActive = i === activeLineIdx;

          return (
            <div
              key={i}
              style={{
                fontSize: 22,
                fontFamily: FONTS.code,
                color: isActive ? COLORS.white : `${COLORS.white}BB`,
                lineHeight: 1.8,
                whiteSpace: 'pre',
                opacity: lineOpacity,
                borderLeft: isActive
                  ? `3px solid ${COLORS.saffron}`
                  : '3px solid transparent',
                paddingLeft: 10,
                backgroundColor: isActive ? `${COLORS.saffron}10` : 'transparent',
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

// ── Interview/Review Content ───────────────────────────────────────────────────
const InterviewContent: React.FC<{
  scene: Scene;
}> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bullets = scene.bullets || scene.narration?.split(/[.!?]/).filter(Boolean).slice(0, 4) || [];

  // Zoom pulse
  const zoomFrame = frame % 90;
  const zoomScale = zoomFrame < 15
    ? interpolate(zoomFrame, [0, 7, 15], [1.0, 1.03, 1.0])
    : 1.0;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      <SubtleBg />

      {/* Question */}
      {scene.heading && (
        <div
          style={{
            position: 'absolute',
            top: 300,
            left: 60,
            right: 60,
            transform: `scale(${zoomScale})`,
          }}
        >
          <div
            style={{
              fontSize: 36,
              fontFamily: FONTS.heading,
              fontWeight: 800,
              color: COLORS.white,
              lineHeight: 1.3,
              textShadow: '0 2px 8px rgba(0,0,0,0.6)',
            }}
          >
            {scene.heading}
          </div>
        </div>
      )}

      {/* Answer bullets */}
      <div
        style={{
          position: 'absolute',
          top: 440,
          left: 60,
          right: 60,
          bottom: 920,
        }}
      >
        {bullets.map((bullet, idx) => {
          const bulletSpring = spring({
            frame: Math.max(0, frame - idx * 25),
            fps,
            config: { damping: 12, stiffness: 140, mass: 0.6 },
          });

          return (
            <div
              key={idx}
              style={{
                fontSize: 28,
                fontFamily: FONTS.text,
                fontWeight: 600,
                color: COLORS.white,
                lineHeight: 1.5,
                marginBottom: 16,
                opacity: interpolate(bulletSpring, [0, 1], [0, 1]),
                transform: `translateX(${interpolate(bulletSpring, [0, 1], [40, 0])}px)`,
                paddingLeft: 20,
                borderLeft: `3px solid ${COLORS.teal}`,
              }}
            >
              {typeof bullet === 'string' ? bullet.trim() : ''}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ── End CTA (last 2 seconds) ───────────────────────────────────────────────────
const EndCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const s = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 140, mass: 0.6 },
  });
  const scale = interpolate(s, [0, 1], [0.6, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      <SubtleBg />
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          transform: `scale(${scale})`,
          opacity: interpolate(s, [0, 1], [0, 1]),
        }}
      >
        <span
          style={{
            fontSize: 28,
            fontFamily: FONTS.heading,
            fontWeight: 800,
            color: COLORS.gold,
          }}
        >
          Follow @guru_sishya.in
        </span>
        <span
          style={{
            fontSize: 20,
            fontFamily: FONTS.code,
            fontWeight: 600,
            color: COLORS.teal,
          }}
        >
          guru-sishya.in
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPOSITION
// ═══════════════════════════════════════════════════════════════════════════════
export const ViralShort: React.FC<ViralShortProps> = ({
  storyboard,
  clipStart,
  clipEnd,
}) => {
  const { fps } = useVideoConfig();

  // ── Select scene ──
  let selectedScene: Scene;
  let selectedIndex: number;

  if (clipStart !== undefined) {
    const contentScenes = storyboard.scenes.filter(
      (s) => s.type !== 'title' && s.type !== 'summary',
    );
    selectedScene = contentScenes[clipStart] || contentScenes[0];
    selectedIndex = storyboard.scenes.indexOf(selectedScene);
  } else {
    const result = selectBestScene(storyboard.scenes);
    selectedScene = result.scene;
    selectedIndex = result.index;
  }

  // ── Audio timing ──
  const audioOffsetSeconds = selectedScene.audioOffsetSeconds ?? 0;
  const sceneDurationSeconds = getAudioDuration(selectedScene);

  // Trim to 25 seconds max for content
  const maxContentSeconds = 25;
  const contentSeconds = Math.min(sceneDurationSeconds, maxContentSeconds);
  const contentFrames = Math.round(contentSeconds * fps);

  // Trim word timestamps to fit
  const wordTimestamps = selectedScene.wordTimestamps
    ? trimTimestamps(selectedScene.wordTimestamps, contentSeconds)
    : [];

  // Total duration: hook (1s) + content + CTA (2s)
  const totalFrames = HOOK_FRAMES + contentFrames + CTA_FRAMES;

  // ── Audio start in master track (frames) ──
  const audioStartFrames = Math.round(audioOffsetSeconds * fps);

  // ── Hook text: rewrite heading as curiosity gap ──
  const heading = selectedScene.heading || storyboard.topic;
  const hookText = generateHookText(heading, storyboard.topic);

  // ── Content renderer based on scene type ──
  const renderContent = () => {
    if (selectedScene.type === 'code') {
      return <CodeContent scene={selectedScene} />;
    }
    if (selectedScene.type === 'interview' || selectedScene.type === 'review') {
      return <InterviewContent scene={selectedScene} />;
    }
    return <TextContent scene={selectedScene} contentDurationFrames={contentFrames} />;
  };

  return (
    <AbsoluteFill
      style={{ backgroundColor: COLORS.dark, width: WIDTH, height: HEIGHT }}
    >
      {/* ── Hook: 1 second ── */}
      <Sequence from={0} durationInFrames={HOOK_FRAMES}>
        <HookScreen text={hookText} />
      </Sequence>

      {/* ── Content ── */}
      <Sequence from={HOOK_FRAMES} durationInFrames={contentFrames}>
        {renderContent()}

        {/* Center captions */}
        <CenterCaptions
          wordTimestamps={wordTimestamps}
          audioOffset={audioOffsetSeconds}
        />
      </Sequence>

      {/* ── CTA: last 2 seconds ── */}
      <Sequence from={HOOK_FRAMES + contentFrames} durationInFrames={CTA_FRAMES}>
        <EndCTA />
      </Sequence>

      {/* ── Master Audio (scene clip) ── */}
      {storyboard.audioFile && (
        <Sequence from={HOOK_FRAMES} durationInFrames={contentFrames}>
          <Audio
            src={staticFile(`audio/${storyboard.audioFile.split('/').pop()}`)}
            startFrom={audioStartFrames}
            volume={(f) => {
              const fadeIn = interpolate(f, [0, 9], [0, 1], {
                extrapolateRight: 'clamp',
              });
              const fadeOut = interpolate(
                f,
                [contentFrames - 15, contentFrames],
                [1, 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );
              return fadeIn * fadeOut;
            }}
          />
        </Sequence>
      )}

      {/* ── BGM: looping, very low volume ── */}
      <Audio
        src={staticFile('audio/bgm/warm-ambient.mp3')}
        volume={0.08}
        loop
      />
    </AbsoluteFill>
  );
};

// ── Hook text generator ────────────────────────────────────────────────────────
function generateHookText(heading: string, topic: string): string {
  const lower = heading.toLowerCase();

  if (lower.includes('mistake') || lower.includes('wrong')) {
    return `STOP doing ${topic} like this`;
  }
  if (lower.includes('tip') || lower.includes('secret')) {
    return `99% get ${topic} WRONG`;
  }
  if (lower.includes('problem')) {
    return `This ${topic} problem breaks everything`;
  }
  if (lower.includes('implementation') || lower.includes('code')) {
    return `${topic} in 20 seconds`;
  }
  if (lower.includes('interview')) {
    return `This ${topic} question fails 90% of candidates`;
  }
  if (lower.includes('number') || lower.includes('latency')) {
    return `The numbers NO ONE tells you about ${topic}`;
  }
  if (lower.includes('real') || lower.includes('impact')) {
    return `${topic} changed everything`;
  }

  // Default curiosity gap
  return `99% get ${topic} WRONG`;
}

// ── calculateMetadata for registration ─────────────────────────────────────────
export function calculateViralShortMetadata({
  props,
}: {
  props: Record<string, unknown>;
}) {
  const sb = props.storyboard as Storyboard;
  if (!sb || !sb.scenes || sb.scenes.length === 0) {
    return { durationInFrames: 900, fps: 30, width: 1080, height: 1920 };
  }

  const clipStartIdx = props.clipStart as number | undefined;
  let scene: Scene;

  if (clipStartIdx !== undefined) {
    const contentScenes = sb.scenes.filter(
      (s) => s.type !== 'title' && s.type !== 'summary',
    );
    scene = contentScenes[clipStartIdx] || contentScenes[0];
  } else {
    scene = selectBestScene(sb.scenes).scene;
  }

  const duration = getAudioDuration(scene);
  const contentSeconds = Math.min(duration, 25);
  const contentFrames = Math.round(contentSeconds * 30);
  const total = HOOK_FRAMES + contentFrames + CTA_FRAMES;

  return {
    durationInFrames: Math.min(total, MAX_TOTAL_FRAMES),
    fps: 30,
    width: 1080,
    height: 1920,
  };
}

export default ViralShort;
