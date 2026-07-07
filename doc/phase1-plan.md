# FlowWright Phase 1 详细开发计划

> 文档版本：v1.0 · 2026-06-24
> 基于：Phase 0 验收完成状态
> 目标：多节点工作流画布、流式执行、打回重做、人工审核、中断恢复

---

## 1. 现状与起点

### Phase 0 交付物（已验证）

| 文件 | 状态 |
|------|------|
| `src/main/engine/WorkflowEngine.ts` | 只有 `runSingleNode()`，硬编码 prompt，无 graph 参数 |
| `src/main/ipc/index.ts` | `workflow:run` 真实调用引擎；其余 13 个 handler 均为 stub |
| `src/shared/types.ts` | `WorkflowGraph` / `NodeConfig` / `EdgeConfig` / `WorkflowState` / `WorkflowEvent` 完整定义 |
| `src/shared/ipc.ts` | 15 个 IPC 通道全部定义，类型安全 |
| `src/renderer/src/lib/ipc.ts` | renderer 端 IPC 客户端全部定义 |

### Phase 1 需要解决的核心问题

1. **引擎**：`WorkflowEngine` 只能运行单节点，不接受 `WorkflowGraph`
2. **流式**：当前用 `generateText`（等待完整结果），需改为 `streamText` + IPC 推送
3. **UI**：renderer 只有空白页面，没有画布
4. **持久化**：`MemorySaver` 进程退出即丢失，interrupt/resume 不能跨 App 重启


---

## 2. 新增文件一览

```
src/
├── main/
│   ├── engine/
│   │   ├── WorkflowEngine.ts     ← 重构（接受 WorkflowGraph，流式，interrupt）
│   │   ├── NodeExecutor.ts       ← 新建（单节点 LLM 执行 + schema 验证）
│   │   ├── GraphBuilder.ts       ← 新建（WorkflowGraph → LangGraph StateGraph）
│   │   └── JsonCheckpointer.ts   ← 新建（JSON 文件持久化 checkpoint）
│   ├── ipc/
│   │   └── index.ts              ← 补全 workflow:save/load/list/pause/resume
│   ├── storage/
│   │   └── WorkflowStore.ts      ← 新建（workflow JSON 文件读写）
│   └── runs/
│       └── RunRegistry.ts        ← 新建（运行历史 + 状态管理）
├── renderer/src/
│   ├── components/
│   │   ├── WorkflowCanvas.tsx    ← 新建（React Flow 画布）
│   │   ├── AgentNode.tsx         ← 新建（自定义节点 + 状态 badge）
│   │   ├── NodeConfigPanel.tsx   ← 新建（节点配置侧边栏）
│   │   ├── RunMonitor.tsx        ← 新建（实时执行状态订阅）
│   │   └── HumanReviewPanel.tsx  ← 新建（人工审核弹窗）
│   └── App.tsx                   ← 修改（集成画布 + 面板）
└── shared/
    └── types.ts                  ← 扩展 RunRecord、CheckpointData 类型
```

---

## 3. 类型扩展（shared/types.ts）

在现有类型基础上新增：

```typescript
// 运行记录（持久化到 ~/.flowwright/runs/{runId}.json）
export interface RunRecord {
  runId: string
  graphId: string
  status: 'running' | 'paused' | 'completed' | 'error' | 'aborted'
  threadId: string          // LangGraph thread_id，与 runId 相同
  startedAt: string         // ISO 8601
  updatedAt: string
  error?: string
}

// WorkflowGraph 存储时加 id 字段（已有），补充 createdAt
export interface WorkflowGraphMeta {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}
```

---

## 4. T1.1 — React Flow 画布基础

**依赖**：`@xyflow/react`（安装时 `--save-exact`）

**文件**：`src/renderer/src/components/WorkflowCanvas.tsx`

### 实现要点

```tsx
// 核心状态：nodes + edges 驱动 React Flow
const [nodes, setNodes, onNodesChange] = useNodesState<NodeConfig[]>([])
const [edges, setEdges, onEdgesChange] = useEdgesState<EdgeConfig[]>([])

// 自定义节点类型注册（避免每次渲染重建）
const nodeTypes = useMemo(() => ({ agent: AgentNode, human_review: HumanReviewNode }), [])

// 保存：WorkflowGraph 序列化后通过 ipc.workflow.save() 写入磁盘
// 加载：应用启动时 ipc.workflow.list() 拉列表，选中后 load
```

