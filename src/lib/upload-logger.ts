/**
 * UPLOAD LOGGER
 * Centralized logging for upload operations
 */

import * as fs from 'fs';
import * as path from 'path';

export interface UploadLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, any>;
}

let logBuffer: UploadLog[] = [];
const LOG_DIR = path.join(process.env.HOME || '', '.copilot', 'session-state', 'logs');

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

export function getLogFile(): string {
  const timestamp = new Date().toISOString().split('T')[0];
  return path.join(LOG_DIR, `upload-${timestamp}.log`);
}

export function logUpload(level: 'info' | 'warn' | 'error', message: string, context?: Record<string, any>): void {
  const log: UploadLog = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  };
  
  logBuffer.push(log);
  
  // Also log to console
  const prefix = {
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
  }[level];
  
  console.log(`${prefix} ${log.timestamp} ${message}`);
  if (context) {
    console.log('   Context:', JSON.stringify(context, null, 2));
  }
}

export function flushLogs(): void {
  if (logBuffer.length === 0) return;
  
  try {
    ensureLogDir();
    const logFile = getLogFile();
    const content = logBuffer.map(log => JSON.stringify(log)).join('\n');
    
    if (fs.existsSync(logFile)) {
      fs.appendFileSync(logFile, '\n' + content);
    } else {
      fs.writeFileSync(logFile, content);
    }
    
    console.log(`\n📝 Logs saved to: ${logFile}`);
    logBuffer = [];
  } catch (err) {
    console.error('Failed to write logs:', err);
  }
}

export function getLogPath(): string {
  ensureLogDir();
  return getLogFile();
}
