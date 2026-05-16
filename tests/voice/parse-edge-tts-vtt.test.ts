import { describe, it, expect } from 'vitest';
import { parseEdgeTtsVtt } from '../../src/voice/tts.js';

/**
 * Pin the WebVTT shape produced by Microsoft Edge-TTS when invoked with
 * `--write-subtitles`. The Karaoke caption layer in render-stock-short.ts
 * depends on this parser to populate `scene.wordTimestamps`, which in
 * turn drives the ASS subtitle rendering. A regression here silently
 * disables karaoke (Ret3 panel highest-leverage retention lever).
 */
describe('parseEdgeTtsVtt', () => {
  it('extracts {word, startMs, endMs} from a typical edge-tts cue', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:00.100 --> 00:00:00.900',
      '<00:00:00.100><c> Hello</c><00:00:00.500><c> world</c>',
      '',
    ].join('\n');
    const out = parseEdgeTtsVtt(vtt);
    expect(out).toEqual([
      { word: 'Hello', startMs: 100, endMs: 500 },
      { word: 'world', startMs: 500, endMs: 900 },
    ]);
  });

  it('handles multiple cues with cumulative offsets', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:00.000 --> 00:00:01.000',
      '<00:00:00.000><c> Bhai</c><00:00:00.400><c> system</c><00:00:00.700><c> design</c>',
      '',
      '00:00:01.000 --> 00:00:02.000',
      '<00:00:01.000><c> in</c><00:00:01.300><c> 60</c><00:00:01.700><c> seconds</c>',
      '',
    ].join('\n');
    const out = parseEdgeTtsVtt(vtt);
    expect(out).toHaveLength(6);
    expect(out[0]).toEqual({ word: 'Bhai', startMs: 0, endMs: 400 });
    expect(out[2]).toEqual({ word: 'design', startMs: 700, endMs: 1000 });
    expect(out[5]).toEqual({ word: 'seconds', startMs: 1700, endMs: 2000 });
  });

  it('returns [] on empty / malformed VTT', () => {
    expect(parseEdgeTtsVtt('')).toEqual([]);
    expect(parseEdgeTtsVtt('WEBVTT\n\nnot a real cue')).toEqual([]);
  });

  it('skips empty <c></c> tokens', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:00.000 --> 00:00:00.500',
      '<00:00:00.000><c> word</c><00:00:00.250><c></c>',
      '',
    ].join('\n');
    const out = parseEdgeTtsVtt(vtt);
    expect(out).toEqual([{ word: 'word', startMs: 0, endMs: 500 }]);
  });
});
