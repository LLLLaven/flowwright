# FlowWright — 技术设计文档

> 版本：v0.1 · 日期：2026-06-24

---

## 一、系统架构

### 整体结构

```
Electron Main Process (Node.js)
├── WorkflowEngine
│   ├── GraphRunner        — 执行 workflow 图
│   ├── CheckpointManager  — SQLite 持久化（LangGraph MemorySaver）
│   └── NodeExecutor       — 构建并运行单节点 agent
├── SkillRegistry          — 扫描 skills/ 目录，管理 SkillDefinition
├── MCPManager             — spawn/管理 MCP server 子进程
├── RAGEngine
│   ├── EmbeddingService   — Transformers.js（WASM，本地）
│   └── VectorStore        — LanceDB（嵌入式）
├── ProviderRegistry       — provider + model → Vercel AI SDK model 实例
└── IPCHandler             — 桥接 main ↔ renderer

Electron Renderer Process (React)
├── WorkflowCanvas         — React Flow 可视化编辑
├── NodeConfigPanel
│   ├── ModelSelector      — provider + model 选择
│   ├── SkillSelector      — 配置节点可见 skill 列表
│   ├── MCPToolSelector    — 配置节点可用 MCP 工具
│   └── SchemaEditor       — Monaco 编辑 JSON Schema
├── RunMonitor             — 实时执行状态展示
├── HumanReviewPanel       — 人工审核/打回界面
└── RAGDocumentManager     — 文档索引管理
```

### 技术栈

| 层 | 技术 |
|----|------|
| 桌面壳 | Electron v33 |
| 前端框架 | React + Vite |
| 可视化工作流 | React Flow |
| 代码/Schema 编辑 | Monaco Editor |
| 工作流引擎 | LangGraph.js |
| LLM 调用 | Vercel AI SDK（多供应商统一接口）|
| 交付物约束 | JSON Schema → Zod（运行时转换）|
| MCP 接入 | `@langchain/mcp-adapters` |
| Embedding | `@xenova/transformers` |
| 向量存储 | LanceDB |
| 持久化 | better-sqlite3 |

---

## 二、核心数据结构

### 工作流图定义（序列化为 JSON，持久化）

```typescript
interface WorkflowGraph {
  id: string
  name: string
  globalDefaults: { provider: string; model: string }
  nodes: NodeConfig[]
  edges: EdgeConfig[]
}

type NodeType = "agent" | "human_review" | "condition" | "rag_retrieve"

interface NodeConfig {
  id: string
  label: string
  type: NodeType
  position: { x: number; y: number }   // React Flow 位置

  // agent 节点专属
  provider?: string                      // 覆盖 globalDefaults
  model?: string
  systemPrompt?: string
  availableSkills?: string[]             // 该节点可见的 skill 名称白名单
  mcpTools?: string[]                    // 格式: "server/tool"
  outputSchema?: JSONSchema              // 硬约束
  maxRetries?: number                    // 打回后最大重试次数
}

interface EdgeConfig {
  id: string
  source: string
  target: string
  condition?: "pass" | "reject" | "default"
}
```

### LangGraph 运行时状态

```typescript
interface WorkflowState {
  runId: string
  messages: Message[]
  nodeOutputs: Record<string, unknown>  // 各节点交付物，key = nodeId
  currentNodeId: string
  retryCount: number
  humanFeedback?: string                // 人工打回时附带的 feedback
}
```

### IPC 事件（引擎 → 前端，用于实时更新）

```typescript
type WorkflowEvent =
  | { type: "node:started";         nodeId: string }
  | { type: "node:stream";          nodeId: string; chunk: string }
  | { type: "node:completed";       nodeId: string; output: unknown }
  | { type: "node:rejected";        nodeId: string; reason: string }
  | { type: "node:awaiting_human";  nodeId: string; deliverable: unknown }
  | { type: "workflow:done";        runId: string }
  | { type: "workflow:error";       runId: string; error: string }
```

---

## 三、Skill 系统设计

### Skill 定义格式（Markdown frontmatter）

```markdown
---
name: coding
description: Expert software engineer for code generation, review, and refactoring
tools:
  - filesystem/read
  - filesystem/write
  - terminal/exec
---

You are an expert software engineer. Follow these principles:
- Write clean, well-documented code
- Always consider edge cases
...
```

### 运行时接口

```typescript
interface SkillDefinition {
  name: string
  description: string   // 展示给模型用于自主选择
  tools: string[]       // MCP tool 引用
  promptBody: string    // 激活时注入到 context
}
```

### Skill 自动选择机制（模型驱动）

```
节点执行前：
  1. 从 availableSkills 列表取出各 skill 的 name + description
  2. 注入 system prompt：
     "Available skills:\n- coding: Expert software engineer...\n- research: ..."
  3. Agent 调用内置工具 activate_skill(name) 来加载 skill

activate_skill 触发：
  4. skill.promptBody 追加到当前 context
  5. skill.tools 合并入该节点的可用工具集
  6. 继续执行
```

这让模型根据任务内容自主决定激活哪些 skill，用户只需配置白名单（节点可见范围），不需要手动绑定。

---

## 四、节点执行流程

`NodeExecutor.run(nodeConfig, state)` 的完整流程：

