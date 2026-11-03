-- ─── 007_agent_runs_episodic.sql ─────────────────────────────────────────────
-- The episodic-memory.ts store writes run_id / outcome / final_answer columns
-- that were never added to agent_runs via a migration.
-- ADD COLUMN is idempotent-safe: SQLite ignores duplicate column errors when
-- wrapped in a try/catch in the JS migration runner.

ALTER TABLE agent_runs ADD COLUMN run_id       TEXT;
ALTER TABLE agent_runs ADD COLUMN outcome      TEXT;
ALTER TABLE agent_runs ADD COLUMN final_answer TEXT;

-- Back-fill: treat existing rows with status='completed' as outcome='success',
-- everything else as 'failed'.
UPDATE agent_runs SET outcome = CASE WHEN status = 'completed' THEN 'success' ELSE 'failed' END
WHERE outcome IS NULL;
