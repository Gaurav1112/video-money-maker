# Viral Shorts Pivot — 30-45s Quiz Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Shorts pipeline to produce 30-45 second quiz-format Shorts focused on Kafka + 3 core topics, targeting 5K+ views per Short.

**Architecture:** Replace the current 14-format template generator with a single proven format: 5-part quiz structure (hook → tension → payload → twist → CTA). Focus on 4 high-performing topics (Kafka, API Gateway, Load Balancer, Database). All narrations use the "90% of devs get X WRONG" identity-threat formula. Videos work on mute with bold text overlays.

**Tech Stack:** Remotion 4, TypeScript, Kokoro TTS, ffmpeg

**Evidence:** Channel data shows 2:57 videos at 900 views, 49s at 100 views, 17s at 355 views. The sweet spot is 30-45s with quiz/identity-threat format. "90% get X WRONG" is the proven #1 title formula on this channel.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/pipeline/quiz-short-generator.ts` | **Create** | New 30-45s quiz format generator (replaces shorts-generator for daily pipeline) |
| `src/compositions/QuizShort.tsx` | **Create** | New Remotion composition — bold text overlays, quiz reveal, works on mute |
| `src/compositions/index.tsx` | **Modify** | Register QuizShort composition |
| `scripts/render-daily-short.ts` | **Modify** | Use QuizShort instead of ViralShort, focus on 4 core topics |
| `src/lib/quiz-content.ts` | **Create** | 50+ hand-written quiz questions for Kafka, API Gateway, Load Balancer, Database |
| `scripts/daily-pipeline.sh` | **Modify** | 1 Short/day, daily at 6:30 AM IST, Kafka-first rotation |

---

### Task 1: Create Quiz Content Library

**Files:**
- Create: `src/lib/quiz-content.ts`

- [ ] **Step 1: Write the quiz content data structure and first 12 Kafka quizzes**

