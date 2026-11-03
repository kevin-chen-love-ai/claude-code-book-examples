import type {
  AgentDefinition,
  AgentStatus,
  SecurityProfile,
  PlatformId,
} from '../agent-core/types'
import type Database from 'better-sqlite3'

export class AgentRegistry {
  constructor(private db: Database.Database) { }

  create(
    params: Omit<AgentDefinition, 'id' | 'createdAt' | 'updatedAt'>,
  ): AgentDefinition {
    const id = crypto.randomUUID()
    const now = new Date()
    const nowUnix = Math.floor(now.getTime() / 1000)

    const stmt = this.db.prepare(`
      INSERT INTO agents
        (id, name, platform, persona_id, channel_id, provider, model, custom_instructions, skill_ids, status, security_profile, created_at, updated_at)
      VALUES
        (@id, @name, @platform, @personaId, @channelId, @provider, @model, @customInstructions, @skillIds, @status, @securityProfile, @createdAt, @updatedAt)
    `)

    stmt.run({
      id,
      name: params.name,
      platform: params.platform,
      personaId: params.personaId ?? null,
      channelId: params.channelId ?? null,
      provider: params.provider,
      model: params.model,
      customInstructions: params.customInstructions,
      skillIds: JSON.stringify(params.skillIds),
      status: params.status,
      securityProfile: JSON.stringify(params.securityProfile),
      createdAt: nowUnix,
      updatedAt: nowUnix,
    })

    return {
      id,
      name: params.name,
      platform: params.platform,
      personaId: params.personaId ?? null,
      channelId: params.channelId ?? null,
      provider: params.provider,
      model: params.model,
      customInstructions: params.customInstructions,
      skillIds: params.skillIds,
      status: params.status,
      securityProfile: params.securityProfile,
      createdAt: now,
      updatedAt: now,
    }
  }

  getById(id: string): AgentDefinition | null {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE id = ?')
    const row = stmt.get(id)
    if (!row) return null
    return this.rowToAgent(row as Record<string, unknown>)
  }

  list(): AgentDefinition[] {
    const stmt = this.db.prepare('SELECT * FROM agents ORDER BY created_at DESC')
    const rows = stmt.all() as Record<string, unknown>[]
    return rows.map((row) => this.rowToAgent(row))
  }

  listActive(): AgentDefinition[] {
    const stmt = this.db.prepare(
      "SELECT * FROM agents WHERE status NOT IN ('paused', 'error') ORDER BY created_at DESC",
    )
    const rows = stmt.all() as Record<string, unknown>[]
    return rows.map((row) => this.rowToAgent(row))
  }

  update(
    id: string,
    patch: Partial<
      Pick<
        AgentDefinition,
        | 'name'
        | 'platform'
        | 'personaId'
        | 'channelId'
        | 'provider'
        | 'model'
        | 'customInstructions'
        | 'skillIds'
        | 'status'
        | 'securityProfile'
      >
    >,
  ): AgentDefinition | null {
    const existing = this.getById(id)
    if (!existing) return null

    const updatedAt = Math.floor(Date.now() / 1000)

    const merged = {
      name: patch.name ?? existing.name,
      platform: patch.platform ?? existing.platform,
      personaId: patch.personaId !== undefined ? patch.personaId : existing.personaId,
      channelId: patch.channelId !== undefined ? patch.channelId : existing.channelId,
      provider: patch.provider ?? existing.provider,
      model: patch.model ?? existing.model,
      customInstructions: patch.customInstructions !== undefined ? patch.customInstructions : existing.customInstructions,
      skillIds: patch.skillIds ?? existing.skillIds,
      status: patch.status ?? existing.status,
      securityProfile: patch.securityProfile ?? existing.securityProfile,
    }

    const stmt = this.db.prepare(`
      UPDATE agents
      SET name = @name,
          platform = @platform,
          persona_id = @personaId,
          channel_id = @channelId,
          provider = @provider,
          model = @model,
          custom_instructions = @customInstructions,
          skill_ids = @skillIds,
          status = @status,
          security_profile = @securityProfile,
          updated_at = @updatedAt
      WHERE id = @id
    `)

    stmt.run({
      id,
      name: merged.name,
      platform: merged.platform,
      personaId: merged.personaId ?? null,
      channelId: merged.channelId ?? null,
      provider: merged.provider,
      model: merged.model,
      customInstructions: merged.customInstructions,
      skillIds: JSON.stringify(merged.skillIds),
      status: merged.status,
      securityProfile: JSON.stringify(merged.securityProfile),
      updatedAt,
    })

    return this.getById(id)
  }

