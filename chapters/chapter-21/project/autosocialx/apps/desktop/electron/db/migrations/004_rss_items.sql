-- Migration 004: RSS items local store with embedding support
CREATE TABLE IF NOT EXISTS rss_items (
    id          TEXT    PRIMARY KEY,
    feed_id     TEXT    NOT NULL DEFAULT '',
    title       TEXT    NOT NULL DEFAULT '',
    content     TEXT    NOT NULL DEFAULT '',
    url         TEXT    NOT NULL,
    pub_date    TEXT    NOT NULL DEFAULT '',
    source      TEXT    NOT NULL DEFAULT '',
    category    TEXT    NOT NULL DEFAULT '',
    embedding   TEXT,           -- JSON float32[], NULL until embedded
    embedded_at INTEGER,        -- unix seconds, NULL if not embedded yet
    fetched_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rss_items_url       ON rss_items(url);
CREATE INDEX        IF NOT EXISTS idx_rss_items_fetched   ON rss_items(fetched_at DESC);
CREATE INDEX        IF NOT EXISTS idx_rss_items_unembedded ON rss_items(fetched_at DESC) WHERE embedding IS NULL;
