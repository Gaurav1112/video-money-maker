import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';
import type { SyncState } from '../../types';

const C = {
  saffron: '#E85D26',
  gold: '#FDB813',
  teal: '#1DD1A1',
  indigo: '#818CF8',
  gray: '#A9ACB3',
  dark: '#0C0A15',
  darkAlt: '#1A1625',
  white: '#FFFFFF',
  red: '#EF4444',
  green: '#22C55E',
  purple: '#A855F7',
  cyan: '#06B6D4',
};

interface QueueVizProps {
  sync: SyncState;
  frame: number;
  keywords: string[];
  variant?: string;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function progressWindow(p: number, start: number, end: number) {
  return clamp((p - start) / (end - start), 0, 1);
}

function useReliableProgress(frame: number, fps: number, sync: SyncState): number {
  if (sync.sceneProgress > 0.01 && sync.sceneProgress < 0.99) {
    return sync.sceneProgress;
  }
  const assumedDuration = 8 * fps;
  return Math.min(1, frame / assumedDuration);
}

// ---- Realistic message labels ----
const MSG_LABELS = [
  'order_123', 'payment_456', 'email_789', 'notify_012',
  'audit_345', 'ship_678', 'refund_901', 'stock_234',
  'auth_567', 'log_890',
];

// ---- Message item colors ----
const MSG_COLORS = [C.saffron, C.gold, C.teal, C.indigo, C.green, C.purple, C.cyan];

interface MessageBoxProps {
  x: number; y: number; width: number; height: number;
  color: string; label: string; opacity: number;
  isProcessing?: boolean; frame: number;
}

const MessageBox: React.FC<MessageBoxProps> = ({
  x, y, width, height, color, label, opacity, isProcessing, frame,
}) => {
  const pulse = isProcessing ? 0.6 + 0.4 * Math.sin(frame * 0.2) : 0;

  return (
    <g opacity={opacity}>
      <rect x={x} y={y} width={width} height={height} rx={4}
        fill={`${color}33`} stroke={color} strokeWidth={1.5}
      />
      {isProcessing && (
        <rect x={x} y={y} width={width} height={height} rx={4}
          fill={color} opacity={pulse * 0.2}
        />
      )}
      <text x={x + width / 2} y={y + height / 2 + 1} fill={color}
        fontSize={8} fontWeight={600} fontFamily="'JetBrains Mono', 'SF Mono', monospace"
        textAnchor="middle" dominantBaseline="middle">
        {label}
      </text>
    </g>
  );
};

// =====================================================================
// Throughput counter component
// =====================================================================
const ThroughputCounter: React.FC<{ produced: number; consumed: number; frame: number; fps: number }> = ({
  produced, consumed, frame, fps,
}) => {
  // Calculate messages per second based on consumed count and elapsed time
  const elapsedSec = Math.max(1, frame / fps);
  const msgsPerSec = Math.round((consumed / elapsedSec) * 100) / 100;
  // Animated display with slight jitter for realism
  const jitter = Math.sin(frame * 0.3) * 12;
  const displayRate = Math.max(0, Math.round(msgsPerSec * 1000 + jitter));

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: C.green,
        boxShadow: `0 0 6px ${C.green}`,
        opacity: 0.6 + 0.4 * Math.sin(frame * 0.12),
      }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 9, color: C.gray }}>Throughput</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.teal, fontFamily: "'JetBrains Mono', monospace" }}>
          {displayRate.toLocaleString()}
        </div>
        <div style={{ fontSize: 8, color: C.gray }}>msg/sec</div>
      </div>
    </div>
  );
};

