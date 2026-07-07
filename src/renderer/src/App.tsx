import { useState, useCallback, useRef } from 'react'
import TitleBar from './components/TitleBar'
import TopBar from './components/TopBar'
import LeftBar, { type LeftView } from './components/LeftBar'
import LeftPanel from './components/LeftPanel'
import WorkflowCanvas, { type WorkflowCanvasHandle } from './components/WorkflowCanvas'
import NodeConfigPanel from './components/NodeConfigPanel'
import StatusBar from './components/StatusBar'
import { RunMonitorProvider, useRunMonitor } from './components/RunMonitor'
import HumanReviewPanel from './components/HumanReviewPanel'
import type { NodeConfig } from '../../shared/types'
import type { NodeStatus } from './components/AgentNode'

type RunState = 'ready' | 'running' | 'paused'

function AppInner(): JSX.Element {
  // ── Layout state ──────────────────────────────────────────────
  const [leftView, setLeftView] = useState<LeftView | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [editingNode, setEditingNode] = useState<NodeConfig | null>(null)
  const [rightOpen, setRightOpen] = useState(false)

  // ── Workflow meta ─────────────────────────────────────────────
  const [graphName, setGraphName] = useState('Untitled Workflow')
  const [unsaved, setUnsaved] = useState(false)
  const [dark, setDark] = useState(true)

  // ── Run / prompt state ────────────────────────────────────────
  const [runState, setRunState] = useState<RunState>('ready')
  const [prompt, setPrompt] = useState('')

  // ── Graph stats (updated from WorkflowCanvas) ─────────────────
  // TODO: derive from canvasRef (expose getNodeCount/getEdgeCount on WorkflowCanvasHandle)
  const [nodeCount, setNodeCount] = useState(0)
  const [edgeCount, setEdgeCount] = useState(0)

  // ── Refs ──────────────────────────────────────────────────────
  const canvasRef = useRef<WorkflowCanvasHandle>(null)

  // ── Run monitor context ───────────────────────────────────────
  const { nodeStatuses, nodeStreams, pendingReview, startRun, clearReview } =
    useRunMonitor()

  // ── Callbacks ─────────────────────────────────────────────────

  const handleToggleTheme = useCallback(() => {
    setDark((prev) => !prev)
  }, [])

  const handleSave = useCallback(async () => {
    await canvasRef.current?.handleSave()
    setUnsaved(false)
  }, [])

  const handleAddNode = useCallback(() => {
    canvasRef.current?.addNode()
    setUnsaved(true)
  }, [])

  const handleToggleRun = useCallback(() => {
    switch (runState) {
      case 'ready':
        canvasRef.current?.handleRun()
        setRunState('running')
        break
      case 'running':
        setRunState('paused')
        break
      case 'paused':
        setRunState('running')
        break
    }
  }, [runState])

  const handleStop = useCallback(() => {
    setRunState('ready')
  }, [])

  const handlePromptChange = useCallback((v: string) => {
    setPrompt(v)
  }, [])

  const handleNodeClick = useCallback((nodeId: string, config: NodeConfig) => {
    setSelectedNodeId(nodeId)
    setEditingNode(config)
    setRightOpen(true)
  }, [])

  const handleNodeUpdate = useCallback(
    (patch: Partial<NodeConfig>) => {
      if (!editingNode) return
      const updated = { ...editingNode, ...patch }
      setEditingNode(updated)
      canvasRef.current?.updateNodeData(updated.id, patch)
    },
    [editingNode],
  )

  const handleClosePanel = useCallback(() => {
    setRightOpen(false)
    setSelectedNodeId(null)
    setEditingNode(null)
  }, [])

  const handleRunStart = useCallback(
    (runId: string) => {
      startRun(runId)
      setRunState('running')
    },
    [startRun],
  )

  const handleLeftSelect = useCallback((view: LeftView) => {
    setLeftView((prev) => (prev === view ? null : view))
  }, [])

  const handleLeftClose = useCallback(() => {
    setLeftView(null)
  }, [])

  // ── Derived ───────────────────────────────────────────────────
  const running = runState !== 'ready'

  // ── Render: 6-zone layout ─────────────────────────────────────
  return (
    <div className="flex size-full flex-col overflow-hidden bg-[#0f172a] text-slate-200">
      {/* Zone 1: TitleBar */}
      <TitleBar
        workflowName={graphName}
        unsaved={unsaved}
        dark={dark}
        onToggleTheme={handleToggleTheme}
      />

      {/* Zone 2: TopBar */}
      <TopBar
        runState={runState}
        onToggleRun={handleToggleRun}
        onStop={handleStop}
        prompt={prompt}
        onPromptChange={handlePromptChange}
        onSave={handleSave}
        onAddNode={handleAddNode}
        running={running}
      />

      {/* Zone 3-6: Main content */}
      <div className="flex min-h-0 flex-1">
        {/* Zone 3: LeftBar */}
        <LeftBar active={leftView} onSelect={handleLeftSelect} />

        {/* Zone 4: LeftPanel (conditional) */}
        {leftView && <LeftPanel view={leftView} onClose={handleLeftClose} />}

        {/* Zone 5: Canvas */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <WorkflowCanvas
            ref={canvasRef}
            prompt={prompt}
            running={running}
            nodeStatuses={nodeStatuses}
            nodeStreams={nodeStreams}
            onNodeClick={handleNodeClick}
            onRunStart={handleRunStart}
          />
        </div>

        {/* Zone 6: NodeConfigPanel / RightPanel (conditional) */}
        {rightOpen && selectedNodeId && editingNode && (
          <NodeConfigPanel
            node={editingNode}
            onUpdate={handleNodeUpdate}
            onClose={handleClosePanel}
          />
        )}
      </div>

      {/* StatusBar */}
      <StatusBar state={runState} nodeCount={nodeCount} edgeCount={edgeCount} />

      {/* Human Review modal (overlay) */}
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
