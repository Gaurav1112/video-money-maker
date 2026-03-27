import Database, { type Database as DatabaseType } from 'better-sqlite3';

const dbPath = process.env.DATABASE_PATH || './queue.db';
const db: DatabaseType = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Whitelists to prevent SQL injection via dynamic column names
const ALLOWED_QUEUE_COLUMNS = new Set(['status', 'youtube_id', 'instagram_id', 'published_at', 'long_path', 'short_path', 'thumb_path', 'updated_at']);
const ALLOWED_JOB_COLUMNS = new Set(['status', 'progress', 'long_path', 'short_path', 'thumb_path', 'error', 'started_at', 'completed_at']);

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT NOT NULL,
      session_number INTEGER NOT NULL,
      language TEXT NOT NULL DEFAULT 'python',
      title TEXT,
      long_path TEXT,
      short_path TEXT,
      thumb_path TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      youtube_id TEXT,
      instagram_id TEXT,
      published_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS render_jobs (
      id TEXT PRIMARY KEY,
      queue_id INTEGER REFERENCES queue(id),
      status TEXT NOT NULL DEFAULT 'queued',
      progress INTEGER DEFAULT 0,
      long_path TEXT,
      short_path TEXT,
      thumb_path TEXT,
      error TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

export function getNextPending() {
  return db.prepare(
    'SELECT * FROM queue WHERE status = ? ORDER BY id ASC LIMIT 1'
  ).get('pending');
}

export function updateQueueStatus(id: number, status: string, extra?: Record<string, any>) {
  const sets = ['status = ?', "updated_at = datetime('now')"];
  const values: any[] = [status];

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (!ALLOWED_QUEUE_COLUMNS.has(key)) continue;
      sets.push(`${key} = ?`);
      values.push(value);
    }
  }

  values.push(id);
  db.prepare(`UPDATE queue SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function createRenderJob(id: string, queueId: number) {
  db.prepare(
    'INSERT INTO render_jobs (id, queue_id, status) VALUES (?, ?, ?)'
  ).run(id, queueId, 'queued');
}

export function updateRenderJob(id: string, updates: Record<string, any>) {
  const safeEntries = Object.entries(updates).filter(([k]) => ALLOWED_JOB_COLUMNS.has(k));
  if (safeEntries.length === 0) return;
  const sets = safeEntries.map(([k]) => `${k} = ?`);
  const values = safeEntries.map(([, v]) => v);
  values.push(id);
  db.prepare(`UPDATE render_jobs SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function getRenderJob(id: string) {
  return db.prepare('SELECT * FROM render_jobs WHERE id = ?').get(id);
}

export function getQueueStats() {
  return db.prepare(
    'SELECT status, COUNT(*) as count FROM queue GROUP BY status'
  ).all();
}

export function seedQueue(items: Array<{ topic: string; session_number: number; language: string; title: string }>) {
  const insert = db.prepare(
    'INSERT INTO queue (topic, session_number, language, title) VALUES (?, ?, ?, ?)'
  );
  const insertMany = db.transaction((items: Array<{ topic: string; session_number: number; language: string; title: string }>) => {
    for (const item of items) {
      insert.run(item.topic, item.session_number, item.language, item.title);
    }
  });
  insertMany(items);
}

export { db };
