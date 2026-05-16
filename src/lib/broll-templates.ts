/**
 * broll-templates.ts
 *
 * Maps each concept type to the ordered set of b-roll components
 * suitable for that concept. The orchestrator uses this to pick
 * the right visual treatment per segment.
 *
 * ConceptType taxonomy:
 *   DEFINITION — explaining what something is
 *   NUMBER — statistics, metrics, salary, latency
 *   COMPARISON — A vs B, before/after, with/without
 *   PROCESS — step-by-step, how it works, flow
 *   CODE — code example, algorithm, function
 *   WARNING — mistake, anti-pattern, gotcha
 *   EXAMPLE — real-world example, case study
 *   QUESTION — rhetorical question, quiz, hook
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConceptType =
  | 'DEFINITION'
  | 'NUMBER'
  | 'COMPARISON'
  | 'PROCESS'
  | 'CODE'
  | 'WARNING'
  | 'EXAMPLE'
  | 'QUESTION';

export type BrollComponentId =
  | 'KenBurns'
  | 'StatBomb'
  | 'CodeTyper'
  | 'TerminalStream'
  | 'CompareSplit'
  | 'ConceptBox'
  | 'ArrowFlow'
  | 'LoadingBar'
  | 'EmojiSlam'
  | 'MetricCard'
  | 'BeforeAfter'
  | 'WhiteboardDraw'
  | 'LiveLog'
  | 'Diagram';

// NOTE: CharacterCam is NOT in the pool — it's always active as a PiP overlay.
// EmojiSlam is a punctuation overlay, not a full layout — used only as accent.

// ---------------------------------------------------------------------------
// Template Map
// ---------------------------------------------------------------------------

/**
 * For each concept type, ordered list of suitable components.
 * First = most suitable. Orchestrator picks deterministically from this list
 * considering recency to ensure variety.
 */
export const CONCEPT_BROLL_MAP: Record<ConceptType, BrollComponentId[]> = {
  DEFINITION: [
    'ConceptBox',     // A labeled box building up is the classic Kurzgesagt definition move
    'WhiteboardDraw', // Sketch-style introduces concepts naturally
    'Diagram',        // Architecture diagram with callouts
    'ArrowFlow',      // "X connects to Y" definitions
    'KenBurns',       // Pan over a reference image
  ],

  NUMBER: [
    'StatBomb',    // Full-frame number slam — MrBeast/MKBHD payoff-first
    'MetricCard',  // Countup card — softer presentation
    'CompareSplit', // "Before: ₹3 LPA | After: ₹50 LPA"
    'BeforeAfter', // Side-by-side number comparison
    'LoadingBar',  // "You're at 3/5 of your salary gap" progress
  ],

  COMPARISON: [
    'CompareSplit',  // The definitive comparison layout
    'BeforeAfter',   // Slider comparison
    'MetricCard',    // Two metric cards side by side
    'ConceptBox',    // Two boxes with different labels
    'ArrowFlow',     // Two paths with different outcomes
  ],

  PROCESS: [
    'ArrowFlow',     // Steps connected by arrows — the process visualization
    'ConceptBox',    // Boxes building up one by one
    'TerminalStream', // Output streaming = "this is happening in order"
    'WhiteboardDraw', // Sketch the flow
    'Diagram',       // Full architecture diagram
    'LoadingBar',    // Progress through steps
  ],

  CODE: [
    'CodeTyper',     // Line-by-line code reveal
    'BeforeAfter',   // Old code vs new code
    'TerminalStream', // Run the code, see the output
    'LiveLog',       // API calls from the code
    'CompareSplit',  // Buggy code vs fixed code
  ],

  WARNING: [
    'EmojiSlam',     // ✗ slam-in for visual punctuation
    'CompareSplit',  // "Wrong way" vs "Right way"
    'ConceptBox',    // Red/shaking box for the bad pattern
    'StatBomb',      // "This costs ₹10L/day" danger number
    'BeforeAfter',   // Before the fix vs after
  ],

  EXAMPLE: [
    'LiveLog',       // Real API logs = concrete example
    'TerminalStream', // Running the actual command
    'CodeTyper',     // The actual code example
    'Diagram',       // Architecture of the example system
    'MetricCard',    // Example metrics/numbers
    'ArrowFlow',     // Example data flow
  ],

  QUESTION: [
    'LoadingBar',    // "Question 1 of 5" — progress builds suspense
    'StatBomb',      // Surprising stat as the question hook
    'ConceptBox',    // "Which is faster?" — two boxes
    'CompareSplit',  // Direct A vs B question
    'WhiteboardDraw', // Draw the question scenario
  ],
};

