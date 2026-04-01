'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PortalNewTicketPage() {
  const router = useRouter()
  const [form, setForm] = useState({ subject: '', description: '', priority: 'normal' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/portal/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (res.ok) {
      const ticket = await res.json()
      router.push(`/portal/tickets/${ticket.id}`)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to submit request')
    }
    setSubmitting(false)
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-2">Submit New Request</h1>
      <p className="text-sm text-gray-500 mb-6">
        Describe your issue and we'll get back to you as soon as possible.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
            Subject
          </label>
          <input
            id="subject"
            type="text"
            required
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Brief summary of your issue"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            required
            rows={6}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Describe the issue in detail. Include any error messages, when it started, and what you've already tried."
          />
        </div>

        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
            Priority (optional)
          </label>
          <select
            id="priority"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="low">Low — question or nice-to-have</option>
            <option value="normal">Normal — something isn't working right</option>
            <option value="high">High — significantly impacting work</option>
            <option value="critical">Critical — work completely stopped</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
        >
          {submitting ? 'Submitting...' : 'Submit Request'}
        </button>
      </form>
    </div>
  )
}