// =====================================================================
// FIFO VARIANT (default) - Simple queue with producer/consumer
// =====================================================================
const FifoVariant: React.FC<Omit<QueueVizProps, 'variant'>> = ({ sync, frame }) => {
  const { fps, width, height } = useVideoConfig();
  const p = useReliableProgress(frame, fps, sync);
  const svgW = width;
  const svgH = height;

  // Layout
  const producerPos = { fx: 0.10, fy: 0.45 };
  const queuePos = { fx: 0.50, fy: 0.45 };
  const consumerPos = { fx: 0.90, fy: 0.45 };

  const revealP = progressWindow(p, 0, 0.10);
  const nodeSpring = spring({ frame, fps, config: { damping: 12, stiffness: 100, mass: 0.9 }, from: 0, to: revealP > 0 ? 1 : 0 });

  const flowActive = p > 0.15;

  // Queue state: items enter and leave
  const queueMaxDisplay = 6;
  const msgW = 62;
  const msgH = 28;
  const msgGap = 6;
  const queueWidth = queueMaxDisplay * (msgW + msgGap) + 20;
  const queueHeight = msgH + 24;
  const queueX = queuePos.fx * svgW - queueWidth / 2;
  const queueY = queuePos.fy * svgH - queueHeight / 2;

  // Frame-driven queue fill/drain simulation
  const produceCycle = Math.floor(fps * 0.8);
  const consumeCycle = Math.floor(fps * 1.2);
  const produced = flowActive ? Math.floor(frame / produceCycle) : 0;
  const consumed = flowActive ? Math.floor(frame / consumeCycle) : 0;
  const queueDepth = clamp(produced - consumed, 0, queueMaxDisplay);

  // Items currently in queue with realistic labels
  const items = Array.from({ length: queueDepth }).map((_, i) => ({
    idx: (consumed + i) % MSG_COLORS.length,
    label: MSG_LABELS[(consumed + i) % MSG_LABELS.length],
    color: MSG_COLORS[(consumed + i) % MSG_COLORS.length],
  }));

  // Producer -> Queue arrow
  const prodArrow = {
    x1: producerPos.fx * svgW + 50, y1: producerPos.fy * svgH,
    x2: queueX - 10, y2: queuePos.fy * svgH,
  };
  // Queue -> Consumer arrow
  const consArrow = {
    x1: queueX + queueWidth + 10, y1: queuePos.fy * svgH,
    x2: consumerPos.fx * svgW - 50, y2: consumerPos.fy * svgH,
  };

  const arrowDrawP = progressWindow(p, 0.08, 0.16);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'transparent', fontFamily: 'Inter, sans-serif' }}>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}
        viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">

        {/* Arrows */}
        <g opacity={arrowDrawP}>
          <line x1={prodArrow.x1} y1={prodArrow.y1} x2={prodArrow.x2} y2={prodArrow.y2}
            stroke={C.saffron} strokeWidth={2.5} strokeLinecap="round"
            opacity={0.5 + 0.3 * Math.sin(frame * 0.06)}
          />
          <polygon points={`${prodArrow.x2},${prodArrow.y2} ${prodArrow.x2 - 8},${prodArrow.y2 - 5} ${prodArrow.x2 - 8},${prodArrow.y2 + 5}`}
            fill={C.saffron} opacity={0.8}
          />
          <text x={(prodArrow.x1 + prodArrow.x2) / 2} y={prodArrow.y1 - 14}
            fill={C.saffron} fontSize={10} fontWeight={600} fontFamily="Inter, sans-serif" textAnchor="middle">
            ENQUEUE
          </text>
        </g>

        <g opacity={arrowDrawP}>
          <line x1={consArrow.x1} y1={consArrow.y1} x2={consArrow.x2} y2={consArrow.y2}
            stroke={C.teal} strokeWidth={2.5} strokeLinecap="round"
            opacity={0.5 + 0.3 * Math.sin(frame * 0.06)}
          />
          <polygon points={`${consArrow.x2},${consArrow.y2} ${consArrow.x2 - 8},${consArrow.y2 - 5} ${consArrow.x2 - 8},${consArrow.y2 + 5}`}
            fill={C.teal} opacity={0.8}
          />
          <text x={(consArrow.x1 + consArrow.x2) / 2} y={consArrow.y1 - 14}
            fill={C.teal} fontSize={10} fontWeight={600} fontFamily="Inter, sans-serif" textAnchor="middle">
            DEQUEUE
          </text>
        </g>

        {/* Queue container */}
        <rect x={queueX} y={queueY} width={queueWidth} height={queueHeight} rx={8}
          fill={`${C.indigo}08`} stroke={C.indigo} strokeWidth={2} opacity={nodeSpring}
        />
        <text x={queueX + queueWidth / 2} y={queueY - 10} fill={C.indigo}
          fontSize={12} fontWeight={700} fontFamily="Inter, sans-serif" textAnchor="middle" opacity={nodeSpring}>
          MESSAGE QUEUE (FIFO)
        </text>

        {/* Head/Tail labels */}
        <text x={queueX + 14} y={queueY + queueHeight + 16} fill={C.gray}
          fontSize={9} fontFamily="Inter, sans-serif" opacity={nodeSpring}>
          HEAD
        </text>
        <text x={queueX + queueWidth - 14} y={queueY + queueHeight + 16} fill={C.gray}
          fontSize={9} fontFamily="Inter, sans-serif" textAnchor="end" opacity={nodeSpring}>
          TAIL
        </text>

        {/* Messages in queue */}
        {items.map((item, i) => {
          const mx = queueX + 10 + i * (msgW + msgGap);
          const my = queueY + (queueHeight - msgH) / 2;
          const isFirst = i === 0;
          return (
            <MessageBox key={`msg-${i}`}
              x={mx} y={my} width={msgW} height={msgH}
              color={item.color} label={item.label} opacity={nodeSpring}
              isProcessing={isFirst} frame={frame}
            />
          );
        })}

        {/* Incoming message animation */}
        {flowActive && (() => {
          const inT = (frame % produceCycle) / produceCycle;
          if (inT < 0.6) {
            const cx = prodArrow.x1 + (prodArrow.x2 - prodArrow.x1) * (inT / 0.6);
            const cy = prodArrow.y1;
            return (
              <rect x={cx - 10} y={cy - 8} width={20} height={16} rx={3}
                fill={C.saffron} opacity={0.7}
                style={{ filter: `drop-shadow(0 0 4px ${C.saffron})` }}
              />
            );
          }
          return null;
        })()}

        {/* Outgoing message animation */}
        {flowActive && (() => {
          const outT = (frame % consumeCycle) / consumeCycle;
          if (outT > 0.4 && outT < 0.9) {
            const t = (outT - 0.4) / 0.5;
            const cx = consArrow.x1 + (consArrow.x2 - consArrow.x1) * t;
            const cy = consArrow.y1;
            return (
              <rect x={cx - 10} y={cy - 8} width={20} height={16} rx={3}
                fill={C.teal} opacity={0.7 * (1 - t)}
                style={{ filter: `drop-shadow(0 0 4px ${C.teal})` }}
              />
            );
          }
          return null;
        })()}
      </svg>

      {/* Producer */}
      <div style={{
        position: 'absolute', left: `${producerPos.fx * 100}%`, top: `${producerPos.fy * 100}%`,
        transform: `translate(-50%, -50%) scale(${nodeSpring})`, opacity: nodeSpring,
        width: 80, height: 60, borderRadius: 10,
        background: `${C.saffron}18`, border: `2px solid ${C.saffron}`,
        boxShadow: flowActive ? `0 0 12px ${C.saffron}44` : 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.saffron }}>PRODUCER</span>
        <span style={{ fontSize: 9, color: C.gray }}>Service A</span>
      </div>

      {/* Consumer */}
      <div style={{
        position: 'absolute', left: `${consumerPos.fx * 100}%`, top: `${consumerPos.fy * 100}%`,
        transform: `translate(-50%, -50%) scale(${nodeSpring})`, opacity: nodeSpring,
        width: 80, height: 60, borderRadius: 10,
        background: `${C.teal}18`, border: `2px solid ${C.teal}`,
        boxShadow: flowActive ? `0 0 12px ${C.teal}44` : 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.teal }}>CONSUMER</span>
        <span style={{ fontSize: 9, color: C.gray }}>Service B</span>
      </div>

      {/* Queue depth counter + throughput */}
      {flowActive && (
        <div style={{
          position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)',
          background: `${C.dark}CC`, border: `1.5px solid ${C.indigo}44`, borderRadius: 8,
          padding: '8px 20px', display: 'flex', gap: 24, alignItems: 'center',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: C.gray }}>Queue Depth</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: queueDepth > 4 ? C.saffron : C.teal }}>{queueDepth}</div>
          </div>
          <div style={{ width: 1, height: 28, background: `${C.gray}44` }} />
          <ThroughputCounter produced={produced} consumed={consumed} frame={frame} fps={fps} />
          <div style={{ width: 1, height: 28, background: `${C.gray}44` }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: C.gray }}>Produced</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.saffron }}>{produced}</div>
          </div>
          <div style={{ width: 1, height: 28, background: `${C.gray}44` }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: C.gray }}>Consumed</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.teal }}>{consumed}</div>
          </div>
        </div>
      )}
    </div>
  );
};

