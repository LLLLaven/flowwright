import { useState, useEffect } from 'react'
import { ipc } from '../lib/ipc'
import type { RunRecord, RunStatus } from '../../../../shared/types'

const STATUS_COLORS: Record<RunStatus, string> = {
  running: '#3b82f6',
  paused: '#f97316',
  completed: '#22c55e',
  error: '#ef4444',
  aborted: '#9ca3af',
}

export default function HistoryPanel(): JSX.Element {
  const [records, setRecords] = useState<RunRecord[]>([])

  useEffect(() => {
    const fetchRecords = (): void => {
      ipc.workflow.list().then(setRecords).catch(console.error)
    }
    fetchRecords()
    const interval = setInterval(fetchRecords, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleResume = (runId: string): void => {
    ipc.workflow.resume(runId).catch(console.error)
  }

  const shortId = (id: string): string => id.slice(-8)

  const formatDate = (iso: string): string => {
    try {
      return new Date(iso).toLocaleString()
    } catch {
      return iso
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <h2 style={{ marginTop: 0 }}>Run History</h2>
      {records.length === 0 ? (
        <p style={{ color: '#888' }}>No runs yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Run ID</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Graph</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Started</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.runId} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
                  {shortId(r.runId)}
                </td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
                  {r.graphId}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 9999,
                      backgroundColor: STATUS_COLORS[r.status],
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {r.status}
                  </span>
                </td>
                <td style={{ padding: '8px 12px' }}>{formatDate(r.startedAt)}</td>
                <td style={{ padding: '8px 12px' }}>
                  {r.status === 'paused' && (
                    <button
                      type="button"
                      onClick={() => handleResume(r.runId)}
                      style={{
                        padding: '4px 12px',
                        backgroundColor: '#f97316',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      Resume
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
