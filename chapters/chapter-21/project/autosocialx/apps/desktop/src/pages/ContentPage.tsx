import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Badge, StatusBadge } from '../components/Badge'
import { PlatformIcon } from '../components/PlatformIcon'
import { Ic } from '../components/Icon'
import { gv, mn, platformLabel } from '../components/tokens'
import { PlatformPreviewCard } from '../components/PlatformPreviewCard'
import type { ContentStatus, PlatformId } from '../types'
import { useUIStore } from '../store/ui'

// ─── Types ───────────────────────────────────────────────────────────────────

type FilterTab = 'all' | ContentStatus
const FILTERS: FilterTab[] = ['all', 'published', 'scheduled', 'queued', 'draft', 'failed']
type ContentType = 'text' | 'images' | 'video'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024   // 5 MB per image
const MAX_VIDEO_BYTES = 50 * 1024 * 1024  // 50 MB video

interface ContentRow {
  id: string
  agent_id: string
  platform: PlatformId
  text: string
  media_urls: string        // JSON string in DB
  status: ContentStatus
  scheduled_at: number | null
  published_at: number | null
  post_id: string | null
  stats: string | null      // JSON string in DB
}

interface ContentItem {
  id: string
  agentId: string
  platform: PlatformId
  text: string
  mediaUrls: string[]
  status: ContentStatus
  scheduledAt: number | null
  publishedAt: number | null
  postId: string | null
  stats: Record<string, number>
}

function parseRow(row: ContentRow): ContentItem {
  return {
    id: row.id,
    agentId: row.agent_id,
    platform: row.platform,
    text: row.text,
    mediaUrls: safeParseJson<string[]>(row.media_urls, []),
    status: row.status,
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    postId: row.post_id,
    stats: safeParseJson<Record<string, number>>(row.stats, {}),
  }
}

function safeParseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback
  try { return JSON.parse(s) as T } catch { return fallback }
}

// Need to pass t function to formatTime to handle translations correctly
function formatTime(unixSec: number | null, t: any): string {
  if (!unixSec) return '—'
  const d = new Date(unixSec * 1000)
  const diff = Math.floor((Date.now() - d.getTime()) / 60000)
  if (diff < 1) return t('content.just_now', 'just now')
  if (diff < 60) return t('content.mins_ago', { count: diff, defaultValue: `${diff}m ago` })
  if (diff < 1440) return t('content.hours_ago', { count: Math.floor(diff / 60), defaultValue: `${Math.floor(diff / 60)}h ago` })
  return d.toLocaleString()
}

function isVideoDataUrl(url: string): boolean {
  return url.startsWith('data:video/')
}

