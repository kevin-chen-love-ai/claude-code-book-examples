import { app, BrowserWindow, ipcMain, safeStorage, dialog } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { homedir } from 'node:os'
import { agentCore, messageBus, executionQueue } from './agent-core/index'
import { AgentRegistry } from './agents/registry'
import { taskScheduler } from './agents/scheduler'
import { personaHub } from './agents/persona'
import { llmGateway } from './agent-core/llm-gateway'
import { EpisodicMemoryStore } from './agent-core/memory/episodic-memory'
import { getDb, closeDb } from './db/client'
import { runMigrations } from './db/migrate'
import { automationStore } from './db/automation-store'
import { campaignStore } from './db/campaign-store'
import { channelStore } from './db/channel-store'
import { mcpServerRegistry } from './mcp/mcp-registry'
import { mcpConfigManager, type MCPServerConfig } from './mcp/config'
import { toolRegistry } from './agent-core/tool-use/registry'
import { contentScheduler } from './agents/content-scheduler'
import { publishContent } from './agents/publisher'
import { knowledgeStore } from './agent-core/memory/knowledge-store'
import { rssStore } from './agent-core/memory/rss-store'
import { rssVectorStore } from './agent-core/memory/rss-vector-store'
import { rssSyncService } from './agents/rss-sync'
import { configStore, type AppConfig } from './config-store'
import { loadToolKeys, setToolKey, getToolKey, deleteToolKey, listToolKeys } from './agent-core/tool-use/tool-keys'
import { skillRegistry } from './agent-core/skill-use/registry'
import { initAgentLogger, getLogsDir, getCurrentLogFile } from './agent-logger'


app.setName('AutoSocialX')

// ─── LLM API key persistence ──────────────────────────────────────────────────
// Keys are encrypted with the OS keychain via safeStorage and stored as
// base64 strings in {userData}/llm_keys.enc.json.

interface SavedLLMKey { encryptedKey: string; baseURL?: string; models?: string[] }
type SavedLLMKeys = Record<string, SavedLLMKey>

function getLLMKeysPath(): string {
    return join(app.getPath('userData'), 'llm_keys.enc.json')
}

function saveLLMKey(provider: string, apiKey: string, baseURL?: string, models?: string[]): void {
    if (!apiKey) return
    const path = getLLMKeysPath()
    let keys: SavedLLMKeys = {}
    if (existsSync(path)) {
        try { keys = JSON.parse(readFileSync(path, 'utf-8')) as SavedLLMKeys } catch { /* corrupted */ }
    }
    const encryptedKey = safeStorage.isEncryptionAvailable()
        ? safeStorage.encryptString(apiKey).toString('base64')
        : Buffer.from(apiKey, 'utf-8').toString('base64') // plain base64 fallback in dev

    keys[provider] = {
        encryptedKey,
        ...(baseURL ? { baseURL } : {}),
        ...(models && models.length > 0 ? { models } : {}),
    }
    writeFileSync(path, JSON.stringify(keys, null, 2), 'utf-8')
}

function deleteLLMKey(provider: string): void {
    const path = getLLMKeysPath()
    if (!existsSync(path)) return
    try {
        const keys = JSON.parse(readFileSync(path, 'utf-8')) as SavedLLMKeys
        delete keys[provider]
        writeFileSync(path, JSON.stringify(keys, null, 2), 'utf-8')
    } catch { /* ignore */ }
}

// Spawn a login shell to read env vars that may not be in process.env
// (e.g. ANTHROPIC_API_KEY exported in ~/.zshrc but app launched from Dock).
// Only applicable on macOS/Linux — Windows reads env vars directly from process.env.
function getShellEnv(varName: string): string | undefined {
    if (process.platform === 'win32') {
        // On Windows env vars are always available via process.env
        return process.env[varName] || undefined
    }
    // Whitelist: only uppercase letters, digits, and underscores — prevents shell injection.
    if (!/^[A-Z_][A-Z0-9_]*$/.test(varName)) return undefined
    try {
        const shell = process.env['SHELL'] ?? '/bin/zsh'
        const val = execSync(`${shell} -l -c 'printenv ${varName} 2>/dev/null'`, {
            timeout: 3_000,
            encoding: 'utf-8',
        }).trim()
        return val || undefined
    } catch {
        return undefined
    }
}

function loadSavedLLMKeys(): void {
    const path = getLLMKeysPath()
    if (!existsSync(path)) return
    try {
        const keys = JSON.parse(readFileSync(path, 'utf-8')) as SavedLLMKeys
        for (const [provider, { encryptedKey, baseURL, models }] of Object.entries(keys)) {
            try {
                const isEncrypted = safeStorage.isEncryptionAvailable()
                const apiKey = isEncrypted
                    ? safeStorage.decryptString(Buffer.from(encryptedKey, 'base64'))
                    : Buffer.from(encryptedKey, 'base64').toString('utf-8')

                llmGateway.configure(provider, apiKey, baseURL, models)
                console.log(`[LLM] Restored config for: ${provider} (encrypted: ${isEncrypted})`)
            } catch (err) {
                console.warn(`[LLM] Failed to decrypt/load key for ${provider}:`, err)
            }
        }
    } catch (err) {
        console.warn('[LLM] Failed to load saved keys:', err)
    }
}

// ─── Local model / CLI tool detection ────────────────────────────────────────

/**
 * Read Claude Code credentials from ~/.claude/.credentials.json or ~/.claude/config.json.
 * Returns the API key string or null if not found.
 */
function readClaudeCodeKey(): string | null {
    const paths = [
        join(homedir(), '.claude', '.credentials.json'),
        join(homedir(), '.claude', 'config.json'),
    ]
    for (const p of paths) {
        if (!existsSync(p)) continue
        try {
            const raw = JSON.parse(readFileSync(p, 'utf-8')) as Record<string, unknown>
            // Common shapes: { apiKey }, { claudeApiKey }, { api_key }, { credentials: { apiKey } }
            const key =
                (raw['apiKey'] as string | undefined) ??
                (raw['claudeApiKey'] as string | undefined) ??
                (raw['api_key'] as string | undefined) ??
                ((raw['credentials'] as Record<string, string> | undefined)?.['apiKey'])
            if (key && key.startsWith('sk-ant-')) return key
        } catch { /* ignore */ }
    }
    return null
}

/**
 * Read OpenAI / Codex CLI API key from ~/.codex/config.json or common env-export files.
 */
function readCodexKey(): string | null {
    // Prefer explicit codex config
    const codexConfig = join(homedir(), '.codex', 'config.json')
    if (existsSync(codexConfig)) {
        try {
            const raw = JSON.parse(readFileSync(codexConfig, 'utf-8')) as Record<string, unknown>
            const key =
                (raw['apiKey'] as string | undefined) ??
                (raw['api_key'] as string | undefined) ??
                (raw['openaiApiKey'] as string | undefined)
            if (key && key.startsWith('sk-')) return key
        } catch { /* ignore */ }
    }
    // Candidate openai config paths — macOS/Linux: ~/.config; Windows: %APPDATA%
    const openaiCandidates: string[] = [
        join(homedir(), '.config', 'openai', 'credentials.json'),
        ...(process.env['APPDATA'] ? [join(process.env['APPDATA'], 'openai', 'credentials.json')] : []),
    ]
    for (const p of openaiCandidates) {
        if (!existsSync(p)) continue
        try {
            const raw = JSON.parse(readFileSync(p, 'utf-8')) as Record<string, unknown>
            const key = (raw['api_key'] as string | undefined) ?? (raw['apiKey'] as string | undefined)
            if (key && key.startsWith('sk-')) return key
        } catch { /* ignore */ }
    }
    return null
}