```
1. resolveProvider(provider, model)
      → Vercel AI SDK model 实例

2. resolveSkills(availableSkills)
      → 构建 skill 选择提示词 + activate_skill 工具

3. resolveMCPTools(mcpTools)
      → 从 MCPManager 单例取已初始化的 tool 实例

4. 合并 tools = mcpTools + [activate_skill] + (动态加载的 skill tools)

5. 构建 ReAct agent，stream 执行
      → 通过 IPC 推送 node:stream 事件到前端

6. 收到最终输出后，JSON Schema 验证
      → 转 Zod schema，调用 parse()

7a. 验证通过 → emit node:completed，推进到下一节点
7b. 验证失败（自动）→ retryCount++，附 error 重跑（未超限）
7c. 超过 maxRetries → emit node:awaiting_human，等人工介入
7d. 人工打回 → state.humanFeedback 写入，重跑节点
```

---

## 五、IPC 接口设计

### Commands（renderer → main，request/response）

```typescript
// 工作流管理
"workflow:load"    (graphJson: string)    → WorkflowGraph
"workflow:save"    (graph: WorkflowGraph) → void
"workflow:run"     (graphId: string)      → runId: string
"workflow:pause"   (runId: string)        → void
"workflow:resume"  (runId: string, humanInput?: HumanInput) → void
"workflow:abort"   (runId: string)        → void
"workflow:list"    ()                     → WorkflowGraph[]

// 节点热更新（运行中修改）
"node:update"      (runId: string, nodeId: string, config: Partial<NodeConfig>) → void

// 工具/资源查询
"skills:list"      ()  → SkillDefinition[]
"mcp:list"         ()  → MCPToolDefinition[]
"providers:list"   ()  → ProviderDefinition[]

// RAG
"rag:index"        (filePaths: string[])  → void
"rag:query"        (query: string, topK?: number) → Document[]
"rag:delete"       (docId: string)        → void
```

### Events（main → renderer，streaming push）

```typescript
// 通过 ipcMain 广播，renderer 用 ipcRenderer.on 监听
"run:event"  (runId: string, event: WorkflowEvent)
```

---

## 六、MCP 管理

### 配置格式

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "~"],
      "autoRestart": true,
      "maxRetries": 3
    },
    "browser": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"],
      "autoRestart": false
    }
  }
}
```

### MCPManager 职责

- App 启动时初始化所有 MCP server（stdio transport）
- 维护 `toolMap: Map<"server/tool", Tool>` 供 NodeExecutor 查询
- 监控子进程健康，按策略自动重启
- 崩溃超过 maxRetries → 标记不可用，通知前端

---

## 七、RAG 引擎

### 索引流程

```
filePaths
  → 文档解析（MD/PDF/代码，按扩展名分派）
  → 分块（chunk size: 512 tokens，overlap: 64）
  → Transformers.js embedding（本地 WASM）
  → LanceDB 写入（vector + metadata: {source, chunkIndex, text}）
```

### 查询（作为工具暴露给 agent）

```typescript
tool: rag_search(query: string, topK = 5) → { text: string; source: string }[]
```

### RAG 节点类型（批量检索场景）

适用于调查报告工作流开头：先批量检索，再注入后续节点 context。

```
[用户输入 + 查询词] → [RAG 节点] → state.nodeOutputs["rag"] → [写作 Agent]
```

---

## 八、本地数据目录

```
~/.flowwright/
  ├── config.json       # 全局配置（providers、MCP servers、默认模型）
  ├── checkpoints.db    # LangGraph 运行状态（better-sqlite3）
  ├── skills/           # *.md  skill 定义
  ├── workflows/        # *.json  workflow 图定义
  ├── schemas/          # *.json  可复用 JSON Schema
  └── rag/
      ├── lancedb/      # 向量索引
      └── sources/      # 已索引文档副本
```

API key 通过 Electron `safeStorage`（系统 keychain）加密存储，不落明文。

---

## 九、MVP 开发路线图

### Phase 0 · 脚手架（1 周）
- [ ] Electron + React + Vite 初始化
- [ ] LangGraph.js main process 跑通单节点 agent
- [ ] IPC skeleton（commands + events）
- [ ] SQLite checkpoint（MemorySaver）
- [ ] Vercel AI SDK 接入 DeepSeek

### Phase 1 · 工作流核心（2 周）
- [ ] React Flow 画布：节点/边增删改，序列化 JSON
- [ ] 节点配置面板：provider / model / systemPrompt
- [ ] Monaco JSON Schema 编辑器
- [ ] JSON Schema → Zod 验证，节点输出硬约束
- [ ] 条件边（pass/reject）+ 打回重做
- [ ] pause/resume，从 checkpoint 继续

### Phase 2 · 工具生态（2 周）
- [ ] 多供应商（OpenAI、Google、Mistral、Ollama）
- [ ] MCPManager：spawn server、节点级工具权限
- [ ] Skill 注册表 + activate_skill 自动选择机制
- [ ] Human review 节点

### Phase 3 · RAG（1 周）
- [ ] 文档索引（MD / PDF / 代码）
- [ ] `rag_search` 工具 + RAG 节点类型
- [ ] 文档管理 UI

### Phase 4 · 多 Workflow 并发（后续版本）
- [ ] 多 run 隔离（独立 LangGraph thread_id）
- [ ] 运行列表 UI
- [ ] 并发资源调度

---

## 十、关键决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 桌面运行时 | Electron | 整个后端是 Node.js，Tauri sidecar 方案引入运行时割裂且无实质收益 |
| Schema 编辑 | Monaco JSON 编辑器 | 开发者工具，无需额外抽象；JSON Schema 可移植可持久化 |
| Skill 触发 | 模型自动选择 | 用户维护白名单，agent 根据任务自主激活，更灵活 |
| 多 workflow 并发 | Phase 4 | 核心价值是长程单任务，并发是锦上添花，不影响 MVP 验证 |
| 图/状态分离 | 是 | WorkflowGraph（结构）与 WorkflowState（运行时）独立存储 |
