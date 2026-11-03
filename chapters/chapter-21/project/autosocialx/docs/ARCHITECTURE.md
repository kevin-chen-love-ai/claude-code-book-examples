# AutoSocialX — 核心架构文档

> **维护规范**: 每次架构模块新增、接口变更、分层调整时必须同步更新本文档。
> 最后更新: 2026-03-01 (v0.3)

---

## 一、整体分层结构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Renderer Process                            │
│         React 19 + Zustand + React Query + Tailwind UI             │
│   Pages: Dashboard / Agents / Campaigns / Content / Analytics ...  │
└────────────────────────────┬────────────────────────────────────────┘
                             │ contextBridge IPC (只读安全 API)
┌────────────────────────────▼────────────────────────────────────────┐
│                          Main Process                               │
│                                                                     │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │                    AGENT CORE                             │     │
│   │  ReAct Engine · Memory · Tool Use · Queue · Bus · Sec   │     │
│   └──────────────────────────────────────────────────────────┘     │
│                                                                     │
│   Agent Registry · Task Scheduler · Content Scheduler              │
│   Persona Hub · LLM Gateway                                        │
│   SQLite (better-sqlite3) · LanceDB (向量 RAG)                     │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────┐      │
│   │              MCP 子系统 (electron/mcp/)                  │      │
│   │  MCPConfigManager · MCPClient · MCPServerRegistry       │      │
│   └──────────────────────────┬──────────────────────────────┘      │
└──────────┬───────────────────┼──────────────────┬───────────────────┘
           │ child_process     │ stdio (MCP协议)   │
           │ fork + JSON-RPC   │                   │
┌──────────▼──────────────┐  ┌▼─────────────────────────────────────┐
│   Playwright Worker     │  │        MCP Server Subprocess(es)     │
│  (Platform Adapters)    │  │  npx @modelcontextprotocol/server-*  │
└─────────────────────────┘  │  e.g. server-puppeteer (浏览器控制)  │
                             └──────────────────────────────────────┘
```

---

## 二、Agent Core（核心引擎）

Agent Core 是系统的中枢，包含 6 个子模块，所有 Agent Run 均由它统一管理。

### 2.1 ReAct Engine（推理-行动引擎）

**位置**: `electron/agent-core/react-engine.ts`

Agent 不是简单的触发→执行，而是 **Reason → Act → Observe** 的自主迭代循环。

```
循环开始 (maxIterations 默认 10)
  │
  ▼
[Reason]   LLM 生成 Thought + 决定下一个 Action
  │
  ▼
[Act]      Tool Use Manager 执行 tool_call
  │
  ▼
[Observe]  将工具返回结果写入 Working Memory
  │
  ├── 未完成 → 回到 Reason（注入新 Observation）
  └── 完成   → Final Answer → 写入 Episodic Memory
```

**核心接口**:

```typescript
interface ReactEngineConfig {
  agentId: string
  maxIterations: number         // 防死循环上限
  stopConditions: StopCondition[]
  securityProfile: SecurityProfile
}

interface RunStep {
  iteration: number
  thought: string
  action: ToolCall | null
  observation: string | null
  timestamp: Date
}

interface AgentRunResult {
  success: boolean
  steps: RunStep[]
  finalAnswer: string
  tokensUsed: number
  durationMs: number
}
```

---

### 2.2 Memory System（三层记忆）

**位置**: `electron/agent-core/memory/`

| 层级 | 名称 | 存储 | 生命周期 | 用途 |
|------|------|------|---------|------|
| L1 | Working Memory | 内存 Map | 单次 Run | 当前上下文窗口、步骤中间结果 |
| L2 | Episodic Memory | SQLite `agent_runs` 表 | Agent 级别永久 | 历史 Run、发帖记录、交互日志 |
| L3 | Semantic Memory | LanceDB 向量库 | 全局持久 | 知识库、风格样本、RAG 召回 |

**行为规范**:
- Act 前：从 L2/L3 召回 top-k 相关记忆，注入 Reason 上下文
- Run 结束：Episode 写入 L2，异步更新 L3 向量索引
- L1 在 Run 完成后自动清理，不跨 Run 共享

```typescript
interface WorkingMemory {
  runId: string
  contextWindow: Message[]       // 传入 LLM 的消息历史
  intermediateResults: Map<string, unknown>
  toolCallHistory: ToolCallRecord[]
}

interface EpisodicRecord {
  runId: string
  agentId: string
  startedAt: Date
  finishedAt: Date
  steps: RunStep[]
  outcome: 'success' | 'failed' | 'partial'
  tokensUsed: number
}