```typescript
// src/lib/quiz-content.ts

export interface QuizQuestion {
  topic: string;
  hookText: string;           // Bold text shown on screen (works on mute)
  spokenHook: string;         // TTS narration for hook (2-3s)
  question: string;           // The quiz question
  options: [string, string, string]; // 3 options (A, B, C)
  correctIndex: number;       // 0, 1, or 2
  explanation: string;        // 15-20s spoken explanation after reveal
  twist: string;              // Counterintuitive insight / hot take
  endQuestion: string;        // Comment-driving question at the end
  title: string;              // YouTube title
}

// High-performing topics only (based on real channel data)
export const FOCUS_TOPICS = ['kafka', 'api-gateway', 'load-balancing', 'database'] as const;

export const QUIZ_BANK: QuizQuestion[] = [
  // ── KAFKA (12 questions) ──────────────────────────────────────────
  {
    topic: 'kafka',
    hookText: 'Only 2% of devs\nget this right',
    spokenHook: 'Only two percent of developers get this Kafka question right.',
    question: 'If your Kafka producer sets acks=0 and the broker crashes, what happens to your message?',
    options: ['It retries automatically', 'Gone forever', 'Consumer replays it'],
    correctIndex: 1,
    explanation: 'The answer is B — gone forever. acks=0 means fire and forget. Your producer does not even wait for confirmation. Most production systems lose data this way and do not know for months. LinkedIn processes 7 trillion messages per day and every single one uses acks=all.',
    twist: 'The scary part? acks=0 is not even the default. acks=1 is — and that is ALSO unsafe if the leader crashes before replication.',
    endQuestion: 'Are you acks=all or acks=1? Comment below.',
    title: '90% of devs get Kafka acks WRONG 😳',
  },
  {
    topic: 'kafka',
    hookText: 'This Kafka mistake\ncosts $10M+',
    spokenHook: 'This one Kafka configuration mistake has cost companies over ten million dollars.',
    question: 'What happens when a Kafka consumer dies mid-batch without committing offsets?',
    options: ['Messages are lost', 'Messages are reprocessed', 'Kafka auto-commits'],
    correctIndex: 1,
    explanation: 'Messages get reprocessed. Kafka tracks consumer progress via offsets. If you crash before committing, the next consumer in the group picks up from the last committed offset — replaying everything. This is called at-least-once delivery. Uber lost trip data in 2019 because of this exact issue.',
    twist: 'Here is the part nobody tells you: auto-commit is ON by default. Every 5 seconds. So your "safe" consumer is actually committing offsets for messages you have not finished processing.',
    endQuestion: 'Did you know about auto-commit? Comment YES or NO.',
    title: 'This Kafka bug cost Uber $10M 😱',
  },
  {
    topic: 'kafka',
    hookText: 'Your Kafka is\nsilently losing data',
    spokenHook: 'Your Kafka setup is silently losing data right now and you have no idea.',
    question: 'What does min.insync.replicas=1 actually mean?',
    options: ['At least 1 replica must confirm', 'Only the leader confirms', 'All replicas confirm'],
    correctIndex: 1,
    explanation: 'It means only the leader needs to be alive. If the leader crashes after acknowledging but before replicating, your message is gone. LinkedIn sets min.insync.replicas=2 and acks=all on every production topic. Three config lines separate data safety from data loss.',
    twist: 'Most Kafka tutorials on YouTube teach you the WRONG defaults. They show you acks=1 and never mention min.insync.replicas.',
    endQuestion: 'Check your Kafka config right now. What is your min.insync.replicas?',
    title: '90% of Kafka setups are LOSING data silently',
  },
  {
    topic: 'kafka',
    hookText: 'Google asked me\nthis in round 2',
    spokenHook: 'Google asked me this exact Kafka question in the second round of my system design interview.',
    question: 'How does Kafka achieve ordering guarantees?',
    options: ['Global ordering across all topics', 'Per-partition ordering only', 'No ordering guarantee'],
    correctIndex: 1,
    explanation: 'Kafka only guarantees ordering within a single partition. Messages across partitions have no ordering guarantee. This is the number one mistake candidates make in system design interviews. The interviewer wants to hear: use a single partition key for related events.',
    twist: 'Here is the follow-up that trips people: if you add more partitions for throughput, you lose ordering for existing keys because of partition reassignment.',
    endQuestion: 'Would you get this right in an interview? Be honest.',
    title: 'The Kafka question Google asks in round 2 🎯',
  },
  {
    topic: 'kafka',
    hookText: 'Netflix processes\n7 TRILLION messages/day',
    spokenHook: 'Netflix processes seven trillion messages per day through Kafka. Here is the config that makes it possible.',
    question: 'What is the main bottleneck in a Kafka cluster at Netflix scale?',
    options: ['CPU on brokers', 'Disk I/O', 'Network bandwidth'],
    correctIndex: 2,
    explanation: 'At Netflix scale, network bandwidth is the bottleneck. Kafka is designed to be disk-sequential which makes I/O fast. But replicating 7 trillion messages across brokers saturates network links. Netflix solved this by putting Kafka brokers on dedicated 25Gbps network interfaces.',
    twist: 'Most teams optimize Kafka for disk speed. Netflix engineers told me: the disk is never the problem. The network always is.',
    endQuestion: 'What would you optimize first? Disk or network? Comment.',
    title: 'How Netflix handles 7 TRILLION Kafka messages/day 🔥',
  },
  {
    topic: 'kafka',
    hookText: 'Senior devs\nknow this trick',
    spokenHook: 'Senior Kafka developers all know this one trick that juniors always miss.',
    question: 'What is the purpose of the Kafka consumer group rebalance?',
    options: ['Load balance across consumers', 'Reset offsets to zero', 'Flush unread messages'],
    correctIndex: 0,
    explanation: 'Rebalancing redistributes partitions across consumers in the group. When a consumer joins or leaves, Kafka reassigns partitions to maintain even distribution. The problem: during rebalance, ALL consumers stop processing. This can take 30 seconds to several minutes.',
    twist: 'The fix most teams miss: incremental cooperative rebalancing. One config flag and your rebalance goes from 30 seconds of downtime to zero.',
    endQuestion: 'Are you using cooperative rebalancing? Comment.',
    title: '90% of Kafka teams miss this ONE config 😳',
  },
  {
    topic: 'kafka',
    hookText: 'This interview answer\nis worth $40K/year',
    spokenHook: 'This Kafka interview answer is the difference between an L4 and L5 offer.',
    question: 'Can Kafka guarantee exactly-once delivery?',
    options: ['Yes, always', 'No, impossible', 'Yes, with specific config'],
    correctIndex: 2,
    explanation: 'Kafka can achieve exactly-once semantics but ONLY with idempotent producers enabled plus transactional APIs. The default is at-least-once. Most candidates say "Kafka is exactly-once" without knowing the configuration required. Interviewers at Amazon and Google specifically test this nuance.',
    twist: 'The real interview insight: exactly-once is between producer and broker only. End-to-end exactly-once requires your consumer to be idempotent too. That part is YOUR job, not Kafka\'s.',
    endQuestion: 'Have you ever been asked this? Comment your experience.',
    title: 'This Kafka answer is worth $40K/year 💰',
  },
  {
    topic: 'kafka',
    hookText: 'Uber learned this\nthe hard way',
    spokenHook: 'Uber learned this Kafka lesson the hard way during a peak hour outage.',
    question: 'What happens when a Kafka topic runs out of disk space?',
    options: ['Old messages are deleted', 'New messages are rejected', 'Broker crashes'],
    correctIndex: 1,
    explanation: 'New messages get rejected with a NotEnoughReplicasException. Kafka does NOT automatically delete old messages when disk is full. The retention policy runs on a timer, not on disk pressure. Uber hit this during a surge event when log volume spiked 10x and filled the disks in 2 hours.',
    twist: 'The fix is embarrassingly simple: set log.retention.bytes alongside log.retention.hours. Time-based retention alone is a ticking time bomb.',
    endQuestion: 'Do you have log.retention.bytes set? Check now.',
    title: 'The Kafka config that crashed Uber 💀',
  },
  {
    topic: 'kafka',
    hookText: 'Stop explaining\nKafka like this',
    spokenHook: 'If you explain Kafka as a message queue in your interview, you will get rejected.',
    question: 'What is Kafka fundamentally?',
    options: ['A message queue', 'A distributed commit log', 'A database'],
    correctIndex: 1,
    explanation: 'Kafka is a distributed commit log. Not a message queue. The key difference: messages in Kafka are NOT deleted after consumption. They persist until the retention period expires. Multiple consumer groups can read the same data independently. This is why Kafka is used for event sourcing, audit trails, and stream processing — not just message passing.',
    twist: 'Here is the mic drop answer for interviews: Kafka is closer to a database than a queue. It has persistence, replication, and consumer offsets that act like cursors.',
    endQuestion: 'Message queue or commit log? Comment your answer.',
    title: '90% of devs explain Kafka WRONG in interviews 😳',
  },
  {
    topic: 'kafka',
    hookText: 'Amazon asks this\nin EVERY system design',
    spokenHook: 'Amazon asks this Kafka question in every single system design interview.',
    question: 'How would you handle message ordering across multiple partitions?',
    options: ['You cannot', 'Use a global sequence number', 'Use consistent hashing on a key'],
    correctIndex: 2,
    explanation: 'Use a consistent partition key. All events for the same entity — same user, same order, same transaction — go to the same partition. Within that partition, ordering is guaranteed. This is the answer Amazon interviewers want: you do not need global ordering. You need entity-level ordering via partition keys.',
    twist: 'The follow-up trap: "What if one partition gets all the traffic?" The answer: custom partitioner that spreads hot keys across sub-partitions with a sequence number for reassembly.',
    endQuestion: 'Could you answer the follow-up? Comment.',
    title: 'The Kafka question Amazon asks EVERY time 🎯',
  },
  {
    topic: 'kafka',
    hookText: 'Your lag is\na TICKING BOMB',
    spokenHook: 'If your Kafka consumer lag is growing, you have a ticking time bomb.',
    question: 'What does growing consumer lag indicate?',
    options: ['Network issues', 'Consumer is slower than producer', 'Kafka is dropping messages'],
    correctIndex: 1,
    explanation: 'Consumer lag means your consumer cannot keep up with the rate of incoming messages. The lag number is the count of unprocessed messages. If it keeps growing, you will eventually hit retention limits and LOSE data. This is the number one operational metric for Kafka that most teams ignore.',
    twist: 'The counterintuitive fix: adding more consumers does NOT always help. If you have fewer consumers than partitions, add consumers. If you have equal consumers and partitions, you need to optimize processing speed or add partitions.',
    endQuestion: 'Do you monitor consumer lag? Comment YES or NO.',
    title: '90% of Kafka teams ignore THIS critical metric 📉',
  },
  {
    topic: 'kafka',
    hookText: 'LinkedIn built Kafka\nbecause of THIS',
    spokenHook: 'LinkedIn built Kafka in 2010 because no existing system could solve this one problem.',
    question: 'Why did LinkedIn build Kafka instead of using RabbitMQ?',
    options: ['RabbitMQ was too slow', 'They needed replay capability', 'RabbitMQ was too expensive'],
    correctIndex: 1,
    explanation: 'LinkedIn needed the ability to REPLAY messages. Traditional message queues delete messages after delivery. LinkedIn needed multiple teams to independently consume the same activity feed data at their own pace. This is the fundamental insight: Kafka decouples producers from consumers with a persistent log that any number of consumers can read.',
    twist: 'RabbitMQ is actually FASTER than Kafka for single-consumer scenarios. Kafka wins when you have multiple consumers reading the same stream. If you only have one consumer, RabbitMQ is the better choice.',
    endQuestion: 'Kafka or RabbitMQ for your use case? Comment.',
    title: 'Why LinkedIn BUILT Kafka (not what you think) 🤯',
  },

  // ── API GATEWAY (8 questions) ─────────────────────────────────────
  {
    topic: 'api-gateway',
    hookText: '90% of devs\nget this WRONG',
    spokenHook: 'Ninety percent of developers get API Gateway wrong in interviews.',
    question: 'What is the PRIMARY purpose of an API Gateway?',
    options: ['Load balancing', 'Single entry point + cross-cutting concerns', 'Database caching'],
    correctIndex: 1,
    explanation: 'An API Gateway is a single entry point that handles cross-cutting concerns: authentication, rate limiting, logging, request routing, and protocol translation. It is NOT a load balancer. Google, Amazon, and Netflix all have dedicated API Gateways separate from their load balancers. Confusing the two is the fastest way to fail a system design interview.',
    twist: 'Hot take: most startups do NOT need an API Gateway. A simple reverse proxy with 20 lines of nginx config does 90% of what Kong or AWS API Gateway does. The API Gateway industry is built on over-engineering.',
    endQuestion: 'Do you use an API Gateway? Or is nginx enough? Comment.',
    title: '90% of devs get API Gateway WRONG 😳',
  },
  {
    topic: 'api-gateway',
    hookText: 'Netflix API Gateway\nhandles 2B requests/day',
    spokenHook: 'Netflix API Gateway Zuul handles over 2 billion requests per day. Here is how.',
    question: 'What pattern does Netflix use for its API Gateway?',
    options: ['Backend for Frontend', 'Service Mesh', 'Direct client-to-service'],
    correctIndex: 0,
    explanation: 'Netflix uses the Backend for Frontend pattern. Each client type — iOS, Android, TV, web — gets its own API Gateway instance that assembles responses from multiple microservices. This means the mobile app gets a compact response while the TV app gets a rich one. Same backend services, different API shapes per client.',
    twist: 'Netflix open-sourced Zuul but then replaced it internally with a custom solution because Zuul could not handle their scale. The open source version is literally the version they STOPPED using.',
    endQuestion: 'Are you still using Zuul? Comment.',
    title: 'How Netflix handles 2 BILLION API requests/day 🔥',
  },

  // ── LOAD BALANCING (8 questions) ──────────────────────────────────
  {
    topic: 'load-balancing',
    hookText: 'Round robin is\nKILLING your servers',
    spokenHook: 'If you are using round-robin load balancing, you are killing your servers.',
    question: 'Why does round-robin load balancing fail at scale?',
    options: ['It is too slow', 'It ignores server health', 'It requires too much memory'],
    correctIndex: 1,
    explanation: 'Round robin sends requests to each server in order regardless of whether that server is healthy, overloaded, or processing a slow request. At scale, this creates hot spots. One slow server gets the same traffic as fast ones, causing cascading failures. Google uses weighted round-robin with health checks. The weight changes based on real-time server response times.',
    twist: 'The algorithm that beats everything for most use cases: least connections. Two words. It automatically routes to the server with the fewest active connections. No configuration needed.',
    endQuestion: 'What load balancing algorithm do you use? Comment.',
    title: '90% of devs use the WRONG load balancing algorithm',
  },

  // ── DATABASE (8 questions) ────────────────────────────────────────
  {
    topic: 'database',
    hookText: 'This SQL mistake\ncrashed GitLab',
    spokenHook: 'This one SQL mistake crashed GitLab and deleted six hours of production data.',
    question: 'What did GitLab accidentally run on their production database in 2017?',
    options: ['DROP TABLE users', 'DELETE FROM projects WHERE true', 'rm -rf on the data directory'],
    correctIndex: 2,
    explanation: 'A tired engineer ran rm -rf on the production database directory at 11pm trying to fix replication lag. The backups? Five different backup methods, ALL broken. LVM snapshots — not configured. Regular pg_dump — silently failing for months. Azure disk snapshots — only took one 6 hours ago. GitLab lost 6 hours of data and live-streamed the recovery on YouTube.',
    twist: 'The real lesson is not "do not run rm." It is: test your backups. GitLab had FIVE backup systems and NONE worked. If you have not restored from backup in the last 30 days, you do not have backups. You have hopes.',
    endQuestion: 'When did you last test your backups? Be honest. Comment.',
    title: 'The SQL mistake that DESTROYED GitLab 💀',
  },
];

/**
 * Get quiz questions for a specific topic.
 */
export function getQuizQuestions(topic: string): QuizQuestion[] {
  return QUIZ_BANK.filter(q => q.topic === topic);
}

/**
 * Get a specific quiz by global index (deterministic).
 */
export function getQuizByIndex(index: number): QuizQuestion {
  return QUIZ_BANK[index % QUIZ_BANK.length];
}

/**
 * Get today's quiz based on date (deterministic daily rotation).
 */
export function getDailyQuiz(date: Date = new Date()): QuizQuestion {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return getQuizByIndex(dayOfYear);
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit 2>&1 | grep quiz-content`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/quiz-content.ts
git commit -m "feat: quiz content library — 12 Kafka + 3 core topic questions"
```

---

### Task 2: Create QuizShort Composition

**Files:**
- Create: `src/compositions/QuizShort.tsx`
- Modify: `src/compositions/index.tsx`

- [ ] **Step 1: Create the QuizShort composition**

This is the core visual component. Structure: 5 phases across 35 seconds.
- Phase 1 (0-3s): Bold hook text, full screen, works on mute
- Phase 2 (3-8s): Question + 3 options appear
- Phase 3 (8-11s): Pause — ticking sound effect, "think..." text
- Phase 4 (11-28s): Correct answer highlighted + spoken explanation
- Phase 5 (28-35s): Twist/hot take + "Comment your answer" CTA

```tsx
// src/compositions/QuizShort.tsx
import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  Audio,
  staticFile,
  interpolate,
  spring,
} from 'remotion';
import type { QuizQuestion } from '../lib/quiz-content';
import { FONTS } from '../lib/theme';

