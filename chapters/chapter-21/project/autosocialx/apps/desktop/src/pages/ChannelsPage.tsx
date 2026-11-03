import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { PlatformIcon } from '../components/PlatformIcon'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Ic } from '../components/Icon'
import { gv } from '../components/tokens'
import type { PlatformId } from '../types'

// ─── Static metadata for built-in platforms ──────────────────────────────────
// Only used for display (descriptions, char limits, extra param keys).
// The actual channel list is loaded from the channels DB table.

interface ExtraParam {
    key: string
    label: string
    placeholder: string
}

interface PlatformMeta {
    description: string
    charLimit: number
    media: string[]
    contentStyle: string
    extraParams?: ExtraParam[]
}

const PLATFORM_META: Record<string, PlatformMeta> = {
    x: {
        description: 'Short-form public posts. Real-time conversation, news, and threads.',
        charLimit: 280, media: ['image', 'video', 'gif'],
        contentStyle: 'Punchy, direct, conversational',
    },
    linkedin: {
        description: 'Professional network. Long-form posts, articles, and career insights.',
        charLimit: 3000, media: ['image', 'video', 'document'],
        contentStyle: 'Professional, data-driven, authoritative',
    },
    instagram: {
        description: 'Visual storytelling. Photos, Reels, and carousels with caption copy.',
        charLimit: 2200, media: ['image', 'video', 'carousel'],
        contentStyle: 'Visual-first, aspirational, community-driven',
    },
    facebook: {
        description: 'Broad social network. Posts, events, and community group content.',
        charLimit: 63206, media: ['image', 'video', 'link'],
        contentStyle: 'Accessible, community-focused, shareable',
    },
    pinterest: {
        description: 'Visual discovery and bookmarking. Pins with keyword-rich descriptions.',
        charLimit: 500, media: ['image', 'video'],
        contentStyle: 'Inspirational, SEO-rich, idea-board format',
        extraParams: [{ key: 'board_id', label: 'Board ID', placeholder: 'e.g. 123456789' }],
    },
    discord: {
        description: 'Community platform. Posts sent via Discord Webhook URL.',
        charLimit: 2000, media: ['image', 'video'],
        contentStyle: 'Community-driven, casual, direct',
    },
    slack: {
        description: 'Team messaging platform. Posts sent to a configured channel.',
        charLimit: 4000, media: ['image'],
        contentStyle: 'Professional, concise, team-oriented',
        extraParams: [{ key: 'channel', label: 'Channel', placeholder: 'e.g. #general' }],
    },
    xiaohongshu: {
        description: 'Lifestyle discovery platform. Image-heavy carousel posts.',
        charLimit: 1000, media: ['image (3–9)', 'video'],
        contentStyle: 'Lifestyle, aesthetic, detailed with hashtags',
    },
}

// ─── Channel row type (mirrors electron.d.ts) ─────────────────────────────────

interface ChannelRow {
    id: string
    platform: string
    name: string
    enabled: boolean
    webhookUrl: string | null
    config: Record<string, string>
    createdAt: string
}

// ─── Add Channel Modal ────────────────────────────────────────────────────────

function AddChannelModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
    const [platform, setPlatform] = useState('')
    const [name, setName] = useState('')
    const [webhookUrl, setWebhookUrl] = useState('')
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState('')

    const inp: React.CSSProperties = {
        width: '100%', background: 'rgba(255,255,255,.05)', border: `1px solid ${gv.gbdr}`,
        borderRadius: 8, color: gv.tx, fontSize: 13, padding: '9px 12px', outline: 'none',
        boxSizing: 'border-box',
    }
    const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: gv.td, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }

    const handleSave = async () => {
        if (!platform.trim()) { setErr('Platform ID is required'); return }
        if (!name.trim()) { setErr('Display name is required'); return }
        setSaving(true)
        setErr('')
        try {
            await window.electronAPI?.channels.create(
                platform.trim().toLowerCase(),
                name.trim(),
                webhookUrl.trim() || undefined,
            )
            onAdded()
            onClose()
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'Failed to add channel')
            setSaving(false)
        }
    }

    return (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{ width: 440, background: gv.card, borderRadius: 16, border: `1px solid ${gv.cbdr}`, padding: 28, boxShadow: '0 24px 48px rgba(0,0,0,.5)' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>Add Channel</div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: gv.td, cursor: 'pointer', fontSize: 16, padding: 4 }}>✕</button>
                </div>

                <div style={{ marginBottom: 14 }}>
                    <div style={lbl}>Platform ID *</div>
                    <input autoFocus value={platform} onChange={e => setPlatform(e.target.value)} placeholder="e.g. telegram, newsletter" style={inp} />
                </div>

                <div style={{ marginBottom: 14 }}>
                    <div style={lbl}>Display Name *</div>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. My Telegram Channel" style={inp} />
                </div>

                <div style={{ marginBottom: 22 }}>
                    <div style={lbl}>n8n Webhook URL (optional override)</div>
                    <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://your-n8n.com/webhook/..." style={inp} />
                    <div style={{ fontSize: 10, color: gv.td, marginTop: 4 }}>Leave empty to use the global webhook from Settings → Publish API</div>
                </div>

                {err && <div style={{ fontSize: 12, color: gv.rd, marginBottom: 12 }}>{err}</div>}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <Button onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button primary onClick={() => void handleSave()} disabled={saving || !platform.trim() || !name.trim()}>
                        {saving ? 'Adding…' : 'Add Channel'}
                    </Button>
                </div>
            </div>
        </div>
    )
}

