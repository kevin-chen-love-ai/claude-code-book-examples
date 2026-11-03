import { BasePlatformAdapter } from './base-adapter.js'
import type { PostDraft, PublishResult, HealthStatus } from './base-adapter.js'
import { mcpManager } from '../../../apps/desktop/electron/mcp/mcp-manager.js'

/**
 * 微博 (Weibo) Adapter — publishes via MCP browser tools on weibo.com.
 * Reuses the user's already-logged-in Chrome session.
 */
export class WeiboAdapter extends BasePlatformAdapter {
  readonly platform = 'weibo' as const

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
    return ['#热搜', '#微博热门', '#社交媒体', '#内容创作', '#涨粉攻略']
  }

  async composePost(draft: PostDraft): Promise<PostDraft> {
    // 微博 character limit: 2000 chars
    return { ...draft, text: this.truncateText(draft.text, 2000) }
  }

  async executePublish(draft: PostDraft): Promise<PublishResult> {
    const client = mcpManager['browserClient']
    if (!client || !client.connected) {
      return { success: false, error: 'Browser not connected.' }
    }

    try {
      await client.callTool('puppeteer_navigate', { url: 'https://weibo.com/' })
      await client.callTool('puppeteer_wait_for_selector', {
        selector: '.weibo-textarea',
        timeout: 10000,
      })
      await client.callTool('puppeteer_click', { selector: '.weibo-textarea' })
      await client.callTool('puppeteer_type', {
        selector: '.weibo-textarea',
        text: draft.text,
      })
      await client.callTool('puppeteer_click', {
        selector: '.W_btn_a[node-type="submit"]',
      })

      return { success: true, postId: `weibo_mcp_${Date.now()}` }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}

export const weiboAdapter = new WeiboAdapter()
