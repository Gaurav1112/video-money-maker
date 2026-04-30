import React from 'react';
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate, spring } from 'remotion';
import { FONTS } from '../lib/theme';
import { getVideoStyleTemplate } from '../lib/video-style-templates';

interface TitleSlideProps {
  topic?: string;
  sessionNumber?: number;
  totalSessions?: number;
  title?: string;
  objectives?: string[];
  language?: string;
  hookText?: string;
  stats?: string;
  durationLabel?: string;
}

// ════════════════════════════════════════════════════════════════════════════════
// TOPIC INTRO CONTENT — movie-trailer text per topic (no shapes, no diagrams)
// ════════════════════════════════════════════════════════════════════════════════
interface TopicIntroContent {
  statNumber: string;        // e.g. "10,000,000"
  statLabel: string;         // e.g. "requests per second"
  statContext: string;       // e.g. "This is what Google handles."
  questionLine1: string;     // "What happens..."
  questionLine2: string;     // "...when ONE server fails?"
  questionHook: string;      // "YOUR interview depends on this answer."
  teaserPoints: [string, string, string];
  accentColor: string;       // override accent per topic
}

const TOPIC_INTRO_CONTENT: Record<string, TopicIntroContent> = {
  'load balancing': {
    statNumber: '1,000,000',
    statLabel: 'requests per second at peak',
    statContext: 'This is what Netflix handles on a Friday night.',
    questionLine1: 'What happens...',
    questionLine2: '...when traffic 10x overnight?',
    questionHook: 'YOUR interview depends on this answer.',
    teaserPoints: [
      'The algorithm that distributes traffic perfectly',
      'Health checks that prevent total downtime',
      'Why Netflix never goes down',
    ],
    accentColor: '#E85D26',
  },
  'caching': {
    statNumber: '230,000,000',
    statLabel: 'users served by Netflix',
    statContext: 'Every single request hits the cache first.',
    questionLine1: 'What happens...',
    questionLine2: '...when the database can\'t keep up?',
    questionHook: 'YOUR interview depends on this answer.',
    teaserPoints: [
      'The caching layer that saves millions',
      'Redis vs Memcached — the real answer',
      'The eviction policy interviewers love',
    ],
    accentColor: '#FDB813',
  },
  'api gateway': {
    statNumber: '10,000,000',
    statLabel: 'API calls per minute',
    statContext: 'This is what Stripe processes daily.',
    questionLine1: 'What happens...',
    questionLine2: '...when clients hit your backend directly?',
    questionHook: 'YOUR interview depends on this answer.',
    teaserPoints: [
      'The single entry point that controls everything',
      'Rate limiting, auth, routing — one layer',
      'The pattern every FAANG company uses',
    ],
    accentColor: '#E85D26',
  },
  'database': {
    statNumber: '2,500,000,000',
    statLabel: 'rows in a single table',
    statContext: 'This is what Facebook\'s user table looks like.',
    questionLine1: 'What happens...',
    questionLine2: '...when your queries take 30 seconds?',
    questionHook: 'YOUR interview depends on this answer.',
    teaserPoints: [
      'The schema design that scales to billions',
      'Indexing strategies that cut latency 100x',
      'The normalization level interviewers expect',
    ],
    accentColor: '#A78BFA',
  },
  'microservices': {
    statNumber: '2,000',
    statLabel: 'microservices at Amazon',
    statContext: 'Every team owns exactly one service.',
    questionLine1: 'What happens...',
    questionLine2: '...when the monolith becomes unmaintainable?',
    questionHook: 'YOUR interview depends on this answer.',
    teaserPoints: [
      'The decomposition strategy that actually works',
      'Service boundaries — how to draw the line',
      'The communication pattern Netflix uses',
    ],
    accentColor: '#1DD1A1',
  },
  'message queue': {
    statNumber: '50,000,000',
    statLabel: 'messages per second through Kafka',
    statContext: 'LinkedIn processes this in real-time.',
    questionLine1: 'What happens...',
    questionLine2: '...when services need to talk asynchronously?',
    questionHook: 'YOUR interview depends on this answer.',
    teaserPoints: [
      'The decoupling pattern that prevents cascading failures',
      'At-least-once vs exactly-once delivery',
      'Dead letter queues — the safety net',
    ],
    accentColor: '#F472B6',
  },
  'consistent hashing': {
    statNumber: '100,000',
    statLabel: 'servers rebalanced in seconds',
    statContext: 'This is how DynamoDB distributes data.',
    questionLine1: 'What happens...',
    questionLine2: '...when you add a server to the cluster?',
    questionHook: 'YOUR interview depends on this answer.',
    teaserPoints: [
      'The hash ring that minimizes data movement',
      'Virtual nodes — the trick that ensures balance',
      'Why this is asked in every system design round',
    ],
    accentColor: '#1DD1A1',
  },
  'rate limiting': {
    statNumber: '429',
    statLabel: 'Too Many Requests',
    statContext: 'The HTTP status that protects your system.',
    questionLine1: 'What happens...',
    questionLine2: '...when a single client floods your API?',
    questionHook: 'YOUR interview depends on this answer.',
    teaserPoints: [
      'Token bucket vs sliding window — which to pick',
      'Distributed rate limiting across servers',
      'The algorithm that keeps APIs alive',
    ],
    accentColor: '#F39C12',
  },
  'circuit breaker': {
    statNumber: '3',
    statLabel: 'seconds to detect a cascade failure',
    statContext: 'Netflix\'s Hystrix catches it before you notice.',
    questionLine1: 'What happens...',
    questionLine2: '...when one service brings down everything?',
    questionHook: 'YOUR interview depends on this answer.',
    teaserPoints: [
      'Closed, open, half-open — the three states',
      'The fallback strategy that saves the user',
      'Why this is a must-know for distributed systems',
    ],
    accentColor: '#1DD1A1',
  },
  'docker': {
    statNumber: '13,000,000',
    statLabel: 'developers using Docker',
    statContext: 'Every modern deployment starts here.',
    questionLine1: 'What happens...',
    questionLine2: '...when your app works on your machine but not in production?',
    questionHook: 'YOUR interview depends on this answer.',
    teaserPoints: [
      'Containers vs VMs — the fundamental difference',
      'The Dockerfile pattern every team uses',
      'Networking and volumes — the tricky parts',
    ],
    accentColor: '#2496ED',
  },
  'kubernetes': {
    statNumber: '5,600,000',
    statLabel: 'clusters running worldwide',
    statContext: 'Google built it to run their own infrastructure.',
    questionLine1: 'What happens...',
    questionLine2: '...when you need to orchestrate 1000 containers?',
    questionHook: 'YOUR interview depends on this answer.',
    teaserPoints: [
      'Pods, services, deployments — the building blocks',
      'Auto-scaling that responds in seconds',
      'The self-healing loop that keeps services alive',
    ],
    accentColor: '#326CE5',
  },
  'cdn': {
    statNumber: '300',
    statLabel: 'milliseconds saved per request',
    statContext: 'Cloudflare has 300+ PoPs across the globe.',
    questionLine1: 'What happens...',
    questionLine2: '...when users are 10,000 miles from your server?',
    questionHook: 'YOUR interview depends on this answer.',
    teaserPoints: [
      'Edge caching that makes content feel instant',
      'Cache invalidation — the hard problem',
      'The architecture behind YouTube\'s speed',
    ],
    accentColor: '#1DD1A1',
  },
  'kafka': {
    statNumber: '7,000,000,000',
    statLabel: 'messages per day at Uber',
    statContext: 'Every ride, every payment — all through Kafka.',
    questionLine1: 'What happens...',
    questionLine2: '...when you need real-time event streaming?',
    questionHook: 'YOUR interview depends on this answer.',
    teaserPoints: [
      'Topics, partitions, consumer groups explained',
      'Why Kafka is faster than traditional queues',
      'The exactly-once guarantee that changes everything',
    ],
    accentColor: '#1DD1A1',
  },
  'authentication': {
    statNumber: '81',
    statLabel: 'percent of breaches caused by weak auth',
    statContext: 'Verizon\'s Data Breach Report, every single year.',
    questionLine1: 'What happens...',
    questionLine2: '...when your auth system has a single flaw?',
    questionHook: 'YOUR interview depends on this answer.',
    teaserPoints: [
      'OAuth 2.0 + JWT — the complete flow',
      'Session vs token-based — when to use which',
      'The security mistakes interviewers look for',
    ],
    accentColor: '#27AE60',
  },
  'distributed': {
    statNumber: '99.999',
    statLabel: 'percent uptime — five nines',
    statContext: 'That\'s only 5 minutes of downtime per year.',
    questionLine1: 'What happens...',
    questionLine2: '...when the network splits in half?',
    questionHook: 'YOUR interview depends on this answer.',
    teaserPoints: [
      'The CAP theorem — you can\'t have it all',
      'Consensus algorithms that keep data consistent',
      'The replication strategy Google uses',
    ],
    accentColor: '#3498DB',
  },
};

