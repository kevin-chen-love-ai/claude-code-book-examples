import { BasePlatformAdapter } from './base-adapter.js'
import type { PostDraft, PublishResult, HealthStatus } from './base-adapter.js'
import { mcpManager } from '../../../apps/desktop/electron/mcp/mcp-manager.js'

/**
 * Facebook Adapter — publishes posts via MCP browser tools.
 * Reuses the user's already-logged-in Chrome session.
 */
export class FacebookAdapter extends BasePlatformAdapter {
  readonly platform = 'facebook' as const

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
    return ['#Facebook', '#Community', '#Social', '#Trending', '#ShareNow']
  }

  async composePost(draft: PostDraft): Promise<PostDraft> {
    // Facebook post character limit: 63,206 chars
    return { ...draft, text: this.truncateText(draft.text, 63206) }
  }

  async executePublish(draft: PostDraft): Promise<PublishResult> {
    const client = mcpManager['browserClient']
    if (!client || !client.connected) {
      return { success: false, error: 'Browser not connected.' }
    }

    try {
      await client.callTool('puppeteer_navigate', { url: 'https://www.facebook.com/' })
      await client.callTool('puppeteer_wait_for_selector', {
        selector: "[aria-label=\"What's on your mind?\"]",
        timeout: 10000,
      })
      await client.callTool('puppeteer_click', {
        selector: "[aria-label=\"What's on your mind?\"]",
      })
      await client.callTool('puppeteer_wait_for_selector', {
        selector: 'div[role="textbox"][contenteditable="true"]',
        timeout: 8000,
      })
      await client.callTool('puppeteer_type', {
        selector: 'div[role="textbox"][contenteditable="true"]',
        text: draft.text,
      })
      await client.callTool('puppeteer_click', { selector: '[aria-label="Post"]' })

      return { success: true, postId: `facebook_mcp_${Date.now()}` }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}

export const facebookAdapter = new FacebookAdapter()
