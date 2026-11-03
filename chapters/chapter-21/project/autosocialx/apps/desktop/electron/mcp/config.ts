import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { app } from 'electron'

export interface MCPServerConfig {
    command: string
    args: string[]
    env?: Record<string, string>
}

export interface MCPConfiguration {
    mcpServers: Record<string, MCPServerConfig>
}

export class MCPConfigManager {
    private configPath: string

    constructor() {
        // Use Electron userData (cross-platform: ~/Library/AS on macOS, %APPDATA% on Windows)
        // Fall back to ~/.autosocialx for non-Electron environments
        const base = app?.getPath ? app.getPath('userData') : path.join(os.homedir(), '.autosocialx')
        const configDir = path.join(base, 'mcp')
        this.configPath = path.join(configDir, 'mcp_servers.json')

        // Ensure directory exists
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true })
        }
    }

    /**
     * Read the configuration file. Creates it with an empty structure if it doesn't exist.
     */
    readConfig(): MCPConfiguration {
        try {
            if (!fs.existsSync(this.configPath)) {
                this.writeConfig({ mcpServers: {} })
            }
            const data = fs.readFileSync(this.configPath, 'utf8')
            const parsed = JSON.parse(data) as MCPConfiguration
            // Ensure mcpServers exists
            if (!parsed.mcpServers) {
                parsed.mcpServers = {}
            }
            return parsed
        } catch (err) {
            console.error(`[MCPConfig] Error reading config from ${this.configPath}:`, err)
            return { mcpServers: {} }
        }
    }

    /**
     * Write to the configuration file.
     */
    writeConfig(config: MCPConfiguration): void {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8')
        } catch (err) {
            console.error(`[MCPConfig] Error writing config to ${this.configPath}:`, err)
        }
    }

    /**
     * Adds or updates a server definition in the config file.
     */
    setServer(name: string, serverConfig: MCPServerConfig): void {
        const config = this.readConfig()
        config.mcpServers[name] = serverConfig
        this.writeConfig(config)
    }

    /**
     * Removes a server definition from the config file.
     */
    removeServer(name: string): void {
        const config = this.readConfig()
        if (config.mcpServers[name]) {
            delete config.mcpServers[name]
            this.writeConfig(config)
        }
    }
}

export const mcpConfigManager = new MCPConfigManager()
