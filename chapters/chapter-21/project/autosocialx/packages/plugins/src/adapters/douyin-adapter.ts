import { BasePlatformAdapter } from './base-adapter.js'
import type { PostDraft, PublishResult, HealthStatus } from './base-adapter.js'
import { mcpManager } from '../../../apps/desktop/electron/mcp/mcp-manager.js'

/**
 * 抖音 (Douyin) Adapter — publishes text posts via MCP browser tools on creator.douyin.com.
 * Reuses the user's already-logged-in Chrome session.
 */
export class DouyinAdapter extends BasePlatformAdapter {
  readonly platform = 'douyin' as const

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
    return ['#抖音热门', '#挑战', '#爆款', '#涨粉', '#创作者']
  }

  async composePost(draft: PostDraft): Promise<PostDraft> {
    // 抖音 text post description limit: 1000 chars
    return { ...draft, text: this.truncateText(draft.text, 1000) }
  }

  async executePublish(draft: PostDraft): Promise<PublishResult> {
    const client = mcpManager['browserClient']
    if (!client || !client.connected) {
      return { success: false, error: 'Browser not connected.' }
    }

    try {
      await client.callTool('puppeteer_navigate', {
        url: 'https://creator.douyin.com/creator-micro/content/upload/text',
      })
      await client.callTool('puppeteer_wait_for_selector', {
        selector: 'div[contenteditable="true"]',
        timeout: 12000,
      })
      await client.callTool('puppeteer_type', {
        selector: 'div[contenteditable="true"]',
        text: draft.text,
      })
      await client.callTool('puppeteer_click', { selector: 'button.publish-btn' })

      return { success: true, postId: `douyin_mcp_${Date.now()}` }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}

export const douyinAdapter = new DouyinAdapter()
