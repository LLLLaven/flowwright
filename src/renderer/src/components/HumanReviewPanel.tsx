import { useState } from 'react'
import { ipc } from '../lib/ipc'
import type { PendingReview } from './RunMonitor'

interface HumanReviewPanelProps {
  review: PendingReview
  onClose: () => void
}

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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 12,
          padding: 24,
          minWidth: 420,
          maxWidth: 560,
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Human Review</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
          Node: {review.nodeId}
        </p>

        <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Deliverable</h3>
        <pre
          style={{
            backgroundColor: '#f3f4f6',
            padding: 12,
            borderRadius: 6,
            fontSize: 12,
            overflow: 'auto',
            maxHeight: 260,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {deliverableStr}
        </pre>

        {showFeedback && (
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>Feedback</label>
            <textarea
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What needs to be changed..."
              style={{
                width: '100%',
                marginTop: 4,
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                fontSize: 13,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          {showFeedback && (
            <button
              onClick={() => setShowFeedback(false)}
              style={secondaryBtnStyle}
            >
              Back
            </button>
          )}
          <button
            onClick={handleReject}
            disabled={loading}
            style={{ ...secondaryBtnStyle, color: '#ef4444', borderColor: '#ef4444' }}
          >
            {showFeedback ? 'Submit Reject' : 'Reject'}
          </button>
          <button
            onClick={handleApprove}
            disabled={loading}
            style={{
              ...secondaryBtnStyle,
              backgroundColor: '#22c55e',
              color: '#fff',
              borderColor: '#22c55e',
            }}
          >
            {loading ? '...' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  )
}

const secondaryBtnStyle: React.CSSProperties = {
  padding: '8px 18px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  backgroundColor: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
}
