'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const CATEGORIES = [
  'Internet / Network Down', 'Payment Processing Down', 'Well / Water System Down',
  'Power / Generator Down', 'Access Gate / Door Failure', 'Endpoint Monitoring',
  'Network Infrastructure', 'Proactive Maintenance', 'Third-Party Admin', 'Security',
  'Documentation', 'Web Application', 'Hosting / DNS', 'Email / Communications',
  'Internal Task', 'Site Audit', 'Maintenance Window',
]

interface Client {
  id: string
  clientName: string
}

export default function NewTicketPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('Internal Task')
  const [priority, setPriority] = useState('normal')
  const [clientId, setClientId] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/clients')
      .then((r) => r.json())
      .then((d) => setClients(d.clients ?? []))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject,
        category,
        priority,
        clientId: clientId || null,
        isInternal,
        description,
      }),
    })

    if (res.ok) {
      const data = await res.json()
      router.push(`/tickets/${data.ticket.id}`)
    }
    setSubmitting(false)
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold mb-6">New Ticket</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-orange-600 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Client (optional)</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
          >
            <option value="">None (internal ticket)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.clientName}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={isInternal}
            onChange={(e) => setIsInternal(e.target.checked)}
            className="rounded"
          />
          Internal ticket (never visible to client)
        </label>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white resize-none focus:border-orange-600 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !subject}
          className="px-6 py-2 bg-orange-700 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create Ticket'}
        </button>
      </form>
    </div>
  )
}
