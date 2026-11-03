import PQueue from 'p-queue'
import type { QueuedTask, TaskStatus } from './types'
import { messageBus } from './message-bus'

interface RateLimitEntry {
  count: number
  resetAt: number
}

export class ExecutionQueue {
  // P0: concurrency 1 (critical), P1: 2, P2: 2, P3: 1
  private queues: [PQueue, PQueue, PQueue, PQueue]
  private tasks: Map<string, QueuedTask & { status: TaskStatus }>
  private runner: ((task: QueuedTask) => Promise<void>) | null = null
  private rateLimits: Map<string, RateLimitEntry> = new Map()
  // Per-agent serial lane: prevents the same agent from running concurrently
  private agentLanes: Map<string, PQueue> = new Map()
  // Tracks agents with at least one active (running) task
  private runningAgents: Set<string> = new Set()

  constructor() {
    this.queues = [
      new PQueue({ concurrency: 1 }),  // P0: manual Generate page (1 slot)
      new PQueue({ concurrency: 1 }),  // P1: reserved
      new PQueue({ concurrency: 3 }),  // P2: background agents — cron + campaign (3 slots)
      new PQueue({ concurrency: 1 }),  // P3: low priority
    ]
    this.tasks = new Map()
  }

  private getAgentLane(agentId: string): PQueue {
    if (!this.agentLanes.has(agentId)) {
      this.agentLanes.set(agentId, new PQueue({ concurrency: 1 }))
    }
    return this.agentLanes.get(agentId)!
  }

  setRunner(fn: (task: QueuedTask) => Promise<void>): void {
    this.runner = fn
  }

  enqueue(params: Omit<QueuedTask, 'id' | 'enqueuedAt'>): string {
    const id = crypto.randomUUID()
    const enqueuedAt = new Date()

    const task: QueuedTask = {
      id,
      enqueuedAt,
      agentId: params.agentId,
      priority: params.priority,
      triggerSource: params.triggerSource,
      payload: params.payload,
      retryCount: params.retryCount,
      maxRetries: params.maxRetries,
    }

    this.tasks.set(id, { ...task, status: 'enqueued' })
    this.emitStatus(id, 'enqueued')

    const priorityQueue = this.queues[params.priority]
    const agentLane = this.getAgentLane(params.agentId)

    // The agent lane (concurrency: 1) serializes same-agent tasks.
    // Inside the lane, we acquire a slot on the global priority queue.
    agentLane.add(() =>
      priorityQueue.add(async () => {
        this.runningAgents.add(task.agentId)
        this.updateStatus(id, 'running')
        try {
          if (this.runner) {
            await this.runner(task)
          }
          this.updateStatus(id, 'completed')
        } catch (err) {
          if (task.retryCount < task.maxRetries) {
            // Exponential backoff: 2s, 4s, 8s …
            const delayMs = Math.pow(2, task.retryCount + 1) * 1000
            const nextRetry = task.retryCount + 1
            console.warn(
              `[Queue] Task ${id} failed (attempt ${nextRetry}/${task.maxRetries + 1}), ` +
              `retrying in ${delayMs / 1000}s — ${err instanceof Error ? err.message : String(err)}`
            )
            this.updateStatus(id, 'failed')
            await new Promise(r => setTimeout(r, delayMs))
            this.enqueue({ ...task, retryCount: nextRetry })
          } else {
            console.error(
              `[Queue] Task ${id} permanently failed after ${task.maxRetries + 1} attempt(s) — ` +
              (err instanceof Error ? err.message : String(err))
            )
            this.updateStatus(id, 'failed')
          }
        } finally {
          this.runningAgents.delete(task.agentId)
        }
      })
    ).catch(() => {
      // Rejection is handled inside the callbacks above
    })

    return id
  }

  isAgentRunning(agentId: string): boolean {
    return this.runningAgents.has(agentId)
  }

  cancel(taskId: string): boolean {
    const entry = this.tasks.get(taskId)
    if (!entry) return false
    if (entry.status === 'enqueued') {
      this.updateStatus(taskId, 'failed')
      return true
    }
    return false
  }

  listActiveTasks(): Array<{ id: string; agentId: string; status: TaskStatus; enqueuedAt: Date; triggerSource: string }> {
    return Array.from(this.tasks.values())
      .filter(t => t.status === 'enqueued' || t.status === 'running')
      .map(({ id, agentId, status, enqueuedAt, triggerSource }) => ({ id, agentId, status, enqueuedAt, triggerSource }))
  }

  getStatus(taskId: string): TaskStatus | undefined {
    return this.tasks.get(taskId)?.status
  }

  getQueueSize(): number {
    return this.queues.reduce((sum, q) => sum + q.size, 0)
  }

  getPendingCount(): number {
    return this.getQueueSize()
  }

  getRunningCount(): number {
    return this.queues.reduce((sum, q) => sum + q.pending, 0)
  }

  // ─── Platform rate limiting ──────────────────────────────────────────────────

  checkRateLimit(platform: string, limit: number): boolean {
    const now = Date.now()
    const entry = this.rateLimits.get(platform)

    if (!entry || now > entry.resetAt) {
      return true
    }

    return entry.count < limit
  }

  recordPlatformOp(platform: string): void {
    const now = Date.now()
    const entry = this.rateLimits.get(platform)

    if (!entry || now > entry.resetAt) {
      this.rateLimits.set(platform, {
        count: 1,
        resetAt: now + 60_000, // reset window: 1 minute
      })
    } else {
      entry.count += 1
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private updateStatus(taskId: string, status: TaskStatus): void {
    const entry = this.tasks.get(taskId)
    if (entry) {
      entry.status = status
      // Prune completed/failed tasks after 5 minutes to prevent unbounded Map growth
      if (status === 'completed' || status === 'failed') {
        setTimeout(() => { this.tasks.delete(taskId) }, 5 * 60 * 1000)
      }
    }
    this.emitStatus(taskId, status)
  }

  private emitStatus(taskId: string, status: TaskStatus): void {
    messageBus.emit('queue:task-status', { taskId, status })
  }
}

export const executionQueue = new ExecutionQueue()
