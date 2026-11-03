import { useState, useEffect } from 'react'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { StatusBadge } from '../components/Badge'
import { Ic } from '../components/Icon'
import { gv, mn } from '../components/tokens'
import { SKILL_TEMPLATES } from '../data/skillTemplates'

import { useTranslation } from 'react-i18next'

// ─── Tab list ─────────────────────────────────────────────────────────────────

type SettingsTab = 'general' | 'n8n' | 'ai' | 'search' | 'knowledge' | 'rss' | 'mcp' | 'skills' | 'image'
type KnowledgeDoc = { id: string; title: string; content: string; addedAt: string }
const getTabsConfig = (t: (key: string) => string): { id: SettingsTab; label: string }[] => [
  { id: 'general', label: t('settings.general.title') },
  { id: 'n8n', label: 'Publish API' },
  { id: 'ai', label: 'AI Providers' },
  { id: 'image', label: 'Image Model' },
  { id: 'search', label: 'Web Search' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'rss', label: 'RSS Feeds' },
  { id: 'mcp', label: 'MCP' },
  { id: 'skills', label: 'Skills' },
]




// ─── Helpers ──────────────────────────────────────────────────────────────────

const rowStyle = (i: number) => ({
  display: 'flex', alignItems: 'center', gap: 14,
  padding: '13px 0',
  borderTop: i ? `1px solid ${gv.gbdr}` : 'none',
})

const inputStyle: React.CSSProperties = {
  flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,.05)',
  border: `1px solid ${gv.gbdr}`, borderRadius: 7, color: gv.tx,
  outline: 'none', fontSize: 13, fontFamily: 'inherit',
}

const selectStyle: React.CSSProperties = {
  padding: '7px 10px', background: 'rgba(255,255,255,.05)',
  border: `1px solid ${gv.gbdr}`, borderRadius: 7, color: gv.tx,
  outline: 'none', fontSize: 13, cursor: 'pointer', appearance: 'none',
  fontFamily: 'inherit', minWidth: 140,
}

// ─── Toggle component ─────────────────────────────────────────────────────────

const Toggle = ({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) => (
  <div
    onClick={() => onChange(!on)}
    style={{
      width: 42, height: 24, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
      background: on ? gv.cc : 'rgba(255,255,255,.1)',
      position: 'relative', transition: 'background .2s',
    }}
  >
    <div style={{
      position: 'absolute', top: 3, left: on ? 21 : 3,
      width: 18, height: 18, borderRadius: 9, background: '#fff',
      transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.3)',
    }} />
  </div>
)

// ─── Main Component ───────────────────────────────────────────────────────────

