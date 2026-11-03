import { BasePlatformAdapter } from './base-adapter.js'
import type { PostDraft, PublishResult, HealthStatus } from './base-adapter.js'
import { mcpManager } from '../../../apps/desktop/electron/mcp/mcp-manager.js'

/**
 * Pinterest Adapter — creates text/note pins via MCP browser tools.
 * Reuses the user's already-logged-in Chrome session on pinterest.com.
 */
export class PinterestAdapter extends BasePlatformAdapter {
  readonly platform = 'pinterest' as const

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
    return ['#Pinterest', '#Inspiration', '#DIY', '#HomeDecor', '#LifestyleTips']
  }

  async composePost(draft: PostDraft): Promise<PostDraft> {
    // Pinterest note/text pin description limit: 500 chars
    return { ...draft, text: this.truncateText(draft.text, 500) }
  }

  async executePublish(draft: PostDraft): Promise<PublishResult> {
    const client = mcpManager['browserClient']
    if (!client || !client.connected) {
      return { success: false, error: 'Browser not connected.' }
    }

    try {
      // Navigate to pin builder and select "Note" (text pin) type
      await client.callTool('puppeteer_navigate', {
        url: 'https://www.pinterest.com/pin-builder/',
      })
      await client.callTool('puppeteer_wait_for_selector', {
        selector: '[data-test-id="note-pin-type"]',
        timeout: 10000,
      })
      await client.callTool('puppeteer_click', { selector: '[data-test-id="note-pin-type"]' })
      await client.callTool('puppeteer_wait_for_selector', {
        selector: 'div[data-test-id="pin-draft-note"] [contenteditable]',
        timeout: 8000,
      })
      await client.callTool('puppeteer_type', {
        selector: 'div[data-test-id="pin-draft-note"] [contenteditable]',
        text: draft.text,
      })
      await client.callTool('puppeteer_click', {
        selector: '[data-test-id="publish-pin-button"]',
      })

      return { success: true, postId: `pinterest_mcp_${Date.now()}` }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}

export const pinterestAdapter = new PinterestAdapter()
