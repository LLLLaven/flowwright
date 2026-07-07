import type { WorkflowGraph, NodeConfig, SkillDefinition, MCPToolDefinition, ProviderDefinition, HumanInput, RunRecord } from '../../../shared/types'
import { IPC } from '../../../shared/ipc'

const invoke = window.electron.ipcRenderer.invoke.bind(window.electron.ipcRenderer)

export const ipc = {
  workflow: {
    list:   (): Promise<RunRecord[]>                        => invoke(IPC.WORKFLOW_LIST),
    listGraphs: (): Promise<WorkflowGraph[]>                => invoke(IPC.WORKFLOW_LIST_GRAPHS),
    load:   (graphId: string)                               => invoke(IPC.WORKFLOW_LOAD, graphId),
    save:   (graph: WorkflowGraph)                         => invoke(IPC.WORKFLOW_SAVE, graph),
    run:    (graphId: string, initialPrompt?: string)       => invoke(IPC.WORKFLOW_RUN, graphId, initialPrompt),
    pause:  (runId: string)                                => invoke(IPC.WORKFLOW_PAUSE, runId),
    resume: (runId: string, input?: HumanInput)            => invoke(IPC.WORKFLOW_RESUME, runId, input),
    abort:  (runId: string)                                => invoke(IPC.WORKFLOW_ABORT, runId),
  },
  node: {
    update: (runId: string, nodeId: string, config: Partial<NodeConfig>) =>
      invoke(IPC.NODE_UPDATE, runId, nodeId, config),
  },
  skills:    { list: (): Promise<SkillDefinition[]>     => invoke(IPC.SKILLS_LIST) },
  mcp:       { list: (): Promise<MCPToolDefinition[]>   => invoke(IPC.MCP_LIST) },
  providers: { list: (): Promise<ProviderDefinition[]>  => invoke(IPC.PROVIDERS_LIST) },
  rag: {
    index:  (filePaths: string[])           => invoke(IPC.RAG_INDEX, filePaths),
    query:  (query: string, topK?: number)  => invoke(IPC.RAG_QUERY, query, topK),
    delete: (docId: string)                 => invoke(IPC.RAG_DELETE, docId),
  },
  on: {
    runEvent: (cb: (runId: string, event: unknown) => void) => {
      window.electron.ipcRenderer.on(IPC.RUN_EVENT, (_e, runId, event) => cb(runId, event))
    },
  },
}
