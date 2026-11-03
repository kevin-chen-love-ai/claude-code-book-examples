import type { ToolDefinition, ToolContext } from '../../types'
import { getToolKey } from '../tool-keys.js'
import { configStore } from '../../../config-store.js'
import { messageBus } from '../../message-bus.js'

const DEFAULT_BASE_URL = 'https://api.302.ai'
const DEFAULT_MODEL = 'kling-v1'
const POLL_INTERVAL_MS = 4000
const POLL_TIMEOUT_MS = 120000
const MAX_IMAGES_PER_RUN = 5

// Per-run image generation counter: runId → count
const runImageCount = new Map<string, number>()

// Clean up counters when a run finishes to prevent memory leaks
messageBus.on('agent:run-complete', ({ runId }) => runImageCount.delete(runId))
messageBus.on('agent:run-failed',   ({ runId }) => runImageCount.delete(runId))

// Map size string → kling aspect_ratio
const SIZE_TO_RATIO: Record<string, string> = {
  '1024x1024': '1:1',
  '1280x720': '16:9',
  '720x1280': '9:16',
}

export const imageGenTool: ToolDefinition = {
  name: 'image_gen',
  description: 'Generate a social media image using AI (302.ai Kling v1 model). Returns one image URL per call. Call multiple times to generate a set of images for carousel posts (e.g. xiaohongshu needs 3–9). Collect all URLs then pass them as the `mediaUrls` array in `schedule_post`.',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Detailed English description of the image to generate',
      },
      size: {
        type: 'string',
        enum: ['1024x1024', '1280x720', '720x1280'],
        description: 'Image dimensions. 1024x1024=square, 1280x720=landscape 16:9, 720x1280=portrait 9:16 (default: 1024x1024)',
      },
    },
    required: ['prompt'],
  },
  requiredPermission: 'tool:image_gen',

  handler: async (args: Record<string, unknown>, ctx: ToolContext) => {
    const { agentId, runId } = ctx
    const log = (msg: string) => messageBus.emit('agent:log', { agentId, runId, message: msg })

    const prompt = typeof args['prompt'] === 'string' ? args['prompt'] : ''
    const size = typeof args['size'] === 'string' ? args['size'] : '1024x1024'

    if (!prompt) return { error: 'INVALID CALL: "prompt" argument is required but was not provided. You must call image_gen with a prompt, e.g.: {"prompt": "A mountain at sunset, photorealistic style"}. Fix your arguments and retry.', invalid_args: true }

    // Enforce per-run image limit
    const count = runImageCount.get(runId) ?? 0
    if (count >= MAX_IMAGES_PER_RUN) {
      log(`[image_gen] ⚠ Run limit reached (${MAX_IMAGES_PER_RUN} images max per run)`)
      return { error: `Image generation limit reached: max ${MAX_IMAGES_PER_RUN} images per run` }
    }
    runImageCount.set(runId, count + 1)

    const apiKey = getToolKey('302ai')
    if (!apiKey) {
      log('[image_gen] ❌ No 302.ai API key — please configure in Settings → Image Model')
      return { error: 'No 302.ai API key configured. Please add it in Settings → Image Model.' }
    }

    const baseURL = (configStore.get('imageBaseURL') as string | undefined)?.replace(/\/$/, '') || DEFAULT_BASE_URL
    const aspectRatio = SIZE_TO_RATIO[size] ?? '1:1'

    log(`[image_gen] Submitting task — model=${DEFAULT_MODEL} ratio=${aspectRatio} prompt="${prompt.slice(0, 80)}${prompt.length > 80 ? '…' : ''}"`)

    // Step 1: Submit task
    let res: Response
    try {
      res = await fetch(`${baseURL}/klingai/v1/images/generations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: DEFAULT_MODEL, prompt, aspect_ratio: aspectRatio }),
        signal: AbortSignal.timeout(30000),
      })
    } catch (err) {
      const msg = `Network error: ${err instanceof Error ? err.message : String(err)}`
      log(`[image_gen] ❌ ${msg}`)
      return { error: msg }
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText)
      log(`[image_gen] ❌ API error ${res.status}: ${errText}`)
      return { error: `302.ai API error ${res.status}: ${errText}` }
    }

    const json = await res.json() as { code: number; data?: { task_id?: string; task_status?: string; task_result?: { images?: Array<{ url: string }> } }; message?: string }

    if (json.code !== 0) {
      log(`[image_gen] ❌ Kling error: ${json.message ?? JSON.stringify(json)}`)
      return { error: `Kling API error: ${json.message ?? JSON.stringify(json)}` }
    }

    const taskId = json.data?.task_id
    if (!taskId) {
      log('[image_gen] ❌ No task_id in response')
      return { error: 'No task_id in response', raw: JSON.stringify(json).slice(0, 300) }
    }

    log(`[image_gen] Task submitted — taskId=${taskId}, polling for result…`)

    // Step 2: Poll for result
    const cdnUrl = await pollKlingTask(baseURL, apiKey, taskId, log)
    if (!cdnUrl) {
      log('[image_gen] ❌ Timed out after 2 minutes waiting for image')
      return { error: 'Image generation timed out after 2 minutes' }
    }

    // Return CDN URL directly — do NOT download to base64.
    // Base64-encoding a 1–2MB image into the tool result inflates the context window
    // by ~2M tokens, causing the very next LLM call to time out before schedule_post
    // can be invoked. The renderer fetches the CDN URL at display time instead.
    log(`[image_gen] ✅ Image ready — ${cdnUrl.slice(0, 80)}…`)
    return { url: cdnUrl, prompt, model: DEFAULT_MODEL }
  },
}

async function pollKlingTask(
  baseURL: string,
  apiKey: string,
  taskId: string,
  log: (msg: string) => void,
): Promise<string | null> {
  const deadline = Date.now() + POLL_TIMEOUT_MS
  let attempts = 0
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
    attempts++
    try {
      const res = await fetch(`${baseURL}/klingai/v1/images/generations/${taskId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) { log(`[image_gen] Poll attempt ${attempts} — HTTP ${res.status}`); continue }
      const json = await res.json() as { code: number; data?: { task_status?: string; task_result?: { images?: Array<{ url: string }> } } }
      const status = json.data?.task_status
      log(`[image_gen] Poll attempt ${attempts} — status=${status ?? 'unknown'}`)
      if (status === 'succeed') {
        return json.data?.task_result?.images?.[0]?.url ?? null
      }
      if (status === 'failed') { log('[image_gen] Task failed on server'); return null }
      // 'submitted' | 'processing' → keep polling
    } catch (err) {
      log(`[image_gen] Poll attempt ${attempts} — error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return null
}
