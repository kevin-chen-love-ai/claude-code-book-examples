import type { CSSProperties } from 'react'
import type { PlatformId } from '../types'
import { Ic } from './Icon'

interface Props {
  p: PlatformId | string
  s?: number
}

interface PlatformConfig {
  bg: string
  ch: React.ReactNode
  bdr?: boolean
}

const configs: Record<string, PlatformConfig> = {
  x:           { bg: '#000',                                                ch: <Ic.Xp />,                                                         bdr: true },
  linkedin:    { bg: '#0A66C2',                                             ch: <span style={{ fontSize: 12, fontWeight: 800 }}>in</span>                    },
  instagram:   { bg: 'linear-gradient(135deg,#833AB4,#E1306C,#F77737)',    ch: <span style={{ fontSize: 13 }}>◎</span>                                        },
  xiaohongshu: { bg: '#FF2442',                                             ch: <span style={{ fontSize: 11, fontWeight: 800 }}>书</span>                    },
  tiktok:      { bg: '#010101',                                             ch: <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: -1 }}>TT</span>  },
  youtube:     { bg: '#FF0000',                                             ch: <span style={{ fontSize: 12, fontWeight: 900 }}>▶</span>                      },
  facebook:    { bg: '#1877F2',                                             ch: <span style={{ fontSize: 14, fontWeight: 900 }}>f</span>                      },
  threads:     { bg: '#101010',                                             ch: <span style={{ fontSize: 13, fontWeight: 800 }}>@</span>                      },
  pinterest:   { bg: '#E60023',                                             ch: <span style={{ fontSize: 14, fontWeight: 900 }}>P</span>                      },
  bluesky:     { bg: '#0085FF',                                             ch: <span style={{ fontSize: 12, fontWeight: 800 }}>☁</span>                      },
  weibo:       { bg: '#E6162D',                                             ch: <span style={{ fontSize: 11, fontWeight: 800 }}>微</span>                     },
  bilibili:    { bg: '#00A1D6',                                             ch: <span style={{ fontSize: 11, fontWeight: 800 }}>哔</span>                     },
  douyin:      { bg: '#161823',                                             ch: <span style={{ fontSize: 13, fontWeight: 900 }}>♪</span>                      },
  discord:     { bg: '#5865F2',                                             ch: <span style={{ fontSize: 13, fontWeight: 800 }}>D</span>                      },
  slack:       { bg: '#4A154B',                                             ch: <span style={{ fontSize: 12, fontWeight: 800 }}>#</span>                      },
}

export const PlatformIcon = ({ p, s = 24 }: Props) => {
  const fallback: PlatformConfig = { bg: '#444', ch: <span style={{ fontSize: 11, fontWeight: 700 }}>{String(p).slice(0, 2).toUpperCase()}</span> }
  const cfg = configs[p] ?? fallback
  const style: CSSProperties = {
    width: s, height: s, borderRadius: s / 2,
    background: cfg.bg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff',
    border: cfg.bdr ? '1px solid rgba(255,255,255,.12)' : 'none',
    flexShrink: 0,
  }
  return <div style={style}>{cfg.ch}</div>
}
