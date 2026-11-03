import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { StatusBadge } from '../components/Badge'
import { PlatformIcon } from '../components/PlatformIcon'
import { Ic } from '../components/Icon'
import { gv, mn } from '../components/tokens'
import type { PlatformId } from '../types'
import { useUIStore } from '../store/ui'

interface CampaignRecord {
  id: string
  name: string
  description: string
  platforms: PlatformId[]
  personaId: string | null
  coverImageUrl: string | null
  channelIds: string[]
  cronExpr: string | null
  cronStatus: 'active' | 'paused'
  status: 'active' | 'archived' | 'paused'
  createdAt: Date
}

interface PersonaItem { id: string; name: string }

const ALL_PLATFORMS: { id: PlatformId; label: string }[] = [
  { id: 'x',           label: 'X (Twitter)'    },
  { id: 'linkedin',    label: 'LinkedIn'        },
  { id: 'xiaohongshu', label: '小红书'           },
  { id: 'instagram',   label: 'Instagram'       },
  { id: 'facebook',    label: 'Facebook'        },
  { id: 'pinterest',   label: 'Pinterest'       },
  { id: 'discord',     label: 'Discord'         },
  { id: 'slack',       label: 'Slack'           },
]

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,.05)', border: `1px solid ${gv.gbdr}`,
  borderRadius: 8, color: gv.tx, fontSize: 13, padding: '9px 12px', outline: 'none', boxSizing: 'border-box',
}
const selStyle: React.CSSProperties = {
  ...inputStyle, appearance: 'auto' as React.CSSProperties['appearance'], colorScheme: 'dark',
}
const lblStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: gv.td, marginBottom: 6 }

// Static label map for campaign cards (no hook needed)
const CRON_LABELS: Record<string, string> = {
  '*/15 * * * *': 'Every 15 min',
  '0 * * * *':    'Every hour',
  '0 */2 * * *':  'Every 2 hours',
  '0 */6 * * *':  'Every 6 hours',
  '0 9 * * *':    'Daily 9 AM',
  '0 12 * * *':   'Daily noon',
  '0 18 * * *':   'Daily 6 PM',
  '0 9,18 * * *': 'Twice daily',
  '0 9 * * 1-5':  'Weekdays 9 AM',
  '0 9 * * 1':    'Monday 9 AM',
}
function humanCron(expr: string): string {
  return CRON_LABELS[expr] ?? expr
}

// ─── Cron Schedule Picker (button chips + text input, same style as AgentsPage) ──
function CronSchedulePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation()
  const presets = [
    { label: t('agents.modal_schedule_daily', 'Daily 9am'),    cron: '0 9 * * *'    },
    { label: t('agents.modal_schedule_twice', 'Twice daily'),  cron: '0 9,18 * * *' },
    { label: t('automation.cron_2h', 'Every 2 hours'),         cron: '0 */2 * * *'  },
    { label: t('agents.modal_schedule_hourly', 'Hourly'),      cron: '0 * * * *'    },
  ]
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {presets.map(opt => (
        <button
          key={opt.cron}
          onClick={() => onChange(value === opt.cron ? '' : opt.cron)}
          style={{
            padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 10,
            border: `1px solid ${value === opt.cron ? gv.ac : gv.gbdr}`,
            background: value === opt.cron ? `${gv.ac}14` : 'transparent',
            color: value === opt.cron ? gv.cc : gv.ts,
          }}
        >
          {opt.label}
        </button>
      ))}
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="cron expr or leave blank"
        style={{ flex: 1, minWidth: 140, background: 'rgba(255,255,255,.04)', border: `1px solid ${gv.gbdr}`, borderRadius: 6, color: gv.ts, fontSize: 10, padding: '4px 8px', fontFamily: mn, outline: 'none' }}
      />
    </div>
  )
}

