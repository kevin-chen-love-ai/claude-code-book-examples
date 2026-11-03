import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Badge, StatusBadge } from '../components/Badge'
import { ProgressBar } from '../components/ProgressBar'
import { PlatformIcon } from '../components/PlatformIcon'
import { Ic } from '../components/Icon'
import { gv, mn } from '../components/tokens'
import { LC, colorizeLog } from '../components/TerminalLog'
import { useAgentIpcStore } from '../store/agentIpc'
import type { PlatformId } from '../types'

// ─── Create Agent Modal ───────────────────────────────────────────────────────
const useCronPresets = () => {
  const { t } = useTranslation()
  return [
    { label: t('automation.cron_none', 'No Schedule (Manual)'), value: '' },
    { label: t('automation.cron_15m', 'Every 15 minutes'), value: '*/15 * * * *' },
    { label: t('automation.cron_1h', 'Every hour'), value: '0 * * * *' },
    { label: t('automation.cron_2h', 'Every 2 hours'), value: '0 */2 * * *' },
    { label: t('automation.cron_6h', 'Every 6 hours'), value: '0 */6 * * *' },
    { label: t('automation.cron_daily_9am', 'Daily at 9 AM'), value: '0 9 * * *' },
    { label: t('automation.cron_daily_noon', 'Daily at noon'), value: '0 12 * * *' },
    { label: t('automation.cron_daily_6pm', 'Daily at 6 PM'), value: '0 18 * * *' },
    { label: t('automation.cron_weekdays_9am', 'Weekdays at 9 AM'), value: '0 9 * * 1-5' },
    { label: t('automation.cron_monday_9am', 'Every Monday 9 AM'), value: '0 9 * * 1' },
    { label: t('automation.cron_custom', 'Custom…'), value: '__custom__' },
  ]
}

interface CreateAgentModalProps { onClose: () => void; onCreated: () => void }

// Helper hooks and styles can be reused from elsewhere if needed
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,.05)', border: `1px solid ${gv.gbdr}`,
  borderRadius: 8, color: gv.tx, fontSize: 13, padding: '9px 12px', outline: 'none', boxSizing: 'border-box'
}

// Fallback platform options if channels API is unavailable
const PLATFORM_OPTIONS_FALLBACK: { value: string; label: string }[] = [
  { value: 'x', label: 'X (Twitter)' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'xiaohongshu', label: '小红书 (XHS)' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'discord', label: 'Discord' },
  { value: 'slack', label: 'Slack' },
]

// Default config per platform for quick setup
const PLATFORM_DEFAULTS: Record<string, { name: string; topic: string; schedule: string }> = {
  x:           { name: 'X Morning Poster',    topic: 'Tech & AI trends, concise punchy posts, 2-3 hashtags',   schedule: '0 9 * * *'   },
  linkedin:    { name: 'LinkedIn Daily',       topic: 'Professional insights, thought leadership, industry news', schedule: '0 10 * * 1-5' },
  xiaohongshu: { name: '小红书日更',             topic: '生活方式内容，种草测评，美妆穿搭，旅行探店',                     schedule: '0 11 * * *'  },
  instagram:   { name: 'Instagram Daily',      topic: 'Visual lifestyle, travel photography, aesthetic content', schedule: '0 14 * * *'  },
  facebook:    { name: 'Facebook Community',   topic: 'Community updates, engaging questions, news sharing',    schedule: '0 12 * * *'  },
  pinterest:   { name: 'Pinterest Boards',     topic: 'Visual inspiration, design, DIY projects, mood boards',  schedule: '0 11 * * *'  },
  discord:     { name: 'Discord Updates',      topic: 'Community announcements, project updates, engagement',   schedule: '0 10 * * *'  },
  slack:       { name: 'Slack Reports',        topic: 'Team updates, metrics, scheduled reports',               schedule: '0 9 * * 1-5' },
}

// ─── Quick Setup Modal ────────────────────────────────────────────────────────
interface QuickSetupModalProps { onClose: () => void; onCreated: () => void }

