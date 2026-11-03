import { gv, mn } from './tokens'

interface Payload {
  name: string
  value: number | string
  color: string
}

interface Props {
  active?: boolean
  payload?: Payload[]
  label?: string
}

export const ChartTooltip = ({ active, payload, label }: Props) => {
  if (!active || !payload) return null
  return (
    <div style={{
      background: 'rgba(18,18,32,.95)',
      border: `1px solid ${gv.gbdr}`,
      borderRadius: 8, padding: '8px 12px', fontSize: 11,
    }}>
      <div style={{ color: gv.td, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 600, fontFamily: mn }}>
            {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}
