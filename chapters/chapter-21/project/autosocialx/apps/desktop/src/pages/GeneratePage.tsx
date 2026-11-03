import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/Button'
import { Ic } from '../components/Icon'
import { gv } from '../components/tokens'
import { PlatformIcon } from '../components/PlatformIcon'
import { PlatformPreviewCard } from '../components/PlatformPreviewCard'
import type { PlatformId } from '../types'

interface AgentRow {
    id: string
    name: string
    platform: string
    status: string
}

interface ChannelRow {
    id: string
    platform: string
    enabled: boolean
    name: string
}

interface Step {
    label: string
    status: 'active' | 'done' | 'error'
    type: 'reasoning' | 'tool' | 'result' | 'final' | 'error'
}

interface Message {
    id: string
    role: 'user' | 'agent'
    text: string
    steps?: Step[]
    finalAnswer?: string
    error?: string
    runStatus?: 'queued' | 'running' | 'done' | 'failed'
    preview?: { platform: PlatformId; text: string; mediaUrls?: string[]; contentId?: string }
}


const AVAILABLE_MODELS = [
    { id: 'qwen3.5-plus', name: 'Qwen 3.5 Plus' },
    { id: 'qwen3-max-2026-01-23', name: 'Qwen 3 Max' },
    { id: 'qwen3-coder-next', name: 'Qwen 3 Coder Next' },
    { id: 'qwen3-coder-plus', name: 'Qwen 3 Coder Plus' },
    { id: 'MiniMax-M2.5', name: 'MiniMax M2.5' },
    { id: 'glm-5', name: 'GLM 5' },
    { id: 'glm-4.7', name: 'GLM 4.7' },
    { id: 'kimi-k2.5', name: 'Kimi K2.5' },
]

function parseStepType(message: string): Step['type'] {
    if (message.startsWith('[Tool] Calling')) return 'tool'
    if (message.startsWith('[Tool]')) return 'result'
    if (message.startsWith('[Done]')) return 'final'
    return 'reasoning'
}

