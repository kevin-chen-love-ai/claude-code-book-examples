import type { ToolDefinition } from '../../types.js'
import { browserUseWorker } from '../../../workers/browser-use-worker.js'
import { llmGateway } from '../../llm-gateway.js'

export const browserDoTool: ToolDefinition = {
  name: 'browser_do',
  description:
    'Use an AI browser agent to accomplish a web task described in natural language. ' +
    'The agent autonomously navigates, clicks, and extracts information from web pages. ' +
    'Use this for tasks like: reading social media trends, scraping competitor content, ' +
    'extracting structured data from websites, or any multi-step web interaction. ' +
    'Returns the final result and all visited URLs. ' +
    'Requires Python 3.11+ with browser-use installed.',
  inputSchema: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description:
          'Natural language description of what to do in the browser. ' +
          'Be specific about what information to extract or what action to take. ' +
          'Example: "Go to twitter.com and find the top 5 trending topics in the AI category"',
      },
      maxSteps: {
        type: 'number',
        description: 'Maximum number of browser actions to take (default: 20, max: 50)',
      },
    },
    required: ['task'],
  },
  requiredPermission: 'tool:browser_do',
  handler: async (args, _ctx) => {
    const task = typeof args['task'] === 'string' ? args['task'] : ''
    const maxSteps = typeof args['maxSteps'] === 'number' ? Math.min(args['maxSteps'], 50) : 20

    if (!task) {
      return { success: false, error: 'task is required' }
    }

    // Resolve LLM credentials from gateway (prefers openai-compat providers for browser-use)
    // Priority: openai → bailian → first available → env fallback
    const providerPreference = ['openai', 'bailian', 'deepseek']
    const providerKey =
      providerPreference.find(k => llmGateway.hasProvider(k)) ??
      llmGateway.getFirstProvider() ??
      'openai'

    const creds = llmGateway.getProviderCredentials(providerKey)
    const apiKey = creds?.apiKey || process.env['OPENAI_API_KEY'] || ''
    const baseUrl = creds?.baseURL || process.env['OPENAI_BASE_URL'] || 'https://api.openai.com/v1'
    const model = llmGateway.getDefaultModel(providerKey)

    if (!apiKey) {
      return {
        success: false,
        error: 'No LLM API key available for browser_do. Configure an LLM provider in Settings.',
      }
    }

    const result = await browserUseWorker.call({ task, maxSteps, apiKey, baseUrl, model })

    return {
      success: result.success,
      result: result.result,
      urls: result.urls,
      steps: result.steps,
      ...(result.error ? { error: result.error } : {}),
    }
  },
}
