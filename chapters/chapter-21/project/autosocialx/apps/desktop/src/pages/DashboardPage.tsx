import { useRef, useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardHeader } from '../components/Card'
import { Button } from '../components/Button'
import { ProgressBar } from '../components/ProgressBar'
import { PlatformIcon } from '../components/PlatformIcon'
import { Ic } from '../components/Icon'
import { gv, mn } from '../components/tokens'
import { colorizeLog, agentColor, LC } from '../components/TerminalLog'
import { useTerminalStore } from '../store/terminal'
import { useQueueStatusStore } from '../store/queueStatus'
import { useAgentIpcStore } from '../store/agentIpc'
import { getElectronAPI } from '../hooks/useElectronAPI'
import type { PlatformId } from '../types'

// ─── Count-up animation hook ──────────────────────────────────────────────────

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4)
}

function useCountUp(target: number, duration = 600): number {
  const [display, setDisplay] = useState(target)
  const rafRef = useRef<number | null>(null)
  const fromRef = useRef(target)
  const startRef = useRef<number | null>(null)
  const targetRef = useRef(target)

  const animate = useCallback((ts: number) => {
    if (startRef.current === null) startRef.current = ts
    const elapsed = ts - startRef.current
    const progress = Math.min(elapsed / duration, 1)
    const eased = easeOutQuart(progress)
    setDisplay(Math.round(fromRef.current + (targetRef.current - fromRef.current) * eased))
    if (progress < 1) {
      rafRef.current = requestAnimationFrame(animate)
    }
  }, [duration])

  useEffect(() => {
    if (target === targetRef.current) return
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    fromRef.current = display
    targetRef.current = target
    startRef.current = null
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, animate])

  return display
}

// ─────────────────────────────────────────────────────────────────────────────

const mockActivityLogs = [
  { t: "11:34:02", a: "AGENT_ORION", x: "[Iteration 1/10] Planning post for X platform...", c: '' },
  { t: "11:34:04", a: "AGENT_ORION", x: "[Tool] Calling web_search { query: 'AI trends 2025' }", c: '' },
  { t: "11:34:06", a: "AGENT_ORION", x: "[Tool] web_search → { results: 5 items }", c: '' },
  { t: "11:34:08", a: "AGENT_ORION", x: "[Iteration 2/10] Drafting caption with trends...", c: '' },
  { t: "11:34:10", a: "AGENT_ORION", x: "[Tool] Calling schedule_post { platform: 'x', text: 'Boost your reach…' }", c: '' },
  { t: "11:34:11", a: "AGENT_ORION", x: "[Done] Post scheduled successfully", c: '' },
]

interface DashStats {
  runs: { total: number; success: number }
  content: { total: number; published: number }
  rssItems: number
  agentRunCounts: Record<string, number>
}

interface PlatformStat {
  platform: string
  todayCount: number
  weekCount: number
  lastPostedAt: number | null  // unix seconds
}

const mockPlatformStats: PlatformStat[] = [
  { platform: 'x',           todayCount: 3, weekCount: 12, lastPostedAt: Date.now() / 1000 - 3600  },
  { platform: 'linkedin',    todayCount: 1, weekCount: 4,  lastPostedAt: Date.now() / 1000 - 7200  },
  { platform: 'xiaohongshu', todayCount: 0, weekCount: 2,  lastPostedAt: Date.now() / 1000 - 86400 },
  { platform: 'instagram',   todayCount: 0, weekCount: 0,  lastPostedAt: null },
]

