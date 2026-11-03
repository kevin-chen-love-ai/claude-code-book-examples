// @autosocialx/plugins — 插件合集接口

export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  /** 插件类型 */
  type: 'media-adapter' | 'skill' | 'persona' | 'template'
}

/** 所有插件的基础接口 */
export interface IPlugin {
  readonly manifest: PluginManifest
  install(): Promise<void>
  uninstall(): Promise<void>
  isEnabled(): boolean
}

/** 技能插件接口 — 可注入到 Agent 工具调用链 */
export interface ISkillPlugin extends IPlugin {
  execute(input: Record<string, unknown>): Promise<Record<string, unknown>>
}

// ─── Adapters ────────────────────────────────────────────────────────────────

export { BasePlatformAdapter } from './adapters/base-adapter.js'
export type { IPlatformAdapter, PostDraft, PublishResult, HealthStatus } from './adapters/base-adapter.js'
export { xAdapter, XAdapter } from './adapters/x-adapter.js'
export { linkedinAdapter, LinkedInAdapter } from './adapters/linkedin-adapter.js'
export { xhsAdapter, XhsAdapter } from './adapters/xhs-adapter.js'

// ─── Skills ──────────────────────────────────────────────────────────────────

export { translateSkill } from './skills/translate-skill.js'
export type { SkillDefinition } from './skills/translate-skill.js'
export { hashtagSkill } from './skills/hashtag-skill.js'
