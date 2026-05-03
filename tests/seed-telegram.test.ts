/**
 * B2 — Telegram seed broadcast tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSeedMessage, seedTelegram } from '../scripts/seed-telegram';

beforeEach(() => {
  delete process.env.TG_BOT_TOKEN;
  delete process.env.TG_CHANNEL_ID;
});

describe('buildSeedMessage', () => {
  it('includes the youtube.com/shorts URL with videoId', () => {
    const msg = buildSeedMessage({
      videoId: 'abc123XYZ_-',
      metadata: { topic: 'Caching' },
    });
    expect(msg).toContain('https://youtube.com/shorts/abc123XYZ_-');
  });

  it('uses the YouTube title when present', () => {
    const msg = buildSeedMessage({
      videoId: 'v1',
      metadata: { topic: 'Caching', youtube: { title: '🔥 Caching Explained in 60s' } },
    });
    expect(msg).toContain('🔥 Caching Explained in 60s');
  });

  it('falls back gracefully when metadata is null', () => {
    const msg = buildSeedMessage({ videoId: 'v1', metadata: null });
    expect(msg).toContain('today');
    expect(msg).toContain('https://youtube.com/shorts/v1');
  });
});

describe('seedTelegram', () => {
  it('skips with reason="no-token" when TG_BOT_TOKEN is missing', async () => {
    const result = await seedTelegram({ videoId: 'v1', metadata: null });
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('no-token');
  });

  it('skips with reason="no-channel" when TG_CHANNEL_ID is missing', async () => {
    process.env.TG_BOT_TOKEN = 'fake-token';
    const result = await seedTelegram({ videoId: 'v1', metadata: null });
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('no-channel');
  });

  it('calls the Telegram sender with token, channel, and templated text', async () => {
    const send = vi.fn().mockResolvedValue({ ok: true });
    const result = await seedTelegram({
      videoId: 'abc',
      metadata: { topic: 'Kafka' },
      botToken: 'tok123',
      channelId: '@chan',
      send,
    });
    expect(result.skipped).toBe(false);
    expect(send).toHaveBeenCalledOnce();
    const [token, channel, text] = send.mock.calls[0];
    expect(token).toBe('tok123');
    expect(channel).toBe('@chan');
    expect(text).toContain('Kafka');
    expect(text).toContain('https://youtube.com/shorts/abc');
  });

  it('throws on Telegram API failure so the workflow can surface it', async () => {
    const send = vi.fn().mockResolvedValue({ ok: false, error: 'chat not found' });
    await expect(
      seedTelegram({
        videoId: 'v1',
        metadata: null,
        botToken: 't',
        channelId: '@c',
        send,
      }),
    ).rejects.toThrow(/chat not found/);
  });
});
