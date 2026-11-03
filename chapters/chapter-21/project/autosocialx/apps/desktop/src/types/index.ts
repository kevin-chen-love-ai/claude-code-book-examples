export type NavId =
  | 'dashboard'
  | 'generate'
  | 'agents'
  | 'channels'
  | 'campaigns'
  | 'content'
  | 'analytics'
  | 'automation'
  | 'personas'
  | 'settings'

export type PlatformId =
  | 'x'
  | 'linkedin'
  | 'instagram'
  | 'xiaohongshu'
  | 'facebook'
  | 'pinterest'
  | 'discord'
  | 'slack'

export type AgentStatus = 'running' | 'active' | 'paused' | 'complete' | 'idle' | 'error'
export type ContentStatus = 'published' | 'scheduled' | 'draft' | 'queued' | 'failed'
export type AutoStatus = 'running' | 'paused'
export type ConnectionStatus = 'connected' | 'idle' | 'active'

export interface Agent {
  id: string
  nm: string
  pl: PlatformId
  tk: string
  st: AgentStatus
  pc: number | null
  cl: string
  channelId: string | null
  personaId: string | null
  provider: string
  model: string
  topic: string
}

export interface LogEntry {
  t: string
  a: string
  x: string
  c: string
}

export interface WeekDataPoint {
  d: string
  i: number
  e: number
}

export interface MonthDataPoint {
  m: string
  f: number
}

export interface PieDataPoint {
  name: string
  value: number
  color: string
}

export interface Campaign {
  id: string
  nm: string
  pl: PlatformId[]
  st: ConnectionStatus
  ps: number
  eng: string
  reach: string
}

export interface Content {
  id: string
  ti: string
  pl: PlatformId
  st: ContentStatus
  eg: string
  tm: string
  tp: 'original' | 'ported' | 'rewrite'
}

export interface Automation {
  id: number
  nm: string
  tr: string
  pl: PlatformId
  st: AutoStatus
  rn: number
  lr: string
}

export interface StatCard {
  l: string
  v: string
  d: string
  c: string
}

export interface AIProvider {
  n: string
  m: string
  s: ConnectionStatus
  c: string
}

export interface Account {
  p: PlatformId
  n: string
  s: ConnectionStatus
}

export interface Plugin {
  n: string
  v: string
  s: ConnectionStatus
}
