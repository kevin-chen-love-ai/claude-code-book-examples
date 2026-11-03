-- Migration 010: Remove FK constraint from agent_runs.agent_id.
-- Reason: virtual/direct agent IDs (e.g. __direct_*) don't exist in the agents table,
-- causing episodic memory saves to fail with SQLITE_CONSTRAINT_FOREIGNKEY.

PRAGMA foreign_keys = OFF;

BEGIN;

CREATE TABLE agent_runs_new (
  id           TEXT    PRIMARY KEY,
  agent_id     TEXT    NOT NULL,
  status       TEXT    NOT NULL,
  steps        TEXT    NOT NULL DEFAULT '[]',
  tokens_used  INTEGER NOT NULL DEFAULT 0,
  duration_ms  INTEGER,
  started_at   INTEGER NOT NULL,
  finished_at  INTEGER,
  run_id       TEXT,
  outcome      TEXT,
  final_answer TEXT
);

INSERT INTO agent_runs_new SELECT * FROM agent_runs;

DROP TABLE agent_runs;

ALTER TABLE agent_runs_new RENAME TO agent_runs;

CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_id   ON agent_runs (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_started_at ON agent_runs (started_at);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status     ON agent_runs (status);

COMMIT;

PRAGMA foreign_keys = ON;
