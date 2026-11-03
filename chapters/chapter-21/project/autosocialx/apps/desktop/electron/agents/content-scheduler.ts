import { getDb } from '../db/client.js'
import { messageBus } from '../agent-core/message-bus.js'
import { publishContent } from './publisher.js'

function log(msg: string): void {
  console.log(msg)
  messageBus.emit('agent:log', { agentId: 'scheduler', runId: 'scheduler', message: msg })
}

const POLL_INTERVAL_MS = 60_000  // check every 60 seconds

interface ContentRow {
  id: string
  platform: string
  scheduled_at: number
}

/**
 * ContentScheduler: periodically publishes content whose scheduled_at has passed.
 * Runs in the main process on a 60-second interval.
 */
class ContentScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false  // prevent concurrent ticks

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => { void this.tick() }, POLL_INTERVAL_MS)
    console.log('[ContentScheduler] Started — polling every 60s')
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return   // skip if previous tick still in progress
    this.running = true
    try {
      await this.doTick()
    } finally {
      this.running = false
    }
  }

  private async doTick(): Promise<void> {
    const nowSec = Math.floor(Date.now() / 1000)
    let db
    try {
      db = getDb()
    } catch {
      return  // DB not ready
    }

    const due = db.prepare(
      `SELECT id, platform, scheduled_at FROM content
       WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?
       LIMIT 10`
    ).all(nowSec) as ContentRow[]

    if (due.length === 0) return

    log(`[ContentScheduler] ${due.length} post(s) due for publishing`)

    for (const row of due) {
      // Prevent endlessly processing ancient posts — mark failed if > 24 hours overdue
      if (nowSec - row.scheduled_at > 86400) {
        log(`[ContentScheduler] Post ${row.id} is > 24h overdue — marking failed`)
        db.prepare(`UPDATE content SET status = 'failed' WHERE id = ?`).run(row.id)
        continue
      }
      await this.publish(row)
    }
  }

  private async publish(row: ContentRow): Promise<void> {
    const db = getDb()

    try {
      const result = await publishContent(row.id)

      if (result.success) {
        log(`[ContentScheduler] ✅ Published ${row.id} on ${row.platform}`)
      } else {
        db.prepare(`UPDATE content SET status = 'failed' WHERE id = ?`).run(row.id)
        log(`[ContentScheduler] ❌ Failed to publish ${row.id} on ${row.platform}: ${result.error}`)
        messageBus.emit('agent:run-failed', {
          agentId: 'scheduler',
          runId: row.id,
          error: result.error ?? 'Unknown error',
        })
      }
    } catch (err) {
      db.prepare(`UPDATE content SET status = 'failed' WHERE id = ?`).run(row.id)
      console.error(`[ContentScheduler] Error publishing ${row.id}:`, err)
    }
  }
}

export const contentScheduler = new ContentScheduler()
