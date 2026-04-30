import React from 'react';
import { AbsoluteFill } from 'remotion';
import { FONTS } from '../lib/theme';

export interface ThumbnailProps {
  topic: string;
  sessionNumber: number;
  hookText: string;
  category?: string;
  language?: string;
}

/**
 * Topic-aware color palettes for gradient backgrounds.
 * Returns [primaryColor, secondaryColor, glowColor].
 */
function getTopicColors(topic: string): [string, string, string] {
  const lower = topic.toLowerCase();

  // Infrastructure / DevOps — deep blue
  if (['load balanc', 'scaling', 'server', 'deploy', 'ci/cd', 'cdn', 'edge', 'cloudflare', 'docker', 'kubernetes', 'nginx'].some(k => lower.includes(k))) {
    return ['#1E3A8A', '#0EA5E9', '#3B82F6'];
  }
  // Messaging / Streaming — amber/orange
  if (['kafka', 'rabbit', 'message', 'queue', 'event', 'pub/sub', 'stream'].some(k => lower.includes(k))) {
    return ['#7C2D12', '#F97316', '#FB923C'];
  }
  // Database / Storage — emerald green
  if (['database', 'sql', 'nosql', 'postgres', 'mongo', 'redis', 'cache', 'memcache', 'storage'].some(k => lower.includes(k))) {
    return ['#064E3B', '#10B981', '#34D399'];
  }
  // Algorithms / DSA — teal
  if (['algo', 'sort', 'tree', 'graph', 'array', 'string', 'hash', 'dynamic', 'dp', 'recursion', 'stack', 'queue', 'linked list', 'binary', 'bfs', 'dfs', 'greedy'].some(k => lower.includes(k))) {
    return ['#134E4A', '#14B8A6', '#5EEAD4'];
  }
  // Design Patterns / Architecture — purple
  if (['design pattern', 'architecture', 'system design', 'microservice', 'pattern', 'solid', 'clean'].some(k => lower.includes(k))) {
    return ['#4C1D95', '#8B5CF6', '#A78BFA'];
  }
  // Networking — indigo
  if (['network', 'tcp', 'http', 'dns', 'api', 'rest', 'graphql', 'grpc', 'gateway', 'proxy'].some(k => lower.includes(k))) {
    return ['#312E81', '#6366F1', '#818CF8'];
  }
  // Security — red/crimson
  if (['security', 'auth', 'oauth', 'jwt', 'encrypt', 'rate limit', 'throttl', 'firewall'].some(k => lower.includes(k))) {
    return ['#7F1D1D', '#EF4444', '#FCA5A5'];
  }
  // Frontend — pink/rose
  if (['react', 'frontend', 'css', 'html', 'vue', 'angular', 'next', 'svelte'].some(k => lower.includes(k))) {
    return ['#831843', '#EC4899', '#F9A8D4'];
  }
  // Concurrency — cyan
  if (['concurrency', 'thread', 'async', 'parallel', 'goroutine'].some(k => lower.includes(k))) {
    return ['#164E63', '#06B6D4', '#67E8F9'];
  }
  // Default — ocean blue
  return ['#1E3A8A', '#3B82F6', '#60A5FA'];
}

/** Format topic name for display */
function formatTopic(topic: string): string {
  return topic
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Code-like background text lines for the tech grid pattern */
const CODE_LINES = [
  'const server = createServer();',
  'async function handle(req) {',
  '  return await process(data);',
  'if (cache.has(key)) return;',
  'export default config;',
  'for (let i = 0; i < n; i++) {',
  '  nodes.push(new Node());',
  'class MessageBroker {',
  '  subscribe(topic, handler);',
  'await db.query(sql, params);',
  'function partition(arr, lo, hi)',
  'const result = map.get(hash);',
  'while (queue.length > 0) {',
  'import { Router } from "express"',
  'app.listen(PORT, () => {});',
];

export const ThumbnailComposition: React.FC<ThumbnailProps> = ({
  topic,
  sessionNumber,
  hookText,
}) => {
  const [bgDark, accent, glow] = getTopicColors(topic);
  const displayTopic = formatTopic(topic);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, #0A0A0F 0%, ${bgDark} 50%, #0A0A0F 100%)`,
        fontFamily: FONTS.heading,
        overflow: 'hidden',
      }}
    >
      {/* Tech grid / code background pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.06,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Faint code text in background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          opacity: 0.04,
        }}
      >
        {CODE_LINES.map((line, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 30 + i * 48,
              left: (i % 3) * 200 + 20,
              fontSize: 16,
              fontFamily: FONTS.code,
              color: '#FFFFFF',
              whiteSpace: 'nowrap',
              transform: `rotate(-3deg)`,
            }}
          >
            {line}
          </div>
        ))}
      </div>

      {/* Radial glow - top right */}
      <div
        style={{
          position: 'absolute',
          top: -200,
          right: -150,
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accent}40 0%, ${accent}15 35%, transparent 65%)`,
        }}
      />

      {/* Radial glow - bottom left */}
      <div
        style={{
          position: 'absolute',
          bottom: -250,
          left: -200,
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${glow}25 0%, transparent 55%)`,
        }}
      />

      {/* Topic badge at top */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: 60,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: '#FFFFFF',
            backgroundColor: accent,
            padding: '10px 30px',
            borderRadius: 50,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            boxShadow: `0 4px 20px ${accent}80, 0 0 40px ${accent}30`,
          }}
        >
          {displayTopic}
        </div>
      </div>

      {/* Bold hook text - centered */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '100px 80px 80px 80px',
        }}
      >
        <div
          style={{
            fontSize: hookText.length > 25 ? 64 : 72,
            fontWeight: 900,
            color: '#FFFFFF',
            textAlign: 'center',
            lineHeight: 1.15,
            letterSpacing: -1.5,
            textShadow: `0 4px 12px rgba(0,0,0,0.8), 0 0 40px ${accent}50, 0 2px 4px rgba(0,0,0,0.9)`,
            maxWidth: 1100,
          }}
        >
          {hookText}
        </div>
      </div>

      {/* SESSION X badge at bottom-right */}
      <div
        style={{
          position: 'absolute',
          bottom: 36,
          right: 50,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: '#FFFFFF',
            backgroundColor: `${accent}CC`,
            padding: '8px 24px',
            borderRadius: 50,
            letterSpacing: 2,
            textTransform: 'uppercase',
            boxShadow: `0 4px 16px ${accent}60`,
            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
          }}
        >
          SESSION {sessionNumber}
        </div>
      </div>

      {/* Brand watermark - bottom left */}
      <div
        style={{
          position: 'absolute',
          bottom: 36,
          left: 60,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 900,
            color: accent,
            letterSpacing: 3,
            textTransform: 'uppercase',
            textShadow: `0 2px 8px rgba(0,0,0,0.6)`,
          }}
        >
          Guru Sishya
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#94A3B8',
            letterSpacing: 2,
            marginTop: 2,
            textShadow: '0 1px 4px rgba(0,0,0,0.5)',
          }}
        >
          guru-sishya.in
        </div>
      </div>

      {/* Bottom accent bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          background: `linear-gradient(90deg, ${accent}, ${glow}, ${accent})`,
          boxShadow: `0 0 20px ${accent}60`,
        }}
      />
    </AbsoluteFill>
  );
};

export default ThumbnailComposition;
