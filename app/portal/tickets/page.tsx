'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Ticket {
  id: string
  ticketNumber: string
  subject: string
  priority: string
  status: string
  createdAt: string
}

export default function PortalTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open')

  useEffect(() => {
    fetch('/api/portal/tickets')
      .then((r) => r.json())
      .then((data) => { setTickets(data); setLoading(false) })
  }, [])

  const filtered = filter === 'all'
    ? tickets
    : filter === 'open'
      ? tickets.filter((t) => !['resolved', 'closed'].includes(t.status))
      : tickets.filter((t) => ['resolved', 'closed'].includes(t.status))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">My Tickets</h1>
        <Link
          href="/portal/tickets/new"
          className="px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white text-sm font-medium rounded-lg"
        >
          + New Request
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        {(['open', 'resolved', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-full border ${
              filter === f
                ? 'bg-orange-700 border-orange-600 text-white'
                : 'border-gray-300 text-gray-500 hover:text-gray-700'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <p className="px-5 py-8 text-center text-gray-400 text-sm">No tickets found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500">
                  <th className="text-left px-5 py-3 font-medium">Ticket</th>
                  <th className="text-left px-5 py-3 font-medium">Subject</th>
                  <th className="text-left px-5 py-3 font-medium">Priority</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link href={`/portal/tickets/${t.id}`} className="text-orange-700 hover:underline font-mono text-xs">
                        {t.ticketNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-900">{t.subject}</td>
                    <td className="px-5 py-3">
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-50 text-red-700',
    high: 'bg-orange-50 text-orange-700',
    normal: 'bg-gray-100 text-gray-600',
    low: 'bg-gray-50 text-gray-400',
  }
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${colors[priority] ?? colors.normal}`}>
      {priority}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: 'bg-blue-50 text-blue-700',
    in_progress: 'bg-yellow-50 text-yellow-700',
    awaiting_client: 'bg-purple-50 text-purple-700',
    awaiting_tech: 'bg-cyan-50 text-cyan-700',
    resolved: 'bg-green-50 text-green-700',
    closed: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${colors[status] ?? colors.open}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}
