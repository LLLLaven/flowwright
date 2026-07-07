import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { ipc } from '../lib/ipc'
import type { WorkflowEvent } from '../../../shared/types'

export type NodeStatus = 'idle' | 'running' | 'completed' | 'rejected' | 'awaiting_human'

export interface PendingReview {
  runId: string
  nodeId: string
  deliverable: unknown
}

interface RunMonitorContextValue {
  nodeStatuses: Map<string, NodeStatus>
  activeRunId: string | null
  pendingReview: PendingReview | null
  startRun: (runId: string) => void
  clearReview: () => void
}

const RunMonitorContext = createContext<RunMonitorContextValue>({
  nodeStatuses: new Map(),
  activeRunId: null,
  pendingReview: null,
  startRun: () => {},
  clearReview: () => {},
})

export function useRunMonitor(): RunMonitorContextValue {
  return useContext(RunMonitorContext)
}

export function RunMonitorProvider({ children }: { children: ReactNode }) {
  const [nodeStatuses, setNodeStatuses] = useState<Map<string, NodeStatus>>(new Map())
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(null)

  const startRun = useCallback((runId: string) => {
    setActiveRunId(runId)
    setNodeStatuses(new Map())
    setPendingReview(null)
  }, [])

  const clearReview = useCallback(() => {
    setPendingReview(null)
  }, [])

  useEffect(() => {
    ipc.on.runEvent((runId: string, event: unknown) => {
      const evt = event as WorkflowEvent

      setNodeStatuses((prev) => {
        const next = new Map(prev)

        switch (evt.type) {
          case 'node:started':
            next.set(evt.nodeId, 'running')
            break
          case 'node:completed':
            next.set(evt.nodeId, 'completed')
            break
          case 'node:rejected':
            next.set(evt.nodeId, 'rejected')
            break
          case 'node:awaiting_human':
            next.set(evt.nodeId, 'awaiting_human')
            setPendingReview({
              runId,
              nodeId: evt.nodeId,
              deliverable: evt.deliverable,
            })
            break
          case 'workflow:done':
            setActiveRunId(null)
            break
          case 'workflow:error':
            setActiveRunId(null)
            break
          // node:stream doesn't change status
        }

        return next
      })
    })
  }, [])

  return (
    <RunMonitorContext.Provider
      value={{ nodeStatuses, activeRunId, pendingReview, startRun, clearReview }}
    >
      {children}
    </RunMonitorContext.Provider>
  )
}
