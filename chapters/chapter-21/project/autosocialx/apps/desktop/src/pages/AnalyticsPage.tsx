import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardHeader } from '../components/Card'
import { PlatformIcon } from '../components/PlatformIcon'
import { Ic } from '../components/Icon'
import { gv, mn } from '../components/tokens'
import type { PlatformId } from '../types'

interface PlatformStat { platform: PlatformId; published: number; queued: number; scheduled: number; draft: number }
interface RecentPost { id: string; platform: PlatformId; text: string; status: string; scheduled_at: number; published_at: number | null }

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card sx={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 11, color: gv.td, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, fontFamily: mn, color: color ?? gv.tx }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: gv.td, marginTop: 4 }}>{sub}</div>}
    </Card>
  )
}

function BarRow({ label, value, max, color, platform }: { label: string; value: number; max: number; color: string; platform?: PlatformId }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${gv.gbdr}20` }}>
      {platform ? <PlatformIcon p={platform} s={20} /> : <div style={{ width: 20 }} />}
      <span style={{ width: 100, fontSize: 11, color: gv.ts }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 4 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .6s cubic-bezier(.4,0,.2,1)' }} />
      </div>
      <span style={{ width: 32, textAlign: 'right', fontSize: 11, fontFamily: mn, color: gv.ts }}>{value}</span>
    </div>
  )
}

function useFormatDate() {
  const { t } = useTranslation()
  return (unixSec: number | null): string => {
    if (!unixSec) return t('analytics.no_posts_yet', '—') // Or just '—'
    const d = new Date(unixSec * 1000)
    const diff = Math.floor((Date.now() - d.getTime()) / 60000)
    if (diff < 60) return t('analytics.mins_ago', { count: diff, defaultValue: `${diff}m ago` })
    if (diff < 1440) return t('analytics.hours_ago', { count: Math.floor(diff / 60), defaultValue: `${Math.floor(diff / 60)}h ago` })
    return d.toLocaleDateString()
  }
}

const PLATFORM_COLORS: Record<string, string> = {
  x: '#E7E9EA',
  linkedin: '#4EAAFF',
  xiaohongshu: '#FF2442',
}

export const AnalyticsPage = () => {
  const { t } = useTranslation()
  const formatDate = useFormatDate()
  const [stats, setStats] = useState<PlatformStat[]>([])
  const [recent, setRecent] = useState<RecentPost[]>([])
  const [totals, setTotals] = useState({ total: 0, published: 0, queued: 0, scheduled: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const allRows = (await window.electronAPI?.content.list('all') ?? []) as Array<{
          id: string; platform: PlatformId; text: string; status: string; scheduled_at: number; published_at: number | null
        }>

        // Compute totals
        setTotals({
          total: allRows.length,
          published: allRows.filter(r => r.status === 'published').length,
          queued: allRows.filter(r => r.status === 'queued').length,
          scheduled: allRows.filter(r => r.status === 'scheduled').length,
        })

        // Compute per-platform stats
        const platforms = ['x', 'linkedin', 'xiaohongshu'] as PlatformId[]
        setStats(platforms.map(p => ({
          platform: p,
          published: allRows.filter(r => r.platform === p && r.status === 'published').length,
          queued: allRows.filter(r => r.platform === p && r.status === 'queued').length,
          scheduled: allRows.filter(r => r.platform === p && r.status === 'scheduled').length,
          draft: allRows.filter(r => r.platform === p && r.status === 'draft').length,
        })))

        // Recent 10 posts
        setRecent(allRows.slice(0, 10))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const maxPosts = Math.max(...stats.map(s => s.published + s.queued + s.scheduled), 1)
  const publishRate = totals.total > 0 ? Math.round((totals.published / totals.total) * 100) : 0

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 17, fontWeight: 800 }}>{t('analytics.title', 'Analytics')}</div>
        <div style={{ fontSize: 11, color: gv.td, marginTop: 2 }}>{t('analytics.desc', 'Publishing performance across all channels')}</div>
      </div>

      {loading && <div style={{ color: gv.td, fontSize: 12, textAlign: 'center', padding: 40 }}>{t('analytics.loading', 'Loading...')}</div>}

      {!loading && (
        <>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
            <StatCard label={t('analytics.total_posts', 'Total Posts')} value={totals.total} color={gv.ac} />
            <StatCard label={t('analytics.published', 'Published')} value={totals.published} color={gv.gr} sub={t('analytics.published_sub', 'Successfully sent')} />
            <StatCard label={t('analytics.queued', 'Queued')} value={totals.queued} color={gv.yl} sub={t('analytics.queued_sub', 'Awaiting publish')} />
            <StatCard label={t('analytics.publish_rate', 'Publish Rate')} value={`${publishRate}%`} color={publishRate > 60 ? gv.gr : gv.yl} sub={t('analytics.publish_rate_sub', 'of all posts')} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            {/* Platform breakdown */}
            <Card sx={{ padding: '0' }}>
              <CardHeader t={t('analytics.posts_by_platform', 'Posts by Platform')} />
              <div style={{ padding: '8px 16px 12px' }}>
                {stats.map(s => (
                  <BarRow
                    key={s.platform}
                    label={s.platform === 'xiaohongshu' ? '小红书' : s.platform}
                    value={s.published + s.queued + s.scheduled}
                    max={maxPosts}
                    color={PLATFORM_COLORS[s.platform] ?? gv.ac}
                    platform={s.platform}
                  />
                ))}
                {stats.every(s => s.published + s.queued + s.scheduled === 0) && (
                  <div style={{ color: gv.td, fontSize: 11, textAlign: 'center', padding: '20px 0' }}>{t('analytics.no_posts_scheduling', 'No posts yet. Start scheduling!')}</div>
                )}
              </div>
            </Card>

            {/* Status breakdown */}
            <Card sx={{ padding: '0' }}>
              <CardHeader t={t('analytics.status_breakdown', 'Status Breakdown')} />
              <div style={{ padding: '8px 16px 12px' }}>
                {[
                  { label: t('status.published', 'Published'), value: totals.published, color: gv.gr },
                  { label: t('status.queued', 'Queued'), value: totals.queued, color: gv.yl },
                  { label: t('status.scheduled', 'Scheduled'), value: totals.scheduled, color: gv.ac },
                  { label: t('status.draft', 'Draft'), value: totals.total - totals.published - totals.queued - totals.scheduled, color: gv.td },
                ].map(s => (
                  <BarRow key={s.label} label={s.label} value={s.value} max={Math.max(totals.total, 1)} color={s.color} />
                ))}
              </div>
            </Card>
          </div>

          {/* Recent posts */}
          <Card sx={{ padding: '0' }}>
            <CardHeader t={t('analytics.recent_posts', 'Recent Posts')} r={<span style={{ fontSize: 10, color: gv.td }}>{t('analytics.shown_count', { count: recent.length, defaultValue: `${recent.length} shown` })}</span>} />
            <div style={{ padding: '0 4px' }}>
              {recent.length === 0 && <div style={{ textAlign: 'center', padding: '24px', color: gv.td, fontSize: 12 }}>{t('analytics.no_posts_yet', 'No posts yet.')}</div>}
              {recent.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderBottom: `1px solid ${gv.gbdr}` }}>
                  <PlatformIcon p={p.platform} s={24} />
                  <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: gv.ts, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.text}</div>
                  <span style={{ fontSize: 10, color: gv.td, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Ic.Clk /> {formatDate(p.status === 'published' ? p.published_at : p.scheduled_at)}
                  </span>
                  <div style={{ padding: '2px 8px', borderRadius: 6, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', background: p.status === 'published' ? `${gv.gr}20` : p.status === 'queued' ? `${gv.yl}20` : `${gv.ac}20`, color: p.status === 'published' ? gv.gr : p.status === 'queued' ? gv.yl : gv.cc }}>{t(`status.${p.status}` as any, p.status)}</div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
