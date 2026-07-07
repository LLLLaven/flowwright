export type NodeType = 'agent' | 'human_review' | 'condition' | 'rag_retrieve'

export interface NodeConfig {
  id: string
  label: string
  type: NodeType
  position: { x: number; y: number }
  provider?: string
  model?: string
  systemPrompt?: string
  availableSkills?: string[]
  mcpTools?: string[]
  outputSchema?: Record<string, unknown>
  maxRetries?: number
}

export interface EdgeConfig {
  id: string
  source: string
  target: string
  condition?: 'pass' | 'reject' | 'default'
}

export interface WorkflowGraph {
  id: string
  name: string
  globalDefaults: { provider: string; model: string }
  nodes: NodeConfig[]
  edges: EdgeConfig[]
}

export interface WorkflowState {
  runId: string
  messages: unknown[]
  nodeOutputs: Record<string, unknown>
  currentNodeId: string
  retryCount: number
  humanFeedback?: string
}

export type WorkflowEvent =
  | { type: 'node:started';        nodeId: string }
  | { type: 'node:stream';         nodeId: string; chunk: string }
  | { type: 'node:completed';      nodeId: string; output: unknown }
  | { type: 'node:rejected';       nodeId: string; reason: string }
  | { type: 'node:awaiting_human'; nodeId: string; deliverable: unknown }
  | { type: 'workflow:done';       runId: string }
  | { type: 'workflow:error';      runId: string; error: string }

export interface SkillDefinition {
  name: string
  description: string
  tools: string[]
  promptBody: string
}

export interface MCPToolDefinition {
  id: string        // "server/tool"
  description: string
}

export interface ProviderDefinition {
  id: string
  name: string
  models: string[]
}

export interface HumanInput {
  decision: 'approve' | 'reject'
  feedback?: string
}

export type RunStatus = 'running' | 'paused' | 'completed' | 'error' | 'aborted'

export interface RunRecord {
  runId: string
  graphId: string
  status: RunStatus
  startedAt: string
  nodeCount: number
  currentNodeId?: string
}
