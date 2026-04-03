// src/lib/video-styles.ts
import type { SceneType, VideoFormat } from '../types';

export type CaptionMode = 'fireship' | 'hormozi';
export type SfxDensity = 'sparse' | 'dense';
export type TransitionType = 'fade' | 'slide-right' | 'slide-left' | 'slide-bottom' | 'slide-top' | 'wipe-left' | 'wipe-right' | 'clockWipe' | 'iris' | 'flip';

export interface VideoStyle {
  id: 'educational' | 'viral';
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
}

const EDUCATIONAL: VideoStyle = {
  id: 'educational',
  ttsRate: {
    title: '+20%',
    text: '+5%',
    code: '-8%',
    diagram: '+0%',
    table: '+5%',
    interview: '+10%',
    review: '+8%',
    summary: '+15%',
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
};

const VIRAL: VideoStyle = {
  id: 'viral',
  ttsRate: {
    title: '+25%',
    text: '+12%',
    code: '+0%',
    diagram: '+5%',
    table: '+8%',
    interview: '+15%',
    review: '+12%',
    summary: '+20%',
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
};

export function getStyleForFormat(format: VideoFormat): VideoStyle {
  return format === 'long' ? STYLES.educational : STYLES.viral;
}

export function getStyle(id: 'educational' | 'viral'): VideoStyle {
  return STYLES[id];
}
