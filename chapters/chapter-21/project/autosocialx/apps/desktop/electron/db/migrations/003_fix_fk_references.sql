-- ─── 003_fix_fk_references.sql ────────────────────────────────────────────────
-- Fix agent_runs / automations / content tables whose agent_id FK incorrectly
-- points to "_agents_old" (a now-dropped temp table from an earlier migration).
-- PRAGMA foreign_keys = ON makes every INSERT fail with "no such table: _agents_old".
--
-- Strategy:
--   1. Turn off FK enforcement for the migration transaction.
--   2. Recreate each broken table with the correct FK (or no FK for content,
--      since agent_id = 'manual' is an intentional non-UUID value).
--   3. Copy existing data via INSERT OR IGNORE (skips rows that would violate
--      the new FK — harmless since run history is non-critical).
--   4. Drop old tables, rename new ones, restore indexes.

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

-- ── 1. agent_runs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_runs_new (
  id           TEXT    PRIMARY KEY,
  agent_id     TEXT    NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
  status       TEXT    NOT NULL,
  steps        TEXT    NOT NULL DEFAULT '[]',
  tokens_used  INTEGER NOT NULL DEFAULT 0,
  duration_ms  INTEGER,
  started_at   INTEGER NOT NULL,
  finished_at  INTEGER
);
INSERT OR IGNORE INTO agent_runs_new SELECT * FROM agent_runs;
DROP TABLE agent_runs;
ALTER TABLE agent_runs_new RENAME TO agent_runs;

-- ── 2. automations ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automations_new (
    id         TEXT    PRIMARY KEY,
    agent_id   TEXT    NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
    cron_expr  TEXT    NOT NULL,
    status     TEXT    NOT NULL DEFAULT 'paused',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
INSERT OR IGNORE INTO automations_new SELECT * FROM automations;
DROP TABLE automations;
ALTER TABLE automations_new RENAME TO automations;

-- ── 3. content ────────────────────────────────────────────────────────────────
-- NOTE: agent_id intentionally has NO FK here — 'manual' and other non-UUID
-- values are valid by design (content created outside agent context).
CREATE TABLE IF NOT EXISTS content_new (
  id           TEXT    PRIMARY KEY,
  agent_id     TEXT    NOT NULL,
  campaign_id  TEXT    REFERENCES campaigns (id) ON DELETE SET NULL,
  channel_id   TEXT    REFERENCES channels  (id) ON DELETE SET NULL,
  platform     TEXT    NOT NULL,
  text         TEXT    NOT NULL DEFAULT '',
  media_urls   TEXT    NOT NULL DEFAULT '[]',
  status       TEXT    NOT NULL DEFAULT 'draft',
  scheduled_at INTEGER,
  published_at INTEGER,
  post_id      TEXT,
  stats        TEXT    NOT NULL DEFAULT '{}'
);
INSERT OR IGNORE INTO content_new SELECT * FROM content;
DROP TABLE content;
ALTER TABLE content_new RENAME TO content;

COMMIT;

PRAGMA foreign_keys = ON;

-- Recreate indexes (IF NOT EXISTS is safe)
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_id   ON agent_runs (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_started_at ON agent_runs (started_at);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status     ON agent_runs (status);

CREATE INDEX IF NOT EXISTS idx_content_agent_id     ON content (agent_id);
CREATE INDEX IF NOT EXISTS idx_content_platform     ON content (platform);
CREATE INDEX IF NOT EXISTS idx_content_status       ON content (status);
CREATE INDEX IF NOT EXISTS idx_content_scheduled_at ON content (scheduled_at);
