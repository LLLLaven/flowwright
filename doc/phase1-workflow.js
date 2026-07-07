export const meta = {
  name: 'flowwright-phase1',
  description: 'Implement FlowWright Phase 1: workflow canvas, streaming execution, human review, interrupt/resume',
  phases: [
    { title: '依赖安装', detail: '安装 @xyflow/react / @monaco-editor/react / zod / zod-from-json-schema' },
    { title: '引擎层', detail: 'WorkflowStore + NodeExecutor + WorkflowEngine 重构 + IPC 补全' },
    { title: 'Schema验证', detail: 'generateObject + 重试逻辑嵌入 NodeExecutor' },
    { title: 'UI层', detail: 'React Flow 画布 + AgentNode + NodeConfigPanel + Monaco 编辑器' },
    { title: '多节点路由', detail: 'GraphBuilder 条件边 + RunMonitor 事件订阅' },
    { title: '人工审核', detail: 'HumanReviewNode + HumanReviewPanel + interrupt/resume' },
    { title: '持久化', detail: 'JsonCheckpointer + RunRegistry + 历史列表 UI' },
  ],
}

// ─── Phase 1: 安装依赖 ───────────────────────────────────────────────────────
phase('依赖安装')

await agent(`
你在 D:/flowwright 目录下工作（Windows，bash shell 可用）。

安装以下 npm 依赖，使用 --save-exact 锁定版本：
  @xyflow/react
  @monaco-editor/react
  zod
  zod-from-json-schema

运行：
  cd D:/flowwright && npm install --save-exact @xyflow/react @monaco-editor/react zod zod-from-json-schema

安装完成后，从 package.json 输出这四个包的实际安装版本，确认无安装错误。
`, { label: '安装 npm 依赖' })

// ─── Phase 2: 引擎层 ─────────────────────────────────────────────────────────
phase('引擎层')

const [storeResult, executorResult] = await parallel([
  // 2a: WorkflowStore — 负责 workflow JSON 文件读写
  () => agent(`
你在 D:/flowwright 目录下工作。阅读以下文件后再编写新文件：
- src/shared/types.ts（WorkflowGraph 定义）
- src/main/startup.ts（数据目录路径规则）

创建文件 src/main/storage/WorkflowStore.ts：

\`\`\`typescript
import { readFile, writeFile, readdir, unlink } from 'fs/promises'
import { join } from 'path'
import type { WorkflowGraph } from '../../shared/types'

export class WorkflowStore {
  constructor(private dir: string) {}

  async save(graph: WorkflowGraph): Promise<void> {
    await writeFile(join(this.dir, graph.id + '.json'), JSON.stringify(graph, null, 2), 'utf-8')
  }

  async load(graphId: string): Promise<WorkflowGraph> {
    const raw = await readFile(join(this.dir, graphId + '.json'), 'utf-8')
    return JSON.parse(raw)
  }

  async list(): Promise<WorkflowGraph[]> {
    const files = (await readdir(this.dir)).filter(f => f.endsWith('.json'))
    return Promise.all(files.map(f => this.load(f.replace('.json', ''))))
  }

  async delete(graphId: string): Promise<void> {
    await unlink(join(this.dir, graphId + '.json'))
  }
}
\`\`\`

验证：TypeScript 类型无报错（运行 npm run lint 或 npx tsc --noEmit）。
输出：已创建文件的完整路径。
  `, { label: 'WorkflowStore' }),

  // 2b: NodeExecutor — 单节点 LLM 执行（流式）
  () => agent(`
你在 D:/flowwright 目录下工作。先阅读：
- src/main/engine/WorkflowEngine.ts（了解 DeepSeek 接入方式）
- src/shared/types.ts（NodeConfig, WorkflowState, WorkflowEvent）

创建文件 src/main/engine/NodeExecutor.ts，实现如下功能：
1. resolveModel(provider, model)：Phase 1 只支持 deepseek（通过 createAnthropic + DeepSeek baseURL），其他 provider 抛错
2. execute(node, state, emit)：
   - 若 node.outputSchema 不存在：用 streamText 流式执行，逐 chunk emit node:stream 事件
   - 若 node.outputSchema 存在：跳过（T1.5 阶段补充）
   - 返回 { output: string, passed: true }
3. emit 签名：(event: WorkflowEvent) => void

注意：
- 使用 streamText from 'ai'，createAnthropic from '@ai-sdk/anthropic'
- DEEPSEEK_API_KEY 从 process.env 读取
- DeepSeek baseURL = 'https://api.deepseek.com/anthropic'
- messages 类型转换：WorkflowState.messages as CoreMessage[]

创建完后运行 npx tsc --noEmit 验证无类型错误。
输出：已创建文件路径 + tsc 输出。
  `, { label: 'NodeExecutor（流式）' }),
])

