import type { ToolDefinition } from '../../types'
import { semanticMemory } from '../../memory/semantic-memory'

// 内置 memory_recall 工具
// inputSchema: { query: string (required), topK?: number (default 5) }
// handler: semanticMemory.search(query, ctx.agentId, topK), 返回 { chunks: [...] }
// requiredPermission: 'tool:memory_recall'

export const memoryRecallTool: ToolDefinition = {
  name: 'memory_recall',
  description: 'Search the agent\'s semantic memory for relevant past knowledge or context.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to find relevant memories',
      },
      topK: {
        type: 'number',
        description: 'Number of top results to return (default: 5)',
      },
    },
    required: ['query'],
  },
  requiredPermission: 'tool:memory_recall',
  handler: async (args: Record<string, unknown>, ctx) => {
    const query = typeof args['query'] === 'string' ? args['query'] : ''
    const topK = typeof args['topK'] === 'number' ? args['topK'] : 5

    const chunks = await semanticMemory.search(query, ctx.agentId, topK)
    return { chunks }
  },
}
