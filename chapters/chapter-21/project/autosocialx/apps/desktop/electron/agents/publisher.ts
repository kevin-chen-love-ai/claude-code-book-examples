/**
 * publisher.ts — Shared content publish function.
 *
 * All platforms route to the configured n8n webhook URL.
 * Per-channel webhook URL override and extra config are looked up from the channels table.
 *
 * Platform mapping (internal id → API enum):
 *   x → twitter   (all others pass through unchanged)
 */

import { getDb } from '../db/client.js'
import { configStore } from '../config-store.js'
import { getToolKey } from '../agent-core/tool-use/tool-keys.js'
import { messageBus } from '../agent-core/message-bus.js'
import { channelStore } from '../db/channel-store.js'
import type { PlatformId } from '../agent-core/types.js'

const PLATFORM_API_MAP: Record<string, string> = {
  x: 'twitter',
}

export interface PublishResult {
  success: boolean
  postId?: string
  error?: string
}

/**
 * Publish a content record by ID.
 * Updates DB status to 'published' on success, or leaves it unchanged on failure.
 */
export async function publishContent(id: string): Promise<PublishResult> {
  const db = getDb()
  const row = db.prepare('SELECT * FROM content WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!row) return { success: false, error: 'Content not found' }

  const platform = row['platform'] as string
  const text = row['text'] as string
  let mediaUrls: string[] = []
  try { mediaUrls = JSON.parse(row['media_urls'] as string ?? '[]') } catch { /* empty */ }

  // ── Webhook API ───────────────────────────────────────────────────────────────
  // Look up the channel for per-channel webhook override and extra config
  const channel = channelStore.getByPlatform(platform)
  const webhookUrl = channel?.webhookUrl ?? configStore.get('n8nUrl')
  if (!webhookUrl) {
    return { success: false, error: 'Publish API URL not configured. Set it in Settings → Publish API.' }
  }

  const channelExtraConfig = channel?.config ?? {}
  const apiPlatform = PLATFORM_API_MAP[platform] ?? platform
  const now = Math.floor(Date.now() / 1000)

  const body: Record<string, unknown> = {
    content_id: id,
    platform: apiPlatform,
    title: text.slice(0, 60).replace(/\n/g, ' '),
    text,
    media_urls: mediaUrls,
    scheduled_at: row['scheduled_at'] ?? null,
    published_at_request: now,
  }

  // Pinterest requires board_id
  if (platform === 'pinterest') {
    const boardId = channelExtraConfig['board_id']
    if (boardId) body['board_id'] = boardId
  }

  // Slack / Discord require channel
  if (platform === 'slack' || platform === 'discord') {
    const ch = channelExtraConfig['channel']
    if (ch) body['channel'] = ch
  }

  // Attach any extra channel config
  if (Object.keys(channelExtraConfig).length > 0) body['extra'] = channelExtraConfig

  // Token is stored encrypted in tool_keys.enc.json
  const webhookToken = getToolKey('n8n-webhook-token')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (webhookToken) headers['Authorization'] = `Bearer ${webhookToken}`

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })

    if (res.ok) {
      db.prepare(`UPDATE content SET status = 'published', published_at = ? WHERE id = ?`)
        .run(now, id)

      messageBus.emit('post:published', {
        agentId: 'publisher',
        contentId: id,
        postId: id,
        platform: platform as PlatformId,
      })

      return { success: true, postId: id }
    }

    const errText = await res.text().catch(() => `HTTP ${res.status}`)
    return { success: false, error: `Publish API responded ${res.status}: ${errText}` }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
