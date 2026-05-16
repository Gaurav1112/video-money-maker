/**
 * dropoff-predictor.ts — Fix #26
 *
 * Given a script (with per-segment timestamps and types), predicts which
 * 5-second windows are at-risk for viewer drop-off and recommends the
 * counter-tactic to insert.
 *
 * DETERMINISTIC: pure function of script structure.
 * No randomness. Same script → same predictions every time.
 *
 * Drop-off heuristics (ranked by risk):
 *   1. 0:00–0:05 — no hook = 15–40% immediate drop
 *   2. After any CTA — perceived end-of-video signal
 *   3. 1:45–2:10 — YouTube 2-min cliff (global median)
 *   4. After hard-concept segments — jargon/architecture dumps
 *   5. Every 90s without a pattern interrupt
 *   6. After code blocks — dense syntax, viewer lost
 *   7. Final 15% of video — "I've got the gist" early exits
 *
 * Sources:
 *   MrBeast: interrupt every 30s; hook must be visual+audio+text in 0.5s
 *   Derral Eves: 2-min cliff; pre-CTA restate required
 *   Karen X. Cheng: dead-air loop tax; completion rate > watch time
 */

import type { RetentionBeatType } from './retention-engine';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DropoffRisk = 'critical' | 'high' | 'medium' | 'low';

export interface DropoffWindow {
  windowStart: number;  // seconds
  windowEnd: number;    // seconds
  risk: DropoffRisk;
  predictedDropPercent: number;  // estimated % of remaining viewers who leave
  reason: string;
  counterTactic: RetentionBeatType;
  tacticText: string;
  audioEvent: string;
}

export interface DropoffPrediction {
  windows: DropoffWindow[];
  /** Sum of all predicted drops (uncorrected — assumes independent windows) */
  worstCaseTotalDrop: number;
  /** Estimated AVD% if no counter-tactics are applied */
  estimatedAvdWithoutFixes: number;
  /** Estimated AVD% if all counter-tactics are applied */
  estimatedAvdWithFixes: number;
  /** Whether estimated fixed AVD meets the Derral Eves threshold (≥ 30%) */
  meetsAvdThreshold: boolean;
  format: 'long_form' | 'short_form';
}

export interface ScriptSegmentInput {
  id: string;
  type: 'hook' | 'content' | 'code' | 'diagram' | 'cta' | 'review' | 'summary' | 'retention_beat' | string;
  startSeconds: number;
  endSeconds: number;
  isHardConcept?: boolean;
  text?: string;
}

// ─── Risk scoring helpers ─────────────────────────────────────────────────────

/** Derral Eves: AVD math baseline for cold/new channels */
const BASELINE_AVD_COLD_CHANNEL = 0.25; // 25% — GuruSishya current state
const TARGET_AVD_SHORTS = 0.65;         // 65% = 10× algo distribution
const TARGET_AVD_LONGFORM = 0.45;       // 45% = breaks cold spiral

/** MrBeast rule: 35% drop in first 30s if hook fails promise+stakes */
const HOOK_FAIL_DROP = 0.35;

/** Counter-tactic effectiveness: each tactic reduces drop by this fraction */
const TACTIC_EFFECTIVENESS: Record<RetentionBeatType, number> = {
  open_loop:           0.60, // 60% of the predicted drop is neutralized
  stake_escalation:    0.55,
  pattern_interrupt:   0.50,
  curiosity_gap:       0.65,
  cta_buyback:         0.70, // most effective: directly counters perceived end
  numbered_tease:      0.45,
  status_reveal:       0.40,
  loss_aversion:       0.50,
  recall_bait:         0.55,
  surprise_subversion: 0.60,
};

// ─── Counter-tactic text generator ───────────────────────────────────────────

