import { useState } from 'react'
import { ipc } from '../lib/ipc'
import type { PendingReview } from './RunMonitor'

interface HumanReviewPanelProps {
  review: PendingReview
  onClose: () => void
}

const btnBase =
  'px-4 py-2 rounded-md text-[13px] font-medium transition-colors border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

export default function HumanReviewPanel({ review, onClose }: HumanReviewPanelProps) {
  const [feedback, setFeedback] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleApprove = async () => {
    setLoading(true)
    await ipc.workflow.resume(review.runId, { decision: 'approve' })
    onClose()
  }

  const handleReject = async () => {
    if (showFeedback) {
      setLoading(true)
      await ipc.workflow.resume(review.runId, { decision: 'reject', feedback })
      onClose()
    } else {
      setShowFeedback(true)
    }
  }

  const deliverableStr =
    typeof review.deliverable === 'string'
      ? review.deliverable
      : JSON.stringify(review.deliverable, null, 2)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]">
      <div className="bg-[#1e293b] rounded-xl p-6 min-w-[420px] max-w-[560px] max-h-[80vh] overflow-auto shadow-2xl border border-slate-700">
        <h2 className="text-lg text-slate-100 m-0 mb-1">Human Review</h2>
        <p className="text-[13px] text-slate-500 mb-4">Node: {review.nodeId}</p>

        <h3 className="text-sm text-slate-300 m-0 mb-2">Deliverable</h3>
        <pre className="bg-[#0b1120] p-3 rounded-md text-xs max-h-[260px] overflow-auto whitespace-pre-wrap break-words text-slate-300 font-mono border border-slate-700">
          {deliverableStr}
        </pre>

        {showFeedback && (
          <>
            <label className="text-sm text-slate-300 m-0 mb-2 mt-4 block">Feedback</label>
            <textarea
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What needs to be changed..."
              className="w-full p-2 border border-slate-600 rounded-md bg-[#0b1120] text-[13px] text-slate-200 resize-y outline-none focus:border-indigo-500"
            />
          </>
        )}

        <div className="flex gap-2 mt-4 justify-end">
          {showFeedback && (
            <button
              onClick={() => setShowFeedback(false)}
              className={`${btnBase} border-slate-600 text-slate-300 hover:bg-slate-700`}
            >
              Back
            </button>
          )}
          <button
            onClick={handleReject}
            disabled={loading}
            className={`${btnBase} border-red-500 text-red-400 hover:bg-red-500 hover:text-white`}
          >
            {showFeedback ? 'Submit Reject' : 'Reject'}
          </button>
          <button
            onClick={handleApprove}
            disabled={loading}
            className={`${btnBase} bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600`}
          >
            {loading ? '...' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  )
}
