import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardHeader } from '../components/Card'
import { Button } from '../components/Button'
import { Badge, StatusBadge } from '../components/Badge'
import { Ic } from '../components/Icon'
import { gv, mn } from '../components/tokens'

interface AutoRule {
  id: string
  agentId: string
  cronExpr: string
  status: 'active' | 'paused'
  createdAt: number
  agentName?: string // Synthesized later
}

type AgentRow = { id: string; name: string; status: string }

interface CampaignRow {
  id: string
  name: string
  cronExpr: string | null
  cronStatus: 'active' | 'paused'
  platforms: string[]
}

// ─── Cron presets ─────────────────────────────────────────────────────────────
const useCronPresets = () => {
  const { t } = useTranslation()
  return [
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

// ─── New Rule Modal ───────────────────────────────────────────────────────────

interface NewRuleModalProps {
  agents: AgentRow[]
  onClose: () => void
  onSaved: () => void
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,.06)',
  border: `1px solid ${gv.gbdr}`, borderRadius: 8, color: gv.tx,
  outline: 'none', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: gv.td,
  textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6,
}

const NewRuleModal = ({ agents, onClose, onSaved }: NewRuleModalProps) => {
  const { t } = useTranslation()
  const CRON_PRESETS = useCronPresets()
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?.id ?? '')
  const [cronPreset, setCronPreset] = useState(CRON_PRESETS[4].value) // Daily at 9AM
  const [customCron, setCustomCron] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const cronValue = cronPreset === '__custom__' ? customCron : cronPreset

  const selectedAgent = agents.find(a => a.id === selectedAgentId)

  const validateCron = (expr: string) => {
    // basic field count check — node-cron handles 5-field expressions
    const parts = expr.trim().split(/\s+/)
    return parts.length === 5
  }

  const handleSave = async () => {
    if (!selectedAgentId) { setSaveError(t('automation.err_no_agent', 'Please select an agent.')); return }
    if (!validateCron(cronValue)) { setSaveError(t('automation.err_invalid_cron', 'Invalid cron expression. Expected 5 fields e.g. "0 9 * * *".')); return }
    setSaving(true)
    setSaveError('')
    try {
      await window.electronAPI?.automations.create(selectedAgentId, cronValue)
      onSaved()
      onClose()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : t('automation.err_save_failed', 'Failed to save rule.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 480, background: gv.card, borderRadius: 18,
          border: `1px solid ${gv.cbdr}`, boxShadow: '0 24px 64px rgba(0,0,0,.6)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 24px 14px', borderBottom: `1px solid ${gv.gbdr}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{t('automation.modal_title', 'New Automation Rule')}</div>
            <div style={{ fontSize: 11, color: gv.td, marginTop: 3 }}>
              {t('automation.modal_step', { step, desc: step === 1 ? t('automation.step_1_desc', 'Select Agent') : t('automation.step_2_desc', 'Set Schedule'), defaultValue: `Step ${step} of 2 — ${step === 1 ? 'Select Agent' : 'Set Schedule'}` })}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: gv.td, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 0 }}>
          {[1, 2].map(s => (
            <div key={s} style={{ flex: 1, height: 3, background: step >= s ? gv.cc : 'rgba(255,255,255,.07)', transition: 'background .3s' }} />
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {step === 1 && (
            <>
              <div>
                <label style={labelStyle}>{t('automation.lbl_agent', 'Agent')}</label>
                {agents.length === 0 ? (
                  <div style={{ padding: '16px 14px', background: 'rgba(255,255,255,.03)', borderRadius: 8, border: `1px dashed ${gv.gbdr}`, color: gv.td, fontSize: 12 }}>
                    <span dangerouslySetInnerHTML={{ __html: t('automation.no_agents_found', 'No agents found. Create an agent first from the <strong>AI Agents</strong> page.') }} />
                  </div>
                ) : (
                  <select
                    value={selectedAgentId}
                    onChange={e => setSelectedAgentId(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    {agents.map(a => (
                      <option key={a.id} value={a.id} style={{ background: gv.card }}>
                        {a.name} ({a.status})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedAgent && (
                <div style={{ padding: '12px 14px', background: 'rgba(123,92,255,.08)', borderRadius: 10, border: `1px solid ${gv.cc}22` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{selectedAgent.name}</div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 11, color: gv.td }}>
                    <span>{t('automation.lbl_status', 'Status')}: <span style={{ color: gv.tx }}>{t(`status_${selectedAgent.status}`, selectedAgent.status)}</span></span>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label style={labelStyle}>{t('automation.lbl_schedule_preset', 'Schedule Preset')}</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {CRON_PRESETS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setCronPreset(p.value)}
                      style={{
                        padding: '9px 12px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                        background: cronPreset === p.value ? `${gv.cc}18` : 'rgba(255,255,255,.04)',
                        border: `1px solid ${cronPreset === p.value ? gv.cc + '50' : gv.gbdr}`,
                        color: cronPreset === p.value ? gv.cc : gv.ts, fontSize: 12,
                        transition: 'all .15s',
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {cronPreset === '__custom__' && (
                <div>
                  <label style={labelStyle}>{t('automation.lbl_custom_cron', 'Custom Cron Expression')}</label>
                  <input
                    value={customCron}
                    onChange={e => setCustomCron(e.target.value)}
                    placeholder={t('automation.placeholder_custom_cron', 'e.g. 0 9 * * 1-5')}
                    style={inputStyle}
                  />
                  <div style={{ marginTop: 6, fontSize: 10, color: gv.td }}>
                    {t('automation.hint_custom_cron', '5-field format: minute hour day-of-month month day-of-week')}
                  </div>
                </div>
              )}

              {/* Preview */}
              <div style={{ padding: '12px 14px', background: 'rgba(0,0,0,.2)', borderRadius: 10, border: `1px solid ${gv.gbdr}` }}>
                <div style={{ fontSize: 11, color: gv.td, marginBottom: 4 }}>{t('automation.lbl_rule_preview', 'Rule preview')}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t('automation.lbl_auto_run', { agent: selectedAgent?.name, defaultValue: `${selectedAgent?.name} — Auto Run` })}</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>
                  <span style={{ color: gv.td }}>{t('automation.lbl_schedule', 'Schedule:')} </span>
                  <span style={{ color: gv.cc, fontFamily: mn }}>{cronValue || '—'}</span>
                </div>
              </div>

              {saveError && (
                <div style={{ fontSize: 12, color: gv.rd, padding: '8px 12px', background: `${gv.rd}12`, borderRadius: 7, border: `1px solid ${gv.rd}30` }}>
                  ⚠ {saveError}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${gv.gbdr}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {step === 1 ? (
            <>
              <Button sm onClick={onClose}>{t('automation.btn_cancel', 'Cancel')}</Button>
              <Button primary sm onClick={() => setStep(2)} disabled={!selectedAgentId || agents.length === 0}>
                {t('automation.btn_next', 'Next: Set Schedule →')}
              </Button>
            </>
          ) : (
            <>
              <Button sm onClick={() => setStep(1)}>{t('automation.btn_back', '← Back')}</Button>
              <Button primary sm onClick={() => void handleSave()} disabled={saving || !cronValue}>
                {saving ? t('automation.btn_saving', 'Saving…') : t('automation.btn_activate', '⚡ Activate Rule')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Quick Setup Modal ────────────────────────────────────────────────────────
// Creates a new agent + automation rule in one step

interface QuickSetupModalProps {
  onClose: () => void
  onSaved: () => void
}

const PLATFORM_OPTIONS = [
  { id: 'x', label: 'X (Twitter)' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'xiaohongshu', label: '小红书' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
]

const QuickSetupModal = ({ onClose, onSaved }: QuickSetupModalProps) => {
  const { t } = useTranslation()
  const CRON_PRESETS = useCronPresets()
  const [agentName, setAgentName] = useState('')
  const [platform, setPlatform] = useState<string>('x')
  const [cronPreset, setCronPreset] = useState(CRON_PRESETS[4].value) // Daily 9AM
  const [customCron, setCustomCron] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const cronValue = cronPreset === '__custom__' ? customCron : cronPreset

  const handleSave = async () => {
    if (!agentName.trim()) { setError('Agent name is required'); return }
    if (!cronValue) { setError('Select a schedule'); return }
    setSaving(true); setError('')
    try {
      // 1. Create agent
      const agentResult = await window.electronAPI?.agents.create({ name: agentName.trim(), platform, status: 'idle' }) as { id: string } | undefined
      if (!agentResult?.id) throw new Error('Failed to create agent')
      // 2. Create automation rule
      await window.electronAPI?.automations.create(agentResult.id, cronValue)
      onSaved()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Setup failed')
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 460, background: gv.card, borderRadius: 18, border: `1px solid ${gv.cbdr}`, boxShadow: '0 24px 64px rgba(0,0,0,.6)', overflow: 'hidden' }}
      >
        <div style={{ padding: '18px 24px 14px', borderBottom: `1px solid ${gv.gbdr}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>⚡ {t('automation.quick_setup_title', 'Quick Setup')}</div>
            <div style={{ fontSize: 11, color: gv.td, marginTop: 3 }}>{t('automation.quick_setup_desc', 'Create an agent and schedule it in one step')}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: gv.td, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Agent Name */}
          <div>
            <label style={labelStyle}>{t('automation.qs_agent_name', 'Agent Name')}</label>
            <input
              autoFocus
              value={agentName}
              onChange={e => setAgentName(e.target.value)}
              placeholder={t('automation.qs_agent_placeholder', 'e.g. Daily X Posts')}
              style={inputStyle}
            />
          </div>

          {/* Platform */}
          <div>
            <label style={labelStyle}>{t('automation.qs_platform', 'Platform')}</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PLATFORM_OPTIONS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  style={{
                    padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                    background: platform === p.id ? `${gv.cc}18` : 'rgba(255,255,255,.04)',
                    border: `1px solid ${platform === p.id ? gv.cc + '50' : gv.gbdr}`,
                    color: platform === p.id ? gv.cc : gv.ts,
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule */}
          <div>
            <label style={labelStyle}>{t('automation.qs_schedule', 'Run Schedule')}</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {CRON_PRESETS.filter(p => p.value !== '__custom__').map(p => (
                <button
                  key={p.value}
                  onClick={() => { setCronPreset(p.value); setCustomCron('') }}
                  style={{
                    padding: '7px 10px', borderRadius: 7, textAlign: 'left', cursor: 'pointer', fontSize: 11,
                    background: cronPreset === p.value ? `${gv.cc}18` : 'rgba(255,255,255,.04)',
                    border: `1px solid ${cronPreset === p.value ? gv.cc + '50' : gv.gbdr}`,
                    color: cronPreset === p.value ? gv.cc : gv.ts,
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div style={{ padding: '10px 14px', background: 'rgba(123,92,255,.06)', borderRadius: 8, border: `1px solid ${gv.cc}18`, fontSize: 12 }}>
            <span style={{ color: gv.td }}>Will create: </span>
            <span style={{ fontWeight: 600 }}>{agentName || '…'}</span>
            <span style={{ color: gv.td }}> on {PLATFORM_OPTIONS.find(p => p.id === platform)?.label}</span>
            <span style={{ color: gv.td }}>, running </span>
            <span style={{ color: gv.cc, fontFamily: mn, fontSize: 11 }}>{CRON_PRESETS.find(p => p.value === cronPreset)?.label ?? cronValue}</span>
          </div>

          {error && (
            <div style={{ fontSize: 12, color: gv.rd, padding: '8px 12px', background: `${gv.rd}12`, borderRadius: 7, border: `1px solid ${gv.rd}30` }}>
              ⚠ {error}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 24px', borderTop: `1px solid ${gv.gbdr}`, display: 'flex', justifyContent: 'space-between' }}>
          <Button sm onClick={onClose}>{t('automation.btn_cancel', 'Cancel')}</Button>
          <Button primary sm onClick={() => void handleSave()} disabled={saving || !agentName.trim()}>
            {saving ? t('automation.btn_saving', 'Saving…') : t('automation.qs_create_btn', '⚡ Create & Schedule')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export const AutomationPage = () => {
  const { t } = useTranslation()
  const [rules, setRules] = useState<AutoRule[]>([])
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [showNew, setShowNew] = useState(false)
  const [showQuickSetup, setShowQuickSetup] = useState(false)
  const [triggeringId, setTriggeringId] = useState<string | null>(null)
  const [triggeredId, setTriggeredId] = useState<string | null>(null)
  const [triggerError, setTriggerError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingCampaignId, setTogglingCampaignId] = useState<string | null>(null)

  const loadData = async () => {
    const agentRows = (await window.electronAPI?.agents.list() ?? []) as AgentRow[]
    setAgents(agentRows)

    const rawRules = (await (window.electronAPI?.automations.listAll?.() ?? window.electronAPI?.automations.listActive()) ?? []) as AutoRule[]
    // Synthesize agent name for display
    const rulesWithMetadata = rawRules.map(r => {
      const ag = agentRows.find(a => a.id === r.agentId)
      return { ...r, agentName: ag?.name ?? t('automation.unknown_agent', 'Unknown Agent') }
    })
    setRules(rulesWithMetadata)

    // Load campaigns that have a cron schedule
    const rawCampaigns = (await window.electronAPI?.campaigns.list() ?? []) as CampaignRow[]
    setCampaigns(rawCampaigns.filter(c => c.cronExpr))
  }

  useEffect(() => { void loadData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTrigger = async (agentId: string) => {
    setTriggeringId(agentId)
    setTriggerError(null)
    try {
      await window.electronAPI?.agents.trigger(agentId)
      setTriggeredId(agentId)
      setTimeout(() => setTriggeredId(null), 3000)
    } catch (e) {
      setTriggerError(e instanceof Error ? e.message : 'Failed to trigger agent')
    } finally {
      setTriggeringId(null)
    }
  }

  const handleTriggerCampaign = async (campaignId: string) => {
    setTriggeringId(campaignId)
    setTriggerError(null)
    try {
      await window.electronAPI?.campaigns.trigger(campaignId)
      setTriggeredId(campaignId)
      setTimeout(() => setTriggeredId(null), 3000)
    } catch (e) {
      setTriggerError(e instanceof Error ? e.message : 'Failed to trigger campaign')
    } finally {
      setTriggeringId(null)
    }
  }

  const handleToggle = async (ruleId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'
    await window.electronAPI?.automations.update(ruleId, { status: newStatus })
    await loadData()
  }

  const handleToggleCampaignCron = async (campaignId: string, currentStatus: 'active' | 'paused') => {
    setTogglingCampaignId(campaignId)
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'
    await window.electronAPI?.campaigns.setCronStatus(campaignId, newStatus)
    setTogglingCampaignId(null)
    await loadData()
  }

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm(t('automation.confirm_delete_rule', 'Remove this automation rule? The agent will remain but its repeating schedule will be cleared.'))) return
    setDeletingId(ruleId)
    await window.electronAPI?.automations.delete(ruleId)
    setDeletingId(null)
    await loadData()
  }

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{t('automation.title', 'Automation')}</div>
          <div style={{ fontSize: 11, color: gv.td, marginTop: 2 }}>{t('automation.desc', 'Scheduled agent runs and triggers')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button sm onClick={() => setShowQuickSetup(true)}><Ic.Zap /> {t('automation.btn_quick_setup', 'Quick Setup')}</Button>
          <Button primary sm onClick={() => setShowNew(true)}><Ic.Plus /> {t('automation.btn_new_rule', 'New Rule')}</Button>
        </div>
      </div>

      {/* Info banner */}
      <div style={{ padding: '10px 14px', marginBottom: 14, background: `${gv.ac}0D`, border: `1px solid ${gv.ac}25`, borderRadius: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
        <Ic.Zap />
        <div style={{ flex: 1, fontSize: 11, color: gv.ts }}>
          <span dangerouslySetInnerHTML={{ __html: t('automation.info_banner', 'Automation rules bind an agent to a cron schedule. Click <strong>New Rule</strong> to set one up, or manage agent schedules from the <strong>AI Agents</strong> page.') }} />
        </div>
      </div>

      {/* Empty state */}
      {rules.length === 0 && agents.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: gv.td }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
          <div style={{ fontSize: 13, marginBottom: 8 }}>{t('automation.empty_all_title', 'No automation rules yet')}</div>
          <div style={{ fontSize: 11, marginBottom: 20 }}>{t('automation.empty_all_desc', 'Create agents with a cron schedule to automate your publishing')}</div>
          <Button primary sm onClick={() => setShowNew(true)}><Ic.Plus /> {t('automation.btn_create_first', 'Create First Rule')}</Button>
        </div>
      )}

      {/* Empty rules but agents exist */}
      {rules.length === 0 && agents.length > 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: gv.td, border: `1px dashed ${gv.gbdr}`, borderRadius: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 24, marginBottom: 10 }}>⏰</div>
          <div style={{ fontSize: 13, marginBottom: 6 }}>{t('automation.empty_rules_title', 'No scheduled rules yet')}</div>
          <div style={{ fontSize: 11, marginBottom: 16 }}>{agents.length === 1 ? t('automation.empty_rules_desc_one', 'Your 1 agent has no cron schedule assigned') : t('automation.empty_rules_desc_other', { count: agents.length, defaultValue: `Your ${agents.length} agents have no cron schedule assigned` })}</div>
          <Button primary sm onClick={() => setShowNew(true)}><Ic.Plus /> {t('automation.btn_new_rule', 'New Rule')}</Button>
        </div>
      )}

      {/* Trigger error banner */}
      {triggerError && (
        <div style={{ padding: '8px 14px', marginBottom: 10, background: `${gv.rd}12`, border: `1px solid ${gv.rd}30`, borderRadius: 8, fontSize: 12, color: gv.rd }}>
          ⚠ {triggerError}
        </div>
      )}

      {/* Scheduled rules list */}
      {rules.length > 0 && (
        <Card sx={{ padding: 0, marginBottom: 12 }}>
          <CardHeader t={t('automation.card_scheduled_title', 'Scheduled Rules')} r={<Badge c={gv.gr}>{t('automation.badge_active_count', { count: rules.filter(r => r.status === 'active').length, defaultValue: `${rules.filter(r => r.status === 'active').length} active` })}</Badge>} />
          {rules.map((r, i) => (
            <div
              key={r.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px',
                borderTop: i ? `1px solid ${gv.gbdr}` : 'none',
                opacity: r.status === 'paused' ? 0.65 : 1,
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: 4, background: r.status === 'active' ? gv.gr : gv.td, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{r.agentName}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 3, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontFamily: mn, color: gv.cc, background: `${gv.cc}12`, padding: '2px 6px', borderRadius: 4 }}>{r.cronExpr}</span>
                  {r.status === 'paused' && <span style={{ fontSize: 10, color: gv.td }}>Paused — click Resume to re-enable</span>}
                </div>
              </div>
              <StatusBadge s={r.status} />
              {triggeredId === r.agentId ? (
                <span style={{ fontSize: 11, color: gv.gr, fontWeight: 600 }}>✓ Started</span>
              ) : (
                <Button sm onClick={() => void handleTrigger(r.agentId)} disabled={triggeringId === r.agentId}>
                  {triggeringId === r.agentId ? '…' : <><Ic.Play /> {t('automation.btn_run_now', 'Run Now')}</>}
                </Button>
              )}
              <Button sm onClick={() => void handleToggle(r.id, r.status)}>
                {r.status === 'active' ? <><Ic.Pause /> {t('automation.btn_pause', 'Pause')}</> : <><Ic.Play /> {t('automation.btn_resume', 'Resume')}</>}
              </Button>
              <button
                onClick={() => void handleDeleteRule(r.id)}
                disabled={deletingId === r.id}
                title={t('automation.title_remove_rule', 'Remove rule')}
                style={{ background: 'none', border: 'none', color: gv.rd, cursor: 'pointer', padding: 6, opacity: deletingId === r.id ? 0.4 : 1 }}
              >
                <Ic.Trash />
              </button>
            </div>
          ))}
        </Card>
      )}

      {/* Campaign Schedules */}
      {campaigns.length > 0 && (
        <Card sx={{ padding: 0, marginBottom: 12 }}>
          <CardHeader
            t={t('automation.card_campaigns_title', 'Campaign Schedules')}
            r={<span style={{ fontSize: 10, color: gv.td }}>{t('automation.card_campaigns_desc', 'Campaigns with recurring schedules')}</span>}
          />
          {campaigns.map((c, i) => (
            <div
              key={c.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px',
                borderTop: i ? `1px solid ${gv.gbdr}` : 'none',
                opacity: c.cronStatus === 'paused' ? 0.65 : 1,
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: 4, background: c.cronStatus === 'active' ? gv.gr : gv.td, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 3, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontFamily: mn, color: gv.pk, background: `${gv.pk}12`, padding: '2px 6px', borderRadius: 4 }}>{c.cronExpr}</span>
                  <span style={{ fontSize: 10, color: gv.td }}>Campaign</span>
                  {c.cronStatus === 'paused' && <span style={{ fontSize: 10, color: gv.td }}>Paused</span>}
                </div>
              </div>
              <StatusBadge s={c.cronStatus} />
              {triggeredId === c.id ? (
                <span style={{ fontSize: 11, color: gv.gr, fontWeight: 600 }}>✓ Started</span>
              ) : (
                <Button sm onClick={() => void handleTriggerCampaign(c.id)} disabled={triggeringId === c.id}>
                  {triggeringId === c.id ? '…' : <><Ic.Play /> {t('automation.btn_run_now', 'Run Now')}</>}
                </Button>
              )}
              <Button sm onClick={() => void handleToggleCampaignCron(c.id, c.cronStatus)} disabled={togglingCampaignId === c.id}>
                {togglingCampaignId === c.id ? '…' : c.cronStatus === 'active'
                  ? <><Ic.Pause /> {t('automation.btn_pause', 'Pause')}</>
                  : <><Ic.Play /> {t('automation.btn_resume', 'Resume')}</>}
              </Button>
            </div>
          ))}
        </Card>
      )}

      {/* Manual trigger section (agents without any schedule) */}
      {agents.filter(a => !rules.some(r => r.agentId === a.id)).length > 0 && (
        <Card sx={{ padding: 0 }}>
          <CardHeader t={t('automation.card_manual_title', 'Manual Trigger')} r={<span style={{ fontSize: 10, color: gv.td }}>{t('automation.card_manual_desc', 'Run unscheduled agents immediately')}</span>} />
          {agents.filter(a => !rules.some(r => r.agentId === a.id)).map((a, i) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px', borderTop: i ? `1px solid ${gv.gbdr}` : 'none' }}>
              <div style={{ flex: 1, fontSize: 13 }}>
                <div style={{ fontWeight: 500 }}>{a.name}</div>
              </div>
              <StatusBadge s={a.status} />
              {triggeredId === a.id ? (
                <span style={{ fontSize: 11, color: gv.gr, fontWeight: 600 }}>✓ Started</span>
              ) : (
                <Button primary sm onClick={() => void handleTrigger(a.id)} disabled={triggeringId === a.id}>
                  {triggeringId === a.id ? <><Ic.Zap /> {t('automation.btn_running', 'Running…')}</> : <><Ic.Play /> {t('automation.btn_run', 'Run')}</>}
                </Button>
              )}
            </div>
          ))}
        </Card>
      )}

      {/* New Rule Modal */}
      {showNew && (
        <NewRuleModal
          agents={agents}
          onClose={() => setShowNew(false)}
          onSaved={() => void loadData()}
        />
      )}

      {/* Quick Setup Modal */}
      {showQuickSetup && <QuickSetupModal onClose={() => setShowQuickSetup(false)} onSaved={() => void loadData()} />}
    </div>
  )
}
