import { BasePlatformAdapter } from './base-adapter.js'
import type { PostDraft, PublishResult, HealthStatus } from './base-adapter.js'
import { mcpManager } from '../../../apps/desktop/electron/mcp/mcp-manager.js'

/**
 * TikTok Adapter — publishes text posts via MCP browser tools.
 * Requires the user to be logged in on TikTok in the connected Chrome session.
 */
export class TikTokAdapter extends BasePlatformAdapter {
  readonly platform = 'tiktok' as const

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
    return ['#FYP', '#ForYou', '#Viral', '#TikTokTrend', '#ContentCreator']
  }

  async composePost(draft: PostDraft): Promise<PostDraft> {
    // TikTok text post description limit: 2200 chars
    return { ...draft, text: this.truncateText(draft.text, 2200) }
  }

  async executePublish(draft: PostDraft): Promise<PublishResult> {
    const client = mcpManager['browserClient']
    if (!client || !client.connected) {
      return { success: false, error: 'Browser not connected.' }
    }

    try {
      await client.callTool('puppeteer_navigate', {
        url: 'https://www.tiktok.com/creator-center/upload/text',
      })
      await client.callTool('puppeteer_wait_for_selector', {
        selector: 'div[contenteditable="true"]',
        timeout: 12000,
      })
      await client.callTool('puppeteer_type', {
        selector: 'div[contenteditable="true"]',
        text: draft.text,
      })
      await client.callTool('puppeteer_click', {
        selector: 'button[data-testid="btn_post"]',
      })

      return { success: true, postId: `tiktok_mcp_${Date.now()}` }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}

export const tiktokAdapter = new TikTokAdapter()