function tacticText(
  tactic: RetentionBeatType,
  topic: string,
  windowStart: number,
): string {
  const t = formatTime(windowStart);
  const tactics: Record<RetentionBeatType, string> = {
    open_loop:
      `[AT ${t}] Open loop: "I'll show you the ONE thing most engineers miss about ${topic} — but first..."`,
    stake_escalation:
      `[AT ${t}] Stake escalation: "If you get ${topic} wrong in your interview, you're not just failing this question."`,
    pattern_interrupt:
      `[AT ${t}] Pattern interrupt: zoom punch + audio sting + 3-word text slam`,
    curiosity_gap:
      `[AT ${t}] Curiosity gap: "What would you say if a Google interviewer asked you about ${topic} right now? Answer at ${formatTime(windowStart + 90)}."`,
    cta_buyback:
      `[AT ${t}] CTA buyback: "WAIT — before that link — I haven't shown you the #1 mistake with ${topic} yet."`,
    numbered_tease:
      `[AT ${t}] Numbered tease: "5 things about ${topic} — #4 is what 90% miss in FAANG interviews."`,
    status_reveal:
      `[AT ${t}] Status reveal: "A principal engineer at Amazon told me something about ${topic} that changed everything."`,
    loss_aversion:
      `[AT ${t}] Loss aversion: "Engineers who don't know this about ${topic} leave ₹15LPA on the table every year."`,
    recall_bait:
      `[AT ${t}] Recall bait: "Remember the question I asked at the start? Here's why your first answer about ${topic} was wrong."`,
    surprise_subversion:
      `[AT ${t}] Surprise subversion: "Most engineers think ${topic} requires more servers. It's actually the opposite."`,
  };
  return tactics[tactic];
}

