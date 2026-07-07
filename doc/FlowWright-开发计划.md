# FlowWright 开发计划

> 项目名称：FlowWright
> 文档版本：v0.2 · 2026-06-24
> 参考文档：[[AI-Agent工具-需求文档]] · [[AI-Agent工具-设计文档]]
> 最后更新：Phase 0 验收完成，记录偏离

---

## 项目信息

| 项      | 内容                                        |
| ------ | ----------------------------------------- |
| 定位     | 本地桌面 AI Agent 工具，专注长链任务编排                 |
| 运行时    | Electron + Node.js main process           |
| 前端     | React + Vite + React Flow + Monaco Editor |
| 工作流引擎  | LangGraph.js                              |
| LLM 调用 | Vercel AI SDK（多供应商）                       |
| 持久化    | MemorySaver（Phase 0）+ better-sqlite3（Phase 1 恢复）+ LanceDB（RAG） |
| 目标平台   | Windows/macOS                             |

---

## 开发原则

1. **Main process 是真正的后端**：LangGraph、MCP、RAG、文件 I/O 全在 main process，renderer 只负责 UI
2. **IPC 是唯一通道**：renderer 不直接操作文件系统或调用 LLM
3. **图结构与运行时状态分离**：`WorkflowGraph`（JSON 定义）与 `WorkflowState`（LangGraph 运行时）独立存储
4. **渐进式功能**：每个 Phase 独立可交付，不等后期功能才能验证核心价值
5. **先跑通，再打磨**：UI 样式留到功能闭环后再迭代

---

## Phase 0 · 项目脚手架 ✅ 已完成

**目标**：搭建可运行的 Electron + React + LangGraph 骨架，跑通一次最简单的 agent 调用。
**时间估算**：3-5 天
**完成日期**：2026-06-24

### 任务

#### T0.1 Electron + React + Vite 初始化 ✅
- ~~使用 `electron-vite` 脚手架（`npm create @quick-start/electron`）~~ → 直接手写所有文件（避免交互式 CLI 无法自动化）
- 目录结构：
  ```
  flowwright/
  ├── src/
  │   ├── main/          # Electron main process
  │   │   ├── index.ts   # 入口，窗口创建 + WorkflowEngine 实例化 + IPC 注册
  │   │   ├── startup.ts # 数据目录初始化
  │   │   ├── engine/    # WorkflowEngine
  │   │   └── ipc/       # IPC handlers
  │   ├── preload/       # contextBridge
  │   ├── renderer/      # React 前端
  │   │   ├── App.tsx
  │   │   ├── lib/ipc.ts # renderer 端类型安全 IPC 客户端
  │   │   └── ...
  │   └── shared/        # main + renderer 共用类型
  │       ├── types.ts   # WorkflowGraph, NodeConfig, WorkflowEvent...
  │       └── ipc.ts     # IPC command 常量 + IPCCommands 类型映射
  ├── electron.vite.config.ts
  └── package.json
  ```
- 验收：`npm run dev` 打开 Electron 窗口，显示 React 页面 ✅

#### T0.2 LangGraph.js 集成（main process） ✅
- 安装：`@langchain/langgraph` `ai` `@ai-sdk/anthropic`
- 在 `src/main/` 创建 `engine/` 目录，写最简 `WorkflowEngine` 类
- ~~跑通：单节点图，调用 Claude，返回文本~~ → 使用 DeepSeek Anthropic 兼容接口（`baseURL: https://api.deepseek.com/anthropic`）
- **偏离详情：**
  - 消息类型：LangChain `BaseMessage` → Vercel AI SDK `CoreMessage`
  - State reducer：`messagesStateReducer` → 内联 `(a, b) => [...a, ...b]`
  - SDK 选型：`@ai-sdk/deepseek` 返回空 text → 改用 `@ai-sdk/anthropic` + DeepSeek Anthropic 兼容端点
  - Checkpoint：`SqliteSaver` → `MemorySaver`（见 T0.4 偏离）
- 验收：main process 日志能看到 LLM 输出 ✅

