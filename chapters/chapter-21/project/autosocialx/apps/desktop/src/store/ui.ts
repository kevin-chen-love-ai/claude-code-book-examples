import { create } from 'zustand'
import type { NavId } from '../types'

interface UIState {
  nav: NavId
  setNav: (nav: NavId) => void
  contentCampaignId: string | null
  setContentCampaignId: (id: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  nav: 'dashboard',
  setNav: (nav) => set({ nav }),
  contentCampaignId: null,
  setContentCampaignId: (id) => set({ contentCampaignId: id }),
}))
