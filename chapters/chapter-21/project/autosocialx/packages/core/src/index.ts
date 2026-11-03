// @autosocialx/core — 核心流转架构 & 可插拔接口

export type PlatformId =
  | 'x'
  | 'linkedin'
  | 'instagram'
  | 'xiaohongshu'
  | 'tiktok'
  | 'youtube'

export type AgentStatus = 'running' | 'active' | 'paused' | 'complete' | 'idle'

export interface PostDraft {
  text: string
  mediaUrls?: string[]
  scheduledAt?: Date
  platform: PlatformId
}

export interface PublishResult {
  success: boolean
  postId?: string
  error?: string
}

/** 每个社交平台 Adapter 必须实现的标准接口 */
export interface IPlatformAdapter {
  readonly platform: PlatformId

  /** 检查 Cookie/Token 健康状态 */
  checkHealth(): Promise<{ healthy: boolean; reason?: string }>

  /** 拉取平台热点 */
  fetchTrends(): Promise<string[]>

  /** 对草稿进行平台专属排版校验 */
  composePost(draft: PostDraft): Promise<PostDraft>

  /** 执行无头浏览器上传发布 */
  executePublish(draft: PostDraft): Promise<PublishResult>
}

/** Agent 流水线调度接口 */
export interface IAgentPipeline {
  readonly agentId: string
  run(): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  getStatus(): AgentStatus
}
