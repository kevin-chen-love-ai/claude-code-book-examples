import type { CSSProperties, ReactNode } from 'react'
import { gv } from './tokens'

export interface CardProps {
  children: ReactNode
  sx?: CSSProperties
  onClick?: () => void
}

export const Card = ({ children, sx, onClick }: CardProps) => (
  <div onClick={onClick} style={{
    background: gv.card,
    border: `1px solid ${gv.cbdr}`,
    borderRadius: 16,
    backdropFilter: 'blur(12px)',
    overflow: 'hidden',
    ...sx,
  }}>
    {children}
  </div>
)

interface CardHeaderProps {
  t: string
  r?: ReactNode
}

export const CardHeader = ({ t, r }: CardHeaderProps) => (
  <div style={{
    display: 'flex', alignItems: 'center',
    padding: '12px 16px',
    borderBottom: `1px solid ${gv.gbdr}`,
  }}>
    <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{t}</span>
    {r}
  </div>
)
