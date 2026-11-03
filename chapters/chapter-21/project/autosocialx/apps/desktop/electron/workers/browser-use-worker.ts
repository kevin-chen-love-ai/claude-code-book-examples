import { spawn, type ChildProcess } from 'child_process'
import { join } from 'path'
import { existsSync } from 'fs'
import { app } from 'electron'

interface BrowserUseRequest {
  id: number
  task: string
  maxSteps?: number
  apiKey?: string
  baseUrl?: string
  model?: string
}

interface BrowserUseResponse {
  id: number | null
  success: boolean
  result: string
  urls: string[]
  steps: number
  error: string | null
  ready?: boolean
}

interface PendingRequest {
  resolve: (v: BrowserUseResponse) => void
  reject: (e: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class BrowserUseWorker {
  private proc: ChildProcess | null = null
  private pending: Map<number, PendingRequest> = new Map()
  private idCounter = 1
  private ready = false
  private buffer = ''

  /** Resolve path to browser_use_worker.py — works in dev and packaged app */
  private get workerPath(): string {
    if (app?.isPackaged) {
      return join(process.resourcesPath, 'workers', 'browser_use_worker.py')
    }
    return join(__dirname, '..', '..', '..', 'python', 'browser_use_worker.py')
  }

  start(): void {
    if (this.proc) return

    try {
      // Prefer localized .venv python over global python3 to avoid dependency conflicts
      let pythonPath = 'python3'
      if (!app?.isPackaged) {
        const basePath = app?.getAppPath ? app.getAppPath() : join(__dirname, '..', '..')
        const pythonBasePath = join(basePath, '..', 'python')
        const venvBin = process.platform === 'win32'
          ? join(pythonBasePath, '.venv', 'Scripts', 'python.exe')
          : join(pythonBasePath, '.venv', 'bin', 'python')
        if (existsSync(venvBin)) pythonPath = venvBin
      }

      this.proc = spawn(pythonPath, [this.workerPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } catch (err) {
      console.warn('[BrowserUseWorker] Failed to spawn python process:', err)
      return
    }

    this.proc.stdout?.setEncoding('utf8')
    this.proc.stdout?.on('data', (chunk: string) => {
      this.buffer += chunk
      const lines = this.buffer.split('\n')
      this.buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        this.handleLine(line)
      }
    })

    this.proc.stderr?.on('data', (data: Buffer | string) => {
      console.warn('[BrowserUseWorker] stderr:', data.toString())
    })

    this.proc.on('exit', (code) => {
      this.ready = false
      this.proc = null
      console.warn(`[BrowserUseWorker] process exited with code ${code}`)
      for (const { reject, timer } of this.pending.values()) {
        clearTimeout(timer)
        reject(new Error('browser_use_worker process exited unexpectedly'))
      }
      this.pending.clear()
    })

    this.proc.on('error', (err) => {
      console.warn('[BrowserUseWorker] process error:', err)
    })
  }

  stop(): void {
    this.proc?.kill('SIGTERM')
    this.proc = null
    this.ready = false
  }

  isAvailable(): boolean {
    return this.ready && this.proc !== null
  }

  async call(params: Omit<BrowserUseRequest, 'id'>): Promise<BrowserUseResponse> {
    if (!this.proc || !this.ready) {
      return {
        id: null,
        success: false,
        result: '',
        urls: [],
        steps: 0,
        error:
          'browser-use worker not available. ' +
          'Ensure Python 3.11+ is installed and run: ' +
          'pip install browser-use langchain-openai && playwright install chromium',
      }
    }

    const id = this.idCounter++
    const request: BrowserUseRequest = { id, ...params }

    return new Promise<BrowserUseResponse>((resolve, reject) => {
      // 150-second outer timeout (browser-use itself has 120s default)
      const timer = setTimeout(() => {
        this.pending.delete(id)
        resolve({
          id,
          success: false,
          result: '',
          urls: [],
          steps: 0,
          error: 'browser_do timed out after 150 seconds',
        })
      }, 150_000)

      this.pending.set(id, { resolve, reject, timer })
      this.proc!.stdin!.write(JSON.stringify(request) + '\n')
    })
  }

  private handleLine(line: string): void {
    let msg: BrowserUseResponse
    try {
      msg = JSON.parse(line) as BrowserUseResponse
    } catch {
      console.warn('[BrowserUseWorker] Unparseable line:', line)
      return
    }

    // Ready signal from worker
    if (msg.ready) {
      this.ready = true
      console.log('[BrowserUseWorker] Python worker ready, pid:', (msg as unknown as { pid: number }).pid)
      return
    }

    const id = msg.id
    if (id === null || id === undefined) return

    const pending = this.pending.get(id)
    if (!pending) return

    clearTimeout(pending.timer)
    this.pending.delete(id)
    pending.resolve(msg)
  }
}

export const browserUseWorker = new BrowserUseWorker()
