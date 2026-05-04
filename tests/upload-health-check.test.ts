/**
 * HEALTH CHECK TESTS
 * Tests for pre-flight validation
 */

import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  isVideoFileReadable,
  isVideoSizeValid,
  validateTokenRefresh,
  runHealthChecks,
} from '../src/lib/upload-health-check';

describe('Video File Validation', () => {
  it('should detect readable video files', () => {
    const testFile = path.join(__dirname, '__fixtures__', 'test.mp4');
    
    // Create test file
    const fixtureDir = path.join(__dirname, '__fixtures__');
    if (!fs.existsSync(fixtureDir)) {
      fs.mkdirSync(fixtureDir, { recursive: true });
    }
    
    fs.writeFileSync(testFile, Buffer.alloc(1024 * 1024)); // 1MB test file
    
    expect(isVideoFileReadable(testFile)).toBe(true);
    
    fs.unlinkSync(testFile);
    expect(isVideoFileReadable(testFile)).toBe(false);
  });

  it('should validate video file size', () => {
    const testFile = path.join(__dirname, '__fixtures__', 'size-test.mp4');
    const fixtureDir = path.join(__dirname, '__fixtures__');
    
    if (!fs.existsSync(fixtureDir)) {
      fs.mkdirSync(fixtureDir, { recursive: true });
    }
    
    // 50MB file
    fs.writeFileSync(testFile, Buffer.alloc(50 * 1024 * 1024));
    expect(isVideoSizeValid(testFile, 100)).toBe(true);
    expect(isVideoSizeValid(testFile, 40)).toBe(false);
    
    fs.unlinkSync(testFile);
  });

  it('should reject files with zero size', () => {
    const testFile = path.join(__dirname, '__fixtures__', 'empty.mp4');
    const fixtureDir = path.join(__dirname, '__fixtures__');
    
    if (!fs.existsSync(fixtureDir)) {
      fs.mkdirSync(fixtureDir, { recursive: true });
    }
    
    fs.writeFileSync(testFile, '');
    expect(isVideoSizeValid(testFile)).toBe(false);
    
    fs.unlinkSync(testFile);
  });

  it('should reject non-existent files', () => {
    expect(isVideoFileReadable('/nonexistent/file.mp4')).toBe(false);
    expect(isVideoSizeValid('/nonexistent/file.mp4')).toBe(false);
  });
});

describe('Token Validation', () => {
  it('should handle missing credentials', async () => {
    const result = await validateTokenRefresh(undefined, 'secret', 'token');
    expect(result).toBe(false);
  });

  it('should handle network errors gracefully', async () => {
    // Mock fetch to fail
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    
    const result = await validateTokenRefresh('id', 'secret', 'token');
    expect(result).toBe(false);
  });
});

describe('Health Checks', () => {
  it('should run all checks', async () => {
    const testFile = path.join(__dirname, '__fixtures__', 'health-test.mp4');
    const fixtureDir = path.join(__dirname, '__fixtures__');
    
    if (!fs.existsSync(fixtureDir)) {
      fs.mkdirSync(fixtureDir, { recursive: true });
    }
    
    fs.writeFileSync(testFile, Buffer.alloc(10 * 1024 * 1024)); // 10MB
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    
    const result = await runHealthChecks(
      testFile,
      'client-id',
      'client-secret',
      'refresh-token',
      100
    );
    
    expect(result.checks.videoReadable).toBe(true);
    expect(result.checks.videoSize).toBe(true);
    
    fs.unlinkSync(testFile);
  });

  it('should detect missing files', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    
    const result = await runHealthChecks(
      '/nonexistent/file.mp4',
      'client-id',
      'client-secret',
      'refresh-token'
    );
    
    expect(result.checks.videoReadable).toBe(false);
    expect(result.healthy).toBe(false);
  });

  it('should report all errors', async () => {
    const result = await runHealthChecks(
      '/nonexistent/file.mp4',
      undefined,
      'secret',
      'token'
    );
    
    expect(result.checks.errors.length).toBeGreaterThan(0);
    expect(result.healthy).toBe(false);
  });
});
