// src/lib/series-tracker.ts
// Daily series tracking system — "Day N of System Design Quiz Challenge"
// Creates FOMO: viewers subscribe because they don't want to miss Day 8.

import * as fs from 'fs';
import * as path from 'path';
import { QUIZ_BANK, FOCUS_TOPICS, type QuizQuestion } from './quiz-content';

const STATE_PATH = path.join(process.cwd(), 'output', '.series-state.json');

export interface SeriesState {
  seriesName: string;       // e.g., "System Design Quiz"
  dayNumber: number;        // auto-increments
  topicRotation: string[];  // cycle through topics
  currentTopicIndex: number; // index into topicRotation
  lastPostedDate: string;   // ISO date string
  history: DayEntry[];      // track what was posted each day
}

export interface DayEntry {
  day: number;
  topic: string;
  quizIndex: number;        // index into QUIZ_BANK
  date: string;
}

/**
 * Default topic rotation — cycles through all topics evenly so the channel
 * feels diverse, not stuck on Kafka. Ordered by search volume / engagement.
 */
const DEFAULT_TOPIC_ROTATION: string[] = [
  'kafka',
  'system-design',
  'microservices',
  'docker',
  'database',
  'kubernetes',
  'redis',
  'api-gateway',
  'rest-api',
  'authentication',
  'load-balancing',
  'cicd',
];

/**
 * Read the series state from disk. Creates a fresh state if missing.
 */
export function getSeriesState(): SeriesState {
  if (fs.existsSync(STATE_PATH)) {
    const raw = fs.readFileSync(STATE_PATH, 'utf-8');
    return JSON.parse(raw) as SeriesState;
  }

  const initial: SeriesState = {
    seriesName: 'System Design Quiz',
    dayNumber: 0,
    topicRotation: [...DEFAULT_TOPIC_ROTATION],
    currentTopicIndex: 0,
    lastPostedDate: '',
    history: [],
  };

  // Ensure output directory exists
  const dir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(STATE_PATH, JSON.stringify(initial, null, 2));
  return initial;
}

/**
 * Advance the series by one day. Increments dayNumber, rotates to next topic,
 * picks the next unused quiz for that topic, and persists to disk.
 */
export function advanceDay(): SeriesState {
  const state = getSeriesState();
  state.dayNumber += 1;

  // Rotate topic
  const topic = state.topicRotation[state.currentTopicIndex % state.topicRotation.length];
  state.currentTopicIndex = (state.currentTopicIndex + 1) % state.topicRotation.length;

  // Find an unused quiz for this topic
  const topicQuizzes = QUIZ_BANK
    .map((q, i) => ({ quiz: q, globalIndex: i }))
    .filter(item => item.quiz.topic === topic);

  const usedIndices = new Set(
    state.history.filter(h => h.topic === topic).map(h => h.quizIndex)
  );

  let quizIndex: number;
  const unused = topicQuizzes.filter(item => !usedIndices.has(item.globalIndex));
  if (unused.length > 0) {
    quizIndex = unused[0].globalIndex;
  } else {
    // All quizzes used — cycle back to first
    quizIndex = topicQuizzes[0]?.globalIndex ?? 0;
  }

  const today = new Date().toISOString().split('T')[0];
  state.lastPostedDate = today;
  state.history.push({
    day: state.dayNumber,
    topic,
    quizIndex,
    date: today,
  });

  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  return state;
}

/**
 * Get the current day's quiz without advancing. Returns null if no days have been posted.
 */
export function getCurrentDayQuiz(): { quiz: QuizQuestion; dayNumber: number; topic: string } | null {
  const state = getSeriesState();
  if (state.history.length === 0) return null;

  const lastEntry = state.history[state.history.length - 1];
  return {
    quiz: QUIZ_BANK[lastEntry.quizIndex],
    dayNumber: lastEntry.day,
    topic: lastEntry.topic,
  };
}

/**
 * Get the next day's quiz (peek without advancing).
 */