function formatLastPosted(ts: number | null): string {
  if (!ts) return '—'
  const diffSec = Date.now() / 1000 - ts
  if (diffSec < 86400) {
    return new Date(ts * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  const days = Math.floor(diffSec / 86400)
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  return `${Math.floor(days / 7)}周前`
}

export const DashboardPage = () => {
  const { t } = useTranslation()
  const termRef = useRef<HTMLDivElement>(null)
  const { logs, startListening } = useTerminalStore()
  const { status: queueStatus, startPolling, stopPolling } = useQueueStatusStore()
  const { agents, fetchAgents } = useAgentIpcStore()

  const [scheduledPosts, setScheduledPosts] = useState<Record<string, unknown>[]>([])
  const [carouselIdx, setCarouselIdx] = useState(0)
  const [recentPost, setRecentPost] = useState<Record<string, unknown> | null>(null)
  const [platformStats, setPlatformStats] = useState<PlatformStat[]>([])
  const [stats, setStats] = useState<DashStats>({
    runs: { total: 0, success: 0 },
    content: { total: 0, published: 0 },
    rssItems: 0,
    agentRunCounts: {},
  })

  // Fetch platform pulse stats
  useEffect(() => {
    const fetch = async () => {
      const api = getElectronAPI()
      if (!api) return
      try {
        const all = await api.content.list('published') as Record<string, unknown>[]
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
        const todayStartSec = todayStart.getTime() / 1000
        const weekStartSec = todayStartSec - 7 * 86400
        const map = new Map<string, PlatformStat>()
        for (const item of all) {
          const p = item['platform'] as string
          const pa = item['published_at'] as number | null
          if (!p) continue
          const stat = map.get(p) ?? { platform: p, todayCount: 0, weekCount: 0, lastPostedAt: null }
          if (pa) {
            if (pa >= todayStartSec) stat.todayCount++
            if (pa >= weekStartSec) stat.weekCount++
            if (!stat.lastPostedAt || pa > stat.lastPostedAt) stat.lastPostedAt = pa
          }
          map.set(p, stat)
        }
        const sorted = Array.from(map.values()).sort((a, b) => (b.lastPostedAt ?? 0) - (a.lastPostedAt ?? 0))
        setPlatformStats(sorted)
        // Most recently published post for fallback preview
        const latest = all
          .filter(r => r['published_at'])
          .sort((a, b) => (b['published_at'] as number) - (a['published_at'] as number))[0] ?? null
        setRecentPost(latest)
      } catch { /* ignore */ }
    }
    void fetch()
    const timer = setInterval(fetch, 10000)
    return () => clearInterval(timer)
  }, [])

  // Fetch scheduled posts
  useEffect(() => {
    const fetchQueue = async () => {
      const api = getElectronAPI()
      if (!api) return
      try {
        const posts = await api.content.list('scheduled')
        setScheduledPosts(posts as Record<string, unknown>[])
      } catch { /* ignore */ }
    }
    void fetchQueue()
    const timer = setInterval(fetchQueue, 5000)
    return () => clearInterval(timer)
  }, [])

  // Fetch dashboard stats
  useEffect(() => {
    const fetchStats = async () => {
      const api = getElectronAPI()
      if (!api) return
      try {
        const s = await api.dashboard.stats()
        setStats(s)
      } catch { /* ignore */ }
    }
    void fetchStats()
    const timer = setInterval(fetchStats, 10000)
    return () => clearInterval(timer)
  }, [])

  // Rotate carousel
  useEffect(() => {
    if (scheduledPosts.length <= 1) return
    const id = setInterval(() => {
      setCarouselIdx(prev => (prev + 1) % scheduledPosts.length)
    }, 6000)
    return () => clearInterval(id)
  }, [scheduledPosts.length])

  useEffect(() => {
    startListening()
    startPolling()
    void fetchAgents()
    return () => { stopPolling() }
  }, [startListening, startPolling, stopPolling, fetchAgents])

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight
  }, [logs])

  const displayLogs = logs.length > 0 ? logs : mockActivityLogs

  // Derived stats
  const successRate = stats.runs.total > 0
    ? Math.round((stats.runs.success / stats.runs.total) * 100)
    : 0
  const publishRate = stats.content.total > 0
    ? Math.round((stats.content.published / stats.content.total) * 100)
    : 0
  const queueActive = queueStatus.pending + queueStatus.running

  // Animated counters
  const animSuccessRate   = useCountUp(successRate)
  const animPublishRate   = useCountUp(publishRate)
  const animRssItems      = useCountUp(stats.rssItems)
  const animRunsSuccess   = useCountUp(stats.runs.success)
  const animPublished     = useCountUp(stats.content.published)
  const animPending       = useCountUp(queueStatus.pending)
  const animRunning       = useCountUp(queueStatus.running)
  const animQueueActive   = useCountUp(queueActive)
  const isQueueEmpty = scheduledPosts.length === 0
  const currentPost = isQueueEmpty
    ? (recentPost ?? undefined)
    : scheduledPosts[carouselIdx] as Record<string, unknown> | undefined
  const displayPlatformStats = platformStats.length > 0 ? platformStats : mockPlatformStats

  // ─── Platform Pulse — dot color by activity ────────────────────────────────

  function dotColor(stat: PlatformStat): string {
    if (stat.todayCount > 0) return gv.gr
    if (stat.weekCount > 0) return gv.yl
    return LC.muted
  }
  const currentPlatform = (currentPost?.['platform'] as string) ?? 'x'
  const PLATFORM_LABELS: Record<string, string> = {
    x: 'X', linkedin: 'LinkedIn', xiaohongshu: '小红书', instagram: 'Instagram',
    tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook', threads: 'Threads',
    bluesky: 'Bluesky', weibo: '微博', bilibili: '哔哩哔哩', douyin: '抖音', pinterest: 'Pinterest',
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 14, flex: 1, minHeight: 0 }}>
        {/* Terminal */}
        <Card sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <CardHeader t={t('dashboard.terminal_title', 'AI Agent Real-Time Activity')} r={<Button sm><Ic.Term /> {t('dashboard.terminal_btn', 'Terminal')} <Ic.ChvD /></Button>} />
          <div ref={termRef} style={{ flex: 1, overflow: "auto", padding: "10px 14px", fontFamily: mn, fontSize: 11.5, lineHeight: 1.85 }}>
            {displayLogs.map((l, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 0, flexWrap: 'wrap' }}>
                <span style={{ color: gv.td, flexShrink: 0, minWidth: 72, marginRight: 6 }}>[{l.t}]</span>
                {l.a && (
                  <span style={{
                    color: agentColor(l.a), flexShrink: 0, marginRight: 8,
                    fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
                    opacity: 0.85,
                  }}>{l.a}</span>
                )}
                <span style={{ color: LC.dim }}>{colorizeLog(l.x, 'info')}</span>
              </div>
            ))}
            <div style={{ marginTop: 4 }}>
              <span style={{ color: gv.td }}>[{new Date().toLocaleTimeString('en-US', { hour12: false })}] </span>
              <span style={{ width: 8, height: 14, background: gv.cc, display: "inline-block", animation: "blink 1s step-end infinite", borderRadius: 1 }} />
            </div>
          </div>
        </Card>

        {/* Live Post Preview / Recently Published */}
        <Card sx={{ width: 380, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <CardHeader
            t={isQueueEmpty
              ? t('dashboard.preview_recent', 'Recently Published')
              : t('dashboard.preview_title', 'Live Post Preview')}
            r={
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {isQueueEmpty
                  ? <span style={{ fontSize: 10, color: gv.gr, background: `${gv.gr}15`, border: `1px solid ${gv.gr}30`, borderRadius: 4, padding: '2px 7px', fontWeight: 700 }}>PUBLISHED</span>
                  : <span style={{ fontSize: 10, color: gv.cc, background: `${gv.cc}15`, border: `1px solid ${gv.cc}30`, borderRadius: 4, padding: '2px 7px', fontWeight: 700 }}>SCHEDULED</span>
                }
                <div style={{ display: 'flex' }}>
                  {['xiaohongshu', 'instagram', 'linkedin', 'x'].map((p, j) => (
                    <div key={j} style={{ marginLeft: j > 0 ? -6 : 0, zIndex: 4 - j }}>
                      <PlatformIcon p={p as PlatformId} s={22} />
                    </div>
                  ))}
                </div>
              </div>
            }
          />
          <div style={{ flex: 1, overflow: "auto", padding: 14 }}>
            {!currentPost ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: gv.td, fontSize: 13 }}>
                <Ic.Msg />
                <div>{t('dashboard.preview_empty', 'No posts yet')}</div>
              </div>
            ) : (
              <>
                <div style={{
                  background: isQueueEmpty ? `${gv.gr}06` : 'rgba(255,255,255,.03)',
                  border: `1px solid ${isQueueEmpty ? gv.gr + '20' : gv.gbdr}`,
                  borderRadius: 14, overflow: "hidden",
                  transition: 'background 0.3s, border-color 0.3s',
                }}>
                  {/* Header */}
                  <div style={{ padding: "12px 14px 8px", display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 18, background: "linear-gradient(135deg,#7B5CFF,#00E5CC)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, textTransform: 'uppercase' }}>
                      {agents.find(a => a._ipcId === currentPost['agent_id'])?.nm?.[0] ?? 'A'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 800 }}>{agents.find(a => a._ipcId === currentPost['agent_id'])?.nm ?? 'Agent'}</span>
                        <PlatformIcon p={currentPlatform as PlatformId} s={16} />
                        <span style={{ fontSize: 11, color: gv.td }}>{PLATFORM_LABELS[currentPlatform] ?? currentPlatform}</span>
                        {!isQueueEmpty && (
                          <span style={{ marginLeft: "auto", fontSize: 10, color: gv.td }}>{carouselIdx + 1}/{scheduledPosts.length}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Images */}
                  {(() => {
                    const raw = currentPost['media_urls']
                    let urls: string[] = []
                    if (Array.isArray(raw)) urls = raw as string[]
                    else if (typeof raw === 'string') { try { urls = JSON.parse(raw) as string[] } catch { /* empty */ } }
                    if (urls.length === 0) return null
                    return (
                      <div style={{ display: 'flex', gap: 4, padding: '0 14px 8px', overflowX: 'auto' }} className="hide-scrollbar">
                        {urls.map((url, i) => (
                          <img key={i} src={url} alt="" style={{
                            height: 180, width: urls.length === 1 ? '100%' : 140,
                            objectFit: 'cover', borderRadius: 10, flexShrink: 0,
                            background: 'rgba(255,255,255,.05)',
                          }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                        ))}
                      </div>
                    )
                  })()}

                  {/* Text */}
                  <p style={{ fontSize: 12.5, lineHeight: 1.65, margin: '0 14px 10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {currentPost['text'] as string}
                  </p>

                  {/* Footer */}
                  <div style={{ padding: "6px 14px 10px", display: 'flex', alignItems: 'center', gap: 6, borderTop: `1px solid ${gv.gbdr}` }}>
                    {isQueueEmpty ? <Ic.Chk /> : <Ic.Clk />}
                    <span style={{ fontSize: 10, color: isQueueEmpty ? gv.gr : gv.td }}>
                      {isQueueEmpty
                        ? (currentPost['published_at']
                          ? new Date(Number(currentPost['published_at']) * 1000).toLocaleString()
                          : t('dashboard.preview_published', 'Published'))
                        : (currentPost['scheduled_at']
                          ? new Date(Number(currentPost['scheduled_at']) * 1000).toLocaleString()
                          : t('dashboard.preview_queued', 'Queued'))}
                    </span>
                  </div>
                </div>
                {!isQueueEmpty && (
                  <Button sx={{ width: "100%", justifyContent: "center", marginTop: 10 }}>
                    {t('dashboard.preview_btn', `Preview on ${PLATFORM_LABELS[currentPlatform] ?? currentPlatform}`)}
                  </Button>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, flexShrink: 0 }}>
        {/* Platform Pulse */}
        <Card sx={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{t('dashboard.platform_pulse', 'Platform Pulse')}</span>
            <span style={{ color: gv.td }}><Ic.ChvR /></span>
          </div>
          {displayPlatformStats.slice(0, 5).map((stat, i) => {
            const color = dotColor(stat)
            const isActive = stat.todayCount > 0
            return (
              <div key={stat.platform} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 0',
                borderTop: i ? `1px solid rgba(255,255,255,.04)` : 'none',
              }}>
                {/* Status dot */}
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: color,
                  boxShadow: isActive ? `0 0 6px ${color}` : 'none',
                  flexShrink: 0,
                }} />
                {/* Platform icon + name */}
                <PlatformIcon p={stat.platform as PlatformId} s={18} />
                <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>
                  {PLATFORM_LABELS[stat.platform] ?? stat.platform}
                </span>
                {/* Today count badge */}
                {stat.todayCount > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, fontFamily: mn,
                    color: gv.gr, background: `${gv.gr}15`,
                    border: `1px solid ${gv.gr}30`,
                    borderRadius: 4, padding: '1px 6px',
                    flexShrink: 0,
                  }}>+{stat.todayCount}</span>
                )}
                {/* Last posted */}
                <span style={{ fontSize: 10, color: gv.td, flexShrink: 0, minWidth: 36, textAlign: 'right', fontFamily: mn }}>
                  {formatLastPosted(stat.lastPostedAt)}
                </span>
              </div>
            )
          })}
          {displayPlatformStats.length === 0 && (
            <div style={{ fontSize: 11, color: gv.td, textAlign: 'center', padding: '12px 0' }}>
              {t('dashboard.no_published', 'No published posts yet')}
            </div>
          )}
        </Card>

        {/* Generation Stats */}
        <Card sx={{ padding: 16 }}>
          <div style={{ display: "flex", marginBottom: 12 }}><span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{t('dashboard.stats_title', 'Generation Stats')}</span><span style={{ color: gv.td }}><Ic.ChvR /></span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: gv.ts }}>{t('dashboard.stats_success', 'Success')}</span>
            <div style={{ flex: 1 }}><ProgressBar v={successRate} c={gv.bl} /></div>
            <span style={{ fontSize: 11, fontFamily: mn, color: gv.ts, fontVariantNumeric: 'tabular-nums', minWidth: 32, textAlign: 'right' }}>{animSuccessRate}%</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
            {[
              { l: t('dashboard.stats_trends', 'Trends'), v: animRssItems,    c: gv.bl },
              { l: t('dashboard.stats_gen', 'Gen'),       v: animRunsSuccess,  c: gv.cc },
              { l: t('dashboard.stats_posts', 'Posts'),   v: animPublished,    c: gv.gr },
            ].map(s => (
              <div key={s.l} style={{ textAlign: "center" }}>
                <div style={{
                  fontSize: 28, fontWeight: 800, fontFamily: mn,
                  color: s.c, letterSpacing: '-0.03em',
                  fontVariantNumeric: 'tabular-nums',
                  textShadow: `0 0 18px ${s.c}55`,
                }}>{s.v}</div>
                <div style={{ fontSize: 10, color: gv.td, marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Queue Status */}
        <Card sx={{ padding: 16 }}>
          <div style={{ display: "flex", marginBottom: 12 }}><span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{t('dashboard.queue_title', 'Queue Status')}</span><span style={{ color: gv.td }}><Ic.ChvR /></span></div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: gv.ts }}>{t('dashboard.queue_complete', 'Published')}</span>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: mn, color: gv.ts, fontVariantNumeric: 'tabular-nums' }}>{animPublishRate}%</span>
            </div>
            <ProgressBar v={publishRate} c={gv.cc} />
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: gv.ts }}>{t('dashboard.queue_in_progress', 'In Queue')}</span>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: mn, color: gv.ts, fontVariantNumeric: 'tabular-nums' }}>{animQueueActive}</span>
            </div>
            <ProgressBar v={queueActive > 0 ? Math.min(100, queueActive * 20) : 0} c={gv.pk} />
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
            {[
              { v: animPending,   c: gv.yl, label: t('dashboard.queue_pending',   'Pending')   },
              { v: animRunning,   c: gv.cc, label: t('dashboard.queue_running',   'Running')   },
              { v: animPublished, c: gv.gr, label: t('dashboard.queue_published', 'Published') },
            ].map(item => (
              <div key={item.label} style={{ textAlign: 'center', flex: 1 }}>
                <div style={{
                  fontSize: 24, fontWeight: 800, fontFamily: mn,
                  color: item.c, letterSpacing: '-0.02em',
                  fontVariantNumeric: 'tabular-nums',
                  textShadow: `0 0 14px ${item.c}55`,
                }}>{item.v}</div>
                <div style={{ fontSize: 10, color: gv.td, marginTop: 1 }}>{item.label}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
