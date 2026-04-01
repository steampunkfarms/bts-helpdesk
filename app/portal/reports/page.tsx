'use client'

import { useEffect, useState } from 'react'

interface Report {
  id: string
  reportType: string
  periodLabel: string
  pdfUrl: string | null
  sentAt: string | null
}

const TYPE_LABELS: Record<string, string> = {
  monthly_summary: 'Monthly Summary',
  quarterly_priority: 'Quarterly Report',
  semi_annual_savings: 'Savings Analysis',
  annual_review: 'Annual Review',
}

export default function PortalReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portal/reports')
      .then((r) => r.json())
      .then((data) => { setReports(data); setLoading(false) })
  }, [])

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">My Reports</h1>
      <p className="text-sm text-gray-500 mb-6">
        Service reports and cost analyses prepared by your IT team.
      </p>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : reports.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
          No reports available yet. Reports are generated monthly.
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r, i) => (
            <a
              key={r.id}
              href={r.pdfUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className={`block bg-white border rounded-xl p-4 hover:border-orange-300 transition-colors ${
                i === 0 ? 'border-orange-200 ring-1 ring-orange-100' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{r.periodLabel}</p>
                  <p className="text-sm text-gray-500">
                    {TYPE_LABELS[r.reportType] ?? r.reportType}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">
                    {r.sentAt ? new Date(r.sentAt).toLocaleDateString() : ''}
                  </p>
                  {r.pdfUrl && (
                    <p className="text-xs text-orange-700 font-medium mt-1">Download PDF</p>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
