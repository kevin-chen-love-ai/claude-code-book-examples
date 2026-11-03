// Playwright Worker — runs as child_process.fork()
// Receives JsonRpcRequest from parent process, dispatches to platform adapters.
// P1 TODO: Replace stub implementations with real Playwright browser automation.

import type { JsonRpcRequest, JsonRpcResponse } from './rpc.js'
import { RPC_ERROR_CODES } from './rpc.js'
import { execFile } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { chromium, type Browser, type Page } from 'playwright'

// ─── Inline stub adapter types ────────────────────────────────────────────────
// Inlined to avoid cross-package runtime dependency in the child process.

interface PostDraft {
  text: string
  platform: string
  mediaUrls?: string[]
  credentialId?: string
}

interface PublishResult {
  ok: boolean
  postId?: string
  error?: string
  publishedAt?: string
}

interface HealthStatus {
  ok: boolean
  message?: string
}

interface TrendResult {
  trends: string[]
}

type PlatformAdapterMap = Record<string, {
  checkHealth: () => Promise<HealthStatus>
  fetchTrends: () => Promise<TrendResult>
  executePublish: (draft: PostDraft) => Promise<PublishResult>
}>

// ─── Stub adapters ────────────────────────────────────────────────────────────

const platformAdapters: PlatformAdapterMap = {
  x: {
    checkHealth: async () => ({ ok: true, message: 'X adapter healthy (stub)' }),
    fetchTrends: async () => ({ trends: ['#AI', '#TechNews', '#OpenSource', '#Startup', '#Innovation'] }),
    executePublish: async (_d) => ({ ok: true, postId: `x_${Date.now()}`, publishedAt: new Date().toISOString() }),
  },
  linkedin: {
    checkHealth: async () => ({ ok: true, message: 'LinkedIn adapter healthy (stub)' }),
    fetchTrends: async () => ({ trends: ['#Leadership', '#Innovation', '#FutureOfWork', '#Technology', '#Business'] }),
    executePublish: async (_d) => ({ ok: true, postId: `li_${Date.now()}`, publishedAt: new Date().toISOString() }),
  },
  xiaohongshu: {
    checkHealth: async () => ({ ok: true, message: '小红书 adapter healthy (stub)' }),
    fetchTrends: async () => ({ trends: ['#好物推荐', '#生活方式', '#职场干货', '#科技前沿', '#创业分享'] }),
    executePublish: async (_d) => ({ ok: true, postId: `xhs_${Date.now()}`, publishedAt: new Date().toISOString() }),
  },
}

// ─── Handler registry ──────────────────────────────────────────────────────────

type Handler = (params: unknown) => Promise<unknown>

// Strip HTML tags and collapse whitespace, returning clean readable text.
function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

