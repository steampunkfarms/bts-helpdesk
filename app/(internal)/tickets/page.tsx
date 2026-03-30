'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Ticket {
  id: string
  ticketNumber: string
  subject: string
  category: string
  priority: string
  status: string
  isInternal: boolean
  source: string
  aiSummary: string | null
  slaResponseBreached: boolean
  slaResolutionBreached: boolean
  clientName: string | null
  createdAt: string
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (priorityFilter) params.set('priority', priorityFilter)
    if (search) params.set('q', search)

    setLoading(true)
    fetch(`/api/tickets?${params}`)
      .then((r) => r.json())
      .then((d) => setTickets(d.tickets ?? []))
      .finally(() => setLoading(false))
  }, [statusFilter, priorityFilter, search])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Tickets</h2>
        <Link
          href="/tickets/new"
          className="px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white rounded-lg text-sm font-medium"
        >
          + New Ticket
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search tickets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:border-orange-600 focus:outline-none w-64"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="awaiting_client">Awaiting Client</option>
          <option value="awaiting_tech">Awaiting Tech</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300"
        >
          <option value="">All priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left px-4 py-3 font-medium">Ticket</th>
              <th className="text-left px-4 py-3 font-medium">Subject</th>
              <th className="text-left px-4 py-3 font-medium">Client</th>
              <th className="text-left px-4 py-3 font-medium">Priority</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : tickets.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No tickets found.</td></tr>
            ) : (
              tickets.map((t) => (
                <tr key={t.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <Link href={`/tickets/${t.id}`} className="text-orange-400 hover:underline font-mono text-xs">
                      {t.ticketNumber}
                    </Link>
                    {t.isInternal && <span className="ml-1 text-gray-600" title="Internal">🔒</span>}
                    {(t.slaResponseBreached || t.slaResolutionBreached) && (
                      <span className="ml-1 text-red-400 text-xs" title="SLA Breached">SLA</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-200 max-w-xs truncate">{t.subject}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{t.clientName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded border ${priorityColors[t.priority] ?? priorityColors.normal}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded ${statusColors[t.status] ?? statusColors.open}`}>
                      {t.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{t.source}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const priorityColors: Record<string, string> = {
  critical: 'bg-red-900/50 text-red-300 border-red-700',
  high: 'bg-orange-900/50 text-orange-300 border-orange-700',
  normal: 'bg-gray-800 text-gray-300 border-gray-700',
  low: 'bg-gray-800 text-gray-500 border-gray-700',
}

const statusColors: Record<string, string> = {
  open: 'bg-blue-900/50 text-blue-300',
  in_progress: 'bg-yellow-900/50 text-yellow-300',
  awaiting_client: 'bg-purple-900/50 text-purple-300',
  awaiting_tech: 'bg-cyan-900/50 text-cyan-300',
  resolved: 'bg-green-900/50 text-green-300',
  closed: 'bg-gray-800 text-gray-500',
}
