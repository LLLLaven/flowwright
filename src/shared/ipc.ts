// All IPC command names and their TypeScript signatures

import type { WorkflowGraph, NodeConfig, WorkflowEvent, SkillDefinition, MCPToolDefinition, ProviderDefinition, HumanInput, RunRecord } from './types'

export const IPC = {
  // Workflow management
  WORKFLOW_LOAD:   'workflow:load',
  WORKFLOW_SAVE:   'workflow:save',
  WORKFLOW_RUN:    'workflow:run',
  WORKFLOW_PAUSE:  'workflow:pause',
  WORKFLOW_RESUME: 'workflow:resume',
  WORKFLOW_ABORT:  'workflow:abort',
  WORKFLOW_LIST:   'workflow:list',
  // Node hot-update
  NODE_UPDATE:     'node:update',
  // Queries
  SKILLS_LIST:     'skills:list',
  MCP_LIST:        'mcp:list',
  PROVIDERS_LIST:  'providers:list',
  // RAG
  RAG_INDEX:       'rag:index',
  RAG_QUERY:       'rag:query',
  RAG_DELETE:      'rag:delete',
  // Event channel (main → renderer)
  RUN_EVENT:       'run:event',
} as const

export type IPCCommands = {
  [IPC.WORKFLOW_LOAD]:   (graphId: string)                                      => WorkflowGraph
  [IPC.WORKFLOW_SAVE]:   (graph: WorkflowGraph)                                 => void
  [IPC.WORKFLOW_RUN]:    (graphId: string, initialPrompt?: string)               => string
  [IPC.WORKFLOW_PAUSE]:  (runId: string)                                        => void
  [IPC.WORKFLOW_RESUME]: (runId: string, humanInput?: HumanInput)               => void
  [IPC.WORKFLOW_ABORT]:  (runId: string)                                        => void
  [IPC.WORKFLOW_LIST]:   ()                                                     => RunRecord[]
  [IPC.NODE_UPDATE]:     (runId: string, nodeId: string, config: Partial<NodeConfig>) => void
  [IPC.SKILLS_LIST]:     ()                                                     => SkillDefinition[]
  [IPC.MCP_LIST]:        ()                                                     => MCPToolDefinition[]
  [IPC.PROVIDERS_LIST]:  ()                                                     => ProviderDefinition[]
  [IPC.RAG_INDEX]:       (filePaths: string[])                                  => void
  [IPC.RAG_QUERY]:       (query: string, topK?: number)                         => { text: string; source: string }[]
  [IPC.RAG_DELETE]:      (docId: string)                                        => void
}
