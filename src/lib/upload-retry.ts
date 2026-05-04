/**
 * EXPONENTIAL BACKOFF RETRY LOGIC
 * Retries failed uploads with intelligent backoff strategy
 * - Max 3 attempts with delays: 1s, 2s, 4s
 * - Distinguishes network errors (retry) vs permission errors (fail fast)
 * - Logs each attempt with timestamp and reason
 */

export interface RetryConfig {
  maxAttempts?: number;
  delays?: number[]; // ms delays between attempts
  logFn?: (msg: string) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
  lastError?: Error;
}

export function isNetworkError(error: any): boolean {
  if (!error) return false;
  
  const message = error.message?.toLowerCase() || '';
  const code = error.code || error.status || 0;
  
  // Network-level errors that should be retried
  const networkPatterns = [
    'econnrefused',
    'econnreset',
    'etimedout',
    'ehostunreach',
    'enetunreach',
    'timeout',
    'network error',
    'socket hang up',
    'fetch failed',
  ];
  
  if (networkPatterns.some(p => message.includes(p))) {
    return true;
  }
  
  // HTTP status codes indicating temporary issues
  const retryableStatuses = [408, 429, 500, 502, 503, 504];
  if (retryableStatuses.includes(code)) {
    return true;
  }
  
  return false;
}

export function isPermissionError(error: any): boolean {
  if (!error) return false;
  
  const message = error.message?.toLowerCase() || '';
  const code = error.code || error.status || 0;
  
  // Permission/auth errors that should NOT be retried
  const permissionPatterns = [
    'unauthorized',
    'forbidden',
    'authentication',
    'invalid token',
    'expired token',
    'permission denied',
    'access denied',
    'quota exceeded',
    'invalid grant',
  ];
  
  if (permissionPatterns.some(p => message.includes(p))) {
    return true;
  }
  
  // HTTP status codes indicating permission issues
  const permissionStatuses = [401, 403, 404, 422];
  if (permissionStatuses.includes(code)) {
    return true;
  }
  
  return false;
}

export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  config?: RetryConfig
): Promise<RetryResult<T>> {
  const maxAttempts = config?.maxAttempts ?? 3;
  const delays = config?.delays ?? [1000, 2000, 4000];
  const logFn = config?.logFn ?? console.log;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const timestamp = new Date().toISOString();
      logFn(`[${timestamp}] Attempt ${attempt}/${maxAttempts}...`);
      
      const result = await fn();
      
      const successMsg = `[${timestamp}] ✅ Upload succeeded on attempt ${attempt}`;
      logFn(successMsg);
      
      return {
        success: true,
        data: result,
        attempts: attempt,
      };
    } catch (error: any) {
      lastError = error as Error;
      const timestamp = new Date().toISOString();
      const errorMsg = error.message || String(error);
      
      // Check if this is a permission error
      if (isPermissionError(error)) {
        const permissionMsg = `[${timestamp}] ❌ Permission error (will not retry): ${errorMsg}`;
        logFn(permissionMsg);
        
        return {
          success: false,
          error: errorMsg,
          attempts: attempt,
          lastError,
        };
      }
      
      // Check if this is a network error
      if (!isNetworkError(error)) {
        const unknownMsg = `[${timestamp}] ❌ Unknown error type: ${errorMsg}`;
        logFn(unknownMsg);
        
        return {
          success: false,
          error: errorMsg,
          attempts: attempt,
          lastError,
        };
      }
      
      // Network error - retry if attempts remain
      if (attempt < maxAttempts) {
        const delay = delays[attempt - 1];
        const retryMsg = `[${timestamp}] ⚠️  Network error (${errorMsg}). Retrying in ${delay}ms...`;
        logFn(retryMsg);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        const finalMsg = `[${timestamp}] ❌ Failed after ${maxAttempts} attempts: ${errorMsg}`;
        logFn(finalMsg);
      }
    }
  }
  
  return {
    success: false,
    error: lastError?.message || 'Unknown error',
    attempts: maxAttempts,
    lastError: lastError || undefined,
  };
}

export async function retryableUpload(
  uploadFn: () => Promise<any>,
  logFn?: (msg: string) => void
): Promise<RetryResult<any>> {
  return retryWithExponentialBackoff(uploadFn, {
    maxAttempts: 3,
    delays: [1000, 2000, 4000],
    logFn,
  });
}
