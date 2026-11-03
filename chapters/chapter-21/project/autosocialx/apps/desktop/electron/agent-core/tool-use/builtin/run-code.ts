import type { ToolDefinition } from '../../types.js'
import { workerBridge } from '../../../workers/worker-bridge.js'

interface CodeResult {
  stdout: string
  stderr: string
  exitCode: number
  timedOut: boolean
}

export const runCodeTool: ToolDefinition = {
  name: 'run_code',
  description:
    'Execute a shell command or Python script and return the output. ' +
    'Use for data processing, calculations, file operations, or system tasks. ' +
    'Shell commands must be passed as an array (e.g. ["ls", "-la"]). ' +
    'Python code is written to a temp file and executed with python3 in isolated mode. ' +
    'Output is limited to 8KB per stream. Timeouts: shell 30s, python 60s.',
  inputSchema: {
    type: 'object',
    properties: {
      language: {
        type: 'string',
        description: 'Execution language: "shell" or "python"',
        enum: ['shell', 'python'],
      },
      code: {
        type: 'string',
        description:
          'For python: the Python source code to execute. ' +
          'For shell: a JSON array string of command + args, e.g. ["ls", "-la", "/tmp"]',
      },
    },
    required: ['language', 'code'],
  },
  requiredPermission: 'tool:run_code',
  handler: async (args, _ctx) => {
    const language = typeof args['language'] === 'string' ? args['language'] : ''
    const code     = typeof args['code']     === 'string' ? args['code']     : ''

    if (language === 'shell') {
      let command: string[]
      try {
        const parsed = JSON.parse(code) as unknown
        if (!Array.isArray(parsed) || parsed.some(x => typeof x !== 'string')) {
          return { error: 'shell code must be a JSON array of strings, e.g. ["ls", "-la"]' }
        }
        command = parsed as string[]
      } catch {
        return { error: 'shell code must be valid JSON array, e.g. ["ls", "-la"]' }
      }

      const result = await workerBridge.call<CodeResult>('code.shell', { command })
      return {
        stdout:   result.stdout,
        stderr:   result.stderr,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        ...(result.timedOut ? { note: 'Command timed out after 30 seconds' } : {}),
      }
    }

    if (language === 'python') {
      const result = await workerBridge.call<CodeResult>('code.python', { code })
      return {
        stdout:   result.stdout,
        stderr:   result.stderr,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        ...(result.timedOut ? { note: 'Script timed out after 60 seconds' } : {}),
      }
    }

    return { error: `Unsupported language: "${language}". Use "shell" or "python".` }
  },
}
