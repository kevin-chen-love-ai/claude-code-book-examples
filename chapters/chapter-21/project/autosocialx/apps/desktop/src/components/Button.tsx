import type { CSSProperties, ReactNode, MouseEventHandler } from 'react'
import { gv, sn } from './tokens'

interface Props {
  children: ReactNode
  primary?: boolean
  sm?: boolean
  onClick?: MouseEventHandler<HTMLButtonElement> | (() => void) | (() => Promise<void>)
  sx?: CSSProperties
  disabled?: boolean
}

export const Button = ({ children, primary, sm, onClick, sx, disabled }: Props) => (
  <button
    onClick={onClick as MouseEventHandler<HTMLButtonElement>}
    disabled={disabled}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: sm ? '5px 10px' : '8px 14px',
      borderRadius: 8,
      border: primary ? 'none' : `1px solid ${gv.gbdr}`,
      background: primary ? gv.ac : 'rgba(255,255,255,.04)',
      color: primary ? '#fff' : gv.ts,
      fontSize: sm ? 11 : 12,
      fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      fontFamily: sn,
      ...sx,
    }}
  >
    {children}
  </button>
)
