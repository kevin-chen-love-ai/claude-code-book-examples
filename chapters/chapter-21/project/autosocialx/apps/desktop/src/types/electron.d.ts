// Re-declare the ElectronAPI shape for the renderer (src) compilation.
// The authoritative source is electron/preload.ts, which is excluded from
// tsconfig.app.json.  Keep the two in sync manually.

export interface ElectronAPI {
  ping: () => Promise<string>
  db: {
    query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; error: string | null }>
  }
  agents: {
    list: () => Promise<unknown>
    create: (params: unknown) => Promise<unknown>
    update: (id: string, patch: unknown) => Promise<unknown>
    delete: (id: string) => Promise<unknown>
    trigger: (agentId: string, input?: unknown) => Promise<unknown>
    triggerDirect: (input: { provider: string; model: string; platform: string; prompt: string }) => Promise<string>
    getRuns: (agentId: string) => Promise<unknown>
  }
  personas: {
    list: () => Promise<unknown>
    compose: (personaId: string) => Promise<unknown>
    create: (params: unknown) => Promise<unknown>
    update: (id: string, patch: unknown) => Promise<unknown>
    delete: (id: string) => Promise<unknown>
  }
  llm: {
    configure: (provider: string, apiKey: string, baseURL?: string, models?: string[]) => Promise<unknown>
    remove: (key: string) => Promise<{ ok: boolean }>
    providers: () => Promise<unknown>
    providersDetail: () => Promise<Array<{ key: string; name: string; baseURL: string | null; type: string; models: string[]; apiKey: string }>>
    detectLocal: () => Promise<{ discovered: string[]; providers: Array<{ key: string; name: string; baseURL: string | null; type: string; models: string[]; apiKey: string }> }>
    testModel: (provider: string, model: string) => Promise<{ ok: boolean; content?: string; tokens?: number; error?: string }>
    testAgentLoop: (provider: string, model: string) => Promise<{ ok: boolean; schedulePostCalled: boolean; steps: number; tokensUsed: number; error?: string }>
  }
  tools: {
    setKey: (name: string, key: string) => Promise<{ ok: boolean }>
    deleteKey: (name: string) => Promise<{ ok: boolean }>
    listKeys: () => Promise<string[]>
    getKey: (name: string) => Promise<string | null>
  }
  rss: {
    list: () => Promise<Array<{ id: string; title: string; url: string; category: string; addedAt: string }>>
    add: (title: string, url: string, category?: string) => Promise<{ id: string; title: string; url: string; category: string; addedAt: string }>
    delete: (id: string) => Promise<boolean>
    importOPML: (xml: string) => Promise<Array<{ id: string; title: string; url: string; category: string; addedAt: string }>>
    importFromUrl: (opmlUrl: string) => Promise<Array<{ id: string; title: string; url: string; category: string; addedAt: string }>>
    openOPMLDialog: () => Promise<{ canceled: boolean; feeds: Array<{ id: string; title: string; url: string; category: string; addedAt: string }> }>
    syncNow: () => Promise<{ feedsProcessed: number; newItems: number; errors: number; embeddedItems: number }>
    syncStats: () => Promise<{ total: number; embedded: number; lastFetchedAt: number | null }>
    items: (opts?: { feedId?: string; search?: string; limit?: number }) => Promise<Array<{ id: string; feed_id: string; title: string; content: string; url: string; pub_date: string; source: string; category: string; embedded_at: number | null }>>
    setInterval: (hours: number) => Promise<{ ok: boolean; hours: number }>
    exportOPML: () => Promise<{ ok: boolean; canceled?: boolean; filePath?: string; count?: number; error?: string }>
  }
  queue: {
    status: () => Promise<unknown>
    list: () => Promise<Array<{ id: string; agentId: string; status: string; enqueuedAt: string; triggerSource: string }>>
    cancel: (taskId: string) => Promise<{ ok: boolean }>
  }
  dashboard: {
    stats: () => Promise<{
      runs: { total: number; success: number }
      content: { total: number; published: number }
      rssItems: number
      agentRunCounts: Record<string, number>
    }>
  }
  knowledge: {
    list: () => Promise<Array<{ id: string; title: string; content: string; addedAt: string }>>
    add: (title: string, content: string) => Promise<{ id: string; title: string; content: string; addedAt: string }>
    delete: (id: string) => Promise<boolean>
  }
  browser: {
    connect: (port?: number) => Promise<{ success: boolean; status?: unknown; error?: string }>
    tools: () => Promise<{ status: unknown }>
    status: () => Promise<unknown>
  }
  content: {
    list: (filter?: string | { status?: string; campaignId?: string }) => Promise<unknown[]>
    create: (params: Record<string, unknown>) => Promise<{ id: string }>
    get: (id: string) => Promise<unknown>
    delete: (id: string) => Promise<{ ok: boolean }>
    updateStatus: (id: string, status: string) => Promise<{ ok: boolean }>
    setSchedule: (id: string, scheduledAtIso: string) => Promise<{ ok: boolean; scheduledAt: number }>
    publish: (id: string) => Promise<{ success: boolean; postId?: string; error?: string }>
    retryFailed: () => Promise<{ ok: boolean; succeeded: number; failed: number; total: number }>
  }
  campaigns: {
    list: () => Promise<unknown[]>
    create: (params: Record<string, unknown>) => Promise<{ id: string }>
    update: (id: string, patch: Record<string, unknown>) => Promise<unknown>
    updateCron: (id: string, cronExpr: string | null) => Promise<unknown>
    setCronStatus: (id: string, status: 'active' | 'paused') => Promise<unknown>
    delete: (id: string) => Promise<{ ok: boolean }>
    trigger: (campaignId: string) => Promise<{ ok: boolean; triggered: number }>
  }
  channels: {
    list: () => Promise<Array<{
      id: string
      platform: string
      name: string
      enabled: boolean
      webhookUrl: string | null
      config: Record<string, string>
      createdAt: string
    }>>
    create: (platform: string, name: string, webhookUrl?: string) => Promise<{
      id: string; platform: string; name: string; enabled: boolean
      webhookUrl: string | null; config: Record<string, string>; createdAt: string
    }>
    delete: (id: string) => Promise<{ ok: boolean }>
    toggle: (id: string, enabled: boolean) => Promise<{ ok: boolean }>
    setConfig: (id: string, config: Record<string, string>) => Promise<{ ok: boolean }>
    setWebhook: (id: string, webhookUrl: string | null) => Promise<{ ok: boolean }>
  }
  automations: {
    listAll: () => Promise<unknown[]>
    listActive: () => Promise<unknown[]>
    listByAgent: (agentId: string) => Promise<unknown[]>
    create: (agentId: string, cronExpr: string) => Promise<unknown>
    update: (id: string, patch: unknown) => Promise<unknown>
    delete: (id: string) => Promise<{ ok: boolean }>
  }
  mcp: {
    listConfig: () => Promise<Array<{ name: string; command: string; args: string[]; env: Record<string, string>; connected: boolean; toolCount: number }>>
    addServer: (name: string, cfg: { command: string; args: string[]; env?: Record<string, string> }) => Promise<{ ok: boolean; error?: string }>
    removeServer: (name: string) => Promise<{ ok: boolean }>
    reconnect: (name: string) => Promise<{ ok: boolean; error?: string }>
    listTools: (name: string) => Promise<{ ok: boolean; tools: Array<{ name: string; description: string }> }>
    status: () => Promise<Record<string, { connected: boolean; toolCount: number }>>
  }
  settings: {
    get: () => Promise<{
      language: string
      notifications: string
      disabledSkills: string[]
      rssSyncIntervalHours?: number
      defaultProvider?: string
      defaultModel?: string
      publishEnabled?: boolean
      activeImageModelId?: string
    }>
    set: (key: string, value: unknown) => Promise<{ ok: boolean }>
    setAll: (patch: {
      language?: string
      notifications?: string
      rssSyncIntervalHours?: number
      defaultProvider?: string
      defaultModel?: string
      publishEnabled?: boolean
      activeImageModelId?: string
    }) => Promise<{ ok: boolean; error?: string }>
  }
  skills: {
    list: () => Promise<Array<{ name: string; description?: string; enabled: boolean }>>
    listTemplates: () => Promise<Array<{ name: string; description?: string; isInstalled: boolean }>>
    toggle: (skillName: string, enabled: boolean) => Promise<{ ok: boolean }>
    install: (skill: { name: string; description: string; content: string }) => Promise<{ ok: boolean; error?: string }>
    installTemplate: (name: string) => Promise<{ ok: boolean; error?: string }>
    delete: (skillName: string) => Promise<{ ok: boolean; error?: string }>
    openTemplatesFolder: () => Promise<{ ok: boolean }>
  }
  logs: {
    getPath: () => Promise<{ dir: string; file: string }>
    openFolder: () => Promise<{ ok: boolean }>
  }
  image: {
    listModels: () => Promise<Array<{ id: string; name: string; baseURL: string; model: string; hasKey: boolean; apiKey: string }>>
    addModel: (entry: { id: string; name: string; baseURL: string; model: string }, apiKey: string) => Promise<{ ok: boolean }>
    removeModel: (id: string) => Promise<{ ok: boolean }>
    getActive: () => Promise<{ id: string; name: string; baseURL: string; model: string; hasKey: boolean; apiKey: string } | null>
  }
  n8n: {
    getConfig: () => Promise<{ url: string; hasToken: boolean; token: string }>
    configure: (url: string, token: string) => Promise<{ ok: boolean }>
    test: () => Promise<{ ok: boolean; status?: number; error?: string }>
  }
  on: (channel: string, callback: (payload: unknown) => void) => () => void
  /** @deprecated Use the cleanup function returned by on() instead. */
  off: (channel: string, callback: (payload: unknown) => void) => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
