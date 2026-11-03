// ─── Shared types across Agent Core ────────────────────────────────────────

export type PlatformId = 'x' | 'linkedin' | 'instagram' | 'xiaohongshu' | 'tiktok' | 'youtube' | 'facebook' | 'threads' | 'pinterest' | 'bluesky' | 'weibo' | 'bilibili' | 'douyin'
export type ModelProvider = 'claude' | 'openai' | 'ollama' | 'deepseek'
export type AgentStatus = 'idle' | 'running' | 'paused' | 'error' | 'complete'
export type ToolCallStatus = 'pending' | 'running' | 'success' | 'error'

// ─── Memory ─────────────────────────────────────────────────────────────────

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  toolName?: string
  /** For assistant messages that contain tool_use blocks (Anthropic format). */
  toolCalls?: ToolCall[]
}

export interface ToolCallRecord {
  id: string
  name: string
  args: unknown
  result: unknown
  status: ToolCallStatus
  startedAt: Date
  finishedAt?: Date
}

export interface WorkingMemory {
  runId: string
  agentId: string
  contextWindow: Message[]
  intermediateResults: Map<string, unknown>
  toolCallHistory: ToolCallRecord[]
  startedAt: Date
}

export interface EpisodicRecord {
  id: string
  runId: string
  agentId: string
  startedAt: Date
  finishedAt: Date
  steps: RunStep[]
  outcome: 'success' | 'failed' | 'partial'
  tokensUsed: number
  finalAnswer: string
}

export interface SemanticChunk {
  id: string
  agentId: string
  content: string
  embedding: number[]
  source: 'post' | 'reply' | 'knowledge' | 'style_sample'
  createdAt: Date
  metadata: Record<string, unknown>
}

// ─── ReAct Engine ────────────────────────────────────────────────────────────

export interface RunStep {
  iteration: number
  thought: string
  action: ToolCall | null
  observation: string | null
  timestamp: Date
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface AgentRunResult {
  runId: string
  agentId: string
  success: boolean
  steps: RunStep[]
  finalAnswer: string
  tokensUsed: number
  durationMs: number
  error?: string
}

export type StopCondition =
  | { type: 'max_iterations'; value: number }
  | { type: 'timeout_ms'; value: number }
  | { type: 'keyword'; value: string }

// ─── Security ────────────────────────────────────────────────────────────────

export type CredentialId = `cred_${string}`
export type Permission =
  | 'tool:web_search' | 'tool:rss_reader' | 'tool:memory_recall'
  | 'tool:schedule_post' | 'tool:x_publish' | 'tool:linkedin_post'
  | 'tool:xhs_publish' | 'tool:scrape_page' | 'tool:translate'
  | 'tool:image_gen' | 'tool:hashtag_analyze' | 'tool:sentiment_scan'
  | 'tool:read_url' | 'tool:browser_do' | 'tool:run_code'
  | 'tool:read_skill'
  | 'tool:browser_navigate' | 'tool:browser_click' | 'tool:browser_type'
  | 'tool:browser_screenshot' | 'tool:browser_evaluate'
  | 'tool:instagram_post' | 'tool:tiktok_post' | 'tool:youtube_post'
  | 'tool:facebook_post' | 'tool:threads_post' | 'tool:bluesky_post'
  | 'tool:weibo_post' | 'tool:bilibili_post' | 'tool:douyin_post'
  | 'tool:pinterest_post'
  | `tool:mcp:${string}:${string}`  // MCP dynamic tools (e.g. tool:mcp:browser:puppeteer_click)

export interface SecurityProfile {
  agentId: string
  allowedPlatforms: PlatformId[]
  allowedTools: Permission[]
  maxTokensPerRun: number
  maxRunsPerHour: number
  canAccessInternet: boolean
  canReadFiles: boolean
  credentialScope: CredentialId[]
}

// ─── Tool Use ────────────────────────────────────────────────────────────────

export type JSONSchema7Type =
  | { type: 'string'; description?: string; enum?: string[] }
  | { type: 'number'; description?: string }
  | { type: 'boolean'; description?: string }
  | { type: 'array'; items: JSONSchema7Type; description?: string }
  | { type: 'object'; properties: Record<string, JSONSchema7Type>; required?: string[]; description?: string }

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: { type: 'object'; properties: Record<string, JSONSchema7Type>; required?: string[] }
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>
  requiredPermission: Permission
}

