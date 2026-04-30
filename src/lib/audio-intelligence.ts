/**
 * Deterministic audio intelligence derived from word timestamps and text content.
 * No ML models — all analysis is rule-based and fully reproducible.
 * Same input always produces the same output.
 */

import { WordTimestamp, Scene } from '../types';

export interface EnergySegment {
  startTime: number;
  endTime: number;
  energy: 'low' | 'medium' | 'high' | 'peak';
  reason: string;
}

export interface EmphasisPoint {
  time: number;
  word: string;
  type: 'question' | 'exclamation' | 'keyword' | 'number' | 'pause' | 'contrast';
  intensity: number;
}

export interface PausePoint {
  time: number;
  duration: number;
  isSentenceBoundary: boolean;
  isTopicTransition: boolean;
}

export interface AudioAnalysis {
  energy: EnergySegment[];
  emphasis: EmphasisPoint[];
  pauses: PausePoint[];
  wordsPerMinute: number;
  avgPauseDuration: number;
  engagementScore: number;
}

function computeWPM(timestamps: WordTimestamp[]): number {
  if (timestamps.length < 2) return 150;
  const firstStart = timestamps[0].start;
  const lastEnd = timestamps[timestamps.length - 1].end;
  const durationMinutes = (lastEnd - firstStart) / 60;
  if (durationMinutes <= 0) return 150;
  return Math.round(timestamps.length / durationMinutes);
}

const TRANSITION_WORDS = new Set(['now', 'next', 'however', 'but', 'instead', 'finally', 'also', 'remember']);

function detectPauses(timestamps: WordTimestamp[]): PausePoint[] {
  const pauses: PausePoint[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    const gap = timestamps[i].start - timestamps[i - 1].end;
    if (gap >= 0.3) {
      const prevWord = timestamps[i - 1].word;
      const isSentenceBoundary = gap >= 0.6 ||
        prevWord.endsWith('.') ||
        prevWord.endsWith('?') ||
        prevWord.endsWith('!');

      const cleanPrev = prevWord.toLowerCase().replace(/[^a-z]/g, '');
      const isTopicTransition = isSentenceBoundary && TRANSITION_WORDS.has(cleanPrev);

      pauses.push({ time: timestamps[i - 1].end, duration: gap, isSentenceBoundary, isTopicTransition });
    }
  }
  return pauses;
}

const HIGH_ENERGY_KEYWORDS = new Set([
  'important', 'critical', 'never', 'always', 'must', 'key', 'secret',
  'wrong', 'mistake', 'fail', 'problem', 'solution', 'trick', 'hack',
  'powerful', 'amazing', 'incredible', 'exactly', 'remember', 'crucial',
]);

const CONTRAST_KEYWORDS = new Set([
  'but', 'however', 'instead', 'actually', 'wrong', 'not', 'versus',
  'difference', 'unlike', 'whereas', 'rather', 'opposite',
]);

function detectEmphasis(timestamps: WordTimestamp[]): EmphasisPoint[] {
  const points: EmphasisPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const cleanWord = ts.word.toLowerCase().replace(/[^a-z0-9]/g, '');
    const rawWord = ts.word;

    if (rawWord.endsWith('?')) {
      points.push({ time: ts.start, word: rawWord, type: 'question', intensity: 0.8 });
    } else if (rawWord.endsWith('!')) {
      points.push({ time: ts.start, word: rawWord, type: 'exclamation', intensity: 0.9 });
    } else if (rawWord === rawWord.toUpperCase() && rawWord.length > 2 && /[A-Z]/.test(rawWord)) {
      points.push({ time: ts.start, word: rawWord, type: 'keyword', intensity: 1.0 });
    } else if (/\d/.test(rawWord) && rawWord.length > 1) {
      points.push({ time: ts.start, word: rawWord, type: 'number', intensity: 0.7 });
    } else if (HIGH_ENERGY_KEYWORDS.has(cleanWord)) {
      points.push({ time: ts.start, word: rawWord, type: 'keyword', intensity: 0.75 });
    } else if (CONTRAST_KEYWORDS.has(cleanWord)) {
      points.push({ time: ts.start, word: rawWord, type: 'contrast', intensity: 0.65 });
    }

    if (i > 0) {
      const gap = ts.start - timestamps[i - 1].end;
      if (gap >= 0.4 && gap < 1.5) {
        points.push({ time: ts.start, word: rawWord, type: 'pause', intensity: 0.6 });
      }
    }
  }
  return points;
}

