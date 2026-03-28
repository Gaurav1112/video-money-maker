import React from 'react';
import { interpolate } from 'remotion';
import type { SyncState } from '../types';

interface MetricCounterProps {
  value: number;
  label: string;
  suffix?: string;
  sync: SyncState;
  triggerWordIndex: number;
  frame: number;
  startFrame: number;
}

export const MetricCounter: React.FC<MetricCounterProps> = ({
  value,
  label,
  suffix = '',
  sync,
  triggerWordIndex,
  frame,
  startFrame,
}) => {
  const isTriggered = sync.wordIndex >= triggerWordIndex;
  const triggerFrame = isTriggered ? frame - startFrame : 0;

  const countDuration = 45;
  const countProgress = isTriggered
    ? interpolate(triggerFrame, [0, countDuration], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: (t) => 1 - Math.pow(2, -10 * t), // easeOutExpo
      })
    : 0;

  const displayValue = Math.round(value * countProgress);
  const formatted = displayValue.toLocaleString() + suffix;

  return (
    <div style={{ textAlign: 'center', padding: 16 }}>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 48,
          fontWeight: 700,
          color: isTriggered ? '#FFD700' : '#A9ACB3',
          opacity: isTriggered ? 1 : 0.3,
        }}
      >
        {isTriggered ? formatted : '—'}
      </div>
      <div
        style={{
          fontSize: 16,
          color: '#A9ACB3',
          fontFamily: "'Inter', system-ui, sans-serif",
          marginTop: 8,
        }}
      >
        {label}
      </div>
    </div>
  );
};
