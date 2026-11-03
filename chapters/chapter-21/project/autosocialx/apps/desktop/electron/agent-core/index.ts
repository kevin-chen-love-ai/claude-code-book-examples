import type { AgentRunResult, ToolDefinition, SecurityProfile, AgentStatus } from './types'
import type { QueuedTask } from './types'
import type Database from 'better-sqlite3'
import { reactEngine, type ReactEngineConfig } from './react-engine'
import { executionQueue } from './queue'
import { messageBus } from './message-bus'
import { workingMemory } from './memory/working-memory'
import { EpisodicMemoryStore } from './memory/episodic-memory'
import { toolRegistry } from './tool-use/registry'
import { llmGateway } from './llm-gateway'
import { knowledgeStore } from './memory/knowledge-store'
import { rssVectorStore } from './memory/rss-vector-store'
import { embeddingService } from './memory/embedding-service'
import { webSearchTool } from './tool-use/builtin/web-search'
import { rssReaderTool } from './tool-use/builtin/rss-reader'
import { memoryRecallTool } from './tool-use/builtin/memory-recall'
import { schedulePostTool } from './tool-use/builtin/schedule-post'
import { readUrlTool } from './tool-use/builtin/read-url'
import { runCodeTool } from './tool-use/builtin/run-code'
import { browserDoTool } from './tool-use/builtin/browser-do'
import { loadSkillTool } from './tool-use/builtin/load-skill'
import { imageGenTool } from './tool-use/builtin/image-gen'
import { getToolKey } from './tool-use/tool-keys'
import { setCampaignId, clearCampaignId } from './tool-use/campaign-context'
import { skillRegistry } from './skill-use/registry'
import { personaHub } from '../agents/persona'
import { contentStore } from '../db/content-store'
import { workerBridge } from '../workers/worker-bridge'
import { browserUseWorker } from '../workers/browser-use-worker'
import type { AgentRegistry } from '../agents/registry'
import { mcpServerRegistry, type RegistryStatus } from '../mcp/mcp-registry'

export class AgentCore {
  private initialized = false
  private episodicMemory: EpisodicMemoryStore | null = null
  private registry: AgentRegistry | null = null

  init(db: Database.Database): void {
    if (this.initialized) return

    this.episodicMemory = new EpisodicMemoryStore(db)

    // Init content store (used by schedule_post tool)
    contentStore.init(db)

    // (Obsolete lightweight generate wrapper removed)

    // Register built-in tools + skill plugins (ignore duplicate-registration errors on re-init)
    const coreTools: ToolDefinition[] = [
      webSearchTool,
      rssReaderTool,
      memoryRecallTool,
      schedulePostTool,
      readUrlTool,
      runCodeTool,
      browserDoTool,
      loadSkillTool,
      imageGenTool,
    ]
    for (const tool of coreTools) {
      try { toolRegistry.register(tool) } catch { /* already registered */ }
    }

    // Initialize the SkillRegistry (Progressive Disclosure)
    skillRegistry.init().catch(err => console.error('[AgentCore] Failed to init SkillRegistry', err))

    // Start browser-use Python worker (non-blocking — gracefully skips if Python unavailable)
    try {
      browserUseWorker.start()
    } catch (err) {
      console.warn('[AgentCore] BrowserUseWorker start failed:', err)
    }

    // Start Playwright Worker and register platform publish tools.
    // Pass publishViaBrowser so agents route through the user's Chrome session
    // (MCP Puppeteer) when it's connected — no child-process stub involved.
    try {
      workerBridge.start()
      for (const tool of workerBridge.createPlatformTools(this.publishViaBrowser.bind(this))) {
        try { toolRegistry.register(tool) } catch { /* already registered */ }
      }
    } catch (err) {
      console.warn('[AgentCore] WorkerBridge start failed:', err)
    }

    executionQueue.setRunner(this.runAgent.bind(this))

    this.initialized = true

    // Async: attempt to connect browser tools via MCP
    // Non-blocking — if Chrome is not running, gracefully skips
    this.initBrowser().catch((err) =>
      console.warn('[AgentCore] Browser init skipped:', err)
    )
  }

  async initBrowser(_debugPort?: number): Promise<RegistryStatus> {
    await mcpServerRegistry.startAll()
    await mcpServerRegistry.discoverAndRegisterTools(toolRegistry)
    return mcpServerRegistry.getStatus()
  }