  updateStatus(id: string, status: AgentStatus): void {
    const updatedAt = Math.floor(Date.now() / 1000)
    const stmt = this.db.prepare(
      'UPDATE agents SET status = @status, updated_at = @updatedAt WHERE id = @id',
    )
    stmt.run({ id, status, updatedAt })
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM agents WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  private rowToAgent(row: Record<string, unknown>): AgentDefinition {
    const id = typeof row['id'] === 'string' ? row['id'] : ''
    const name = typeof row['name'] === 'string' ? row['name'] : ''
    const platform = (
      typeof row['platform'] === 'string' ? row['platform'] : 'x'
    ) as PlatformId
    const personaId =
      typeof row['persona_id'] === 'string' ? row['persona_id'] : null
    const channelId =
      typeof row['channel_id'] === 'string' ? row['channel_id'] : null
    const provider =
      typeof row['provider'] === 'string' ? row['provider'] : 'claude'
    const model =
      typeof row['model'] === 'string' ? row['model'] : 'claude-3-5-sonnet-latest'
    const customInstructions =
      typeof row['custom_instructions'] === 'string' ? row['custom_instructions'] : ''
    const status = (
      typeof row['status'] === 'string' ? row['status'] : 'idle'
    ) as AgentStatus

    const skillIdsRaw =
      typeof row['skill_ids'] === 'string' ? row['skill_ids'] : '[]'
    const skillIds = JSON.parse(skillIdsRaw) as string[]

    const securityProfileRaw =
      typeof row['security_profile'] === 'string' ? row['security_profile'] : '{}'
    const rawProfile = JSON.parse(securityProfileRaw) as Record<string, unknown>

    // Normalize: old seeded rows may be missing fields — apply safe defaults
    const DEFAULT_ALLOWED_TOOLS = [
      'tool:web_search', 'tool:rss_reader', 'tool:memory_recall',
      'tool:schedule_post', 'tool:hashtag_analyze', 'tool:translate',
      'tool:sentiment_scan',
      'tool:read_url', 'tool:read_skill', 'tool:run_code',
      'tool:x_publish', 'tool:linkedin_post', 'tool:xhs_publish',
    ]
    const securityProfile: SecurityProfile = {
      agentId: id,
      allowedPlatforms: Array.isArray(rawProfile['allowedPlatforms'])
        ? (rawProfile['allowedPlatforms'] as PlatformId[]) : [],
      allowedTools: (Array.isArray(rawProfile['allowedTools'])
        ? rawProfile['allowedTools'] : DEFAULT_ALLOWED_TOOLS) as SecurityProfile['allowedTools'],
      maxTokensPerRun: typeof rawProfile['maxTokensPerRun'] === 'number'
        ? rawProfile['maxTokensPerRun'] : 4096,
      maxRunsPerHour: typeof rawProfile['maxRunsPerHour'] === 'number'
        ? rawProfile['maxRunsPerHour']
        : typeof rawProfile['rateLimitPerHour'] === 'number'
          ? rawProfile['rateLimitPerHour'] : 10,
      canAccessInternet: typeof rawProfile['canAccessInternet'] === 'boolean'
        ? rawProfile['canAccessInternet'] : true,
      canReadFiles: typeof rawProfile['canReadFiles'] === 'boolean'
        ? rawProfile['canReadFiles'] : false,
      credentialScope: (Array.isArray(rawProfile['credentialScope'])
        ? rawProfile['credentialScope'] : []) as SecurityProfile['credentialScope'],
    }

    const createdAtRaw =
      typeof row['created_at'] === 'number' ? row['created_at'] : 0
    const updatedAtRaw =
      typeof row['updated_at'] === 'number' ? row['updated_at'] : 0

    return {
      id,
      name,
      platform,
      personaId,
      channelId,
      provider,
      model,
      customInstructions,
      skillIds,
      status,
      securityProfile,
      createdAt: new Date(createdAtRaw * 1000),
      updatedAt: new Date(updatedAtRaw * 1000),
    }
  }
}
