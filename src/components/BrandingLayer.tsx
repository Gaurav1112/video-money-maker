import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from 'remotion';

/**
 * BrandingLayer — Persistent guru-sishya.in branding throughout the video.
 *
 * Features:
 * 1. Bottom-right watermark on every frame (subtle, semi-transparent)
 * 2. Mid-video CTA card at ~50% mark (5 seconds)
 * 3. End card with full CTA (last 5 seconds before outro)
 */

interface BrandingLayerProps {
  /** Total duration of the composition in frames */
  durationInFrames: number;
  /** Whether to show mid-video CTA (default true) */
  showMidCta?: boolean;
  /** Format: 'long' for 16:9, 'short' for 9:16 */
  format?: 'long' | 'short';
  /** Topic slug for deep-linked URLs (e.g. "load-balancing") */
  topicSlug?: string;
}

export const BrandingLayer: React.FC<BrandingLayerProps> = ({
  durationInFrames,
  showMidCta = true,
  format = 'long',
  topicSlug,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isShort = format === 'short';

  // Watermark appears after intro (frame 90 for long, 45 for short)
  const watermarkStart = isShort ? 45 : 90;
  const watermarkEnd = durationInFrames - (isShort ? 90 : 150); // Before outro

  // Mid-video CTA at 50% mark (shows for 5 seconds = 150 frames)
  const midCtaStart = Math.round(durationInFrames * 0.5);
  const midCtaDuration = 150;

  // End CTA starts 10 seconds before outro
  const endCtaStart = watermarkEnd - 300; // 10s before outro
  const endCtaDuration = 300;

  // Lower-third CTA banner at ~10% of video duration (shows for 3 seconds = 90 frames)
  const lowerThirdStart = Math.round(durationInFrames * 0.1);
  const lowerThirdDuration = Math.round(fps * 3);

  return (
    <>
      {/* Lower-third CTA banner — slides up from bottom at 10% mark */}
      <Sequence from={lowerThirdStart} durationInFrames={lowerThirdDuration}>
        <LowerThirdCta topicSlug={topicSlug} format={format} />
      </Sequence>

      {/* Bottom-right subtle watermark — small, unobtrusive */}
      {frame >= watermarkStart && frame < watermarkEnd && (
        <div
          style={{
            position: 'absolute',
            top: isShort ? 16 : 20,
            right: isShort ? 16 : 30,
            opacity: 0.6,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(12, 10, 21, 0.65)',
            borderRadius: 8,
            padding: isShort ? '4px 10px' : '5px 12px',
            border: '1px solid rgba(232, 93, 38, 0.25)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span style={{
            fontSize: 14,
            fontFamily: "'Inter', system-ui, sans-serif",
            fontWeight: 600,
            color: '#E85D26',
            letterSpacing: 0.3,
          }}>
            guru-sishya.in
          </span>
        </div>
      )}

      {/* Mid-video CTA card */}
      {showMidCta && (
        <Sequence from={midCtaStart} durationInFrames={midCtaDuration}>
          <MidVideoCta format={format} />
        </Sequence>
      )}

      {/* End CTA card */}
      <Sequence from={endCtaStart} durationInFrames={endCtaDuration}>
        <EndCta format={format} />
      </Sequence>
    </>
  );
};

/** Lower-third CTA banner — dark pill with saffron border, slides up from bottom */
const LowerThirdCta: React.FC<{ topicSlug?: string; format: 'long' | 'short' }> = ({ topicSlug, format }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isShort = format === 'short';

  // Slide up over 10 frames, hold, slide down in last 10 frames
  const slideUp = spring({ frame, fps, config: { damping: 15, stiffness: 120 } });
  const totalFrames = Math.round(fps * 3);
  const slideDown = frame > totalFrames - 10
    ? interpolate(frame, [totalFrames - 10, totalFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0;

  const translateY = interpolate(slideUp, [0, 1], [80, 0]) + slideDown * 80;
  const opacity = slideUp * (1 - slideDown);

  const url = topicSlug ? `guru-sishya.in/${topicSlug}` : 'guru-sishya.in';

  return (
    <div
      style={{
        position: 'absolute',
        bottom: isShort ? 140 : 30,
        left: isShort ? 16 : 30,
        transform: `translateY(${translateY}px)`,
        opacity,
        zIndex: 200,
      }}
    >
      <div
        style={{
          background: 'rgba(12, 10, 21, 0.85)',
          border: '2px solid #E85D26',
          borderRadius: 24,
          padding: isShort ? '8px 16px' : '10px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          backdropFilter: 'blur(10px)',
        }}
      >
        <span style={{
          fontSize: isShort ? 14 : 17,
          fontFamily: "'Inter', system-ui, sans-serif",
          fontWeight: 600,
          color: '#fff',
        }}>
          Full notes & practice →
        </span>
        <span style={{
          fontSize: isShort ? 14 : 17,
          fontFamily: "'Inter', system-ui, sans-serif",
          fontWeight: 800,
          color: '#E85D26',
        }}>
          {url}
        </span>
      </div>
    </div>
  );
};

/** Mid-video CTA — slides in from right, stays, slides out */
const MidVideoCta: React.FC<{ format: 'long' | 'short' }> = ({ format }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isShort = format === 'short';

  // Slide in over 15 frames, hold, slide out in last 15 frames
  const slideIn = spring({ frame, fps, config: { damping: 15, stiffness: 120 } });
  const slideOut = frame > 120
    ? interpolate(frame, [120, 150], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0;

  const translateX = interpolate(slideIn, [0, 1], [300, 0]) + slideOut * 300;
  const opacity = slideIn * (1 - slideOut);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: isShort ? 200 : 80,
        right: isShort ? 20 : 40,
        transform: `translateX(${translateX}px)`,
        opacity,
        zIndex: 200,
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(232, 93, 38, 0.95), rgba(255, 150, 50, 0.95))',
          borderRadius: 16,
          padding: isShort ? '14px 20px' : '18px 28px',
          boxShadow: '0 8px 32px rgba(232, 93, 38, 0.4)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          maxWidth: isShort ? 280 : 360,
        }}
      >
        <div
          style={{
            fontSize: isShort ? 21 : 29,
            fontWeight: 800,
            color: '#fff',
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          Want to ace this in interviews?
        </div>
        <div
          style={{
            fontSize: isShort ? 16 : 20,
            color: 'rgba(255,255,255,0.9)',
            fontFamily: "'Inter', system-ui, sans-serif",
            lineHeight: 1.4,
          }}
        >
          1,988 questions + code playground + mock interviews
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 8,
          }}
        >
          <div style={{
            background: '#20C997',
            color: '#0C0A15',
            padding: '6px 16px',
            borderRadius: 8,
            fontSize: isShort ? 14 : 17,
            fontWeight: 800,
            fontFamily: "'Inter', system-ui, sans-serif",
          }}>
            100% FREE
          </div>
          <span style={{
            fontSize: isShort ? 18 : 23,
            fontWeight: 800,
            color: '#FFD700',
            fontFamily: "'Inter', system-ui, sans-serif",
          }}>
            www.guru-sishya.in
          </span>
        </div>
      </div>
    </div>
  );
};