interface SemanticChunk {
  id: string
  agentId: string
  content: string
  embedding: number[]           // LanceDB 向量
  source: 'post' | 'reply' | 'knowledge' | 'style_sample'
  createdAt: Date
}
```

---

### 2.3 Tool Use Manager（工具管理器）

**位置**: `electron/agent-core/tool-use/`

统一工具注册、Schema 校验、执行与结果回收。对 LLM 暴露标准 JSON Schema 函数表。

```
Tool Registry
  ├── 内置工具
  │     ├── web_search          网络搜索
  │     ├── rss_reader          RSS 源抓取
  │     ├── memory_recall       召回语义记忆
  │     └── schedule_post       定时预约发布
  ├── 平台工具 (由 WorkerBridge 注册)
  │     ├── x_publish           发布到 X (Playwright Worker)
  │     ├── linkedin_post       发布到 LinkedIn (Playwright Worker)
  │     ├── xhs_publish         发布到小红书 (Playwright Worker)
  │     └── scrape_page         无头浏览器抓取页面
  ├── 技能工具 (由 packages/plugins 注册)
  │     ├── translate           翻译润色 (LLM factory)
  │     ├── image_gen           AI 生图 (stub, TODO: DALL-E)
  │     ├── hashtag_analyze     话题标签分析 (LLM factory)
  │     └── sentiment_scan      舆情扫描 (stub, TODO: API)
  └── MCP 工具 (运行时动态注入，由 MCPServerRegistry 注册)
        ├── puppeteer_navigate  MCP 浏览器导航
        ├── puppeteer_click     MCP 浏览器点击
        ├── puppeteer_type      MCP 浏览器输入
        ├── puppeteer_screenshot MCP 截图
        └── ...                 (所有 MCP server 暴露的工具均自动注册)
```

**MCP 工具的权限命名规范**:
- 权限字符串格式: `` `tool:mcp:${serverName}:${toolName}` ``
- 示例: `tool:mcp:browser:puppeteer_navigate`
- 这些权限不在静态 `Permission` 联合类型内，通过 `as Permission` 运行时注入

**执行流程**:
1. LLM 返回 `tool_call(name, args)`
2. 校验 args 符合该工具的 JSON Schema
3. `SecurityPolicy.checkPermission(agentId, toolName)` 鉴权
4. 执行工具，写入 Working Memory
5. 通过 Message Bus 发送 `tool:executing` 事件至 UI

```typescript
interface ToolDefinition {
  name: string
  description: string
  inputSchema: JSONSchema7
  handler: (args: unknown, ctx: ToolContext) => Promise<unknown>
  requiredPermission: Permission
}

interface ToolContext {
  agentId: string
  runId: string
  workingMemory: WorkingMemory
  securityProfile: SecurityProfile
}
```

---

### 2.4 Execution Queue（执行队列）

**位置**: `electron/agent-core/queue.ts`

内存级优先级队列，使用 `p-queue` 实现并发控制与背压管理。

```
Priority Levels:
  P0 Critical  — 人工触发、紧急重试
  P1 High      — 定时发布、热点响应
  P2 Normal    — 常规 Agent Run
  P3 Low       — 数据分析、报告生成

并发配置:
  maxConcurrentRuns: 3           // 同时运行的 Agent 数
  maxConcurrentToolCalls: 5      // 同时并发的工具调用数
  rateLimitPerPlatform:
    x: 10 ops/min
    linkedin: 5 ops/min
    xiaohongshu: 8 ops/min

失败策略: 指数退避重试 1s → 2s → 4s → 8s → 放弃
任务状态: enqueued → running → completed / failed / retrying
```

```typescript
interface QueuedTask {
  id: string
  agentId: string
  priority: 0 | 1 | 2 | 3
  triggerSource: 'cron' | 'event' | 'manual' | 'retry'
  payload: AgentRunPayload
  enqueuedAt: Date
  retryCount: number
  maxRetries: number
}
```

---

### 2.5 Message Bus（消息总线）

**位置**: `electron/agent-core/message-bus.ts`

贯穿 Main Process、Renderer (IPC)、Worker 子进程 (JSON-RPC) 三层的事件通道。

```
事件命名规范: <namespace>:<action>

Core 事件:
  agent:status-changed    → UI Sidebar 状态点更新
  agent:log               → Dashboard 实时日志推送
  agent:run-started       → 队列任务开始执行
  agent:run-complete      → Run 完成，触发下一个队列任务
  agent:run-failed        → 进入重试逻辑
  tool:executing          → UI 显示当前工具名
  tool:result             → 工具结果写入 Working Memory
  queue:backpressure      → 队列饱和，暂停新任务入队
  memory:recalled         → L3 RAG 召回完成
  post:scheduled          → 内容进入发布日历
  post:published          → 发布成功，更新 Analytics

