import type { ToolCall, ToolContext, ToolCallRecord } from '../types'
import { toolRegistry } from './registry'
import { messageBus } from '../message-bus'

export class ToolExecutor {
  async execute(toolCall: ToolCall, ctx: ToolContext): Promise<unknown> {
    const tool = toolRegistry.get(toolCall.name)
    if (!tool) {
      throw new Error(`Tool not found: ${toolCall.name}`)
    }

    const permission = tool.requiredPermission
    if (!ctx.securityProfile.allowedTools.includes(permission)) {
      throw new Error(`Permission denied: ${permission} is not allowed for agent ${ctx.agentId}`)
    }

    messageBus.emit('tool:executing', {
      agentId: ctx.agentId,
      runId: ctx.runId,
      toolName: toolCall.name,
    })

    const startedAt = new Date()
    let result: unknown
    let success = false

    try {
      result = await tool.handler(toolCall.args, ctx)
      success = true
    } catch (err) {
      const finishedAt = new Date()
      const record: ToolCallRecord = {
        id: toolCall.id,
        name: toolCall.name,
        args: toolCall.args,
        result: err instanceof Error ? err.message : String(err),
        status: 'error',
        startedAt,
        finishedAt,
      }
      ctx.workingMemory.toolCallHistory.push(record)

      messageBus.emit('tool:result', {
        agentId: ctx.agentId,
        runId: ctx.runId,
        toolName: toolCall.name,
        success: false,
      })

      throw err
    }

    const finishedAt = new Date()
    const record: ToolCallRecord = {
      id: toolCall.id,
      name: toolCall.name,
      args: toolCall.args,
      result,
      status: 'success',
      startedAt,
      finishedAt,
    }
    ctx.workingMemory.toolCallHistory.push(record)

    messageBus.emit('tool:result', {
      agentId: ctx.agentId,
      runId: ctx.runId,
      toolName: toolCall.name,
      success,
    })

    return result
  }
}

export const toolExecutor = new ToolExecutor()
