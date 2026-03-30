'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface TicketDetail {
  ticket: {
    id: string
    ticketNumber: string
    subject: string
    category: string
    priority: string
    status: string
    isInternal: boolean
    source: string
    aiCategory: string | null
    aiPriority: string | null
    aiSummary: string | null
    aiDraftResponse: string | null
    aiConfidence: number | null
    slaResponseDue: string | null
    slaResolutionDue: string | null
    firstRespondedAt: string | null
    slaResponseBreached: boolean
    slaResolutionBreached: boolean
    totalMinutes: number
    createdAt: string
  }
  client: { id: string; clientName: string; primaryEmail: string; phone: string | null; slaTier: string } | null
  assignedTo: { id: string; name: string; email: string } | null
  messages: {
    id: string
    content: string
    isInternal: boolean
    source: string
    authorName: string | null
    authorEmail: string | null
    recordingUrl: string | null
    transcription: string | null
    createdAt: string
  }[]
}

const CATEGORIES = [
  'Internet / Network Down', 'Payment Processing Down', 'Well / Water System Down',
  'Power / Generator Down', 'Access Gate / Door Failure', 'Endpoint Monitoring',
  'Network Infrastructure', 'Proactive Maintenance', 'Third-Party Admin', 'Security',
  'Documentation', 'Web Application', 'Hosting / DNS', 'Email / Communications',
  'Internal Task', 'Site Audit', 'Maintenance Window',
]

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<TicketDetail | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    fetch(`/api/tickets/${id}`)
      .then((r) => r.json())
      .then(setData)
  }, [id])

  async function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (!replyContent.trim()) return
    setSending(true)

    await fetch(`/api/tickets/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: replyContent, isInternal: isInternalNote }),
    })

    setReplyContent('')
    // Refresh ticket data
    const res = await fetch(`/api/tickets/${id}`)
    setData(await res.json())
    setSending(false)
  }

  async function updateTicket(field: string, value: string) {
    await fetch(`/api/tickets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    const res = await fetch(`/api/tickets/${id}`)
    setData(await res.json())
  }

  async function approveAiDraft() {
    if (!data?.ticket.aiDraftResponse) return
    setSending(true)
    await fetch(`/api/tickets/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: data.ticket.aiDraftResponse, isInternal: false }),
    })
    const res = await fetch(`/api/tickets/${id}`)
    setData(await res.json())
    setSending(false)
  }

  if (!data) return <div className="text-gray-500">Loading...</div>

  const { ticket, client, assignedTo, messages } = data

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="mb-4">
          <span className="text-gray-500 font-mono text-xs">{ticket.ticketNumber}</span>
          {ticket.isInternal && <span className="ml-2 text-gray-600 text-xs">🔒 Internal</span>}
        </div>
        <h2 className="text-xl font-bold mb-6">{ticket.subject}</h2>

        {/* Messages thread */}
        <div className="space-y-4 mb-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-4 rounded-lg border ${
                msg.isInternal
                  ? 'bg-yellow-900/10 border-yellow-800'
                  : 'bg-gray-900 border-gray-800'
              }`}
            >
              <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
                <span className="font-medium text-gray-300">
                  {msg.authorName ?? msg.source}
                </span>
                {msg.isInternal && (
                  <span className="px-1.5 py-0.5 bg-yellow-900/30 text-yellow-400 rounded text-xs">
                    Internal Note
                  </span>
                )}
                <span>·</span>
                <span>{new Date(msg.createdAt).toLocaleString()}</span>
                <span className="text-gray-600">via {msg.source}</span>
              </div>
              <div className="text-gray-200 text-sm whitespace-pre-wrap">{msg.content}</div>
              {msg.recordingUrl && (
                <a
                  href={`${msg.recordingUrl}.mp3`}
                  className="inline-block mt-2 text-sm text-cyan-400 hover:underline"
                >
                  Listen to Recording
                </a>
              )}
            </div>
          ))}
        </div>

        {/* AI Triage Panel */}
        {ticket.aiSummary && (
          <div className="bg-indigo-900/20 border border-indigo-800 rounded-lg p-4 mb-6">
            <h4 className="text-sm font-medium text-indigo-300 mb-2">
              AI Triage (confidence: {ticket.aiConfidence}%)
            </h4>
            <div className="text-sm text-gray-300 space-y-1">
              <p><span className="text-gray-500">Category:</span> {ticket.aiCategory}</p>
              <p><span className="text-gray-500">Priority:</span> {ticket.aiPriority}</p>
              <p><span className="text-gray-500">Summary:</span> {ticket.aiSummary}</p>
            </div>
            {ticket.aiDraftResponse && (
              <div className="mt-3 pt-3 border-t border-indigo-800">
                <p className="text-xs text-gray-500 mb-2">Draft response:</p>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{ticket.aiDraftResponse}</p>
                <button
                  onClick={approveAiDraft}
                  disabled={sending}
                  className="mt-2 px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white rounded text-sm disabled:opacity-50"
                >
                  Approve & Send
                </button>
              </div>
            )}
          </div>
        )}

        {/* Reply form */}
        <form onSubmit={handleReply} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder={isInternalNote ? 'Internal note (not visible to client)...' : 'Reply to client...'}
            rows={4}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:border-orange-600 focus:outline-none"
          />
          <div className="flex items-center justify-between mt-3">
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={isInternalNote}
                onChange={(e) => setIsInternalNote(e.target.checked)}
                className="rounded"
              />
              Internal note
            </label>
            <button
              type="submit"
              disabled={sending || !replyContent.trim()}
              className="px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {sending ? 'Sending...' : isInternalNote ? 'Add Note' : 'Reply'}
            </button>
          </div>
        </form>
      </div>

      {/* Right sidebar */}
      <div className="w-64 shrink-0 space-y-4">
        {/* Status */}
        <SidebarCard title="Status">
          <select
            value={ticket.status}
            onChange={(e) => updateTicket('status', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="awaiting_client">Awaiting Client</option>
            <option value="awaiting_tech">Awaiting Tech</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </SidebarCard>

        {/* Priority */}
        <SidebarCard title="Priority">
          <select
            value={ticket.priority}
            onChange={(e) => updateTicket('priority', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </SidebarCard>

        {/* Category */}
        <SidebarCard title="Category">
          <select
            value={ticket.category}
            onChange={(e) => updateTicket('category', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </SidebarCard>

        {/* Client info */}
        {client && (
          <SidebarCard title="Client">
            <p className="text-sm text-white">{client.clientName}</p>
            <p className="text-xs text-gray-400">{client.primaryEmail}</p>
            {client.phone && <p className="text-xs text-gray-400">{client.phone}</p>}
            <p className="text-xs text-gray-500 mt-1">SLA: {client.slaTier}</p>
          </SidebarCard>
        )}

        {/* SLA clocks */}
        {(ticket.slaResponseDue || ticket.slaResolutionDue) && (
          <SidebarCard title="SLA">
            {ticket.slaResponseDue && (
              <div className="text-xs mb-1">
                <span className="text-gray-500">Response: </span>
                <span className={ticket.slaResponseBreached ? 'text-red-400' : 'text-green-400'}>
                  {ticket.firstRespondedAt ? 'Met' : new Date(ticket.slaResponseDue).toLocaleString()}
                </span>
              </div>
            )}
            {ticket.slaResolutionDue && (
              <div className="text-xs">
                <span className="text-gray-500">Resolution: </span>
                <span className={ticket.slaResolutionBreached ? 'text-red-400' : 'text-gray-300'}>
                  {new Date(ticket.slaResolutionDue).toLocaleString()}
                </span>
              </div>
            )}
          </SidebarCard>
        )}

        {/* Metadata */}
        <SidebarCard title="Details">
          <p className="text-xs text-gray-400">Source: {ticket.source}</p>
          <p className="text-xs text-gray-400">Time logged: {ticket.totalMinutes} min</p>
          <p className="text-xs text-gray-400">Created: {new Date(ticket.createdAt).toLocaleString()}</p>
        </SidebarCard>
      </div>
    </div>
  )
}

function SidebarCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
      <h4 className="text-xs font-medium text-gray-400 mb-2">{title}</h4>
      {children}
    </div>
  )
}
