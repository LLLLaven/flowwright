import { Circle, GitBranch, Boxes, Zap, Clock } from "lucide-react";

interface StatusBarProps {
  state: "ready" | "running" | "paused";
  nodeCount: number;
  edgeCount: number;
}

const STATE_META = {
  ready: { label: "Ready", color: "#10b981" },
  running: { label: "Running", color: "#3b82f6" },
  paused: { label: "Paused", color: "#f59e0b" },
};

export function StatusBar({ state, nodeCount, edgeCount }: StatusBarProps) {
  const meta = STATE_META[state];
  return (
    <div className="flex h-7 shrink-0 items-center gap-4 border-t border-[#1e293b] bg-[#0b1120] px-3 text-[11px] text-slate-400">
      <div className="flex items-center gap-1.5">
        <span className="relative flex size-2">
          {state !== "ready" && (
            <span
              className="absolute inline-flex size-2 animate-ping rounded-full opacity-70"
              style={{ background: meta.color }}
            />
          )}
          <span className="relative inline-flex size-2 rounded-full" style={{ background: meta.color }} />
        </span>
        <span className="text-slate-300">{meta.label}</span>
      </div>

      <Sep />
      <Item icon={<Boxes className="size-3" />}>{nodeCount} 节点</Item>
      <Item icon={<GitBranch className="size-3" />}>{edgeCount} 连接</Item>
      <Item icon={<Zap className="size-3" />}>Token: 1.2K</Item>
      <Item icon={<Clock className="size-3" />}>0.5s</Item>

      <div className="flex-1" />

      <span className="text-slate-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        FlowWright v1.0
      </span>
      <Sep />
      <span className="flex items-center gap-1 text-slate-500">
        <Circle className="size-2 fill-emerald-500 text-emerald-500" />
        已连接
      </span>
    </div>
  );
}

function Item({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-slate-500">{icon}</span>
      {children}
    </span>
  );
}

function Sep() {
  return <span className="h-3 w-px bg-slate-700/70" />;
}