export interface ToolContext {
  agentId: string
  runId: string
  workingMemory: WorkingMemory
  securityProfile: SecurityProfile
}

// ─── Queue ───────────────────────────────────────────────────────────────────

export interface AgentRunPayload {
  trigger: string
  ruleId?: string
  input?: Record<string, unknown>
}

export interface QueuedTask {
  id: string
  agentId: string
  priority: 0 | 1 | 2 | 3
  triggerSource: 'cron' | `cron:${string}` | 'event' | 'manual' | 'retry'
  payload: AgentRunPayload
  enqueuedAt: Date
  retryCount: number
  maxRetries: number
}

export type TaskStatus = 'enqueued' | 'running' | 'completed' | 'failed' | 'retrying'

// ─── Agent Registry ──────────────────────────────────────────────────────────

export interface AgentDefinition {
  id: string
  name: string
  platform: PlatformId // Kept for quick access mapping to capabilities

  // Relational FKs
  personaId: string | null
  channelId: string | null

  // Model & Prompt configurations
  provider: string
  model: string
  customInstructions: string

  skillIds: string[]
  status: AgentStatus
  securityProfile: SecurityProfile
  createdAt: Date
  updatedAt: Date
}

export interface AutomationRule {
  id: string
  agentId: string // FK to agents
  cronExpr: string
  status: 'active' | 'paused'
  createdAt: Date
  updatedAt: Date
}

export interface CampaignRecord {
  id: string
  name: string
  description: string
  platforms: PlatformId[]
  personaId: string | null
  coverImageUrl: string | null
  channelIds: string[]
  cronExpr: string | null
  cronStatus: 'active' | 'paused'
  status: 'active' | 'archived' | 'paused'
  createdAt: Date
}

export interface ChannelRecord {
  id: string
  platform: string
  name: string
  enabled: boolean
  webhookUrl: string | null
  config: Record<string, string>
  createdAt: Date
}

// ─── LLM ─────────────────────────────────────────────────────────────────────

export interface GenerateOptions {
  provider: string   // named provider key, e.g. 'claude', 'dashscope', 'openai', or any custom name
  model: string
  systemPrompt?: string
  messages: Message[]
  tools?: ToolDefinition[]
  maxTokens?: number
  temperature?: number
}

export interface GenerateResult {
  content: string
  toolCalls: ToolCall[]
  inputTokens: number
  outputTokens: number
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens'
}

// ─── Message Bus ─────────────────────────────────────────────────────────────

export type BusEventMap = {
  'agent:status-changed': { agentId: string; status: AgentStatus }
  'agent:log': { agentId: string; runId: string; message: string; color?: string }
  'agent:run-started': { agentId: string; runId: string; name?: string; platform?: string }
  'agent:run-complete': { agentId: string; runId: string; result: AgentRunResult }
  'agent:run-failed': { agentId: string; runId: string; error: string }
  'tool:executing': { agentId: string; runId: string; toolName: string }
  'tool:result': { agentId: string; runId: string; toolName: string; success: boolean }
  'queue:backpressure': { queueSize: number }
  'queue:task-status': { taskId: string; status: TaskStatus }
  'post:scheduled': { agentId: string; contentId: string; scheduledAt: Date | null }
  'post:published': { agentId: string; contentId: string; postId: string; platform: PlatformId }
  'campaign:triggered': { campaignId: string }
}
