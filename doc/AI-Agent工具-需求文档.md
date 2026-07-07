# FlowWright — 需求文档

> 版本：v0.1 · 日期：2026-06-24

---

## 一、项目定位

FlowWright — 一款面向个人开发者的本地桌面 AI Agent 工具，专注于**长链任务编排**。

核心场景：
- **Coding**：多步骤代码生成、审查、重构
- **深度调查**：信息搜集 → 分析 → 报告 → PPT 汇报

执行模式：**默认全自动运行，人可随时介入**——审查中间交付物、打回重做、动态调整工作流结构。

---

## 二、核心差异化（vs Claude Code）

| 痛点 | Claude Code | 本项目 |
|------|------------|--------|
| Subagent 管理粒度 | 只能管理整个 workflow | 每个节点独立配置 |
| 交付物打回 | 不支持 | 节点输出不通过可打回重做 |
| 中间交付物约束 | 仅提示词软约束 | Zod schema 硬约束 |
| 工作流中断恢复 | 困难 | LangGraph checkpoint，随时恢复 |
| 动态调整工作流 | 无法中途修改 | UI 直接编辑节点/边，重载继续 |
| Subagent 使用 MCP | ❌ 仅主 session 可用 | ✅ 每个节点独立配置 MCP 工具集 |
| Subagent 使用 Skill | ❌ 仅主 session 可用 | ✅ 每个节点独立挂载 skill |
| 本地 RAG | ❌ | ✅ 完全本地，无需联网 |
| 模型供应商 | 仅 4 个 Claude 模型 | ✅ 每个节点可选不同供应商 + 本地模型 |

---

## 三、功能需求

### 3.1 工作流编排

- 有向图结构：节点 = Agent/工具调用/人工审核门/条件路由
- 条件边：支持"通过 → 继续"/"不通过 → 打回上游节点（附 feedback）"
- 工作流序列化为 JSON，可保存、加载、版本管理
- 支持中途修改节点配置或图结构，修改后从 checkpoint 继续执行

### 3.2 多供应商模型支持

- 全局供应商配置：API Key 管理（通过 Tauri 安全存储，不落明文）
- 支持供应商：Anthropic / OpenAI / Google Gemini / Mistral / Ollama（本地）/ Azure OpenAI
- 每个节点独立选择 provider + model，与其他节点互不干扰
- 实现原理：Vercel AI SDK 统一接口，切换供应商不改变节点执行逻辑

```typescript
// 节点执行时，按配置动态解析供应商
const model = resolveProvider(node.provider, node.model)
// resolveProvider("openai", "gpt-4o") → openai("gpt-4o")
// resolveProvider("ollama", "llama3.2") → ollama("llama3.2")
// resolveProvider("anthropic", "claude-opus-4-8") → anthropic("claude-opus-4-8")
```

典型用法示例：
- 调查节点用 Gemini 2.0（长上下文、搜索集成）
- 代码生成节点用 Claude Opus（coding 最强）
- 格式化/摘要节点用 Haiku / GPT-4o mini（成本优化）
- 涉密节点用 Ollama 本地模型（数据不出境）

### 3.3 节点系统

每个节点独立配置：

```
{
  id, label,
  provider,       // "anthropic" | "openai" | "google" | "mistral" | "ollama" | ...
  model,          // 对应供应商的模型 ID
  systemPrompt,
  tools: [],      // 引用 MCP 工具（最小权限原则）
  skills: [],     // 引用 skill
  outputSchema,   // Zod schema，定义交付物结构
  maxRetries      // 打回后最多重试次数
}
```

### 3.3 交付物硬约束

- 每个节点出口可定义 Zod schema
- Agent 必须通过 `structured_output` 工具输出，schema 不满足则节点不推进
- 不通过时：自动附 validation error 打回，或暂停等人工处理

### 3.4 Human-in-the-loop

- 任意节点可设置"人工审核门"，执行到此暂停
- 人工操作：通过 / 打回（附 feedback）/ 修改节点配置 / 跳过
- 也可在自动运行中随时手动暂停

### 3.5 MCP 集成

- App 启动时初始化 MCP Client（单例，持续运行）
- 支持配置多个 MCP server（filesystem、browser、search 等）
- 节点配置中按名称引用具体工具（`filesystem/read`、`browser/navigate`）
- 未授权的工具在节点执行时不可调用

### 3.6 Skill 系统

