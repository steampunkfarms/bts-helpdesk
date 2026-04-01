'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Report {
  id: string
  clientId: string
  clientName: string | null
  reportType: string
  periodLabel: string
  status: string
  pdfUrl: string | null
  generatedAt: string
  sentAt: string | null
}

const TYPE_LABELS: Record<string, string> = {
  monthly_summary: 'Monthly',
  quarterly_priority: 'Quarterly',
  semi_annual_savings: 'Savings',
  annual_review: 'Annual',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-900/50 text-yellow-300',
  approved: 'bg-blue-900/50 text-blue-300',
  sent: 'bg-green-900/50 text-green-300',
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'draft' | 'sent'>('all')

  async function loadReports() {
    const url = filter === 'all' ? '/api/reports' : `/api/reports?status=${filter}`
    const res = await fetch(url)
    setReports(await res.json())
    setLoading(false)
  }

  useEffect(() => { loadReports() }, [filter])

  const pending = reports.filter((r) => r.status === 'draft').length
  const sent = reports.filter((r) => r.status === 'sent').length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Reports</h2>
          <p className="text-sm text-gray-400 mt-1">
            {pending} pending review / {sent} sent this period
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(['all', 'draft', 'sent'] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setLoading(true); setFilter(f) }}
            className={`px-3 py-1.5 text-xs rounded-md border ${
              filter === f
                ? 'bg-orange-700 border-orange-600 text-white'
                : 'border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-400">Loading reports...</div>
      ) : (
        <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-left px-4 py-3 font-medium">Client</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Period</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Generated</th>
                <th className="text-left px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No reports yet. Reports generate on the 5th of each month.
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-gray-200">{r.clientName ?? 'Unknown'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 text-xs rounded bg-gray-800 text-gray-300">
                        {TYPE_LABELS[r.reportType] ?? r.reportType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{r.periodLabel}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded ${STATUS_COLORS[r.status] ?? 'bg-gray-800 text-gray-400'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {r.generatedAt ? new Date(r.generatedAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 space-x-2">
                      <Link
                        href={`/reports/${r.id}`}
                        className="text-xs text-orange-400 hover:text-orange-300"
                      >
                        Review
                      </Link>
                      {r.pdfUrl && (
                        <a
                          href={r.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-400 hover:text-white"
                        >
                          PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
