-- Migration 008: Decouple agents from campaigns
-- Agents and campaigns are now completely independent — no FK relationship.
-- Campaign-triggered content is tracked via content.campaign_id instead.

-- Drop campaign_id from agents table (SQLite 3.35+)
-- Safe: column is nullable TEXT with no index/constraint
ALTER TABLE agents DROP COLUMN IF EXISTS campaign_id;
