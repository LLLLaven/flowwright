import { useState, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import type { NodeConfig } from '../../../shared/types'

interface NodeConfigPanelProps {
  node: NodeConfig | null
  onUpdate: (patch: Partial<NodeConfig>) => void
  onClose: () => void
}

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

export default function NodeConfigPanel({ node, onUpdate, onClose }: NodeConfigPanelProps) {
  const [schemaTemplate, setSchemaTemplate] = useState('none')

  if (!node) return null

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
    <div
      style={{
        width: 300,
        height: '100%',
        borderLeft: '1px solid #e5e7eb',
        backgroundColor: '#fff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        fontFamily: 'sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>Node Config</span>
        <button
          onClick={onClose}
          style={{
            border: 'none',
            background: 'none',
            fontSize: 18,
            cursor: 'pointer',
            color: '#9ca3af',
          }}
        >
          ✕
        </button>
      </div>

      {/* Fields */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Label */}
        <label style={labelStyle}>
          Label
          <input
            type="text"
            value={node.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            style={inputStyle}
          />
        </label>

        {/* Type */}
        <label style={labelStyle}>
          Type
          <select
            value={node.type}
            onChange={(e) => onUpdate({ type: e.target.value as NodeConfig['type'] })}
            style={inputStyle}
          >
            <option value="agent">Agent</option>
            <option value="human_review">Human Review</option>
          </select>
        </label>

        {/* Provider */}
        <label style={labelStyle}>
          Provider
          <select
            value={node.provider ?? 'deepseek'}
            onChange={(e) => onUpdate({ provider: e.target.value })}
            style={inputStyle}
          >
            <option value="deepseek">DeepSeek</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
          </select>
        </label>

        {/* Model */}
        <label style={labelStyle}>
          Model
          <input
            type="text"
            value={node.model ?? ''}
            placeholder="deepseek-v4-flash"
            onChange={(e) => onUpdate({ model: e.target.value })}
            style={inputStyle}
          />
        </label>

        {/* System Prompt */}
        <label style={labelStyle}>
          System Prompt
          <textarea
            rows={5}
            value={node.systemPrompt ?? ''}
            onChange={(e) => onUpdate({ systemPrompt: e.target.value })}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace' }}
          />
        </label>

        {/* Max Retries */}
        <label style={labelStyle}>
          Max Retries
          <input
            type="number"
            min={0}
            max={5}
            value={node.maxRetries ?? 2}
            onChange={(e) => onUpdate({ maxRetries: parseInt(e.target.value) || 0 })}
            style={{ ...inputStyle, width: 80 }}
          />
        </label>

        {/* Output Schema */}
        <div style={labelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Output Schema (JSON)</span>
            <select
              value={schemaTemplate}
              onChange={(e) => handleSchemaTemplateChange(e.target.value)}
              style={{ fontSize: 12, padding: '2px 4px' }}
            >
              <option value="none">No template</option>
              <option value="code_file">Code File</option>
              <option value="analysis">Analysis Report</option>
              <option value="task_list">Task List</option>
            </select>
          </div>
          <div style={{ border: '1px solid #d1d5db', borderRadius: 4, overflow: 'hidden', marginTop: 4 }}>
            <Editor
              height="200px"
              language="json"
              value={schemaJson}
              onChange={handleSchemaChange}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                lineNumbers: 'off',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  fontWeight: 500,
  color: '#374151',
}

const inputStyle: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  fontSize: 13,
  fontFamily: 'sans-serif',
}