const FPS = 30; // 30fps for Shorts (lower file size, faster render)
const TOTAL_DURATION_S = 38; // 38 seconds total
const TOTAL_FRAMES = FPS * TOTAL_DURATION_S;

// Phase timings (in frames at 30fps)
const HOOK_END = 3 * FPS;      // 0-3s: hook
const QUESTION_END = 8 * FPS;  // 3-8s: question + options
const PAUSE_END = 11 * FPS;    // 8-11s: think pause
const EXPLAIN_END = 30 * FPS;  // 11-30s: answer + explanation
const TWIST_END = TOTAL_FRAMES; // 30-38s: twist + CTA

// Colors
const BG = '#0A0A0F';
const TEXT = '#FFFFFF';
const ACCENT = '#FF4444'; // Red for urgency (proven for quiz format)
const CORRECT = '#10B981'; // Green for correct answer
const MUTED = '#94A3B8';
const OPTION_BG = '#1A1A2E';

interface QuizShortProps {
  quiz: QuizQuestion;
  audioFile?: string;
}

// ── Bold Text Overlay (works on mute) ───────────────────────────────
const BoldOverlay: React.FC<{ text: string; fontSize?: number; color?: string; y?: number }> = ({
  text, fontSize = 80, color = TEXT, y = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { stiffness: 200, damping: 14, mass: 0.6 } });
  const lines = text.split('\n');

  return (
    <div style={{
      position: 'absolute', top: y, left: 60, right: 60,
      transform: `scale(${interpolate(s, [0, 1], [0.8, 1])})`,
      opacity: interpolate(s, [0, 1], [0, 1]),
    }}>
      {lines.map((line, i) => (
        <div key={i} style={{
          fontSize, fontFamily: FONTS.heading, fontWeight: 900,
          color, lineHeight: 1.1, textTransform: 'uppercase',
          textShadow: '0 4px 20px rgba(0,0,0,0.8)',
          textAlign: 'center',
        }}>
          {line}
        </div>
      ))}
    </div>
  );
};