function computeEnergy(timestamps: WordTimestamp[], emphasis: EmphasisPoint[]): EnergySegment[] {
  if (timestamps.length === 0) return [];
  const segmentDuration = 3;
  const totalDuration = timestamps[timestamps.length - 1].end;
  const segments: EnergySegment[] = [];

  for (let t = 0; t < totalDuration; t += segmentDuration) {
    const segEnd = Math.min(t + segmentDuration, totalDuration);
    const wordsInSegment = timestamps.filter(w => w.start >= t && w.start < segEnd).length;
    const wpm = (wordsInSegment / segmentDuration) * 60;
    const emphasisInSegment = emphasis.filter(e => e.time >= t && e.time < segEnd);
    const emphasisDensity = emphasisInSegment.length / segmentDuration;

    let energy: EnergySegment['energy'];
    let reason: string;

    if (emphasisDensity >= 2 || wpm > 200) {
      energy = 'peak';
      reason = emphasisDensity >= 2 ? 'high emphasis density' : 'rapid speech';
    } else if (emphasisDensity >= 1 || wpm > 170) {
      energy = 'high';
      reason = emphasisDensity >= 1 ? 'multiple emphasis points' : 'fast pacing';
    } else if (wpm > 120) {
      energy = 'medium';
      reason = 'normal pacing';
    } else {
      energy = 'low';
      reason = wpm < 80 ? 'slow/pause heavy' : 'calm delivery';
    }

    segments.push({ startTime: t, endTime: segEnd, energy, reason });
  }
  return segments;
}

function computeEngagementScore(
  narration: string, wpm: number, emphasis: EmphasisPoint[], pauses: PausePoint[], sceneType: string,
): number {
  let score = 50;
  const firstSentence = narration.split(/[.!?]/)[0] || '';
  if (firstSentence.includes('?')) score += 12;
  if (/\d/.test(firstSentence)) score += 8;
  if (HIGH_ENERGY_KEYWORDS.has(firstSentence.split(' ')[0]?.toLowerCase())) score += 5;

  if (wpm >= 160 && wpm <= 200) score += 10;
  else if (wpm >= 140 && wpm <= 220) score += 5;
  else score -= 5;

  const duration = narration.length / 15;
  const idealEmphasis = duration / 5;
  const emphasisRatio = emphasis.length / Math.max(idealEmphasis, 1);
  if (emphasisRatio >= 0.8 && emphasisRatio <= 1.5) score += 8;

  score += Math.min(emphasis.filter(e => e.type === 'contrast').length * 3, 9);
  score += Math.min(emphasis.filter(e => e.type === 'question').length * 4, 12);

  const sentencePauses = pauses.filter(p => p.isSentenceBoundary).length;
  if (sentencePauses >= 2 && sentencePauses <= 8) score += 5;

  if (sceneType === 'interview') score += 5;
  if (sceneType === 'code') score += 3;
  if (sceneType === 'review') score += 4;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function analyzeScene(scene: Scene): AudioAnalysis {
  const timestamps = scene.wordTimestamps || [];
  const narration = scene.narration || '';
  const wpm = computeWPM(timestamps);
  const pauses = detectPauses(timestamps);
  const emphasis = detectEmphasis(timestamps);
  const energy = computeEnergy(timestamps, emphasis);
  const engagementScore = computeEngagementScore(narration, wpm, emphasis, pauses, scene.type);
  const avgPauseDuration = pauses.length > 0 ? pauses.reduce((sum, p) => sum + p.duration, 0) / pauses.length : 0;

  return { energy, emphasis, pauses, wordsPerMinute: wpm, avgPauseDuration, engagementScore };
}

export function analyzeStoryboard(scenes: Scene[]): {
  sceneAnalyses: AudioAnalysis[];
  bestClipScenes: number[];
  overallEngagement: number;
} {
  const sceneAnalyses = scenes.map(analyzeScene);
  const ranked = sceneAnalyses
    .map((a, i) => ({ index: i, score: a.engagementScore }))
    .sort((a, b) => b.score - a.score);
  const bestClipScenes = ranked.slice(0, 5).map(r => r.index).sort((a, b) => a - b);
  const overallEngagement = Math.round(
    sceneAnalyses.reduce((sum, a) => sum + a.engagementScore, 0) / Math.max(sceneAnalyses.length, 1)
  );

  return { sceneAnalyses, bestClipScenes, overallEngagement };
}
