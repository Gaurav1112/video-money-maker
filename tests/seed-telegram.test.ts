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

describe('buildSeedMessage — Panel-21 P1-2 hashtag-wall strip', () => {
  it('strips hashtag wall from description before forming caption (snapshot shape)', () => {
    const description = [
      '⚡ Kafka Consumer Groups — most engineers get this wrong',
      'Fail Amazon SDE-2 system design without knowing this.',
      '🔗 Deep-dive: https://guru-sishya.in/kafka',
      '#Kafka #KafkaConsumerGroups #SystemDesign #DSA #FAANG #India #SDE #LLD #OS #DBMS #CodingInterview',
    ].join('\n');

    const msg = buildSeedMessage({
      videoId: 'abc123',
      metadata: {
        topic: 'Kafka Consumer Groups',
        youtube: { title: '🔥 Kafka Consumer Groups in 60s' },
        description,
      },
    });

    // Snapshot shape assertions:
    expect(msg).toContain('🚀 New Short is live!');
    expect(msg).toContain('*🔥 Kafka Consumer Groups in 60s*');
    expect(msg).toContain('https://youtube.com/shorts/abc123');
    // The description body (prose lines) should appear in the caption.
    expect(msg).toContain('⚡ Kafka Consumer Groups');
    // The hashtag wall line should be stripped (ratio = 11/11 = 1.0 > 0.7).
    expect(msg).not.toContain('#Kafka #KafkaConsumerGroups');
  });

  it('does not include description section when metadata has no description', () => {
    const msg = buildSeedMessage({
      videoId: 'v2',
      metadata: { topic: 'Redis', youtube: { title: 'Redis in 60s' } },
    });
    expect(msg).toContain('*Redis in 60s*');
    expect(msg).toContain('https://youtube.com/shorts/v2');
  });

  it('clamps caption to 4096 characters', () => {
    const longDescription = 'word '.repeat(1000);
    const msg = buildSeedMessage({
      videoId: 'v3',
      metadata: { topic: 'Long', description: longDescription },
    });
    expect(msg.length).toBeLessThanOrEqual(4096);
  });

  it('URL line is preserved even when description has hashtag wall', () => {
    const description = [
      '⚡ hook line here',
      'stake line here',
      '🔗 some cta',
      '#a #b #c #d #e #f #g #h #i #j',
    ].join('\n');
    const msg = buildSeedMessage({
      videoId: 'urltest',
      metadata: { description },
    });
    expect(msg).toContain('https://youtube.com/shorts/urltest');
  });
});