/**
 * Detect local model servers (Ollama, LM Studio) and CLI tool configs (Claude Code, Codex)
 * then configure the LLM gateway for any that are found.
 * Skips a provider if it is already persisted in the saved keys file.
 */
async function detectAndConfigureLocalModels(): Promise<string[]> {
    const discovered: string[] = []
    const savedKeysPath = getLLMKeysPath()
    let savedKeys: SavedLLMKeys = {}
    if (existsSync(savedKeysPath)) {
        try { savedKeys = JSON.parse(readFileSync(savedKeysPath, 'utf-8')) as SavedLLMKeys } catch { /* ignore */ }
    }

    // ── Claude Code ─────────────────────────────────────────────────────────────
    if (!savedKeys['claude']) {
        const claudeKey = readClaudeCodeKey()
        if (claudeKey) {
            llmGateway.configure('claude', claudeKey)
            saveLLMKey('claude', claudeKey)
            discovered.push('claude')
            console.log('[LLM] Auto-detected Claude Code credentials')
        }
    }

    // ── Codex / OpenAI CLI ───────────────────────────────────────────────────────
    if (!savedKeys['openai'] && !savedKeys['codex']) {
        const codexKey = readCodexKey()
        if (codexKey) {
            llmGateway.configure('codex', codexKey)
            saveLLMKey('codex', codexKey)
            discovered.push('codex')
            console.log('[LLM] Auto-detected Codex/OpenAI CLI credentials')
        }
    }

    // ── Ollama ───────────────────────────────────────────────────────────────────
    if (!savedKeys['ollama']) {
        try {
            const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) })
            if (res.ok) {
                const data = await res.json() as { models?: { name: string }[] }
                const models = (data.models ?? []).map(m => m.name).filter(Boolean)
                llmGateway.configure('ollama', '', undefined, models)
                // Ollama doesn't need a real key — save placeholder
                saveLLMKey('ollama', '__local__', 'http://localhost:11434/v1', models)
                discovered.push('ollama')
                console.log('[LLM] Auto-detected Ollama:', models)
            }
        } catch { /* not running */ }
    }

    // ── LM Studio ────────────────────────────────────────────────────────────────
    if (!savedKeys['lmstudio']) {
        try {
            const res = await fetch('http://localhost:1234/v1/models', { signal: AbortSignal.timeout(2000) })
            if (res.ok) {
                const data = await res.json() as { data?: { id: string }[] }
                const models = (data.data ?? []).map(m => m.id).filter(Boolean)
                llmGateway.configure('lmstudio', '', 'http://localhost:1234/v1', models)
                saveLLMKey('lmstudio', '__local__', 'http://localhost:1234/v1', models)
                discovered.push('lmstudio')
                console.log('[LLM] Auto-detected LM Studio:', models)
            }
        } catch { /* not running */ }
    }

    return discovered
}

process.env.DIST_ELECTRON = join(__dirname, '../dist-electron')
process.env.DIST = join(__dirname, '../dist')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
    ? join(process.env.DIST_ELECTRON, '../public')
    : process.env.DIST

let win: BrowserWindow | null = null
const preload = join(__dirname, 'preload.js')

let agentRegistry: AgentRegistry | null = null
let episodicMemory: EpisodicMemoryStore | null = null

function initApp(): void {
    const db = getDb()

    // 1. Run DB migrations
    runMigrations(db)

    // Ensure virtual 'manual' agent exists — used as agentId for user-created posts
    db.prepare(`
        INSERT OR IGNORE INTO agents (id, name, platform, created_at, updated_at)
        VALUES ('manual', 'Manual', 'x', unixepoch(), unixepoch())
    `).run()

    // 2. Init agent core (registers built-in tools, sets queue runner)
    agentCore.init(db)

    // 3. Create AgentRegistry backed by SQLite
    agentRegistry = new AgentRegistry(db)

    // 4. Wire registry into AgentCore
    agentCore.setRegistry(agentRegistry)

    // 5. Create episodic memory store for IPC use
    episodicMemory = new EpisodicMemoryStore(db)

    // 6. Load personas from disk (SQLite)
    personaHub.init(db)

    // 7. Initialize Unified Stores
    automationStore.init(db)
    campaignStore.init(db)
    channelStore.init(db)

    // 8. Start cron scheduler leveraging automation store + campaign crons
    taskScheduler.start(automationStore.listActive())
    taskScheduler.startCampaigns(campaignStore.listWithCron())

    // 8.5 Start content scheduler (auto-publishes scheduled posts)
    contentScheduler.start()

    // 8.6 Init RSS vector store and start background sync
    rssVectorStore.init(db)
    rssSyncService.start()

    // 8. Configure LLM gateway.
    // Priority (low → high): shell env → process.env → safeStorage (persisted user setting)
    // Shell env is read via a login shell so it works even when the app is launched
    // from Dock/Spotlight without inheriting the terminal's environment.
    const anthropicKey = process.env['ANTHROPIC_API_KEY'] || getShellEnv('ANTHROPIC_API_KEY')
    if (anthropicKey) {
        llmGateway.configure('claude', anthropicKey)
        console.log('[LLM] Auto-detected ANTHROPIC_API_KEY from environment')
    }
    const openaiKey = process.env['OPENAI_API_KEY'] || getShellEnv('OPENAI_API_KEY')
    if (openaiKey) {
        llmGateway.configure('openai', openaiKey, process.env['OPENAI_BASE_URL'] || getShellEnv('OPENAI_BASE_URL'))
        console.log('[LLM] Auto-detected OPENAI_API_KEY from environment')
    }

    // Load app configuration (language, theme, disabledSkills, etc.)
    configStore.load()

    // Restore user-persisted keys (set via Settings UI) — these win over env vars
    loadSavedLLMKeys()

    // Load tool API keys (Tavily, etc.)
    loadToolKeys()

    // Bootstrap 302.ai image API key if not already stored
    if (!getToolKey('302ai')) {
        const imageKey = process.env['IMAGE_API_KEY_302AI'] || ''
        if (imageKey) {
            setToolKey('302ai', imageKey)
            console.log('[Tools] Bootstrap 302.ai API key from environment')
        }
    }

    // One-time migration: move n8nToken from plaintext config.json → encrypted tool_keys
    const legacyN8nToken = (configStore.getAll() as { n8nToken?: string }).n8nToken
    if (legacyN8nToken && !getToolKey('n8n-webhook-token')) {
        setToolKey('n8n-webhook-token', legacyN8nToken)
        console.log('[Config] Migrated n8nToken from plaintext config → encrypted storage')
    }

    // Auto-detect TAVILY_API_KEY from environment if not already stored.
    // If not found, leave unconfigured — user sets it via Settings → Tools.
    if (!getToolKey('tavily')) {
        const tavilyKey = process.env['TAVILY_API_KEY'] || getShellEnv('TAVILY_API_KEY')
        if (tavilyKey) {
            setToolKey('tavily', tavilyKey)
            console.log('[Tools] Auto-detected TAVILY_API_KEY from environment')
        }
    }

    // Detect local model servers (Ollama, LM Studio) and CLI tool configs (Claude Code, Codex)
    void detectAndConfigureLocalModels()

    // \u2500\u2500 Seed default Knowledge Base docs on first run \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    void knowledgeStore.listDocuments().then(async (docs) => {
        if (docs.length > 0) return  // already seeded
        console.log('[Knowledge] Seeding default knowledge documents...')
        await knowledgeStore.addDocument(
            'AutoSocialX Content Principles',
            `# Content Principles & Brand Voice\n\n## Platform Tone Guidelines\n- **X (Twitter)**: Short, punchy, conversational. Max 280 chars. 2-3 hashtags max. Hook in the first 5 words.\n- **LinkedIn**: Professional yet approachable. 150-300 words. Paragraph breaks. 3-5 relevant hashtags.\n- **Xiaohongshu (小红书)**: Warm, lifestyle-focused. Emoji-rich. 150-300 characters. Authentic storytelling.\n\n## Brand Voice Rules\n- Always lead with value — give the reader something useful immediately\n- Avoid corporate jargon; write like a knowledgeable human\n- Use specific details and numbers rather than vague claims\n- Calls-to-action should feel natural, not forced\n\n## Content Pillars\n1. **Insights**: Industry trends, data-backed observations\n2. **How-to**: Step-by-step guidance, frameworks, practical tips\n3. **Stories**: Case studies, lessons learned, behind-the-scenes\n4. **Community**: Questions, polls, engaging prompts`
        )
        await knowledgeStore.addDocument(
            'Social Media Best Practices 2025',
            `# Social Media Best Practices 2025\n\n## Optimal Posting Times (UTC+8)\n- LinkedIn: Tue-Thu 8-10am and 12-1pm\n- X: Mon-Fri 9-11am and 8-10pm\n- Xiaohongshu: Weekday evenings 7-10pm, Weekend 10am-12pm\n\n## Hook Writing Formulas\n1. Problem/Pain: "Struggling with [X]? Here's what actually works."\n2. Contrarian: "Everyone says [A]. The data says [B]."\n3. Curiosity gap: "The one mistake killing your [X]"\n4. Number list: "5 things I learned after [milestone]:"\n5. Direct claim: "The fastest way to [outcome] is not what you think."\n\n## Hashtag Strategy\n- LinkedIn: 3-5 niche hashtags, blend popular with specific\n- X: 1-2 max; only when they add context or discoverability\n- Xiaohongshu: 5-8 topic tags\n\n## Content Recycling\n- Every insight can be repurposed: long-form → 5 tweets → 1 LinkedIn post → 1 Xiaohongshu note\n- A/B test headlines: same content, different hooks`
        )
        await knowledgeStore.addDocument(
            'RSS Feed Content Strategy',
            `# RSS Feed Content Strategy\n\nThe rss_reader tool supports url="@saved" to fetch all configured feed sources at once.\n\n## Categories of Valuable RSS Sources\n- Industry News: Follow 5-10 authoritative sources in your niche\n- Competitor Monitoring: Track competitor blogs to spot content gaps\n- Curated Aggregators: Feedly, Inoreader, newsletter RSS feeds\n\n## Content Workflow with RSS\n1. Pull latest feeds using rss_reader tool (url="@saved")\n2. Identify 1-3 stories with high engagement potential\n3. Extract the key insight or news\n4. Add your own perspective or counterpoint\n5. Format for the target platform\n6. Schedule via schedule_post tool\n\n## Recommended Feed Types\n- Official company blogs and engineering blogs\n- Research institution publication feeds\n- Top industry journalists' substacks\n- Aggregators: HackerNews RSS, Product Hunt Daily`
        )
        console.log('[Knowledge] Default knowledge documents seeded.')
    })

    // Pre-install popular MCP servers on first run (only if config is empty)
    seedDefaultMCPServers()
    seedDemoActivities()
}

