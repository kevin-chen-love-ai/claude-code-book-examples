import type { WorkingMemory, Message, ToolCallRecord } from '../types'
import { app } from 'electron'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

export class WorkingMemoryStore {
  private store: Map<string, WorkingMemory> = new Map()
  private baseDir: string = ''
  private initPromise: Promise<void> | null = null

  // A simple queue guard to prevent race conditions during rapid file writes for the same runId
  private writeTasks: Map<string, Promise<void>> = new Map()

  constructor() {
    this.initPromise = this.init()
  }

  private async init(): Promise<void> {
    try {
      this.baseDir = path.join(app.getPath('userData'), 'working_memory')
      await fs.mkdir(this.baseDir, { recursive: true })

      // Auto-recover active runs that might have crashed
      const files = await fs.readdir(this.baseDir)
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const data = await fs.readFile(path.join(this.baseDir, file), 'utf-8')
            const parsed = JSON.parse(data)
            // Restore Date object correctly
            if (parsed.startedAt) parsed.startedAt = new Date(parsed.startedAt)

            // Restore intermediate results Map
            const intermediateRaw = parsed.intermediateResults ?? []
            parsed.intermediateResults = new Map(intermediateRaw)

            this.store.set(parsed.runId, parsed as WorkingMemory)
            console.log(`[WorkingMemory] Recovered run ${parsed.runId} from disk.`)
          } catch (err) {
            console.error(`[WorkingMemory] Failed to recover file ${file}`, err)
          }
        }
      }
    } catch (e) {
      console.error('[WorkingMemory] Failed to init dir:', e)
    }
  }

  private enqueueWrite(runId: string, mem: WorkingMemory): Promise<void> {
    const activeTask = this.writeTasks.get(runId) ?? Promise.resolve()
    const nextTask = activeTask.then(async () => {
      const filePath = path.join(this.baseDir, `${runId}.json`)
      // Serialize Map into array of tuples
      const memObj = {
        ...mem,
        intermediateResults: Array.from(mem.intermediateResults.entries())
      }
      await fs.writeFile(filePath, JSON.stringify(memObj, null, 2), 'utf-8')
    }).catch(err => {
      console.error(`[WorkingMemory] Failed to write run ${runId} to disk:`, err)
    })

    this.writeTasks.set(runId, nextTask)
    return nextTask
  }

  async create(agentId: string): Promise<WorkingMemory> {
    await this.initPromise
    const runId = crypto.randomUUID()
    const mem: WorkingMemory = {
      runId,
      agentId,
      contextWindow: [],
      intermediateResults: new Map<string, unknown>(),
      toolCallHistory: [],
      startedAt: new Date(),
    }
    this.store.set(runId, mem)
    await this.enqueueWrite(runId, mem)
    return mem
  }

  async get(runId: string): Promise<WorkingMemory | undefined> {
    await this.initPromise
    return this.store.get(runId)
  }

  async addMessage(runId: string, msg: Message): Promise<void> {
    await this.initPromise
    const mem = this.store.get(runId)
    if (!mem) throw new Error(`WorkingMemory not found for runId: ${runId}`)
    mem.contextWindow.push(msg)
    await this.enqueueWrite(runId, mem)
  }

  async addToolCall(runId: string, record: ToolCallRecord): Promise<void> {
    await this.initPromise
    const mem = this.store.get(runId)
    if (!mem) throw new Error(`WorkingMemory not found for runId: ${runId}`)
    mem.toolCallHistory.push(record)
    await this.enqueueWrite(runId, mem)
  }

  async setIntermediate(runId: string, key: string, value: unknown): Promise<void> {
    await this.initPromise
    const mem = this.store.get(runId)
    if (!mem) throw new Error(`WorkingMemory not found for runId: ${runId}`)
    mem.intermediateResults.set(key, value)
    await this.enqueueWrite(runId, mem)
  }

  async getIntermediate(runId: string, key: string): Promise<unknown> {
    await this.initPromise
    const mem = this.store.get(runId)
    if (!mem) throw new Error(`WorkingMemory not found for runId: ${runId}`)
    return mem.intermediateResults.get(key)
  }

  async clear(runId: string): Promise<void> {
    await this.initPromise
    this.store.delete(runId)
    const activeTask = this.writeTasks.get(runId) ?? Promise.resolve()
    const clearTask = activeTask.then(async () => {
      const filePath = path.join(this.baseDir, `${runId}.json`)
      try {
        await fs.unlink(filePath)
      } catch {
        // Ignore if file is already gone
      }
    })
    this.writeTasks.set(runId, clearTask)
    await clearTask
  }

  async getContextWindow(runId: string): Promise<Message[]> {
    await this.initPromise
    const mem = this.store.get(runId)
    if (!mem) throw new Error(`WorkingMemory not found for runId: ${runId}`)
    return mem.contextWindow
  }
}

export const workingMemory = new WorkingMemoryStore()
