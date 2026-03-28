import { SyncTimeline } from '../lib/sync-engine';

describe('SyncTimeline', () => {
  const fps = 30;
  const INTRO_FRAMES = 90;

  const sceneOffsets = [0, 2.0];
  const wordTimestamps = [
    [
      { word: 'hello', start: 0.0, end: 0.5 },
      { word: 'world', start: 0.5, end: 1.0 },
      { word: 'test', start: 1.0, end: 1.5 },
    ],
    [
      { word: 'second', start: 0.0, end: 0.8 },
      { word: 'scene', start: 0.8, end: 1.5 },
    ],
  ];

  let timeline: SyncTimeline;

  beforeEach(() => {
    timeline = new SyncTimeline(sceneOffsets, wordTimestamps, fps, INTRO_FRAMES);
  });

  describe('getSyncState', () => {
    it('returns correct word at scene 0, frame 0 (relative)', () => {
      const state = timeline.getSyncState(0, 5);
      expect(state.currentWord).toBe('hello');
      expect(state.wordIndex).toBe(0);
      expect(state.isNarrating).toBe(true);
    });

    it('returns correct word mid-scene', () => {
      const state = timeline.getSyncState(0, 20);
      expect(state.currentWord).toBe('world');
      expect(state.wordIndex).toBe(1);
      expect(state.wordsSpoken).toBe(2);
    });

    it('returns not narrating in gap after last word', () => {
      const state = timeline.getSyncState(0, 50);
      expect(state.isNarrating).toBe(false);
    });

    it('computes sceneProgress correctly', () => {
      const state = timeline.getSyncState(0, 30);
      expect(state.sceneProgress).toBeCloseTo(0.5, 1);
    });
  });

  describe('wordIndexToAbsoluteFrame', () => {
    it('computes absolute frame for scene 0 word 0', () => {
      const frame = timeline.wordIndexToAbsoluteFrame(0, 0);
      expect(frame).toBe(INTRO_FRAMES);
    });

    it('computes absolute frame for scene 1 word 1', () => {
      const frame = timeline.wordIndexToAbsoluteFrame(1, 1);
      expect(frame).toBe(INTRO_FRAMES + 60 + 24);
    });
  });

  describe('isFrameInNarration', () => {
    it('returns true during narration', () => {
      expect(timeline.isFrameInNarration(100)).toBe(true);
    });

    it('returns false in gap between scenes', () => {
      expect(timeline.isFrameInNarration(135)).toBe(false);
    });

    it('returns false before intro ends', () => {
      expect(timeline.isFrameInNarration(50)).toBe(false);
    });
  });

  describe('computePhraseBoundaries', () => {
    it('detects sentence boundaries', () => {
      const narration = 'Hello world. This is a test. Final sentence';
      const boundaries = SyncTimeline.computePhraseBoundaries(narration);
      expect(boundaries).toContain(1);
      expect(boundaries).toContain(5);
    });
  });
});
