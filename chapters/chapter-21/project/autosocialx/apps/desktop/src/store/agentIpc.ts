import { create } from 'zustand'
import { getElectronAPI } from '../hooks/useElectronAPI'
import type { Agent, AgentStatus, PlatformId } from '../types'
import { AGENTS } from '../data/mock'

// platform → accent color
const PLATFORM_COLORS: Record<string, string> = {
  x: '#00E5CC',
  linkedin: '#4EAAFF',
  instagram: '#E84393',
  xiaohongshu: '#FF2442',
  tiktok: '#F0C040',
  youtube: '#EF5B6B',
}

// Extended Agent shape that carries the original UUID for IPC calls.
export type AgentWithIpcId = Agent & { _ipcId?: string }

function adaptAgent(def: Record<string, unknown>): AgentWithIpcId {
  const platform = String(def['platform'] ?? 'x')
  return {
    id: String(def['id']),
    nm: String(def['name'] ?? 'Agent'),
    pl: platform as PlatformId,
    tk: String(def['cronExpr'] ?? 'Manual trigger'),
    st: String(def['status'] ?? 'idle') as AgentStatus,
    pc: null,
    cl: PLATFORM_COLORS[platform] ?? '#00E5CC',
    _ipcId: String(def['id']),
    channelId: typeof def['channelId'] === 'string' ? def['channelId'] : null,
    personaId: typeof def['personaId'] === 'string' ? def['personaId'] : null,
    provider: typeof def['provider'] === 'string' ? def['provider'] : 'claude',
    model: typeof def['model'] === 'string' ? def['model'] : 'claude-3-5-sonnet-latest',
    topic: typeof def['customInstructions'] === 'string' ? def['customInstructions'] : '',
  }
}

/** Apply runningIpcIds on top of DB-fetched agents so poll never overwrites real-time state. */
function mergeRunning(agents: AgentWithIpcId[], runningIds: Set<string>): AgentWithIpcId[] {
  if (runningIds.size === 0) return agents
  return agents.map(a =>
    a._ipcId && runningIds.has(a._ipcId)
      ? { ...a, st: 'running' as AgentStatus }
      : a
  )
}

interface AgentIpcState {
  agents: AgentWithIpcId[]
  loading: boolean
  /** Source of truth for which agentIds are currently running (survives DB polls) */
  runningIpcIds: Set<string>
  fetchAgents: () => Promise<void>
  toggleAgent: (id: string) => Promise<void>
  triggerAgent: (id: string) => Promise<string | null>
  updateAgent: (id: string, patch: { name?: string; platform?: PlatformId; channelId?: string | null; personaId?: string | null; provider?: string; model?: string; topic?: string }) => Promise<void>
  deleteAgent: (id: string) => Promise<void>
  /** Mark agent as running/idle via real-time IPC events (no DB poll needed) */
  setAgentRunning: (ipcId: string, running: boolean) => void
}

export const useAgentIpcStore = create<AgentIpcState>((set, get) => ({
  agents: AGENTS,   // initial fallback
  loading: false,
  runningIpcIds: new Set<string>(),

  fetchAgents: async () => {
    const api = getElectronAPI()
    if (!api) return
    set({ loading: true })
    try {
      const raw = await api.agents.list()
      const adapted: AgentWithIpcId[] = Array.isArray(raw)
        ? (raw as Record<string, unknown>[]).map(adaptAgent)
        : AGENTS
      // Preserve real-time running state — poll must not overwrite it
      const { runningIpcIds } = get()
      set({ agents: mergeRunning(adapted, runningIpcIds), loading: false })
    } catch {
      set({ loading: false })
    }
  },

  setAgentRunning: (ipcId, running) => {
    set(state => {
      const next = new Set(state.runningIpcIds)
      if (running) next.add(ipcId)
      else next.delete(ipcId)
      // Re-apply running state: if stopped, DB status (idle/active) from last fetch is restored
      const agents = state.agents.map(a => {
        if (!a._ipcId) return a
        if (next.has(a._ipcId)) return { ...a, st: 'running' as AgentStatus }
        // Was running before, now stopped → restore to idle
        if (state.runningIpcIds.has(a._ipcId) && !next.has(a._ipcId)) {
          return { ...a, st: 'idle' as AgentStatus }
        }
        return a
      })
      return { runningIpcIds: next, agents }
    })
  },

  toggleAgent: async (id) => {
    const agent = get().agents.find((a) => a.id === id)
    if (!agent?._ipcId) {
      // Browser / mock mode — toggle locally.
      set((state) => ({
        agents: state.agents.map((a) =>
          a.id === id
            ? {
              ...a,
              st: (a.st === 'running' || a.st === 'active')
                ? ('paused' as AgentStatus)
                : ('running' as AgentStatus),
            }
            : a
        ),
      }))
      return
    }
    const api = getElectronAPI()
    if (!api) return
    const newStatus =
      agent.st === 'running' || agent.st === 'active' ? 'paused' : 'running'
    await api.agents.update(agent._ipcId, { status: newStatus })
    await get().fetchAgents()
  },

  triggerAgent: async (id) => {
    const agent = get().agents.find((a) => a.id === id)
    if (!agent?._ipcId) return null
    const api = getElectronAPI()
    if (!api) return null
    const taskId = await api.agents.trigger(agent._ipcId)
    return typeof taskId === 'string' ? taskId : null
  },

  updateAgent: async (id, patch) => {
    const agent = get().agents.find((a) => a.id === id)
    if (!agent?._ipcId) return
    const api = getElectronAPI()
    if (!api) return
    const payload = { ...patch, customInstructions: patch.topic }
    await api.agents.update(agent._ipcId, payload)
    await get().fetchAgents()
  },

  deleteAgent: async (id) => {
    const agent = get().agents.find((a) => a.id === id)
    if (!agent?._ipcId) return
    const api = getElectronAPI()
    if (!api) return
    await api.agents.delete(agent._ipcId)
    await get().fetchAgents()
  },
}))
