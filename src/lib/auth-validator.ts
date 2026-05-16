/**
 * AUTH VALIDATOR (P0 FIX #5)
 * Fails fast on stale credentials instead of silent failures
 * ENHANCED: OAuth2 refresh with token caching
 */

export interface AuthStatus {
  platform: string;
  valid: boolean;
  expiresAt?: Date;
  error?: string;
  accessToken?: string;
}

export interface TokenRefreshResult {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}

// In-memory token cache to avoid redundant refreshes
let tokenCache: { accessToken: string; expiresAt: number } | null = null;

export async function refreshYouTubeToken(refreshToken: string): Promise<TokenRefreshResult> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET not set');
  }
  
  if (!refreshToken) {
    throw new Error('YOUTUBE_REFRESH_TOKEN not set');
  }
  
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText} - ${error}`);
    }
    
    const data = await response.json() as {
      access_token: string;
      expires_in: number;
      token_type: string;
    };
    
    const expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    tokenCache = {
      accessToken: data.access_token,
      expiresAt,
    };
    
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in || 3600,
      tokenType: data.token_type || 'Bearer',
    };
  } catch (e: any) {
    throw new Error(`OAuth2 token refresh failed: ${e.message}`);
  }
}

export function getCachedAccessToken(): string | null {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) {
    return tokenCache.accessToken;
  }
  return null;
}

export async function getValidAccessToken(refreshToken: string): Promise<string> {
  const cached = getCachedAccessToken();
  if (cached) {
    return cached;
  }
  
  const result = await refreshYouTubeToken(refreshToken);
  return result.accessToken;
}

export async function validateYouTubeAuth(refreshToken: string): Promise<AuthStatus> {
  if (!refreshToken) {
    return {
      platform: 'youtube',
      valid: false,
      error: 'YOUTUBE_REFRESH_TOKEN not set'
    };
  }
  
  try {
    const result = await refreshYouTubeToken(refreshToken);
    return {
      platform: 'youtube',
      valid: true,
      accessToken: result.accessToken,
      expiresAt: new Date(Date.now() + result.expiresIn * 1000)
    };
  } catch (e: any) {
    return {
      platform: 'youtube',
      valid: false,
      error: `Auth check failed: ${e.message}`
    };
  }
}

export async function validateInstagramAuth(accessToken: string): Promise<AuthStatus> {
  if (!accessToken) {
    return {
      platform: 'instagram',
      valid: false,
      error: 'INSTAGRAM_ACCESS_TOKEN not set'
    };
  }
  
  try {
    const response = await fetch(`https://graph.instagram.com/me?access_token=${accessToken}`);
    
    if (!response.ok) {
      return {
        platform: 'instagram',
        valid: false,
        error: `Token validation failed: ${response.status}`
      };
    }
    
    return {
      platform: 'instagram',
      valid: true
    };
  } catch (e: any) {
    return {
      platform: 'instagram',
      valid: false,
      error: `Auth check failed: ${e.message}`
    };
  }
}

export async function validateAllAuth(): Promise<AuthStatus[]> {
  const results: AuthStatus[] = [];
  
  // Check YouTube
  const yt = await validateYouTubeAuth(process.env.YOUTUBE_REFRESH_TOKEN || '');
  results.push(yt);
  
  // Check Instagram (if configured)
  if (process.env.INSTAGRAM_ACCESS_TOKEN) {
    const ig = await validateInstagramAuth(process.env.INSTAGRAM_ACCESS_TOKEN);
    results.push(ig);
  }
  
  return results;
}

export function failFastOnAuthError(authStatuses: AuthStatus[]): void {
  const invalid = authStatuses.filter(s => !s.valid);
  
  if (invalid.length > 0) {
    console.error('❌ AUTH ERRORS (failing fast):');
    invalid.forEach(status => {
      console.error(`   [${status.platform}] ${status.error}`);
    });
    throw new Error(`${invalid.length} platform(s) have invalid credentials`);
  }
}