传输层:
  Main → Renderer    : ipcMain.emit / webContents.send
  Renderer → Main    : ipcRenderer.invoke (contextBridge)
  Main → Worker      : child_process 标准 IPC (JSON-RPC 2.0)
```

---

### 2.6 Security Policy（安全策略）

**位置**: `electron/agent-core/security.ts`

每个 Agent 绑定一份 `SecurityProfile`，所有工具调用前强制鉴权。

```typescript
interface SecurityProfile {
  agentId: string
  allowedPlatforms: PlatformId[]      // 平台白名单
  allowedTools: string[]              // 工具白名单
  maxTokensPerRun: number             // 单次 Token 上限 (默认 50_000)
  maxRunsPerHour: number              // 频率上限 (默认 12)
  canAccessInternet: boolean          // 外网开关
  canReadFiles: boolean               // 文件系统访问
  credentialScope: string[]           // 只能使用哪些 credential_id
}

// 凭证存储规范:
// - 明文 Token 只存 macOS Keychain / Windows Credential Store
// - Agent 只持有 credential_id (字符串引用)
// - 实际读取发生在 Main Process，Renderer 和 Worker 均不可见
type CredentialId = `cred_${string}`
```

---

## 三、外围模块

### 3.1 Agent Registry（注册表）

**位置**: `electron/agents/registry.ts`
**存储**: SQLite `agents` 表
职责：Agent CRUD，开机从 SQLite 恢复 active agent 列表，注册到 Scheduler。

### 3.2 Task Scheduler（调度器）

**位置**: `electron/agents/scheduler.ts`
职责：两种触发方式
- **Cron 触发**: `node-cron` 按表达式定时入队
- **事件触发**: 订阅 Message Bus 事件（热点出现 / 新评论 / 新 RSS 条目）

### 3.3 LLM Gateway（大模型网关）

**位置**: `packages/ai/src/gateway.ts`

| Provider | SDK / 方式 |
|---------|----------|
| Claude (Anthropic) | `@anthropic-ai/sdk` |
| OpenAI GPT | `openai` SDK |
| Ollama (本地) | REST `localhost:11434` |
| DeepSeek | OpenAI 兼容接口 |

统一接口：`generate()` / `stream()` / `generateWithTools()`

### 3.4 Persona Hub（人设注入）

**位置**: `electron/agents/persona.ts`
职责：每次 ReAct Engine 调用 LLM 前，动态拼装 System Prompt
- Persona 存为 YAML 文件：语气词库 / 禁忌词 / 历史风格样本 / 价值观锚点
- PersonaHub.compose(agentId) → 返回最终 systemPrompt 字符串

### 3.5 Platform Adapters（平台适配器）

**位置**: `packages/plugins/src/adapters/`
每个平台实现 `IPlatformAdapter` 接口，通过 **Playwright Worker 子进程**运行，主进程 JSON-RPC 通信。

```
IPlatformAdapter:
  checkHealth()      → 检查 Cookie/Token 有效性
  fetchTrends()      → 拉取平台热点
  composePost()      → 平台专属排版校验
  executePublish()   → Playwright 无头发布
