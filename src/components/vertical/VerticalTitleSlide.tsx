import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate,
  spring,
} from 'remotion';
import { FONTS } from '../../lib/theme';

// ════════════════════════════════════════════════════════════════════════════════
// PROPS
// ════════════════════════════════════════════════════════════════════════════════
interface VerticalTitleSlideProps {
  topic?: string;
  sessionNumber?: number;
  totalSessions?: number;
  title?: string;
  objectives?: string[];
  language?: string;
  hookText?: string;
  stats?: string;
  durationLabel?: string;
  sceneIndex?: number;
  sceneStartFrame?: number;
}

// ════════════════════════════════════════════════════════════════════════════════
// TOPIC INTRO CONTENT — sourced from TitleSlide TOPIC_INTRO_CONTENT
// ════════════════════════════════════════════════════════════════════════════════
interface TopicIntroContent {
  statNumber: string;
  statLabel: string;
  statContext: string;
  questionLine1: string;
  questionLine2: string;
  questionHook: string;
  teaserPoints: [string, string, string];
  accentColor: string;
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
    questionLine2: "...when the database can't keep up?",
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
    statContext: "This is what Facebook's user table looks like.",
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
    statContext: "Netflix's Hystrix catches it before you notice.",
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
    questionLine2: "...when your app works on your machine but not in production?",
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
      "The architecture behind YouTube's speed",
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
    statContext: "Verizon's Data Breach Report, every single year.",
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
    statContext: "That's only 5 minutes of downtime per year.",
    questionLine1: 'What happens...',
    questionLine2: '...when the network splits in half?',
    questionHook: 'YOUR interview depends on this answer.',
    teaserPoints: [
      "The CAP theorem — you can't have it all",
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
// ANIMATED COUNTER HELPER
// ════════════════════════════════════════════════════════════════════════════════
function parseFormattedNumber(s: string): number {
  return parseFloat(s.replace(/,/g, '')) || 0;
}

function formatNumber(n: number, original: string): string {
  // Preserve decimal if original has one (e.g. "99.999")
  if (original.includes('.')) {
    const decimals = original.split('.')[1].length;
    return n.toFixed(decimals);
  }
  return Math.round(n).toLocaleString('en-US');
}

// ════════════════════════════════════════════════════════════════════════════════
// SPRING HELPER — staggered entrance
// ════════════════════════════════════════════════════════════════════════════════
function useEntrance(frame: number, fps: number, delayFrames: number) {
  const s = spring({
    frame: Math.max(0, frame - delayFrames),
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.7 },
  });
  const opacity = interpolate(Math.max(0, frame - delayFrames), [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return { translateY: interpolate(s, [0, 1], [40, 0]), opacity };
}

// ════════════════════════════════════════════════════════════════════════════════
// DARK PALETTE
// ════════════════════════════════════════════════════════════════════════════════
const DARK = {
  bg: '#0C0A15',
  text: '#FFFFFF',
  subtext: 'rgba(255,255,255,0.5)',
  saffron: '#E85D26',
  gold: '#FDB813',
  teal: '#1DD1A1',
  badgeBg: 'rgba(232,93,38,0.12)',
  objectiveBullet: '#1DD1A1',
} as const;

// ════════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════════════════════════
export const VerticalTitleSlide: React.FC<VerticalTitleSlideProps> = ({
  topic = 'System Design',
  sessionNumber = 1,
  totalSessions,
  title,
  objectives = [],
  hookText,
  stats,
  durationLabel,
  sceneIndex = 0,
  sceneStartFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const content = getTopicIntro(topic);
  const accent = content.accentColor;

  // Global fade-out in last 15 frames
  const globalOp = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // ── Staggered entrance delays (frames) ──
  const BADGE_DELAY = 0;
  const HOOK_DELAY = 12;
  const STAT_DELAY = 24;
  const STAT_LABEL_DELAY = 36;
  const TITLE_DELAY = 46;
  const OBJ_DELAY = 56;
  const BRANDING_DELAY = 66;

  const badge = useEntrance(frame, fps, BADGE_DELAY);
  const hook = useEntrance(frame, fps, HOOK_DELAY);
  const statEl = useEntrance(frame, fps, STAT_DELAY);
  const statLabel = useEntrance(frame, fps, STAT_LABEL_DELAY);
  const titleEl = useEntrance(frame, fps, TITLE_DELAY);
  const brandingEl = useEntrance(frame, fps, BRANDING_DELAY);

  // ── Animated counter (stat number ticks up) ──
  const target = parseFormattedNumber(content.statNumber);
  const counterProgress = interpolate(frame, [STAT_DELAY, STAT_DELAY + 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const easedCounter = 1 - Math.pow(1 - counterProgress, 3);
  const currentCounterValue = formatNumber(target * easedCounter, content.statNumber);

  // ── Pulse after counter reaches target ──
  const pulseScale =
    frame > STAT_DELAY + 62
      ? interpolate(frame, [STAT_DELAY + 62, STAT_DELAY + 72, STAT_DELAY + 82], [1, 1.06, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1;

  // ── Hook text: use prop override or compose from content ──
  const hookDisplay = hookText || `${content.questionLine1} ${content.questionLine2}`;

  // ── Badge label ──
  const badgeText = totalSessions
    ? `${topic.toUpperCase()} · SESSION ${sessionNumber} OF ${totalSessions}`
    : `${topic.toUpperCase()} · SESSION ${sessionNumber}`;

  // ── Objectives (cap to 4 for vertical space) ──
  const visibleObjectives = objectives.slice(0, 4);

  return (
    <AbsoluteFill
      style={{
        background: DARK.bg,
        fontFamily: FONTS.text,
        opacity: globalOp,
        overflow: 'hidden',
      }}
    >
      {/* ── RADIAL GLOW behind stat ── */}
      <div
        style={{
          position: 'absolute',
          top: '35%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 900,
          height: 900,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accent}18 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* ── ACCENT LINE — top decoration ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, ${DARK.saffron}, ${DARK.gold}, ${DARK.teal})`,
        }}
      />

      {/* ── TOPIC BADGE — y≈120 ── */}
      <div
        style={{
          position: 'absolute',
          top: 90,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: badge.opacity,
          transform: `translateY(${badge.translateY}px)`,
        }}
      >
        <div
          style={{
            border: `2px solid ${DARK.saffron}`,
            background: DARK.badgeBg,
            borderRadius: 50,
            paddingLeft: 36,
            paddingRight: 36,
            paddingTop: 14,
            paddingBottom: 14,
          }}
        >
          <span
            style={{
              fontSize: 28,
              fontFamily: FONTS.heading,
              fontWeight: 700,
              color: DARK.saffron,
              letterSpacing: 3,
              textTransform: 'uppercase',
            }}
          >
            {badgeText}
          </span>
        </div>
      </div>

      {/* ── HOOK QUESTION — y≈350 ── */}
      <div
        style={{
          position: 'absolute',
          top: 300,
          left: 60,
          right: 60,
          textAlign: 'center',
          opacity: hook.opacity,
          transform: `translateY(${hook.translateY}px)`,
        }}
      >
        <span
          style={{
            fontSize: 52,
            fontFamily: FONTS.heading,
            fontWeight: 700,
            color: DARK.teal,
            lineHeight: 1.25,
            display: 'block',
          }}
        >
          {hookDisplay}
        </span>
      </div>

      {/* ── HERO STAT NUMBER — y≈560 ── */}
      <div
        style={{
          position: 'absolute',
          top: 530,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: statEl.opacity,
          transform: `translateY(${statEl.translateY}px) scale(${pulseScale})`,
        }}
      >
        <span
          style={{
            fontSize: 128,
            fontFamily: FONTS.heading,
            fontWeight: 900,
            color: DARK.text,
            letterSpacing: -3,
            lineHeight: 1,
            textShadow: `0 0 60px ${accent}60, 0 0 120px ${accent}30`,
          }}
        >
          {currentCounterValue}
        </span>
      </div>

      {/* ── STAT LABEL — y≈700 ── */}
      <div
        style={{
          position: 'absolute',
          top: 690,
          left: 60,
          right: 60,
          textAlign: 'center',
          opacity: statLabel.opacity,
          transform: `translateY(${statLabel.translateY}px)`,
        }}
      >
        <span
          style={{
            fontSize: 34,
            fontFamily: FONTS.text,
            fontWeight: 400,
            color: DARK.subtext,
            letterSpacing: 1,
            display: 'block',
          }}
        >
          {content.statLabel}
        </span>
        <span
          style={{
            fontSize: 28,
            fontFamily: FONTS.text,
            fontWeight: 400,
            color: `${DARK.gold}CC`,
            letterSpacing: 0.5,
            display: 'block',
            marginTop: 10,
          }}
        >
          {content.statContext}
        </span>
      </div>

      {/* ── DIVIDER LINE ── */}
      <div
        style={{
          position: 'absolute',
          top: 845,
          left: 120,
          right: 120,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${accent}60, transparent)`,
          opacity: titleEl.opacity,
        }}
      />

      {/* ── SESSION TITLE — y≈880 ── */}
      {title && (
        <div
          style={{
            position: 'absolute',
            top: 870,
            left: 60,
            right: 60,
            textAlign: 'center',
            opacity: titleEl.opacity,
            transform: `translateY(${titleEl.translateY}px)`,
          }}
        >
          <span
            style={{
              fontSize: 44,
              fontFamily: FONTS.heading,
              fontWeight: 700,
              color: DARK.text,
              lineHeight: 1.3,
              display: 'block',
            }}
          >
            {title}
          </span>
        </div>
      )}

      {/* ── OBJECTIVES — y≈1050 ── */}
      {visibleObjectives.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 1040,
            left: 80,
            right: 80,
          }}
        >
          {visibleObjectives.map((obj, i) => {
            const objEntrance = useEntrance(frame, fps, OBJ_DELAY + i * 10);
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 20,
                  marginBottom: 28,
                  opacity: objEntrance.opacity,
                  transform: `translateY(${objEntrance.translateY}px)`,
                }}
              >
                <span
                  style={{
                    fontSize: 28,
                    color: DARK.objectiveBullet,
                    flexShrink: 0,
                    marginTop: 2,
                    fontWeight: 700,
                  }}
                >
                  ✦
                </span>
                <span
                  style={{
                    fontSize: 30,
                    fontFamily: FONTS.text,
                    fontWeight: 500,
                    color: DARK.text,
                    lineHeight: 1.4,
                  }}
                >
                  {obj}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TEASERS (when no objectives provided) — y≈1050 ── */}
      {visibleObjectives.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: 1040,
            left: 80,
            right: 80,
          }}
        >
          {content.teaserPoints.map((pt, i) => {
            const ptEntrance = useEntrance(frame, fps, OBJ_DELAY + i * 12);
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 20,
                  marginBottom: 32,
                  opacity: ptEntrance.opacity,
                  transform: `translateY(${ptEntrance.translateY}px)`,
                }}
              >
                <span
                  style={{
                    fontSize: 26,
                    color: accent,
                    flexShrink: 0,
                    marginTop: 3,
                  }}
                >
                  ▸
                </span>
                <span
                  style={{
                    fontSize: 30,
                    fontFamily: FONTS.text,
                    fontWeight: 400,
                    color: 'rgba(255,255,255,0.82)',
                    lineHeight: 1.45,
                  }}
                >
                  {pt}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── BOTTOM ACCENT BAR ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${DARK.teal}, ${DARK.gold}, ${DARK.saffron})`,
        }}
      />

      {/* ── BRANDING — y≈1700 ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 50,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: brandingEl.opacity,
          transform: `translateY(${brandingEl.translateY}px)`,
        }}
      >
        <span
          style={{
            fontSize: 24,
            fontFamily: FONTS.text,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.28)',
            letterSpacing: 2,
          }}
        >
          guru-sishya.in
        </span>
      </div>
    </AbsoluteFill>
  );
};

export default VerticalTitleSlide;
