'use client'

import { useState } from 'react'

export default function PortalLoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <h1 className="text-xl font-bold text-gray-900 mb-2">BTS Client Portal</h1>
        <p className="text-sm text-gray-500 mb-6">
          Sign in with your email to view tickets, reports, and support resources.
        </p>

        {sent ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800 font-medium">Check your email</p>
            <p className="text-sm text-green-700 mt-1">
              We sent a sign-in link to <strong>{email}</strong>. It expires in 24 hours.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg text-sm"
            >
              {loading ? 'Sending...' : 'Send Sign-In Link'}
            </button>
          </form>
        )}

        <p className="text-xs text-gray-400 mt-6 text-center">
          Need help? Call (760) 782-8476 or email helpdesk@tronboll.us
        </p>
      </div>
    </div>
  )
}
