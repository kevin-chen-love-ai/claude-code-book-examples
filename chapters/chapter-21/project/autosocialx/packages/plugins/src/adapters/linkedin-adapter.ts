import { BasePlatformAdapter } from './base-adapter.js'
import type { PostDraft, PublishResult, HealthStatus } from './base-adapter.js'
import { mcpManager } from '../../../apps/desktop/electron/mcp/mcp-manager.js'

/**
 * LinkedIn Adapter — publishes via MCP browser tools, reusing the user's
 * already-logged-in Chrome session.
 */
export class LinkedInAdapter extends BasePlatformAdapter {
  readonly platform = 'linkedin' as const

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
    return ['#Leadership', '#Innovation', '#AI', '#FutureOfWork', '#Technology']
  }

  async composePost(draft: PostDraft): Promise<PostDraft> {
    // LinkedIn: 3000 char limit for regular posts
    return { ...draft, text: this.truncateText(draft.text, 3000) }
  }

  async executePublish(draft: PostDraft): Promise<PublishResult> {
    const client = mcpManager['browserClient']
    if (!client || !client.connected) {
      return { success: false, error: 'Browser not connected.' }
    }

    try {
      // Navigate to LinkedIn feed
      await client.callTool('puppeteer_navigate', { url: 'https://www.linkedin.com/feed/' })

      // Click "Start a post" button
      await client.callTool('puppeteer_click', {
        selector: 'button.share-box-feed-entry__trigger',
      })

      // Wait for composer modal
      await client.callTool('puppeteer_wait_for_selector', {
        selector: '.ql-editor[data-placeholder]',
        timeout: 10000,
      })

      // Type content
      await client.callTool('puppeteer_type', {
        selector: '.ql-editor[data-placeholder]',
        text: draft.text,
      })

      // Click Post button
      await client.callTool('puppeteer_click', {
        selector: 'button.share-actions__primary-action',
      })

      return { success: true, postId: `linkedin_mcp_${Date.now()}` }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}

export const linkedinAdapter = new LinkedInAdapter()
