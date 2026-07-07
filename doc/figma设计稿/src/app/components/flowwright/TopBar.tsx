import {
  FilePlus2,
  FolderOpen,
  Save,
  Plus,
  Search,
  X,
  Play,
  Pause,
  Square,
  Undo2,
  Redo2,
} from "lucide-react";

type RunState = "ready" | "running" | "paused";

interface TopBarProps {
  runState: RunState;
  onToggleRun: () => void;
  onStop: () => void;
  query: string;
  onQuery: (v: string) => void;
}

export function TopBar({ runState, onToggleRun, onStop, query, onQuery }: TopBarProps) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[#1e293b] bg-[#111a2e] px-3">
      {/* File group */}
      <Group>
        <IconBtn label="新建"><FilePlus2 className="size-[17px]" /></IconBtn>
        <IconBtn label="打开"><FolderOpen className="size-[17px]" /></IconBtn>
        <IconBtn label="保存 (Ctrl+S)"><Save className="size-[17px]" /></IconBtn>
      </Group>

      <Divider />

      {/* Edit group */}
      <Group>
        <IconBtn label="撤销"><Undo2 className="size-[17px]" /></IconBtn>
        <IconBtn label="重做"><Redo2 className="size-[17px]" /></IconBtn>
      </Group>

      <Divider />

      <button
        className="flex items-center gap-1.5 rounded-lg border border-slate-600/70 bg-slate-700/40 px-3 py-1.5 text-[13px] text-slate-200 transition-colors hover:bg-slate-700/70"
      >
        <Plus className="size-[15px]" />
        节点库
      </button>

      {/* Search / input */}
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="输入任务指令或搜索节点…"
          className="h-9 w-full rounded-lg border border-slate-700 bg-[#0b1120] pl-9 pr-9 text-[13px] text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        />
        {query && (
          <button
            onClick={() => onQuery("")}
            className="absolute right-2.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-slate-500 hover:text-slate-200"
          >
            <X className="size-[14px]" />
          </button>
        )}
      </div>

      {/* Run controls */}
      <Divider />
      <div className="flex items-center gap-2">
        <RunButton state={runState} onClick={onToggleRun} />
        <button
          onClick={onStop}
          disabled={runState === "ready"}
          title="停止"
          className="flex size-9 items-center justify-center rounded-lg border border-slate-600/70 bg-slate-700/40 text-slate-300 transition-colors hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Square className="size-[15px]" fill="currentColor" />
        </button>
      </div>
    </div>
  );
}

function RunButton({ state, onClick }: { state: RunState; onClick: () => void }) {
  if (state === "running") {
    return (
      <button
        onClick={onClick}
        className="relative flex items-center gap-1.5 overflow-hidden rounded-lg bg-blue-600 px-4 py-2 text-[13px] text-white shadow-lg shadow-blue-600/30 transition-transform active:scale-95"
      >
        <Pause className="size-[15px]" fill="currentColor" />
        暂停
        <span className="absolute inset-0 animate-pulse bg-white/10" />
      </button>
    );
  }
  if (state === "paused") {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-[13px] text-white shadow-lg shadow-amber-500/30 transition-transform active:scale-95"
      >
        <Play className="size-[15px]" fill="currentColor" />
        继续
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
      className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] text-white shadow-lg shadow-indigo-600/40 transition-transform active:scale-95"
    >
      <Play className="size-[15px]" fill="currentColor" />
      运行
    </button>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function Divider() {
  return <div className="mx-1 h-6 w-px bg-slate-700/70" />;
}

function IconBtn({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <button
      title={label}
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-slate-700/60 hover:text-white active:scale-95"
    >
      {children}
    </button>
  );
}
