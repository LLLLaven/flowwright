import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { NodeConfig } from '../../../shared/types'

export type NodeStatus = 'idle' | 'running' | 'completed' | 'rejected' | 'awaiting_human'

export interface AgentNodeData extends NodeConfig {
  status?: NodeStatus
}

const STATUS_COLORS: Record<NodeStatus, string> = {
  idle: '#9ca3af',
  running: '#3b82f6',
  completed: '#22c55e',
  rejected: '#ef4444',
  awaiting_human: '#f59e0b',
}

const STATUS_LABELS: Record<NodeStatus, string> = {
  idle: 'Idle',
  running: 'Running',
  completed: 'Done',
  rejected: 'Failed',
  awaiting_human: 'Review',
}

const TYPE_LABELS: Record<string, string> = {
  agent: '🤖 Agent',
  human_review: '👤 Review',
  condition: '🔀 Condition',
  rag_retrieve: '📚 RAG',
}

function AgentNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as AgentNodeData
  const status: NodeStatus = nodeData.status ?? 'idle'
  const badgeColor = STATUS_COLORS[status]
  const typeLabel = TYPE_LABELS[nodeData.type] ?? TYPE_LABELS.agent

  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: 8,
        border: `2px solid ${selected ? '#3b82f6' : '#d1d5db'}`,
        backgroundColor: '#fff',
        minWidth: 180,
        boxShadow: selected ? '0 0 0 2px rgba(59,130,246,0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
        fontSize: 13,
        fontFamily: 'sans-serif',
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{nodeData.label || 'Untitled'}</span>
        <span
          style={{
            fontSize: 11,
            padding: '2px 6px',
            borderRadius: 10,
            backgroundColor: badgeColor,
            color: '#fff',
            fontWeight: 500,
            animation: status === 'running' ? 'pulse 1.5s infinite' : undefined,
          }}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>
      <div style={{ fontSize: 11, color: '#9ca3af' }}>{typeLabel}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

export default memo(AgentNode)