// 2c: WorkflowEngine 重构（依赖 NodeExecutor）
await agent(`
你在 D:/flowwright 目录下工作。先阅读：
- src/main/engine/WorkflowEngine.ts（当前实现）
- src/main/engine/NodeExecutor.ts（刚创建）
- src/shared/types.ts（WorkflowGraph, WorkflowState, HumanInput）

重构 WorkflowEngine.ts，保留 runSingleNode()，新增：
1. 构造函数接收 checkpointer（类型先用 MemorySaver），内部新增：
   - activeRuns: Map<string, any>（存储 compiled graph 实例）
   - executor: NodeExecutor

2. async runGraph(graph: WorkflowGraph, runId: string, emit: (e: WorkflowEvent) => void): Promise<void>
   - 构建一个单节点验证图：先只把 graph.nodes[0] 运行起来（GraphBuilder 在下一阶段实现）
   - 临时实现：遍历 graph.nodes，对每个 agent 类型节点依次调用 this.executor.execute()
   - 完成后 emit({ type: 'workflow:done', runId })
   - 失败时 emit({ type: 'workflow:error', runId, error: String(e) })

3. async pause(runId: string): Promise<void>（暂存 runId，占位）
4. async resume(runId, input?, emit?)（占位，T1.7 实现）

重构后运行 npx tsc --noEmit 验证无类型错误。
输出：已修改文件路径 + tsc 结果。
`, { label: 'WorkflowEngine 重构' })

// 2d: IPC 补全
await agent(`
你在 D:/flowwright 目录下工作。先阅读：
- src/main/ipc/index.ts（当前 stub 实现）
- src/main/engine/WorkflowEngine.ts（重构后）
- src/main/storage/WorkflowStore.ts（刚创建）
- src/main/index.ts（了解 engine 和 win 的传入方式）

修改 src/main/ipc/index.ts：
1. registerIpcHandlers 签名改为 registerIpcHandlers(engine, store, win)
   - store: WorkflowStore
   - win: BrowserWindow（用于 emitRunEvent）
2. 补全以下 handler（其余保持 stub）：
   - workflow:run → store.load(graphId) → engine.runGraph(graph, runId, emit)，emit 调用 emitRunEvent(win, runId, event)，立即返回 runId
   - workflow:save → store.save(graph)
   - workflow:list → store.list()
   - workflow:pause → engine.pause(runId)
   - workflow:resume → engine.resume(runId, input, emit)
3. emitRunEvent 已有，无需修改

同步修改 src/main/index.ts，给 registerIpcHandlers 传入 store 和 win 实例。
WorkflowStore 构造时目录路径从 app.getPath('home') + '/.flowwright/workflows' 获取。

运行 npx tsc --noEmit 验证。输出已修改文件列表 + tsc 结果。
`, { label: 'IPC 补全' })

// ─── Phase 3: Schema 验证 ────────────────────────────────────────────────────
phase('Schema验证')

