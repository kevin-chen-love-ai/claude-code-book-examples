export interface PostDraft {
  text: string
  mediaUrls?: string[]
  scheduledAt?: Date
  platform: string
}

export interface PublishResult {
  success: boolean
  postId?: string
  error?: string
}

export interface HealthStatus {
  healthy: boolean
  reason?: string
  checkedAt: Date
}

// 所有平台 Adapter 必须实现的接口
export interface IPlatformAdapter {
  readonly platform: string
  checkHealth(): Promise<HealthStatus>
  fetchTrends(): Promise<string[]>
  composePost(draft: PostDraft): Promise<PostDraft>
  executePublish(draft: PostDraft): Promise<PublishResult>
}

// 基础抽象类，提供通用工具方法
export abstract class BasePlatformAdapter implements IPlatformAdapter {
  abstract readonly platform: string
  abstract checkHealth(): Promise<HealthStatus>
  abstract fetchTrends(): Promise<string[]>
  abstract composePost(draft: PostDraft): Promise<PostDraft>
  abstract executePublish(draft: PostDraft): Promise<PublishResult>

  protected truncateText(text: string, maxLen: number): string {
    return text.length > maxLen ? text.slice(0, maxLen - 3) + '...' : text
  }
}
