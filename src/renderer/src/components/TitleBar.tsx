import React from 'react';
import { Workflow, Moon, Sun, Settings, HelpCircle, Minus, Square, X } from "lucide-react";

interface TitleBarProps {
  workflowName: string;
  unsaved: boolean;
  dark: boolean;
  onToggleTheme: () => void;
}

export default function TitleBar({ workflowName, unsaved, dark, onToggleTheme }: TitleBarProps) {
  return (
    <div className="flex h-[34px] shrink-0 items-center justify-between border-b border-[#1e293b] bg-[#0b1120] px-3 select-none">
      <div className="flex items-center gap-2">
        <div
          className="flex size-5 items-center justify-center rounded-md"
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
        >
          <Workflow className="size-3 text-white" strokeWidth={2} />
        </div>
        <span
          className="text-[13px] tracking-tight text-slate-100"
          style={{ fontFamily: "Poppins, Inter, sans-serif", fontWeight: 600 }}
        >
          FlowWright
        </span>
        <span className="mx-1 text-slate-600">/</span>
        <span className="text-[12px] text-slate-400">{workflowName}</span>
        {unsaved && (
          <span className="ml-1 text-[16px] leading-none text-amber-400" title="未保存">
            •
          </span>
        )}
      </div>
      <div className="flex items-center gap-0.5">
        <TitleIconButton onClick={onToggleTheme} label="切换主题">
          {dark ? <Sun className="size-[15px]" /> : <Moon className="size-[15px]" />}
        </TitleIconButton>
        <TitleIconButton label="设置">
          <Settings className="size-[15px]" />
        </TitleIconButton>
        <TitleIconButton label="帮助">
          <HelpCircle className="size-[15px]" />
        </TitleIconButton>
        <div className="mx-1 h-4 w-px bg-slate-700" />
        <TitleIconButton label="最小化">
          <Minus className="size-[14px]" />
        </TitleIconButton>
        <TitleIconButton label="最大化">
          <Square className="size-[11px]" />
        </TitleIconButton>
        <button className="ml-0.5 flex size-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-500 hover:text-white">
          <X className="size-[15px]" />
        </button>
      </div>
    </div>
  );
}

function TitleIconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className="flex size-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-700/60 hover:text-slate-100">
      {children}
    </button>
  );
}
