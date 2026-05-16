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
import type { Storyboard, Scene, WordTimestamp, WorldClassScene, MicroReward } from '../types';
import { COLORS, FONTS } from '../lib/theme';
import { TemplateFactory } from '../components/templates/TemplateFactory';
import { getVisualTemplate } from '../lib/visual-templates';
import { computeVisualBeats } from '../lib/visual-beats';
import { getZeigarnikEnding } from '../pipeline/shorts-generator';

// ── Avatar Bubble (280px — large enough for face detection + brand recognition) ─
const AVATAR_SIZE = 280;
const AvatarBubble: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Breathing animation — subtle scale pulse (1.0→1.05→1.0 over 3 seconds)
  const breathCycle = (frame % (fps * 3)) / (fps * 3);
  const breathScale = 1 + 0.05 * Math.sin(breathCycle * Math.PI * 2);

  // Pulsing border glow — synced to breathing
  const glowIntensity = 0.3 + 0.2 * Math.sin(breathCycle * Math.PI * 2);

  // Entry spring — slides in from right
  const entrySpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });
  const slideX = interpolate(entrySpring, [0, 1], [120, 0]);

  // Avatar: ALWAYS use the AI-generated avatar, NEVER the raw photo
  const avatarImgSrc = staticFile('images/guru-avatar-crop.png');
  const fallbackSrc = staticFile('images/guru-avatar.png');

  return (
    <div
      style={{
        position: 'absolute',
        top: 140,
        right: 30,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        transform: `scale(${breathScale}) translateX(${slideX}px)`,
        zIndex: 80,
      }}
    >
      {/* Avatar circle with glow */}
      <div
        style={{
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          borderRadius: '50%',
          overflow: 'hidden',
          border: `4px solid ${SHORTS_ACCENT}`,
          boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 ${Math.round(20 + glowIntensity * 20)}px rgba(45,156,219,${glowIntensity})`,
        }}
      >
        <img
          src={avatarImgSrc}
          onError={(e) => { (e.target as HTMLImageElement).src = fallbackSrc; }}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
      {/* Name label below avatar */}
      <div
        style={{
          marginTop: 8,
          padding: '4px 16px',
          backgroundColor: 'rgba(0,0,0,0.6)',
          borderRadius: 12,
          opacity: interpolate(entrySpring, [0, 1], [0, 1]),
        }}
      >
        <span style={{ fontSize: 24, fontFamily: FONTS.heading, fontWeight: 600, color: SHORTS_TEXT }}>
          Kumar Gaurav
        </span>
      </div>
    </div>
  );
};

// ── Constants ─────────────────────────────────────────────────────────────────
const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 60;
const HOOK_FRAMES = 150; // 2.5 seconds at 60fps — algorithm needs 2-3s to measure retention
const CTA_FRAMES = 150; // 2.5 seconds at 60fps — enough to read all 3 CTA elements
const MAX_TOTAL_FRAMES = 3300; // 55 seconds at 60fps

// Unified dark theme for Shorts — consistent throughout, no jarring transitions
const SHORTS_BG = '#0F0F14'; // rich dark (not pure black, avoids OLED banding)
const SHORTS_TEXT = '#FFFFFF';
const SHORTS_MUTED = '#94A3B8';
const SHORTS_ACCENT = '#2D9CDB'; // bright blue accent

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
    {/* Very faint grid on dark background */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(${SHORTS_ACCENT}06 1px, transparent 1px),
          linear-gradient(90deg, ${SHORTS_ACCENT}06 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
      }}
    />
    {/* Subtle radial glow */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse at 50% 40%, ${SHORTS_ACCENT}0A 0%, transparent 60%)`,
      }}
    />
  </div>
);

