import { describe, it, expect } from 'vitest';
import {
  GRAPH_API_BASE,
  MAX_POLL_ATTEMPTS,
  buildGraphUrl,
  pollDecision,
  resolveCredentials,
} from '../lib/instagram-api';

describe('instagram-api: GRAPH_API_BASE', () => {
  it('points at graph.instagram.com (Instagram-Login API), not graph.facebook.com', () => {
    expect(GRAPH_API_BASE).toBe('https://graph.instagram.com/v21.0');
    expect(GRAPH_API_BASE).not.toContain('graph.facebook.com');
  });
});

describe('instagram-api: buildGraphUrl', () => {
  it('builds a media-container URL on the Instagram base', () => {
    const url = buildGraphUrl('/17841400000000000/media', {
      media_type: 'REELS',
      video_url: 'https://cdn.example.com/v.mp4',
      access_token: 'tok',
    });
    expect(url).toContain('https://graph.instagram.com/v21.0/17841400000000000/media');
    expect(url).toContain('media_type=REELS');
    expect(url).toContain('access_token=tok');
  });

  it('url-encodes query param values', () => {
    const url = buildGraphUrl('/x/media', { caption: 'hello world & more' });
    expect(url).toContain('caption=hello+world+%26+more');
  });

  it('works without params', () => {
    expect(buildGraphUrl('/123')).toBe('https://graph.instagram.com/v21.0/123');
  });
});

describe('instagram-api: pollDecision', () => {
  it('returns finished on FINISHED', () => {
    expect(pollDecision('FINISHED', 0)).toBe('finished');
  });

  it('returns error on ERROR and EXPIRED', () => {
    expect(pollDecision('ERROR', 0)).toBe('error');
    expect(pollDecision('EXPIRED', 0)).toBe('error');
  });

  it('returns wait while still in progress and attempts remain', () => {
    expect(pollDecision('IN_PROGRESS', 0)).toBe('wait');
    expect(pollDecision('IN_PROGRESS', MAX_POLL_ATTEMPTS - 2)).toBe('wait');
  });

  it('returns timeout on the final attempt', () => {
    expect(pollDecision('IN_PROGRESS', MAX_POLL_ATTEMPTS - 1)).toBe('timeout');
  });
});

describe('instagram-api: resolveCredentials', () => {
  it('reads the new IG_USER_ID / IG_ACCESS_TOKEN vars', () => {
    const c = resolveCredentials({ IG_USER_ID: 'u1', IG_ACCESS_TOKEN: 't1' });
    expect(c).toEqual({ igUserId: 'u1', accessToken: 't1' });
  });

  it('falls back to legacy INSTAGRAM_* vars', () => {
    const c = resolveCredentials({
      INSTAGRAM_BUSINESS_ID: 'u2',
      INSTAGRAM_ACCESS_TOKEN: 't2',
    });
    expect(c).toEqual({ igUserId: 'u2', accessToken: 't2' });
  });

  it('throws a clear message when IG_USER_ID is missing', () => {
    expect(() => resolveCredentials({ IG_ACCESS_TOKEN: 't' })).toThrow(/Missing IG_USER_ID/);
  });

  it('throws a clear message when IG_ACCESS_TOKEN is missing', () => {
    expect(() => resolveCredentials({ IG_USER_ID: 'u' })).toThrow(/Missing IG_ACCESS_TOKEN/);
  });
});