await agent(`
你在 D:/flowwright 目录下工作。先阅读：
- src/main/engine/NodeExecutor.ts

修改 NodeExecutor.ts，在 execute() 中补充 outputSchema 分支：

当 node.outputSchema 存在时：
1. 使用 zod-from-json-schema 将 outputSchema 转成 Zod schema（import { parseSchema } from 'zod-from-json-schema'）
2. 使用 generateObject from 'ai' 替代 streamText：
   \`\`\`typescript
   const { object } = await generateObject({ model, schema: zodSchema, messages, system })
   \`\`\`
3. 重试逻辑：用 for 循环最多 (node.maxRetries ?? 2) + 1 次，失败时将错误信息追加到 messages 后继续循环
4. 最终失败：emit node:rejected，返回 { output: null, passed: false, reason }
5. 成功：emit node:completed，返回 { output: object, passed: true }

当 node.outputSchema 不存在：保持原有 streamText 逻辑不变。

运行 npx tsc --noEmit 验证。输出修改摘要 + tsc 结果。
`, { label: 'Schema 验证 + 重试' })

// ─── Phase 4: UI 层（并行） ──────────────────────────────────────────────────
phase('UI层')

const [canvasResult, panelResult] = await parallel([
  // 4a: React Flow 画布 + AgentNode
  () => agent(`
你在 D:/flowwright 目录下工作。先阅读：
- src/shared/types.ts（NodeConfig, EdgeConfig, WorkflowGraph）
- src/renderer/src/lib/ipc.ts（ipc.workflow.* 调用方式）
- src/renderer/src/App.tsx（当前 UI 结构）

创建以下两个文件：

**src/renderer/src/components/AgentNode.tsx**
- 接收 React Flow NodeProps（data: NodeConfig + status 字段）
- 显示：label 文字 + 右上角状态 badge
- badge 颜色：idle=gray, running=blue(pulse 动画), completed=green, rejected=red, awaiting_human=orange
- 两个 Handle：左 target，右 source

**src/renderer/src/components/WorkflowCanvas.tsx**
- 使用 @xyflow/react 的 ReactFlow 组件
- useNodesState / useEdgesState 管理节点和边
- nodeTypes = { agent: AgentNode, human_review: AgentNode }（T1.7 前先复用）
- 工具栏（画布上方）：
  - "Add Node" 按钮：插入默认 agent 节点，id = crypto.randomUUID()，position 居中偏移
  - "Save" 按钮：将画布转换为 WorkflowGraph 后调用 ipc.workflow.save()
  - "Run" 按钮：调用 ipc.workflow.run(graph.id)，将返回的 runId 存入组件 state
- 键盘事件：Backspace/Delete 删除选中节点/边（React Flow 内置，通过 onKeyDown 或 deleteKeyCode prop）
- 加载：组件 mount 时调用 ipc.workflow.list() 获取第一个图（Demo 模式），无图时显示空画布

不使用内联样式超过必要，用 Tailwind 或简单 CSS class 即可。
运行 npx tsc --noEmit 验证。输出文件路径 + tsc 结果。
  `, { label: 'React Flow 画布 + AgentNode', phase: 'UI层' }),

  // 4b: NodeConfigPanel + Monaco
  () => agent(`
你在 D:/flowwright 目录下工作。先阅读：
- src/shared/types.ts（NodeConfig）
- src/renderer/src/lib/ipc.ts

创建 src/renderer/src/components/NodeConfigPanel.tsx：
- Props: { node: NodeConfig | null; onUpdate: (patch: Partial<NodeConfig>) => void; onClose: () => void }
- node 为 null 时渲染 null
- 字段渲染：
  - label → <input type="text">
  - provider → <select>（选项：deepseek, anthropic, openai）
  - model → <input type="text">
  - systemPrompt → <textarea rows={5}>
  - maxRetries → <input type="number" min={0} max={5}>
  - outputSchema → Monaco Editor（见下）
- 每个字段 onChange 调用 onUpdate({ fieldName: value })
- 顶部有关闭按钮，调用 onClose

Monaco Editor 集成（outputSchema 字段）：
\`\`\`tsx
import Editor from '@monaco-editor/react'
// height="200px", language="json", defaultLanguage="json"
// value = JSON.stringify(node.outputSchema ?? {}, null, 2)
// onChange: 解析 JSON 后调用 onUpdate({ outputSchema: parsed })，解析失败时不调用
\`\`\`

预置模板下拉（在 Monaco 上方）：
- 选项："无" / "代码文件" / "分析报告" / "任务清单"
- 选中后将对应 JSON Schema 填入编辑器

运行 npx tsc --noEmit 验证。输出文件路径 + tsc 结果。
  `, { label: 'NodeConfigPanel + Monaco', phase: 'UI层' }),
])

