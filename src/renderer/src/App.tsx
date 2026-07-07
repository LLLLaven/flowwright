import { useState, useCallback } from 'react'
import WorkflowCanvas from './components/WorkflowCanvas'
import NodeConfigPanel from './components/NodeConfigPanel'
import { RunMonitorProvider, useRunMonitor } from './components/RunMonitor'
import HumanReviewPanel from './components/HumanReviewPanel'
import HistoryPanel from './components/HistoryPanel'
import type { NodeConfig } from '../../shared/types'

type Tab = 'canvas' | 'history'

function AppInner(): JSX.Element {
  const [tab, setTab] = useState<Tab>('canvas')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [editingNode, setEditingNode] = useState<NodeConfig | null>(null)
  const [canvasNodeConfigs, setCanvasNodeConfigs] = useState<Map<string, NodeConfig>>(new Map())

  const { nodeStatuses, pendingReview, startRun, clearReview } = useRunMonitor()

  const tabs: { key: Tab; label: string }[] = [
    { key: 'canvas', label: 'Canvas' },
    { key: 'history', label: 'History' },
  ]

  // When a node is clicked on the canvas, open the config panel
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId)
      const config = canvasNodeConfigs.get(nodeId)
      if (config) {
        setEditingNode(config)
      }
    },
    [canvasNodeConfigs],
  )

  // Update node config (from config panel)
  const handleNodeUpdate = useCallback(
    (patch: Partial<NodeConfig>) => {
      if (!editingNode) return
      const updated = { ...editingNode, ...patch }
      setEditingNode(updated)
      setCanvasNodeConfigs((prev) => {
        const next = new Map(prev)
        next.set(updated.id, updated)
        return next
      })
    },
    [editingNode],
  )

  const handleClosePanel = useCallback(() => {
    setSelectedNodeId(null)
    setEditingNode(null)
  }, [])

  const handleRunStart = useCallback(
    (runId: string) => {
      startRun(runId)
    },
    [startRun],
  )

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid #e5e7eb',
          padding: '0 16px',
          backgroundColor: '#f9fafb',
        }}
      >
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: tab === key ? '2px solid #3b82f6' : '2px solid transparent',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: tab === key ? 600 : 400,
              color: tab === key ? '#3b82f6' : '#6b7280',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {tab === 'canvas' ? (
          <>
            {/* Canvas area */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <WorkflowCanvas
                nodeStatuses={nodeStatuses}
                onNodeClick={handleNodeClick}
                onRunStart={handleRunStart}
              />
            </div>

            {/* Config sidebar */}
            {selectedNodeId && editingNode && (
              <NodeConfigPanel
                node={editingNode}
                onUpdate={handleNodeUpdate}
                onClose={handleClosePanel}
              />
            )}
          </>
        ) : (
          <div style={{ flex: 1, overflow: 'auto' }}>
            <HistoryPanel />
          </div>
        )}
      </div>

      {/* Human Review modal */}
      {pendingReview && (
        <HumanReviewPanel review={pendingReview} onClose={clearReview} />
      )}
    </div>
  )
}

export default function App(): JSX.Element {
  return (
    <RunMonitorProvider>
      <AppInner />
    </RunMonitorProvider>
  )
}