function QuickSetupModal({ onClose, onCreated }: QuickSetupModalProps) {
  const [platformOptions, setPlatformOptions] = useState<{ value: string; label: string }[]>(PLATFORM_OPTIONS_FALLBACK)
  const [selected, setSelected] = useState<Set<string>>(new Set(PLATFORM_OPTIONS_FALLBACK.map(p => p.value)))
  const [providers, setProviders] = useState<{ key: string; name: string; models: string[] }[]>([])
  const [personaId, setPersonaId] = useState('')
  const [personas, setPersonas] = useState<{ id: string; name: string }[]>([])
  const [providerKey, setProviderKey] = useState('')
  const [model, setModel] = useState('')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const [existingPlatforms, setExistingPlatforms] = useState<Set<string>>(new Set())

  const selStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,.05)', border: `1px solid ${gv.gbdr}`,
    borderRadius: 8, color: gv.tx, fontSize: 13, padding: '7px 10px',
    outline: 'none', appearance: 'auto' as React.CSSProperties['appearance'], colorScheme: 'dark',
  }

  useEffect(() => {
    const load = async () => {
      const api = window.electronAPI
      if (!api) return
      const [llmSet, agentSet, prSet, chSet] = await Promise.allSettled([
        api.llm.providersDetail(),
        api.agents.list(),
        api.personas.list(),
        api.channels.list(),
      ])
      if (llmSet.status === 'fulfilled' && Array.isArray(llmSet.value)) {
        const llms = llmSet.value as { key: string; name: string; models: string[] }[]
        setProviders(llms)
        if (llms.length > 0) { setProviderKey(llms[0].key); setModel(llms[0].models[0] ?? '') }
      }
      if (agentSet.status === 'fulfilled' && Array.isArray(agentSet.value)) {
        const existing = new Set((agentSet.value as { platform: string }[]).map(a => a.platform))
        setExistingPlatforms(existing)
        // Pre-deselect platforms that already have an agent; will be overridden once channels load
        setSelected(new Set(PLATFORM_OPTIONS_FALLBACK.map(p => p.value).filter(v => !existing.has(v))))
      }
      if (chSet.status === 'fulfilled' && Array.isArray(chSet.value)) {
        const enabled = (chSet.value as { platform: string; name: string; enabled: boolean }[]).filter(c => c.enabled)
        if (enabled.length > 0) {
          const opts = enabled.map(c => ({ value: c.platform, label: c.name }))
          setPlatformOptions(opts)
          const existing = existingPlatforms
          setSelected(new Set(opts.map(p => p.value).filter(v => !existing.has(v))))
        }
      }
      if (prSet.status === 'fulfilled' && Array.isArray(prSet.value)) {
        const prs = prSet.value as { id: string; name: string }[]
        setPersonas(prs)
        if (prs.length > 0) setPersonaId(prs[0].id)
      }
    }
    void load()
  }, [])

  useEffect(() => {
    const p = providers.find(x => x.key === providerKey)
    if (p && p.models.length > 0) setModel(prev => p.models.includes(prev) ? prev : (p.models[0] ?? ''))
  }, [providerKey, providers])

  const togglePlatform = (p: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(p) ? next.delete(p) : next.add(p)
      return next
    })
  }

  const handleCreate = async () => {
    if (!providerKey) { setError('Please configure an LLM provider in Settings first.'); return }
    const targets = platformOptions.map(p => p.value).filter(p => selected.has(p))
    if (targets.length === 0) { setError('Select at least one platform.'); return }

    setProgress({ done: 0, total: targets.length })
    setError('')
    for (let i = 0; i < targets.length; i++) {
      const platform = targets[i]!
      const def = PLATFORM_DEFAULTS[platform] ?? { name: `${platform} Agent`, topic: `Engaging content for ${platform}`, schedule: '0 9 * * *' }
      try {
        await window.electronAPI?.agents.create({
          name: def.name,
          platform,
          personaId: personaId || null,
          provider: providerKey,
          model: model || 'default',
          topic: def.topic,
          schedule: def.schedule,
          status: 'active',
          maxIterations: 10,
        })
      } catch (err) {
        console.error(`Failed to create agent for ${platform}:`, err)
      }
      setProgress({ done: i + 1, total: targets.length })
    }
    onCreated()
    onClose()
  }

  const allSelected = platformOptions.every(p => selected.has(p.value))

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 580, maxHeight: '90vh', background: gv.card, border: `1px solid ${gv.cbdr}`, borderRadius: 20, boxShadow: '0 40px 120px rgba(0,0,0,.8)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${gv.cbdr}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Quick Setup — All Channels</div>
              <div style={{ fontSize: 11, color: gv.td, marginTop: 2 }}>Create agents for all selected platforms at once</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: gv.td, cursor: 'pointer', fontSize: 16, padding: 4 }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {/* Provider + Persona */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: gv.td, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>AI Provider</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <select value={providerKey} onChange={e => setProviderKey(e.target.value)} style={{ ...selStyle, flex: 1 }}>
                  {providers.length === 0 && <option value="">No providers…</option>}
                  {providers.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
                </select>
                <select value={model} onChange={e => setModel(e.target.value)} style={{ ...selStyle, flex: 1.5 }}>
                  {providers.find(p => p.key === providerKey)?.models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  )) ?? <option value="">Default</option>}
                </select>
              </div>
            </div>
            <div style={{ flex: 0.8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: gv.td, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Persona</div>
              <select value={personaId} onChange={e => setPersonaId(e.target.value)} style={{ ...selStyle, width: '100%' }}>
                <option value="">Generic</option>
                {personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          {/* Select All / None */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: gv.ts }}>Platforms ({selected.size} selected)</div>
            <button
              onClick={() => setSelected(allSelected ? new Set() : new Set(platformOptions.map(p => p.value)))}
              style={{ fontSize: 10, color: gv.cc, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {/* Platform checkboxes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {platformOptions.map(p => {
              const isSelected = selected.has(p.value)
              const alreadyExists = existingPlatforms.has(p.value)
              const def = PLATFORM_DEFAULTS[p.value]
              return (
                <div
                  key={p.value}
                  onClick={() => !alreadyExists && togglePlatform(p.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    borderRadius: 10, border: `1px solid ${isSelected ? gv.cc + '40' : gv.gbdr}`,
                    background: isSelected ? `${gv.cc}08` : 'rgba(255,255,255,.02)',
                    cursor: alreadyExists ? 'default' : 'pointer',
                    opacity: alreadyExists ? 0.45 : 1, transition: 'all .15s',
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: 4, border: `2px solid ${isSelected ? gv.cc : gv.gbdr}`,
                    background: isSelected ? gv.cc : 'transparent', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isSelected && <span style={{ color: '#000', fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                  </div>
                  <PlatformIcon p={p.value} s={22} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {def.name}
                      {alreadyExists && <Badge c={gv.gr}>exists</Badge>}
                    </div>
                    <div style={{ fontSize: 10, color: gv.td, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{def.topic}</div>
                  </div>
                  <div style={{ fontSize: 9, color: gv.td, fontFamily: mn, flexShrink: 0 }}>{def.schedule}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${gv.cbdr}` }}>
          {error && <div style={{ fontSize: 11, color: gv.rd, marginBottom: 8 }}>⚠ {error}</div>}
          {progress && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: gv.ts, marginBottom: 4 }}>
                Creating agents… {progress.done}/{progress.total}
              </div>
              <div style={{ height: 4, background: gv.gbdr, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(progress.done / progress.total) * 100}%`, background: gv.cc, borderRadius: 2, transition: 'width .3s' }} />
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button sm onClick={onClose}>Cancel</Button>
            <Button primary sm onClick={() => void handleCreate()} disabled={!!progress || selected.size === 0}>
              {progress ? `Creating… (${progress.done}/${progress.total})` : `Create ${selected.size} Agent${selected.size !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CreateAgentModal({ onClose, onCreated }: CreateAgentModalProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')

  // Relational Data
  const [personas, setPersonas] = useState<{ id: string; name: string }[]>([])
  const [providers, setProviders] = useState<{ key: string; name: string; models: string[] }[]>([])
  const [platformOptions, setPlatformOptions] = useState<{ value: string; label: string }[]>(PLATFORM_OPTIONS_FALLBACK)

  // Selected State
  const [platform, setPlatform] = useState<string>('x')
  const [personaId, setPersonaId] = useState<string>('')
  const [providerKey, setProviderKey] = useState<string>('')
  const [model, setModel] = useState<string>('')

  const [topic, setTopic] = useState('')
  const [schedule, setSchedule] = useState('0 9 * * *')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      const api = window.electronAPI
      if (!api) return

      // Load each independently so one failure doesn't block others
      const [prSet, llmSet, chSet] = await Promise.allSettled([
        api.personas.list(),
        api.llm.providersDetail(),
        api.channels.list(),
      ])

      if (!active) return

      if (prSet.status === 'fulfilled' && Array.isArray(prSet.value)) {
        const prs = prSet.value as { id: string; name: string }[]
        setPersonas(prs)
        if (prs.length > 0) setPersonaId(prs[0].id)
      }
      if (llmSet.status === 'fulfilled' && Array.isArray(llmSet.value)) {
        const llms = llmSet.value as { key: string; name: string; models: string[] }[]
        setProviders(llms)
        if (llms.length > 0) {
          setProviderKey(llms[0].key)
          if (llms[0].models.length > 0) setModel(llms[0].models[0]!)
        }
      }
      if (chSet.status === 'fulfilled' && Array.isArray(chSet.value)) {
        const enabled = (chSet.value as { platform: string; name: string; enabled: boolean }[]).filter(c => c.enabled)
        if (enabled.length > 0) {
          setPlatformOptions(enabled.map(c => ({ value: c.platform, label: c.name })))
          setPlatform(enabled[0].platform)
        }
      }
    }
    void load()
    return () => { active = false }
  }, [])

  // Update model default when provider changes
  useEffect(() => {
    const p = providers.find(x => x.key === providerKey)
    if (p && p.models.length > 0 && !p.models.includes(model)) {
      setModel(p.models[0]!)
    }
  }, [providerKey, providers, model])

  const handleCreate = async () => {
    if (!name.trim()) { setError('Agent Name is required'); return }
    if (!providerKey) { setError('AI Provider is required'); return }

    setSaving(true)
    try {
      await window.electronAPI?.agents.create({
        name: name.trim(),
        platform,
        personaId: personaId || null,
        provider: providerKey,
        model: model || 'default',
        topic: topic.trim(),
        schedule,
        status: 'active',
        maxIterations: 10,
      })
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent')
    }
    setSaving(false)
  }

  const selStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'auto' as React.CSSProperties['appearance'],
    colorScheme: 'dark',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 480, background: gv.card, border: `1px solid ${gv.cbdr}`, borderRadius: 18, padding: 28, boxShadow: '0 32px 100px rgba(0,0,0,.7)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{t('agents.modal_create_title', 'Create AI Agent')}</div>
            <div style={{ fontSize: 11, color: gv.td, marginTop: 2 }}>{t('agents.modal_create_desc', 'Configure a new social media agent')}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: gv.td, cursor: 'pointer', fontSize: 16, padding: 4 }}>✕</button>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: gv.ts, display: 'block', marginBottom: 5 }}>{t('agents.modal_name_label', 'Agent Name')}</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder={t('agents.modal_name_placeholder', 'e.g. X Morning Poster')}
            style={{ width: '100%', background: 'rgba(255,255,255,.05)', border: `1px solid ${gv.gbdr}`, borderRadius: 8, color: gv.tx, fontSize: 13, padding: '9px 12px', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Platform */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: gv.ts, display: 'block', marginBottom: 5 }}>Platform</label>
          <select value={platform} onChange={e => setPlatform(e.target.value)} style={selStyle}>
            {platformOptions.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Persona Selection */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: gv.ts, display: 'block', marginBottom: 5 }}>Persona (Voice & Tone)</label>
          <select value={personaId} onChange={e => setPersonaId(e.target.value)} style={selStyle}>
            <option value="">-- No Persona (Generic) --</option>
            {personas.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {personas.length === 0 && (
            <div style={{ fontSize: 10, color: gv.td, marginTop: 4 }}>No personas found — add one in Settings → Personas.</div>
          )}
        </div>

        {/* LLM Provider & Model */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: gv.ts, display: 'block', marginBottom: 5 }}>{t('agents.modal_provider_label', 'AI Provider')}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={providerKey} onChange={e => setProviderKey(e.target.value)} style={{ ...selStyle, flex: 1 }}>
              {providers.length === 0 && <option value="">No providers configured...</option>}
              {providers.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
            </select>
            <select value={model} onChange={e => setModel(e.target.value)} style={{ ...selStyle, flex: 1.5 }}>
              {providers.find(p => p.key === providerKey)?.models.map(m => (
                <option key={m} value={m}>{m}</option>
              )) ?? <option value="">Default model</option>}
            </select>
          </div>
          {providers.length === 0 && <div style={{ fontSize: 10, color: gv.rd, marginTop: 4 }}>Please configure LLM providers in Settings first.</div>}
        </div>

        {/* Topic / System Prompt */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: gv.ts, display: 'block', marginBottom: 5 }}>{t('agents.modal_topic_label', 'Content Topic / Persona')}</label>
          <textarea value={topic} onChange={e => setTopic(e.target.value)} rows={3} placeholder={t('agents.modal_topic_placeholder', 'e.g. AI industry news, tech trends, startup insights...')}
            style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: `1px solid ${gv.gbdr}`, borderRadius: 8, color: gv.tx, fontSize: 12, lineHeight: 1.5, padding: '9px 12px', fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Schedule */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: gv.ts, display: 'block', marginBottom: 5 }}>{t('agents.modal_schedule_label', 'Cron Schedule')}</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { label: t('agents.modal_schedule_daily', 'Daily 9am'), cron: '0 9 * * *' },
              { label: t('agents.modal_schedule_twice', 'Twice daily'), cron: '0 9,18 * * *' },
              { label: t('agents.modal_schedule_hourly', 'Hourly'), cron: '0 * * * *' },
            ].map(opt => (
              <button key={opt.cron} onClick={() => setSchedule(opt.cron)} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${schedule === opt.cron ? gv.ac : gv.gbdr}`, background: schedule === opt.cron ? `${gv.ac}14` : 'transparent', cursor: 'pointer', color: schedule === opt.cron ? gv.cc : gv.ts, fontSize: 10 }}>
                {opt.label}
              </button>
            ))}
            <input value={schedule} onChange={e => setSchedule(e.target.value)}
              style={{ flex: 1, background: 'rgba(255,255,255,.04)', border: `1px solid ${gv.gbdr}`, borderRadius: 6, color: gv.ts, fontSize: 10, padding: '4px 8px', fontFamily: mn, outline: 'none' }}
            />
          </div>
        </div>

        {error && <div style={{ fontSize: 11, color: gv.rd, marginBottom: 12 }}>⚠ {error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button sm onClick={onClose}>{t('agents.modal_cancel', 'Cancel')}</Button>
          <Button primary sm onClick={handleCreate} disabled={saving}>
            {saving ? t('agents.modal_creating', 'Creating…') : t('agents.create_btn', 'Create Agent')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── EditAgent Modal ─────────────────────────────────────────────────────────

interface EditAgentModalProps {
  agent: import('../types').Agent
  onClose: () => void
  onSaved: () => void
}

function EditAgentModal({ agent, onClose, onSaved }: EditAgentModalProps) {
  const { t } = useTranslation()
  const { updateAgent } = useAgentIpcStore()
  const CRON_PRESETS = useCronPresets()

  const [name, setName] = useState(agent.nm)

  const [personas, setPersonas] = useState<{ id: string; name: string }[]>([])
  const [providers, setProviders] = useState<{ key: string; name: string; models: string[] }[]>([])
  const [platformOptions, setPlatformOptions] = useState<{ value: string; label: string }[]>(PLATFORM_OPTIONS_FALLBACK)
  const [, setLoadingData] = useState(true)

  // Selected State initialized from existing agent
  const [platform, setPlatform] = useState<string>(agent.pl)
  const [personaId, setPersonaId] = useState<string>(agent.personaId || '')
  const [providerKey, setProviderKey] = useState<string>(agent.provider || '')
  const [model, setModel] = useState<string>(agent.model || '')
  const [topic, setTopic] = useState(agent.topic || '')

  const [loadingRule, setLoadingRule] = useState(true)
  const [existingRuleId, setExistingRuleId] = useState<string | null>(null)
  const [originalCron, setOriginalCron] = useState<string>('')

  const [cronPreset, setCronPreset] = useState('')
  const [customCron, setCustomCron] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Fetch options
  useEffect(() => {
    let active = true
    const load = async () => {
      const api = window.electronAPI
      if (!api) { setLoadingData(false); return }

      const [prSet, llmSet, chSet] = await Promise.allSettled([
        api.personas.list(),
        api.llm.providersDetail(),
        api.channels.list(),
      ])

      if (!active) return

      if (prSet.status === 'fulfilled' && Array.isArray(prSet.value)) {
        const prs = prSet.value as { id: string; name: string }[]
        setPersonas(prs)
        if (prs.length > 0 && !personaId) setPersonaId(prs[0].id)
      }
      if (llmSet.status === 'fulfilled' && Array.isArray(llmSet.value)) {
        const llms = llmSet.value as { key: string; name: string; models: string[] }[]
        setProviders(llms)
        if (llms.length > 0 && !providerKey) {
          setProviderKey(llms[0].key)
          if (llms[0].models.length > 0) setModel(llms[0].models[0]!)
        }
      }
      if (chSet.status === 'fulfilled' && Array.isArray(chSet.value)) {
        const enabled = (chSet.value as { platform: string; name: string; enabled: boolean }[]).filter(c => c.enabled)
        if (enabled.length > 0) setPlatformOptions(enabled.map(c => ({ value: c.platform, label: c.name })))
      }
      if (active) setLoadingData(false)
    }
    void load()
    return () => { active = false }
  }, []) // run once

  // Update model default when provider changes
  useEffect(() => {
    const p = providers.find(x => x.key === providerKey)
    if (p && p.models.length > 0 && !p.models.includes(model)) {
      setModel(p.models[0]!)
    }
  }, [providerKey, providers, model])

  useEffect(() => {
    const loadRule = async () => {
      try {
        const rules = (await window.electronAPI?.automations.listActive() || []) as Array<{ id: string; agentId: string; cronExpr: string }>
        const rule = rules.find(r => String(r.agentId) === String(agent.id))
        if (rule) {
          setExistingRuleId(rule.id)
          setOriginalCron(rule.cronExpr)

          const isPreset = CRON_PRESETS.some(p => p.value === rule.cronExpr && p.value !== '__custom__' && p.value !== '')
          if (isPreset) {
            setCronPreset(rule.cronExpr)
          } else {
            setCronPreset('__custom__')
            setCustomCron(rule.cronExpr)
          }
        } else {
          setCronPreset('')
        }
      } catch (err) {
        console.error('Failed to load schedule for agent', err)
      } finally {
        setLoadingRule(false)
      }
    }
    void loadRule()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id])

  const cronValue = cronPreset === '__custom__' ? customCron : cronPreset

  const selStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'auto' as React.CSSProperties['appearance'],
    colorScheme: 'dark',
  }

  const validateCron = (expr: string) => {
    if (!expr) return true
    const parts = expr.trim().split(/\s+/)
    return parts.length === 5
  }

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    if (cronValue && !validateCron(cronValue)) { setError(t('automation.err_invalid_cron', 'Invalid cron expression. Expected 5 fields.')); return }

    setSaving(true)
    setError('')
    try {
      // 1. Update basic agent details
      await updateAgent(agent.id, {
        name: name.trim(),
        platform: platform as PlatformId,
        personaId: personaId || null,
        provider: providerKey,
        model: model,
        topic: topic.trim()
      })

      // 2. Update automation schedule if modified
      if (cronValue !== originalCron) {
        if (existingRuleId) {
          await window.electronAPI?.automations.delete(existingRuleId)
        }
        if (cronValue) {
          await window.electronAPI?.automations.create(String(agent.id), cronValue)
        }
      }

      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    }
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 440, background: gv.card, border: `1px solid ${gv.cbdr}`, borderRadius: 18, padding: 28, boxShadow: '0 32px 100px rgba(0,0,0,.7)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{t('agents.modal_edit_title', 'Edit Agent')}</div>
            <div style={{ fontSize: 11, color: gv.td, marginTop: 2 }}>{t('agents.modal_edit_desc', 'Update agent configuration')}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: gv.td, cursor: 'pointer', fontSize: 16, padding: 4 }}>✕</button>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: gv.ts, display: 'block', marginBottom: 5 }}>{t('agents.modal_name_label', 'Agent Name')}</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('agents.modal_name_placeholder', 'e.g. X Morning Poster')}
            style={{ width: '100%', background: 'rgba(255,255,255,.05)', border: `1px solid ${gv.gbdr}`, borderRadius: 8, color: gv.tx, fontSize: 13, padding: '9px 12px', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Platform */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: gv.ts, display: 'block', marginBottom: 5 }}>Platform</label>
          <select value={platform} onChange={e => setPlatform(e.target.value)} style={selStyle}>
            {platformOptions.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Persona Selection */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: gv.ts, display: 'block', marginBottom: 5 }}>Persona (Voice & Tone)</label>
          <select value={personaId} onChange={e => setPersonaId(e.target.value)} style={selStyle}>
            <option value="">-- No Persona (Generic) --</option>
            {personas.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* LLM Provider & Model */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: gv.ts, display: 'block', marginBottom: 5 }}>{t('agents.modal_provider_label', 'AI Provider')}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={providerKey} onChange={e => setProviderKey(e.target.value)} style={{ ...selStyle, flex: 1 }}>
              {providers.length === 0 && <option value="">No providers configured...</option>}
              {providers.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
            </select>
            <select value={model} onChange={e => setModel(e.target.value)} style={{ ...selStyle, flex: 1.5 }}>
              {providers.find(p => p.key === providerKey)?.models.map(m => (
                <option key={m} value={m}>{m}</option>
              )) ?? <option value="">Default model</option>}
            </select>
          </div>
          {providers.length === 0 && <div style={{ fontSize: 10, color: gv.rd, marginTop: 4 }}>Please configure LLM providers in Settings first.</div>}
        </div>

        {/* Topic / System Prompt */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: gv.ts, display: 'block', marginBottom: 5 }}>{t('agents.modal_topic_label', 'Content Topic / Persona')}</label>
          <textarea value={topic} onChange={e => setTopic(e.target.value)} rows={3} placeholder={t('agents.modal_topic_placeholder', 'e.g. AI industry news, tech trends, startup insights...')}
            style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: `1px solid ${gv.gbdr}`, borderRadius: 8, color: gv.tx, fontSize: 12, lineHeight: 1.5, padding: '9px 12px', fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Schedule */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: gv.ts, display: 'block', marginBottom: 5 }}>{t('automation.lbl_schedule_preset', 'Schedule Preset')}</label>
          {loadingRule ? (
            <div style={{ fontSize: 12, color: gv.td }}>{t('analytics.loading', 'Loading...')}</div>
          ) : (
            <>
              <select
                value={cronPreset}
                onChange={e => setCronPreset(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,.05)', border: `1px solid ${gv.gbdr}`, borderRadius: 8, color: gv.tx, fontSize: 13, padding: '9px 12px', outline: 'none', cursor: 'pointer', marginBottom: cronPreset === '__custom__' ? 8 : 0 }}
              >
                {CRON_PRESETS.map(p => (
                  <option key={p.value} value={p.value} style={{ background: gv.card, color: gv.tx }}>{p.label}</option>
                ))}
              </select>

              {cronPreset === '__custom__' && (
                <div>
                  <input
                    value={customCron}
                    onChange={e => setCustomCron(e.target.value)}
                    placeholder={t('automation.placeholder_custom_cron', 'e.g. 0 9 * * 1-5')}
                    style={{ width: '100%', background: 'rgba(255,255,255,.05)', border: `1px solid ${gv.gbdr}`, borderRadius: 8, color: gv.tx, fontSize: 13, padding: '9px 12px', outline: 'none', boxSizing: 'border-box' }}
                  />
                  <div style={{ marginTop: 6, fontSize: 10, color: gv.td }}>
                    {t('automation.hint_custom_cron', '5-field format: minute hour day-of-month month day-of-week')}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {error && <div style={{ fontSize: 11, color: gv.rd, marginBottom: 12 }}>⚠ {error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button sm onClick={onClose}>{t('agents.modal_cancel', 'Cancel')}</Button>
          <Button primary sm onClick={handleSave} disabled={saving}>
            {saving ? t('agents.modal_saving', 'Saving…') : t('agents.modal_save_changes', 'Save Changes')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// colorizeLog, LogTag, extractToolParts, LC — imported from TerminalLog.tsx

// ─── Run Log Panel ────────────────────────────────────────────────────────────

interface LogEntry { t: string; content: string; type: 'info' | 'tool' | 'error' | 'result' }

interface StepSer {
  iteration?: number
  thought?: string
  action?: { name: string; args: Record<string, unknown> } | null
  observation?: string | null
  timestamp?: string | number
}

interface RunSummary {
  runId?: string
  outcome?: string
  tokensUsed?: number
  startedAt?: string | number
  finishedAt?: string | number
  steps?: StepSer[]
  finalAnswer?: string
}

function parseTs(val?: string | number): Date | null {
  if (!val) return null
  if (typeof val === 'number') return new Date(val < 1e10 ? val * 1000 : val)
  return new Date(val)
}

function stepsToLogs(run: RunSummary): LogEntry[] {
  const logs: LogEntry[] = []
  for (const step of run.steps ?? []) {
    const d = parseTs(step.timestamp)
    const t = d ? d.toLocaleTimeString() : ''
    if (step.thought) {
      logs.push({ t, content: `[Iter ${(step.iteration ?? 0) + 1}] ${step.thought}`, type: 'info' })
    }
    if (step.action) {
      const argsStr = JSON.stringify(step.action.args ?? {})
      logs.push({ t, content: `[Tool] ${step.action.name} ${argsStr.length > 120 ? argsStr.slice(0, 120) + '…' : argsStr}`, type: 'tool' })
    }
    if (step.observation) {
      const obs = step.observation.length > 300 ? step.observation.slice(0, 300) + '…' : step.observation
      logs.push({ t, content: `→ ${obs}`, type: 'info' })
    }
  }
  if (run.finalAnswer) {
    logs.push({ t: '', content: run.finalAnswer, type: 'result' })
  }
  return logs
}

function RunLogPanel({ agentId, agentName, onClose }: { agentId: string; agentName: string; onClose: () => void }) {
  const { t } = useTranslation()
  const [liveLogs, setLiveLogs] = useState<LogEntry[]>([])
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [selectedRun, setSelectedRun] = useState<RunSummary | null>(null)

  const reloadRuns = () => {
    void window.electronAPI?.agents.getRuns(String(agentId)).then(r => setRuns(r as RunSummary[]))
  }

  // Load historical runs on open
  useEffect(() => { reloadRuns() }, [agentId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to live agent:log events — switch to live view automatically
  useEffect(() => {
    const handler = (payload: unknown) => {
      const p = payload as { agentId?: string; message?: string; type?: string }
      if (String(p.agentId) !== String(agentId)) return
      setSelectedRun(null)
      setLiveLogs(prev => [...prev.slice(-200), {
        t: new Date().toLocaleTimeString(),
        content: p.message ?? JSON.stringify(p),
        type: (p.type as LogEntry['type']) ?? 'info',
      }])
    }
    const removeLog = window.electronAPI?.on('agent:log', handler)
    return () => { removeLog?.() }
  }, [agentId])

  // Refresh historical run list after a run completes
  useEffect(() => {
    const handler = (payload: unknown) => {
      const p = payload as { agentId?: string }
      if (String(p.agentId) !== String(agentId)) return
      reloadRuns()
    }
    const removeComplete = window.electronAPI?.on('agent:run-complete', handler)
    const removeFailed = window.electronAPI?.on('agent:run-failed', handler)
    return () => {
      removeComplete?.()
      removeFailed?.()
    }
  }, [agentId]) // eslint-disable-line react-hooks/exhaustive-deps

  const displayLogs = selectedRun ? stepsToLogs(selectedRun) : liveLogs
  const isLive = selectedRun === null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 720, height: 560, background: gv.card, border: `1px solid ${gv.cbdr}`, borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 100px rgba(0,0,0,.7)' }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${gv.gbdr}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: isLive ? gv.gr : gv.ac, animation: isLive ? 'pulse 2s infinite' : 'none' }} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            {agentName} — {selectedRun ? t('agents.log_run_detail', 'Run Detail') : t('agents.log_title', 'Live Log')}
          </span>
          <div style={{ flex: 1 }} />
          {selectedRun && (
            <button onClick={() => setSelectedRun(null)} style={{ background: 'none', border: `1px solid ${gv.gbdr}`, borderRadius: 6, color: gv.td, cursor: 'pointer', fontSize: 10, padding: '3px 10px', marginRight: 4 }}>
              ← Live
            </button>
          )}
          <Button sm onClick={() => void window.electronAPI?.logs?.openFolder()} sx={{ fontSize: 10 }}>
            {t('agents.log_open_folder', '📂 Open Logs')}
          </Button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: gv.td, cursor: 'pointer', fontSize: 16, padding: 2 }}>✕</button>
        </div>

        {/* Main log area */}
        <div style={{ flex: 1, overflow: 'auto', padding: '10px 20px', fontFamily: mn, fontSize: 11 }}>
          {displayLogs.length === 0 && isLive && (
            <div style={{ color: gv.td, textAlign: 'center', paddingTop: 40 }}>
              {t('agents.log_waiting', 'Waiting for agent activity...')}<br />
              <span style={{ fontSize: 10, marginTop: 8, display: 'block' }}>
                {runs.length > 0
                  ? t('agents.log_click_run_hint', 'Click a run below to view its full log')
                  : t('agents.log_trigger_hint', 'Trigger a run to see real-time logs')}
              </span>
            </div>
          )}
          {displayLogs.map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '2px 0', borderBottom: `1px solid rgba(255,255,255,.025)` }}>
              {l.t && <span style={{ color: LC.muted, flexShrink: 0, fontSize: 10, minWidth: 64, letterSpacing: '.02em' }}>{l.t}</span>}
              <span style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', flex: 1, lineHeight: 1.6 }}>
                {colorizeLog(l.content, l.type)}
              </span>
            </div>
          ))}
        </div>

        {/* Historical runs list */}
        {runs.length > 0 && (
          <div style={{ padding: '8px 20px', borderTop: `1px solid ${gv.gbdr}`, maxHeight: 150, overflow: 'auto' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: gv.td, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              {t('agents.log_historical_title', 'Historical Runs')} ({runs.length})
            </div>
            {runs.map((r, i) => {
              const startD = parseTs(r.startedAt)
              const endD = parseTs(r.finishedAt)
              const durSec = startD && endD ? Math.round((endD.getTime() - startD.getTime()) / 1000) : null
              const isSelected = selectedRun === r
              return (
                <div
                  key={i}
                  onClick={() => setSelectedRun(isSelected ? null : r)}
                  style={{
                    display: 'flex', gap: 10, fontSize: 10, color: gv.ts, padding: '4px 8px', marginBottom: 2,
                    borderRadius: 5, cursor: 'pointer',
                    background: isSelected ? `${gv.ac}18` : 'transparent',
                    border: `1px solid ${isSelected ? gv.ac : 'transparent'}`,
                  }}
                >
                  <span style={{ fontFamily: mn, color: gv.td, flexShrink: 0 }}>{startD ? startD.toLocaleString() : '—'}</span>
                  <StatusBadge s={r.outcome ?? 'unknown'} />
                  <span>{r.tokensUsed ?? 0} {t('agents.log_tokens', 'tokens')}</span>
                  {durSec !== null && <span>{durSec}s</span>}
                  {(r.steps?.length ?? 0) > 0 && <span style={{ color: gv.cc }}>{r.steps!.length} steps</span>}
                  {r.finalAnswer && <span style={{ color: gv.gr, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{r.finalAnswer.slice(0, 60)}{r.finalAnswer.length > 60 ? '…' : ''}</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Agents Page ──────────────────────────────────────────────────────────────

export const AgentsPage = () => {
  const { t } = useTranslation()
  const { agents, loading, fetchAgents, toggleAgent, triggerAgent, deleteAgent } = useAgentIpcStore()
  const [showCreate, setShowCreate] = useState(false)
  const [showQuickSetup, setShowQuickSetup] = useState(false)
  const [editAgent, setEditAgent] = useState<import('../types').Agent | null>(null)
  const [viewLogs, setViewLogs] = useState<{ id: string; name: string } | null>(null)
  const reload = useCallback(() => { void fetchAgents() }, [fetchAgents])

  useEffect(() => { void fetchAgents() }, [fetchAgents])

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t('agents.delete_confirm', { name, defaultValue: `Delete agent "${name}"? This cannot be undone.` }))) return
    await deleteAgent(id)
  }

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      {showCreate && <CreateAgentModal onClose={() => setShowCreate(false)} onCreated={reload} />}
      {showQuickSetup && <QuickSetupModal onClose={() => setShowQuickSetup(false)} onCreated={reload} />}
      {editAgent && <EditAgentModal agent={editAgent} onClose={() => setEditAgent(null)} onSaved={reload} />}
      {viewLogs && <RunLogPanel agentId={viewLogs.id} agentName={viewLogs.name} onClose={() => setViewLogs(null)} />}

      {loading && <div style={{ color: gv.td, fontSize: 12, marginBottom: 10 }}>{t('agents.loading', 'Loading agents...')}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, alignItems: 'center' }}>
        <span style={{ color: gv.ts }}>{t('agents.agents_count', { count: agents.length, defaultValue: `${agents.length} agents` })}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button sm onClick={() => setShowQuickSetup(true)} sx={{ color: gv.cc, borderColor: `${gv.cc}40` }}>
            ⚡ Quick Setup
          </Button>
          <Button primary sm onClick={() => setShowCreate(true)}><Ic.Plus /> {t('agents.create_btn', 'Create Agent')}</Button>
        </div>
      </div>

      {agents.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: gv.td }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>🤖</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{t('agents.no_agents', 'No agents yet')}</div>
          <div style={{ fontSize: 12, marginBottom: 20 }}>{t('agents.no_agents_desc', 'Create your first AI agent to start automating social media posting')}</div>
          <Button primary sm onClick={() => setShowCreate(true)}><Ic.Plus /> {t('agents.create_first_btn', 'Create First Agent')}</Button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: 12 }}>
        {agents.map(a => (
          <Card key={a.id} sx={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ position: 'relative' }}>
                <PlatformIcon p={a.pl} s={36} />
                <div style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: 5, background: (a.st === 'running' || a.st === 'active') ? gv.gr : gv.yl, border: '2px solid #0A0A12', animation: a.st === 'running' ? 'pulse 2s infinite' : 'none' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{a.nm}</div>
                <div style={{ fontSize: 11, color: gv.td, marginTop: 1 }}>{a.tk}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                <StatusBadge s={a.st} />
                {a.pc != null && <Badge c={a.cl}>{a.pc}%</Badge>}
              </div>
            </div>

            {a.pc != null && <ProgressBar v={a.pc} c={a.cl} h={5} />}


            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              <Button sm sx={{ flex: 1, justifyContent: 'center' }} onClick={() => void toggleAgent(a.id)}>
                {(a.st === 'running' || a.st === 'active') ? <><Ic.Pause /> {t('agents.pause_btn', 'Pause')}</> : <><Ic.Play /> {t('agents.start_btn', 'Start')}</>}
              </Button>
              <Button sm sx={{ flex: 1, justifyContent: 'center' }} onClick={() => setViewLogs({ id: a.id, name: a.nm })}>
                <Ic.Term /> {t('agents.log_btn', 'Log')}
              </Button>
              <Button sm sx={{ flex: 1, justifyContent: 'center' }} onClick={() => void triggerAgent(a.id)}>
                <Ic.Play /> {t('agents.run_btn', 'Run')}
              </Button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <Button sm sx={{ flex: 1, justifyContent: 'center' }} onClick={() => setEditAgent(a)}>
                <Ic.Gear /> {t('agents.edit_btn', 'Edit')}
              </Button>
              <button
                onClick={() => void handleDelete(a.id, a.nm)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '5px 8px', borderRadius: 8, border: `1px solid ${gv.rd}30`, background: 'transparent', color: gv.rd, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
              >
                <Ic.Trash /> {t('agents.delete_btn', 'Delete')}
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
