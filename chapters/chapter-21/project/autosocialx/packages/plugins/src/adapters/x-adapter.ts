import { BasePlatformAdapter } from './base-adapter.js'
import type { PostDraft, PublishResult, HealthStatus } from './base-adapter.js'
import { mcpManager } from '../../../apps/desktop/electron/mcp/mcp-manager.js'

/**
 * X (Twitter) Adapter — publishes via MCP browser tools, reusing the user's
 * already-logged-in Chrome session. No credentials stored in the app.
 *
 * Requires Chrome to be running with --remote-debugging-port=9222.
 */
export class XAdapter extends BasePlatformAdapter {
  readonly platform = 'x' as const

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
    // In future: navigate to x.com/explore and extract trending topics
    return ['#AI', '#BuildInPublic', '#IndieHacker', '#SaaS', '#OpenAI']
  }

  async composePost(draft: PostDraft): Promise<PostDraft> {
    // X limit: 280 characters
    return { ...draft, text: this.truncateText(draft.text, 280) }
  }

  async executePublish(draft: PostDraft): Promise<PublishResult> {
    const client = mcpManager['browserClient']
    if (!client || !client.connected) {
      return {
        success: false,
        error: 'Browser not connected. Please start Chrome with --remote-debugging-port=9222 and reconnect.',
      }
    }

    try {
      // Navigate to X compose
      await client.callTool('puppeteer_navigate', {
        url: 'https://x.com/compose/tweet',
      })

      // Wait for the compose textarea to appear
      await client.callTool('puppeteer_wait_for_selector', {
        selector: '[data-testid="tweetTextarea_0"]',
        timeout: 10000,
      })

      // Type the post content
      await client.callTool('puppeteer_type', {
        selector: '[data-testid="tweetTextarea_0"]',
        text: draft.text,
      })

      // Click the Tweet button
      await client.callTool('puppeteer_click', {
        selector: '[data-testid="tweetButton"]',
      })

      // Take screenshot to confirm
      const screenshot = await client.callTool('puppeteer_screenshot', {
        fullPage: false,
      })
      const screenText = screenshot.content.find(c => c.type === 'text')?.text ?? ''

      return {
        success: true,
        postId: `x_mcp_${Date.now()}`,
        ...(screenText ? { debug: screenText } : {}),
      } as PublishResult
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
}

export const xAdapter = new XAdapter()