export function peekNextDayQuiz(): { quiz: QuizQuestion; dayNumber: number; topic: string } {
  const state = getSeriesState();
  const nextDay = state.dayNumber + 1;
  const topic = state.topicRotation[state.currentTopicIndex % state.topicRotation.length];

  const topicQuizzes = QUIZ_BANK
    .map((q, i) => ({ quiz: q, globalIndex: i }))
    .filter(item => item.quiz.topic === topic);

  const usedIndices = new Set(
    state.history.filter(h => h.topic === topic).map(h => h.quizIndex)
  );

  const unused = topicQuizzes.filter(item => !usedIndices.has(item.globalIndex));
  const quiz = unused.length > 0
    ? unused[0].quiz
    : topicQuizzes[0]?.quiz ?? QUIZ_BANK[0];

  return { quiz, dayNumber: nextDay, topic };
}

/**
 * Generate a series title for YouTube.
 * Format: "Day 7: 90% of devs get Kafka acks WRONG"
 */
export function getSeriesTitle(quiz: QuizQuestion, dayNumber: number): string {
  // Strip emoji from the quiz title for clean series format
  // Strip common emoji characters from title
  // eslint-disable-next-line no-control-regex
  const cleanTitle = quiz.title.replace(/[^\x20-\x7E]/g, '').trim();
  return `Day ${dayNumber}: ${cleanTitle}`;
}

/**
 * Generate a series description for YouTube.
 * Creates FOMO and drives subscriptions.
 */
export function getSeriesDescription(dayNumber: number, totalQuizzes: number): string {
  const topicStats = getTopicStatsFromBank();
  const topicList = Object.entries(topicStats)
    .map(([topic, count]) => `${formatTopicName(topic)} (${count})`)
    .join(', ');

  return [
    `Day ${dayNumber} of the System Design Quiz Challenge`,
    '',
    `${totalQuizzes} questions across ${Object.keys(topicStats).length} topics: ${topicList}`,
    '',
    'New quiz every day. Subscribe so you do not miss Day ' + (dayNumber + 1) + '.',
    '',
    `Can you answer today's question? Drop your answer in the comments BEFORE watching the explanation.`,
    '',
    '#systemdesign #coding #programming #interviewprep #softwareengineering',
  ].join('\n');
}

/**
 * Format topic slug to display name.
 */
export function formatTopicName(topic: string): string {
  const nameMap: Record<string, string> = {
    'kafka': 'Kafka',
    'api-gateway': 'API Gateway',
    'load-balancing': 'Load Balancing',
    'database': 'Database',
    'microservices': 'Microservices',
    'docker': 'Docker',
    'kubernetes': 'Kubernetes',
    'redis': 'Redis',
    'system-design': 'System Design',
    'rest-api': 'REST API',
    'authentication': 'Auth/JWT',
    'cicd': 'CI/CD',
  };
  return nameMap[topic] || topic;
}

/**
 * Get quiz count per topic from the bank.
 */
function getTopicStatsFromBank(): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const q of QUIZ_BANK) {
    stats[q.topic] = (stats[q.topic] || 0) + 1;
  }
  return stats;
}

/**
 * Reset series state (for testing or restart).
 */
export function resetSeriesState(): void {
  if (fs.existsSync(STATE_PATH)) {
    fs.unlinkSync(STATE_PATH);
  }
}

/**
 * Get series progress stats for display.
 */
export function getSeriesProgress(): {
  dayNumber: number;
  totalQuizzes: number;
  topicsCount: number;
  quizzesUsed: number;
  daysUntilRepeat: number;
} {
  const state = getSeriesState();
  const totalQuizzes = QUIZ_BANK.length;
  const quizzesUsed = state.history.length;
  const daysUntilRepeat = totalQuizzes - quizzesUsed;

  return {
    dayNumber: state.dayNumber,
    totalQuizzes,
    topicsCount: new Set(QUIZ_BANK.map(q => q.topic)).size,
    quizzesUsed,
    daysUntilRepeat: Math.max(0, daysUntilRepeat),
  };
}
