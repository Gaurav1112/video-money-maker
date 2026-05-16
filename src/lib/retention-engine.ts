/**
 * retention-engine.ts — Fix #26
 *
 * Given a script with per-segment timestamps, inserts retention beats:
 *   • Open loop at 0:15
 *   • Pattern interrupt every 30s
 *   • Midpoint recall-bait callback
 *   • Pre-CTA stake-restate
 *
 * DETERMINISTIC: All beat placement is a pure function of input timestamps.
 * No randomness. Same script → same beats every time.
 *
 * Sources:
 *   MrBeast rule: interrupt every 30s, hook = promise+stakes in 0.5s
 *   Derral Eves: AVD ≥ 30% for distribution; pre-CTA restate holds viewers
 *   Karen X. Cheng: loop tax = 2.5%/dead-air-second; every beat must earn its place
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScriptSegmentType =
  | 'hook'
  | 'content'
  | 'code'
  | 'diagram'
  | 'cta'
  | 'review'
  | 'summary'
  | 'retention_beat'; // injected by this engine

export interface ScriptSegment {
  id: string;
  type: ScriptSegmentType;
  startSeconds: number;
  endSeconds: number;
  text: string;
  /** Optional: marks which concept is being taught (for drop-off predictor) */
  conceptLabel?: string;
  /** True if this is a "hard concept" segment (architecture, algo, formula) */
  isHardConcept?: boolean;
}

export type RetentionBeatType =
  | 'open_loop'
  | 'stake_escalation'
  | 'pattern_interrupt'
  | 'curiosity_gap'
  | 'cta_buyback'
  | 'numbered_tease'
  | 'status_reveal'
  | 'loss_aversion'
  | 'recall_bait'
  | 'surprise_subversion';

export interface RetentionBeat {
  beatType: RetentionBeatType;
  insertAtSeconds: number;
  durationSeconds: number;
  /** The injected spoken/on-screen text */
  text: string;
  /** The audio event to pair with this beat */
  audioEvent: AudioEvent;
  /** References earlier beat by ID (for recall_bait and cta_buyback) */
  referencesId?: string;
}

export type AudioEvent =
  | 'none'
  | 'zoom_punch'      // 1.08× scale flash + whoosh SFX
  | 'audio_sting'     // 80ms 440Hz sine or short whoosh
  | 'audio_rise'      // ascending filter swell (+3dB over 0.5s)
  | 'audio_duck'      // 0.5s near-silence before key line
  | 'audio_slam'      // instant full-volume return
  | 'color_flash'     // 2-frame accent-color overlay
  | 'silence_cut';    // 0.5s of full silence

