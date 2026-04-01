'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface ReportDetail {
  id: string
  clientId: string
  clientName: string | null
  reportType: string
  periodStart: string
  periodEnd: string
  periodLabel: string
  pdfUrl: string | null
  reportData: Record<string, unknown> | null
  status: string
  notes: string | null
  reviewedBy: string | null
  generatedAt: string
  sentAt: string | null
}

const TYPE_LABELS: Record<string, string> = {
  monthly_summary: 'Monthly Service Summary',
  quarterly_priority: 'Quarterly Priority Report',
  semi_annual_savings: 'Semi-Annual Savings Analysis',
  annual_review: 'Annual Review',
}

export default function ReportDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [sending, setSending] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  async function loadReport() {
    const res = await fetch(`/api/reports/${params.id}`)
    if (res.ok) {
      const data = await res.json()
      setReport(data)
      setNotes(data.notes ?? '')
    }
    setLoading(false)
  }

  useEffect(() => { loadReport() }, [params.id])

  async function handleSend() {
    if (!confirm('Send this report to the client? This cannot be undone.')) return
    setSending(true)
    const res = await fetch(`/api/reports/${params.id}/send`, { method: 'POST' })
    if (res.ok) {
      await loadReport()
    } else {
      const err = await res.json()
      alert(`Failed to send: ${err.error ?? 'Unknown error'}`)
    }
    setSending(false)
  }

  async function handleRegenerate() {
    if (!confirm('Regenerate this report? The current version will be replaced.')) return
    setRegenerating(true)
    const res = await fetch(`/api/reports/${params.id}/regenerate`, { method: 'POST' })
    if (res.ok) {
      await loadReport()
    } else {
      alert('Regeneration failed — check logs.')
    }
    setRegenerating(false)
  }

  async function handleSaveNotes() {
    await fetch(`/api/reports/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
  }

  if (loading) return <div className="text-gray-400">Loading report...</div>
  if (!report) return <div className="text-gray-400">Report not found.</div>

  const data = report.reportData as Record<string, unknown> | null

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button onClick={() => router.push('/reports')} className="text-xs text-gray-400 hover:text-white mb-2 block">
            &larr; Back to Reports
          </button>
          <h2 className="text-xl font-bold">{TYPE_LABELS[report.reportType] ?? report.reportType}</h2>
          <p className="text-sm text-gray-400 mt-1">
            {report.clientName} / {report.periodLabel}
          </p>
        </div>
        <div className="flex gap-2">
          {report.status === 'draft' && (
            <>
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="px-3 py-2 text-xs border border-gray-700 hover:border-gray-500 text-gray-300 rounded-lg disabled:opacity-50"
              >
                {regenerating ? 'Regenerating...' : 'Regenerate'}
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="px-3 py-2 text-xs bg-orange-700 hover:bg-orange-600 text-white rounded-lg disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Approve & Send'}
              </button>
            </>
          )}
          {report.status === 'sent' && (
            <span className="px-3 py-2 text-xs bg-green-900/50 text-green-300 rounded-lg">
              Sent {report.sentAt ? new Date(report.sentAt).toLocaleDateString() : ''}
            </span>
          )}
        </div>
      </div>

      {/* PDF Preview */}
      {report.pdfUrl && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-300">PDF Preview</h3>
            <a
              href={report.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-orange-400 hover:text-orange-300"
            >
              Open in new tab
            </a>
          </div>
          <iframe
            src={report.pdfUrl}
            className="w-full h-[600px] bg-white rounded-lg border border-gray-800"
          />
        </div>
      )}

      {/* Data Summary */}
      {data && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <DataCard label="Total Tickets" value={String(data.totalTickets ?? 0)} />
          <DataCard label="Proactive" value={String(data.proactiveTickets ?? 0)} />
          <DataCard label="Client-Initiated" value={String(data.clientInitiated ?? 0)} />
          <DataCard label="SLA Breaches" value={String((data.slaResponseBreached as number ?? 0) + (data.slaResolutionBreached as number ?? 0))} />
        </div>
      )}

      {/* Notes */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-300 mb-2">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleSaveNotes}
          rows={3}
          className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white"
          placeholder="Add notes before sending..."
        />
        <p className="text-xs text-gray-500 mt-1">Auto-saves on blur</p>
      </div>

      {/* Metadata */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>Generated: {report.generatedAt ? new Date(report.generatedAt).toLocaleString() : '-'}</p>
        {report.reviewedBy && <p>Reviewed by: {report.reviewedBy}</p>}
        {report.sentAt && <p>Sent: {new Date(report.sentAt).toLocaleString()}</p>}
      </div>
    </div>
  )
}

function DataCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="text-lg font-bold text-white">{value}</p>
    </div>
  )
}
