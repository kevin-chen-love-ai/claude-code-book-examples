import { gv } from './tokens'

interface Props {
  v: number
  c?: string
  h?: number
}

export const ProgressBar = ({ v, c = gv.cc, h = 4 }: Props) => (
  <div style={{ height: h, borderRadius: h, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
    <div style={{
      height: '100%', borderRadius: h,
      background: `linear-gradient(90deg,${c},${c}aa)`,
      width: `${v}%`,
      transition: 'width .8s',
    }} />
  </div>
)