// 4c: App.tsx 集成（依赖画布和面板）
await agent(`
你在 D:/flowwright 目录下工作。先阅读：
- src/renderer/src/App.tsx（当前内容）
- src/renderer/src/components/WorkflowCanvas.tsx（刚创建）
- src/renderer/src/components/NodeConfigPanel.tsx（刚创建）

修改 App.tsx，集成：
1. 渲染 <WorkflowCanvas /> 作为主区域（全屏）
2. WorkflowCanvas 的 onNodeClick 触发显示 NodeConfigPanel（侧边栏）
3. NodeConfigPanel 的 onUpdate 更新对应节点的 data
4. NodeConfigPanel 的 onClose 关闭侧边栏

布局：左侧或右侧 280px 侧边栏（NodeConfigPanel），其余区域为画布。

运行 npm run lint 验证无 ESLint 错误。输出修改后 App.tsx 的关键变更。
`, { label: 'App.tsx 集成' })

// ─── Phase 5: 多节点路由 ─────────────────────────────────────────────────────
phase('多节点路由')

const [builderResult, monitorResult] = await parallel([
  // 5a: GraphBuilder
  () => agent(`
你在 D:/flowwright 目录下工作。先阅读：
- src/shared/types.ts（WorkflowGraph, EdgeConfig, WorkflowState）
- src/main/engine/NodeExecutor.ts
- src/main/engine/WorkflowEngine.ts
- 参考文件 D:/flowwright/langgraph-complete-guide.md 的第 5-6 章（StateGraph, addConditionalEdges）

创建 src/main/engine/GraphBuilder.ts：

\`\`\`typescript
import { StateGraph, START, END } from '@langchain/langgraph'
import type { WorkflowGraph, WorkflowState, WorkflowEvent } from '../../shared/types'
import type { NodeExecutor } from './NodeExecutor'
import type { BaseCheckpointSaver } from '@langchain/langgraph'

export function buildGraph(
  workflow: WorkflowGraph,
  executor: NodeExecutor,
  emit: (event: WorkflowEvent) => void,
  checkpointer: BaseCheckpointSaver,
) { ... }
\`\`\`

实现逻辑（参考 doc/phase1-plan.md 第 9 节的 GraphBuilder 详细代码）：
1. StateGraph channels 对应 WorkflowState 字段（messages reducer 追加，nodeOutputs reducer 合并，其余取最新值）
2. 遍历 workflow.nodes，对 agent 类型节点注册 makeAgentNode，human_review 节点先占位（返回空 state）
3. 遍历 workflow.edges，相同 source 有 pass/reject 边时用 addConditionalEdges，路由函数从 nodeOutputs[source].__passed 读取
4. 入边为空的节点连 START，出边为空的节点连 END
5. compile({ checkpointer }) 返回

修改 WorkflowEngine.ts 中的 runGraph()，将临时的遍历逻辑替换为调用 buildGraph()。

运行 npx tsc --noEmit 验证。输出 tsc 结果。
  `, { label: 'GraphBuilder', phase: '多节点路由' }),

  // 5b: RunMonitor
  () => agent(`
你在 D:/flowwright 目录下工作。先阅读：
- src/renderer/src/lib/ipc.ts（ipc.on.runEvent 用法）
- src/shared/types.ts（WorkflowEvent 联合类型）
- src/renderer/src/components/AgentNode.tsx

创建 src/renderer/src/components/RunMonitor.tsx：

功能：
- 订阅 ipc.on.runEvent
- 内部维护 nodeStatuses: Map<string, NodeStatus>（NodeStatus = 'idle'|'running'|'completed'|'rejected'|'awaiting_human'）
- 根据 WorkflowEvent 类型更新对应 nodeId 的状态：
  - node:started → 'running'
  - node:completed → 'completed'
  - node:rejected → 'rejected'
  - node:awaiting_human → 'awaiting_human'
- 通过 Context（RunMonitorContext）对外暴露 nodeStatuses

使用方式（供 WorkflowCanvas 消费）：
\`\`\`tsx
const { nodeStatuses } = useRunMonitor()
// 将 nodeStatuses.get(nodeId) 传入对应 AgentNode 的 data.status
\`\`\`

在 App.tsx 中用 <RunMonitorProvider> 包裹画布。

运行 npx tsc --noEmit 验证。输出 tsc 结果。
  `, { label: 'RunMonitor + Context', phase: '多节点路由' }),
])

