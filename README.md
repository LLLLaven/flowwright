# FlowWright

**本地桌面 AI Agent 工具，专为长链任务编排设计。**

FlowWright 是一款基于 [Electron](https://www.electronjs.org/) + [React Flow](https://reactflow.dev/) 的桌面应用，可让你通过可视化方式构建和执行 AI 驱动的工作流图 —— 包括 LLM 调用链、条件分支、JSON Schema 校验以及人工审核节点。

## 功能特性

- 🧩 **可视化工作流编辑器** — 基于 React Flow 的拖拽式节点/边编辑
- 🤖 **多节点执行引擎** — 使用 LangGraph.js 运行 Agent 节点链
- 🔀 **条件分支** — 基于 LLM 输出结果的 pass/reject 边路由
- ✅ **JSON Schema 校验** — 使用 Zod 对节点输出进行结构化校验
- 👤 **人工审核节点** — 支持中断/恢复工作流进行人工审批
- 💬 **丰富的 LLM 集成** — 通过 Anthropic 兼容 API 接入 DeepSeek

## 系统架构

```
主进程 (Node.js)               渲染进程 (React)
├── WorkflowEngine              ├── WorkflowCanvas (React Flow)
├── NodeExecutor                ├── NodeConfigPanel
├── IPC 处理器                  ├── LeftPanel / StatusBar / TopBar
├── WorkflowStore (存储层)      └── lib/ipc.ts (类型化 IPC 客户端)
└── shared/types.ts ←──────────→ shared/types.ts
```

- **主进程** 是真正的后端 —— LangGraph、LLM 调用、文件 I/O 全部在此运行
- **渲染进程** 仅负责 UI，通过 15 个类型安全的 IPC 通道与主进程通信
- **Graph ↔ State 分离** — WorkflowGraph（持久化 JSON）与 WorkflowState（LangGraph 运行时状态）分开存储

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

## 技术栈

| 技术 | 用途 |
|------|------|
| [Electron](https://electronjs.org/) + [electron-vite](https://electron-vite.org/) | 桌面端框架 & 构建工具 |
| [React](https://react.dev/) 19 + [TypeScript](https://www.typescriptlang.org/) | 前端 UI |
| [React Flow](https://reactflow.dev/) (`@xyflow/react`) | 画布图编辑器 |
| [LangGraph.js](https://langchain-ai.github.io/langgraphjs/) | 工作流图执行引擎 |
| [Vercel AI SDK](https://sdk.vercel.ai/) (`ai`) | LLM 客户端抽象层 |
| [Tailwind CSS](https://tailwindcss.com/) 4 + [Motion](https://motion.dev/) | 样式 & 动画 |
| [Zod](https://zod.dev/) 4 | Schema 校验 |

## 项目结构

```
src/
├── main/                    # Electron 主进程
│   ├── index.ts             # 入口：窗口创建、引擎初始化、IPC 注册
│   ├── engine/
│   │   ├── WorkflowEngine.ts   # LangGraph StateGraph 构建器
│   │   └── NodeExecutor.ts     # LLM 调用与校验
│   ├── ipc/
│   │   └── index.ts            # IPC 处理器注册
│   ├── storage/
│   │   └── WorkflowStore.ts    # 工作流 CRUD 持久化
│   └── startup.ts              # ~/.flowwright/ 数据目录初始化
├── renderer/                # Electron 渲染进程 (React)
│   └── src/
│       ├── App.tsx             # 根组件 & 布局
│       ├── components/
│       │   ├── WorkflowCanvas.tsx   # React Flow 图编辑器
│       │   ├── NodeConfigPanel.tsx  # 节点属性编辑面板
│       │   ├── AgentNode.tsx        # 自定义 React Flow 节点
│       │   ├── LeftPanel.tsx        # 工作流列表侧边栏
│       │   ├── TopBar.tsx           # 顶部工具栏
│       │   ├── StatusBar.tsx        # 底部状态栏
│       │   ├── RunMonitor.tsx       # 执行进度监控
│       │   └── HumanReviewPanel.tsx # 人工审核界面
│       └── lib/
│           └── ipc.ts        # 类型化渲染端 IPC 客户端
└── shared/                  # 主进程 & 渲染进程共享
    ├── types.ts              # WorkflowGraph、NodeConfig 等类型定义
    └── ipc.ts                # IPC 通道名称 & 类型映射
```

## 开发命令

```bash
npm run dev        # 启动开发模式（热重载）
npm run build      # 生产构建 → out/
npm run preview    # 预览生产构建
npm run lint       # 运行 ESLint
```

## 许可证

[MIT](LICENSE)