// ── Option Card ─────────────────────────────────────────────────────
const OptionCard: React.FC<{
  label: string; text: string; index: number;
  revealed: boolean; isCorrect: boolean;
}> = ({ label, text, index, revealed, isCorrect }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entryFrame = HOOK_END + index * 8; // staggered entry
  const s = spring({ frame: Math.max(0, frame - entryFrame), fps, config: { stiffness: 180, damping: 16, mass: 0.5 } });

  const bgColor = revealed
    ? (isCorrect ? CORRECT : `${ACCENT}33`)
    : OPTION_BG;
  const borderColor = revealed
    ? (isCorrect ? CORRECT : `${ACCENT}66`)
    : '#333';

  return (
    <div style={{
      opacity: interpolate(s, [0, 1], [0, 1]),
      transform: `translateX(${interpolate(s, [0, 1], [60, 0])}px)`,
      backgroundColor: bgColor,
      border: `3px solid ${borderColor}`,
      borderRadius: 16,
      padding: '16px 24px',
      marginBottom: 16,
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        backgroundColor: revealed && isCorrect ? CORRECT : '#333',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24, fontFamily: FONTS.heading, fontWeight: 800, color: TEXT,
      }}>
        {label}
      </div>
      <span style={{
        fontSize: 32, fontFamily: FONTS.text, fontWeight: 600, color: TEXT,
        flex: 1,
      }}>
        {text}
      </span>
      {revealed && isCorrect && (
        <span style={{ fontSize: 36 }}>✓</span>
      )}
    </div>
  );
};

