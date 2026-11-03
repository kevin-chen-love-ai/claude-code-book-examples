-- ADD COLUMN provider
ALTER TABLE agents ADD COLUMN provider TEXT NOT NULL DEFAULT 'claude';

-- ADD COLUMN model
ALTER TABLE agents ADD COLUMN model TEXT NOT NULL DEFAULT 'claude-3-5-sonnet-latest';

-- ADD COLUMN custom_instructions (acting as topic/system prompt modifier)
ALTER TABLE agents ADD COLUMN custom_instructions TEXT NOT NULL DEFAULT '';
