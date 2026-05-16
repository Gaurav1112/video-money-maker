#!/usr/bin/env npx tsx
/**
 * scripts/queue/init-db.ts — Create/migrate queue.db schema
 *
 * Called automatically by claim.ts, complete.ts, fail.ts, enqueue.ts.
 * Safe to call multiple times (CREATE TABLE IF NOT EXISTS).
 *
 * DB location: $QUEUE_DB_PATH  (default: ~/video-money-maker-data/queue.db)
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export const DB_PATH: string =
  process.env['QUEUE_DB_PATH'] ??
  path.join(os.homedir(), 'video-money-maker-data', 'queue.db');

export function openDb(): Database.Database {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');   // concurrent reads
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');  // 5 s wait on locked DB

  initSchema(db);
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS queue_items (
      id                TEXT PRIMARY KEY,
      topic             TEXT NOT NULL,
      topic_name        TEXT NOT NULL,
      session           INTEGER NOT NULL,
      slot_type         TEXT NOT NULL
                          CHECK (slot_type IN ('long','vertical-1','vertical-23','daily-short')),
      day_of_week       TEXT NOT NULL,
      scheduled_date    TEXT NOT NULL,          -- YYYY-MM-DD
      overall_status    TEXT NOT NULL DEFAULT 'pending'
                          CHECK (overall_status IN ('pending','partial','published','dead_letter')),
      video_path        TEXT NOT NULL,
      additional_videos TEXT,                   -- JSON array of extra video paths
      metadata_path     TEXT NOT NULL,
      thumbnail_path    TEXT,
      created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ) STRICT;

    -- One row per (queue_item × platform). Tracks status independently.
    CREATE TABLE IF NOT EXISTS platform_publishes (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      queue_item_id    TEXT    NOT NULL REFERENCES queue_items(id) ON DELETE CASCADE,
      platform         TEXT    NOT NULL CHECK (platform IN ('youtube','instagram','telegram')),
      status           TEXT    NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','claimed','published','failed','dead_letter')),
      platform_video_id TEXT,                   -- YouTube video ID / Instagram media ID / Telegram msg ID
      claimed_by       TEXT,                    -- GHA run_id that holds the claim
      claimed_at       TEXT,
      idempotency_key  TEXT    UNIQUE,           -- sha256(id:attempt:run_id)
      attempts         INTEGER NOT NULL DEFAULT 0,
      max_attempts     INTEGER NOT NULL DEFAULT 3,
      last_error       TEXT,
      created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE (queue_item_id, platform)
    ) STRICT;

    CREATE TABLE IF NOT EXISTS publish_log (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      queue_item_id     TEXT    NOT NULL REFERENCES queue_items(id),
      platform          TEXT    NOT NULL CHECK (platform IN ('youtube','instagram','telegram')),
      status            TEXT    NOT NULL CHECK (status IN ('success','failure')),
      platform_video_id TEXT,
      error             TEXT,
      duration_ms       INTEGER,
      run_id            TEXT,
      idempotency_key   TEXT    NOT NULL,
      created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ) STRICT;

    CREATE TABLE IF NOT EXISTS dead_letter (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      queue_item_id  TEXT    NOT NULL REFERENCES queue_items(id),
      platform       TEXT    NOT NULL,
      failed_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      error          TEXT    NOT NULL,
      run_id         TEXT,
      attempts       INTEGER NOT NULL
    ) STRICT;

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_pp_status_platform
      ON platform_publishes (platform, status, queue_item_id);

    CREATE INDEX IF NOT EXISTS idx_qi_scheduled
      ON queue_items (scheduled_date, overall_status);

    CREATE INDEX IF NOT EXISTS idx_pp_claimed_by
      ON platform_publishes (claimed_by);
  `);
}

// When run directly: just initialise the DB and print a confirmation.
if (require.main === module) {
  openDb();
  console.log(`✅ queue.db initialised at: ${DB_PATH}`);
}
