import * as fs from 'fs/promises'
import * as path from 'path'
import { BaseCheckpointSaver, uuid6 } from '@langchain/langgraph-checkpoint'
import type {
  Checkpoint,
  CheckpointTuple,
  CheckpointListOptions,
  CheckpointMetadata,
  CheckpointPendingWrite,
  PendingWrite,
  ChannelVersions
} from '@langchain/langgraph-checkpoint'
import type { RunnableConfig } from '@langchain/core/runnables'

interface CheckpointFile {
  checkpoint: Checkpoint
  metadata: CheckpointMetadata
  pendingWrites: CheckpointPendingWrite[]
  parentConfig?: RunnableConfig
}

export class JsonCheckpointer extends BaseCheckpointSaver {
  private checkpointsDir: string

  constructor(checkpointsDir: string) {
    super()
    this.checkpointsDir = checkpointsDir
    console.log('[JsonCheckpointer] Initialized with dir:', checkpointsDir)
  }

  /**
   * Resolve the directory for a given thread_id (and optional checkpoint_ns).
   */
  private threadDir(threadId: string, checkpointNs: string = ''): string {
    return checkpointNs
      ? path.join(this.checkpointsDir, threadId, checkpointNs)
      : path.join(this.checkpointsDir, threadId)
  }

  /**
   * Full file path for a given checkpoint.
   */
  private filePath(threadId: string, checkpointId: string, checkpointNs: string = ''): string {
    return path.join(this.threadDir(threadId, checkpointNs), `${checkpointId}.json`)
  }

  /**
   * Read a single checkpoint file and return its contents.
   */
  private async readFile(config: RunnableConfig): Promise<CheckpointFile | undefined> {
    const threadId = config.configurable?.thread_id
    const checkpointId = config.configurable?.checkpoint_id
    const checkpointNs = config.configurable?.checkpoint_ns || ''

    if (!threadId) {
      console.warn('[JsonCheckpointer] readFile: no thread_id in config')
      return undefined
    }

    if (!checkpointId) {
      // No specific checkpoint requested — find the latest by mtime
      return this.readLatest(threadId, checkpointNs)
    }

    const fp = this.filePath(threadId, checkpointId, checkpointNs)
    try {
      const raw = await fs.readFile(fp, 'utf-8')
      return JSON.parse(raw) as CheckpointFile
    } catch {
      return undefined
    }
  }

