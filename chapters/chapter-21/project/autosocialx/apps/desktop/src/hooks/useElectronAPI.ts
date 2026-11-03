import type { ElectronAPI } from '../types/electron.d.ts'

// Safe accessor used inside React components.
export function useElectronAPI(): ElectronAPI | null {
  if (typeof window !== 'undefined' && 'electronAPI' in window) {
    return window.electronAPI ?? null
  }
  return null
}

// Non-hook accessor for use inside Zustand stores.
export function getElectronAPI(): ElectronAPI | null {
  if (typeof window !== 'undefined' && 'electronAPI' in window) {
    return window.electronAPI ?? null
  }
  return null
}
