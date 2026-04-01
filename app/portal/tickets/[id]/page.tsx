'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Ticket {
  id: string
  ticketNumber: string
  subject: string
  category: string
  priority: string
  status: string
  createdAt: string
  slaResponseDue: string | null
  slaResolutionDue: string | null
  firstRespondedAt: string | null
  resolvedAt: string | null
}

interface Message {
  id: string
  content: string
  contentHtml: string | null
  source: string
  createdAt: string
}

export default function PortalTicketDetailPage() {
  const params = useParams()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  async function loadData() {
    const [ticketRes, messagesRes] = await Promise.all([
      fetch(`/api/portal/tickets/${params.id}`),
      fetch(`/api/portal/tickets/${params.id}/messages`),
    ])
    if (ticketRes.ok) setTicket(await ticketRes.json())
    if (messagesRes.ok) setMessages(await messagesRes.json())
    setLoading(false)
  }

  useEffect(() => { loadData() }, [params.id])

  async function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (!reply.trim()) return
    setSending(true)
    const res = await fetch(`/api/portal/tickets/${params.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: reply }),
    })
    if (res.ok) {
      setReply('')
      await loadData()
    }
    setSending(false)
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading...</p>
  if (!ticket) return <p className="text-gray-400 text-sm">Ticket not found.</p>

  const isOpen = !['resolved', 'closed'].includes(ticket.status)

  return (
    <div className="max-w-3xl">
      <Link href="/portal/tickets" className="text-xs text-gray-400 hover:text-gray-600 mb-3 block">
        &larr; Back to My Tickets
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs text-gray-400 font-mono mb-1">{ticket.ticketNumber}</p>
          <h1 className="text-xl font-bold text-gray-900">{ticket.subject}</h1>
        </div>
        <div className="text-right space-y-1">
          <StatusBadge status={ticket.status} />
          <p className="text-xs text-gray-400">
            {ticket.priority} priority
          </p>
        </div>
      </div>

      {/* SLA info */}
      {ticket.slaResponseDue && !ticket.firstRespondedAt && isOpen && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-sm text-blue-800">
          Expected response by {new Date(ticket.slaResponseDue).toLocaleString()}
        </div>
      )}

      {/* Message thread */}
      <div className="space-y-4 mb-6">
        {messages.map((m) => (
          <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 capitalize">
                {m.source === 'portal' ? 'You' : m.source === 'email' ? 'Email' : 'Support'}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(m.createdAt).toLocaleString()}
              </span>
            </div>
            {m.contentHtml ? (
              <div
                className="text-sm text-gray-700 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: m.contentHtml }}
              />
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{m.content}</p>
            )}
          </div>
        ))}
      </div>

      {/* Reply form */}
      {isOpen && (
        <form onSubmit={handleReply} className="bg-white border border-gray-200 rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Reply</label>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Type your reply..."
          />
          <button
            type="submit"
            disabled={sending || !reply.trim()}
            className="mt-2 px-4 py-2 bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
          >
            {sending ? 'Sending...' : 'Send Reply'}
          </button>
        </form>
      )}

      {!isOpen && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
          This ticket has been resolved.
          {ticket.resolvedAt && ` Resolved on ${new Date(ticket.resolvedAt).toLocaleDateString()}.`}
          {' '}If you need further help, <Link href="/portal/tickets/new" className="underline">submit a new request</Link>.
        </div>
      )}
    </div>
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
