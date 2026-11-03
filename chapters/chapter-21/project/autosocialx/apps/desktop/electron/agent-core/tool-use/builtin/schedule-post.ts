import type { ToolDefinition } from '../../types.js'
import { contentStore } from '../../../db/content-store.js'
import { messageBus } from '../../message-bus.js'
import { getCampaignId } from '../campaign-context.js'
import type { PlatformId } from '../../types.js'

export const schedulePostTool: ToolDefinition = {
  name: 'schedule_post',
  description:
    'Save a generated post as a draft or schedule it for future publishing. ' +
    'Returns the content record ID that can be used to track publication status.',
  inputSchema: {
    type: 'object',
    properties: {
      platform: {
        type: 'string',
        description: 'Target platform: x | linkedin | xiaohongshu',
      },
      text: {
        type: 'string',
        description: 'Post text content',
      },
      scheduledAt: {
        type: 'string',
        description: 'ISO 8601 datetime for scheduled publish. Omit to save as draft.',
      },
      mediaUrls: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional array of media URLs to attach to the post. Pass multiple URLs for carousel/multi-image posts (e.g. xiaohongshu: 3–9, instagram: 1–3, x: 1–4). Each URL must come from a prior `image_gen` tool call.',
      },
    },
    required: ['platform', 'text'],
  },
  requiredPermission: 'tool:schedule_post',
  handler: async (args, ctx) => {
    const platform  = args['platform']    as PlatformId
    const text      = args['text']        as string
    const rawDate   = args['scheduledAt'] as string | undefined
    const mediaUrls = args['mediaUrls']   as string[] | undefined

    const scheduledAt = rawDate ? new Date(rawDate) : null
    const status      = scheduledAt ? 'scheduled' : 'draft'
    const campaignId  = getCampaignId(ctx.agentId)

    const record = contentStore.create({
      agentId: ctx.agentId,
      campaignId,
      platform,
      text,
      mediaUrls: mediaUrls ?? [],
      status,
      scheduledAt,
    })

    // Always notify renderer so the Generate page can display the real content
    messageBus.emit('post:scheduled', {
      agentId: ctx.agentId,
      contentId: record.id,
      scheduledAt: scheduledAt ?? null,
    })

    messageBus.emit('agent:log', {
      agentId: ctx.agentId,
      runId: ctx.runId,
      message: `[schedule_post] Content ${record.id} saved as ${status} on ${platform}`,
    })

    return {
      success:     true,
      contentId:   record.id,
      status,
      platform,
      scheduledAt: record.scheduledAt?.toISOString() ?? null,
      message: scheduledAt
        ? `Post scheduled for ${scheduledAt.toISOString()}`
        : 'Post saved as draft',
    }
  },
}
