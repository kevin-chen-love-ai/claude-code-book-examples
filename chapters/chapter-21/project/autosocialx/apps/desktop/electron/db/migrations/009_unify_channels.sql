-- Migration 009: Replace credential-based channels table with lightweight publishing destinations.
-- Channels are now purely n8n webhook config holders — no accounts, no keychain.

PRAGMA foreign_keys = OFF;

BEGIN;

DROP TABLE IF EXISTS channels;

CREATE TABLE channels (
  id          TEXT    PRIMARY KEY,
  platform    TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  webhook_url TEXT,
  config      TEXT    NOT NULL DEFAULT '{}',
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_channels_platform ON channels (platform);
CREATE INDEX IF NOT EXISTS idx_channels_enabled  ON channels (enabled);

-- Seed 8 built-in platforms
INSERT INTO channels (id, platform, name, enabled, webhook_url, config, created_at) VALUES
  ('builtin-x',           'x',           'X (Twitter)', 1, NULL, '{}', unixepoch()),
  ('builtin-linkedin',    'linkedin',    'LinkedIn',    1, NULL, '{}', unixepoch()),
  ('builtin-instagram',   'instagram',   'Instagram',   1, NULL, '{}', unixepoch()),
  ('builtin-facebook',    'facebook',    'Facebook',    1, NULL, '{}', unixepoch()),
  ('builtin-pinterest',   'pinterest',   'Pinterest',   1, NULL, '{}', unixepoch()),
  ('builtin-discord',     'discord',     'Discord',     1, NULL, '{}', unixepoch()),
  ('builtin-slack',       'slack',       'Slack',       1, NULL, '{}', unixepoch()),
  ('builtin-xiaohongshu', 'xiaohongshu', '小红书',        1, NULL, '{}', unixepoch());

COMMIT;

PRAGMA foreign_keys = ON;