**工具栏操作**：
- `+` 按钮：`addNode()` 在画布中心插入默认 `agent` 节点，id 用 `crypto.randomUUID()`
- 删除键（`Backspace`/`Delete`）：删除选中节点/边
- `Save`：调用 `ipc.workflow.save(currentGraph)`
- `Run`：调用 `ipc.workflow.run(graph.id)` → 返回 `runId`

**AgentNode 组件**（`AgentNode.tsx`）：

```tsx
// 显示：label + 状态 badge（idle/running/completed/rejected/awaiting_human）
// 颜色：idle=灰 running=蓝（动画）completed=绿 rejected=红 awaiting=橙
// Handle：左侧 target，右侧 source（React Flow 标准）
```

**验收**：拖拽创建节点、连线、Backspace 删除、Save 后重启 App 图仍在。

---

## 5. T1.2 — 节点配置面板

**文件**：`src/renderer/src/components/NodeConfigPanel.tsx`

### 实现要点

- 点击节点触发 `onNodeClick`，通过 React 状态 `selectedNodeId` 控制面板显隐
- 面板直接修改 `nodes` 数组中对应节点的 `data`（React Flow 受控模式）
- **不单独调用保存**：面板修改只更新本地 state，用户点 Save 才持久化

```tsx
// 字段映射（对应 NodeConfig）
label          → <input type="text">
provider       → <select>（deepseek / anthropic / openai，可手动输入）
model          → <input type="text">
systemPrompt   → <textarea rows={6}>
maxRetries     → <input type="number" min={0} max={5}>
outputSchema   → Monaco Editor（T1.3 嵌入）
```

**验收**：修改 label → 节点 badge 文字实时更新；保存后重载配置保留。

---

## 6. T1.3 — Monaco JSON Schema 编辑器

**依赖**：`@monaco-editor/react`

**嵌入位置**：`NodeConfigPanel` 底部 `outputSchema` 字段区域

### 实现要点

```tsx
import Editor from '@monaco-editor/react'

// 配置 JSON Schema 语法校验
monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
  validate: true,
  schemas: [{
    uri: 'http://json-schema.org/draft-07/schema',
    fileMatch: ['*'],
    schema: { /* draft-07 meta-schema */ },
  }]
})

// 预置模板下拉
const TEMPLATES = {
  'code_file':    { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
  'analysis':     { type: 'object', properties: { summary: { type: 'string' }, findings: { type: 'array', items: { type: 'string' } } }, required: ['summary'] },
  'task_list':    { type: 'object', properties: { tasks: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, done: { type: 'boolean' } } } } }, required: ['tasks'] },
}
```

**验收**：输入非法 JSON 时红色波浪线；选择模板后填充到编辑器。


---

## 7. T1.4 — 工作流执行引擎重构

这是 Phase 1 的核心重构，`WorkflowEngine` 从单节点演示变为真正的执行引擎。

### 7.1 WorkflowStore（存储层）

**文件**：`src/main/storage/WorkflowStore.ts`

```typescript
// 存储路径：~/.flowwright/workflows/{graphId}.json
export class WorkflowStore {
  constructor(private dir: string) {}            // dir = ~/.flowwright/workflows
  async save(graph: WorkflowGraph): Promise<void>
  async load(graphId: string): Promise<WorkflowGraph>
  async list(): Promise<WorkflowGraph[]>         // 读取所有 JSON 文件
  async delete(graphId: string): Promise<void>
}
```

### 7.2 NodeExecutor（节点执行层）

**文件**：`src/main/engine/NodeExecutor.ts`

```typescript
// 职责：单节点 LLM 调用 + 流式输出 + schema 验证（T1.5 填充）
export class NodeExecutor {
  async execute(
    node: NodeConfig,
    state: WorkflowState,
    emit: (event: WorkflowEvent) => void,  // 回调 → IPC bridge
  ): Promise<{ output: unknown; passed: boolean; reason?: string }>
}
```