// Extract main content from HTML, prioritising <article>/<main> over full body
function extractMainContent(html: string): string {
  // Remove script, style, nav, footer, header, aside blocks entirely
  let cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  // Try to extract semantic content zone
  const articleMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  const mainMatch = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  const zone = articleMatch?.[1] ?? mainMatch?.[1] ?? cleaned

  // Strip remaining tags and normalise whitespace
  return zone
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

// Run a command with a hard timeout (SIGTERM → SIGKILL)
function execWithTimeout(
  cmd: string,
  args: string[],
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean }> {
  return new Promise((resolve) => {
    let timedOut = false
    const proc = execFile(cmd, args, { timeout: 0, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({
        stdout: stdout.slice(0, 8192),
        stderr: stderr.slice(0, 8192),
        exitCode: timedOut ? -1 : (err?.code as number | undefined ?? 0),
        timedOut,
      })
    })

    const timer = setTimeout(() => {
      timedOut = true
      proc.kill('SIGTERM')
      setTimeout(() => { try { proc.kill('SIGKILL') } catch { /* already dead */ } }, 1000)
    }, timeoutMs)

    proc.on('close', () => clearTimeout(timer))
  })
}

function buildHandlers(): Record<string, Handler> {
  const h: Record<string, Handler> = {
    'health': async () => ({ ok: true, pid: process.pid }),

    'scrape.page': async (p) => {
      const { url } = p as { url: string }
      let browser: Browser | null = null
      try {
        browser = await chromium.launch({ headless: true, channel: 'chrome' })
        const page = await browser.newPage()
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

        const title = await page.title()
        const bodyHandle = await page.$('body')
        const html = await bodyHandle?.innerHTML() || ''
        const content = extractMainContent(html).slice(0, 10000)

        return {
          url,
          title,
          content,
          status: 200,
          timestamp: new Date().toISOString()
        }
      } catch (err) {
        return {
          url,
          error: err instanceof Error ? err.message : String(err),
          status: 500,
          timestamp: new Date().toISOString()
        }
      } finally {
        await browser?.close()
      }
    },

    'fetch.url': async (p) => {
      const { url } = p as { url: string }
      let browser: Browser | null = null
      try {
        browser = await chromium.launch({ headless: true, channel: 'chrome' })
        const page = await browser.newPage()
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

        const title = await page.title()
        const html = await page.content()
        const content = extractMainContent(html).slice(0, 8000)
        const wordCount = content.split(/\s+/).filter(Boolean).length

        return { url, title, content, wordCount, timestamp: new Date().toISOString() }
      } catch (err) {
        return { url, title: '', content: '', wordCount: 0, error: String(err) }
      } finally {
        await browser?.close()
      }
    },

    // ── Browser-based web search (Bing scrape — no API key needed) ───────────
    'search.web': async (p) => {
      const { query, maxResults = 5 } = p as { query: string; maxResults?: number }
      let browser: Browser | null = null
      let page: Page | null = null
      try {
        browser = await chromium.launch({ headless: true, channel: 'chrome' })
        page = await browser.newPage()

        await page.setExtraHTTPHeaders({
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        })

        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${maxResults * 2}&setlang=zh-CN`
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 })

        // page.evaluate runs inside the browser — cast to any to avoid tsconfig.node.json dom-lib issues
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results = await page.evaluate((max: number): { title: string; url: string; snippet: string }[] => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const doc = (globalThis as any).document as any
          const items: { title: string; url: string; snippet: string }[] = []
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          doc.querySelectorAll('li.b_algo').forEach((node: any) => {
            if (items.length >= max) return
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const anchor: any = node.querySelector('h2 a')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const snippetEl: any = node.querySelector('.b_caption p, .b_paractl, p')
            const title: string = anchor?.innerText?.trim() ?? ''
            const url: string = anchor?.href ?? ''
            const snippet: string = snippetEl?.innerText?.trim() ?? ''
            if (title && url && url.startsWith('http')) items.push({ title, url, snippet })
          })
          return items
        }, maxResults)

        if (results.length > 0) {
          return { results, source: 'bing' }
        }

        // Fallback: try Google if Bing returned nothing
        await page.goto(
          `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${maxResults * 2}&hl=zh-CN`,
          { waitUntil: 'domcontentloaded', timeout: 25000 },
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const googleResults = await page.evaluate((max: number): { title: string; url: string; snippet: string }[] => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const doc = (globalThis as any).document as any
          const items: { title: string; url: string; snippet: string }[] = []
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          doc.querySelectorAll('div.g').forEach((div: any) => {
            if (items.length >= max) return
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const anchor: any = div.querySelector('a[href]')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const h3: any = div.querySelector('h3')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const snippetDiv: any = div.querySelector('.VwiC3b, .st, span')
            const url: string = anchor?.href ?? ''
            const title: string = h3?.innerText?.trim() ?? ''
            const snippet: string = snippetDiv?.innerText?.trim() ?? ''
            if (title && url.startsWith('http') && !url.includes('google.com')) {
              items.push({ title, url, snippet })
            }
          })
          return items
        }, maxResults)

        return { results: googleResults, source: 'google' }
      } catch (err) {
        return { results: [], error: err instanceof Error ? err.message : String(err) }
      } finally {
        await browser?.close()
      }
    },

    // ── Shell command execution (non-shell mode, no injection risk) ──────────
    'code.shell': async (p) => {
      const { command } = p as { command: string[] }
      if (!Array.isArray(command) || command.length === 0) {
        return { stdout: '', stderr: 'command must be a non-empty array', exitCode: 1, timedOut: false }
      }
      const [cmd, ...args] = command as [string, ...string[]]
      return execWithTimeout(cmd, args, 30_000)
    },

    // ── Python script execution (isolated mode, temp file) ───────────────────
    'code.python': async (p) => {
      const { code } = p as { code: string }
      const tmpFile = join(tmpdir(), `autosocialx_${randomUUID()}.py`)
      try {
        await writeFile(tmpFile, code, 'utf8')
        return await execWithTimeout('python3', ['-I', tmpFile], 60_000)
      } finally {
        await unlink(tmpFile).catch(() => { /* ignore */ })
      }
    },
  }

  for (const [platform, adapter] of Object.entries(platformAdapters)) {
    h[`${platform}.health`] = async () => adapter.checkHealth()
    h[`${platform}.trends`] = async () => adapter.fetchTrends()
    h[`${platform}.publish`] = async (p) => adapter.executePublish(p as PostDraft)
  }

  return h
}

const handlers = buildHandlers()

// ─── Message loop ──────────────────────────────────────────────────────────────

// Exit cleanly when parent disconnects (e.g. Electron window closes)
process.on('disconnect', () => process.exit(0))

process.on('message', async (req: unknown) => {
  const send = (res: JsonRpcResponse): void => {
    try { process.send?.(res) } catch { /* parent channel closed, ignore */ }
  }

  if (
    !req ||
    typeof req !== 'object' ||
    (req as JsonRpcRequest).jsonrpc !== '2.0' ||
    typeof (req as JsonRpcRequest).method !== 'string'
  ) {
    send({ jsonrpc: '2.0', id: 0, error: { code: RPC_ERROR_CODES.INVALID_REQUEST, message: 'Invalid JSON-RPC request' } })
    return
  }

  const rpcReq = req as JsonRpcRequest
  const handler = handlers[rpcReq.method]

  if (!handler) {
    send({ jsonrpc: '2.0', id: rpcReq.id, error: { code: RPC_ERROR_CODES.METHOD_NOT_FOUND, message: `Unknown method: ${rpcReq.method}` } })
    return
  }

  try {
    const result = await handler(rpcReq.params)
    send({ jsonrpc: '2.0', id: rpcReq.id, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    send({ jsonrpc: '2.0', id: rpcReq.id, error: { code: RPC_ERROR_CODES.INTERNAL_ERROR, message } })
  }
})

// Signal readiness to parent
process.send?.({ jsonrpc: '2.0', id: 0, result: { ready: true, pid: process.pid } })
