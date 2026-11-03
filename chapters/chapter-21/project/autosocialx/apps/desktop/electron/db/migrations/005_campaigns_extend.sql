-- Extend campaigns table with persona, cover image, channel list, schedule and description
ALTER TABLE campaigns ADD COLUMN persona_id      TEXT;
ALTER TABLE campaigns ADD COLUMN cover_image_url TEXT;
ALTER TABLE campaigns ADD COLUMN channel_ids     TEXT NOT NULL DEFAULT '[]';
ALTER TABLE campaigns ADD COLUMN scheduled_at    INTEGER;
ALTER TABLE campaigns ADD COLUMN description     TEXT NOT NULL DEFAULT '';
