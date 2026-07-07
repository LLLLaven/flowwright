import { readFile, writeFile, readdir, unlink } from 'fs/promises'
import { join } from 'path'
import type { WorkflowGraph } from '../../shared/types'

export class WorkflowStore {
  constructor(private dir: string) {}

  async save(graph: WorkflowGraph): Promise<void> {
    const filePath = join(this.dir, `${graph.id}.json`)
    const stamped: WorkflowGraph = { ...graph, updatedAt: new Date().toISOString() }
    await writeFile(filePath, JSON.stringify(stamped, null, 2), 'utf-8')
    console.log('[WorkflowStore] Saved:', filePath, 'nodes:', graph.nodes.length, 'edges:', graph.edges.length)
  }

  async load(graphId: string): Promise<WorkflowGraph> {
    const filePath = join(this.dir, `${graphId}.json`)
    const raw = await readFile(filePath, 'utf-8')
    return JSON.parse(raw) as WorkflowGraph
  }

  async list(): Promise<WorkflowGraph[]> {
    try {
      const files = (await readdir(this.dir)).filter((f) => f.endsWith('.json'))
      const graphs = await Promise.all(
        files.map(async (f) => {
          try {
            return await this.load(f.replace('.json', ''))
          } catch {
            return null
          }
        })
      )
      return graphs.filter((g): g is WorkflowGraph => g !== null)
    } catch {
      return []
    }
  }

  async delete(graphId: string): Promise<void> {
    const filePath = join(this.dir, `${graphId}.json`)
    await unlink(filePath)
    console.log('[WorkflowStore] Deleted:', filePath)
  }
}