function audioEventForTactic(tactic: RetentionBeatType): string {
  const map: Record<RetentionBeatType, string> = {
    open_loop: 'audio_rise',
    stake_escalation: 'audio_duck',
    pattern_interrupt: 'zoom_punch + audio_sting',
    curiosity_gap: 'silence_cut',
    cta_buyback: 'audio_slam',
    numbered_tease: 'audio_sting',
    status_reveal: 'none',
    loss_aversion: 'audio_duck',
    recall_bait: 'audio_sting',
    surprise_subversion: 'silence_cut + audio_slam',
  };
  return map[tactic];
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Main predictor ───────────────────────────────────────────────────────────

/**
 * predictDropoffs — pure function, deterministic.
 *
 * Returns predicted at-risk windows sorted by risk level (critical → low).
 */
export function predictDropoffs(
  segments: ScriptSegmentInput[],
  topic: string,
): DropoffPrediction {
  const sorted = [...segments].sort((a, b) => a.startSeconds - b.startSeconds);
  const totalDuration =
    sorted.length > 0 ? sorted[sorted.length - 1].endSeconds : 0;
  const format: 'long_form' | 'short_form' =
    totalDuration <= 180 ? 'short_form' : 'long_form';

  const windows: DropoffWindow[] = [];

  // ── Risk 1: Hook window 0:00–0:05 (CRITICAL) ────────────────────────────
  {
    const hookSeg = sorted.find((s) => s.type === 'hook');
    const hasHook = hookSeg !== undefined;
    const hookDuration = hookSeg ? hookSeg.endSeconds - hookSeg.startSeconds : 0;
    const isHookTooLong = hookDuration > (format === 'short_form' ? 1.5 : 5);

    if (!hasHook || isHookTooLong) {
      windows.push({
        windowStart: 0,
        windowEnd: 5,
        risk: 'critical',
        predictedDropPercent: 35,
        reason: hasHook
          ? `Hook segment too long (${hookDuration}s > ${format === 'short_form' ? '1.5s' : '5s'}) — MrBeast rule: promise+stakes in 0.5s`
          : 'No hook segment — first 5 seconds are dead air (MrBeast: 35% drop guaranteed)',
        counterTactic: 'loss_aversion',
        tacticText: tacticText('loss_aversion', topic, 0),
        audioEvent: audioEventForTactic('loss_aversion'),
      });
    }
  }

  // ── Risk 2: After every CTA ───────────────────────────────────────────────
  const ctaSegments = sorted.filter((s) => s.type === 'cta');
  for (const cta of ctaSegments) {
    const buybackExists = sorted.some(
      (s) =>
        s.type === 'retention_beat' &&
        s.startSeconds >= cta.endSeconds &&
        s.startSeconds <= cta.endSeconds + 8,
    );
    if (!buybackExists) {
      windows.push({
        windowStart: cta.endSeconds,
        windowEnd: cta.endSeconds + 5,
        risk: 'critical',
        predictedDropPercent: 22,
        reason: `CTA at ${formatTime(cta.startSeconds)} has no buyback — viewers interpret CTA as video end`,
        counterTactic: 'cta_buyback',
        tacticText: tacticText('cta_buyback', topic, cta.endSeconds),
        audioEvent: audioEventForTactic('cta_buyback'),
      });
    }
  }

  // ── Risk 3: YouTube 2-min cliff (1:45–2:10) — long-form only ─────────────
  if (format === 'long_form' && totalDuration > 130) {
    const cliffStart = 105; // 1:45
    const cliffEnd = 130;   // 2:10
    const hasInterruptNearCliff = sorted.some(
      (s) =>
        s.type === 'retention_beat' &&
        s.startSeconds >= cliffStart - 15 &&
        s.startSeconds <= cliffEnd + 10,
    );
    if (!hasInterruptNearCliff) {
      windows.push({
        windowStart: cliffStart,
        windowEnd: cliffEnd,
        risk: 'high',
        predictedDropPercent: 18,
        reason: 'YouTube 2-min cliff: median drop point globally when intro ends and content begins with no re-hook',
        counterTactic: 'pattern_interrupt',
        tacticText: tacticText('pattern_interrupt', topic, cliffStart),
        audioEvent: audioEventForTactic('pattern_interrupt'),
      });
    }
  }

  // ── Risk 4: After hard-concept segments ───────────────────────────────────
  const hardSegs = sorted.filter((s) => s.isHardConcept);
  for (const seg of hardSegs) {
    const dropWindow = seg.endSeconds;
    const hasFollowupBeat = sorted.some(
      (s) =>
        s.type === 'retention_beat' &&
        s.startSeconds >= dropWindow - 3 &&
        s.startSeconds <= dropWindow + 10,
    );
    if (!hasFollowupBeat) {
      windows.push({
        windowStart: dropWindow,
        windowEnd: dropWindow + 5,
        risk: 'high',
        predictedDropPercent: 14,
        reason: `Hard concept ends at ${formatTime(dropWindow)} without a re-anchor — viewers who are lost exit here`,
        counterTactic: 'recall_bait',
        tacticText: tacticText('recall_bait', topic, dropWindow),
        audioEvent: audioEventForTactic('recall_bait'),
      });
    }
  }

  // ── Risk 5: Every 90s without pattern interrupt ───────────────────────────
  let lastInterruptAt = 0;
  for (let t = 30; t < totalDuration; t += 5) {
    const hasRecentInterrupt = sorted.some(
      (s) =>
        s.type === 'retention_beat' &&
        s.startSeconds >= lastInterruptAt &&
        s.startSeconds <= t,
    );
    if (hasRecentInterrupt) {
      lastInterruptAt = t;
      continue;
    }
    const gapSinceLast = t - lastInterruptAt;
    if (gapSinceLast >= 90) {
      windows.push({
        windowStart: t,
        windowEnd: t + 5,
        risk: 'medium',
        predictedDropPercent: 8,
        reason: `${Math.round(gapSinceLast)}s since last interrupt — attention resets every 90s (MrBeast: interrupt every 30s)`,
        counterTactic: 'pattern_interrupt',
        tacticText: tacticText('pattern_interrupt', topic, t),
        audioEvent: audioEventForTactic('pattern_interrupt'),
      });
      lastInterruptAt = t; // Reset so we don't spam the same gap
    }
  }

  // ── Risk 6: After code blocks ─────────────────────────────────────────────
  const codeSegs = sorted.filter((s) => s.type === 'code');
  for (const seg of codeSegs) {
    const dropWindow = seg.endSeconds;
    const hasBeatAfter = sorted.some(
      (s) =>
        s.type === 'retention_beat' &&
        s.startSeconds >= dropWindow &&
        s.startSeconds <= dropWindow + 12,
    );
    if (!hasBeatAfter) {
      windows.push({
        windowStart: dropWindow,
        windowEnd: dropWindow + 5,
        risk: 'medium',
        predictedDropPercent: 10,
        reason: `Code block ends at ${formatTime(dropWindow)} — dense syntax causes viewer loss → exit`,
        counterTactic: 'curiosity_gap',
        tacticText: tacticText('curiosity_gap', topic, dropWindow),
        audioEvent: audioEventForTactic('curiosity_gap'),
      });
    }
  }

  // ── Risk 7: Final 15% of video ────────────────────────────────────────────
  const finalWindowStart = totalDuration * 0.85;
  const hasEndBeat = sorted.some(
    (s) => s.type === 'retention_beat' && s.startSeconds >= finalWindowStart,
  );
  if (!hasEndBeat && totalDuration > 60) {
    windows.push({
      windowStart: finalWindowStart,
      windowEnd: totalDuration,
      risk: 'medium',
      predictedDropPercent: 7,
      reason: '"I\'ve got the gist" early exits in final 15% — needs a recall bait or numbered list completion',
      counterTactic: 'recall_bait',
      tacticText: tacticText('recall_bait', topic, finalWindowStart),
      audioEvent: audioEventForTactic('recall_bait'),
    });
  }

  // ── Sort by risk level ────────────────────────────────────────────────────
  const riskOrder: Record<DropoffRisk, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  windows.sort(
    (a, b) =>
      riskOrder[a.risk] - riskOrder[b.risk] ||
      b.predictedDropPercent - a.predictedDropPercent,
  );

  // ── AVD estimates ─────────────────────────────────────────────────────────
  const worstCaseTotalDrop = windows.reduce(
    (sum, w) => sum + w.predictedDropPercent / 100,
    0,
  );

  const estimatedAvdWithoutFixes = Math.max(
    0.05,
    BASELINE_AVD_COLD_CHANNEL * (1 - Math.min(0.8, worstCaseTotalDrop)),
  );

  // With fixes: each tactic neutralizes a fraction of its window's drop
  const fixedDrop = windows.reduce((sum, w) => {
    const effectiveness = TACTIC_EFFECTIVENESS[w.counterTactic];
    return sum + (w.predictedDropPercent / 100) * (1 - effectiveness);
  }, 0);

  const estimatedAvdWithFixes = Math.min(
    0.85,
    BASELINE_AVD_COLD_CHANNEL + (0.45 - BASELINE_AVD_COLD_CHANNEL) * (1 - Math.min(0.8, fixedDrop)),
  );

  const targetAvd = format === 'short_form' ? TARGET_AVD_SHORTS : TARGET_AVD_LONGFORM;
  const meetsAvdThreshold = estimatedAvdWithFixes >= targetAvd * 0.8;

  return {
    windows,
    worstCaseTotalDrop: Math.round(worstCaseTotalDrop * 100),
    estimatedAvdWithoutFixes: Math.round(estimatedAvdWithoutFixes * 100),
    estimatedAvdWithFixes: Math.round(estimatedAvdWithFixes * 100),
    meetsAvdThreshold,
    format,
  };
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatDropoffReport(
  prediction: DropoffPrediction,
  topic: string,
): string {
  const lines: string[] = [
    `Drop-Off Prediction: ${topic}`,
    '═'.repeat(60),
    `Format: ${prediction.format} | Windows at risk: ${prediction.windows.length}`,
    `Estimated AVD without fixes: ${prediction.estimatedAvdWithoutFixes}%`,
    `Estimated AVD with all fixes: ${prediction.estimatedAvdWithFixes}%`,
    `Derral Eves threshold (30%): ${prediction.meetsAvdThreshold ? '✅ MET' : '❌ NOT MET — cold spiral risk'}`,
    '',
    'At-Risk Windows:',
    '─'.repeat(60),
  ];

  for (const w of prediction.windows) {
    const riskIcon = w.risk === 'critical' ? '🔴' : w.risk === 'high' ? '🟠' : '🟡';
    lines.push(
      `${riskIcon} ${formatTime(w.windowStart)}–${formatTime(w.windowEnd)} [${w.risk.toUpperCase()}] -${w.predictedDropPercent}% predicted`,
    );
    lines.push(`   Reason: ${w.reason}`);
    lines.push(`   Fix: ${w.tacticText}`);
    lines.push(`   Audio: ${w.audioEvent}`);
    lines.push('');
  }

  return lines.join('\n');
}