export interface RetentionEngineOutput {
  /** Original segments with retention beats woven in, sorted by startSeconds */
  segments: ScriptSegment[];
  /** Summary of all beats inserted */
  beatsInserted: RetentionBeat[];
  /** Whether this is long-form (>180s) or short-form */
  format: 'long_form' | 'short_form';
  /** Total video duration in seconds */
  totalDurationSeconds: number;
  /** Open loops opened and closed (for validation) */
  openLoopBalance: { opened: number; closed: number };
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Shorts cutoff: ≤ 180s = short_form */
const SHORT_FORM_THRESHOLD_SECONDS = 180;

/** MrBeast rule: interrupt every 30s */
const PATTERN_INTERRUPT_INTERVAL_SECONDS = 30;

/** Beat at which to open the primary curiosity gap (long-form) */
const OPEN_LOOP_TARGET_SECONDS = 15;

/** Stake escalation target: just after hook settles */
const STAKE_ESCALATION_TARGET_SECONDS = 35;

/** Recall bait at midpoint */
const RECALL_BAIT_FRACTION = 0.5;

/** Derral Eves: pre-CTA stake-restate must be ≥ 5s before CTA */
const PRE_CTA_RESTATE_OFFSET_SECONDS = 6;

/** Duration for each beat type (seconds) */
const BEAT_DURATIONS: Record<RetentionBeatType, number> = {
  open_loop: 6,
  stake_escalation: 8,
  pattern_interrupt: 3,
  curiosity_gap: 8,
  cta_buyback: 6,
  numbered_tease: 12,
  status_reveal: 8,
  loss_aversion: 6,
  recall_bait: 8,
  surprise_subversion: 15,
};

// ─── Topic-aware template generators ─────────────────────────────────────────

function openLoopText(topic: string, ctaPayoffSeconds: number): string {
  const minStr = formatTime(ctaPayoffSeconds);
  return `I'll show you the ONE answer that works — but first, there's something about ${topic} that 90% of engineers get completely wrong. I'll explain at ${minStr}.`;
}

function stakeEscalationText(topic: string): string {
  return `If you answer ${topic} the wrong way in a FAANG interview, you don't just fail that question — you fail the whole system design round. Most engineers make this mistake and never know why they got rejected.`;
}

function patternInterruptText(index: number): string {
  const phrases = [
    'WAIT — before we continue:',
    'HERE\'S WHAT CHANGES EVERYTHING:',
    'STOP — this is the part most tutorials skip:',
    'PAY ATTENTION HERE:',
    'THIS IS THE CRITICAL PART:',
  ];
  return phrases[index % phrases.length];
}

function curiosityGapText(topic: string, payoffSeconds: number): string {
  const minStr = formatTime(payoffSeconds);
  return `Question: if you had to explain ${topic} to a Google interviewer in 30 seconds — what would you say? Hold that answer. I'll show you why most people get it wrong at ${minStr}.`;
}

function ctaBuybackText(topic: string): string {
  return `But WAIT — before that link — I haven't shown you the #1 mistake everyone makes with ${topic}. Stay for 30 more seconds.`;
}

function numberedTeaseText(topic: string, count: number): string {
  return `${count} things every senior engineer knows about ${topic} — and number ${Math.ceil(count * 0.75)} is what 90% miss in interviews.`;
}

function statusRevealText(topic: string): string {
  return `A principal engineer at Amazon told me something about ${topic} during a mock interview — and it changed how I explain it forever.`;
}

function lossAversionText(topic: string): string {
  return `Engineers who don't know this about ${topic} are leaving ₹15–20LPA on the table — every interview season.`;
}

function recallBaitText(topic: string, questionSeconds: number): string {
  const minStr = formatTime(questionSeconds);
  return `Remember the question I asked at ${minStr}? Here's exactly why your first instinct about ${topic} was wrong — and what the correct answer is.`;
}

function surpriseSubversionText(topic: string): string {
  return `Most engineers think the answer to "${topic} at scale" is to add more servers. It's actually the opposite — and I'll prove it in the next 30 seconds.`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Generate deterministic beat ID from type + position */
function beatId(type: RetentionBeatType, positionSeconds: number): string {
  return `beat_${type}_${Math.round(positionSeconds)}`;
}

/** Find nearest non-overlapping insertion point after `target` seconds */
function findInsertionPoint(
  segments: ScriptSegment[],
  targetSeconds: number,
  beatDurationSeconds: number,
): number {
  // Find a gap after targetSeconds that fits the beat
  const sorted = [...segments].sort((a, b) => a.startSeconds - b.startSeconds);
  for (let i = 0; i < sorted.length; i++) {
    const seg = sorted[i];
    if (seg.startSeconds >= targetSeconds) {
      // Insert before this segment if there's room
      const prevEnd = i > 0 ? sorted[i - 1].endSeconds : 0;
      const gap = seg.startSeconds - prevEnd;
      if (gap >= beatDurationSeconds) {
        return prevEnd + 0.1;
      }
      // Otherwise push this segment forward in the caller (we return the target time)
      return targetSeconds;
    }
  }
  // Append at end
  const last = sorted[sorted.length - 1];
  return last ? last.endSeconds + 0.1 : targetSeconds;
}

/** Shift all segments at or after `fromSeconds` by `shiftBy` seconds */
function shiftSegmentsAfter(
  segments: ScriptSegment[],
  fromSeconds: number,
  shiftBy: number,
): ScriptSegment[] {
  return segments.map((seg) => {
    if (seg.startSeconds >= fromSeconds) {
      return {
        ...seg,
        startSeconds: seg.startSeconds + shiftBy,
        endSeconds: seg.endSeconds + shiftBy,
      };
    }
    return seg;
  });
}

/** Convert a RetentionBeat to a ScriptSegment for insertion */
function beatToSegment(beat: RetentionBeat): ScriptSegment {
  return {
    id: beatId(beat.beatType, beat.insertAtSeconds),
    type: 'retention_beat',
    startSeconds: beat.insertAtSeconds,
    endSeconds: beat.insertAtSeconds + beat.durationSeconds,
    text: beat.text,
    conceptLabel: beat.beatType,
  };
}

// ─── Main engine ─────────────────────────────────────────────────────────────

/**
 * insertRetentionBeats — pure function, deterministic.
 *
 * Takes a script (sorted by startSeconds) and topic label, returns a new
 * script with retention beats inserted at the correct positions.
 *
 * Beat placement order:
 *   1. Open loop at 0:15 (long-form only)
 *   2. Loss aversion at ~0:05 (both formats)
 *   3. Stake escalation at ~0:35 (long-form)
 *   4. Curiosity gap at ~0:20 (both)
 *   5. Numbered tease at ~0:45 (long-form only)
 *   6. Pattern interrupts every 30s
 *   7. Status reveal before hardest concept
 *   8. Surprise subversion before primary insight
 *   9. Pre-CTA stake-restate + CTA buyback at every CTA
 *  10. Recall bait at midpoint
 */
export function insertRetentionBeats(
  segments: ScriptSegment[],
  topic: string,
): RetentionEngineOutput {
  // Sort by start time
  let workingSegments = [...segments].sort(
    (a, b) => a.startSeconds - b.startSeconds,
  );

  const totalDuration =
    workingSegments.length > 0
      ? workingSegments[workingSegments.length - 1].endSeconds
      : 0;

  const format: 'long_form' | 'short_form' =
    totalDuration <= SHORT_FORM_THRESHOLD_SECONDS ? 'short_form' : 'long_form';

  const beatsInserted: RetentionBeat[] = [];
  let openLoopOpened = 0;
  let openLoopClosed = 0;

  // ── 1. Loss aversion at ~0:05 (both formats) ──────────────────────────────
  {
    const insertAt = 5;
    const beat: RetentionBeat = {
      beatType: 'loss_aversion',
      insertAtSeconds: insertAt,
      durationSeconds: BEAT_DURATIONS.loss_aversion,
      text: lossAversionText(topic),
      audioEvent: 'audio_duck',
    };
    beatsInserted.push(beat);
    workingSegments = shiftSegmentsAfter(
      workingSegments,
      insertAt,
      beat.durationSeconds,
    );
    workingSegments.push(beatToSegment(beat));
  }

  // ── 2. Open loop at 0:15 (long-form) or curiosity gap at 0:10 (short) ─────
  if (format === 'long_form') {
    const payoffAt = Math.round(totalDuration * 0.55);
    const insertAt = OPEN_LOOP_TARGET_SECONDS;
    const beat: RetentionBeat = {
      beatType: 'open_loop',
      insertAtSeconds: insertAt,
      durationSeconds: BEAT_DURATIONS.open_loop,
      text: openLoopText(topic, payoffAt),
      audioEvent: 'audio_rise',
    };
    beatsInserted.push(beat);
    workingSegments = shiftSegmentsAfter(
      workingSegments,
      insertAt,
      beat.durationSeconds,
    );
    workingSegments.push(beatToSegment(beat));
    openLoopOpened++;

    // Curiosity gap right after open loop
    const cgInsertAt = insertAt + BEAT_DURATIONS.open_loop + 2;
    const cgPayoff = Math.round(totalDuration * 0.6);
    const cgBeat: RetentionBeat = {
      beatType: 'curiosity_gap',
      insertAtSeconds: cgInsertAt,
      durationSeconds: BEAT_DURATIONS.curiosity_gap,
      text: curiosityGapText(topic, cgPayoff),
      audioEvent: 'silence_cut',
    };
    beatsInserted.push(cgBeat);
    workingSegments = shiftSegmentsAfter(
      workingSegments,
      cgInsertAt,
      cgBeat.durationSeconds,
    );
    workingSegments.push(beatToSegment(cgBeat));
    openLoopOpened++;
  } else {
    // Short-form: curiosity gap at ~0:04 (after 0:00 hook)
    const insertAt = 4;
    const payoffAt = Math.round(totalDuration * 0.65);
    const beat: RetentionBeat = {
      beatType: 'curiosity_gap',
      insertAtSeconds: insertAt,
      durationSeconds: 5,
      text: curiosityGapText(topic, payoffAt),
      audioEvent: 'silence_cut',
    };
    beatsInserted.push(beat);
    workingSegments = shiftSegmentsAfter(
      workingSegments,
      insertAt,
      beat.durationSeconds,
    );
    workingSegments.push(beatToSegment(beat));
    openLoopOpened++;
  }

  // ── 3. Stake escalation at ~0:35 (long-form only) ─────────────────────────
  if (format === 'long_form') {
    const insertAt = STAKE_ESCALATION_TARGET_SECONDS;
    const beat: RetentionBeat = {
      beatType: 'stake_escalation',
      insertAtSeconds: insertAt,
      durationSeconds: BEAT_DURATIONS.stake_escalation,
      text: stakeEscalationText(topic),
      audioEvent: 'audio_duck',
    };
    beatsInserted.push(beat);
    workingSegments = shiftSegmentsAfter(
      workingSegments,
      insertAt,
      beat.durationSeconds,
    );
    workingSegments.push(beatToSegment(beat));
  }

  // ── 4. Numbered tease at ~0:45 (long-form only) ────────────────────────────
  if (format === 'long_form') {
    const insertAt = 45;
    const beat: RetentionBeat = {
      beatType: 'numbered_tease',
      insertAtSeconds: insertAt,
      durationSeconds: BEAT_DURATIONS.numbered_tease,
      text: numberedTeaseText(topic, 5),
      audioEvent: 'audio_sting',
    };
    beatsInserted.push(beat);
    workingSegments = shiftSegmentsAfter(
      workingSegments,
      insertAt,
      beat.durationSeconds,
    );
    workingSegments.push(beatToSegment(beat));
  }

  // ── 5. Status reveal before hardest concept ───────────────────────────────
  const hardConceptSeg = workingSegments.find((s) => s.isHardConcept);
  if (hardConceptSeg) {
    const insertAt = Math.max(0, hardConceptSeg.startSeconds - 5);
    const beat: RetentionBeat = {
      beatType: 'status_reveal',
      insertAtSeconds: insertAt,
      durationSeconds: BEAT_DURATIONS.status_reveal,
      text: statusRevealText(topic),
      audioEvent: 'none',
    };
    beatsInserted.push(beat);
    workingSegments = shiftSegmentsAfter(
      workingSegments,
      insertAt,
      beat.durationSeconds,
    );
    workingSegments.push(beatToSegment(beat));
  }

  // ── 6. Pattern interrupts every 30s ────────────────────────────────────────
  // Re-sort to get correct current positions after all insertions so far
  workingSegments.sort((a, b) => a.startSeconds - b.startSeconds);
  const currentDuration =
    workingSegments[workingSegments.length - 1]?.endSeconds ?? totalDuration;

  let interruptIndex = 0;
  for (
    let t = PATTERN_INTERRUPT_INTERVAL_SECONDS;
    t < currentDuration - 10;
    t += PATTERN_INTERRUPT_INTERVAL_SECONDS
  ) {
    // Don't insert if there's already a retention beat within 8s
    const alreadyHasBeat = workingSegments.some(
      (s) =>
        s.type === 'retention_beat' &&
        Math.abs(s.startSeconds - t) < 8,
    );
    if (alreadyHasBeat) continue;

    const beat: RetentionBeat = {
      beatType: 'pattern_interrupt',
      insertAtSeconds: t,
      durationSeconds: BEAT_DURATIONS.pattern_interrupt,
      text: patternInterruptText(interruptIndex),
      audioEvent: interruptIndex % 2 === 0 ? 'zoom_punch' : 'audio_sting',
    };
    beatsInserted.push(beat);
    workingSegments = shiftSegmentsAfter(
      workingSegments,
      t,
      beat.durationSeconds,
    );
    workingSegments.push(beatToSegment(beat));
    interruptIndex++;
    // Re-sort after each insertion
    workingSegments.sort((a, b) => a.startSeconds - b.startSeconds);
  }

  // ── 7. Surprise subversion before primary insight ─────────────────────────
  if (format === 'long_form') {
    const targetPos = totalDuration * 0.42;
    const insertAt = findInsertionPoint(
      workingSegments,
      targetPos,
      BEAT_DURATIONS.surprise_subversion,
    );
    const beat: RetentionBeat = {
      beatType: 'surprise_subversion',
      insertAtSeconds: insertAt,
      durationSeconds: BEAT_DURATIONS.surprise_subversion,
      text: surpriseSubversionText(topic),
      audioEvent: 'silence_cut',
    };
    beatsInserted.push(beat);
    workingSegments = shiftSegmentsAfter(
      workingSegments,
      insertAt,
      beat.durationSeconds,
    );
    workingSegments.push(beatToSegment(beat));
  }

  // ── 8. Pre-CTA stake-restate + CTA buyback ─────────────────────────────────
  workingSegments.sort((a, b) => a.startSeconds - b.startSeconds);
  const ctaSegments = workingSegments.filter((s) => s.type === 'cta');

  for (const cta of ctaSegments) {
    // Pre-CTA restate (Derral Eves: remind viewers WHY they came before asking action)
    const restateAt = Math.max(0, cta.startSeconds - PRE_CTA_RESTATE_OFFSET_SECONDS);
    const restateBeat: RetentionBeat = {
      beatType: 'loss_aversion',
      insertAtSeconds: restateAt,
      durationSeconds: 5,
      text: `Before I give you the link — remember: engineers who miss this are leaving ₹15LPA behind every year.`,
      audioEvent: 'audio_duck',
    };
    beatsInserted.push(restateBeat);
    workingSegments = shiftSegmentsAfter(
      workingSegments,
      restateAt,
      restateBeat.durationSeconds,
    );
    workingSegments.push(beatToSegment(restateBeat));
    workingSegments.sort((a, b) => a.startSeconds - b.startSeconds);

    // CTA buyback immediately after CTA
    const buybackAt = cta.endSeconds + 0.5;
    const buybackBeat: RetentionBeat = {
      beatType: 'cta_buyback',
      insertAtSeconds: buybackAt,
      durationSeconds: BEAT_DURATIONS.cta_buyback,
      text: ctaBuybackText(topic),
      audioEvent: 'audio_slam',
    };
    beatsInserted.push(buybackBeat);
    workingSegments = shiftSegmentsAfter(
      workingSegments,
      buybackAt,
      buybackBeat.durationSeconds,
    );
    workingSegments.push(beatToSegment(buybackBeat));
    workingSegments.sort((a, b) => a.startSeconds - b.startSeconds);
  }

  // ── 9. Recall bait at midpoint ────────────────────────────────────────────
  workingSegments.sort((a, b) => a.startSeconds - b.startSeconds);
  const finalDuration =
    workingSegments[workingSegments.length - 1]?.endSeconds ?? totalDuration;

  const openLoopBeat = beatsInserted.find(
    (b) => b.beatType === 'open_loop' || b.beatType === 'curiosity_gap',
  );
  const recallAt = finalDuration * RECALL_BAIT_FRACTION;
  const recallBeat: RetentionBeat = {
    beatType: 'recall_bait',
    insertAtSeconds: recallAt,
    durationSeconds: BEAT_DURATIONS.recall_bait,
    text: recallBaitText(
      topic,
      openLoopBeat?.insertAtSeconds ?? OPEN_LOOP_TARGET_SECONDS,
    ),
    audioEvent: 'audio_sting',
    referencesId: openLoopBeat
      ? beatId(openLoopBeat.beatType, openLoopBeat.insertAtSeconds)
      : undefined,
  };
  beatsInserted.push(recallBeat);
  workingSegments = shiftSegmentsAfter(
    workingSegments,
    recallAt,
    recallBeat.durationSeconds,
  );
  workingSegments.push(beatToSegment(recallBeat));

  // ── Final sort ─────────────────────────────────────────────────────────────
  workingSegments.sort((a, b) => a.startSeconds - b.startSeconds);

  // Count loop balance (recall_bait + surprise_subversion close loops)
  openLoopClosed = beatsInserted.filter(
    (b) => b.beatType === 'recall_bait' || b.beatType === 'surprise_subversion',
  ).length;

  return {
    segments: workingSegments,
    beatsInserted,
    format,
    totalDurationSeconds: workingSegments[workingSegments.length - 1]?.endSeconds ?? 0,
    openLoopBalance: { opened: openLoopOpened, closed: openLoopClosed },
  };
}

// ─── Convenience: extract beat schedule as plain text ─────────────────────────

/**
 * Renders the beat schedule as a human-readable string for logging / PR comment.
 */
export function formatBeatSchedule(output: RetentionEngineOutput): string {
  const lines: string[] = [
    `Retention Beat Schedule (${output.format}, ${formatTime(output.totalDurationSeconds)})`,
    '═'.repeat(60),
  ];
  for (const beat of output.beatsInserted.sort(
    (a, b) => a.insertAtSeconds - b.insertAtSeconds,
  )) {
    lines.push(
      `  ${formatTime(beat.insertAtSeconds).padEnd(6)} [${beat.beatType.padEnd(20)}] ${beat.audioEvent.padEnd(15)} "${beat.text.slice(0, 60)}..."`,
    );
  }
  lines.push('─'.repeat(60));
  lines.push(
    `  Open loops: ${output.openLoopBalance.opened} opened, ${output.openLoopBalance.closed} closed`,
  );
  return lines.join('\n');
}
