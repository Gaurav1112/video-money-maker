/**
 * tests/telegram.test.ts
 *
 * Unit tests for publish-telegram.ts.
 * Uses Jest + ts-jest. node-telegram-bot-api is mocked — no real network calls.
 *
 * Run: npx jest tests/telegram.test.ts
 */

import { buildCaption, publishToTelegram } from '../scripts/publish-telegram';

// ─── Mock node-telegram-bot-api ───────────────────────────────────────────────

const mockSendVideo = jest.fn().mockResolvedValue({ message_id: 1 });
const mockSendPhoto = jest.fn().mockResolvedValue({ message_id: 2 });
const mockSendMessage = jest.fn().mockResolvedValue({ message_id: 3 });

jest.mock('node-telegram-bot-api', () => {
  return jest.fn().mockImplementation(() => ({
    sendVideo: mockSendVideo,
    sendPhoto: mockSendPhoto,
    sendMessage: mockSendMessage,
  }));
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseMetadata = {
  episodeNumber: 42,
  title: 'CAP Theorem Explained',
  youtubeUrl: 'https://youtu.be/abc123',
  thumbnailPath: undefined as string | undefined,
  videoPath: undefined as string | undefined,
  communityPost: {
    teaser:
      'CAP theorem says you can only guarantee two out of Consistency, Availability, and ' +
      'Partition Tolerance in a distributed system. In this video we walk through real-world ' +
      'database trade-offs that every FAANG interview candidate must know.',
    bullets: [
      'What CAP theorem actually means',
      'CP vs AP databases with examples',
      'How to answer CAP questions in system design rounds',
    ],
  },
  tags: ['SystemDesign', 'FAANG', 'InterviewPrep', 'CAPTheorem'],
};

// ─── buildCaption tests ───────────────────────────────────────────────────────

describe('buildCaption', () => {
  it('includes the video title in bold', () => {
    const caption = buildCaption(baseMetadata);
    expect(caption).toContain('CAP Theorem Explained');
  });

  it('includes the YouTube URL', () => {
    const caption = buildCaption(baseMetadata);
    expect(caption).toContain('https://youtu.be/abc123');
  });

  it('includes the guru-sishya.in CTA', () => {
    const caption = buildCaption(baseMetadata);
    expect(caption).toContain('guru');
    expect(caption).toContain('sishya');
  });

  it('includes hashtags', () => {
    const caption = buildCaption(baseMetadata);
    expect(caption).toContain('#SystemDesign');
    expect(caption).toContain('#FAANG');
  });

  it('includes bullet points when provided', () => {
    const caption = buildCaption(baseMetadata);
    expect(caption).toContain('What CAP theorem actually means');
    expect(caption).toContain('CP vs AP databases');
  });

  it('stays within the 1024-byte Telegram caption limit', () => {
    const caption = buildCaption(baseMetadata);
    const bytes = new TextEncoder().encode(caption).length;
    expect(bytes).toBeLessThanOrEqual(1024);
  });

  it('truncates gracefully when teaser is very long', () => {
    const longMeta = {
      ...baseMetadata,
      communityPost: {
        teaser: 'x'.repeat(2000),
        bullets: Array(20).fill('A very long bullet point that takes up space'),
      },
    };
    const caption = buildCaption(longMeta);
    const bytes = new TextEncoder().encode(caption).length;
    expect(bytes).toBeLessThanOrEqual(1024);
  });

  it('uses default hashtags when tags field is absent', () => {
    const metaNoTags = { ...baseMetadata, tags: undefined };
    const caption = buildCaption(metaNoTags);
    expect(caption).toContain('#SystemDesign');
    expect(caption).toContain('#FAANG');
    expect(caption).toContain('#InterviewPrep');
  });

  it('handles missing communityPost gracefully', () => {
    const metaNoCommunity = { ...baseMetadata, communityPost: undefined };
    const caption = buildCaption(metaNoCommunity);
    expect(caption).toContain('CAP Theorem Explained');
    expect(caption).toContain('guru');
  });
});

// ─── publishToTelegram tests ──────────────────────────────────────────────────

describe('publishToTelegram', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      TG_BOT_TOKEN: 'test-token-123',
      TG_CHANNEL_ID: '@GuruSishya_India',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws if TG_BOT_TOKEN is missing', async () => {
    delete process.env.TG_BOT_TOKEN;
    await expect(publishToTelegram(baseMetadata)).rejects.toThrow('TG_BOT_TOKEN');
  });

  it('throws if TG_CHANNEL_ID is missing', async () => {
    delete process.env.TG_CHANNEL_ID;
    await expect(publishToTelegram(baseMetadata)).rejects.toThrow('TG_CHANNEL_ID');
  });

  it('does not make network calls in dry-run mode', async () => {
    await publishToTelegram(baseMetadata, true);
    expect(mockSendVideo).not.toHaveBeenCalled();
    expect(mockSendPhoto).not.toHaveBeenCalled();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('sends text message when no video or thumbnail exists', async () => {
    const meta = { ...baseMetadata, videoPath: undefined, thumbnailPath: undefined };
    await publishToTelegram(meta, false);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith(
      '@GuruSishya_India',
      expect.stringContaining('CAP Theorem Explained'),
      expect.objectContaining({ parse_mode: 'HTML' }),
    );
  });

  it('sends photo when thumbnail exists but video is absent', async () => {
    // Mock fs.existsSync to return true only for thumbnail
    const fs = require('fs');
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((p: string) => {
      return p === '/fake/thumbnail.png';
    });
    jest.spyOn(fs, 'createReadStream').mockReturnValue('stream' as any);

    const meta = { ...baseMetadata, thumbnailPath: '/fake/thumbnail.png', videoPath: undefined };
    await publishToTelegram(meta, false);

    expect(mockSendPhoto).toHaveBeenCalledTimes(1);
    expect(mockSendPhoto).toHaveBeenCalledWith(
      '@GuruSishya_India',
      'stream',
      expect.objectContaining({ parse_mode: 'MarkdownV2' }),
    );
    existsSyncSpy.mockRestore();
  });

  it('sends video directly when file is ≤ 50 MB', async () => {
    const fs = require('fs');
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'statSync').mockReturnValue({ size: 10 * 1024 * 1024 } as any); // 10 MB
    jest.spyOn(fs, 'createReadStream').mockReturnValue('videostream' as any);

    const meta = { ...baseMetadata, videoPath: '/fake/video.mp4' };
    await publishToTelegram(meta, false);

    expect(mockSendVideo).toHaveBeenCalledTimes(1);
    expect(mockSendVideo).toHaveBeenCalledWith(
      '@GuruSishya_India',
      'videostream',
      expect.objectContaining({ parse_mode: 'MarkdownV2' }),
    );
  });

  it('falls back to thumbnail when video is > 50 MB', async () => {
    const fs = require('fs');
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'statSync').mockReturnValue({ size: 60 * 1024 * 1024 } as any); // 60 MB
    jest.spyOn(fs, 'createReadStream').mockReturnValue('thumbstream' as any);

    const meta = {
      ...baseMetadata,
      videoPath: '/fake/video.mp4',
      thumbnailPath: '/fake/thumb.png',
    };
    await publishToTelegram(meta, false);

    expect(mockSendVideo).not.toHaveBeenCalled();
    expect(mockSendPhoto).toHaveBeenCalledTimes(1);
  });

  it('retries on transient failure and eventually succeeds', async () => {
    const fs = require('fs');
    jest.spyOn(fs, 'existsSync').mockReturnValue(false); // forces text-only path

    // Fail twice, succeed on third attempt
    mockSendMessage
      .mockRejectedValueOnce(new Error('ETIMEOUT'))
      .mockRejectedValueOnce(new Error('ETIMEOUT'))
      .mockResolvedValueOnce({ message_id: 99 });

    // Speed up retries in tests
    jest.useFakeTimers();
    const publishPromise = publishToTelegram(baseMetadata, false);
    // Advance all pending timers
    await jest.runAllTimersAsync();
    await publishPromise;

    expect(mockSendMessage).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });
});
