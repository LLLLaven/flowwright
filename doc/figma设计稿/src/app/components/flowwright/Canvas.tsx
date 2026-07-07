import { Plus, Minus, Maximize, Lock } from "lucide-react";
import { AgentNode } from "./AgentNode";
import { FlowNode, FlowEdge, STATUS_META, NODE_W } from "./data";

interface CanvasProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

// approximate node height for edge anchoring
const NODE_H = 96;

export function Canvas({ nodes, edges, selectedId, onSelect }: CanvasProps) {
  const nodeById = (id: string) => nodes.find((n) => n.id === id);

  return (
    <div
      className="relative flex-1 overflow-hidden bg-[#0f172a]"
      onClick={() => onSelect(null)}
      style={{
        backgroundImage:
          "radial-gradient(circle, rgba(148,163,184,0.12) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      {/* edges */}
      <svg className="pointer-events-none absolute inset-0 size-full">
        <defs>
          <marker
            id="arrow"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill="#475569" />
          </marker>
        </defs>
        {edges.map((edge) => {
          const from = nodeById(edge.from);
          const to = nodeById(edge.to);
          if (!from || !to) return null;
          const x1 = from.x + NODE_W;
          const y1 = from.y + NODE_H / 2;
          const x2 = to.x;
          const y2 = to.y + NODE_H / 2;
          const dx = Math.max(60, Math.abs(x2 - x1) * 0.5);
          const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
          const active = from.status === "running" || from.status === "completed";
          return (
            <path
              key={edge.id}
              d={path}
              fill="none"
              stroke={active ? STATUS_META[from.status].color : "#475569"}
              strokeWidth={active ? 2 : 1.5}
              strokeDasharray={active ? "0" : "5 5"}
              markerEnd="url(#arrow)"
              opacity={active ? 0.9 : 0.6}
              className={from.status === "running" ? "animate-[dash_1s_linear_infinite]" : ""}
            />
          );
        })}
      </svg>

      {/* nodes */}
      {nodes.map((node) => (
        <div key={node.id} onClick={(e) => e.stopPropagation()}>
          <AgentNode
            node={node}
            selected={selectedId === node.id}
            dimmed={selectedId !== null && selectedId !== node.id}
            onSelect={() => onSelect(node.id)}
          />
        </div>
      ))}

      {/* zoom controls */}
      <div className="absolute bottom-4 left-4 flex flex-col overflow-hidden rounded-lg border border-slate-700 bg-[#1e293b] shadow-lg">
        <ZoomBtn><Plus className="size-4" /></ZoomBtn>
        <div className="h-px bg-slate-700" />
        <ZoomBtn><Minus className="size-4" /></ZoomBtn>
        <div className="h-px bg-slate-700" />
        <ZoomBtn><Maximize className="size-4" /></ZoomBtn>
        <div className="h-px bg-slate-700" />
        <ZoomBtn><Lock className="size-4" /></ZoomBtn>
      </div>

      {/* minimap */}
      <div className="absolute bottom-4 right-4 h-28 w-44 overflow-hidden rounded-lg border border-slate-700 bg-[#0b1120]/80 p-1.5 shadow-lg backdrop-blur">
        <div className="relative size-full">
          {nodes.map((n) => (
            <span
              key={n.id}
              className="absolute rounded-sm"
              style={{
                left: `${(n.x / 1300) * 100}%`,
                top: `${(n.y / 560) * 100}%`,
                width: 16,
                height: 7,
                background: STATUS_META[n.status].color,
                opacity: 0.8,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ZoomBtn({ children }: { children: React.ReactNode }) {
  return (
    <button className="flex size-8 items-center justify-center text-slate-400 transition-colors hover:bg-slate-700/70 hover:text-slate-100">
      {children}
    </button>
  );
}
