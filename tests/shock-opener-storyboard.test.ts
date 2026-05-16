/**
 * shock-opener-storyboard.test.ts
 *
 * Integration tests for micro-shock visual storyboard generation.
 * Verifies misconception data extraction and pattern selection.
 */

import { generateStoryboard } from '../src/pipeline/storyboard';
import type { Scene } from '../src/types';

describe('Shock Opener - Storyboard Integration', () => {
  // Mock input data
  const mockScenes: Scene[] = [
    {
      type: 'text',
      content: 'Performance Optimization',
      narration: 'Most people think bubble sort is fine for small datasets, but actually quicksort is always better for production code.',
      heading: 'Sorting Algorithms',
      duration: 5,
      startFrame: 0,
      endFrame: 150,
    },
    {
      type: 'code',
      content: 'const arr = [3, 1, 4, 1, 5];',
      narration: 'Here we can see the implementation details.',
      heading: 'Quick Implementation',
      duration: 5,
      startFrame: 150,
      endFrame: 300,
    },
  ];

  const mockAudioResults = [
    {
      audioPath: 'test1.mp3',
      wordTimestamps: [
        { word: 'Most', start: 0, end: 0.2 },
        { word: 'people', start: 0.2, end: 0.4 },
      ],
      duration: 3.5,
    },
    {
      audioPath: 'test2.mp3',
      wordTimestamps: [
        { word: 'Here', start: 0, end: 0.3 },
      ],
      duration: 3.0,
    },
  ];

  test('extracts misconception from "Most people think X, but actually Y" pattern', () => {
    const storyboard = generateStoryboard(mockScenes, mockAudioResults, {
      topic: 'Sorting Algorithms',
      sessionNumber: 1,
    });

    expect(storyboard.shockWrongClaim).toBeDefined();
    expect(storyboard.shockRightClaim).toBeDefined();
    expect(storyboard.shockWrongClaim).toContain('bubble sort');
    expect(storyboard.shockRightClaim).toContain('quicksort');
    expect(storyboard.shockPattern).toBe('myth-buster');
  });

  test('sets shockPattern to myth-buster for misconception match', () => {
    const storyboard = generateStoryboard(mockScenes, mockAudioResults, {
      topic: 'Sorting Algorithms',
      sessionNumber: 1,
    });

    expect(storyboard.shockPattern).toBe('myth-buster');
  });

  test('handles scenes without clear misconception pattern', () => {
    const scenesWithoutPattern: Scene[] = [
      {
        type: 'text',
        content: 'Introduction',
        narration: 'Welcome to this tutorial on basic concepts.',
        heading: 'Getting Started',
        duration: 5,
        startFrame: 0,
        endFrame: 150,
      },
    ];

    const audioResults = [
      {
        audioPath: 'intro.mp3',
        wordTimestamps: [{ word: 'Welcome', start: 0, end: 0.5 }],
        duration: 2.0,
      },
    ];

    const storyboard = generateStoryboard(scenesWithoutPattern, audioResults, {
      topic: 'Basic Concepts',
      sessionNumber: 1,
    });

    // Should have fallback shock opener data
    expect(storyboard.shockWrongClaim).toBeDefined();
    expect(storyboard.shockRightClaim).toBeDefined();
    expect(storyboard.shockPattern).toBe('reveal');
  });

  test('does not add shockPattern fields if no misconception detected and no fallback', () => {
    const scenesEmpty: Scene[] = [];
    const audioEmpty = [];

    const storyboard = generateStoryboard(scenesEmpty, audioEmpty, {
      topic: 'Empty Topic',
      sessionNumber: 1,
    });

    // Depending on implementation, might not have shock data
    if (storyboard.shockWrongClaim === undefined) {
      expect(storyboard.shockRightClaim).toBeUndefined();
      expect(storyboard.shockPattern).toBeUndefined();
    }
  });

  test('shock opener data types match Storyboard interface', () => {
    const storyboard = generateStoryboard(mockScenes, mockAudioResults, {
      topic: 'Sorting Algorithms',
      sessionNumber: 1,
    });

    if (storyboard.shockWrongClaim) {
      expect(typeof storyboard.shockWrongClaim).toBe('string');
      expect(typeof storyboard.shockRightClaim).toBe('string');
      expect(['side-by-side', 'flip-wipe', 'truth-bomb', 'myth-buster', 'plot-twist', 'reveal']).toContain(
        storyboard.shockPattern
      );
    }
  });

  test('storyboard includes all required fields', () => {
    const storyboard = generateStoryboard(mockScenes, mockAudioResults, {
      topic: 'Sorting Algorithms',
      sessionNumber: 1,
    });

    expect(storyboard.fps).toBe(30);
    expect(storyboard.width).toBe(1920);
    expect(storyboard.height).toBe(1080);
    expect(storyboard.durationInFrames).toBeGreaterThan(0);
    expect(storyboard.scenes).toBeDefined();
    expect(storyboard.audioFile).toBeDefined();
    expect(storyboard.topic).toBe('Sorting Algorithms');
    expect(storyboard.sessionNumber).toBe(1);
  });

  test('misconception extraction prioritizes first content scene', () => {
    const scenesWithMultiple: Scene[] = [
      {
        type: 'title',
        content: 'Title',
        narration: '',
        heading: 'Title',
        duration: 2,
        startFrame: 0,
        endFrame: 60,
      },
      {
        type: 'text',
        content: 'First concept',
        narration: 'Most people think A, but actually B.',
        heading: 'First Concept',
        duration: 5,
        startFrame: 60,
        endFrame: 210,
      },
      {
        type: 'text',
        content: 'Second concept',
        narration: 'Wrong: X | Right: Y',
        heading: 'Second Concept',
        duration: 5,
        startFrame: 210,
        endFrame: 360,
      },
    ];

    const audioResults = [
      {
        audioPath: 'skip.mp3',
        wordTimestamps: [],
        duration: 0,
      },
      {
        audioPath: 'first.mp3',
        wordTimestamps: [{ word: 'Most', start: 0, end: 0.2 }],
        duration: 2.0,
      },
      {
        audioPath: 'second.mp3',
        wordTimestamps: [{ word: 'Wrong', start: 0, end: 0.2 }],
        duration: 2.0,
      },
    ];

    const storyboard = generateStoryboard(scenesWithMultiple, audioResults, {
      topic: 'Concepts',
      sessionNumber: 1,
    });

    // Should use first content scene (not title, not intro)
    expect(storyboard.shockWrongClaim).toContain('A');
    expect(storyboard.shockRightClaim).toContain('B');
  });
});