**流式实现**（使用 Vercel AI SDK `streamText`）：

```typescript
const { textStream } = streamText({
  model: resolveModel(node.provider, node.model),
  messages: state.messages as CoreMessage[],
  system: node.systemPrompt,
})

emit({ type: 'node:stream', nodeId: node.id, chunk: '' }) // started
for await (const chunk of textStream) {
  emit({ type: 'node:stream', nodeId: node.id, chunk })
}
```

**Provider 解析**（Phase 1 只支持 deepseek，T2.1 扩展）：

```typescript
function resolveModel(provider = 'deepseek', model = 'deepseek-v4-flash') {
  if (provider === 'deepseek' || provider === 'anthropic-compat') {
    return createAnthropic({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com/anthropic' })(model)
  }
  throw new Error(`unsupported provider: ${provider}`)
}
```

### 7.3 WorkflowEngine 重构

**文件**：`src/main/engine/WorkflowEngine.ts`（覆盖重写）

新增方法，`runSingleNode` 保留（向后兼容测试）：

```typescript
// 主入口：接受 WorkflowGraph，返回 runId
async runGraph(
  graph: WorkflowGraph,
  runId: string,
  emit: (event: WorkflowEvent) => void,
): Promise<void>

// 中断
async pause(runId: string): Promise<void>

// 恢复（携带 humanInput）
async resume(runId: string, input?: HumanInput, emit?: (event: WorkflowEvent) => void): Promise<void>
```

内部维护：

```typescript
// 运行中的图实例（runId → compiled graph）
private activeRuns = new Map<string, CompiledStateGraph>()
// checkpointer（T1.8 切换为 JsonCheckpointer）
private checkpointer: MemorySaver | JsonCheckpointer
```

### 7.4 IPC 补全

**文件**：`src/main/ipc/index.ts`

```typescript
// workflow:run 改为：加载图 → 启动执行 → 通过 emitRunEvent 推流式事件
ipcMain.handle(IPC.WORKFLOW_RUN, async (_e, graphId: string) => {
  const graph = await store.load(graphId)
  const runId = 'run-' + Date.now()
  const emit = (event: WorkflowEvent) => emitRunEvent(win, runId, event)
  engine.runGraph(graph, runId, emit).catch(console.error)
  return runId   // 立即返回 runId，异步推送事件
})

ipcMain.handle(IPC.WORKFLOW_SAVE,   async (_e, graph) => store.save(graph))
ipcMain.handle(IPC.WORKFLOW_LOAD,   async (_e, graphJson) => JSON.parse(graphJson))
ipcMain.handle(IPC.WORKFLOW_LIST,   async () => store.list())
ipcMain.handle(IPC.WORKFLOW_PAUSE,  async (_e, runId) => engine.pause(runId))
ipcMain.handle(IPC.WORKFLOW_RESUME, async (_e, runId, input) => {
  const emit = (event: WorkflowEvent) => emitRunEvent(win, runId, event)
  engine.resume(runId, input, emit).catch(console.error)
})
```

### 7.5 RunMonitor 组件

**文件**：`src/renderer/src/components/RunMonitor.tsx`

```tsx
// 订阅 run:event，维护 nodeStates: Map<nodeId, 'idle'|'running'|'completed'|'rejected'|'awaiting_human'>
// 通过 Context 或 prop 传给 WorkflowCanvas，驱动 AgentNode 的 badge 颜色
useEffect(() => {
  ipc.on.runEvent((runId, event) => dispatch(event))
}, [])
```

**验收**：单节点执行时，画布节点 badge 从 idle → running（显示流式文字片段）→ completed。

---

## 8. T1.5 — JSON Schema 硬约束验证

**依赖**：`zod` + `zod-from-json-schema`（或 `json-schema-to-zod`，选一即可）

**嵌入位置**：`NodeExecutor.execute()` 末尾

### 实现要点

当节点有 `outputSchema` 时，改用 Vercel AI SDK `generateObject`（结构化输出）代替 `streamText`：

