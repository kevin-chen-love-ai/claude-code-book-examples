import { create } from 'zustand'
import type { Agent } from '../types'
import { AGENTS } from '../data/mock'

interface AgentsState {
  agents: Agent[]
  toggleAgent: (id: string) => void
}

export const useAgentsStore = create<AgentsState>((set) => ({
  agents: AGENTS,
  toggleAgent: (id) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === id
          ? { ...a, st: a.st === 'running' || a.st === 'active' ? 'paused' : 'running' }
          : a
      ),
    })),
}))
