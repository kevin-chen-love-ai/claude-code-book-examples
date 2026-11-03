import { BasePlatformAdapter } from './base-adapter.js'
import type { PostDraft, PublishResult, HealthStatus } from './base-adapter.js'
import { mcpManager } from '../../../apps/desktop/electron/mcp/mcp-manager.js'

/**
 * YouTube Adapter — publishes Community posts via YouTube Studio.
 * Reuses the user's logged-in Chrome session via MCP browser tools.
 */
export class YouTubeAdapter extends BasePlatformAdapter {
  readonly platform = 'youtube' as const

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
    return ['#YouTube', '#Shorts', '#Tutorial', '#HowTo', '#TechTips']
  }

  async composePost(draft: PostDraft): Promise<PostDraft> {
    // YouTube Community post limit: 5000 chars
    return { ...draft, text: this.truncateText(draft.text, 5000) }
  }

  async executePublish(draft: PostDraft): Promise<PublishResult> {
    const client = mcpManager['browserClient']
    if (!client || !client.connected) {
      return { success: false, error: 'Browser not connected.' }
    }

    try {
      // Navigate to YouTube Studio
      await client.callTool('puppeteer_navigate', { url: 'https://studio.youtube.com/' })
      await client.callTool('puppeteer_wait_for_selector', { selector: '#create-icon', timeout: 10000 })
      await client.callTool('puppeteer_click', { selector: '#create-icon' })

      // Click "Create post" option
      await client.callTool('puppeteer_wait_for_selector', {
        selector: '[test-id="create-post-button"]',
        timeout: 8000,
      })
      await client.callTool('puppeteer_click', { selector: '[test-id="create-post-button"]' })

      // Type in the post text area
      await client.callTool('puppeteer_wait_for_selector', { selector: '#text-input', timeout: 8000 })
      await client.callTool('puppeteer_type', { selector: '#text-input', text: draft.text })

      // Publish
      await client.callTool('puppeteer_click', { selector: '[test-id="post-button"]' })

      return { success: true, postId: `youtube_mcp_${Date.now()}` }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}

export const youtubeAdapter = new YouTubeAdapter()