#### T0.3 IPC 骨架 ✅
- `src/main/ipc/index.ts`：注册所有 `ipcMain.handle`
- `src/shared/ipc.ts`：定义所有 command 名和类型（TypeScript 类型安全）
- `src/renderer/lib/ipc.ts`：封装 `ipcRenderer.invoke` 调用
- **偏离详情：**
  - `registerIpcHandlers(engine: WorkflowEngine)` 接收引擎实例（非无参函数）
  - `workflow:run` 已真实调用 `engine.runSingleNode()`（非 stub），读取 `DEEPSEEK_API_KEY` 环境变量
  - 其余 14 个 handler 仍为 stub
- 验收：renderer 调用 `workflow:run`，main process 收到并执行 LLM 调用 ✅

#### T0.4 SQLite Checkpoint ⚠️ 推迟至 Phase 1
- ~~安装：`better-sqlite3` + LangGraph `SqliteSaver`~~
- **偏离原因：**
  1. `better-sqlite3@11.x` 无 Node.js v24 预编译二进制
  2. 开发机缺少 VS Build Tools，无法本地编译原生模块
  3. `better-sqlite3@12.10.0` 可安装但产生 32 个无用依赖
  4. `SqliteSaver` 真实导出路径为 `@langchain/langgraph-checkpoint-sqlite`（独立包），非 `@langchain/langgraph/checkpoint/sqlite`
- **当前方案：** 使用 `MemorySaver`（纯 JS 内存存储），checkpoint 不持久化
- **Phase 1 计划：** 中断恢复（T1.8）必须持久化 checkpoint，届时重新评估 better-sqlite3 或改用 JSON 文件方案
- 验收：workflow 运行后，MemorySaver 记录 checkpoint（进程内有效）✅

#### T0.5 数据目录初始化 ✅
- App 首次启动时检查并创建 `~/.flowwright/` 各子目录
- `config.json` 默认值写入
- **偏离详情：** 默认 provider/model 从 `anthropic/claude-haiku-4-5-20251001` 改为 `deepseek/deepseek-v4-flash`
- 验收：目录结构符合设计文档第八章 ✅

---

## Phase 1 · 工作流核心

**目标**：可以在 UI 上画一个多节点工作流，执行并查看结果，支持打回重做和中断恢复。
**时间估算**：10-14 天

### 任务

#### T1.1 React Flow 画布基础
- 安装：`@xyflow/react`
- `WorkflowCanvas` 组件：空白画布 + 节点/边增删
- 节点类型：`AgentNode`（自定义样式，显示 label + 状态 badge）
- 工具栏：添加节点、删除选中、保存图
- 验收：可以拖拽创建节点，连线，保存为 JSON

#### T1.2 节点配置面板
- 点击节点弹出/侧边栏展开配置面板
- 字段：label、provider（下拉）、model（文本）、systemPrompt（textarea）、maxRetries（number）
- 实时更新 React Flow 节点 data
- 验收：修改配置后保存，重新加载图时配置保留

#### T1.3 Monaco JSON Schema 编辑器
- 安装：`@monaco-editor/react`
- 嵌入节点配置面板的 `outputSchema` 字段
- 内置 JSON Schema 语法提示
- 提供预置模板下拉（"代码文件"、"分析报告"、"任务清单"）
- 验收：输入合法/非法 JSON Schema 有对应提示

#### T1.4 工作流执行（单节点闭环）
- `NodeExecutor.run(nodeConfig, state)` 实现：
  - 解析 provider/model → Vercel AI SDK model 实例
  - 构建 ReAct agent（`createReactAgent`）
  - 流式执行，通过 IPC 推送 `node:stream` 事件
- 前端 `RunMonitor` 组件：订阅 `run:event`，更新节点 badge（运行中/完成/失败）
- 验收：画布上单个节点能执行并实时看到流式输出

#### T1.5 JSON Schema 硬约束验证
- 安装：`zod` `zod-from-json-schema`（或 `json-schema-to-zod`）
- 节点执行后，用 outputSchema 验证 agent 输出
- Agent 使用 `structured_output` 工具返回结果（避免自由文本格式）
- 验证失败：自动附 validation error 重跑（不超 maxRetries）
- 验收：设置错误 schema，agent 连续失败后进入打回状态

#### T1.6 多节点图执行 + 条件边路由
- `EdgeConfig.condition`：`pass` / `reject` / `default`
- LangGraph `StateGraph` 构建：按 `WorkflowGraph` 的 edges 动态生成图
- 节点完成后按验证结果走不同边
- 验收：三节点链式工作流能顺序执行

