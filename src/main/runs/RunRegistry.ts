import { readFile, writeFile, readdir } from 'fs/promises'
import { join } from 'path'
import type { RunRecord, RunStatus } from '../../shared/types'

export class RunRegistry {
  constructor(private dir: string) {}

  async create(runId: string, graphId: string, nodeCount = 0): Promise<RunRecord> {
    const record: RunRecord = {
      runId,
      graphId,
      status: 'running',
      startedAt: new Date().toISOString(),
      nodeCount,
    }
    await this.writeRecord(runId, record)
    console.log('[RunRegistry] Created run:', runId)
    return record
  }

  async update(runId: string, patch: Partial<RunRecord>): Promise<void> {
    const existing = await this.get(runId)
    if (!existing) {
      console.warn('[RunRegistry] Run not found for update:', runId)
      return
    }
    const updated = { ...existing, ...patch }
    await this.writeRecord(runId, updated)
  }

  async updateStatus(runId: string, status: RunStatus): Promise<void> {
    await this.update(runId, { status })
  }

  async list(): Promise<RunRecord[]> {
    try {
      const files = (await readdir(this.dir)).filter((f) => f.endsWith('.json'))
      const records = await Promise.all(
        files.map(async (f) => {
          try {
            const raw = await readFile(join(this.dir, f), 'utf-8')
            return JSON.parse(raw) as RunRecord
          } catch {
            return null
          }
        })
      )
      return records
        .filter((r): r is RunRecord => r !== null)
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    } catch {
      return []
    }
  }

  async get(runId: string): Promise<RunRecord | null> {
    try {
      const raw = await readFile(join(this.dir, `${runId}.json`), 'utf-8')
      return JSON.parse(raw) as RunRecord
    } catch {
      return null
    }
  }

  private async writeRecord(runId: string, record: RunRecord): Promise<void> {
    await writeFile(join(this.dir, `${runId}.json`), JSON.stringify(record, null, 2), 'utf-8')
  }
}
