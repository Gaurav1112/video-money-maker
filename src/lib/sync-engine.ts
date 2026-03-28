import type { WordTimestamp } from '../types';

export class SyncTimeline {
  private sceneOffsets: number[];
  private wordTimestamps: WordTimestamp[][];
  private fps: number;
  private introFrames: number;
  private sceneDurationsInSeconds: number[];

  constructor(
    sceneOffsets: number[],
    wordTimestamps: WordTimestamp[][],
    fps: number,
    introFrames: number,
  ) {
    this.sceneOffsets = sceneOffsets;
    this.wordTimestamps = wordTimestamps;
    this.fps = fps;
    this.introFrames = introFrames;

    this.sceneDurationsInSeconds = sceneOffsets.map((offset, i) => {
      if (i < sceneOffsets.length - 1) {
        return sceneOffsets[i + 1] - offset;
      }
      const lastWords = wordTimestamps[i];
      if (lastWords && lastWords.length > 0) {
        return lastWords[lastWords.length - 1].end + 1.0;
      }
      return 8;
    });
  }

  getSyncState(sceneIndex: number, relativeFrame: number): {
    currentWord: string;
    wordIndex: number;
    sceneProgress: number;
    phraseBoundaries: number[];
    isNarrating: boolean;
    wordsSpoken: number;
  } {
    const words = this.wordTimestamps[sceneIndex] || [];
    const sceneDuration = this.sceneDurationsInSeconds[sceneIndex] || 8;
    const currentTimeInScene = relativeFrame / this.fps;

    let currentWord = '';
    let wordIndex = -1;
    let wordsSpoken = 0;
    let isNarrating = false;

    for (let i = 0; i < words.length; i++) {
      if (currentTimeInScene >= words[i].start && currentTimeInScene < words[i].end) {
        currentWord = words[i].word;
        wordIndex = i;
        isNarrating = true;
      }
      if (currentTimeInScene >= words[i].start) {
        wordsSpoken = i + 1;
      }
    }

    if (!isNarrating && words.length > 0) {
      const lastWord = words[words.length - 1];
      if (currentTimeInScene < lastWord.end && currentTimeInScene >= words[0].start) {
        isNarrating = true;
        for (let i = words.length - 1; i >= 0; i--) {
          if (currentTimeInScene >= words[i].start) {
            wordIndex = i;
            currentWord = words[i].word;
            break;
          }
        }
      }
    }

    const sceneProgress = Math.min(1, currentTimeInScene / sceneDuration);
    const fullNarration = words.map(w => w.word).join(' ');
    const phraseBoundaries = SyncTimeline.computePhraseBoundaries(fullNarration);

    return {
      currentWord,
      wordIndex: Math.max(0, wordIndex),
      sceneProgress,
      phraseBoundaries,
      isNarrating,
      wordsSpoken,
    };
  }

  wordIndexToAbsoluteFrame(sceneIndex: number, wordIndex: number): number {
    const sceneOffset = this.sceneOffsets[sceneIndex] || 0;
    const words = this.wordTimestamps[sceneIndex] || [];
    const wordStart = words[wordIndex]?.start || 0;
    return this.introFrames + Math.round((sceneOffset + wordStart) * this.fps);
  }

  isFrameInNarration(absoluteFrame: number): boolean {
    if (absoluteFrame < this.introFrames) return false;

    const timeInMaster = (absoluteFrame - this.introFrames) / this.fps;

    for (let i = 0; i < this.sceneOffsets.length; i++) {
      const sceneStart = this.sceneOffsets[i];
      const words = this.wordTimestamps[i] || [];
      if (words.length === 0) continue;

      const firstWordAbsStart = sceneStart + words[0].start;
      const lastWordAbsEnd = sceneStart + words[words.length - 1].end;

      if (timeInMaster >= firstWordAbsStart && timeInMaster < lastWordAbsEnd) {
        return true;
      }
    }

    return false;
  }

  getSceneDurationFrames(sceneIndex: number): number {
    return Math.round(this.sceneDurationsInSeconds[sceneIndex] * this.fps);
  }

  static computePhraseBoundaries(narration: string): number[] {
    const words = narration.split(/\s+/).filter(w => w.length > 0);
    const boundaries: number[] = [];

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (/[.!?;:]$/.test(word)) {
        boundaries.push(i);
      }
      if (
        word.endsWith(',') &&
        i + 1 < words.length &&
        /^(and|but|or)$/i.test(words[i + 1])
      ) {
        boundaries.push(i);
      }
    }

    return boundaries;
  }
}
