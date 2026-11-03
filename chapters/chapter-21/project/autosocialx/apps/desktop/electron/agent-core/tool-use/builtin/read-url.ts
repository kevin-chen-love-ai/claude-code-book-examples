import type { ToolDefinition } from '../../types.js'
import { workerBridge } from '../../../workers/worker-bridge.js'

export const readUrlTool: ToolDefinition = {
  name: 'read_url',
  description:
    'Fetch and read the main text content of any web page URL. ' +
    'Returns the page title and extracted body text (up to 6000 characters). ' +
    'Use this after web_search to read the full content of a result URL, ' +
    'or to read any article, blog post, or documentation page.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'Full URL of the page to read (must start with http:// or https://)',
      },
    },
    required: ['url'],
  },
  requiredPermission: 'tool:read_url',
  handler: async (args, ctx) => {
    const url = typeof args['url'] === 'string' ? args['url'] : ''
    if (!url.startsWith('http')) {
      return { error: 'Invalid URL: must start with http:// or https://' }
    }

    try {
      const result = await workerBridge.call<{
        url: string
        title: string
        content: string
        wordCount: number
        timestamp: string
        error?: string
      }>('fetch.url', { url })

      if (result.error) {
        return { url, error: result.error, content: '' }
      }

      return {
        url: result.url,
        title: result.title,
        content: result.content,
        wordCount: result.wordCount,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Log but don't crash — return error so LLM can proceed with own knowledge
      void ctx.agentId  // suppress unused warning
      return { url, error: `Failed to fetch: ${msg}`, content: '' }
    }
  },
}