  /** Directly publish content to a platform via MCP browser tools */
  async publishViaBrowser(platform: string, text: string): Promise<{ success: boolean; postId?: string; error?: string }> {
    const client = mcpServerRegistry.getClient('browser')
    if (!client?.connected) {
      return { success: false, error: 'Browser not connected' }
    }

    try {
      const recipes: Record<string, Array<{ tool: string; args: Record<string, unknown> }>> = {
        x: [
          { tool: 'puppeteer_navigate', args: { url: 'https://x.com/compose/tweet' } },
          { tool: 'puppeteer_wait_for_selector', args: { selector: '[data-testid="tweetTextarea_0"]', timeout: 10000 } },
          { tool: 'puppeteer_type', args: { selector: '[data-testid="tweetTextarea_0"]', text } },
          { tool: 'puppeteer_click', args: { selector: '[data-testid="tweetButton"]' } },
        ],
        linkedin: [
          { tool: 'puppeteer_navigate', args: { url: 'https://www.linkedin.com/feed/' } },
          { tool: 'puppeteer_click', args: { selector: 'button.share-box-feed-entry__trigger' } },
          { tool: 'puppeteer_wait_for_selector', args: { selector: '.ql-editor[data-placeholder]', timeout: 10000 } },
          { tool: 'puppeteer_type', args: { selector: '.ql-editor[data-placeholder]', text } },
          { tool: 'puppeteer_click', args: { selector: 'button.share-actions__primary-action' } },
        ],
        xiaohongshu: [
          { tool: 'puppeteer_navigate', args: { url: 'https://creator.xiaohongshu.com/publish/publish' } },
          { tool: 'puppeteer_wait_for_selector', args: { selector: '[data-type="text"]', timeout: 10000 } },
          { tool: 'puppeteer_click', args: { selector: '[data-type="text"]' } },
          { tool: 'puppeteer_wait_for_selector', args: { selector: '.content-editor', timeout: 8000 } },
          { tool: 'puppeteer_type', args: { selector: '.content-editor', text } },
          { tool: 'puppeteer_click', args: { selector: '.publishBtn' } },
        ],
        instagram: [
          { tool: 'puppeteer_navigate', args: { url: 'https://www.instagram.com/' } },
          { tool: 'puppeteer_wait_for_selector', args: { selector: '[aria-label="New post"]', timeout: 10000 } },
          { tool: 'puppeteer_click', args: { selector: '[aria-label="New post"]' } },
          { tool: 'puppeteer_wait_for_selector', args: { selector: 'textarea[aria-label="Write a caption..."]', timeout: 12000 } },
          { tool: 'puppeteer_type', args: { selector: 'textarea[aria-label="Write a caption..."]', text } },
          { tool: 'puppeteer_click', args: { selector: '[aria-label="Share"]' } },
        ],
        tiktok: [
          { tool: 'puppeteer_navigate', args: { url: 'https://www.tiktok.com/creator-center/upload/text' } },
          { tool: 'puppeteer_wait_for_selector', args: { selector: 'div[contenteditable="true"]', timeout: 12000 } },
          { tool: 'puppeteer_type', args: { selector: 'div[contenteditable="true"]', text } },
          { tool: 'puppeteer_click', args: { selector: 'button[data-testid="btn_post"]' } },
        ],
        youtube: [
          { tool: 'puppeteer_navigate', args: { url: 'https://studio.youtube.com/' } },
          { tool: 'puppeteer_wait_for_selector', args: { selector: '#create-icon', timeout: 10000 } },
          { tool: 'puppeteer_click', args: { selector: '#create-icon' } },
          { tool: 'puppeteer_wait_for_selector', args: { selector: '[test-id="create-post-button"]', timeout: 8000 } },
          { tool: 'puppeteer_click', args: { selector: '[test-id="create-post-button"]' } },
          { tool: 'puppeteer_wait_for_selector', args: { selector: '#text-input', timeout: 8000 } },
          { tool: 'puppeteer_type', args: { selector: '#text-input', text } },
          { tool: 'puppeteer_click', args: { selector: '[test-id="post-button"]' } },
        ],
        facebook: [
          { tool: 'puppeteer_navigate', args: { url: 'https://www.facebook.com/' } },
          { tool: 'puppeteer_wait_for_selector', args: { selector: '[aria-label="What\'s on your mind?"]', timeout: 10000 } },
          { tool: 'puppeteer_click', args: { selector: '[aria-label="What\'s on your mind?"]' } },
          { tool: 'puppeteer_wait_for_selector', args: { selector: 'div[role="textbox"][contenteditable="true"]', timeout: 8000 } },
          { tool: 'puppeteer_type', args: { selector: 'div[role="textbox"][contenteditable="true"]', text } },
          { tool: 'puppeteer_click', args: { selector: '[aria-label="Post"]' } },
        ],
        threads: [
          { tool: 'puppeteer_navigate', args: { url: 'https://www.threads.net/' } },
          { tool: 'puppeteer_wait_for_selector', args: { selector: '[aria-label="New thread"]', timeout: 10000 } },
          { tool: 'puppeteer_click', args: { selector: '[aria-label="New thread"]' } },
          { tool: 'puppeteer_wait_for_selector', args: { selector: 'div[contenteditable="true"][role="textbox"]', timeout: 8000 } },
          { tool: 'puppeteer_type', args: { selector: 'div[contenteditable="true"][role="textbox"]', text } },
          { tool: 'puppeteer_click', args: { selector: 'div[role="button"]:has-text("Post")' } },
        ],
        bluesky: [
          { tool: 'puppeteer_navigate', args: { url: 'https://bsky.app/' } },
          { tool: 'puppeteer_wait_for_selector', args: { selector: '[aria-label="New post"]', timeout: 10000 } },
          { tool: 'puppeteer_click', args: { selector: '[aria-label="New post"]' } },
          { tool: 'puppeteer_wait_for_selector', args: { selector: 'div[data-testid="composerTextInput"]', timeout: 8000 } },
          { tool: 'puppeteer_type', args: { selector: 'div[data-testid="composerTextInput"]', text } },
          { tool: 'puppeteer_click', args: { selector: 'button[data-testid="composerPublishBtn"]' } },
        ],
        weibo: [
          { tool: 'puppeteer_navigate', args: { url: 'https://weibo.com/' } },
          { tool: 'puppeteer_wait_for_selector', args: { selector: '.weibo-textarea', timeout: 10000 } },
          { tool: 'puppeteer_click', args: { selector: '.weibo-textarea' } },
          { tool: 'puppeteer_type', args: { selector: '.weibo-textarea', text } },
          { tool: 'puppeteer_click', args: { selector: '.W_btn_a[node-type="submit"]' } },
        ],
        bilibili: [
          { tool: 'puppeteer_navigate', args: { url: 'https://t.bilibili.com/' } },
          { tool: 'puppeteer_wait_for_selector', args: { selector: '.publish-textarea', timeout: 10000 } },
          { tool: 'puppeteer_click', args: { selector: '.publish-textarea' } },
          { tool: 'puppeteer_type', args: { selector: '.publish-textarea', text } },
          { tool: 'puppeteer_click', args: { selector: '.submit-btn' } },
        ],
        douyin: [
          { tool: 'puppeteer_navigate', args: { url: 'https://creator.douyin.com/creator-micro/content/upload/text' } },
          { tool: 'puppeteer_wait_for_selector', args: { selector: 'div[contenteditable="true"]', timeout: 12000 } },
          { tool: 'puppeteer_type', args: { selector: 'div[contenteditable="true"]', text } },
          { tool: 'puppeteer_click', args: { selector: 'button.publish-btn' } },
        ],
        pinterest: [
          { tool: 'puppeteer_navigate', args: { url: 'https://www.pinterest.com/pin-builder/' } },
          { tool: 'puppeteer_wait_for_selector', args: { selector: '[data-test-id="note-pin-type"]', timeout: 10000 } },
          { tool: 'puppeteer_click', args: { selector: '[data-test-id="note-pin-type"]' } },
          { tool: 'puppeteer_wait_for_selector', args: { selector: 'textarea[data-test-id="pin-draft-title"]', timeout: 8000 } },
          { tool: 'puppeteer_type', args: { selector: 'div[data-test-id="pin-draft-note"] [contenteditable]', text } },
          { tool: 'puppeteer_click', args: { selector: '[data-test-id="board-dropdown-select-button"]' } },
          { tool: 'puppeteer_click', args: { selector: '[data-test-id="publish-pin-button"]' } },
        ],
      }

      const steps = recipes[platform]
      if (!steps) return { success: false, error: `Unknown platform: ${platform}` }

      for (const step of steps) {
        await client.callTool(step.tool, step.args)
      }
      return { success: true, postId: `${platform}_${Date.now()}` }
    } catch (err) {
      console.warn(`[AgentCore] Static recipe failed for ${platform}, falling back to AI agent:`, err)

      // Fallback: Use browser_use AI agent to perform the task autonomously
      // Require a valid API key before spawning a browser — avoids endless Chromium windows on misconfigured installs
      const apiKey = process.env['OPENAI_API_KEY'] || ''
      if (!apiKey) {
        console.warn(`[AgentCore] Skipping browser-use fallback — OPENAI_API_KEY not set`)
        return { success: false, error: 'AI Fallback skipped: OPENAI_API_KEY not configured' }
      }

      const aiTask = `Navigate to ${platform === 'x' ? 'x.com' : platform === 'linkedin' ? 'linkedin.com' : platform}.com and publish this content: "${text}". Ensure it is actually posted and you see a success message.`

      try {
        const result = await browserUseWorker.call({
          task: aiTask,
          maxSteps: 30,
          apiKey,
          baseUrl: process.env['OPENAI_BASE_URL'] || 'https://api.openai.com/v1',
          model: llmGateway.getDefaultModel(llmGateway.hasProvider('openai') ? 'openai' : (llmGateway.getFirstProvider() ?? 'openai'))
        })

        if (result.success) {
          return { success: true, postId: `${platform}_ai_${Date.now()}` }
        } else {
          return { success: false, error: `AI Fallback also failed: ${result.error}` }
        }
      } catch (aiErr) {
        return { success: false, error: `AI Fallback exception: ${aiErr instanceof Error ? aiErr.message : String(aiErr)}` }
      }
    }
  }