```typescript
if (node.outputSchema) {
  const schema = jsonSchemaToZod(node.outputSchema)  // 转成 Zod schema
  const { object } = await generateObject({
    model: resolveModel(node.provider, node.model),
    schema,
    messages: state.messages as CoreMessage[],
    system: node.systemPrompt,
  })
  // 验证通过直接返回 object
  return { output: object, passed: true }
}
```

**重试逻辑**（`generateObject` 验证失败时 Vercel SDK 已内置重试；手动重试用于兜底）：

```typescript
// 最多 node.maxRetries 次（默认 2）
for (let attempt = 0; attempt <= (node.maxRetries ?? 2); attempt++) {
  try {
    const { object } = await generateObject({ ... })
    return { output: object, passed: true }
  } catch (e) {
    if (attempt === node.maxRetries) {
      emit({ type: 'node:rejected', nodeId: node.id, reason: String(e) })
      return { output: null, passed: false, reason: String(e) }
    }
    // 将错误附加到 messages，下次重试时 agent 会知道
    state.messages.push({ role: 'user', content: `Validation failed: ${e}. Please retry.` })
  }
}
```

**验收**：设置错误 schema（如要求 `required: ['nonexistent']`），连续失败 maxRetries 次后节点变红。

---

## 9. T1.6 — 多节点图执行 + 条件边路由

### GraphBuilder

**文件**：`src/main/engine/GraphBuilder.ts`

```typescript
import { StateGraph, START, END } from '@langchain/langgraph'

export function buildGraph(
  workflow: WorkflowGraph,
  executor: NodeExecutor,
  emit: (event: WorkflowEvent) => void,
  checkpointer: BaseCheckpointSaver,
): CompiledStateGraph {
  
  const graph = new StateGraph<WorkflowState>({
    channels: {
      messages:    { reducer: (a, b) => [...a, ...b], default: () => [] },
      nodeOutputs: { reducer: (a, b) => ({ ...a, ...b }), default: () => () },
      currentNodeId: { reducer: (_, b) => b, default: () => '' },
      retryCount:  { reducer: (_, b) => b, default: () => 0 },
      humanFeedback: { reducer: (_, b) => b, default: () => undefined },
      runId: { reducer: (_, b) => b, default: () => '' },
    }
  })

  // 注册所有节点
  for (const node of workflow.nodes) {
    if (node.type === 'human_review') {
      graph.addNode(node.id, makeHumanReviewNode(node, emit))
    } else {
      graph.addNode(node.id, makeAgentNode(node, executor, emit))
    }
  }

  // 注册边
  const hasIncoming = new Set(workflow.edges.map(e => e.target))
  const hasOutgoing = new Set(workflow.edges.map(e => e.source))

  // START → 没有入边的节点
  for (const node of workflow.nodes) {
    if (!hasIncoming.has(node.id)) graph.addEdge(START, node.id)
  }

  // 条件边：同一 source 有 pass + reject 两条边 → addConditionalEdges
  const edgesBySource = new Map<string, EdgeConfig[]>()
  for (const edge of workflow.edges) {
    const arr = edgesBySource.get(edge.source) ?? []
    arr.push(edge)
    edgesBySource.set(edge.source, arr)
  }

  for (const [source, edges] of edgesBySource) {
    const hasCondition = edges.some(e => e.condition === 'pass' || e.condition === 'reject')
    if (hasCondition) {
      graph.addConditionalEdges(source, (state) => {
        const out = state.nodeOutputs[source]
        return (out as any)?.__passed ? 'pass' : 'reject'
      }, Object.fromEntries(edges.map(e => [e.condition ?? 'default', e.target ?? END])))
    } else {
      for (const edge of edges) graph.addEdge(source, edge.target ?? END)
    }
  }

  // 没有出边的节点 → END
  for (const node of workflow.nodes) {
    if (!hasOutgoing.has(node.id)) graph.addEdge(node.id, END)
  }

  return graph.compile({ checkpointer })
}
```

**AgentNode 函数**（Graph 内部节点函数，非 React 组件）：

