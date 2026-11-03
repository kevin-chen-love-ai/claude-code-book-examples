import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'

export interface MCPToolResult {
    content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>
    isError?: boolean
}

export class MCPClient {
    private client: Client
    private transport: StdioClientTransport | null = null
    public connected = false

    constructor(private readonly name: string) {
        this.client = new Client({ name: `autosocialx-${name}`, version: '1.0.0' })
    }

    /**
     * Connect to an MCP server by spawning it as a stdio subprocess.
     * @param command  The executable to spawn (e.g. 'npx')
     * @param args     Arguments passed to the command
     * @param env      Optional extra env vars for the subprocess
     */
    async connect(command: string, args: string[], env?: Record<string, string>): Promise<void> {
        this.transport = new StdioClientTransport({
            command,
            args,
            env: { ...process.env, ...env } as Record<string, string>,
        })

        await this.client.connect(this.transport)
        this.connected = true
        console.log(`[MCPClient:${this.name}] Connected`)
    }

    /** List all tools exposed by this MCP server */
    async listTools(): Promise<Tool[]> {
        if (!this.connected) return []
        const response = await this.client.listTools()
        return response.tools
    }

    /** Call a tool by name with given arguments */
    async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
        if (!this.connected) {
            throw new Error(`[MCPClient:${this.name}] Not connected`)
        }
        const result = await this.client.callTool({ name, arguments: args })
        return result as MCPToolResult
    }

    async disconnect(): Promise<void> {
        if (this.transport) {
            await this.client.close()
            this.connected = false
            console.log(`[MCPClient:${this.name}] Disconnected`)
        }
    }
}
