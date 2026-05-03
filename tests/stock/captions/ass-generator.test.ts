import { describe, it, expect } from 'vitest';
import { generateAssSubtitles } from '../../../src/stock/captions/ass-generator.js';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(__dirname, '_ass-test-out.ass');

describe('generateAssSubtitles', () => {
  it('creates ASS file with Script Info header', async () => {
    await generateAssSubtitles({
      narration: 'Hello world test',
      wordTimestamps: [
        { word: 'Hello', startMs: 0, endMs: 400 },
        { word: 'world', startMs: 410, endMs: 800 },
        { word: 'test', startMs: 810, endMs: 1100 },
      ],
      outputPath: OUT,
    });
    expect(existsSync(OUT)).toBe(true);
    const content = readFileSync(OUT, 'utf8');
    expect(content).toContain('[Script Info]');
  });

  it('contains MarginV=480 in styles', async () => {
    const content = readFileSync(OUT, 'utf8');
    expect(content).toContain('MarginV');
    expect(content).toContain('480');
  });

  it('has at least one Dialogue line', async () => {
    const content = readFileSync(OUT, 'utf8');
    expect(content).toContain('Dialogue:');
  });

  it('cleans up', () => {
    if (existsSync(OUT)) rmSync(OUT);
  });
});