```typescript
function makeAgentNode(node: NodeConfig, executor: NodeExecutor, emit: (e: WorkflowEvent) => void) {
  return async (state: WorkflowState) => {
    emit({ type: 'node:started', nodeId: node.id })
    const { output, passed, reason } = await executor.execute(node, state, emit)
    if (!passed) return { nodeOutputs: { [node.id]: { __passed: false } } }
    emit({ type: 'node:completed', nodeId: node.id, output })
    return {
      nodeOutputs: { [node.id]: { ...output as object, __passed: true } },
      messages: [{ role: 'assistant' as const, content: JSON.stringify(output) }],
    }
  }
}
```

**验收**：三节点链式工作流（A → B → C）顺序执行，每个节点完成后下一个自动开始。

---

## 10. T1.7 — Human Review 节点

### 新节点类型

`NodeConfig.type = 'human_review'` 不调用 LLM，只触发 `interrupt()`：

```typescript
import { interrupt } from '@langchain/langgraph'

function makeHumanReviewNode(node: NodeConfig, emit: (e: WorkflowEvent) => void) {
  return async (state: WorkflowState) => {
    // 取上游节点的输出作为 deliverable
    const deliverable = Object.values(state.nodeOutputs).at(-1)
    emit({ type: 'node:awaiting_human', nodeId: node.id, deliverable })

    // interrupt() 暂停图执行，等待 Command({ resume }) 恢复
    const humanInput: HumanInput = interrupt({ nodeId: node.id, deliverable })

    if (humanInput.decision === 'reject') {
      return {
        humanFeedback: humanInput.feedback,
        nodeOutputs: { [node.id]: { __passed: false, feedback: humanInput.feedback } },
      }
    }
    return { nodeOutputs: { [node.id]: { __passed: true } } }
  }
}
```

### HumanReviewPanel 组件

**文件**：`src/renderer/src/components/HumanReviewPanel.tsx`

- 由 `RunMonitor` 检测到 `node:awaiting_human` 事件后弹出
- 展示 `deliverable` 内容（JSON 格式化显示）
- 操作按钮：通过 / 打回
- 打回时显示 feedback textarea
- 点击"通过"：`ipc.workflow.resume(runId, { decision: 'approve' })`
- 点击"打回"：`ipc.workflow.resume(runId, { decision: 'reject', feedback })`

**resume IPC 实现**：

```typescript
// engine 收到 resume 后用 LangGraph Command 恢复
import { Command } from '@langchain/langgraph'

async resume(runId: string, input?: HumanInput, emit?: ...) {
  const compiled = this.activeRuns.get(runId)
  if (!compiled) throw new Error('run not found: ' + runId)
  compiled.invoke(
    new Command({ resume: input }),
    { configurable: { thread_id: runId } }
  ).then(() => emit?.({ type: 'workflow:done', runId }))
   .catch(e => emit?.({ type: 'workflow:error', runId, error: String(e) }))
}
```

**验收**：工作流在 human_review 节点暂停，弹出面板，点通过后继续执行。

---

## 11. T1.8 — 中断恢复 + Checkpoint 持久化

### 持久化方案

**问题**：`better-sqlite3` 需要原生编译，Node v24 + 缺少 VS Build Tools 无法使用。

**决策：实现 `JsonCheckpointer`**（纯 JS，无原生依赖）

**文件**：`src/main/engine/JsonCheckpointer.ts`

```typescript
import { BaseCheckpointSaver, type Checkpoint, type CheckpointMetadata, type RunnableConfig } from '@langchain/langgraph'
import { readFile, writeFile, readdir } from 'fs/promises'
import { join } from 'path'

// 存储路径：~/.flowwright/checkpoints/{threadId}/{checkpointId}.json
export class JsonCheckpointer extends BaseCheckpointSaver {
  constructor(private dir: string) { super() }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> { ... }
  async *list(config: RunnableConfig): AsyncGenerator<CheckpointTuple> { ... }
  async put(config, checkpoint: Checkpoint, metadata: CheckpointMetadata, newVersions): Promise<RunnableConfig> { ... }
  async putWrites(config, writes, taskId): Promise<void> { ... }
}
```

**替换时机**：`WorkflowEngine` 构造函数中，将 `new MemorySaver()` 替换为 `new JsonCheckpointer(checkpointsDir)`。

### RunRegistry（运行历史）

**文件**：`src/main/runs/RunRegistry.ts`

