import type Database from 'better-sqlite3'
import type { AutomationRule } from '../agent-core/types'

export class AutomationStore {
    private db: Database.Database | null = null

    init(db: Database.Database): void {
        this.db = db
    }

    private getDb(): Database.Database {
        if (!this.db) throw new Error('AutomationStore not initialized. Call init(db) first.')
        return this.db
    }

    listAll(): AutomationRule[] {
        const rows = this.getDb()
            .prepare('SELECT * FROM automations ORDER BY created_at DESC')
            .all() as Record<string, unknown>[]
        return rows.map(r => this.toRecord(r))
    }

    listActive(): AutomationRule[] {
        const rows = this.getDb()
            .prepare("SELECT * FROM automations WHERE status = 'active' ORDER BY created_at DESC")
            .all() as Record<string, unknown>[]
        return rows.map(r => this.toRecord(r))
    }

    listByAgent(agentId: string): AutomationRule[] {
        const rows = this.getDb()
            .prepare('SELECT * FROM automations WHERE agent_id = ? ORDER BY created_at DESC')
            .all(agentId) as Record<string, unknown>[]
        return rows.map(r => this.toRecord(r))
    }

    getById(id: string): AutomationRule | null {
        const row = this.getDb().prepare('SELECT * FROM automations WHERE id = ?').get(id) as Record<string, unknown> | undefined
        return row ? this.toRecord(row) : null
    }

    create(agentId: string, cronExpr: string): AutomationRule {
        const id = crypto.randomUUID()
        const now = Math.floor(Date.now() / 1000)

        this.getDb().prepare(`
      INSERT INTO automations (id, agent_id, cron_expr, status, created_at, updated_at)
      VALUES (?, ?, ?, 'active', ?, ?)
    `).run(id, agentId, cronExpr, now, now)

        return this.getById(id)!
    }

    update(id: string, patch: { cronExpr?: string; status?: 'active' | 'paused' }): AutomationRule | null {
        const sets = []
        const params = []

        if (patch.cronExpr !== undefined) { sets.push('cron_expr = ?'); params.push(patch.cronExpr) }
        if (patch.status !== undefined) { sets.push('status = ?'); params.push(patch.status) }

        if (sets.length === 0) return this.getById(id)

        sets.push('updated_at = ?')
        params.push(Math.floor(Date.now() / 1000))
        params.push(id)

        this.getDb().prepare(`UPDATE automations SET ${sets.join(', ')} WHERE id = ?`).run(...params)
        return this.getById(id)
    }

    delete(id: string): void {
        this.getDb().prepare('DELETE FROM automations WHERE id = ?').run(id)
    }

    private toRecord(row: Record<string, unknown>): AutomationRule {
        return {
            id: String(row['id']),
            agentId: String(row['agent_id']),
            cronExpr: String(row['cron_expr']),
            status: row['status'] as 'active' | 'paused',
            createdAt: new Date(Number(row['created_at']) * 1000),
            updatedAt: new Date(Number(row['updated_at']) * 1000)
        }
    }
}

export const automationStore = new AutomationStore()
