-- ─── 002_unify_architecture.sql ────────────────────────────────────────────────
-- Adds new tables and columns without using the error-prone CREATE/DROP/RENAME
-- table pattern. Uses ALTER TABLE ADD COLUMN and CREATE TABLE IF NOT EXISTS
-- for safe idempotent execution.

-- 1. channels (replaces the simplistic credentials table)
CREATE TABLE IF NOT EXISTS channels (
    id           TEXT    PRIMARY KEY,
    platform     TEXT    NOT NULL,
    account_name TEXT    NOT NULL,
    keychain_key TEXT    NOT NULL UNIQUE,
    created_at   INTEGER NOT NULL
);

-- NOTE: credentials migration is handled in JS (see migrate.ts) because
-- the credentials table may already have been dropped by a previous partial run.

-- 2. personas
CREATE TABLE IF NOT EXISTS personas (
    id                TEXT    PRIMARY KEY,
    name              TEXT    NOT NULL,
    tone_keywords     TEXT    NOT NULL DEFAULT '[]',
    forbidden_words   TEXT    NOT NULL DEFAULT '[]',
    value_principles  TEXT    NOT NULL DEFAULT '[]',
    style_samples     TEXT    NOT NULL DEFAULT '[]',
    extra_instructions TEXT   NOT NULL DEFAULT '',
    created_at        INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL
);

-- 3. automations
CREATE TABLE IF NOT EXISTS automations (
    id         TEXT    PRIMARY KEY,
    agent_id   TEXT    NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
    cron_expr  TEXT    NOT NULL,
    status     TEXT    NOT NULL DEFAULT 'paused',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Seed automations from existing agents with cron expressions
INSERT OR IGNORE INTO automations (id, agent_id, cron_expr, status, created_at, updated_at)
SELECT lower(hex(randomblob(16))), id, cron_expr,
       CASE WHEN status = 'running' OR status = 'idle' THEN 'active' ELSE 'paused' END,
       unixepoch(), unixepoch()
FROM agents WHERE cron_expr IS NOT NULL AND cron_expr != '';

-- 4. Add new FK columns to agents (campaign_id, channel_id)
ALTER TABLE agents ADD COLUMN campaign_id TEXT REFERENCES campaigns (id) ON DELETE SET NULL;
ALTER TABLE agents ADD COLUMN channel_id  TEXT REFERENCES channels  (id) ON DELETE SET NULL;

-- 5. Add new FK columns to content (campaign_id, channel_id)
ALTER TABLE content ADD COLUMN campaign_id TEXT REFERENCES campaigns (id) ON DELETE SET NULL;
ALTER TABLE content ADD COLUMN channel_id  TEXT REFERENCES channels  (id) ON DELETE SET NULL;
