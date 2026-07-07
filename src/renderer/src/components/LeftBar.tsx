import React from 'react'
import { LayoutGrid, Boxes, Wrench, Library, Settings, Menu } from "lucide-react";

export type LeftView = "workflows" | "nodes" | "tools" | "rag";

interface LeftBarProps {
  active: LeftView | null;
  onSelect: (v: LeftView) => void;
}

const ITEMS: { id: LeftView; icon: typeof LayoutGrid; label: string }[] = [
  { id: "workflows", icon: LayoutGrid, label: "工作流列表" },
  { id: "nodes", icon: Boxes, label: "节点库" },
  { id: "tools", icon: Wrench, label: "工具配置" },
  { id: "rag", icon: Library, label: "RAG 文档" },
];

export default function LeftBar({ active, onSelect }: LeftBarProps) {
  return (
    <div className="flex w-12 shrink-0 flex-col items-center border-r border-[#1e293b] bg-[#0b1120] py-2">
      <button className="mb-2 flex size-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-700/60 hover:text-slate-100">
        <Menu className="size-5" />
      </button>
      <div className="mb-2 h-px w-6 bg-slate-700/70" />
      <div className="flex flex-1 flex-col gap-1">
        {ITEMS.map((item) => {
          const isActive = active === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              title={item.label}
              aria-label={item.label}
              className={`relative flex size-9 items-center justify-center rounded-lg transition-colors ${
                isActive
                  ? "bg-indigo-500/15 text-indigo-300"
                  : "text-slate-400 hover:bg-slate-700/60 hover:text-slate-100"
              }`}
            >
              {isActive && (
                <span className="absolute -left-2 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-indigo-400" />
              )}
              <Icon className="size-5" strokeWidth={1.75} />
            </button>
          );
        })}
      </div>
      <button
        title="设置"
        className="flex size-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-700/60 hover:text-slate-100"
      >
        <Settings className="size-5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