// =====================================================================
// PUB-SUB VARIANT - Fan-out to multiple consumers with animated trails
// =====================================================================
const PubSubVariant: React.FC<Omit<QueueVizProps, 'variant'>> = ({ sync, frame }) => {
  const { fps, width, height } = useVideoConfig();
  const p = useReliableProgress(frame, fps, sync);
  const svgW = width;
  const svgH = height;

  const publisherPos = { fx: 0.12, fy: 0.45 };
  const topicPos = { fx: 0.45, fy: 0.45 };
  const subscribers = [
    { fx: 0.82, fy: 0.15, label: 'Email Svc', color: C.saffron },
    { fx: 0.85, fy: 0.40, label: 'Analytics', color: C.gold },
    { fx: 0.82, fy: 0.65, label: 'Notification', color: C.teal },
    { fx: 0.78, fy: 0.88, label: 'Audit Log', color: C.indigo },
  ];

  const revealP = progressWindow(p, 0, 0.10);
  const nodeSpring = spring({ frame, fps, config: { damping: 12, stiffness: 100, mass: 0.9 }, from: 0, to: revealP > 0 ? 1 : 0 });

  const subSprings = subscribers.map((_, i) =>
    spring({ frame: Math.max(0, frame - i * 6), fps, config: { damping: 13, stiffness: 110, mass: 0.8 }, from: 0, to: progressWindow(p, 0.08, 0.18) > 0 ? 1 : 0 })
  );

  const arrowDrawP = progressWindow(p, 0.10, 0.20);
  const flowActive = p > 0.18;
  const dotPeriod = fps * 1.6;

  // Pub -> Topic arrow
  const pubArrow = {
    x1: publisherPos.fx * svgW + 50, y1: publisherPos.fy * svgH,
    x2: topicPos.fx * svgW - 60, y2: topicPos.fy * svgH,
  };

  // Topic -> Subscriber arrows (fan-out)
  const subArrows = subscribers.map((s) => ({
    x1: topicPos.fx * svgW + 60, y1: topicPos.fy * svgH,
    x2: s.fx * svgW - 50, y2: s.fy * svgH,
  }));

  // Throughput counter for pub-sub
  const pubCycle = Math.floor(fps * 1.2);
  const pubCount = flowActive ? Math.floor(frame / pubCycle) : 0;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'transparent', fontFamily: 'Inter, sans-serif' }}>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}
        viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">

        {/* SVG defs for fan-out trail gradient */}
        <defs>
          {subscribers.map((sub, i) => (
            <linearGradient key={`trail-grad-${i}`} id={`trail-grad-${i}`}
              x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={sub.color} stopOpacity={0.6} />
              <stop offset="100%" stopColor={sub.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {/* Publisher -> Topic arrow */}
        <g opacity={arrowDrawP * (0.5 + 0.3 * Math.sin(frame * 0.06))}>
          <line x1={pubArrow.x1} y1={pubArrow.y1} x2={pubArrow.x2} y2={pubArrow.y2}
            stroke={C.saffron} strokeWidth={2.5} strokeLinecap="round" />
          <polygon points={`${pubArrow.x2},${pubArrow.y2} ${pubArrow.x2 - 8},${pubArrow.y2 - 5} ${pubArrow.x2 - 8},${pubArrow.y2 + 5}`}
            fill={C.saffron} />
          <text x={(pubArrow.x1 + pubArrow.x2) / 2} y={pubArrow.y1 - 12}
            fill={C.saffron} fontSize={10} fontWeight={600} fontFamily="Inter, sans-serif" textAnchor="middle">
            PUBLISH
          </text>
        </g>

        {/* Fan-out arrows with animated trail lines */}
        {subArrows.map((a, i) => {
          const dx = a.x2 - a.x1;
          const dy = a.y2 - a.y1;
          const len = Math.sqrt(dx * dx + dy * dy);
          const drawnLen = len * arrowDrawP;
          const ex = a.x1 + (dx / len) * drawnLen;
          const ey = a.y1 + (dy / len) * drawnLen;
          const angle = Math.atan2(dy, dx);

          return (
            <g key={`sa-${i}`} opacity={arrowDrawP * (0.5 + 0.3 * Math.sin(frame * 0.06 + i))}>
              {/* Main connection line */}
              <line x1={a.x1} y1={a.y1} x2={ex} y2={ey}
                stroke={subscribers[i].color} strokeWidth={2} strokeLinecap="round" />
              {/* Animated trail effect — wider fading line that pulses */}
              {flowActive && (
                <line x1={a.x1} y1={a.y1} x2={ex} y2={ey}
                  stroke={subscribers[i].color} strokeWidth={6} strokeLinecap="round"
                  opacity={0.08 + 0.06 * Math.sin(frame * 0.1 + i * 1.5)}
                />
              )}
              {arrowDrawP > 0.85 && (
                <polygon
                  points={`${ex},${ey} ${ex - 8 * Math.cos(angle - Math.PI / 6)},${ey - 8 * Math.sin(angle - Math.PI / 6)} ${ex - 8 * Math.cos(angle + Math.PI / 6)},${ey - 8 * Math.sin(angle + Math.PI / 6)}`}
                  fill={subscribers[i].color} opacity={0.8}
                />
              )}
            </g>
          );
        })}

        {/* Fan-out flowing dots with trail particles */}
        {subArrows.map((a, i) => {
          const dots = [];
          for (let d = 0; d < 3; d++) {
            const offset = i * Math.floor(dotPeriod / 4) + d * Math.floor(dotPeriod / 3);
            const rawT = ((frame - offset) % dotPeriod) / dotPeriod;
            const t = rawT < 0 ? rawT + 1 : rawT;
            const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            const cx = a.x1 + (a.x2 - a.x1) * eased;
            const cy = a.y1 + (a.y2 - a.y1) * eased;
            const alpha = t < 0.1 ? t / 0.1 : t > 0.9 ? (1 - t) / 0.1 : 1;

            // Main dot
            dots.push(
              <circle key={`fd-${i}-${d}`} cx={cx} cy={cy} r={5}
                fill={subscribers[i].color} opacity={flowActive ? alpha * 0.8 : 0}
                style={{ filter: `drop-shadow(0 0 4px ${subscribers[i].color})` }}
              />
            );
            // Trail particle behind the dot
            if (flowActive && t > 0.05) {
              const trailT = Math.max(0, eased - 0.06);
              const tx = a.x1 + (a.x2 - a.x1) * trailT;
              const ty = a.y1 + (a.y2 - a.y1) * trailT;
              dots.push(
                <circle key={`ft-${i}-${d}`} cx={tx} cy={ty} r={3}
                  fill={subscribers[i].color} opacity={flowActive ? alpha * 0.3 : 0}
                />
              );
            }
          }
          return dots;
        })}

        {/* Publish dot */}
        {flowActive && (() => {
          const pubT = ((frame) % Math.floor(fps * 1.2)) / Math.floor(fps * 1.2);
          const eased = pubT < 0.5 ? 2 * pubT * pubT : -1 + (4 - 2 * pubT) * pubT;
          const cx = pubArrow.x1 + (pubArrow.x2 - pubArrow.x1) * eased;
          const cy = pubArrow.y1;
          const alpha = pubT < 0.1 ? pubT / 0.1 : pubT > 0.9 ? (1 - pubT) / 0.1 : 1;
          return (
            <circle cx={cx} cy={cy} r={6} fill={C.saffron} opacity={alpha * 0.8}
              style={{ filter: `drop-shadow(0 0 4px ${C.saffron})` }}
            />
          );
        })()}

        {/* Topic box (center) */}
        <g opacity={nodeSpring}>
          <rect x={topicPos.fx * svgW - 55} y={topicPos.fy * svgH - 35} width={110} height={70} rx={10}
            fill={`${C.gold}15`} stroke={C.gold} strokeWidth={2.5}
          />
          {/* Broadcast icon */}
          {[0, 1, 2].map((i) => (
            <circle key={`bc-${i}`} cx={topicPos.fx * svgW} cy={topicPos.fy * svgH - 8}
              r={8 + i * 6} fill="none" stroke={C.gold}
              strokeWidth={1} opacity={0.15 + 0.1 * Math.sin(frame * 0.08 + i)}
            />
          ))}
          <text x={topicPos.fx * svgW} y={topicPos.fy * svgH + 18} fill={C.gold}
            fontSize={12} fontWeight={700} fontFamily="Inter, sans-serif" textAnchor="middle">
            TOPIC
          </text>
          <text x={topicPos.fx * svgW} y={topicPos.fy * svgH + 30} fill={C.gray}
            fontSize={9} fontFamily="'JetBrains Mono', monospace" textAnchor="middle">
            order.created
          </text>
        </g>
      </svg>

      {/* Publisher */}
      <div style={{
        position: 'absolute', left: `${publisherPos.fx * 100}%`, top: `${publisherPos.fy * 100}%`,
        transform: `translate(-50%, -50%) scale(${nodeSpring})`, opacity: nodeSpring,
        width: 80, height: 60, borderRadius: 10,
        background: `${C.saffron}18`, border: `2px solid ${C.saffron}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.saffron }}>PUBLISHER</span>
        <span style={{ fontSize: 9, color: C.gray }}>Order Svc</span>
      </div>

      {/* Subscribers */}
      {subscribers.map((sub, i) => (
        <div key={`sub-${i}`} style={{
          position: 'absolute', left: `${sub.fx * 100}%`, top: `${sub.fy * 100}%`,
          transform: `translate(-50%, -50%) scale(${subSprings[i]})`, opacity: subSprings[i],
          width: 90, height: 50, borderRadius: 8,
          background: `${sub.color}18`, border: `2px solid ${sub.color}`,
          boxShadow: flowActive ? `0 0 8px ${sub.color}33` : 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: sub.color }}>{sub.label}</span>
          <span style={{ fontSize: 8, color: C.gray }}>Subscriber</span>
        </div>
      ))}

      {/* Fan-out label + throughput */}
      {flowActive && (
        <div style={{
          position: 'absolute', bottom: '6%', left: '50%', transform: 'translateX(-50%)',
          background: `${C.gold}18`, border: `1.5px solid ${C.gold}55`, borderRadius: 8,
          padding: '6px 18px', display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.gold }}>
            1 Event {'->'} {subscribers.length} Subscribers (Fan-Out)
          </span>
          <div style={{ width: 1, height: 20, background: `${C.gray}44` }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.teal, fontFamily: "'JetBrains Mono', monospace" }}>
            {pubCount * subscribers.length} delivered
          </span>
        </div>
      )}
    </div>
  );
};

// =====================================================================
// DEAD LETTER VARIANT - Failed messages route to DLQ
// =====================================================================
const DeadLetterVariant: React.FC<Omit<QueueVizProps, 'variant'>> = ({ sync, frame }) => {
  const { fps, width, height } = useVideoConfig();
  const p = useReliableProgress(frame, fps, sync);
  const svgW = width;
  const svgH = height;

  const producerPos = { fx: 0.10, fy: 0.35 };
  const queuePos = { fx: 0.42, fy: 0.35 };
  const consumerPos = { fx: 0.78, fy: 0.35 };
  const dlqPos = { fx: 0.42, fy: 0.78 };
  const retryPos = { fx: 0.78, fy: 0.78 };

  const revealP = progressWindow(p, 0, 0.10);
  const nodeSpring = spring({ frame, fps, config: { damping: 12, stiffness: 100, mass: 0.9 }, from: 0, to: revealP > 0 ? 1 : 0 });

  const dlqRevealP = progressWindow(p, 0.30, 0.40);
  const dlqSpring = spring({ frame, fps, config: { damping: 13, stiffness: 110, mass: 0.8 }, from: 0, to: dlqRevealP > 0 ? 1 : 0 });

  const arrowDrawP = progressWindow(p, 0.08, 0.18);
  const flowActive = p > 0.15;

  // Normal flow
  const queueW = 200;
  const queueH = 45;
  const queueX = queuePos.fx * svgW - queueW / 2;
  const queueY = queuePos.fy * svgH - queueH / 2;

  // Simulate failures: every 3rd message fails
  const msgCycle = Math.floor(fps * 1.5);
  const msgCount = flowActive ? Math.floor(frame / msgCycle) : 0;
  const isFailing = msgCount % 3 === 2;
  const failCount = Math.floor(msgCount / 3);

  // DLQ items
  const dlqW = 180;
  const dlqH = 40;

  // Shake animation for failing consumer
  const shakeX = isFailing ? Math.sin(frame * 0.8) * 5 : 0;
  const shakeY = isFailing ? Math.cos(frame * 1.1) * 2 : 0;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'transparent', fontFamily: 'Inter, sans-serif' }}>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}
        viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">

        {/* Producer -> Queue */}
        <g opacity={arrowDrawP * (0.5 + 0.3 * Math.sin(frame * 0.06))}>
          <line x1={producerPos.fx * svgW + 50} y1={producerPos.fy * svgH}
            x2={queueX - 10} y2={queuePos.fy * svgH}
            stroke={C.saffron} strokeWidth={2.5} strokeLinecap="round" />
        </g>

        {/* Queue -> Consumer */}
        <g opacity={arrowDrawP * (0.5 + 0.3 * Math.sin(frame * 0.06))}>
          <line x1={queueX + queueW + 10} y1={queuePos.fy * svgH}
            x2={consumerPos.fx * svgW - 50} y2={consumerPos.fy * svgH}
            stroke={isFailing ? C.red : C.teal} strokeWidth={2.5} strokeLinecap="round" />
        </g>

        {/* Queue -> DLQ (failure path) */}
        {dlqSpring > 0 && (
          <g opacity={dlqSpring * (0.5 + 0.3 * Math.sin(frame * 0.06))}>
            <line x1={queuePos.fx * svgW} y1={queuePos.fy * svgH + queueH / 2 + 5}
              x2={dlqPos.fx * svgW} y2={dlqPos.fy * svgH - dlqH / 2 - 5}
              stroke={C.red} strokeWidth={2} strokeLinecap="round" strokeDasharray="6 4" />
            <text x={queuePos.fx * svgW - 60} y={(queuePos.fy * svgH + dlqPos.fy * svgH) / 2}
              fill={C.red} fontSize={10} fontWeight={600} fontFamily="Inter, sans-serif">
              3x RETRY FAILED
            </text>
          </g>
        )}

        {/* Main queue */}
        <g opacity={nodeSpring}>
          <rect x={queueX} y={queueY} width={queueW} height={queueH} rx={8}
            fill={`${C.indigo}08`} stroke={C.indigo} strokeWidth={2} />
          <text x={queueX + queueW / 2} y={queueY - 10} fill={C.indigo}
            fontSize={12} fontWeight={700} fontFamily="Inter, sans-serif" textAnchor="middle">
            MAIN QUEUE
          </text>
          {/* Messages in queue with realistic labels */}
          {Array.from({ length: 3 }).map((_, i) => {
            const mx = queueX + 10 + i * 62;
            const lbl = MSG_LABELS[(msgCount + i) % MSG_LABELS.length];
            return (
              <g key={`mq-${i}`}>
                <rect x={mx} y={queueY + 10} width={56} height={24} rx={4}
                  fill={`${MSG_COLORS[i]}33`} stroke={MSG_COLORS[i]} strokeWidth={1.5}
                />
                <text x={mx + 28} y={queueY + 24} fill={MSG_COLORS[i]}
                  fontSize={7} fontWeight={600} fontFamily="'JetBrains Mono', monospace"
                  textAnchor="middle" dominantBaseline="middle">
                  {lbl}
                </text>
              </g>
            );
          })}
        </g>

        {/* DLQ */}
        <g opacity={dlqSpring}>
          <rect x={dlqPos.fx * svgW - dlqW / 2} y={dlqPos.fy * svgH - dlqH / 2}
            width={dlqW} height={dlqH} rx={8}
            fill={`${C.red}12`} stroke={C.red} strokeWidth={2}
          />
          <text x={dlqPos.fx * svgW} y={dlqPos.fy * svgH - dlqH / 2 - 10} fill={C.red}
            fontSize={12} fontWeight={700} fontFamily="Inter, sans-serif" textAnchor="middle">
            DEAD LETTER QUEUE
          </text>
          {/* Failed messages with skull icon */}
          {Array.from({ length: Math.min(3, failCount) }).map((_, i) => (
            <g key={`dlq-${i}`}>
              <rect x={dlqPos.fx * svgW - dlqW / 2 + 10 + i * 56}
                y={dlqPos.fy * svgH - 10} width={50} height={20} rx={3}
                fill={`${C.red}33`} stroke={C.red} strokeWidth={1}
              />
              {/* Skull icon */}
              <text x={dlqPos.fx * svgW - dlqW / 2 + 22 + i * 56}
                y={dlqPos.fy * svgH + 4} fill={C.red} fontSize={10}
                fontFamily="Inter, sans-serif" textAnchor="middle" dominantBaseline="middle">
                {'\u2620'}
              </text>
              <text x={dlqPos.fx * svgW - dlqW / 2 + 42 + i * 56}
                y={dlqPos.fy * svgH + 4} fill={C.red} fontSize={7}
                fontWeight={600} fontFamily="'JetBrains Mono', monospace" textAnchor="middle" dominantBaseline="middle">
                FAIL
              </text>
            </g>
          ))}
        </g>

        {/* Failure animation on consumer — pulsing red rings */}
        {flowActive && isFailing && (
          <g>
            <circle cx={consumerPos.fx * svgW + shakeX} cy={consumerPos.fy * svgH + shakeY}
              r={40 + 10 * Math.sin(frame * 0.15)} fill="none"
              stroke={C.red} strokeWidth={2} opacity={0.3 + 0.3 * Math.sin(frame * 0.15)}
            />
            <circle cx={consumerPos.fx * svgW + shakeX} cy={consumerPos.fy * svgH + shakeY}
              r={50 + 8 * Math.sin(frame * 0.12)} fill="none"
              stroke={C.red} strokeWidth={1} opacity={0.15 + 0.15 * Math.sin(frame * 0.12)}
            />
          </g>
        )}

        {/* Flowing message dot */}
        {flowActive && (() => {
          const t = (frame % msgCycle) / msgCycle;
          if (t < 0.4) {
            // Producer to queue
            const eased = t / 0.4;
            const cx = (producerPos.fx * svgW + 50) + (queueX - 10 - producerPos.fx * svgW - 50) * eased;
            return (
              <circle cx={cx} cy={producerPos.fy * svgH} r={5} fill={C.saffron}
                opacity={0.8} style={{ filter: `drop-shadow(0 0 4px ${C.saffron})` }} />
            );
          }
          if (t > 0.5 && t < 0.85) {
            // Queue to consumer
            const eased = (t - 0.5) / 0.35;
            const cx = (queueX + queueW + 10) + (consumerPos.fx * svgW - 50 - queueX - queueW - 10) * eased;
            const color = isFailing ? C.red : C.teal;
            return (
              <circle cx={cx} cy={queuePos.fy * svgH} r={5} fill={color}
                opacity={0.8} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
            );
          }
          return null;
        })()}
      </svg>

      {/* Producer */}
      <div style={{
        position: 'absolute', left: `${producerPos.fx * 100}%`, top: `${producerPos.fy * 100}%`,
        transform: `translate(-50%, -50%) scale(${nodeSpring})`, opacity: nodeSpring,
        width: 80, height: 55, borderRadius: 10,
        background: `${C.saffron}18`, border: `2px solid ${C.saffron}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.saffron }}>PRODUCER</span>
      </div>

      {/* Consumer — shakes on failure */}
      <div style={{
        position: 'absolute', left: `${consumerPos.fx * 100}%`, top: `${consumerPos.fy * 100}%`,
        transform: `translate(calc(-50% + ${shakeX}px), calc(-50% + ${shakeY}px)) scale(${nodeSpring})`, opacity: nodeSpring,
        width: 80, height: 55, borderRadius: 10,
        background: isFailing ? `${C.red}18` : `${C.teal}18`,
        border: `2px solid ${isFailing ? C.red : C.teal}`,
        boxShadow: isFailing ? `0 0 12px ${C.red}44` : 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: isFailing ? C.red : C.teal }}>CONSUMER</span>
        <span style={{ fontSize: 9, color: isFailing ? C.red : C.gray }}>
          {isFailing ? 'ERROR!' : 'Processing'}
        </span>
      </div>

      {/* Retry handler */}
      {dlqSpring > 0 && (
        <div style={{
          position: 'absolute', left: `${retryPos.fx * 100}%`, top: `${retryPos.fy * 100}%`,
          transform: `translate(-50%, -50%) scale(${dlqSpring})`, opacity: dlqSpring,
          width: 90, height: 50, borderRadius: 8,
          background: `${C.gold}18`, border: `2px solid ${C.gold}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.gold }}>RETRY</span>
          <span style={{ fontSize: 9, color: C.gray }}>Manual Review</span>
        </div>
      )}

      {/* Stats */}
      {flowActive && (
        <div style={{
          position: 'absolute', top: '5%', right: '5%',
          background: `${C.dark}CC`, border: `1.5px solid ${C.gray}33`, borderRadius: 8,
          padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: C.gray, width: 60 }}>Processed</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.teal }}>{msgCount - failCount}</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: C.gray, width: 60 }}>Failed</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.red }}>
              {'\u2620'} {failCount}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: C.gray, width: 60 }}>Error Rate</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: failCount > 3 ? C.red : C.gold }}>
              {msgCount > 0 ? ((failCount / msgCount) * 100).toFixed(0) : 0}%
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: C.gray, width: 60 }}>Throughput</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.teal, fontFamily: "'JetBrains Mono', monospace" }}>
              {Math.round((msgCount - failCount) / Math.max(1, frame / fps) * 100) / 100}/s
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// =====================================================================
// MAIN EXPORT
// =====================================================================
export const QueueViz: React.FC<QueueVizProps> = (props) => {
  if (props.variant === 'pubsub') return <PubSubVariant {...props} />;
  if (props.variant === 'deadletter') return <DeadLetterVariant {...props} />;
  return <FifoVariant {...props} />;
};
