import { contextBridge, ipcRenderer } from 'electron'

// Each call to on() returns a cleanup function (a preload-side closure) that the
// renderer can invoke to remove exactly the wrapper that was registered.
// This avoids the contextBridge proxy-identity problem: every time a function crosses
// the bridge, Electron creates a *new* proxy object, so Map-keyed deduplication via
// callback reference is impossible. Returning a cleanup closure sidesteps this entirely.
type IpcWrapper = (event: unknown, payload: unknown) => void

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
        list: () => Promise<unknown[]>
        add: (title: string, content: string) => Promise<unknown>
        delete: (id: string) => Promise<boolean>
    }
    browser: {
        /** Connect to user's Chrome via remote-debugging-port (default 9222) */
        connect: (port?: number) => Promise<{ success: boolean; status?: unknown; error?: string }>
        /** List available browser tools from MCP */
        tools: () => Promise<{ status: unknown }>
        /** Get current browser connection status */
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
        list: () => Promise<unknown[]>
        create: (platform: string, name: string, webhookUrl?: string) => Promise<unknown>
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
        }>
        set: (key: string, value: unknown) => Promise<{ ok: boolean }>
        setAll: (patch: { language?: string; notifications?: string; rssSyncIntervalHours?: number }) => Promise<{ ok: boolean; error?: string }>
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
        getConfig: () => Promise<{ url: string; hasToken: boolean }>
        configure: (url: string, token: string) => Promise<{ ok: boolean }>
        test: () => Promise<{ ok: boolean; status?: number; error?: string }>
    }
    /** Register a listener and receive a cleanup function to remove it. */
    on: (channel: string, callback: (payload: unknown) => void) => () => void
    /** @deprecated Pass the cleanup function returned by on() instead. */
    off: (channel: string, callback: (payload: unknown) => void) => void
}

