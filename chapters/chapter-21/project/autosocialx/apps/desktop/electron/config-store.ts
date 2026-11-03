import { app } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

// ─── Config Schema ────────────────────────────────────────────────────────────

export interface ImageModelEntry {
    /** Unique key used to look up the encrypted API key (stored as image-key-${id}) */
    id: string
    /** Display name shown in dropdowns, e.g. "302.ai · Kling v1" */
    name: string
    /** Base URL of the image generation API */
    baseURL: string
    /** Model identifier passed to the API, e.g. "kling-v1" */
    model: string
}

export interface CustomChannel {
    id: string
    name: string
    description?: string
    charLimit?: number
    media?: string[]
    contentStyle?: string
}

export interface AppConfig {
    /** UI language: 'en' | 'zh' */
    language: string
    /** Notification level: 'all' | 'important' | 'none' */
    notifications: string
    /** List of skill names that are disabled and should not be injected into agent prompts */
    disabledSkills: string[]
    /** @deprecated Legacy single-provider base URL — superseded by imageModels */
    imageBaseURL: string
    /** All configured image generation models */
    imageModels: ImageModelEntry[]
    /** ID of the currently active image model (references an entry in imageModels) */
    activeImageModelId: string
    /** RSS background sync interval in hours (1 | 2 | 4 | 6 | 12 | 24). Default 2. */
    rssSyncIntervalHours: number
    /** User-defined custom channels (in addition to the 13 built-in platforms) */
    customChannels: CustomChannel[]
    /** Publish API webhook URL, e.g. http://server:5678/webhook/social-publish */
    n8nUrl: string
    /** When false, publishing marks content as published locally without calling the n8n webhook */
    publishEnabled: boolean
    /** @deprecated Token is now stored encrypted in tool_keys.enc.json under key 'n8n-webhook-token'. This field is ignored. */
    n8nToken?: string
    /** Per-platform extra publish params, e.g. { pinterest: { board_id: '...' }, slack: { channel: '#general' } } */
    channelConfig: Record<string, Record<string, string>>
    /** Default LLM provider key for newly created agents (e.g. 'claude', 'openai') */
    defaultProvider: string
    /** Default model ID for newly created agents (e.g. 'claude-sonnet-4-6') */
    defaultModel: string
}

const DEFAULTS: AppConfig = {
    language: 'en',
    notifications: 'all',
    disabledSkills: [],
    imageBaseURL: 'https://api.302.ai',
    imageModels: [],
    activeImageModelId: '',
    rssSyncIntervalHours: 2,
    customChannels: [],
    n8nUrl: '',
    publishEnabled: true,
    channelConfig: {},
    defaultProvider: '',
    defaultModel: '',
}

// ─── ConfigStore ──────────────────────────────────────────────────────────────

class ConfigStore {
    private config: AppConfig = { ...DEFAULTS }
    private loaded = false

    private get configPath(): string {
        return join(app.getPath('userData'), 'config.json')
    }

    load(): void {
        if (this.loaded) return
        this.loaded = true
        if (!existsSync(this.configPath)) {
            this.save()
            return
        }
        try {
            const raw = JSON.parse(readFileSync(this.configPath, 'utf-8')) as Partial<AppConfig>
            this.config = { ...DEFAULTS, ...raw }
        } catch {
            console.warn('[ConfigStore] Failed to parse config.json, using defaults')
            this.config = { ...DEFAULTS }
        }
    }

    save(): void {
        try {
            writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8')
        } catch (err) {
            console.error('[ConfigStore] Failed to save config.json:', err)
        }
    }

    getAll(): AppConfig {
        return { ...this.config }
    }

    get<K extends keyof AppConfig>(key: K): AppConfig[K] {
        return this.config[key]
    }

    set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
        this.config[key] = value
        this.save()
    }

    /** Batch-update multiple keys at once — one disk write. Unknown keys are silently ignored. */
    setAll(patch: Partial<AppConfig>): void {
        const validKeys = new Set(Object.keys(DEFAULTS) as Array<keyof AppConfig>)
        for (const [k, v] of Object.entries(patch)) {
            if (validKeys.has(k as keyof AppConfig)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (this.config as any)[k] = v
            }
        }
        this.save()
    }

    // ─── Skill helpers ──────────────────────────────────────────────────────────

    isSkillEnabled(skillName: string): boolean {
        return !this.config.disabledSkills.includes(skillName)
    }

    setSkillEnabled(skillName: string, enabled: boolean): void {
        if (enabled) {
            this.config.disabledSkills = this.config.disabledSkills.filter(s => s !== skillName)
        } else {
            if (!this.config.disabledSkills.includes(skillName)) {
                this.config.disabledSkills = [...this.config.disabledSkills, skillName]
            }
        }
        this.save()
    }
}

export const configStore = new ConfigStore()
