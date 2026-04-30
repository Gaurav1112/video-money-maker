import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate, useVideoConfig, spring } from 'remotion';

interface BrowserSceneProps {
  url: string;
  content: React.ReactNode | string;
  title?: string;
  startFrame?: number;
  sceneIndex?: number;
  sceneStartFrame?: number;
  sceneDurationFrames?: number;
}

/**
 * Realistic Chrome-style browser window.
 * Shows a URL bar, tab, navigation controls, and content area.
 */
export const BrowserScene: React.FC<BrowserSceneProps> = ({
  url,
  content,
  title = 'Browser',
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Window entrance
  const entrance = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 80, mass: 1 },
  });
  const windowScale = interpolate(entrance, [0, 1], [0.92, 1]);
  const windowOpacity = interpolate(entrance, [0, 1], [0, 1]);

  // Loading bar animation (fills in first 30 frames)
  const loadingProgress = interpolate(frame, [0, 30], [0, 100], {
    extrapolateRight: 'clamp',
  });
  const loadingOpacity = interpolate(frame, [28, 35], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Content fade in after loading
  const contentOpacity = interpolate(frame, [20, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0D0D1A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 60,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          maxWidth: 1600,
          maxHeight: 900,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 25px 80px rgba(0,0,0,0.6)',
          transform: `scale(${windowScale})`,
          opacity: windowOpacity,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#FFFFFF',
        }}
      >
        {/* Chrome title bar with tab */}
        <div
          style={{
            backgroundColor: '#DEE1E6',
            height: 38,
            display: 'flex',
            alignItems: 'flex-end',
            padding: '0 8px',
            gap: 0,
          }}
        >
          {/* Traffic dots */}
          <div style={{ display: 'flex', gap: 7, alignItems: 'center', padding: '0 8px', height: '100%' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#FF5F57' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#FFBD2E' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#28CA41' }} />
          </div>

          {/* Tab */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '8px 8px 0 0',
              padding: '6px 16px',
              marginLeft: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              maxWidth: 240,
              height: 32,
            }}
          >
            {/* Favicon circle */}
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                backgroundColor: '#4ADE80',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 12,
                color: '#333',
                fontFamily: "'Inter', system-ui, sans-serif",
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {title}
            </span>
            {/* Close button */}
            <span
              style={{
                fontSize: 14,
                color: '#999',
                marginLeft: 'auto',
                cursor: 'pointer',
              }}
            >
              ×
            </span>
          </div>
        </div>

        {/* URL bar */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            height: 44,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            gap: 8,
            borderBottom: '1px solid #E5E7EB',
            position: 'relative',
          }}
        >
          {/* Navigation buttons */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {/* Back arrow */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 15L7 10L12 5" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {/* Forward arrow */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M8 5L13 10L8 15" stroke="#DADCE0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {/* Reload */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M3 9a6 6 0 0111.196-3M15 9a6 6 0 01-11.196 3"
                stroke="#9CA3AF"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path d="M14.5 3v3.5H11" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* URL pill */}
          <div
            style={{
              flex: 1,
              backgroundColor: '#F1F3F4',
              borderRadius: 20,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              padding: '0 14px',
              gap: 6,
            }}
          >
            {/* Lock icon */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="3" y="6" width="8" height="6" rx="1" stroke="#5F6368" strokeWidth="1.2" />
              <path d="M5 6V4a2 2 0 014 0v2" stroke="#5F6368" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span
              style={{
                fontSize: 14,
                color: '#5F6368',
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              {url}
            </span>
          </div>

          {/* Bookmark star */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 3l2.09 4.26L17 8.27l-3.5 3.41.82 4.82L10 14.27l-4.32 2.23.82-4.82L3 8.27l4.91-1.01L10 3z"
              stroke="#9CA3AF"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>

          {/* Loading bar */}
          {loadingProgress < 100 && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: 3,
                width: `${loadingProgress}%`,
                backgroundColor: '#4285F4',
                opacity: loadingOpacity,
                borderRadius: '0 2px 2px 0',
              }}
            />
          )}
        </div>

        {/* Content area */}
        <div
          style={{
            flex: 1,
            backgroundColor: '#FFFFFF',
            padding: 32,
            overflow: 'hidden',
            opacity: contentOpacity,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 18,
            lineHeight: 1.6,
            color: '#1F2937',
          }}
        >
          {typeof content === 'string' ? (
            <pre
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 18,
                lineHeight: 1.6,
              }}
            >
              {content}
            </pre>
          ) : (
            content
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default BrowserScene;
