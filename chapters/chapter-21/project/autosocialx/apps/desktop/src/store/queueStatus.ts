import { create } from 'zustand'
import { getElectronAPI } from '../hooks/useElectronAPI'

interface QueueStatus {
  pending: number
  running: number
}

interface QueueStatusState {
  status: QueueStatus
  poll: () => Promise<void>
  startPolling: (intervalMs?: number) => void
  stopPolling: () => void
}

// Every 3 seconds by default.
export const useQueueStatusStore = create<QueueStatusState>((set) => {
  let timer: ReturnType<typeof setInterval> | null = null

  const doPoll = async () => {
    const api = getElectronAPI()
    if (!api) return
    try {
      const s = await api.queue.status() as QueueStatus
      set({ status: s })
    } catch { /* ignore transient poll errors */ }
  }

  return {
    status: { pending: 0, running: 0 },

    poll: doPoll,

    startPolling: (intervalMs = 3000) => {
      if (timer !== null) return
      void doPoll()   // immediate first fetch
      timer = setInterval(() => { void doPoll() }, intervalMs)
    },

    stopPolling: () => {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
    },
  }
})
