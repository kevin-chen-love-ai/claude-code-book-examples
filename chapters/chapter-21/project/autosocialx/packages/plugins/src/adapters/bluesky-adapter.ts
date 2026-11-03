import { BasePlatformAdapter } from './base-adapter.js'
import type { PostDraft, PublishResult, HealthStatus } from './base-adapter.js'
import { mcpManager } from '../../../apps/desktop/electron/mcp/mcp-manager.js'

/**
 * Bluesky Adapter — publishes via MCP browser tools on bsky.app.
 * Reuses the user's already-logged-in Chrome session.
 */
export class BlueskyAdapter extends BasePlatformAdapter {
  readonly platform = 'bluesky' as const

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
    return ['#Bluesky', '#ATProto', '#OpenSocial', '#Fediverse', '#BuildInPublic']
  }

  async composePost(draft: PostDraft): Promise<PostDraft> {
    // Bluesky character limit: 300 chars
    return { ...draft, text: this.truncateText(draft.text, 300) }
  }

  async executePublish(draft: PostDraft): Promise<PublishResult> {
    const client = mcpManager['browserClient']
    if (!client || !client.connected) {
      return { success: false, error: 'Browser not connected.' }
    }

    try {
      await client.callTool('puppeteer_navigate', { url: 'https://bsky.app/' })
      await client.callTool('puppeteer_wait_for_selector', {
        selector: '[aria-label="New post"]',
        timeout: 10000,
      })
      await client.callTool('puppeteer_click', { selector: '[aria-label="New post"]' })
      await client.callTool('puppeteer_wait_for_selector', {
        selector: 'div[data-testid="composerTextInput"]',
        timeout: 8000,
      })
      await client.callTool('puppeteer_type', {
        selector: 'div[data-testid="composerTextInput"]',
        text: draft.text,
      })
      await client.callTool('puppeteer_click', {
        selector: 'button[data-testid="composerPublishBtn"]',
      })

      return { success: true, postId: `bluesky_mcp_${Date.now()}` }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}

export const blueskyAdapter = new BlueskyAdapter()
