import React, { useState, useRef, useEffect, Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useUIStore } from './store/ui'
import { useAgentIpcStore } from './store/agentIpc'
import { useTerminalStore } from './store/terminal'
import { Ic } from './components/Icon'
import { gv, sn } from './components/tokens'
import { PlatformIcon } from './components/PlatformIcon'
import { ProgressBar } from './components/ProgressBar'
import { DashboardPage } from './pages/DashboardPage'
import { GeneratePage } from './pages/GeneratePage'
import { AgentsPage } from './pages/AgentsPage'
import { ChannelsPage } from './pages/ChannelsPage'
import { CampaignsPage } from './pages/CampaignsPage'
import { ContentPage } from './pages/ContentPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { AutomationPage } from './pages/AutomationPage'
import { PersonasPage } from './pages/PersonasPage'
import { SettingsPage } from './pages/SettingsPage'
import type { NavId } from './types'
import { useTranslation } from 'react-i18next'

const queryClient = new QueryClient()

class PageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[ErrorBoundary]', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: gv.ts }}>
          <div style={{ fontSize: 24 }}>⚠️</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: gv.rd }}>Something went wrong</div>
          <div style={{ fontSize: 11, color: gv.td, maxWidth: 320, textAlign: 'center' }}>{(this.state.error as Error).message}</div>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 8, padding: '6px 16px', borderRadius: 7, border: `1px solid ${gv.gbdr}`, background: 'rgba(255,255,255,.06)', color: gv.ts, cursor: 'pointer', fontSize: 12 }}>Try again</button>
        </div>
      )
    }
    return this.props.children
  }
}

const navConfig: { id: NavId; key: string; ic: () => React.ReactElement }[] = [
  { id: 'dashboard', key: 'dashboard', ic: Ic.Dash },
  { id: 'generate', key: 'new_post', ic: Ic.Msg },
  { id: 'agents', key: 'agents', ic: Ic.Agent },
  { id: 'channels', key: 'channels', ic: Ic.Xp },
  { id: 'campaigns', key: 'campaigns', ic: Ic.Send },
  { id: 'content', key: 'library', ic: Ic.File },
  { id: 'analytics', key: 'explore', ic: Ic.Bar },
  { id: 'automation', key: 'calendar', ic: Ic.Zap },
  { id: 'personas', key: 'personas', ic: Ic.User },
  { id: 'settings', key: 'settings', ic: Ic.Gear },
]

const PAGE_MAP: Record<NavId, () => React.ReactElement> = {
  dashboard: DashboardPage,
  generate: GeneratePage,
  agents: AgentsPage,
  channels: ChannelsPage,
  campaigns: CampaignsPage,
  content: ContentPage,
  analytics: AnalyticsPage,
  automation: AutomationPage,
  personas: PersonasPage,
  settings: SettingsPage,
}

