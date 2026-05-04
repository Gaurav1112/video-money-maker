/**
 * Panel-21 P1-2 — strip-tag-wall utility tests
 */
import { describe, it, expect } from 'vitest';
import { stripTagWall } from '../../src/services/strip-tag-wall';

describe('stripTagWall', () => {
  it('returns empty string for empty input', () => {
    expect(stripTagWall('')).toBe('');
  });

  it('preserves clean prose unchanged', () => {
    const prose = [
      '⚡ Kafka Consumer Groups explained in 60s',
      '💼 FAANG India SDE band: ₹14L (entry) → ₹26L (mid) → ₹45L+ (senior)',
      '🔗 Full deep-dive + practice: https://guru-sishya.in/kafka',
      '📘 Instant FREE 80-Q FAANG cheatsheet → https://guru-sishya.in/free',
    ].join('\n');
    expect(stripTagWall(prose)).toBe(prose);
  });

  it('strips a bottom hashtag wall (B28 description shape)', () => {
    // Mimic the real description tail: hook + stake + long hashtag wall
    const desc = [
      '⚡ Kafka Consumer Groups — most engineers get this wrong',
      'Fail Amazon SDE-2 system design without knowing this.',
      '🔗 Deep-dive: https://guru-sishya.in/kafka',
      '#KafkaConsumerGroups #Kafka #SystemDesign #DSA #FAANG #India #SDE #LLD #OS #DBMS #CodingInterview',
    ].join('\n');

    const result = stripTagWall(desc);
    // The hashtag-wall line (line index 3, ratio = 11/11 = 1.0) should be dropped.
    expect(result).not.toContain('#KafkaConsumerGroups');
    // First 3 lines should be intact.
    expect(result).toContain('⚡ Kafka Consumer Groups');
    expect(result).toContain('Fail Amazon SDE-2');
    expect(result).toContain('🔗 Deep-dive');
  });

  it('preserves the first 3 lines even if hashtag-heavy (default preserveTopN=3)', () => {
    const text = [
      '#one #two #three #four #five', // line 0 — all tags, preserved
      '#six #seven #eight #nine #ten', // line 1 — all tags, preserved
      '#a #b #c #d #e',               // line 2 — all tags, preserved
      '#x #y #z #p #q',               // line 3 — all tags, should be dropped
    ].join('\n');

    const result = stripTagWall(text);
    const lines = result.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('#one #two #three #four #five');
    expect(lines[1]).toBe('#six #seven #eight #nine #ten');
    expect(lines[2]).toBe('#a #b #c #d #e');
  });

  it('with preserveTopN=0, strips ALL high-ratio lines from the start', () => {
    const text = [
      '#one #two #three #four #five', // ratio = 1.0, dropped
      'Clean intro line with words',   // ratio = 0.0, kept
      '#x #y #z #p #q',               // ratio = 1.0, dropped
    ].join('\n');

    const result = stripTagWall(text, { preserveTopN: 0 });
    expect(result).toBe('Clean intro line with words');
  });

  it('keeps a line with exactly 70% tag ratio (boundary: > 0.7 strips, == 0.7 keeps)', () => {
    // 7 tokens, 7*0.7 = 4.9 → 5 tags in 7 tokens? No: need exactly 0.7 ratio.
    // 10 tokens, 7 hashtags → ratio = 7/10 = 0.7 exactly → kept
    const line = '#a #b #c #d #e #f #g word1 word2 word3';
    const text = ['first line', 'second line', 'third line', line].join('\n');
    const result = stripTagWall(text);
    expect(result).toContain(line);
  });

  it('drops a line with 71% tag ratio (just over the boundary)', () => {
    // 7 tags out of 9 tokens: 7/9 ≈ 0.778 > 0.7 → dropped
    // line index >= 3, so not in the protected window
    const line = '#a #b #c #d #e #f #g word1 word2';
    const text = ['first line', 'second line', 'third line', line].join('\n');
    const result = stripTagWall(text);
    expect(result).not.toContain('#a #b #c #d #e #f #g word1 word2');
  });

  it('keeps pure-emoji lines (emoji counted as non-tag tokens)', () => {
    const text = [
      'Line one',
      'Line two',
      'Line three',
      '🔥🚀💡', // pure emoji — no hashtag tokens → ratio = 0 → kept
    ].join('\n');
    const result = stripTagWall(text);
    expect(result).toContain('🔥🚀💡');
  });

  it('keeps blank lines (0 tokens → always kept)', () => {
    const text = ['first', 'second', 'third', '', '#a #b #c #d #e'].join('\n');
    const result = stripTagWall(text);
    // The blank line (index 3) is preserved; the hashtag wall (index 4) is stripped.
    expect(result).toContain('third');
    // Result ends with the blank line separator (trailing newline after join).
    expect(result.endsWith('\n')).toBe(true);
    // Hashtag wall must be gone.
    expect(result).not.toContain('#a');
  });
});
