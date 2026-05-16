import { describe, it, expect } from 'vitest';
import { escapeDrawtext } from '../../src/stock/composer.js';

// drawtext filter graph delimiters and special characters are easy to
// accidentally let through. These tests pin the contract so a future
// "simplification" cannot regress us back to a render-time crash on
// real-world topic strings.
describe('escapeDrawtext', () => {
  it('escapes filter-graph delimiters that crash ffmpeg', () => {
    expect(escapeDrawtext('a, b')).toBe('a\\, b');
    expect(escapeDrawtext('a; b')).toBe('a\\; b');
    expect(escapeDrawtext('[load]')).toBe('\\[load\\]');
    expect(escapeDrawtext('a,b;c[d]')).toBe('a\\,b\\;c\\[d\\]');
  });

  it('escapes drawtext-internal specials', () => {
    expect(escapeDrawtext("don't fail")).toBe("don\\'t fail");
    expect(escapeDrawtext('time: 9:30')).toBe('time\\: 9\\:30');
    expect(escapeDrawtext('100% pass')).toBe('100\\% pass');
    expect(escapeDrawtext('back\\slash')).toBe('back\\\\slash');
  });

  it('does not double-escape already-clean text', () => {
    expect(escapeDrawtext('hello world')).toBe('hello world');
    expect(escapeDrawtext('FAANG prep')).toBe('FAANG prep');
  });

  it('handles realistic Hinglish / Devanagari hooks safely', () => {
    expect(escapeDrawtext("Bhai, sirf 3 cheez yaad karo")).toBe('Bhai\\, sirf 3 cheez yaad karo');
    expect(escapeDrawtext('Most engineers don\'t get this')).toBe("Most engineers don\\'t get this");
    // Devanagari should pass through unchanged
    expect(escapeDrawtext('लोड बैलेंसर')).toBe('लोड बैलेंसर');
  });

  it('escapes a topic string the renderer would actually pass', () => {
    // Realistic worst-case: comma + colon + apostrophe + bracket
    const out = escapeDrawtext("[A,B]: don't fail");
    expect(out).toBe("\\[A\\,B\\]\\: don\\'t fail");
  });
});