// ─── Editable field ───────────────────────────────────────────────────────────

function EditableField({
    label, value, placeholder, onCommit,
}: {
    label: string
    value: string
    placeholder: string
    onCommit: (val: string) => Promise<void>
}) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(value)
    const [saving, setSaving] = useState(false)

    const commit = async () => {
        if (draft === value) { setEditing(false); return }
        setSaving(true)
        await onCommit(draft.trim())
        setSaving(false)
        setEditing(false)
    }

    if (editing) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: gv.td, minWidth: 60 }}>{label}:</span>
                <input
                    autoFocus
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void commit(); if (e.key === 'Escape') setEditing(false) }}
                    onBlur={() => void commit()}
                    placeholder={placeholder}
                    style={{
                        flex: 1, background: 'rgba(255,255,255,.07)', border: `1px solid ${gv.ac}60`,
                        borderRadius: 5, color: gv.tx, fontSize: 11, padding: '3px 8px', outline: 'none',
                    }}
                />
                {saving && <span style={{ fontSize: 10, color: gv.td }}>…</span>}
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: gv.td, minWidth: 60 }}>{label}:</span>
            <span
                style={{
                    fontSize: 11, color: value ? gv.tx : gv.td, fontStyle: value ? 'normal' : 'italic',
                    cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
                    background: 'rgba(255,255,255,.04)', border: '1px solid transparent',
                }}
                onClick={() => { setDraft(value); setEditing(true) }}
                title="Click to edit"
            >
                {value || 'Not set — click to configure'}
            </span>
            <button
                onClick={() => { setDraft(value); setEditing(true) }}
                style={{ background: 'none', border: 'none', color: gv.td, cursor: 'pointer', padding: 2, display: 'flex' }}
            >
                <Ic.Edit />
            </button>
        </div>
    )
}

// ─── Channel Card ─────────────────────────────────────────────────────────────

