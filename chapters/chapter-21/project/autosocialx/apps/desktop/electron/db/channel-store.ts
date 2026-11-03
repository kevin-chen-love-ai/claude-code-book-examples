import type Database from 'better-sqlite3'
import type { ChannelRecord } from '../agent-core/types'

export class ChannelStore {
    private db: Database.Database | null = null

    init(db: Database.Database): void {
        this.db = db
    }

    private getDb(): Database.Database {
        if (!this.db) throw new Error('ChannelStore not initialized. Call init(db) first.')
        return this.db
    }

    list(): ChannelRecord[] {
        const rows = this.getDb()
            .prepare('SELECT * FROM channels ORDER BY created_at ASC')
            .all() as Record<string, unknown>[]
        return rows.map(r => this.toRecord(r))
    }

    listEnabled(): ChannelRecord[] {
        const rows = this.getDb()
            .prepare('SELECT * FROM channels WHERE enabled = 1 ORDER BY created_at ASC')
            .all() as Record<string, unknown>[]
        return rows.map(r => this.toRecord(r))
    }

    getById(id: string): ChannelRecord | null {
        const row = this.getDb()
            .prepare('SELECT * FROM channels WHERE id = ?')
            .get(id) as Record<string, unknown> | undefined
        return row ? this.toRecord(row) : null
    }

    /** Returns the first enabled channel for a given platform, or null. */
    getByPlatform(platform: string): ChannelRecord | null {
        const row = this.getDb()
            .prepare('SELECT * FROM channels WHERE platform = ? AND enabled = 1 ORDER BY created_at ASC LIMIT 1')
            .get(platform) as Record<string, unknown> | undefined
        return row ? this.toRecord(row) : null
    }

    create(platform: string, name: string, webhookUrl?: string | null): ChannelRecord {
        const id = crypto.randomUUID()
        const now = Math.floor(Date.now() / 1000)
        this.getDb().prepare(`
            INSERT INTO channels (id, platform, name, enabled, webhook_url, config, created_at)
            VALUES (?, ?, ?, 1, ?, '{}', ?)
        `).run(id, platform, name, webhookUrl ?? null, now)
        return this.getById(id)!
    }

    toggle(id: string, enabled: boolean): void {
        this.getDb()
            .prepare('UPDATE channels SET enabled = ? WHERE id = ?')
            .run(enabled ? 1 : 0, id)
    }

    setWebhookUrl(id: string, webhookUrl: string | null): void {
        this.getDb()
            .prepare('UPDATE channels SET webhook_url = ? WHERE id = ?')
            .run(webhookUrl, id)
    }

    /** Replace the entire config JSON for a channel. */
    setConfig(id: string, config: Record<string, string>): void {
        this.getDb()
            .prepare('UPDATE channels SET config = ? WHERE id = ?')
            .run(JSON.stringify(config), id)
    }

    delete(id: string): void {
        this.getDb().prepare('DELETE FROM channels WHERE id = ?').run(id)
    }

    private toRecord(row: Record<string, unknown>): ChannelRecord {
        let config: Record<string, string> = {}
        try { config = JSON.parse(row['config'] as string ?? '{}') } catch { /* empty */ }
        return {
            id: String(row['id']),
            platform: String(row['platform']),
            name: String(row['name']),
            enabled: Number(row['enabled']) === 1,
            webhookUrl: row['webhook_url'] != null ? String(row['webhook_url']) : null,
            config,
            createdAt: new Date(Number(row['created_at']) * 1000),
        }
    }
}

export const channelStore = new ChannelStore()
