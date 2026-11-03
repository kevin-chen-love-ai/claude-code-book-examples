import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Ic } from './Icon'
import { gv, statusColors } from './tokens'

interface BadgeProps {
  children: ReactNode
  c?: string
}

export const Badge = ({ children, c = gv.ac }: BadgeProps) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 3,
    padding: '3px 8px', borderRadius: 12,
    background: `${c}18`,
    fontSize: 10, color: c, fontWeight: 600,
  }}>
    {children}
  </span>
)

interface StatusBadgeProps {
  s: string
}

export const StatusBadge = ({ s }: StatusBadgeProps) => {
  const { t } = useTranslation()
  return (
    <Badge c={statusColors[s] ?? gv.td}>
      {s === 'published' && <Ic.Chk />}
      {t(`status.${s}`, s)}
    </Badge>
  )
}
