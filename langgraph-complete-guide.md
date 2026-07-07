# LangGraph JavaScript/TypeScript SDK — 完整开发指南

> 来源: [docs.langchain.com](https://docs.langchain.com/oss/javascript/langgraph/overview)  
> 抓取日期: 2026-06-24  
> 覆盖页面: 27 个文档页面

---

## 目录

1. [LangGraph 概述](#1-langgraph-概述)
2. [安装](#2-安装)
3. [快速开始](#3-快速开始)
4. [本地开发服务器](#4-本地开发服务器)
5. [LangGraph 思维模型](#5-langgraph-思维模型)
6. [Workflows 与 Agents](#6-workflows-与-agents)
7. [持久化](#7-持久化)
8. [容错机制](#8-容错机制)
9. [Checkpointers（检查点存储）](#9-checkpointers检查点存储)
10. [Stores（存储）](#10-stores存储)
11. [事件流](#11-事件流)
12. [流式处理（Streaming）](#12-流式处理streaming)
13. [中断（Interrupts）——人在回路中](#13-中断interrupts人在回路中)
14. [时间旅行（Time Travel）](#14-时间旅行time-travel)
15. [记忆（Memory）](#15-记忆memory)
16. [子图（Subgraphs）](#16-子图subgraphs)
17. [应用结构](#17-应用结构)
18. [测试](#18-测试)
19. [向后兼容性](#19-向后兼容性)
20. [LangSmith Studio](#20-langsmith-studio)
21. [Agent Chat UI](#21-agent-chat-ui)
22. [部署](#22-部署)
23. [可观测性](#23-可观测性)
24. [前端集成](#24-前端集成)
25. [运行时（Pregel）](#25-运行时pregel)

---

## 1. LangGraph 概述

LangGraph 是一个低级编排框架和运行时，用于构建、管理和部署长时间运行的有状态 Agent。它被 Klarna、Uber、J.P. Morgan 等公司信赖使用。

LangGraph 非常底层，完全专注于 Agent **编排**。在使用 LangGraph 之前，建议先熟悉构建 Agent 所需的基础组件，如 [models](https://docs.langchain.com/oss/javascript/langchain/models) 和 [tools](https://docs.langchain.com/oss/javascript/langchain/tools)。

### LangChain 产品体系

- **Deep Agents** — Agent harness：规划、子 Agent、文件系统工具和上下文管理，构建在 LangGraph 之上
- **LangChain** — Agent 框架：模型、工具和 Agent 循环的抽象和集成
- **LangGraph** — 编排运行时：持久执行、流式处理、人在回路中、持久化
- **LangSmith** — 跨框架的追踪、评估、提示和部署平台
- **LangSmith Engine** — 检测 LangGraph Agent 追踪中的问题并提出修复方案
- **LangSmith Fleet** — 无代码 Agent 构建器，用于模板、集成和日常自动化

### 核心优势

- **持久化（Persistence）**: 构建能够在故障后持久化的 Agent，可以从中断处恢复并长时间运行
- **人在回路中（Human-in-the-loop）**: 在任何节点插入人工审批，检查和修改 Agent 状态
- **全面的记忆（Comprehensive memory）**: 创建具有短期工作记忆（用于持续推理）和跨会话长期记忆的有状态 Agent
- **使用 LangSmith 调试**: 通过可视化工具深度洞察复杂 Agent 行为，追踪执行路径、捕获状态转换
- **生产就绪部署**: 使用专为有状态、长时间运行工作流设计的可扩展基础设施部署 Agent

### 致谢

LangGraph 受 [Pregel](https://research.google/pubs/pub37252/) 和 [Apache Beam](https://beam.apache.org/) 的启发。公共接口从 [NetworkX](https://networkx.org/documentation/latest/) 汲取灵感。LangGraph 由 LangChain Inc 构建，但可以脱离 LangChain 独立使用。

---

## 2. 安装

```bash
npm install @langchain/langgraph @langchain/core
# 或
pnpm add @langchain/langgraph @langchain/core
# 或
yarn add @langchain/langgraph @langchain/core
# 或
bun add @langchain/langgraph @langchain/core
```

### 推荐配置

使用 [LangSmith](https://docs.langchain.com/langsmith/observability) 追踪请求、调试 Agent 行为并评估输出：

```bash
LANGSMITH_TRACING=true
```

---

## 3. 快速开始

### Hello World 示例

```typescript
import { StateSchema, MessagesValue, type GraphNode, StateGraph, START, END } from "@langchain/langgraph";

const State = new StateSchema({
  messages: MessagesValue,
});

const mockLlm: GraphNode<typeof State> = (state) => {
  return { messages: [{ role: "ai", content: "hello world" }] };
};

const graph = new StateGraph(State)
  .addNode("mock_llm", mockLlm)
  .addEdge(START, "mock_llm")
  .addEdge("mock_llm", END)
  .compile();

await graph.invoke({ messages: [{ role: "user", content: "hi!" }] });
```

### 核心概念

LangGraph 的核心工作流基于以下概念：

1. **State（状态）** — 定义图的状态结构，使用 `StateSchema` 定义状态字段
2. **Nodes（节点）** — 图中的计算单元，每个节点是一个函数，接收状态并返回状态更新
3. **Edges（边）** — 连接节点，定义执行流程。包括普通边和条件边
4. **START / END** — 特殊标记，分别表示图的入口和出口

### Graph API vs Functional API

LangGraph JS/TS 提供两种构建图的 API：

**Graph API** (`StateGraph`):
```typescript
const graph = new StateGraph(State)
  .addNode("nodeA", nodeAFn)
  .addNode("nodeB", nodeBFn)
  .addEdge(START, "nodeA")
  .addConditionalEdges("nodeA", routerFn)
  .addEdge("nodeB", END)
  .compile();
```

**Functional API** (`entrypoint`):
```typescript
import { entrypoint } from "@langchain/langgraph/func";

const checkpointer = new MemorySaver();

const writeEssay = entrypoint(
  { checkpointer, name: "writeEssay" },
  async (essay: Essay) => {
    return { content: `Essay about ${essay.topic}` };
  }
);
```

### 状态管理

```typescript
import { StateSchema, MessagesValue, type GraphNode } from "@langchain/langgraph";

// 定义状态结构
const State = new StateSchema({
  messages: MessagesValue,      // 消息列表（自动追加）
  score: { default: () => 0 },  // 带默认值
  topic: null,                   // 普通值
});

// 节点可以返回部分状态更新（自动合并）
const scoreNode: GraphNode<typeof State> = (state) => {
  return { score: computeScore(state.messages) };
};
```

---

## 4. 本地开发服务器

### 启动本地服务器

LangGraph 提供了一个本地开发服务器，用于在本地运行和测试 Agent 图：

```bash
npx @langchain/langgraph-cli dev
```

本地服务器会：
- 启动一个 HTTP API 端点
- 支持 LangSmith Studio 连接进行可视化调试
- 提供热重载功能
- 支持流式响应

### 配置

在 `langgraph.json` 中配置图：

```json
{
  "graphs": {
    "agent": "./src/agent.ts:graph"
  },
  "env": ".env"
}
```

---

## 5. LangGraph 思维模型

### 从图的角度思考

LangGraph 的核心思想是将 Agent 表示为**有向图**：

- **Nodes（节点）** = 计算步骤（LLM 调用、工具执行、数据转换）
- **Edges（边）** = 控制流（从一个节点到下一个节点）
- **State（状态）** = 在节点之间传递的数据

### 关键设计原则

1. **显式控制流** — 与隐式 Agent 循环不同，LangGraph 让你显式定义执行路径
2. **状态即真相** — 所有数据都存储在状态中，节点可以读取和更新状态
3. **持久化是公民权利** — 每个状态转换都可以被持久化，支持故障恢复
4. **边驱动执行** — 图通过沿着边传递数据来执行

### Graph vs Chain

```
Chain:    A → B → C → D  (线性的, 固定顺序)
Graph:    A → B ⇄ C → D  (可以有循环、条件分支、并行)
          ↓         ↑
          E → → → → ↗
```

### 常见模式

- **Router（路由器）** — 根据 LLM 输出决定下一个节点
- **Agent Loop（Agent 循环）** — 节点循环直到满足条件
- **Parallel（并行）** — 多个节点同时执行
- **Map-Reduce** — 分发到子任务然后聚合结果
- **Human-in-the-loop** — 在关键节点暂停等待人工输入

---

## 6. Workflows 与 Agents

### Workflow（工作流）

Workflow 是**确定性的、预定义的**执行路径：

```typescript
const workflow = new StateGraph(State)
  .addNode("fetch_data", fetchData)
  .addNode("transform", transformData)
  .addNode("validate", validateData)
  .addEdge(START, "fetch_data")
  .addEdge("fetch_data", "transform")
  .addEdge("transform", "validate")
  .addEdge("validate", END)
  .compile();
```

特点：
- 固定的步骤顺序
- 可预测的执行路径
- 适合 ETL、数据处理等场景

### Agent（智能体）

Agent 使用 LLM 进行**动态决策**，执行路径不固定：

```typescript
const agent = new StateGraph(State)
  .addNode("agent", callModel)
  .addNode("tools", toolNode)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue, {
    continue: "tools",
    end: END,
  })
  .addEdge("tools", "agent")
  .compile();
```

特点：
- LLM 决定下一步行动
- 可以循环执行（agent → tools → agent）
- 适合对话、推理、工具使用等场景

### 选择指南

| 场景 | 推荐 |
|------|------|
| 固定的业务流程 | Workflow |
| 需要 LLM 推理决策 | Agent |
| 混合场景 | Agent + Workflow 结合 |

---

## 7. 持久化

LangGraph 支持持久化执行，这意味着 Agent 可以在故障后从中断处恢复。

### 基本用法

```typescript
import { MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

const graph = new StateGraph(State)
  .addNode("agent", agentNode)
  .addEdge(START, "agent")
  .compile({ checkpointer });
```

### Checkpoint（检查点）

每次状态更新都会创建一个检查点，包含：
- 当前状态值
- 当前节点位置
- 元数据（时间戳、配置等）

### 线程（Thread）

使用 `configurable.thread_id` 来隔离不同的对话/会话：

```typescript
const config = { configurable: { thread_id: "user-123" } };

await graph.invoke({ messages: [...] }, config);
// 稍后在同一线程中继续
await graph.invoke({ messages: [...] }, config);
```

---

## 8. 容错机制

LangGraph 提供内置的容错能力：

### 重试策略

```typescript
const graph = new StateGraph(State)
  .addNode("api_call", callApi, {
    retry: {
      maxAttempts: 3,
      initialInterval: 1000,  // 1 秒
      backoffFactor: 2,        // 指数退避
    }
  })
  .compile();
```

### 故障恢复

- **自动重试** — 临时故障时自动重试节点
- **检查点恢复** — 从最近的检查点恢复执行
- **优雅降级** — 处理不可恢复的错误

---

## 9. Checkpointers（检查点存储）

Checkpointer 负责持久化图的状态。LangGraph 提供多种实现：

### MemorySaver

用于开发和测试，数据存储在内存中：

```typescript
import { MemorySaver } from "@langchain/langgraph";
const checkpointer = new MemorySaver();
```

### AsyncPostgresSaver

用于生产环境，数据存储在 PostgreSQL：

```typescript
import { AsyncPostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const checkpointer = await AsyncPostgresSaver.fromConnString(
  "postgresql://user:pass@localhost:5432/db"
);
```

### SqliteSaver

轻量级本地持久化：

```typescript
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";

const checkpointer = new SqliteSaver("path/to/db.sqlite");
```

### 自定义 Checkpointer

可以实现 `Checkpointer` 接口来支持其他存储后端。

---

## 10. Stores（存储）

Store 提供长期记忆存储，与 Checkpoint 不同：

- **Checkpoint** — 短期、线程内的状态快照
- **Store** — 长期、跨线程的持久数据

### 使用 Store

```typescript
import { InMemoryStore } from "@langchain/langgraph";

const store = new InMemoryStore();

const graph = new StateGraph(State)
  .compile({ store });
```

### Store 操作

```typescript
// 在节点中访问 store
const myNode = async (state, config) => {
  const store = config.store;
  
  // 存储数据
  await store.put(["users", "preferences"], { theme: "dark" });
  
  // 读取数据
  const prefs = await store.get(["users", "preferences"]);
  
  // 搜索
  const results = await store.search(["users"], { filter: { active: true } });
  
  return { ... };
};
```

---

## 11. 事件流

LangGraph 提供详细的事件流机制，用于监控图执行过程：

### 事件类型

```typescript
// 流式监听所有事件
for await (const event of graph.streamEvents(input, config)) {
  switch (event.event) {
    case "on_chain_start":    // 图/节点开始执行
    case "on_chain_end":      // 图/节点执行完成
    case "on_chat_model_start": // LLM 调用开始
    case "on_chat_model_stream": // LLM token 流
    case "on_chat_model_end":   // LLM 调用结束
    case "on_tool_start":       // 工具调用开始
    case "on_tool_end":         // 工具调用结束
  }
}
```

### 自定义事件

```typescript
const myNode = (state) => {
  // 发出自定义事件
  return {
    messages: [...],
    __events__: [{ name: "custom_event", value: "some data" }],
  };
};
```

---

## 12. 流式处理（Streaming）

LangGraph 支持多种流式模式：

### stream()

逐个节点返回状态更新：

```typescript
for await (const chunk of await graph.stream(input, config)) {
  // chunk 是每个节点执行后的部分状态
  console.log(chunk);
}
```

### streamMode

```typescript
// 只流式返回 messages
for await (const [msg, _] of await graph.stream(input, {
  ...config,
  streamMode: "messages",
})) {
  console.log(msg); // AI 消息/工具调用
}

// 只流式返回 LLM tokens
for await (const token of await graph.stream(input, {
  ...config,
  streamMode: "messages-tokens",
})) {
  process.stdout.write(token);
}

// 自定义流模式
for await (const chunk of await graph.stream(input, {
  ...config,
  streamMode: "custom",
})) {
  // 处理自定义流数据
}
```

---

## 13. 中断（Interrupts）——人在回路中

中断允许在特定节点暂停执行，等待人工审批或输入。

### 基本中断

```typescript
import { interrupt } from "@langchain/langgraph";

const approvalNode = (state) => {
  // 暂停并请求人工审批
  const approved = interrupt({
    question: "Is this action approved?",
    data: state.proposedAction,
  });
  
  if (approved) {
    return { status: "approved" };
  }
  return { status: "rejected" };
};
```

### 恢复执行

```typescript
// 初始调用会暂停
const stream = await graph.stream(input, config);

// 当图暂停时，使用 Command 恢复
import { Command } from "@langchain/langgraph";

await graph.invoke(
  new Command({ resume: { approved: true } }),
  config
);
```

### 动态中断

```typescript
const graphWithBreakpoints = new StateGraph(State)
  .addNode("agent", agentNode)
  .addNode("tools", toolNode)
  .addEdge(START, "agent")
  .compile({
    // 在执行每个节点前中断
    interruptBefore: ["tools"],
    // 或者在某些节点后中断
    // interruptAfter: ["agent"],
  });
```

---

## 14. 时间旅行（Time Travel）

时间旅行允许你查看和恢复到之前的状态。

### 查看历史状态

```typescript
// 获取状态历史
const history = [];
for await (const state of graph.getStateHistory(config)) {
  history.push(state);
}

// 查看特定检查点的状态
const state = await graph.getState(config);
const parentState = await graph.getState({
  ...config,
  configurable: {
    ...config.configurable,
    checkpoint_id: state.config.configurable.checkpoint_id,
  },
});
```

### 重放到特定状态

```typescript
// 从特定检查点重放
await graph.updateState(config, {
  messages: [...],
  // 指定要恢复到的检查点
  checkpoint_id: "checkpoint-id-here",
});

// 继续执行
await graph.invoke(null, config);
```

### Fork 执行

```typescript
// 从历史状态分叉（创建新线程）
const forked = await graph.getState(config);
// 修改状态并创建新线程
await graph.invoke(input, {
  ...config,
  configurable: {
    ...config.configurable,
    thread_id: "new-thread-id",
  },
});
```

---

## 15. 记忆（Memory）

LangGraph 支持为 Agent 添加持久记忆。

### 短期记忆（工作记忆）

通过状态管理实现：

```typescript
const State = new StateSchema({
  messages: MessagesValue,
  scratchpad: [],  // 工作记忆
});
```

### 长期记忆（跨会话）

使用 Store 实现：

```typescript
import { InMemoryStore } from "@langchain/langgraph";

const store = new InMemoryStore();

// 在节点中保存记忆
const memoryNode = async (state, config) => {
  // 从 store 检索相关记忆
  const memories = await config.store.search(["memories"], {
    filter: { user_id: config.configurable.user_id },
  });
  
  // 更新记忆
  await config.store.put(
    ["memories", Date.now().toString()],
    { content: state.messages[state.messages.length - 1].content }
  );
  
  return { relevant_memories: memories };
};
```

### 语义搜索

```typescript
// 使用嵌入向量进行语义搜索
const similar = await store.search(["memories"], {
  query: "user preferences",  // 语义查询
  k: 5,                       // 返回 top-5
});
```

---

## 16. 子图（Subgraphs）

子图允许将复杂的 Agent 拆分为可复用的子组件。

### 创建子图

```typescript
// 定义子图
const subgraph = new StateGraph(SubState)
  .addNode("process", processNode)
  .addEdge(START, "process")
  .addEdge("process", END)
  .compile();

// 在主图中使用子图
const mainGraph = new StateGraph(MainState)
  .addNode("subgraph", subgraph)  // 将子图作为节点
  .addEdge(START, "subgraph")
  .addEdge("subgraph", END)
  .compile();
```

### 状态映射

当主图和子图有不同状态结构时，需要状态映射：

```typescript
const mainGraph = new StateGraph(MainState)
  .addNode("subgraph", subgraph, {
    // 将主状态映射到子图状态
    input: (state) => ({ query: state.userInput }),
    // 将子图状态映射回主状态
    output: (state, result) => ({ response: result.answer }),
  })
  .compile();
```

---

## 17. 应用结构

推荐的 LangGraph 项目结构：

```
my-agent/
├── langgraph.json          # 图配置
├── package.json
├── src/
│   ├── agent.ts            # 主 Agent 图定义
│   ├── nodes/              # 节点实现
│   │   ├── chat.ts         # LLM 聊天节点
│   │   ├── tools.ts        # 工具执行节点
│   │   └── router.ts       # 路由逻辑
│   ├── state.ts            # 状态定义
│   ├── tools/              # 自定义工具
│   │   ├── search.ts
│   │   └── database.ts
│   └── config.ts           # 配置和 checkpointer
├── tests/
│   └── agent.test.ts
└── .env
```

### langgraph.json 配置

```json
{
  "graphs": {
    "agent": "./src/agent.ts:graph"
  },
  "env": ".env",
  "dependencies": ["./src"]
}
```

---

## 18. 测试

### 单元测试节点

```typescript
import { describe, it, expect } from "vitest";

describe("agent node", () => {
  it("should generate a response", async () => {
    const state = { messages: [{ role: "user", content: "hello" }] };
    const result = await agentNode(state);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("ai");
  });
});
```

### 集成测试图

```typescript
import { MemorySaver } from "@langchain/langgraph";

it("should complete full conversation", async () => {
  const graph = buildGraph().compile({ checkpointer: new MemorySaver() });
  
  const result = await graph.invoke(
    { messages: [{ role: "user", content: "What is the weather?" }] },
    { configurable: { thread_id: "test-1" } }
  );
  
  expect(result.messages[result.messages.length - 1].content).toBeDefined();
});
```

### 模拟 LLM

```typescript
// 使用 mock LLM 进行确定性测试
const mockLlm = (state) => ({
  messages: [{ role: "ai", content: "mocked response" }],
});
```

---

## 19. 向后兼容性

LangGraph 遵循语义化版本（Semver）：

- **主版本** (x.0.0): 不兼容的 API 变更
- **次版本** (0.x.0): 向后兼容的新功能
- **补丁版本** (0.0.x): 向后兼容的 bug 修复

### 迁移

查阅 [Changelog](https://docs.langchain.com/oss/javascript/releases/changelog) 了解版本间的迁移指南。

---

## 20. LangSmith Studio

LangSmith Studio 是一个用于可视化调试 LangGraph Agent 的桌面应用。

### 功能

- **图可视化** — 查看图结构，追踪执行路径
- **状态检查** — 在每个节点检查完整状态
- **时间旅行** — 回放历史执行
- **实时追踪** — 在开发过程中实时观察 Agent 行为

### 连接

```bash
npx @langchain/langgraph-cli dev
```

然后在 LangSmith Studio 中连接到本地服务器。

---

## 21. Agent Chat UI

LangGraph 提供开箱即用的聊天 UI 组件：

```typescript
// 在 Web 应用中嵌入 Agent Chat UI
import { ChatUI } from "@langchain/langgraph-ui";

function App() {
  return (
    <ChatUI
      graphUrl="http://localhost:8123/agent"
      title="My Agent"
    />
  );
}
```

---

## 22. LangSmith 部署

### 部署方式

LangGraph Agent 可以部署到：

1. **LangSmith Cloud** — 托管部署平台
2. **自托管** — 在自己的基础设施上运行
3. **本地服务器** — 开发和测试

### 使用 LangGraph CLI 部署

```bash
npx @langchain/langgraph-cli deploy
```

### Docker 部署

```dockerfile
FROM node:20
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
EXPOSE 8123
CMD ["npx", "@langchain/langgraph-cli", "serve", "--port", "8123"]
```

---

## 23. 可观测性

### LangSmith 追踪

```typescript
// 启用 LangSmith 追踪
process.env.LANGSMITH_TRACING = "true";
process.env.LANGSMITH_API_KEY = "ls_...";

// 所有图执行自动被追踪
await graph.invoke(input, config);
```

### 追踪内容

- 图执行路径
- 每个节点的输入/输出
- LLM 调用（tokens、延迟）
- 工具调用
- 状态转换
- 错误和重试

### 评估

使用 LangSmith 对 Agent 进行评估：

```typescript
import { evaluate } from "langsmith/evaluation";

await evaluate(
  (input) => graph.invoke(input),
  {
    data: "my-dataset",
    evaluators: [correctnessEvaluator],
  }
);
```

---

## 24. 前端集成

### Graph Execution（图执行）

在前端控制图的执行和可视化：

```typescript
// 使用 LangGraph 前端 SDK
import { useGraph } from "@langchain/langgraph-frontend";

function AgentView() {
  const { state, stream, interrupt } = useGraph({
    graphId: "agent",
    serverUrl: "http://localhost:8123",
  });
  
  return (
    <div>
      {state.messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <button onClick={() => stream.submit({ messages: [...] })}>
        Send
      </button>
    </div>
  );
}
```

### Custom Stream Channels（自定义流通道）

自定义前端需要的流数据：

```typescript
const graph = new StateGraph(State)
  .addNode("agent", agentNode)
  .compile({
    streamChannels: ["messages", "thinking", "tool_calls"],
  });
```

---

## 25. 运行时（Pregel）

> Pregel 运行时以 Google 的 Pregel 算法命名，该算法描述了一种使用图进行大规模并行计算的高效方法。

### 概述

LangGraph 的运行时基于 **actors** 和 **channels** 两个核心概念：

- **Actors** — 图中的节点，订阅 channels 并在有新数据时被触发
- **Channels** — 节点之间的通信通道，存储状态数据

### Pregel 算法（Bulk Synchronous Parallel）

每个执行步骤包含三个阶段：

1. **Plan（规划）** — 确定此步骤中要执行哪些 actor。例如，第一步选择订阅特殊输入通道的 actor；后续步骤选择订阅上一步更新的通道的 actor
2. **Execution（执行）** — 并行执行所有选定的 actor，直到全部完成、或一个失败、或达到超时
3. **Update（更新）** — 使用此步骤中 actor 写入的值更新通道

### Channel 类型

#### LastValue

存储最后一个写入的值：

```typescript
import { LastValue } from "@langchain/langgraph/channels";
const channel = new LastValue<number>();
```

#### Topic

积累所有写入的值：

```typescript
import { Topic } from "@langchain/langgraph/channels";
// 在步骤间累积所有值
const channel = new Topic<string>({ accumulate: true });
```

#### BinaryOperatorAggregate

使用自定义归约器合并值：

```typescript
import { BinaryOperatorAggregate } from "@langchain/langgraph/channels";

const total = new BinaryOperatorAggregate<number>({
  operator: (a, b) => a + b  // 类似 reducer
});
```

### Pregel 低级 API 示例

#### 单节点图

```typescript
import { EphemeralValue } from "@langchain/langgraph/channels";
import { Pregel, NodeBuilder } from "@langchain/langgraph/pregel";

const node1 = new NodeBuilder()
  .subscribeOnly("a")
  .do((x: string) => x + x)
  .writeTo("b");

const app = new Pregel({
  nodes: { node1 },
  channels: {
    a: new EphemeralValue<string>(),
    b: new EphemeralValue<string>(),
  },
  inputChannels: ["a"],
  outputChannels: ["b"],
});

await app.invoke({ a: "foo" });
// => { b: 'foofoo' }
```

#### 多节点

```typescript
import { LastValue, EphemeralValue } from "@langchain/langgraph/channels";

const node1 = new NodeBuilder()
  .subscribeOnly("a")
  .do((x: string) => x + x)
  .writeTo("b");

const node2 = new NodeBuilder()
  .subscribeOnly("b")
  .do((x: string) => x + x)
  .writeTo("c");

const app = new Pregel({
  nodes: { node1, node2 },
  channels: {
    a: new EphemeralValue<string>(),
    b: new LastValue<string>(),
    c: new EphemeralValue<string>(),
  },
  inputChannels: ["a"],
  outputChannels: ["b", "c"],
});

await app.invoke({ a: "foo" });
// => { b: 'foofoo', c: 'foofoofoofoo' }
```

#### Topic 累积

```typescript
import { EphemeralValue, Topic } from "@langchain/langgraph/channels";

const node1 = new NodeBuilder()
  .subscribeOnly("a")
  .do((x: string) => x + x)
  .writeTo("b", "c");

const node2 = new NodeBuilder()
  .subscribeTo("b")
  .do((x: { b: string }) => x.b + x.b)
  .writeTo("c");

const app = new Pregel({
  nodes: { node1, node2 },
  channels: {
    a: new EphemeralValue<string>(),
    b: new EphemeralValue<string>(),
    c: new Topic<string>({ accumulate: true }),
  },
  inputChannels: ["a"],
  outputChannels: ["c"],
});

await app.invoke({ a: "foo" });
// => { c: ['foofoo', 'foofoofoofoo'] }
```

#### 条件跳过（SkipNone）

```typescript
const exampleNode = new NodeBuilder()
  .subscribeOnly("value")
  .do((x: string) => x.length < 10 ? x + x : null)
  .writeTo(new ChannelWriteEntry("value", { skipNone: true }));

const app = new Pregel({
  nodes: { exampleNode },
  channels: { value: new EphemeralValue<string>() },
  inputChannels: ["value"],
  outputChannels: ["value"],
});

await app.invoke({ value: "a" });
// => { value: 'aaaaaaaaaaaaaaaa' }
```

### 与高级 API 的关系

StateGraph 和 Functional API 都是 Pregel 运行时的高级封装：

```typescript
// StateGraph 编译后返回 Pregel 实例
const builder = new StateGraph<Essay>({
  channels: { topic: null, content: null, score: null }
})
  .addNode("writeEssay", writeEssay)
  .addNode("scoreEssay", scoreEssay)
  .addEdge(START, "writeEssay")
  .addEdge("writeEssay", "scoreEssay");

const graph = builder.compile(); // 返回 Pregel 实例

// 底层 Pregel 的 nodes 和 channels 可见
console.log(graph.nodes);    // { __start__: PregelNode, writeEssay: PregelNode, ... }
console.log(graph.channels); // { topic: LastValue, content: LastValue, ... }
```

```typescript
// Functional API 同样基于 Pregel
import { MemorySaver } from "@langchain/langgraph";
import { entrypoint } from "@langchain/langgraph/func";

const writeEssay = entrypoint(
  { checkpointer: new MemorySaver(), name: "writeEssay" },
  async (essay: Essay) => ({ content: `Essay about ${essay.topic}` })
);

console.log(writeEssay.nodes);    // { writeEssay: PregelNode { ... } }
console.log(writeEssay.channels); // { __start__: EphemeralValue, __end__: LastValue, ... }
```

---

## 附：API 参考速查

### 核心导入

```typescript
// 图构建
import { StateGraph, START, END } from "@langchain/langgraph";
import { StateSchema, MessagesValue } from "@langchain/langgraph";

// 检查点
import { MemorySaver } from "@langchain/langgraph";
import { AsyncPostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";

// 存储
import { InMemoryStore } from "@langchain/langgraph";

// 中断
import { interrupt, Command } from "@langchain/langgraph";

// 功能 API
import { entrypoint } from "@langchain/langgraph/func";

// Channels (低级 API)
import { LastValue, EphemeralValue, Topic, BinaryOperatorAggregate } from "@langchain/langgraph/channels";

// Pregel (低级 API)
import { Pregel, NodeBuilder, ChannelWriteEntry } from "@langchain/langgraph/pregel";
```

### 常用模式

```typescript
// 条件路由
function shouldContinue(state: State): "tools" | "__end__" {
  if (state.messages[state.messages.length - 1].tool_calls) {
    return "tools";
  }
  return "__end__";
}

// 并行执行
const graph = new StateGraph(State)
  .addNode("analyze_a", analyzeA)
  .addNode("analyze_b", analyzeB)
  .addNode("synthesize", synthesize)
  .addEdge(START, "analyze_a")
  .addEdge(START, "analyze_b")
  .addEdge("analyze_a", "synthesize")
  .addEdge("analyze_b", "synthesize")
  .addEdge("synthesize", END)
  .compile();
```

---

> **提示**: 本文档从 [docs.langchain.com](https://docs.langchain.com/oss/javascript/langgraph/overview) 自动抓取编译。建议配合官方文档使用，获取最新的 API 变更和新增功能。
