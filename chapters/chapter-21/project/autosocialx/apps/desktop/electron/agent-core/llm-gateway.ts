import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import type { GenerateOptions, GenerateResult, ToolDefinition, ToolCall, Message } from './types'

// ─── Provider entry types ─────────────────────────────────────────────────────

type ProviderEntry =
  | { type: 'anthropic'; client: Anthropic; displayName: string; models: string[] }
  | { type: 'openai-compat'; client: OpenAI; baseURL: string | null; displayName: string; models: string[] }

// ─── Default models per provider key ─────────────────────────────────────────

const DEFAULT_MODELS: Record<string, string> = {
  claude: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  dashscope: 'qwen-plus',
  bailian: 'qwen3.5-plus',
  deepseek: 'deepseek-chat',
  ollama: 'llama3:8b',
  lmstudio: 'local-model',
  codex: 'gpt-4o',
  volcengine: 'doubao-seed-2.0-pro',
}

// ─── Preset model lists for providers with multiple known models ───────────────

const PRESET_MODEL_LISTS: Record<string, string[]> = {
  volcengine: [
    'doubao-seed-2.0-pro',
    'doubao-seed-2.0-code',
    'doubao-seed-2.0-lite',
    'doubao-seed-code',
    'minimax-m2.5',
    'glm-4.7',
    'deepseek-v3.2',
    'kimi-k2.5',
  ],
}

// ─── Known base URLs for preset providers ─────────────────────────────────────

const PRESET_BASE_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com',
  ollama: 'http://localhost:11434/v1',
  lmstudio: 'http://localhost:1234/v1',
  dashscope: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  bailian: 'https://coding.dashscope.aliyuncs.com/v1',
  codex: 'https://api.openai.com/v1',
  volcengine: 'https://ark.cn-beijing.volces.com/api/v3',
}

function buildDisplayName(key: string, baseURL: string | null): string {
  if (key === 'openai') return 'OpenAI'
  if (key === 'deepseek') return 'DeepSeek'
  if (key === 'ollama') return 'Ollama (Local)'
  if (key === 'lmstudio') return 'LM Studio (Local)'
  if (key === 'dashscope') return 'DashScope (Aliyun)'
  if (key === 'bailian') return 'Bailian (Aliyun Coding Plan)'
  if (key === 'codex') return 'OpenAI Codex'
  if (key === 'volcengine') return 'Volcengine Ark (火山引擎)'
  if (key === 'claude') return 'Claude (Anthropic)'
  if (baseURL) {
    try { return `${key} (${new URL(baseURL).host})` } catch { /* ignore */ }
  }
  return key
}

// ─── Anthropic helpers ────────────────────────────────────────────────────────

function toAnthropicTool(tool: ToolDefinition): Anthropic.Messages.Tool {
  return { name: tool.name, description: tool.description, input_schema: tool.inputSchema }
}

function buildAnthropicMessages(messages: Message[]): Anthropic.Messages.MessageParam[] {
  const result: Anthropic.Messages.MessageParam[] = []
  let i = 0
  while (i < messages.length) {
    const m = messages[i]
    if (m.role === 'user') {
      result.push({ role: 'user', content: m.content })
      i++
    } else if (m.role === 'assistant') {
      if (m.toolCalls && m.toolCalls.length > 0) {
        const content: Anthropic.Messages.ContentBlockParam[] = []
        if (m.content) content.push({ type: 'text', text: m.content })
        for (const tc of m.toolCalls) {
          content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args })
        }
        result.push({ role: 'assistant', content })
      } else {
        result.push({ role: 'assistant', content: m.content })
      }
      i++
    } else if (m.role === 'tool') {
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []
      while (i < messages.length && messages[i].role === 'tool') {
        const tm = messages[i]
        toolResults.push({ type: 'tool_result', tool_use_id: tm.toolCallId ?? '', content: tm.content })
        i++
      }
      result.push({ role: 'user', content: toolResults })
    } else {
      i++
    }
  }
  return result
}

// ─── OpenAI helpers ───────────────────────────────────────────────────────────

function toOpenAITool(tool: ToolDefinition): OpenAI.Chat.ChatCompletionFunctionTool {
  return { type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.inputSchema } }
}

function buildOpenAIMessages(options: GenerateOptions): OpenAI.Chat.ChatCompletionMessageParam[] {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
  if (options.systemPrompt) messages.push({ role: 'system', content: options.systemPrompt })
  for (const m of options.messages) {
    if (m.role === 'user') {
      messages.push({ role: 'user', content: m.content })
    } else if (m.role === 'assistant') {
      if (m.toolCalls && m.toolCalls.length > 0) {
        messages.push({
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.args) },
          })),
        })
      } else {
        messages.push({ role: 'assistant', content: m.content })
      }
    } else if (m.role === 'tool') {
      messages.push({ role: 'tool', content: m.content, tool_call_id: m.toolCallId ?? '' })
    }
  }
  return messages
}