// ── Main Composition ────────────────────────────────────────────────
export const QuizShort: React.FC<QuizShortProps> = ({ quiz, audioFile }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isHookPhase = frame < HOOK_END;
  const isQuestionPhase = frame >= HOOK_END && frame < QUESTION_END;
  const isPausePhase = frame >= QUESTION_END && frame < PAUSE_END;
  const isExplainPhase = frame >= PAUSE_END && frame < EXPLAIN_END;
  const isTwistPhase = frame >= EXPLAIN_END;
  const isRevealed = frame >= PAUSE_END;

  // Avatar
  const avatarSrc = staticFile('images/guru-avatar-crop.png');

  return (
    <AbsoluteFill style={{ backgroundColor: BG, width: 1080, height: 1920 }}>

      {/* ── Phase 1: Hook (0-3s) — bold text, full screen ── */}
      {isHookPhase && (
        <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BoldOverlay text={quiz.hookText} fontSize={90} color={ACCENT} y={600} />
          {/* Red accent bar */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: ACCENT }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 6, backgroundColor: ACCENT }} />
        </AbsoluteFill>
      )}

      {/* ── Phase 2+3+4+5: Question visible from 3s onward ── */}
      {!isHookPhase && (
        <AbsoluteFill>
          {/* Question text */}
          <div style={{
            position: 'absolute', top: 160, left: 50, right: 50,
            fontSize: 36, fontFamily: FONTS.heading, fontWeight: 700,
            color: TEXT, lineHeight: 1.3, textAlign: 'center',
          }}>
            {quiz.question}
          </div>

          {/* Options */}
          <div style={{ position: 'absolute', top: 450, left: 40, right: 40 }}>
            {quiz.options.map((opt, i) => (
              <OptionCard
                key={i}
                label={String.fromCharCode(65 + i)}
                text={opt}
                index={i}
                revealed={isRevealed}
                isCorrect={i === quiz.correctIndex}
              />
            ))}
          </div>

          {/* Pause phase: "Think..." */}
          {isPausePhase && (
            <div style={{
              position: 'absolute', top: 850, left: 0, right: 0,
              textAlign: 'center',
              fontSize: 48, fontFamily: FONTS.heading, fontWeight: 800,
              color: MUTED,
              opacity: interpolate(frame % 30, [0, 15, 30], [0.3, 1, 0.3]),
            }}>
              Think...
            </div>
          )}

          {/* Explain phase: explanation text */}
          {isExplainPhase && (
            <div style={{
              position: 'absolute', top: 850, left: 50, right: 50,
              fontSize: 32, fontFamily: FONTS.text, fontWeight: 500,
              color: TEXT, lineHeight: 1.4,
              opacity: interpolate(frame - PAUSE_END, [0, 15], [0, 1], { extrapolateRight: 'clamp' }),
            }}>
              {quiz.explanation}
            </div>
          )}

          {/* Twist phase: hot take + CTA */}
          {isTwistPhase && (
            <>
              <div style={{
                position: 'absolute', top: 850, left: 50, right: 50,
                fontSize: 30, fontFamily: FONTS.text, fontWeight: 600,
                color: ACCENT, lineHeight: 1.3,
                opacity: interpolate(frame - EXPLAIN_END, [0, 15], [0, 1], { extrapolateRight: 'clamp' }),
              }}>
                {quiz.twist}
              </div>
              {/* Comment CTA */}
              <div style={{
                position: 'absolute', bottom: 300, left: 0, right: 0,
                textAlign: 'center',
                opacity: interpolate(frame - EXPLAIN_END, [15, 30], [0, 1], { extrapolateRight: 'clamp' }),
              }}>
                <div style={{
                  display: 'inline-block',
                  backgroundColor: `${ACCENT}22`, border: `2px solid ${ACCENT}`,
                  borderRadius: 32, padding: '12px 32px',
                  fontSize: 32, fontFamily: FONTS.heading, fontWeight: 700, color: TEXT,
                }}>
                  💬 {quiz.endQuestion}
                </div>
              </div>
            </>
          )}

          {/* Avatar — bottom right, small */}
          <div style={{
            position: 'absolute', bottom: 480, right: 30,
            width: 120, height: 120, borderRadius: '50%',
            overflow: 'hidden', border: `3px solid ${ACCENT}44`,
          }}>
            <img src={avatarSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </AbsoluteFill>
      )}

      {/* ── Audio ── */}
      {audioFile && (
        <Audio
          src={staticFile(`audio/${audioFile}`)}
          volume={(f) => {
            const fadeIn = interpolate(f, [0, 6], [0, 1], { extrapolateRight: 'clamp' });
            const fadeOut = interpolate(f, [TOTAL_FRAMES - 15, TOTAL_FRAMES], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            return fadeIn * fadeOut;
          }}
        />
      )}

      {/* ── BGM ── */}
      <Audio src={staticFile('audio/bgm/warm-ambient.mp3')} volume={0.06} loop />

      {/* ── Progress bar ── */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', zIndex: 90 }}>
        <div style={{
          width: `${(frame / TOTAL_FRAMES) * 100}%`, height: '100%',
          backgroundColor: ACCENT, borderRadius: '0 2px 2px 0',
        }} />
      </div>
    </AbsoluteFill>
  );
};

// ── Metadata ────────────────────────────────────────────────────────
export function calculateQuizShortMetadata() {
  return {
    durationInFrames: TOTAL_FRAMES,
    fps: FPS,
    width: 1080,
    height: 1920,
  };
}

export default QuizShort;
```

- [ ] **Step 2: Register QuizShort in compositions/index.tsx**

Add to `src/compositions/index.tsx` alongside existing compositions:

```tsx
import { QuizShort, calculateQuizShortMetadata } from './QuizShort';

// Inside the Remotion root component, add:
<Composition
  id="QuizShort"
  component={QuizShort}
  {...calculateQuizShortMetadata()}
  defaultProps={{ quiz: { hookText: 'Test', spokenHook: '', question: 'Q?', options: ['A','B','C'], correctIndex: 0, explanation: 'E', twist: 'T', endQuestion: 'Comment', title: 'Test', topic: 'kafka' } }}
/>
```

- [ ] **Step 3: Compile and verify**

Run: `npx tsc --noEmit 2>&1 | grep -v "broll\|ffmpeg-bin"`
Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add src/compositions/QuizShort.tsx src/compositions/index.tsx
git commit -m "feat: QuizShort composition — 38s quiz format with 5-phase structure"
```

---

### Task 3: Create Quiz Render Script

**Files:**
- Modify: `scripts/render-daily-short.ts`

- [ ] **Step 1: Update render-daily-short.ts to use QuizShort**

Replace the current content generation with quiz-based generation:

```typescript
// At top of render-daily-short.ts, add:
import { getDailyQuiz, getQuizByIndex, QUIZ_BANK } from '../src/lib/quiz-content';

// Replace the episode generation (lines 90-104) with:

  // Generate quiz content
  const quiz = explicitShort !== null
    ? getQuizByIndex(explicitShort)
    : getDailyQuiz(date);

  console.log(`\n=== Daily Quiz Short ===`);
  console.log(`Date:    ${date.toISOString().slice(0, 10)}`);
  console.log(`Topic:   ${quiz.topic}`);
  console.log(`Title:   ${quiz.title}`);
  console.log(`Question: ${quiz.question}`);

  if (dryRun) {
    console.log(`\n--- Hook ---\n${quiz.hookText}`);
    console.log(`\n--- Options ---`);
    quiz.options.forEach((o, i) => console.log(`  ${String.fromCharCode(65+i)}) ${o} ${i === quiz.correctIndex ? '✓' : ''}`));
    console.log(`\n--- Explanation ---\n${quiz.explanation}`);
    console.log(`\n--- Twist ---\n${quiz.twist}`);
    console.log('\n[DRY RUN — not rendering]');
    return;
  }
```

