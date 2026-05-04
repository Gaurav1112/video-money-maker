/**
 * AUTH VALIDATOR (P0 FIX #5)
 * Fails fast on stale credentials instead of silent failures
 */

export interface AuthStatus {
  platform: string;
  valid: boolean;
  expiresAt?: Date;
  error?: string;
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
    // Attempt token refresh to validate
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.YOUTUBE_CLIENT_ID || '',
        client_secret: process.env.YOUTUBE_CLIENT_SECRET || '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    
    if (!response.ok) {
      return {
        platform: 'youtube',
        valid: false,
        error: `Token refresh failed: ${response.status} ${response.statusText}`
      };
    }
    
    const data = await response.json() as { expires_in?: number };
    return {
      platform: 'youtube',
      valid: true,
      expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000)
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