#### T1.7 Human Review 节点
- 新节点类型 `human_review`：执行到此 `interrupt()`，等待
- 前端弹出 `HumanReviewPanel`：展示上游节点交付物，操作按钮（通过/打回）
- 打回时用户可输入 feedback，写入 `state.humanFeedback`
- 验收：工作流在 human_review 节点暂停，人工通过后继续

#### T1.8 中断恢复
- `workflow:pause`：调用 LangGraph interrupt
- `workflow:resume`：从 checkpoint 继续，可携带 humanInput
- 前端"运行历史"列表：显示所有 run，标注状态（运行中/暂停/完成）
- 验收：关闭 App 重启后，未完成的 run 可从历史列表恢复

---

## Phase 2 · 工具生态

**目标**：每个节点可独立配置供应商、MCP 工具、Skill，实现最小权限原则。
**时间估算**：10-14 天

### 任务

#### T2.1 多供应商支持
- `ProviderRegistry`：维护 `Map<provider, (model: string) => LanguageModel>`
- 支持：`anthropic` `openai` `google` `mistral` `ollama`
- Provider 配置 UI：全局设置页，输入 API key（`safeStorage` 加密存储）
- 节点配置面板新增 provider 下拉 + model 输入
- 验收：同一工作流的不同节点使用不同供应商各自执行

#### T2.2 MCPManager
- `src/main/mcp/MCPManager.ts`
  - 读 `config.json.mcpServers`，spawn 子进程（stdio transport）
  - 维护 `toolMap: Map<"server/tool", Tool>`
  - autoRestart 逻辑：子进程退出后按配置重试
- MCP 配置 UI：服务器增删改，状态指示灯（运行中/错误）
- 验收：filesystem MCP server 启动，工具列表可在 UI 查询

#### T2.3 节点级 MCP 工具权限
- 节点配置面板新增"MCP 工具"区域：checkbox 列表（来自 MCPManager.toolMap）
- `NodeExecutor` 执行时只注入节点配置的 `mcpTools` 子集
- 验收：节点 A 有 filesystem 工具，节点 B 无，两者行为符合配置

#### T2.4 Skill 注册表
- `src/main/skills/SkillRegistry.ts`
  - 启动时扫描 `~/.flowwright/skills/*.md`
  - 解析 frontmatter（gray-matter 库）→ `SkillDefinition[]`
  - 提供 `list()` / `get(name)` 接口
- 预置 3 个 skill 文件：`coding.md` `research.md` `writing.md`
- 验收：IPC `skills:list` 返回正确的 skill 列表

#### T2.5 Skill 自动选择机制
- 节点配置面板新增"可用 Skill"多选（白名单配置）
- `NodeExecutor` 执行前：
  1. 将白名单 skill 的 name + description 注入 system prompt
  2. 注册 `activate_skill(name)` 内置工具
  3. Agent 调用 `activate_skill` 时：合并 skill promptBody + tools
- 验收：agent 在 coding 任务中自动激活 coding skill，使用其工具

---

## Phase 3 · RAG 引擎

**目标**：支持本地文档索引，agent 可检索本地知识库。
**时间估算**：5-7 天

### 任务

#### T3.1 文档索引
- 安装：`@xenova/transformers` `vectordb`（LanceDB）`langchain/document_loaders`
- `RAGEngine.index(filePaths: string[])` 实现：
  1. 按扩展名分派解析器（`.md` / `.pdf` / `.ts/.py` 等代码文件）
  2. 分块：chunk size 512 tokens，overlap 64
  3. Transformers.js 生成 embedding（`all-MiniLM-L6-v2`，首次自动下载 ~25MB）
  4. 写入 LanceDB，metadata：`{ source, chunkIndex, text }`
- 验收：索引 10 个 MD 文件，LanceDB 数据目录有记录

#### T3.2 rag_search 工具
- `RAGEngine.query(query, topK = 5)` 实现：query → embedding → LanceDB ANN 搜索
- 将 `rag_search` 注册为 MCPManager 的内置工具（`rag/search`）
- 节点工具配置面板中可选 `rag/search`
- 验收：agent 调用 `rag_search("登录流程")` 返回相关文档片段