// ─── LLMGateway ──────────────────────────────────────────────────────────────

export class LLMGateway {
  private providers: Map<string, ProviderEntry> = new Map()

  // ── Configure / Remove ────────────────────────────────────────────────────

  configure(key: string, apiKey: string, baseURL?: string, models: string[] = []): void {
    if (key === 'claude') {
      this.providers.set('claude', {
        type: 'anthropic',
        client: new Anthropic({ apiKey, timeout: 180_000, maxRetries: 1 }),
        displayName: 'Claude (Anthropic)',
        models: models.length > 0 ? models : [DEFAULT_MODELS.claude]
      })
    } else {
      const resolvedURL = baseURL ?? PRESET_BASE_URLS[key] ?? null
      const isDashScope = resolvedURL?.includes('dashscope') ?? false
      const client = new OpenAI({
        apiKey: apiKey || 'placeholder',
        ...(resolvedURL ? { baseURL: resolvedURL } : {}),
        timeout: 180_000,  // 180s — allows slow providers (local Ollama, DashScope, DeepSeek) enough headroom
        maxRetries: 1,     // one automatic retry on network errors / timeouts
        defaultHeaders: {
          'User-Agent': isDashScope ? 'OpenClaw/1.0' : 'AutoSocialX/1.0',
        },
      })
      this.providers.set(key, {
        type: 'openai-compat',
        client,
        baseURL: resolvedURL,
        displayName: buildDisplayName(key, resolvedURL),
        models: models.length > 0 ? models : (PRESET_MODEL_LISTS[key] ?? (DEFAULT_MODELS[key] ? [DEFAULT_MODELS[key]] : ['gpt-4o-mini']))
      })
    }
  }

  remove(key: string): void {
    this.providers.delete(key)
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  hasProvider(key: string): boolean {
    return this.providers.has(key)
  }

  getFirstProvider(): string | null {
    const first = this.providers.keys().next()
    return first.done ? null : first.value
  }

  getDefaultModel(key: string): string {
    return DEFAULT_MODELS[key] ?? 'gpt-4o'
  }

  /** Returns the raw API key and baseURL for a given provider key, or null if not configured. */
  getProviderCredentials(key: string): { apiKey: string; baseURL: string | null } | null {
    const entry = this.providers.get(key)
    if (!entry) return null
    if (entry.type === 'anthropic') {
      return { apiKey: (entry.client as Anthropic).apiKey ?? '', baseURL: null }
    }
    const compat = entry as Extract<ProviderEntry, { type: 'openai-compat' }>
    return { apiKey: (compat.client as OpenAI).apiKey ?? '', baseURL: compat.baseURL }
  }

  listAvailableProviders(): string[] {
    return Array.from(this.providers.keys())
  }

  listConfiguredProviderDetails(): Array<{ key: string; name: string; baseURL: string | null; type: string; models: string[]; apiKey: string }> {
    return Array.from(this.providers.entries()).map(([key, entry]) => {
      const creds = this.getProviderCredentials(key)
      return {
        key,
        name: entry.displayName,
        baseURL: entry.type === 'openai-compat' ? entry.baseURL : null,
        type: entry.type,
        models: entry.models,
        apiKey: creds?.apiKey ?? '',
      }
    })
  }

  // ── Generate / Stream ──────────────────────────────────────────────────────

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const entry = this.providers.get(options.provider)
    if (!entry) throw new Error(`LLM provider not configured: "${options.provider}". Go to Settings → AI Providers to add one.`)

    if (entry.type === 'anthropic') {
      return this.callClaude(options, entry.client)
    } else {
      return this.callOpenAI(options, entry.client, entry.baseURL)
    }
  }

  async stream(options: GenerateOptions, onChunk: (text: string) => void): Promise<GenerateResult> {
    const entry = this.providers.get(options.provider)
    if (!entry) throw new Error(`LLM provider not configured: "${options.provider}"`)

    if (entry.type !== 'anthropic') {
      // Non-Claude providers: stream not implemented, fall back to generate
      return this.generate(options)
    }

    const anthropicMessages = buildAnthropicMessages(options.messages)
    const stream = entry.client.messages.stream({
      model: options.model,
      max_tokens: options.maxTokens ?? 4096,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.systemPrompt ? { system: options.systemPrompt } : {}),
      messages: anthropicMessages,
      ...(options.tools && options.tools.length > 0 ? { tools: options.tools.map(toAnthropicTool) } : {}),
    })

    stream.on('text', (textDelta: string) => { onChunk(textDelta) })
    const finalMessage = await stream.finalMessage()

    let content = ''
    const toolCalls: ToolCall[] = []
    for (const block of finalMessage.content) {
      if (block.type === 'text') { content += block.text }
      else if (block.type === 'tool_use') {
        toolCalls.push({ id: block.id, name: block.name, args: block.input as Record<string, unknown> })
      }
    }

