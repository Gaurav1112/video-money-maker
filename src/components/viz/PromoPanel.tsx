import React from 'react';
import { interpolate, spring, useVideoConfig, useCurrentFrame } from 'remotion';
import type { SyncState } from '../../types';

interface PromoPanelProps {
  sync: SyncState;
  frame: number;
  keywords: string[];
}

// Rotating promo cards — each shows for ~5 seconds
const PROMO_CARDS = [
  {
    stat: '138',
    label: 'Topics Covered',
    detail: 'System Design • DSA • CS Fundamentals',
    color: '#E85D26',
  },
  {
    stat: '1,933',
    label: 'Practice Questions',
    detail: 'With detailed explanations & code',
    color: '#FFD700',
  },
  {
    stat: 'FREE',
    label: 'Code Playground',
    detail: 'Python • Java • JavaScript • C++',
    color: '#20C997',
  },
  {
    stat: '671',
    label: 'Video Sessions',
    detail: 'Complete learning path for every topic',
    color: '#818CF8',
  },
  {
    stat: '100%',
    label: 'Free to Start',
    detail: 'No credit card • No signup required',
    color: '#E85D26',
  },
];

export const PromoPanel: React.FC<PromoPanelProps> = ({ sync, frame, keywords }) => {
  const { fps } = useVideoConfig();

  // Rotate cards every 5 seconds (150 frames)
  const cardDuration = 150;
  const activeIndex = Math.floor(frame / cardDuration) % PROMO_CARDS.length;
  const cardLocalFrame = frame % cardDuration;
  const card = PROMO_CARDS[activeIndex];

  // Card entrance animation
  const cardSpring = spring({
    frame: cardLocalFrame,
    fps,
    config: { damping: 14, stiffness: 100 },
  });

  // Fade out at end of each card
  const fadeOut = interpolate(cardLocalFrame, [cardDuration - 20, cardDuration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const opacity = cardSpring * fadeOut;
  const translateY = interpolate(cardSpring, [0, 1], [60, 0]);

  // Animated stat counter
  const countProgress = interpolate(cardLocalFrame, [0, fps * 0.8], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const eased = 1 - Math.pow(1 - countProgress, 3);

  const statNum = parseFloat(card.stat.replace(/[^0-9.]/g, ''));
  const isNumber = !isNaN(statNum) && card.stat !== 'FREE';
  const displayStat = isNumber
    ? Math.round(statNum * eased).toLocaleString() + (card.stat.includes('%') ? '%' : '')
    : card.stat;

  // Pulsing glow
  const glowPulse = 0.5 + 0.5 * Math.sin(frame * 0.08);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 30,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background accent glow */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${card.color}15, transparent 70%)`,
        filter: 'blur(40px)',
      }} />

      {/* Main promo card */}
      <div style={{
        transform: `translateY(${translateY}px)`,
        opacity,
        textAlign: 'center',
        zIndex: 1,
      }}>
        {/* Big stat number */}
        <div style={{
          fontSize: 96,
          fontWeight: 900,
          color: card.color,
          fontFamily: "'Inter', system-ui, sans-serif",
          lineHeight: 1,
          textShadow: `0 0 ${60 * glowPulse}px ${card.color}60, 0 0 ${100 * glowPulse}px ${card.color}30`,
          marginBottom: 14,
        }}>
          {displayStat}
        </div>

        {/* Label */}
        <div style={{
          fontSize: 22,
          fontWeight: 700,
          color: '#fff',
          fontFamily: "'Inter', system-ui, sans-serif",
          marginBottom: 8,
        }}>
          {card.label}
        </div>

        {/* Detail */}
        <div style={{
          fontSize: 14,
          color: '#A9ACB3',
          fontFamily: "'Inter', system-ui, sans-serif",
          lineHeight: 1.4,
        }}>
          {card.detail}
        </div>
      </div>

      {/* Brand footer */}
      <div style={{
        position: 'absolute',
        bottom: 40,
        textAlign: 'center',
        opacity: 0.95,
      }}>
        <div style={{
          fontSize: 24,
          fontWeight: 800,
          color: '#E85D26',
          fontFamily: "'Inter', system-ui, sans-serif",
          textShadow: `0 0 ${20 * glowPulse}px rgba(232, 93, 38, ${0.7 * glowPulse}), 0 0 ${40 * glowPulse}px rgba(232, 93, 38, ${0.35 * glowPulse})`,
          letterSpacing: 0.5,
        }}>
          www.guru-sishya.in
        </div>
        <div style={{
          fontSize: 14,
          color: '#FFD700',
          fontFamily: "'Inter', system-ui, sans-serif",
          fontWeight: 600,
          marginTop: 5,
          letterSpacing: 0.3,
        }}>
          Master Your Interview
        </div>
      </div>

      {/* Rotating dots indicator */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        display: 'flex',
        gap: 6,
      }}>
        {PROMO_CARDS.map((_, i) => (
          <div key={i} style={{
            width: i === activeIndex ? 16 : 6,
            height: 6,
            borderRadius: 3,
            background: i === activeIndex ? card.color : '#333',
            transition: 'width 0.2s',
          }} />
        ))}
      </div>
    </div>
  );
};
