import React from 'react';
import { AbsoluteFill } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';

export interface ThumbnailProps {
  topic: string;
  sessionNumber: number;
  category?: string;
  language?: string;
  emoji?: string;
}

/** Map topic keywords to relevant emoji icons */
function getTopicEmoji(topic: string): string {
  const lower = topic.toLowerCase();
  const emojiMap: Array<[string[], string]> = [
    [['load balanc', 'scaling', 'horizontal'], '\u2696\uFE0F'],
    [['database', 'sql', 'nosql', 'postgres', 'mongo'], '\U0001F5C4\uFE0F'],
    [['cache', 'redis', 'memcache'], '\u26A1'],
    [['api', 'rest', 'graphql', 'grpc'], '\U0001F310'],
    [['tree', 'binary', 'bst', 'trie'], '\U0001F333'],
    [['graph', 'bfs', 'dfs', 'dijkstra'], '\U0001F578\uFE0F'],
    [['array', 'string', 'hash'], '\U0001F4CB'],
    [['stack', 'queue', 'linked list'], '\U0001F4DA'],
    [['sort', 'merge', 'quick', 'heap'], '\U0001F4CA'],
    [['dynamic', 'dp', 'recursion'], '\U0001F9E9'],
    [['system design', 'architecture'], '\U0001F3D7\uFE0F'],
    [['microservice', 'docker', 'kubernetes'], '\U0001F433'],
    [['network', 'tcp', 'http', 'dns'], '\U0001F4E1'],
    [['security', 'auth', 'oauth', 'jwt'], '\U0001F512'],
    [['server', 'deploy', 'ci/cd'], '\U0001F5A5\uFE0F'],
    [['message', 'kafka', 'rabbit', 'queue'], '\U0001F4E8'],
    [['react', 'frontend', 'css', 'html'], '\U0001F3A8'],
    [['java', 'spring'], '\u2615'],
    [['python', 'django', 'flask'], '\U0001F40D'],
    [['concurrency', 'thread', 'async'], '\U0001F500'],
    [['rate limit', 'throttl'], '\U0001F6A6'],
    [['cdn', 'edge', 'cloudflare'], '\u2601\uFE0F'],
  ];

  for (const [keywords, emoji] of emojiMap) {
    if (keywords.some(k => lower.includes(k))) return emoji;
  }
  return '\U0001F4BB'; // default: laptop
}

export const ThumbnailComposition: React.FC<ThumbnailProps> = ({
  topic,
  sessionNumber,
  category,
  language,
  emoji,
}) => {
  const displayEmoji = emoji || getTopicEmoji(topic);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        fontFamily: FONTS.heading,
        overflow: 'hidden',
      }}
    >
      {/* Background gradient glow - top right saffron */}
      <div
        style={{
          position: 'absolute',
          top: -180,
          right: -120,
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.saffron}40 0%, ${COLORS.saffron}15 40%, transparent 70%)`,
        }}
      />

      {/* Background gradient glow - bottom left teal */}
      <div
        style={{
          position: 'absolute',
          bottom: -200,
          left: -150,
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.teal}25 0%, transparent 60%)`,
        }}
      />

      {/* Subtle grid pattern overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.04,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Large emoji icon */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          right: 60,
          fontSize: 160,
          opacity: 0.9,
          filter: 'drop-shadow(0 0 30px rgba(232, 93, 38, 0.3))',
        }}
      >
        {displayEmoji}
      </div>

      {/* Main topic title - large bold text with saffron gradient */}
      <div
        style={{
          position: 'absolute',
          left: 60,
          top: 100,
          right: 280,
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
      >
        <div
          style={{
            fontSize: Math.min(SIZES.heading1 + 20, topic.length > 20 ? 72 : 92),
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: -2,
            background: `linear-gradient(135deg, ${COLORS.saffron} 0%, #FF8A50 50%, ${COLORS.gold} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textTransform: 'uppercase',
          }}
        >
          {topic}
        </div>
      </div>

      {/* Session badge - pill shape */}
      <div
        style={{
          position: 'absolute',
          left: 60,
          bottom: 100,
          display: 'flex',
          gap: 16,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: COLORS.white,
            backgroundColor: COLORS.saffron,
            padding: '10px 28px',
            borderRadius: 50,
            letterSpacing: 1,
            boxShadow: `0 0 20px ${COLORS.saffron}60`,
          }}
        >
          SESSION {sessionNumber}
        </div>

        {category && (
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: COLORS.white,
              backgroundColor: COLORS.indigo,
              padding: '10px 24px',
              borderRadius: 50,
            }}
          >
            {category}
          </div>
        )}

        {language && (
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: COLORS.dark,
              backgroundColor: COLORS.teal,
              padding: '10px 24px',
              borderRadius: 50,
            }}
          >
            {language}
          </div>
        )}
      </div>

      {/* Bottom saffron accent bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 8,
          background: `linear-gradient(90deg, ${COLORS.saffron}, ${COLORS.gold}, ${COLORS.saffron})`,
        }}
      />

      {/* GURU SISHYA brand - bottom right */}
      <div
        style={{
          position: 'absolute',
          bottom: 30,
          right: 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: COLORS.saffron,
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}
        >
          Guru Sishya
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: COLORS.gray,
            letterSpacing: 2,
            marginTop: 2,
          }}
        >
          guru-sishya.in
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default ThumbnailComposition;
