import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '../../shared/ipc'
import { WorkflowEngine } from '../engine/WorkflowEngine'
import { WorkflowStore } from '../storage/WorkflowStore'
import { RunRegistry } from '../runs/RunRegistry'
import type { WorkflowEvent, HumanInput, WorkflowGraph } from '../../shared/types'

export function registerIpcHandlers(
  engine: WorkflowEngine,
  store: WorkflowStore,
  registry: RunRegistry,
  win: BrowserWindow,
): void {
  // ─── Workflow management (wired) ───────────────────────────────────────

  ipcMain.handle(IPC.WORKFLOW_LIST, async () => {
    return registry.list()
  })

  ipcMain.handle(IPC.WORKFLOW_LIST_GRAPHS, async () => {
    return store.list()
  })

  ipcMain.handle(IPC.WORKFLOW_LOAD, async (_e, graphId: string) => {
    return store.load(graphId)
  })

  ipcMain.handle(IPC.WORKFLOW_SAVE, async (_e, graph: WorkflowGraph) => {
    await store.save(graph)
  })

  ipcMain.handle(IPC.WORKFLOW_RUN, async (_e, graphId: string, initialPrompt?: string) => {
    console.log('[IPC] workflow:run received, graphId:', graphId, 'prompt:', initialPrompt?.slice(0, 50))
    try {
      const graph = await store.load(graphId)
      const runId = 'run-' + Date.now()
      await registry.create(runId, graphId, graph.nodes.length)

      const emit = (event: WorkflowEvent) => {
        emitRunEvent(win, runId, event)
      }

      // Fire-and-forget: execution streams events async
      engine.runGraph(graph, runId, emit, initialPrompt)
        .then(() => registry.updateStatus(runId, 'completed'))
        .catch(async (e) => {
          const msg = String(e)
          console.error('[IPC] runGraph FAILED:', runId, msg)
          if (msg.includes('GraphInterrupt') || msg.includes('__interrupt__')) {
            await registry.updateStatus(runId, 'paused')
          } else {
            await registry.update(runId, { status: 'error', currentNodeId: undefined })
          }
        })

      return runId
    } catch (e) {
      console.error('[IPC] workflow:run error:', e)
      throw e
    }
  })

  ipcMain.handle(IPC.WORKFLOW_PAUSE, async (_e, runId: string) => {
    console.log('[IPC] workflow:pause:', runId)
    await engine.pause(runId)
    await registry.updateStatus(runId, 'paused')
  })

  ipcMain.handle(IPC.WORKFLOW_RESUME, async (_e, runId: string, humanInput?: HumanInput) => {
    console.log('[IPC] workflow:resume:', runId, humanInput)
    const input = humanInput ?? { decision: 'approve' as const }
    await registry.updateStatus(runId, 'running')

    const emit = (event: WorkflowEvent) => {
      emitRunEvent(win, runId, event)
    }

    engine.resume(runId, input, emit)
      .then(() => registry.updateStatus(runId, 'completed'))
      .catch(async (e) => {
        const msg = String(e)
        if (msg.includes('GraphInterrupt') || msg.includes('__interrupt__')) {
          await registry.updateStatus(runId, 'paused')
        } else {
          await registry.update(runId, { status: 'error', currentNodeId: undefined })
        }
      })
  })

  ipcMain.handle(IPC.WORKFLOW_ABORT, async (_e, runId: string) => {
    console.log('[IPC] workflow:abort:', runId)
    await engine.abort(runId)
    await registry.updateStatus(runId, 'aborted')
  })

  // ─── Remaining stubs (Phase 2+) ────────────────────────────────────────

  ipcMain.handle(IPC.NODE_UPDATE,    async (_e, _runId, _nodeId, _config) => {})
  ipcMain.handle(IPC.SKILLS_LIST,    async () => [])
  ipcMain.handle(IPC.MCP_LIST,       async () => [])
  ipcMain.handle(IPC.PROVIDERS_LIST, async () => [])
  ipcMain.handle(IPC.RAG_INDEX,      async (_e, _paths) => {})
  ipcMain.handle(IPC.RAG_QUERY,      async (_e, _query, _topK) => [])
  ipcMain.handle(IPC.RAG_DELETE,     async (_e, _docId) => {})
}

export function emitRunEvent(win: BrowserWindow, runId: string, event: WorkflowEvent): void {
  logRunEvent(runId, event)
  win.webContents.send(IPC.RUN_EVENT, runId, event)
}

function previewValue(value: unknown): string {
  const s = typeof value === 'string' ? value : JSON.stringify(value)
  return s.length > 120 ? s.slice(0, 120) + '…' : s
}

function logRunEvent(runId: string, event: WorkflowEvent): void {
  switch (event.type) {
    case 'node:stream':
      // Per-chunk noise skipped here — NodeExecutor logs a start/end summary instead.
      return
    case 'node:started':
      console.log(`[RunEvent] ${runId} ${event.nodeId} started`)
      return
    case 'node:completed':
      console.log(`[RunEvent] ${runId} ${event.nodeId} completed output=${previewValue(event.output)}`)
      return
    case 'node:rejected':
      console.log(`[RunEvent] ${runId} ${event.nodeId} REJECTED reason=${previewValue(event.reason)}`)
      return
    case 'node:awaiting_human':
      console.log(`[RunEvent] ${runId} ${event.nodeId} awaiting_human deliverable=${previewValue(event.deliverable)}`)
      return
    case 'workflow:done':
      console.log(`[RunEvent] ${runId} workflow DONE`)
      return
    case 'workflow:error':
      console.error(`[RunEvent] ${runId} workflow ERROR: ${event.error}`)
      return
  }
}