/**
 * Seeds demo agents + automation rules + a campaign on first launch.
 * Skips if any real agents (non-manual) already exist.
 */
function seedDemoActivities(): void {
    if (!agentRegistry) return
    const existing = agentRegistry.list().filter(a => a.id !== 'manual')
    if (existing.length > 0) return  // already have agents, don't overwrite

    try {
        const DEFAULT_SECURITY_PROFILE = {
            agentId: '',
            allowedPlatforms: [] as import('./agent-core/types').PlatformId[],
            allowedTools: [
                'tool:web_search', 'tool:rss_reader', 'tool:memory_recall',
                'tool:schedule_post', 'tool:translate', 'tool:hashtag_analyze',
                'tool:sentiment_scan', 'tool:read_url', 'tool:read_skill',
                'tool:run_code', 'tool:image_gen',
                'tool:x_publish', 'tool:linkedin_post', 'tool:xhs_publish',
            ] as import('./agent-core/types').Permission[],
            maxTokensPerRun: 4096,
            maxRunsPerHour: 10,
            canAccessInternet: true,
            canReadFiles: false,
            credentialScope: [] as import('./agent-core/types').CredentialId[],
        }

        // 1. Create demo campaign
        const campaign = campaignStore.create({
            name: 'Daily Content Plan',
            description: 'Automated daily posts across all major platforms',
            platforms: ['x', 'linkedin', 'xiaohongshu'],
            personaId: null,
            coverImageUrl: null,
            channelIds: [],
            cronExpr: null,
        })
        console.log('[Seed] Created campaign:', campaign.id)

        // 2. Create 3 agents and their automation rules
        const demos = [
            { name: 'X Daily Poster',        platform: 'x'           as const, cron: '0 9 * * *'    },
            { name: 'LinkedIn Insights',     platform: 'linkedin'    as const, cron: '0 10 * * 1-5' },
            { name: '小红书内容创作者',          platform: 'xiaohongshu' as const, cron: '0 19 * * *'   },
        ]

        for (const demo of demos) {
            const agent = agentRegistry!.create({
                name: demo.name,
                platform: demo.platform,
                personaId: null,
                channelId: null,
                provider: 'claude',
                model: 'claude-3-5-sonnet-latest',
                customInstructions: '',
                skillIds: [],
                status: 'idle',
                securityProfile: {
                    ...DEFAULT_SECURITY_PROFILE,
                    allowedPlatforms: [demo.platform],
                },
            })

            automationStore.create(agent.id, demo.cron)
            console.log(`[Seed] Created agent "${demo.name}" with cron "${demo.cron}"`)
        }

        // 3. (Re)start scheduler with the new rules
        taskScheduler.start(automationStore.listActive())

        console.log('[Seed] Demo activities seeded successfully.')
    } catch (err) {
        console.error('[Seed] Failed to seed demo activities:', err)
    }
}

/**
 * Seeds 4 commonly-used MCP servers into the config file on first launch.
 * Runs only when mcpServers is empty to avoid overwriting user config.
 */
function seedDefaultMCPServers(): void {
    const existing = mcpConfigManager.readConfig()
    if (Object.keys(existing.mcpServers).length > 0) return

    const defaults: Record<string, { command: string; args: string[] }> = {
        'filesystem': {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', require('node:os').homedir()],
        },
        'fetch': {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-fetch'],
        },
        'sequential-thinking': {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
        },
        'puppeteer': {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-puppeteer'],
        },
    }

    for (const [name, cfg] of Object.entries(defaults)) {
        mcpConfigManager.setServer(name, { command: cfg.command, args: cfg.args })
    }
    console.log('[MCP] Seeded 4 default MCP servers into config')
}

