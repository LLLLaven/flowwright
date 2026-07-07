import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react'
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

export interface WorkflowCanvasHandle {
  /** Applies a config patch to a node's data. */
  updateNodeData: (nodeId: string, patch: Partial<NodeConfig>) => void
  /** Adds a new agent node to the canvas at a random position. */
  addNode: () => void
  /** Saves the current workflow graph to disk. */
  handleSave: () => Promise<void>
  /** Saves and runs the current workflow graph. */
  handleRun: () => Promise<void>
}

interface WorkflowCanvasProps {
  prompt: string
  running: boolean
  nodeStatuses: Map<string, NodeStatus>
  nodeStreams: Map<string, string>
  onNodeClick: (nodeId: string, config: NodeConfig) => void
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

  const nodeIds = new Set(nodes.map((n) => n.id))
  const edges: Edge[] = graph.edges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e) => ({
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

  const nodeIds = new Set(nodes.map((n) => n.id))
  const edges: EdgeConfig[] = flowEdges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e) => ({
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

const WorkflowCanvas = forwardRef<WorkflowCanvasHandle, WorkflowCanvasProps>(function WorkflowCanvas(
  { prompt, running, nodeStatuses, nodeStreams, onNodeClick, onRunStart },
  ref,
) {
  const [graphId, setGraphId] = useState(() => 'graph-' + Date.now())
  const [graphName, setGraphName] = useState('Untitled Workflow')
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<AgentNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const initialLoadRef = useRef(false)

  // ── Imperative handle (exposed to parent) ──────────────────────────────

  const addNode = useCallback(() => {
    const newNode: Node<AgentNodeData> = {
      id: crypto.randomUUID(),
      type: 'agent',
      position: { x: 100 + Math.random() * 300, y: 100 + Math.random() * 300 },
      data: { ...createDefaultNode(), status: 'idle' as NodeStatus },
    }
    setNodes((nds) => [...nds, newNode])
  }, [setNodes])

  const deleteSelected = useCallback(() => {
    let deletedNodeIds: Set<string> = new Set()
    setNodes((nds) => {
      deletedNodeIds = new Set(nds.filter((n) => n.selected).map((n) => n.id))
      return nds.filter((n) => !n.selected)
    })
    setEdges((eds) =>
      eds.filter((e) => !e.selected && !deletedNodeIds.has(e.source) && !deletedNodeIds.has(e.target)),
    )
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
    // Save first, then run
    const graph = flowToGraph(graphId, graphName, nodes, edges)
    await ipc.workflow.save(graph)
    const runId = await ipc.workflow.run(graphId, prompt || undefined)
    onRunStart(runId)
  }, [graphId, graphName, nodes, edges, prompt, onRunStart])

  useImperativeHandle(
    ref,
    () => ({
      updateNodeData: (nodeId, patch) => {
        setNodes((nds) =>
          nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n)),
        )
      },
      addNode,
      handleSave,
      handleRun,
    }),
    [setNodes, addNode, handleSave, handleRun],
  )

  // ── Apply statuses + stream text from RunMonitor ───────────────────────

  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        const status = nodeStatuses.get(n.id)
        const streamText = nodeStreams.get(n.id)
        if (status === undefined && streamText === undefined) return n
        return {
          ...n,
          data: {
            ...n.data,
            ...(status !== undefined ? { status } : {}),
            ...(streamText !== undefined ? { streamText } : {}),
          },
        }
      }),
    )
  }, [nodeStatuses, nodeStreams, setNodes])

  // ── Load the most recently saved graph on mount ────────────────────────

  useEffect(() => {
    if (initialLoadRef.current) return
    initialLoadRef.current = true
    ipc.workflow
      .listGraphs()
      .then((graphs) => {
        if (!graphs || graphs.length === 0) return
        const latest = [...graphs].sort(
          (a, b) =>
            new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime(),
        )[0]
        setGraphId(latest.id)
        setGraphName(latest.name)
        const { nodes: flowNodes, edges: flowEdges } = graphToFlow(latest)
        setNodes(flowNodes)
        setEdges(flowEdges)
        console.log('[WorkflowCanvas] Loaded saved graph:', latest.id, 'nodes:', flowNodes.length)
      })
      .catch((e) => console.error('[WorkflowCanvas] Failed to load saved graphs:', e))
  }, [setNodes, setEdges])

  // ── Edge connection handler ────────────────────────────────────────────

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

  // ── Node click handler ─────────────────────────────────────────────────

  const handleNodeClick = useCallback(
    (_e: React.MouseEvent, node: Node<AgentNodeData>) => {
      const { status: _status, streamText: _streamText, ...config } = node.data
      onNodeClick(node.id, config)
    },
    [onNodeClick],
  )

  const nodeTypes = useMemo(() => ({ agent: AgentNode }), [])

  // ── Keyboard handler (Delete / Backspace) ──────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="relative flex-1 overflow-hidden bg-[#0f172a]">
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
        <Controls className="[&>button]:!bg-slate-800 [&>button]:!border-slate-600 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-700 [&>svg]:!fill-slate-400" />
        <MiniMap
          className="!bg-slate-900 !border-slate-700"
          nodeColor={(n) => {
            const status = (n.data as AgentNodeData)?.status
            if (status === 'running') return '#3b82f6'
            if (status === 'success') return '#22c55e'
            if (status === 'error') return '#ef4444'
            if (status === 'streaming') return '#a855f7'
            return '#475569'
          }}
          maskColor="rgba(15,23,42,0.7)"
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1}
          color="rgba(148,163,184,0.12)"
        />
      </ReactFlow>
    </div>
  )
})

export default WorkflowCanvas
