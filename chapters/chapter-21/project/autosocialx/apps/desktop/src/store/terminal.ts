import { create } from 'zustand'
import { LOGS } from '../data/mock'
import type { LogEntry } from '../types'
import { getElectronAPI } from '../hooks/useElectronAPI'

interface TerminalState {
  logs: LogEntry[]
  isListening: boolean
  startListening: () => void
  stopListening: () => void
  clearLogs: () => void
}

// Holds the cleanup function returned by on()
let removeLogListener: (() => void) | null = null

// Keep the handler reference stable so we can deregister it later.
function makeHandler(
  addLog: (entry: LogEntry) => void
): (payload: unknown) => void {
  return (payload) => {
    const p = payload as { message?: string; color?: string; agentId?: string }
    const entry: LogEntry = {
      t: new Date().toLocaleTimeString('en-US', { hour12: false }),
      a: p.agentId ?? 'SYSTEM',
      x: p.message ?? '',
      c: p.color ?? '#9898B0',
    }
    addLog(entry)
  }
}

export const useTerminalStore = create<TerminalState>((set, get) => {
  // Stable handler reference kept in closure — created once per store instance.
  const handler = makeHandler((entry) => {
    set((state) => ({
      logs: [...state.logs.slice(-199), entry],  // keep at most 200 entries
    }))
  })

  return {
    logs: LOGS,       // initial mock data shown before Electron connects
    isListening: false,

    startListening: () => {
      if (get().isListening) return
      const api = getElectronAPI()
      if (!api) return
      removeLogListener = api.on('agent:log', handler)
      set({ isListening: true, logs: [] })   // clear mock, start streaming real data
    },

    stopListening: () => {
      if (!get().isListening) return
      removeLogListener?.()
      removeLogListener = null
      set({ isListening: false })
    },

    clearLogs: () => set({ logs: [] }),
  }
})
