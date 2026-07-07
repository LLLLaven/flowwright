import { useState, useCallback, useRef } from 'react'
import Editor from '@monaco-editor/react'
import {
  ChevronDown,
  PanelRightClose,
  Terminal,
  Trash2,
  Download,
} from 'lucide-react'
import type { NodeConfig, NodeType } from '../../../shared/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NodeConfigPanelProps {
  node: NodeConfig | null
  onUpdate: (patch: Partial<NodeConfig>) => void
  onClose: () => void
}

type TabId = 'basic' | 'tools' | 'schema' | 'advanced'

interface LogEntry {
  id: number
  time: string
  level: 'info' | 'success' | 'warn' | 'error'
  message: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS: { id: TabId; label: string }[] = [
  { id: 'basic', label: '基础' },
  { id: 'tools', label: '工具' },
  { id: 'schema', label: 'Schema' },
  { id: 'advanced', label: '高级' },
]

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  agent: 'AI Agent',
  human_review: 'Human Review',
  condition: 'Condition',
  rag_retrieve: 'RAG Retrieve',
}

const PROVIDER_OPTIONS = [
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
]

const BUILT_IN_SKILLS = [
  'coding',
  'research',
  'web_search',
  'python_repl',
  'file_read',
  'data_analysis',
]

const SCHEMA_TEMPLATES: Record<string, Record<string, unknown>> = {
  none: {},
  code_file: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      content: { type: 'string' },
    },
    required: ['path', 'content'],
  },
  analysis: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      findings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            severity: { enum: ['low', 'medium', 'high', 'critical'] },
            description: { type: 'string' },
          },
          required: ['severity', 'description'],
        },
      },
    },
    required: ['summary', 'findings'],
  },
  task_list: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            done: { type: 'boolean' },
          },
          required: ['id', 'done'],
        },
      },
    },
    required: ['tasks'],
  },
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Label + children wrapper, matching the Figma Field component */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] text-slate-400">{label}</label>
      {children}
    </div>
  )
}

/** Styled text input */
function TextInput({
  value,
  onChange,
  placeholder,
  mono,
  className = '',
  type = 'text',
  min,
  max,
}: {
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  mono?: boolean
  className?: string
  type?: string
  min?: number
  max?: number
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      min={min}
      max={max}
      style={mono ? { fontFamily: "'JetBrains Mono', monospace" } : undefined}
      className={`h-9 rounded-lg border border-slate-700 bg-[#0b1120] px-3 text-[13px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${
        className || 'w-full'
      }`}
    />
  )
}

/** Styled select dropdown */
function SelectInput({
  value,
  onChange,
  options,
  className = '',
}: {
  value: string
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <div className={`relative ${className || 'w-full'}`}>
      <select
        value={value}
        onChange={onChange}
        className="h-9 w-full appearance-none rounded-lg border border-slate-700 bg-[#0b1120] px-3 pr-8 text-[13px] text-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
    </div>
  )
}

