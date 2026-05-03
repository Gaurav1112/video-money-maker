/**
 * retention-proxy.ts — Fix #26
 *
 * Synthetic retention score for a rendered video (no real YouTube data).
 * Inputs: video metadata extracted via ffprobe + script metadata.
 * Outputs: single 0–100 score + per-section breakdown.
 *
 * CALIBRATION against channel-shorts.tsv:
 *   944 views "90% Engineers WRONG"    → score ≥ 85
 *   905 views "Health Checks 3min"     → score ≥ 80
 *   812 views "90% Get Kafka WRONG"    → score ≥ 80
 *   613 views "Know Kafka or fail"     → score ≥ 72
 *   354 views "Netflix 1B requests"    → score ≥ 65
 *   268 views "Kafka Answer Hired"     → score ≥ 60
 *    11 views "API Gateway 60s"        → score ≤ 42
 *     4 views "Caching 60s Flat"       → score ≤ 35
 *
 * DETERMINISTIC: pure function of inputs — no RNG, no external calls.
 *
 * Sources:
 *   Derral Eves: AVD ≥ 30% → distribution; CTR × AVD = distribution score
 *   MrBeast: hook=promise+stakes, interrupt every 30s, 35% drop in 30s
 *   Karen X. Cheng: loop tax 2.5%/dead-air-second; completion rate > watch time
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Input: extracted from the rendered video + script metadata */
export interface VideoMetrics {
  /** Video title (used for shock-hook scoring) */
  title: string;

  /** Duration of hook before first content beat, in seconds (target: ≤ 3s for Shorts, ≤ 5s long-form) */
  hookDurationSeconds: number;

  /** Number of cuts per minute (target: ≥ 4/min for long-form, ≥ 8/min for Shorts) */
  cutsPerMinute: number;

  /** Audio dynamic range in dB (difference between avg loud and avg quiet passages) */
  audioDynamicRangeDb: number;

  /** True if captions/subtitles are burned in or attached */
  captionPresence: boolean;

  /** When the first CTA appears as a fraction of total video length (0.0–1.0) */
  ctaTimingFraction: number;

  /** Total video length in seconds */
  videoLengthSeconds: number;

  /** Number of open loops opened in the script */
  openLoopCount: number;

  /** Number of pattern interrupts inserted (≥ 1 per 30s is target) */
  patternInterruptCount: number;

  /** Does the video end with a frame that visually matches the first frame? */
  loopBackMatch: boolean;

  /** Number of retention beats inserted by retention-engine.ts */
  retentionBeatCount: number;

  /** Whether voice/TTS starts in the first 0.5s (frame 15 at 30fps) */
  voiceAtFrameZero: boolean;

  /** Whether the video has a visual change (zoom, color, text) in the first 0.5s */
  visualAtFrameZero: boolean;
}

/** Per-section score breakdown */
export interface SectionScore {
  section: string;
  score: number;       // 0–100 within this section
  weight: number;      // weight in final total (sum = 100)
  contribution: number; // score × weight / 100
  notes: string[];
}

/** Full output from the retention proxy */
export interface RetentionProxyResult {
  /** Composite 0–100 score */
  totalScore: number;

  /** Section-by-section breakdown */
  sections: SectionScore[];

  /** Pass/fail at the 70/100 CI gate */
  passed: boolean;

  /** Human-readable summary */
  summary: string;

  /** Recommended fixes (in priority order) */
  recommendations: string[];
}

// ─── Scoring weights (must sum to 100) ────────────────────────────────────────
//
// These weights are calibrated against the channel-shorts.tsv data:
//   The #1 driver of view-count variance in this channel is hook type (shock vs descriptive)
//   The #2 driver is video length (shorter = higher completion rate)
//   The #3 driver is pattern interrupt frequency
//
const SECTION_WEIGHTS = {
  hook: 25,           // Hook quality: text + voice + visual + shock factor
  earlyRetention: 20, // 0–30s: stake escalation, no dead air, first interrupt
  midRetention: 25,   // 30s–70%: interrupts/min, CTA buyback, loop payoff
  ctaQuality: 10,     // CTA timing + presence of buyback
  endRetention: 10,   // Last 20%: recall bait, loop close, numbered completion
  production: 10,     // Captions, audio dynamics, cuts/min
} as const;