export const SettingsPage = () => {
  const { t, i18n } = useTranslation()
  const TABS = getTabsConfig(t)
  const [tab, setTab] = useState<SettingsTab>('general')

  // ── General settings ────────────────────────────────────────────────────────
  const [language, setLanguage] = useState('en')
  const [notifications, setNotifications] = useState('all')
  const [generalLoaded, setGeneralLoaded] = useState(false)
  const [generalSaving, setGeneralSaving] = useState(false)
  const [generalSaveMsg, setGeneralSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  // General — Default AI Model
  const [defaultProvider, setDefaultProvider] = useState('')
  const [defaultModel, setDefaultModel] = useState('')
  const [generalProviders, setGeneralProviders] = useState<LLMProviderDetail[]>([])
  // General — active image model selection
  const [activeImageModelId, setActiveImageModelId] = useState('')
  // General — Publish Gateway
  const [publishEnabled, setPublishEnabled] = useState(true)
  // General — status reads (n8n / image / tavily) loaded alongside general
  const [genN8nConfigured, setGenN8nConfigured] = useState(false)
  const [, setGenImageConfigured] = useState(false)
  const [genTavilyConfigured, setGenTavilyConfigured] = useState(false)

  // ── AI Provider config ───────────────────────────────────────────────────────
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI
  const [providersLoading, setProvidersLoading] = useState(true)
  const [configuringProvider, setConfiguringProvider] = useState<string | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [baseURLInput, setBaseURLInput] = useState('')
  const [addingProvider, setAddingProvider] = useState(false)
  const [addPreset, setAddPreset] = useState('')
  const [addKey, setAddKey] = useState('')
  const [addApiKey, setAddApiKey] = useState('')
  const [addBaseURL, setAddBaseURL] = useState('')
  type LLMProviderDetail = { key: string; name: string; baseURL: string | null; type: string; models: string[]; apiKey: string }
  const [llmProvidersDetail, setLlmProvidersDetail] = useState<LLMProviderDetail[]>([])
  const [addModels, setAddModels] = useState('')
  const [detectingLocal, setDetectingLocal] = useState(false)
  const [detectLocalMsg, setDetectLocalMsg] = useState<string | null>(null)
  const [modelTestResults, setModelTestResults] = useState<Record<string, { ok: boolean; msg: string; testing?: boolean }>>({})
  const [loopTestResults, setLoopTestResults] = useState<Record<string, { ok: boolean; msg: string; testing?: boolean }>>({})

  const handleTestLoopModel = async (providerKey: string, model: string) => {
    const api = window.electronAPI
    if (!api) return
    const key = `${providerKey}::${model}`
    setLoopTestResults(prev => ({ ...prev, [key]: { ok: false, msg: 'Running loop…', testing: true } }))
    const res = await api.llm.testAgentLoop(providerKey, model)
    setLoopTestResults(prev => ({
      ...prev,
      [key]: res.ok && res.schedulePostCalled
        ? { ok: true, msg: `✓ schedule_post OK (${res.steps} steps, ${res.tokensUsed} tok)` }
        : { ok: false, msg: `✗ No post saved — ${res.error ?? (res.schedulePostCalled ? 'loop failed' : 'schedule_post not called')}` },
    }))
  }

  const handleTestAllModels = async () => {
    const api = window.electronAPI
    if (!api) return
    const results: Record<string, { ok: boolean; msg: string; testing?: boolean }> = {}
    for (const p of llmProvidersDetail) {
      for (const model of p.models) {
        const key = `${p.key}::${model}`
        setModelTestResults(prev => ({ ...prev, [key]: { ok: false, msg: 'Testing…', testing: true } }))
        const res = await api.llm.testModel(p.key, model)
        setModelTestResults(prev => ({
          ...prev,
          [key]: res.ok
            ? { ok: true, msg: `✓ ${res.content ?? 'OK'} (${res.tokens ?? 0} tok)` }
            : { ok: false, msg: `✗ ${res.error ?? 'failed'}` },
        }))
      }
    }
    void results
  }

  // ── Knowledge (RAG) ─────────────────────────────────────────────────────────
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>([])
  const [newDocTitle, setNewDocTitle] = useState('')
  const [newDocContent, setNewDocContent] = useState('')
  const [isAddingDoc, setIsAddingDoc] = useState(false)

  // ── RSS Feeds ────────────────────────────────────────────────────────────────
  type RssFeed = { id: string; title: string; url: string; category: string; addedAt: string }
  type RssItem = { id: string; feed_id: string; title: string; content: string; url: string; pub_date: string; source: string; category: string; embedded_at: number | null }
  const [rssFeeds, setRssFeeds] = useState<RssFeed[]>([])
  const [rssAddTitle, setRssAddTitle] = useState('')
  const [rssAddUrl, setRssAddUrl] = useState('')
  const [rssAddCategory, setRssAddCategory] = useState('General')
  const [rssAdding, setRssAdding] = useState(false)
  const [rssImporting, setRssImporting] = useState(false)
  const [rssExporting, setRssExporting] = useState(false)
  const [rssMsg, setRssMsg] = useState<string | null>(null)
  const [rssSyncing, setRssSyncing] = useState(false)
  const [rssSyncStats, setRssSyncStats] = useState<{ total: number; embedded: number; lastFetchedAt: number | null } | null>(null)
  const [rssSyncInterval, setRssSyncInterval] = useState(2)
  const [rssItems, setRssItems] = useState<RssItem[]>([])
  const [rssItemsLoading, setRssItemsLoading] = useState(false)
  const [rssItemsSearch, setRssItemsSearch] = useState('')
  const [rssItemsFeedId, setRssItemsFeedId] = useState('')
  const [rssItemsExpanded, setRssItemsExpanded] = useState<Set<string>>(new Set())

  // ── MCP config ──────────────────────────────────────────────────────────────
  type MCPRow = { name: string; command: string; args: string[]; env: Record<string, string>; connected: boolean; toolCount: number }
  type MCPTool = { name: string; description: string }
  const [mcpServers, setMcpServers] = useState<MCPRow[]>([])
  const [mcpForm, setMcpForm] = useState({ name: '', command: '', args: '', env: '' })
  const [mcpAdding, setMcpAdding] = useState(false)
  const [mcpError, setMcpError] = useState('')
  const [mcpExpandedTools, setMcpExpandedTools] = useState<Record<string, MCPTool[] | null>>({})
  const [mcpReconnecting, setMcpReconnecting] = useState<Record<string, boolean>>({})

  // ── Skills ───────────────────────────────────────────────────────────────────
  type SkillRow = { name: string; description?: string; enabled: boolean }
  const [skills, setSkills] = useState<SkillRow[]>([])
  type TemplateRow = { name: string; description?: string; isInstalled: boolean }
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [skillsLoading, setSkillsLoading] = useState(false)

  // ── Tavily (web search) key ───────────────────────────────────────────────────
  const [tavilyKey, setTavilyKey] = useState('')
  const [tavilyHasKey, setTavilyHasKey] = useState(false)
  const [tavilySaving, setTavilySaving] = useState(false)
  const [tavilyMsg, setTavilyMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const loadTavilyStatus = async () => {
    const keys = await window.electronAPI?.tools.listKeys() ?? []
    const has = keys.includes('tavily')
    setTavilyHasKey(has)
    if (has) {
      const val = await window.electronAPI?.tools.getKey('tavily')
      if (val) setTavilyKey(val)
    }
  }

  const handleTavilySave = async () => {
    if (!tavilyKey.trim()) return
    setTavilySaving(true)
    setTavilyMsg(null)
    try {
      await window.electronAPI?.tools.setKey('tavily', tavilyKey.trim())
      setTavilyHasKey(true)
      setTavilyKey('')
      setTavilyMsg({ ok: true, text: '✓ Tavily API key saved' })
    } catch (err) {
      setTavilyMsg({ ok: false, text: err instanceof Error ? err.message : 'Save failed' })
    }
    setTavilySaving(false)
    setTimeout(() => setTavilyMsg(null), 4000)
  }

  const handleTavilyRemove = async () => {
    setTavilySaving(true)
    await window.electronAPI?.tools.deleteKey('tavily')
    setTavilyHasKey(false)
    setTavilySaving(false)
    setTavilyMsg({ ok: true, text: '✓ Key removed' })
    setTimeout(() => setTavilyMsg(null), 3000)
  }

  // ── N8N config ───────────────────────────────────────────────────────────────
  const [n8nUrl, setN8nUrl] = useState('')
  const [n8nToken, setN8nToken] = useState('')
  const [n8nHasToken, setN8nHasToken] = useState(false)
  const [n8nSaving, setN8nSaving] = useState(false)
  const [n8nTesting, setN8nTesting] = useState(false)
  const [n8nMsg, setN8nMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [n8nPreviewOpen, setN8nPreviewOpen] = useState(false)

  const loadN8nConfig = async () => {
    const cfg = await window.electronAPI?.n8n?.getConfig()
    if (cfg) {
      setN8nUrl(cfg.url)
      setN8nHasToken(cfg.hasToken)
      if (cfg.token) setN8nToken(cfg.token)
    }
  }

  const handleN8nSave = async () => {
    setN8nSaving(true)
    setN8nMsg(null)
    try {
      await window.electronAPI?.n8n?.configure(n8nUrl.trim(), n8nToken.trim())
      setN8nHasToken(!!n8nToken.trim())
      setN8nToken('')
      setN8nMsg({ ok: true, text: '✓ Publish API config saved' })
    } catch (err) {
      setN8nMsg({ ok: false, text: err instanceof Error ? err.message : 'Save failed' })
    }
    setN8nSaving(false)
    setTimeout(() => setN8nMsg(null), 4000)
  }

  const handleN8nTest = async () => {
    setN8nTesting(true)
    setN8nMsg(null)
    try {
      const res = await window.electronAPI?.n8n?.test()
      if (res?.ok) {
        setN8nMsg({ ok: true, text: `✓ Webhook reachable (HTTP ${res.status})` })
      } else {
        setN8nMsg({ ok: false, text: res?.error ?? `HTTP ${res?.status ?? '?'}` })
      }
    } catch (err) {
      setN8nMsg({ ok: false, text: err instanceof Error ? err.message : 'Test failed' })
    }
    setN8nTesting(false)
    setTimeout(() => setN8nMsg(null), 5000)
  }

  // ── Image model config (multi-model) ─────────────────────────────────────────
  type ImageModelRow = { id: string; name: string; baseURL: string; model: string; hasKey: boolean; apiKey: string }
  const [imageModels, setImageModels] = useState<ImageModelRow[]>([])
  const [imageMsg, setImageMsg] = useState<{ ok: boolean; text: string } | null>(null)
  // Add-model form
  const [imageAddOpen, setImageAddOpen] = useState(false)
  const [imageAddPreset, setImageAddPreset] = useState('')
  const [imageAddId, setImageAddId] = useState('')
  const [imageAddName, setImageAddName] = useState('')
  const [imageAddBaseURL, setImageAddBaseURL] = useState('')
  const [imageAddModel, setImageAddModel] = useState('')
  const [imageAddApiKey, setImageAddApiKey] = useState('')
  const [imageAdding, setImageAdding] = useState(false)

  const IMAGE_PRESETS = [
    { label: '302.ai · Kling v1',     id: '302ai-kling-v1',    name: '302.ai · Kling v1',     baseURL: 'https://api.302.ai', model: 'kling-v1' },
    { label: '302.ai · Kling v2',     id: '302ai-kling-v2',    name: '302.ai · Kling v2',     baseURL: 'https://api.302.ai', model: 'kling-v2' },
    { label: '302.ai · Flux Schnell', id: '302ai-flux-schnell', name: '302.ai · Flux Schnell', baseURL: 'https://api.302.ai', model: 'flux-schnell' },
    { label: '302.ai · Stable Diffusion XL', id: '302ai-sdxl', name: '302.ai · Stable Diffusion XL', baseURL: 'https://api.302.ai', model: 'stable-diffusion-xl' },
    { label: 'OpenAI · DALL-E 3',     id: 'openai-dalle3',     name: 'OpenAI · DALL-E 3',     baseURL: 'https://api.openai.com/v1', model: 'dall-e-3' },
    { label: 'Custom…', id: '', name: '', baseURL: '', model: '' },
  ]

  const loadImageModels = async () => {
    const rows = await window.electronAPI?.image?.listModels()
    if (rows) setImageModels(rows)
  }

  const handleImageAdd = async () => {
    const id = imageAddId.trim()
    const name = imageAddName.trim()
    const baseURL = imageAddBaseURL.trim()
    const model = imageAddModel.trim()
    if (!id || !name || !baseURL || !model) {
      setImageMsg({ ok: false, text: 'All fields are required' })
      return
    }
    setImageAdding(true)
    setImageMsg(null)
    await window.electronAPI?.image?.addModel({ id, name, baseURL, model }, imageAddApiKey.trim())
    await loadImageModels()
    setImageAddOpen(false)
    setImageAddPreset(''); setImageAddId(''); setImageAddName(''); setImageAddBaseURL(''); setImageAddModel(''); setImageAddApiKey('')
    setImageMsg({ ok: true, text: `✓ "${name}" added` })
    setImageAdding(false)
    setTimeout(() => setImageMsg(null), 3000)
  }

  const handleImageRemove = async (id: string, name: string) => {
    if (!confirm(`Remove image model "${name}"?`)) return
    await window.electronAPI?.image?.removeModel(id)
    await loadImageModels()
    // If it was the active model, clear activeImageModelId
    if (activeImageModelId === id) setActiveImageModelId('')
  }

  // ── Data loaders ─────────────────────────────────────────────────────────────
  const loadGeneral = async () => {
    const api = window.electronAPI
    const cfg = await api?.settings?.get()
    if (cfg) {
      setLanguage(cfg.language ?? 'en')
      setNotifications(cfg.notifications ?? 'all')
      setRssSyncInterval(cfg.rssSyncIntervalHours ?? 2)
      setDefaultProvider(cfg.defaultProvider ?? '')
      setDefaultModel(cfg.defaultModel ?? '')
      setPublishEnabled(cfg.publishEnabled ?? true)
      setActiveImageModelId(cfg.activeImageModelId ?? '')
    }
    setGeneralLoaded(true)
    if (!api) return
    // Load status for overview sections in parallel
    void api.llm.providersDetail().then(d => setGeneralProviders(d ?? []))
    void api.n8n?.getConfig().then(c => setGenN8nConfigured(!!c?.url))
    void api.image?.listModels().then(rows => {
      if (rows) {
        setImageModels(rows)
        setGenImageConfigured(rows.some(r => r.hasKey))
      }
    })
    void api.tools.listKeys().then(keys => setGenTavilyConfigured(Array.isArray(keys) && keys.includes('tavily')))
  }

  const saveGeneral = async () => {
    setGeneralSaving(true)
    setGeneralSaveMsg(null)
    const res = await window.electronAPI?.settings?.setAll({
      language, notifications,
      defaultProvider, defaultModel,
      publishEnabled, activeImageModelId,
    })
    setGeneralSaving(false)
    if (!res) return
    if (res.ok) {
      void i18n.changeLanguage(language)
      setGeneralSaveMsg({ ok: true, text: t('settings.general.saved', 'Saved') })
      setTimeout(() => setGeneralSaveMsg(null), 2500)
    } else {
      setGeneralSaveMsg({ ok: false, text: res.error ?? t('settings.general.save_failed', 'Save failed') })
    }
  }

  const loadKnowledgeDocs = async () => {
    if (window.electronAPI?.knowledge) {
      const docs = await window.electronAPI.knowledge.list()
      setKnowledgeDocs(docs)
    }
  }

  const loadMcp = async () => {
    const api = window.electronAPI
    if (!api?.mcp) return
    const rows = await api.mcp.listConfig()
    setMcpServers(rows)
  }

  const loadSkills = async () => {
    setSkillsLoading(true)
    const api = window.electronAPI?.skills
    if (api) {
      const [rows, tpls] = await Promise.all([
        api.list(),
        api.listTemplates()
      ])
      if (rows) setSkills(rows)
      if (tpls) setTemplates(tpls)
    }
    setSkillsLoading(false)
  }

  const handleOpenTemplatesFolder = async () => {
    await window.electronAPI?.skills?.openTemplatesFolder()
    await loadSkills()
  }

  const handleInstallLocalTemplate = async (name: string) => {
    const res = await window.electronAPI?.skills?.installTemplate(name)
    if (res?.ok) {
      alert(t('settings.skills.install_success', 'Skill installed successfully'))
      await loadSkills()
    } else {
      alert(res?.error ?? t('settings.skills.install_failed', 'Installation failed'))
    }
  }

  const handleAddMcpServer = async () => {
    if (!mcpForm.name.trim() || !mcpForm.command.trim()) return
    setMcpAdding(true)
    setMcpError('')
    let args: string[] = []
    let env: Record<string, string> = {}
    try {
      args = mcpForm.args.trim() ? JSON.parse(mcpForm.args) as string[] : []
      env = mcpForm.env.trim() ? JSON.parse(mcpForm.env) as Record<string, string> : {}
    } catch {
      setMcpError('Args / Env must be valid JSON')
      setMcpAdding(false)
      return
    }
    const res = await window.electronAPI?.mcp.addServer(mcpForm.name.trim(), { command: mcpForm.command.trim(), args, env })
    if (res && !res.ok) setMcpError(res.error ?? 'Failed')
    else setMcpForm({ name: '', command: '', args: '', env: '' })
    await loadMcp()
    setMcpAdding(false)
  }

  const handleRemoveMcpServer = async (name: string) => {
    if (!confirm(`Remove MCP server "${name}"?`)) return
    await window.electronAPI?.mcp.removeServer(name)
    await loadMcp()
  }

  const refreshProviders = async () => {
    const pd = await window.electronAPI?.llm.providersDetail()
    if (pd) setLlmProvidersDetail(pd)
  }

  const handleConfigure = async (providerKey: string) => {
    const api = window.electronAPI
    if (!api || (!apiKeyInput.trim() && providerKey !== 'ollama' && providerKey !== 'lmstudio')) return
    await api.llm.configure(providerKey, apiKeyInput.trim(), baseURLInput.trim() || undefined)
    setApiKeyInput('')
    setBaseURLInput('')
    setConfiguringProvider(null)
    await refreshProviders()
  }

  const handleDetectLocal = async () => {
    const api = window.electronAPI
    if (!api) return
    setDetectingLocal(true)
    setDetectLocalMsg(null)
    try {
      const result = await api.llm.detectLocal()
      if (result.discovered.length > 0) {
        setLlmProvidersDetail(result.providers)
        setDetectLocalMsg(`✓ Found: ${result.discovered.join(', ')}`)
      } else {
        setDetectLocalMsg('No new local providers detected')
      }
    } catch {
      setDetectLocalMsg('Detection failed')
    }
    setDetectingLocal(false)
    setTimeout(() => setDetectLocalMsg(null), 4000)
  }

  const handleRemoveProvider = async (key: string) => {
    if (!confirm(`Remove provider "${key}"?`)) return
    await window.electronAPI?.llm.remove(key)
    await refreshProviders()
  }

  const PROVIDER_PRESETS = [
    { label: 'Claude (Anthropic)', key: 'claude', baseURL: '' },
    { label: 'OpenAI', key: 'openai', baseURL: '' },
    { label: 'Volcengine Ark (火山引擎)', key: 'volcengine', baseURL: 'https://ark.cn-beijing.volces.com/api/v3' },
    { label: 'Bailian — Aliyun Coding Plan', key: 'bailian', baseURL: 'https://coding.dashscope.aliyuncs.com/v1' },
    { label: 'DashScope (Aliyun)', key: 'dashscope', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
    { label: 'DeepSeek', key: 'deepseek', baseURL: 'https://api.deepseek.com' },
    { label: 'Ollama (Local)', key: 'ollama', baseURL: 'http://localhost:11434/v1' },
    { label: 'LM Studio (Local)', key: 'lmstudio', baseURL: 'http://localhost:1234/v1' },
    { label: 'OpenAI Codex CLI', key: 'codex', baseURL: '' },
    { label: 'Custom…', key: '', baseURL: '' },
  ]

  const handleAddProvider = async () => {
    const api = window.electronAPI
    const resolvedKey = addKey.trim() || addPreset
    if (!api || !resolvedKey) return
    const models = addModels.trim() ? addModels.split(',').map(m => m.trim()).filter(Boolean) : undefined
    await api.llm.configure(resolvedKey, addApiKey.trim(), addBaseURL.trim() || undefined, models)
    setAddingProvider(false)
    setAddPreset('')
    setAddKey('')
    setAddApiKey('')
    setAddBaseURL('')
    setAddModels('')
    await refreshProviders()
  }

  const handleAddDocument = async () => {
    if (!newDocTitle.trim() || !newDocContent.trim()) return
    setIsAddingDoc(true)
    await window.electronAPI?.knowledge.add(newDocTitle.trim(), newDocContent.trim())
    setNewDocTitle('')
    setNewDocContent('')
    setIsAddingDoc(false)
    await loadKnowledgeDocs()
  }

  const handleDeleteDocument = async (id: string) => {
    if (confirm('Delete this knowledge document?')) {
      await window.electronAPI?.knowledge.delete(id)
      await loadKnowledgeDocs()
    }
  }

  // ── RSS handlers ────────────────────────────────────────────────────────
  const loadRssFeeds = async () => {
    try {
      const feeds = await window.electronAPI?.rss?.list()
      if (feeds) setRssFeeds(feeds as RssFeed[])
    } catch { /* ignore */ }
    try {
      const stats = await window.electronAPI?.rss?.syncStats()
      if (stats) setRssSyncStats(stats)
    } catch { /* rss_items table may not exist yet */ }
  }

  const loadRssItems = async (opts?: { search?: string; feedId?: string }) => {
    setRssItemsLoading(true)
    try {
      const items = await window.electronAPI?.rss?.items({
        search: opts?.search?.trim() || undefined,
        feedId: opts?.feedId || undefined,
        limit: 50,
      })
      setRssItems((items ?? []) as RssItem[])
    } catch {
      setRssItems([])
    } finally {
      setRssItemsLoading(false)
    }
  }

  const handleRssSyncNow = async () => {
    setRssSyncing(true)
    setRssMsg(null)
    try {
      const result = await window.electronAPI?.rss?.syncNow()
      if (result) {
        setRssMsg(`同步完成：+${result.newItems} 篇文章，向量化 ${result.embeddedItems} 篇，处理 ${result.feedsProcessed} 个源`)
        const stats = await window.electronAPI?.rss?.syncStats()
        if (stats) setRssSyncStats(stats)
        setTimeout(() => setRssMsg(null), 5000)
      }
    } catch (err) {
      setRssMsg(`同步失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setRssSyncing(false)
    }
  }

  const handleAddFeed = async () => {
    const url = rssAddUrl.trim()
    const title = rssAddTitle.trim() || url
    if (!url) return
    const feed = await window.electronAPI?.rss?.add(title, url, rssAddCategory || 'General')
    if (feed) {
      setRssFeeds(prev => [...prev, feed as RssFeed])
      setRssAddTitle('')
      setRssAddUrl('')
      setRssAddCategory('General')
      setRssAdding(false)
    }
  }

  const handleDeleteFeed = async (id: string) => {
    if (!confirm('Remove this RSS feed source?')) return
    await window.electronAPI?.rss?.delete(id)
    setRssFeeds(prev => prev.filter(f => f.id !== id))
  }

  const handleImportOPML = async () => {
    setRssImporting(true)
    setRssMsg(null)
    const result = await window.electronAPI?.rss?.openOPMLDialog()
    if (result && !result.canceled) {
      setRssFeeds(prev => {
        const existingIds = new Set(prev.map(f => f.id))
        const newFeeds = (result.feeds as RssFeed[]).filter(f => !existingIds.has(f.id))
        return [...prev, ...newFeeds]
      })
      const count = result.feeds.length
      setRssMsg(`✓ Imported ${count} feed source${count !== 1 ? 's' : ''}`)
      setTimeout(() => setRssMsg(null), 4000)
    }
    setRssImporting(false)
  }

  const handleExportOPML = async () => {
    setRssExporting(true)
    setRssMsg(null)
    try {
      const result = await window.electronAPI?.rss?.exportOPML()
      if (result?.ok) {
        setRssMsg(`✓ Exported ${result.count ?? 0} feed${(result.count ?? 0) !== 1 ? 's' : ''}`)
      } else if (!result?.canceled) {
        setRssMsg(`Export failed: ${result?.error ?? 'unknown error'}`)
      }
    } catch (err) {
      setRssMsg(`Export failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setRssExporting(false)
      setTimeout(() => setRssMsg(null), 4000)
    }
  }

  const handleRssSyncIntervalChange = async (hours: number) => {
    setRssSyncInterval(hours)
    await window.electronAPI?.rss?.setInterval(hours)
  }

  const handleMcpReconnect = async (name: string) => {
    setMcpReconnecting(prev => ({ ...prev, [name]: true }))
    try {
      const res = await window.electronAPI?.mcp.reconnect(name)
      if (res && !res.ok) setMcpError(`Reconnect failed: ${res.error ?? 'unknown'}`)
    } finally {
      setMcpReconnecting(prev => ({ ...prev, [name]: false }))
      await loadMcp()
    }
  }

  const handleMcpToggleTools = async (name: string) => {
    if (mcpExpandedTools[name] !== undefined) {
      // Collapse
      setMcpExpandedTools(prev => { const n = { ...prev }; delete n[name]; return n })
      return
    }
    // Expand: fetch tools
    setMcpExpandedTools(prev => ({ ...prev, [name]: null })) // null = loading
    try {
      const res = await window.electronAPI?.mcp.listTools(name)
      setMcpExpandedTools(prev => ({ ...prev, [name]: res?.tools ?? [] }))
    } catch {
      setMcpExpandedTools(prev => ({ ...prev, [name]: [] }))
    }
  }

  const handleSkillToggle = async (skillName: string, enabled: boolean) => {
    await window.electronAPI?.skills?.toggle(skillName, enabled)
    setSkills(prev => prev.map(s => s.name === skillName ? { ...s, enabled } : s))
  }

  const handleInstallSkill = async (template: typeof SKILL_TEMPLATES[0]) => {
    setSkillsLoading(true)
    await window.electronAPI?.skills?.install(template)
    await loadSkills()
  }

  const handleDeleteSkill = async (skillName: string) => {
    if (!confirm(`Delete skill "${skillName}"?`)) return
    setSkillsLoading(true)
    await window.electronAPI?.skills?.delete(skillName)
    await loadSkills()
  }

  // ── Initial load + tab-responsive loading ──────────────────────────────────
  useEffect(() => {
    // Load all data once on mount
    void loadGeneral()
    const api = window.electronAPI
    if (!api) {
      setProvidersLoading(false)
      return
    }
    void api.llm.providersDetail().then(d => { setLlmProvidersDetail(d); setProvidersLoading(false) })
    void loadKnowledgeDocs()
    void loadRssFeeds()
    void loadMcp()
    // The loader functions intentionally run once to hydrate state from Electron IPC.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reload tab-specific data every time the user switches to that tab,
  // so we always show fresh data (e.g. after adding a provider from elsewhere).
  useEffect(() => {
    const api = window.electronAPI
    if (tab === 'general') {
      void loadGeneral()
    } else if (tab === 'n8n') {
      void loadN8nConfig()
    } else if (tab === 'ai') {
      setProvidersLoading(true)
      if (api) {
        void api.llm.providersDetail().then(d => { setLlmProvidersDetail(d); setProvidersLoading(false) })
      } else {
        setProvidersLoading(false)
      }
    } else if (tab === 'search') {
      void loadTavilyStatus()
    } else if (tab === 'knowledge') {
      void loadKnowledgeDocs()
    } else if (tab === 'rss') {
      void loadRssFeeds()
      void loadRssItems()
    } else if (tab === 'image') {
      void loadImageModels()
    } else if (tab === 'mcp') {
      void loadMcp()
    } else if (tab === 'skills') {
      void loadSkills()
    }
    // Loaders are recreated during render but only the active tab should trigger a refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // Debounce RSS items search/filter
  useEffect(() => {
    if (tab !== 'rss') return
    const timer = setTimeout(() => {
      void loadRssItems({ search: rssItemsSearch, feedId: rssItemsFeedId })
    }, 300)
    return () => clearTimeout(timer)
    // Search changes, rather than the loader identity, control this debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rssItemsSearch, rssItemsFeedId, tab])

  // ── Skill badge color ─────────────────────────────────────────────────────────
  const skillColor = (name: string) => {
    const palette = [gv.cc, gv.ac, gv.gr, gv.yl, '#9C88FF', '#FF6B6B']
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return palette[Math.abs(hash) % palette.length]
  }

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <Button
            key={t.id} sm
            onClick={() => setTab(t.id)}
            sx={{
              background: tab === t.id ? `${gv.cc}18` : 'rgba(255,255,255,.04)',
              color: tab === t.id ? gv.cc : gv.ts,
              border: tab === t.id ? `1px solid ${gv.cc}30` : `1px solid ${gv.gbdr}`,
            }}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <Card sx={{ padding: 20 }}>

        {/* ══════════════════════════ PUBLISH API ════════════════════════════════ */}
        {tab === 'n8n' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Publish API</div>
              <div style={{ fontSize: 11, color: gv.td, marginTop: 4, lineHeight: 1.6 }}>
                Webhook endpoint for publishing content. When set, "Publish" will POST to this URL.<br />
                Production: <code style={{ background: 'rgba(255,255,255,.07)', padding: '1px 5px', borderRadius: 4 }}>POST /webhook/social-publish</code> &nbsp;|&nbsp;
                Test: <code style={{ background: 'rgba(255,255,255,.07)', padding: '1px 5px', borderRadius: 4 }}>POST /webhook-test/social-publish</code>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: gv.td, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Webhook URL</div>
                <input
                  value={n8nUrl}
                  onChange={e => setN8nUrl(e.target.value)}
                  placeholder="http://your-server:5678/webhook/social-publish"
                  style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                />
                <div style={{ fontSize: 10, color: gv.td, marginTop: 4 }}>
                  Payload: <code style={{ background: 'rgba(255,255,255,.07)', padding: '1px 5px', borderRadius: 4 }}>content_id, platform, title, text, media_urls, scheduled_at, published_at_request, board_id?, channel?, extra?</code>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: gv.td, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Bearer Token {n8nHasToken && <span style={{ color: gv.gr, fontWeight: 400, textTransform: 'none' }}>(saved)</span>}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={n8nToken}
                    onChange={e => setN8nToken(e.target.value)}
                    placeholder="Optional — sent as Authorization: Bearer …"
                    style={{ ...inputStyle, flex: 1, boxSizing: 'border-box', fontFamily: n8nToken ? mn : 'inherit' }}
                  />
                  {n8nToken && (
                    <button onClick={() => void navigator.clipboard.writeText(n8nToken)} style={{ background: 'rgba(255,255,255,.06)', border: `1px solid ${gv.gbdr}`, borderRadius: 6, color: gv.td, cursor: 'pointer', padding: '6px 10px', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }} title="Copy token">⎘ Copy</button>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Button primary sm onClick={() => void handleN8nSave()} disabled={n8nSaving}>
                  {n8nSaving ? 'Saving…' : 'Save'}
                </Button>
                <Button sm onClick={() => void handleN8nTest()} disabled={n8nTesting || !n8nUrl.trim()}>
                  {n8nTesting ? 'Testing…' : 'Test Webhook'}
                </Button>
                {n8nMsg && (
                  <span style={{ fontSize: 12, color: n8nMsg.ok ? gv.gr : gv.rd }}>{n8nMsg.text}</span>
                )}
              </div>
            </div>

            {/* Request Body Preview */}
            <div style={{ marginTop: 24, borderTop: `1px solid ${gv.gbdr}`, paddingTop: 16 }}>
              <button
                onClick={() => setN8nPreviewOpen(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: gv.ts, fontSize: 12, padding: 0 }}
              >
                <span style={{ fontSize: 10, transition: 'transform .15s', display: 'inline-block', transform: n8nPreviewOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                Request Body Preview
              </button>
              {n8nPreviewOpen && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: gv.td, marginBottom: 8, lineHeight: 1.6 }}>
                    AutoSocialX POSTs this JSON to your webhook URL when publishing content. Use these fields to route requests in your n8n workflow.
                  </div>
                  <pre style={{
                    background: 'rgba(0,0,0,.35)', border: `1px solid ${gv.gbdr}`, borderRadius: 8,
                    padding: '12px 14px', fontSize: 11, fontFamily: mn, color: gv.tx,
                    overflow: 'auto', lineHeight: 1.7, margin: 0,
                  }}>{`{
  "content_id":          "550e8400-e29b-41d4-a716-446655440000",
  "platform":            "twitter",
  "title":               "First 60 chars of text used as a short title…",
  "text":                "Full post content goes here.",
  "media_urls":          [],
  "scheduled_at":        1710000000,
  "published_at_request": 1710001234,
  "board_id":            "(Pinterest only)",
  "channel":             "(Slack / Discord only)",
  "extra":               {}
}`}</pre>
                  <div style={{ fontSize: 10, color: gv.td, marginTop: 8 }}>
                    Tip: In n8n, use a <strong style={{ color: gv.ts }}>Switch</strong> node on <code style={{ background: 'rgba(255,255,255,.07)', padding: '1px 4px', borderRadius: 3 }}>{'{{$json.platform}}'}</code> to route each platform to its own branch.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════ GENERAL ═══════════════════════════════ */}
        {tab === 'general' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {!generalLoaded && (
              <div style={{ padding: '20px 0', textAlign: 'center', color: gv.td, fontSize: 13 }}>{t('settings.general.loading', 'Loading settings…')}</div>
            )}
            {generalLoaded && (<>

              {/* ── Section label helper ── */}
              {/* Section: Default AI Model */}
              <div style={{ paddingTop: 4, paddingBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: gv.td, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Default AI Model</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {/* Provider */}
                  <select
                    value={defaultProvider}
                    onChange={e => { setDefaultProvider(e.target.value); setDefaultModel('') }}
                    style={{ ...selectStyle, flex: 1, minWidth: 0 }}
                  >
                    <option value="">— Select provider —</option>
                    {generalProviders.map(p => (
                      <option key={p.key} value={p.key}>{p.name}</option>
                    ))}
                  </select>
                  {/* Model */}
                  <select
                    value={defaultModel}
                    onChange={e => setDefaultModel(e.target.value)}
                    style={{ ...selectStyle, flex: 1, minWidth: 0 }}
                    disabled={!defaultProvider}
                  >
                    <option value="">— Select model —</option>
                    {(generalProviders.find(p => p.key === defaultProvider)?.models ?? []).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setTab('ai')}
                    style={{ flexShrink: 0, background: 'none', border: `1px solid ${gv.gbdr}`, borderRadius: 6, color: gv.td, cursor: 'pointer', padding: '6px 10px', fontSize: 11, whiteSpace: 'nowrap' }}
                    title="Go to AI Providers"
                  >AI Providers →</button>
                </div>
                <div style={{ fontSize: 10, color: gv.td, marginTop: 6 }}>
                  Applied to all newly created agents unless overridden per agent.
                </div>
              </div>

              <div style={{ height: 1, background: gv.gbdr, margin: '4px 0 12px' }} />

              {/* Section: Default Image Model */}
              <div style={{ paddingBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: gv.td, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Default Image Model</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    value={activeImageModelId}
                    onChange={e => setActiveImageModelId(e.target.value)}
                    style={{ ...selectStyle, flex: 1, minWidth: 0 }}
                    disabled={imageModels.length === 0}
                  >
                    {imageModels.length === 0
                      ? <option value="">— No image models configured —</option>
                      : <>
                          <option value="">— Select active model —</option>
                          {imageModels.map(m => (
                            <option key={m.id} value={m.id}>{m.name}{m.hasKey ? '' : ' (no key)'}</option>
                          ))}
                        </>
                    }
                  </select>
                  <button
                    onClick={() => setTab('image')}
                    style={{ flexShrink: 0, background: 'none', border: `1px solid ${gv.gbdr}`, borderRadius: 6, color: gv.td, cursor: 'pointer', padding: '6px 10px', fontSize: 11, whiteSpace: 'nowrap' }}
                  >Image Model →</button>
                </div>
                {imageModels.length === 0 && (
                  <div style={{ fontSize: 10, color: gv.td, marginTop: 6 }}>
                    No image models configured. Go to the Image Model tab to add one.
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: gv.gbdr, margin: '4px 0 12px' }} />

              {/* Section: Publish Gateway */}
              <div style={{ paddingBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: gv.td, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Publish Gateway</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Toggle on={publishEnabled} onChange={setPublishEnabled} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: gv.tx }}>
                      Route publishing via n8n webhook
                    </div>
                    <div style={{ fontSize: 11, color: gv.td, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 3, background: genN8nConfigured ? gv.gr : gv.td, display: 'inline-block', flexShrink: 0 }} />
                      {genN8nConfigured ? 'Webhook URL configured' : 'No webhook URL set — configure below'}
                    </div>
                  </div>
                  <button
                    onClick={() => setTab('n8n')}
                    style={{ flexShrink: 0, background: 'none', border: `1px solid ${gv.gbdr}`, borderRadius: 6, color: gv.td, cursor: 'pointer', padding: '6px 10px', fontSize: 11, whiteSpace: 'nowrap' }}
                  >Publish API →</button>
                </div>
                {!publishEnabled && (
                  <div style={{ marginTop: 8, padding: '7px 10px', background: `${gv.yl}12`, border: `1px solid ${gv.yl}30`, borderRadius: 6, fontSize: 11, color: gv.yl }}>
                    Publish is disabled — content will be marked as published locally without calling the webhook.
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: gv.gbdr, margin: '4px 0 12px' }} />

              {/* Section: Web Search */}
              <div style={{ paddingBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: gv.td, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Web Search</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: gv.tx }}>Search provider</div>
                    <div style={{ fontSize: 11, color: gv.td, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 3, background: genTavilyConfigured ? gv.gr : gv.td, display: 'inline-block', flexShrink: 0 }} />
                      {genTavilyConfigured
                        ? 'Tavily configured — used as primary search provider'
                        : 'Tavily not configured — falling back to Bing / DuckDuckGo'}
                    </div>
                  </div>
                  <button
                    onClick={() => setTab('search')}
                    style={{ flexShrink: 0, background: 'none', border: `1px solid ${gv.gbdr}`, borderRadius: 6, color: gv.td, cursor: 'pointer', padding: '6px 10px', fontSize: 11, whiteSpace: 'nowrap' }}
                  >Web Search →</button>
                </div>
              </div>

              <div style={{ height: 1, background: gv.gbdr, margin: '4px 0 12px' }} />

              {/* Section: RSS Auto-sync */}
              <div style={{ paddingBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: gv.td, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>RSS Auto-sync</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: gv.tx }}>Background sync interval</div>
                    <div style={{ fontSize: 11, color: gv.td, marginTop: 2 }}>Feeds are fetched and embedded on this schedule</div>
                  </div>
                  <select
                    value={rssSyncInterval}
                    onChange={e => setRssSyncInterval(Number(e.target.value))}
                    style={{ ...selectStyle, minWidth: 110 }}
                  >
                    {[1, 2, 4, 6, 12, 24].map(h => (
                      <option key={h} value={h}>Every {h}h</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setTab('rss')}
                    style={{ flexShrink: 0, background: 'none', border: `1px solid ${gv.gbdr}`, borderRadius: 6, color: gv.td, cursor: 'pointer', padding: '6px 10px', fontSize: 11, whiteSpace: 'nowrap' }}
                  >RSS Feeds →</button>
                </div>
              </div>

              <div style={{ height: 1, background: gv.gbdr, margin: '4px 0 16px' }} />

              {/* Language */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${gv.gbdr}` }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{t('settings.general.language_title', 'Language')}</div>
                  <div style={{ fontSize: 11, color: gv.td, marginTop: 2 }}>{t('settings.general.language')}</div>
                </div>
                <select value={language} onChange={e => {
                  setLanguage(e.target.value)
                  void i18n.changeLanguage(e.target.value)
                }} style={selectStyle}>
                  <option value="en">English</option>
                  <option value="zh-CN">中文 (简体)</option>
                </select>
              </div>

              {/* Notifications */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${gv.gbdr}` }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{t('settings.general.notifications_title', 'Notifications')}</div>
                  <div style={{ fontSize: 11, color: gv.td, marginTop: 2 }}>{t('settings.general.notifications')}</div>
                </div>
                <select value={notifications} onChange={e => setNotifications(e.target.value)} style={selectStyle}>
                  <option value="all">{t('settings.general.notifications_all', 'All')}</option>
                  <option value="important">{t('settings.general.notifications_important', 'Important only')}</option>
                  <option value="none">{t('settings.general.notifications_none', 'None')}</option>
                </select>
              </div>

              {/* Save */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, paddingTop: 16 }}>
                {generalSaveMsg && (
                  <span style={{ fontSize: 12, color: generalSaveMsg.ok ? gv.gr : gv.rd }}>
                    {generalSaveMsg.ok ? '✓ ' : '✗ '}{generalSaveMsg.text}
                  </span>
                )}
                <Button primary sm onClick={() => void saveGeneral()} disabled={generalSaving}>
                  {generalSaving ? t('settings.general.saving') : t('settings.general.save')}
                </Button>
              </div>
            </>)}
          </div>
        )}

        {/* ═══════════════════════════════ AI PROVIDERS ═════════════════════════ */}
        {tab === 'ai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* ── Configured providers (dynamic from backend) ── */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: gv.td, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t('settings.ai.configured', 'Configured Providers')}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {detectLocalMsg && (
                    <span style={{ fontSize: 11, color: detectLocalMsg.startsWith('✓') ? gv.gr : gv.td }}>{detectLocalMsg}</span>
                  )}
                  <Button sm onClick={() => void handleDetectLocal()} disabled={detectingLocal}>
                    {detectingLocal ? t('settings.ai.scanning', 'Scanning…') : `🔍 ${t('settings.ai.detect_local', 'Detect Local')}`}
                  </Button>
                  <Button sm onClick={() => void handleTestAllModels()} disabled={llmProvidersDetail.length === 0}>
                    Test All Models
                  </Button>
                  <Button sm onClick={() => { setAddingProvider(!addingProvider); setAddPreset(''); setAddKey(''); setAddApiKey(''); setAddBaseURL(''); setAddModels('') }}>
                    <Ic.Plus /> {t('settings.ai.add_provider', 'Add Provider')}
                  </Button>
                </div>
              </div>

              {/* Add Provider Form */}
              {addingProvider && (
                <div style={{ marginBottom: 14, padding: 14, background: 'rgba(255,255,255,.02)', borderRadius: 10, border: `1px solid ${gv.cbdr}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: gv.td, textTransform: 'uppercase', letterSpacing: '.05em' }}>{t('settings.ai.add_title', 'Add / Reconfigure Provider')}</div>
                  <select
                    value={addPreset}
                    onChange={e => {
                      const preset = PROVIDER_PRESETS.find(p => p.key === e.target.value)
                      setAddPreset(e.target.value)
                      setAddKey(e.target.value)
                      setAddBaseURL(preset?.baseURL ?? '')
                    }}
                    style={selectStyle}
                  >
                    <option value="">— Select preset —</option>
                    {PROVIDER_PRESETS.map(p => <option key={p.key || 'custom'} value={p.key}>{p.label}</option>)}
                  </select>
                  {addPreset === '' && (
                    <input type="text" placeholder="Provider key (e.g. my-llm)" value={addKey}
                      onChange={e => setAddKey(e.target.value)} style={inputStyle} />
                  )}
                  <input
                    type="password"
                    placeholder={addPreset === 'ollama' ? 'API Key (leave blank for local)' : 'API Key'}
                    value={addApiKey}
                    onChange={e => setAddApiKey(e.target.value)}
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    placeholder="Base URL (leave blank for default)"
                    value={addBaseURL}
                    onChange={e => setAddBaseURL(e.target.value)}
                    style={{ ...inputStyle, fontSize: 12, fontFamily: mn }}
                  />
                  <input
                    type="text"
                    placeholder="Models (comma-separated, e.g. gpt-4o,gpt-4o-mini) — leave blank for default"
                    value={addModels}
                    onChange={e => setAddModels(e.target.value)}
                    style={{ ...inputStyle, fontSize: 12, fontFamily: mn }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <Button sm onClick={() => setAddingProvider(false)}>Cancel</Button>
                    <Button primary sm onClick={() => void handleAddProvider()}>Save Provider</Button>
                  </div>
                </div>
              )}

              {providersLoading ? (
                <div style={{ padding: '18px 16px', background: 'rgba(255,255,255,.02)', borderRadius: 10, border: `1px dashed ${gv.gbdr}`, color: gv.td, fontSize: 12, textAlign: 'center' }}>
                  Loading providers…
                </div>
              ) : !isElectron ? (
                <div style={{ padding: '18px 16px', background: `rgba(240,160,48,.06)`, borderRadius: 10, border: `1px dashed ${gv.am}40`, color: gv.td, fontSize: 12, textAlign: 'center', lineHeight: 1.7 }}>
                  <span style={{ color: gv.am, fontWeight: 700 }}>Running in browser preview</span><br />
                  Provider list is only available in the Electron app.<br />
                  Configured providers (e.g. Bailian) will appear here when running the desktop app.
                </div>
              ) : llmProvidersDetail.length === 0 ? (
                <div style={{ padding: '18px 16px', background: 'rgba(255,255,255,.02)', borderRadius: 10, border: `1px dashed ${gv.gbdr}`, color: gv.td, fontSize: 12, textAlign: 'center' }}>
                  No LLM providers configured yet. Click "Add Provider" to add one.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {llmProvidersDetail.map((p, i) => {
                    const c = p.key === 'claude' ? gv.ac : p.key === 'ollama' ? gv.cc : p.key === 'deepseek' ? gv.td : gv.gr
                    return (
                      <div key={p.key}>
                        <div style={{ ...rowStyle(i), padding: '12px 16px' }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${c}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c, fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                            {p.key[0]?.toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                            {p.baseURL && <div style={{ fontSize: 10, color: gv.td, fontFamily: mn, marginTop: 2 }}>{p.baseURL}</div>}
                            {p.apiKey && p.apiKey !== 'placeholder' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                <span style={{ fontSize: 10, color: gv.td, fontFamily: mn, userSelect: 'all', cursor: 'text', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.apiKey}</span>
                                <button onClick={() => void navigator.clipboard.writeText(p.apiKey)} style={{ background: 'none', border: 'none', color: gv.td, cursor: 'pointer', padding: '0 2px', fontSize: 10, lineHeight: 1 }} title="Copy key">⎘</button>
                              </div>
                            )}
                            {p.models && p.models.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                                {p.models.map(m => {
                                  const tr = modelTestResults[`${p.key}::${m}`]
                                  const lr = loopTestResults[`${p.key}::${m}`]
                                  return (
                                    <span key={m} style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: `${c}14`, color: c, fontFamily: mn, display: 'flex', alignItems: 'center', gap: 4 }}>
                                      {m}
                                      {tr && (
                                        <span style={{ color: tr.testing ? gv.td : tr.ok ? gv.gr : gv.rd, fontFamily: 'inherit' }}>
                                          {tr.testing ? '…' : tr.ok ? '✓' : '✗'}
                                        </span>
                                      )}
                                      <button
                                        onClick={() => void handleTestLoopModel(p.key, m)}
                                        title="Test Agent Loop (schedule_post)"
                                        style={{ background: lr ? (lr.testing ? 'rgba(255,255,255,.1)' : lr.ok ? 'rgba(0,200,100,.18)' : 'rgba(255,80,80,.18)') : 'rgba(255,255,255,.08)', border: 'none', borderRadius: 3, color: lr ? (lr.testing ? gv.td : lr.ok ? gv.gr : gv.rd) : gv.td, cursor: 'pointer', fontSize: 8, fontWeight: 700, padding: '1px 4px', lineHeight: 1.4, fontFamily: 'inherit' }}
                                      >
                                        {lr?.testing ? '⟳' : 'Loop'}
                                      </button>
                                    </span>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,.07)', color: gv.td, textTransform: 'uppercase', letterSpacing: '.05em' }}>Configured</span>
                          <Button sm onClick={() => { setConfiguringProvider(configuringProvider === p.key ? null : p.key); setApiKeyInput(''); setBaseURLInput(p.baseURL ?? '') }}>
                            <Ic.Gear />
                          </Button>
                          <button
                            onClick={() => void handleRemoveProvider(p.key)}
                            style={{ background: 'none', border: 'none', color: gv.rd, cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center' }}
                            title={`Remove ${p.key}`}
                          >
                            <Ic.Trash />
                          </button>
                        </div>
                        {/* Per-model test error details */}
                        {p.models.some(m => (modelTestResults[`${p.key}::${m}`] && !modelTestResults[`${p.key}::${m}`].testing) || (loopTestResults[`${p.key}::${m}`] && !loopTestResults[`${p.key}::${m}`].testing)) && (
                          <div style={{ marginLeft: 48, marginBottom: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {p.models.map(m => {
                              const tr = modelTestResults[`${p.key}::${m}`]
                              const lr = loopTestResults[`${p.key}::${m}`]
                              const showTr = tr && !tr.testing
                              const showLr = lr && !lr.testing
                              if (!showTr && !showLr) return null
                              return (
                                <div key={m} style={{ fontSize: 10, fontFamily: mn, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                  {showTr && <span style={{ color: tr.ok ? gv.gr : gv.rd }}>{m} [test]: {tr.msg}</span>}
                                  {showLr && <span style={{ color: lr.ok ? gv.gr : gv.rd }}>{m} [loop]: {lr.msg}</span>}
                                </div>
                              )
                            })}
                          </div>
                        )}
                        {configuringProvider === p.key && (
                          <div style={{ marginLeft: 48, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'rgba(255,255,255,.02)', borderRadius: 8, border: `1px solid ${gv.cbdr}` }}>
                            <input
                              type="password"
                              placeholder={p.key === 'ollama' ? 'API Key (leave blank for local)' : `Enter new API Key for ${p.name}`}
                              value={apiKeyInput}
                              onChange={e => setApiKeyInput(e.target.value)}
                              style={inputStyle}
                            />
                            <input
                              type="text"
                              placeholder="Base URL — leave blank to keep current"
                              value={baseURLInput}
                              onChange={e => setBaseURLInput(e.target.value)}
                              style={{ ...inputStyle, fontSize: 12, fontFamily: mn }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                              <Button sm onClick={() => setConfiguringProvider(null)}>Cancel</Button>
                              <Button primary sm onClick={() => void handleConfigure(p.key)}>Update Key</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── Provider notes ── */}
            <div style={{ padding: '10px 14px', background: 'rgba(123,92,255,.06)', border: `1px solid ${gv.cc}20`, borderRadius: 8, fontSize: 11, color: gv.td, lineHeight: 1.6 }}>
              <span style={{ color: gv.cc, fontWeight: 700 }}>Supported presets:</span> Claude (Anthropic) · OpenAI · Bailian/DashScope (Aliyun) · DeepSeek · Ollama · LM Studio · Codex · any OpenAI-compatible API.
              <br />Click <strong style={{ color: gv.tx }}>🔍 Detect Local</strong> to auto-scan for Ollama, LM Studio, Claude Code CLI, and Codex CLI configs.
              <br />Keys are encrypted with the OS keychain and persist across restarts.
            </div>

          </div>
        )}

        {/* ══════════════════════════ WEB SEARCH ═════════════════════════════════ */}
        {tab === 'search' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Web Search</div>
              <div style={{ fontSize: 12, color: gv.td }}>Configure search providers used by agents when browsing the web for content ideas and research.</div>
            </div>

            {/* Tavily */}
            <div style={{ padding: '16px 18px', background: 'rgba(255,255,255,.02)', borderRadius: 10, border: `1px solid ${gv.gbdr}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 5, background: tavilyHasKey ? gv.gr : gv.td, flexShrink: 0 }} />
                <div style={{ fontSize: 14, fontWeight: 700 }}>Tavily Search API</div>
                <span style={{ fontSize: 11, color: tavilyHasKey ? gv.gr : gv.td, marginLeft: 2 }}>{tavilyHasKey ? 'Configured' : 'Not configured'}</span>
              </div>
              <div style={{ fontSize: 12, color: gv.td, lineHeight: 1.6 }}>
                Provides higher-quality, real-time web search results for agents. Without it, agents fall back to DuckDuckGo → Wikipedia automatically.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: gv.td, textTransform: 'uppercase', letterSpacing: '.05em' }}>API Key</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={tavilyKey}
                    onChange={e => setTavilyKey(e.target.value)}
                    placeholder="tvly-..."
                    style={{ ...inputStyle, flex: 1, fontFamily: tavilyKey ? mn : 'inherit' }}
                  />
                  {tavilyKey && (
                    <button onClick={() => void navigator.clipboard.writeText(tavilyKey)} style={{ background: 'rgba(255,255,255,.06)', border: `1px solid ${gv.gbdr}`, borderRadius: 6, color: gv.td, cursor: 'pointer', padding: '6px 10px', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>⎘ Copy</button>
                  )}
                  <Button primary sm onClick={() => void handleTavilySave()} disabled={tavilySaving || !tavilyKey.trim()}>
                    {tavilySaving ? 'Saving…' : 'Save'}
                  </Button>
                  {tavilyHasKey && (
                    <Button sm onClick={() => void handleTavilyRemove()} disabled={tavilySaving} sx={{ color: gv.rd, borderColor: `${gv.rd}40` }}>
                      Remove
                    </Button>
                  )}
                  {tavilyMsg && (
                    <span style={{ fontSize: 12, color: tavilyMsg.ok ? gv.gr : gv.rd }}>{tavilyMsg.text}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Fallback info */}
            <div style={{ padding: '10px 14px', background: `rgba(123,92,255,.06)`, border: `1px solid ${gv.cc}20`, borderRadius: 8, fontSize: 11, color: gv.td, lineHeight: 1.6 }}>
              <span style={{ color: gv.cc, fontWeight: 700 }}>Search priority:</span> Tavily (if key set) → DuckDuckGo → Wikipedia.<br />
              Keys are encrypted and stored locally. Get a free Tavily key at <span style={{ color: gv.cc }}>tavily.com</span>.
            </div>
          </div>
        )}

        {/* ═══════════════════════════════ KNOWLEDGE ════════════════════════════ */}
        {tab === 'knowledge' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{t('settings.knowledge.title', 'Brand Knowledge Base')}</div>
                <div style={{ fontSize: 12, color: gv.td, marginTop: 4 }}>{t('settings.knowledge.desc', 'Add style guides, product catalogs, and operating procedures here for AI contextual retrieval (RAG).')}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, background: 'rgba(255,255,255,.02)', borderRadius: 12, border: `1px solid ${gv.gbdr}` }}>
              <input
                placeholder={t('settings.knowledge.doc_title_placeholder', 'Document Title (e.g. Acme Corp Brand Guidelines 2026)')}
                value={newDocTitle}
                onChange={e => setNewDocTitle(e.target.value)}
                style={{ padding: '10px 12px', background: 'rgba(255,255,255,.04)', border: `1px solid ${gv.gbdr}`, borderRadius: 8, color: gv.tx, fontSize: 13, outline: 'none' }}
              />
              <textarea
                placeholder={t('settings.knowledge.doc_content_placeholder', 'Paste the document text here...')}
                value={newDocContent}
                onChange={e => setNewDocContent(e.target.value)}
                rows={4}
                style={{ padding: '10px 12px', background: 'rgba(255,255,255,.04)', border: `1px solid ${gv.gbdr}`, borderRadius: 8, color: gv.tx, fontSize: 13, outline: 'none', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button primary sm onClick={handleAddDocument} disabled={isAddingDoc || !newDocTitle || !newDocContent}>
                  <Ic.Plus /> {isAddingDoc ? t('settings.knowledge.ingesting', 'Ingesting...') : t('settings.knowledge.ingest_btn', 'Ingest Document')}
                </Button>
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: gv.td, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>{t('settings.knowledge.ingested_docs', 'Ingested Documents')}</div>
              {knowledgeDocs.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: gv.td, fontSize: 13, border: `1px dashed ${gv.gbdr}`, borderRadius: 8 }}>
                  {t('settings.knowledge.no_docs_yet', 'No knowledge documents added yet.')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {knowledgeDocs.map(doc => (
                    <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'rgba(0,0,0,.2)', border: `1px solid ${gv.cbdr}`, borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ color: gv.cc }}><Ic.File /></div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{doc.title}</div>
                          <div style={{ fontSize: 10, color: gv.td, marginTop: 2 }}>{new Date(doc.addedAt).toLocaleString()} · {doc.content.length} characters</div>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteDocument(doc.id)} style={{ background: 'none', border: 'none', color: gv.rd, cursor: 'pointer', padding: 8 }}>
                        <Ic.Trash />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════ RSS FEEDS ═══════════════════════════════ */}
        {tab === 'rss' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{t('settings.rss.title', 'RSS Feed Sources')}</div>
                <div style={{ fontSize: 12, color: gv.td, marginTop: 4 }}>
                  {t('settings.rss.desc_prefix', 'Saved feeds power the')} <code style={{ background: 'rgba(255,255,255,.06)', padding: '1px 5px', borderRadius: 4, fontFamily: mn }}>rss_reader</code> {t('settings.rss.desc_suffix', 'tool when agents use')} <code style={{ background: 'rgba(255,255,255,.06)', padding: '1px 5px', borderRadius: 4, fontFamily: mn }}>url="@saved"</code>.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {rssMsg && <span style={{ fontSize: 11, color: rssMsg.startsWith('✓') ? gv.gr : gv.rd }}>{rssMsg}</span>}
                <Button sm onClick={() => void handleImportOPML()} disabled={rssImporting}>
                  {rssImporting ? t('settings.rss.importing', 'Importing…') : `📥 ${t('settings.rss.import_opml', 'Import OPML')}`}
                </Button>
                <Button sm onClick={() => void handleExportOPML()} disabled={rssExporting || rssFeeds.length === 0}>
                  {rssExporting ? '导出中…' : '📤 Export OPML'}
                </Button>
                <Button sm onClick={() => setRssAdding(!rssAdding)}>
                  <Ic.Plus /> {t('settings.rss.add_feed', 'Add Feed')}
                </Button>
              </div>
            </div>

            {/* Local store sync status + interval */}
            <div style={{ padding: '12px 16px', background: 'rgba(123,92,255,.06)', borderRadius: 10, border: `1px solid rgba(123,92,255,.2)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: gv.cc }}>本地向量索引</div>
                {rssSyncStats ? (
                  <div style={{ fontSize: 11, color: gv.td }}>
                    已存 <span style={{ color: gv.tx, fontWeight: 600 }}>{rssSyncStats.total}</span> 篇文章，已向量化 <span style={{ color: gv.gr, fontWeight: 600 }}>{rssSyncStats.embedded}</span> 篇
                    {rssSyncStats.total > 0 && rssSyncStats.embedded === 0 && (
                      <span style={{ color: gv.yl }}> · 需要 Ollama nomic-embed-text</span>
                    )}
                    {rssSyncStats.lastFetchedAt && (
                      <span> · 最近同步 {new Date(rssSyncStats.lastFetchedAt * 1000).toLocaleString()}</span>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: gv.td }}>暂无数据 · 添加订阅源后点击同步</div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: gv.td, whiteSpace: 'nowrap' }}>自动同步</span>
                  <select
                    value={rssSyncInterval}
                    onChange={e => void handleRssSyncIntervalChange(Number(e.target.value))}
                    style={{ ...selectStyle, minWidth: 80, fontSize: 11, padding: '4px 8px' }}
                  >
                    <option value={1}>每 1 小时</option>
                    <option value={2}>每 2 小时</option>
                    <option value={4}>每 4 小时</option>
                    <option value={6}>每 6 小时</option>
                    <option value={12}>每 12 小时</option>
                    <option value={24}>每 24 小时</option>
                  </select>
                </div>
                <Button sm primary onClick={() => void handleRssSyncNow()} disabled={rssSyncing || rssFeeds.length === 0}>
                  {rssSyncing ? '同步中…' : '立即同步'}
                </Button>
              </div>
            </div>

            {/* Add Feed form */}
            {rssAdding && (
              <div style={{ padding: 14, background: 'rgba(255,255,255,.02)', borderRadius: 10, border: `1px solid ${gv.cbdr}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: gv.td, textTransform: 'uppercase', letterSpacing: '.05em' }}>{t('settings.rss.add_feed_title', 'Add RSS Feed Source')}</div>
                <input
                  type="text"
                  placeholder={t('settings.rss.feed_title_placeholder', 'Feed title (e.g. TechCrunch)')}
                  value={rssAddTitle}
                  onChange={e => setRssAddTitle(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="url"
                  placeholder={t('settings.rss.feed_url_placeholder', 'Feed URL (e.g. https://techcrunch.com/feed/)')}
                  value={rssAddUrl}
                  onChange={e => setRssAddUrl(e.target.value)}
                  style={{ ...inputStyle, fontFamily: mn, fontSize: 12 }}
                />
                <input
                  type="text"
                  placeholder={t('settings.rss.feed_category_placeholder', 'Category (e.g. Tech, Finance, AI) — optional')}
                  value={rssAddCategory}
                  onChange={e => setRssAddCategory(e.target.value)}
                  style={inputStyle}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <Button sm onClick={() => setRssAdding(false)}>{t('settings.general.cancel', 'Cancel')}</Button>
                  <Button primary sm onClick={() => void handleAddFeed()} disabled={!rssAddUrl.trim()}>{t('settings.rss.save_feed', 'Save Feed')}</Button>
                </div>
              </div>
            )}

            {/* Feed list */}
            {rssFeeds.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: gv.td, fontSize: 13, border: `1px dashed ${gv.gbdr}`, borderRadius: 10 }}>
                {t('settings.rss.no_feeds_yet', 'No RSS feed sources yet. Add feeds manually or import an OPML file from your RSS reader.')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {rssFeeds.map((feed, i) => (
                  <div key={feed.id} style={{ ...rowStyle(i), padding: '12px 4px' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 7, background: `${gv.am}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: gv.am, flexShrink: 0 }}>
                      <Ic.Bar />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{feed.title}</div>
                      <div style={{ fontSize: 10, color: gv.td, fontFamily: mn, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{feed.url}</div>
                      <div style={{ marginTop: 4 }}>
                        <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: `${gv.am}14`, color: gv.am }}>{feed.category}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => void handleDeleteFeed(feed.id)}
                      style={{ background: 'none', border: 'none', color: gv.rd, cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center' }}
                    >
                      <Ic.Trash />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Info note */}
            <div style={{ padding: '10px 14px', background: 'rgba(240,160,48,.06)', border: `1px solid ${gv.am}20`, borderRadius: 8, fontSize: 11, color: gv.td, lineHeight: 1.6 }}>
              <span style={{ color: gv.am, fontWeight: 700 }}>{t('settings.rss.note_title', 'Using feeds in agents:')}</span> {t('settings.rss.note_body_1', 'When agents have the')} <strong style={{ color: gv.tx }}>rss_reader</strong> {t('settings.rss.note_body_2', 'skill selected, they can pull all saved feeds at once with')} <code style={{ background: 'rgba(255,255,255,.07)', padding: '1px 5px', borderRadius: 3, fontFamily: mn }}>url="@saved"</code>.
              <br />{t('settings.rss.note_body_3', 'Import your existing subscriptions by clicking')} <strong style={{ color: gv.tx }}>{t('settings.rss.import_opml', 'Import OPML')}</strong> {t('settings.rss.note_body_4', 'and selecting the file exported from your RSS reader.')}
            </div>

            {/* ── Synced Articles ──────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Section header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>已同步文章</div>
                {rssSyncStats && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: `${gv.cc}18`, color: gv.cc }}>{rssSyncStats.total}</span>
                )}
              </div>

              {/* Search + feed filter */}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="搜索文章标题或内容…"
                  value={rssItemsSearch}
                  onChange={e => setRssItemsSearch(e.target.value)}
                  style={{ ...inputStyle, flex: 1, fontSize: 12 }}
                />
                <select
                  value={rssItemsFeedId}
                  onChange={e => setRssItemsFeedId(e.target.value)}
                  style={{ ...selectStyle, fontSize: 12, minWidth: 120 }}
                >
                  <option value="">全部来源</option>
                  {rssFeeds.map(f => (
                    <option key={f.id} value={f.id}>{f.title}</option>
                  ))}
                </select>
              </div>

              {/* Article list */}
              {rssItemsLoading && (
                <div style={{ color: gv.td, fontSize: 12, padding: '12px 0' }}>加载中…</div>
              )}
              {!rssItemsLoading && rssItems.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: gv.td, fontSize: 12, border: `1px dashed ${gv.gbdr}`, borderRadius: 10 }}>
                  {rssSyncStats && rssSyncStats.total > 0 ? '没有匹配的文章' : '同步后文章将在此显示'}
                </div>
              )}
              {!rssItemsLoading && rssItems.map((item, i) => {
                const expanded = rssItemsExpanded.has(item.id)
                const preview = item.content?.slice(0, 150)
                const hasMore = (item.content?.length ?? 0) > 150
                const pubDate = item.pub_date ? new Date(item.pub_date).toLocaleString() : ''
                return (
                  <div key={item.id} style={{ ...rowStyle(i), alignItems: 'flex-start', padding: '12px 0', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.4 }}>{item.title || '(无标题)'}</div>
                        <div style={{ fontSize: 10, color: gv.td, marginTop: 2 }}>
                          {item.source || item.category} · {pubDate}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {item.embedded_at
                          ? <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 8, background: `${gv.gr}18`, color: gv.gr }}>● 已索引</span>
                          : <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 8, background: 'rgba(255,255,255,.06)', color: gv.td }}>○ 待索引</span>
                        }
                        {item.url && (
                          <a href={item.url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: gv.cc, textDecoration: 'none' }}>原文 ↗</a>
                        )}
                      </div>
                    </div>
                    {preview && (
                      <div style={{ fontSize: 12, color: gv.ts, lineHeight: 1.6, paddingLeft: 0 }}>
                        {expanded ? item.content : preview}
                        {hasMore && (
                          <button
                            onClick={() => setRssItemsExpanded(prev => {
                              const next = new Set(prev)
                              if (expanded) next.delete(item.id)
                              else next.add(item.id)
                              return next
                            })}
                            style={{ background: 'none', border: 'none', color: gv.cc, cursor: 'pointer', fontSize: 11, marginLeft: 4, padding: 0 }}
                          >
                            {expanded ? '收起' : '…展开'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════ IMAGE MODEL ══════════════════════════ */}
        {tab === 'image' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Image Models</div>
                <div style={{ fontSize: 12, color: gv.td, marginTop: 4 }}>
                  Configure multiple image generation endpoints. API keys are encrypted and stored locally.
                </div>
              </div>
              <Button primary sm onClick={() => { setImageAddOpen(true); setImageAddPreset('') }}>
                <Ic.Plus /> Add Model
              </Button>
            </div>

            {/* Configured models list */}
            {imageModels.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: gv.td, fontSize: 13, border: `1px dashed ${gv.gbdr}`, borderRadius: 8 }}>
                No image models configured. Click <strong>Add Model</strong> to get started.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {imageModels.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: activeImageModelId === m.id ? `${gv.cc}0d` : 'rgba(255,255,255,.03)', border: `1px solid ${activeImageModelId === m.id ? gv.cc + '40' : gv.gbdr}`, borderRadius: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, flexShrink: 0, background: m.hasKey ? gv.gr : gv.yl }} title={m.hasKey ? 'API key set' : 'No API key'} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: gv.td, fontFamily: mn, marginTop: 2 }}>{m.baseURL} · {m.model}</div>
                    </div>
                    {activeImageModelId === m.id && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: gv.cc, background: `${gv.cc}18`, padding: '2px 7px', borderRadius: 4 }}>Active</span>
                    )}
                    <button
                      onClick={() => { setActiveImageModelId(m.id); void window.electronAPI?.settings?.set('activeImageModelId', m.id) }}
                      disabled={activeImageModelId === m.id}
                      style={{ background: 'none', border: `1px solid ${gv.gbdr}`, color: activeImageModelId === m.id ? gv.td : gv.tx, cursor: activeImageModelId === m.id ? 'default' : 'pointer', padding: '4px 10px', borderRadius: 5, fontSize: 11 }}
                    >
                      {activeImageModelId === m.id ? '✓ Active' : 'Set Active'}
                    </button>
                    <button onClick={() => void handleImageRemove(m.id, m.name)} style={{ background: 'none', border: 'none', color: gv.rd, cursor: 'pointer', padding: 6 }}><Ic.Trash /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Add model form */}
            {imageAddOpen && (
              <div style={{ padding: 16, background: 'rgba(255,255,255,.02)', border: `1px solid ${gv.gbdr}`, borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: gv.td, textTransform: 'uppercase', letterSpacing: '.05em' }}>Add Image Model</div>

                {/* Preset picker */}
                <select
                  value={imageAddPreset}
                  onChange={e => {
                    const p = IMAGE_PRESETS.find(x => x.id === e.target.value)
                    if (p) {
                      setImageAddPreset(p.id)
                      setImageAddId(p.id)
                      setImageAddName(p.name)
                      setImageAddBaseURL(p.baseURL)
                      setImageAddModel(p.model)
                    } else {
                      setImageAddPreset('')
                    }
                  }}
                  style={{ ...selectStyle, width: '100%' }}
                >
                  <option value="">— Choose a preset or fill manually —</option>
                  {IMAGE_PRESETS.map(p => <option key={p.id || 'custom'} value={p.id}>{p.label}</option>)}
                </select>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: gv.td, marginBottom: 4 }}>ID (unique key)</div>
                    <input value={imageAddId} onChange={e => setImageAddId(e.target.value)} placeholder="my-model-id" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', fontFamily: mn }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: gv.td, marginBottom: 4 }}>Display Name</div>
                    <input value={imageAddName} onChange={e => setImageAddName(e.target.value)} placeholder="302.ai · Kling v1" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: gv.td, marginBottom: 4 }}>Base URL</div>
                    <input value={imageAddBaseURL} onChange={e => setImageAddBaseURL(e.target.value)} placeholder="https://api.302.ai" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', fontFamily: mn }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: gv.td, marginBottom: 4 }}>Model ID</div>
                    <input value={imageAddModel} onChange={e => setImageAddModel(e.target.value)} placeholder="kling-v1" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', fontFamily: mn }} />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: gv.td, marginBottom: 4 }}>API Key <span style={{ fontWeight: 400 }}>(optional — can be added later)</span></div>
                  <input type="text" value={imageAddApiKey} onChange={e => setImageAddApiKey(e.target.value)} placeholder="sk-…" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', fontFamily: mn }} />
                </div>

                {imageMsg && <div style={{ fontSize: 12, color: imageMsg.ok ? gv.gr : gv.rd }}>{imageMsg.text}</div>}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Button sm onClick={() => { setImageAddOpen(false); setImageMsg(null) }}>Cancel</Button>
                  <Button primary sm onClick={() => void handleImageAdd()} disabled={imageAdding}>
                    {imageAdding ? 'Adding…' : 'Add Model'}
                  </Button>
                </div>
              </div>
            )}

            {!imageAddOpen && imageMsg && (
              <div style={{ fontSize: 12, color: imageMsg.ok ? gv.gr : gv.rd }}>{imageMsg.text}</div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════ MCP ══════════════════════════════════ */}
        {tab === 'mcp' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{t('settings.mcp.title', 'MCP Servers')}</div>
              <div style={{ fontSize: 12, color: gv.td, marginTop: 4 }}>{t('settings.mcp.desc', 'Manage Model Context Protocol servers. Config saved to ~/.autosocialx/mcp_servers.json')}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14, background: 'rgba(255,255,255,.02)', borderRadius: 10, border: `1px solid ${gv.gbdr}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: gv.td, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{t('settings.mcp.add_server', 'Add Server')}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input placeholder={t('settings.mcp.name_placeholder', 'Server name (e.g. filesystem)')} value={mcpForm.name} onChange={e => setMcpForm(f => ({ ...f, name: e.target.value }))}
                  style={{ flex: 1, padding: '8px 10px', background: 'rgba(255,255,255,.05)', border: `1px solid ${gv.gbdr}`, borderRadius: 6, color: gv.tx, fontSize: 12, outline: 'none', fontFamily: mn }} />
                <input placeholder={t('settings.mcp.command_placeholder', 'Command (e.g. npx)')} value={mcpForm.command} onChange={e => setMcpForm(f => ({ ...f, command: e.target.value }))}
                  style={{ flex: 1, padding: '8px 10px', background: 'rgba(255,255,255,.05)', border: `1px solid ${gv.gbdr}`, borderRadius: 6, color: gv.tx, fontSize: 12, outline: 'none', fontFamily: mn }} />
              </div>
              <input placeholder={t('settings.mcp.args_placeholder', 'Args JSON array (e.g. ["-y","@modelcontextprotocol/server-filesystem","/tmp"])')} value={mcpForm.args} onChange={e => setMcpForm(f => ({ ...f, args: e.target.value }))}
                style={{ padding: '8px 10px', background: 'rgba(255,255,255,.05)', border: `1px solid ${gv.gbdr}`, borderRadius: 6, color: gv.tx, fontSize: 12, outline: 'none', fontFamily: mn }} />
              <input placeholder={t('settings.mcp.env_placeholder', 'Env JSON object (e.g. {"API_KEY":"xxx"}) — optional')} value={mcpForm.env} onChange={e => setMcpForm(f => ({ ...f, env: e.target.value }))}
                style={{ padding: '8px 10px', background: 'rgba(255,255,255,.05)', border: `1px solid ${gv.gbdr}`, borderRadius: 6, color: gv.tx, fontSize: 12, outline: 'none', fontFamily: mn }} />
              {mcpError && <div style={{ fontSize: 11, color: gv.rd }}>⚠ {mcpError}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button primary sm onClick={() => void handleAddMcpServer()} disabled={mcpAdding || !mcpForm.name || !mcpForm.command}>
                  <Ic.Plus /> {mcpAdding ? t('settings.mcp.connecting', 'Connecting…') : t('settings.mcp.add_connect', 'Add & Connect')}
                </Button>
              </div>
            </div>

            {mcpServers.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: gv.td, fontSize: 13, border: `1px dashed ${gv.gbdr}`, borderRadius: 8 }}>{t('settings.mcp.no_servers', 'No MCP servers configured.')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {mcpServers.map((s) => {
                  const tools = mcpExpandedTools[s.name]
                  const toolsOpen = tools !== undefined
                  const reconnecting = mcpReconnecting[s.name] ?? false
                  return (
                    <div key={s.name} style={{ background: 'rgba(0,0,0,.2)', border: `1px solid ${gv.cbdr}`, borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                        <div style={{ width: 8, height: 8, borderRadius: 4, background: s.connected ? gv.gr : gv.yl, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</div>
                          <div style={{ fontSize: 10, color: gv.td, fontFamily: mn, marginTop: 2 }}>{s.command} {s.args.join(' ')}</div>
                        </div>
                        <StatusBadge s={s.connected ? 'connected' : 'idle'} />
                        {s.connected && (
                          <button
                            onClick={() => void handleMcpToggleTools(s.name)}
                            style={{ background: 'none', border: `1px solid ${gv.gbdr}`, color: toolsOpen ? gv.cc : gv.td, cursor: 'pointer', padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700 }}
                          >
                            {toolsOpen ? '▲ Tools' : `▼ Tools`}
                          </button>
                        )}
                        {!s.connected && (
                          <Button sm onClick={() => void handleMcpReconnect(s.name)} disabled={reconnecting}>
                            {reconnecting ? '…' : '↺ Reconnect'}
                          </Button>
                        )}
                        <button onClick={() => void handleRemoveMcpServer(s.name)} style={{ background: 'none', border: 'none', color: gv.rd, cursor: 'pointer', padding: 6 }}><Ic.Trash /></button>
                      </div>
                      {toolsOpen && (
                        <div style={{ borderTop: `1px solid ${gv.gbdr}`, padding: '10px 14px', background: 'rgba(0,0,0,.15)' }}>
                          {tools === null ? (
                            <div style={{ fontSize: 11, color: gv.td }}>Loading tools…</div>
                          ) : tools.length === 0 ? (
                            <div style={{ fontSize: 11, color: gv.td }}>No tools reported by this server.</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {tools.map(tool => (
                                <div key={tool.name} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, fontFamily: mn, color: gv.cc }}>{tool.name}</span>
                                  {tool.description && <span style={{ fontSize: 10, color: gv.td, lineHeight: 1.4 }}>{tool.description}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════ SKILLS ═══════════════════════════════ */}
        {tab === 'skills' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{t('settings.skills.title', 'AI Skill Management')}</div>
              <div style={{ fontSize: 12, color: gv.td, marginTop: 4 }}>
                {t('settings.skills.desc', 'Enable or disable skill modules that are injected into the AI agent\'s system prompt. Disabled skills are invisible to the agent at runtime.')}
              </div>
            </div>

            {skillsLoading ? (
              <div style={{ padding: 32, textAlign: 'center', color: gv.td, fontSize: 13 }}>{t('settings.skills.loading', 'Loading skills…')}</div>
            ) : skills.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: gv.td, fontSize: 13, border: `1px dashed ${gv.gbdr}`, borderRadius: 8 }}>
                {t('settings.skills.no_skills', 'No skills found. Place SKILL.md files in')} <code style={{ fontFamily: mn, background: 'rgba(255,255,255,.08)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>electron/skills/</code>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {skills.map((skill) => {
                  const color = skillColor(skill.name)
                  return (
                    <div
                      key={skill.name}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                        background: skill.enabled ? 'rgba(0,0,0,.2)' : 'rgba(0,0,0,.1)',
                        border: `1px solid ${skill.enabled ? color + '30' : gv.gbdr}`,
                        borderRadius: 10, transition: 'border .2s',
                      }}
                    >
                      {/* Icon tag */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                        background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15, color,
                      }}>
                        ⚡
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{skill.name}</span>
                          <span style={{
                            fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em',
                            padding: '2px 6px', borderRadius: 4,
                            background: skill.enabled ? `${color}18` : 'rgba(255,255,255,.05)',
                            color: skill.enabled ? color : gv.td,
                          }}>
                            {skill.enabled ? t('settings.skills.active', 'Active') : t('settings.skills.disabled', 'Disabled')}
                          </span>
                        </div>
                        {skill.description && (
                          <div style={{ fontSize: 11.5, color: gv.td, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {skill.description}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Toggle on={skill.enabled} onChange={v => void handleSkillToggle(skill.name, v)} />
                        <button
                          onClick={() => void handleDeleteSkill(skill.name)}
                          style={{ background: 'none', border: 'none', color: gv.rd, cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Ic.Trash />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ padding: '12px 14px', background: 'rgba(123,92,255,.07)', border: `1px solid ${gv.cc}25`, borderRadius: 8, fontSize: 11.5, color: gv.td, lineHeight: 1.6 }}>
              <span style={{ color: gv.cc, fontWeight: 700 }}>{t('settings.skills.note_title', 'Note:')}</span> {t('settings.skills.note_body', 'Changes take effect immediately for new agent runs. Any currently running agent session will continue using the skills that were active when it started.')}
            </div>

            {/* Local Templates */}
            <div style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{t('settings.skills.local_template_title', 'Local Templates')}</div>
                  <div style={{ fontSize: 12, color: gv.td, marginTop: 4 }}>
                    {t('settings.skills.local_template_desc', 'Drop SKILL.md files into the templates folder to install them.')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button sm onClick={() => void loadSkills()}><Ic.Refresh /> {t('settings.general.refresh', 'Refresh')}</Button>
                  <Button sm primary onClick={() => void handleOpenTemplatesFolder()}><Ic.Folder /> {t('settings.skills.open_folder', 'Open Folder')}</Button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {templates.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: gv.td, fontSize: 13, border: `1px dashed ${gv.gbdr}`, borderRadius: 8 }}>
                    {t('settings.skills.no_local_templates', 'No local templates found. Open the folder and copy your skills there.')}
                  </div>
                ) : (
                  templates.map(tpl => {
                    const color = gv.am
                    return (
                      <div
                        key={tpl.name}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                          background: 'rgba(255,255,255,.02)',
                          border: `1px solid ${gv.gbdr}`,
                          borderRadius: 10,
                        }}
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                          background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 15, color,
                        }}>
                          ⚡
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: gv.tx }}>{tpl.name}</span>
                            {tpl.isInstalled && (
                              <span style={{
                                fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em',
                                padding: '2px 6px', borderRadius: 4,
                                background: 'rgba(255,255,255,.1)', color: gv.ts,
                              }}>
                                {t('settings.skills.installed', 'Installed')}
                              </span>
                            )}
                          </div>
                          {tpl.description && (
                            <div style={{ fontSize: 11.5, color: gv.td, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {tpl.description}
                            </div>
                          )}
                        </div>
                        <Button sm primary={!tpl.isInstalled} onClick={() => void handleInstallLocalTemplate(tpl.name)}>
                          {tpl.isInstalled ? <><Ic.Refresh /> {t('settings.skills.reinstall', 'Update')}</> : <><Ic.Plus /> {t('settings.skills.install', 'Install')}</>}
                        </Button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Built-in Template Library */}
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{t('settings.skills.template_title', 'Built-in Library')}</div>
              <div style={{ fontSize: 12, color: gv.td, marginTop: 4, marginBottom: 12 }}>
                {t('settings.skills.template_desc', 'Install high-quality standard skills.')}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {SKILL_TEMPLATES.filter(tpl => !skills.some(s => s.name === tpl.name)).map(tpl => {
                  const color = skillColor(tpl.name)
                  return (
                    <div
                      key={tpl.name}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                        background: 'rgba(255,255,255,.02)',
                        border: `1px dashed ${gv.gbdr}`,
                        borderRadius: 10,
                      }}
                    >
                      {/* Icon tag */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                        background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15, color: gv.td,
                      }}>
                        ⚡
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0, opacity: 0.6 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: gv.td }}>{tpl.name}</div>
                        <div style={{ fontSize: 11.5, color: gv.td, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tpl.description}
                        </div>
                      </div>

                      {/* Install Button */}
                      <Button sm primary onClick={() => void handleInstallSkill(tpl)}>
                        <Ic.Plus /> {t('settings.skills.template_install', 'Install')}
                      </Button>
                    </div>
                  )
                })}
                {SKILL_TEMPLATES.filter(tpl => !skills.some(s => s.name === tpl.name)).length === 0 && (
                  <div style={{ padding: 24, textAlign: 'center', color: gv.td, fontSize: 13 }}>
                    {t('settings.skills.all_templates_installed', 'All templates are installed!')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </Card>
    </div>
  )
}
