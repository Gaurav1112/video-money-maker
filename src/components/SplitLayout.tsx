import React from 'react';
import type { ReactNode } from 'react';

interface SplitLayoutProps {
  left: ReactNode;
  right: ReactNode;
  leftWidth?: string;
  rightWidth?: string;
}

export const SplitLayout: React.FC<SplitLayoutProps> = ({
  left,
  right,
  leftWidth = '55%',
  rightWidth = '45%',
}) => {
  return (
    <div style={{
      display: 'flex',
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
    }}>
      <div style={{ flex: `0 0 ${leftWidth}`, overflow: 'hidden', position: 'relative' }}>{left}</div>
      <div style={{
        flex: `0 0 ${rightWidth}`,
        overflow: 'hidden',
        position: 'relative',
        background: 'rgba(12, 10, 21, 0.5)',
        borderLeft: '1px solid rgba(232, 93, 38, 0.15)',
      }}>{right}</div>
    </div>
  );
};
