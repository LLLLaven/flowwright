import { useState } from "react";
import { TitleBar } from "./components/flowwright/TitleBar";
import { TopBar } from "./components/flowwright/TopBar";
import { LeftBar, LeftView } from "./components/flowwright/LeftBar";
import { LeftPanel } from "./components/flowwright/LeftPanel";
import { Canvas } from "./components/flowwright/Canvas";
import { RightPanel } from "./components/flowwright/RightPanel";
import { StatusBar } from "./components/flowwright/StatusBar";
import { initialNodes, initialEdges } from "./components/flowwright/data";

type RunState = "ready" | "running" | "paused";

export default function App() {
  const [leftView, setLeftView] = useState<LeftView | null>("nodes");
  const [selectedId, setSelectedId] = useState<string | null>("n3");
  const [rightOpen, setRightOpen] = useState(true);
  const [runState, setRunState] = useState<RunState>("running");
  const [query, setQuery] = useState("测试");

  const selectedNode = initialNodes.find((n) => n.id === selectedId) ?? null;

  const handleSelectLeft = (v: LeftView) =>
    setLeftView((cur) => (cur === v ? null : v));

  const handleToggleRun = () =>
    setRunState((s) => (s === "running" ? "paused" : "running"));

  const handleSelectNode = (id: string | null) => {
    setSelectedId(id);
    if (id) setRightOpen(true);
  };

  return (
    <div className="flex size-full flex-col overflow-hidden bg-[#0f172a] text-slate-200">
      <TitleBar
        workflowName="测试工作流"
        unsaved
        dark
        onToggleTheme={() => {}}
      />
      <TopBar
        runState={runState}
        onToggleRun={handleToggleRun}
        onStop={() => setRunState("ready")}
        query={query}
        onQuery={setQuery}
      />

      <div className="flex min-h-0 flex-1">
        <LeftBar active={leftView} onSelect={handleSelectLeft} />
        {leftView && (
          <LeftPanel view={leftView} onClose={() => setLeftView(null)} />
        )}

        <Canvas
          nodes={initialNodes}
          edges={initialEdges}
          selectedId={selectedId}
          onSelect={handleSelectNode}
        />

        {rightOpen ? (
          <RightPanel node={selectedNode} onClose={() => setRightOpen(false)} />
        ) : (
          <button
            onClick={() => setRightOpen(true)}
            className="w-8 shrink-0 border-l border-[#1e293b] bg-[#111a2e] text-[11px] text-slate-500 [writing-mode:vertical-rl] hover:text-slate-200"
          >
            展开配置面板
          </button>
        )}
      </div>

      <StatusBar
        state={runState}
        nodeCount={initialNodes.length}
        edgeCount={initialEdges.length}
      />
    </div>
  );
}