/** End CTA — full-screen overlay with call to action */
const EndCta: React.FC<{ format: 'long' | 'short' }> = ({ format }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isShort = format === 'short';

  const fadeIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const scaleIn = spring({ frame, fps, config: { damping: 12, stiffness: 80 } });

  // Pulsing glow on the CTA
  const glowPulse = 0.6 + 0.4 * Math.sin(frame * 0.15);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(180deg, rgba(12, 10, 21, ${fadeIn * 0.85}) 0%, rgba(12, 10, 21, ${fadeIn * 0.95}) 100%)`,
        zIndex: 300,
        gap: isShort ? 20 : 30,
        padding: 40,
      }}
    >
      {/* Logo text */}
      <div
        style={{
          fontSize: isShort ? 36 : 56,
          fontWeight: 800,
          color: '#E85D26',
          fontFamily: "'Inter', system-ui, sans-serif",
          transform: `scale(${scaleIn})`,
          textShadow: `0 0 ${40 * glowPulse}px rgba(232, 93, 38, ${0.5 * glowPulse})`,
        }}
      >
        Guru Sishya
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: isShort ? 18 : 24,
          color: '#FFD700',
          fontFamily: "'Inter', system-ui, sans-serif",
          fontWeight: 600,
          opacity: fadeIn,
          textAlign: 'center',
        }}
      >
        Master Your Interview. Land Your Dream Job.
      </div>

      {/* Features */}
      <div
        style={{
          display: 'flex',
          gap: isShort ? 12 : 24,
          flexDirection: isShort ? 'column' : 'row',
          opacity: interpolate(frame, [15, 30], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        {['141 Topics', '1,988 Questions', 'Code Playground', 'FREE'].map((feature, i) => (
          <div
            key={feature}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(232, 93, 38, 0.3)',
              borderRadius: 10,
              padding: isShort ? '8px 16px' : '10px 20px',
              fontSize: isShort ? 13 : 16,
              color: '#fff',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 500,
              transform: `scale(${spring({ frame: frame - i * 5, fps, config: { damping: 15, stiffness: 100 } })})`,
            }}
          >
            {feature}
          </div>
        ))}
      </div>

      {/* URL with glow */}
      <div
        style={{
          fontSize: isShort ? 28 : 40,
          fontWeight: 800,
          color: '#fff',
          fontFamily: "'Inter', system-ui, sans-serif",
          opacity: interpolate(frame, [25, 45], [0, 1], { extrapolateRight: 'clamp' }),
          textShadow: `0 0 30px rgba(232, 93, 38, ${0.8 * glowPulse}), 0 0 60px rgba(232, 93, 38, ${0.4 * glowPulse})`,
          background: 'linear-gradient(90deg, #E85D26, #FFD700)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginTop: 10,
        }}
      >
        guru-sishya.in
      </div>

      {/* Subscribe CTA */}
      <div
        style={{
          fontSize: isShort ? 14 : 18,
          color: 'rgba(255,255,255,0.7)',
          fontFamily: "'Inter', system-ui, sans-serif",
          opacity: interpolate(frame, [35, 50], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        Subscribe for daily coding lessons
      </div>
    </div>
  );
};
