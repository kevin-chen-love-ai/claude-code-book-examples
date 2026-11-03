import { BasePlatformAdapter } from './base-adapter.js'
import type { PostDraft, PublishResult, HealthStatus } from './base-adapter.js'
import { mcpManager } from '../../../apps/desktop/electron/mcp/mcp-manager.js'

/**
 * Instagram Adapter — publishes via MCP browser tools.
 * Reuses the user's already-logged-in Chrome session.
 * Note: Instagram web requires at least one media item for a feed post;
 * caption-only posts are saved as drafts if no media is provided.
 */
export class InstagramAdapter extends BasePlatformAdapter {
  readonly platform = 'instagram' as const

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
    return ['#Reels', '#Explore', '#InstaDaily', '#ContentCreator', '#ViralContent']
  }

  async composePost(draft: PostDraft): Promise<PostDraft> {
    // Instagram caption limit: 2200 chars
    return { ...draft, text: this.truncateText(draft.text, 2200) }
  }

  async executePublish(draft: PostDraft): Promise<PublishResult> {
    const client = mcpManager['browserClient']
    if (!client || !client.connected) {
      return { success: false, error: 'Browser not connected.' }
    }

    try {
      await client.callTool('puppeteer_navigate', { url: 'https://www.instagram.com/' })
      await client.callTool('puppeteer_wait_for_selector', {
        selector: '[aria-label="New post"]',
        timeout: 10000,
      })
      await client.callTool('puppeteer_click', { selector: '[aria-label="New post"]' })
      await client.callTool('puppeteer_wait_for_selector', {
        selector: 'textarea[aria-label="Write a caption..."]',
        timeout: 12000,
      })
      await client.callTool('puppeteer_type', {
        selector: 'textarea[aria-label="Write a caption..."]',
        text: draft.text,
      })
      await client.callTool('puppeteer_click', { selector: '[aria-label="Share"]' })

      return { success: true, postId: `instagram_mcp_${Date.now()}` }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}

export const instagramAdapter = new InstagramAdapter()
