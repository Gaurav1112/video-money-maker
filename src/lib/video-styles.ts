// src/lib/video-styles.ts
import type { SceneType, VideoFormat } from '../types';

export type CaptionMode = 'fireship' | 'hormozi';
export type SfxDensity = 'sparse' | 'dense';
export type TransitionType = 'fade' | 'slide-right' | 'slide-left' | 'slide-bottom' | 'slide-top' | 'wipe-left' | 'wipe-right' | 'clockWipe' | 'iris' | 'flip';

export interface VideoStyle {
  id: 'educational' | 'viral' | 'vertical';
  ttsRate: Record<SceneType, string>;
  captionMode: CaptionMode;
  zoomInterval: [number, number];
  zoomScale: number;
  transitionPool: TransitionType[];
  bgmVolume: number;
  bgmChangeInterval: number;
  sfxDensity: SfxDensity;
  transitionDuration: number;
  dramaticTransitionDuration: number;
  // ── Pacing constraints (Fireship-level density) ──
  /** Max seconds a text scene should last before being split. 0 = no limit. */
  maxTextSceneDurationSeconds: number;
  /** Max bullets shown simultaneously per text scene. Fewer = faster pacing. */
  maxBulletsPerScene: number;
  /** Target minimum cuts per minute. Used to warn when pacing is too slow. */
  minCutsPerMinute: number;
}

const EDUCATIONAL: VideoStyle = {
  id: 'educational',
  ttsRate: {
    title: '+40%',
    text: '+30%',
    code: '+15%',
    diagram: '+25%',
    table: '+30%',
    interview: '+35%',
    review: '+30%',
    summary: '+35%',
  },
  captionMode: 'fireship',
  zoomInterval: [3, 5],
  zoomScale: 1.15,
  transitionPool: ['fade', 'slide-right', 'wipe-left', 'slide-bottom', 'fade', 'slide-left', 'wipe-right', 'slide-top'],
  bgmVolume: 0.12,
  bgmChangeInterval: 120,
  sfxDensity: 'sparse',
  transitionDuration: 8,
  dramaticTransitionDuration: 15,
  maxTextSceneDurationSeconds: 0, // no limit for long-form
  maxBulletsPerScene: 6,
  minCutsPerMinute: 6,
};

const VIRAL: VideoStyle = {
  id: 'viral',
  ttsRate: {
    title: '+45%',
    text: '+35%',
    code: '+20%',
    diagram: '+30%',
    table: '+32%',
    interview: '+40%',
    review: '+35%',
    summary: '+40%',
  },
  captionMode: 'hormozi',
  zoomInterval: [1.5, 3],
  zoomScale: 1.25,
  transitionPool: ['fade', 'slide-right', 'wipe-left', 'iris'],
  bgmVolume: 0.15,
  bgmChangeInterval: 60,
  sfxDensity: 'dense',
  transitionDuration: 3,
  dramaticTransitionDuration: 8,
  maxTextSceneDurationSeconds: 8,
  maxBulletsPerScene: 2,
  minCutsPerMinute: 15,
};

const VERTICAL: VideoStyle = {
  id: 'vertical',
  ttsRate: {
    title: '+50%',      // was +40% — grab attention instantly
    text: '+42%',       // was +38% — Fireship pace: ~200 WPM effective
    code: '+25%',       // was +22% — still needs comprehension time
    diagram: '+35%',    // was +32%
    table: '+38%',      // was +35%
    interview: '+45%',  // was +42%
    review: '+42%',     // was +38%
    summary: '+48%',    // was +45% — rapid recap
  },
  captionMode: 'hormozi',
  zoomInterval: [1, 2.5],  // was [1.5,3] — more frequent stimulus
  zoomScale: 1.12,
  transitionPool: ['fade', 'slide-bottom', 'wipe-left', 'fade'],
  bgmVolume: 0.18,         // was 0.10 — audible on phone speakers
  bgmChangeInterval: 45,   // was 90 — rotate tracks faster
  sfxDensity: 'dense',     // was 'sparse' — 3 SFX per scene, not 1
  transitionDuration: 3,   // was 4 — Fireship uses ~2-3 frame cuts
  dramaticTransitionDuration: 6, // was 8 — still snappy
  maxTextSceneDurationSeconds: 6, // HARD LIMIT: split any text scene >6s
  maxBulletsPerScene: 2,          // ONE concept per scene, max 2 bullets
  minCutsPerMinute: 18,           // Fireship target: 18-25 cuts/min
};

const DRAMATIC_PAIRS: Array<[string | null, string]> = [
  ['title', '*'],
  [null, 'review'],
  ['review', 'summary'],
];

export function getTransitionDuration(
  prevSceneType: SceneType | null,
  currSceneType: SceneType,
  style: VideoStyle,
): number {
  for (const [prev, curr] of DRAMATIC_PAIRS) {
    if ((prev === null || prev === prevSceneType) && (curr === '*' || curr === currSceneType)) {
      return style.dramaticTransitionDuration;
    }
  }
  return style.transitionDuration;
}

const STYLES: Record<string, VideoStyle> = {
  educational: EDUCATIONAL,
  viral: VIRAL,
  vertical: VERTICAL,
};

export function getStyleForFormat(format: VideoFormat): VideoStyle {
  if (format === 'vertical') return STYLES.vertical;
  return format === 'long' ? STYLES.educational : STYLES.viral;
}

export function getStyle(id: 'educational' | 'viral' | 'vertical'): VideoStyle {
  return STYLES[id];
}
