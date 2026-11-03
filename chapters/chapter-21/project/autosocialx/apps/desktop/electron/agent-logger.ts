// Agent run logger — writes JSONL to {userData}/logs/agents-YYYY-MM-DD.jsonl
// One JSON object per line; rotates daily; safe to call from main process only.

import { app } from 'electron'
import { appendFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { messageBus } from './agent-core/index'

function logsDir(): string {
    const base = app?.getPath ? app.getPath('userData') : tmpdir()
    return join(base, 'logs')
}

function logFilePath(): string {
    const d = new Date()
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return join(logsDir(), `agents-${ymd}.jsonl`)
}

function writeLine(obj: Record<string, unknown>): void {
    try {
        const dir = logsDir()
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
        appendFileSync(logFilePath(), JSON.stringify(obj) + '\n', { encoding: 'utf-8' })
    } catch {
        // Never let log I/O errors bubble up and crash the app
    }
}

let started = false

export function initAgentLogger(): void {
    if (started) return
    started = true

    messageBus.on('agent:run-started', ({ agentId, runId }) => {
        writeLine({ ts: new Date().toISOString(), event: 'run-started', agentId, runId })
    })

    messageBus.on('agent:log', ({ agentId, runId, message }) => {
        writeLine({ ts: new Date().toISOString(), event: 'log', agentId, runId, message })
    })

    messageBus.on('agent:run-complete', ({ agentId, runId, result }) => {
        const r = result as { tokensUsed?: number; durationMs?: number; success?: boolean }
        writeLine({
            ts: new Date().toISOString(),
            event: 'run-complete',
            agentId,
            runId,
            success: r?.success,
            tokens: r?.tokensUsed,
            durationMs: r?.durationMs,
        })
    })

    messageBus.on('agent:run-failed', ({ agentId, runId, error }) => {
        writeLine({ ts: new Date().toISOString(), event: 'run-failed', agentId, runId, error })
    })
}

export function getLogsDir(): string {
    return logsDir()
}

export function getCurrentLogFile(): string {
    return logFilePath()
}