```typescript
// 存储：~/.flowwright/runs/{runId}.json
export class RunRegistry {
  async create(runId: string, graphId: string): Promise<RunRecord>
  async update(runId: string, patch: Partial<RunRecord>): Promise<void>
  async list(): Promise<RunRecord[]>          // 按 startedAt 倒序
  async get(runId: string): Promise<RunRecord | null>
}
```

**IPC 集成**：
- `workflow:run` 执行前调用 `registry.create()`
- 节点事件流中根据 `workflow:done` / `workflow:error` 更新状态
- `workflow:pause` 调用 `registry.update(runId, { status: 'paused' })`
- `workflow:list` 同时返回 `WorkflowGraph[]` + `RunRecord[]`（或分开两个 IPC）

### 前端运行历史

- `App.tsx` 增加"历史"标签页
- 列表：runId / 所属 workflow / 状态 badge / 开始时间
- 状态为 `paused` 的 run 显示"恢复"按钮，点击触发 `ipc.workflow.resume(runId)`

**验收**：关闭 App 重启后，paused 的 run 出现在历史列表，点"恢复"后工作流从中断处继续。

---

## 12. 任务依赖与推荐执行顺序

```
T1.1 React Flow 画布
  └─ T1.2 节点配置面板
       └─ T1.3 Monaco 编辑器（嵌入 T1.2）

T1.4a WorkflowStore + WorkflowEngine 重构（引擎层）
  └─ T1.4b IPC 补全 + RunMonitor
       └─ T1.5 Schema 验证（NodeExecutor 扩展）
            └─ T1.6 多节点 + 条件边（GraphBuilder）
                 └─ T1.7 Human Review 节点
                      └─ T1.8 JsonCheckpointer + RunRegistry

并行窗口：T1.1~T1.3（UI）与 T1.4a~T1.5（引擎）可并行推进，在 T1.6 合并。
```

**推荐顺序（串行开发时）**：

| 顺序 | 任务 | 预计时长 | 验收点 |
|------|------|---------|--------|
| 1 | T1.4a WorkflowStore + Engine 重构 | 1.5 天 | `workflow:save/load/list` 能读写 JSON 文件 |
| 2 | T1.4b IPC 补全 + RunMonitor | 1 天 | 单节点流式执行，画布 badge 变色 |
| 3 | T1.1 React Flow 画布 | 1 天 | 拖拽建图，Save/Load |
| 4 | T1.2 + T1.3 配置面板 + Monaco | 1.5 天 | 修改节点配置持久化 |
| 5 | T1.5 Schema 验证 | 0.5 天 | 错误 schema 触发打回 |
| 6 | T1.6 多节点路由 | 1 天 | 三节点链顺序执行 |
| 7 | T1.7 Human Review | 1 天 | 暂停 + 弹窗 + 恢复 |
| 8 | T1.8 持久化 + 历史 | 2 天 | 重启 App 后恢复 paused run |

**总计估算**：10.5 天（含调试 buffer 为 12-14 天）

---

## 13. 安装依赖

```bash
# 在 D:/flowwright 目录执行
npm install --save-exact @xyflow/react@12.3.6
npm install --save-exact @monaco-editor/react@4.7.0
npm install --save-exact zod@3.25.51
npm install --save-exact zod-from-json-schema@0.6.1
```

> `better-sqlite3` 继续推迟，`JsonCheckpointer` 替代。

---

## 14. 验收清单（Phase 1 完成标准）

- [ ] 画布可创建 `agent` 和 `human_review` 节点，连线，保存，重载
- [ ] 节点配置面板：修改 label/model/systemPrompt/outputSchema 持久化
- [ ] Monaco 编辑器：非法 JSON 有错误提示，模板下拉可用
- [ ] 单节点 agent 执行：流式输出实时显示，节点 badge 状态正确
- [ ] Schema 验证：有 `outputSchema` 的节点使用结构化输出；失败超 maxRetries 后进入 rejected 状态
- [ ] 三节点链式工作流顺序执行，条件边按 pass/reject 路由
- [ ] Human Review 节点：工作流暂停，弹窗展示交付物，通过/打回后继续
- [ ] 中断恢复：关闭 App 重启，paused run 出现在历史列表并可恢复


