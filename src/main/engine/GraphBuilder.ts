import { StateGraph, START, END } from '@langchain/langgraph'
import { interrupt, Command } from '@langchain/langgraph'
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint'
import type {
  WorkflowGraph,
  WorkflowState,
  WorkflowEvent,
  EdgeConfig,
  NodeConfig,
  HumanInput,
} from '../../shared/types'
import type { NodeExecutor } from './NodeExecutor'
import type { CoreMessage } from 'ai'

// Extended state channels for the compiled graph
interface GraphChannels {
  messages: CoreMessage[]
  nodeOutputs: Record<string, unknown>
  currentNodeId: string
  retryCount: number
  humanFeedback: string | undefined
  runId: string
}

// Augmented output with routing metadata
interface NodeOutputWithRouting {
  __passed: boolean
  [key: string]: unknown
}

function makeAgentNode(
  node: NodeConfig,
  executor: NodeExecutor,
  emit: (event: WorkflowEvent) => void,
) {
  return async (state: GraphChannels): Promise<Partial<GraphChannels>> => {
    emit({ type: 'node:started', nodeId: node.id })

    const { output, passed, reason } = await executor.execute(
      node,
      state.messages,
      emit,
    )

    const nodeOutput: NodeOutputWithRouting = { __passed: passed }
    if (output !== null && output !== undefined) {
      Object.assign(nodeOutput, output as Record<string, unknown>)
    }

    const newMessages: CoreMessage[] = []
    if (output) {
      const content =
        typeof output === 'string' ? output : JSON.stringify(output)
      newMessages.push({ role: 'assistant' as const, content })
    }

    if (!passed) {
      emit({
        type: 'node:rejected',
        nodeId: node.id,
        reason: reason ?? 'Unknown error',
      })
      return {
        nodeOutputs: { [node.id]: nodeOutput },
        messages: newMessages,
        currentNodeId: node.id,
      }
    }

    emit({ type: 'node:completed', nodeId: node.id, output })
    return {
      nodeOutputs: { [node.id]: nodeOutput },
      messages: newMessages,
      currentNodeId: node.id,
    }
  }
}

function makeHumanReviewNode(
  node: NodeConfig,
  emit: (event: WorkflowEvent) => void,
) {
  return (state: GraphChannels): Partial<GraphChannels> => {
    // Get the last node's output as the deliverable
    const outputs = Object.entries(state.nodeOutputs)
    const deliverable =
      outputs.length > 0 ? outputs[outputs.length - 1][1] : null

    emit({
      type: 'node:awaiting_human',
      nodeId: node.id,
      deliverable,
    })

    // interrupt() pauses the graph and waits for Command({ resume })
    const humanInput: HumanInput = interrupt({
      nodeId: node.id,
      deliverable,
    })

    if (humanInput.decision === 'reject') {
      return {
        humanFeedback: humanInput.feedback,
        nodeOutputs: {
          [node.id]: { __passed: false, feedback: humanInput.feedback },
        },
        currentNodeId: node.id,
      }
    }

    return {
      nodeOutputs: { [node.id]: { __passed: true } },
      currentNodeId: node.id,
    }
  }
}

function routeByValidation(state: GraphChannels): string {
  const lastNodeId = state.currentNodeId
  if (!lastNodeId) return 'default'

  const out = state.nodeOutputs[lastNodeId] as NodeOutputWithRouting | undefined
  return out?.__passed ? 'pass' : 'reject'
}

export interface CompiledGraph {
  graph: ReturnType<StateGraph['compile']>
  runId: string
}

export function buildGraph(
  workflow: WorkflowGraph,
  executor: NodeExecutor,
  emit: (event: WorkflowEvent) => void,
  checkpointer: BaseCheckpointSaver,
  runId: string,
  initialPrompt?: string,
): ReturnType<StateGraph<any, any, any, any, any, any, any>['compile']> {

  // Build initial messages: user prompt as first message
  const initialMessages: CoreMessage[] = initialPrompt
    ? [{ role: 'user' as const, content: initialPrompt }]
    : []
  const graph = new StateGraph<GraphChannels>({
    channels: {
      messages: {
        reducer: (a: CoreMessage[], b: CoreMessage[]) => [...a, ...b],
        default: () => initialMessages as CoreMessage[],
      },
      nodeOutputs: {
        reducer: (a: Record<string, unknown>, b: Record<string, unknown>) => ({ ...a, ...b }),
        default: () => ({}),
      },
      currentNodeId: {
        reducer: (_: string, b: string) => b,
        default: () => '',
      },
      retryCount: {
        reducer: (_: number, b: number) => b,
        default: () => 0,
      },
      humanFeedback: {
        reducer: (_: string | undefined, b: string | undefined) => b,
        default: () => undefined,
      },
      runId: {
        reducer: (_: string, b: string) => b,
        default: () => runId,
      },
    },
  })

  // Register all nodes
  for (const node of workflow.nodes) {
    if (node.type === 'human_review') {
      graph.addNode(node.id, makeHumanReviewNode(node, emit))
    } else {
      // Default: agent or any other type
      graph.addNode(node.id, makeAgentNode(node, executor, emit))
    }
  }

  // Determine incoming/outgoing edges
  const hasIncoming = new Set(workflow.edges.map((e) => e.target))
  const hasOutgoing = new Set(workflow.edges.map((e) => e.source))

  // START → nodes with no incoming edges
  for (const node of workflow.nodes) {
    if (!hasIncoming.has(node.id)) {
      graph.addEdge(START, node.id)
    }
  }

  // Group edges by source for conditional routing
  const edgesBySource = new Map<string, EdgeConfig[]>()
  for (const edge of workflow.edges) {
    const arr = edgesBySource.get(edge.source) ?? []
    arr.push(edge)
    edgesBySource.set(edge.source, arr)
  }

  for (const [source, edges] of edgesBySource) {
    const hasCondition = edges.some(
      (e) => e.condition === 'pass' || e.condition === 'reject',
    )

    if (hasCondition) {
      // Build conditional edge map
      const routeMap: Record<string, string | typeof END> = {}
      for (const edge of edges) {
        const key = edge.condition ?? 'default'
        routeMap[key] = edge.target || END
      }
      graph.addConditionalEdges(source, routeByValidation, routeMap)
    } else {
      // Plain edges
      for (const edge of edges) {
        graph.addEdge(edge.source, edge.target || END)
      }
    }
  }

  // Nodes with no outgoing edges → END
  for (const node of workflow.nodes) {
    if (!hasOutgoing.has(node.id)) {
      graph.addEdge(node.id, END)
    }
  }

  return graph.compile({ checkpointer })
}

/**
 * Resume a compiled graph from a human review interruption.
 */
export async function resumeGraph(
  compiled: ReturnType<StateGraph<any, any, any, any, any, any, any>['compile']>,
  runId: string,
  humanInput: HumanInput,
): Promise<void> {
  await compiled.invoke(new Command({ resume: humanInput }), {
    configurable: { thread_id: runId },
  })
}
