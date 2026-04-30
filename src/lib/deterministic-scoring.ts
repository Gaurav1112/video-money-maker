/**
 * Deterministic virality scoring for clips.
 * Scores based on: hook quality (30%), pacing (25%), payoff clarity (25%),
 * CTA presence (10%), visual interest (10%).
 * Same clip always gets the same score.
 */

import { Scene } from '../types';
import { AudioAnalysis } from './audio-intelligence';

export interface ViralityScore {
  total: number;
  hookQuality: number;
  pacing: number;
  payoff: number;
  cta: number;
  visual: number;
  breakdown: string;
}

function scoreHook(firstScene: Scene): number {
  const text = (firstScene.narration || '').toLowerCase();
  const firstWords = text.split(' ').slice(0, 10).join(' ');
  let score = 0;

  if (firstWords.includes('?')) score += 10;
  if (/\d+/.test(firstWords)) score += 8;
  const powerWords = ['secret', 'never', 'always', 'wrong', 'mistake', 'why', 'how', 'what'];
  if (powerWords.some(w => firstWords.includes(w))) score += 7;
  const firstSentence = text.split(/[.!?]/)[0] || '';
  if (firstSentence.split(' ').length <= 15) score += 5;

  return Math.min(30, score);
}

function scorePacing(analysis: AudioAnalysis): number {
  let score = 0;

  if (analysis.wordsPerMinute >= 155 && analysis.wordsPerMinute <= 205) score += 12;
  else if (analysis.wordsPerMinute >= 130 && analysis.wordsPerMinute <= 230) score += 6;

  const energyLevels = new Set(analysis.energy.map(e => e.energy));
  score += Math.min(energyLevels.size * 3, 9);

  if (analysis.emphasis.length >= 3) score += 4;

  return Math.min(25, score);
}

function scorePayoff(lastScene: Scene): number {
  const text = (lastScene.narration || '').toLowerCase();
  let score = 0;

  const payoffSignals = ['remember', 'key takeaway', 'in summary', 'the answer is', 'so the trick is',
    'this is why', 'that\'s how', 'and that\'s', 'now you know'];
  if (payoffSignals.some(s => text.includes(s))) score += 12;

  if (lastScene.type === 'summary') score += 10;
  if (lastScene.type === 'review') score += 8;
  if (lastScene.type === 'code') score += 5;

  if (text.trim().match(/[.!?]$/)) score += 3;

  return Math.min(25, score);
}

function scoreCTA(scenes: Scene[]): number {
  const allText = scenes.map(s => s.narration || '').join(' ').toLowerCase();
  let score = 0;

  if (allText.includes('subscribe') || allText.includes('follow')) score += 4;
  if (allText.includes('save') || allText.includes('bookmark')) score += 3;
  if (allText.includes('comment') || allText.includes('share')) score += 3;

  return Math.min(10, score);
}

function scoreVisual(scenes: Scene[]): number {
  let score = 0;

  const types = new Set(scenes.map(s => s.type));
  score += Math.min(types.size * 2, 6);

  if (scenes.some(s => s.type === 'code')) score += 2;
  if (scenes.some(s => s.type === 'diagram' || s.type === 'table')) score += 2;

  return Math.min(10, score);
}

export function scoreClip(scenes: Scene[], analyses: AudioAnalysis[]): ViralityScore {
  if (scenes.length === 0) {
    return { total: 0, hookQuality: 0, pacing: 0, payoff: 0, cta: 0, visual: 0, breakdown: 'Empty clip' };
  }

  const hookQuality = scoreHook(scenes[0]);
  const pacing = analyses.length > 0
    ? Math.round(analyses.reduce((sum, a) => sum + scorePacing(a), 0) / analyses.length)
    : 10;
  const payoff = scorePayoff(scenes[scenes.length - 1]);
  const cta = scoreCTA(scenes);
  const visual = scoreVisual(scenes);
  const total = hookQuality + pacing + payoff + cta + visual;

  const parts: string[] = [];
  if (hookQuality >= 20) parts.push('Strong hook');
  else if (hookQuality >= 10) parts.push('Decent hook');
  else parts.push('Weak hook');
  if (pacing >= 18) parts.push('great pacing');
  if (payoff >= 18) parts.push('clear payoff');
  if (cta >= 5) parts.push('has CTA');

  return { total, hookQuality, pacing, payoff, cta, visual, breakdown: parts.join(', ') };
}
