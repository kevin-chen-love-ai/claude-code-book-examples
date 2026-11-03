import { fork } from 'child_process'
import type { ChildProcess } from 'child_process'
import { join } from 'path'
import type { JsonRpcRequest, JsonRpcResponse } from './rpc.js'
import { isRpcError } from './rpc.js'
import type { ToolDefinition, Permission } from '../agent-core/types.js'
import { messageBus } from '../agent-core/message-bus.js'
import { getDb } from '../db/client.js'


// When the MCP browser is connected, the caller can pass this fn so platform
// publish goes through the user's live Chrome session instead of the child process.
type PublishViaBrowserFn = (
  platform: string,
  text: string,
) => Promise<{ success: boolean; postId?: string; error?: string }>

export class WorkerBridge {
  private worker: ChildProcess | null = null
  private pending = new Map<
    string | number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >()
  private idCounter = 1

  start(): void {
    if (this.worker) return

    // Compiled worker path (tsc outputs .js)
    const workerPath = join(__dirname, 'playwright-worker.js')
    this.worker = fork(workerPath, [], { silent: false })

    this.worker.on('message', (msg: unknown) => {
      const rpcMsg = msg as JsonRpcResponse
      // id === 0 is the worker-ready ping — ignore
      if (rpcMsg.id === 0) return

      const pending = this.pending.get(rpcMsg.id)
      if (!pending) return
      this.pending.delete(rpcMsg.id)

      if (isRpcError(rpcMsg)) {
        pending.reject(new Error(rpcMsg.error.message))
      } else {
        pending.resolve(rpcMsg.result)
      }
    })

    this.worker.on('error', (err) => {
      console.error('[WorkerBridge] worker error:', err)
      for (const { reject } of this.pending.values()) reject(err)
      this.pending.clear()
    })

    this.worker.on('exit', (code) => {
      this.worker = null
      console.warn(`[WorkerBridge] worker exited with code ${code}`)
    })
  }

  stop(): void {
    this.worker?.kill()
    this.worker = null
  }

  call<T = unknown>(method: string, params: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('WorkerBridge: worker not started'))
        return
      }
      const id = this.idCounter++
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      const req: JsonRpcRequest = { jsonrpc: '2.0', method, params, id }
      this.worker.send(req)
    })
  }

  // ─── Platform tool definitions ──────────────────────────────────────────────

  createPlatformTools(publishFn?: PublishViaBrowserFn): ToolDefinition[] {
    type PlatformEntry = { permission: Permission; method: string; label: string }
    const platforms: PlatformEntry[] = [
      { permission: 'tool:x_publish',       method: 'x.publish',           label: 'X (Twitter)' },
      { permission: 'tool:linkedin_post',   method: 'linkedin.publish',    label: 'LinkedIn' },
      { permission: 'tool:xhs_publish',     method: 'xiaohongshu.publish', label: '小红书' },
      { permission: 'tool:instagram_post',  method: 'instagram.publish',   label: 'Instagram' },
      { permission: 'tool:tiktok_post',     method: 'tiktok.publish',      label: 'TikTok' },
      { permission: 'tool:youtube_post',    method: 'youtube.publish',     label: 'YouTube' },
      { permission: 'tool:facebook_post',   method: 'facebook.publish',    label: 'Facebook' },
      { permission: 'tool:threads_post',    method: 'threads.publish',     label: 'Threads' },
      { permission: 'tool:bluesky_post',    method: 'bluesky.publish',     label: 'Bluesky' },
      { permission: 'tool:weibo_post',      method: 'weibo.publish',       label: '微博' },
      { permission: 'tool:bilibili_post',   method: 'bilibili.publish',    label: '哔哩哔哩' },
      { permission: 'tool:douyin_post',     method: 'douyin.publish',      label: '抖音' },
      { permission: 'tool:pinterest_post',  method: 'pinterest.publish',   label: 'Pinterest' },
    ]

    const tools: ToolDefinition[] = platforms.map(({ permission, method, label }) => ({
      name: method.replace('.', '_'),
      description: `Publish a post to ${label}. Requires post text and optional media URLs.`,
      inputSchema: {
        type: 'object' as const,
        properties: {
          text:         { type: 'string' as const, description: 'Post text content' },
          mediaUrls:    { type: 'array'  as const, items: { type: 'string' as const }, description: 'Optional media URLs to attach' },
          credentialId: { type: 'string' as const, description: 'Credential ID from the credential store' },
        },
        required: ['text'],
      },
      requiredPermission: permission,
      handler: async (args, ctx) => {
        const toolName = method.replace('.', '_')
        const platformId = method.split('.')[0]!  // 'x' | 'linkedin' | 'xiaohongshu'
        messageBus.emit('tool:executing', { agentId: ctx.agentId, runId: ctx.runId, toolName })

        const text = String((args as Record<string, unknown>)['text'] ?? '')

        // If MCP browser is available, publish directly (reuses user's Chrome session)
        if (publishFn) {
          const result = await publishFn(platformId, text)
          if (!result.success && result.error === 'Browser not connected') {
            // Browser not logged in — save as queued instead of failing the agent run
            const db = getDb()
            const id = crypto.randomUUID()
            const now = Math.floor(Date.now() / 1000)
            db.prepare(
              `INSERT INTO content (id, agent_id, platform, text, media_urls, status, scheduled_at, published_at, post_id, stats)
               VALUES (?, ?, ?, ?, '[]', 'queued', ?, NULL, NULL, '{}')`
            ).run(id, ctx.agentId, platformId, text, now)
            messageBus.emit('tool:result', { agentId: ctx.agentId, runId: ctx.runId, toolName, success: true })
            console.log(`[WorkerBridge] Browser not connected — content ${id} saved as queued on ${platformId}`)
            return { success: true, queued: true, contentId: id }
          }
          messageBus.emit('tool:result', { agentId: ctx.agentId, runId: ctx.runId, toolName, success: result.success })
          if (!result.success) throw new Error(result.error ?? `Failed to publish to ${label}`)
          return result
        }

        // Fall back to child-process worker (stub until real Playwright is added)
        const result = await this.call(method, args) as { success?: boolean; error?: string }
        const ok = result?.success !== false
        messageBus.emit('tool:result', { agentId: ctx.agentId, runId: ctx.runId, toolName, success: ok })
        if (!ok) throw new Error(result?.error ?? `Failed to publish to ${label}`)
        return result
      },
    }))

    tools.push({
      name: 'scrape_page',
      description: 'Scrape the visible content of a web page using a headless browser.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Full URL of the page to scrape' },
        },
        required: ['url'],
      },
      requiredPermission: 'tool:scrape_page',
      handler: async (args, ctx) => {
        messageBus.emit('tool:executing', { agentId: ctx.agentId, runId: ctx.runId, toolName: 'scrape_page' })
        const result = await this.call('scrape.page', args)
        messageBus.emit('tool:result', { agentId: ctx.agentId, runId: ctx.runId, toolName: 'scrape_page', success: true })
        return result
      },
    })

    return tools
  }
}

export const workerBridge = new WorkerBridge()