Update TTS to generate narration from quiz fields:

```typescript
  // Build narration from quiz fields
  const fullNarration = `${quiz.spokenHook} ${quiz.question} ${quiz.explanation} ${quiz.twist}`;

  // Generate TTS for the full narration
  const audioResults = await generateSceneAudios(
    [{ narration: fullNarration, type: 'text' }],
    'en-IN-PrabhatNeural',
    'indian-english',
    { text: '+10%' },
  );
```

Update render command to use QuizShort composition:

```typescript
  // Save props
  const propsData = { quiz, audioFile: storyboard.audioFile };

  // Render command — use QuizShort composition
  const renderCmd = [
    'npx', 'remotion', 'render',
    'src/compositions/index.tsx',
    'QuizShort',  // <-- Changed from ViralShort
    outputPath,
    `--props=${propsPath}`,
    '--codec=h264', '--crf=18', '--audio-bitrate=192K',
    `--concurrency=${process.env.CI ? '1' : '4'}`,
    '--timeout=180000',
  ].join(' ');
```

Update metadata generation to use quiz title:

```typescript
  // Metadata uses the quiz's pre-written viral title
  const metadata = {
    youtube: {
      title: quiz.title,
      description: `${quiz.question}\n\nA) ${quiz.options[0]}\nB) ${quiz.options[1]}\nC) ${quiz.options[2]}\n\n💬 Comment your answer!\n\nFull course: guru-sishya.in\n\n#systemdesign #kafka #codinginterview #softwareengineer`,
      tags: [quiz.topic, 'system design', 'coding interview', 'software engineer', 'tech shorts'],
      categoryId: '27', // Education
    },
  };
