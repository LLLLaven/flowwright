import { memo } from "react";
import { Copy, Pencil, Trash2, Check, X, Pause } from "lucide-react";
import { FlowNode, STATUS_META, KIND_META, NODE_W } from "./data";

interface AgentNodeProps {
  node: FlowNode;
  selected: boolean;
  dimmed: boolean;
  onSelect: () => void;
}

export const AgentNode = memo(function AgentNode({
  node,
  selected,
  dimmed,
  onSelect,
}: AgentNodeProps) {
  const status = STATUS_META[node.status];
  const kind = KIND_META[node.kind];

  const borderStyle =
    node.status === "idle" ? "dashed" : "solid";

  return (
    <div
      onClick={onSelect}
      className="group absolute cursor-pointer transition-[transform,opacity,box-shadow] duration-200 hover:-translate-y-0.5"
      style={{
        left: node.x,
        top: node.y,
        width: NODE_W,
        opacity: dimmed ? 0.45 : 1,
        transform: selected ? "scale(1.02)" : undefined,
      }}
    >
      {/* connection handles */}
      <Handle side="left" visible={selected} />
      <Handle side="right" visible={selected} />

      <div
        className="rounded-xl bg-[#1e293b] backdrop-blur"
        style={{
          border: `1.5px ${borderStyle} ${
            node.status === "idle" ? "#475569" : status.color
          }`,
          boxShadow: selected
            ? `0 4px 20px ${status.color}55, 0 0 0 1px ${status.color}55`
            : "0 2px 10px rgba(0,0,0,0.35)",
        }}
      >
        {/* header */}
        <div className="flex items-center gap-2 px-4 pt-3">
          <div
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-[15px]"
            style={{ background: `${kind.accent}22` }}
          >
            {kind.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] text-slate-100" style={{ fontWeight: 600 }}>
              {node.label}
            </div>
          </div>
          <StatusDot status={node.status} />
        </div>

        {/* type badge */}
        <div className="px-4 pb-2 pt-1">
          <span
            className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px]"
            style={{ background: `${kind.accent}1a`, color: kind.accent }}
          >
            {kind.label}
          </span>
        </div>

        {/* meta */}
        {node.provider && (
          <div className="border-t border-slate-700/70 px-4 py-2">
            <MetaRow label="Provider" value={node.provider} />
            <MetaRow label="Model" value={node.model ?? "—"} mono />
          </div>
        )}

        {/* stream preview */}
        {node.status === "running" && node.stream && (
          <div className="border-t border-blue-500/30 bg-blue-500/5 px-4 py-2">
            <div
              className="flex items-center gap-1.5 truncate text-[11px] text-blue-300"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <span className="inline-block size-1.5 shrink-0 animate-pulse rounded-full bg-blue-400" />
              <span className="truncate">{node.stream}</span>
            </div>
          </div>
        )}

        {/* awaiting label */}
        {node.status === "awaiting" && (
          <div className="flex items-center gap-1.5 border-t border-amber-500/30 bg-amber-500/5 px-4 py-2 text-[11px] text-amber-300">
            <Pause className="size-3" fill="currentColor" />
            等待人工审核
          </div>
        )}

        {/* rejected label */}
        {node.status === "rejected" && (
          <div className="flex items-center gap-1.5 border-t border-red-500/30 bg-red-500/5 px-4 py-2 text-[11px] text-red-300">
            <X className="size-3" />
            执行失败，请检查配置
          </div>
        )}
      </div>

      {/* hover actions */}
      <div className="pointer-events-none absolute -top-3 right-2 flex gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        <QuickAction><Pencil className="size-3" /></QuickAction>
        <QuickAction><Copy className="size-3" /></QuickAction>
        <QuickAction danger><Trash2 className="size-3" /></QuickAction>
      </div>
    </div>
  );
});

function StatusDot({ status }: { status: FlowNode["status"] }) {
  const meta = STATUS_META[status];
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
        {status === "completed" && <Check className="size-2.5 text-white" strokeWidth={3} />}
        {status === "rejected" && <X className="size-2.5 text-white" strokeWidth={3} />}
        {status === "awaiting" && <Pause className="size-2 text-white" fill="white" />}
      </span>
    </div>
  );
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
  );
}

function Handle({ side, visible }: { side: "left" | "right"; visible: boolean }) {
  return (
    <span
      className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full border-2 border-[#0f172a] bg-indigo-400 transition-opacity"
      style={{
        [side]: -5,
        opacity: visible ? 1 : 0,
      }}
    />
  );
}

function QuickAction({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      className={`flex size-6 items-center justify-center rounded-md border border-slate-600 bg-[#0f172a] text-slate-300 shadow-md transition-colors ${
        danger ? "hover:bg-red-500 hover:text-white" : "hover:bg-slate-700 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
