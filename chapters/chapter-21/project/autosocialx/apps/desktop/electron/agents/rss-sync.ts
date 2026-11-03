/**
 * RssSyncService — background cron service that:
 *   1. Fetches all subscribed RSS feeds every 2 hours
 *   2. Upserts new items into the rss_items SQLite table
 *   3. Asynchronously generates embeddings for unembedded items in batches
 *
 * Batching: 10 items at a time, concurrency 5, to avoid hammering Ollama.
 */

import * as cron from 'node-cron'
import type { ScheduledTask } from 'node-cron'
import Parser from 'rss-parser'
import * as crypto from 'node:crypto'
import { rssStore } from '../agent-core/memory/rss-store'
import { rssVectorStore } from '../agent-core/memory/rss-vector-store'
import { embeddingService } from '../agent-core/memory/embedding-service'
import { configStore } from '../config-store'

const FEED_TIMEOUT_MS = 10_000
const EMBED_BATCH_SIZE = 10
const EMBED_CONCURRENCY = 5

export interface SyncResult {
    feedsProcessed: number
    newItems: number
    errors: number
    embeddedItems: number
}

class RssSyncService {
    private job: ScheduledTask | null = null
    private syncing = false
    private lastResult: SyncResult | null = null

    /** Convert hours (1|2|4|6|12|24) to a cron expression. */
    private static hoursToCron(hours: number): string {
        if (hours === 1) return '0 * * * *'
        if (hours === 24) return '0 0 * * *'
        return `0 */${hours} * * *`
    }

    /**
     * Start the background sync cron.
     * Interval is read from configStore.rssSyncIntervalHours (default 2h).
     * Also schedules a one-time embedding pass 5 seconds after startup.
     */
    start(): void {
        // Initial embedding pass 5s after startup (no full RSS fetch needed)
        setTimeout(() => {
            void this.embedPending().then(n => {
                if (n > 0) console.log(`[RssSync] Startup: embedded ${n} pending item(s)`)
            })
        }, 5_000)

        const hours = configStore.get('rssSyncIntervalHours') ?? 2
        this.job = cron.schedule(RssSyncService.hoursToCron(hours), () => {
            void this.syncNow().then(r =>
                console.log(`[RssSync] Cron: +${r.newItems} items, ${r.embeddedItems} embedded, ${r.errors} errors`)
            )
        })

        console.log(`[RssSync] Started (cron: every ${hours}h)`)
    }

    /** Restart the cron with a new interval. Saves to config. */
    setIntervalHours(hours: number): void {
        configStore.set('rssSyncIntervalHours', hours)
        this.stop()
        const started = this.job !== null
        if (started || true) {
            this.job = cron.schedule(RssSyncService.hoursToCron(hours), () => {
                void this.syncNow().then(r =>
                    console.log(`[RssSync] Cron: +${r.newItems} items, ${r.embeddedItems} embedded, ${r.errors} errors`)
                )
            })
            console.log(`[RssSync] Interval updated → every ${hours}h`)
        }
    }

    stop(): void {
        this.job?.stop()
        this.job = null
    }

    getLastResult(): SyncResult | null {
        return this.lastResult
    }

    /**
     * Full sync: fetch all subscribed feeds, store new items, then embed pending.
     * Re-entrant guard prevents overlapping runs.
     */
    async syncNow(): Promise<SyncResult> {
        if (this.syncing) {
            console.log('[RssSync] Already syncing, skipping')
            return this.lastResult ?? { feedsProcessed: 0, newItems: 0, errors: 0, embeddedItems: 0 }
        }
        this.syncing = true

        const result: SyncResult = { feedsProcessed: 0, newItems: 0, errors: 0, embeddedItems: 0 }

        try {
            const sources = await rssStore.list()
            if (sources.length === 0) {
                console.log('[RssSync] No RSS sources configured — skipping sync')
                return result
            }

            const parser = new Parser({ timeout: FEED_TIMEOUT_MS })

            const fetchResults = await Promise.allSettled(
                sources.map(async (src) => {
                    try {
                        const feed = await parser.parseURL(src.url)
                        const items = (feed.items ?? []).slice(0, 20)   // max 20 per feed
                        for (const item of items) {
                            const url = item.link ?? item.guid
                            if (!url) continue
                            const inserted = rssVectorStore.upsert({
                                id: crypto.createHash('sha1').update(url).digest('hex'),
                                feedId: src.id,
                                title: item.title ?? '',
                                content: (item.contentSnippet ?? item.summary ?? '').slice(0, 1000),
                                url,
                                pubDate: item.pubDate ?? item.isoDate ?? '',
                                source: src.title,
                                category: src.category,
                            })
                            if (inserted) result.newItems++
                        }
                        result.feedsProcessed++
                    } catch (err) {
                        console.warn(`[RssSync] Failed to fetch ${src.url}:`, err instanceof Error ? err.message : err)
                        result.errors++
                    }
                })
            )

            // Count actual settled errors (from Promise.allSettled rejections, though our inner try catches them)
            result.errors += fetchResults.filter(r => r.status === 'rejected').length

            // Clean up old articles (> 30 days)
            const deleted = rssVectorStore.deleteOlderThan(30)
            if (deleted > 0) console.log(`[RssSync] Pruned ${deleted} old item(s)`)

            // Embed pending items
            result.embeddedItems = await this.embedPending()
        } finally {
            this.syncing = false
            this.lastResult = result
        }

        return result
    }

    /**
     * Embed all items that don't have an embedding yet.
     * Processes in batches of EMBED_BATCH_SIZE with concurrency EMBED_CONCURRENCY.
     * Returns total number of items successfully embedded.
     */
    async embedPending(batchSize = EMBED_BATCH_SIZE): Promise<number> {
        const available = await embeddingService.isAvailable()
        if (!available) {
            console.log('[RssSync] Ollama nomic-embed-text not available — skipping embedding')
            return 0
        }

        let totalEmbedded = 0

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const batch = rssVectorStore.getUnembedded(batchSize)
            if (batch.length === 0) break

            // Process EMBED_CONCURRENCY items at a time
            for (let i = 0; i < batch.length; i += EMBED_CONCURRENCY) {
                const chunk = batch.slice(i, i + EMBED_CONCURRENCY)
                await Promise.all(
                    chunk.map(async (item) => {
                        const text = `${item.title}\n${item.content}`
                        const emb = await embeddingService.embed(text)
                        if (emb) {
                            rssVectorStore.updateEmbedding(item.id, emb)
                            totalEmbedded++
                        }
                    })
                )
            }

            // If we got a full batch, there might be more — continue loop
            if (batch.length < batchSize) break
        }

        return totalEmbedded
    }
}

export const rssSyncService = new RssSyncService()
