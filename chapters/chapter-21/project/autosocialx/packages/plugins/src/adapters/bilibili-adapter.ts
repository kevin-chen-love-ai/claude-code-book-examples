import { BasePlatformAdapter } from './base-adapter.js'
import type { PostDraft, PublishResult, HealthStatus } from './base-adapter.js'
import { mcpManager } from '../../../apps/desktop/electron/mcp/mcp-manager.js'

/**
 * 哔哩哔哩 (Bilibili) Adapter — publishes 动态 (moment) posts via MCP browser tools.
 * Reuses the user's already-logged-in Chrome session.
 */
export class BilibiliAdapter extends BasePlatformAdapter {
  readonly platform = 'bilibili' as const

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
    return ['#哔哩哔哩', '#动态', '#UP主', '#科技', '#数码']
  }

  async composePost(draft: PostDraft): Promise<PostDraft> {
    // Bilibili 动态 limit: 2000 chars
    return { ...draft, text: this.truncateText(draft.text, 2000) }
  }

  async executePublish(draft: PostDraft): Promise<PublishResult> {
    const client = mcpManager['browserClient']
    if (!client || !client.connected) {
      return { success: false, error: 'Browser not connected.' }
    }

    try {
      // Navigate to 动态 (moments) publish page
      await client.callTool('puppeteer_navigate', { url: 'https://t.bilibili.com/' })
      await client.callTool('puppeteer_wait_for_selector', {
        selector: '.publish-textarea',
        timeout: 10000,
      })
      await client.callTool('puppeteer_click', { selector: '.publish-textarea' })
      await client.callTool('puppeteer_type', {
        selector: '.publish-textarea',
        text: draft.text,
      })
      await client.callTool('puppeteer_click', { selector: '.submit-btn' })

      return { success: true, postId: `bilibili_mcp_${Date.now()}` }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}

export const bilibiliAdapter = new BilibiliAdapter()