    let stopReason: GenerateResult['stopReason'] = 'end_turn'
    if (finalMessage.stop_reason === 'tool_use') stopReason = 'tool_use'
    else if (finalMessage.stop_reason === 'max_tokens') stopReason = 'max_tokens'

    return { content, toolCalls, inputTokens: finalMessage.usage.input_tokens ?? 0, outputTokens: finalMessage.usage.output_tokens, stopReason }
  }

  // ── Private: Anthropic ────────────────────────────────────────────────────

  private async callClaude(options: GenerateOptions, client: Anthropic): Promise<GenerateResult> {
    const anthropicMessages = buildAnthropicMessages(options.messages)
    const response = await client.messages.create({
      model: options.model,
      max_tokens: options.maxTokens ?? 4096,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.systemPrompt ? { system: options.systemPrompt } : {}),
      messages: anthropicMessages,
      ...(options.tools && options.tools.length > 0 ? { tools: options.tools.map(toAnthropicTool) } : {}),
    })

    let content = ''
    const toolCalls: ToolCall[] = []
    for (const block of response.content) {
      if (block.type === 'text') { content += block.text }
      else if (block.type === 'tool_use') {
        toolCalls.push({ id: block.id, name: block.name, args: block.input as Record<string, unknown> })
      }
    }

    let stopReason: GenerateResult['stopReason'] = 'end_turn'
    if (response.stop_reason === 'tool_use') stopReason = 'tool_use'
    else if (response.stop_reason === 'max_tokens') stopReason = 'max_tokens'

    return { content, toolCalls, inputTokens: response.usage.input_tokens ?? 0, outputTokens: response.usage.output_tokens, stopReason }
  }

  // ── Private: OpenAI-compatible ────────────────────────────────────────────

  private async callOpenAI(options: GenerateOptions, client: OpenAI, baseURL: string | null): Promise<GenerateResult> {
    const messages = buildOpenAIMessages(options)
    const isDashScope = (baseURL?.includes('dashscope') || baseURL?.includes('coding.dashscope')) ?? false

    // ── DashScope thinking-mode handling ──────────────────────────────────────
    // Three categories of DashScope models:
    //   1. Thinking-required (must be true):  qwen3-coder-*, qwq-*, qwen3.x-* (versioned), MoE a-suffix
    //   2. Thinking-optional (can be false):  qwen3-* dash models (standard)
    //   3. No support (omit param):           qwen-plus, qwen-turbo, older models, glm-*, kimi-*
    //
    // Note: qwen3.5-plus / qwen3.7-plus (dot-versioned) on coding.dashscope require enable_thinking=true.
    //       MoE models (qwen3-30b-a3b, qwen3-235b-a22b) also require true.
    const THINKING_REQUIRED = /^(qwen3-coder|qwq|minimax-m|qwen3\.\d|qwen3-\d+b-a\d)/i
    const THINKING_OPTIONAL  = /^(qwen3-|qwen2\.5-)/i
    const thinkingParam: Record<string, unknown> = {}
    if (isDashScope) {
      if (THINKING_REQUIRED.test(options.model)) {
        // Must enable thinking; thinking_budget capped to maxTokens so total output stays bounded
        thinkingParam['enable_thinking'] = true
        thinkingParam['thinking_budget'] = Math.min(options.maxTokens ?? 4096, 8192)
      } else if (THINKING_OPTIONAL.test(options.model)) {
        thinkingParam['enable_thinking'] = false
      }
      // else: older models — omit entirely
    }

    const apiBody: Record<string, unknown> = {
      model: options.model,
      messages,
      ...(options.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.tools && options.tools.length > 0 ? { tools: options.tools.map(toOpenAITool) } : {}),
      ...thinkingParam,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await client.chat.completions.create(apiBody as any)
    const choice = response.choices[0]
    const message = choice.message

    // Qwen3 thinking mode may leave content null/empty; fall back to reasoning_content
    const rawMsg = message as { content?: string | null; reasoning_content?: string }
    const rawContent = rawMsg.content || rawMsg.reasoning_content || ''
    // Strip residual <think>…</think> blocks
    const content = rawContent.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim()

    const toolCalls: ToolCall[] = []
    if (message.tool_calls) {
      for (const tc of message.tool_calls) {
        if (tc.type === 'function') {
          let parsedArgs: Record<string, unknown> = {}
          try { parsedArgs = JSON.parse(tc.function.arguments) as Record<string, unknown> } catch { /* keep empty */ }
          toolCalls.push({ id: tc.id, name: tc.function.name, args: parsedArgs })
        }
      }
    }

    let stopReason: GenerateResult['stopReason'] = 'end_turn'
    if (choice.finish_reason === 'tool_calls') stopReason = 'tool_use'
    else if (choice.finish_reason === 'length') stopReason = 'max_tokens'

    return {
      content, toolCalls,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      stopReason,
    }
  }
}

export const llmGateway = new LLMGateway()
