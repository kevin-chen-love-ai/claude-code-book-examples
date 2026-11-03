import type { ToolDefinition } from '../../types'
import Parser from 'rss-parser'
import { rssStore } from '../../memory/rss-store'
import { rssVectorStore } from '../../memory/rss-vector-store'
import { embeddingService } from '../../memory/embedding-service'

// 内置 rss_reader 工具
// inputSchema: {
//   url: string (required — use "@saved" for local store),
//   query?: string (semantic search query for local store),
//   maxItems?: number (default 10)
// }
// handler:
//   "@saved" + query → semantic / keyword search from local SQLite store
//   "@saved" (no query) → recent items from local SQLite store
//   "@saved" (local store empty) → live fetch all subscribed sources (fallback)
//   specific URL → live fetch via rss-parser

export const rssReaderTool: ToolDefinition = {
  name: 'rss_reader',
  description:
    'Read RSS feed content. Use url="@saved" to search locally stored articles (faster, offline). ' +
    'Add a query parameter for semantic search to find articles relevant to a topic. ' +
    'Pass a specific URL to live-fetch that feed directly.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL of the RSS feed, or "@saved" to search locally stored articles',
      },
      query: {
        type: 'string',
        description:
          'Optional: semantic search query. Used only with url="@saved". ' +
          'Returns articles most relevant to this topic from the local store.',
      },
      maxItems: {
        type: 'number',
        description: 'Maximum number of items to return (default: 10)',
      },
    },
    required: ['url'],
  },
  requiredPermission: 'tool:rss_reader',
  handler: async (args: Record<string, unknown>, _ctx) => {
    const url = typeof args['url'] === 'string' ? args['url'] : ''
    const query = typeof args['query'] === 'string' ? args['query'].trim() : ''
    const maxItems = typeof args['maxItems'] === 'number' ? args['maxItems'] : 10

    // ── @saved: use local SQLite store ──────────────────────────────────────
    if (url === '@saved') {
      const stats = rssVectorStore.getStats()

      // No local data → live fallback for backward compatibility
      if (stats.total === 0) {
        return liveFetchAll(maxItems)
      }

      let items: ReturnType<typeof rssVectorStore.getRecent>

      if (query) {
        if (stats.embedded > 0) {
          // Semantic search
          const qEmb = await embeddingService.embed(query)
          items = qEmb
            ? rssVectorStore.semanticSearch(qEmb, maxItems)
            : rssVectorStore.keywordSearch(query, maxItems)
        } else {
          // No embeddings yet → keyword search
          items = rssVectorStore.keywordSearch(query, maxItems)
        }
      } else {
        // No query → return most recent items
        items = rssVectorStore.getRecent(maxItems * 2)
      }

      return {
        items: items.map(i => ({
          title: i.title,
          link: i.url,
          pubDate: i.pubDate,
          summary: i.content,
          source: i.source,
          category: i.category,
        })),
        source: 'local',
        total: stats.total,
        embedded: stats.embedded,
      }
    }

    // ── Single URL: live fetch ───────────────────────────────────────────────
    const FEED_TIMEOUT_MS = 8000
    const parser = new Parser({ timeout: FEED_TIMEOUT_MS })
    try {
      const feed = await parser.parseURL(url)
      const items = (feed.items ?? []).slice(0, maxItems).map((item) => ({
        title: item.title ?? '',
        link: item.link ?? '',
        pubDate: item.pubDate ?? '',
        summary: item.contentSnippet ?? item.summary ?? '',
      }))
      return { items }
    } catch (err) {
      return {
        items: [],
        error: `Failed to fetch feed: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  },
}

// ── Live fallback for @saved when local store is empty ──────────────────────
async function liveFetchAll(maxItems: number) {
  const sources = await rssStore.list()
  if (sources.length === 0) {
    return { items: [], note: 'No RSS feed sources configured. Add some in Settings → RSS Feeds.' }
  }

  const FEED_TIMEOUT_MS = 8000
  const parser = new Parser({ timeout: FEED_TIMEOUT_MS })

  const allItems: Array<{
    title: string; link: string; pubDate: string; summary: string; source: string
  }> = []

  const results = await Promise.allSettled(
    sources.map(async (src) => {
      try {
        const feed = await parser.parseURL(src.url)
        return (feed.items ?? []).slice(0, maxItems).map(item => ({
          title: item.title ?? '',
          link: item.link ?? '',
          pubDate: item.pubDate ?? '',
          summary: item.contentSnippet ?? item.summary ?? '',
          source: src.title,
        }))
      } catch {
        return []
      }
    })
  )

  for (const r of results) {
    if (r.status === 'fulfilled') allItems.push(...r.value)
  }

  allItems.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0
    const db2 = b.pubDate ? new Date(b.pubDate).getTime() : 0
    return db2 - da
  })

  return {
    items: allItems.slice(0, maxItems * 3),
    feedCount: sources.length,
    source: 'live',
  }
}