// ---------------------------------------------------------------------------
// Component duration guidelines (in frames at 30fps)
// ---------------------------------------------------------------------------

export const COMPONENT_DURATION: Record<BrollComponentId, { min: number; default: number; max: number }> = {
  KenBurns:      { min: 60,  default: 150, max: 300 },
  StatBomb:      { min: 45,  default: 90,  max: 120 },
  CodeTyper:     { min: 90,  default: 150, max: 300 },
  TerminalStream:{ min: 90,  default: 150, max: 240 },
  CompareSplit:  { min: 120, default: 150, max: 210 },
  ConceptBox:    { min: 60,  default: 120, max: 180 },
  ArrowFlow:     { min: 90,  default: 135, max: 180 },
  LoadingBar:    { min: 60,  default: 90,  max: 150 },
  EmojiSlam:     { min: 20,  default: 52,  max: 60  },
  MetricCard:    { min: 90,  default: 120, max: 150 },
  BeforeAfter:   { min: 120, default: 150, max: 210 },
  WhiteboardDraw:{ min: 90,  default: 150, max: 270 },
  LiveLog:       { min: 120, default: 180, max: 300 },
  Diagram:       { min: 120, default: 210, max: 360 },
};

// ---------------------------------------------------------------------------
// Component prop templates
// Default props for each component type to reduce boilerplate
// ---------------------------------------------------------------------------

export const DEFAULT_COMPONENT_PROPS: Partial<Record<BrollComponentId, Record<string, unknown>>> = {
  StatBomb: {
    inFrames: 12,
    holdFrames: 60,
    outFrames: 18,
    color: '#F97316',
  },
  MetricCard: {
    direction: 'neutral',
    countupFrames: 60,
    width: 320,
  },
  ConceptBox: {
    color: '#38BDF8',
    width: 200,
    height: 120,
    splitDelay: 45,
  },
  LoadingBar: {
    fillDuration: 45,
    showPercent: true,
    height: 16,
    fontSize: 36,
  },
  EmojiSlam: {
    inFrames: 12,
    holdFrames: 30,
    outFrames: 10,
    size: 120,
    position: 'center',
  },
  CodeTyper: {
    language: 'typescript',
    charsPerFrame: 3,
    showCursor: true,
    fontSize: 28,
  },
  TerminalStream: {
    framesPerLine: 18,
    charsPerFrame: 8,
    showPrompt: true,
    fontSize: 24,
  },
  LiveLog: {
    framesPerEntry: 20,
    maxVisible: 12,
    fontSize: 20,
  },
  ArrowFlow: {
    framesPerEdge: 45,
    canvasWidth: 1000,
    canvasHeight: 600,
    showPackets: true,
  },
  CompareSplit: {
    goodBad: true,
    inFrames: 30,
  },
  BeforeAfter: {
    revealFrames: 60,
    autoSlide: false,
  },
  WhiteboardDraw: {
    framesPerPath: 45,
    background: '#FFFDF7',
  },
  KenBurns: {
    duration: 150,
  },
  Diagram: {
    kbDuration: 300,
    svgWidth: 1000,
    svgHeight: 600,
  },
};