  /**
   * Read the latest checkpoint file in a thread directory (by mtime).
   */
  private async readLatest(threadId: string, checkpointNs: string): Promise<CheckpointFile | undefined> {
    const dir = this.threadDir(threadId, checkpointNs)
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      const files = entries
        .filter((e) => e.isFile() && e.name.endsWith('.json'))
        .map((e) => path.join(dir, e.name))

      if (files.length === 0) return undefined

      // Get stats for all files and pick the newest by mtime
      let latest: { fp: string; mtime: number } | null = null
      for (const fp of files) {
        try {
          const stat = await fs.stat(fp)
          if (!latest || stat.mtimeMs > latest.mtime) {
            latest = { fp, mtime: stat.mtimeMs }
          }
        } catch {
          // file may have been deleted between readdir and stat
        }
      }

      if (!latest) return undefined

      const raw = await fs.readFile(latest.fp, 'utf-8')
      return JSON.parse(raw) as CheckpointFile
    } catch {
      return undefined
    }
  }

  // ---- BaseCheckpointSaver abstract methods ----

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const file = await this.readFile(config)
    if (!file) return undefined

    const threadId = config.configurable?.thread_id!
    const checkpointNs = config.configurable?.checkpoint_ns || ''

    return {
      config: {
        configurable: {
          thread_id: threadId,
          checkpoint_ns: checkpointNs,
          checkpoint_id: file.checkpoint.id
        }
      },
      checkpoint: file.checkpoint,
      metadata: file.metadata,
      parentConfig: file.parentConfig,
      pendingWrites: file.pendingWrites
    }
  }

  async *list(
    config: RunnableConfig,
    options?: CheckpointListOptions
  ): AsyncGenerator<CheckpointTuple> {
    const threadId = config.configurable?.thread_id
    const checkpointNs = config.configurable?.checkpoint_ns || ''

    if (!threadId) return

    const dir = this.threadDir(threadId, checkpointNs)

    let entries: { name: string; mtimeMs: number }[]
    try {
      const dirents = await fs.readdir(dir, { withFileTypes: true })
      const stats: { name: string; mtimeMs: number }[] = []
      for (const d of dirents) {
        if (!d.isFile() || !d.name.endsWith('.json')) continue
        try {
          const st = await fs.stat(path.join(dir, d.name))
          stats.push({ name: d.name, mtimeMs: st.mtimeMs })
        } catch {
          // skip deleted files
        }
      }
      // Sort by mtime descending (newest first)
      stats.sort((a, b) => b.mtimeMs - a.mtimeMs)
      entries = stats
    } catch {
      return
    }

    // Apply before filter: only yield checkpoints older than `before`
    let beforeTs: string | undefined
    if (options?.before) {
      const beforeFile = await this.readFile(options.before)
      beforeTs = beforeFile?.checkpoint.ts
    }

    let yielded = 0
    const limit = options?.limit

    for (const entry of entries) {
      if (limit !== undefined && yielded >= limit) break

      const fp = path.join(dir, entry.name)
      let raw: string
      try {
        raw = await fs.readFile(fp, 'utf-8')
      } catch {
        continue
      }

      const file = JSON.parse(raw) as CheckpointFile

      // Skip if before filter is set and this checkpoint is not older
      if (beforeTs && file.checkpoint.ts >= beforeTs) continue

      const checkpointId = file.checkpoint.id

      yield {
        config: {
          configurable: {
            thread_id: threadId,
            checkpoint_ns: checkpointNs,
            checkpoint_id: checkpointId
          }
        },
        checkpoint: file.checkpoint,
        metadata: file.metadata,
        parentConfig: file.parentConfig,
        pendingWrites: file.pendingWrites
      }

      yielded++
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    _newVersions: ChannelVersions
  ): Promise<RunnableConfig> {
    const threadId = config.configurable?.thread_id
    const checkpointNs = config.configurable?.checkpoint_ns || ''

    if (!threadId) {
      throw new Error('[JsonCheckpointer] put: thread_id is required in config.configurable')
    }

    // Generate checkpoint ID if not already set
    if (!checkpoint.id) {
      checkpoint.id = uuid6(Date.now())
    }
    // Set timestamp if not already set
    if (!checkpoint.ts) {
      checkpoint.ts = new Date().toISOString()
    }

    const dir = this.threadDir(threadId, checkpointNs)
    await fs.mkdir(dir, { recursive: true })

    // Load existing pending writes if any
    let pendingWrites: CheckpointPendingWrite[] = []
    const existingFile = config.configurable?.checkpoint_id
      ? await this.readFile(config)
      : undefined
    if (existingFile?.pendingWrites) {
      pendingWrites = existingFile.pendingWrites
    }

    const file: CheckpointFile = {
      checkpoint,
      metadata,
      pendingWrites,
      parentConfig: metadata.parents
        ? {
            configurable: {
              thread_id: threadId,
              checkpoint_ns: checkpointNs,
              checkpoint_id: Object.values(metadata.parents)[0]
            }
          }
        : undefined
    }

    const fp = this.filePath(threadId, checkpoint.id, checkpointNs)
    await fs.writeFile(fp, JSON.stringify(file, null, 2), 'utf-8')

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
        checkpoint_id: checkpoint.id
      }
    }
  }

  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string
  ): Promise<void> {
    const threadId = config.configurable?.thread_id
    const checkpointNs = config.configurable?.checkpoint_ns || ''
    const checkpointId = config.configurable?.checkpoint_id

    if (!threadId || !checkpointId) {
      console.warn('[JsonCheckpointer] putWrites: thread_id and checkpoint_id are required')
      return
    }

    const fp = this.filePath(threadId, checkpointId, checkpointNs)

    let file: CheckpointFile
    try {
      const raw = await fs.readFile(fp, 'utf-8')
      file = JSON.parse(raw) as CheckpointFile
    } catch {
      // If the checkpoint file doesn't exist yet, create a minimal one
      file = {
        checkpoint: {
          v: 1,
          id: checkpointId,
          ts: new Date().toISOString(),
          channel_values: {},
          channel_versions: {},
          versions_seen: {},
          pending_sends: []
        },
        metadata: {
          source: 'loop',
          step: 0,
          writes: null,
          parents: {}
        },
        pendingWrites: []
      }
    }

    // Remove any existing writes for this taskId
    file.pendingWrites = file.pendingWrites.filter((w) => w[0] !== taskId)

    // Append new writes as [taskId, channel, value] tuples
    for (const write of writes) {
      file.pendingWrites.push([taskId, write[0], write[1]])
    }

    await fs.mkdir(path.dirname(fp), { recursive: true })
    await fs.writeFile(fp, JSON.stringify(file, null, 2), 'utf-8')
  }
}
