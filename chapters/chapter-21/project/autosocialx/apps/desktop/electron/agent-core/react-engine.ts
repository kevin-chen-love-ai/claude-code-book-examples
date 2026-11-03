import type {
  AgentRunResult,
  RunStep,
  SecurityProfile,
  StopCondition,
  ToolDefinition,
} from './types'
import { workingMemory } from './memory/working-memory'
import { toolExecutor } from './tool-use/executor'
import { toolRegistry } from './tool-use/registry'
import { llmGateway } from './llm-gateway'
import { messageBus } from './message-bus'
import { SecurityPolicy } from './security'

export interface ReactEngineConfig {
  agentId: string
  provider: string
  model: string
  systemPrompt?: string
  maxIterations?: number
  stopConditions?: StopCondition[]
  securityProfile?: SecurityProfile
  /** @deprecated use maxIterations */
  maxTokens?: number
}

// Hard limits applied to every run
const MAX_TOOL_CALLS_PER_TOOL = 5   // same tool at most 5 calls per run
const MAX_IDENTICAL_TOOL_CALLS = 3  // identical tool+args → stuck loop, break out
const DEFAULT_TIMEOUT_MS = 2 * 60 * 60 * 1000  // 2 hours — supports complex multi-step tasks

// Set DEBUG_AGENT=1 to enable per-step LLM input/output logging
const DEBUG = process.env['DEBUG_AGENT'] === '1'

function dbg(emit: (msg: string) => void, msg: string): void {
  if (DEBUG) emit(msg)
}