- Skill = 提示词片段 + 专属工具集 + 可选资源引用
- Skill 注册表：扫描本地目录，读 frontmatter（name/description）
- 节点执行时动态注入：skill 提示词追加到 systemPrompt，工具合并到 tool 列表
- 每个 subagent 节点可挂载任意 skill 组合，互不干扰

### 3.7 本地 RAG

- Embedding：`@xenova/transformers`（Node.js + WASM，完全本地）
- 向量存储：LanceDB（嵌入式，无服务器）
- 接入方式：
  - 作为 Agent 工具（`rag_search(query)`，agent 自主调用）
  - 作为独立工作流节点（批量检索后注入后续节点 context）
- 文档管理 UI：索引、删除、查看来源

### 3.8 状态持久化与恢复

- LangGraph checkpoint 存入本地 SQLite
- 任意时刻关闭，下次打开可继续未完成的 workflow run
- 支持查看历史 run、回溯中间状态

---

## 四、技术架构

```
┌──────────────────────────────────────────┐
│             Tauri v2 桌面壳              │
│  ┌────────────────────────────────────┐  │
│  │  React + React Flow                │  │
│  │  · 工作流可视化编辑                │  │
│  │  · 节点属性面板（工具/skill 配置） │  │
│  │  · 实时执行状态 · RAG 文档管理     │  │
│  └──────────────┬─────────────────────┘  │
│                 │ Tauri IPC              │
│  ┌──────────────▼─────────────────────┐  │
│  │  LangGraph.js  工作流引擎          │  │
│  │  · 图执行 · 条件边 · checkpoint    │  │
│  │  · interrupt() human-in-the-loop   │  │
│  └──────┬──────────────┬──────────────┘  │
│         │              │                 │
│  ┌──────▼──────┐ ┌─────▼──────────────┐  │
│  │ MCP Client  │ │  Skill Registry    │  │
│  │ (单例)      │ │  + RAG Engine      │  │
│  └─────────────┘ └────────────────────┘  │
│  ┌─────────────────────────────────────┐  │
│  │  SQLite (checkpoint) + LanceDB(RAG)│  │
│  └─────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

**技术栈：**

| 层 | 技术 |
|----|------|
| 桌面壳 | Tauri v2 |
| 前端 | React + React Flow |
| 工作流引擎 | LangGraph.js |
| LLM 调用 | Vercel AI SDK |
| 交付物约束 | Zod |
| MCP 接入 | `@langchain/mcp-adapters` |
| Embedding | `@xenova/transformers` |
| 向量存储 | LanceDB |
| 持久化 | better-sqlite3 |

---

## 五、MVP 路线图

### Phase 0 · 项目脚手架（1周）
- [ ] Tauri v2 + React 项目初始化
- [ ] LangGraph.js 集成，跑通最简单的单节点 agent
- [ ] Vercel AI SDK 接入 Claude API
- [ ] SQLite checkpoint 配置

### Phase 1 · 工作流核心（2周）
- [ ] React Flow 画布：节点增删、连线
- [ ] 节点属性面板：model / systemPrompt 配置
- [ ] 条件边 + 打回逻辑
- [ ] Zod schema 硬约束（节点出口验证）
- [ ] 中断恢复：暂停 / 从 checkpoint 继续

### Phase 2 · 工具生态（2周）
- [ ] MCP Client 单例 + 多 server 配置 UI
- [ ] 节点级 MCP 工具权限配置（最小权限）
- [ ] Skill 注册表 + 节点级 skill 挂载
- [ ] Human-in-the-loop 审核门节点

### Phase 3 · RAG（1周）
- [ ] 文档索引（MD / PDF / 代码文件）
- [ ] `rag_search` 工具，供 agent 节点调用
- [ ] RAG 节点类型（批量检索 → 注入 context）
- [ ] 文档管理 UI

### Phase 4 · 打磨（持续）
- [ ] 工作流模板（coding / 调查报告 / PPT）
- [ ] 执行日志 & token 用量统计
- [ ] 开源准备（README / 文档 / CI）

---

## 六、数据目录结构

```
~/.flowwright/
  ├── config.json          # MCP servers、默认模型等全局配置
  ├── checkpoints.db       # LangGraph workflow 状态
  ├── rag/
  │   ├── lancedb/         # 向量索引
  │   └── sources/         # 原始文档
  ├── skills/              # skill 定义文件
  └── workflows/           # 工作流 JSON
```

---

*项目名称：FlowWright*