// ─── Platform Multi-Select Dropdown ──────────────────────────────────────────
function PlatformMultiSelect({ value, onChange }: {
  value: PlatformId[]
  onChange: (ids: PlatformId[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggle = (id: PlatformId) =>
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id])

  const label = value.length === 0
    ? 'Select platforms…'
    : value.map(id => ALL_PLATFORMS.find(p => p.id === id)?.label ?? id).join(', ')

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ ...inputStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
      >
        <span style={{ color: value.length === 0 ? gv.td : gv.tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontSize: 13 }}>
          {label}
        </span>
        <span style={{ color: gv.td, fontSize: 10, marginLeft: 8, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200, background: gv.bg, border: `1px solid ${gv.cbdr}`, borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.5)', maxHeight: 260, overflowY: 'auto' }}>
          {ALL_PLATFORMS.map(p => {
            const isSelected = value.includes(p.id)
            return (
              <div
                key={p.id}
                onClick={() => toggle(p.id)}
                style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: isSelected ? `${gv.ac}12` : 'transparent', transition: 'background .1s' }}
              >
                <div style={{ width: 15, height: 15, borderRadius: 4, border: `2px solid ${isSelected ? gv.ac : gv.gbdr}`, background: isSelected ? gv.ac : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isSelected && <span style={{ color: '#000', fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                </div>
                <PlatformIcon p={p.id} s={18} />
                <span style={{ fontSize: 13, color: gv.tx }}>{p.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Create Campaign Modal ────────────────────────────────────────────────────
function CreateCampaignModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation()

  const [name,          setName]          = useState('')
  const [description,   setDescription]   = useState('')
  const [personaId,     setPersonaId]     = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [platforms,     setPlatforms]     = useState<PlatformId[]>([])
  const [cronExpr,      setCronExpr]      = useState('')

  const [personas, setPersonas] = useState<PersonaItem[]>([])
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState('')

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    void api.personas.list().then(res => {
      if (Array.isArray(res)) {
        setPersonas((res as Array<Record<string, unknown>>).map(p => ({
          id: String(p['id']), name: String(p['name'] ?? p['id']),
        })))
      }
    })
  }, [])

  const handleSave = async () => {
    if (!name.trim()) { setErr('Campaign name is required'); return }
    if (platforms.length === 0) { setErr('Select at least one platform'); return }
    setSaving(true); setErr('')
    try {
      await window.electronAPI?.campaigns.create({
        name: name.trim(),
        description: description.trim(),
        platforms,
        personaId: personaId || null,
        coverImageUrl: coverImageUrl.trim() || null,
        channelIds: [],
        cronExpr: cronExpr || null,
      })
      onCreated(); onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create campaign')
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 520, maxHeight: '90vh', overflowY: 'auto', background: gv.card, borderRadius: 16, border: `1px solid ${gv.cbdr}`, padding: 28, boxShadow: '0 24px 48px rgba(0,0,0,.5)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>
            {t('campaigns.modal_create_title', 'Create Campaign')}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: gv.td, cursor: 'pointer', fontSize: 16, padding: 4 }}>✕</button>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 14 }}>
          <div style={lblStyle}>CAMPAIGN NAME *</div>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Q4 Product Launch" style={inputStyle} />
        </div>

        {/* Description */}
        <div style={{ marginBottom: 14 }}>
          <div style={lblStyle}>DESCRIPTION</div>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="What is this campaign about?" rows={2}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
        </div>

        {/* Platforms */}
        <div style={{ marginBottom: 14 }}>
          <div style={lblStyle}>PLATFORMS *</div>
          <PlatformMultiSelect value={platforms} onChange={setPlatforms} />
          {platforms.length > 0 && (
            <div style={{ fontSize: 10, color: gv.td, marginTop: 4 }}>
              {platforms.length} platform{platforms.length > 1 ? 's' : ''} selected
            </div>
          )}
        </div>

        {/* Persona */}
        <div style={{ marginBottom: 14 }}>
          <div style={lblStyle}>PERSONA</div>
          <select value={personaId} onChange={e => setPersonaId(e.target.value)} style={selStyle}>
            <option value="">-- No persona --</option>
            {personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {personas.length === 0 && (
            <div style={{ fontSize: 10, color: gv.td, marginTop: 4 }}>No personas — add one in Settings → Personas</div>
          )}
        </div>

        {/* Cover Image URL */}
        <div style={{ marginBottom: 14 }}>
          <div style={lblStyle}>COVER IMAGE URL</div>
          <input value={coverImageUrl} onChange={e => setCoverImageUrl(e.target.value)}
            placeholder="https://... or leave blank" style={inputStyle} />
          {coverImageUrl && (
            <img src={coverImageUrl} alt="cover preview"
              style={{ marginTop: 8, width: '100%', height: 100, objectFit: 'cover', borderRadius: 8, border: `1px solid ${gv.gbdr}` }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
        </div>

        {/* Schedule (cron) */}
        <div style={{ marginBottom: 20 }}>
          <div style={lblStyle}>RECURRING SCHEDULE</div>
          <CronSchedulePicker value={cronExpr} onChange={setCronExpr} />
          {cronExpr
            ? <div style={{ fontSize: 11, color: gv.ac, marginTop: 6 }}>⏰ {humanCron(cronExpr)}</div>
            : <div style={{ fontSize: 11, color: gv.td, marginTop: 4 }}>No schedule — trigger manually</div>
          }
        </div>

        {err && <div style={{ fontSize: 12, color: '#ff6b6b', marginBottom: 12 }}>{err}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button primary onClick={() => void handleSave()} disabled={saving || !name.trim()}>
            {saving ? 'Creating...' : 'Create Campaign'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit Campaign Modal ──────────────────────────────────────────────────────
function EditCampaignModal({ campaign, onClose, onSaved }: { campaign: CampaignRecord; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState(campaign.name)
  const [description, setDescription] = useState(campaign.description)
  const [platforms, setPlatforms] = useState<PlatformId[]>(campaign.platforms)
  const [personaId, setPersonaId] = useState(campaign.personaId ?? '')
  const [coverImageUrl, setCoverImageUrl] = useState(campaign.coverImageUrl ?? '')
  const [cronExpr, setCronExpr] = useState(campaign.cronExpr ?? '')
  const [personas, setPersonas] = useState<PersonaItem[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    void api.personas.list().then(res => {
      if (Array.isArray(res)) {
        setPersonas((res as Array<Record<string, unknown>>).map(p => ({
          id: String(p['id']), name: String(p['name'] ?? p['id']),
        })))
      }
    })
  }, [])

  const handleSave = async () => {
    if (!name.trim()) { setErr('Name is required'); return }
    if (platforms.length === 0) { setErr('Select at least one platform'); return }
    setSaving(true); setErr('')
    try {
      await window.electronAPI?.campaigns.update(campaign.id, {
        name: name.trim(),
        description: description.trim(),
        platforms,
        personaId: personaId || null,
        coverImageUrl: coverImageUrl.trim() || null,
        cronExpr: cronExpr.trim() || null,
      })
      onSaved(); onClose()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Save failed'); setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm(t('campaigns.confirm_delete', 'Delete this campaign permanently?'))) return
    setDeleting(true)
    await window.electronAPI?.campaigns.delete(campaign.id)
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 520, maxHeight: '90vh', overflowY: 'auto', background: gv.card, borderRadius: 16, border: `1px solid ${gv.cbdr}`, padding: 28, boxShadow: '0 24px 48px rgba(0,0,0,.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Edit Campaign</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: gv.td, cursor: 'pointer', fontSize: 16, padding: 4 }}>✕</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={lblStyle}>NAME *</div>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={lblStyle}>DESCRIPTION</div>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={lblStyle}>PLATFORMS *</div>
          <PlatformMultiSelect value={platforms} onChange={setPlatforms} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={lblStyle}>PERSONA</div>
          <select value={personaId} onChange={e => setPersonaId(e.target.value)} style={selStyle}>
            <option value="">-- No persona --</option>
            {personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {personas.length === 0 && (
            <div style={{ fontSize: 10, color: gv.td, marginTop: 4 }}>No personas — add one in Settings → Personas</div>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={lblStyle}>COVER IMAGE URL</div>
          <input value={coverImageUrl} onChange={e => setCoverImageUrl(e.target.value)}
            placeholder="https://... or leave blank" style={inputStyle} />
          {coverImageUrl && (
            <img src={coverImageUrl} alt="cover preview"
              style={{ marginTop: 8, width: '100%', height: 100, objectFit: 'cover', borderRadius: 8, border: `1px solid ${gv.gbdr}` }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={lblStyle}>RECURRING SCHEDULE</div>
          <CronSchedulePicker value={cronExpr} onChange={setCronExpr} />
          {cronExpr
            ? <div style={{ fontSize: 11, color: gv.ac, marginTop: 6 }}>⏰ {humanCron(cronExpr)}</div>
            : <div style={{ fontSize: 11, color: gv.td, marginTop: 4 }}>No schedule — trigger manually</div>
          }
        </div>

        {err && <div style={{ fontSize: 12, color: gv.rd, marginBottom: 12 }}>{err}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={() => void handleDelete()} disabled={deleting} sx={{ color: gv.rd, borderColor: `${gv.rd}40` }}>
            <Ic.Trash /> {deleting ? 'Deleting…' : 'Delete'}
          </Button>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button onClick={onClose} disabled={saving}>Cancel</Button>
            <Button primary onClick={() => void handleSave()} disabled={saving || !name.trim()}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Campaigns Page ───────────────────────────────────────────────────────────
export const CampaignsPage = () => {
  const { t } = useTranslation()
  const { setNav, setContentCampaignId } = useUIStore()
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editCampaign, setEditCampaign] = useState<CampaignRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState<string | null>(null)
  const [triggered, setTriggered] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    const result = await (window.electronAPI?.campaigns.list() ?? Promise.resolve([]))
    if (Array.isArray(result)) {
      setCampaigns((result as CampaignRecord[]).map(r => ({ ...r, createdAt: new Date(r.createdAt) })))
    }
    setLoading(false)
  }

  useEffect(() => { void loadData() }, [])

  const handleTrigger = async (campaignId: string) => {
    setTriggering(campaignId)
    try {
      await window.electronAPI?.campaigns.trigger(campaignId)
      setTriggered(campaignId)
      setTimeout(() => setTriggered(null), 3000)
    } catch { /* ignore */ }
    finally { setTriggering(null) }
  }

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      {showCreate && <CreateCampaignModal onClose={() => setShowCreate(false)} onCreated={() => void loadData()} />}
      {editCampaign && <EditCampaignModal campaign={editCampaign} onClose={() => setEditCampaign(null)} onSaved={() => void loadData()} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{t('campaigns.title', 'Campaigns')}</div>
          <div style={{ fontSize: 11, color: gv.td, marginTop: 2 }}>{t('campaigns.desc', 'Organize your content initiatives')}</div>
        </div>
        <Button primary sm onClick={() => setShowCreate(true)}><Ic.Plus /> {t('campaigns.btn_new_campaign', 'New Campaign')}</Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: gv.td, fontSize: 12 }}>Loading...</div>
      ) : campaigns.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: gv.td }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>🎯</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: gv.ts, marginBottom: 8 }}>No campaigns yet</div>
          <div style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 300, margin: '0 auto', marginBottom: 20 }}>
            Create a campaign with platforms and a schedule — it runs automatically without needing separate agents.
          </div>
          <Button primary sm onClick={() => setShowCreate(true)}><Ic.Plus /> Create First Campaign</Button>
        </div>
      ) : (
        campaigns.map(c => {
          const isTriggering = triggering === c.id
          const isTriggered = triggered === c.id
          return (
            <Card key={c.id} sx={{ padding: 16, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                {c.coverImageUrl
                  ? <img src={c.coverImageUrl} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  : (
                    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      {(c.platforms.length > 0 ? c.platforms : ['x' as PlatformId]).map((p, j) => (
                        <div key={j} style={{ marginLeft: j > 0 ? -6 : 0, zIndex: c.platforms.length - j }}>
                          <PlatformIcon p={p} s={28} />
                        </div>
                      ))}
                    </div>
                  )
                }

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</div>
                  {c.description && (
                    <div style={{ fontSize: 12, color: gv.td, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' }}>
                    <StatusBadge s={c.status} />
                    {c.cronExpr ? (
                      <span style={{ fontSize: 10, background: c.cronStatus === 'active' ? `${gv.ac}18` : 'rgba(255,255,255,.06)', color: c.cronStatus === 'active' ? gv.ac : gv.td, padding: '2px 7px', borderRadius: 4 }}>
                        ⏰ {humanCron(c.cronExpr)}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, color: gv.td, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,.04)' }}>No schedule</span>
                    )}
                    {isTriggered && <span style={{ fontSize: 10, color: gv.gr, fontWeight: 600 }}>✓ Started</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <Button sm onClick={() => { setContentCampaignId(c.id); setNav('content') }}>
                    <Ic.File /> Content
                  </Button>
                  {isTriggered ? (
                    <span style={{ fontSize: 11, color: gv.gr, fontWeight: 600, padding: '4px 10px' }}>✓ Running</span>
                  ) : (
                    <Button primary sm onClick={() => void handleTrigger(c.id)} disabled={isTriggering}>
                      {isTriggering ? '…' : <><Ic.Play /> Run Now</>}
                    </Button>
                  )}
                  <Button sm onClick={() => setEditCampaign(c)}><Ic.Edit /></Button>
                </div>
              </div>
            </Card>
          )
        })
      )}
    </div>
  )
}
