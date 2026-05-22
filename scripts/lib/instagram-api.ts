/**
 * instagram-api.ts — Pure helpers for the Instagram Graph API publisher.
 *
 * Migrated to the newer "Instagram API with Instagram Login" product:
 *   - Base URL is graph.instagram.com (NOT graph.facebook.com).
 *   - Auth uses an Instagram user access token generated directly from the
 *     app's Instagram product "Generate access tokens" panel.
 *   - The IG user id is taken from the IG_USER_ID env var (shown in that
 *     same panel) — no /me/accounts discovery step.
 *
 * These helpers are pure (no network) so they can be unit-tested directly.
 */

/** Base URL for the Instagram-Login Graph API. */
export const GRAPH_API_BASE = 'https://graph.instagram.com/v21.0';

/** Deterministic polling: fixed 5s interval, 12 attempts (~60s budget). */
export const POLL_INTERVAL_MS = 5000;
export const MAX_POLL_ATTEMPTS = 12;

/**
 * Build a fully-qualified Graph API URL with query params.
 * @param urlPath path beginning with '/', e.g. `/17841400000000000/media`
 * @param params  query/body params (Instagram accepts them as query string)
 */
export function buildGraphUrl(urlPath: string, params?: Record<string, string>): string {
  const url = new URL(`${GRAPH_API_BASE}${urlPath}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export type PollDecision = 'finished' | 'error' | 'wait' | 'timeout';

/**
 * Decide what to do given a container status code and attempt count.
 * Pure function — drives the (impure) polling loop.
 *
 * @param statusCode  the `status_code` field from the container status response
 * @param attempt     zero-based attempt index already consumed
 */
export function pollDecision(statusCode: string, attempt: number): PollDecision {
  if (statusCode === 'FINISHED') return 'finished';
  if (statusCode === 'ERROR' || statusCode === 'EXPIRED') return 'error';
  if (attempt + 1 >= MAX_POLL_ATTEMPTS) return 'timeout';
  return 'wait';
}

export interface InstagramCredentials {
  igUserId: string;
  accessToken: string;
}

/**
 * Read + validate the Instagram credentials from the environment.
 * Accepts the new IG_USER_ID / IG_ACCESS_TOKEN names, falling back to the
 * legacy INSTAGRAM_BUSINESS_ID / INSTAGRAM_ACCESS_TOKEN names so existing
 * workflow secrets keep working.
 *
 * @throws Error with a clear "missing X" message if anything is absent.
 */
export function resolveCredentials(env: NodeJS.ProcessEnv = process.env): InstagramCredentials {
  const igUserId = env.IG_USER_ID || env.INSTAGRAM_BUSINESS_ID;
  const accessToken = env.IG_ACCESS_TOKEN || env.INSTAGRAM_ACCESS_TOKEN;

  if (!igUserId) {
    throw new Error(
      "Missing IG_USER_ID. Set the Instagram user id from the app's " +
        'Instagram product "Generate access tokens" panel ' +
        '(IG_USER_ID, or legacy INSTAGRAM_BUSINESS_ID).'
    );
  }
  if (!accessToken) {
    throw new Error(
      'Missing IG_ACCESS_TOKEN. Set the Instagram user access token ' +
        "generated from the app's Instagram product panel " +
        '(IG_ACCESS_TOKEN, or legacy INSTAGRAM_ACCESS_TOKEN).'
    );
  }
  return { igUserId, accessToken };
}