```

### 3.6 Skills Registry（技能注册表）

**位置**: `packages/plugins/src/skills/`
可插拔 Tool 实现，实现 `ISkillPlugin` 接口后自动注册到 Tool Use Manager。

---

### 3.7 MCP 子系统（Model Context Protocol）

**位置**: `electron/mcp/`

AutoSocialX 实现了完整的 MCP 客户端侧，可接入任何符合 MCP 协议的外部服务（如浏览器控制、数据库、API 等）。架构上与 Claude Desktop 的 MCP 配置规范保持一致。

#### 三个核心模块

**`mcp-client.ts` — MCPClient**

单个 MCP server 的连接封装，基于 `@modelcontextprotocol/sdk`，通过 **stdio 子进程**与 MCP server 通信。

```typescript
class MCPClient {
  connect(command: string, args: string[], env?: Record<string, string>): Promise<void>
  listTools(): Promise<Tool[]>              // 查询 server 暴露的工具列表
  callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult>
  disconnect(): Promise<void>
}
```

**`config.ts` — MCPConfigManager**

读写 `~/.autosocialx/mcp_servers.json`，格式与 Claude Desktop 的 MCP 配置完全兼容，方便用户复用已有配置。

```json
// ~/.autosocialx/mcp_servers.json
{
  "mcpServers": {
    "browser": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer", "--", "--browserWSEndpoint=ws://..."]
    },
    "custom-tool": {
      "command": "node",
      "args": ["./my-mcp-server.js"],
      "env": { "API_KEY": "..." }
    }
  }
}
```

```typescript
class MCPConfigManager {
  readConfig(): MCPConfiguration
  setServer(name: string, config: MCPServerConfig): void    // 写入并持久化
  removeServer(name: string): void
}
```

**`mcp-registry.ts` — MCPServerRegistry**

管理多个 MCPClient 实例的生命周期，并将所有 MCP server 暴露的工具动态注入 AgentCore ToolRegistry。

```typescript
class MCPServerRegistry {
  startAll(): Promise<void>                    // 读取配置，启动所有已配置 server
  startServer(name, command, args): Promise<MCPClient>
  discoverAndRegisterTools(toolRegistry: ToolRegistry): Promise<void>  // 工具发现 & 注入
  getClient(name: string): MCPClient | undefined
  getStatus(): RegistryStatus                  // { [serverName]: { connected, toolCount } }
  shutdown(): Promise<void>
}
```

#### browser:connect 完整流程

```
用户点击 "Connect Browser"
    │
    ▼
IPC: browser:connect(port?)
    │
    ├─ 1. 尝试 fetch http://127.0.0.1:{port}/json/version
    │       成功 → 获取 wsEndpoint (CDP WebSocket URL)
    │       失败 → 无 wsEndpoint (后备为 headless 模式)
    │
    ├─ 2. mcpConfigManager.setServer('browser', {
    │         command: 'npx',
    │         args: ['-y', '@modelcontextprotocol/server-puppeteer',
    │                '--', '--browserWSEndpoint=<wsEndpoint>']  // 有 Chrome 时注入
    │      })                                                   // 写入 mcp_servers.json
    │
    ├─ 3. mcpServerRegistry.startServer('browser', ...)
    │         → 子进程: npx @modelcontextprotocol/server-puppeteer
    │         → MCPClient 通过 stdio 与之握手
    │
    ├─ 4. mcpServerRegistry.discoverAndRegisterTools(toolRegistry)
    │         → client.listTools() 拉取工具列表
    │         → 每个工具创建 ToolDefinition，handler 调用 client.callTool()
    │         → 权限: `tool:mcp:browser:${toolName}` (as Permission)
    │         → toolRegistry.register(toolDef) 注入 AgentCore
    │
    └─ 5. 返回 { success: true, status: RegistryStatus }
```

#### MCP 工具在 Agent Run 中的使用

MCP 工具注入 ToolRegistry 后，与内置工具完全等价。Agent 的 `securityProfile.allowedTools` 需显式包含对应权限字符串方可使用。

```
Agent ReAct 循环
  └─ LLM 决定调用 puppeteer_navigate(url)
       └─ ToolExecutor.execute()
            ├─ SecurityPolicy.check('tool:mcp:browser:puppeteer_navigate') ✓
            ├─ MCPClient.callTool('puppeteer_navigate', { url })
            └─ MCP server 控制浏览器，返回结果文本
```

#### ContentScheduler（内容自动发布）

**位置**: `electron/agents/content-scheduler.ts`

每 60 秒扫描 SQLite `content` 表中 `status='scheduled' AND scheduled_at <= now` 的记录，通过 `agentCore.publishViaBrowser()` 调用 MCP browser 工具完成发布，并更新状态为 `published` 或 `failed`。

```typescript
// 时间字段统一规范: unix seconds (INTEGER)
// content 表 scheduled_at / published_at 均存 Math.floor(Date.now() / 1000)
contentScheduler.start()   // initApp() 中调用，60s 轮询
contentScheduler.stop()    // before-quit 中调用
```

---

## 四、SQLite 数据表结构

```sql
-- Agent 定义
CREATE TABLE agents (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  platform    TEXT NOT NULL,
  persona_id  TEXT,
  skill_ids   TEXT,           -- JSON array
  cron_expr   TEXT,
  status      TEXT DEFAULT 'idle',
  security_profile TEXT,      -- JSON
  created_at  INTEGER,
  updated_at  INTEGER
);

-- Run 历史 (Episodic Memory L2)
CREATE TABLE agent_runs (
  id          TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL,
  status      TEXT,           -- success / failed / partial
  steps       TEXT,           -- JSON array of RunStep
  tokens_used INTEGER,
  duration_ms INTEGER,
  started_at  INTEGER,
  finished_at INTEGER
);