contextBridge.exposeInMainWorld('electronAPI', {
    ping: () => ipcRenderer.invoke('ping'),
    db: {
        query: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:query', sql, params),
    },
    agents: {
        list: () => ipcRenderer.invoke('agents:list'),
        create: (params: unknown) => ipcRenderer.invoke('agents:create', params),
        update: (id: string, patch: unknown) => ipcRenderer.invoke('agents:update', id, patch),
        delete: (id: string) => ipcRenderer.invoke('agents:delete', id),
        trigger: (agentId: string, input?: unknown) => ipcRenderer.invoke('agents:trigger', agentId, input),
        triggerDirect: (input: { provider: string; model: string; platform: string; prompt: string }) => ipcRenderer.invoke('agents:trigger-direct', input),
        getRuns: (agentId: string) => ipcRenderer.invoke('agents:get-runs', agentId),
    },
    personas: {
        list: () => ipcRenderer.invoke('personas:list'),
        compose: (personaId: string) => ipcRenderer.invoke('personas:compose', personaId),
        create: (params: unknown) => ipcRenderer.invoke('personas:create', params),
        update: (id: string, patch: unknown) => ipcRenderer.invoke('personas:update', id, patch),
        delete: (id: string) => ipcRenderer.invoke('personas:delete', id),
    },
    llm: {
        configure: (provider: string, apiKey: string, baseURL?: string, models?: string[]) =>
            ipcRenderer.invoke('llm:configure', provider, apiKey, baseURL, models),
        remove: (key: string) => ipcRenderer.invoke('llm:remove', key),
        providers: () => ipcRenderer.invoke('llm:providers'),
        providersDetail: () => ipcRenderer.invoke('llm:providers-full'),
        detectLocal: () => ipcRenderer.invoke('llm:detect-local'),
        testModel: (provider: string, model: string) => ipcRenderer.invoke('llm:test-model', provider, model),
        testAgentLoop: (provider: string, model: string) => ipcRenderer.invoke('llm:test-agent-loop', provider, model),
    },
    tools: {
        setKey: (name: string, key: string) => ipcRenderer.invoke('tools:setKey', name, key),
        deleteKey: (name: string) => ipcRenderer.invoke('tools:deleteKey', name),
        listKeys: () => ipcRenderer.invoke('tools:listKeys'),
        getKey: (name: string) => ipcRenderer.invoke('tools:getKey', name),
    },
    rss: {
        list: () => ipcRenderer.invoke('rss:list'),
        add: (title: string, url: string, category?: string) => ipcRenderer.invoke('rss:add', title, url, category),
        delete: (id: string) => ipcRenderer.invoke('rss:delete', id),
        importOPML: (xml: string) => ipcRenderer.invoke('rss:import-opml', xml),
        importFromUrl: (opmlUrl: string) => ipcRenderer.invoke('rss:import-from-url', opmlUrl),
        openOPMLDialog: () => ipcRenderer.invoke('rss:open-opml-dialog'),
        syncNow: () => ipcRenderer.invoke('rss:sync-now'),
        syncStats: () => ipcRenderer.invoke('rss:sync-stats'),
        items: (opts?: { feedId?: string; search?: string; limit?: number }) => ipcRenderer.invoke('rss:items', opts),
        setInterval: (hours: number) => ipcRenderer.invoke('rss:set-interval', hours),
        exportOPML: () => ipcRenderer.invoke('rss:export-opml'),
    },
    queue: {
        status: () => ipcRenderer.invoke('queue:status'),
        list: () => ipcRenderer.invoke('queue:list'),
        cancel: (taskId: string) => ipcRenderer.invoke('queue:cancel', taskId),
    },
    dashboard: {
        stats: () => ipcRenderer.invoke('dashboard:stats'),
    },
    knowledge: {
        list: () => ipcRenderer.invoke('knowledge:list'),
        add: (title: string, content: string) => ipcRenderer.invoke('knowledge:add', title, content),
        delete: (id: string) => ipcRenderer.invoke('knowledge:delete', id),
    },
    browser: {
        connect: (port?: number) => ipcRenderer.invoke('browser:connect', port),
        tools: () => ipcRenderer.invoke('browser:tools'),
        status: () => ipcRenderer.invoke('browser:status'),
    },
    content: {
        list: (filter?: string | { status?: string; campaignId?: string }) => ipcRenderer.invoke('content:list', filter),
        create: (params: Record<string, unknown>) => ipcRenderer.invoke('content:create', params),
        get: (id: string) => ipcRenderer.invoke('content:get', id),
        delete: (id: string) => ipcRenderer.invoke('content:delete', id),
        updateStatus: (id: string, status: string) => ipcRenderer.invoke('content:update-status', id, status),
        setSchedule: (id: string, scheduledAtIso: string) => ipcRenderer.invoke('content:set-schedule', id, scheduledAtIso),
        publish: (id: string) => ipcRenderer.invoke('content:publish', id),
        retryFailed: () => ipcRenderer.invoke('content:retry-failed'),
    },
    campaigns: {
        list: () => ipcRenderer.invoke('campaigns:list'),
        create: (params: Record<string, unknown>) => ipcRenderer.invoke('campaigns:create', params),
        update: (id: string, patch: Record<string, unknown>) => ipcRenderer.invoke('campaigns:update', id, patch),
        updateCron: (id: string, cronExpr: string | null) => ipcRenderer.invoke('campaigns:updateCron', id, cronExpr),
        setCronStatus: (id: string, status: 'active' | 'paused') => ipcRenderer.invoke('campaigns:setCronStatus', id, status),
        delete: (id: string) => ipcRenderer.invoke('campaigns:delete', id),
        trigger: (campaignId: string) => ipcRenderer.invoke('campaigns:trigger', campaignId),
    },
    channels: {
        list: () => ipcRenderer.invoke('channels:list'),
        create: (platform: string, name: string, webhookUrl?: string) =>
            ipcRenderer.invoke('channels:create', platform, name, webhookUrl),
        delete: (id: string) => ipcRenderer.invoke('channels:delete', id),
        toggle: (id: string, enabled: boolean) => ipcRenderer.invoke('channels:toggle', id, enabled),
        setConfig: (id: string, config: Record<string, string>) => ipcRenderer.invoke('channels:setConfig', id, config),
        setWebhook: (id: string, webhookUrl: string | null) => ipcRenderer.invoke('channels:setWebhook', id, webhookUrl),
    },
    automations: {
        listAll: () => ipcRenderer.invoke('automations:listAll'),
        listActive: () => ipcRenderer.invoke('automations:listActive'),
        listByAgent: (agentId: string) => ipcRenderer.invoke('automations:listByAgent', agentId),
        create: (agentId: string, cronExpr: string) => ipcRenderer.invoke('automations:create', agentId, cronExpr),
        update: (id: string, patch: unknown) => ipcRenderer.invoke('automations:update', id, patch),
        delete: (id: string) => ipcRenderer.invoke('automations:delete', id),
    },
    mcp: {
        listConfig: () => ipcRenderer.invoke('mcp:list-config'),
        addServer: (name: string, cfg: { command: string; args: string[]; env?: Record<string, string> }) =>
            ipcRenderer.invoke('mcp:add-server', name, cfg),
        removeServer: (name: string) => ipcRenderer.invoke('mcp:remove-server', name),
        reconnect: (name: string) => ipcRenderer.invoke('mcp:reconnect', name),
        listTools: (name: string) => ipcRenderer.invoke('mcp:list-tools', name),
        status: () => ipcRenderer.invoke('mcp:status'),
    },
    settings: {
        get: () => ipcRenderer.invoke('settings:get'),
        set: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
        setAll: (patch: { language?: string; notifications?: string; rssSyncIntervalHours?: number }) => ipcRenderer.invoke('settings:set-all', patch),
    },
    skills: {
        list: () => ipcRenderer.invoke('skills:list'),
        listTemplates: () => ipcRenderer.invoke('skills:list-templates'),
        toggle: (skillName: string, enabled: boolean) => ipcRenderer.invoke('skills:toggle', skillName, enabled),
        install: (skill: { name: string; description: string; content: string }) => ipcRenderer.invoke('skills:install', skill),
        installTemplate: (name: string) => ipcRenderer.invoke('skills:install-template', name),
        delete: (skillName: string) => ipcRenderer.invoke('skills:delete', skillName),
        openTemplatesFolder: () => ipcRenderer.invoke('skills:open-templates-folder'),
    },
    logs: {
        getPath: () => ipcRenderer.invoke('logs:getPath'),
        openFolder: () => ipcRenderer.invoke('logs:openFolder'),
    },
    image: {
        listModels: () => ipcRenderer.invoke('image:listModels'),
        addModel: (entry: { id: string; name: string; baseURL: string; model: string }, apiKey: string) => ipcRenderer.invoke('image:addModel', entry, apiKey),
        removeModel: (id: string) => ipcRenderer.invoke('image:removeModel', id),
        getActive: () => ipcRenderer.invoke('image:getActive'),
    },
    n8n: {
        getConfig: () => ipcRenderer.invoke('n8n:getConfig') as Promise<{ url: string; hasToken: boolean; token: string }>,
        configure: (url: string, token: string) => ipcRenderer.invoke('n8n:configure', url, token),
        test: () => ipcRenderer.invoke('n8n:test') as Promise<{ ok: boolean; status?: number; error?: string }>,
    },
    on: (channel: string, callback: (payload: unknown) => void) => {
        const validChannels = [
            'agent:log',
            'agent:status-changed',
            'agent:run-started',
            'agent:run-complete',
            'agent:run-failed',
            'tool:executing',
            'queue:task-status',
            'post:scheduled',
            'campaign:triggered',
        ]
        if (!validChannels.includes(channel)) return () => {}

        const wrapper: IpcWrapper = (_event, payload) => callback(payload)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ipcRenderer.on(channel, wrapper as any)

        // Return a cleanup closure — the caller should invoke it to remove this listener.
        // This avoids the contextBridge proxy-identity problem that made the old Map-based
        // off() approach unreliable (each crossing of the bridge creates a new proxy object).
        return () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ipcRenderer.removeListener(channel, wrapper as any)
        }
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    off: (_channel: string, _callback: (payload: unknown) => void) => {
        // no-op: use the cleanup function returned by on() instead.
    },
} satisfies ElectronAPI)

declare global {
    interface Window {
        electronAPI: ElectronAPI
    }
}
