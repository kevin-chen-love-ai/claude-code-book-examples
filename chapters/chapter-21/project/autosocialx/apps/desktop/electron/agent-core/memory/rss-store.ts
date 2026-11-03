import { app } from 'electron'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as crypto from 'node:crypto'

export interface RssFeedSource {
    id: string
    title: string
    url: string
    category: string
    addedAt: string
}

export class RssStore {
    private filePath: string = ''
    private initPromise: Promise<void> | null = null

    constructor() {
        this.initPromise = this.init()
    }

    private async init(): Promise<void> {
        try {
            const dir = app.getPath('userData')
            this.filePath = path.join(dir, 'rss_feeds.json')
        } catch (e) {
            console.error('[RssStore] Failed to init:', e)
        }
    }

    private async load(): Promise<RssFeedSource[]> {
        await this.initPromise
        try {
            const data = await fs.readFile(this.filePath, 'utf-8')
            return JSON.parse(data) as RssFeedSource[]
        } catch {
            return []
        }
    }

    private async save(feeds: RssFeedSource[]): Promise<void> {
        await this.initPromise
        await fs.writeFile(this.filePath, JSON.stringify(feeds, null, 2), 'utf-8')
    }

    async list(): Promise<RssFeedSource[]> {
        return this.load()
    }

    async add(title: string, url: string, category = 'General'): Promise<RssFeedSource> {
        const feeds = await this.load()
        // Avoid duplicates by URL
        if (feeds.find(f => f.url === url)) {
            return feeds.find(f => f.url === url)!
        }
        const feed: RssFeedSource = {
            id: crypto.randomUUID(),
            title,
            url,
            category,
            addedAt: new Date().toISOString(),
        }
        feeds.push(feed)
        await this.save(feeds)
        return feed
    }

    async delete(id: string): Promise<boolean> {
        const feeds = await this.load()
        const filtered = feeds.filter(f => f.id !== id)
        if (filtered.length !== feeds.length) {
            await this.save(filtered)
            return true
        }
        return false
    }

    /**
     * Fetch an OPML file from a URL and import all feeds from it.
     */
    async importFromUrl(opmlUrl: string): Promise<RssFeedSource[]> {
        const response = await fetch(opmlUrl, { signal: AbortSignal.timeout(15000) })
        if (!response.ok) {
            throw new Error(`Failed to fetch OPML from ${opmlUrl}: HTTP ${response.status}`)
        }
        const xml = await response.text()
        return this.importOPML(xml)
    }

    /**
     * Parse an OPML XML string and import all <outline xmlUrl="…"> entries.
     * Returns the list of newly added feeds.
     */
    async importOPML(opmlXml: string): Promise<RssFeedSource[]> {
        const added: RssFeedSource[] = []
        // Simple regex-based OPML parse — avoids pulling in a DOM parser
        // Matches <outline ... xmlUrl="URL" ... text="Title" ...>
        const outlinePattern = /<outline([^>]*)>/gi
        let match: RegExpExecArray | null
        while ((match = outlinePattern.exec(opmlXml)) !== null) {
            const attrs = match[1] ?? ''
            const xmlUrl = /xmlUrl\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]
            if (!xmlUrl) continue
            const text = /text\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] ?? xmlUrl
            const category = /category\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] ?? 'Imported'
            const title = /title\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] ?? text
            const feed = await this.add(title, xmlUrl, category)
            added.push(feed)
        }
        return added
    }
}

export const rssStore = new RssStore()
