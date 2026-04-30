import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { TransitionPresentation, TransitionPresentationComponentProps } from '@remotion/transitions';

type SlideProps = TransitionPresentationComponentProps<Record<string, unknown>>;

// --- Clock Wipe: circular reveal using conic-gradient clip-path ---
export function clockWipe(): TransitionPresentation<Record<string, unknown>> {
  return {
    component: ({ presentationDirection, presentationProgress, children }: SlideProps) => {
      const progress = presentationDirection === 'entering' ? presentationProgress : 1;
      const angle = progress * 360;
      return (
        <AbsoluteFill
          style={{
            clipPath: `polygon(50% 50%, 50% 0%, ${angle > 90 ? '100% 0%' : `${50 + 50 * Math.tan((angle * Math.PI) / 180)}% 0%`}${angle > 90 ? `, 100% ${angle > 180 ? '100%' : `${50 * Math.tan(((angle - 90) * Math.PI) / 180)}%`}` : ''}${angle > 180 ? `, ${angle > 270 ? '0%' : `${100 - 50 * Math.tan(((angle - 180) * Math.PI) / 180)}%`} 100%` : ''}${angle > 270 ? `, 0% ${100 - 50 * Math.tan(((angle - 270) * Math.PI) / 180)}%` : ''})`,
          }}
        >
          {children}
        </AbsoluteFill>
      );
    },
    props: {},
  };
}

// --- Iris: circular reveal from center ---
export function iris(): TransitionPresentation<Record<string, unknown>> {
  return {
    component: ({ presentationDirection, presentationProgress, children }: SlideProps) => {
      const progress = presentationDirection === 'entering' ? presentationProgress : 1;
      const radius = progress * 150; // percentage — 150% covers full frame diagonally
      return (
        <AbsoluteFill
          style={{
            clipPath: `circle(${radius}% at 50% 50%)`,
          }}
        >
          {children}
        </AbsoluteFill>
      );
    },
    props: {},
  };
}

// --- Flip: 2D scaleX flip (safe for headless Chrome) ---
export function flip(): TransitionPresentation<Record<string, unknown>> {
  return {
    component: ({ presentationDirection, presentationProgress, children }: SlideProps) => {
      const isEntering = presentationDirection === 'entering';
      // Exiting: scaleX 1 → 0 (first half). Entering: scaleX 0 → 1 (second half).
      const scaleX = isEntering ? presentationProgress : 1 - presentationProgress;
      return (
        <AbsoluteFill
          style={{
            transform: `scaleX(${scaleX})`,
            opacity: scaleX < 0.05 ? 0 : 1,
          }}
        >
          {children}
        </AbsoluteFill>
      );
    },
    props: {},
  };
}