/** Toggle switch row */
function ToggleRow({
  label,
  desc,
  on,
  onToggle,
}: {
  label: string
  desc: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-[13px] text-slate-200">{label}</div>
        <div className="text-[11px] text-slate-500">{desc}</div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`relative h-5 w-9 rounded-full transition-colors ${
          on ? 'bg-indigo-500' : 'bg-slate-600'
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white transition-transform ${
            on ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab content components
// ---------------------------------------------------------------------------

function BasicTab({
  node,
  onUpdate,
}: {
  node: NodeConfig
  onUpdate: (patch: Partial<NodeConfig>) => void
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <Field label="Label">
        <TextInput
          value={node.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
        />
      </Field>

      <Field label="Type">
        <SelectInput
          value={node.type}
          onChange={(e) => onUpdate({ type: e.target.value as NodeType })}
          options={Object.entries(NODE_TYPE_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
      </Field>

      <Field label="Provider">
        <SelectInput
          value={node.provider ?? 'deepseek'}
          onChange={(e) => onUpdate({ provider: e.target.value })}
          options={PROVIDER_OPTIONS}
        />
      </Field>

      <Field label="Model">
        <TextInput
          value={node.model ?? ''}
          placeholder="deepseek-v4-flash"
          mono
          onChange={(e) => onUpdate({ model: e.target.value })}
        />
      </Field>

      <Field label="System Prompt">
        <textarea
          value={node.systemPrompt ?? ''}
          onChange={(e) => onUpdate({ systemPrompt: e.target.value })}
          rows={4}
          className="w-full resize-none rounded-lg border border-slate-700 bg-[#0b1120] px-3 py-2 text-[13px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        />
      </Field>

      <Field label="Max Retries">
        <TextInput
          type="number"
          min={0}
          max={5}
          value={String(node.maxRetries ?? 2)}
          onChange={(e) =>
            onUpdate({ maxRetries: parseInt(e.target.value) || 0 })
          }
          className="w-24"
        />
      </Field>
    </div>
  )
}

function ToolsTab({
  node,
  onUpdate,
}: {
  node: NodeConfig
  onUpdate: (patch: Partial<NodeConfig>) => void
}) {
  const selected = node.availableSkills ?? []

  const toggleSkill = useCallback(
    (skill: string) => {
      const next = selected.includes(skill)
        ? selected.filter((s) => s !== skill)
        : [...selected, skill]
      onUpdate({ availableSkills: next })
    },
    [selected, onUpdate],
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="mb-1 flex items-center justify-between text-[12px]">
        <span className="text-slate-400">Skills</span>
        <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-[11px] text-slate-300">
          {selected.length} 已选
        </span>
      </div>
      {BUILT_IN_SKILLS.map((skill) => {
        const checked = selected.includes(skill)
        return (
          <label
            key={skill}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-700/70 bg-[#0b1120] px-3 py-2 text-[13px] text-slate-300 hover:border-slate-600"
          >
            <span
              className={`flex size-4 items-center justify-center rounded border ${
                checked
                  ? 'border-indigo-500 bg-indigo-500'
                  : 'border-slate-600'
              }`}
            >
              {checked && <span className="text-[10px] text-white">&#10003;</span>}
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {skill}
            </span>
          </label>
        )
      })}

      {/* MCP Tools section */}
      {node.mcpTools && node.mcpTools.length > 0 && (
        <>
          <div className="mb-1 mt-2 flex items-center text-[12px]">
            <span className="text-slate-400">MCP Tools</span>
          </div>
          {node.mcpTools.map((tool) => (
            <div
              key={tool}
              className="flex items-center gap-2.5 rounded-lg border border-slate-700/70 bg-[#0b1120] px-3 py-2 text-[13px] text-slate-300"
            >
              <span className="size-1.5 rounded-full bg-emerald-400" />
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {tool}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function SchemaTab({
  node,
  onUpdate,
}: {
  node: NodeConfig
  onUpdate: (patch: Partial<NodeConfig>) => void
}) {
  const [schemaTemplate, setSchemaTemplate] = useState('none')

  const handleSchemaTemplateChange = useCallback(
    (template: string) => {
      setSchemaTemplate(template)
      const schema = SCHEMA_TEMPLATES[template]
      if (schema && Object.keys(schema).length > 0) {
        onUpdate({ outputSchema: schema })
      }
    },
    [onUpdate],
  )

  const schemaJson = node.outputSchema
    ? JSON.stringify(node.outputSchema, null, 2)
    : '{}'

  const handleSchemaChange = useCallback(
    (value: string | undefined) => {
      if (!value) return
      try {
        const parsed = JSON.parse(value)
        onUpdate({ outputSchema: parsed })
      } catch {
        // Invalid JSON — don't update yet (Monaco shows error)
      }
    },
    [onUpdate],
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-[12px] text-slate-400">Output Schema (JSON)</label>
        <SelectInput
          value={schemaTemplate}
          onChange={(e) => handleSchemaTemplateChange(e.target.value)}
          options={[
            { value: 'none', label: 'No template' },
            { value: 'code_file', label: 'Code File' },
            { value: 'analysis', label: 'Analysis Report' },
            { value: 'task_list', label: 'Task List' },
          ]}
          className="w-36"
        />
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-700">
        <Editor
          height="260px"
          language="json"
          theme="vs-dark"
          value={schemaJson}
          onChange={handleSchemaChange}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            tabSize: 2,
          }}
        />
      </div>
    </div>
  )
}

function AdvancedTab(_props: {
  node: NodeConfig
  onUpdate: (patch: Partial<NodeConfig>) => void
}) {
  // Local UI-only state for toggles not yet in NodeConfig
  const [streamOutput, setStreamOutput] = useState(true)
  const [parallelExec, setParallelExec] = useState(false)
  const [cacheResults, setCacheResults] = useState(true)
  // Local state for temperature / timeout (not yet in NodeConfig)
  const [temperature, setTemperature] = useState('0.7')
  const [timeout, setTimeout_] = useState('60')

  return (
    <div className="flex flex-col gap-4">
      <ToggleRow
        label="流式输出"
        desc="逐 token 返回结果"
        on={streamOutput}
        onToggle={() => setStreamOutput((v) => !v)}
      />
      <ToggleRow
        label="并行执行"
        desc="允许与同级节点并行"
        on={parallelExec}
        onToggle={() => setParallelExec((v) => !v)}
      />
      <ToggleRow
        label="缓存结果"
        desc="复用相同输入的输出"
        on={cacheResults}
        onToggle={() => setCacheResults((v) => !v)}
      />

      <Field label="Temperature">
        <TextInput
          value={temperature}
          onChange={(e) => setTemperature(e.target.value)}
          className="w-24"
        />
      </Field>

      <Field label="Timeout (s)">
        <TextInput
          value={timeout}
          onChange={(e) => setTimeout_(e.target.value)}
          className="w-24"
        />
      </Field>
    </div>
  )
}

/** Empty state when no node is selected */
function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-700/40 text-2xl text-slate-400">
        &#10025;
      </div>
      <p className="text-[13px] text-slate-300">未选择节点</p>
      <p className="text-[12px] leading-relaxed text-slate-500">
        点击画布中的任意节点查看并编辑其配置
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Log viewer (collapsible)
// ---------------------------------------------------------------------------

function LogViewer({
  logs,
  onClear,
  nodeLabel,
}: {
  logs: LogEntry[]
  onClear: () => void
  nodeLabel: string
}) {
  const [logOpen, setLogOpen] = useState(true)

  return (
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
          <span
            className="text-slate-500 hover:text-slate-300"
            title="清空"
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
          >
            <Trash2 className="size-3.5" />
          </span>
          <span className="text-slate-500" title="导出">
            <Download className="size-3.5" />
          </span>
          <ChevronDown
            className={`size-4 transition-transform ${
              logOpen ? '' : '-rotate-90'
            }`}
          />
        </span>
      </button>
      {logOpen && (
        <div className="h-40 overflow-y-auto bg-[#0b1120] px-3 py-2">
          {logs.length === 0 ? (
            <div className="py-4 text-center text-[11px] text-slate-600">
              暂无日志
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="mb-1.5 text-[11px] leading-snug"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600">{log.time}</span>
                  <span className="text-slate-500">[{nodeLabel}]</span>
                </div>
                <div
                  className={`pl-1 ${
                    log.level === 'success'
                      ? 'text-emerald-400'
                      : log.level === 'warn'
                        ? 'text-amber-400'
                        : log.level === 'error'
                          ? 'text-red-400'
                          : 'text-slate-400'
                  }`}
                >
                  {log.level === 'success' ? '✓ ' : '▸ '}
                  {log.message}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

export default function NodeConfigPanel({
  node,
  onUpdate,
  onClose,
}: NodeConfigPanelProps) {
  const [tab, setTab] = useState<TabId>('basic')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const logIdRef = useRef(0)

  const addLog = useCallback(
    (level: LogEntry['level'], message: string) => {
      const now = new Date()
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes(),
      ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      const entry: LogEntry = {
        id: ++logIdRef.current,
        time,
        level,
        message,
      }
      setLogs((prev) => [...prev.slice(-99), entry])
    },
    [],
  )

  const clearLogs = useCallback(() => setLogs([]), [])

  return (
    <div className="flex w-[320px] shrink-0 flex-col border-l border-[#1e293b] bg-[#111a2e]">
      {/* Header */}
      <div className="flex h-11 items-center justify-between border-b border-[#1e293b] px-3">
        <span
          className="text-[13px] text-slate-200"
          style={{ fontWeight: 600 }}
        >
          {node ? '节点配置' : '配置面板'}
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
          {/* Tabs */}
          <div className="flex gap-1 border-b border-[#1e293b] px-2 pt-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative px-3 py-2 text-[12px] transition-colors ${
                  tab === t.id
                    ? 'text-indigo-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
                {tab === t.id && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-indigo-400" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-3">
            {tab === 'basic' && <BasicTab node={node} onUpdate={onUpdate} />}
            {tab === 'tools' && <ToolsTab node={node} onUpdate={onUpdate} />}
            {tab === 'schema' && <SchemaTab node={node} onUpdate={onUpdate} />}
            {tab === 'advanced' && <AdvancedTab node={node} onUpdate={onUpdate} />}
          </div>

          {/* Collapsible log viewer */}
          <LogViewer logs={logs} onClear={clearLogs} nodeLabel={node.label} />
        </>
      ) : (
        <EmptyState />
      )}
    </div>
  )
}
