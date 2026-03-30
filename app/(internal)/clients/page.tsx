'use client'

import { useState, useEffect } from 'react'

interface Client {
  id: string
  clientName: string
  primaryEmail: string
  phone: string | null
  slaTier: string
  isActive: boolean
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [slaTier, setSlaTier] = useState('standard')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/clients')
      .then((r) => r.json())
      .then((d) => setClients(d.clients ?? []))
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientName: name,
        primaryEmail: email,
        phone: phone || null,
        slaTier,
      }),
    })

    if (res.ok) {
      const data = await res.json()
      setClients((prev) => [...prev, data.client])
      setName('')
      setEmail('')
      setPhone('')
      setSlaTier('standard')
      setShowForm(false)
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Clients</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white rounded-lg text-sm font-medium"
        >
          {showForm ? 'Cancel' : '+ Add Client'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Client name" value={name} onChange={(e) => setName(e.target.value)} required className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
            <input type="email" placeholder="Primary email" value={email} onChange={(e) => setEmail(e.target.value)} required className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
            <input type="text" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
            <select value={slaTier} onChange={(e) => setSlaTier(e.target.value)} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
              <option value="priority">Priority</option>
              <option value="standard">Standard</option>
              <option value="basic">Basic</option>
            </select>
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white rounded-lg text-sm disabled:opacity-50">
            {saving ? 'Saving...' : 'Add Client'}
          </button>
        </form>
      )}

      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Phone</th>
              <th className="text-left px-4 py-3 font-medium">SLA Tier</th>
              <th className="text-left px-4 py-3 font-medium">Active</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No clients registered yet.</td></tr>
            ) : (
              clients.map((c) => (
                <tr key={c.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-white">{c.clientName}</td>
                  <td className="px-4 py-3 text-gray-300">{c.primaryEmail}</td>
                  <td className="px-4 py-3 text-gray-400">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{c.slaTier}</td>
                  <td className="px-4 py-3">{c.isActive ? '✓' : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
