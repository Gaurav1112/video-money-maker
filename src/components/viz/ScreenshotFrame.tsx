import React from 'react';
import {
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  staticFile,
  Img,
} from 'remotion';
import type { VisualBeat } from '../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ScreenshotHighlight {
  x: number;          // percentage 0-100
  y: number;          // percentage 0-100
  width: number;      // percentage 0-100
  height: number;     // percentage 0-100
  label?: string;
  beatIndex: number;  // when to show this highlight
}

export interface ScreenshotFrameProps {
  src: string;          // path relative to public/
  type: 'browser' | 'terminal' | 'ide';
  title?: string;       // tab title or filename
  highlights?: ScreenshotHighlight[];
  beats: VisualBeat[];
  fps: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const FRAME_W = 1600;
const FRAME_H = 900;
const TITLE_BAR_H = 40;
const TAB_BAR_H = 36;

// Color palettes per frame type
const THEME = {
  browser: {
    titleBg: '#DEE1E6',
    tabBg: '#F1F3F4',
    tabActive: '#FFFFFF',
    border: '#C4C7CC',
    addressBg: '#FFFFFF',
    addressBorder: '#DADCE0',
    dot1: '#FF5F57',
    dot2: '#FFBD2E',
    dot3: '#28C840',
    contentBg: '#1E1E2E',
  },
  terminal: {
    titleBg: '#2D2D2D',
    border: '#1A1A1A',
    dot1: '#FF5F57',
    dot2: '#FFBD2E',
    dot3: '#28C840',
    contentBg: '#1E1E2E',
    text: '#4AF626',
  },
  ide: {
    titleBg: '#323233',
    tabBg: '#2D2D2D',
    tabActive: '#1E1E1E',
    border: '#1A1A1A',
    sidebarBg: '#252526',
    dot1: '#FF5F57',
    dot2: '#FFBD2E',
    dot3: '#28C840',
    contentBg: '#1E1E1E',
    gutterBg: '#1E1E1E',
    gutterText: '#858585',
  },
} as const;

// ---------------------------------------------------------------------------
// Traffic light dots
// ---------------------------------------------------------------------------
const TrafficLights: React.FC<{ d1: string; d2: string; d3: string }> = ({
  d1, d2, d3,
}) => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
    <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: d1 }} />
    <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: d2 }} />
    <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: d3 }} />
  </div>
);

// ---------------------------------------------------------------------------
// Active beat index helper
// ---------------------------------------------------------------------------
function getActiveBeatIndex(frame: number, fps: number, beats: VisualBeat[]): number {
  const timeSec = frame / fps;
  let active = -1;
  for (const b of beats) {
    if (timeSec >= b.startTime) {
      active = b.beatIndex;
    }
  }
  return active;
}