// ── Hook Screen (1 second) ─────────────────────────────────────────────────────
const HookScreen: React.FC<{ text: string; subtext?: string }> = ({ text, subtext }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Frame 0 must be fully visible — YouTube uses it as the Shorts thumbnail
  // Loom motion starts from frame 1: text slides up from below
  const loomProgress = frame === 0 ? 0 : interpolate(frame, [1, 20], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const loomY = loomProgress * 100; // reduced travel for faster readability
  const loomOpacity = frame === 0 ? 1 : interpolate(frame, [1, 12], [0.5, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Blur-to-sharp: frame 0 is sharp (thumbnail), then slight blur for motion feel
  const blurAmount = frame === 0 ? 0 : interpolate(frame, [1, 8], [4, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Accent bar height spring (0→64)
  const accentBarSpring = spring({ frame, fps, config: { damping: 12, stiffness: 160, mass: 0.6 } });
  const accentBarHeight = interpolate(accentBarSpring, [0, 1], [0, 64]);

  // Light scan sweep (frames 8-20)
  const scanProgress = interpolate(frame, [8, 20], [-20, 120], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scanOpacity = interpolate(frame, [8, 12, 18, 20], [0, 0.35, 0.35, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const lines = text.split('\n');

  // Render words with ALL-CAPS highlighted in accent color
  const renderLineWithEmphasis = (line: string) => {
    const words = line.split(/(\s+)/);
    return words.map((word, wi) => {
      const isEmphasis = word.length >= 2 && word === word.toUpperCase() && /[A-Z]/.test(word);
      return (
        <span key={wi} style={{ color: isEmphasis ? SHORTS_ACCENT : '#FFFFFF' }}>
          {word}
        </span>
      );
    });
  };

  return (
    <AbsoluteFill style={{ backgroundColor: SHORTS_BG }}>
      {/* Gradient accent bar top */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 48, background: `linear-gradient(90deg, ${SHORTS_ACCENT}, transparent)` }} />

      <div
        style={{
          position: 'absolute',
          top: 0, bottom: 0, left: 60, right: 60,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          transform: `translateY(${loomY}px)`,
          opacity: loomOpacity,
          filter: `blur(${blurAmount}px)`,
        }}
      >
        {/* Animated accent bar */}
        <div style={{ width: 6, height: accentBarHeight, background: `linear-gradient(180deg, ${SHORTS_ACCENT}, transparent)`, borderRadius: 3, marginBottom: 24 }} />

        {/* Hook text — staggered scale spring per line */}
        {lines.map((line, i) => {
          const lineSpring = spring({ frame: Math.max(0, frame - i * 4), fps, config: { damping: 14, stiffness: 180, mass: 0.7 } });
          const lineScale = interpolate(lineSpring, [0, 1], [0.7, 1.0]);
          return (
            <div
              key={i}
              style={{
                fontSize: 80,
                fontFamily: 'Space Grotesk, sans-serif',
                fontWeight: 900,
                lineHeight: 1.1,
                letterSpacing: -1,
                textTransform: 'uppercase',
                transform: `scale(${lineScale})`,
                transformOrigin: 'left center',
              }}
            >
              {renderLineWithEmphasis(line)}
            </div>
          );
        })}

        {/* Subtext */}
        {subtext && (
          <div style={{ fontSize: 48, fontFamily: 'Inter, sans-serif', fontWeight: 500, color: SHORTS_MUTED, marginTop: 24, lineHeight: 1.3 }}>
            {subtext}
          </div>
        )}
      </div>

      {/* Light scan sweep overlay */}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, transparent ${scanProgress - 15}%, rgba(255,255,255,${scanOpacity}) ${scanProgress}%, transparent ${scanProgress + 15}%)`, pointerEvents: 'none' }} />

      {/* Gradient accent bar bottom */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 48, background: `linear-gradient(270deg, ${SHORTS_ACCENT}, transparent)` }} />
    </AbsoluteFill>
  );
};

// ── Karaoke Captions (single-word pop with scale + bounce) ──────────────────
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

  const currentWord = wordTimestamps[currentWordIdx];
  const wordStartFrame = Math.round(currentWord.start * fps);
  const localFrame = frame - wordStartFrame;

  const wordSpring = spring({
    frame: Math.max(0, localFrame),
    fps,
    config: { stiffness: 300, damping: 12, mass: 0.4 },
  });
  const wordScale = interpolate(wordSpring, [0, 1], [0.7, 1]);
  const bounceY = interpolate(wordSpring, [0, 1], [20, 0]);

  const nextWord = currentWordIdx < wordTimestamps.length - 1
    ? wordTimestamps[currentWordIdx + 1].word : null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 1180, // YouTube safe zone — above action buttons (like/comment/share)
        left: 40,
        right: 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 50,
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(0,0,0,0.75)',
          borderRadius: 16,
          padding: '12px 32px',
          transform: `scale(${wordScale}) translateY(${bounceY}px)`,
        }}
      >
        <span
          style={{
            fontSize: 68,
            fontFamily: FONTS.heading,
            fontWeight: 800,
            color: SHORTS_TEXT,
            textShadow: `0 0 16px ${SHORTS_ACCENT}66, 0 2px 8px rgba(0,0,0,0.9)`,
            letterSpacing: -1,
          }}
        >
          {currentWord.word}
        </span>
      </div>
      {nextWord && (
        <span
          style={{
            fontSize: 36,
            fontFamily: FONTS.heading,
            fontWeight: 500,
            color: `${SHORTS_MUTED}88`,
            marginTop: 8,
          }}
        >
          {nextWord}
        </span>
      )}
    </div>
  );
};

// ── Engagement Prompts — each enters from a different direction/position ──────
const EngagementPrompt: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Each prompt has unique position, entry direction, accent color, and type
  const prompts = [
    { triggerFrame: Math.round(8 * fps), type: 'save' as const, top: 480, left: 40, right: undefined as number | undefined, entryDir: 'left' as const, accent: '#10B981' },
    { triggerFrame: Math.round(20 * fps), type: 'comment' as const, top: undefined as number | undefined, left: undefined as number | undefined, right: 40, bottom: 550, entryDir: 'right' as const, accent: SHORTS_ACCENT },
    { triggerFrame: Math.round(35 * fps), type: 'share' as const, top: 520, left: 40, right: undefined as number | undefined, entryDir: 'bottom' as const, accent: '#FCD34D' },
  ];

  const SHOW_DURATION = Math.round(2 * fps);  // 2 seconds (was 1.5)
  const FADE_FRAMES = Math.round(0.3 * fps);

  let activePrompt: typeof prompts[0] | null = null;
  let localFrame = 0;
  for (let i = 0; i < prompts.length; i++) {
    const p = prompts[i];
    if (frame >= p.triggerFrame && frame < p.triggerFrame + SHOW_DURATION) {
      activePrompt = p;
      localFrame = frame - p.triggerFrame;
      break;
    }
  }

  if (!activePrompt) return null;

  const fadeIn = interpolate(localFrame, [0, FADE_FRAMES], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fadeOut = interpolate(localFrame, [SHOW_DURATION - FADE_FRAMES, SHOW_DURATION], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const s = spring({ frame: localFrame, fps, config: { stiffness: 200, damping: 18, mass: 0.5 } });

  // Different entry animation per prompt
  const slideX = activePrompt.entryDir === 'left' ? interpolate(s, [0, 1], [-80, 0])
    : activePrompt.entryDir === 'right' ? interpolate(s, [0, 1], [80, 0]) : 0;
  const slideY = activePrompt.entryDir === 'bottom' ? interpolate(s, [0, 1], [40, 0]) : 0;
  const entryScale = activePrompt.entryDir === 'bottom' ? interpolate(s, [0, 1], [0.85, 1]) : 1;

  // Pulsing border animation for save prompt (scale 1.0 -> 1.05 -> 1.0 cycle)
  const pulseCycle = (localFrame % (fps * 0.6)) / (fps * 0.6);
  const pulseScale = activePrompt.type === 'save'
    ? 1 + 0.05 * Math.sin(pulseCycle * Math.PI * 2)
    : 1;

  // Render prompt content based on type
  const renderPromptContent = () => {
    if (activePrompt!.type === 'save') {
      return (
        <div
          style={{
            backgroundColor: 'rgba(0,0,0,0.8)',
            borderRadius: 28,
            padding: '12px 28px',
            borderLeft: `4px solid ${activePrompt!.accent}`,
            boxShadow: `0 0 20px ${activePrompt!.accent}22`,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            transform: `scale(${pulseScale})`,
          }}
        >
          <span style={{ fontSize: 40 }}>🔖</span>
          <span style={{
            fontSize: 36,
            fontFamily: FONTS.text,
            fontWeight: 700,
            color: SHORTS_TEXT,
          }}>
            Save this
          </span>
        </div>
      );
    }

    if (activePrompt!.type === 'comment') {
      return (
        <div
          style={{
            backgroundColor: 'rgba(0,0,0,0.8)',
            borderRadius: 28,
            padding: '12px 28px',
            borderLeft: `4px solid ${activePrompt!.accent}`,
            boxShadow: `0 0 20px ${activePrompt!.accent}22`,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            backgroundColor: `${activePrompt!.accent}33`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: activePrompt!.accent }}>?</span>
          </div>
          <span style={{
            fontSize: 34,
            fontFamily: FONTS.text,
            fontWeight: 700,
            color: SHORTS_TEXT,
          }}>
            Can you name the 3rd config?
          </span>
        </div>
      );
    }

    // share prompt
    return (
      <div
        style={{
          backgroundColor: 'rgba(0,0,0,0.8)',
          borderRadius: 28,
          padding: '12px 28px',
          borderLeft: `4px solid ${activePrompt!.accent}`,
          boxShadow: `0 0 20px ${activePrompt!.accent}22`,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <span style={{ fontSize: 36 }}>↗</span>
        <span style={{
          fontSize: 36,
          fontFamily: FONTS.text,
          fontWeight: 700,
          color: SHORTS_TEXT,
        }}>
          Share with your team
        </span>
        <div style={{
          marginLeft: 8,
          backgroundColor: `${activePrompt!.accent}33`,
          borderRadius: 14,
          padding: '4px 12px',
          display: 'flex',
          alignItems: 'center',
        }}>
          <span style={{
            fontSize: 22,
            fontFamily: FONTS.text,
            fontWeight: 600,
            color: activePrompt!.accent,
          }}>
            2.3K shares
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: activePrompt.top,
        bottom: (activePrompt as any).bottom,
        left: activePrompt.left,
        right: activePrompt.right,
        opacity: fadeIn * fadeOut,
        transform: `translateX(${slideX}px) translateY(${slideY}px) scale(${entryScale})`,
        zIndex: 60,
      }}
    >
      {renderPromptContent()}
    </div>
  );
};

// ── Progress Bar ─────────────────────────────────────────────────────────────
const ShortsProgressBar: React.FC<{ totalFrames: number }> = ({ totalFrames }) => {
  const frame = useCurrentFrame();
  const progress = Math.min(1, frame / Math.max(totalFrames, 1));
  const widthPercent = progress * 100;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        zIndex: 90,
      }}
    >
      <div
        style={{
          width: `${widthPercent}%`,
          height: '100%',
          background: `linear-gradient(90deg, ${SHORTS_ACCENT}, #60B5F0)`,
          borderRadius: '0 3px 3px 0',
          boxShadow: '0 0 8px rgba(96,181,240,0.6), 0 0 16px rgba(45,156,219,0.3)',
        }}
      />
    </div>
  );
};

// ── Sponsor Overlay (optional — renders only when sponsor prop is provided) ──
interface SponsorConfig {
  name: string;
  tagline: string;
}

// Topic category → sponsor mapping (fill in when deals are signed)
const SPONSOR_MAP: Record<string, SponsorConfig> = {
  // Example: 'system-design': { name: 'DigitalOcean', tagline: 'Deploy in seconds' },
  // Example: 'databases': { name: 'PlanetScale', tagline: 'Serverless MySQL' },
};

const SponsorOverlay: React.FC<{
  topicSlug: string;
  contentFrames: number;
}> = ({ topicSlug, contentFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Look up sponsor by topic category
  const category = topicSlug; // simplified — in production, use getTopicCategory
  const sponsor = SPONSOR_MAP[category];
  if (!sponsor) return null;

  // Show sponsor card for 1.5s near the end of content (last 3s)
  const showStart = contentFrames - Math.round(3 * fps);
  const showEnd = contentFrames - Math.round(1.5 * fps);
  const localFrame = frame - showStart;

  if (frame < showStart || frame > showEnd) return null;

  const fadeIn = interpolate(localFrame, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fadeOut = interpolate(localFrame, [showEnd - showStart - 10, showEnd - showStart], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 500,
        left: 40,
        right: 40,
        opacity: fadeIn * fadeOut,
        zIndex: 70,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(0,0,0,0.75)',
          borderRadius: 16,
          padding: '12px 28px',
          border: `1px solid ${SHORTS_ACCENT}33`,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <span style={{ fontSize: 28, fontFamily: FONTS.text, fontWeight: 400, color: SHORTS_MUTED }}>
          Powered by
        </span>
        <span style={{ fontSize: 36, fontFamily: FONTS.heading, fontWeight: 700, color: SHORTS_TEXT }}>
          {sponsor.name}
        </span>
        <span style={{ fontSize: 24, fontFamily: FONTS.text, fontWeight: 400, color: SHORTS_MUTED }}>
          {sponsor.tagline}
        </span>
      </div>
    </div>
  );
};

// ── Multi-Phase Content (3 visual phases with crossfade transitions) ─────────
const CROSSFADE_FRAMES = 15; // overlap between phases

const MultiPhaseContent: React.FC<{
  scene: Scene;
  contentDurationFrames: number;
}> = ({ scene, contentDurationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Split duration into 3 equal phases
  const phaseLength = Math.floor(contentDurationFrames / 3);
  const phase1End = phaseLength;
  const phase2End = phaseLength * 2;

  // Phase opacities with crossfade overlap
  const phase1Opacity = interpolate(
    frame,
    [phase1End - CROSSFADE_FRAMES, phase1End],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const phase2Opacity = (() => {
    const fadeIn = interpolate(
      frame,
      [phase1End - CROSSFADE_FRAMES, phase1End],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );
    const fadeOut = interpolate(
      frame,
      [phase2End - CROSSFADE_FRAMES, phase2End],
      [1, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );
    return fadeIn * fadeOut;
  })();
  const phase3Opacity = interpolate(
    frame,
    [phase2End - CROSSFADE_FRAMES, phase2End],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Compute visual beats for template diagrams
  const beats = React.useMemo(() => {
    if (scene.wordTimestamps && scene.wordTimestamps.length > 0) {
      return computeVisualBeats(scene.narration || '', scene.wordTimestamps);
    }
    return [];
  }, [scene]);

  // Tension-state color overlay (shared across phases)
  const wcScene = scene as WorldClassScene;
  const tensionOpacity = wcScene.emotionalBeat === 'tension' ? 0.18 :
                         wcScene.emotionalBeat === 'escalation' ? 0.22 :
                         wcScene.emotionalBeat === 'resolution' ? 0.15 : 0;
  const tensionColor = (wcScene.emotionalBeat === 'tension' || wcScene.emotionalBeat === 'escalation')
    ? '255, 68, 68' : '16, 185, 129';
  const tensionOverlayColor = tensionOpacity > 0
    ? `rgba(${tensionColor}, ${tensionOpacity})`
    : 'transparent';

  // Extract key takeaway from narration (last sentence or heading)
  const keyTakeaway = React.useMemo(() => {
    const narration = scene.narration || '';
    const sentences = narration.split(/[.!?]/).filter((s) => s.trim().length > 10);
    if (sentences.length > 0) return sentences[sentences.length - 1].trim() + '.';
    return scene.heading || 'Key Takeaway';
  }, [scene]);

  // Bullets for staggered reveal in phase 2
  const bullets = scene.bullets || [];

  // Heading slide-in spring
  const headingSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 160, mass: 0.7 },
  });

  // Variable-interval zoom pulse (deterministic, seeded)
  const PULSE_OFFSETS = [150, 402, 588, 888, 1110, 1278];
  const PULSE_PERIOD = 1428;
  const cyclicFrame = frame % PULSE_PERIOD;
  const pulseLocalFrame = (() => {
    for (const offset of PULSE_OFFSETS) {
      const local = cyclicFrame - offset;
      if (local >= 0 && local < 24) return local;
    }
    return -1;
  })();
  const zoomScale = pulseLocalFrame >= 0
    ? interpolate(pulseLocalFrame, [0, 10, 24], [1.0, 1.06, 1.0])
    : 1.0;

  return (
    <AbsoluteFill style={{ backgroundColor: SHORTS_BG }}>
      {/* Tension color tint */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: tensionOverlayColor, pointerEvents: 'none', zIndex: 1 }} />

      {/* ── Phase 1: Heading + Template (slide-in, top-aligned) ── */}
      {frame < phase1End && (
        <AbsoluteFill style={{ opacity: phase1Opacity }}>
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
                transform: `translateX(${interpolate(headingSpring, [0, 1], [-40, 0])}px)`,
                opacity: interpolate(headingSpring, [0, 1], [0, 1]),
              }}
            >
              <div style={{ width: 4, height: 32, backgroundColor: SHORTS_ACCENT, borderRadius: 2 }} />
              <span
                style={{
                  fontSize: 48,
                  fontFamily: FONTS.heading,
                  fontWeight: 800,
                  color: '#FCD34D',
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
              top: 340,
              bottom: 580,
              left: 20,
              right: 20,
              transform: `scale(${zoomScale})`,
              transformOrigin: 'center center',
              overflow: 'hidden',
            }}
          >
            <div style={{ width: '100%', height: '100%', transform: 'scale(1.4)', transformOrigin: 'center center' }}>
              <TemplateFactory
                templateId={scene.templateId || 'ConceptDiagram'}
                variant={scene.templateVariant || 'auto'}
                beats={beats}
                accentColor={SHORTS_ACCENT}
                fps={fps}
                sceneHeading={scene.heading}
                bullets={scene.bullets}
                content={scene.content}
              />
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* ── Phase 2: Staggered bullets or centered template ── */}
      {frame >= phase1End - CROSSFADE_FRAMES && frame < phase2End && (
        <AbsoluteFill style={{ opacity: phase2Opacity }}>
          <SubtleBg />
          {/* Blue tint overlay */}
          <div style={{ position: 'absolute', inset: 0, backgroundColor: `${SHORTS_ACCENT}08`, pointerEvents: 'none' }} />

          {scene.heading && (
            <div
              style={{
                position: 'absolute',
                top: 180,
                left: 60,
                right: 60,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{ width: 4, height: 32, backgroundColor: SHORTS_ACCENT, borderRadius: 2 }} />
              <span
                style={{
                  fontSize: 52,
                  fontFamily: FONTS.heading,
                  fontWeight: 800,
                  color: '#FCD34D',
                  textTransform: 'uppercase',
                  letterSpacing: 2,
                }}
              >
                {scene.heading}
              </span>
            </div>
          )}

          {bullets.length > 0 ? (
            <div
              style={{
                position: 'absolute',
                top: 280,
                left: 60,
                right: 60,
                bottom: 580,
              }}
            >
              {bullets.map((bullet, idx) => {
                const localPhaseFrame = frame - phase1End;
                const staggerDelay = idx * Math.round(phaseLength / Math.max(bullets.length + 1, 2));
                const bulletSpring = spring({
                  frame: Math.max(0, localPhaseFrame - staggerDelay),
                  fps,
                  config: { damping: 12, stiffness: 140, mass: 0.6 },
                });
                return (
                  <div
                    key={idx}
                    style={{
                      fontSize: 44,
                      fontFamily: FONTS.text,
                      fontWeight: 600,
                      color: SHORTS_TEXT,
                      lineHeight: 1.4,
                      marginBottom: 24,
                      opacity: interpolate(bulletSpring, [0, 1], [0, 1]),
                      transform: `translateX(${interpolate(bulletSpring, [0, 1], [60, 0])}px)`,
                      paddingLeft: 20,
                      borderLeft: `3px solid ${SHORTS_ACCENT}`,
                    }}
                  >
                    {typeof bullet === 'string' ? bullet.trim() : ''}
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 20,
                right: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${zoomScale})`,
                transformOrigin: 'center center',
                overflow: 'hidden',
              }}
            >
              <div style={{ width: '100%', height: 800, transform: 'scale(1.4)', transformOrigin: 'center center' }}>
                <TemplateFactory
                  templateId={scene.templateId || 'ConceptDiagram'}
                  variant={scene.templateVariant || 'auto'}
                  beats={beats}
                  accentColor={SHORTS_ACCENT}
                  fps={fps}
                  sceneHeading={scene.heading}
                  bullets={scene.bullets}
                  content={scene.content}
                />
              </div>
            </div>
          )}
        </AbsoluteFill>
      )}

      {/* ── Phase 3: Key takeaway — large centered text ── */}
      {frame >= phase2End - CROSSFADE_FRAMES && (
        <AbsoluteFill style={{ opacity: phase3Opacity }}>
          <SubtleBg />
          {/* Warm amber tint overlay */}
          <div style={{ position: 'absolute', inset: 0, backgroundColor: '#FCD34D08', pointerEvents: 'none' }} />

          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 60,
              right: 60,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Small label */}
            <div
              style={{
                fontSize: 28,
                fontFamily: FONTS.text,
                fontWeight: 600,
                color: SHORTS_ACCENT,
                textTransform: 'uppercase',
                letterSpacing: 4,
                marginBottom: 24,
                opacity: interpolate(
                  frame - phase2End,
                  [0, 20],
                  [0, 1],
                  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                ),
              }}
            >
              Key Takeaway
            </div>

            {/* Main takeaway text */}
            {(() => {
              const takeawaySpring = spring({
                frame: Math.max(0, frame - phase2End),
                fps,
                config: { damping: 14, stiffness: 120, mass: 0.8 },
              });
              return (
                <div
                  style={{
                    fontSize: 56,
                    fontFamily: FONTS.heading,
                    fontWeight: 800,
                    color: SHORTS_TEXT,
                    textAlign: 'center',
                    lineHeight: 1.3,
                    transform: `scale(${interpolate(takeawaySpring, [0, 1], [0.85, 1])})`,
                    opacity: interpolate(takeawaySpring, [0, 1], [0, 1]),
                  }}
                >
                  {keyTakeaway}
                </div>
              );
            })()}

            {/* Heading as subtitle */}
            {scene.heading && (
              <div
                style={{
                  fontSize: 36,
                  fontFamily: FONTS.text,
                  fontWeight: 500,
                  color: '#FCD34D',
                  marginTop: 32,
                  textAlign: 'center',
                  opacity: interpolate(
                    frame - phase2End,
                    [10, 30],
                    [0, 0.8],
                    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                  ),
                }}
              >
                {scene.heading}
              </div>
            )}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ── Text Content (kept for reference / fallback) ─────────────────────────────
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

  // Variable-interval zoom pulse — prevents habituation (Sokolov 1963)
  // Seeded intervals: 2.5s, 4.2s, 3.1s, 5.0s, 3.7s, 2.8s cycle (doubled for 60fps)
  const PULSE_OFFSETS = [150, 402, 588, 888, 1110, 1278]; // frames between pulses (cumulative)
  const PULSE_PERIOD = 1428; // total cycle length
  const cyclicFrame = frame % PULSE_PERIOD;
  const isInPulse = PULSE_OFFSETS.some(offset => {
    const local = cyclicFrame - offset;
    return local >= 0 && local < 24;
  });
  const pulseLocalFrame = (() => {
    for (const offset of PULSE_OFFSETS) {
      const local = cyclicFrame - offset;
      if (local >= 0 && local < 24) return local;
    }
    return -1;
  })();
  const zoomScale = isInPulse && pulseLocalFrame >= 0
    ? interpolate(pulseLocalFrame, [0, 10, 24], [1.0, 1.06, 1.0])
    : 1.0;

  // Tension-state color overlay — red tint during tension, green tint during resolution
  const wcScene = scene as WorldClassScene;
  const tensionOpacity = wcScene.emotionalBeat === 'tension' ? 0.18 :
                         wcScene.emotionalBeat === 'escalation' ? 0.22 :
                         wcScene.emotionalBeat === 'resolution' ? 0.15 : 0;
  const tensionColor = (wcScene.emotionalBeat === 'tension' || wcScene.emotionalBeat === 'escalation')
    ? `255, 68, 68` : `16, 185, 129`;
  const tensionOverlayColor = tensionOpacity > 0
    ? `rgba(${tensionColor}, ${tensionOpacity})`
    : 'transparent';

  return (
    <AbsoluteFill style={{ backgroundColor: SHORTS_BG }}>
      {/* Tension color tint */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: tensionOverlayColor, pointerEvents: 'none', zIndex: 1 }} />
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
              backgroundColor: SHORTS_ACCENT,
              borderRadius: 2,
            }}
          />
          <span
            style={{
              fontSize: 48,
              fontFamily: FONTS.heading,
              fontWeight: 800,
              color: '#FCD34D',
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
          top: 340,
          bottom: 580,
          left: 20,
          right: 20,
          transform: `scale(${zoomScale})`,
          transformOrigin: 'center center',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: '100%', height: '100%', transform: 'scale(1.4)', transformOrigin: 'center center' }}>
          <TemplateFactory
            templateId={scene.templateId || 'ConceptDiagram'}
            variant={scene.templateVariant || 'auto'}
            beats={beats}
            accentColor={SHORTS_ACCENT}
            fps={fps}
            sceneHeading={scene.heading}
            bullets={scene.bullets}
            content={scene.content}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Code Content ───────────────────────────────────────────────────────────────
const CodeContent: React.FC<{
  scene: Scene;
}> = ({ scene }) => {
  const frame = useCurrentFrame();
  const codeLines = (scene.content || '').split('\n').slice(0, 9);
  const activeLineIdx = Math.min(
    codeLines.length - 1,
    Math.floor(frame / 16),
  );

  // Variable-interval zoom pulse — prevents habituation (Sokolov 1963)
  // Seeded intervals: 2.5s, 4.2s, 3.1s, 5.0s, 3.7s, 2.8s cycle (doubled for 60fps)
  const PULSE_OFFSETS_CODE = [150, 402, 588, 888, 1110, 1278]; // frames between pulses (cumulative)
  const PULSE_PERIOD_CODE = 1428; // total cycle length
  const cyclicFrameCode = frame % PULSE_PERIOD_CODE;
  const isInPulseCode = PULSE_OFFSETS_CODE.some(offset => {
    const local = cyclicFrameCode - offset;
    return local >= 0 && local < 24;
  });
  const pulseLocalFrameCode = (() => {
    for (const offset of PULSE_OFFSETS_CODE) {
      const local = cyclicFrameCode - offset;
      if (local >= 0 && local < 24) return local;
    }
    return -1;
  })();
  const zoomScale = isInPulseCode && pulseLocalFrameCode >= 0
    ? interpolate(pulseLocalFrameCode, [0, 10, 24], [1.0, 1.06, 1.0])
    : 1.0;

  return (
    <AbsoluteFill style={{ backgroundColor: SHORTS_BG }}>
      <SubtleBg />

      <div
        style={{
          position: 'absolute',
          top: 280,
          left: 40,
          right: 40,
          bottom: 580,
          backgroundColor: '#1E1E2E',
          borderRadius: 12,
          padding: 24,
          overflow: 'hidden',
          transform: `scale(${zoomScale})`,
        }}
      >
        {codeLines.map((line, i) => {
          const lineOpacity = interpolate(
            frame - i * 12,
            [0, 20],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );
          const isActive = i === activeLineIdx;

          return (
            <div
              key={i}
              style={{
                fontSize: 36,
                fontFamily: FONTS.code,
                color: isActive ? SHORTS_TEXT : `${SHORTS_TEXT}BB`,
                lineHeight: 1.6,
                whiteSpace: 'pre',
                opacity: lineOpacity,
                borderLeft: isActive
                  ? `3px solid ${SHORTS_ACCENT}`
                  : '3px solid transparent',
                paddingLeft: 10,
                backgroundColor: isActive ? `${SHORTS_ACCENT}10` : 'transparent',
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

  // Variable-interval zoom pulse — prevents habituation (Sokolov 1963)
  // Seeded intervals: 2.5s, 4.2s, 3.1s, 5.0s, 3.7s, 2.8s cycle (doubled for 60fps)
  const PULSE_OFFSETS_IV = [150, 402, 588, 888, 1110, 1278]; // frames between pulses (cumulative)
  const PULSE_PERIOD_IV = 1428; // total cycle length
  const cyclicFrameIV = frame % PULSE_PERIOD_IV;
  const isInPulseIV = PULSE_OFFSETS_IV.some(offset => {
    const local = cyclicFrameIV - offset;
    return local >= 0 && local < 24;
  });
  const pulseLocalFrameIV = (() => {
    for (const offset of PULSE_OFFSETS_IV) {
      const local = cyclicFrameIV - offset;
      if (local >= 0 && local < 24) return local;
    }
    return -1;
  })();
  const zoomScale = isInPulseIV && pulseLocalFrameIV >= 0
    ? interpolate(pulseLocalFrameIV, [0, 10, 24], [1.0, 1.06, 1.0])
    : 1.0;

  return (
    <AbsoluteFill style={{ backgroundColor: SHORTS_BG }}>
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
              fontSize: 52,
              fontFamily: FONTS.heading,
              fontWeight: 800,
              color: SHORTS_TEXT,
              lineHeight: 1.2,
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
          bottom: 580,
        }}
      >
        {bullets.map((bullet, idx) => {
          const bulletSpring = spring({
            frame: Math.max(0, frame - idx * 50),
            fps,
            config: { damping: 12, stiffness: 140, mass: 0.6 },
          });

          return (
            <div
              key={idx}
              style={{
                fontSize: 48,
                fontFamily: FONTS.text,
                fontWeight: 600,
                color: SHORTS_TEXT,
                lineHeight: 1.3,
                marginBottom: 20,
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
    <AbsoluteFill style={{ backgroundColor: SHORTS_BG }}>
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
            fontSize: 56,
            fontFamily: FONTS.heading,
            fontWeight: 800,
            color: '#FCD34D',
          }}
        >
          Follow @guru_sishya.in
        </span>
        <span
          style={{
            fontSize: 36,
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

// ── Open Loop Ending (Zeigarnik — forces re-watch) ─────────────────────────
const OpenLoopEnding: React.FC<{ topic: string; hookText?: string }> = ({ topic, hookText }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Staggered reveals — each element enters sequentially across 2.5s
  // Phase 1 (0-0.5s): Avatar + open loop text
  // Phase 2 (0.5-1.2s): Long-form upsell
  // Phase 3 (1.2-2.5s): Lead magnet pill
  const phase1 = spring({ frame, fps, config: { stiffness: 180, damping: 22, mass: 0.6 } });
  const phase2 = spring({ frame: Math.max(0, frame - 30), fps, config: { stiffness: 160, damping: 18, mass: 0.5 } });
  const phase3 = spring({ frame: Math.max(0, frame - 72), fps, config: { stiffness: 140, damping: 16, mass: 0.5 } });

  const displayText = hookText || `The ${topic} mistake that costs teams weeks...`;

  const avatarSrc = staticFile('images/guru-avatar-crop.png');
  const fallbackSrc = staticFile('images/guru-avatar.png');

  return (
    <AbsoluteFill style={{ backgroundColor: SHORTS_BG }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${SHORTS_ACCENT}, transparent)` }} />
      <div
        style={{
          position: 'absolute',
          top: 0, bottom: 0, left: 60, right: 60,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Phase 1: Avatar + Zeigarnik open loop */}
        <div style={{
          opacity: interpolate(phase1, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(phase1, [0, 1], [30, 0])}px)`,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div style={{ width: 140, height: 140, borderRadius: '50%', overflow: 'hidden', border: `3px solid ${SHORTS_ACCENT}`, marginBottom: 20 }}>
            <img src={avatarSrc} onError={(e) => { (e.target as HTMLImageElement).src = fallbackSrc; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ fontSize: 40, fontFamily: 'Inter, sans-serif', fontWeight: 500, color: SHORTS_MUTED, textAlign: 'center', lineHeight: 1.3 }}>
            {displayText}
          </div>
        </div>

        {/* Phase 2: Long-form upsell */}
        <div style={{
          marginTop: 24,
          opacity: interpolate(phase2, [0, 1], [0, 1]),
          transform: `scale(${interpolate(phase2, [0, 1], [0.8, 1])})`,
        }}>
          <div style={{ fontSize: 52, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 900, color: SHORTS_TEXT, lineHeight: 1.2, textAlign: 'center' }}>
            Full breakdown on my channel
          </div>
        </div>

        {/* Phase 3: Lead magnet pill */}
        <div style={{
          marginTop: 24,
          opacity: interpolate(phase3, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(phase3, [0, 1], [20, 0])}px)`,
        }}>
          <div style={{
            padding: '14px 36px',
            backgroundColor: `${SHORTS_ACCENT}22`,
            border: `2px solid ${SHORTS_ACCENT}`,
            borderRadius: 32,
          }}>
            <span style={{ fontSize: 36, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, color: SHORTS_ACCENT }}>
              Free cheat sheet — link in bio
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Micro Reward Pulse — fires at microReward.triggerSec intervals ─────────
const MicroRewardPulse: React.FC<{
  microRewards: MicroReward[];
  contentStartFrame: number;
}> = ({ microRewards, contentStartFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Find the most recently triggered reward
  const currentSec = (frame - contentStartFrame) / fps;
  let activeReward: MicroReward | null = null;
  let activeTriggerFrame = -1;

  for (const reward of microRewards) {
    if (currentSec >= reward.triggerSec && currentSec < reward.triggerSec + 1.5) {
      activeReward = reward;
      activeTriggerFrame = Math.round(reward.triggerSec * fps) + contentStartFrame;
    }
  }

  if (!activeReward) return null;

  const localFrame = frame - activeTriggerFrame;
  const pulse = spring({
    frame: localFrame,
    fps,
    config: { stiffness: 320, damping: 14, mass: 0.5 },
  });
  const opacity = interpolate(
    localFrame,
    [0, 10, 60, 90],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const rewardColors: Record<string, string> = {
    revelation: '#F59E0B',
    confirmation: '#10B981',
    cliffhanger: '#FF4444',
    setup: '#2D9CDB',
    pattern_break: '#7C3AED',
  };
  const color = rewardColors[activeReward.type] || '#F59E0B';

  return (
    <div
      style={{
        position: 'absolute',
        top: 200,
        left: 60,
        right: 60,
        opacity,
        transform: `scale(${interpolate(pulse, [0, 1], [0.8, 1])})`,
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      {activeReward.displayText && (
        <div
          style={{
            backgroundColor: `${color}22`,
            border: `2px solid ${color}`,
            borderRadius: 8,
            padding: '16px 24px',
            fontSize: 48,
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 700,
            color,
            textAlign: 'center',
          }}
        >
          {activeReward.displayText}
        </div>
      )}
    </div>
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

  // Trim to 48 seconds max for content
  const maxContentSeconds = 48;
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

  // ── Zeigarnik ending: topic-specific open loop text ──
  const zeigarnikEnding = getZeigarnikEnding(storyboard.topic, selectedIndex);

  // ── Content renderer based on scene type ──
  const renderContent = () => {
    if (selectedScene.type === 'code') {
      return <CodeContent scene={selectedScene} />;
    }
    if (selectedScene.type === 'interview' || selectedScene.type === 'review') {
      return <InterviewContent scene={selectedScene} />;
    }
    return <MultiPhaseContent scene={selectedScene} contentDurationFrames={contentFrames} />;
  };

  return (
    <AbsoluteFill
      style={{ backgroundColor: SHORTS_BG, width: WIDTH, height: HEIGHT }}
    >
      {/* ── Hook: 1 second ── */}
      <Sequence from={0} durationInFrames={HOOK_FRAMES}>
        <HookScreen text={hookText} subtext={selectedScene.heading} />
      </Sequence>

      {/* ── Content ── */}
      <Sequence from={HOOK_FRAMES} durationInFrames={contentFrames}>
        {renderContent()}

        {/* Micro-reward pulses at TER arc trigger points */}
        {(() => {
          const wcScene = selectedScene as WorldClassScene;
          return wcScene.microRewards && wcScene.microRewards.length > 0 ? (
            <MicroRewardPulse
              microRewards={wcScene.microRewards}
              contentStartFrame={HOOK_FRAMES}
            />
          ) : null;
        })()}

        {/* Center captions */}
        <CenterCaptions
          wordTimestamps={wordTimestamps}
          audioOffset={audioOffsetSeconds}
        />

        {/* Avatar bubble — human face boosts algorithm priority */}
        <AvatarBubble />

        {/* Engagement prompts — drive saves/comments */}
        <EngagementPrompt />

        {/* Sponsor overlay — appears near end of content if sponsor configured */}
        <SponsorOverlay topicSlug={storyboard.topic} contentFrames={contentFrames} />
      </Sequence>

      {/* ── Open Loop End (Zeigarnik — forces follow behavior) ── */}
      <Sequence from={HOOK_FRAMES + contentFrames} durationInFrames={CTA_FRAMES}>
        <OpenLoopEnding topic={storyboard.topic} hookText={zeigarnikEnding} />
      </Sequence>

      {/* ── Master Audio — starts from frame 0 (no silent hook) ── */}
      {storyboard.audioFile && (
        <Sequence from={0} durationInFrames={HOOK_FRAMES + contentFrames}>
          <Audio
            src={staticFile(`audio/${storyboard.audioFile.split('/').pop()}`)}
            startFrom={audioStartFrames}
            volume={(f) => {
              // Fade in over first 18 frames
              const fadeIn = interpolate(f, [0, 6], [0, 1], {
                extrapolateRight: 'clamp',
              });
              // Fade out at end of content
              const totalAudioFrames = HOOK_FRAMES + contentFrames;
              const fadeOut = interpolate(
                f,
                [totalAudioFrames - 30, totalAudioFrames],
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
        volume={(f) => {
          // Louder BGM during CTA for audio presence
          const ctaStart = HOOK_FRAMES + contentFrames;
          if (f >= ctaStart) return 0.15;
          return 0.08;
        }}
        loop
      />

      {/* ── Progress bar: runs entire video, above content but below captions ── */}
      <ShortsProgressBar totalFrames={totalFrames} />
    </AbsoluteFill>
  );
};

// ── Hook text generator — 20+ variations to prevent pattern fatigue ───────────
function generateHookText(heading: string, topic: string): string {
  const lower = heading.toLowerCase();
  const T = topic.toUpperCase();

  // ── Fear/Loss hooks (strongest psychological triggers) ──
  if (lower.includes('drop') || lower.includes('los') || lower.includes('miss'))
    return `YOUR ${T}\nIS SILENTLY FAILING`;
  if (lower.includes('silent') || lower.includes('leak') || lower.includes('corrupt'))
    return `${T} IS LOSING\nYOUR DATA RIGHT NOW`;
  if (lower.includes('crash') || lower.includes('down') || lower.includes('outage'))
    return `WHY ${T}\nGOES DOWN AT 3AM`;

  // ── Status/Authority hooks ──
  if (lower.includes('senior') || lower.includes('expert'))
    return `SENIOR ENGINEERS\nDO THIS DIFFERENTLY`;
  if (lower.includes('config') || lower.includes('setting') || lower.includes('tuning'))
    return `THE ${T} CONFIG\nNOBODY CHECKS`;
  if (lower.includes('best') || lower.includes('practice'))
    return `BEST PRACTICE?\nACTUALLY, IT'S WRONG`;

  // ── Cognitive dissonance hooks ──
  if (lower.includes('safe') || lower.includes('default'))
    return `THE DEFAULT\nIS A TRAP`;
  if (lower.includes('wrong') || lower.includes('myth') || lower.includes('lie'))
    return `EVERYTHING YOU KNOW\nABOUT ${T} IS WRONG`;
  if (lower.includes('think') || lower.includes('assume') || lower.includes('obvious'))
    return `YOU THINK\nTHIS IS SAFE`;

  // ── Curiosity gap hooks ──
  if (lower.includes('secret') || lower.includes('hidden'))
    return `THE HIDDEN COST\nOF ${T}`;
  if (lower.includes('danger') || lower.includes('risk') || lower.includes('threat'))
    return `THE ${T} RISK\nNO ONE MENTIONS`;
  if (lower.includes('nobody') || lower.includes('no one') || lower.includes('rarely'))
    return `NOBODY TEACHES\nTHIS ABOUT ${T}`;

  // ── Interview hooks ──
  if (lower.includes('interview') || lower.includes('question'))
    return `THIS ${T} QUESTION\nFAILS 90% OF DEVS`;

  // ── Performance hooks ──
  if (lower.includes('latency') || lower.includes('slow') || lower.includes('performance'))
    return `WHY ${T}\nIS 100X SLOWER THAN YOU THINK`;
  if (lower.includes('scale') || lower.includes('million') || lower.includes('billion'))
    return `${T} AT SCALE\nBREAKS DIFFERENTLY`;

  // ── Aspiration/Positive hooks ──
  if (lower.includes('how') || lower.includes('build') || lower.includes('create'))
    return `${T} IN 45 SECONDS\nFINALLY EXPLAINED`;
  if (lower.includes('simple') || lower.includes('easy') || lower.includes('basic'))
    return `${T} CLICKS\nWHEN YOU SEE THIS`;
  if (lower.includes('pattern') || lower.includes('design') || lower.includes('architecture'))
    return `THE ${T} PATTERN\nTHAT CHANGES EVERYTHING`;

  // ── Challenge hooks ──
  if (lower.includes('solve') || lower.includes('debug') || lower.includes('fix'))
    return `CAN YOU SPOT\nTHE ${T} BUG?`;

  // ── Default: rotate between 5 formulas based on topic hash ──
  const hash = topic.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const defaults = [
    `${T} EXPLAINED\nIN 45 SECONDS`,
    `STOP USING\n${T} LIKE THIS`,
    `THE ${T} TRICK\nNOBODY TAUGHT YOU`,
    `WHY ${T}\nIS HARDER THAN YOU THINK`,
    `${T}: WHAT THEY\nDON'T TELL YOU`,
  ];
  return defaults[hash % defaults.length];
}

// ── calculateMetadata for registration ─────────────────────────────────────────
export function calculateViralShortMetadata({
  props,
}: {
  props: Record<string, unknown>;
}) {
  const sb = props.storyboard as Storyboard;
  if (!sb || !sb.scenes || sb.scenes.length === 0) {
    return { durationInFrames: 1800, fps: 60, width: 1080, height: 1920 };
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
  const contentSeconds = Math.min(duration, 48);
  const contentFrames = Math.round(contentSeconds * 60);
  const total = HOOK_FRAMES + contentFrames + CTA_FRAMES;

  return {
    durationInFrames: Math.min(total, MAX_TOTAL_FRAMES),
    fps: 60,
    width: 1080,
    height: 1920,
  };
}

export default ViralShort;
