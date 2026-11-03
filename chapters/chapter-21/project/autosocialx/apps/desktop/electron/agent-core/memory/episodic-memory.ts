import type { EpisodicRecord, RunStep } from '../types'
import Database from 'better-sqlite3'

export class EpisodicMemoryStore {
  constructor(private db: Database.Database) {}

  save(record: EpisodicRecord): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO agent_runs
        (id, run_id, agent_id, status, started_at, finished_at, steps, outcome, tokens_used, final_answer)
      VALUES
        (@id, @runId, @agentId, @status, @startedAt, @finishedAt, @steps, @outcome, @tokensUsed, @finalAnswer)
    `)
    stmt.run({
      id: record.id,
      runId: record.runId,
      agentId: record.agentId,
      status: record.outcome === 'success' ? 'success' : 'failed',
      startedAt: Math.floor(record.startedAt.getTime() / 1000),
      finishedAt: Math.floor(record.finishedAt.getTime() / 1000),
      steps: JSON.stringify(record.steps),
      outcome: record.outcome,
      tokensUsed: record.tokensUsed,
      finalAnswer: record.finalAnswer,
    })
  }

  getByRunId(runId: string): EpisodicRecord | null {
    const stmt = this.db.prepare('SELECT * FROM agent_runs WHERE run_id = ?')
    const row = stmt.get(runId)
    if (!row) return null
    return this.rowToRecord(row)
  }

  listByAgent(agentId: string, limit = 50): EpisodicRecord[] {
    const stmt = this.db.prepare(
      'SELECT * FROM agent_runs WHERE agent_id = ? ORDER BY started_at DESC LIMIT ?'
    )
    const rows = stmt.all(agentId, limit)
    return rows.map((row) => this.rowToRecord(row))
  }

  private rowToRecord(row: unknown): EpisodicRecord {
    const r = row as Record<string, unknown>

    const id = typeof r['id'] === 'string' ? r['id'] : ''
    const runId = typeof r['run_id'] === 'string' ? r['run_id'] : ''
    const agentId = typeof r['agent_id'] === 'string' ? r['agent_id'] : ''
    const outcome = r['outcome'] === 'success' || r['outcome'] === 'failed' || r['outcome'] === 'partial'
      ? r['outcome']
      : 'failed'
    const tokensUsed = typeof r['tokens_used'] === 'number' ? r['tokens_used'] : 0
    const finalAnswer = typeof r['final_answer'] === 'string' ? r['final_answer'] : ''

    const startedAtRaw = typeof r['started_at'] === 'number' ? r['started_at'] : 0
    const finishedAtRaw = typeof r['finished_at'] === 'number' ? r['finished_at'] : 0

    const stepsRaw = typeof r['steps'] === 'string' ? r['steps'] : '[]'
    const steps = JSON.parse(stepsRaw) as RunStep[]

    return {
      id,
      runId,
      agentId,
      startedAt: new Date(startedAtRaw * 1000),
      finishedAt: new Date(finishedAtRaw * 1000),
      steps,
      outcome,
      tokensUsed,
      finalAnswer,
    }
  }
}