export class ReactEngine {
  async run(config: ReactEngineConfig, initialInput: string): Promise<AgentRunResult> {
    const {
      agentId,
      provider,
      model,
      systemPrompt = '',
      maxIterations = 30,
      stopConditions = [],
      securityProfile,
    } = config

    const wm = await workingMemory.create(agentId)
    const { runId } = wm

    await workingMemory.addMessage(runId, { role: 'user', content: initialInput })

    messageBus.emit('agent:run-started', { agentId, runId })

    const startTime = Date.now()
    const steps: RunStep[] = []
    let tokensUsed = 0
    let finalAnswer = ''
    let success = false
    let errorMessage: string | undefined

    // Per-tool call counter — prevents infinite retries on the same failing tool
    const toolCallCounts = new Map<string, number>()
    // Identical-args counter — detects stuck loops (same tool + same args repeated)
    const identicalCallCounts = new Map<string, number>()
    // Tracks whether schedule_post was successfully invoked this run
    let schedulePostSucceeded = false
    // Tracks whether we already injected a "call schedule_post" reminder (text-only path)
    let textOnlyReminderSent = false
    // Tracks how many consecutive iterations had all tool calls blocked (limit hit or identical loop)
    let allBlockedCount = 0
    // Tracks whether we injected a "blocked tools" rescue reminder
    let blockedReminderSent = false

    const defaultProfile: SecurityProfile = {
      agentId,
      allowedPlatforms: [],
      allowedTools: [],
      maxTokensPerRun: 0,
      maxRunsPerHour: 0,
      canAccessInternet: false,
      canReadFiles: false,
      credentialScope: [],
    }
    const resolvedProfile = securityProfile ?? defaultProfile
    const allowedTools = this.buildAllowedTools(resolvedProfile)
    const policy = new SecurityPolicy(resolvedProfile)
    const log = (msg: string) => messageBus.emit('agent:log', { agentId, runId, message: msg })

    try {
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        // ── Global timeout guard ────────────────────────────────────────────
        if (Date.now() - startTime > DEFAULT_TIMEOUT_MS) {
          log(`[Timeout] Run exceeded ${DEFAULT_TIMEOUT_MS / 1000}s — stopping`)
          break
        }

        log(`[Iteration ${iteration + 1}/${maxIterations}] Reasoning...`)

        // ── Per-iteration LLM call with graceful error handling ─────────────
        const contextMessages = await workingMemory.getContextWindow(runId)
        dbg(log, `[DEBUG:LLM-IN] provider=${provider} model=${model} msgs=${contextMessages.length} tools=${allowedTools.map(t => t.name).join(',')}`)
        if (DEBUG) {
          // Log each message role + content preview
          for (const m of contextMessages) {
            const preview = typeof m.content === 'string'
              ? m.content.slice(0, 300)
              : JSON.stringify(m.content).slice(0, 300)
            log(`[DEBUG:MSG] role=${m.role} content=${preview}${preview.length >= 300 ? '…' : ''}`)
          }
        }

        let result: Awaited<ReturnType<typeof llmGateway.generate>>
        try {
          result = await llmGateway.generate({
            provider,
            model,
            systemPrompt,
            messages: contextMessages,
            tools: allowedTools,
            maxTokens: config.maxTokens ?? 4096,
          })
        } catch (llmErr) {
          const errMsg = llmErr instanceof Error ? llmErr.message : String(llmErr)
          console.error(`[ReAct] LLM call failed at iteration ${iteration}: ${errMsg}`)
          log(`[Error] LLM call failed: ${errMsg} — stopping run`)
          // If we have prior steps, use the last non-empty thought as a partial answer
          for (let i = steps.length - 1; i >= 0; i--) {
            const thought = steps[i]?.thought
            if (thought) {
              finalAnswer = thought
              success = true
              log('[Done] Using last reasoning as partial answer')
              break
            }
          }
          errorMessage = errMsg
          break
        }

        tokensUsed += result.inputTokens + result.outputTokens

        dbg(log, `[DEBUG:LLM-OUT] stopReason=${result.stopReason} toolCalls=${result.toolCalls.length} tokens=${result.inputTokens}+${result.outputTokens} content="${result.content.slice(0, 400)}${result.content.length > 400 ? '…' : ''}"`)
        if (DEBUG && result.toolCalls.length > 0) {
          for (const tc of result.toolCalls) {
            log(`[DEBUG:TOOL-CALL] ${tc.name} args=${JSON.stringify(tc.args)}`)
          }
        }

        // No tool calls — LLM produced a final answer or wrote content as plain text
        if (result.toolCalls.length === 0) {
          if (!result.content) {
            // Empty response — often means the model gave up after blocked tool calls.
            // Try a rescue injection once before giving up.
            if (!schedulePostSucceeded && !blockedReminderSent && iteration < maxIterations - 1) {
              blockedReminderSent = true
              await workingMemory.addMessage(runId, {
                role: 'user',
                content: `IMPORTANT: You returned an empty response. You MUST call \`schedule_post\` now. ` +
                  `Write a post about the topic using any knowledge you have and call \`schedule_post\` immediately. ` +
                  `Do not call any other tool first.`,
              })
              log('[Warn] LLM returned empty response — injecting final rescue reminder')
              steps.push({ iteration, thought: '', action: null, observation: '↩ Empty response rescue injected', timestamp: new Date() })
              continue
            }
            log('[Warn] LLM returned empty response with no tool calls — using step fallback')
            break
          }

          // If schedule_post was never called and we still have iterations left,
          // inject a one-time reminder and continue — the model wrote text instead of calling the tool.
          if (!schedulePostSucceeded && !textOnlyReminderSent && iteration < maxIterations - 1) {
            textOnlyReminderSent = true
            await workingMemory.addMessage(runId, { role: 'assistant', content: result.content })
            await workingMemory.addMessage(runId, {
              role: 'user',
              content: `You wrote the post content as text but did NOT call \`schedule_post\`. ` +
                `This run is not complete until you invoke the tool. ` +
                `Call \`schedule_post\` NOW with the content you just wrote above.`,
            })
            log('[Warn] LLM returned text without tool call — injecting schedule_post reminder, continuing')
            steps.push({ iteration, thought: result.content, action: null, observation: '↩ Reminder injected — awaiting schedule_post call', timestamp: new Date() })
            continue
          }

          finalAnswer = result.content
          log('[Done] Final answer generated')
          const step: RunStep = {
            iteration,
            thought: result.content,
            action: null,
            observation: null,
            timestamp: new Date(),
          }
          steps.push(step)
          success = true
          this.checkStopConditions(step, startTime, stopConditions)
          break
        }

        if (result.stopReason === 'tool_use' && result.toolCalls.length > 0) {
          const step: RunStep = {
            iteration,
            thought: result.content,
            action: result.toolCalls[0] ?? null,
            observation: null,
            timestamp: new Date(),
          }

          await workingMemory.addMessage(runId, {
            role: 'assistant',
            content: result.content,
            toolCalls: result.toolCalls,
          })

          for (const toolCall of result.toolCalls) {
            // ── Identical-args stuck-loop detector ────────────────────────
            const callSig = `${toolCall.name}::${JSON.stringify(toolCall.args)}`
            const identCount = (identicalCallCounts.get(callSig) ?? 0) + 1
            identicalCallCounts.set(callSig, identCount)
            if (identCount > MAX_IDENTICAL_TOOL_CALLS) {
              const stuckMsg = `SYSTEM: You have called "${toolCall.name}" with identical arguments ${identCount} times and keep getting the same result. You are stuck in a loop. STOP calling this tool. You MUST call "schedule_post" now with whatever content you have, without images if needed. Do not call any other tool.`
              log(`[Tool] ${toolCall.name} — stuck loop detected (${identCount} identical calls), breaking`)
              await workingMemory.addMessage(runId, { role: 'tool', content: stuckMsg, toolCallId: toolCall.id, toolName: toolCall.name })
              step.observation = stuckMsg
              continue
            }

            // ── Per-tool retry limit ──────────────────────────────────────
            // Note: invalid_args failures are handled after execution (counted separately,
            // not toward the external-service retry limit — see below)
            const callCount = (toolCallCounts.get(toolCall.name) ?? 0) + 1
            toolCallCounts.set(toolCall.name, callCount)

            if (callCount > MAX_TOOL_CALLS_PER_TOOL) {
              const limitMsg = `SYSTEM: "${toolCall.name}" has been called ${MAX_TOOL_CALLS_PER_TOOL} times and is now blocked for this run. Do NOT call it again. If this was image_gen, proceed to "schedule_post" immediately without images (omit mediaUrls). If this was a search tool, write the post using knowledge you already have and call "schedule_post".`
              log(`[Tool] ${toolCall.name} — retry limit reached, skipping`)
              await workingMemory.addMessage(runId, {
                role: 'tool',
                content: limitMsg,
                toolCallId: toolCall.id,
                toolName: toolCall.name,
              })
              step.observation = limitMsg
              continue
            }

            if (!policy.checkPermission(`tool:${toolCall.name}`)) {
              const observation = `Permission denied: tool:${toolCall.name}`
              log(`[Tool] ${toolCall.name} — permission denied`)
              await workingMemory.addMessage(runId, {
                role: 'tool',
                content: observation,
                toolCallId: toolCall.id,
                toolName: toolCall.name,
              })
              step.observation = observation
              continue
            }

            log(`[Tool] Calling ${toolCall.name}...`)
            dbg(log, `[DEBUG:TOOL-ARGS] ${toolCall.name} ${JSON.stringify(toolCall.args)}`)

            const currentWm = await workingMemory.get(runId)
            if (!currentWm) {
              throw new Error(`WorkingMemory not found for runId: ${runId}`)
            }

            let observation: string
            try {
              const toolResult = await toolExecutor.execute(toolCall, {
                agentId,
                runId,
                workingMemory: currentWm,
                securityProfile: resolvedProfile,
              })
              observation = JSON.stringify(toolResult)
            } catch (toolErr) {
              const errMsg = toolErr instanceof Error ? toolErr.message : String(toolErr)
              observation = JSON.stringify({ error: errMsg })
              log(`[Tool] ${toolCall.name} failed: ${errMsg}`)
            }

            if (DEBUG) {
              log(`[DEBUG:TOOL-RESULT] ${toolCall.name} → ${observation}`)
            } else {
              const preview = observation.length > 200 ? observation.slice(0, 200) + '...' : observation
              log(`[Tool] ${toolCall.name} → ${preview}`)
              // Always log args when tool returns an error — helps diagnose bad LLM inputs
              if (observation.includes('"error"')) {
                log(`[Tool] ${toolCall.name} args=${JSON.stringify(toolCall.args)}`)
              }
            }

            await workingMemory.addMessage(runId, {
              role: 'tool',
              content: observation,
              toolCallId: toolCall.id,
              toolName: toolCall.name,
            })

            step.action = toolCall
            step.observation = observation

            // Track successful schedule_post call — prevents unnecessary reminders
            if (toolCall.name === 'schedule_post' && !observation.includes('"error"')) {
              schedulePostSucceeded = true
            }

            // Invalid-args failures (model sent wrong input) should not count toward
            // the external-service retry limit — roll back the counter so the model
            // gets a fair chance to fix its arguments on the next call.
            if (observation.includes('"invalid_args":true')) {
              toolCallCounts.set(toolCall.name, callCount - 1)
              log(`[Tool] ${toolCall.name} — invalid args, retry count not incremented`)
            }
          }

          // ── Detect when ALL tool calls were blocked this iteration ────────
          // If every tool call was rejected (retry limit / stuck loop / permission),
          // and schedule_post hasn't been called, inject a strong user-role rescue message.
          const allBlocked = result.toolCalls.length > 0 && result.toolCalls.every(tc => {
            const sig = `${tc.name}::${JSON.stringify(tc.args)}`
            return (toolCallCounts.get(tc.name) ?? 0) > MAX_TOOL_CALLS_PER_TOOL ||
                   (identicalCallCounts.get(sig) ?? 0) > MAX_IDENTICAL_TOOL_CALLS ||
                   !policy.checkPermission(`tool:${tc.name}`)
          })
          if (allBlocked && !schedulePostSucceeded) {
            allBlockedCount++
            if (allBlockedCount >= 2 && !blockedReminderSent && iteration < maxIterations - 1) {
              blockedReminderSent = true
              await workingMemory.addMessage(runId, {
                role: 'user',
                content: `FINAL INSTRUCTION: All tool calls you are attempting are blocked. ` +
                  `You MUST call \`schedule_post\` right now. ` +
                  `Write the post text yourself — do NOT use image_gen, do NOT use any other tool. ` +
                  `Call \`schedule_post\` with just the "platform" and "text" fields. This is mandatory.`,
              })
              log('[Warn] All tools blocked — injecting mandatory schedule_post rescue message')
            }
          } else {
            allBlockedCount = 0
          }

          steps.push(step)

          if (this.checkStopConditions(step, startTime, stopConditions)) {
            break
          }
        }
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err)
      success = false
      messageBus.emit('agent:run-failed', { agentId, runId, error: errorMessage })
    }