const EditableUserProfile = () => {
  const [isEditing, setIsEditing] = useState(false)
  const [userName, setUserName] = useState('Alex R.')
  const [tempName, setTempName] = useState(userName)

  const handleSave = () => {
    if (tempName.trim()) setUserName(tempName.trim())
    setIsEditing(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <div style={{ width: 28, height: 28, borderRadius: 14, background: 'linear-gradient(135deg,#F0A030,#E84393)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
        {userName.charAt(0).toUpperCase()}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 60 }}>
        {isEditing ? (
          <input
            autoFocus
            value={tempName}
            onChange={e => setTempName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') { setTempName(userName); setIsEditing(false) }
            }}
            onBlur={handleSave}
            style={{
              background: 'rgba(255,255,255,0.1)', border: `1px solid ${gv.cc}`,
              borderRadius: 4, color: '#fff', fontSize: 12, fontWeight: 700,
              padding: '2px 6px', margin: '-3px -7px -3px -7px', outline: 'none',
              width: 80, fontFamily: 'inherit'
            }}
          />
        ) : (
          <div
            style={{ fontSize: 12, fontWeight: 700, cursor: 'text' }}
            onClick={() => setIsEditing(true)}
            title="Click to edit name"
          >
            {userName}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
          <div style={{ width: 5, height: 5, borderRadius: 3, background: gv.gr }} />
          <span style={{ fontSize: 9, color: gv.td }}>Online</span>
        </div>
      </div>
    </div>
  )
}

function AppShell() {
  const { nav, setNav } = useUIStore()
  const { agents, fetchAgents, setAgentRunning } = useAgentIpcStore()
  const { logs } = useTerminalStore()

  useEffect(() => {
    void fetchAgents()
    const timer = setInterval(() => void fetchAgents(), 10000)
    return () => clearInterval(timer)
  }, [fetchAgents])

  // Real-time agent running status via IPC events (no poll delay)
  useEffect(() => {
    const onStarted = window.electronAPI?.on('agent:run-started', (p) => {
      const payload = p as { agentId: string }
      setAgentRunning(payload.agentId, true)
    })
    const onDone = window.electronAPI?.on('agent:run-complete', (p) => {
      const payload = p as { agentId: string }
      setAgentRunning(payload.agentId, false)
    })
    const onFailed = window.electronAPI?.on('agent:run-failed', (p) => {
      const payload = p as { agentId: string }
      setAgentRunning(payload.agentId, false)
    })
    return () => { onStarted?.(); onDone?.(); onFailed?.() }
  }, [setAgentRunning])
  const { t, i18n } = useTranslation() // Get the translation hook and i18n instance
  const Page = PAGE_MAP[nav]

  // Listen to language changes from settings
  useEffect(() => {
    window.electronAPI?.settings?.get().then(cfg => {
      if (cfg?.language && cfg.language !== i18n.language) {
        i18n.changeLanguage(cfg.language)
      }
    }).catch(() => { })
  }, [i18n])

  // Compute translated NAV_ITEMS for use in UI
  const NAV_ITEMS = React.useMemo(() => {
    return navConfig.map(n => ({
      ...n,
      lb: t(`sidebar.${n.key}`)
    }))
  }, [t])

  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  // Close notification panel when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false)
      }
    }
    if (showNotif) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showNotif])

  // Search: filter nav items + agents by query
  const searchResults = searchQuery.trim()
    ? [
      ...NAV_ITEMS.filter(n => n.lb.toLowerCase().includes(searchQuery.toLowerCase())).map(n => ({ type: 'page' as const, id: n.id, label: n.lb })),
      ...agents.filter(a => a.nm.toLowerCase().includes(searchQuery.toLowerCase())).map(a => ({ type: 'agent' as const, id: 'agents' as NavId, label: a.nm })),
    ].slice(0, 6)
    : []

  const recentLogs = logs.slice(-8).reverse()

  return (
    <div style={{
      width: '100%', height: '100vh',
      background: `radial-gradient(ellipse at 30% 100%,rgba(120,60,20,.12) 0%,transparent 60%),radial-gradient(ellipse at 80% 0%,rgba(60,20,120,.10) 0%,transparent 50%),${gv.bg}`,
      color: gv.tx, fontFamily: sn, fontSize: 13,
      overflow: 'hidden', position: 'relative',
    }}>
      {/* Ambient glows */}
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '50%', height: '50%', background: 'radial-gradient(ellipse,rgba(123,92,255,.06) 0%,transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '50%', background: 'radial-gradient(ellipse,rgba(240,160,48,.05) 0%,transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ display: 'flex', height: '100%', position: 'relative', zIndex: 1 }}>
        {/* SIDEBAR */}
        <div style={{ width: 220, background: gv.glass, borderRight: `1px solid ${gv.gbdr}`, backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          {/* Logo — draggable area aligned with native traffic lights */}
          <div style={{ paddingTop: 32, paddingLeft: 14, paddingRight: 14, paddingBottom: 12, display: 'flex', alignItems: 'center', gap: 9, WebkitAppRegion: 'drag' } as React.CSSProperties}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#7B5CFF,#00E5CC)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', fontStyle: 'italic' }}>Ai</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-.02em' }}>AutoSocialX</div>
              <div style={{ fontSize: 9, color: gv.td }}>AI Social Media Manager</div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ padding: '4px 8px', flex: 1 }}>
            {NAV_ITEMS.map(n => {
              const active = nav === n.id
              return (
                <button
                  key={n.id}
                  onClick={() => setNav(n.id)}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.03)' }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    width: '100%', padding: '8px 11px', marginBottom: 1,
                    borderRadius: 9, border: 'none', cursor: 'pointer',
                    fontSize: 12.5, fontWeight: active ? 600 : 500,
                    color: active ? gv.tx : gv.ts,
                    background: active ? 'rgba(123,92,255,.12)' : 'transparent',
                    textAlign: 'left', fontFamily: 'inherit', transition: 'all .12s',
                  }}
                >
                  <span style={{ color: active ? gv.cc : gv.td, display: 'flex' }}><n.ic /></span>
                  {n.lb}
                </button>
              )
            })}
          </nav>

          {/* Active Agents */}
          <div style={{ padding: '0 10px 12px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: gv.td, textTransform: 'uppercase', letterSpacing: '.07em', padding: '8px 4px', borderTop: `1px solid ${gv.gbdr}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Active Agents</span>
              {agents.filter(a => a.st === 'running').length > 0 && (
                <span style={{ background: `${gv.gr}25`, color: gv.gr, borderRadius: 4, padding: '1px 5px', fontSize: 9 }}>
                  {agents.filter(a => a.st === 'running').length}
                </span>
              )}
            </div>
            {(() => {
              const running = agents.filter(a => a.st === 'running')
              const displayed = running.length > 0 ? running : agents.slice(0, 4)
              const isIdle = running.length === 0
              if (displayed.length === 0) return (
                <div style={{ fontSize: 10, color: gv.td, padding: '6px 4px', textAlign: 'center' }}>No agents yet</div>
              )
              return displayed.map((a) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 4px', cursor: 'pointer', opacity: isIdle ? 0.55 : 1 }} onClick={() => setNav('agents')}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <PlatformIcon p={a.pl} s={24} />
                    <div style={{
                      position: 'absolute', bottom: -1, right: -1,
                      width: 7, height: 7, borderRadius: 4,
                      background: a.st === 'running' ? gv.gr : gv.td,
                      border: '2px solid rgba(10,10,18,.9)',
                      animation: a.st === 'running' ? 'pulse 2s infinite' : 'none',
                    }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>{a.nm}</div>
                    <div style={{ fontSize: 9, color: gv.td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.tk}</div>
                    {a.pc != null
                      ? <div style={{ marginTop: 3 }}><ProgressBar v={a.pc} c={a.cl} h={3} /></div>
                      : <div style={{ fontSize: 9, color: isIdle ? gv.td : gv.gr, fontWeight: 600, marginTop: 2 }}>● {a.st[0].toUpperCase() + a.st.slice(1)}</div>
                    }
                  </div>
                </div>
              ))
            })()}
          </div>
        </div>

        {/* MAIN */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Header */}
          <div style={{ height: 48, display: 'flex', alignItems: 'center', padding: '0 16px 0 0', gap: 10, borderBottom: `1px solid ${gv.gbdr}`, flexShrink: 0, position: 'relative', WebkitAppRegion: 'drag' } as React.CSSProperties}>
            <div style={{ flex: 1 }} />

            {/* Search */}
            <div style={{ position: 'relative', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', background: 'rgba(255,255,255,.04)', border: `1px solid ${searchFocused ? gv.cc : gv.gbdr}`, borderRadius: 7, width: searchFocused ? 220 : 160, transition: 'all .2s' }}>
                <span style={{ color: gv.td, flexShrink: 0 }}><Ic.Srch /></span>
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => { setTimeout(() => { setSearchFocused(false); setSearchQuery('') }, 150) }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && searchResults[0]) { setNav(searchResults[0].id); setSearchQuery(''); searchRef.current?.blur() }
                    if (e.key === 'Escape') { setSearchQuery(''); searchRef.current?.blur() }
                  }}
                  placeholder="Search..."
                  style={{ background: 'none', border: 'none', outline: 'none', color: gv.tx, fontSize: 11, width: '100%', fontFamily: 'inherit' }}
                />
              </div>
              {/* Search results dropdown */}
              {searchFocused && searchResults.length > 0 && (
                <div style={{ position: 'absolute', top: '110%', right: 0, width: 220, background: gv.card, border: `1px solid ${gv.gbdr}`, borderRadius: 9, padding: 4, zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}>
                  {searchResults.map((r, i) => (
                    <div
                      key={i}
                      onMouseDown={() => { setNav(r.id); setSearchQuery('') }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, cursor: 'pointer', color: gv.tx, fontSize: 12 }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.06)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, background: r.type === 'page' ? 'rgba(123,92,255,.2)' : 'rgba(0,229,204,.15)', color: r.type === 'page' ? gv.cc : gv.ac, fontWeight: 700, textTransform: 'uppercase' }}>{r.type}</span>
                      {r.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Gear → Settings */}
            <button
              onClick={() => setNav('settings')}
              title="Settings"
              style={{ width: 28, height: 28, borderRadius: 7, background: nav === 'settings' ? 'rgba(123,92,255,.15)' : 'rgba(255,255,255,.04)', border: `1px solid ${nav === 'settings' ? gv.cc : gv.gbdr}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: nav === 'settings' ? gv.cc : gv.ts, cursor: 'pointer', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <Ic.Gear />
            </button>

            {/* Copy → Content */}
            <button
              onClick={() => setNav('content')}
              title="Content"
              style={{ width: 28, height: 28, borderRadius: 7, background: nav === 'content' ? 'rgba(123,92,255,.15)' : 'rgba(255,255,255,.04)', border: `1px solid ${nav === 'content' ? gv.cc : gv.gbdr}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: nav === 'content' ? gv.cc : gv.ts, cursor: 'pointer', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <Ic.Copy />
            </button>

            {/* Bell → Notification panel */}
            <div ref={notifRef} style={{ position: 'relative', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <button
                onClick={() => setShowNotif(v => !v)}
                title="Notifications"
                style={{ width: 28, height: 28, borderRadius: 7, background: showNotif ? 'rgba(123,92,255,.15)' : 'rgba(255,255,255,.04)', border: `1px solid ${showNotif ? gv.cc : gv.gbdr}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: showNotif ? gv.cc : gv.ts, cursor: 'pointer', position: 'relative' }}
              >
                <Ic.Bell />
                {recentLogs.length > 0 && (
                  <div style={{ position: 'absolute', top: 4, right: 4, width: 5, height: 5, borderRadius: 3, background: gv.ac, border: `1px solid ${gv.bg}` }} />
                )}
              </button>

              {showNotif && (
                <div style={{ position: 'absolute', top: '110%', right: 0, width: 300, background: gv.card, border: `1px solid ${gv.gbdr}`, borderRadius: 10, zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,.4)', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${gv.gbdr}` }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>Activity</span>
                    <span style={{ fontSize: 10, color: gv.td }}>{recentLogs.length} recent</span>
                  </div>
                  {recentLogs.length === 0 ? (
                    <div style={{ padding: '20px 14px', textAlign: 'center', color: gv.td, fontSize: 11 }}>No activity yet</div>
                  ) : (
                    recentLogs.map((log, i) => (
                      <div key={i} style={{ padding: '8px 14px', borderBottom: i < recentLogs.length - 1 ? `1px solid ${gv.gbdr}` : 'none', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ width: 5, height: 5, borderRadius: 3, background: log.c, marginTop: 5, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: gv.tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.x}</div>
                          <div style={{ fontSize: 9, color: gv.td, marginTop: 1 }}>{log.t} · {log.a}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div style={{ width: 1, height: 24, background: gv.gbdr, margin: '0 4px' }} />
            <EditableUserProfile />
          </div>

          {/* Page content */}
          <div style={{ flex: 1, padding: 14, overflow: 'hidden' }} key={nav}>
            <PageErrorBoundary>
              <Page />
            </PageErrorBoundary>
          </div>
        </div>
      </div>

    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  )
}
