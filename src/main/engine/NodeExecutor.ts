import { createAnthropic } from '@ai-sdk/anthropic'
import { streamText, generateObject, type CoreMessage } from 'ai'
import { convertJsonSchemaToZod as parseSchema } from 'zod-from-json-schema'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { NodeConfig, WorkflowEvent } from '../../shared/types'

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/anthropic'

export interface ExecuteResult {
  output: unknown
  passed: boolean
  reason?: string
}

function loadConfigApiKey(): string {
  try {
    const configPath = join(app.getPath('home'), '.flowwright', 'config.json')
    if (existsSync(configPath)) {
      const raw = readFileSync(configPath, 'utf-8')
      const config = JSON.parse(raw)
      return config.apiKey || ''
    }
  } catch {
    // config file missing or malformed — ignore
  }
  return ''
}

function resolveModel(provider?: string, model?: string) {
  const providerId = provider || 'deepseek'
  const modelId = model || 'deepseek-v4-flash'
  // env var takes priority, then config file
  const apiKey = process.env.DEEPSEEK_API_KEY || loadConfigApiKey()

  if (providerId === 'deepseek' || providerId === 'anthropic-compat') {
    const client = createAnthropic({ apiKey, baseURL: DEEPSEEK_BASE_URL })
    return client(modelId)
  }

  throw new Error(`Unsupported provider: ${providerId}`)
}

export class NodeExecutor {
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

      console.log(
        `[NodeExecutor] "${node.id}" structured output start, maxRetries=${maxRetries}, provider=${node.provider ?? 'deepseek'}, model=${node.model ?? 'deepseek-v4-flash'}`,
      )

      let lastError = ''
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const attemptStartedAt = Date.now()
        try {
          const { object } = await generateObject({
            model,
            schema: zodSchema,
            messages,
            ...(system ? { system } : {}),
          })
          console.log(
            `[NodeExecutor] "${node.id}" schema validation attempt ${attempt + 1}/${maxRetries + 1} PASSED in ${Date.now() - attemptStartedAt}ms`,
          )
          emit({ type: 'node:completed', nodeId: node.id, output: object })
          return { output: object, passed: true }
        } catch (e) {
          lastError = String(e)
          console.warn(
            `[NodeExecutor] "${node.id}" schema validation attempt ${attempt + 1}/${maxRetries + 1} FAILED in ${Date.now() - attemptStartedAt}ms:`,
            lastError,
          )
          if (attempt < maxRetries) {
            messages.push({ role: 'user' as const, content: `Output validation failed: ${lastError}. Please fix your output and retry.` })
          }
        }
      }

      console.warn(`[NodeExecutor] "${node.id}" exhausted ${maxRetries + 1} attempt(s) — marking rejected`)
      emit({ type: 'node:rejected', nodeId: node.id, reason: lastError })
      return { output: null, passed: false, reason: lastError }
    }

    // Without outputSchema: use streaming text
    try {
      emit({ type: 'node:started', nodeId: node.id })
      console.log(
        `[NodeExecutor] "${node.id}" streaming start, provider=${node.provider ?? 'deepseek'}, model=${node.model ?? 'deepseek-v4-flash'}`,
      )
      const streamStartedAt = Date.now()
      const result = streamText({
        model,
        messages,
        ...(system ? { system } : {}),
      })

      let fullText = ''
      let chunkCount = 0
      emit({ type: 'node:stream', nodeId: node.id, chunk: '' }) // signal stream started
      for await (const chunk of result.textStream) {
        fullText += chunk
        chunkCount++
        emit({ type: 'node:stream', nodeId: node.id, chunk })
      }

      console.log(
        `[NodeExecutor] "${node.id}" streaming done: ${chunkCount} chunk(s), ${fullText.length} char(s), ${Date.now() - streamStartedAt}ms`,
      )
      emit({ type: 'node:completed', nodeId: node.id, output: fullText })
      return { output: fullText, passed: true }
    } catch (e) {
      const reason = String(e)
      console.error(`[NodeExecutor] "${node.id}" streaming FAILED:`, reason)
      emit({ type: 'node:rejected', nodeId: node.id, reason })
      return { output: null, passed: false, reason }
    }
  }
}