function charLimit(p: PlatformId): number {
  if (p === 'x') return 280
  if (p === 'xiaohongshu') return 1000
  return 3000
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({
  item,
  agentName,
  onClose,
  onDeleted,
  onPublished,
}: {
  item: ContentItem
  agentName: string | null
  onClose: () => void
  onDeleted: () => void
  onPublished: () => void
}) {
  const { t } = useTranslation()
  const [publishing, setPublishing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [publishResult, setPublishResult] = useState<{ ok: boolean; error?: string } | null>(null)

  const handlePublish = async () => {
    setPublishing(true)
    setPublishResult(null)
    const r = await window.electronAPI?.content.publish(item.id) ?? { success: false, error: 'No API' }
    setPublishResult({ ok: r.success, error: r.error })
    setPublishing(false)
    if (r.success) onPublished()
  }

  const handleDelete = async () => {
    if (!confirm(t('content.detail_delete_confirm', 'Delete this post permanently?'))) return
    setDeleting(true)
    await window.electronAPI?.content.delete(item.id)
    setDeleting(false)
    onDeleted()
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 700, maxHeight: '90vh', background: gv.card, border: `1px solid ${gv.cbdr}`, borderRadius: 18, boxShadow: '0 32px 100px rgba(0,0,0,.7)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: `1px solid ${gv.cbdr}` }}>
          <PlatformIcon p={item.platform} s={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{platformLabel(item.platform)}</div>
            <div style={{ fontSize: 11, color: gv.td, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.agentId === 'manual'
                ? t('content.detail_manual', 'Manual post')
                : agentName
                  ? agentName
                  : t('content.detail_agent_prefix', { id: item.agentId.slice(0, 8), defaultValue: `Agent ${item.agentId.slice(0, 8)}` })}
            </div>
          </div>
          <StatusBadge s={item.status} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: gv.td, cursor: 'pointer', fontSize: 20, padding: '2px 6px', lineHeight: 1, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Body – scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {/* Platform preview */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: gv.td, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>{t('content.detail_preview', 'Preview')}</div>
            <PlatformPreviewCard platform={item.platform} text={item.text} mediaUrls={item.mediaUrls} />
          </div>

          {/* Extra media thumbnails (for images post) */}
          {item.mediaUrls.length > 1 && !isVideoDataUrl(item.mediaUrls[0]) && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: gv.td, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{t('content.detail_all_media', { count: item.mediaUrls.length, defaultValue: `All Media (${item.mediaUrls.length})` })}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {item.mediaUrls.map((url, i) => (
                  <img key={i} src={url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: `1px solid ${gv.cbdr}` }} />
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { label: t('content.detail_status', 'Status'), value: t(`content.status_${item.status}`, item.status) },
              { label: item.status === 'published' ? t('content.detail_published_at', 'Published at') : item.status === 'scheduled' ? t('content.detail_scheduled_at', 'Scheduled at') : t('content.detail_created_at', 'Created at'), value: formatTime(item.status === 'published' ? item.publishedAt : item.scheduledAt, t) },
              { label: t('content.detail_platform_id', 'Platform post ID'), value: item.postId ?? '—' },
              { label: t('content.detail_chars', 'Characters'), value: `${item.text.length} / ${charLimit(item.platform)}` },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${gv.gbdr}` }}>
                <span style={{ fontSize: 12, color: gv.td }}>{row.label}</span>
                <span style={{ fontSize: 12, fontFamily: mn, color: gv.tx }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${gv.cbdr}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button sm onClick={() => void handleDelete()} disabled={deleting} sx={{ color: gv.rd, borderColor: `${gv.rd}40` }}>
            <Ic.Trash /> {deleting ? t('content.btn_deleting', 'Deleting…') : t('content.btn_delete', 'Delete')}
          </Button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {publishResult && (
              <span style={{ fontSize: 11, color: publishResult.ok ? gv.gr : gv.rd }}>
                {publishResult.ok ? t('content.published_success', '✓ Published') : t('content.publish_error', { error: publishResult.error, defaultValue: `✗ ${publishResult.error}` })}
              </span>
            )}
            {(item.status === 'queued' || item.status === 'scheduled' || item.status === 'draft') && (
              <Button primary sm onClick={() => void handlePublish()} disabled={publishing}>
                {publishing ? t('content.btn_publishing', 'Publishing…') : t('content.btn_publish_now', 'Publish Now')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── New Post Modal ───────────────────────────────────────────────────────────

function NewPostModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation()
  const [platformOptions, setPlatformOptions] = useState<{ value: string; label: string }[]>([
    { value: 'x', label: 'X (Twitter)' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'xiaohongshu', label: '小红书' },
  ])
  const [platform, setPlatform] = useState<PlatformId>('x')
  const [contentType, setContentType] = useState<ContentType>('text')
  const [text, setText] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [images, setImages] = useState<string[]>([])   // data URLs
  const [video, setVideo] = useState<string | null>(null)  // data URL
  const [saving, setSaving] = useState(false)
  const [mediaError, setMediaError] = useState('')

  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.electronAPI?.channels.list().then(list => {
      const enabled = list.filter(c => c.enabled)
      if (enabled.length > 0) {
        setPlatformOptions(enabled.map(c => ({ value: c.platform, label: c.name })))
        setPlatform(enabled[0].platform as PlatformId)
      }
    }).catch(() => {})
  }, [])

  const limit = charLimit(platform)
  const over = text.length > limit
  const maxImages = platform === 'x' ? 4 : 9

  // Reset media when switching content type
  const switchType = (t: ContentType) => {
    setContentType(t)
    setImages([])
    setVideo(null)
    setMediaError('')
  }

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMediaError('')
    const files = Array.from(e.target.files ?? [])
    const slots = maxImages - images.length
    const toAdd = files.slice(0, slots)
    toAdd.forEach(file => {
      if (file.size > MAX_IMAGE_BYTES) {
        setMediaError(`"${file.name}" exceeds 5 MB limit`)
        return
      }
      const reader = new FileReader()
      reader.onload = ev => {
        setImages(prev => [...prev, ev.target!.result as string])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const handleVideoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMediaError('')
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_VIDEO_BYTES) {
      setMediaError(`Video exceeds 50 MB limit`)
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = ev => setVideo(ev.target!.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const removeImage = (idx: number) => setImages(prev => prev.filter((_, i) => i !== idx))

  const mediaUrls: string[] = contentType === 'images' ? images : contentType === 'video' && video ? [video] : []

  const handleSave = async (asDraft = false) => {
    if (!text.trim() && mediaUrls.length === 0) return
    setSaving(true)
    await window.electronAPI?.content.create({
      platform,
      text,
      mediaUrls,
      scheduledAt: scheduledAt || undefined,
      status: asDraft ? 'draft' : 'queued',
    })
    setSaving(false)
    onCreated()
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 560, background: gv.card, border: `1px solid ${gv.cbdr}`, borderRadius: 18, padding: '20px 24px', boxShadow: '0 24px 80px rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '92vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{t('content.modal_title', 'New Post')}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: gv.td, cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {/* Platform selector */}
        <div>
          <div style={{ fontSize: 11, color: gv.td, marginBottom: 6 }}>{t('content.modal_platform', 'Platform')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {platformOptions.map(p => (
              <button key={p.value} onClick={() => setPlatform(p.value as PlatformId)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, border: `1px solid ${platform === p.value ? gv.cc : gv.gbdr}`, background: platform === p.value ? `${gv.cc}15` : 'transparent', cursor: 'pointer', color: gv.tx, fontSize: 11 }}>
                <PlatformIcon p={p.value as PlatformId} s={16} />{p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content type */}
        <div>
          <div style={{ fontSize: 11, color: gv.td, marginBottom: 6 }}>{t('content.modal_type', 'Content Type')}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['text', 'images', 'video'] as ContentType[]).map(typeKey => (
              <button key={typeKey} onClick={() => switchType(typeKey)} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${contentType === typeKey ? gv.cc : gv.gbdr}`, background: contentType === typeKey ? `${gv.cc}15` : 'transparent', cursor: 'pointer', color: contentType === typeKey ? gv.cc : gv.ts, fontSize: 12, fontWeight: contentType === typeKey ? 700 : 400 }}>
                {typeKey === 'text' ? t('content.modal_type_text', '📝 Text Only') : typeKey === 'images' ? t('content.modal_type_images', '🖼 Images') : t('content.modal_type_video', '🎥 Video')}
              </button>
            ))}
          </div>
        </div>

        {/* Text area */}
        <div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={contentType === 'video' ? t('content.modal_placeholder_video', 'Video caption...') : contentType === 'images' ? t('content.modal_placeholder_images', 'Write a caption for your images...') : t('content.modal_placeholder_text', 'Write your post...')}
            rows={4}
            style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: `1px solid ${over ? gv.rd : gv.gbdr}`, borderRadius: 10, color: gv.tx, fontSize: 13, lineHeight: 1.6, padding: '10px 14px', fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 3 }}>
            <span style={{ fontSize: 10, fontFamily: mn, color: over ? gv.rd : gv.td }}>{text.length}/{limit}</span>
          </div>
        </div>

        {/* Image picker */}
        {contentType === 'images' && (
          <div>
            <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImagePick} style={{ display: 'none' }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {images.map((url, i) => (
                <div key={i} style={{ position: 'relative', width: 80, height: 80, borderRadius: 8, overflow: 'hidden', border: `1px solid ${gv.cbdr}` }}>
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    onClick={() => removeImage(i)}
                    style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: 9, background: 'rgba(0,0,0,.6)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                  >✕</button>
                </div>
              ))}
              {images.length < maxImages && (
                <button
                  onClick={() => imageInputRef.current?.click()}
                  style={{ width: 80, height: 80, borderRadius: 8, border: `2px dashed ${gv.gbdr}`, background: 'transparent', color: gv.td, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 22 }}
                >
                  <span>+</span>
                  <span style={{ fontSize: 9, color: gv.td }}>{t('content.modal_add_image', 'Add image')}</span>
                </button>
              )}
            </div>
            <div style={{ fontSize: 10, color: gv.td, marginTop: 4 }}>
              {t('content.modal_images_limit', { count: images.length, max: maxImages, defaultValue: `${images.length}/${maxImages} images · max 5 MB each` })}
            </div>
          </div>
        )}

        {/* Video picker */}
        {contentType === 'video' && (
          <div>
            <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoPick} style={{ display: 'none' }} />
            {video ? (
              <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `1px solid ${gv.cbdr}` }}>
                <video src={video} controls style={{ width: '100%', maxHeight: 200, objectFit: 'contain', background: '#000' }} />
                <button
                  onClick={() => setVideo(null)}
                  style={{ position: 'absolute', top: 8, right: 8, padding: '3px 10px', borderRadius: 6, background: 'rgba(0,0,0,.6)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 11 }}
                >{t('content.modal_video_remove', 'Remove')}</button>
              </div>
            ) : (
              <button
                onClick={() => videoInputRef.current?.click()}
                style={{ width: '100%', padding: '24px', borderRadius: 10, border: `2px dashed ${gv.gbdr}`, background: 'transparent', color: gv.td, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, fontSize: 28 }}
              >
                <span>🎥</span>
                <span style={{ fontSize: 12 }}>{t('content.modal_video_hint1', 'Click to select video')}</span>
                <span style={{ fontSize: 10 }}>{t('content.modal_video_hint2', 'Max 50 MB · MP4, WebM, MOV')}</span>
              </button>
            )}
          </div>
        )}

        {/* Media error */}
        {mediaError && (
          <div style={{ fontSize: 11, color: gv.rd, padding: '6px 10px', background: `${gv.rd}10`, borderRadius: 6 }}>
            ⚠ {mediaError}
          </div>
        )}

        {/* Schedule + actions */}
        <div>
          <div style={{ fontSize: 11, color: gv.td, marginBottom: 4 }}>{t('content.modal_schedule_label', 'Schedule (optional)')}</div>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: `1px solid ${gv.gbdr}`, borderRadius: 8, color: gv.ts, fontSize: 12, padding: '7px 10px', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button sm onClick={() => void handleSave(true)} disabled={saving || (!text.trim() && mediaUrls.length === 0)} sx={{ color: gv.td }}>
            {t('content.btn_save_draft', 'Save as Draft')}
          </Button>
          <Button sm onClick={onClose}>{t('content.btn_cancel', 'Cancel')}</Button>
          <Button primary sm onClick={() => void handleSave(false)} disabled={saving || (!text.trim() && mediaUrls.length === 0) || over}>
            {saving ? t('content.btn_saving', 'Saving…') : scheduledAt ? t('content.btn_schedule', '📅 Schedule') : t('content.btn_queue', '⬆ Queue')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Agent Run Queue Panel ────────────────────────────────────────────────────

interface QueueTask { id: string; agentId: string; status: string; enqueuedAt: string; triggerSource: string }

interface DisplayTask extends QueueTask { finishedAt?: number }

function AgentQueuePanel({ agents }: { agents: { id: string; name: string }[] }) {
  const { t } = useTranslation()
  // Merge live tasks + recently finished (kept for 5s so fast tasks are visible)
  const [liveTasks, setLiveTasks] = useState<QueueTask[]>([])
  const [recentDone, setRecentDone] = useState<DisplayTask[]>([])
  const [cancelling, setCancelling] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const list = (await window.electronAPI?.queue.list?.() ?? []) as QueueTask[]
      setLiveTasks(list)
    } catch {
      // silently ignore IPC errors
    }
  }, [])

  // Poll every 3s
  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), 3000)
    return () => clearInterval(timer)
  }, [refresh])

  // On queue:task-status event: refresh immediately; on complete/failed, record finished task
  useEffect(() => {
    const onStatus = (payload: unknown) => {
      void refresh()
      const p = payload as { taskId?: string; status?: string }
      if (p?.status === 'completed' || p?.status === 'failed') {
        // find agent from current liveTasks via ref
        setLiveTasks(prev => {
          const finished = prev.find(t => t.id === p.taskId)
          if (finished) {
            setRecentDone(d => [...d.filter(x => x.id !== finished.id), { ...finished, status: p.status!, finishedAt: Date.now() }])
          }
          return prev
        })
      }
    }
    const onDone = () => void refresh()
    const removeStatus = window.electronAPI?.on('queue:task-status', onStatus)
    const removeComplete = window.electronAPI?.on('agent:run-complete', onDone)
    const removeFailed = window.electronAPI?.on('agent:run-failed', onDone)
    return () => {
      removeStatus?.()
      removeComplete?.()
      removeFailed?.()
    }
  }, [refresh])

  // Clear finished tasks after 5s
  useEffect(() => {
    if (recentDone.length === 0) return
    const timer = setTimeout(() => {
      const now = Date.now()
      setRecentDone(d => d.filter(t => (now - (t.finishedAt ?? 0)) < 5000))
    }, 5000)
    return () => clearTimeout(timer)
  }, [recentDone])

  const handleCancel = async (taskId: string) => {
    setCancelling(taskId)
    await window.electronAPI?.queue.cancel?.(taskId)
    await refresh()
    setCancelling(null)
  }

  // Merge: live tasks first, then recently done (deduped)
  const liveIds = new Set(liveTasks.map(t => t.id))
  const displayTasks: DisplayTask[] = [
    ...liveTasks,
    ...recentDone.filter(t => !liveIds.has(t.id)),
  ]

  if (displayTasks.length === 0) return null

  const agentName = (agentId: string) => agents.find(a => a.id === agentId)?.name ?? agentId.slice(0, 8)

  return (
    <div style={{ marginBottom: 12, background: `${gv.yl}0A`, border: `1px solid ${gv.yl}30`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '8px 14px', borderBottom: `1px solid ${gv.yl}20`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 7, height: 7, borderRadius: 4, background: gv.yl, animation: 'pulse 1.5s infinite' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: gv.yl }}>
          {t('content.queue_running', 'Agent Tasks')} ({displayTasks.length})
        </span>
      </div>
      {displayTasks.map(task => {
        const isDone = task.status === 'completed' || task.status === 'failed'
        return (
          <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: `1px solid ${gv.gbdr}20`, opacity: isDone ? 0.6 : 1 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: task.status === 'running' ? gv.gr : isDone ? (task.status === 'completed' ? gv.gr : gv.rd) : gv.yl, animation: task.status === 'running' ? 'pulse 2s infinite' : 'none' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{agentName(task.agentId)}</span>
              <span style={{ fontSize: 10, color: gv.td, marginLeft: 8 }}>
                {task.status === 'running' ? t('content.task_running', 'Running…')
                  : task.status === 'completed' ? t('content.task_done', 'Done')
                  : task.status === 'failed' ? t('content.task_failed', 'Failed')
                  : t('content.task_queued', 'Waiting in queue')}
              </span>
            </div>
            <StatusBadge s={task.status} />
            {task.status === 'enqueued' && (
              <Button sm onClick={() => void handleCancel(task.id)} disabled={cancelling === task.id} sx={{ color: gv.rd, borderColor: `${gv.rd}40`, flexShrink: 0 }}>
                {cancelling === task.id ? '…' : t('content.btn_cancel_task', 'Cancel')}
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export const ContentPage = () => {
  const { t } = useTranslation()
  const { contentCampaignId, setContentCampaignId } = useUIStore()
  const [ft, setFt] = useState<FilterTab>('all')
  const [rows, setRows] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [detailItem, setDetailItem] = useState<ContentItem | null>(null)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [publishResult, setPublishResult] = useState<Record<string, { ok: boolean; error?: string }>>({})
  const [retryingAll, setRetryingAll] = useState(false)
  const [retryAllResult, setRetryAllResult] = useState<{ succeeded: number; failed: number; total: number } | null>(null)
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const filter: { status?: string; campaignId?: string } = {}
      if (ft !== 'all') filter.status = ft
      if (contentCampaignId) filter.campaignId = contentCampaignId
      const data = await window.electronAPI?.content.list(Object.keys(filter).length ? filter : undefined) ?? []
      const items = (data as ContentRow[]).map(parseRow)
      setRows(items)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [ft, contentCampaignId])

  useEffect(() => { void fetchData() }, [fetchData])

  // Load agent names for queue panel display
  useEffect(() => {
    window.electronAPI?.agents.list().then(raw => {
      if (Array.isArray(raw)) setAgents((raw as { id: string; name: string }[]).map(a => ({ id: a.id, name: a.name })))
    }).catch(() => {})
  }, [])

  // Refresh content list when an agent run completes
  useEffect(() => {
    const handler = () => void fetchData()
    const removeComplete = window.electronAPI?.on('agent:run-complete', handler)
    const removeFailed = window.electronAPI?.on('agent:run-failed', handler)
    return () => {
      removeComplete?.()
      removeFailed?.()
    }
  }, [fetchData])

  const handlePublish = async (id: string) => {
    setPublishing(id)
    const result = await window.electronAPI?.content.publish(id) ?? { success: false, error: 'No API' }
    setPublishResult(prev => ({ ...prev, [id]: { ok: result.success, error: result.error } }))
    setPublishing(null)
    if (result.success) await fetchData()
  }

  const handleRetryAllFailed = async () => {
    setRetryingAll(true)
    setRetryAllResult(null)
    const res = await window.electronAPI?.content.retryFailed() ?? { ok: false, succeeded: 0, failed: 0, total: 0 }
    setRetryAllResult({ succeeded: res.succeeded, failed: res.failed, total: res.total })
    setRetryingAll(false)
    await fetchData()
  }

  const handleCancelQueued = async (id: string) => {
    await window.electronAPI?.content.updateStatus(id, 'draft')
    await fetchData()
  }

  const handleViewDetail = async (id: string) => {
    const row = await window.electronAPI?.content.get(id)
    if (row) setDetailItem(parseRow(row as ContentRow))
  }

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      {showNew && <NewPostModal onClose={() => setShowNew(false)} onCreated={() => void fetchData()} />}
      {detailItem && (
        <DetailModal
          item={detailItem}
          agentName={agents.find(a => a.id === detailItem.agentId)?.name ?? null}
          onClose={() => setDetailItem(null)}
          onDeleted={() => { setDetailItem(null); void fetchData() }}
          onPublished={() => { void fetchData() }}
        />
      )}

      {/* Campaign filter banner */}
      {contentCampaignId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 10, background: `${gv.ac}12`, border: `1px solid ${gv.ac}30`, borderRadius: 8, fontSize: 12 }}>
          <span style={{ color: gv.ac, fontWeight: 600 }}>🎯 Showing content for campaign</span>
          <button
            onClick={() => { setContentCampaignId(null) }}
            style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 5, border: `1px solid ${gv.gbdr}`, background: 'rgba(255,255,255,.06)', color: gv.ts, fontSize: 11, cursor: 'pointer' }}
          >
            ✕ Clear filter
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <Button key={f} sm onClick={() => setFt(f)} sx={{
              background: ft === f ? `${gv.cc}18` : 'rgba(255,255,255,.04)',
              color: ft === f ? gv.cc : gv.ts,
              border: ft === f ? `1px solid ${gv.cc}30` : `1px solid ${gv.gbdr}`,
            }}>
              {t(`content.status_${f}`, f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1))}
            </Button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {(ft === 'failed' || rows.some(r => r.status === 'failed')) && (
            <>
              <Button sm onClick={() => void handleRetryAllFailed()} disabled={retryingAll}
                sx={{ color: gv.rd, borderColor: `${gv.rd}40` }}>
                {retryingAll ? 'Retrying…' : 'Retry All Failed'}
              </Button>
              {retryAllResult && (
                <span style={{ fontSize: 11, color: retryAllResult.failed === 0 ? gv.gr : gv.rd }}>
                  {retryAllResult.succeeded}/{retryAllResult.total} ok
                </span>
              )}
            </>
          )}
          <Button primary sm onClick={() => setShowNew(true)}><Ic.Plus /> {t('content.btn_new', 'New Post')}</Button>
        </div>
      </div>

      {/* Agent execution queue panel */}
      <AgentQueuePanel agents={agents} />

      {loading && <div style={{ color: gv.td, fontSize: 12, padding: 20, textAlign: 'center' }}>{t('content.loading', 'Loading...')}</div>}

      {!loading && rows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: gv.td }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 13 }}>{t('content.no_posts_title', 'No posts yet. Create one with "New Post"!')}</div>
        </div>
      )}

      {rows.map(c => {
        const res = publishResult[c.id]
        return (
          <Card key={c.id} sx={{ padding: '12px 16px', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <PlatformIcon p={c.platform} s={28} />
              {/* Thumbnail */}
              {c.mediaUrls.length > 0 && !isVideoDataUrl(c.mediaUrls[0]) && (
                <img
                  src={c.mediaUrls[0]}
                  alt=""
                  style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: `1px solid ${gv.cbdr}` }}
                />
              )}
              {c.mediaUrls.length > 0 && isVideoDataUrl(c.mediaUrls[0]) && (
                <div style={{ width: 52, height: 52, borderRadius: 8, background: gv.card, border: `1px solid ${gv.cbdr}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🎥</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }}>
                  {c.text || <span style={{ color: gv.td, fontStyle: 'italic' }}>{t('content.media_only', '(media only)')}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, color: gv.td, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Ic.Clk /> {formatTime(c.status === 'published' ? c.publishedAt : c.scheduledAt, t)}
                  </span>
                  {c.agentId !== 'manual' && <Badge c={gv.ac}>{c.agentId.slice(0, 6)}</Badge>}
                  {c.mediaUrls.length > 1 && (
                    <Badge c={gv.cc}>{`🖼 ${c.mediaUrls.length}`}</Badge>
                  )}
                  {res && (
                    <span style={{ fontSize: 10, color: res.ok ? gv.gr : gv.rd }}>
                      {res.ok ? t('content.published_success', '✓ Published') : t('content.publish_error', { error: res.error, defaultValue: `✗ ${res.error}` })}
                    </span>
                  )}
                </div>
              </div>
              <StatusBadge s={c.status} />
              <Button sm onClick={() => void handleViewDetail(c.id)} sx={{ flexShrink: 0 }}>
                <Ic.Eye /> {t('content.btn_view', 'View')}
              </Button>
              {c.status === 'queued' && (
                <Button sm onClick={() => void handleCancelQueued(c.id)} sx={{ color: gv.rd, borderColor: `${gv.rd}40`, flexShrink: 0 }}>
                  {t('content.btn_cancel_queued', 'Cancel')}
                </Button>
              )}
              {(c.status === 'queued' || c.status === 'scheduled') && (
                <Button primary sm onClick={() => void handlePublish(c.id)} disabled={publishing === c.id} sx={{ flexShrink: 0 }}>
                  {publishing === c.id ? '…' : t('content.btn_publish', 'Publish')}
                </Button>
              )}
              {c.status === 'failed' && (
                <Button primary sm onClick={() => void handlePublish(c.id)} disabled={publishing === c.id} sx={{ flexShrink: 0 }}>
                  {publishing === c.id ? '…' : 'Retry'}
                </Button>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
