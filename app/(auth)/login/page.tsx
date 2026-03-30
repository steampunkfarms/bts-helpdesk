'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (res.ok) {
      router.push('/dashboard')
    } else {
      const data = await res.json()
      setError(data.error ?? 'Login failed')
    }
    setLoading(false)
  }

  async function handleMagicLink() {
    setError('')
    setLoading(true)
    await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setMagicLinkSent(true)
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-2">BTS Helpdesk</h1>
        <p className="text-gray-400 text-center text-sm mb-8">Tech & Admin Login</p>

        {magicLinkSent ? (
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 text-center">
            <p className="text-green-300">Check your email for a sign-in link.</p>
          </div>
        ) : (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-orange-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-orange-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-orange-700 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-700" /></div>
              <div className="relative flex justify-center"><span className="bg-gray-950 px-2 text-gray-500 text-xs">OR</span></div>
            </div>

            <button
              type="button"
              onClick={handleMagicLink}
              disabled={loading || !email}
              className="w-full py-2 border border-gray-700 hover:border-gray-500 text-gray-300 rounded-lg text-sm disabled:opacity-50"
            >
              Send Magic Link
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
