import { app } from 'electron'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as crypto from 'node:crypto'

export interface KnowledgeDocument {
    id: string
    title: string
    content: string
    addedAt: string
}

export class KnowledgeStore {
    private baseDir: string = ''
    private filePath: string = ''
    private initPromise: Promise<void> | null = null

    constructor() {
        this.initPromise = this.init()
    }

    private async init(): Promise<void> {
        try {
            this.baseDir = path.join(app.getPath('userData'), 'knowledge_base')
            await fs.mkdir(this.baseDir, { recursive: true })
            this.filePath = path.join(this.baseDir, 'documents.json')
        } catch (e) {
            console.error('[KnowledgeStore] Failed to init dir:', e)
        }
    }

    private async loadDocs(): Promise<KnowledgeDocument[]> {
        await this.initPromise
        try {
            const data = await fs.readFile(this.filePath, 'utf-8')
            return JSON.parse(data) as KnowledgeDocument[]
        } catch {
            return []
        }
    }

    private async saveDocs(docs: KnowledgeDocument[]): Promise<void> {
        await this.initPromise
        await fs.writeFile(this.filePath, JSON.stringify(docs, null, 2), 'utf-8')
    }

    async addDocument(title: string, content: string): Promise<KnowledgeDocument> {
        const docs = await this.loadDocs()
        const doc: KnowledgeDocument = {
            id: crypto.randomUUID(),
            title,
            content,
            addedAt: new Date().toISOString()
        }
        docs.push(doc)
        await this.saveDocs(docs)
        return doc
    }

    async deleteDocument(id: string): Promise<boolean> {
        const docs = await this.loadDocs()
        const filtered = docs.filter(d => d.id !== id)
        if (filtered.length !== docs.length) {
            await this.saveDocs(filtered)
            return true
        }
        return false
    }

    async listDocuments(): Promise<KnowledgeDocument[]> {
        return this.loadDocs()
    }

    async search(query: string, topK = 3): Promise<KnowledgeDocument[]> {
        const docs = await this.loadDocs()
        if (!query.trim()) return []

        const lower = query.toLowerCase()
        const queryWords = lower.split(/\s+/)

        const scored = docs.map(doc => {
            const contentLower = doc.content.toLowerCase() + ' ' + doc.title.toLowerCase()
            let score = 0
            for (const word of queryWords) {
                if (word.length > 1 && contentLower.includes(word)) {
                    score++
                }
            }
            return { doc, score }
        }).filter(s => s.score > 0)

        scored.sort((a, b) => b.score - a.score)
        return scored.slice(0, topK).map(s => s.doc)
    }
}

export const knowledgeStore = new KnowledgeStore()
