import { BasePlatformAdapter } from './base-adapter.js'
import type { PostDraft, PublishResult, HealthStatus } from './base-adapter.js'
import { mcpManager } from '../../../apps/desktop/electron/mcp/mcp-manager.js'

/**
 * 小红书 (Xiaohongshu / XHS) Adapter — publishes via MCP browser tools
 * using the user's already-logged-in Chrome session.
 */
export class XhsAdapter extends BasePlatformAdapter {
  readonly platform = 'xiaohongshu' as const

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
    return ['#生活', '#美食', '#旅行', '#穿搭', '#护肤']
  }

  async composePost(draft: PostDraft): Promise<PostDraft> {
    // 小红书 note: 1000 char limit for description
    return { ...draft, text: this.truncateText(draft.text, 1000) }
  }

  async executePublish(draft: PostDraft): Promise<PublishResult> {
    const client = mcpManager['browserClient']
    if (!client || !client.connected) {
      return { success: false, error: 'Browser not connected.' }
    }

    try {
      // Navigate to 小红书 creator platform
      await client.callTool('puppeteer_navigate', {
        url: 'https://creator.xiaohongshu.com/publish/publish',
      })

      // Click "发布笔记" / text note option
      await client.callTool('puppeteer_wait_for_selector', {
        selector: '.upload-wrapper',
        timeout: 10000,
      })

      // Find text note button and click
      await client.callTool('puppeteer_click', {
        selector: '[data-type="text"]',
      })

      // Wait for text editor
      await client.callTool('puppeteer_wait_for_selector', {
        selector: '.content-editor',
        timeout: 8000,
      })

      // Type content body
      await client.callTool('puppeteer_type', {
        selector: '.content-editor',
        text: draft.text,
      })

      // Click publish
      await client.callTool('puppeteer_click', {
        selector: '.publishBtn',
      })

      return { success: true, postId: `xhs_mcp_${Date.now()}` }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}

export const xhsAdapter = new XhsAdapter()
