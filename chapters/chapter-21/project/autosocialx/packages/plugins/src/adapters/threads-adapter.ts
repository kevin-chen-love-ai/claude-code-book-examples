import { BasePlatformAdapter } from './base-adapter.js'
import type { PostDraft, PublishResult, HealthStatus } from './base-adapter.js'
import { mcpManager } from '../../../apps/desktop/electron/mcp/mcp-manager.js'

/**
 * Threads Adapter — publishes via MCP browser tools.
 * Reuses the user's already-logged-in Chrome session on threads.net.
 */
export class ThreadsAdapter extends BasePlatformAdapter {
  readonly platform = 'threads' as const

  async checkHealth(): Promise<HealthStatus> {
    const status = mcpManager.getStatus()
    return {
      healthy: status.connected,
      reason: status.connected
        ? `Browser MCP connected (${status.mode})`
        : 'Browser not connected — run Chrome with --remote-debugging-port=9222',
      checkedAt: new Date(),
    }
  }

  async fetchTrends(): Promise<string[]> {
    return ['#Threads', '#NewThread', '#Social', '#Community', '#Conversation']
  }

  async composePost(draft: PostDraft): Promise<PostDraft> {
    // Threads character limit: 500 chars
    return { ...draft, text: this.truncateText(draft.text, 500) }
  }

  async executePublish(draft: PostDraft): Promise<PublishResult> {
    const client = mcpManager['browserClient']
    if (!client || !client.connected) {
      return { success: false, error: 'Browser not connected.' }
    }

    try {
      await client.callTool('puppeteer_navigate', { url: 'https://www.threads.net/' })
      await client.callTool('puppeteer_wait_for_selector', {
        selector: '[aria-label="New thread"]',
        timeout: 10000,
      })
      await client.callTool('puppeteer_click', { selector: '[aria-label="New thread"]' })
      await client.callTool('puppeteer_wait_for_selector', {
        selector: 'div[contenteditable="true"][role="textbox"]',
        timeout: 8000,
      })
      await client.callTool('puppeteer_type', {
        selector: 'div[contenteditable="true"][role="textbox"]',
        text: draft.text,
      })
      await client.callTool('puppeteer_click', {
        selector: 'div[role="button"]:has-text("Post")',
      })

      return { success: true, postId: `threads_mcp_${Date.now()}` }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}

export const threadsAdapter = new ThreadsAdapter()