export const GeneratePage = () => {
    const { t } = useTranslation()
    const [agents, setAgents] = useState<AgentRow[]>([])
    const [channels, setChannels] = useState<ChannelRow[]>([])
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
    const [prompt, setPrompt] = useState('')
    const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)

    const selectedChannel = channels.find(c => c.id === selectedChannelId)
    const selectedPlatform = (selectedChannel?.platform || null) as PlatformId | null
    const [configuredProviders, setConfiguredProviders] = useState<Array<{ key: string; name: string }>>([])
    const [selectedProvider, setSelectedProvider] = useState<string>('')
    const [selectedModel, setSelectedModel] = useState('qwen3.5-plus')
    const [messages, setMessages] = useState<Message[]>([])
    const [isGenerating, setIsGenerating] = useState(false)
    const [schedulingMsgId, setSchedulingMsgId] = useState<string | null>(null)
    const [scheduleValue, setScheduleValue] = useState('')
    const [scheduleResult, setScheduleResult] = useState<Record<string, { ok: boolean; text: string }>>({})
    const scrollRef = useRef<HTMLDivElement>(null)
    const runningAgentId = useRef<string | null>(null)
    const agentMsgId = useRef<string | null>(null)
    const mountedRef = useRef(true)
    const selectedPlatformRef = useRef<PlatformId | null>(null)
    // Tracks the contentId produced by schedule_post during the active run
    const latestContentId = useRef<string | null>(null)
    // Synchronous guard to prevent double-invocation from fast double-click or
    // Enter+click before React can re-render with isGenerating=true
    const sendingRef = useRef(false)

    useEffect(() => {
        mountedRef.current = true
        return () => { mountedRef.current = false }
    }, [])

    // Keep ref in sync so IPC handlers always have the latest platform
    useEffect(() => {
        selectedPlatformRef.current = selectedPlatform
    }, [selectedPlatform])

    // Auto-scroll on new messages/steps
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    // Load agents list & providers
    useEffect(() => {
        const load = async () => {
            if (!window.electronAPI) return
            try {
                const list = await window.electronAPI.agents.list() as AgentRow[]
                const providers = await window.electronAPI.llm.providersDetail()
                const chanList = await window.electronAPI.channels.list() as ChannelRow[]
                console.log('[DEBUG] Loaded agents:', list)
                if (mountedRef.current) {
                    setAgents(list)
                    setConfiguredProviders(providers)
                    setChannels(chanList || [])
                    if (providers.length > 0) setSelectedProvider(providers[0].key)
                }
            } catch (err) {
                console.error('[DEBUG] Failed to load agents or providers:', err)
            }
        }
        load()
    }, [])

    // Auto-select first matching agent when platform or agent list changes
    useEffect(() => {
        if (!selectedPlatform) { setSelectedAgentId(null); return }
        const match = agents.find(a => a.platform === selectedPlatform)
        setSelectedAgentId(prev => {
            // Keep existing selection if still valid for this platform
            if (prev && agents.find(a => a.id === prev && a.platform === selectedPlatform)) return prev
            return match?.id ?? null
        })
    }, [selectedPlatform, agents])

    // IPC event subscriptions — registered ONCE on mount to prevent listener accumulation.
    // selectedPlatform is read via selectedPlatformRef so onComplete always has the latest value.
    useEffect(() => {
        if (!window.electronAPI) return

        const onLog = (payload: unknown) => {
            const p = payload as { agentId: string; runId: string; message: string }
            if (p.agentId !== runningAgentId.current || !agentMsgId.current || !mountedRef.current) return

            // Filter noisy intermediate messages
            if (p.message.startsWith('[image_gen] Poll attempt')) return
            if (p.message.startsWith('[image_gen] Task submitted')) return

            const msgId = agentMsgId.current
            const stepType = parseStepType(p.message)

            setMessages(prev => prev.map(m => {
                if (m.id !== msgId) return m
                const prevSteps = (m.steps ?? [])

                if (stepType === 'result') {
                    // Tool returned — mark the active "Calling X..." step as done.
                    // Don't add a new step; the result is implied by the tool completing.
                    return {
                        ...m,
                        runStatus: 'running' as const,
                        steps: prevSteps.map(s => s.status === 'active' ? { ...s, status: 'done' as const } : s),
                    }
                }

                const updatedSteps = prevSteps.map(s =>
                    s.status === 'active' ? { ...s, status: 'done' as const } : s
                )
                return {
                    ...m,
                    runStatus: 'running' as const,
                    steps: [...updatedSteps, { label: p.message, status: 'active' as const, type: stepType }],
                }
            }))
        }

        const onPostScheduled = (payload: unknown) => {
            const p = payload as { agentId: string; contentId: string }
            if (p.agentId === runningAgentId.current) {
                latestContentId.current = p.contentId
            }
        }

        const onComplete = (payload: unknown) => {
            const p = payload as {
                agentId: string
                runId: string
                result: { finalAnswer: string; success: boolean }
            }
            if (p.agentId !== runningAgentId.current || !agentMsgId.current || !mountedRef.current) return
            const msgId = agentMsgId.current
            const platform = selectedPlatformRef.current
            const contentId = latestContentId.current

            const finalizeMessage = (text: string, mediaUrls: string[], cid?: string) => {
                if (!mountedRef.current) return
                setMessages(prev => prev.map(m => {
                    if (m.id !== msgId) return m
                    const finalSteps = (m.steps ?? []).map(s =>
                        s.status === 'active' ? { ...s, status: 'done' as const } : s
                    )
                    return {
                        ...m,
                        steps: finalSteps,
                        text: t('generate.log_generation_complete', 'Generation complete:'),
                        finalAnswer: text,
                        runStatus: 'done' as const,
                        preview: platform ? { platform, text, mediaUrls, contentId: cid } : undefined,
                    }
                }))
                setIsGenerating(false)
                runningAgentId.current = null
                agentMsgId.current = null
                latestContentId.current = null
            }

            if (contentId && window.electronAPI) {
                // Fetch full content record (with image) then finalize
                window.electronAPI.content.get(contentId).then(row => {
                    if (!row || !mountedRef.current) {
                        finalizeMessage(p.result.finalAnswer, [])
                        return
                    }
                    const r = row as { text: string; media_urls: string }
                    let mediaUrls: string[] = []
                    try { mediaUrls = JSON.parse(r.media_urls) as string[] } catch { /* empty */ }
                    finalizeMessage(r.text || p.result.finalAnswer, mediaUrls, contentId)
                }).catch(() => finalizeMessage(p.result.finalAnswer, []))
            } else {
                finalizeMessage(p.result.finalAnswer, [])
            }
        }

        const onFailed = (payload: unknown) => {
            const p = payload as { agentId: string; runId: string; error: string }
            if (p.agentId !== runningAgentId.current || !agentMsgId.current || !mountedRef.current) return
            const msgId = agentMsgId.current
            setMessages(prev => prev.map(m => {
                if (m.id !== msgId) return m
                const finalSteps = (m.steps ?? []).map(s =>
                    s.status === 'active' ? { ...s, status: 'error' as const, type: 'error' as const } : s
                )
                return { ...m, steps: finalSteps, error: p.error, runStatus: 'failed' as const }
            }))
            setIsGenerating(false)
            runningAgentId.current = null
            agentMsgId.current = null
        }

        const removeLog = window.electronAPI.on('agent:log', onLog)
        const removeComplete = window.electronAPI.on('agent:run-complete', onComplete)
        const removeFailed = window.electronAPI.on('agent:run-failed', onFailed)
        const removeScheduled = window.electronAPI.on('post:scheduled', onPostScheduled)

        return () => {
            removeLog()
            removeComplete()
            removeFailed()
            removeScheduled()
        }
    }, [])  // ← register once; selectedPlatform read via ref

    const platformAgents = agents.filter(a => a.platform === selectedPlatform)
    const selectedAgent = agents.find(a => a.id === selectedAgentId)

    const handleSend = async () => {
        if (!prompt.trim() || !selectedPlatform || isGenerating || sendingRef.current) return
        sendingRef.current = true

        const agentId = selectedAgentId
        const userMsg: Message = { id: Date.now().toString(), role: 'user', text: prompt.trim() }
        const msgId = (Date.now() + 1).toString()
        const agentMsg: Message = {
            id: msgId,
            role: 'agent',
            text: '',
            steps: [{ label: 'Task queued for agent execution...', status: 'active', type: 'reasoning' }],
            runStatus: 'queued',
        }

        setMessages(prev => [...prev, userMsg, agentMsg])
        setPrompt('')
        setIsGenerating(true)
        agentMsgId.current = msgId
        latestContentId.current = null

        if (window.electronAPI) {
            try {
                let virtualAgentId: string
                if (agentId) {
                    // Use configured agent (carries persona + custom instructions)
                    runningAgentId.current = agentId
                    await window.electronAPI.agents.trigger(agentId, {
                        prompt: prompt.trim(),
                        provider: selectedProvider,
                        model: selectedModel,
                        platform: selectedPlatform,
                    })
                } else {
                    // Direct mode: no agent needed, run with selected provider/model/platform
                    virtualAgentId = await window.electronAPI.agents.triggerDirect({
                        prompt: prompt.trim(),
                        provider: selectedProvider,
                        model: selectedModel,
                        platform: selectedPlatform!,
                    })
                    runningAgentId.current = virtualAgentId
                }
                // Task is now queued; isGenerating remains true until run-complete/run-failed
                sendingRef.current = false
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err)
                sendingRef.current = false
                if (mountedRef.current) {
                    setMessages(prev => prev.map(m =>
                        m.id === msgId ? { ...m, error: errMsg, runStatus: 'failed' as const } : m
                    ))
                    setIsGenerating(false)
                    runningAgentId.current = null
                    agentMsgId.current = null
                }
            }
        } else {
            // Vite browser fallback: simulate steps
            runningAgentId.current = '__mock__'
            const steps = [
                t('generate.mock_analyzing', 'Analyzing request intent...'),
                t('generate.mock_retrieving', 'Retrieving persona from Semantic Memory...'),
                '[Tool] Calling web_search...',
                '[Tool] web_search → {"results": [...trending topics found]}',
                t('generate.mock_drafting', { platform: selectedPlatform, defaultValue: `Drafting content for ${selectedPlatform}...` }),
                `[Done] ${t('generate.mock_done', 'Final answer generated')}`,
            ]
            for (let i = 0; i < steps.length; i++) {
                await new Promise(r => setTimeout(r, 900 + Math.random() * 400))
                if (!mountedRef.current) break
                const label = steps[i]!
                const type = parseStepType(label)
                setMessages(prev => prev.map(m => {
                    if (m.id !== msgId) return m
                    const prevSteps = (m.steps ?? []).map(s =>
                        s.status === 'active' ? { ...s, status: 'done' as const } : s
                    )
                    return {
                        ...m, runStatus: 'running' as const,
                        steps: [...prevSteps, { label, status: 'active' as const, type }],
                    }
                }))
            }
            await new Promise(r => setTimeout(r, 600))
            if (mountedRef.current) {
                const mockContent = `🚀 Just unlocked a new way to automate your entire social media strategy!\n\nWith AI agents handling research, drafting, and scheduling — you stay focused on what matters. No more context-switching.\n\n✅ Platform-aware tone\n✅ Trend-driven hashtags\n✅ Autonomous scheduling\n\n#AutoSocialX #AIMarketing #SocialMediaAutomation`
                setMessages(prev => prev.map(m => {
                    if (m.id !== msgId) return m
                    return {
                        ...m,
                        steps: (m.steps ?? []).map(s => ({ ...s, status: 'done' as const })),
                        text: t('generate.log_generation_complete', 'Generation complete:'),
                        finalAnswer: mockContent,
                        runStatus: 'done' as const,
                        preview: { platform: selectedPlatform!, text: mockContent },
                    }
                }))
                setIsGenerating(false)
                runningAgentId.current = null
                agentMsgId.current = null
                sendingRef.current = false
            }
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '0 0 14px 0', borderBottom: `1px solid ${gv.gbdr}`, flexShrink: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                    <div style={{ fontSize: 17, fontWeight: 800 }}>{t('generate.title', 'Generate')}</div>
                    <div style={{ fontSize: 11, color: gv.td, marginTop: 2 }}>{t('generate.desc', 'Chat with an agent to generate and refine content')}</div>
                </div>
                {messages.length > 0 && (
                    <button
                        onClick={() => { setMessages([]); setSelectedChannelId(null) }}
                        style={{ padding: '5px 12px', borderRadius: 7, background: 'rgba(255,255,255,.04)', border: `1px solid ${gv.gbdr}`, color: gv.ts, fontSize: 11, cursor: 'pointer' }}
                    >
                        {t('generate.new_session', 'New session')}
                    </button>
                )}
            </div>

            {/* Message area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0', display: 'flex', flexDirection: 'column' }} ref={scrollRef}>
                {messages.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{t('generate.hero_title', 'What do you want to generate?')}</div>
                            <div style={{ fontSize: 13, color: gv.td }}>{t('generate.hero_desc', 'Select a platform — the agent will customize tone and format automatically')}</div>
                        </div>

                        {/* Platform scroll strip */}
                        <div style={{ width: '100%', position: 'relative' }}>
                            {/* Right fade hint */}
                            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 4, width: 48, background: `linear-gradient(to right, transparent, ${gv.bg})`, pointerEvents: 'none', zIndex: 1 }} />
                            <div
                                className="hide-scrollbar"
                                style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, paddingTop: 4, paddingLeft: 4, paddingRight: 48 }}
                            >
                                {(() => {
                                    const isMock = !window.electronAPI
                                    const activeChannels = isMock
                                        ? [
                                            { id: 'mock-x', platform: 'x', name: 'Twitter / X', enabled: true },
                                            { id: 'mock-linkedin', platform: 'linkedin', name: 'LinkedIn', enabled: true }
                                        ] as ChannelRow[]
                                        : channels.filter(c => c.enabled)

                                    if (activeChannels.length === 0) {
                                        return (
                                            <div style={{ fontSize: 13, color: gv.ts, padding: '10px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Ic.Info /> {t('generate.no_active_channels', 'No active channels found. Please enable publishing channels first.')}
                                            </div>
                                        )
                                    }

                                    return activeChannels.map(ch => {
                                        const p = ch.platform as PlatformId
                                        const active = selectedChannelId === ch.id
                                        const agentsForP = agents.filter(a => a.platform === p)
                                        const cnt = agentsForP.length
                                        const hasAgent = !window.electronAPI || cnt > 0
                                        return (
                                            <div
                                                key={ch.id}
                                                onClick={() => setSelectedChannelId(ch.id)}
                                                style={{
                                                    flexShrink: 0, width: 104,
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                                                    padding: '16px 8px 14px',
                                                    borderRadius: 16, cursor: 'pointer',
                                                    background: active ? `${gv.ac}18` : 'rgba(255,255,255,.02)',
                                                    border: `1px solid ${active ? gv.ac : gv.gbdr}`,
                                                    boxShadow: active ? `0 8px 20px -6px ${gv.ac}40` : 'none',
                                                    transform: active ? 'translateY(-3px)' : 'none',
                                                    transition: 'all .18s cubic-bezier(0.16, 1, 0.3, 1)',
                                                }}
                                                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,.05)'; e.currentTarget.style.borderColor = gv.gbdr } }}
                                                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,.02)'; e.currentTarget.style.borderColor = gv.gbdr } }}
                                            >
                                                <div style={{
                                                    width: 44, height: 44, borderRadius: 12,
                                                    background: active ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.04)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    transition: 'all .18s',
                                                }}>
                                                    <PlatformIcon p={p} s={28} />
                                                </div>
                                                <div style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? '#fff' : gv.ts, textAlign: 'center', lineHeight: 1.2, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px' }} title={ch.name}>
                                                    {ch.name}
                                                </div>
                                                <div style={{
                                                    fontSize: 9, fontWeight: 600,
                                                    padding: '2px 7px', borderRadius: 8,
                                                    background: hasAgent ? `${gv.gr}18` : `${gv.yl}15`,
                                                    color: hasAgent ? gv.gr : gv.yl,
                                                    lineHeight: 1.4,
                                                }}>
                                                    {hasAgent ? (cnt > 0 ? `${cnt} agent${cnt > 1 ? 's' : ''}` : '✓ ready') : 'no agent'}
                                                </div>
                                            </div>
                                        )
                                    })
                                })()}
                            </div>
                        </div>

                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 24 }}>
                        {messages.map(m => (
                            <div key={m.id} style={{ display: 'flex', gap: 16, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                                {/* Avatar */}
                                <div style={{
                                    width: 36, height: 36, borderRadius: 18,
                                    background: m.role === 'user' ? gv.ac : 'linear-gradient(135deg,#7B5CFF,#00E5CC)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0, fontWeight: 800, fontSize: 14, color: '#fff',
                                    boxShadow: '0 4px 12px rgba(0,0,0,.25)',
                                }}>
                                    {m.role === 'user' ? 'U' : 'Ai'}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxWidth: '82%' }}>
                                    {/* Name + status badge */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: m.role === 'agent' ? 4 : 0, marginRight: m.role === 'user' ? 4 : 0, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: gv.ts }}>
                                            {m.role === 'user' ? t('generate.msg_you', 'You') : (selectedAgent?.name ?? t('generate.msg_agent_core', 'Agent Core'))}
                                        </span>
                                        {m.role === 'agent' && (
                                            <span style={{
                                                fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 600,
                                                background: m.runStatus === 'running' ? `${gv.cc}20`
                                                    : m.runStatus === 'done' ? `${gv.gr}20`
                                                        : m.runStatus === 'failed' ? `${gv.rd}20`
                                                            : `${gv.yl}20`,
                                                color: m.runStatus === 'running' ? gv.cc
                                                    : m.runStatus === 'done' ? gv.gr
                                                        : m.runStatus === 'failed' ? gv.rd
                                                            : gv.yl,
                                            }}>
                                                {m.runStatus === 'running' ? t('generate.status_running', '● Running')
                                                    : m.runStatus === 'done' ? t('generate.status_done', '✓ Done')
                                                        : m.runStatus === 'failed' ? t('generate.status_failed', '✗ Failed')
                                                            : t('generate.status_queued', '⏳ Queued')}
                                            </span>
                                        )}
                                    </div>

                                    {/* Bubble */}
                                    <div style={{
                                        padding: '16px 20px',
                                        borderRadius: 16,
                                        borderTopRightRadius: m.role === 'user' ? 4 : 16,
                                        borderTopLeftRadius: m.role === 'agent' ? 4 : 16,
                                        background: m.role === 'user' ? 'rgba(123,92,255,.15)' : 'rgba(255,255,255,.04)',
                                        border: `1px solid ${m.role === 'user' ? 'rgba(123,92,255,.3)' : gv.gbdr}`,
                                        color: gv.tx, fontSize: 14, lineHeight: 1.6,
                                        boxShadow: '0 4px 16px rgba(0,0,0,.1)',
                                    }}>
                                        {/* ReAct steps */}
                                        {m.steps && m.steps.length > 0 && (
                                            <div style={{
                                                display: 'flex', flexDirection: 'column', gap: 8,
                                                marginBottom: (m.text || m.error) ? 16 : 0,
                                                paddingBottom: (m.text || m.error) ? 16 : 0,
                                                borderBottom: (m.text || m.error) ? `1px dashed ${gv.gbdr}` : 'none',
                                            }}>
                                                {m.steps.map((s, idx) => (
                                                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                                        {/* Step icon */}
                                                        <span style={{ flexShrink: 0, marginTop: 1, display: 'flex' }}>
                                                            {s.status === 'done'
                                                                ? <span style={{ color: s.type === 'final' ? gv.cc : gv.gr }}><Ic.Chk /></span>
                                                                : s.status === 'error'
                                                                    ? <span style={{ color: gv.rd }}><Ic.X /></span>
                                                                    : <span style={{ color: s.type === 'tool' ? gv.am : gv.cc }}><Ic.Term /></span>
                                                            }
                                                        </span>
                                                        <span style={{
                                                            fontSize: 12, lineHeight: 1.4,
                                                            color: s.status === 'active' ? gv.tx
                                                                : s.status === 'error' ? gv.rd
                                                                    : gv.ts,
                                                            fontWeight: s.status === 'active' ? 600 : 400,
                                                            fontFamily: s.type === 'result' ? "'JetBrains Mono', monospace" : 'inherit',
                                                        }}>
                                                            {s.label}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Error message */}
                                        {m.error && (
                                            <div style={{ padding: '10px 14px', borderRadius: 8, background: `${gv.rd}10`, border: `1px solid ${gv.rd}30`, color: gv.rd, fontSize: 13 }}>
                                                <strong>{t('generate.error_prefix', 'Error:')}</strong> {m.error}
                                            </div>
                                        )}

                                        {/* Intro text */}
                                        {m.text && !m.error && (
                                            <div style={{ color: gv.ts, fontSize: 12, marginBottom: m.preview ? 12 : 0 }}>{m.text}</div>
                                        )}

                                        {/* Generated content preview */}
                                        {m.preview && (
                                            <div style={{ borderRadius: 12, border: `1px solid ${gv.gbdr}`, overflow: 'hidden' }}>
                                                {/* Preview header */}
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,.03)', borderBottom: `1px solid ${gv.gbdr}` }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                                        <PlatformIcon p={m.preview.platform} s={16} />
                                                        <span style={{ fontSize: 12, fontWeight: 700, color: gv.ts }}>{t('generate.generated_preview', 'Generated Content')}</span>
                                                        {m.preview.mediaUrls && m.preview.mediaUrls.length > 0 && (
                                                            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: `${gv.gr}18`, color: gv.gr, fontWeight: 600 }}>🖼 {m.preview.mediaUrls.length} img</span>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => navigator.clipboard.writeText(m.preview!.text)}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'transparent', border: `1px solid ${gv.gbdr}`, color: gv.ts, fontSize: 10, cursor: 'pointer' }}
                                                    >
                                                        <Ic.Copy /> {t('generate.btn_copy', 'Copy')}
                                                    </button>
                                                </div>
                                                {/* Platform-style preview with image */}
                                                <div style={{ padding: 14 }}>
                                                    <PlatformPreviewCard
                                                        platform={m.preview.platform}
                                                        text={m.preview.text}
                                                        mediaUrls={m.preview.mediaUrls}
                                                    />
                                                </div>
                                                {/* Actions */}
                                                <div style={{ borderTop: `1px solid ${gv.gbdr}`, background: 'rgba(255,255,255,.02)' }}>
                                                    <div style={{ display: 'flex', gap: 8, padding: '10px 14px', alignItems: 'center' }}>
                                                        {m.preview.contentId ? (
                                                            <>
                                                                <button style={{ padding: '7px 12px', borderRadius: 7, background: 'rgba(255,255,255,.06)', border: `1px solid ${gv.gbdr}`, color: gv.ts, fontSize: 12, fontWeight: 600, cursor: 'default' }}>
                                                                    ✓ {t('generate.btn_saved', 'Saved')}
                                                                </button>
                                                                <button
                                                                    onClick={() => { setSchedulingMsgId(prev => prev === m.id ? null : m.id); setScheduleValue('') }}
                                                                    style={{ padding: '7px 12px', borderRadius: 7, background: schedulingMsgId === m.id ? `${gv.yl}18` : 'rgba(255,255,255,.04)', border: `1px solid ${schedulingMsgId === m.id ? gv.yl : gv.gbdr}`, color: schedulingMsgId === m.id ? gv.yl : gv.ts, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                                                >
                                                                    {t('generate.btn_schedule', 'Schedule')}
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        if (!window.electronAPI || !m.preview?.contentId) return
                                                                        void window.electronAPI.content.publish(m.preview.contentId)
                                                                            .then(r => setScheduleResult(prev => ({ ...prev, [m.id]: { ok: r.success, text: r.success ? '✓ Published' : (r.error ?? 'Failed') } })))
                                                                    }}
                                                                    style={{ flex: 1, padding: '7px 12px', borderRadius: 7, background: `${gv.cc}18`, border: `1px solid ${gv.cc}40`, color: gv.cc, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                                                >
                                                                    {t('generate.btn_publish_now', 'Publish Now')}
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    onClick={() => {
                                                                        if (!window.electronAPI) return
                                                                        void window.electronAPI.content.create({ platform: m.preview!.platform, text: m.preview!.text, mediaUrls: m.preview!.mediaUrls ?? [], agentId: selectedAgentId ?? 'manual' })
                                                                    }}
                                                                    style={{ padding: '7px 12px', borderRadius: 7, background: 'rgba(255,255,255,.06)', border: `1px solid ${gv.gbdr}`, color: gv.tx, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                                                >
                                                                    {t('generate.btn_save_draft', 'Save as Draft')}
                                                                </button>
                                                                <button
                                                                    onClick={() => { setSchedulingMsgId(prev => prev === m.id ? null : m.id); setScheduleValue('') }}
                                                                    style={{ padding: '7px 12px', borderRadius: 7, background: schedulingMsgId === m.id ? `${gv.yl}18` : 'rgba(255,255,255,.04)', border: `1px solid ${schedulingMsgId === m.id ? gv.yl : gv.gbdr}`, color: schedulingMsgId === m.id ? gv.yl : gv.ts, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                                                >
                                                                    {t('generate.btn_schedule', 'Schedule')}
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        if (!window.electronAPI) return
                                                                        void window.electronAPI.content.create({ platform: m.preview!.platform, text: m.preview!.text, mediaUrls: m.preview!.mediaUrls ?? [], agentId: selectedAgentId ?? 'manual' })
                                                                            .then(({ id }) => window.electronAPI!.content.publish(id)
                                                                                .then(r => setScheduleResult(prev => ({ ...prev, [m.id]: { ok: r.success, text: r.success ? '✓ Published' : (r.error ?? 'Failed') } }))))
                                                                    }}
                                                                    style={{ flex: 1, padding: '7px 12px', borderRadius: 7, background: `${gv.cc}18`, border: `1px solid ${gv.cc}40`, color: gv.cc, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                                                >
                                                                    {t('generate.btn_publish_now', 'Publish Now')}
                                                                </button>
                                                            </>
                                                        )}
                                                        {scheduleResult[m.id] && (
                                                            <span style={{ fontSize: 11, color: scheduleResult[m.id].ok ? gv.gr : gv.rd, flexShrink: 0 }}>{scheduleResult[m.id].text}</span>
                                                        )}
                                                    </div>
                                                    {/* Schedule datetime picker */}
                                                    {schedulingMsgId === m.id && (
                                                        <div style={{ display: 'flex', gap: 8, padding: '0 14px 10px', alignItems: 'center' }}>
                                                            <input
                                                                type="datetime-local"
                                                                value={scheduleValue}
                                                                min={new Date().toISOString().slice(0, 16)}
                                                                onChange={e => setScheduleValue(e.target.value)}
                                                                style={{ flex: 1, padding: '6px 10px', borderRadius: 7, background: 'rgba(255,255,255,.05)', border: `1px solid ${gv.yl}50`, color: gv.tx, fontSize: 12, outline: 'none', colorScheme: 'dark' }}
                                                            />
                                                            <button
                                                                disabled={!scheduleValue}
                                                                onClick={() => {
                                                                    if (!scheduleValue || !window.electronAPI) return
                                                                    const preview = m.preview!
                                                                    const doSchedule = (cid: string) =>
                                                                        window.electronAPI!.content.setSchedule(cid, new Date(scheduleValue).toISOString())
                                                                            .then(() => { setScheduleResult(prev => ({ ...prev, [m.id]: { ok: true, text: `✓ Scheduled for ${new Date(scheduleValue).toLocaleString()}` } })); setSchedulingMsgId(null) })
                                                                    if (preview.contentId) {
                                                                        void doSchedule(preview.contentId)
                                                                    } else {
                                                                        void window.electronAPI!.content.create({ platform: preview.platform, text: preview.text, mediaUrls: preview.mediaUrls ?? [], agentId: selectedAgentId ?? 'manual' })
                                                                            .then(({ id }) => doSchedule(id))
                                                                    }
                                                                }}
                                                                style={{ padding: '6px 14px', borderRadius: 7, background: scheduleValue ? `${gv.yl}20` : 'rgba(255,255,255,.03)', border: `1px solid ${scheduleValue ? gv.yl : gv.gbdr}`, color: scheduleValue ? gv.yl : gv.td, fontSize: 12, fontWeight: 600, cursor: scheduleValue ? 'pointer' : 'default' }}
                                                            >
                                                                {t('generate.btn_confirm_schedule', 'Confirm')}
                                                            </button>
                                                            <button
                                                                onClick={() => setSchedulingMsgId(null)}
                                                                style={{ padding: '6px 10px', borderRadius: 7, background: 'transparent', border: `1px solid ${gv.gbdr}`, color: gv.td, fontSize: 12, cursor: 'pointer' }}
                                                            >
                                                                {t('generate.btn_cancel', 'Cancel')}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Input area */}
            <div style={{ flexShrink: 0, padding: '12px 0 0 0', borderTop: `1px solid ${gv.gbdr}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedPlatform && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Agent selector */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: 'rgba(255,255,255,.04)', border: `1px solid ${gv.gbdr}` }}>
                            <PlatformIcon p={selectedPlatform} s={14} />
                            {platformAgents.length > 0 ? (
                                <select
                                    value={selectedAgentId ?? ''}
                                    onChange={e => setSelectedAgentId(e.target.value || null)}
                                    style={{ background: 'transparent', border: 'none', color: gv.tx, fontSize: 12, fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                                >
                                    {platformAgents.map(a => (
                                        <option key={a.id} value={a.id} style={{ background: '#1a1a2e' }}>{a.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <span style={{ fontSize: 12, color: gv.yl }}>{t('generate.agent_count_zero', 'No agent')}</span>
                            )}
                        </div>

                        <div style={{ width: 1, height: 18, background: gv.gbdr }} />

                        {/* Provider */}
                        <span style={{ fontSize: 10, fontWeight: 700, color: gv.td, textTransform: 'uppercase', letterSpacing: '.05em' }}>{t('generate.lbl_provider', 'Provider:')}</span>
                        <select
                            value={selectedProvider}
                            onChange={e => setSelectedProvider(e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: gv.tx, fontSize: 12, fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                        >
                            {configuredProviders.map(p => (
                                <option key={p.key} value={p.key} style={{ background: '#222' }}>{p.name}</option>
                            ))}
                            {configuredProviders.length === 0 && <option value="" disabled>{t('generate.provider_none', 'None Configured')}</option>}
                        </select>

                        <div style={{ width: 1, height: 18, background: gv.gbdr }} />

                        {/* Model */}
                        <span style={{ fontSize: 10, fontWeight: 700, color: gv.td, textTransform: 'uppercase', letterSpacing: '.05em' }}>{t('generate.lbl_model', 'Model:')}</span>
                        <select
                            value={selectedModel}
                            onChange={e => setSelectedModel(e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: gv.tx, fontSize: 12, fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                        >
                            {AVAILABLE_MODELS.map(model => (
                                <option key={model.id} value={model.id} style={{ background: '#222' }}>{model.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Prompt input + send */}
                <div style={{ display: 'flex', gap: 12 }}>
                    <input
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
                        disabled={!selectedPlatform || isGenerating}
                        placeholder={
                            !selectedPlatform ? t('generate.input_placeholder_no_platform', 'Select a platform above first...')
                                : t('generate.input_placeholder_ready', 'Describe what content to generate...')
                        }
                        style={{
                            flex: 1, background: 'rgba(255,255,255,.04)',
                            border: `1px solid ${selectedPlatform ? gv.gbdr : 'rgba(255,255,255,.02)'}`,
                            borderRadius: 10, color: gv.tx, fontSize: 14, padding: '13px 18px', outline: 'none',
                            opacity: !selectedPlatform ? 0.45 : 1,
                            transition: 'all .2s', fontFamily: 'inherit',
                        }}
                        onFocus={e => { if (selectedPlatform) e.currentTarget.style.borderColor = gv.ac }}
                        onBlur={e => { if (selectedPlatform) e.currentTarget.style.borderColor = gv.gbdr }}
                    />
                    <Button
                        primary
                        onClick={() => void handleSend()}
                        disabled={!selectedPlatform || isGenerating || !prompt.trim()}
                    >
                        {isGenerating ? t('generate.btn_generating', 'Running...') : t('generate.btn_generate', 'Generate')}
                    </Button>
                </div>
            </div>
        </div>
    )
}