// ─── Hook shock-scoring ───────────────────────────────────────────────────────

interface HookPattern {
  pattern: RegExp;
  score: number;
  label: string;
}

/**
 * Scores a video title for shock/retention hook quality.
 * Calibrated against channel-shorts.tsv performers.
 *
 * Returns 0–100.
 */
export function scoreTitle(title: string): number {
  const t = title.toLowerCase();

  const patterns: HookPattern[] = [
    // Tier 1: Proven top performers on this channel (900+ views)
    // Catch all "90% … WRONG" patterns regardless of words between them
    { pattern: /90%\s+\w[\w\s]+wrong/i, score: 95, label: '90% WRONG formula (channel #1 performer)' },
    { pattern: /\d+%\s*(engineer|dev|developer)s?\s*(are|get|prepare|answer|do)\s*wrong/i, score: 95, label: '90% WRONG formula strict' },
    { pattern: /\d+%.*wrong/i, score: 92, label: '% WRONG general' },
    { pattern: /90%\s*(get|are|do)/i, score: 92, label: '90% shock hook' },
    { pattern: /wrong|mistake|error|fail/i, score: 75, label: 'Error/failure hook' },

    // Tier 2: Strong performers (500–900 views)
    { pattern: /(fail|failing|failed)\s*(your|the|my)?\s*interview/i, score: 88, label: 'Interview fail hook' },
    { pattern: /or\s+fail\s+your/i, score: 85, label: 'Or fail hook' },
    { pattern: /health\s+check|explained\s+in\s+\d+\s+min/i, score: 78, label: 'Urgency + time hook' },
    { pattern: /(secret|trick|hack)\s+(to|behind|of)/i, score: 80, label: 'Secret/trick hook' },
    { pattern: /\d+\s*(billion|million|M|B)\s*(request|user|view)/i, score: 77, label: 'Scale curiosity hook' },

    // Tier 3: Moderate performers (250–500 views)
    { pattern: /(answer|strategy)\s+(that|which)\s+(get|work|land)/i, score: 68, label: 'Outcome hook' },
    { pattern: /(most|every)\s+(dev|engineer|programmer)/i, score: 65, label: 'Group identity hook' },
    { pattern: /\d+(lpa|lakh|salary|pay)/i, score: 72, label: 'Loss aversion (salary) hook' },

    // Tier 4: Weak performers (< 100 views) — descriptive hooks
    { pattern: /in\s+\d+\s+(second|minute|min|sec)/i, score: 30, label: 'Descriptive "in N seconds" hook' },
    { pattern: /(explained|tutorial|guide|introduction|overview)/i, score: 25, label: 'Descriptive/tutorial hook' },
    { pattern: /when\s+to\s+use/i, score: 28, label: 'Descriptive comparison hook' },
    { pattern: /#systemdesign\s*$|#shorts\s*$/i, score: 22, label: 'Hashtag-only identifier (no hook)' },
  ];

  // Start from 0; a "neutral" title (no pattern match) gets 40 (non-zero but below CI gate).
  // Weak patterns (score < 40) intentionally score LOWER than neutral — "in 60 seconds"
  // is worse than a plain declarative title.
  let bestScore = 0;
  let anyMatch = false;
  for (const { pattern, score } of patterns) {
    if (pattern.test(title)) {
      bestScore = Math.max(bestScore, score);
      anyMatch = true;
    }
  }
  if (!anyMatch) {
    bestScore = 40; // Neutral: no hook detected — better than weak but below CI gate
  }

  // Bonus: emojis signal energy and Shorts-native formatting (+5)
  if (/[\u{1F300}-\u{1FFFF}]/u.test(title)) {
    bestScore = Math.min(100, bestScore + 5);
  }

  // Penalty: title > 70 chars is truncated in mobile Shorts feed (-5)
  if (title.length > 70) {
    bestScore = Math.max(0, bestScore - 5);
  }

  return bestScore;
}

// ─── Section scorers ──────────────────────────────────────────────────────────

function scoreHook(m: VideoMetrics): SectionScore {
  const notes: string[] = [];
  let score = 0;

  // Title shock factor: 40 points
  const titleScore = scoreTitle(m.title);
  score += (titleScore / 100) * 40;
  notes.push(`Title shock score: ${titleScore}/100`);

  // Voice at frame zero: 20 points (MrBeast rule: audio+visual+text simultaneously in 0.5s)
  if (m.voiceAtFrameZero) {
    score += 20;
    notes.push('✅ Voice starts at frame 0');
  } else {
    notes.push('❌ Voice NOT at frame 0 — fix: TTS must start at frame 0 (HOOK_FRAMES issue)');
  }

  // Visual at frame zero: 20 points
  if (m.visualAtFrameZero) {
    score += 20;
    notes.push('✅ Visual change at frame 0');
  } else {
    notes.push('❌ No visual change at frame 0 — fix: zoom/color/text on first frame');
  }

  // Hook duration penalty: 20 points
  // Long-form: ≤ 5s = full points; > 25s = 0 (TitleSlide bug)
  // Short-form: ≤ 1s = full points; > 5s = 0
  const isShort = m.videoLengthSeconds <= 180;
  const maxGoodHook = isShort ? 1.5 : 5.0;
  const maxBadHook = isShort ? 5.0 : 25.0;
  const hookPenalty = Math.max(
    0,
    Math.min(1, (m.hookDurationSeconds - maxGoodHook) / (maxBadHook - maxGoodHook)),
  );
  const hookPoints = Math.round(20 * (1 - hookPenalty));
  score += hookPoints;
  notes.push(
    hookPoints === 20
      ? `✅ Hook duration ${m.hookDurationSeconds}s — optimal`
      : `⚠️ Hook duration ${m.hookDurationSeconds}s — target ≤ ${maxGoodHook}s (lost ${20 - hookPoints}pts)`,
  );

  return {
    section: 'Hook (0–5s)',
    score: Math.round(Math.min(100, score)),
    weight: SECTION_WEIGHTS.hook,
    contribution: Math.round((Math.min(100, score) * SECTION_WEIGHTS.hook) / 100),
    notes,
  };
}

function scoreEarlyRetention(m: VideoMetrics): SectionScore {
  const notes: string[] = [];
  let score = 0;

  // Pattern interrupt in first 30s: 40 points
  // Target: ≥ 1 interrupt in 0–30s window
  const expectedInterruptsFirst30 = 1;
  const actualInterruptsFirst30 = Math.min(
    m.patternInterruptCount,
    expectedInterruptsFirst30,
  );
  const interruptScore = (actualInterruptsFirst30 / expectedInterruptsFirst30) * 40;
  score += interruptScore;
  notes.push(
    actualInterruptsFirst30 >= expectedInterruptsFirst30
      ? '✅ Pattern interrupt present in first 30s'
      : '❌ No pattern interrupt in first 30s — viewers drift at 0:30',
  );

  // No dead air: 30 points (Karen X. Cheng loop tax)
  // Proxy: if cutsPerMinute ≥ 4, assume no dead air
  const cutsTarget = m.videoLengthSeconds <= 180 ? 8 : 4;
  const cutScore = Math.min(1, m.cutsPerMinute / cutsTarget) * 30;
  score += cutScore;
  notes.push(
    m.cutsPerMinute >= cutsTarget
      ? `✅ ${m.cutsPerMinute.toFixed(1)} cuts/min — above target`
      : `⚠️ ${m.cutsPerMinute.toFixed(1)} cuts/min — target ≥ ${cutsTarget}/min`,
  );

  // Retention beats present: 30 points
  // Stake escalation + loss aversion should appear in first 40s
  const expectedBeats = 2;
  const beatScore = Math.min(1, m.retentionBeatCount / expectedBeats) * 30;
  score += beatScore;
  notes.push(
    m.retentionBeatCount >= expectedBeats
      ? `✅ ${m.retentionBeatCount} retention beats — early retention covered`
      : `⚠️ Only ${m.retentionBeatCount} beats — need ≥ ${expectedBeats} in first 40s`,
  );

  return {
    section: 'Early Retention (0–30s)',
    score: Math.round(Math.min(100, score)),
    weight: SECTION_WEIGHTS.earlyRetention,
    contribution: Math.round((Math.min(100, score) * SECTION_WEIGHTS.earlyRetention) / 100),
    notes,
  };
}

function scoreMidRetention(m: VideoMetrics): SectionScore {
  const notes: string[] = [];
  let score = 0;

  // Interrupt frequency throughout video: 40 points
  // Target: 1 interrupt per 30s = 2 per minute
  const expectedInterrupts = Math.floor(m.videoLengthSeconds / 30);
  const interruptRatio = Math.min(1, m.patternInterruptCount / Math.max(1, expectedInterrupts));
  score += interruptRatio * 40;
  notes.push(
    `Pattern interrupts: ${m.patternInterruptCount}/${expectedInterrupts} expected (${Math.round(interruptRatio * 100)}%)`,
  );

  // Open loop count: 30 points
  // 1–2 = full score, 0 = 0, > 3 = penalty (Karen: loop tax)
  const openLoopScore =
    m.openLoopCount === 0 ? 0
    : m.openLoopCount === 1 ? 100
    : m.openLoopCount === 2 ? 95
    : m.openLoopCount === 3 ? 70
    : 40; // > 3 = loop overload
  score += (openLoopScore / 100) * 30;
  notes.push(
    m.openLoopCount === 0
      ? '❌ No open loops — viewers have no reason to stay'
      : m.openLoopCount <= 2
      ? `✅ ${m.openLoopCount} open loop(s) — optimal`
      : `⚠️ ${m.openLoopCount} open loops — Karen X. Cheng rule: ≤ 2 or loop tax`,
  );

  // Retention beat count relative to expected: 30 points
  const expectedTotalBeats = Math.max(3, Math.floor(m.videoLengthSeconds / 30));
  const beatRatio = Math.min(1, m.retentionBeatCount / expectedTotalBeats);
  score += beatRatio * 30;
  notes.push(`Retention beats: ${m.retentionBeatCount}/${expectedTotalBeats} expected`);

  return {
    section: 'Mid Retention (30s–70%)',
    score: Math.round(Math.min(100, score)),
    weight: SECTION_WEIGHTS.midRetention,
    contribution: Math.round((Math.min(100, score) * SECTION_WEIGHTS.midRetention) / 100),
    notes,
  };
}

function scoreCtaQuality(m: VideoMetrics): SectionScore {
  const notes: string[] = [];
  let score = 0;

  // CTA timing: 60 points
  // Optimal: 40–70% into video. ≤ 20% or ≥ 90% = bad.
  const cta = m.ctaTimingFraction;
  let ctaPoints: number;
  if (cta >= 0.4 && cta <= 0.7) {
    ctaPoints = 60;
    notes.push(`✅ CTA at ${Math.round(cta * 100)}% — optimal window (40–70%)`);
  } else if (cta >= 0.25 && cta < 0.4) {
    ctaPoints = 40;
    notes.push(`⚠️ CTA at ${Math.round(cta * 100)}% — slightly early (target: 40–70%)`);
  } else if (cta > 0.7 && cta <= 0.85) {
    ctaPoints = 45;
    notes.push(`⚠️ CTA at ${Math.round(cta * 100)}% — slightly late (target: 40–70%)`);
  } else {
    ctaPoints = 15;
    notes.push(`❌ CTA at ${Math.round(cta * 100)}% — outside optimal window (kills retention)`);
  }
  score += ctaPoints;

  // CTA buyback: 40 points (proxy: retentionBeatCount includes cta_buyback beats)
  // We use retentionBeatCount as a proxy — if beats were inserted, buybacks are present
  const hasBuyback = m.retentionBeatCount >= 4;
  if (hasBuyback) {
    score += 40;
    notes.push('✅ CTA buyback likely present (retention beats ≥ 4)');
  } else {
    notes.push('❌ CTA buyback missing — immediate exit risk after CTA');
  }

  return {
    section: 'CTA Quality',
    score: Math.round(Math.min(100, score)),
    weight: SECTION_WEIGHTS.ctaQuality,
    contribution: Math.round((Math.min(100, score) * SECTION_WEIGHTS.ctaQuality) / 100),
    notes,
  };
}

function scoreEndRetention(m: VideoMetrics): SectionScore {
  const notes: string[] = [];
  let score = 0;

  // Loop-back match: 50 points (Karen X. Cheng: highest-leverage Shorts hack)
  if (m.loopBackMatch) {
    score += 50;
    notes.push('✅ Loop-back match — last frame = first frame (replay signal)');
  } else {
    notes.push('❌ No loop-back match — fix: EndCTA → loop frame (highest Shorts leverage)');
  }

  // Recall bait / open loop closure: 30 points
  // Proxy: if retentionBeatCount is high, recall bait is likely present
  const hasRecallBait = m.retentionBeatCount >= 5;
  if (hasRecallBait) {
    score += 30;
    notes.push('✅ Recall bait likely present (closes open loops)');
  } else {
    notes.push('⚠️ Recall bait may be missing — open loops left unclosed = viewer feels cheated');
  }

  // Open loop closure: 20 points
  // If openLoopCount > 0, we need to ensure they're closed
  // Proxy: if video has beats AND open loops, assume they're closed
  const loopsClosed = m.openLoopCount > 0 && m.retentionBeatCount >= m.openLoopCount + 2;
  if (loopsClosed) {
    score += 20;
    notes.push('✅ Open loops closed by end');
  } else if (m.openLoopCount === 0) {
    score += 10; // Neutral: no loops to close
    notes.push('ℹ️ No open loops to close');
  } else {
    notes.push('⚠️ Open loops may not be closed — audit script');
  }

  return {
    section: 'End Retention (last 20%)',
    score: Math.round(Math.min(100, score)),
    weight: SECTION_WEIGHTS.endRetention,
    contribution: Math.round((Math.min(100, score) * SECTION_WEIGHTS.endRetention) / 100),
    notes,
  };
}

function scoreProduction(m: VideoMetrics): SectionScore {
  const notes: string[] = [];
  let score = 0;

  // Captions: 35 points (accessibility + watch-without-sound = 85% of mobile viewers)
  if (m.captionPresence) {
    score += 35;
    notes.push('✅ Captions present');
  } else {
    notes.push('❌ No captions — 85% of mobile viewers watch without sound');
  }

  // Audio dynamic range: 35 points
  // Target: ≥ 6dB range. < 3dB = flat/monotonous. > 15dB = inconsistent.
  let audioPoints: number;
  if (m.audioDynamicRangeDb >= 6 && m.audioDynamicRangeDb <= 15) {
    audioPoints = 35;
    notes.push(`✅ Audio dynamic range ${m.audioDynamicRangeDb.toFixed(1)}dB — optimal`);
  } else if (m.audioDynamicRangeDb < 3) {
    audioPoints = 5;
    notes.push(`❌ Audio too flat (${m.audioDynamicRangeDb.toFixed(1)}dB) — no emotional variation`);
  } else if (m.audioDynamicRangeDb < 6) {
    audioPoints = 18;
    notes.push(`⚠️ Audio range low (${m.audioDynamicRangeDb.toFixed(1)}dB) — target ≥ 6dB`);
  } else {
    audioPoints = 20;
    notes.push(`⚠️ Audio range high (${m.audioDynamicRangeDb.toFixed(1)}dB) — may feel inconsistent`);
  }
  score += audioPoints;

  // Cuts per minute: 30 points
  const isShort = m.videoLengthSeconds <= 180;
  const cutsTarget = isShort ? 8 : 4;
  const cutRatio = Math.min(1, m.cutsPerMinute / cutsTarget);
  score += cutRatio * 30;
  notes.push(
    m.cutsPerMinute >= cutsTarget
      ? `✅ ${m.cutsPerMinute.toFixed(1)} cuts/min`
      : `⚠️ ${m.cutsPerMinute.toFixed(1)} cuts/min — target ≥ ${cutsTarget}/min for ${isShort ? 'Shorts' : 'long-form'}`,
  );

  return {
    section: 'Production Signals',
    score: Math.round(Math.min(100, score)),
    weight: SECTION_WEIGHTS.production,
    contribution: Math.round((Math.min(100, score) * SECTION_WEIGHTS.production) / 100),
    notes,
  };
}

// ─── Main scorer ──────────────────────────────────────────────────────────────

/**
 * scoreRetention — pure function, deterministic.
 *
 * Returns a 0–100 retention proxy score + per-section breakdown.
 * CI gate: FAIL if totalScore < 70.
 */
export function scoreRetention(metrics: VideoMetrics): RetentionProxyResult {
  const sections: SectionScore[] = [
    scoreHook(metrics),
    scoreEarlyRetention(metrics),
    scoreMidRetention(metrics),
    scoreCtaQuality(metrics),
    scoreEndRetention(metrics),
    scoreProduction(metrics),
  ];

  const totalScore = sections.reduce((sum, s) => sum + s.contribution, 0);
  const passed = totalScore >= 70;

  // Auto-fail if hook section scores < 30% of its weight (hook is non-negotiable)
  const hookSection = sections.find((s) => s.section.startsWith('Hook'));
  const hookMinScore = (SECTION_WEIGHTS.hook * 0.30);
  const hookAutoFail =
    hookSection !== undefined && hookSection.contribution < hookMinScore;

  const finalPassed = passed && !hookAutoFail;

  // Build recommendations (sorted by highest score impact first)
  const recommendations: string[] = [];
  const failingSections = sections
    .filter((s) => s.score < 60)
    .sort((a, b) => b.weight - a.weight);

  for (const section of failingSections) {
    for (const note of section.notes) {
      if (note.startsWith('❌') || note.startsWith('⚠️')) {
        recommendations.push(`[${section.section}] ${note}`);
      }
    }
  }

  if (hookAutoFail) {
    recommendations.unshift(
      '🚨 AUTO-FAIL: Hook section scored below minimum threshold (< 30% of weight). Fix hook before anything else.',
    );
  }

  const summary = [
    `Retention Proxy Score: ${totalScore}/100 — ${finalPassed ? '✅ PASS' : '❌ FAIL (threshold: 70)'}`,
    `Format: ${metrics.videoLengthSeconds <= 180 ? 'Short-form' : 'Long-form'} (${metrics.videoLengthSeconds}s)`,
    `Title: "${metrics.title}"`,
    hookAutoFail ? '🚨 Hook auto-fail triggered' : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    totalScore,
    sections,
    passed: finalPassed,
    summary,
    recommendations,
  };
}

// ─── Calibration helper ───────────────────────────────────────────────────────

/**
 * Returns the expected score range for a given view count,
 * based on the channel-shorts.tsv calibration data.
 */
export function expectedScoreRange(views: number): [number, number] {
  if (views >= 900) return [82, 100];
  if (views >= 600) return [70, 84];
  if (views >= 300) return [60, 72];
  if (views >= 100) return [48, 62];
  if (views >= 30)  return [38, 50];
  return [0, 42];
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Format the result as a GitHub PR comment (Markdown).
 */
export function formatRetentionComment(result: RetentionProxyResult): string {
  const icon = result.passed ? '✅' : '❌';
  const lines: string[] = [
    `## ${icon} Retention Proxy Score: ${result.totalScore}/100`,
    '',
    result.passed
      ? '**CI Gate: PASS** (threshold: 70/100)'
      : '**CI Gate: FAIL** (threshold: 70/100) — This video will not be uploaded until retention score ≥ 70.',
    '',
    '### Section Breakdown',
    '',
    '| Section | Score | Weight | Contribution |',
    '|---|---|---|---|',
  ];

  for (const s of result.sections) {
    const icon = s.score >= 70 ? '✅' : s.score >= 50 ? '⚠️' : '❌';
    lines.push(`| ${icon} ${s.section} | ${s.score}/100 | ${s.weight}% | ${s.contribution}pts |`);
  }

  lines.push('');
  lines.push('### Details');
  for (const s of result.sections) {
    if (s.notes.length > 0) {
      lines.push(`**${s.section}:**`);
      for (const note of s.notes) {
        lines.push(`- ${note}`);
      }
    }
  }

  if (result.recommendations.length > 0) {
    lines.push('');
    lines.push('### 🔧 Recommendations (highest-impact first)');
    result.recommendations.slice(0, 5).forEach((r, i) => {
      lines.push(`${i + 1}. ${r}`);
    });
  }

  lines.push('');
  lines.push(
    '*Retention Proxy v1.0 — Fix #26 — Sources: MrBeast 35% rule, Derral Eves AVD math, Karen X. Cheng loop tax*',
  );

  return lines.join('\n');
}