// ─── Phase 6: 人工审核 ───────────────────────────────────────────────────────
phase('人工审核')

await agent(`
你在 D:/flowwright 目录下工作。先阅读：
- src/main/engine/GraphBuilder.ts（makeHumanReviewNode 占位）
- src/main/engine/WorkflowEngine.ts
- src/shared/types.ts（HumanInput, WorkflowEvent）
- src/renderer/src/components/RunMonitor.tsx
- D:/flowwright/langgraph-complete-guide.md 第 13 章（interrupt + Command 恢复）

**主进程端修改：**

1. 在 GraphBuilder.ts 中实现 makeHumanReviewNode：
   \`\`\`typescript
   import { interrupt } from '@langchain/langgraph'
   // 获取上游最后一个 nodeOutput 作为 deliverable
   // interrupt({ nodeId, deliverable }) 暂停
   // 返回值作为 humanInput，据此更新 nodeOutputs[node.id]
   \`\`\`

2. 在 WorkflowEngine.ts 中实现 resume()：
   \`\`\`typescript
   import { Command } from '@langchain/langgraph'
   // 从 activeRuns 获取 compiled graph
   // graph.invoke(new Command({ resume: input }), { configurable: { thread_id: runId } })
   \`\`\`

**渲染端：**

创建 src/renderer/src/components/HumanReviewPanel.tsx：
- Props: { runId: string; nodeId: string; deliverable: unknown; onClose: () => void }
- 展示 deliverable（JSON.stringify 格式化）
- "通过" 按钮：ipc.workflow.resume(runId, { decision: 'approve' })，然后 onClose()
- "打回" 按钮：展开 feedback textarea，提交时 ipc.workflow.resume(runId, { decision: 'reject', feedback })，然后 onClose()

在 RunMonitor 中检测到 node:awaiting_human 事件时，通过 Context 暴露 pendingReview 状态。
在 App.tsx 中：pendingReview 不为 null 时渲染 <HumanReviewPanel>。

运行 npx tsc --noEmit + npm run lint。输出验证结果。
`, { label: '人工审核节点 + 面板' })

// ─── Phase 7: 持久化 ─────────────────────────────────────────────────────────
phase('持久化')