function ChannelCard({
    ch, onToggle, onDelete, onWebhookChange, onConfigChange,
}: {
    ch: ChannelRow
    onToggle: (enabled: boolean) => void
    onDelete: () => void
    onWebhookChange: (url: string) => Promise<void>
    onConfigChange: (key: string, val: string) => Promise<void>
}) {
    const meta = PLATFORM_META[ch.platform]
    const isBuiltin = ch.id.startsWith('builtin-')

    return (
        <Card sx={{ padding: '16px 18px', opacity: ch.enabled ? 1 : 0.55 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                {/* Icon */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    <PlatformIcon p={ch.platform as PlatformId} s={40} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{ch.name}</div>
                        {!isBuiltin && (
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: `${gv.yl}18`, color: gv.yl, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                                Custom
                            </span>
                        )}
                    </div>

                    {meta && (
                        <>
                            <div style={{ fontSize: 11, color: gv.td, lineHeight: 1.5, marginBottom: 8 }}>{meta.description}</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: `${gv.cc}14`, color: gv.cc, fontWeight: 600 }}>
                                    {meta.charLimit >= 10000 ? `${Math.round(meta.charLimit / 1000)}K` : meta.charLimit} chars
                                </span>
                                {meta.media.map(m => (
                                    <span key={m} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: `${gv.ac}12`, color: gv.ac, fontWeight: 600 }}>
                                        {m}
                                    </span>
                                ))}
                            </div>
                            <div style={{ fontSize: 10, color: gv.td, marginTop: 5, fontStyle: 'italic' }}>{meta.contentStyle}</div>

                            {/* Extra config params (board_id, slack channel, etc.) */}
                            {meta.extraParams?.map(param => (
                                <EditableField
                                    key={param.key}
                                    label={param.label}
                                    value={ch.config[param.key] ?? ''}
                                    placeholder={param.placeholder}
                                    onCommit={val => onConfigChange(param.key, val)}
                                />
                            ))}
                        </>
                    )}

                    {/* Per-channel webhook URL override */}
                    <EditableField
                        label="Webhook"
                        value={ch.webhookUrl ?? ''}
                        placeholder="https://your-n8n.com/webhook/… (overrides global)"
                        onCommit={onWebhookChange}
                    />
                </div>

                {/* Right actions */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                    {/* Enabled toggle */}
                    <button
                        onClick={() => onToggle(!ch.enabled)}
                        style={{
                            width: 36, height: 20, borderRadius: 10,
                            background: ch.enabled ? gv.gr : gv.gbdr,
                            border: 'none', cursor: 'pointer', position: 'relative', transition: 'background .2s',
                        }}
                        title={ch.enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
                    >
                        <div style={{
                            position: 'absolute', top: 3, left: ch.enabled ? 18 : 3,
                            width: 14, height: 14, borderRadius: 7,
                            background: '#fff', transition: 'left .2s',
                        }} />
                    </button>

                    {/* Delete (only for custom channels) */}
                    {!isBuiltin && (
                        <button
                            onClick={onDelete}
                            style={{ background: 'none', border: 'none', color: gv.td, cursor: 'pointer', padding: 4, display: 'flex' }}
                            title="Remove channel"
                        >
                            <Ic.Trash />
                        </button>
                    )}
                </div>
            </div>
        </Card>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export const ChannelsPage = () => {
    const { t } = useTranslation()
    const [showAdd, setShowAdd] = useState(false)
    const [channels, setChannels] = useState<ChannelRow[]>([])

    const load = async () => {
        const res = await window.electronAPI?.channels.list()
        if (Array.isArray(res)) setChannels(res as ChannelRow[])
    }

    useEffect(() => { void load() }, [])

    const handleToggle = async (id: string, enabled: boolean) => {
        await window.electronAPI?.channels.toggle(id, enabled)
        setChannels(prev => prev.map(c => c.id === id ? { ...c, enabled } : c))
    }

    const handleDelete = async (id: string) => {
        await window.electronAPI?.channels.delete(id)
        setChannels(prev => prev.filter(c => c.id !== id))
    }

    const handleWebhookChange = async (id: string, url: string) => {
        const webhookUrl = url.trim() || null
        await window.electronAPI?.channels.setWebhook(id, webhookUrl)
        setChannels(prev => prev.map(c => c.id === id ? { ...c, webhookUrl } : c))
    }

    const handleConfigChange = async (id: string, key: string, val: string) => {
        const ch = channels.find(c => c.id === id)
        if (!ch) return
        const newConfig = { ...ch.config, [key]: val }
        await window.electronAPI?.channels.setConfig(id, newConfig)
        setChannels(prev => prev.map(c => c.id === id ? { ...c, config: newConfig } : c))
    }

    const builtin = channels.filter(c => c.id.startsWith('builtin-'))
    const custom = channels.filter(c => !c.id.startsWith('builtin-'))

    return (
        <div style={{ height: '100%', overflow: 'auto' }}>
            {showAdd && <AddChannelModal onClose={() => setShowAdd(false)} onAdded={() => { void load(); setShowAdd(false) }} />}

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <div style={{ fontSize: 17, fontWeight: 800 }}>{t('channels.title', 'Channels')}</div>
                    <div style={{ fontSize: 11, color: gv.td, marginTop: 3 }}>
                        {t('channels.desc', 'Publishing destinations. Toggle to enable/disable. All publish via n8n webhook.')}
                    </div>
                </div>
                <Button primary sm onClick={() => setShowAdd(true)}>
                    <Ic.Plus /> {t('channels.btn_add', 'Add Channel')}
                </Button>
            </div>

            {/* Built-in channels */}
            <div style={{ fontSize: 11, fontWeight: 700, color: gv.td, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
                Built-in ({builtin.length})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 10, marginBottom: 24 }}>
                {builtin.map(ch => (
                    <ChannelCard
                        key={ch.id}
                        ch={ch}
                        onToggle={enabled => void handleToggle(ch.id, enabled)}
                        onDelete={() => void handleDelete(ch.id)}
                        onWebhookChange={url => handleWebhookChange(ch.id, url)}
                        onConfigChange={(key, val) => handleConfigChange(ch.id, key, val)}
                    />
                ))}
            </div>

            {/* Custom channels */}
            {custom.length > 0 && (
                <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: gv.td, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
                        Custom ({custom.length})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 10 }}>
                        {custom.map(ch => (
                            <ChannelCard
                                key={ch.id}
                                ch={ch}
                                onToggle={enabled => void handleToggle(ch.id, enabled)}
                                onDelete={() => void handleDelete(ch.id)}
                                onWebhookChange={url => handleWebhookChange(ch.id, url)}
                                onConfigChange={(key, val) => handleConfigChange(ch.id, key, val)}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
