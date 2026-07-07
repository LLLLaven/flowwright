import { createAnthropic } from '@ai-sdk/anthropic'
import { streamText, generateObject, type CoreMessage } from 'ai'
import { parseSchema } from 'zod-from-json-schema'
import type { NodeConfig, WorkflowEvent } from '../../shared/types'

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/anthropic'

export interface ExecuteResult {
  output: unknown
  passed: boolean
  reason?: string
}

function resolveModel(provider?: string, model?: string) {
  const providerId = provider || 'deepseek'
  const modelId = model || 'deepseek-v4-flash'
  const apiKey = process.env.DEEPSEEK_API_KEY ?? ''

  if (providerId === 'deepseek' || providerId === 'anthropic-compat') {
    const client = createAnthropic({ apiKey, baseURL: DEEPSEEK_BASE_URL })
    return client(modelId)
  }

  throw new Error(`Unsupported provider: ${providerId}`)
}

export class NodeExecutor {
  constructor(private apiKey?: string) {}

  async execute(
    node: NodeConfig,
    messages: CoreMessage[],
    emit: (event: WorkflowEvent) => void,
  ): Promise<ExecuteResult> {
    const model = resolveModel(node.provider, node.model)
    const maxRetries = node.maxRetries ?? 2
    const system = node.systemPrompt

    // With outputSchema: use structured output (generateObject)
    if (node.outputSchema && Object.keys(node.outputSchema).length > 0) {
      let zodSchema: ReturnType<typeof parseSchema>
      try {
        zodSchema = parseSchema(node.outputSchema)
      } catch (e) {
        emit({ type: 'node:rejected', nodeId: node.id, reason: `Schema parse error: ${String(e)}` })
        return { output: null, passed: false, reason: `Invalid JSON Schema: ${String(e)}` }
      }

      let lastError = ''
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const { object } = await generateObject({
            model,
            schema: zodSchema,
            messages,
            ...(system ? { system } : {}),
          })
          emit({ type: 'node:completed', nodeId: node.id, output: object })
          return { output: object, passed: true }
        } catch (e) {
          lastError = String(e)
          console.warn(`[NodeExecutor] Attempt ${attempt + 1}/${maxRetries + 1} failed for node "${node.id}":`, lastError)
          if (attempt < maxRetries) {
            messages.push({ role: 'user' as const, content: `Output validation failed: ${lastError}. Please fix your output and retry.` })
          }
        }
      }

      emit({ type: 'node:rejected', nodeId: node.id, reason: lastError })
      return { output: null, passed: false, reason: lastError }
    }

    // Without outputSchema: use streaming text
    try {
      emit({ type: 'node:started', nodeId: node.id })
      const result = streamText({
        model,
        messages,
        ...(system ? { system } : {}),
      })

      let fullText = ''
      emit({ type: 'node:stream', nodeId: node.id, chunk: '' }) // signal stream started
      for await (const chunk of result.textStream) {
        fullText += chunk
        emit({ type: 'node:stream', nodeId: node.id, chunk })
      }

      emit({ type: 'node:completed', nodeId: node.id, output: fullText })
      return { output: fullText, passed: true }
    } catch (e) {
      const reason = String(e)
      emit({ type: 'node:rejected', nodeId: node.id, reason })
      return { output: null, passed: false, reason }
    }
  }
}