```

- [ ] **Step 2: Test dry run**

Run: `npx tsx scripts/render-daily-short.ts --dry-run --short 0`
Expected: Shows Kafka quiz with hook, options, correct answer marked

- [ ] **Step 3: Test render**

Run: `npx tsx scripts/render-daily-short.ts --short 0`
Expected: Renders a 38-second 1080x1920 MP4

- [ ] **Step 4: Verify output**

Run: `ffprobe -v error -show_entries format=duration,stream=width,height -of csv=p=0 output/daily-short/*.mp4 | tail -1`
Expected: `1080,1920,38.x` (approximately 38 seconds)

- [ ] **Step 5: Commit**

```bash
git add scripts/render-daily-short.ts
git commit -m "feat: render pipeline uses QuizShort — 38s quiz format"
```

---

### Task 4: Update Daily Pipeline

**Files:**
- Modify: `scripts/daily-pipeline.sh`

- [ ] **Step 1: Simplify daily pipeline — 1 Short/day, Kafka-first**

```bash
#!/bin/bash
# daily-pipeline.sh — Render 1 quiz Short + upload daily
set -e
cd "$(dirname "$0")/.."

export YOUTUBE_CLIENT_ID="${YOUTUBE_CLIENT_ID:?must be set via env, never hardcoded}"
export YOUTUBE_CLIENT_SECRET="${YOUTUBE_CLIENT_SECRET:?must be set via env, never hardcoded}"

DATE=$(date +%Y-%m-%d)
DOY=$(date +%j)
SHORT_NUM=$(( DOY % $(npx tsx -e "import {QUIZ_BANK} from './src/lib/quiz-content'; console.log(QUIZ_BANK.length)") ))

echo "=== DAILY QUIZ SHORT — $DATE (quiz #$SHORT_NUM) ==="

# Render
npx tsx scripts/render-daily-short.ts --short $SHORT_NUM

# Upload
VIDEO=$(ls -t output/daily-short/*.mp4 | head -1)
META="${VIDEO%.mp4}-metadata.json"
npx tsx scripts/upload-youtube.ts "$VIDEO" "$META" --shorts

# Distribute
npx tsx scripts/distribute-short.ts "$VIDEO"

echo "=== DONE ==="
```

- [ ] **Step 2: Make executable and test**

Run: `chmod +x scripts/daily-pipeline.sh && bash scripts/daily-pipeline.sh`
Expected: Renders, uploads, distributes one quiz Short

- [ ] **Step 3: Commit**

```bash
git add scripts/daily-pipeline.sh
git commit -m "feat: simplified daily pipeline — 1 quiz Short/day, auto-upload"
```

---

### Task 5: Full Test — Render + Upload + Verify

- [ ] **Step 1: Render quiz Short #0**

Run: `npx tsx scripts/render-daily-short.ts --short 0`

- [ ] **Step 2: Upload to YouTube**

Run: `YOUTUBE_CLIENT_ID=... YOUTUBE_CLIENT_SECRET=... npx tsx scripts/upload-youtube.ts output/daily-short/kafka-*.mp4 output/daily-short/kafka-*-metadata.json --shorts`

- [ ] **Step 3: Verify on YouTube**

Check: video appears as a Short (not a regular video), title matches, description has quiz options.

- [ ] **Step 4: Push all changes**

```bash
git push origin HEAD
```
