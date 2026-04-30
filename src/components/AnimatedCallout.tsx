import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';

interface CalloutTrigger {
  keyword: string;
  emoji: string;
  label: string;
  color: string;
}

interface AnimatedCalloutProps {
  /** Current narration word (from sync.currentWord) */
  currentWord?: string;
  /** Total words spoken so far (from sync.wordsSpoken) */
  wordsSpoken?: number;
  /** Scene index for position variation */
  sceneIndex?: number;
}

// Keyword triggers: when the narrator says these words, a callout pops in
const CALLOUT_TRIGGERS: CalloutTrigger[] = [
  // Key points
  { keyword: 'important', emoji: '\u{1F4A1}', label: 'Key Point', color: COLORS.gold },
  { keyword: 'key', emoji: '\u{1F4A1}', label: 'Key Point', color: COLORS.gold },
  { keyword: 'remember', emoji: '\u{1F4A1}', label: 'Remember This', color: COLORS.gold },
  { keyword: 'note', emoji: '\u{1F4A1}', label: 'Key Point', color: COLORS.gold },
  { keyword: 'essential', emoji: '\u{1F4A1}', label: 'Essential', color: COLORS.gold },
  { keyword: 'fundamental', emoji: '\u{1F4A1}', label: 'Fundamental', color: COLORS.gold },

  // Common mistakes
  { keyword: 'mistake', emoji: '\u{26A0}\u{FE0F}', label: 'Common Mistake', color: COLORS.red },
  { keyword: 'error', emoji: '\u{26A0}\u{FE0F}', label: 'Watch Out', color: COLORS.red },
  { keyword: 'wrong', emoji: '\u{26A0}\u{FE0F}', label: 'Common Mistake', color: COLORS.red },
  { keyword: 'careful', emoji: '\u{26A0}\u{FE0F}', label: 'Be Careful', color: COLORS.red },
  { keyword: 'warning', emoji: '\u{26A0}\u{FE0F}', label: 'Warning', color: COLORS.red },
  { keyword: 'avoid', emoji: '\u{26A0}\u{FE0F}', label: 'Avoid This', color: COLORS.red },
  { keyword: 'never', emoji: '\u{26A0}\u{FE0F}', label: 'Never Do This', color: COLORS.red },
  { keyword: 'bug', emoji: '\u{26A0}\u{FE0F}', label: 'Bug Alert', color: COLORS.red },

  // Interview tips
  { keyword: 'interview', emoji: '\u{1F3AF}', label: 'Interview Tip', color: COLORS.teal },
  { keyword: 'asked', emoji: '\u{1F3AF}', label: 'Interview Tip', color: COLORS.teal },
  { keyword: 'faang', emoji: '\u{1F3AF}', label: 'FAANG Tip', color: COLORS.teal },
  { keyword: 'google', emoji: '\u{1F3AF}', label: 'Interview Tip', color: COLORS.teal },
  { keyword: 'amazon', emoji: '\u{1F3AF}', label: 'Interview Tip', color: COLORS.teal },
  { keyword: 'tip', emoji: '\u{1F3AF}', label: 'Pro Tip', color: COLORS.teal },
  { keyword: 'trick', emoji: '\u{1F3AF}', label: 'Pro Tip', color: COLORS.teal },
  { keyword: 'hint', emoji: '\u{1F3AF}', label: 'Hint', color: COLORS.teal },

  // Performance
  { keyword: 'optimize', emoji: '\u{26A1}', label: 'Optimization', color: COLORS.saffron },
  { keyword: 'performance', emoji: '\u{26A1}', label: 'Performance', color: COLORS.saffron },
  { keyword: 'faster', emoji: '\u{26A1}', label: 'Speed Boost', color: COLORS.saffron },
  { keyword: 'efficient', emoji: '\u{26A1}', label: 'Efficiency', color: COLORS.saffron },
  { keyword: 'complexity', emoji: '\u{26A1}', label: 'Complexity', color: COLORS.saffron },
];

/**
 * AnimatedCallout - Pop-in annotations triggered by keywords in narration.
 * Appears with spring animation, stays ~3 seconds, then fades out.
 * Uses Remotion's spring() and interpolate() for frame-accurate motion.
 */
const AnimatedCallout: React.FC<AnimatedCalloutProps> = ({
  currentWord = '',
  wordsSpoken = 0,
  sceneIndex = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Track triggered callouts with frame-based logic
  // A callout lasts ~3 seconds (90 frames at 30fps)
  const CALLOUT_DURATION = fps * 3;
  const COOLDOWN = fps * 5; // minimum frames between callouts

  // Find if current word matches any trigger
  const cleanWord = currentWord.toLowerCase().replace(/[^a-z]/g, '');
  const matchedTrigger = CALLOUT_TRIGGERS.find(t => cleanWord.includes(t.keyword));

  // Use a deterministic approach: trigger when word matches AND we're not in cooldown
  // We use wordsSpoken as a stable trigger point
  const triggerFrame = matchedTrigger ? frame : -999;

  // Simple state: show callout from trigger frame for CALLOUT_DURATION
  // Since we can't use state in Remotion, we show when the word is matched
  // and use the frame-since-match for timing
  const isActive = matchedTrigger !== undefined;

  if (!isActive) return null;

  // Spring entrance
  const entranceSpring = spring({
    frame: 0, // instant since we just detected
    fps,
    config: { damping: 11, stiffness: 180, mass: 0.7 },
  });

  const trigger = matchedTrigger!;

  // Position varies by scene index
  const positions = [
    { top: '12%', right: '4%' },
    { top: '18%', right: '3%' },
    { top: '8%', right: '5%' },
    { top: '15%', right: '3%' },
  ];
  const pos = positions[sceneIndex % positions.length];

  // Glow pulse
  const glowIntensity = interpolate(
    Math.sin(frame * 0.1),
    [-1, 1],
    [0.4, 0.8],
  );

  return (
    <div
      style={{
        position: 'absolute',
        ...pos,
        zIndex: 80,
        pointerEvents: 'none',
        transform: `scale(${entranceSpring}) translateX(${interpolate(entranceSpring, [0, 1], [40, 0])}px)`,
        opacity: entranceSpring,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          backgroundColor: `${COLORS.dark}E8`,
          backdropFilter: 'blur(12px)',
          borderRadius: 12,
          padding: '10px 18px',
          border: `1px solid ${trigger.color}40`,
          boxShadow: `0 4px 20px ${COLORS.dark}AA, 0 0 ${20 * glowIntensity}px ${trigger.color}22`,
        }}
      >
        <span style={{ fontSize: 20 }}>{trigger.emoji}</span>
        <span
          style={{
            fontSize: SIZES.caption,
            fontFamily: FONTS.text,
            fontWeight: 700,
            color: trigger.color,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          {trigger.label}
        </span>
      </div>

      {/* Connecting line to content area */}
      <div
        style={{
          position: 'absolute',
          bottom: -12,
          left: 20,
          width: 1,
          height: 12,
          background: `linear-gradient(180deg, ${trigger.color}40, transparent)`,
        }}
      />
    </div>
  );
};

export default AnimatedCallout;