// ─── Forward Message Bus events to Renderer (registered ONCE) ─────────────────
// IMPORTANT: must NOT be inside createWindow() — on macOS the window can be
// closed and re-created via the 'activate' event, which would accumulate a new
// set of listeners on the singleton messageBus each time.
let messageBusBridged = false
function bridgeMessageBus(): void {
    if (messageBusBridged) return
    messageBusBridged = true

    messageBus.on('agent:log', (payload) => {
        win?.webContents.send('agent:log', payload)
    })
    messageBus.on('agent:status-changed', (payload) => {
        win?.webContents.send('agent:status-changed', payload)
    })
    messageBus.on('agent:run-started', (payload) => {
        win?.webContents.send('agent:run-started', payload)
    })
    messageBus.on('agent:run-complete', (payload) => {
        win?.webContents.send('agent:run-complete', payload)
    })
    messageBus.on('agent:run-failed', (payload) => {
        win?.webContents.send('agent:run-failed', payload)
    })
    messageBus.on('tool:executing', (payload) => {
        win?.webContents.send('tool:executing', payload)
    })
    messageBus.on('queue:task-status', (payload) => {
        win?.webContents.send('queue:task-status', payload)
    })
    messageBus.on('post:scheduled', (payload) => {
        win?.webContents.send('post:scheduled', payload)
    })
    messageBus.on('campaign:triggered', (payload) => {
        const p = payload as { campaignId: string }
        void (async () => {
            const campaign = campaignStore.getById(p.campaignId)
            if (!campaign) return

            const platforms = campaign.platforms.length > 0 ? campaign.platforms : ['x' as import('./agent-core/types').PlatformId]
            const provider = llmGateway.getFirstProvider() ?? 'claude'
            console.log(`[Campaign] "${campaign.name}" triggered via cron — running direct for ${platforms.join(', ')}`)

            for (const platform of platforms) {
                agentCore.triggerDirect({
                    platform,
                    name: `${campaign.name} · ${platform}`,
                    provider,
                    model: llmGateway.getDefaultModel(provider),
                    personaId: campaign.personaId ?? undefined,
                    customInstructions: campaign.description ?? '',
                    campaignId: campaign.id,
                }, 2).catch((err: unknown) => {
                    console.error(`[Campaign] Failed to trigger direct run for ${platform}:`, err)
                })
            }
        })()
        win?.webContents.send('campaign:triggered', payload)
    })
}

function createWindow(): void {
    const iconPath = join(__dirname, process.env['VITE_DEV_SERVER_URL'] ? '../public/icon.png' : '../dist/icon.png')

    if (process.platform === 'darwin') {
        app.dock?.setIcon(iconPath)
    }

    const isMac = process.platform === 'darwin'
    win = new BrowserWindow({
        icon: iconPath,
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 680,
        // macOS-only native window styling
        ...(isMac ? {
            titleBarStyle: 'hiddenInset' as const,
            vibrancy: 'under-window' as const,
            visualEffectState: 'active' as const,
        } : {
            titleBarStyle: 'default' as const,
            frame: true,
        }),
        webPreferences: {
            preload,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    })

    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL)
        win.webContents.openDevTools()
    } else {
        win.loadFile(join(process.env.DIST!, 'index.html'))
    }
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('ping', () => 'pong')

// ─── Settings ─────────────────────────────────────────────────────────────────
ipcMain.handle('settings:get', () => configStore.getAll())
ipcMain.handle('settings:set', (_event, key: string, value: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    configStore.set(key as any, value as any)
    return { ok: true }
})
ipcMain.handle('settings:set-all', (_event, patch: Partial<AppConfig>) => {
    try {
        configStore.setAll(patch)
        return { ok: true }
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
})

// ─── N8N ──────────────────────────────────────────────────────────────────────
ipcMain.handle('n8n:getConfig', () => ({
    url: configStore.get('n8nUrl') ?? '',
    // Token is stored encrypted in tool_keys.enc.json (not plaintext config.json)
    hasToken: listToolKeys().includes('n8n-webhook-token'),
    token: getToolKey('n8n-webhook-token') ?? '',
}))

ipcMain.handle('n8n:configure', (_event, url: string, token: string) => {
    configStore.set('n8nUrl', url.trim())
    // Store token encrypted, not in plaintext config.json
    if (token.trim()) setToolKey('n8n-webhook-token', token.trim())
    return { ok: true }
})

ipcMain.handle('n8n:test', async () => {
    const url = configStore.get('n8nUrl')
    const token = getToolKey('n8n-webhook-token')
    if (!url) return { ok: false, error: 'No webhook URL configured' }
    try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ test: true, source: 'AutoSocialX' }),
            signal: AbortSignal.timeout(10_000),
        })
        return { ok: res.ok, status: res.status }
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
})

// ─── Skills ───────────────────────────────────────────────────────────────────
ipcMain.handle('skills:list', () => skillRegistry.listAll())
ipcMain.handle('skills:list-templates', () => skillRegistry.listTemplates())

ipcMain.handle('skills:toggle', (_event, skillName: string, enabled: boolean) => {
    configStore.setSkillEnabled(skillName, enabled)
    return { ok: true }
})

ipcMain.handle('skills:install', async (_event, skill: { name: string; description: string; content: string }) => {
    try {
        const skillsDir = skillRegistry.getSkillsDir()
        const skillDir = join(skillsDir, skill.name)
        if (!existsSync(skillDir)) mkdirSync(skillDir, { recursive: true })
        const frontmatter = `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n`
        writeFileSync(join(skillDir, 'SKILL.md'), frontmatter + skill.content, 'utf-8')
        await skillRegistry.reload()
        return { ok: true }
    } catch (err) {
        return { ok: false, error: String(err) }
    }
})

ipcMain.handle('skills:install-template', async (_event, name: string) => {
    try {
        const templatesDir = skillRegistry.getTemplatesDir()
        const extDir = join(templatesDir, name)
        const mdPath = join(extDir, 'SKILL.md')

        if (!existsSync(mdPath)) return { ok: false, error: `SKILL.md not found in template directory: ${name}` }

        const content = readFileSync(mdPath, 'utf-8')
        const validation = skillRegistry.validateTemplate(content)
        if (!validation.ok) return { ok: false, error: validation.error }

        const skillsDir = skillRegistry.getSkillsDir()
        const targetDir = join(skillsDir, name)
        if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true })
        writeFileSync(join(targetDir, 'SKILL.md'), content, 'utf-8')

        await skillRegistry.reload()
        return { ok: true }
    } catch (err) {
        return { ok: false, error: String(err) }
    }
})

ipcMain.handle('skills:open-templates-folder', async () => {
    const { shell } = await import('electron')
    shell.showItemInFolder(skillRegistry.getTemplatesDir())
    return { ok: true }
})

ipcMain.handle('skills:delete', async (_event, skillName: string) => {
    try {
        let deleted = false
        const skillsDir = skillRegistry.getSkillsDir()
        const skillDir = join(skillsDir, skillName)
        if (existsSync(skillDir)) {
            rmSync(skillDir, { recursive: true, force: true })
            deleted = true
        }

        if (deleted) {
            await skillRegistry.reload()
        }
        return { ok: true }
    } catch (err) {
        return { ok: false, error: String(err) }
    }
})

// ─── Log file IPC ─────────────────────────────────────────────────────────────

ipcMain.handle('logs:getPath', () => {
    return { dir: getLogsDir(), file: getCurrentLogFile() }
})

