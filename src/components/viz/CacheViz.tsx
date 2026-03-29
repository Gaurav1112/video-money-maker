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
};

interface CacheVizProps {
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

// ---- Sub-components ----

interface CacheEntryProps {
  x: number; y: number; width: number; height: number;
  keyStr: string; value: string;
  color: string; opacity: number;
  isHit?: boolean; isExpiring?: boolean;
  frame: number;
}

const CacheEntry: React.FC<CacheEntryProps> = ({
  x, y, width, height, keyStr, value, color, opacity, isHit, isExpiring, frame,
}) => {
  const flash = isHit ? 0.6 + 0.4 * Math.sin(frame * 0.25) : 0;
  const fadeOut = isExpiring ? 0.3 + 0.3 * Math.sin(frame * 0.15) : 1;

  return (
    <g opacity={opacity * fadeOut}>
      <rect x={x} y={y} width={width} height={height} rx={4}
        fill={isHit ? `${C.green}33` : `${color}18`}
        stroke={isHit ? C.green : isExpiring ? C.red : color}
        strokeWidth={isHit ? 2 : 1.5}
      />
      {isHit && (
        <rect x={x} y={y} width={width} height={height} rx={4}
          fill={C.green} opacity={flash * 0.2}
        />
      )}
      <text x={x + 8} y={y + height / 2 + 1} fill={color} fontSize={10}
        fontWeight={600} fontFamily="Inter, sans-serif" dominantBaseline="middle">
        {keyStr}
      </text>
      <text x={x + width - 8} y={y + height / 2 + 1} fill={C.gray} fontSize={9}
        fontFamily="Inter, sans-serif" textAnchor="end" dominantBaseline="middle">
        {value}
      </text>
    </g>
  );
};

interface FlowDotProps {
  t: number; x1: number; y1: number; x2: number; y2: number;
  color: string; visible: boolean; size?: number;
}

const FlowDot: React.FC<FlowDotProps> = ({ t, x1, y1, x2, y2, color, visible, size = 5 }) => {
  if (!visible) return null;
  const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  const cx = x1 + (x2 - x1) * eased;
  const cy = y1 + (y2 - y1) * eased;
  const alpha = t < 0.1 ? t / 0.1 : t > 0.9 ? (1 - t) / 0.1 : 1;

  return (
    <circle cx={cx} cy={cy} r={size} fill={color} opacity={alpha * 0.9}
      style={{ filter: `drop-shadow(0 0 4px ${color})` }}
    />
  );
};

// =====================================================================
// LOOKUP VARIANT (default) - Cache Hit / Miss flow
// =====================================================================
const LookupVariant: React.FC<Omit<CacheVizProps, 'variant'>> = ({ sync, frame }) => {
  const { fps, width, height } = useVideoConfig();
  const p = useReliableProgress(frame, fps, sync);
  const svgW = width;
  const svgH = height;

  // Layout: Client (left) -> Cache (center) -> Database (right)
  const clientPos = { fx: 0.08, fy: 0.45 };
  const cachePos = { fx: 0.42, fy: 0.45 };
  const dbPos = { fx: 0.82, fy: 0.45 };

  // Reveals
  const revealP = progressWindow(p, 0, 0.20);
  const nodeSpring = spring({ frame, fps, config: { damping: 12, stiffness: 100, mass: 0.9 }, from: 0, to: revealP > 0 ? 1 : 0 });

  const arrowDrawP = progressWindow(p, 0.20, 0.40);
  const flowActive = p > 0.40;

  // Alternating hit/miss cycles (frame-driven)
  const cycleLen = fps * 3; // 3-second cycles
  const cyclePhase = (frame % cycleLen) / cycleLen;
  const isHit = Math.floor(frame / cycleLen) % 3 !== 2; // ~66% hit rate

  // Arrows
  const clientToCache = {
    x1: clientPos.fx * svgW + 50, y1: clientPos.fy * svgH,
    x2: cachePos.fx * svgW - 80, y2: cachePos.fy * svgH,
  };
  const cacheToDb = {
    x1: cachePos.fx * svgW + 80, y1: cachePos.fy * svgH,
    x2: dbPos.fx * svgW - 50, y2: dbPos.fy * svgH,
  };
  const cacheReturn = {
    x1: cachePos.fx * svgW - 80, y1: cachePos.fy * svgH + 20,
    x2: clientPos.fx * svgW + 50, y2: clientPos.fy * svgH + 20,
  };
  const dbReturn = {
    x1: dbPos.fx * svgW - 50, y1: dbPos.fy * svgH + 20,
    x2: cachePos.fx * svgW + 80, y2: cachePos.fy * svgH + 20,
  };

  // Cache entries
  const cacheEntries = [
    { key: 'user:42', val: '{name:"Raj"}' },
    { key: 'prod:99', val: '{price:499}' },
    { key: 'sess:7f', val: '{token:...}' },
    { key: 'cfg:app', val: '{theme:dk}' },
  ];

  const hitIdx = Math.floor(frame / cycleLen) % cacheEntries.length;
  const hitRate = 65 + Math.floor(frame / (fps * 8)) * 3 + Math.sin(frame * 0.02) * 2;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'transparent', fontFamily: 'Inter, sans-serif' }}>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}
        viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">

        {/* Request arrow */}
        <g opacity={arrowDrawP}>
          <line x1={clientToCache.x1} y1={clientToCache.y1}
            x2={clientToCache.x2} y2={clientToCache.y2}
            stroke={C.saffron} strokeWidth={2.5} strokeLinecap="round"
            opacity={0.5 + 0.3 * Math.sin(frame * 0.06)}
          />
          <text x={(clientToCache.x1 + clientToCache.x2) / 2}
            y={clientToCache.y1 - 12} fill={C.saffron} fontSize={10}
            fontWeight={600} fontFamily="Inter, sans-serif" textAnchor="middle">
            GET key
          </text>
        </g>

        {/* Cache to DB arrow (only on miss) */}
        {!isHit && flowActive && (
          <g opacity={0.5 + 0.3 * Math.sin(frame * 0.06)}>
            <line x1={cacheToDb.x1} y1={cacheToDb.y1}
              x2={cacheToDb.x2} y2={cacheToDb.y2}
              stroke={C.red} strokeWidth={2} strokeLinecap="round" strokeDasharray="6 4"
            />
            <text x={(cacheToDb.x1 + cacheToDb.x2) / 2}
              y={cacheToDb.y1 - 12} fill={C.red} fontSize={10}
              fontWeight={600} fontFamily="Inter, sans-serif" textAnchor="middle">
              MISS - Query DB
            </text>
          </g>
        )}

        {/* Return arrows */}
        {flowActive && isHit && (
          <g opacity={0.4 + 0.3 * Math.sin(frame * 0.06)}>
            <line x1={cacheReturn.x1} y1={cacheReturn.y1}
              x2={cacheReturn.x2} y2={cacheReturn.y2}
              stroke={C.green} strokeWidth={2} strokeLinecap="round"
            />
            <text x={(cacheReturn.x1 + cacheReturn.x2) / 2}
              y={cacheReturn.y1 + 16} fill={C.green} fontSize={10}
              fontWeight={600} fontFamily="Inter, sans-serif" textAnchor="middle">
              HIT - Fast Return
            </text>
          </g>
        )}

        {!isHit && flowActive && (
          <g opacity={0.4 + 0.3 * Math.sin(frame * 0.06)}>
            <line x1={dbReturn.x1} y1={dbReturn.y1}
              x2={dbReturn.x2} y2={dbReturn.y2}
              stroke={C.gold} strokeWidth={2} strokeLinecap="round" strokeDasharray="4 3"
            />
          </g>
        )}

        {/* Request dots */}
        {flowActive && (
          <FlowDot t={cyclePhase < 0.3 ? cyclePhase / 0.3 : 1}
            x1={clientToCache.x1} y1={clientToCache.y1}
            x2={clientToCache.x2} y2={clientToCache.y2}
            color={C.saffron} visible={cyclePhase < 0.3} size={6}
          />
        )}

        {/* Hit return dot */}
        {flowActive && isHit && cyclePhase > 0.4 && cyclePhase < 0.7 && (
          <FlowDot t={(cyclePhase - 0.4) / 0.3}
            x1={cacheReturn.x1} y1={cacheReturn.y1}
            x2={cacheReturn.x2} y2={cacheReturn.y2}
            color={C.green} visible size={6}
          />
        )}

        {/* Miss -> DB dot */}
        {flowActive && !isHit && cyclePhase > 0.3 && cyclePhase < 0.6 && (
          <FlowDot t={(cyclePhase - 0.3) / 0.3}
            x1={cacheToDb.x1} y1={cacheToDb.y1}
            x2={cacheToDb.x2} y2={cacheToDb.y2}
            color={C.red} visible size={5}
          />
        )}

        {/* Cache entries */}
        {cacheEntries.map((entry, i) => {
          const entryY = cachePos.fy * svgH - 55 + i * 28;
          return (
            <CacheEntry key={`ce-${i}`}
              x={cachePos.fx * svgW - 70} y={entryY}
              width={140} height={22}
              keyStr={entry.key} value={entry.val}
              color={C.teal} opacity={nodeSpring}
              isHit={flowActive && isHit && hitIdx === i}
              frame={frame}
            />
          );
        })}
      </svg>

      {/* Client node */}
      <div style={{
        position: 'absolute', left: `${clientPos.fx * 100}%`, top: `${clientPos.fy * 100}%`,
        transform: `translate(-50%, -50%) scale(${nodeSpring})`, opacity: nodeSpring,
        width: 80, height: 60, borderRadius: 10,
        background: `${C.indigo}18`, border: `2px solid ${C.indigo}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.indigo }}>CLIENT</span>
        <span style={{ fontSize: 9, color: C.gray }}>Application</span>
      </div>

      {/* Cache node */}
      <div style={{
        position: 'absolute', left: `${cachePos.fx * 100}%`, top: `${(cachePos.fy - 0.15) * 100}%`,
        transform: `translate(-50%, -50%) scale(${nodeSpring})`, opacity: nodeSpring,
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.teal }}>REDIS CACHE</span>
          <span style={{ fontSize: 10, color: C.gray }}>In-Memory Store</span>
        </div>
      </div>

      {/* Hit/Miss indicator */}
      {flowActive && (
        <div style={{
          position: 'absolute', left: `${cachePos.fx * 100}%`, top: `${(cachePos.fy + 0.15) * 100}%`,
          transform: 'translate(-50%, -50%)',
          background: isHit ? `${C.green}33` : `${C.red}33`,
          border: `2px solid ${isHit ? C.green : C.red}`,
          borderRadius: 8, padding: '6px 16px',
          boxShadow: `0 0 12px ${isHit ? C.green : C.red}44`,
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: isHit ? C.green : C.red }}>
            {isHit ? 'CACHE HIT' : 'CACHE MISS'}
          </span>
        </div>
      )}

      {/* Database node */}
      <div style={{
        position: 'absolute', left: `${dbPos.fx * 100}%`, top: `${dbPos.fy * 100}%`,
        transform: `translate(-50%, -50%) scale(${nodeSpring})`, opacity: nodeSpring,
        width: 80, height: 70, borderRadius: 10,
        background: `${C.gold}18`, border: `2px solid ${C.gold}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
      }}>
        <svg width={24} height={22} viewBox="0 0 24 22">
          <ellipse cx={12} cy={5} rx={9} ry={4} fill={`${C.gold}44`} stroke={C.gold} strokeWidth={1.2} />
          <rect x={3} y={5} width={18} height={12} fill={`${C.gold}22`} />
          <line x1={3} y1={5} x2={3} y2={17} stroke={C.gold} strokeWidth={1.2} />
          <line x1={21} y1={5} x2={21} y2={17} stroke={C.gold} strokeWidth={1.2} />
          <ellipse cx={12} cy={17} rx={9} ry={4} fill={`${C.gold}33`} stroke={C.gold} strokeWidth={1.2} />
        </svg>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.gold }}>DATABASE</span>
      </div>

      {/* Hit rate counter */}
      {flowActive && (
        <div style={{
          position: 'absolute', top: '6%', right: '6%',
          background: `${C.dark}CC`, border: `1.5px solid ${C.teal}55`, borderRadius: 10,
          padding: '10px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}>
          <span style={{ fontSize: 10, color: C.gray, letterSpacing: 1 }}>CACHE HIT RATE</span>
          <span style={{
            fontSize: 28, fontWeight: 800, color: C.green,
            fontFamily: 'Inter, sans-serif',
          }}>
            {clamp(hitRate, 0, 99.9).toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
};

// =====================================================================
// EVICTION VARIANT - LRU eviction animation
// =====================================================================
const EvictionVariant: React.FC<Omit<CacheVizProps, 'variant'>> = ({ sync, frame }) => {
  const { fps, width, height } = useVideoConfig();
  const p = useReliableProgress(frame, fps, sync);
  const svgW = width;
  const svgH = height;

  const cacheX = svgW * 0.3;
  const cacheY = svgH * 0.15;
  const cacheW = svgW * 0.4;
  const slotH = 36;
  const maxSlots = 6;

  const revealP = progressWindow(p, 0, 0.10);
  const nodeSpring = spring({ frame, fps, config: { damping: 12, stiffness: 100, mass: 0.9 }, from: 0, to: revealP > 0 ? 1 : 0 });

  // Cache fills up over time
  const fillP = progressWindow(p, 0.10, 0.60);
  const filledSlots = Math.min(maxSlots, Math.floor(fillP * (maxSlots + 2)));

  // Eviction happens when full
  const evicting = filledSlots >= maxSlots && p > 0.50;
  const evictCycle = fps * 2;
  const evictPhase = evicting ? ((frame % evictCycle) / evictCycle) : 0;
  const evictIdx = evicting ? 0 : -1; // Always evict LRU (index 0)

  const allKeys = ['user:1', 'sess:a', 'prod:5', 'cfg:x', 'user:7', 'cart:3', 'prod:9', 'user:4'];

  // Which entries are currently visible
  const baseIdx = evicting ? Math.floor((frame - fps * 4) / evictCycle) : 0;
  const visibleKeys = allKeys.slice(
    Math.max(0, baseIdx) % allKeys.length,
    Math.max(0, baseIdx) % allKeys.length + filledSlots
  ).map((k, i) => ({
    key: allKeys[(Math.max(0, baseIdx) + i) % allKeys.length],
    idx: i,
  }));

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'transparent', fontFamily: 'Inter, sans-serif' }}>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}
        viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">

        {/* Cache container */}
        <rect x={cacheX} y={cacheY} width={cacheW} height={maxSlots * slotH + 20} rx={10}
          fill={`${C.teal}08`} stroke={C.teal} strokeWidth={2} opacity={nodeSpring}
        />

        {/* Title */}
        <text x={cacheX + cacheW / 2} y={cacheY - 12} fill={C.teal} fontSize={14}
          fontWeight={700} fontFamily="Inter, sans-serif" textAnchor="middle" opacity={nodeSpring}>
          LRU CACHE (max {maxSlots})
        </text>

        {/* Slots */}
        {Array.from({ length: maxSlots }).map((_, i) => {
          const slotY = cacheY + 10 + i * slotH;
          const entry = visibleKeys.find((v) => v.idx === i);
          const isEvicting = evictIdx === i && evicting;
          const shakeX = isEvicting ? Math.sin(frame * 0.4) * 6 : 0;

          return (
            <g key={`slot-${i}`} opacity={nodeSpring}>
              {/* Slot background */}
              <rect x={cacheX + 8 + shakeX} y={slotY} width={cacheW - 16} height={slotH - 4} rx={4}
                fill={isEvicting ? `${C.red}22` : entry ? `${C.teal}12` : `${C.gray}08`}
                stroke={isEvicting ? C.red : entry ? `${C.teal}44` : `${C.gray}22`}
                strokeWidth={1.5}
              />
              {/* LRU position label */}
              <text x={cacheX + 20 + shakeX} y={slotY + slotH / 2} fill={C.gray} fontSize={9}
                fontFamily="Inter, sans-serif" dominantBaseline="middle">
                {i === 0 ? 'LRU' : i === maxSlots - 1 ? 'MRU' : `#${i}`}
              </text>
              {/* Key */}
              {entry && (
                <text x={cacheX + cacheW / 2 + shakeX} y={slotY + slotH / 2}
                  fill={isEvicting ? C.red : C.teal} fontSize={12}
                  fontWeight={600} fontFamily="Inter, sans-serif"
                  textAnchor="middle" dominantBaseline="middle">
                  {entry.key}
                </text>
              )}
              {/* Eviction arrow */}
              {isEvicting && evictPhase > 0.5 && (
                <g opacity={evictPhase - 0.5}>
                  <line x1={cacheX + cacheW + 10} y1={slotY + slotH / 2}
                    x2={cacheX + cacheW + 60} y2={slotY + slotH / 2}
                    stroke={C.red} strokeWidth={2} strokeLinecap="round"
                  />
                  <text x={cacheX + cacheW + 70} y={slotY + slotH / 2 + 4}
                    fill={C.red} fontSize={10} fontWeight={600} fontFamily="Inter, sans-serif">
                    EVICTED
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* New entry arrow */}
        {evicting && evictPhase < 0.5 && (
          <g opacity={evictPhase * 2}>
            <line x1={cacheX - 60} y1={cacheY + maxSlots * slotH}
              x2={cacheX + 8} y2={cacheY + maxSlots * slotH}
              stroke={C.green} strokeWidth={2} strokeLinecap="round"
            />
            <text x={cacheX - 70} y={cacheY + maxSlots * slotH + 4}
              fill={C.green} fontSize={10} fontWeight={600} fontFamily="Inter, sans-serif"
              textAnchor="end">
              NEW
            </text>
          </g>
        )}

        {/* Capacity indicator */}
        <rect x={cacheX} y={cacheY + maxSlots * slotH + 30} width={cacheW} height={10} rx={5}
          fill={`${C.gray}22`} opacity={nodeSpring}
        />
        <rect x={cacheX} y={cacheY + maxSlots * slotH + 30}
          width={cacheW * (filledSlots / maxSlots)} height={10} rx={5}
          fill={filledSlots >= maxSlots ? C.saffron : C.teal}
          opacity={nodeSpring}
        />
        <text x={cacheX + cacheW / 2} y={cacheY + maxSlots * slotH + 52}
          fill={C.gray} fontSize={10} fontFamily="Inter, sans-serif" textAnchor="middle"
          opacity={nodeSpring}>
          {filledSlots}/{maxSlots} slots used
        </text>
      </svg>

      {/* Status */}
      {evicting && (
        <div style={{
          position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)',
          background: `${C.saffron}22`, border: `2px solid ${C.saffron}`, borderRadius: 10,
          padding: '8px 20px',
          opacity: 0.6 + 0.4 * Math.sin(frame * 0.08),
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.saffron }}>
            Cache Full - LRU Eviction Active
          </span>
        </div>
      )}
    </div>
  );
};

// =====================================================================
// LAYERS VARIANT - L1 / L2 / CDN stack
// =====================================================================
const LayersVariant: React.FC<Omit<CacheVizProps, 'variant'>> = ({ sync, frame }) => {
  const { fps, width, height } = useVideoConfig();
  const p = useReliableProgress(frame, fps, sync);
  const svgW = width;
  const svgH = height;

  const layers = [
    { label: 'CDN Edge', sublabel: '< 5ms', color: C.green, fy: 0.15, hitRate: 85 },
    { label: 'L1 App Cache', sublabel: '< 1ms (in-process)', color: C.teal, fy: 0.38, hitRate: 95 },
    { label: 'L2 Redis', sublabel: '< 10ms (network)', color: C.gold, fy: 0.58, hitRate: 98 },
    { label: 'Database', sublabel: '50-200ms', color: C.saffron, fy: 0.80, hitRate: 100 },
  ];

  const revealP = progressWindow(p, 0, 0.15);
  const layerSprings = layers.map((_, i) =>
    spring({
      frame: Math.max(0, frame - i * 8), fps,
      config: { damping: 13, stiffness: 100, mass: 0.8 },
      from: 0, to: revealP > 0 ? 1 : 0,
    })
  );

  const flowActive = p > 0.18;

  // Request cascades down layers until hit
  const cascadeCycle = fps * 4; // 4s cycle
  const cascadePhase = (frame % cascadeCycle) / cascadeCycle;
  // Which layer catches: cycle through different depths
  const catchLayer = Math.floor(frame / cascadeCycle) % 4;

  // Arrow positions
  const layerX = svgW * 0.5;
  const layerW = svgW * 0.55;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'transparent', fontFamily: 'Inter, sans-serif' }}>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}
        viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">

        {/* Layer boxes */}
        {layers.map((layer, i) => {
          const y = layer.fy * svgH;
          const isActive = flowActive && cascadePhase * (layers.length) > i && i <= catchLayer;
          const isCatch = flowActive && i === catchLayer && cascadePhase > (catchLayer + 0.5) / layers.length;
          const pulse = isActive ? 0.3 + 0.3 * Math.sin(frame * 0.12 + i) : 0;

          return (
            <g key={`layer-${i}`} opacity={layerSprings[i]}>
              {/* Layer background */}
              <rect x={layerX - layerW / 2} y={y - 20} width={layerW} height={40} rx={8}
                fill={isCatch ? `${layer.color}33` : `${layer.color}12`}
                stroke={layer.color}
                strokeWidth={isCatch ? 2.5 : 1.5}
              />
              {isCatch && (
                <rect x={layerX - layerW / 2} y={y - 20} width={layerW} height={40} rx={8}
                  fill={layer.color} opacity={pulse * 0.15}
                />
              )}
              {/* Label */}
              <text x={layerX - layerW / 2 + 16} y={y + 1} fill={layer.color}
                fontSize={13} fontWeight={700} fontFamily="Inter, sans-serif"
                dominantBaseline="middle">
                {layer.label}
              </text>
              {/* Sublabel */}
              <text x={layerX + layerW / 2 - 16} y={y + 1} fill={C.gray}
                fontSize={10} fontFamily="Inter, sans-serif"
                textAnchor="end" dominantBaseline="middle">
                {layer.sublabel}
              </text>
              {/* Hit indicator */}
              {isCatch && (
                <g>
                  <circle cx={layerX + layerW / 2 + 30} cy={y} r={12}
                    fill={`${C.green}33`} stroke={C.green} strokeWidth={1.5} />
                  <text x={layerX + layerW / 2 + 30} y={y + 1} fill={C.green}
                    fontSize={9} fontWeight={700} fontFamily="Inter, sans-serif"
                    textAnchor="middle" dominantBaseline="middle">
                    HIT
                  </text>
                </g>
              )}
              {/* Miss indicator for layers above catch */}
              {isActive && !isCatch && i < catchLayer && (
                <g>
                  <circle cx={layerX + layerW / 2 + 30} cy={y} r={12}
                    fill={`${C.red}22`} stroke={C.red} strokeWidth={1.5} />
                  <text x={layerX + layerW / 2 + 30} y={y + 1} fill={C.red}
                    fontSize={9} fontWeight={700} fontFamily="Inter, sans-serif"
                    textAnchor="middle" dominantBaseline="middle">
                    MISS
                  </text>
                </g>
              )}
              {/* Down arrow to next layer */}
              {i < layers.length - 1 && (
                <line x1={layerX} y1={y + 22} x2={layerX} y2={layers[i + 1].fy * svgH - 22}
                  stroke={`${C.gray}44`} strokeWidth={1.5} strokeDasharray="4 3"
                  opacity={layerSprings[i]}
                />
              )}
            </g>
          );
        })}

        {/* Cascading request dot */}
        {flowActive && (() => {
          const targetLayer = Math.min(catchLayer, layers.length - 1);
          const dotProgress = cascadePhase * layers.length;
          const currentLayer = Math.min(Math.floor(dotProgress), targetLayer);
          const layerProgress = dotProgress - currentLayer;

          if (currentLayer <= targetLayer && layerProgress < 1) {
            const fromY = layers[currentLayer].fy * svgH;
            const toY = currentLayer < targetLayer ? layers[currentLayer + 1].fy * svgH : fromY;
            const dotY = fromY + (toY - fromY) * Math.min(1, layerProgress);

            return (
              <circle cx={layerX} cy={dotY} r={6} fill={C.saffron}
                opacity={0.8} style={{ filter: `drop-shadow(0 0 6px ${C.saffron})` }}
              />
            );
          }
          return null;
        })()}
      </svg>

      {/* Title */}
      <div style={{
        position: 'absolute', top: '3%', left: '50%', transform: 'translateX(-50%)',
        opacity: layerSprings[0],
      }}>
        <span style={{ fontSize: 11, color: C.gray, letterSpacing: 2, fontWeight: 600 }}>
          MULTI-LAYER CACHING STRATEGY
        </span>
      </div>

      {/* Latency comparison */}
      {flowActive && (
        <div style={{
          position: 'absolute', bottom: '5%', left: '50%', transform: 'translateX(-50%)',
          background: `${C.dark}CC`, border: `1.5px solid ${C.gray}33`, borderRadius: 8,
          padding: '8px 20px', display: 'flex', gap: 24, alignItems: 'center',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: C.gray }}>With Cache</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>~5ms</div>
          </div>
          <div style={{ width: 1, height: 30, background: `${C.gray}44` }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: C.gray }}>Without Cache</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.red }}>~200ms</div>
          </div>
          <div style={{ width: 1, height: 30, background: `${C.gray}44` }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: C.gray }}>Improvement</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.gold }}>40x</div>
          </div>
        </div>
      )}
    </div>
  );
};

// =====================================================================
// MAIN EXPORT
// =====================================================================
export const CacheViz: React.FC<CacheVizProps> = (props) => {
  if (props.variant === 'eviction') return <EvictionVariant {...props} />;
  if (props.variant === 'layers') return <LayersVariant {...props} />;
  return <LookupVariant {...props} />;
};
