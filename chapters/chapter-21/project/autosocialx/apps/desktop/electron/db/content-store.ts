import type Database from 'better-sqlite3'
import type { PlatformId } from '../agent-core/types.js'

export interface ContentRecord {
  id: string
  agentId: string
  campaignId: string | null
  channelId: string | null
  platform: PlatformId // Redundant cache to avoid JOIN every time we just need logo
  text: string
  mediaUrls: string[]
  status: 'draft' | 'scheduled' | 'queued' | 'published' | 'failed'
  scheduledAt: Date | null
  publishedAt: Date | null
  postId: string | null
  stats: Record<string, number>
}

interface ContentRow {
  id: string
  agent_id: string
  campaign_id: string | null
  channel_id: string | null
  platform: string
  text: string
  media_urls: string
  status: string
  scheduled_at: number | null
  published_at: number | null
  post_id: string | null
  stats: string
}

function toRecord(row: ContentRow): ContentRecord {
  return {
    id: row.id,
    agentId: row.agent_id,
    campaignId: row.campaign_id,
    channelId: row.channel_id,
    platform: row.platform as PlatformId,
    text: row.text,
    mediaUrls: JSON.parse(row.media_urls) as string[],
    status: row.status as ContentRecord['status'],
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at * 1000) : null,
    publishedAt: row.published_at ? new Date(row.published_at * 1000) : null,
    postId: row.post_id,
    stats: JSON.parse(row.stats) as Record<string, number>,
  }
}

export class ContentStore {
  private db: Database.Database | null = null

  init(db: Database.Database): void {
    this.db = db
  }

  private getDb(): Database.Database {
    if (!this.db) throw new Error('ContentStore not initialized. Call init(db) first.')
    return this.db
  }

  list(filter?: {
    agentId?: string
    campaignId?: string
    channelId?: string
    status?: ContentRecord['status']
    platform?: PlatformId
    limit?: number
  }): ContentRecord[] {
    const conditions: string[] = []
    const params: unknown[] = []

    if (filter?.agentId) { conditions.push('agent_id = ?'); params.push(filter.agentId) }
    if (filter?.campaignId) { conditions.push('campaign_id = ?'); params.push(filter.campaignId) }
    if (filter?.channelId) { conditions.push('channel_id = ?'); params.push(filter.channelId) }
    if (filter?.status) { conditions.push('status = ?'); params.push(filter.status) }
    if (filter?.platform) { conditions.push('platform = ?'); params.push(filter.platform) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const limitClause = filter?.limit ? `LIMIT ${filter.limit}` : ''
    const rows = this.getDb()
      .prepare(`SELECT * FROM content ${where} ORDER BY COALESCE(scheduled_at, rowid) DESC ${limitClause}`)
      .all(...params) as ContentRow[]

    return rows.map(toRecord)
  }

  getById(id: string): ContentRecord | null {
    const row = this.getDb()
      .prepare('SELECT * FROM content WHERE id = ?')
      .get(id) as ContentRow | undefined
    return row ? toRecord(row) : null
  }

  create(input: {
    agentId: string
    campaignId?: string | null
    channelId?: string | null
    platform: PlatformId
    text: string
    mediaUrls?: string[]
    status: ContentRecord['status']
    scheduledAt?: Date | null
  }): ContentRecord {
    const id = crypto.randomUUID()
    this.getDb().prepare(`
      INSERT INTO content (id, agent_id, campaign_id, channel_id, platform, text, media_urls, status, scheduled_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.agentId,
      input.campaignId ?? null,
      input.channelId ?? null,
      input.platform,
      input.text,
      JSON.stringify(input.mediaUrls ?? []),
      input.status,
      input.scheduledAt ? Math.floor(input.scheduledAt.getTime() / 1000) : null,
    )
    return this.getById(id)!
  }

  update(
    id: string,
    patch: Partial<Pick<ContentRecord, 'text' | 'status' | 'scheduledAt' | 'mediaUrls'>>,
  ): ContentRecord | null {
    const sets: string[] = []
    const params: unknown[] = []

    if (patch.text !== undefined) { sets.push('text = ?'); params.push(patch.text) }
    if (patch.status !== undefined) { sets.push('status = ?'); params.push(patch.status) }
    if (patch.scheduledAt !== undefined) { sets.push('scheduled_at = ?'); params.push(patch.scheduledAt ? Math.floor(patch.scheduledAt.getTime() / 1000) : null) }
    if (patch.mediaUrls !== undefined) { sets.push('media_urls = ?'); params.push(JSON.stringify(patch.mediaUrls)) }

    if (sets.length === 0) return this.getById(id)

    params.push(id)
    this.getDb().prepare(`UPDATE content SET ${sets.join(', ')} WHERE id = ?`).run(...params)
    return this.getById(id)
  }

  markPublished(id: string, postId: string): ContentRecord | null {
    const now = Math.floor(Date.now() / 1000)
    this.getDb().prepare(
      `UPDATE content SET status = 'published', post_id = ?, published_at = ? WHERE id = ?`,
    ).run(postId, now, id)
    return this.getById(id)
  }

  markFailed(id: string): ContentRecord | null {
    this.getDb().prepare(`UPDATE content SET status = 'failed' WHERE id = ?`).run(id)
    return this.getById(id)
  }

  delete(id: string): void {
    this.getDb().prepare('DELETE FROM content WHERE id = ?').run(id)
  }
}

export const contentStore = new ContentStore()