  async runAgent(task: QueuedTask): Promise<void> {
    // Emit failure for pre-setup errors so the renderer is never left hanging
    if (!this.registry) {
      messageBus.emit('agent:run-failed', { agentId: task.agentId, runId: 'setup', error: 'AgentCore registry not initialized' })
      throw new Error('AgentCore: registry not set. Call setRegistry() first.')
    }

    // Direct-mode: no DB agent — build a synthetic AgentDefinition from input payload
    const isDirect = task.agentId.startsWith('__direct_')
    const agent = isDirect
      ? (() => {
          const inp = task.payload.input as Record<string, unknown>
          const campaignId = typeof inp['campaignId'] === 'string' ? inp['campaignId'] : null
          if (campaignId) setCampaignId(task.agentId, campaignId)
          return {
            id: task.agentId,
            name: typeof inp['name'] === 'string' ? inp['name'] : 'Direct',
            platform: typeof inp['platform'] === 'string' ? inp['platform'] : 'x',
            provider: typeof inp['provider'] === 'string' ? inp['provider'] : llmGateway.getFirstProvider() ?? 'claude',
            model: typeof inp['model'] === 'string' ? inp['model'] : '',
            personaId: typeof inp['personaId'] === 'string' ? inp['personaId'] : 'default',
            customInstructions: typeof inp['customInstructions'] === 'string' ? inp['customInstructions'] : '',
            securityProfile: {
              agentId: task.agentId,
              allowedPlatforms: [],
              allowedTools: [
                'tool:web_search', 'tool:rss_reader', 'tool:memory_recall',
                'tool:read_url', 'tool:schedule_post', 'tool:read_skill',
                'tool:image_gen',
              ],
              maxTokensPerRun: 8192,
              maxRunsPerHour: 60,
              canAccessInternet: true,
              canReadFiles: false,
              credentialScope: [],
            },
            skillIds: [],
            status: 'active' as const,
            cronExpr: '',
          }
        })()
      : this.registry.getById(task.agentId)

    if (!agent) {
      messageBus.emit('agent:run-failed', { agentId: task.agentId, runId: 'setup', error: `Agent not found — id=${task.agentId}` })
      throw new Error(`AgentCore: agent not found — id=${task.agentId}`)
    }

    console.log(`[AgentCore] runAgent start — agent="${agent.name}" platform=${agent.platform} provider=${agent.provider}`)

    // Persist running status to DB so polls reflect reality even after page refresh
    // Normalize 'active' (virtual-agent only value) to 'idle' for restore
    const preRunStatus: AgentStatus = (agent.status === 'idle' || agent.status === 'paused' || agent.status === 'error' || agent.status === 'complete')
      ? agent.status : 'idle'
    this.registry?.updateStatus(agent.id, 'running')

    messageBus.emit('agent:run-started', { agentId: agent.id, runId: 'pending', name: agent.name, platform: agent.platform })

    // runId is owned by reactEngine (via workingMemory) — don't pre-generate here
    const startedAt = new Date()

    // Build system prompt: use assigned persona, fall back to 'default', then a
    // platform-aware base prompt so the agent always has meaningful instructions.
    const baseSystemPrompt =
      personaHub.compose(agent.personaId) ||
      personaHub.compose('default') ||
      `You are a seasoned content writer with a sharp editorial instinct. ` +
      `You write for ${agent.platform} — your copy is direct, specific, and earned. ` +
      `You never use filler words, never explain what you're about to say, and never sound like a chatbot. ` +
      `Every sentence either adds information or creates tension. If it does neither, cut it. ` +
      `Use available tools to research real trends and facts before writing. ` +
      `IMPORTANT: If a tool returns empty results or an error, do NOT retry the same tool. ` +
      `Fall back to your own knowledge and write anyway.`

    const imageGenAvailable = !!getToolKey('302ai')
    const imageGenHint = imageGenAvailable
      ? '\n\n## Image Generation\nYou have access to the `image_gen` tool to create AI-generated images for posts. ' +
        'You can call `image_gen` MULTIPLE TIMES to generate a set of images — each call returns one URL. ' +
        'Collect all returned URLs into an array and pass them together in `mediaUrls` when calling `schedule_post`.\n\n' +
        'Platform image guidance:\n' +
        '- xiaohongshu: MUST generate 3–9 images (carousel format). Call `image_gen` 3–6 times with varied prompts (different angles, details, scenes of the same topic). Pass all URLs in `mediaUrls`.\n' +
        '- instagram: Generate 1–3 images. A single strong hero image is sufficient; use 3 for carousel posts.\n' +
        '- linkedin: Generate 1 image — professional, data-visual, or product-focused.\n' +
        '- x: 1–2 images recommended for engagement.\n' +
        '- Other platforms: 1 image unless the task explicitly asks for multiple.\n\n' +
        'IMPORTANT: Call all `image_gen` invocations BEFORE calling `schedule_post`. ' +
        'Do not call `schedule_post` until you have all image URLs ready.'
      : ''

    const todayStr = new Date().toISOString().slice(0, 10)
    const systemPrompt = `${baseSystemPrompt}\n\nToday's date: ${todayStr}. Always schedule posts for FUTURE dates (at least 1 hour from now).\n\n${agent.customInstructions ? `## Custom Instructions\n${agent.customInstructions}\n\n` : ''}${skillRegistry.getAvailabilityManifest()}${imageGenHint}` +
      `\n\n## Tool Usage Rules\n` +
      `- Do NOT call \`browser_do\` for content research or creation. Use \`web_search\` or \`read_url\` instead.\n` +
      `- Only call \`browser_do\` if explicitly instructed to interact with a logged-in browser session.\n` +
      `- When calling \`image_gen\`, you MUST always include a "prompt" argument with a detailed description. Calling it with empty args \`{}\` will always fail.\n` +
      `- If \`image_gen\` returns an error, fix the arguments and retry once. If it fails again, skip images and call \`schedule_post\` without mediaUrls — do NOT keep retrying.\n` +
      `- If you receive a SYSTEM message saying you are stuck in a loop or a tool is blocked, STOP immediately and call \`schedule_post\` with whatever content you have.\n` +
      `\n## Writing Standards — NON-NEGOTIABLE\n` +
      `- NO emojis of any kind. Not one. Not even in hashtags.\n` +
      `- NO AI-sounding phrases: "In today's fast-paced world", "game-changer", "dive into", "delve into", "unlock", "leverage", "it's important to note", "revolutionize", "seamlessly", "cutting-edge", "transformative", "at the end of the day", "exciting", "innovative", "robust", "unleash your potential".\n` +
      `- NO hollow openers. Do not start with "Are you ready?", "Have you ever wondered?", "I'm excited to share", "I'm thrilled", or any variation.\n` +
      `- NO markdown syntax (no **, no *, no ##, no ---). Plain text only.\n` +
      `- Write like a person who knows something, not like a bot summarizing a topic.\n` +
      `- Be specific. Name the thing. State the number. Tell the exact story. Vague claims get cut.\n` +
      `- Sentences should feel inevitable in retrospect. Short when it counts. Long when the idea earns it.\n` +
      `- Do NOT include any preamble like "Here is the post:" or "I've generated:". Pass ONLY the post body to schedule_post.\n` +
      `\n\nCRITICAL: You MUST call the \`schedule_post\` tool before finishing. ` +
      `Do NOT write the post content as plain text in your reply — call the tool. ` +
      `Your run is only considered successful when \`schedule_post\` has been invoked with the final post text. ` +
      `After calling the tool, your final reply should be a one-sentence confirmation.`

    // ── Runtime context from UI ───────────────────────────────────────────────
    const inputPlatform = typeof task.payload.input?.['platform'] === 'string'
      ? task.payload.input['platform']
      : agent.platform

    // All tools from the agent's security profile are available for this run.
    // The LLM decides autonomously which tools to call based on the task.
    const mergedAllowedTools = [...new Set([
      ...(agent.securityProfile.allowedTools as string[]),
      'tool:read_url',
      'tool:read_skill',
      'tool:image_gen',
    ])] as SecurityProfile['allowedTools']

    const runSecurityProfile: SecurityProfile = {
      ...agent.securityProfile,
      allowedTools: mergedAllowedTools,
    }

    // Platform-specific formatting hints injected into the user prompt
    const platformGuides: Record<string, string> = {
      x: `Platform: X (Twitter). Hard limit 280 characters — every word is load-bearing.
Style: One sharp observation or one concrete fact. No build-up, no conclusion. The reader should feel the punch before they realize it landed.
Hashtags: 0-2, only if they add context. Never decorative.
No emojis. No "thoughts?" fishing. No hollow calls to action.`,

      linkedin: `Platform: LinkedIn. 150-300 words. Paragraph breaks after every 1-2 sentences — walls of text get scrolled past.
Style: Write from experience. Open with the thing that happened, not what you learned from it. Let the insight arrive naturally at the end.
Voice: First-person, grounded, a little dry. No corporate-speak. No "I'm humbled to announce."
Hashtags: 3-5, appended quietly at the end. Never mid-sentence.`,

      xiaohongshu: `平台：小红书。使用中文写作。200-400字。
风格：像一个真实的人在分享亲身经历，不是在推销。标题要具体，不要"干货满满"这类废话开头。
句子短，信息密度高。细节越具体越好——写"用了三周、效果比某品牌强一倍"，不要写"效果非常好"。
话题标签：3-5个，放在正文末尾。不要在正文里堆砌关键词。
不用emoji。`,

      instagram: `Platform: Instagram. Caption max visible length: 125 characters before "more" — the first two lines must earn the tap.
Style: Specific, textured. Describe what you actually see or felt. Skip the generic "beautiful moment" framing.
Structure: Open strong, build context in the middle, close with something that earns a save.
Hashtags: 5-8, placed on a separate line at the very end. Niche beats generic.
No emojis. No "link in bio" unless necessary.`,

      tiktok: `Platform: TikTok video caption. 80-150 characters — this is a hook, not a summary.
Style: Direct address or a provocative half-statement that makes people stop. Reads like something a friend would text you.
Hashtags: 2-4, trend-relevant. Place at end.
No emojis.`,

      youtube: `Platform: YouTube Community post. 100-300 words.
Style: Behind-the-scenes texture or an honest take on something in your field. Avoid the promotional tone of a video description — write like you're talking to subscribers, not an audience.
One focused thought. End with a question only if it's genuinely interesting, not just "what do you think?"
No emojis. No hashtags.`,

      facebook: `Platform: Facebook post. 50-100 words optimal. Plain prose.
Style: Conversational but considered. Write for someone scrolling slowly, not fast. A specific story beats a general point every time.
No hashtags unless the content naturally calls for one.
No emojis.`,

      threads: `Platform: Threads. Max 500 characters.
Style: Like a thought you actually had, not content you produced. Incomplete ideas are fine. Deadpan works.
One thing per post. Do not pack value. Let it breathe.
No emojis. No hashtags.`,

      bluesky: `Platform: Bluesky. Max 300 characters.
Style: Intellectual, slightly nerdy, honest. Say the thing people are thinking but not saying. Reference the specific, not the general.
No emojis. 0-1 hashtags.`,

      weibo: `平台：微博。使用中文。300-800字为佳。
风格：有态度，有立场。不做和事佬，不说"各有各的道理"。观点清晰，用数据或具体事例支撑。
话题：使用 #话题# 格式，选择当前热点相关的，放在开头或结尾。
不用emoji。`,

      bilibili: `平台：哔哩哔哩 动态。使用中文。200-500字。
风格：有个性，有品味。可以稍微口语化，但不要装嫩。对技术或文化有具体见解，不泛泛而谈。
用词准确，避免"绝了""爆了"这类流量词。
不用emoji。`,

      douyin: `平台：抖音视频文案。使用中文。60-120字。
风格：直接说结论，第一句话就是最重要的信息。语言有画面感，让人能想象出来。
话题标签：2-3个，放末尾。
不用emoji。`,

      pinterest: `Platform: Pinterest. 100-300 characters.
Style: Descriptive and precise — help the reader picture exactly what they're saving. Lead with the most specific detail.
Keywords over hashtags. No hashtags.
No emojis.`,
    }
    const platformHint = platformGuides[inputPlatform] ?? `Platform: ${inputPlatform}`

    const userPromptRaw = typeof task.payload.input?.['prompt'] === 'string'
      ? task.payload.input['prompt']
      : null

    // ── Inject brand knowledge from Knowledge Base ────────────────────────
    // Search for docs relevant to the user's request and inject them as context.
    let knowledgeContext = ''
    try {
      const searchQuery = userPromptRaw ?? `${agent.platform} ${agent.name}`
      const knowledgeDocs = await knowledgeStore.search(searchQuery, 5)
      if (knowledgeDocs.length > 0) {
        knowledgeContext = '\n\n<brand_knowledge>\n' +
          knowledgeDocs.map(d => `## ${d.title}\n${d.content.slice(0, 800)}`).join('\n\n') +
          '\n</brand_knowledge>'
        messageBus.emit('agent:log', { agentId: agent.id, runId: 'pending', message: `[Context] Injected ${knowledgeDocs.length} knowledge doc(s) into context` })
      }
    } catch (err) {
      console.warn('[AgentCore] Failed to load knowledge context:', err)
    }

    // ── Inject relevant RSS articles from local vector store ──────────────
    let rssContext = ''
    try {
      const rssStats = rssVectorStore.getStats()
      if (rssStats.embedded > 0 && userPromptRaw) {
        const qEmb = await embeddingService.embed(userPromptRaw)
        const rssItems = qEmb
          ? rssVectorStore.semanticSearch(qEmb, 5)
          : rssVectorStore.keywordSearch(userPromptRaw, 5)
        if (rssItems.length > 0) {
          rssContext = '\n\n<rss_context>\n## Relevant Articles from Subscribed Feeds\n' +
            rssItems.map((item, i) =>
              `### ${i + 1}. ${item.title}\nSource: ${item.source} | ${item.pubDate}\nURL: ${item.url}\n${item.content.slice(0, 400)}`
            ).join('\n\n') +
            '\n</rss_context>'
          messageBus.emit('agent:log', { agentId: agent.id, runId: 'pending', message: `[Context] Injected ${rssItems.length} relevant RSS article(s) from local store` })
        }
      }
    } catch (err) {
      console.warn('[AgentCore] Failed to inject RSS context:', err)
    }

    const providerKey = typeof task.payload.input?.['provider'] === 'string'
      ? task.payload.input['provider']
      : agent.provider || llmGateway.getFirstProvider() || 'claude'
    const config: ReactEngineConfig = {
      agentId: agent.id,
      provider: providerKey,
      model: typeof task.payload.input?.['model'] === 'string' ? task.payload.input['model'] : agent.model || llmGateway.getDefaultModel(providerKey),
      systemPrompt: systemPrompt + knowledgeContext + rssContext,
      maxIterations: typeof task.payload.input?.['maxIterations'] === 'number'
        ? task.payload.input['maxIterations']
        : 30,
      maxTokens: agent.securityProfile.maxTokensPerRun || 4096,
      securityProfile: runSecurityProfile,
    }

    // Platforms that require image generation
    const imageRequiredPlatforms = ['xiaohongshu', 'instagram', 'x', 'linkedin', 'weibo', 'douyin', 'pinterest', 'threads', 'bluesky']
    const needsImages = imageGenAvailable && imageRequiredPlatforms.includes(inputPlatform)
    const imageInstruction = needsImages
      ? `\n\nIMAGE REQUIREMENT: You MUST call \`image_gen\` to generate images for this post BEFORE calling \`schedule_post\`. ` +
        (inputPlatform === 'xiaohongshu' ? 'Generate 3–6 images with varied prompts, then pass all URLs in the `mediaUrls` array.' :
         inputPlatform === 'instagram' ? 'Generate 1–3 images then pass URLs in `mediaUrls`.' :
         'Generate 1 image then pass its URL in `mediaUrls`.')
      : ''

    const prompt = userPromptRaw
      ? `${platformHint}\n\nUser request: ${userPromptRaw}${imageInstruction}\n\nIMPORTANT: You MUST call the \`schedule_post\` tool with the finished post text. Do not put the post content in your reply text — use the tool.`
      : `You are managing the ${agent.name} agent on ${agent.platform}. ` +
      `Research current trending topics, draft a high-quality post, and add relevant hashtags. ` +
      (needsImages ? `Generate images using \`image_gen\` and pass them in \`mediaUrls\`. ` : '') +
      `You MUST call \`schedule_post\` with the final post text — do NOT write it as plain text in your reply.`

    let result: AgentRunResult

    try {
      result = await reactEngine.run(config, prompt)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      clearCampaignId(agent.id)
      this.registry?.updateStatus(agent.id, preRunStatus as AgentStatus)
      messageBus.emit('agent:run-failed', { agentId: agent.id, runId: 'unknown', error: errMsg })

      if (this.episodicMemory) {
        this.episodicMemory.save({
          id: crypto.randomUUID(),
          runId: 'unknown',
          agentId: agent.id,
          startedAt,
          finishedAt: new Date(),
          steps: [],
          outcome: 'failed',
          tokensUsed: 0,
          finalAnswer: `[ERROR] ${errMsg}`,
        })
      }
      throw err
    }

    // ── Auto-save fallback: if LLM wrote content but never called schedule_post ──
    // The LLM sometimes produces a final answer directly instead of calling the tool.
    // Detect this and persist the content so it's never silently lost.
    try {
      const schedulePostCalled = result.steps.some(step => {
        if (step.action?.name !== 'schedule_post' || !step.observation) return false
        try {
          const obs = JSON.parse(step.observation) as Record<string, unknown>
          return obs['success'] === true
        } catch { return false }
      })
      if (!schedulePostCalled && result.success && result.finalAnswer.trim()) {
        contentStore.create({
          agentId: agent.id,
          platform: inputPlatform as import('./types.js').PlatformId,
          text: result.finalAnswer.trim(),
          status: 'draft',
          scheduledAt: null,
        })
        messageBus.emit('agent:log', {
          agentId: agent.id,
          runId: result.runId,
          message: '[Auto-save] schedule_post not called — saved final answer as draft',
        })
      }
    } catch (autoSaveErr) {
      console.error('[AgentCore] Auto-save fallback failed:', autoSaveErr)
    }

    // Save episodic memory — don't let a DB write failure block the run-complete event
    try {
      if (this.episodicMemory) {
        this.episodicMemory.save({
          id: crypto.randomUUID(),
          runId: result.runId,
          agentId: result.agentId,
          startedAt,
          finishedAt: new Date(),
          steps: result.steps,
          outcome: result.success ? 'success' : 'failed',
          tokensUsed: result.tokensUsed,
          finalAnswer: result.finalAnswer || (result.error ? `[ERROR] ${result.error}` : ''),
        })
      }
    } catch (memErr) {
      console.error('[AgentCore] Failed to save episodic memory, continuing:', memErr)
    }

    clearCampaignId(agent.id)
    this.registry?.updateStatus(agent.id, preRunStatus as AgentStatus)
    messageBus.emit('agent:run-complete', { agentId: agent.id, runId: result.runId, result })
  }

