import type { CSSProperties } from 'react'

export const statusColors: Record<string, string> = {
  published: '#3DD68C',
  scheduled: '#F0C040',
  draft: '#8080A8',
  failed: '#EF5B6B',
  queued: '#00E5CC',
  running: '#3DD68C',
  active: '#3DD68C',
  error: '#EF5B6B',
  complete: '#F0C040',
  paused: '#F0C040',
  connected: '#3DD68C',
  idle: '#F0C040',
}

export const cssVar = (v: string): string => `var(${v})`

export const gv = {
  bg: '#0A0A12',
  glass: 'rgba(16,16,28,.65)',
  gbdr: 'rgba(255,255,255,.06)',
  card: 'rgba(18,18,32,.7)',
  cbdr: 'rgba(255,255,255,.07)',
  tx: '#F0F0FA',
  ts: '#B8B8D0',
  td: '#8080A8',
  ac: '#7B5CFF',
  cc: '#00E5CC',
  pk: '#E84393',
  am: '#F0A030',
  bl: '#4EAAFF',
  gr: '#3DD68C',
  rd: '#EF5B6B',
  yl: '#F0C040',
} as const

export const mn = "'JetBrains Mono',monospace"

export function platformLabel(p: string): string {
  if (p === 'xiaohongshu') return '小红书'
  return p
}
export const sn = "'DM Sans',-apple-system,sans-serif"

export const g = (extra?: CSSProperties): CSSProperties => ({ ...(extra ?? {}) })
