import { useState, useEffect } from 'react'
import { ipc } from '../lib/ipc'
import type { RunRecord, RunStatus } from '../../../shared/types'

const STATUS_COLORS: Record<RunStatus, string> = {
  running: 'bg-blue-500',
  paused: 'bg-orange-500',
  completed: 'bg-emerald-500',
  error: 'bg-red-500',
  aborted: 'bg-slate-400',
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
    <div className="p-4 overflow-auto">
      <h2 className="text-lg font-semibold text-slate-200 mt-0">Run History</h2>
      {records.length === 0 ? (
        <p className="text-slate-500">No runs yet.</p>
      ) : (
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b-2 border-slate-600">
              <th className="px-3 py-2 text-left text-slate-400 font-medium">Run ID</th>
              <th className="px-3 py-2 text-left text-slate-400 font-medium">Graph</th>
              <th className="px-3 py-2 text-left text-slate-400 font-medium">Status</th>
              <th className="px-3 py-2 text-left text-slate-400 font-medium">Started</th>
              <th className="px-3 py-2 text-left text-slate-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.runId} className="border-b border-slate-700">
                <td className="px-3 py-2 font-mono">{shortId(r.runId)}</td>
                <td className="px-3 py-2 font-mono">{r.graphId}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-white text-xs font-semibold ${STATUS_COLORS[r.status]}`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2">{formatDate(r.startedAt)}</td>
                <td className="px-3 py-2">
                  {r.status === 'paused' && (
                    <button
                      type="button"
                      onClick={() => handleResume(r.runId)}
                      className="px-3 py-1 bg-orange-500 text-white border-none rounded text-xs cursor-pointer"
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
