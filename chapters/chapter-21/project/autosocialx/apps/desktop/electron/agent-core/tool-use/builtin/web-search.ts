import type { ToolDefinition } from '../../types'
import { getToolKey } from '../tool-keys.js'

export const webSearchTool: ToolDefinition = {
  name: 'web_search',
  description: 'Search the web for current information. Uses Tavily Search API for real-time results.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5)',
      },
    },
    required: ['query'],
  },
  requiredPermission: 'tool:web_search',
  handler: async (args: Record<string, unknown>) => {
    const query = typeof args['query'] === 'string' ? args['query'] : ''
    const maxResults = typeof args['maxResults'] === 'number' ? args['maxResults'] : 5

    // ── Primary: Tavily Search API ─────────────────────────────────────────────
    const tavilyKey = getToolKey('tavily')
    if (tavilyKey) {
      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: tavilyKey,
            query,
            max_results: maxResults,
            search_depth: 'basic',
            include_answer: false,
          }),
          signal: AbortSignal.timeout(15000),
        })
        if (res.ok) {
          const data = await res.json() as {
            results?: Array<{ title: string; url: string; content: string }>
          }
          const results = (data.results ?? []).map(r => ({
            title: r.title,
            url: r.url,
            snippet: r.content,
          }))
          if (results.length > 0) return { results, source: 'tavily' }
        }
      } catch (err) {
        console.warn('[web_search] Tavily failed, falling back:', err)
      }
    }

    // ── Fallback 1: DuckDuckGo Instant Answer API ──────────────────────────────
    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
      const res = await fetch(ddgUrl, {
        headers: { 'User-Agent': 'AutoSocialX/1.0' },
        signal: AbortSignal.timeout(5000),
      })
      const data = await res.json() as {
        AbstractText?: string
        AbstractURL?: string
        AbstractSource?: string
        RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>
      }

      const results: { title: string; url: string; snippet: string }[] = []
      if (data.AbstractText) {
        results.push({
          title: data.AbstractSource ?? query,
          url: data.AbstractURL ?? '',
          snippet: data.AbstractText,
        })
      }
      for (const topic of (data.RelatedTopics ?? []).slice(0, maxResults - results.length)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] ?? topic.Text,
            url: topic.FirstURL,
            snippet: topic.Text,
          })
        }
      }
      if (results.length > 0) return { results, source: 'duckduckgo' }
    } catch {
      // DuckDuckGo unavailable
    }

    // ── Fallback 2: Wikipedia search API ──────────────────────────────────────
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=${maxResults}&origin=*`
      const res = await fetch(wikiUrl, {
        headers: { 'User-Agent': 'AutoSocialX/1.0' },
        signal: AbortSignal.timeout(6000),
      })
      const data = await res.json() as {
        query?: { search?: Array<{ title: string; snippet: string; pageid: number }> }
      }
      const items = data.query?.search ?? []
      if (items.length > 0) {
        return {
          results: items.map(item => ({
            title: item.title,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
            snippet: item.snippet.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#039;/g, "'"),
          })),
          source: 'wikipedia',
        }
      }
    } catch {
      // Wikipedia unavailable
    }

    return {
      results: [],
      note: 'Web search returned no results. Generate the post directly from your own knowledge and expertise.',
    }
  },
}