const [checkpointerResult, registryResult] = await parallel([
  // 7a: JsonCheckpointer
  () => agent(`
你在 D:/flowwright 目录下工作。先阅读：
- D:/flowwright/langgraph-complete-guide.md 第 9 章（Checkpointers 接口）
- src/main/engine/WorkflowEngine.ts

创建 src/main/engine/JsonCheckpointer.ts，实现 LangGraph BaseCheckpointSaver 接口：

存储格式：~/.flowwright/checkpoints/{threadId}/{checkpointId}.json
每个文件包含 { checkpoint, metadata, pendingWrites }

需要实现的方法：
- getTuple(config): 读取最新 checkpoint（无 checkpoint_id 时读最新，有时读指定）
- list(config): 遍历 threadId 目录，按时间倒序 yield CheckpointTuple
- put(config, checkpoint, metadata, newVersions): 写入文件，返回带 checkpoint_id 的 config
- putWrites(config, writes, taskId): 追加 pending writes 到当前 checkpoint 文件

注意：
- BaseCheckpointSaver 从 '@langchain/langgraph' 导入（或 '@langchain/langgraph-checkpoint'）
- checkpoint_id 在 config.configurable.checkpoint_id，thread_id 在 config.configurable.thread_id
- 文件名用 checkpoint_id，目录名用 thread_id

修改 WorkflowEngine.ts 构造函数：
\`\`\`typescript
constructor(checkpointsDir: string) {
  this.checkpointer = new JsonCheckpointer(checkpointsDir)
  this.executor = new NodeExecutor()
}
\`\`\`

修改 src/main/index.ts 传入 checkpointsDir（app.getPath('home') + '/.flowwright/checkpoints'）。

运行 npx tsc --noEmit 验证。输出 tsc 结果。
  `, { label: 'JsonCheckpointer', phase: '持久化' }),

  // 7b: RunRegistry
  () => agent(`
你在 D:/flowwright 目录下工作。先阅读：
- src/shared/types.ts（RunRecord 类型）
- src/main/storage/WorkflowStore.ts（参考文件读写模式）

创建 src/main/runs/RunRegistry.ts：
\`\`\`typescript
// 存储路径：~/.flowwright/runs/{runId}.json
export class RunRegistry {
  constructor(private dir: string) {}
  async create(runId: string, graphId: string): Promise<RunRecord>
  async update(runId: string, patch: Partial<RunRecord>): Promise<void>
  async list(): Promise<RunRecord[]>   // 按 startedAt 倒序排列
  async get(runId: string): Promise<RunRecord | null>
}
\`\`\`

创建完后：
1. 修改 src/main/ipc/index.ts 的 registerIpcHandlers，增加 registry 参数，在 workflow:run 前调用 registry.create()，在 workflow:list handler 中同时返回 runs（或新增 workflow:list-runs handler，类型已有 WORKFLOW_LIST 可复用）
2. 修改 src/main/index.ts 实例化 RunRegistry 并传入

运行 npx tsc --noEmit 验证。输出 tsc 结果。
  `, { label: 'RunRegistry', phase: '持久化' }),
])

// 7c: 历史列表 UI
await agent(`
你在 D:/flowwright 目录下工作。先阅读：
- src/renderer/src/App.tsx（当前结构）
- src/renderer/src/lib/ipc.ts（ipc.workflow.list / ipc.workflow.resume）
- src/shared/types.ts（RunRecord）

在 App.tsx 中增加"历史"标签页（在画布主区域上方或侧边添加 Tab）：

历史面板内容：
- 调用 ipc.workflow.list() 获取 RunRecord 列表（若 list 返回 WorkflowGraph[]，新增 IPC 或复用 workflow:list 扩展为同时返回 runs）
- 每行显示：runId（截取后 8 位）/ graphId / status badge / startedAt
- status badge 颜色：running=blue, paused=orange, completed=green, error=red, aborted=gray
- paused 状态行末尾显示"恢复"按钮，点击调用 ipc.workflow.resume(runId)
- 列表每 5 秒刷新一次（setInterval，组件卸载时 clearInterval）

验证：
1. 运行 npx tsc --noEmit
2. 运行 npm run lint

输出：所有修改文件列表 + 验证结果。
`, { label: '运行历史 UI' })

// ─── 最终验收 ────────────────────────────────────────────────────────────────
phase('验收')

await agent(`
你在 D:/flowwright 目录下工作。

执行完整验收检查：

1. 运行 npx tsc --noEmit，输出结果
2. 运行 npm run lint，输出结果
3. 检查以下文件是否存在（用 ls 验证）：
   - src/main/engine/NodeExecutor.ts
   - src/main/engine/GraphBuilder.ts
   - src/main/engine/JsonCheckpointer.ts
   - src/main/storage/WorkflowStore.ts
   - src/main/runs/RunRegistry.ts
   - src/renderer/src/components/WorkflowCanvas.tsx
   - src/renderer/src/components/AgentNode.tsx
   - src/renderer/src/components/NodeConfigPanel.tsx
   - src/renderer/src/components/RunMonitor.tsx
   - src/renderer/src/components/HumanReviewPanel.tsx
4. 汇总：哪些文件已创建，哪些 tsc/lint 错误需要修复

输出完整的验收报告，格式：
✅ / ❌ 每个检查项结果
未修复的错误列表（如有）
`, { label: '最终验收' })