// ---------------------------------------------------------------------------
// Browser Frame
// ---------------------------------------------------------------------------
const BrowserFrame: React.FC<{
  title?: string;
  children: React.ReactNode;
}> = ({ title, children }) => {
  const t = THEME.browser;
  return (
    <div
      style={{
        width: FRAME_W,
        height: FRAME_H,
        borderRadius: 12,
        overflow: 'hidden',
        border: `1px solid ${t.border}`,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* Title bar */}
      <div
        style={{
          height: TITLE_BAR_H,
          backgroundColor: t.titleBg,
          display: 'flex',
          alignItems: 'center',
          padding: '0 14px',
          gap: 12,
        }}
      >
        <TrafficLights d1={t.dot1} d2={t.dot2} d3={t.dot3} />
        {/* Tab */}
        <div
          style={{
            backgroundColor: t.tabActive,
            borderRadius: '8px 8px 0 0',
            padding: '6px 16px',
            fontSize: 12,
            color: '#333',
            fontFamily: 'Inter, sans-serif',
            maxWidth: 200,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title || 'New Tab'}
        </div>
      </div>
      {/* Address bar */}
      <div
        style={{
          height: 32,
          backgroundColor: t.titleBg,
          padding: '0 14px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            flex: 1,
            height: 24,
            backgroundColor: t.addressBg,
            borderRadius: 12,
            border: `1px solid ${t.addressBorder}`,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 12,
            fontSize: 12,
            color: '#666',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          🔒 https://example.com
        </div>
      </div>
      {/* Content area */}
      <div
        style={{
          flex: 1,
          backgroundColor: t.contentBg,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Terminal Frame
// ---------------------------------------------------------------------------
const TerminalFrame: React.FC<{
  title?: string;
  children: React.ReactNode;
}> = ({ title, children }) => {
  const t = THEME.terminal;
  return (
    <div
      style={{
        width: FRAME_W,
        height: FRAME_H,
        borderRadius: 12,
        overflow: 'hidden',
        border: `1px solid ${t.border}`,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* Title bar */}
      <div
        style={{
          height: TITLE_BAR_H,
          backgroundColor: t.titleBg,
          display: 'flex',
          alignItems: 'center',
          padding: '0 14px',
          gap: 12,
        }}
      >
        <TrafficLights d1={t.dot1} d2={t.dot2} d3={t.dot3} />
        <div
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 13,
            color: '#CCCCCC',
            fontFamily: 'monospace',
          }}
        >
          {title || 'Terminal — bash'}
        </div>
      </div>
      {/* Content area */}
      <div
        style={{
          flex: 1,
          backgroundColor: t.contentBg,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// IDE Frame
// ---------------------------------------------------------------------------
const IDEFrame: React.FC<{
  title?: string;
  children: React.ReactNode;
}> = ({ title, children }) => {
  const t = THEME.ide;
  return (
    <div
      style={{
        width: FRAME_W,
        height: FRAME_H,
        borderRadius: 12,
        overflow: 'hidden',
        border: `1px solid ${t.border}`,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* Title bar */}
      <div
        style={{
          height: TITLE_BAR_H,
          backgroundColor: t.titleBg,
          display: 'flex',
          alignItems: 'center',
          padding: '0 14px',
          gap: 12,
        }}
      >
        <TrafficLights d1={t.dot1} d2={t.dot2} d3={t.dot3} />
        <div
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 13,
            color: '#CCCCCC',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Visual Studio Code
        </div>
      </div>
      {/* Tab bar */}
      <div
        style={{
          height: TAB_BAR_H,
          backgroundColor: t.tabBg,
          display: 'flex',
          alignItems: 'flex-end',
        }}
      >
        <div
          style={{
            backgroundColor: t.tabActive,
            padding: '6px 20px',
            fontSize: 13,
            color: '#FFFFFF',
            fontFamily: 'monospace',
            borderTop: '2px solid #007ACC',
          }}
        >
          {title || 'index.ts'}
        </div>
      </div>
      {/* Content area with sidebar hint + gutter */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Sidebar hint */}
        <div
          style={{
            width: 48,
            backgroundColor: t.sidebarBg,
            borderRight: `1px solid ${t.border}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 12,
            gap: 16,
          }}
        >
          {/* File explorer icon */}
          <div style={{ width: 20, height: 20, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' }} />
          <div style={{ width: 20, height: 20, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <div style={{ width: 20, height: 20, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        </div>
        {/* Line number gutter */}
        <div
          style={{
            width: 48,
            backgroundColor: t.gutterBg,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            paddingTop: 8,
            paddingRight: 8,
            gap: 2,
          }}
        >
          {Array.from({ length: 30 }, (_, i) => (
            <div
              key={i}
              style={{
                fontSize: 12,
                color: t.gutterText,
                fontFamily: 'monospace',
                lineHeight: '20px',
              }}
            >
              {i + 1}
            </div>
          ))}
        </div>
        {/* Main content */}
        <div
          style={{
            flex: 1,
            backgroundColor: t.contentBg,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Placeholder panel (shown when no screenshot file exists)
// ---------------------------------------------------------------------------
const PlaceholderPanel: React.FC<{ type: string; title?: string }> = ({ type, title }) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 12,
      backgroundColor: '#12101E',
    }}
  >
    <div style={{ fontSize: 48, opacity: 0.3 }}>
      {type === 'browser' ? '🌐' : type === 'terminal' ? '💻' : '📝'}
    </div>
    <div
      style={{
        fontSize: 16,
        color: 'rgba(255,255,255,0.25)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {title || 'Screenshot placeholder'}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export const ScreenshotFrame: React.FC<ScreenshotFrameProps> = ({
  src,
  type,
  title,
  highlights = [],
  beats,
  fps,
}) => {
  const frame = useCurrentFrame();
  const { fps: vFps } = useVideoConfig();
  const activeBeatIndex = getActiveBeatIndex(frame, fps, beats);

  // Frame entrance animation
  const entrance = spring({
    frame,
    fps: vFps,
    config: { damping: 18, stiffness: 80, mass: 1 },
  });
  const scale = interpolate(entrance, [0, 1], [0.92, 1]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  // Determine if src file likely exists (we just attempt to render)
  const hasSrc = src && src.length > 0;

  // Select frame wrapper
  const FrameWrapper =
    type === 'browser'
      ? BrowserFrame
      : type === 'terminal'
        ? TerminalFrame
        : IDEFrame;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      <FrameWrapper title={title}>
        {/* Screenshot image or placeholder */}
        {hasSrc ? (
          <Img
            src={staticFile(src)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            onError={() => {
              // Silently fail — placeholder will show through
            }}
          />
        ) : (
          <PlaceholderPanel type={type} title={title} />
        )}

        {/* Highlight overlays */}
        {highlights.map((hl, idx) => {
          if (hl.beatIndex > activeBeatIndex) return null;

          const hlEntrance = spring({
            frame: Math.max(0, frame - hl.beatIndex * (fps * 0.4)),
            fps: vFps,
            config: { damping: 14, stiffness: 120, mass: 0.6 },
          });
          const hlOpacity = interpolate(hlEntrance, [0, 1], [0, 1]);
          const hlScale = interpolate(hlEntrance, [0, 1], [0.9, 1]);

          return (
            <div
              key={`hl-${idx}`}
              style={{
                position: 'absolute',
                left: `${hl.x}%`,
                top: `${hl.y}%`,
                width: `${hl.width}%`,
                height: `${hl.height}%`,
                border: '2px solid rgba(253, 184, 19, 0.8)',
                backgroundColor: 'rgba(253, 184, 19, 0.15)',
                borderRadius: 4,
                opacity: hlOpacity,
                transform: `scale(${hlScale})`,
                transformOrigin: 'top left',
                pointerEvents: 'none',
              }}
            >
              {hl.label && (
                <div
                  style={{
                    position: 'absolute',
                    top: -24,
                    left: 0,
                    backgroundColor: 'rgba(253, 184, 19, 0.9)',
                    color: '#0C0A15',
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'Inter, sans-serif',
                    padding: '2px 8px',
                    borderRadius: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {hl.label}
                </div>
              )}
            </div>
          );
        })}
      </FrameWrapper>
    </div>
  );
};

export default ScreenshotFrame;