    // ── Fallback: if loop ended without a final answer, search all steps for last non-empty thought ──
    if (!success && !errorMessage && steps.length > 0) {
      for (let i = steps.length - 1; i >= 0; i--) {
        const thought = steps[i]?.thought
        if (thought) {
          finalAnswer = thought
          success = true
          log('[Done] Using last reasoning as final answer')
          break
        }
      }
    }

    const durationMs = Date.now() - startTime

    const runResult: AgentRunResult = {
      runId,
      agentId,
      success,
      steps,
      finalAnswer,
      tokensUsed,
      durationMs,
      ...(errorMessage !== undefined ? { error: errorMessage } : {}),
    }

    await workingMemory.clear(runId)

    return runResult
  }

  private checkStopConditions(
    step: RunStep,
    startTime: number,
    conditions: StopCondition[],
  ): boolean {
    for (const condition of conditions) {
      if (condition.type === 'timeout_ms') {
        if (Date.now() - startTime > condition.value) {
          return true
        }
      } else if (condition.type === 'keyword') {
        if (step.thought.includes(condition.value)) {
          return true
        }
        if (step.observation !== null && step.observation.includes(condition.value)) {
          return true
        }
      }
    }
    return false
  }

  private buildAllowedTools(profile: SecurityProfile): ToolDefinition[] {
    const allTools = toolRegistry.list()
    return allTools.filter((tool) =>
      (profile.allowedTools as string[]).includes(tool.requiredPermission),
    )
  }
}

export const reactEngine = new ReactEngine()