#### T3.3 RAG 节点类型
- 新节点类型 `rag_retrieve`：配置项为查询词列表或从上游 state 提取
- 批量查询后合并结果写入 `state.nodeOutputs["<nodeId>"]`
- 验收：调查报告模板工作流，RAG 节点输出注入后续写作节点

#### T3.4 文档管理 UI
- `RAGDocumentManager` 页面：已索引文档列表（文件名/路径/块数/时间）
- 操作：添加文件（文件选择对话框）、删除文档、重新索引
- 验收：UI 可完整管理文档生命周期，无需手动操作文件系统

---

## Phase 4 · 多 Workflow 并发（后续版本）

**目标**：同时管理多个工作流 run，互不干扰。
**优先级**：低，MVP 后再排期

### 预研点（现在不实现，但架构需预留）

- LangGraph `thread_id` 隔离：每个 run 使用不同 thread_id，已满足（当前也是）
- **需要预留的**：`runId` 已贯穿所有 IPC 接口，并发时只需多路复用事件分发
- **需要注意的**：并发 run 共享 MCPManager，MCP server 需支持多路调用（大部分 MCP server 天然支持）
- **Ollama 并发**：本地模型单实例，并发 run 可能需要排队策略

### Phase 4 任务（预留）
- [ ] 运行列表 UI（运行中 / 暂停 / 历史）
- [ ] 并发 token 用量统计与限额配置
- [ ] Run 对比视图（同一工作流不同参数的输出对比）

---

## 里程碑总览

| 里程碑 | 完成标志 | 预计时间 |
|--------|---------|---------|
| M0 骨架 | Electron 启动，单节点 agent 跑通（DeepSeek） | ✅ 第 1 周 |
| M1 工作流 MVP | 多节点图执行，打回重做，中断恢复 | 第 3 周 |
| M2 工具生态 | 多供应商 + MCP + Skill 自动选择 | 第 5 周 |
| M3 RAG | 本地文档检索，agent 可调用 | 第 6 周 |
| M4 打磨 | 工作流模板、日志、token 统计 | 第 7-8 周 |

---

## 依赖关系图

```
T0.1 → T0.2 → T0.3 → T0.5
         ↓
T0.4 (推迟至 Phase 1 T1.8 前)
                ↓
T1.1 → T1.2 → T1.3
         ↓
T1.4 → T1.5 → T1.6 → T1.7 → T1.8
                               ↓
T2.1 → T2.2 → T2.3           （并行开始）
               ↓
T2.4 → T2.5
         ↓
T3.1 → T3.2 → T3.3 → T3.4
```

Phase 2 的 T2.1 ~ T2.5 可在 Phase 1 完成后并行推进。

---

## 关键依赖包版本锁定

```json
{
  "electron": "33.3.1",
  "electron-vite": "3.0.0",
  "@xyflow/react": "12.x",
  "@monaco-editor/react": "4.x",
  "@langchain/langgraph": "0.2.42",
  "@langchain/langgraph-checkpoint": "0.0.15",
  "ai": "4.3.16",
  "@ai-sdk/anthropic": "1.2.12",
  "@langchain/mcp-adapters": "0.3.x",
  "@xenova/transformers": "2.x",
  "vectordb": "0.9.x",
  "better-sqlite3": "未安装（推迟至 Phase 1）",
  "gray-matter": "4.x",
  "zod": "3.x"
}
```

> 开发时锁定精确版本（`--save-exact`），避免小版本 breaking change。
>
> **Phase 0 偏离：** `better-sqlite3` 因 Node v24 无预编译二进制 + 缺少 VS Build Tools 推迟；当前使用 `MemorySaver`（纯 JS 内存实现）。`@ai-sdk/deepseek` 已安装但未使用——DeepSeek 调用改用 `@ai-sdk/anthropic` + `baseURL: https://api.deepseek.com/anthropic`（Anthropic 兼容端点）。

---

## 开放问题（待决策）

- [ ] **项目 repo 名**：`flowwright` / `flow-wright` / 其他？
- [ ] **首个公开版本号**：`0.1.0`（内测）还是等 Phase 3 完成后 `0.3.0`？
- [ ] **Skill marketplace**：后续是否支持社区 skill 分享？（影响 skill 格式设计）
- [ ] **工作流模板**：内置几个开箱即用模板（coding review / 调查报告 / 代码重构）

