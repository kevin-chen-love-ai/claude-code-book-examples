// @autosocialx/ai — 大模型可插拔网关

export type ModelProvider = 'claude' | 'openai' | 'ollama' | 'deepseek'

export interface GenerateOptions {
  provider: ModelProvider
  model: string
  systemPrompt?: string
  userPrompt: string
  maxTokens?: number
  temperature?: number
}

export interface GenerateResult {
  text: string
  inputTokens: number
  outputTokens: number
  provider: ModelProvider
  model: string
}

/** 大模型统一出口接口 — 支持云端和本地模型热切换 */
export interface ILLMGateway {
  /** 单次生成 */
  generate(options: GenerateOptions): Promise<GenerateResult>

  /** 流式生成（SSE 形式） */
  stream(options: GenerateOptions, onChunk: (chunk: string) => void): Promise<GenerateResult>

  /** 列出当前可用的 provider */
  listProviders(): ModelProvider[]
}
