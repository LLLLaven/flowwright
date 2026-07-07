# FlowWright

**本地桌面 AI Agent 工具，专为长链任务编排设计。**

FlowWright 是一款基于 [Electron](https://www.electronjs.org/) + [React Flow](https://reactflow.dev/) 的桌面应用，可让你通过可视化方式构建和执行 AI 驱动的工作流图 —— 包括 LLM 调用链、条件分支、JSON Schema 校验以及人工审核节点。

---

## 功能特性

### 已实现 ✅

- 🧩 **可视化工作流编辑器** — 基于 React Flow 的拖拽式节点/边编辑
- 🤖 **多节点执行引擎** — 使用 LangGraph.js 运行 Agent 节点链
- 🔀 **条件分支** — 基于 LLM 输出结果的 pass/reject 边路由
- ✅ **JSON Schema 校验** — 使用 Zod 对节点输出进行结构化校验，失败自动重试
- 👤 **人工审核节点** — 支持中断/恢复工作流进行人工审批
- 📡 **流式输出** — 实时推送 LLM 生成内容到前端渲染
- 💾 **Checkpoint 持久化** — 基于 JSON 文件的检查点存储（`JsonCheckpointer`），支持重启后恢复
- 📋 **运行历史** — 查看、恢复、终止历史工作流运行

### 未实现 🚧

- 🔌 **多供应商支持** — 目前仅支持 DeepSeek（Anthropic 兼容接口），尚未接入 OpenAI / Google / Mistral / Ollama
- 🛠️ **MCP 工具系统** — MCPManager 未构建，无法集成外部 MCP Server 工具
- 🎯 **Skill 注册表** — 尚未实现 Skill 扫描、注册与自动选择机制
- 📚 **RAG 引擎** — 本地文档索引、向量检索、RAG 节点类型均未实现
- 📊 **Token 用量统计** — 暂无 token 消耗追踪与限额
- 🔄 **多 Workflow 并发** — 仅支持单工作流运行，无并发调度
- 🏪 **工作流模板** — 尚无内置开箱即用模板

---

## 系统架构

```
主进程 (Node.js)               渲染进程 (React)
├── WorkflowEngine              ├── WorkflowCanvas (React Flow)
├── NodeExecutor                ├── NodeConfigPanel
├── GraphBuilder                ├── LeftPanel / StatusBar / TopBar
├── JsonCheckpointer (持久化)   ├── RunMonitor / HumanReviewPanel
├── IPC 处理器                  └── lib/ipc.ts (类型化 IPC 客户端)
├── WorkflowStore (存储层)
├── RunRegistry (运行历史)
└── shared/types.ts ←──────────→ shared/types.ts
```

- **主进程** 是真正的后端 —— LangGraph、LLM 调用、文件 I/O 全部在此运行
- **渲染进程** 仅负责 UI，通过 15 个类型安全的 IPC 通道与主进程通信
- **Graph ↔ State 分离** — WorkflowGraph（持久化 JSON）与 WorkflowState（LangGraph 运行时状态）分开存储
- **Checkpoint 持久化** — `JsonCheckpointer`（纯 JS，无原生依赖）替代了 `better-sqlite3`，checkpoint 存入 `~/.flowwright/checkpoints/`

---

## 快速开始

### 环境要求

- Node.js 18+
- [DeepSeek API Key](https://platform.deepseek.com/)（或其他 Anthropic 兼容接口）

### 安装运行

```bash
# 克隆仓库
git clone https://github.com/LLLLaven/flowwright.git
cd flowwright

# 安装依赖
npm install

# 设置 API Key
export DEEPSEEK_API_KEY=sk-your-key-here

# 启动开发模式
npm run dev
```

### 环境变量

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `DEEPSEEK_API_KEY` | 是 | DeepSeek Anthropic 兼容接口的 API Key |

LLM 提供商和模型可在 `src/main/engine/NodeExecutor.ts` 中配置 —— 默认使用 `createAnthropic` 连接 DeepSeek，可轻松替换为其他兼容提供商。

---

## 技术栈

| 技术 | 用途 |
|------|------|
| [Electron](https://electronjs.org/) + [electron-vite](https://electron-vite.org/) | 桌面端框架 & 构建工具 |
| [React](https://react.dev/) 19 + [TypeScript](https://www.typescriptlang.org/) | 前端 UI |
| [React Flow](https://reactflow.dev/) (`@xyflow/react`) | 画布图编辑器 |
| [LangGraph.js](https://langchain-ai.github.io/langgraphjs/) | 工作流图执行引擎 |
| [Vercel AI SDK](https://sdk.vercel.ai/) (`ai`) | LLM 客户端抽象层 |
| [Tailwind CSS](https://tailwindcss.com/) 4 + [Motion](https://motion.dev/) | 样式 & 动画 |
| [Zod](https://zod.dev/) | Schema 校验 |
| [Monaco Editor](https://microsoft.github.io/monaco-editor/) | JSON Schema 编辑器 |

---

## 项目结构

```
src/
├── main/                    # Electron 主进程
│   ├── index.ts             # 入口：窗口创建、引擎初始化、IPC 注册
│   ├── engine/
│   │   ├── WorkflowEngine.ts   # LangGraph StateGraph 构建 & 执行
│   │   ├── NodeExecutor.ts     # LLM 调用（流式 + 结构化输出）与校验
│   │   ├── GraphBuilder.ts     # WorkflowGraph → LangGraph StateGraph 编译
│   │   └── JsonCheckpointer.ts # JSON 文件 checkpoint 持久化
│   ├── ipc/
│   │   └── index.ts            # IPC 处理器注册
│   ├── storage/
│   │   └── WorkflowStore.ts    # 工作流 CRUD 持久化
│   ├── runs/
│   │   └── RunRegistry.ts      # 运行历史管理
│   └── startup.ts              # ~/.flowwright/ 数据目录初始化
├── renderer/                # Electron 渲染进程 (React)
│   └── src/
│       ├── App.tsx             # 根组件 & 布局
│       ├── components/
│       │   ├── WorkflowCanvas.tsx   # React Flow 图编辑器
│       │   ├── NodeConfigPanel.tsx  # 节点属性编辑面板（含 Monaco Editor）
│       │   ├── AgentNode.tsx        # 自定义 React Flow 节点（含状态 badge）
│       │   ├── LeftPanel.tsx        # 工作流列表侧边栏
│       │   ├── TopBar.tsx           # 顶部工具栏
│       │   ├── StatusBar.tsx        # 底部状态栏
│       │   ├── RunMonitor.tsx       # 执行进度监控
│       │   ├── HumanReviewPanel.tsx # 人工审核界面
│       │   └── HistoryPanel.tsx     # 运行历史列表
│       └── lib/
│           └── ipc.ts        # 类型化渲染端 IPC 客户端
└── shared/                  # 主进程 & 渲染进程共享
    ├── types.ts              # WorkflowGraph、NodeConfig 等类型定义
    └── ipc.ts                # IPC 通道名称 & 类型映射
```

---

## 开发计划

项目采用渐进式开发策略，每个 Phase 独立可交付。以下是各阶段概览：

### Phase 0 · 项目脚手架 ✅ 已完成

搭建可运行的 Electron + React + LangGraph 骨架，跑通单节点 LLM 调用。

| 任务 | 状态 |
|------|------|
| Electron + React + Vite 初始化 | ✅ |
| LangGraph.js 集成（DeepSeek） | ✅ |
| IPC 骨架（15 通道） | ✅ |
| 数据目录初始化（`~/.flowwright/`） | ✅ |
| SQLite Checkpoint | ⏭️ 推迟，改用 JSON 文件方案 |

### Phase 1 · 工作流核心 ✅ 已完成

可视化多节点工作流编辑与执行，支持打回重做和中断恢复。

| 任务 | 状态 |
|------|------|
| React Flow 画布（拖拽节点/连线/保存） | ✅ |
| 节点配置面板（label/model/prompt/Schema） | ✅ |
| Monaco JSON Schema 编辑器（语法提示 + 模板） | ✅ |
| 工作流执行引擎（流式输出 + IPC 推送） | ✅ |
| JSON Schema 硬约束验证（Zod + 自动重试） | ✅ |
| 多节点图执行 + 条件边路由（pass/reject） | ✅ |
| Human Review 节点（中断/通过/打回） | ✅ |
| 中断恢复 + Checkpoint 持久化（JsonCheckpointer） | ✅ |

### Phase 2 · 工具生态 🚧 未开始

**目标**：每个节点可独立配置供应商、MCP 工具、Skill，实现最小权限原则。

| 任务 | 状态 |
|------|------|
| 多供应商支持（OpenAI / Google / Ollama 等） | 🚧 |
| MCPManager（MCP Server 管理 + 工具发现） | 🚧 |
| 节点级 MCP 工具权限（按节点白名单注入） | 🚧 |
| Skill 注册表（扫描、解析、管理 Skill 文件） | 🚧 |
| Skill 自动选择机制（Agent 动态激活） | 🚧 |

### Phase 3 · RAG 引擎 🚧 未开始

**目标**：支持本地文档索引，Agent 可检索本地知识库。

| 任务 | 状态 |
|------|------|
| 文档索引（分块 + Embedding + LanceDB） | 🚧 |
| rag_search 工具注册 | 🚧 |
| RAG 节点类型 | 🚧 |
| 文档管理 UI | 🚧 |

### Phase 4 · 多 Workflow 并发 ⏳ 后续版本

**目标**：同时管理多个工作流 run，互不干扰。优先级低，MVP 后再排期。

| 任务 | 状态 |
|------|------|
| 并发 Run 管理（多路复用事件分发） | ⏳ |
| Token 用量统计与限额 | ⏳ |
| Run 对比视图 | ⏳ |
| 工作流模板库 | ⏳ |

---

## 里程碑总览

| 里程碑 | 完成标志 | 状态 |
|--------|---------|------|
| M0 骨架 | Electron 启动，单节点 Agent 跑通 | ✅ |
| M1 工作流 MVP | 多节点图执行、打回重做、中断恢复 | ✅ |
| M2 工具生态 | 多供应商 + MCP + Skill 自动选择 | 🚧 |
| M3 RAG | 本地文档检索，Agent 可调用 | 🚧 |
| M4 打磨 | 工作流模板、日志、Token 统计 | ⏳ |

---

## 开发命令

```bash
npm run dev        # 启动开发模式（热重载）
npm run build      # 生产构建 → out/
npm run preview    # 预览生产构建
npm run lint       # 运行 ESLint
```

## 许可证

[MIT](LICENSE)
