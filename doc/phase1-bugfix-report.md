# FlowWright Phase 1 验收问题修复报告

> 文档版本：v1.0 · 2026-07-01
> 关联文档：[phase1-plan.md](./phase1-plan.md)

---

## 1. 背景

`phase1-plan.md` 验收清单 8 项中，用户仅确认第 1 项通过，报告了 3 个具体问题：

- 节点配置面板不可见 / 未实现
- 终端日志输出过于粗略，无法正常验收
- 单节点 agent 执行：流式输出无法实时显示，只有 done 的状态

---

## 2. 根因与修复

| # | 问题 | 根因 | 修复 |
|---|------|------|------|
| 1 | 配置面板不可见 | `App.tsx` 维护一个从未被填充的 `canvasNodeConfigs` Map（先有鸡先有蛋问题），面板显示条件恒为 false | 让 `WorkflowCanvas`（已持有 React Flow 节点状态）成为唯一数据源，暴露 `updateNodeData` 命令式句柄，`onNodeClick` 直接回传节点当前配置 |
| 2 | 流式输出不显示 | `RunMonitor.tsx` 接收 `node:stream` 事件但直接丢弃（注释写着"不影响状态"） | 新增 `nodeStreams` 状态累积分片文本，`AgentNode.tsx` 在 `running` 状态下内联展示流式文字预览 |
| 3 | 终端日志过粗 | 仅有零星单行日志 | `NodeExecutor` 增加逐次 schema 校验尝试的通过/失败 + 耗时日志、流式起止摘要（chunk 数/字符数/耗时）；`emitRunEvent` 增加按节点状态转换的结构化单行日志（跳过高噪音的逐 chunk 日志） |

---

## 3. 排查中额外发现并修复的 3 个隐藏 bug

| # | 问题 | 影响 |
|---|------|------|
| 4 | "重载"功能是假的：`WorkflowCanvas` 的"加载已保存工作流"是空实现（`// For now, start empty`），且根本没有列出已保存图的 IPC 通道 | 重启 App 后画布永远空白，验收清单第 1 条"重载"实际从未生效 |
| 5 | Schema 校验完全不可用：`NodeExecutor.ts` 导入了不存在的 `zod-from-json-schema` 导出 `parseSchema`（实际导出名为 `convertJsonSchemaToZod`） | 任何设置了 `outputSchema` 的节点会在调用 LLM 前就抛错并直接进入 rejected，验收清单 schema 校验项完全无法工作 |
| 6 | `HistoryPanel.tsx` 类型导入路径多写一层 `../`，指向项目外部路径 | 该文件被 `App.tsx` 静态引入，可能导致整个渲染进程模块解析失败 |

修复方式：新增 `WORKFLOW_LIST_GRAPHS` IPC 通道 + `WorkflowStore.list()` 接入 + 保存时打 `updatedAt` 时间戳；修正错误的包导出名；修正错误的相对路径。

---

## 4. 改动文件清单

```
src/main/engine/NodeExecutor.ts
src/main/engine/WorkflowEngine.ts
src/main/ipc/index.ts
src/main/storage/WorkflowStore.ts
src/renderer/src/App.tsx
src/renderer/src/components/AgentNode.tsx
src/renderer/src/components/HistoryPanel.tsx
src/renderer/src/components/RunMonitor.tsx
src/renderer/src/components/WorkflowCanvas.tsx
src/renderer/src/lib/ipc.ts
src/shared/ipc.ts
src/shared/types.ts
```

---

## 5. 验证方式

**类型检查**：`npx tsc --noEmit` 分别跑通 node/web 两个 tsconfig，确认新改动不引入新错误（项目中确实存在一些无关的历史遗留类型问题，如 `GraphBuilder.ts` 的 StateGraph 泛型、tsconfig 缺少 `src/shared` 的 include 规则——均未触碰，超出本次范围）。

**真实构建**：`npm run build` 成功产出 `out/`。

**实机验证**（Playwright 驱动 Electron，而非仅看代码）：

- 点击节点 → 面板正确弹出，编辑 label → 画布卡片文字实时同步 ✅
- 关闭重启 App → 正确加载上次保存的工作流（而非空白）✅
- 模拟 `node:started` / `node:stream` / `node:completed` 三段真实 IPC 事件序列 → 节点卡片在 running 时内联显示流式文字，完成后正确变回 "Done" 且预览消失 ✅

**未验证项**：真实 DeepSeek API 端到端流式（当前环境无 `DEEPSEEK_API_KEY`，未借用 Claude Code 代理的凭据去调用不相关的 DeepSeek 接口）。建议本地配置 key 后自行跑一次真实 Run 确认。

---

## 6. 现场清理

验证过程中曾在本地 `~/.flowwright/workflows/` 下的一个测试图里临时加了一个 "Renamed Node E2E" 节点，已还原为验证前的 4 节点原状；临时驱动脚本和截图已删除；`out/`（gitignored）和 `.tsbuildinfo` 构建缓存也已清理，`git status` 仅剩本次实际改动的 12 个源文件。

---

## 7. 建议下一步

1. 配置 `DEEPSEEK_API_KEY` 后跑一次三节点链式工作流 + Human Review 节点，走完验收清单剩余 6 项。
2. 若要追求 `tsc --noEmit` 全绿，需要另开一个任务处理以下历史遗留问题（不影响当前 `npm run dev` / `build`，但会导致严格类型检查失败）：
   - `tsconfig.node.json` / `tsconfig.web.json` 缺少 `src/shared/**/*` 的 include 规则
   - `GraphBuilder.ts` 里 LangGraph `StateGraph` 泛型参数不匹配
   - `JSX` 命名空间缺失
