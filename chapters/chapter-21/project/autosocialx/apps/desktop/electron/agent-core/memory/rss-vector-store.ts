/**
 * RssVectorStore — SQLite-backed store for RSS items with vector search.
 *
 * Storage layout (table: rss_items):
 *   id, feed_id, title, content, url, pub_date, source, category,
 *   embedding TEXT (JSON float32[]), embedded_at INTEGER, fetched_at INTEGER
 *
 * Search strategy:
 *   - If embeddings available → cosine similarity (JS-side, <5000 rows ~5ms)
 *   - Fallback → simple LIKE keyword search
 */

import type Database from 'better-sqlite3'
import { embeddingService } from './embedding-service'

export interface RssItemRow {
    id: string
    feedId: string
    title: string
    content: string
    url: string
    pubDate: string
    source: string
    category: string
    embedding: number[] | null
    embeddedAt: Date | null
    fetchedAt: Date
}

interface DbRow {
    id: string
    feed_id: string
    title: string
    content: string
    url: string
    pub_date: string
    source: string
    category: string
    embedding: string | null
    embedded_at: number | null
    fetched_at: number
}

function rowToItem(row: DbRow): RssItemRow {
    return {
        id: row.id,
        feedId: row.feed_id,
        title: row.title,
        content: row.content,
        url: row.url,
        pubDate: row.pub_date,
        source: row.source,
        category: row.category,
        embedding: row.embedding ? (JSON.parse(row.embedding) as number[]) : null,
        embeddedAt: row.embedded_at ? new Date(row.embedded_at * 1000) : null,
        fetchedAt: new Date(row.fetched_at * 1000),
    }
}

class RssVectorStore {
    private db: Database.Database | null = null

    init(db: Database.Database): void {
        this.db = db
    }

    private getDb(): Database.Database {
        if (!this.db) throw new Error('[RssVectorStore] not initialized — call init(db) first')
        return this.db
    }

    /** Insert new item; silently ignore if URL already exists (UNIQUE constraint).
     *  Returns true if the row was newly inserted, false if it was a duplicate. */
    upsert(item: Omit<RssItemRow, 'embedding' | 'embeddedAt' | 'fetchedAt'>): boolean {
        const db = this.getDb()
        const result = db.prepare(`
            INSERT OR IGNORE INTO rss_items
                (id, feed_id, title, content, url, pub_date, source, category, fetched_at)
            VALUES
                (@id, @feedId, @title, @content, @url, @pubDate, @source, @category, @fetchedAt)
        `).run({
            id: item.id,
            feedId: item.feedId,
            title: item.title,
            content: item.content,
            url: item.url,
            pubDate: item.pubDate,
            source: item.source,
            category: item.category,
            fetchedAt: Math.floor(Date.now() / 1000),
        })
        return result.changes > 0
    }

    /** Persist computed embedding for an item. */
    updateEmbedding(id: string, embedding: number[]): void {
        const db = this.getDb()
        db.prepare(`
            UPDATE rss_items
            SET embedding = @emb, embedded_at = @now
            WHERE id = @id
        `).run({
            id,
            emb: JSON.stringify(embedding),
            now: Math.floor(Date.now() / 1000),
        })
    }

    /** Return items that have no embedding yet, newest first. */
    getUnembedded(limit = 50): RssItemRow[] {
        const db = this.getDb()
        const rows = db.prepare(`
            SELECT * FROM rss_items
            WHERE embedding IS NULL
            ORDER BY fetched_at DESC
            LIMIT ?
        `).all(limit) as DbRow[]
        return rows.map(rowToItem)
    }

    /** Return most recent items regardless of embedding status. */
    getRecent(limit = 30): RssItemRow[] {
        const db = this.getDb()
        const rows = db.prepare(`
            SELECT * FROM rss_items
            ORDER BY fetched_at DESC
            LIMIT ?
        `).all(limit) as DbRow[]
        return rows.map(rowToItem)
    }

    /**
     * Semantic search: load all embedded items, compute cosine similarity in JS,
     * return top-K sorted by score descending.
     */
    semanticSearch(queryEmbedding: number[], topK = 5): RssItemRow[] {
        const db = this.getDb()
        const rows = db.prepare(`
            SELECT * FROM rss_items
            WHERE embedding IS NOT NULL
            ORDER BY fetched_at DESC
            LIMIT 5000
        `).all() as DbRow[]

        const scored = rows
            .map(row => {
                const emb = row.embedding ? (JSON.parse(row.embedding) as number[]) : null
                const score = emb ? embeddingService.cosineSimilarity(queryEmbedding, emb) : 0
                return { row, score }
            })
            .filter(({ score }) => score > 0.3)   // low-quality cutoff
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)

        return scored.map(({ row }) => rowToItem(row))
    }

    /**
     * Keyword fallback: SQL LIKE search on title + content.
     */
    keywordSearch(query: string, topK = 5): RssItemRow[] {
        const db = this.getDb()
        const terms = query.trim().split(/\s+/).filter(Boolean).slice(0, 5)
        if (terms.length === 0) return this.getRecent(topK)

        // Build WHERE clause: each term must appear in title OR content
        const conditions = terms.map(() => `(title LIKE ? OR content LIKE ?)`).join(' AND ')
        const params = terms.flatMap(t => [`%${t}%`, `%${t}%`])

        const rows = db.prepare(`
            SELECT * FROM rss_items
            WHERE ${conditions}
            ORDER BY fetched_at DESC
            LIMIT ?
        `).all(...params, topK) as DbRow[]

        return rows.map(rowToItem)
    }

    getStats(): { total: number; embedded: number; lastFetchedAt: number | null } {
        const db = this.getDb()
        const row = db.prepare(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN embedding IS NOT NULL THEN 1 ELSE 0 END) AS embedded,
                MAX(fetched_at) AS lastFetchedAt
            FROM rss_items
        `).get() as { total: number; embedded: number; lastFetchedAt: number | null }
        return row
    }

    /** Delete items older than N days. Returns count of deleted rows. */
    deleteOlderThan(days = 30): number {
        const db = this.getDb()
        const cutoff = Math.floor(Date.now() / 1000) - days * 86400
        const result = db.prepare(`
            DELETE FROM rss_items WHERE fetched_at < ?
        `).run(cutoff)
        return result.changes
    }
}

export const rssVectorStore = new RssVectorStore()
