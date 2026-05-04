/**
 * tests/hinglish-hot-path.test.ts
 *
 * Verifies that the hot TTS path routes to hi-IN-MadhurNeural (Hinglish) by
 * default, and falls back to en-IN-NeerjaNeural only when TTS_VOICE_TRACK=en.
 *
 * CDawgVA P0: the daily Shorts pipeline calls `synthesize` from src/voice/tts.ts.
 * This test ensures the routing function drives voice selection correctly so
 * the renderer always requests the Hindi voice unless explicitly overridden.
 *
 * Strategy: test `resolveVoiceTrack()` (exported for testability) — a pure
 * routing function with no network calls. Each test case passes the track
 * value directly so env-var mutations stay isolated.
 */

import { describe, it, expect } from 'vitest';
import { resolveVoiceTrack } from '../src/voice/tts.js';

const HINGLISH_VOICE = 'hi-IN-MadhurNeural';
const ENGLISH_VOICE  = 'en-IN-NeerjaNeural';

describe('resolveVoiceTrack — hot TTS path routing (CDawgVA P0)', () => {
  it('defaults to Hinglish when TTS_VOICE_TRACK is not set', () => {
    // Simulate the default (env var absent): pass undefined so the function
    // falls back to its own env-var read, which defaults to "hi".
    const saved = process.env['TTS_VOICE_TRACK'];
    delete process.env['TTS_VOICE_TRACK'];
    try {
      const { mode, voice } = resolveVoiceTrack();
      expect(mode).toBe('hi');
      expect(voice).toBe(HINGLISH_VOICE);
    } finally {
      if (saved !== undefined) process.env['TTS_VOICE_TRACK'] = saved;
    }
  });

  it('returns Hinglish voice when TTS_VOICE_TRACK=hi', () => {
    const { mode, voice } = resolveVoiceTrack('hi');
    expect(mode).toBe('hi');
    expect(voice).toBe(HINGLISH_VOICE);
  });

  it('returns English voice when TTS_VOICE_TRACK=en', () => {
    const { mode, voice } = resolveVoiceTrack('en');
    expect(mode).toBe('en');
    expect(voice).toBe(ENGLISH_VOICE);
  });

  it('treats any non-"en" value as Hinglish (safe default)', () => {
    // Unknown or empty values fall through to Hinglish, not English.
    for (const track of ['', 'HI', 'hindi', 'unknown']) {
      const { mode, voice } = resolveVoiceTrack(track);
      expect(mode).toBe('hi');
      expect(voice).toBe(HINGLISH_VOICE);
    }
  });

  it('Hinglish voice is hi-IN-MadhurNeural (warm male, edu-style)', () => {
    // Pin the exact voice ID so a typo in tts.ts is caught immediately.
    const { voice } = resolveVoiceTrack('hi');
    expect(voice).toMatch(/^hi-IN-MadhurNeural$/);
  });

  it('English voice is en-IN-NeerjaNeural (Indian-English fallback)', () => {
    const { voice } = resolveVoiceTrack('en');
    expect(voice).toMatch(/^en-IN-NeerjaNeural$/);
  });
});
