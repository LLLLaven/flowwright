import { StateGraph, START, END } from '@langchain/langgraph'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText, type CoreMessage } from 'ai'
import { JsonCheckpointer } from './JsonCheckpointer'
import { NodeExecutor } from './NodeExecutor'
import { buildGraph, resumeGraph } from './GraphBuilder'
import type { WorkflowGraph, WorkflowEvent, HumanInput } from '../../shared/types'
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint'

// DeepSeek Anthropic-compatible endpoint
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/anthropic'

interface GraphState {
  messages: CoreMessage[]
}

export class WorkflowEngine {
  private checkpointer: BaseCheckpointSaver
  private executor: NodeExecutor
  private activeRuns = new Map<string, ReturnType<typeof buildGraph>>()

  constructor(checkpointsDir: string) {
    this.checkpointer = new JsonCheckpointer(checkpointsDir)
    this.executor = new NodeExecutor()
    console.log('[WorkflowEngine] Initialized with JsonCheckpointer:', checkpointsDir)
  }

  // ─── Phase 0 compatibility (kept for testing) ──────────────────────────

  async runSingleNode(userMessage: string, apiKey: string): Promise<string> {
    const deepseek = createAnthropic({
      apiKey,
      baseURL: DEEPSEEK_BASE_URL,
    })

    const graph = new StateGraph<GraphState>({
      channels: {
        messages: { reducer: (a: CoreMessage[], b: CoreMessage[]) => [...a, ...b], default: () => [] },
      },
    })
      .addNode('agent', async (state) => {
        const { text } = await generateText({
          model: deepseek('deepseek-v4-flash'),
          messages: state.messages,
        })
        return { messages: [{ role: 'assistant', content: text }] }
      })
      .addEdge(START, 'agent')
      .addEdge('agent', END)
      .compile({ checkpointer: this.checkpointer })

    const result = await graph.invoke(
      { messages: [{ role: 'user' as const, content: userMessage }] },
      { configurable: { thread_id: 'test-run' } }
    )

    const last = result.messages[result.messages.length - 1]
    const output = typeof last.content === 'string' ? last.content : JSON.stringify(last.content)
    console.log('[WorkflowEngine] LLM output:', output)
    return output
  }

  // ─── Phase 1: Graph execution ───────────────────────────────────────────

  async runGraph(
    graph: WorkflowGraph,
    runId: string,
    emit: (event: WorkflowEvent) => void,
    initialPrompt?: string,
  ): Promise<void> {
    console.log('[WorkflowEngine] runGraph:', graph.id, 'runId:', runId, 'prompt:', initialPrompt?.slice(0, 50))

    const compiled = buildGraph(graph, this.executor, emit, this.checkpointer, runId, initialPrompt)
    this.activeRuns.set(runId, compiled)

    try {
      const initialMessages: CoreMessage[] = initialPrompt
        ? [{ role: 'user' as const, content: initialPrompt }]
        : []
      await compiled.invoke(
        {
          messages: initialMessages,
          nodeOutputs: {},
          currentNodeId: '',
          retryCount: 0,
          humanFeedback: undefined,
          runId,
        },
        { configurable: { thread_id: runId } },
      )
      emit({ type: 'workflow:done', runId })
    } catch (e) {
      const errMsg = String(e)
      // Check if this is a LangGraph interrupt (human review pause)
      if (errMsg.includes('GraphInterrupt') || errMsg.includes('__interrupt__')) {
        console.log('[WorkflowEngine] Graph interrupted (human review):', runId)
        // Don't emit error — the awaiting_human event was already sent
        return
      }
      console.error('[WorkflowEngine] Graph error:', errMsg)
      emit({ type: 'workflow:error', runId, error: errMsg })
    } finally {
      // Don't remove from activeRuns if paused (human review)
      // We'll check if the run had a human_review node... for now, keep all
    }
  }

  async pause(runId: string): Promise<void> {
    console.log('[WorkflowEngine] Pause requested for:', runId)
    const compiled = this.activeRuns.get(runId)
    if (!compiled) {
      console.warn('[WorkflowEngine] No active run found for pause:', runId)
      return
    }
    // LangGraph handles interrupt internally; we just keep the compiled graph
    // in activeRuns for resume later. The interrupt is automatic from
    // human_review nodes.
  }

  async resume(
    runId: string,
    humanInput: HumanInput,
    emit: (event: WorkflowEvent) => void,
  ): Promise<void> {
    console.log('[WorkflowEngine] Resume:', runId, 'decision:', humanInput.decision)

    const compiled = this.activeRuns.get(runId)
    if (!compiled) {
      throw new Error(`Run not found: ${runId}`)
    }

    try {
      await resumeGraph(compiled, runId, humanInput)
      emit({ type: 'workflow:done', runId })
      this.activeRuns.delete(runId)
    } catch (e) {
      const errMsg = String(e)
      console.error('[WorkflowEngine] Resume error:', errMsg)
      emit({ type: 'workflow:error', runId, error: errMsg })
    }
  }

  async abort(runId: string): Promise<void> {
    console.log('[WorkflowEngine] Abort:', runId)
    this.activeRuns.delete(runId)
  }
}
