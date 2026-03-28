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
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <div style={{ flex: `0 0 ${leftWidth}`, overflow: 'hidden' }}>{left}</div>
      <div style={{ flex: `0 0 ${rightWidth}`, overflow: 'hidden' }}>{right}</div>
    </div>
  );
};
