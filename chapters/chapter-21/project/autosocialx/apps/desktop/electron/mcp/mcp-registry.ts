import { MCPClient } from './mcp-client'
import { mcpConfigManager } from './config'
import type { ToolDefinition, Permission, ToolContext } from '../agent-core/types'
import type { ToolRegistry } from '../agent-core/tool-use/registry'

export interface ServerStatus {
    connected: boolean
    toolCount: number
    error?: string
}

export type RegistryStatus = Record<string, ServerStatus>

export class MCPServerRegistry {
    private clients: Map<string, MCPClient> = new Map()
    private registeredToolNames: Set<string> = new Set()

    /**
     * Reads mcp_servers.json and starts all configured servers.
     */
    async startAll(): Promise<void> {
        const config = mcpConfigManager.readConfig()
        if (!config.mcpServers || Object.keys(config.mcpServers).length === 0) {
            console.log('[MCPServerRegistry] No MCP servers configured.')
            return
        }

        const promises = Object.entries(config.mcpServers).map(async ([name, serverConfig]) => {
            try {
                await this.startServer(name, serverConfig.command, serverConfig.args, serverConfig.env)
            } catch (err) {
                console.error(`[MCPServerRegistry] Failed to start server ${name}:`, err)
            }
        })

        await Promise.allSettled(promises)
    }

    /**
     * Start a single server and store its client.
     */
    async startServer(
        name: string,
        command: string,
        args: string[],
        env?: Record<string, string>
    ): Promise<MCPClient> {
        // Disconnect existing if any
        if (this.clients.has(name)) {
            await this.clients.get(name)?.disconnect()
        }

        const client = new MCPClient(name)
        await client.connect(command, args, env)
        this.clients.set(name, client)
        return client
    }

    /**
     * Stop all connected servers.
     */
    async shutdown(): Promise<void> {
        const promises = Array.from(this.clients.values()).map((client) => client.disconnect())
        await Promise.allSettled(promises)
        this.clients.clear()
        this.registeredToolNames.clear()
    }

    /**
     * For a given tools registry from AgentCore, query all connected MCP servers,
     * discover their tools, and map them to AgentCore ToolDefinitions.
     */
    async discoverAndRegisterTools(toolRegistry: ToolRegistry): Promise<void> {
        for (const [serverName, client] of this.clients.entries()) {
            if (!client.connected) continue

            try {
                const mcpTools = await client.listTools()

                for (const mcpTool of mcpTools) {
                    const toolName = mcpTool.name
                    const globalToolName = `${toolName}` // Use the exact tool name or namespace it.

                    if (this.registeredToolNames.has(globalToolName)) continue

                    // Generate a generic permission string for this MCP tool
                    const permission = `tool:mcp:${serverName}:${toolName}` as Permission

                    const toolDef: ToolDefinition = {
                        name: globalToolName,
                        description: mcpTool.description ?? `MCP Tool from ${serverName}: ${toolName}`,
                        inputSchema: (mcpTool.inputSchema as ToolDefinition['inputSchema']) ?? {
                            type: 'object',
                            properties: {},
                        },
                        requiredPermission: permission,
                        handler: async (args: Record<string, unknown>, _ctx: ToolContext) => {
                            const result = await client.callTool(toolName, args)

                            const textContent = result.content
                                .filter((c) => c.type === 'text')
                                .map((c) => c.text)
                                .join('\n')

                            const imageContent = result.content.find((c) => c.type === 'image')

                            if (result.isError) {
                                throw new Error(`[MCP Tool Error] ${serverName}:${toolName} - ${textContent}`)
                            }

                            return imageContent
                                ? { text: textContent, image: { data: imageContent.data, mimeType: imageContent.mimeType } }
                                : { text: textContent }
                        },
                    }

                    try {
                        toolRegistry.register(toolDef)
                        this.registeredToolNames.add(globalToolName)
                        console.log(`[MCPServerRegistry] Registered tool: ${globalToolName} from ${serverName}`)
                    } catch {
                        // Safe to ignore duplicate registrations
                    }
                }
            } catch (err) {
                console.error(`[MCPServerRegistry] Error discovering tools for ${serverName}:`, err)
            }
        }
    }

    /**
     * Retrieves an instance of an MCPClient by name (e.g., 'browser').
     */
    getClient(name: string): MCPClient | undefined {
        return this.clients.get(name)
    }

    /**
     * Retrieves the combined status of all servers dynamically.
     */
    getStatus(): RegistryStatus {
        const status: RegistryStatus = {}
        for (const [name, client] of this.clients.entries()) {
            // NOTE: We don't have toolCount stored synchronously in the client, but for simplicity
            // and checking connection state, we return the boolean. Let's default toolCount to 0 in status output.
            status[name] = {
                connected: client.connected,
                toolCount: 0,
            }
        }
        return status
    }
}

export const mcpServerRegistry = new MCPServerRegistry()