  setRegistry(registry: AgentRegistry): void {
    this.registry = registry
  }

  getMessageBus(): typeof messageBus {
    return messageBus
  }

  stopWorkers(): void {
    workerBridge.stop()
    browserUseWorker.stop()
  }

  async triggerAgent(agentId: string, input?: Record<string, unknown>, priority: 0 | 1 | 2 | 3 = 0): Promise<string> {
    // priority 0 = Generate page (1 dedicated slot)
    // priority 2 = background campaign/automation (3 shared slots)
    const taskId = executionQueue.enqueue({
      agentId,
      priority,
      triggerSource: 'manual',
      payload: { trigger: 'manual', input },
      retryCount: 0,
      maxRetries: priority === 0 ? 0 : 2,
    })
    return taskId
  }

  /**
   * Run a minimal agent loop test for a given provider/model.
   * Bypasses the queue. maxIterations=5. Returns whether schedule_post was successfully called.
   */
  async testAgentLoop(provider: string, model: string): Promise<{
    ok: boolean
    schedulePostCalled: boolean
    steps: number
    tokensUsed: number
    error?: string
  }> {
    const virtualAgentId = `__test_${Date.now()}`
    const testPrompt = 'Write a 1-sentence post about AI for X (Twitter). Call schedule_post immediately with the text — do NOT write it as plain text.'

    const testSecurityProfile: SecurityProfile = {
      agentId: virtualAgentId,
      allowedPlatforms: ['x'],
      allowedTools: ['tool:schedule_post'],
      maxTokensPerRun: 4096,
      maxRunsPerHour: 100,
      canAccessInternet: false,
      canReadFiles: false,
      credentialScope: [],
    }

    const config: ReactEngineConfig = {
      agentId: virtualAgentId,
      provider,
      model,
      systemPrompt: 'You are a social media content assistant. Your only job: write a short post and call schedule_post immediately.',
      maxIterations: 5,
      maxTokens: 1024,
      securityProfile: testSecurityProfile,
    }

    try {
      const result = await reactEngine.run(config, testPrompt)
      const schedulePostCalled = result.steps.some(step => {
        if (step.action?.name !== 'schedule_post' || !step.observation) return false
        try {
          const obs = JSON.parse(step.observation) as Record<string, unknown>
          return obs['success'] === true
        } catch { return false }
      })
      return {
        ok: result.success,
        schedulePostCalled,
        steps: result.steps.length,
        tokensUsed: result.tokensUsed,
        ...(result.error ? { error: result.error } : {}),
      }
    } catch (err) {
      return {
        ok: false,
        schedulePostCalled: false,
        steps: 0,
        tokensUsed: 0,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  /**
   * Run a generation task directly without a pre-configured DB agent.
   * The caller supplies provider/model/platform/prompt inline.
   * A synthetic agentId is generated for IPC event routing.
   */
  async triggerDirect(input: {
    provider?: string
    model?: string
    platform: string
    prompt?: string
    name?: string
    personaId?: string
    customInstructions?: string
    campaignId?: string
  }, priority: 0 | 1 | 2 | 3 = 0): Promise<string> {
    const virtualAgentId = `__direct_${Date.now()}`
    const taskId = executionQueue.enqueue({
      agentId: virtualAgentId,
      priority,
      triggerSource: 'manual',
      payload: { trigger: 'direct', input: { ...input, __direct: true } },
      retryCount: 0,
      maxRetries: priority === 0 ? 0 : 2,
    })
    return taskId
  }
}

export const agentCore = new AgentCore()
export { messageBus } from './message-bus'
export { executionQueue } from './queue'

// Suppress unused-import warnings for modules that consumers may import from here
void workingMemory
