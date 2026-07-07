import { useState } from "react";
import { ChevronDown, PanelRightClose, Terminal, Trash2, Download } from "lucide-react";
import { FlowNode, KIND_META, initialLogs } from "./data";

interface RightPanelProps {
  node: FlowNode | null;
  onClose: () => void;
}

type Tab = "basic" | "tools" | "schema" | "advanced";

const TABS: { id: Tab; label: string }[] = [
  { id: "basic", label: "基础" },
  { id: "tools", label: "工具" },
  { id: "schema", label: "Schema" },
  { id: "advanced", label: "高级" },
];

export function RightPanel({ node, onClose }: RightPanelProps) {
  const [tab, setTab] = useState<Tab>("basic");
  const [logOpen, setLogOpen] = useState(true);

  return (
    <div className="flex w-[320px] shrink-0 flex-col border-l border-[#1e293b] bg-[#111a2e]">
      {/* header */}
      <div className="flex h-11 items-center justify-between border-b border-[#1e293b] px-3">
        <span className="text-[13px] text-slate-200" style={{ fontWeight: 600 }}>
          {node ? "节点配置" : "配置面板"}
        </span>
        <button
          onClick={onClose}
          className="flex size-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-700/60 hover:text-slate-100"
        >
          <PanelRightClose className="size-4" />
        </button>
      </div>

      {node ? (
        <>
          {/* tabs */}
          <div className="flex gap-1 border-b border-[#1e293b] px-2 pt-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative px-3 py-2 text-[12px] transition-colors ${
                  tab === t.id ? "text-indigo-300" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t.label}
                {tab === t.id && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-indigo-400" />
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {tab === "basic" && <BasicTab node={node} />}
            {tab === "tools" && <ToolsTab />}
            {tab === "schema" && <SchemaTab />}
            {tab === "advanced" && <AdvancedTab />}
          </div>

          {/* log viewer */}
          <div className="border-t border-[#1e293b]">
            <button
              onClick={() => setLogOpen((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-[12px] text-slate-300 hover:bg-slate-700/30"
            >
              <span className="flex items-center gap-1.5">
                <Terminal className="size-3.5" />
                实时日志
              </span>
              <span className="flex items-center gap-1">
                <span className="text-slate-500" title="清空"><Trash2 className="size-3.5" /></span>
                <span className="text-slate-500" title="导出"><Download className="size-3.5" /></span>
                <ChevronDown
                  className={`size-4 transition-transform ${logOpen ? "" : "-rotate-90"}`}
                />
              </span>
            </button>
            {logOpen && (
              <div className="h-40 overflow-y-auto bg-[#0b1120] px-3 py-2">
                {initialLogs.map((log) => (
                  <div key={log.id} className="mb-1.5 text-[11px] leading-snug" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600">{log.time}</span>
                      <span style={{ color: log.color }}>[{log.node}]</span>
                    </div>
                    <div
                      className={`pl-1 ${
                        log.level === "success"
                          ? "text-emerald-400"
                          : log.level === "warn"
                          ? "text-amber-400"
                          : log.level === "error"
                          ? "text-red-400"
                          : "text-slate-400"
                      }`}
                    >
                      {log.level === "success" ? "✓ " : "▸ "}
                      {log.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function BasicTab({ node }: { node: FlowNode }) {
  return (
    <div className="flex flex-col gap-3.5">
      <Field label="Label">
        <TextInput defaultValue={node.label} />
      </Field>
      <Field label="Type">
        <SelectInput value={KIND_META[node.kind].label} />
      </Field>
      <Field label="Provider">
        <SelectInput value={node.provider ?? "DeepSeek"} />
      </Field>
      <Field label="Model">
        <TextInput defaultValue={node.model ?? "deepseek-v4-flash"} mono />
      </Field>
      <Field label="System Prompt">
        <textarea
          defaultValue="you are a helpful assistant"
          rows={4}
          className="w-full resize-none rounded-lg border border-slate-700 bg-[#0b1120] px-3 py-2 text-[13px] text-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        />
      </Field>
      <Field label="Max Retries">
        <TextInput defaultValue="2" className="w-24" />
      </Field>
    </div>
  );
}

function ToolsTab() {
  const tools = ["coding", "research", "web_search", "python_repl", "file_read"];
  return (
    <div className="flex flex-col gap-2">
      <div className="mb-1 flex items-center justify-between text-[12px]">
        <span className="text-slate-400">Skills</span>
        <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-[11px] text-slate-300">2 已选</span>
      </div>
      {tools.map((t, i) => (
        <label
          key={t}
          className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-700/70 bg-[#0b1120] px-3 py-2 text-[13px] text-slate-300 hover:border-slate-600"
        >
          <span
            className={`flex size-4 items-center justify-center rounded border ${
              i < 2 ? "border-indigo-500 bg-indigo-500" : "border-slate-600"
            }`}
          >
            {i < 2 && <span className="text-[10px] text-white">✓</span>}
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t}</span>
        </label>
      ))}
    </div>
  );
}

function SchemaTab() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-[12px] text-slate-400">Output Schema (JSON)</label>
        <SelectInput value="No template" className="w-28" />
      </div>
      <pre
        className="h-64 overflow-auto rounded-lg border border-slate-700 bg-[#0b1120] p-3 text-[12px] leading-relaxed text-slate-300"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >{`{
  "type": "object",
  "properties": {
    "summary": {
      "type": "string"
    },
    "score": {
      "type": "number"
    }
  },
  "required": ["summary"]
}`}</pre>
    </div>
  );
}

function AdvancedTab() {
  return (
    <div className="flex flex-col gap-4">
      <ToggleRow label="流式输出" desc="逐 token 返回结果" on />
      <ToggleRow label="并行执行" desc="允许与同级节点并行" on={false} />
      <ToggleRow label="缓存结果" desc="复用相同输入的输出" on />
      <Field label="Temperature">
        <TextInput defaultValue="0.7" className="w-24" />
      </Field>
      <Field label="Timeout (s)">
        <TextInput defaultValue="60" className="w-24" />
      </Field>
    </div>
  );
}

function ToggleRow({ label, desc, on }: { label: string; desc: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-[13px] text-slate-200">{label}</div>
        <div className="text-[11px] text-slate-500">{desc}</div>
      </div>
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${
          on ? "bg-indigo-500" : "bg-slate-600"
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white transition-transform ${
            on ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] text-slate-400">{label}</label>
      {children}
    </div>
  );
}

function TextInput({
  defaultValue,
  className = "",
  mono,
}: {
  defaultValue?: string;
  className?: string;
  mono?: boolean;
}) {
  return (
    <input
      defaultValue={defaultValue}
      style={mono ? { fontFamily: "'JetBrains Mono', monospace" } : undefined}
      className={`h-9 rounded-lg border border-slate-700 bg-[#0b1120] px-3 text-[13px] text-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${
        className || "w-full"
      }`}
    />
  );
}

function SelectInput({ value, className = "" }: { value: string; className?: string }) {
  return (
    <div
      className={`flex h-9 items-center justify-between rounded-lg border border-slate-700 bg-[#0b1120] px-3 text-[13px] text-slate-200 ${
        className || "w-full"
      }`}
    >
      <span className="truncate">{value}</span>
      <ChevronDown className="size-4 shrink-0 text-slate-500" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-700/40 text-2xl">
        ✦
      </div>
      <p className="text-[13px] text-slate-300">未选择节点</p>
      <p className="text-[12px] leading-relaxed text-slate-500">
        点击画布中的任意节点查看并编辑其配置
      </p>
    </div>
  );
}
