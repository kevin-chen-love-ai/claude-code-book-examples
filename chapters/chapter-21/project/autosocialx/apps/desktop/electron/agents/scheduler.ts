import cron, { type ScheduledTask } from 'node-cron'
import type { AutomationRule, CampaignRecord } from '../agent-core/types'
import { messageBus } from '../agent-core/message-bus'
import { executionQueue } from '../agent-core/queue'

export class TaskScheduler {
  // Map of automationRule.id -> ScheduledTask (agent automations)
  private jobs: Map<string, ScheduledTask> = new Map()
  // Map of campaign.id -> ScheduledTask
  private campaignJobs: Map<string, ScheduledTask> = new Map()

  start(rules: AutomationRule[]): void {
    for (const rule of rules) {
      if (rule.status === 'active') {
        this.registerRule(rule)
      }
    }
  }

  registerRule(rule: AutomationRule): void {
    if (!cron.validate(rule.cronExpr)) {
      console.warn(
        `[TaskScheduler] Invalid cron expression for automation ${rule.id}: "${rule.cronExpr}"`,
      )
      return
    }

    // Stop any existing job first
    this.unregisterRule(rule.id)

    const task = cron.schedule(rule.cronExpr, () => {
      // Skip if a run is already active for this agent to prevent concurrent executions
      if (executionQueue.isAgentRunning(rule.agentId)) {
        console.log(`[TaskScheduler] Skipping cron tick — agent ${rule.agentId} already running (rule: ${rule.id})`)
        return
      }
      executionQueue.enqueue({
        agentId: rule.agentId,
        priority: 2,
        triggerSource: `cron:${rule.id}`,
        payload: { trigger: 'cron', ruleId: rule.id },
        retryCount: 0,
        maxRetries: 2,   // cron tasks: retry up to 2 times with backoff
      })
    })

    this.jobs.set(rule.id, task)
  }

  unregisterRule(ruleId: string): void {
    const job = this.jobs.get(ruleId)
    if (job) {
      job.stop()
      this.jobs.delete(ruleId)
    }
  }

  pauseRule(ruleId: string): void {
    this.unregisterRule(ruleId)
  }

  resumeRule(rule: AutomationRule): void {
    if (rule.status === 'active') {
      this.registerRule(rule)
    }
  }

  // ── Campaign scheduling ───────────────────────────────────────────────────

  startCampaigns(campaigns: CampaignRecord[]): void {
    for (const c of campaigns) {
      if (c.cronExpr && c.cronStatus === 'active') {
        this.registerCampaignCron(c.id, c.cronExpr)
      }
    }
  }

  registerCampaignCron(campaignId: string, cronExpr: string): void {
    if (!cron.validate(cronExpr)) {
      console.warn(`[TaskScheduler] Invalid cron for campaign ${campaignId}: "${cronExpr}"`)
      return
    }
    this.unregisterCampaignCron(campaignId)

    const task = cron.schedule(cronExpr, () => {
      console.log(`[TaskScheduler] campaign:triggered — campaignId=${campaignId}`)
      messageBus.emit('campaign:triggered', { campaignId })
    })

    this.campaignJobs.set(campaignId, task)
    console.log(`[TaskScheduler] Campaign cron registered: ${campaignId} @ "${cronExpr}"`)
  }

  unregisterCampaignCron(campaignId: string): void {
    const job = this.campaignJobs.get(campaignId)
    if (job) {
      job.stop()
      this.campaignJobs.delete(campaignId)
    }
  }

  subscribeToEvents(): void {
    messageBus.on('agent:run-complete', ({ agentId, runId, result }) => {
      // Reserved: trigger downstream agents based on run completion
      console.log(
        `[TaskScheduler] agent:run-complete — agentId=${agentId} runId=${runId} success=${result.success}`,
      )
    })
  }

  stop(): void {
    for (const job of this.jobs.values()) { job.stop() }
    this.jobs.clear()
    for (const job of this.campaignJobs.values()) { job.stop() }
    this.campaignJobs.clear()
  }
}

export const taskScheduler = new TaskScheduler()