ipcMain.handle('logs:openFolder', async () => {
    const { shell } = await import('electron')
    shell.openPath(getLogsDir())
    return { ok: true }
})

// Real SQLite execution for Renderer P1 Phase
ipcMain.handle('db:query', async (_event, sql: string, params: unknown[] = []) => {
    try {
        const db = getDb()
        const isSelect = sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('PRAGMA')

        let rows: unknown[] = []
        if (isSelect) {
            rows = db.prepare(sql).all(...params)
        } else {
            const info = db.prepare(sql).run(...params)
            rows = [info] // return execution info for inserts/updates
        }
        return { rows, error: null }
    } catch (err) {
        console.error('[SQLite RPC Error]', err)
        return { rows: [], error: err instanceof Error ? err.message : String(err) }
    }
})

// ─── Browser / MCP Handlers ──────────────────────────────────────────────────

/** Connect to user's Chrome (or fall back to headless) and register browser tools */
ipcMain.handle('browser:connect', async (_event, port?: number) => {
    try {
        const debugPort = port ?? 9222
        // Try to find running Chrome
        let wsEndpoint: string | null = null
        try {
            const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`, {
                signal: AbortSignal.timeout(2000),
            })
            const json = await res.json() as { webSocketDebuggerUrl?: string }
            wsEndpoint = json.webSocketDebuggerUrl ?? null
        } catch {
            wsEndpoint = null
        }

        const args = ['-y', '@modelcontextprotocol/server-puppeteer']
        if (wsEndpoint) {
            args.push('--', `--browserWSEndpoint=${wsEndpoint}`)
            console.log(`[Main] Configuring Chrome MCP via ${wsEndpoint}`)
        } else {
            console.warn(`[Main] Chrome not found on port ${debugPort}. Fallback to headless.`)
        }

        // Dynamically add the browser definition to mcp_servers.json
        mcpConfigManager.setServer('browser', {
            command: 'npx',
            args,
        })

        const status = await agentCore.initBrowser(debugPort)
        return { success: true, status }
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
})

/** List all currently registered browser tools */
ipcMain.handle('browser:tools', () => {
    const status = mcpServerRegistry.getStatus()
    return { status }
})

/** Return current browser connection status */
ipcMain.handle('browser:status', () => mcpServerRegistry.getStatus())

// Agent management
ipcMain.handle('agents:list', () => {
    if (!agentRegistry) throw new Error('AgentRegistry not initialized')
    return agentRegistry.list()
})

ipcMain.handle('agents:create', (_event, params: unknown) => {
    if (!agentRegistry) throw new Error('AgentRegistry not initialized')
    const p = params as Record<string, unknown>
    // Normalize frontend params → AgentDefinition shape
    const platform = String(p['platform'] ?? 'x')
    const rawStatus = String(p['status'] ?? 'idle')
    const validStatuses = new Set(['idle', 'running', 'paused', 'error', 'complete'])
    const status = validStatuses.has(rawStatus) ? rawStatus : 'idle'
    return agentRegistry.create({
        name: String(p['name'] ?? 'Unnamed Agent'),
        platform: platform as Parameters<AgentRegistry['create']>[0]['platform'],
        personaId: typeof p['personaId'] === 'string' ? p['personaId'] : null,
        channelId: typeof p['channelId'] === 'string' ? p['channelId'] : null,
        provider: typeof p['provider'] === 'string' ? p['provider'] : 'claude',
        model: typeof p['model'] === 'string' ? p['model'] : 'claude-3-5-sonnet-latest',
        customInstructions: typeof p['customInstructions'] === 'string' ? p['customInstructions'] : typeof p['topic'] === 'string' ? p['topic'] : '',
        skillIds: Array.isArray(p['skillIds']) ? (p['skillIds'] as string[]) : [],
        status: status as Parameters<AgentRegistry['create']>[0]['status'],
        securityProfile: {
            agentId: '',
            allowedPlatforms: [platform as Parameters<AgentRegistry['create']>[0]['platform']],
            allowedTools: [
                'tool:web_search', 'tool:rss_reader', 'tool:memory_recall',
                'tool:schedule_post', 'tool:translate', 'tool:hashtag_analyze',
                'tool:sentiment_scan',
                'tool:read_url', 'tool:read_skill', 'tool:run_code',
                'tool:image_gen',
                // Platform publish tools (routed through WorkerBridge → Playwright)
                'tool:x_publish', 'tool:linkedin_post', 'tool:xhs_publish',
                // browser_do intentionally excluded: requires live browser login session
                // and fails with success:false on most social platforms when unauthenticated
            ],
            maxTokensPerRun: typeof p['maxTokensPerRun'] === 'number' ? p['maxTokensPerRun'] : 4096,
            maxRunsPerHour: 10,
            canAccessInternet: true,
            canReadFiles: false,
            credentialScope: [],
        },
    })
})

ipcMain.handle('agents:update', (_event, id: string, patch: unknown) => {
    if (!agentRegistry) throw new Error('AgentRegistry not initialized')
    const updated = agentRegistry.update(id, patch as Parameters<AgentRegistry['update']>[1])
    if (updated) {
        // Hot-reload the scheduler whenever status changes
        // For unified db, actual cron is in automations table not agents...
        // For now, reload all active rules tied to this agent if its status paused/activated
        const p = patch as Record<string, unknown>
        if ('status' in p) {
            const rules = automationStore.listByAgent(id)
            for (const r of rules) {
                if (updated.status === 'paused') {
                    taskScheduler.pauseRule(r.id)
                } else if (r.status === 'active') {
                    taskScheduler.registerRule(r)
                }
            }
        }
    }
    return updated
})

ipcMain.handle('agents:delete', (_event, id: string) => {
    if (!agentRegistry) throw new Error('AgentRegistry not initialized')
    return agentRegistry.delete(id)
})

ipcMain.handle('agents:trigger', (_event, agentId: string, input?: unknown) => {
    return agentCore.triggerAgent(agentId, input as Record<string, unknown> | undefined)
})

ipcMain.handle('agents:trigger-direct', (_event, input: unknown) => {
    return agentCore.triggerDirect(input as { provider: string; model: string; platform: string; prompt: string })
})

ipcMain.handle('agents:get-runs', (_event, agentId: string) => {
    if (!episodicMemory) throw new Error('EpisodicMemoryStore not initialized')
    return episodicMemory.listByAgent(agentId, 20)
})

// Persona management
ipcMain.handle('personas:list', () => {
    return personaHub.list()
})

ipcMain.handle('personas:compose', (_event, personaId: string) => {
    return personaHub.compose(personaId)
})

ipcMain.handle('personas:create', (_event, data: Record<string, unknown>) => {
    const id = `persona_${Date.now()}`
    const config = {
        id,
        name: String(data.name || 'New Persona'),
        toneKeywords: Array.isArray(data.toneKeywords) ? data.toneKeywords : [],
        forbiddenWords: Array.isArray(data.forbiddenWords) ? data.forbiddenWords : [],
        valuePrinciples: Array.isArray(data.valuePrinciples) ? data.valuePrinciples : [],
        styleSamples: Array.isArray(data.styleSamples) ? data.styleSamples : [],
        extraInstructions: typeof data.extraInstructions === 'string' ? data.extraInstructions : undefined
    }
    personaHub.savePersona(config)
    return config
})

ipcMain.handle('personas:update', (_event, id: string, data: Record<string, unknown>) => {
    const existing = personaHub.get(id)
    if (!existing) throw new Error('Persona not found')
    const config = {
        ...existing,
        name: typeof data.name === 'string' ? data.name : existing.name,
        toneKeywords: Array.isArray(data.toneKeywords) ? data.toneKeywords : existing.toneKeywords,
        forbiddenWords: Array.isArray(data.forbiddenWords) ? data.forbiddenWords : existing.forbiddenWords,
        valuePrinciples: Array.isArray(data.valuePrinciples) ? data.valuePrinciples : existing.valuePrinciples,
        styleSamples: Array.isArray(data.styleSamples) ? data.styleSamples : existing.styleSamples,
        extraInstructions: typeof data.extraInstructions === 'string' ? data.extraInstructions : existing.extraInstructions
    }
    personaHub.savePersona(config)
    return config
})

ipcMain.handle('personas:delete', (_event, id: string) => {
    personaHub.deletePersona(id)
    return { ok: true }
})

// LLM configuration
ipcMain.handle('llm:configure', (_event, provider: string, apiKey: string, baseURL?: string, models?: string[]) => {
    llmGateway.configure(provider, apiKey, baseURL, models)
    saveLLMKey(provider, apiKey, baseURL, models)
    return { ok: true }
})

ipcMain.handle('llm:remove', (_event, provider: string) => {
    llmGateway.remove(provider)
    deleteLLMKey(provider)
    return { ok: true }
})

ipcMain.handle('llm:providers', () => {
    return llmGateway.listAvailableProviders()
})

// ─── Tool API key management ───────────────────────────────────────────────────
ipcMain.handle('tools:setKey', (_event, name: string, key: string) => {
    setToolKey(name, key)
    return { ok: true }
})

ipcMain.handle('tools:deleteKey', (_event, name: string) => {
    deleteToolKey(name)
    return { ok: true }
})

ipcMain.handle('tools:listKeys', () => {
    return listToolKeys()
})

ipcMain.handle('tools:getKey', (_event, name: string) => {
    return getToolKey(name) ?? null
})

// ─── Image model config (multi-model) ─────────────────────────────────────────

ipcMain.handle('image:listModels', () => {
    const models = configStore.get('imageModels') ?? []
    return models.map(m => ({
        ...m,
        hasKey: listToolKeys().includes(`image-key-${m.id}`),
        apiKey: getToolKey(`image-key-${m.id}`) ?? '',
    }))
})

ipcMain.handle('image:addModel', (_event, entry: import('./config-store').ImageModelEntry, apiKey: string) => {
    const models = [...(configStore.get('imageModels') ?? [])]
    const idx = models.findIndex(m => m.id === entry.id)
    if (idx >= 0) {
        models[idx] = { id: entry.id, name: entry.name, baseURL: entry.baseURL, model: entry.model }
    } else {
        models.push({ id: entry.id, name: entry.name, baseURL: entry.baseURL, model: entry.model })
    }
    configStore.set('imageModels', models)
    if (apiKey.trim()) setToolKey(`image-key-${entry.id}`, apiKey.trim())
    // Auto-activate if this is the first model
    if (!configStore.get('activeImageModelId')) configStore.set('activeImageModelId', entry.id)
    return { ok: true }
})

ipcMain.handle('image:removeModel', (_event, id: string) => {
    const models = (configStore.get('imageModels') ?? []).filter(m => m.id !== id)
    configStore.set('imageModels', models)
    deleteToolKey(`image-key-${id}`)
    if (configStore.get('activeImageModelId') === id) {
        configStore.set('activeImageModelId', models[0]?.id ?? '')
    }
    return { ok: true }
})

ipcMain.handle('image:getActive', () => {
    const id = configStore.get('activeImageModelId')
    const models = configStore.get('imageModels') ?? []
    const entry = models.find(m => m.id === id) ?? models[0]
    if (!entry) return null
    return {
        ...entry,
        hasKey: listToolKeys().includes(`image-key-${entry.id}`),
        apiKey: getToolKey(`image-key-${entry.id}`) ?? '',
    }
})

ipcMain.handle('llm:providers-full', () => {
    return llmGateway.listConfiguredProviderDetails()
})

ipcMain.handle('llm:detect-local', async () => {
    const discovered = await detectAndConfigureLocalModels()
    return { discovered, providers: llmGateway.listConfiguredProviderDetails() }
})

ipcMain.handle('llm:test-model', async (_event, provider: string, model: string) => {
    try {
        const result = await llmGateway.generate({
            provider,
            model,
            messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
            maxTokens: 16,
        })
        return { ok: true, content: result.content.trim(), tokens: result.inputTokens + result.outputTokens }
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
})

ipcMain.handle('llm:test-agent-loop', async (_event, provider: string, model: string) => {
    return agentCore.testAgentLoop(provider, model)
})

// Queue status
ipcMain.handle('queue:status', () => ({
    pending: executionQueue.getPendingCount(),
    running: executionQueue.getRunningCount(),
}))

ipcMain.handle('queue:list', () => executionQueue.listActiveTasks())

ipcMain.handle('queue:cancel', (_event, taskId: string) => ({
    ok: executionQueue.cancel(taskId),
}))

ipcMain.handle('dashboard:stats', () => {
    const db = getDb()
    const runs = db.prepare(`
        SELECT COUNT(*) as total,
               SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as success
        FROM agent_runs
    `).get() as { total: number; success: number }

    const content = db.prepare(`
        SELECT COUNT(*) as total,
               SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published
        FROM content
    `).get() as { total: number; published: number }

    let rssItems = 0
    try {
        const r = db.prepare(`SELECT COUNT(*) as c FROM rss_items`).get() as { c: number }
        rssItems = r.c
    } catch { /* table may not exist yet */ }

    const agentRunRows = db.prepare(`
        SELECT agent_id, COUNT(*) as run_count FROM agent_runs GROUP BY agent_id
    `).all() as { agent_id: string; run_count: number }[]
    const agentRunCounts: Record<string, number> = {}
    for (const row of agentRunRows) agentRunCounts[row.agent_id] = row.run_count

    return { runs, content, rssItems, agentRunCounts }
})

// Knowledge Base
ipcMain.handle('knowledge:list', () => {
    return knowledgeStore.listDocuments()
})

ipcMain.handle('knowledge:add', (_event, title: string, content: string) => {
    return knowledgeStore.addDocument(title, content)
})

ipcMain.handle('knowledge:delete', (_event, id: string) => {
    return knowledgeStore.deleteDocument(id)
})

// ─── RSS Feed Sources ──────────────────────────────────────────────────────────

ipcMain.handle('rss:list', () => {
    return rssStore.list()
})

ipcMain.handle('rss:add', (_event, title: string, url: string, category?: string) => {
    return rssStore.add(title, url, category)
})

ipcMain.handle('rss:delete', (_event, id: string) => {
    return rssStore.delete(id)
})

ipcMain.handle('rss:import-opml', (_event, opmlXml: string) => {
    return rssStore.importOPML(opmlXml)
})

ipcMain.handle('rss:import-from-url', (_event, opmlUrl: string) => {
    return rssStore.importFromUrl(opmlUrl)
})

ipcMain.handle('rss:open-opml-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Select OPML File',
        filters: [{ name: 'OPML Files', extensions: ['opml', 'xml'] }],
        properties: ['openFile'],
    })
    if (canceled || filePaths.length === 0) return { canceled: true, feeds: [] }
    const xml = readFileSync(filePaths[0]!, 'utf-8')
    const feeds = await rssStore.importOPML(xml)
    return { canceled: false, feeds }
})

ipcMain.handle('rss:sync-now', () => rssSyncService.syncNow())
ipcMain.handle('rss:sync-stats', () => rssVectorStore.getStats())

ipcMain.handle('rss:set-interval', (_event, hours: number) => {
    const valid = [1, 2, 4, 6, 12, 24]
    const h = valid.includes(hours) ? hours : 2
    rssSyncService.setIntervalHours(h)
    return { ok: true, hours: h }
})

ipcMain.handle('rss:export-opml', async () => {
    const feeds = await rssStore.list()
    if (feeds.length === 0) return { ok: false, error: 'No feeds to export' }

    // Build OPML XML
    const outlines = feeds.map((f: { title: string; url: string; category?: string }) =>
        `  <outline type="rss" text="${f.title.replace(/"/g, '&quot;')}" title="${f.title.replace(/"/g, '&quot;')}" xmlUrl="${f.url.replace(/"/g, '&quot;')}" category="${(f.category ?? '').replace(/"/g, '&quot;')}" />`
    ).join('\n')
    const opml = `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="1.0">\n  <head><title>AutoSocialX RSS Feeds</title></head>\n  <body>\n${outlines}\n  </body>\n</opml>\n`

    const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Export RSS Feeds as OPML',
        defaultPath: 'autosocialx-feeds.opml',
        filters: [{ name: 'OPML Files', extensions: ['opml', 'xml'] }],
    })
    if (canceled || !filePath) return { ok: false, canceled: true }

    const { writeFileSync } = await import('node:fs')
    writeFileSync(filePath, opml, 'utf-8')
    return { ok: true, filePath, count: feeds.length }
})

ipcMain.handle('rss:items', (_event, opts?: { feedId?: string; search?: string; limit?: number }) => {
    const db = getDb()
    const limit = Math.min((opts?.limit ?? 50), 200)
    const conds: string[] = []
    const params: unknown[] = []
    if (opts?.feedId) { conds.push('feed_id = ?'); params.push(opts.feedId) }
    if (opts?.search?.trim()) {
        conds.push('(title LIKE ? OR content LIKE ?)')
        params.push(`%${opts.search}%`, `%${opts.search}%`)
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    params.push(limit)
    return db.prepare(
        `SELECT id, feed_id, title, content, url, pub_date, source, category, embedded_at
         FROM rss_items ${where} ORDER BY pub_date DESC LIMIT ?`
    ).all(...params)
})

// ─── MCP Server Management ─────────────────────────────────────────────────────

ipcMain.handle('mcp:list-config', () => {
    const config = mcpConfigManager.readConfig()
    const status = mcpServerRegistry.getStatus()
    return Object.entries(config.mcpServers).map(([name, cfg]) => ({
        name,
        command: cfg.command,
        args: cfg.args,
        env: cfg.env ?? {},
        connected: status[name]?.connected ?? false,
        toolCount: status[name]?.toolCount ?? 0,
    }))
})

ipcMain.handle('mcp:add-server', async (_event, name: string, cfg: MCPServerConfig) => {
    mcpConfigManager.setServer(name, cfg)
    try {
        await mcpServerRegistry.startServer(name, cfg.command, cfg.args, cfg.env)
        await mcpServerRegistry.discoverAndRegisterTools(toolRegistry)
    } catch (err) {
        console.error(`[MCP] Failed to start ${name}:`, err)
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
    return { ok: true }
})

ipcMain.handle('mcp:remove-server', async (_event, name: string) => {
    mcpConfigManager.removeServer(name)
    // Shutdown only the removed client
    const client = mcpServerRegistry.getClient(name)
    if (client) await client.disconnect()
    return { ok: true }
})

ipcMain.handle('mcp:status', () => mcpServerRegistry.getStatus())

ipcMain.handle('mcp:reconnect', async (_event, name: string) => {
    const config = mcpConfigManager.readConfig()
    const cfg = config.mcpServers[name]
    if (!cfg) return { ok: false, error: `Server "${name}" not found in config` }
    try {
        await mcpServerRegistry.startServer(name, cfg.command, cfg.args, cfg.env)
        await mcpServerRegistry.discoverAndRegisterTools(toolRegistry)
        return { ok: true }
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
})

ipcMain.handle('mcp:list-tools', async (_event, name: string) => {
    const client = mcpServerRegistry.getClient(name)
    if (!client) return { ok: false, tools: [] }
    try {
        const tools = await client.listTools()
        return { ok: true, tools: tools.map(t => ({ name: t.name, description: t.description ?? '' })) }
    } catch {
        return { ok: false, tools: [] }
    }
})

// ─── App lifecycle ─────────────────────────────────────────────────────────────

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
        win = null
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

app.on('before-quit', () => {
    taskScheduler.stop()
    contentScheduler.stop()
    rssSyncService.stop()
    agentCore.stopWorkers()
    void mcpServerRegistry.shutdown()
    closeDb()
})

// ─── Campaigns IPC ─────────────────────────────────────────────────────────────

ipcMain.handle('campaigns:list', () => {
    return campaignStore.list()
})

ipcMain.handle('campaigns:create', (_event, params: Record<string, unknown>) => {
    const cronExpr = params['cronExpr'] ? String(params['cronExpr']) : null
    const record = campaignStore.create({
        name: String(params['name']),
        description: params['description'] ? String(params['description']) : undefined,
        platforms: ((params['platforms'] as string[] | undefined) ?? []) as import('./agent-core/types').PlatformId[],
        personaId: params['personaId'] ? String(params['personaId']) : null,
        coverImageUrl: params['coverImageUrl'] ? String(params['coverImageUrl']) : null,
        channelIds: Array.isArray(params['channelIds']) ? params['channelIds'] as string[] : [],
        cronExpr,
    })
    if (cronExpr) taskScheduler.registerCampaignCron(record.id, cronExpr)
    return record
})

ipcMain.handle('campaigns:update', (_event, id: string, patch: Record<string, unknown>) => {
    const record = campaignStore.update(id, {
        name: patch['name'] !== undefined ? String(patch['name']) : undefined,
        description: patch['description'] !== undefined ? String(patch['description']) : undefined,
        platforms: Array.isArray(patch['platforms']) ? patch['platforms'] as import('./agent-core/types').PlatformId[] : undefined,
        personaId: patch['personaId'] !== undefined ? (patch['personaId'] ? String(patch['personaId']) : null) : undefined,
        coverImageUrl: patch['coverImageUrl'] !== undefined ? (patch['coverImageUrl'] ? String(patch['coverImageUrl']) : null) : undefined,
        cronExpr: patch['cronExpr'] !== undefined ? (patch['cronExpr'] ? String(patch['cronExpr']) : null) : undefined,
    })
    // Re-register cron if changed
    if (patch['cronExpr'] !== undefined) {
        const cronExpr = patch['cronExpr'] ? String(patch['cronExpr']) : null
        if (!cronExpr) taskScheduler.unregisterCampaignCron(id)
        else taskScheduler.registerCampaignCron(id, cronExpr)
    }
    return record
})

ipcMain.handle('campaigns:updateCron', (_event, id: string, cronExpr: string | null) => {
    const record = campaignStore.updateCron(id, cronExpr, cronExpr ? 'active' : 'paused')
    if (!cronExpr) {
        taskScheduler.unregisterCampaignCron(id)
    } else {
        taskScheduler.registerCampaignCron(id, cronExpr)
    }
    return record
})

ipcMain.handle('campaigns:delete', (_event, id: string) => {
    taskScheduler.unregisterCampaignCron(id)
    campaignStore.delete(id)
    return { ok: true }
})

ipcMain.handle('campaigns:setCronStatus', (_event, id: string, status: 'active' | 'paused') => {
    const campaign = campaignStore.getById(id)
    if (!campaign) return null
    if (status === 'paused') {
        taskScheduler.unregisterCampaignCron(id)
    } else if (campaign.cronExpr) {
        taskScheduler.registerCampaignCron(id, campaign.cronExpr)
    }
    return campaignStore.updateCron(id, campaign.cronExpr, status)
})

ipcMain.handle('campaigns:trigger', async (_event, campaignId: string) => {
    const campaign = campaignStore.getById(campaignId)
    if (!campaign) return { ok: false, triggered: 0 }

    const platforms = campaign.platforms.length > 0 ? campaign.platforms : ['x' as import('./agent-core/types').PlatformId]
    const provider = llmGateway.getFirstProvider() ?? 'claude'
    console.log(`[Campaign] Manual trigger "${campaign.name}" — running direct for ${platforms.join(', ')}`)

    for (const platform of platforms) {
        await agentCore.triggerDirect({
            platform,
            name: `${campaign.name} · ${platform}`,
            provider,
            model: llmGateway.getDefaultModel(provider),
            personaId: campaign.personaId ?? undefined,
            customInstructions: campaign.description ?? '',
            campaignId: campaign.id,
        }, 2)
    }
    return { ok: true, triggered: platforms.length }
})

// ─── Channels IPC ─────────────────────────────────────────────────────────────

ipcMain.handle('channels:list', () => channelStore.list())

ipcMain.handle('channels:create', (_event, platform: string, name: string, webhookUrl?: string) => {
    return channelStore.create(platform, name, webhookUrl ?? null)
})

ipcMain.handle('channels:delete', (_event, id: string) => {
    channelStore.delete(id)
    return { ok: true }
})

ipcMain.handle('channels:toggle', (_event, id: string, enabled: boolean) => {
    channelStore.toggle(id, enabled)
    return { ok: true }
})

ipcMain.handle('channels:setConfig', (_event, id: string, config: Record<string, string>) => {
    channelStore.setConfig(id, config)
    return { ok: true }
})

ipcMain.handle('channels:setWebhook', (_event, id: string, webhookUrl: string | null) => {
    channelStore.setWebhookUrl(id, webhookUrl)
    return { ok: true }
})

// ─── Automations IPC ─────────────────────────────────────────────────────────────

ipcMain.handle('automations:listAll', () => {
    return automationStore.listAll()
})

ipcMain.handle('automations:listActive', () => {
    return automationStore.listActive()
})

ipcMain.handle('automations:listByAgent', (_event, agentId: string) => {
    return automationStore.listByAgent(agentId)
})

ipcMain.handle('automations:create', (_event, agentId: string, cronExpr: string) => {
    const rule = automationStore.create(agentId, cronExpr)
    taskScheduler.registerRule(rule)
    return rule
})

ipcMain.handle('automations:update', (_event, id: string, patch: unknown) => {
    const updated = automationStore.update(id, patch as Parameters<typeof automationStore.update>[1])
    if (updated) {
        if (updated.status === 'paused') {
            taskScheduler.pauseRule(updated.id)
        } else {
            taskScheduler.registerRule(updated)
        }
    }
    return updated
})

ipcMain.handle('automations:delete', (_event, id: string) => {
    taskScheduler.pauseRule(id)
    automationStore.delete(id)
    return { ok: true }
})

// ─── Content (posts) IPC ───────────────────────────────────────────────────────

ipcMain.handle('content:list', (_event, filter?: string | { status?: string; campaignId?: string }) => {
    const db = getDb()
    const validStatuses = new Set(['draft', 'scheduled', 'queued', 'published', 'failed'])

    // Support both legacy string filter (status) and object filter
    const statusFilter = typeof filter === 'string' ? filter : filter?.status
    const campaignIdFilter = typeof filter === 'object' ? filter?.campaignId : undefined

    const conditions: string[] = []
    const params: unknown[] = []

    if (statusFilter && statusFilter !== 'all' && validStatuses.has(statusFilter)) {
        conditions.push('status = ?')
        params.push(statusFilter)
    }
    if (campaignIdFilter) {
        conditions.push('campaign_id = ?')
        params.push(campaignIdFilter)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    return db.prepare(`SELECT * FROM content ${where} ORDER BY COALESCE(scheduled_at, rowid) DESC LIMIT 100`).all(...params)
})

ipcMain.handle('content:create', (_event, params: Record<string, unknown>) => {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)
    db.prepare(`
        INSERT INTO content (id, agent_id, platform, text, media_urls, status, scheduled_at, published_at, post_id, stats)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, '{}')
    `).run(
        id,
        params['agentId'] ?? 'manual',
        params['platform'],
        params['text'],
        JSON.stringify(params['mediaUrls'] ?? []),
        params['scheduledAt'] ? 'scheduled' : (params['status'] ?? 'draft'),
        params['scheduledAt'] ? Math.floor(new Date(params['scheduledAt'] as string).getTime() / 1000) : now,
    )
    return { id }
})

ipcMain.handle('content:get', (_event, id: string) => {
    const db = getDb()
    return db.prepare('SELECT * FROM content WHERE id = ?').get(id) ?? null
})

ipcMain.handle('content:delete', (_event, id: string) => {
    const db = getDb()
    db.prepare('DELETE FROM content WHERE id = ?').run(id)
    return { ok: true }
})

ipcMain.handle('content:update-status', (_event, id: string, status: string) => {
    const db = getDb()
    db.prepare(`UPDATE content SET status = ? WHERE id = ?`).run(status, id)
    return { ok: true }
})

/** Set scheduled_at for a content record and mark it as 'scheduled' */
ipcMain.handle('content:set-schedule', (_event, id: string, scheduledAtIso: string) => {
    const db = getDb()
    const ts = Math.floor(new Date(scheduledAtIso).getTime() / 1000)
    db.prepare(`UPDATE content SET scheduled_at = ?, status = 'scheduled' WHERE id = ?`).run(ts, id)
    return { ok: true, scheduledAt: ts }
})

/** Publish a post via Webhook API */
ipcMain.handle('content:publish', (_event, id: string) => publishContent(id))

/** Retry all failed posts: re-publish each one via the webhook */
ipcMain.handle('content:retry-failed', async () => {
    const db = getDb()
    const rows = db.prepare(`SELECT id, platform FROM content WHERE status = 'failed'`).all() as { id: string; platform: string }[]
    let succeeded = 0, failed = 0
    for (const row of rows) {
        const result = await publishContent(row.id)
        if (result.success) succeeded++
        else failed++
    }
    return { ok: true, succeeded, failed, total: rows.length }
})



app.whenReady().then(async () => {
    // ── Test mode: TEST_GENERATE=1 runs the generate test and exits ─────────
    if (process.env['TEST_GENERATE']) {
        initApp()
        loadSavedLLMKeys()
        const { runGenerateTest } = await import('../tests/test-generate.js')
        await runGenerateTest()
        return
    }

    initApp()
    bridgeMessageBus()   // register once — never inside createWindow()
    initAgentLogger()    // start writing run logs to {userData}/logs/
    createWindow()
})
