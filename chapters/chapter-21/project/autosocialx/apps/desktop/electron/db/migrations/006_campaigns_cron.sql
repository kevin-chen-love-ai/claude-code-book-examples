-- Replace one-time scheduled_at with recurring cron_expr on campaigns
ALTER TABLE campaigns ADD COLUMN cron_expr TEXT;
ALTER TABLE campaigns ADD COLUMN cron_status TEXT NOT NULL DEFAULT 'active';
