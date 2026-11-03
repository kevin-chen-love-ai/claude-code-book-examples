/**
 * Lightweight per-run campaign context store.
 * Allows triggerDirect() to associate a campaignId with a virtual agentId
 * so that the schedule_post tool can tag content records correctly.
 */
const campaignIds = new Map<string, string>() // agentId -> campaignId

export function setCampaignId(agentId: string, campaignId: string): void {
  campaignIds.set(agentId, campaignId)
}

export function getCampaignId(agentId: string): string | null {
  return campaignIds.get(agentId) ?? null
}

export function clearCampaignId(agentId: string): void {
  campaignIds.delete(agentId)
}
