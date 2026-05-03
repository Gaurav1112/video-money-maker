/**
 * tests/publishing/cookie-refresh.test.ts
 *
 * RED: OAuth token management in upload-youtube.ts does not check token
 *      expiry before uploading. A stale token causes a silent 401 drop.
 *
 * GREEN after: Add needsTokenRefresh(token) and refreshToken(oauth2Client)
 *              utility functions; call refreshToken if needsTokenRefresh.
 */
import { describe, it, expect, vi } from 'vitest';

let needsTokenRefresh: (token: { expiry_date?: number }) => boolean;
let refreshToken: (client: any) => Promise<{ expiry_date: number }>;

try {
  const mod = await import('../../src/pipeline/upload-youtube');
  needsTokenRefresh = (mod as any).needsTokenRefresh;
  refreshToken = (mod as any).refreshToken;
} catch {
  needsTokenRefresh = undefined as any;
  refreshToken = undefined as any;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

describe('publishing: OAuth token refresh', () => {
  it('needsTokenRefresh is exported', () => {
    expect(typeof needsTokenRefresh).toBe('function');
  });

  it('returns true when token expires in < 5 minutes', () => {
    const soon = Date.now() + FIVE_MINUTES_MS - 1000;
    expect(needsTokenRefresh({ expiry_date: soon })).toBe(true);
  });

  it('returns false when token expires in > 5 minutes', () => {
    const later = Date.now() + FIVE_MINUTES_MS + 60_000;
    expect(needsTokenRefresh({ expiry_date: later })).toBe(false);
  });

  it('returns true when expiry_date is absent (unknown = treat as expired)', () => {
    expect(needsTokenRefresh({})).toBe(true);
  });

  it('returns true for already-expired token', () => {
    const past = Date.now() - 1000;
    expect(needsTokenRefresh({ expiry_date: past })).toBe(true);
  });

  it('refreshToken calls oauth2Client.refreshAccessToken', async () => {
    const mockRefresh = vi.fn().mockResolvedValue({
      credentials: { expiry_date: Date.now() + 3600_000 },
    });
    const fakeClient = { refreshAccessToken: mockRefresh, setCredentials: vi.fn() };
    const token = await refreshToken(fakeClient);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(token.expiry_date).toBeGreaterThan(Date.now());
  });
});
