# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FlowWright is a local desktop AI Agent tool for long-chain task orchestration. Electron + React frontend, LangGraph.js workflow engine in the main process, Vercel AI SDK for LLM calls.

## Commands

```bash
npm run dev          # electron-vite dev (hot-reload main + renderer)
npm run build        # production build → out/
npm run preview      # preview production build
npm run lint         # eslint
```

## Architecture

```
Main Process (Node.js)          Renderer Process (React)
├── WorkflowEngine              ├── WorkflowCanvas (React Flow)
├── IPC Handlers                ├── NodeConfigPanel
├── startup (data dir init)     └── lib/ipc.ts (typed IPC client)
├── shared/types.ts ←──────────→ shared/types.ts
└── shared/ipc.ts   ←──────────→ shared/ipc.ts
```

**Main process is the real backend** — LangGraph, LLM calls, file I/O all live in main. Renderer is UI-only.

**IPC is the only bridge** — renderer never touches filesystem or calls LLM directly. All 15 IPC channels are defined in `src/shared/ipc.ts` with full TypeScript signatures in `IPCCommands`. The renderer client (`src/renderer/src/lib/ipc.ts`) wraps `window.electron.ipcRenderer.invoke`.

**Graph ↔ State separation** — `WorkflowGraph` (persisted JSON, defining nodes/edges/positions) is stored separately from `WorkflowState` (LangGraph runtime messages, checkpoints).

## LLM Provider

Currently using **DeepSeek via Anthropic-compatible endpoint**:

```
createAnthropic({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/anthropic',
})
```

Model: `deepseek-v4-flash` (fast, default) or `deepseek-v4-pro` (heavier tasks).

Set `DEEPSEEK_API_KEY` env var before running. The IPC `workflow:run` handler reads it from `process.env`.

## Key Design Decisions (Phase 0)

- **MemorySaver over SqliteSaver**: `better-sqlite3` has native compilation conflicts with Electron's Node.js version. Using in-memory checkpoints for now; will revisit persistence in Phase 1 (interrupt/resume needs it).
- **Vercel AI SDK types over LangChain types**: State uses `CoreMessage[]` (from `ai` package), not `BaseMessage[]`. Reducer is inline `(a, b) => [...a, ...b]` instead of `messagesStateReducer`. Avoids type conflicts between the two ecosystems.
- **`@ai-sdk/anthropic` not `@ai-sdk/deepseek`**: The DeepSeek SDK returned empty text bodies; the Anthropic SDK with DeepSeek's `/anthropic` base URL works correctly.

## Current State (Phase 0 complete)

What works:
- Electron window opens with React UI
- `workflow:run` IPC → `WorkflowEngine.runSingleNode()` → LangGraph single-node graph → DeepSeek LLM → returns text
- `initDataDir()` creates `~/.flowwright/` with subdirectories (skills, workflows, schemas, rag/) and default `config.json`
- 15 IPC channels registered (only `workflow:run` is wired to the engine; rest are stubs)

What's next (Phase 1):
- React Flow canvas with node/edge editing
- Multi-node graph execution with conditional edges (pass/reject)
- JSON Schema output validation (Zod)
- Human review nodes with interrupt/resume
- SQLite checkpoint persistence

## Key Files

| File | Role |
|------|------|
| `src/main/index.ts` | Electron entry: creates window, inits data dir, instantiates WorkflowEngine, registers IPC |
| `src/main/engine/WorkflowEngine.ts` | LangGraph StateGraph builder + LLM invocation |
| `src/main/ipc/index.ts` | `registerIpcHandlers(engine)` — all `ipcMain.handle` registrations |
| `src/main/startup.ts` | `initDataDir()` — ensures `~/.flowwright/` directory tree exists |
| `src/shared/types.ts` | `WorkflowGraph`, `NodeConfig`, `EdgeConfig`, `WorkflowState`, `WorkflowEvent`, etc. |
| `src/shared/ipc.ts` | IPC channel name constants + `IPCCommands` type map |
| `src/renderer/src/lib/ipc.ts` | Typed renderer-side IPC client |
| `src/preload/index.ts` | contextBridge exposing `electron` + `api` to renderer |
