import type { SecurityProfile } from './types'

// ─── Default security profile (all capabilities disabled) ────────────────────

export const DEFAULT_SECURITY_PROFILE: SecurityProfile = {
  agentId: '',
  allowedPlatforms: [],
  allowedTools: [],
  maxTokensPerRun: 0,
  maxRunsPerHour: 0,
  canAccessInternet: false,
  canReadFiles: false,
  credentialScope: [],
}

// ─── SecurityPolicy ───────────────────────────────────────────────────────────

export class SecurityPolicy {
  private readonly profile: SecurityProfile

  constructor(profile: SecurityProfile) {
    this.profile = profile
  }

  /**
   * Returns true when the given tool name (as a Permission string) is
   * explicitly listed in the agent's allowedTools set.
   */
  checkPermission(toolName: string): boolean {
    return (this.profile.allowedTools as string[]).includes(toolName)
  }

  /**
   * Returns true when the given platform is listed in allowedPlatforms.
   */
  checkPlatform(platform: string): boolean {
    return (this.profile.allowedPlatforms as string[]).includes(platform)
  }

  /**
   * Returns true when the cumulative token spend for this run has not yet
   * reached the per-run limit defined in the security profile.
   */
  checkTokenBudget(tokensUsed: number): boolean {
    return tokensUsed < this.profile.maxTokensPerRun
  }

  /**
   * Returns true when the agent has not exceeded its hourly execution quota.
   */
  enforceRateLimit(runCount: number): boolean {
    return runCount < this.profile.maxRunsPerHour
  }

  /**
   * Returns the first credential ID whose suffix matches the given platform
   * name (convention: `cred_<platform>_<account>` or `cred_<platform>`).
   * Returns null when no matching credential exists in the scope.
   */
  getCredentialId(platform: string): string | null {
    const match = this.profile.credentialScope.find((cid) =>
      cid.startsWith(`cred_${platform}`),
    )
    return match ?? null
  }

  /**
   * Factory — constructs a SecurityPolicy from an agent ID and its stored
   * SecurityProfile.  The agentId on the profile is overridden with the
   * supplied value so callers don't need to keep them in sync.
   */
  static fromAgent(agentId: string, profile: SecurityProfile): SecurityPolicy {
    return new SecurityPolicy({ ...profile, agentId })
  }
}
