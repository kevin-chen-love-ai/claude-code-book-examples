import React from 'react'

// ─── Terminal color palette ────────────────────────────────────────────────────

export const LC = {
  iteration: '#4EAAFF',  // progress — blue
  done:      '#3DD68C',  // success — green
  error:     '#EF5B6B',  // error — red
  warn:      '#F0C040',  // warning — amber
  timeout:   '#FF8C42',  // timeout — orange
  tool_call: '#00E5CC',  // tool calling — cyan
  tool_res:  '#7B8ECC',  // tool result — blue-gray
  tool_warn: '#FF8C42',  // stuck / limit / denied — orange
  debug:     '#36364F',  // debug noise — very dim
  system:    '#FF8C42',  // SYSTEM: intervention — orange
  obs:       '#6870A8',  // → observation arrow
  result:    '#3DD68C',  // final answer — green
  dim:       '#9898B0',  // default dim gray
  muted:     '#5A5A7A',  // very muted
}

// ─── Agent ID → stable color ──────────────────────────────────────────────────

const AGENT_PALETTE = [
  '#4EAAFF', '#00E5CC', '#B97BFF', '#FF8C42',
  '#F0C040', '#3DD68C', '#EF5B6B', '#7B8ECC',
]

export function agentColor(agentId: string): string {
  let h = 0
  for (let i = 0; i < agentId.length; i++) h = (h * 31 + agentId.charCodeAt(i)) >>> 0
  return AGENT_PALETTE[h % AGENT_PALETTE.length]
}

// ─── Tag badge ─────────────────────────────────────────────────────────────────

export function LogTag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block', flexShrink: 0,
      background: `${color}18`, color, border: `1px solid ${color}35`,
      borderRadius: 4, padding: '0 5px', marginRight: 7,
      fontSize: 9, fontWeight: 800, letterSpacing: '.06em', lineHeight: '17px',
      verticalAlign: 'middle',
    }}>{label}</span>
  )
}

// ─── Tool name extractor ───────────────────────────────────────────────────────

export function extractToolParts(rest: string): { before: string; tool: string; after: string } | null {
  // "Calling TOOLNAME ..."
  let m = rest.match(/^(Calling\s+)(\w+)(.*)$/s)
  if (m) return { before: m[1], tool: m[2], after: m[3] }
  // "TOOLNAME → ..." or "TOOLNAME — ..."
  m = rest.match(/^(\w+)(\s+[→—]\s*)(.*)$/s)
  if (m) return { before: '', tool: m[1], after: m[2] + m[3] }
  return null
}

// ─── Main colorizer ────────────────────────────────────────────────────────────

export function colorizeLog(content: string, type: string): React.ReactNode {
  // Final answer (result type)
  if (type === 'result') {
    return <span style={{ color: LC.result, fontStyle: 'italic' }}>{content}</span>
  }

  // → observation (from stepsToLogs historical view)
  if (content.startsWith('→ ')) {
    return (
      <>
        <span style={{ color: LC.obs, marginRight: 6 }}>→</span>
        <span style={{ color: LC.muted }}>{content.slice(2)}</span>
      </>
    )
  }

  // SYSTEM: stuck-loop intervention
  if (content.startsWith('SYSTEM:')) {
    return (
      <>
        <LogTag label="SYSTEM" color={LC.system} />
        <span style={{ color: `${LC.system}BB` }}>{content.slice(7).trim()}</span>
      </>
    )
  }

  // Extract [TAG] prefix
  const tagMatch = content.match(/^(\[[\w:/ ]+\])\s*([\s\S]*)$/)
  if (!tagMatch) return <span style={{ color: LC.dim }}>{content}</span>

  const fullTag = tagMatch[1]
  const rest = tagMatch[2]

  // [Iteration N/M] or [Iter N]
  if (/^\[Iter(ation)?\s+\d/.test(fullTag)) {
    return (
      <>
        <LogTag label={fullTag.slice(1, -1).toUpperCase()} color={LC.iteration} />
        <span style={{ color: LC.muted }}>{rest}</span>
      </>
    )
  }

  // [Done]
  if (fullTag === '[Done]') {
    return (
      <>
        <LogTag label="DONE" color={LC.done} />
        <span style={{ color: `${LC.done}99` }}>{rest}</span>
      </>
    )
  }

  // [Error]
  if (fullTag === '[Error]') {
    const ci = rest.indexOf(': ')
    return (
      <>
        <LogTag label="ERR" color={LC.error} />
        {ci > -1
          ? <><span style={{ color: `${LC.error}80` }}>{rest.slice(0, ci + 2)}</span><span style={{ color: LC.error }}>{rest.slice(ci + 2)}</span></>
          : <span style={{ color: LC.error }}>{rest}</span>}
      </>
    )
  }

  // [Warn]
  if (fullTag === '[Warn]') {
    return (
      <>
        <LogTag label="WARN" color={LC.warn} />
        <span style={{ color: `${LC.warn}BB` }}>{rest}</span>
      </>
    )
  }

  // [Timeout]
  if (fullTag === '[Timeout]') {
    return (
      <>
        <LogTag label="TIMEOUT" color={LC.timeout} />
        <span style={{ color: `${LC.timeout}99` }}>{rest}</span>
      </>
    )
  }

  // [Tool]
  if (fullTag === '[Tool]') {
    const isWarning = rest.includes('stuck loop') || rest.includes('retry limit') || rest.includes('permission denied') || rest.includes('blocked')
    const isCalling = rest.startsWith('Calling')
    const color = isWarning ? LC.tool_warn : isCalling ? LC.tool_call : LC.tool_res
    const parts = extractToolParts(rest)
    if (parts) {
      const hasArrow = parts.after.startsWith(' → ') || parts.after.startsWith(' — ')
      const arrowRest = hasArrow ? parts.after.slice(3) : parts.after
      const arrowSym = hasArrow ? parts.after.slice(0, 3) : ''
      const preview = arrowRest.length > 140 ? arrowRest.slice(0, 140) + '…' : arrowRest
      return (
        <>
          <LogTag label="TOOL" color={color} />
          {isCalling && <span style={{ color: LC.muted }}>call </span>}
          <span style={{ color, fontWeight: 600 }}>{parts.tool}</span>
          {hasArrow
            ? <><span style={{ color: LC.muted }}>{arrowSym}</span><span style={{ color: LC.muted }}>{preview}</span></>
            : <span style={{ color: `${color}80` }}>{parts.after}</span>}
        </>
      )
    }
    return (
      <>
        <LogTag label="TOOL" color={color} />
        <span style={{ color: `${color}BB` }}>{rest}</span>
      </>
    )
  }

  // [ContentScheduler] — scheduler activity
  if (fullTag === '[ContentScheduler]') {
    const isSuccess = rest.includes('✅') || rest.includes('Published')
    const isError = rest.includes('❌') || rest.includes('Failed') || rest.includes('failed')
    const color = isSuccess ? LC.done : isError ? LC.error : LC.iteration
    return (
      <>
        <LogTag label="SCHED" color={color} />
        <span style={{ color: `${color}CC` }}>{rest}</span>
      </>
    )
  }

  // [DEBUG:*] — nearly invisible, reduce noise
  if (fullTag.startsWith('[DEBUG')) {
    return (
      <>
        <LogTag label="DBG" color={LC.debug} />
        <span style={{ color: LC.debug }}>{rest}</span>
      </>
    )
  }

  // Fallback
  return <span style={{ color: LC.dim }}>{content}</span>
}
