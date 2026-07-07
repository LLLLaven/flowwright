import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Copy, Pencil, Trash2, Check, X, Pause } from 'lucide-react'
import type { NodeConfig } from '../../../shared/types'

export type NodeStatus = 'idle' | 'running' | 'completed' | 'rejected' | 'awaiting_human'

// The `& Record<string, unknown>` satisfies @xyflow/react's Node<T> data constraint
export type AgentNodeData = NodeConfig & Record<string, unknown> & {
  status?: NodeStatus
  streamText?: string
}

const NODE_W = 224

const STATUS_META: Record<NodeStatus, { label: string; color: string; pulse?: boolean }> = {
  idle:          { label: 'Idle',     color: '#64748b' },
  running:       { label: 'Running',  color: '#3b82f6', pulse: true },
  completed:     { label: 'Done',     color: '#10b981' },
  rejected:      { label: 'Failed',   color: '#ef4444' },
  awaiting_human:{ label: 'Awaiting', color: '#f59e0b', pulse: true },
}

const KIND_META: Record<string, { label: string; icon: string; accent: string }> = {
  agent:        { label: 'Agent',         icon: '\u{1F916}', accent: '#6366f1' },
  human_review: { label: 'Human Review',  icon: '\u{1F464}', accent: '#f59e0b' },
  condition:    { label: 'Condition',     icon: '\u{1F500}', accent: '#8b5cf6' },
  rag_retrieve: { label: 'RAG Retrieve',  icon: '\u{1F4DA}', accent: '#10b981' },
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: NodeStatus }) {
  const meta = STATUS_META[status]
  return (
    <div className="relative flex size-5 shrink-0 items-center justify-center">
      {meta.pulse && (
        <span
          className="absolute inline-flex size-4 animate-ping rounded-full opacity-60"
          style={{ background: meta.color }}
        />
      )}
      <span
        className="relative flex size-4 items-center justify-center rounded-full"
        style={{ background: meta.color }}
      >
        {status === 'completed' && <Check className="size-2.5 text-white" strokeWidth={3} />}
        {status === 'rejected' && <X className="size-2.5 text-white" strokeWidth={3} />}
        {status === 'awaiting_human' && <Pause className="size-2 text-white" fill="white" />}
      </span>
    </div>
  )
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-[11px]">
      <span className="text-slate-500">{label}</span>
      <span
        className="text-slate-300"
        style={mono ? { fontFamily: "'JetBrains Mono', monospace" } : undefined}
      >
        {value}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function AgentNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as AgentNodeData
  const status: NodeStatus = nodeData.status ?? 'idle'
  const statusMeta = STATUS_META[status]
  const kind = KIND_META[nodeData.type] ?? KIND_META.agent
  const dimmed = (nodeData['dimmed'] as boolean) ?? false

  const borderStyle = status === 'idle' ? 'dashed' : 'solid'

  const handleVisible = selected

  return (
    <div
      className="group relative transition-[transform,opacity,box-shadow] duration-200 hover:-translate-y-0.5"
      style={{
        width: NODE_W,
        opacity: dimmed ? 0.45 : 1,
        transform: selected ? 'scale(1.02)' : undefined,
      }}
    >
      {/* ---- React Flow handle: target (left) ---- */}
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !rounded-full !border-2 !border-[#0f172a] !bg-indigo-400 !transition-opacity"
        style={{ left: -5, opacity: handleVisible ? 1 : 0 }}
      />

      {/* ---- Card body ---- */}
      <div
        className="rounded-xl bg-[#1e293b] backdrop-blur"
        style={{
          border: `1.5px ${borderStyle} ${
            status === 'idle' ? '#475569' : statusMeta.color
          }`,
          boxShadow: selected
            ? `0 4px 20px ${statusMeta.color}55, 0 0 0 1px ${statusMeta.color}55`
            : '0 2px 10px rgba(0,0,0,0.35)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-3">
          <div
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-[15px]"
            style={{ background: `${kind.accent}22` }}
          >
            {kind.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-slate-100">
              {nodeData.label || 'Untitled'}
            </div>
          </div>
          <StatusDot status={status} />
        </div>

        {/* Type badge */}
        <div className="px-4 pb-2 pt-1">
          <span
            className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px]"
            style={{ background: `${kind.accent}1a`, color: kind.accent }}
          >
            {kind.label}
          </span>
        </div>

        {/* Meta section (Provider + Model) */}
        {nodeData.provider && (
          <div className="border-t border-slate-700/70 px-4 py-2">
            <MetaRow label="Provider" value={nodeData.provider} />
            <MetaRow label="Model" value={nodeData.model ?? '—'} mono />
          </div>
        )}

        {/* Stream preview (running + streamText) */}
        {status === 'running' && nodeData.streamText && (
          <div className="border-t border-blue-500/30 bg-blue-500/5 px-4 py-2">
            <div
              className="flex items-center gap-1.5 truncate text-[11px] text-blue-300"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <span className="inline-block size-1.5 shrink-0 animate-pulse rounded-full bg-blue-400" />
              <span className="truncate">{nodeData.streamText.slice(-160)}</span>
            </div>
          </div>
        )}

        {/* Awaiting human label */}
        {status === 'awaiting_human' && (
          <div className="flex items-center gap-1.5 border-t border-amber-500/30 bg-amber-500/5 px-4 py-2 text-[11px] text-amber-300">
            <Pause className="size-3" fill="currentColor" />
            Awaiting human review
          </div>
        )}

        {/* Rejected label */}
        {status === 'rejected' && (
          <div className="flex items-center gap-1.5 border-t border-red-500/30 bg-red-500/5 px-4 py-2 text-[11px] text-red-300">
            <X className="size-3" />
            Execution failed
          </div>
        )}
      </div>

      {/* ---- React Flow handle: source (right) ---- */}
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !rounded-full !border-2 !border-[#0f172a] !bg-indigo-400 !transition-opacity"
        style={{ right: -5, opacity: handleVisible ? 1 : 0 }}
      />

      {/* ---- Hover action buttons ---- */}
      <div className="pointer-events-none absolute -top-3 right-2 flex gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        <button
          className="flex size-6 items-center justify-center rounded-md border border-slate-600 bg-[#0f172a] text-slate-300 shadow-md transition-colors hover:bg-slate-700 hover:text-white"
          aria-label="Edit node"
        >
          <Pencil className="size-3" />
        </button>
        <button
          className="flex size-6 items-center justify-center rounded-md border border-slate-600 bg-[#0f172a] text-slate-300 shadow-md transition-colors hover:bg-slate-700 hover:text-white"
          aria-label="Duplicate node"
        >
          <Copy className="size-3" />
        </button>
        <button
          className="flex size-6 items-center justify-center rounded-md border border-slate-600 bg-[#0f172a] text-slate-300 shadow-md transition-colors hover:bg-red-500 hover:text-white"
          aria-label="Delete node"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  )
}

export default memo(AgentNode)
