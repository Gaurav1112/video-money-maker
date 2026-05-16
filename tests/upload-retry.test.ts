/**
 * UPLOAD RETRY TESTS
 * Tests for exponential backoff retry logic
 */

import { describe, it, expect, vi } from 'vitest';
import {
  isNetworkError,
  isPermissionError,
  retryWithExponentialBackoff,
  retryableUpload,
} from '../src/lib/upload-retry';

describe('Error Classification', () => {
  it('should classify network errors correctly', () => {
    const networkErrors = [
      new Error('ECONNREFUSED: Connection refused'),
      new Error('ETIMEDOUT: timeout'),
      new Error('Network error'),
      { message: 'socket hang up', status: 0 },
      { message: '', status: 503 },
      { message: '', status: 429 },
    ];
    
    networkErrors.forEach(err => {
      expect(isNetworkError(err)).toBe(true);
    });
  });

  it('should classify permission errors correctly', () => {
    const permissionErrors = [
      new Error('Unauthorized'),
      new Error('PERMISSION DENIED'),
      new Error('Invalid token'),
      new Error('Quota exceeded'),
      { message: 'Authentication failed', status: 401 },
      { message: '', status: 403 },
      { message: '', status: 404 },
    ];
    
    permissionErrors.forEach(err => {
      expect(isPermissionError(err)).toBe(true);
    });
  });

  it('should distinguish between network and permission errors', () => {
    const networkErr = new Error('ECONNRESET: connection reset');
    const permErr = new Error('Unauthorized access');
    
    expect(isNetworkError(networkErr)).toBe(true);
    expect(isPermissionError(networkErr)).toBe(false);
    
    expect(isPermissionError(permErr)).toBe(true);
    expect(isNetworkError(permErr)).toBe(false);
  });
});

describe('Exponential Backoff Retry', () => {
  it('should succeed on first attempt', async () => {
    const mockFn = vi.fn().mockResolvedValue({ success: true });
    
    const result = await retryWithExponentialBackoff(mockFn, {
      maxAttempts: 3,
      delays: [100, 200, 300],
    });
    
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should retry on network error and succeed', async () => {
    const mockFn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET: connection reset'))
      .mockResolvedValueOnce({ success: true });
    
    const result = await retryWithExponentialBackoff(mockFn, {
      maxAttempts: 3,
      delays: [50, 100],
      logFn: vi.fn(),
    });
    
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should fail fast on permission error', async () => {
    const mockFn = vi.fn()
      .mockRejectedValue(new Error('Unauthorized: Invalid token'));
    
    const result = await retryWithExponentialBackoff(mockFn, {
      maxAttempts: 3,
      delays: [50, 100, 150],
      logFn: vi.fn(),
    });
    
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should exhaust all retries on persistent network error', async () => {
    const mockFn = vi.fn()
      .mockRejectedValue(new Error('ECONNREFUSED: connection refused'));
    
    const result = await retryWithExponentialBackoff(mockFn, {
      maxAttempts: 3,
      delays: [50, 100],
      logFn: vi.fn(),
    });
    
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3);
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should use exponential backoff delays', async () => {
    const delays: number[] = [];
    const mockFn = vi.fn()
      .mockImplementation(() => {
        delays.push(Date.now());
        return Promise.reject(new Error('Network error'));
      });
    
    await retryWithExponentialBackoff(mockFn, {
      maxAttempts: 3,
      delays: [50, 100],
      logFn: vi.fn(),
    });
    
    // Check approximate delays (with 20ms tolerance for test execution)
    if (delays.length >= 3) {
      const delay1 = delays[1] - delays[0];
      const delay2 = delays[2] - delays[1];
      
      // Should be roughly 50ms and 100ms
      expect(delay1).toBeGreaterThanOrEqual(40);
      expect(delay2).toBeGreaterThanOrEqual(80);
    }
  });

  it('should log each attempt', async () => {
    const logFn = vi.fn();
    const mockFn = vi.fn()
      .mockRejectedValue(new Error('Network error'));
    
    await retryWithExponentialBackoff(mockFn, {
      maxAttempts: 2,
      delays: [50],
      logFn,
    });
    
    expect(logFn).toHaveBeenCalledWith(expect.stringContaining('Attempt 1/2'));
    expect(logFn).toHaveBeenCalledWith(expect.stringContaining('Network error'));
    expect(logFn).toHaveBeenCalledWith(expect.stringContaining('Attempt 2/2'));
  });

  it('should return error details on failure', async () => {
    const error = new Error('Custom upload error');
    const mockFn = vi.fn().mockRejectedValue(error);
    
    const result = await retryWithExponentialBackoff(mockFn, {
      maxAttempts: 1,
      logFn: vi.fn(),
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('Custom upload error');
    expect(result.lastError).toBe(error);
  });
});

describe('Retryable Upload Wrapper', () => {
  it('should use default retry config', async () => {
    const mockFn = vi.fn().mockResolvedValue({ id: 'video123' });
    
    const result = await retryableUpload(mockFn);
    
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe('video123');
    expect(result.attempts).toBe(1);
  });

  it('should work with custom log function', async () => {
    const logFn = vi.fn();
    const mockFn = vi.fn().mockResolvedValue({ id: 'video123' });
    
    await retryableUpload(mockFn, logFn);
    
    expect(logFn).toHaveBeenCalled();
  });
});
