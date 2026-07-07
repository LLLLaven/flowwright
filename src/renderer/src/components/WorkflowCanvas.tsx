import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  type Connection,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import AgentNode, { type AgentNodeData, type NodeStatus } from './AgentNode'
import { ipc } from '../lib/ipc'
import type { WorkflowGraph, NodeConfig, EdgeConfig } from '../../../shared/types'

interface WorkflowCanvasProps {
  nodeStatuses: Map<string, NodeStatus>
  onNodeClick: (nodeId: string) => void
  onRunStart: (runId: string) => void
}

// Default node data when creating a new node
function createDefaultNode(overrides: Partial<NodeConfig> = {}): NodeConfig {
  return {
    id: crypto.randomUUID(),
    label: 'New Agent',
    type: 'agent',
    position: { x: 0, y: 0 },
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
    systemPrompt: '',
    maxRetries: 2,
    ...overrides,
  }
}

function graphToFlow(graph: WorkflowGraph): { nodes: Node<AgentNodeData>[]; edges: Edge[] } {
  const nodes: Node<AgentNodeData>[] = graph.nodes.map((n) => ({
    id: n.id,
    type: n.type === 'human_review' ? 'agent' : 'agent', // reuse AgentNode for human_review
    position: n.position,
    data: { ...n, status: 'idle' as NodeStatus },
  }))

  const edges: Edge[] = graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.condition ?? '',
    animated: true,
  }))

  return { nodes, edges }
}

function flowToGraph(
  graphId: string,
  graphName: string,
  flowNodes: Node<AgentNodeData>[],
  flowEdges: Edge[],
): WorkflowGraph {
  const nodes: NodeConfig[] = flowNodes.map((n) => ({
    id: n.id,
    label: n.data.label,
    type: n.data.type,
    position: n.position,
    provider: n.data.provider,
    model: n.data.model,
    systemPrompt: n.data.systemPrompt,
    outputSchema: n.data.outputSchema,
    maxRetries: n.data.maxRetries,
  }))

  const edges: EdgeConfig[] = flowEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    condition: (e.label as EdgeConfig['condition']) || undefined,
  }))

  return {
    id: graphId,
    name: graphName,
    globalDefaults: { provider: 'deepseek', model: 'deepseek-v4-flash' },
    nodes,
    edges,
  }
}

export default function WorkflowCanvas({ nodeStatuses, onNodeClick, onRunStart }: WorkflowCanvasProps) {
  const [graphId] = useState(() => 'graph-' + Date.now())
  const [graphName] = useState('Untitled Workflow')
  const [nodes, setNodes, onNodesChange] = useNodesState<AgentNodeData>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [prompt, setPrompt] = useState('')
  const [running, setRunning] = useState(false)
  const initialLoadRef = useRef(false)

  // Apply statuses from RunMonitor
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        const status = nodeStatuses.get(n.id)
        return status ? { ...n, data: { ...n.data, status } } : n
      }),
    )
  }, [nodeStatuses, setNodes])

  // Load first saved graph on mount
  useEffect(() => {
    if (initialLoadRef.current) return
    initialLoadRef.current = true
    ipc.workflow.list().then((records) => {
      if (!records || records.length === 0) {
        // No saved graphs — start empty
        return
      }
      // Load the most recent graph (records are sorted by startedAt desc)
      // Actually, we need the graph, not the run. Load by graphId from the most recent run.
      const latestRun = records[0]
      try {
        // Try loading the graph directly by its id
        const json = JSON.stringify({ id: latestRun.graphId, name: '', globalDefaults: { provider: 'deepseek', model: 'deepseek-v4-flash' }, nodes: [], edges: [] })
        // We can't load the graph via ipc.workflow.load since it needs graphJson
        // For now, start empty
      } catch {
        // ignore
      }
    })
  }, [])

  const onConnect = useCallback(
    (connection: Connection) => {
      const edge: Edge = {
        id: `e-${connection.source}-${connection.target}`,
        source: connection.source!,
        target: connection.target!,
      }
      setEdges((eds) => addEdge(edge, eds))
    },
    [setEdges],
  )

  const addNode = useCallback(() => {
    const newNode: Node<AgentNodeData> = {
      id: crypto.randomUUID(),
      type: 'agent',
      position: { x: 100 + Math.random() * 300, y: 100 + Math.random() * 300 },
      data: createDefaultNode(),
    }
    setNodes((nds) => [...nds, newNode])
  }, [setNodes])

  const deleteSelected = useCallback(() => {
    setNodes((nds) => nds.filter((n) => !n.selected))
    setEdges((eds) => eds.filter((e) => !e.selected))
  }, [setNodes, setEdges])

  const handleSave = useCallback(async () => {
    const graph = flowToGraph(graphId, graphName, nodes, edges)
    await ipc.workflow.save(graph)
    console.log('[WorkflowCanvas] Saved graph:', graphId)
    alert('Workflow saved!')
  }, [graphId, graphName, nodes, edges])

  const handleRun = useCallback(async () => {
    if (nodes.length === 0) {
      alert('Add at least one node to the canvas.')
      return
    }
    setRunning(true)
    // Save first, then run
    const graph = flowToGraph(graphId, graphName, nodes, edges)
    await ipc.workflow.save(graph)
    const runId = await ipc.workflow.run(graphId, prompt || undefined)
    onRunStart(runId)
    // Reset running when workflow completes (workflow:done/error event in RunMonitor)
    setTimeout(() => setRunning(false), 500)
  }, [graphId, graphName, nodes, edges, prompt, onRunStart])

  const handleNodeClick = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      onNodeClick(node.id)
    },
    [onNodeClick],
  )

  const nodeTypes = useMemo(() => ({ agent: AgentNode }), [])

  // Listen for Delete key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't delete if user is typing in an input
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        deleteSelected()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [deleteSelected])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '8px 16px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          alignItems: 'center',
        }}
      >
        <button onClick={addNode} style={toolbarBtnStyle}>+ Add Node</button>
        <button onClick={deleteSelected} style={toolbarBtnStyle}>🗑 Delete</button>

        {/* Prompt input */}
        <input
          type="text"
          placeholder="Type your task / prompt here..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRun() } }}
          style={{
            flex: 1,
            padding: '6px 10px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: 13,
            fontFamily: 'sans-serif',
            outline: 'none',
          }}
        />

        <button onClick={handleSave} style={toolbarBtnStyle}>💾 Save</button>
        <button
          onClick={handleRun}
          disabled={running}
          style={{ ...toolbarBtnStyle, backgroundColor: running ? '#93c5fd' : '#3b82f6', color: '#fff' }}
        >
          {running ? '⏳' : '▶'} Run
        </button>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={['Backspace', 'Delete']}
        >
          <Controls />
          <MiniMap />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
      </div>
    </div>
  )
}

const toolbarBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  backgroundColor: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: 'sans-serif',
}
