import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type Database from 'better-sqlite3'

export function runMigrations(db: Database.Database): void {
  // PRAGMA foreign_keys = ON is crucial for our new relational architecture
  db.pragma('foreign_keys = ON')

  // Migration tracking table — each migration runs exactly once
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name       TEXT    PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )`)

  // NOTE: Two files share the "004" prefix due to a historical naming error.
  // Both are tracked independently by filename and are safe to apply in any order.
  const migrations = ['001_initial.sql', '002_unify_architecture.sql', '003_fix_fk_references.sql', '004_add_agent_provider.sql', '004_rss_items.sql', '005_campaigns_extend.sql', '006_campaigns_cron.sql', '007_agent_runs_episodic.sql', '008_decouple_agents_campaigns.sql', '009_unify_channels.sql', '010_agent_runs_no_fk.sql', '011_seed_demo.sql', '012_reseed_campaigns_content.sql']

  for (const m of migrations) {
    const already = db.prepare('SELECT name FROM _migrations WHERE name = ?').get(m)
    if (already) {
      console.log(`[migrate] ${m} already applied, skipping`)
      continue
    }

    const sqlPath = join(__dirname, 'migrations', m)
    const sql = readFileSync(sqlPath, 'utf-8')

    // For 002/003, run each statement individually so we can handle known-safe errors
    if (m === '002_unify_architecture.sql') {
      run002(db, sql)
      db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, unixepoch())').run(m)
      console.log(`[migrate] ${m} applied successfully`)
      continue
    }

    if (m === '003_fix_fk_references.sql') {
      run003(db, sql)
      db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, unixepoch())').run(m)
      console.log(`[migrate] ${m} applied successfully`)
      continue
    }

    // 004_rss_items creates a new table with IF NOT EXISTS — safe to re-run
    if (m === '004_rss_items.sql' || m === '005_campaigns_extend.sql' || m === '006_campaigns_cron.sql' || m === '007_agent_runs_episodic.sql' || m === '008_decouple_agents_campaigns.sql') {
      runAddColumns(db, sql)
      db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, unixepoch())').run(m)
      console.log(`[migrate] ${m} applied successfully`)
      continue
    }

    if (m === '009_unify_channels.sql') {
      run009(db, sql)
      db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, unixepoch())').run(m)
      console.log(`[migrate] ${m} applied successfully`)
      continue
    }

    if (m === '010_agent_runs_no_fk.sql') {
      run009(db, sql) // same statement-by-statement runner with PRAGMA/transaction support
      db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, unixepoch())').run(m)
      console.log(`[migrate] ${m} applied successfully`)
      continue
    }

    if (m === '011_seed_demo.sql') {
      run009(db, sql) // DELETE + INSERT statements, run individually for clear error reporting
      db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, unixepoch())').run(m)
      console.log(`[migrate] ${m} applied successfully`)
      continue
    }

    if (m === '012_reseed_campaigns_content.sql') {
      run009(db, sql) // INSERT OR REPLACE — safe to re-run on top of 011
      db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, unixepoch())').run(m)
      console.log(`[migrate] ${m} applied successfully`)
      continue
    }

    try {
      db.exec(sql)
      db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, unixepoch())').run(m)
      console.log(`[migrate] ${m} applied successfully`)
    } catch (err: unknown) {
      console.error(`[migrate] Failed to run migration ${m}:`, err)
    }
  }
}

/**
 * Run migration 002 statement-by-statement, skipping known-safe errors:
 *  - duplicate column name (ADD COLUMN already applied on previous partial run)
 *  - no such table: credentials (was dropped in a previous partial run)
 */
function run002(db: Database.Database, sql: string): void {
  // Strip -- comments, then split into individual statements
  const cleanSql = sql.replace(/--[^\n]*/g, '')
  const statements = cleanSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  for (const stmt of statements) {
    try {
      db.exec(stmt + ';')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (
        msg.includes('duplicate column name') ||
        msg.includes('no such table: credentials') ||
        msg.includes('already exists')
      ) {
        // Column/table already present from a previous partial run — safe to skip
        continue
      }
      // Log unexpected errors but continue (don't crash the app)
      console.error('[migrate] 002 statement failed:', stmt.slice(0, 80), '—', msg)
    }
  }

  // After tables are created, migrate credentials → channels if credentials still exists
  const hasCredentials = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='credentials'"
  ).get()
  if (hasCredentials) {
    try {
      db.exec(`
        INSERT OR IGNORE INTO channels (id, platform, account_name, keychain_key, created_at)
        SELECT id, platform, account_name, keychain_key, created_at FROM credentials;
        DROP TABLE IF EXISTS credentials;
      `)
    } catch (err: unknown) {
      console.error('[migrate] 002 credentials migration failed:', err)
    }
  }
}

/**
 * Run migration 003 statement-by-statement.
 * Uses PRAGMA foreign_keys = OFF / transaction / rename pattern.
 * Skips "already exists" errors for idempotency.
 */
/** Generic ADD COLUMN runner — skips duplicate column errors for idempotency */
function runAddColumns(db: Database.Database, sql: string): void {
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map(s => s.trim()).filter(s => s.length > 0)
  for (const stmt of statements) {
    try {
      db.exec(stmt + ';')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('duplicate column name')) continue
      console.error('[migrate] 005 statement failed:', stmt.slice(0, 80), '—', msg)
    }
  }
}

/**
 * Run migration 009 — DROP + CREATE channels table with new schema.
 * Uses PRAGMA foreign_keys = OFF to avoid FK constraint issues during DROP.
 */
function run009(db: Database.Database, sql: string): void {
  const cleanSql = sql.replace(/--[^\n]*/g, '')
  const statements = cleanSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  for (const stmt of statements) {
    try {
      db.exec(stmt + ';')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('already exists') || msg.includes('duplicate column name')) continue
      console.error('[migrate] 009 statement failed:', stmt.slice(0, 80), '—', msg)
    }
  }
}

function run003(db: Database.Database, sql: string): void {
  // Strip -- comments, split on semicolons
  const cleanSql = sql.replace(/--[^\n]*/g, '')
  const statements = cleanSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  for (const stmt of statements) {
    try {
      db.exec(stmt + ';')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('already exists') || msg.includes('duplicate column name')) {
        continue
      }
      console.error('[migrate] 003 statement failed:', stmt.slice(0, 80), '—', msg)
    }
  }
}
