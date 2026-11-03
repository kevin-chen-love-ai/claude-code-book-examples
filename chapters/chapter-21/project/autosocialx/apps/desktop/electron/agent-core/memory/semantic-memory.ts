import type { SemanticChunk } from '../types'
import { app } from 'electron'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

/**
 * L3 Semantic Memory
 * Implemented as a File-based store per user constraints to avoid heavy LanceDB native bindings in P1/P2.
 */
export class SemanticMemoryStore {
  private baseDir: string = ''
  private initPromise: Promise<void> | null = null

  constructor() {
    this.initPromise = this.init()
  }

  private async init(): Promise<void> {
    try {
      this.baseDir = path.join(app.getPath('userData'), 'semantic_memory')
      await fs.mkdir(this.baseDir, { recursive: true })
    } catch (e) {
      console.error('[SemanticMemoryStore] Failed to init dir:', e)
    }
  }

  private getAgentFilePath(agentId: string): string {
    return path.join(this.baseDir, `${agentId}.json`)
  }

  private async loadAgentChunks(agentId: string): Promise<SemanticChunk[]> {
    await this.initPromise
    const filePath = this.getAgentFilePath(agentId)
    try {
      const data = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(data) as SemanticChunk[]
    } catch {
      // If file doesn't exist, return empty array
      return []
    }
  }

  private async saveAgentChunks(agentId: string, chunks: SemanticChunk[]): Promise<void> {
    await this.initPromise
    const filePath = this.getAgentFilePath(agentId)
    await fs.writeFile(filePath, JSON.stringify(chunks, null, 2), 'utf-8')
  }

  async add(chunk: Omit<SemanticChunk, 'id' | 'embedding'>): Promise<void> {
    const chunks = await this.loadAgentChunks(chunk.agentId)
    const newChunk: SemanticChunk = {
      ...chunk,
      id: crypto.randomUUID(),
      embedding: [] // Stub for text-based version
    }
    chunks.push(newChunk)
    await this.saveAgentChunks(chunk.agentId, chunks)
  }

  async search(query: string, agentId?: string, topK = 5): Promise<SemanticChunk[]> {
    await this.initPromise

    // For file-based version, if agentId is known, just search that agent.
    // Otherwise scan all agents (not deeply optimized, but functional for P1).
    let allChunks: SemanticChunk[] = []

    if (agentId) {
      allChunks = await this.loadAgentChunks(agentId)
    } else {
      try {
        const files = await fs.readdir(this.baseDir)
        for (const file of files) {
          if (file.endsWith('.json')) {
            const data = await fs.readFile(path.join(this.baseDir, file), 'utf-8')
            allChunks.push(...(JSON.parse(data) as SemanticChunk[]))
          }
        }
      } catch {
        // baseDir might be empty or error reading
      }
    }

    const lower = query.toLowerCase()

    // Simple text matching fallback (in place of LanceDB vector search)
    // Score based on word hits
    const queryWords = lower.split(/\s+/)

    const scored = allChunks.map(chunk => {
      const contentLower = chunk.content.toLowerCase()
      let score = 0
      for (const word of queryWords) {
        if (word.length > 1 && contentLower.includes(word)) {
          score++
        }
      }
      return { chunk, score }
    }).filter(s => s.score > 0)

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, topK).map(s => s.chunk)
  }

  async deleteByAgent(agentId: string): Promise<void> {
    await this.initPromise
    const filePath = this.getAgentFilePath(agentId)
    try {
      await fs.unlink(filePath)
    } catch {
      // Ignore if file already doesn't exist
    }
  }
}

export const semanticMemory = new SemanticMemoryStore()

