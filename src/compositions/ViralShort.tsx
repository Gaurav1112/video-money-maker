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
const HOOK_FRAMES = 30;   // 1 second
const CTA_FRAMES = 60;    // 2 seconds
const MAX_TOTAL_FRAMES = 900; // 30 seconds — well within ≤55 s cap

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
// PATCH (Rank #3): was `top: 850` (44 % from top; obscured by platform chrome).
//                  Fixed to `bottom: 420` — clears like/comment/share UI on all
//                  modern phones per TikTok/Instagram safe-zone guidelines.
const CenterCaptions: React.FC<{
  wordTimestamps: WordTimestamp[];
  audioOffset: number;
}> = ({ wordTimestamps, audioOffset }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!wordTimestamps || wordTimestamps.length === 0) return null;

  const currentTime = frame / fps;

  let currentWordIdx = -1;
  for (let i = wordTimestamps.length - 1; i >= 0; i--) {
    if (currentTime >= wordTimestamps[i].start) {
      currentWordIdx = i;
      break;
    }
  }

  if (currentWordIdx < 0) return null;

  const windowStart = Math.max(0, currentWordIdx - 1);
  const windowEnd = Math.min(wordTimestamps.length, windowStart + 4);
  const visibleWords = wordTimestamps.slice(windowStart, windowEnd);

  return (
    <div
      style={{
        position: 'absolute',
        // FIXED: bottom: 420 keeps captions above platform UI chrome.
        // On 1920 px canvas this equals top ≈ 1460 px after wrapping.
        bottom: 420,
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
              textShadow:
                '0 0 8px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8), 2px 0 4px rgba(0,0,0,0.8), -2px 0 4px rgba(0,0,0,0.8)',
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

  const beats = React.useMemo(() => {
    if (scene.wordTimestamps && scene.wordTimestamps.length > 0) {
      return computeVisualBeats(scene.narration || '', scene.wordTimestamps);
    }
    return [];
  }, [scene]);

  const zoomFrame = frame % 90;
  const zoomScale =
    zoomFrame < 15
      ? interpolate(zoomFrame, [0, 7, 15], [1.0, 1.03, 1.0])
      : 1.0;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      <SubtleBg />

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

      <div
        style={{
          position: 'absolute',
          top: 320,
          // Diagram stays above safe-zone: 1920 - 420 (chrome) - 80 (caption) = 1420
          bottom: 520,
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
  const activeLineIdx = Math.min(codeLines.length - 1, Math.floor(frame / 8));

  const zoomFrame = frame % 90;
  const zoomScale =
    zoomFrame < 15
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
          bottom: 520,
          backgroundColor: '#1E1E2E',
          borderRadius: 12,
          padding: 24,
          overflow: 'hidden',
          transform: `scale(${zoomScale})`,
        }}
      >
        {codeLines.map((line, i) => {
          const lineOpacity = interpolate(frame - i * 6, [0, 10], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
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

  const bullets =
    scene.bullets ||
    scene.narration
      ?.split(/[.!?]/)
      .filter(Boolean)
      .slice(0, 4) ||
    [];

  const zoomFrame = frame % 90;
  const zoomScale =
    zoomFrame < 15
      ? interpolate(zoomFrame, [0, 7, 15], [1.0, 1.03, 1.0])
      : 1.0;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      <SubtleBg />

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

      <div
        style={{
          position: 'absolute',
          top: 440,
          left: 60,
          right: 60,
          bottom: 520,
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
// PATCH (Rank #7 loopable ending): added fade-out in final 8 frames so the last
// rendered frame is fully transparent over COLORS.dark. When the platform loops
// video (last frame → first frame), it transitions seamlessly into the HookScreen
// which itself fades in from COLORS.dark — no jarring hard cut.
const EndCTA: React.FC<{ totalFrames: number }> = ({ totalFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeInSpring = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 140, mass: 0.6 },
  });
  const scale = interpolate(fadeInSpring, [0, 1], [0.6, 1]);

  // Fade out in last 8 frames — makes the ending frame pure COLORS.dark,
  // matching HookScreen frame 0, which creates a seamless loop.
  const fadeOutOpacity = interpolate(
    frame,
    [totalFrames - 8, totalFrames - 1],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const combinedOpacity = interpolate(fadeInSpring, [0, 1], [0, 1]) * fadeOutOpacity;

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
          opacity: combinedOpacity,
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

  const maxContentSeconds = 25;
  const contentSeconds = Math.min(sceneDurationSeconds, maxContentSeconds);
  const contentFrames = Math.round(contentSeconds * fps);

  const wordTimestamps = selectedScene.wordTimestamps
    ? trimTimestamps(selectedScene.wordTimestamps, contentSeconds)
    : [];

  // Total: hook (1 s) + content (≤25 s) + CTA (2 s) = ≤28 s — within MAX_TOTAL_FRAMES
  const totalFrames = Math.min(HOOK_FRAMES + contentFrames + CTA_FRAMES, MAX_TOTAL_FRAMES);
  const adjustedContentFrames = totalFrames - HOOK_FRAMES - CTA_FRAMES;

  const audioStartFrames = Math.round(audioOffsetSeconds * fps);

  const heading = selectedScene.heading || storyboard.topic;
  const hookText = generateHookText(heading, storyboard.topic);

  const renderContent = () => {
    if (selectedScene.type === 'code') {
      return <CodeContent scene={selectedScene} />;
    }
    if (selectedScene.type === 'interview' || selectedScene.type === 'review') {
      return <InterviewContent scene={selectedScene} />;
    }
    return (
      <TextContent scene={selectedScene} contentDurationFrames={adjustedContentFrames} />
    );
  };

  return (
    <AbsoluteFill
      style={{ backgroundColor: COLORS.dark, width: WIDTH, height: HEIGHT }}
    >
      {/* ── Hook: 1 s ── */}
      <Sequence from={0} durationInFrames={HOOK_FRAMES}>
        <HookScreen text={hookText} />
      </Sequence>

      {/* ── Content ── */}
      <Sequence from={HOOK_FRAMES} durationInFrames={adjustedContentFrames}>
        {renderContent()}
        <CenterCaptions
          wordTimestamps={wordTimestamps}
          audioOffset={audioOffsetSeconds}
        />
      </Sequence>

      {/* ── CTA: 2 s, loopable fade-out ── */}
      <Sequence from={HOOK_FRAMES + adjustedContentFrames} durationInFrames={CTA_FRAMES}>
        <EndCTA totalFrames={CTA_FRAMES} />
      </Sequence>

      {/* ── Master Audio ── */}
      {storyboard.audioFile && (
        <Sequence from={HOOK_FRAMES} durationInFrames={adjustedContentFrames}>
          <Audio
            src={staticFile(`audio/${storyboard.audioFile.split('/').pop()}`)}
            startFrom={audioStartFrames}
            volume={(f) => {
              const fadeIn = interpolate(f, [0, 9], [0, 1], {
                extrapolateRight: 'clamp',
              });
              const fadeOut = interpolate(
                f,
                [adjustedContentFrames - 15, adjustedContentFrames],
                [1, 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );
              return fadeIn * fadeOut;
            }}
          />
        </Sequence>
      )}

      {/* ── BGM: looping, very low volume ── */}
      <Audio src={staticFile('audio/bgm/warm-ambient.mp3')} volume={0.08} loop />
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

  return `99% get ${topic} WRONG`;
}

// ── calculateMetadata for Remotion registration ────────────────────────────────
export function calculateViralShortMetadata({
  props,
}: {
  props: Record<string, unknown>;
}) {
  const sb = props.storyboard as Storyboard;
  if (!sb || !sb.scenes || sb.scenes.length === 0) {
    return { durationInFrames: 900, fps: FPS, width: WIDTH, height: HEIGHT };
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
  const contentFrames = Math.round(contentSeconds * FPS);
  const total = Math.min(HOOK_FRAMES + contentFrames + CTA_FRAMES, MAX_TOTAL_FRAMES);

  return {
    durationInFrames: total,
    fps: FPS,
    width: WIDTH,
    height: HEIGHT,
  };
}