-- 内容库
CREATE TABLE content (
  id          TEXT PRIMARY KEY,
  agent_id    TEXT,           -- agent UUID 或 'manual' (手动创建)
  platform    TEXT,
  text        TEXT,
  media_urls  TEXT,           -- JSON array
  status      TEXT,           -- draft | scheduled | queued | published | failed
  scheduled_at INTEGER,       -- unix seconds (与 published_at 统一单位)
  published_at INTEGER,       -- unix seconds
  post_id     TEXT,           -- 平台返回的发布 ID
  stats       TEXT            -- JSON { likes, reposts, views }
);

-- 运营活动
CREATE TABLE campaigns (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  platforms   TEXT,           -- JSON array of PlatformId
  status      TEXT DEFAULT 'active',
  created_at  INTEGER
);

-- 凭证映射 (只存 ID，明文在 Keychain)
CREATE TABLE credentials (
  id          TEXT PRIMARY KEY,
  platform    TEXT NOT NULL,
  account_name TEXT,
  keychain_key TEXT NOT NULL, -- macOS Keychain 中的 key
  created_at  INTEGER
);
```

---

## 五、目录结构（落地后）

```
apps/desktop/
  electron/
    main.ts                          # Electron 主进程入口 + 全量 IPC handlers
    preload.ts                       # contextBridge API (ElectronAPI 类型)
    agent-core/
      index.ts                       # AgentCore 统一入口
      react-engine.ts                # ReAct 推理-行动引擎
      llm-gateway.ts                 # LLM 网关 (Claude/OpenAI/Ollama/DeepSeek)
      queue.ts                       # Execution Queue (p-queue)
      message-bus.ts                 # 三层事件总线
      security.ts                    # SecurityPolicy 鉴权
      types.ts                       # 全量共享类型 (PlatformId, Permission 等)
      memory/
        working-memory.ts            # L1 内存上下文
        episodic-memory.ts           # L2 SQLite Run 历史
        semantic-memory.ts           # L3 LanceDB 向量 RAG (stub)
      tool-use/
        registry.ts                  # Tool 注册表
        executor.ts                  # Tool 调用执行器
        builtin/                     # 内置工具
          web-search.ts
          rss-reader.ts
          memory-recall.ts
          schedule-post.ts           # 写入 content 表 + messageBus 事件
        skills/                      # 技能工具 (stub)
          image-gen.ts
          sentiment-scan.ts
    agents/
      registry.ts                    # Agent CRUD (SQLite)
      scheduler.ts                   # Cron + 事件触发调度 (node-cron)
      persona.ts                     # Persona Hub (YAML)
      content-scheduler.ts           # 60s 轮询自动发布到期内容
    mcp/
      config.ts                      # MCPConfigManager (~/.autosocialx/mcp_servers.json)
      mcp-client.ts                  # MCPClient (@modelcontextprotocol/sdk, stdio)
      mcp-registry.ts                # MCPServerRegistry 多 server 生命周期 + 工具注入
    workers/
      rpc.ts                         # JSON-RPC 2.0 类型定义
      playwright-worker.ts           # 平台发布子进程 (child_process.fork)
      worker-bridge.ts               # 主进程侧 WorkerBridge (Promise pool)
    db/
      client.ts                      # better-sqlite3 单例 (WAL mode)
      migrate.ts                     # SQL 迁移执行器
      content-store.ts               # ContentStore CRUD (unix seconds)
      migrations/
        001_initial.sql              # agents / agent_runs / content / credentials / campaigns

packages/
  core/src/index.ts                  # IPlatformAdapter / IAgentPipeline
  ai/src/index.ts                    # ILLMGateway 接口
  plugins/src/
    adapters/                        # BasePlatformAdapter + X / LinkedIn / XHS stub
    skills/
      translate-skill.ts             # makeTranslateTool(generateFn) LLM 翻译
      hashtag-skill.ts               # makeHashtagTool(generateFn) LLM 标签
```

---

## 六、版本变更记录

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| v0.1 | 2026-03-01 | P0 地基期：Electron 骨架 + 7页 UI + Zustand + Mock 数据 |
| v0.2 | 2026-03-01 | Agent Core 架构设计：ReAct / Memory / ToolUse / Queue / Bus / Security |
| v0.3 | 2026-03-01 | MCP 子系统接入：MCPConfigManager / MCPClient / MCPServerRegistry；ContentScheduler 自动发布；Playwright Worker + WorkerBridge；IPC 参数规范化；时间戳统一 unix seconds |
