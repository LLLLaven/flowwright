import { X, GripVertical, FileText, Circle } from "lucide-react";
import { KIND_META, NodeKind } from "./data";
import type { LeftView } from "./LeftBar";

interface LeftPanelProps {
  view: LeftView;
  onClose: () => void;
}

const TITLES: Record<LeftView, string> = {
  workflows: "工作流列表",
  nodes: "节点库",
  tools: "工具配置",
  rag: "RAG 文档管理",
};

export function LeftPanel({ view, onClose }: LeftPanelProps) {
  return (
    <div className="flex w-[264px] shrink-0 flex-col border-r border-[#1e293b] bg-[#0f172a] animate-[panelIn_.22s_cubic-bezier(0.4,0,0.2,1)]">
      <div className="flex h-11 items-center justify-between border-b border-[#1e293b] px-3">
        <span className="text-[13px] text-slate-200" style={{ fontWeight: 600 }}>
          {TITLES[view]}
        </span>
        <button
          onClick={onClose}
          className="flex size-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-700/60 hover:text-slate-100"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {view === "nodes" && <NodeLibrary />}
        {view === "workflows" && <WorkflowList />}
        {view === "tools" && <ToolsList />}
        {view === "rag" && <RagList />}
      </div>
    </div>
  );
}

function NodeLibrary() {
  const kinds: NodeKind[] = ["agent", "human", "condition", "rag"];
  return (
    <div className="flex flex-col gap-2">
      <p className="mb-1 text-[11px] text-slate-500">拖拽节点到画布以添加</p>
      {kinds.map((k) => {
        const meta = KIND_META[k];
        return (
          <div
            key={k}
            draggable
            className="group flex cursor-grab items-center gap-3 rounded-xl border border-slate-700/70 bg-[#1e293b]/60 p-3 transition-all hover:border-indigo-500/60 hover:bg-[#1e293b] active:cursor-grabbing"
          >
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[18px]"
              style={{ background: `${meta.accent}1a` }}
            >
              {meta.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-slate-100">{meta.label}</div>
              <div className="text-[11px] text-slate-500">{meta.desc}</div>
            </div>
            <GripVertical className="size-4 text-slate-600 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        );
      })}
    </div>
  );
}

function WorkflowList() {
  const items = [
    { name: "测试工作流", active: true, nodes: 6 },
    { name: "客服自动化", active: false, nodes: 12 },
    { name: "代码审查流水线", active: false, nodes: 8 },
    { name: "内容生成器", active: false, nodes: 4 },
  ];
  return (
    <div className="flex flex-col gap-1">
      {items.map((it) => (
        <button
          key={it.name}
          className={`flex items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
            it.active ? "bg-indigo-500/15 text-indigo-200" : "text-slate-300 hover:bg-slate-700/50"
          }`}
        >
          <span className="text-[13px]">{it.name}</span>
          <span className="text-[11px] text-slate-500">{it.nodes}</span>
        </button>
      ))}
    </div>
  );
}

function ToolsList() {
  const tools = ["coding", "web_search", "python_repl", "file_read", "sql_query"];
  return (
    <div className="flex flex-col gap-2">
      <p className="mb-1 text-[11px] text-slate-500">MCP / Skills</p>
      {tools.map((t) => (
        <label
          key={t}
          className="flex items-center gap-2.5 rounded-lg border border-slate-700/70 bg-[#1e293b]/50 px-3 py-2 text-[13px] text-slate-300"
        >
          <Circle className="size-3.5 text-slate-600" />
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t}</span>
        </label>
      ))}
    </div>
  );
}

function RagList() {
  const docs = ["架构设计.pdf", "API 参考手册.md", "产品需求文档.docx", "代码规范.md"];
  return (
    <div className="flex flex-col gap-1.5">
      {docs.map((d) => (
        <div
          key={d}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-slate-300 hover:bg-slate-700/50"
        >
          <FileText className="size-4 text-emerald-400/80" />
          <span className="truncate">{d}</span>
        </div>
      ))}
    </div>
  );
}