function getTopicIntro(topic: string): TopicIntroContent {
  const lower = topic.toLowerCase();
  const sortedKeys = Object.keys(TOPIC_INTRO_CONTENT).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (lower.includes(key)) return TOPIC_INTRO_CONTENT[key];
  }
  // Fallback — generic but still dramatic
  return {
    statNumber: '10,000,000',
    statLabel: 'requests per second',
    statContext: 'This is what top companies handle.',
    questionLine1: 'What happens...',
    questionLine2: `...when your ${topic.toLowerCase()} fails?`,
    questionHook: 'YOUR interview depends on this answer.',
    teaserPoints: [
      `The ${topic.toLowerCase()} pattern every engineer must know`,
      'The implementation detail interviewers dig into',
      'The answer that separates senior from junior',
    ],
    accentColor: '#E85D26',
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// ANIMATED COUNTER — ticks from 0 to target number
// ════════════════════════════════════════════════════════════════════════════════
function parseFormattedNumber(s: string): number {
  return parseInt(s.replace(/,/g, ''), 10) || 0;
}

function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

// ════════════════════════════════════════════════════════════════════════════════
// PHASE 1: THE SHOCKING STAT (0-120f / 0-4s)
// Pure darkness → huge animated counter → context line
// ════════════════════════════════════════════════════════════════════════════════
const PhaseStat: React.FC<{ frame: number; content: TopicIntroContent }> = ({ frame, content }) => {
  const accent = content.accentColor;

  // Phase overall opacity
  const phaseOp = interpolate(frame, [0, 5, 100, 120], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Counter: ticks from 0 → target between frame 30-90
  const target = parseFormattedNumber(content.statNumber);
  const counterProgress = interpolate(frame, [30, 90], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Ease-out curve for the counter (fast start, slow finish)
  const eased = 1 - Math.pow(1 - counterProgress, 3);
  const currentValue = formatNumber(target * eased);

  // Counter opacity: invisible for first second, then appears
  const counterOp = interpolate(frame, [28, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Stat label ("requests per second") fades in with counter
  const labelOp = interpolate(frame, [35, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Number PULSE after reaching target (frame 90-120)
  const pulseScale = frame > 90
    ? interpolate(frame, [90, 100, 110], [1.0, 1.08, 1.0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1.0;

  // Context line fades in after pulse
  const contextOp = interpolate(frame, [92, 105], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const contextSpring = spring({
    frame: Math.max(0, frame - 92),
    fps: 30,
    config: { damping: 12, stiffness: 120, mass: 0.6 },
  });

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: phaseOp }}>
      {/* THE NUMBER — dead center, massive */}
      <div
        style={{
          position: 'absolute',
          top: '38%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: counterOp,
          transform: `scale(${pulseScale})`,
        }}
      >
        <span
          style={{
            fontSize: 120,
            fontFamily: FONTS.heading,
            fontWeight: 900,
            color: '#FFFFFF',
            letterSpacing: -2,
            textShadow: `0 0 60px ${accent}40, 0 0 120px ${accent}20`,
            lineHeight: 1,
          }}
        >
          {currentValue}
        </span>
      </div>

      {/* STAT LABEL — below the number */}
      <div
        style={{
          position: 'absolute',
          top: '55%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: labelOp,
        }}
      >
        <span
          style={{
            fontSize: 24,
            fontFamily: FONTS.text,
            fontWeight: 400,
            color: '#6B7280',
            letterSpacing: 2,
          }}
        >
          {content.statLabel}
        </span>
      </div>

      {/* CONTEXT LINE — "This is what Google handles." */}
      <div
        style={{
          position: 'absolute',
          top: '64%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: contextOp,
          transform: `translateY(${interpolate(contextSpring, [0, 1], [10, 0])}px)`,
        }}
      >
        <span
          style={{
            fontSize: 20,
            fontFamily: FONTS.text,
            fontWeight: 400,
            color: '#6B7280',
          }}
        >
          {content.statContext}
        </span>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// PHASE 2: THE QUESTION (120-300f / 4-10s)
// "What happens..." → "...when ONE server fails?" → interview hook
// ════════════════════════════════════════════════════════════════════════════════
const PhaseQuestion: React.FC<{ frame: number; content: TopicIntroContent }> = ({ frame, content }) => {
  const accent = content.accentColor;

  // Phase overall opacity
  const phaseOp = interpolate(frame, [120, 130, 280, 300], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Line 1: "What happens..." — fades in at 120
  const line1Spring = spring({
    frame: Math.max(0, frame - 125),
    fps: 30,
    config: { damping: 12, stiffness: 140, mass: 0.6 },
  });
  const line1Op = interpolate(frame, [125, 145], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Line 2: "...when ONE server fails?" — fades in at 150
  const line2Spring = spring({
    frame: Math.max(0, frame - 155),
    fps: 30,
    config: { damping: 10, stiffness: 160, mass: 0.5 },
  });
  const line2Op = interpolate(frame, [155, 175], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Line 1 dims when line 2 appears
  const line1Dim = interpolate(frame, [155, 175], [1, 0.4], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Hook line: "YOUR interview depends on this answer." — slams in at 210
  const hookSpring = spring({
    frame: Math.max(0, frame - 210),
    fps: 30,
    config: { damping: 8, stiffness: 220, mass: 0.4 },
  });
  const hookOp = interpolate(frame, [210, 230], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Lines 1 & 2 dim further when hook appears
  const questionDim = interpolate(frame, [210, 230], [1, 0.3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: phaseOp }}>
      {/* Line 1: "What happens..." */}
      <div
        style={{
          position: 'absolute',
          top: '35%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: line1Op * line1Dim * questionDim,
          transform: `translateY(${interpolate(line1Spring, [0, 1], [20, 0])}px)`,
        }}
      >
        <span
          style={{
            fontSize: 48,
            fontFamily: FONTS.heading,
            fontWeight: 700,
            color: '#FFFFFF',
            textShadow: '0 0 40px rgba(255, 255, 255, 0.15)',
          }}
        >
          {content.questionLine1}
        </span>
      </div>

      {/* Line 2: "...when ONE server fails?" */}
      <div
        style={{
          position: 'absolute',
          top: '47%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: line2Op * questionDim,
          transform: `scale(${interpolate(line2Spring, [0, 1], [0.8, 1])})`,
        }}
      >
        <span
          style={{
            fontSize: 48,
            fontFamily: FONTS.heading,
            fontWeight: 700,
            color: accent,
            textShadow: `0 0 40px ${accent}30`,
          }}
        >
          {content.questionLine2}
        </span>
      </div>

      {/* Hook: "YOUR interview depends on this answer." */}
      <div
        style={{
          position: 'absolute',
          top: '62%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: hookOp,
          transform: `scale(${interpolate(hookSpring, [0, 1], [0.5, 1])})`,
        }}
      >
        <span
          style={{
            fontSize: 36,
            fontFamily: FONTS.heading,
            fontWeight: 600,
            color: '#FFFFFF',
            textShadow: '0 0 40px rgba(255, 255, 255, 0.1)',
          }}
        >
          {content.questionHook}
        </span>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// PHASE 3: THE TEASER (300-540f / 10-18s)
// Three key points slide in one by one, previous ones dim
// ════════════════════════════════════════════════════════════════════════════════
const PhaseTeaser: React.FC<{ frame: number; content: TopicIntroContent }> = ({ frame, content }) => {
  const accent = content.accentColor;
  const teal = '#1DD1A1';

  // Phase overall opacity
  const phaseOp = interpolate(frame, [300, 315, 520, 540], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Three points appear at staggered times
  const pointFrames = [320, 380, 440];

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: phaseOp }}>
      {content.teaserPoints.map((point, i) => {
        const entryFrame = pointFrames[i];
        const pointSpring = spring({
          frame: Math.max(0, frame - entryFrame),
          fps: 30,
          config: { damping: 12, stiffness: 140, mass: 0.6 },
        });
        const pointOp = interpolate(frame, [entryFrame, entryFrame + 20], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        // Dim previous lines when new one appears
        let dimFactor = 1;
        if (i === 0 && frame > pointFrames[1]) {
          dimFactor = interpolate(frame, [pointFrames[1], pointFrames[1] + 15], [1, 0.35], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
        }
        if (i === 1 && frame > pointFrames[2]) {
          dimFactor = interpolate(frame, [pointFrames[2], pointFrames[2] + 15], [1, 0.35], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
        }
        if (i === 0 && frame > pointFrames[2]) {
          dimFactor = 0.2;
        }

        const slideX = interpolate(pointSpring, [0, 1], [-60, 0]);

        return (
          <div
            key={`point-${i}`}
            style={{
              position: 'absolute',
              top: `${38 + i * 10}%`,
              left: '15%',
              right: '15%',
              opacity: pointOp * dimFactor,
              transform: `translateX(${slideX}px)`,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            {/* Checkmark */}
            <span
              style={{
                fontSize: 28,
                fontFamily: FONTS.heading,
                fontWeight: 700,
                color: teal,
                textShadow: `0 0 20px ${teal}40`,
                flexShrink: 0,
              }}
            >
              &#x2713;
            </span>
            {/* Point text */}
            <span
              style={{
                fontSize: 28,
                fontFamily: FONTS.heading,
                fontWeight: 500,
                color: '#FFFFFF',
                textShadow: `0 0 30px ${accent}15`,
              }}
            >
              {point}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// PHASE 4: THE HOOK + CTA (540-750f / 18-25s)
// Topic name SLAMS in → session badge → branding → fade
// ════════════════════════════════════════════════════════════════════════════════
const PhaseHook: React.FC<{
  frame: number;
  topic: string;
  sessionNumber: number;
  totalSessions: number;
  content: TopicIntroContent;
  totalFrames: number;
}> = ({ frame, topic, sessionNumber, totalSessions, content, totalFrames }) => {
  const accent = content.accentColor;

  // Phase overall opacity
  const phaseOp = interpolate(frame, [540, 555, totalFrames - 20, totalFrames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Topic name — SLAM entrance at 550
  const topicSpring = spring({
    frame: Math.max(0, frame - 550),
    fps: 30,
    config: { damping: 8, stiffness: 220, mass: 0.4 },
  });
  const topicOp = interpolate(frame, [550, 570, totalFrames - 25, totalFrames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Session badge — appears at 600
  const badgeSpring = spring({
    frame: Math.max(0, frame - 600),
    fps: 30,
    config: { damping: 12, stiffness: 140, mass: 0.6 },
  });
  const badgeOp = interpolate(frame, [600, 620, totalFrames - 20, totalFrames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Branding: "GURU SISHYA" + "guru-sishya.in" at 660
  const brandSpring = spring({
    frame: Math.max(0, frame - 660),
    fps: 30,
    config: { damping: 14, stiffness: 100, mass: 0.8 },
  });
  const brandOp = interpolate(frame, [660, 685, totalFrames - 15, totalFrames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: phaseOp }}>
      {/* Subtle radial glow behind topic */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 700,
          height: 350,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accent}12, transparent 60%)`,
          opacity: topicOp,
          filter: 'blur(60px)',
        }}
      />

      {/* TOPIC NAME — huge, centered */}
      <div
        style={{
          position: 'absolute',
          top: '32%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: topicOp,
          transform: `scale(${interpolate(topicSpring, [0, 1], [0.3, 1])})`,
        }}
      >
        <span
          style={{
            fontSize: 72,
            fontFamily: FONTS.heading,
            fontWeight: 900,
            color: accent,
            letterSpacing: 4,
            textTransform: 'uppercase',
            textShadow: `0 0 40px ${accent}30, 0 0 80px ${accent}15`,
            lineHeight: 1.1,
          }}
        >
          {topic}
        </span>
      </div>

      {/* SESSION BADGE — pill shape */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translateX(-50%) scale(${interpolate(badgeSpring, [0, 1], [0.6, 1])})`,
          opacity: badgeOp,
        }}
      >
        <div
          style={{
            background: `${accent}20`,
            border: `1.5px solid ${accent}50`,
            borderRadius: 999,
            padding: '8px 28px',
          }}
        >
          <span
            style={{
              fontSize: 18,
              fontFamily: FONTS.text,
              fontWeight: 600,
              color: '#FFFFFF',
              letterSpacing: 2,
            }}
          >
            Session {sessionNumber}{totalSessions > 1 ? ` of ${totalSessions}` : ''}
          </span>
        </div>
      </div>

      {/* GURU SISHYA branding */}
      <div
        style={{
          position: 'absolute',
          top: '68%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: brandOp,
          transform: `translateY(${interpolate(brandSpring, [0, 1], [15, 0])}px)`,
        }}
      >
        <div>
          <span
            style={{
              fontSize: 32,
              fontFamily: FONTS.heading,
              fontWeight: 900,
              letterSpacing: 2,
            }}
          >
            <span style={{ color: '#E85D26' }}>GURU</span>
            <span style={{ color: '#FDB813' }}>{' '}SISHYA</span>
          </span>
        </div>
        <div style={{ marginTop: 10 }}>
          <span
            style={{
              fontSize: 16,
              fontFamily: FONTS.code,
              fontWeight: 500,
              color: '#6B7280',
              letterSpacing: 3,
            }}
          >
            guru-sishya.in
          </span>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT — Movie-trailer TitleSlide (text-only, zero CSS shapes)
// ════════════════════════════════════════════════════════════════════════════════
const TitleSlide: React.FC<TitleSlideProps> = ({
  topic = 'TOPIC',
  sessionNumber = 1,
  totalSessions = 12,
  title = '',
  objectives = [],
  language,
  hookText,
  stats,
  durationLabel,
}) => {
  const frame = useCurrentFrame();
  const content = getTopicIntro(topic);

  // Get accent color from video style template if available, otherwise use topic default
  const styleTemplate = getVideoStyleTemplate(topic, sessionNumber);
  if (styleTemplate.accentColor && styleTemplate.accentColor !== content.accentColor) {
    // Let topic-specific color take priority — it's been hand-tuned
  }

  const totalFrames = 750; // ~25 seconds at 30fps

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0A0A0A',
        overflow: 'hidden',
      }}
    >
      {/* Extremely subtle gradient — near-black, not distracting */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, #0A0A0A 0%, #111827 50%, #0A0A0A 100%)',
        }}
      />

      {/* All 4 phases render simultaneously — each manages its own visibility */}
      <PhaseStat frame={frame} content={content} />
      <PhaseQuestion frame={frame} content={content} />
      <PhaseTeaser frame={frame} content={content} />
      <PhaseHook
        frame={frame}
        topic={topic}
        sessionNumber={sessionNumber}
        totalSessions={totalSessions}
        content={content}
        totalFrames={totalFrames}
      />
    </AbsoluteFill>
  );
};

export default TitleSlide;
