export type NodeStatus =
  | "idle"
  | "running"
  | "completed"
  | "rejected"
  | "awaiting";

export type NodeKind = "agent" | "human" | "condition" | "rag";

export interface FlowNode {
  id: string;
  label: string;
  kind: NodeKind;
  status: NodeStatus;
  provider?: string;
  model?: string;
  x: number;
  y: number;
  stream?: string;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
}

export const STATUS_META: Record<
  NodeStatus,
  { label: string; color: string; pulse?: boolean }
> = {
  idle: { label: "Idle", color: "#64748b" },
  running: { label: "Running", color: "#3b82f6", pulse: true },
  completed: { label: "Done", color: "#10b981" },
  rejected: { label: "Failed", color: "#ef4444" },
  awaiting: { label: "Awaiting", color: "#f59e0b", pulse: true },
};

export const KIND_META: Record<
  NodeKind,
  { label: string; icon: string; desc: string; accent: string }
> = {
  agent: {
    label: "Agent",
    icon: "🤖",
    desc: "LLM 推理节点",
    accent: "#6366f1",
  },
  human: {
    label: "Human Review",
    icon: "👤",
    desc: "人工审核节点",
    accent: "#f59e0b",
  },
  condition: {
    label: "Condition",
    icon: "🔀",
    desc: "条件路由节点",
    accent: "#8b5cf6",
  },
  rag: {
    label: "RAG Retrieve",
    icon: "📚",
    desc: "向量检索节点",
    accent: "#10b981",
  },
};

export const NODE_W = 224;

export const initialNodes: FlowNode[] = [
  {
    id: "n1",
    label: "Intake Agent",
    kind: "agent",
    status: "completed",
    provider: "DeepSeek",
    model: "deepseek-v4-flash",
    x: 40,
    y: 220,
  },
  {
    id: "n2",
    label: "Research Agent",
    kind: "rag",
    status: "running",
    provider: "OpenAI",
    model: "gpt-5-mini",
    x: 380,
    y: 60,
    stream: "…querying vector store for relevant context chunks",
  },
  {
    id: "n3",
    label: "Code Writer",
    kind: "agent",
    status: "running",
    provider: "Anthropic",
    model: "claude-opus-4.8",
    x: 380,
    y: 360,
    stream: "…generating implementation for the auth module handler",
  },
  {
    id: "n4",
    label: "Router",
    kind: "condition",
    status: "idle",
    x: 720,
    y: 220,
  },
  {
    id: "n5",
    label: "Human Review",
    kind: "human",
    status: "awaiting",
    x: 1040,
    y: 100,
  },
  {
    id: "n6",
    label: "Deploy Agent",
    kind: "agent",
    status: "idle",
    provider: "DeepSeek",
    model: "deepseek-v4",
    x: 1040,
    y: 360,
  },
];

export const initialEdges: FlowEdge[] = [
  { id: "e1", from: "n1", to: "n2" },
  { id: "e2", from: "n1", to: "n3" },
  { id: "e3", from: "n2", to: "n4" },
  { id: "e4", from: "n3", to: "n4" },
  { id: "e5", from: "n4", to: "n5" },
  { id: "e6", from: "n4", to: "n6" },
];

export interface LogEntry {
  id: string;
  time: string;
  node: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
  color: string;
}

export const initialLogs: LogEntry[] = [
  { id: "l1", time: "12:34:56.102", node: "Intake Agent", level: "info", message: "Started execution", color: "#818cf8" },
  { id: "l2", time: "12:34:58.441", node: "Intake Agent", level: "success", message: "Completed (2.3s) · 480 tokens", color: "#818cf8" },
  { id: "l3", time: "12:34:58.512", node: "Research Agent", level: "info", message: "Started execution", color: "#34d399" },
  { id: "l4", time: "12:34:59.204", node: "Research Agent", level: "info", message: "Stream: querying vector store…", color: "#34d399" },
  { id: "l5", time: "12:34:58.520", node: "Code Writer", level: "info", message: "Started execution", color: "#f472b6" },
  { id: "l6", time: "12:35:01.877", node: "Code Writer", level: "warn", message: "Stream: generating implementation…", color: "#f472b6" },
  { id: "l7", time: "12:35:02.010", node: "Router", level: "info", message: "Waiting for upstream nodes", color: "#a78bfa" },
];
