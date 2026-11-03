import type Database from 'better-sqlite3'
import type { CampaignRecord, PlatformId } from '../agent-core/types'

export interface CreateCampaignParams {
    name: string
    description?: string
    platforms: PlatformId[]
    personaId?: string | null
    coverImageUrl?: string | null
    channelIds?: string[]
    cronExpr?: string | null
}

export class CampaignStore {
    private db: Database.Database | null = null

    init(db: Database.Database): void {
        this.db = db
    }

    private getDb(): Database.Database {
        if (!this.db) throw new Error('CampaignStore not initialized. Call init(db) first.')
        return this.db
    }

    list(): CampaignRecord[] {
        const rows = this.getDb().prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all() as Record<string, unknown>[]
        return rows.map(r => this.toRecord(r))
    }

    listWithCron(): CampaignRecord[] {
        const rows = this.getDb()
            .prepare("SELECT * FROM campaigns WHERE cron_expr IS NOT NULL AND cron_status = 'active' ORDER BY created_at DESC")
            .all() as Record<string, unknown>[]
        return rows.map(r => this.toRecord(r))
    }

    getById(id: string): CampaignRecord | null {
        const row = this.getDb().prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as Record<string, unknown> | undefined
        return row ? this.toRecord(row) : null
    }

    create(params: CreateCampaignParams): CampaignRecord {
        const id = crypto.randomUUID()
        const now = Math.floor(Date.now() / 1000)

        this.getDb().prepare(`
            INSERT INTO campaigns (id, name, description, platforms, persona_id, cover_image_url, channel_ids, cron_expr, cron_status, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 'active', ?)
        `).run(
            id,
            params.name,
            params.description ?? '',
            JSON.stringify(params.platforms),
            params.personaId ?? null,
            params.coverImageUrl ?? null,
            JSON.stringify(params.channelIds ?? []),
            params.cronExpr ?? null,
            now,
        )

        return this.getById(id)!
    }

    update(id: string, patch: { name?: string; description?: string; platforms?: PlatformId[]; personaId?: string | null; coverImageUrl?: string | null; cronExpr?: string | null }): CampaignRecord | null {
        const sets: string[] = []
        const params: unknown[] = []
        if (patch.name !== undefined)         { sets.push('name = ?');           params.push(patch.name) }
        if (patch.description !== undefined)  { sets.push('description = ?');    params.push(patch.description) }
        if (patch.platforms !== undefined)    { sets.push('platforms = ?');      params.push(JSON.stringify(patch.platforms)) }
        if (patch.personaId !== undefined)    { sets.push('persona_id = ?');     params.push(patch.personaId) }
        if (patch.coverImageUrl !== undefined){ sets.push('cover_image_url = ?');params.push(patch.coverImageUrl) }
        if (patch.cronExpr !== undefined)     { sets.push('cron_expr = ?');      params.push(patch.cronExpr); sets.push('cron_status = ?'); params.push(patch.cronExpr ? 'active' : 'paused') }
        if (sets.length === 0) return this.getById(id)
        params.push(id)
        this.getDb().prepare(`UPDATE campaigns SET ${sets.join(', ')} WHERE id = ?`).run(...params)
        return this.getById(id)
    }

    updateCron(id: string, cronExpr: string | null, cronStatus?: 'active' | 'paused'): CampaignRecord | null {
        this.getDb().prepare(
            'UPDATE campaigns SET cron_expr = ?, cron_status = ? WHERE id = ?'
        ).run(cronExpr, cronStatus ?? 'active', id)
        return this.getById(id)
    }

    updateStatus(id: string, status: 'active' | 'archived' | 'paused'): CampaignRecord | null {
        this.getDb().prepare('UPDATE campaigns SET status = ? WHERE id = ?').run(status, id)
        return this.getById(id)
    }

    delete(id: string): void {
        this.getDb().prepare('DELETE FROM campaigns WHERE id = ?').run(id)
    }

    private toRecord(row: Record<string, unknown>): CampaignRecord {
        return {
            id: String(row['id']),
            name: String(row['name']),
            description: String(row['description'] ?? ''),
            platforms: JSON.parse(String(row['platforms'] ?? '[]')) as PlatformId[],
            personaId: row['persona_id'] ? String(row['persona_id']) : null,
            coverImageUrl: row['cover_image_url'] ? String(row['cover_image_url']) : null,
            channelIds: JSON.parse(String(row['channel_ids'] ?? '[]')) as string[],
            cronExpr: row['cron_expr'] ? String(row['cron_expr']) : null,
            cronStatus: (row['cron_status'] as 'active' | 'paused') ?? 'active',
            status: row['status'] as 'active' | 'archived' | 'paused',
            createdAt: new Date(Number(row['created_at']) * 1000),
        }
    }
}

export const campaignStore = new CampaignStore()
