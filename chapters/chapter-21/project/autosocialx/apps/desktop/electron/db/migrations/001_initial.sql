-- ─── agents ──────────────────────────────────────────────────────────────────
-- Represents a configured autonomous agent with its platform, persona, skills,
-- schedule, runtime status, and security constraints.
CREATE TABLE IF NOT EXISTS agents (
  id               TEXT    PRIMARY KEY,
  name             TEXT    NOT NULL,
  platform         TEXT    NOT NULL,
  persona_id       TEXT,
  skill_ids        TEXT    NOT NULL DEFAULT '[]',   -- JSON array of skill IDs
  cron_expr        TEXT,
  status           TEXT    NOT NULL DEFAULT 'idle', -- idle | running | paused | error | complete
  security_profile TEXT    NOT NULL DEFAULT '{}',   -- JSON SecurityProfile blob
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agents_platform ON agents (platform);
CREATE INDEX IF NOT EXISTS idx_agents_status   ON agents (status);

-- ─── agent_runs ──────────────────────────────────────────────────────────────
-- Records each execution run of an agent, including step traces and token costs.
CREATE TABLE IF NOT EXISTS agent_runs (
  id           TEXT    PRIMARY KEY,
  agent_id     TEXT    NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
  status       TEXT    NOT NULL,                        -- enqueued | running | completed | failed | retrying
  steps        TEXT    NOT NULL DEFAULT '[]',           -- JSON array of RunStep
  tokens_used  INTEGER NOT NULL DEFAULT 0,
  duration_ms  INTEGER,
  started_at   INTEGER NOT NULL,
  finished_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_id    ON agent_runs (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_started_at  ON agent_runs (started_at);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status      ON agent_runs (status);

-- ─── content ─────────────────────────────────────────────────────────────────
-- Stores AI-generated posts at every stage of their lifecycle.
CREATE TABLE IF NOT EXISTS content (
  id           TEXT    PRIMARY KEY,
  agent_id     TEXT    NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
  platform     TEXT    NOT NULL,
  text         TEXT    NOT NULL DEFAULT '',
  media_urls   TEXT    NOT NULL DEFAULT '[]',           -- JSON array of URL strings
  status       TEXT    NOT NULL DEFAULT 'draft',        -- draft | scheduled | published | failed
  scheduled_at INTEGER,
  published_at INTEGER,
  post_id      TEXT,                                    -- platform-assigned post ID after publish
  stats        TEXT    NOT NULL DEFAULT '{}'            -- JSON engagement stats blob
);

CREATE INDEX IF NOT EXISTS idx_content_agent_id     ON content (agent_id);
CREATE INDEX IF NOT EXISTS idx_content_platform     ON content (platform);
CREATE INDEX IF NOT EXISTS idx_content_status       ON content (status);
CREATE INDEX IF NOT EXISTS idx_content_scheduled_at ON content (scheduled_at);

-- ─── credentials ─────────────────────────────────────────────────────────────
-- Maps platform accounts to their keychain-managed credential keys.
-- Actual secrets are NEVER stored here; only the keychain lookup key.
CREATE TABLE IF NOT EXISTS credentials (
  id           TEXT    PRIMARY KEY,
  platform     TEXT    NOT NULL,
  account_name TEXT    NOT NULL,
  keychain_key TEXT    NOT NULL UNIQUE,                 -- OS keychain entry name
  created_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credentials_platform ON credentials (platform);

-- ─── campaigns ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id           TEXT    PRIMARY KEY,
  name         TEXT    NOT NULL,
  platforms    TEXT    NOT NULL DEFAULT '[]',
  status       TEXT    NOT NULL DEFAULT 'active',
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns (status);
